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
                     incoterm, created_by)
                    VALUES ($1, $2, 'BOOKING_CONFIRMED', $3, $4, $5, $6, $7, $8, $9, 'FOB', $10)
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
                // Update existing shipment status to BOOKING_CONFIRMED
                await pool.query(
                    `UPDATE shipments SET status = 'BOOKING_CONFIRMED', updated_at = NOW() WHERE id = $1`,
                    [shipmentId]
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
                    `Điều xe cho booking ${booking.booking_number}`,
                    `Cần điều xe để đóng hàng trước cut-off CY. Tuyến: ${booking.route || 'N/A'}. Tàu: ${booking.vessel_flight || 'N/A'}`,
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
                    `Chuẩn bị chứng từ cho booking ${booking.booking_number}`,
                    `Cần gửi Invoice, Packing List, Draft B/L cho forwarder trước cut-off SI`,
                    docDeadline,
                ]
            );

            // 6. Send notification
            const deadlineStr = truckDeadline
                ? new Date(truckDeadline).toLocaleString('vi-VN')
                : 'TBD';
            await notificationService.send(
                {
                    type: 'SALES_CONFIRMED',
                    priority: 'HIGH',
                    title: `✅ Sales đã confirm booking ${booking.booking_number}`,
                    message: `Cần điều xe trước ${deadlineStr}. Tuyến: ${booking.route || 'N/A'}`,
                    bookingId: bookingId,
                    actionUrl: `/bookings/${bookingId}`,
                    actionLabel: 'Điều Xe Ngay',
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
                    title: `✅ Task hoàn thành: ${task.title}`,
                    message: `Task ${task.task_type} đã được hoàn thành`,
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
                    title: `🚛 Xe đã được điều: ${truckPlate}`,
                    message: `Booking ${bookings[0]?.booking_number || bookingId}. Tài xế: ${driverName}. Lấy hàng: ${new Date(pickupDatetime).toLocaleString('vi-VN')}`,
                    bookingId: bookingId,
                    actionUrl: `/bookings/${bookingId}`,
                    actionLabel: 'Xem Chi Tiết',
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
