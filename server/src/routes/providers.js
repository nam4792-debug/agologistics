const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('./auth');
const auditService = require('../services/auditService');
const { validate, RULES, DELETE_GUARDS } = require('../middleware/validator');

// Get all providers (from forwarders table)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { type, status, search } = req.query;

        let query = `
            SELECT 
                id,
                company_name as name,
                COALESCE(provider_code, 'FWD-' || SUBSTRING(id::text, 1, 6)) as code,
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
                COALESCE(credit_limit_monthly, 0) as "creditLimit",
                COALESCE((SELECT SUM(amount_usd) FROM invoices WHERE invoices.forwarder_id = forwarders.id AND invoices.status IN ('PENDING', 'OVERDUE')), 0) as "outstandingBalance",
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
            query += ` AND (company_name ILIKE $${params.length} OR contact_name ILIKE $${params.length})`;
        }

        query += ' ORDER BY company_name ASC';

        const { rows } = await pool.query(query, params);

        res.json({
            success: true,
            providers: rows,
            total: rows.length,
        });
    } catch (error) {
        console.error('Error fetching providers:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Get real debt stats from bookings
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        // Outstanding = unpaid invoices (PENDING + OVERDUE) — same source as Dashboard
        const { rows: debtStats } = await pool.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN status IN ('PENDING', 'OVERDUE') THEN amount_usd ELSE 0 END), 0) as total_debt,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount_usd ELSE 0 END), 0) as total_pending
            FROM invoices
            WHERE status NOT IN ('CANCELLED', 'PAID')
        `);

        // Get active vendors count
        const { rows: vendorCount } = await pool.query(`
            SELECT COUNT(*) as count FROM forwarders WHERE status = 'ACTIVE' OR status IS NULL
        `);

        res.json({
            success: true,
            stats: {
                totalDebt: debtStats[0]?.total_debt || 0,
                totalPending: debtStats[0]?.total_pending || 0,
                activeVendors: vendorCount[0]?.count || 0
            }
        });
    } catch (error) {
        console.error('Error fetching provider stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single provider by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { rows } = await pool.query(`
            SELECT 
                id,
                company_name as name,
                COALESCE(provider_code, 'FWD-' || SUBSTRING(id::text, 1, 6)) as code,
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
router.post('/', authenticateToken, validate(RULES.provider.create), async (req, res) => {
    try {
        const {
            name,
            company_name,
            type = 'FORWARDER',
            contact,
            contact_name,
            email,
            phone,
            address,
            onTimeRate = 0,
            docAccuracyRate = 0,
            costScore = 0,
            creditLimit,
            credit_limit_monthly,
        } = req.body;

        const providerName = name || company_name;
        const providerContact = contact || contact_name;
        const creditLimitValue = parseFloat(creditLimit || credit_limit_monthly) || 0;

        if (!providerName) {
            return res.status(400).json({ error: 'Provider name is required' });
        }

        const id = uuidv4();

        await pool.query(`
            INSERT INTO forwarders (id, company_name, contact_name, email, phone, address, on_time_rate, doc_accuracy_rate, cost_score, credit_limit_monthly, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', NOW())
        `, [id, providerName, providerContact, email, phone, address, onTimeRate, docAccuracyRate, costScore, creditLimitValue]);

        // Audit trail
        auditService.log('provider', id, 'CREATE', req.user?.userId || null, {
            name: providerName,
        });

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
router.put('/:id', authenticateToken, async (req, res) => {
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
            creditLimit,
            credit_limit_monthly,
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
        const creditLimitValue = creditLimit !== undefined ? creditLimit : credit_limit_monthly;
        if (creditLimitValue !== undefined) {
            updates.push(`credit_limit_monthly = $${paramIndex++}`);
            params.push(parseFloat(creditLimitValue) || 0);
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

        // Audit trail
        auditService.log('provider', id, 'UPDATE', req.user?.userId || null, {
            updated_fields: Object.keys(req.body),
        });

        res.json({ success: true, message: 'Provider updated successfully' });
    } catch (error) {
        console.error('Error updating provider:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Delete provider
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // BUG-15: Check for linked bookings/shipments before deleting
        const { rows: linkedBookings } = await pool.query(
            'SELECT COUNT(*) as count FROM bookings WHERE forwarder_id = $1',
            [id]
        );
        if (parseInt(linkedBookings[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot delete this vendor',
                message: `This vendor has ${linkedBookings[0].count} linked booking(s). Remove or reassign them first.`
            });
        }

        const { rows: linkedShipments } = await pool.query(
            'SELECT COUNT(*) as count FROM shipments WHERE forwarder_id = $1',
            [id]
        );
        if (parseInt(linkedShipments[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot delete this vendor',
                message: `This vendor has ${linkedShipments[0].count} linked shipment(s). Remove or reassign them first.`
            });
        }

        const result = await pool.query('DELETE FROM forwarders WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }

        // Audit trail
        auditService.log('provider', id, 'DELETE', req.user?.userId || null, {});

        res.json({ success: true, message: 'Provider deleted successfully' });
    } catch (error) {
        console.error('Error deleting provider:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// Get provider statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
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
router.get('/:id/debt', authenticateToken, async (req, res) => {
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

// Compare multiple vendors side-by-side
router.post('/compare', authenticateToken, async (req, res) => {
    try {
        const { vendorIds } = req.body;

        if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length < 2) {
            return res.status(400).json({ error: 'At least 2 vendor IDs are required' });
        }

        if (vendorIds.length > 5) {
            return res.status(400).json({ error: 'Maximum 5 vendors can be compared at once' });
        }

        const placeholders = vendorIds.map((_, i) => `$${i + 1}`).join(', ');

        const { rows: vendors } = await pool.query(`
            SELECT 
                f.id,
                f.company_name as name,
                COALESCE(f.on_time_rate, 0) as "onTimeRate",
                COALESCE(f.doc_accuracy_rate, 0) as "docAccuracyRate",
                COALESCE(f.cost_score, 0) as "costCompetitiveness",
                COALESCE(
                    (f.on_time_rate * 0.3 + f.doc_accuracy_rate * 0.3 + f.cost_score * 0.2 + 50 * 0.2),
                    0
                ) as "performanceScore",
                f.contact_name as contact,
                f.email,
                f.phone,
                COALESCE(f.status, 'ACTIVE') as status,
                COALESCE(f.credit_limit_monthly, 0) as "creditLimit",
                (SELECT COUNT(*) FROM bookings WHERE forwarder_id = f.id) as "totalBookings",
                (SELECT COUNT(*) FROM bookings WHERE forwarder_id = f.id AND status = 'CONFIRMED') as "confirmedBookings",
                (SELECT COALESCE(SUM(freight_rate_usd), 0) FROM bookings WHERE forwarder_id = f.id) as "totalRevenue",
                (SELECT COALESCE(AVG(freight_rate_usd), 0) FROM bookings WHERE forwarder_id = f.id) as "avgRate"
            FROM forwarders f
            WHERE f.id IN (${placeholders})
        `, vendorIds);

        res.json({
            success: true,
            vendors,
            comparisonMetrics: [
                'performanceScore',
                'onTimeRate',
                'docAccuracyRate',
                'costCompetitiveness',
                'totalBookings',
                'avgRate',
            ],
        });
    } catch (error) {
        console.error('Error comparing vendors:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
