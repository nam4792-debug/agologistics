const pool = require('../config/database');
const notificationService = require('./notificationService');

class WorkflowService {
    /**
     * Handle sales confirmation of a booking
     * This triggers automatic task creation and notifications
     */
    async confirmBooking(bookingId, userId, io) {
        console.log(`📋 Processing sales confirmation for booking ${bookingId}`);

        try {
            // 1. Get booking details
            const { rows: bookings } = await pool.query(
                `SELECT b.*, bd.cut_off_si, bd.cut_off_vgm, bd.cut_off_cy
         FROM bookings b
         LEFT JOIN booking_deadlines bd ON b.id = bd.booking_id
         WHERE b.id = $1`,
                [bookingId]
            );

            if (bookings.length === 0) {
                throw new Error('Booking not found');
            }

            const booking = bookings[0];

            // Guard: only PENDING bookings can be confirmed
            if (booking.status !== 'PENDING') {
                throw new Error(`Cannot confirm booking with status "${booking.status}". Only PENDING bookings can be confirmed.`);
            }

            // 2. Update booking status
            await pool.query(
                `UPDATE bookings SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`,
                [bookingId]
            );

            // 2.5 Auto-create shipment if booking doesn't have one
            let shipmentId = booking.shipment_id;
            if (!shipmentId) {
                const shipmentNumber = `SH-${Date.now().toString(36).toUpperCase()}`;
                const { rows: newShipment } = await pool.query(
                    `INSERT INTO shipments 
                    (shipment_number, type, status, origin_port, destination_port, 
                     cargo_description, container_count, container_type, etd, eta, 
                     incoterm, forwarder_id, customer_id, created_by)
                    VALUES ($1, $2, 'BOOKED', $3, $4, $5, $6, $7, $8, $9, 'FOB', $10, $11, $12)
                    RETURNING id`,
                    [
                        shipmentNumber,
                        booking.type,
                        booking.origin_port,
                        booking.destination_port,
                        `Booking ${booking.booking_number}`,
                        booking.container_count || 1,
                        booking.container_type || '40GP',
                        booking.etd,
                        booking.eta,
                        booking.forwarder_id || null,
                        booking.customer_id || null,
                        userId
                    ]
                );

                if (newShipment.length > 0) {
                    shipmentId = newShipment[0].id;
                    // Link booking to new shipment
                    await pool.query(
                        `UPDATE bookings SET shipment_id = $1 WHERE id = $2`,
                        [shipmentId, bookingId]
                    );
                    console.log(`✅ Auto-created shipment ${shipmentNumber} for booking ${booking.booking_number}`);
                }
            } else {
                // Sync shipment status to BOOKED when booking is confirmed
                await pool.query(
                    `UPDATE shipments SET status = 'BOOKED', 
                     forwarder_id = COALESCE(forwarder_id, $1),
                     updated_at = NOW() WHERE id = $2`,
                    [booking.forwarder_id || null, shipmentId]
                );
            }

            // 3. Update booking_deadlines
            await pool.query(
                `UPDATE booking_deadlines 
         SET sales_confirmed = true,
             sales_confirmed_at = NOW(),
             sales_confirmed_by = $1,
             status = 'CONFIRMED',
             updated_at = NOW()
         WHERE booking_id = $2`,
                [userId, bookingId]
            );

            // 4. Create "Truck Dispatch" task
            // Deadline: CY cut-off minus 6 hours, or ETD, or 7 days from now
            let truckDeadline;
            if (booking.cut_off_cy) {
                const truckDate = new Date(booking.cut_off_cy);
                truckDate.setHours(truckDate.getHours() - 6);
                truckDeadline = truckDate.toISOString();
            } else if (booking.etd) {
                truckDeadline = new Date(booking.etd).toISOString();
            } else {
                const defaultDate = new Date();
                defaultDate.setDate(defaultDate.getDate() + 7);
                truckDeadline = defaultDate.toISOString();
            }

            const { rows: truckTask } = await pool.query(
                `INSERT INTO tasks 
         (booking_id, task_type, title, description, deadline, priority, status)
         VALUES ($1, 'TRUCK_DISPATCH', $2, $3, $4, 'HIGH', 'PENDING')
         RETURNING *`,
                [
                    bookingId,
                    `Arrange truck dispatch for booking ${booking.booking_number}`,
                    `Schedule truck for container stuffing before CY cut-off. Route: ${booking.route || 'N/A'}. Vessel: ${booking.vessel_flight || 'N/A'}`,
                    truckDeadline,
                ]
            );

            // 5. Create "Document Prep" task
            // Deadline: SI cut-off, or ETD, or 7 days from now
            let docDeadline;
            if (booking.cut_off_si) {
                docDeadline = booking.cut_off_si;
            } else if (booking.etd) {
                docDeadline = new Date(booking.etd).toISOString();
            } else {
                const defaultDate = new Date();
                defaultDate.setDate(defaultDate.getDate() + 7);
                docDeadline = defaultDate.toISOString();
            }

            const { rows: docTask } = await pool.query(
                `INSERT INTO tasks 
         (booking_id, task_type, title, description, deadline, priority, status)
         VALUES ($1, 'DOCUMENT_PREP', $2, $3, $4, 'HIGH', 'PENDING')
         RETURNING *`,
                [
                    bookingId,
                    `Prepare documents for booking ${booking.booking_number}`,
                    `Submit Invoice, Packing List, Draft B/L to forwarder before SI cut-off`,
                    docDeadline,
                ]
            );

            // 6. Send notification
            const deadlineStr = truckDeadline
                ? new Date(truckDeadline).toLocaleString('en-US')
                : 'TBD';
            await notificationService.send(
                {
                    type: 'SALES_CONFIRMED',
                    priority: 'HIGH',
                    title: `✅ Booking ${booking.booking_number} confirmed by sales`,
                    message: `Truck dispatch needed before ${deadlineStr}. Route: ${booking.route || 'N/A'}`,
                    bookingId: bookingId,
                    actionUrl: `/bookings/${bookingId}`,
                    actionLabel: 'Dispatch Truck Now',
                },
                io
            );

            console.log(`✅ Booking ${booking.booking_number} confirmed with tasks created`);

            return {
                booking,
                tasks: [truckTask[0], docTask[0]],
            };
        } catch (error) {
            console.error('❌ Error confirming booking:', error);
            throw error;
        }
    }

    /**
     * Complete a task
     */
    async completeTask(taskId, userId, io) {
        try {
            const { rows } = await pool.query(
                `UPDATE tasks 
         SET status = 'COMPLETED',
             completed_at = NOW(),
             completed_by = $1
         WHERE id = $2
         RETURNING *`,
                [userId, taskId]
            );

            if (rows.length === 0) {
                throw new Error('Task not found');
            }

            const task = rows[0];

            // Send notification
            await notificationService.send(
                {
                    type: 'TASK_COMPLETED',
                    priority: 'LOW',
                    title: `✅ Task completed: ${task.title}`,
                    message: `Task ${task.task_type} has been completed`,
                    bookingId: task.booking_id,
                },
                io
            );

            return task;
        } catch (error) {
            console.error('❌ Error completing task:', error);
            throw error;
        }
    }

    /**
     * Create truck dispatch record
     */
    async createTruckDispatch(data, userId, io) {
        const {
            bookingId,
            taskId,
            truckCompany,
            driverName,
            driverPhone,
            truckPlate,
            pickupDatetime,
            warehouseLocation,
            notes,
        } = data;

        try {
            // Create dispatch record
            const { rows } = await pool.query(
                `INSERT INTO truck_dispatches 
         (booking_id, task_id, truck_company, driver_name, driver_phone, 
          truck_plate, pickup_datetime, warehouse_location, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
                [
                    bookingId,
                    taskId,
                    truckCompany,
                    driverName,
                    driverPhone,
                    truckPlate,
                    pickupDatetime,
                    warehouseLocation,
                    notes,
                    userId,
                ]
            );

            const dispatch = rows[0];

            // Complete the associated task if exists
            if (taskId) {
                await this.completeTask(taskId, userId, io);
            }

            // Get booking info for notification
            const { rows: bookings } = await pool.query(
                'SELECT booking_number FROM bookings WHERE id = $1',
                [bookingId]
            );

            // Send notification
            await notificationService.send(
                {
                    type: 'TRUCK_DISPATCHED',
                    priority: 'MEDIUM',
                    title: `🚛 Truck dispatched: ${truckPlate}`,
                    message: `Booking ${bookings[0]?.booking_number || bookingId}. Driver: ${driverName}. Pickup: ${new Date(pickupDatetime).toLocaleString('en-US')}`,
                    bookingId: bookingId,
                    actionUrl: `/bookings/${bookingId}`,
                    actionLabel: 'View Details',
                },
                io
            );

            console.log(`✅ Truck dispatched: ${truckPlate} for booking ${bookingId}`);

            return dispatch;
        } catch (error) {
            console.error('❌ Error creating truck dispatch:', error);
            throw error;
        }
    }
}

module.exports = new WorkflowService();
