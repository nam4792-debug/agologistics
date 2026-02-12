const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Get all providers (from forwarders table)
router.get('/', async (req, res) => {
    try {
        const { type, status, search } = req.query;

        let query = `
            SELECT 
                id,
                company_name as name,
                company_name as code,
                'FORWARDER' as type,
                COALESCE(on_time_rate, 0) as "onTimeRate",
                COALESCE(doc_accuracy_rate, 0) as "docAccuracyRate",
                COALESCE(cost_score, 0) as "costCompetitiveness",
                COALESCE(
                    (on_time_rate * 0.3 + doc_accuracy_rate * 0.3 + cost_score * 0.2 + 50 * 0.2),
                    0
                ) as "performanceScore",
                CASE 
                    WHEN (on_time_rate * 0.3 + doc_accuracy_rate * 0.3 + cost_score * 0.2 + 50 * 0.2) >= 90 THEN 'A'
                    WHEN (on_time_rate * 0.3 + doc_accuracy_rate * 0.3 + cost_score * 0.2 + 50 * 0.2) >= 80 THEN 'B'
                    WHEN (on_time_rate * 0.3 + doc_accuracy_rate * 0.3 + cost_score * 0.2 + 50 * 0.2) >= 70 THEN 'C'
                    WHEN (on_time_rate * 0.3 + doc_accuracy_rate * 0.3 + cost_score * 0.2 + 50 * 0.2) >= 60 THEN 'D'
                    ELSE 'F'
                END as grade,
                contact_name as contact,
                email,
                phone,
                address,
                COALESCE(status, 'ACTIVE') as status,
                created_at as "createdAt"
            FROM forwarders
            WHERE 1=1
        `;

        const params = [];

        if (status && status !== 'ALL') {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (company_name LIKE $${params.length} OR contact_name LIKE $${params.length})`;
        }

        query += ' ORDER BY company_name ASC';

        const { rows } = await pool.query(query, params);

        // Add mock credit info for now (can be moved to separate table later)
        const providersWithCredit = rows.map((p, i) => ({
            ...p,
            communicationScore: 85,
            complianceScore: 90,
            creditLimit: 50000 + (i * 10000),
            currentDebt: Math.floor(Math.random() * 40000),
            paymentDueDate: new Date(Date.now() + (i + 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            lastPaymentDate: new Date(Date.now() - (i + 5) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }));

        res.json({
            success: true,
            providers: providersWithCredit,
            total: rows.length,
        });
    } catch (error) {
        console.error('Error fetching providers:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Get real debt stats from bookings
router.get('/stats', async (req, res) => {
    try {
        // Get total debt from confirmed bookings
        const { rows: confirmedStats } = await pool.query(`
            SELECT COALESCE(SUM(freight_rate_usd), 0) as total_debt
            FROM bookings
            WHERE status = 'CONFIRMED' AND forwarder_id IS NOT NULL
        `);

        // Get pending amount from pending bookings
        const { rows: pendingStats } = await pool.query(`
            SELECT COALESCE(SUM(freight_rate_usd), 0) as total_pending
            FROM bookings
            WHERE status = 'PENDING' AND forwarder_id IS NOT NULL
        `);

        // Get active vendors count
        const { rows: vendorCount } = await pool.query(`
            SELECT COUNT(*) as count FROM forwarders WHERE status = 'ACTIVE' OR status IS NULL
        `);

        res.json({
            success: true,
            stats: {
                totalDebt: confirmedStats[0]?.total_debt || 0,
                totalPending: pendingStats[0]?.total_pending || 0,
                activeVendors: vendorCount[0]?.count || 0
            }
        });
    } catch (error) {
        console.error('Error fetching provider stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single provider by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { rows } = await pool.query(`
            SELECT 
                id,
                company_name as name,
                company_name as code,
                'FORWARDER' as type,
                COALESCE(on_time_rate, 0) as "onTimeRate",
                COALESCE(doc_accuracy_rate, 0) as "docAccuracyRate",
                COALESCE(cost_score, 0) as "costCompetitiveness",
                contact_name as contact,
                email,
                phone,
                address,
                COALESCE(status, 'ACTIVE') as status,
                created_at as "createdAt"
            FROM forwarders
            WHERE id = $1
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }

        res.json({ success: true, provider: rows[0] });
    } catch (error) {
        console.error('Error fetching provider:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Create new provider
router.post('/', async (req, res) => {
    try {
        const {
            name,
            type = 'FORWARDER',
            contact,
            email,
            phone,
            address,
            onTimeRate = 0,
            docAccuracyRate = 0,
            costScore = 0,
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Provider name is required' });
        }

        const id = uuidv4();

        await pool.query(`
            INSERT INTO forwarders (id, company_name, contact_name, email, phone, address, on_time_rate, doc_accuracy_rate, cost_score, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', NOW())
        `, [id, name, contact, email, phone, address, onTimeRate, docAccuracyRate, costScore]);

        res.status(201).json({
            success: true,
            message: 'Provider created successfully',
            provider: { id, name, type, contact, email, phone, address, status: 'ACTIVE' },
        });
    } catch (error) {
        console.error('Error creating provider:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Update provider
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            contact,
            email,
            phone,
            address,
            onTimeRate,
            docAccuracyRate,
            costScore,
            status,
        } = req.body;

        // Build dynamic update query
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`company_name = $${paramIndex++}`);
            params.push(name);
        }
        if (contact !== undefined) {
            updates.push(`contact_name = $${paramIndex++}`);
            params.push(contact);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramIndex++}`);
            params.push(email);
        }
        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            params.push(phone);
        }
        if (address !== undefined) {
            updates.push(`address = $${paramIndex++}`);
            params.push(address);
        }
        if (onTimeRate !== undefined) {
            updates.push(`on_time_rate = $${paramIndex++}`);
            params.push(onTimeRate);
        }
        if (docAccuracyRate !== undefined) {
            updates.push(`doc_accuracy_rate = $${paramIndex++}`);
            params.push(docAccuracyRate);
        }
        if (costScore !== undefined) {
            updates.push(`cost_score = $${paramIndex++}`);
            params.push(costScore);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            params.push(status);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(id);
        const query = `UPDATE forwarders SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

        const result = await pool.query(query, params);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }

        res.json({ success: true, message: 'Provider updated successfully' });
    } catch (error) {
        console.error('Error updating provider:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Delete provider
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query('DELETE FROM forwarders WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }

        res.json({ success: true, message: 'Provider deleted successfully' });
    } catch (error) {
        console.error('Error deleting provider:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Get provider statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN grade = 'A' THEN 1 ELSE 0 END) as grade_a,
                SUM(CASE WHEN grade = 'B' THEN 1 ELSE 0 END) as grade_b,
                AVG(on_time_rate) as avg_on_time_rate,
                AVG(doc_accuracy_rate) as avg_doc_accuracy
            FROM forwarders
        `);

        res.json({ success: true, stats: rows[0] });
    } catch (error) {
        console.error('Error fetching provider stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get provider with debt details (linked to real bookings)
router.get('/:id/debt', async (req, res) => {
    try {
        const { id } = req.params;

        // Get provider info
        const { rows: providerRows } = await pool.query(`
            SELECT 
                id,
                company_name as name,
                contact_name as contact,
                email,
                phone,
                COALESCE(status, 'ACTIVE') as status
            FROM forwarders
            WHERE id = $1
        `, [id]);

        if (providerRows.length === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }

        // Get bookings linked to this provider
        const { rows: bookings } = await pool.query(`
            SELECT 
                b.id,
                b.booking_number,
                b.type,
                b.status,
                b.vessel_flight,
                b.route,
                b.origin_port,
                b.destination_port,
                COALESCE(b.freight_rate_usd, 0) as freight_rate,
                b.etd,
                b.eta,
                b.created_at
            FROM bookings b
            WHERE b.forwarder_id = $1
            ORDER BY b.created_at DESC
        `, [id]);

        // Calculate total debt = sum of freight_rate from CONFIRMED bookings
        const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED');
        const totalDebt = confirmedBookings.reduce((sum, b) => sum + (b.freight_rate || 0), 0);
        const pendingBookings = bookings.filter(b => b.status === 'PENDING');
        const pendingAmount = pendingBookings.reduce((sum, b) => sum + (b.freight_rate || 0), 0);

        res.json({
            success: true,
            provider: providerRows[0],
            debt: {
                totalDebt,
                pendingAmount,
                confirmedBookingsCount: confirmedBookings.length,
                pendingBookingsCount: pendingBookings.length,
                totalBookingsCount: bookings.length,
            },
            bookings: bookings.slice(0, 10), // Return latest 10 bookings
        });
    } catch (error) {
        console.error('Error fetching provider debt:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

module.exports = router;
