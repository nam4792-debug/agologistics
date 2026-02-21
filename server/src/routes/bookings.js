const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const workflowService = require('../services/workflowService');
const { authenticateToken } = require('./auth');
const auditService = require('../services/auditService');
const creditService = require('../services/creditService');
const { validate, RULES } = require('../middleware/validator');

// Get all bookings
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, type, unlinked } = req.query;

        let query = `
      SELECT b.*, 
             bd.cut_off_si, bd.cut_off_vgm, bd.cut_off_cy,
             bd.sales_confirmed, bd.status as deadline_status,
             f.company_name as forwarder_name,
             s.shipment_number
      FROM bookings b
      LEFT JOIN booking_deadlines bd ON b.id = bd.booking_id
      LEFT JOIN forwarders f ON b.forwarder_id = f.id
      LEFT JOIN shipments s ON b.shipment_id = s.id
      WHERE 1=1
    `;

        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND b.status = $${paramIndex++}`;
            params.push(status);
        }

        if (type) {
            query += ` AND b.type = $${paramIndex++}`;
            params.push(type);
        }

        if (unlinked === 'true') {
            query += " AND b.shipment_id IS NULL AND b.status NOT IN ('CANCELLED')";
        }

        query += ' ORDER BY b.created_at DESC';

        const { rows } = await pool.query(query, params);
        res.json({ bookings: rows });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get forwarders list for dropdown
router.get('/forwarders', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, company_name, contact_name, email, phone
            FROM forwarders
            WHERE status = 'ACTIVE' OR status IS NULL
            ORDER BY company_name
        `);
        res.json({ forwarders: rows });
    } catch (error) {
        console.error('Error fetching forwarders:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single booking
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT b.*, 
              bd.cut_off_si, bd.cut_off_vgm, bd.cut_off_cy,
              bd.sales_confirmed, bd.sales_confirmed_at,
              f.company_name as forwarder_name, f.contact_name as forwarder_contact,
              s.shipment_number, s.customer_id
       FROM bookings b
       LEFT JOIN booking_deadlines bd ON b.id = bd.booking_id
       LEFT JOIN forwarders f ON b.forwarder_id = f.id
       LEFT JOIN shipments s ON b.shipment_id = s.id
       WHERE b.id = $1`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Get tasks for this booking
        const { rows: tasks } = await pool.query(
            'SELECT * FROM tasks WHERE booking_id = $1 ORDER BY deadline',
            [req.params.id]
        );

        // Get truck dispatches
        const { rows: dispatches } = await pool.query(
            'SELECT * FROM truck_dispatches WHERE booking_id = $1 ORDER BY created_at DESC',
            [req.params.id]
        );

        res.json({
            booking: rows[0],
            tasks,
            dispatches,
        });
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create booking
router.post('/', authenticateToken, validate(RULES.booking.create), async (req, res) => {
    try {
        // Accept both snake_case and camelCase
        const body = req.body;
        const bookingNumber = body.booking_number || body.bookingNumber || `BK-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
        const shipmentId = body.shipment_id || body.shipmentId || null;
        const forwarderId = body.forwarder_id || body.forwarderId || null;
        const type = body.type || 'FCL';
        const vesselFlight = body.vessel_flight || body.vesselFlight || '';
        const voyageNumber = body.voyage_number || body.voyageNumber || '';
        const originPort = body.origin_port || body.originPort || 'Ho Chi Minh City';
        const destinationPort = body.destination_port || body.destinationPort || '';
        // Auto-generate route from ports if not explicitly provided
        const route = body.route || (originPort && destinationPort ? `${originPort} → ${destinationPort}` : '');
        const containerType = body.container_type || body.containerType || '40GP';
        const containerCount = parseInt(body.container_count || body.containerCount) || 1;
        const etd = body.etd || null;
        const eta = body.eta || null;
        const freightRate = parseFloat(body.freight_rate_usd || body.freightRate) || 0;
        const notes = body.notes || null;
        const shippingLine = body.shipping_line || body.shippingLine || null;

        // Deadlines
        const cutOffSI = body.cut_off_si || body.cutOffSI || null;
        const cutOffVGM = body.cut_off_vgm || body.cutOffVGM || null;
        const cutOffCY = body.cut_off_cy || body.cutOffCY || null;

        // Generate UUID
        const id = uuidv4();

        // Insert booking
        await pool.query(
            `INSERT INTO bookings 
       (id, booking_number, shipment_id, forwarder_id, type, status, vessel_flight, voyage_number,
        route, origin_port, destination_port, container_type, container_count,
        etd, eta, freight_rate_usd, notes, shipping_line)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
                id,
                bookingNumber,
                shipmentId,
                forwarderId,
                type,
                vesselFlight,
                voyageNumber,
                route,
                originPort,
                destinationPort,
                containerType,
                containerCount,
                etd,
                eta,
                freightRate,
                notes,
                shippingLine,
            ]
        );

        // Insert deadlines if any deadline is provided
        if (cutOffSI || cutOffVGM || cutOffCY) {
            const dlId = uuidv4();
            await pool.query(
                `INSERT INTO booking_deadlines 
         (id, booking_id, cut_off_si, cut_off_vgm, cut_off_cy)
         VALUES ($1, $2, $3, $4, $5)`,
                [dlId, id, cutOffSI || null, cutOffVGM || null, cutOffCY || null]
            );
        }

        // Get the created booking
        const { rows } = await pool.query(
            'SELECT * FROM bookings WHERE id = $1',
            [id]
        );

        const created = rows[0] || { id, booking_number: bookingNumber };

        // Audit trail
        try {
            auditService.log('booking', id, 'CREATE', req.user?.userId || null, {
                booking_number: bookingNumber,
                type,
                forwarder_id: forwarderId,
            });
        } catch (e) { }

        res.status(201).json({ booking: created });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Sales confirm booking (triggers workflow)
router.post('/:id/confirm', authenticateToken, async (req, res) => {
    try {
        const io = req.app.get('io');

        let userId = req.user?.id || 'demo-user';
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            if (token) {
                try {
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                    userId = decoded.userId;
                } catch (e) {
                    // Token invalid, use default user
                }
            }
        }

        const result = await workflowService.confirmBooking(
            req.params.id,
            userId,
            io
        );

        // Credit check — warning only, does not block
        let creditWarning = null;
        if (result.booking?.forwarder_id) {
            creditWarning = await creditService.checkCreditBeforeBooking(
                result.booking.forwarder_id,
                parseFloat(result.booking.freight_rate_usd) || 0
            );
        }

        res.json({
            message: 'Booking confirmed successfully',
            ...result,
            creditWarning,
        });

        // Gap #9: Log audit trail
        auditService.log('booking', req.params.id, 'CONFIRM', userId, {
            status: { old: 'PENDING', new: 'CONFIRMED' },
            booking_number: result.booking?.booking_number,
        });
    } catch (error) {
        console.error('Error confirming booking:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Cancel booking (preserves record with reason)
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const { reason } = req.body;
        const bookingId = req.params.id;

        // Verify booking exists and is not already cancelled
        const { rows: existing } = await pool.query(
            'SELECT * FROM bookings WHERE id = $1', [bookingId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        if (existing[0].status === 'CANCELLED') {
            return res.status(400).json({ error: 'Booking is already cancelled' });
        }
        if (['COMPLETED', 'USED'].includes(existing[0].status)) {
            return res.status(400).json({ error: `Cannot cancel a ${existing[0].status} booking. It has already been completed.` });
        }

        // Update booking status to CANCELLED with reason in notes
        const cancelNote = `[CANCELLED ${new Date().toISOString()}] ${reason || 'No reason provided'}`;
        await pool.query(
            `UPDATE bookings SET status = 'CANCELLED', 
             notes = CASE WHEN notes IS NULL THEN $1 ELSE notes || E'\\n' || $1 END,
             updated_at = NOW() WHERE id = $2`,
            [cancelNote, bookingId]
        );

        // Cancel related PENDING tasks
        await pool.query(
            `UPDATE tasks SET status = 'CANCELLED' WHERE booking_id = $1 AND status = 'PENDING'`,
            [bookingId]
        );

        // Cancel related SCHEDULED dispatches
        await pool.query(
            `UPDATE truck_dispatches SET status = 'CANCELLED' WHERE booking_id = $1 AND status = 'SCHEDULED'`,
            [bookingId]
        );

        // If booking was ALLOCATED to a shipment, unlink it
        if (existing[0].shipment_id) {
            await pool.query(
                'UPDATE bookings SET shipment_id = NULL WHERE id = $1',
                [bookingId]
            );
        }

        // Send notification
        const io = req.app.get('io');
        if (io) {
            const notificationService = require('../services/notificationService');
            await notificationService.send({
                type: 'BOOKING_CANCELLED',
                priority: 'HIGH',
                title: `❌ Booking ${existing[0].booking_number} has been cancelled`,
                message: `Reason: ${reason || 'No reason provided'}. Route: ${existing[0].route || 'N/A'}`,
                bookingId: bookingId,
                actionUrl: `/bookings/${bookingId}`,
                actionLabel: 'View Details',
            }, io);
        }

        res.json({ message: 'Booking cancelled successfully', bookingId });

        // Gap #9: Log audit trail
        auditService.log('booking', bookingId, 'CANCEL', null, {
            status: { old: existing[0].status, new: 'CANCELLED' },
            booking_number: existing[0].booking_number,
            reason: reason || 'No reason provided',
        });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const updates = req.body;
        const fields = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = [
            'status',
            'vessel_flight',
            'voyage_number',
            'route',
            'origin_port',
            'destination_port',
            'etd',
            'eta',
            'freight_rate_usd',
            'notes',
            'forwarder_id',
            'container_type',
            'container_count',
            'shipping_line',
            'type',
        ];

        // Separate deadline fields from booking fields
        const deadlineFields = {};
        const deadlineKeys = ['cut_off_si', 'cut_off_vgm', 'cut_off_cy'];

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
            if (deadlineKeys.includes(snakeKey)) {
                deadlineFields[snakeKey] = value || null;
            } else if (allowedFields.includes(snakeKey)) {
                fields.push(`${snakeKey} = $${paramIndex++}`);
                values.push(value);
            }
        }

        // Update booking fields
        if (fields.length > 0) {
            fields.push(`updated_at = NOW()`);
            values.push(req.params.id);

            await pool.query(
                `UPDATE bookings SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
                values
            );
        }

        // Update booking deadlines if any deadline fields provided
        if (Object.keys(deadlineFields).length > 0) {
            const dlFields = [];
            const dlValues = [];
            let dlIdx = 1;

            for (const [key, value] of Object.entries(deadlineFields)) {
                dlFields.push(`${key} = $${dlIdx++}`);
                dlValues.push(value);
            }
            dlValues.push(req.params.id);

            // Try UPDATE first, INSERT if no row exists
            const updateResult = await pool.query(
                `UPDATE booking_deadlines SET ${dlFields.join(', ')} WHERE booking_id = $${dlIdx}`,
                dlValues
            );

            if (updateResult.rowCount === 0) {
                // Insert new deadline row
                await pool.query(
                    `INSERT INTO booking_deadlines (booking_id, cut_off_si, cut_off_vgm, cut_off_cy)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (booking_id) DO UPDATE SET
                       cut_off_si = EXCLUDED.cut_off_si,
                       cut_off_vgm = EXCLUDED.cut_off_vgm,
                       cut_off_cy = EXCLUDED.cut_off_cy`,
                    [req.params.id, deadlineFields.cut_off_si || null, deadlineFields.cut_off_vgm || null, deadlineFields.cut_off_cy || null]
                );
            }
        }

        // Fetch updated booking with deadlines
        const { rows } = await pool.query(
            `SELECT b.*, bd.cut_off_si, bd.cut_off_vgm, bd.cut_off_cy
             FROM bookings b
             LEFT JOIN booking_deadlines bd ON b.id = bd.booking_id
             WHERE b.id = $1`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Audit trail
        try {
            auditService.log('booking', req.params.id, 'UPDATE', req.user?.userId || null, {
                booking_number: rows[0].booking_number,
                updated_fields: Object.keys(updates),
            });
        } catch (e) {
            console.error('Audit log failed (non-fatal):', e.message);
        }

        // Emit real-time event
        const io = req.app.get('io');
        if (io) io.emit('booking:updated', rows[0]);

        res.json({ booking: rows[0] });
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete booking (only PENDING bookings can be hard-deleted)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const bookingId = req.params.id;

        // Check booking exists and is PENDING
        const { rows: existing } = await pool.query(
            'SELECT status, booking_number FROM bookings WHERE id = $1', [bookingId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        if (existing[0].status !== 'PENDING') {
            return res.status(400).json({
                error: `Cannot delete a ${existing[0].status} booking. Only PENDING bookings can be deleted. Use Cancel instead.`
            });
        }

        // Delete related records first
        await pool.query('DELETE FROM notifications WHERE booking_id = $1', [bookingId]);
        await pool.query('DELETE FROM booking_deadlines WHERE booking_id = $1', [bookingId]);
        await pool.query('DELETE FROM tasks WHERE booking_id = $1', [bookingId]);
        await pool.query('DELETE FROM truck_dispatches WHERE booking_id = $1', [bookingId]);
        try { await pool.query("DELETE FROM audit_log WHERE entity_type = 'booking' AND entity_id = $1", [bookingId]); } catch (e) { }

        // Then delete the booking
        await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);

        res.json({ success: true, message: 'Booking deleted successfully' });

        // Log audit trail
        auditService.log('booking', bookingId, 'DELETE', req.user?.userId || null, {
            booking_number: existing[0].booking_number,
        });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Credit check endpoint (pre-confirm)
router.get('/credit-check/:forwarderId', authenticateToken, async (req, res) => {
    try {
        const status = await creditService.getVendorCreditStatus(req.params.forwarderId);
        if (!status) {
            return res.status(404).json({ error: 'Forwarder not found' });
        }
        res.json({ creditStatus: status });
    } catch (error) {
        console.error('Error checking credit:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
