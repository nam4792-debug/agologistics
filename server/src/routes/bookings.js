const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const workflowService = require('../services/workflowService');
const { authenticateToken } = require('./auth');

// Get all bookings
router.get('/', async (req, res) => {
    try {
        const { status, type } = req.query;

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

        query += ' ORDER BY b.created_at DESC';

        const { rows } = await pool.query(query, params);
        res.json({ bookings: rows });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get forwarders list for dropdown
router.get('/forwarders', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
    try {
        // Accept both snake_case and camelCase
        const body = req.body;
        const bookingNumber = body.booking_number || body.bookingNumber || `BK-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
        const shipmentId = body.shipment_id || body.shipmentId || null;
        const forwarderId = body.forwarder_id || body.forwarderId || null;
        const type = body.type || 'FCL';
        const vesselFlight = body.vessel_flight || body.vesselFlight || '';
        const voyageNumber = body.voyage_number || body.voyageNumber || '';
        const route = body.route || '';
        const originPort = body.origin_port || body.originPort || 'Ho Chi Minh City';
        const destinationPort = body.destination_port || body.destinationPort || '';
        const containerType = body.container_type || body.containerType || '40GP';
        const containerCount = parseInt(body.container_count || body.containerCount) || 1;
        const etd = body.etd || null;
        const eta = body.eta || null;
        const freightRate = parseFloat(body.freight_rate_usd || body.freightRate) || 0;
        const notes = body.notes || null;

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
        etd, eta, freight_rate_usd, notes)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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

        res.status(201).json({ booking: rows[0] || { id, booking_number: bookingNumber } });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Sales confirm booking (triggers workflow)
// NOTE: Auth is optional to allow demo usage without login
router.post('/:id/confirm', async (req, res) => {
    try {
        const io = req.app.get('io');

        // Check for auth token, but don't require it
        let userId = 'demo-user';
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

        res.json({
            message: 'Booking confirmed successfully',
            ...result,
        });
    } catch (error) {
        console.error('Error confirming booking:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Update booking
router.put('/:id', async (req, res) => {
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
            'etd',
            'eta',
            'freight_rate_usd',
            'notes',
        ];

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
            if (allowedFields.includes(snakeKey)) {
                fields.push(`${snakeKey} = $${paramIndex++}`);
                values.push(value);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        fields.push(`updated_at = NOW()`);
        values.push(req.params.id);

        const { rows } = await pool.query(
            `UPDATE bookings SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json({ booking: rows[0] });
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete booking
router.delete('/:id', async (req, res) => {
    try {
        const bookingId = req.params.id;

        // First, delete related records
        await pool.query('DELETE FROM booking_deadlines WHERE booking_id = $1', [bookingId]);
        await pool.query('DELETE FROM tasks WHERE booking_id = $1', [bookingId]);
        await pool.query('DELETE FROM truck_dispatches WHERE booking_id = $1', [bookingId]);

        // Then delete the booking
        const result = await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
