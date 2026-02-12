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
        let alerts = { total: 0, critical: 0, unread: 0 };
        try {
            const alertsResult = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN type = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
                    SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread
                FROM notifications
                WHERE created_at > NOW() - INTERVAL '7 days'
            `);
            alerts = alertsResult.rows[0] || alerts;
        } catch (e) {
            // notifications table may not exist yet
        }

        // Calculate upcoming deadlines (within next 7 days)
        let deadlines = { upcoming_count: 0, urgent_count: 0 };
        try {
            const deadlinesResult = await pool.query(`
                SELECT 
                    COUNT(*) as upcoming_count,
                    SUM(CASE WHEN DATE(cut_off_si) <= CURRENT_DATE + INTERVAL '3 days' AND DATE(cut_off_si) >= CURRENT_DATE THEN 1 ELSE 0 END) as urgent_count
                FROM booking_deadlines
                WHERE status != 'COMPLETED'
                AND (DATE(cut_off_si) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
                    OR DATE(cut_off_vgm) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
                    OR DATE(cut_off_cy) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')
            `);
            deadlines = deadlinesResult.rows[0] || deadlines;
        } catch (e) {
            // booking_deadlines table may not exist yet
        }

        // Active Shipments: Bookings with ALLOCATED/CONFIRMED/USED status where ETA > today
        let activeShipments = { active_count: 0 };
        try {
            const activeShipmentsResult = await pool.query(`
                SELECT COUNT(*) as active_count
                FROM bookings
                WHERE status IN ('ALLOCATED', 'CONFIRMED', 'USED')
                AND (eta IS NULL OR DATE(eta) >= CURRENT_DATE)
            `);
            activeShipments = activeShipmentsResult.rows[0] || activeShipments;
        } catch (e) {
            // bookings table may not exist yet
        }

        const shipments = shipmentsResult.rows[0] || { total: 0, in_transit: 0, at_port: 0, delivered: 0, pending: 0, in_customs: 0 };
        const bookings = bookingsResult.rows[0] || { total: 0, fcl: 0, air: 0, pending: 0, confirmed: 0 };
        const documents = documentsResult.rows[0] || { total: 0, validated: 0, pending: 0 };

        res.json({
            success: true,
            metrics: {
                shipments: {
                    total: parseInt(shipments.total) || 0,
                    inTransit: parseInt(shipments.in_transit) || 0,
                    atPort: parseInt(shipments.at_port) || 0,
                    delivered: parseInt(shipments.delivered) || 0,
                    pending: parseInt(shipments.pending) || 0,
                    inCustoms: parseInt(shipments.in_customs) || 0,
                    activeBookings: parseInt(activeShipments.active_count) || 0,
                },
                bookings: {
                    total: parseInt(bookings.total) || 0,
                    fcl: parseInt(bookings.fcl) || 0,
                    air: parseInt(bookings.air) || 0,
                    pending: parseInt(bookings.pending) || 0,
                    confirmed: parseInt(bookings.confirmed) || 0,
                },
                documents: {
                    total: parseInt(documents.total) || 0,
                    validated: parseInt(documents.validated) || 0,
                    pending: parseInt(documents.pending) || 0,
                },
                alerts: {
                    total: parseInt(alerts.total) || 0,
                    critical: parseInt(alerts.critical) || 0,
                    unread: parseInt(alerts.unread) || 0,
                },
                deadlines: {
                    upcoming: parseInt(deadlines.upcoming_count) || 0,
                    urgent: parseInt(deadlines.urgent_count) || 0,
                },
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        // Return zeros - no mock data
        res.json({
            success: true,
            metrics: {
                shipments: { total: 0, inTransit: 0, atPort: 0, delivered: 0, pending: 0, inCustoms: 0, activeBookings: 0 },
                bookings: { total: 0, fcl: 0, air: 0, pending: 0, confirmed: 0 },
                documents: { total: 0, validated: 0, pending: 0 },
                alerts: { total: 0, critical: 0, unread: 0 },
                deadlines: { upcoming: 0, urgent: 0 },
            },
            timestamp: new Date().toISOString(),
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
        res.json({ success: true, shipments: [] });
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
        res.json({ success: true, deadlines: [] });
    }
});

module.exports = router;
