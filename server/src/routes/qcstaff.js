const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all QC staff
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                id,
                staff_code as code,
                full_name as name,
                role,
                email,
                phone,
                department,
                status,
                created_at as "createdAt"
            FROM qc_staff
            WHERE status = 'ACTIVE'
            ORDER BY full_name
        `);
        res.json({ success: true, staff: rows });
    } catch (error) {
        console.error('Error fetching QC staff:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create QC staff
router.post('/', async (req, res) => {
    try {
        const { full_name, role, email, phone, department } = req.body;

        if (!full_name) {
            return res.status(400).json({ error: 'Full name is required' });
        }

        const id = uuidv4();
        const code = `QC-${Date.now().toString(36).toUpperCase().slice(-6)}`;

        await pool.query(`
            INSERT INTO qc_staff (id, staff_code, full_name, role, email, phone, department)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, code, full_name, role || 'QC Inspector', email || null, phone || null, department || null]);

        res.status(201).json({
            success: true,
            staff: { id, code, name: full_name, role: role || 'QC Inspector', email, phone, department }
        });
    } catch (error) {
        console.error('Error creating QC staff:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Update QC staff
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, role, email, phone, department } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (full_name) { updates.push(`full_name = $${paramIndex++}`); values.push(full_name); }
        if (role !== undefined) { updates.push(`role = $${paramIndex++}`); values.push(role); }
        if (email !== undefined) { updates.push(`email = $${paramIndex++}`); values.push(email); }
        if (phone !== undefined) { updates.push(`phone = $${paramIndex++}`); values.push(phone); }
        if (department !== undefined) { updates.push(`department = $${paramIndex++}`); values.push(department); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);
        const query = `UPDATE qc_staff SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
        await pool.query(query, values);

        res.json({ success: true, message: 'QC staff updated' });
    } catch (error) {
        console.error('Error updating QC staff:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete QC staff
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE qc_staff SET status = 'INACTIVE' WHERE id = $1",
            [req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'QC staff not found' });
        }

        res.json({ success: true, message: 'QC staff deactivated' });
    } catch (error) {
        console.error('Error deleting QC staff:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
