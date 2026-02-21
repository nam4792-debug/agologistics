const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('./auth');
const auditService = require('../services/auditService');
const { validate, checkVersion, RULES } = require('../middleware/validator');

// Get all shipments
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, type, customerId } = req.query;

        let query = `
      SELECT s.*, 
             c.company_name as customer_name,
             f.company_name as forwarder_name,
             (SELECT COUNT(*) FROM documents d WHERE d.shipment_id = s.id AND d.deleted_at IS NULL) as document_count
      FROM shipments s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN forwarders f ON s.forwarder_id = f.id
      WHERE 1=1
    `;

        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND s.status = $${paramIndex++}`;
            params.push(status);
        }

        if (type) {
            query += ` AND s.type = $${paramIndex++}`;
            params.push(type);
        }

        if (customerId) {
            query += ` AND s.customer_id = $${paramIndex++}`;
            params.push(customerId);
        }

        query += ' ORDER BY s.created_at DESC';

        const { rows } = await pool.query(query, params);
        res.json({ shipments: rows });
    } catch (error) {
        console.error('Error fetching shipments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single shipment
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT s.*, 
              c.company_name as customer_name, c.contact_name as customer_contact, c.email as customer_email, c.country as customer_country,
              COALESCE(f.company_name, bf.company_name) as forwarder_name,
              COALESCE(f.contact_name, bf.contact_name) as forwarder_contact
       FROM shipments s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN forwarders f ON s.forwarder_id = f.id
       LEFT JOIN bookings b2 ON b2.shipment_id = s.id
       LEFT JOIN forwarders bf ON b2.forwarder_id = bf.id
       WHERE s.id = $1
       LIMIT 1`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Get documents (exclude soft-deleted)
        const { rows: documents } = await pool.query(
            `SELECT * FROM documents WHERE shipment_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
            [req.params.id]
        );

        // Get bookings
        const { rows: bookings } = await pool.query(
            `SELECT b.*, bd.cut_off_si, bd.cut_off_vgm, bd.cut_off_cy, bd.sales_confirmed,
                    fw.company_name as forwarder_name
       FROM bookings b
       LEFT JOIN booking_deadlines bd ON b.id = bd.booking_id
       LEFT JOIN forwarders fw ON b.forwarder_id = fw.id
       WHERE b.shipment_id = $1`,
            [req.params.id]
        );

        // Get invoices (optional - table might not exist)
        let invoices = [];
        try {
            const invoiceResult = await pool.query(
                'SELECT * FROM invoices WHERE shipment_id = $1 ORDER BY created_at DESC',
                [req.params.id]
            );
            invoices = invoiceResult.rows;
        } catch (e) {
            // invoices table might not exist yet
        }

        res.json({
            shipment: rows[0],
            documents,
            bookings,
            invoices,
        });
    } catch (error) {
        console.error('Error fetching shipment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create shipment
router.post('/', authenticateToken, validate(RULES.shipment.create), async (req, res) => {
    try {
        // Accept both snake_case and camelCase
        const body = req.body;
        const shipmentNumber = body.shipment_number || body.shipmentNumber || `SHP-${Date.now().toString(36).toUpperCase()}`;
        const type = body.type || 'FCL';
        const customerId = body.customer_id || body.customerId;
        const forwarderId = body.forwarder_id || body.forwarderId || null;
        const originPort = body.origin_port || body.originPort || 'Ho Chi Minh City';
        const destinationPort = body.destination_port || body.destinationPort;
        const originCountry = body.origin_country || body.originCountry || 'Vietnam';
        const destinationCountry = body.destination_country || body.destinationCountry || '';
        const cargoDescription = body.cargo_description || body.cargoDescription;
        const cargoWeightKg = body.cargo_weight_kg || body.cargoWeightKg || 0;
        const cargoVolumeCbm = body.cargo_volume_cbm || body.cargoVolumeCbm || null;
        const containerCount = body.container_count || body.containerCount || 1;
        const containerType = body.container_type || body.containerType || '40GP';
        const incoterm = body.incoterm || 'FOB';
        const etd = body.etd || null;
        const eta = body.eta || null;
        const notes = body.notes || null;
        const bookingId = body.booking_id || body.bookingId || null;

        // Validate required fields
        if (!shipmentNumber || !destinationPort || !cargoDescription) {
            return res.status(400).json({
                error: 'Missing required fields: shipment_number, destination_port, cargo_description'
            });
        }

        // Generate UUID
        const id = uuidv4();

        const { rows } = await pool.query(
            `INSERT INTO shipments 
       (id, shipment_number, type, status, customer_id, forwarder_id, 
        origin_port, destination_port, origin_country, destination_country,
        cargo_description, cargo_weight_kg, cargo_volume_cbm,
        container_count, container_type, incoterm, etd, eta, notes)
       VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
            [
                id,
                shipmentNumber,
                type,
                customerId,
                forwarderId,
                originPort,
                destinationPort,
                originCountry,
                destinationCountry,
                cargoDescription,
                cargoWeightKg,
                cargoVolumeCbm,
                containerCount,
                containerType,
                incoterm,
                etd,
                eta,
                notes,
            ]
        );

        const createdShipment = rows[0] || { id, shipment_number: shipmentNumber };

        // Link booking to this shipment if booking_id was provided
        if (bookingId) {
            await pool.query(
                'UPDATE bookings SET shipment_id = $1, status = $2, updated_at = NOW() WHERE id = $3',
                [id, 'ALLOCATED', bookingId]
            );
        }

        // Emit real-time event
        const io = req.app.get('io');
        if (io) io.emit('shipment:created', createdShipment);

        res.status(201).json({ shipment: createdShipment });
    } catch (error) {
        console.error('Error creating shipment:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Update shipment
router.put('/:id', authenticateToken, validate(RULES.shipment.update), checkVersion('shipments'), async (req, res) => {
    try {
        const updates = req.body;
        const fields = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = [
            'status',
            'origin_port',
            'destination_port',
            'origin_country',
            'destination_country',
            'cargo_description',
            'cargo_weight_kg',
            'cargo_volume_cbm',
            'container_count',
            'container_type',
            'incoterm',
            'customer_id',
            'forwarder_id',
            'type',
            'etd',
            'eta',
            'atd',
            'ata',
            'total_cost_usd',
            'notes',
        ];

        // Convert empty date strings to null (PostgreSQL rejects '' for date/timestamp columns)
        const dateFields = ['etd', 'eta', 'atd', 'ata'];
        for (const df of dateFields) {
            if (updates[df] === '') updates[df] = null;
        }

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

        await pool.query(
            `UPDATE shipments SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        // Fetch the updated shipment
        const { rows } = await pool.query('SELECT * FROM shipments WHERE id = $1', [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Audit trail
        auditService.log('shipment', req.params.id, 'UPDATE', req.user?.userId || null, {
            shipment_number: rows[0].shipment_number,
            updated_fields: Object.keys(updates),
        });

        // Emit real-time event
        const io = req.app.get('io');
        if (io) io.emit('shipment:updated', rows[0]);

        res.json({ shipment: rows[0] });
    } catch (error) {
        console.error('Error updating shipment:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message, detail: error.detail || null });
    }
});

// Update shipment status
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = [
            'DRAFT', 'BOOKED', 'BOOKING_CONFIRMED',
            'DOCUMENTATION_IN_PROGRESS', 'READY_TO_LOAD',
            'LOADING', 'LOADED',
            'CUSTOMS_SUBMITTED', 'CUSTOMS_CLEARED',
            'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'CANCELLED'
        ];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
        }

        // Get current status for audit trail
        const { rows: current } = await pool.query('SELECT status FROM shipments WHERE id = $1', [req.params.id]);
        if (current.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        const oldStatus = current[0].status;

        await pool.query(
            `UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2`,
            [status, req.params.id]
        );

        // Fetch the updated shipment
        const { rows } = await pool.query('SELECT * FROM shipments WHERE id = $1', [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Audit trail
        auditService.log('shipment', req.params.id, 'STATUS_CHANGE', req.user?.userId || null, {
            shipment_number: rows[0].shipment_number,
            status: { old: oldStatus, new: status },
        });

        // Emit real-time event
        const io = req.app.get('io');
        if (io) io.emit('shipment:updated', rows[0]);

        res.json({ shipment: rows[0] });
    } catch (error) {
        console.error('Error updating shipment status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete shipment
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const shipmentId = req.params.id;

        // Check if shipment exists
        const { rows: existing } = await pool.query(
            'SELECT * FROM shipments WHERE id = $1',
            [shipmentId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Clear shipment_id from related bookings (don't delete bookings)
        await pool.query(
            'UPDATE bookings SET shipment_id = NULL WHERE shipment_id = $1',
            [shipmentId]
        );

        // Delete related records that reference this shipment (prevent FK violations)
        await pool.query('DELETE FROM notifications WHERE shipment_id = $1', [shipmentId]);
        try { await pool.query('DELETE FROM alerts WHERE shipment_id = $1', [shipmentId]); } catch (e) { }
        try { await pool.query('DELETE FROM ai_analysis_results WHERE shipment_id = $1', [shipmentId]); } catch (e) { }
        try { await pool.query('DELETE FROM ai_chat_messages WHERE shipment_id = $1', [shipmentId]); } catch (e) { }
        try { await pool.query('DELETE FROM shipment_revenue WHERE shipment_id = $1', [shipmentId]); } catch (e) { }
        try { await pool.query("DELETE FROM audit_log WHERE entity_type = 'shipment' AND entity_id = $1", [shipmentId]); } catch (e) { }

        // Delete related documents
        await pool.query(
            'DELETE FROM documents WHERE shipment_id = $1',
            [shipmentId]
        );

        // Delete related invoices
        await pool.query(
            'DELETE FROM invoices WHERE shipment_id = $1',
            [shipmentId]
        );

        // Delete related tasks
        await pool.query(
            'DELETE FROM tasks WHERE shipment_id = $1',
            [shipmentId]
        );

        // Delete the shipment
        await pool.query(
            'DELETE FROM shipments WHERE id = $1',
            [shipmentId]
        );

        // Emit real-time event
        const io = req.app.get('io');
        if (io) io.emit('shipment:deleted', { id: shipmentId });

        // Audit trail
        auditService.log('shipment', shipmentId, 'DELETE', req.user?.userId || null, {
            shipment_number: existing[0].shipment_number,
        });

        res.json({ message: 'Shipment deleted successfully' });
    } catch (error) {
        console.error('Error deleting shipment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
