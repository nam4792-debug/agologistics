const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Dashboard metrics - aggregated data from database
router.get('/metrics', async (req, res) => {
    try {
        // Get shipment counts by status
        const shipmentsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit,
                SUM(CASE WHEN status = 'AT_PORT' THEN 1 ELSE 0 END) as at_port,
                SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status = 'PENDING' OR status = 'DRAFT' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'CUSTOMS' THEN 1 ELSE 0 END) as in_customs
            FROM shipments
        `);

        // Get booking counts by type
        const bookingsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN type = 'FCL' THEN 1 ELSE 0 END) as fcl,
                SUM(CASE WHEN type = 'AIR' THEN 1 ELSE 0 END) as air,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed
            FROM bookings
        `);

        // Get document counts
        const documentsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as validated,
                SUM(CASE WHEN status = 'PENDING' OR status = 'UPLOADED' THEN 1 ELSE 0 END) as pending
            FROM documents
            WHERE deleted_at IS NULL
        `);

        // Get recent alerts/notifications
        const alertsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN type = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
            FROM notifications
            WHERE created_at > datetime('now', '-7 days')
        `);

        // Calculate upcoming deadlines (within next 7 days)
        const deadlinesResult = await pool.query(`
            SELECT 
                COUNT(*) as upcoming_count,
                SUM(CASE WHEN DATE(cut_off_si) <= DATE('now', '+3 days') AND DATE(cut_off_si) >= DATE('now') THEN 1 ELSE 0 END) as urgent_count
            FROM booking_deadlines
            WHERE status != 'COMPLETED'
            AND (DATE(cut_off_si) BETWEEN DATE('now') AND DATE('now', '+7 days')
                OR DATE(cut_off_vgm) BETWEEN DATE('now') AND DATE('now', '+7 days')
                OR DATE(cut_off_cy) BETWEEN DATE('now') AND DATE('now', '+7 days'))
        `);

        // Active Shipments: Bookings with ALLOCATED/CONFIRMED/USED status where ETA > today
        const activeShipmentsResult = await pool.query(`
            SELECT COUNT(*) as active_count
            FROM bookings
            WHERE status IN ('ALLOCATED', 'CONFIRMED', 'USED')
            AND (eta IS NULL OR DATE(eta) >= DATE('now'))
        `);

        const shipments = shipmentsResult.rows[0] || { total: 0, in_transit: 0, at_port: 0, delivered: 0, pending: 0, in_customs: 0 };
        const bookings = bookingsResult.rows[0] || { total: 0, fcl: 0, air: 0, pending: 0, confirmed: 0 };
        const documents = documentsResult.rows[0] || { total: 0, validated: 0, pending: 0 };
        const alerts = alertsResult.rows[0] || { total: 0, critical: 0, unread: 0 };
        const deadlines = deadlinesResult.rows[0] || { upcoming_count: 0, urgent_count: 0 };
        const activeShipments = activeShipmentsResult.rows[0] || { active_count: 0 };

        res.json({
            success: true,
            metrics: {
                shipments: {
                    total: shipments.total || 0,
                    inTransit: shipments.in_transit || 0,
                    atPort: shipments.at_port || 0,
                    delivered: shipments.delivered || 0,
                    pending: shipments.pending || 0,
                    inCustoms: shipments.in_customs || 0,
                    // Active Shipments = Bookings ALLOCATED/CONFIRMED/USED where ETA >= today
                    activeBookings: activeShipments.active_count || 0,
                },
                bookings: {
                    total: bookings.total || 0,
                    fcl: bookings.fcl || 0,
                    air: bookings.air || 0,
                    pending: bookings.pending || 0,
                    confirmed: bookings.confirmed || 0,
                },
                documents: {
                    total: documents.total || 0,
                    validated: documents.validated || 0,
                    pending: documents.pending || 0,
                },
                alerts: {
                    total: alerts.total || 0,
                    critical: alerts.critical || 0,
                    unread: alerts.unread || 0,
                },
                deadlines: {
                    upcoming: deadlines.upcoming_count || 0,
                    urgent: deadlines.urgent_count || 0,
                },
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        res.status(500).json({
            error: 'Internal server error',
            // Fallback mock data for demo
            metrics: {
                shipments: { total: 24, inTransit: 8, atPort: 3, delivered: 12, pending: 1, inCustoms: 2 },
                bookings: { total: 18, fcl: 12, air: 6, pending: 5, confirmed: 13 },
                documents: { total: 156, validated: 142, pending: 14 },
                alerts: { total: 7, critical: 2, unread: 4 },
                deadlines: { upcoming: 3, urgent: 1 },
            },
        });
    }
});

// Get recent shipments for dashboard
router.get('/recent-shipments', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT s.id, s.shipment_number, s.type, s.status, s.origin_country, s.destination_country, 
                   c.company_name as customer_name, s.etd, s.eta, s.created_at
            FROM shipments s
            LEFT JOIN customers c ON s.customer_id = c.id
            ORDER BY s.created_at DESC
            LIMIT 5
        `);

        res.json({ success: true, shipments: rows });
    } catch (error) {
        console.error('Error fetching recent shipments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get upcoming deadlines
router.get('/upcoming-deadlines', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT b.id, b.booking_number, b.type, b.route, b.etd,
                   bd.cut_off_si, bd.cut_off_vgm, bd.cut_off_cy
            FROM bookings b
            LEFT JOIN booking_deadlines bd ON b.id = bd.booking_id
            WHERE b.status != 'COMPLETED'
            ORDER BY b.etd ASC
            LIMIT 5
        `);

        res.json({ success: true, deadlines: rows });
    } catch (error) {
        console.error('Error fetching upcoming deadlines:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
