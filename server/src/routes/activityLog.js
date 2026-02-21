const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('./auth');

// Get activity log (admin only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { entity_type, action, limit = 50, offset = 0, startDate, endDate } = req.query;

        let query = `
            SELECT al.*, 
                   u.full_name as user_name,
                   u.email as user_email
            FROM audit_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (entity_type) {
            query += ` AND al.entity_type = $${paramIndex++}`;
            params.push(entity_type);
        }

        if (action) {
            query += ` AND al.action = $${paramIndex++}`;
            params.push(action);
        }

        if (startDate) {
            query += ` AND al.created_at >= $${paramIndex++}`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND al.created_at <= $${paramIndex++}`;
            params.push(endDate);
        }

        query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const { rows } = await pool.query(query, params);

        // Get total count for pagination
        let countQuery = `SELECT COUNT(*) as total FROM audit_log WHERE 1=1`;
        const countParams = [];
        let countIdx = 1;
        if (entity_type) {
            countQuery += ` AND entity_type = $${countIdx++}`;
            countParams.push(entity_type);
        }
        if (action) {
            countQuery += ` AND action = $${countIdx++}`;
            countParams.push(action);
        }
        if (startDate) {
            countQuery += ` AND created_at >= $${countIdx++}`;
            countParams.push(startDate);
        }
        if (endDate) {
            countQuery += ` AND created_at <= $${countIdx++}`;
            countParams.push(endDate);
        }

        const { rows: countRows } = await pool.query(countQuery, countParams);

        res.json({
            activities: rows,
            total: parseInt(countRows[0].total),
            limit: parseInt(limit),
            offset: parseInt(offset),
        });
    } catch (error) {
        console.error('Error fetching activity log:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get activity summary (for admin dashboard)
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const { rows: todayCount } = await pool.query(
            `SELECT COUNT(*) as count FROM audit_log WHERE created_at >= CURRENT_DATE`
        );

        const { rows: weekCount } = await pool.query(
            `SELECT COUNT(*) as count FROM audit_log WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`
        );

        const { rows: byAction } = await pool.query(
            `SELECT action, COUNT(*) as count 
             FROM audit_log 
             WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY action 
             ORDER BY count DESC`
        );

        const { rows: byEntity } = await pool.query(
            `SELECT entity_type, COUNT(*) as count 
             FROM audit_log 
             WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY entity_type 
             ORDER BY count DESC`
        );

        const { rows: recentUsers } = await pool.query(
            `SELECT u.full_name, u.email, COUNT(*) as actions
             FROM audit_log al
             JOIN users u ON al.user_id = u.id
             WHERE al.created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY u.full_name, u.email
             ORDER BY actions DESC
             LIMIT 10`
        );

        res.json({
            todayCount: parseInt(todayCount[0].count),
            weekCount: parseInt(weekCount[0].count),
            byAction,
            byEntity,
            recentUsers,
        });
    } catch (error) {
        console.error('Error fetching activity summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get entity-specific activity (timeline for a specific booking/shipment/etc.)
router.get('/entity/:type/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT al.*, u.full_name as user_name
             FROM audit_log al
             LEFT JOIN users u ON al.user_id = u.id
             WHERE al.entity_type = $1 AND al.entity_id = $2
             ORDER BY al.created_at DESC`,
            [req.params.type, req.params.id]
        );

        res.json({ activities: rows });
    } catch (error) {
        console.error('Error fetching entity activity:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
