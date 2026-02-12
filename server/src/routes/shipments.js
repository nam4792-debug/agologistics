const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all shipments
router.get('/', async (req, res) => {
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
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT s.*, 
              c.company_name as customer_name, c.contact_name as customer_contact, c.email as customer_email, c.country as customer_country,
              f.company_name as forwarder_name, f.contact_name as forwarder_contact
       FROM shipments s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN forwarders f ON s.forwarder_id = f.id
       WHERE s.id = ?`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Get documents
        const { rows: documents } = await pool.query(
            `SELECT * FROM documents WHERE shipment_id = ? ORDER BY created_at DESC`,
            [req.params.id]
        );

        // Get bookings
        const { rows: bookings } = await pool.query(
            `SELECT b.*, bd.cut_off_si, bd.cut_off_vgm, bd.cut_off_cy, bd.sales_confirmed
       FROM bookings b
       LEFT JOIN booking_deadlines bd ON b.id = bd.booking_id
       WHERE b.shipment_id = ?`,
            [req.params.id]
        );

        // Get invoices (optional - table might not exist)
        let invoices = [];
        try {
            const invoiceResult = await pool.query(
                'SELECT * FROM invoices WHERE shipment_id = ? ORDER BY created_at DESC',
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
router.post('/', async (req, res) => {
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

        // Validate required fields
        if (!shipmentNumber || !destinationPort || !cargoDescription) {
            return res.status(400).json({
                error: 'Missing required fields: shipment_number, destination_port, cargo_description'
            });
        }

        // Generate UUID for SQLite
        const id = `ship-${Date.now().toString(36)}`;

        const { rows } = await pool.query(
            `INSERT INTO shipments 
       (id, shipment_number, type, status, customer_id, forwarder_id, 
        origin_port, destination_port, origin_country, destination_country,
        cargo_description, cargo_weight_kg, cargo_volume_cbm,
        container_count, container_type, incoterm, etd, eta, notes)
       VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

        // Get the created shipment
        const { rows: newShipment } = await pool.query(
            'SELECT * FROM shipments WHERE id = ?',
            [id]
        );

        const createdShipment = newShipment[0] || { id, shipment_number: shipmentNumber };

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
router.put('/:id', async (req, res) => {
    try {
        const updates = req.body;
        const fields = [];
        const values = [];

        const allowedFields = [
            'status',
            'origin_port',
            'destination_port',
            'cargo_description',
            'cargo_weight_kg',
            'etd',
            'eta',
            'atd',
            'ata',
            'total_cost_usd',
            'notes',
        ];

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
            if (allowedFields.includes(snakeKey)) {
                fields.push(`${snakeKey} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        fields.push(`updated_at = datetime('now')`);
        values.push(req.params.id);

        await pool.query(
            `UPDATE shipments SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        // Fetch the updated shipment
        const { rows } = await pool.query('SELECT * FROM shipments WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Emit real-time event
        const io = req.app.get('io');
        if (io) io.emit('shipment:updated', rows[0]);

        res.json({ shipment: rows[0] });
    } catch (error) {
        console.error('Error updating shipment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update shipment status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        await pool.query(
            `UPDATE shipments SET status = ?, updated_at = datetime('now') WHERE id = ?`,
            [status, req.params.id]
        );

        // Fetch the updated shipment
        const { rows } = await pool.query('SELECT * FROM shipments WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

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
router.delete('/:id', async (req, res) => {
    try {
        const shipmentId = req.params.id;

        // Check if shipment exists
        const { rows: existing } = await pool.query(
            'SELECT * FROM shipments WHERE id = ?',
            [shipmentId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Clear shipment_id from related bookings (don't delete bookings)
        await pool.query(
            'UPDATE bookings SET shipment_id = NULL WHERE shipment_id = ?',
            [shipmentId]
        );

        // Delete related documents
        await pool.query(
            'DELETE FROM documents WHERE shipment_id = ?',
            [shipmentId]
        );

        // Delete related tasks
        await pool.query(
            'DELETE FROM tasks WHERE shipment_id = ?',
            [shipmentId]
        );

        // Delete the shipment
        await pool.query(
            'DELETE FROM shipments WHERE id = ?',
            [shipmentId]
        );

        // Emit real-time event
        const io = req.app.get('io');
        if (io) io.emit('shipment:deleted', { id: shipmentId });

        res.json({ message: 'Shipment deleted successfully' });
    } catch (error) {
        console.error('Error deleting shipment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
