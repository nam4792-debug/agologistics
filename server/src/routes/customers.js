const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all customers
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                id,
                customer_code as code,
                company_name as name,
                contact_name as contact,
                email,
                phone,
                country,
                created_at as "createdAt"
            FROM customers
            ORDER BY company_name
        `);
        res.json({ success: true, customers: rows });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single customer
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                id,
                customer_code as code,
                company_name as name,
                contact_name as contact,
                email,
                phone,
                country,
                created_at as "createdAt"
            FROM customers
            WHERE id = $1
        `, [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get shipments for this customer
        const { rows: shipments } = await pool.query(`
            SELECT id, shipment_number, type, status, origin_port, destination_port, etd, eta
            FROM shipments
            WHERE customer_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [req.params.id]);

        res.json({
            success: true,
            customer: rows[0],
            shipments
        });
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create customer
router.post('/', async (req, res) => {
    try {
        const { company_name, contact_name, email, phone, country } = req.body;

        if (!company_name) {
            return res.status(400).json({ error: 'Company name is required' });
        }

        const id = uuidv4();
        const code = `CUS-${Date.now().toString(36).toUpperCase().slice(-6)}`;

        await pool.query(`
            INSERT INTO customers (id, customer_code, company_name, contact_name, email, phone, country)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, code, company_name, contact_name || null, email || null, phone || null, country || null]);

        res.status(201).json({
            success: true,
            customer: { id, code, name: company_name, contact: contact_name, email, phone, country }
        });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Update customer
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { company_name, contact_name, email, phone, country } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (company_name) { updates.push(`company_name = $${paramIndex++}`); values.push(company_name); }
        if (contact_name !== undefined) { updates.push(`contact_name = $${paramIndex++}`); values.push(contact_name); }
        if (email !== undefined) { updates.push(`email = $${paramIndex++}`); values.push(email); }
        if (phone !== undefined) { updates.push(`phone = $${paramIndex++}`); values.push(phone); }
        if (country !== undefined) { updates.push(`country = $${paramIndex++}`); values.push(country); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);
        const query = `UPDATE customers SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ success: true, message: 'Customer updated' });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete customer
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ success: true, message: 'Customer deleted' });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
