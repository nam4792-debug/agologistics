const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('./auth');

// ─── Simple in-memory cache (30s TTL) ───
let metricsCache = null;
let metricsCacheTime = 0;
const CACHE_TTL_MS = 30000;

// Dashboard metrics - aggregated data from database
router.get('/metrics', authenticateToken, async (req, res) => {
    try {
        // Check cache
        const now = Date.now();
        if (metricsCache && (now - metricsCacheTime) < CACHE_TTL_MS) {
            return res.json({ ...metricsCache, cached: true });
        }

        // Get shipment counts by status
        // Pipeline counts aligned with ShipmentDetail statusFlow
        const shipmentsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'BOOKED' OR status = 'BOOKING_CONFIRMED' THEN 1 ELSE 0 END) as booked,
                SUM(CASE WHEN status = 'DOCUMENTATION_IN_PROGRESS' THEN 1 ELSE 0 END) as doc_in_progress,
                SUM(CASE WHEN status = 'READY_TO_LOAD' THEN 1 ELSE 0 END) as ready_to_load,
                SUM(CASE WHEN status IN ('LOADING', 'LOADED') THEN 1 ELSE 0 END) as loading,
                SUM(CASE WHEN status IN ('CUSTOMS_SUBMITTED', 'CUSTOMS_CLEARED') THEN 1 ELSE 0 END) as customs,
                SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit,
                SUM(CASE WHEN status = 'ARRIVED' THEN 1 ELSE 0 END) as arrived,
                SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered
            FROM shipments
            WHERE status != 'DRAFT'
        `);

        // FIX A1: Active bookings only (PENDING + CONFIRMED + ALLOCATED), not total
        const bookingsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN type = 'FCL' THEN 1 ELSE 0 END) as fcl,
                SUM(CASE WHEN type = 'AIR' THEN 1 ELSE 0 END) as air,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN status = 'ALLOCATED' THEN 1 ELSE 0 END) as allocated
            FROM bookings
            WHERE status IN ('PENDING', 'CONFIRMED', 'ALLOCATED')
        `);

        // Get document counts — exclude docs belonging to DRAFT shipments for awaiting_review
        const documentsResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN d.status IN ('APPROVED', 'VALIDATED') THEN 1 ELSE 0 END) as validated,
                SUM(CASE WHEN d.status = 'UPLOADED' AND s.status != 'DRAFT' THEN 1 ELSE 0 END) as awaiting_review
            FROM documents d
            LEFT JOIN shipments s ON d.shipment_id = s.id
            WHERE d.deleted_at IS NULL
        `);

        // Get shipments that have no documents at all — exclude DRAFT and finished ones
        const shipmentsWithoutDocsResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM shipments s
            WHERE NOT EXISTS (
                SELECT 1 FROM documents d WHERE d.shipment_id = s.id AND d.deleted_at IS NULL
            )
            AND s.status NOT IN ('DRAFT', 'DELIVERED', 'CANCELLED', 'COMPLETED')
        `);

        // FIX A5: Count SHIPMENTS that have unvalidated docs (not doc count)
        let shipmentsWithUnvalidatedDocs = 0;
        try {
            const unvalidatedResult = await pool.query(`
                SELECT COUNT(DISTINCT s.id) as count
                FROM shipments s
                INNER JOIN documents d ON d.shipment_id = s.id AND d.deleted_at IS NULL
                WHERE d.status = 'UPLOADED'
                AND s.status NOT IN ('DRAFT', 'DELIVERED', 'CANCELLED', 'COMPLETED')
            `);
            shipmentsWithUnvalidatedDocs = parseInt(unvalidatedResult.rows[0]?.count) || 0;
        } catch (e) { /* ignore */ }

        // Alert counts: only count HIGH/CRITICAL unread notifications (not accumulated spam)
        let alerts = { total: 0, critical: 0, unread: 0 };
        try {
            const alertsResult = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN priority IN ('CRITICAL', 'HIGH') AND is_read = false THEN 1 END) as critical,
                    COUNT(CASE WHEN is_read = false THEN 1 END) as unread
                FROM notifications
                WHERE created_at > NOW() - INTERVAL '7 days'
            `);
            alerts = alertsResult.rows[0] || alerts;
        } catch (e) {
            /* notifications table may not exist yet */
        }

        // FIX A6: Calculate upcoming deadlines — check ALL 3 columns for urgent
        let deadlines = { upcoming_count: 0, urgent_count: 0, nearest_days: null };
        try {
            const deadlinesResult = await pool.query(`
                SELECT 
                    COUNT(*) as upcoming_count,
                    SUM(CASE 
                        WHEN (DATE(cut_off_si) <= CURRENT_DATE + INTERVAL '3 days' AND DATE(cut_off_si) >= CURRENT_DATE) 
                          OR (DATE(cut_off_vgm) <= CURRENT_DATE + INTERVAL '3 days' AND DATE(cut_off_vgm) >= CURRENT_DATE)
                          OR (DATE(cut_off_cy) <= CURRENT_DATE + INTERVAL '3 days' AND DATE(cut_off_cy) >= CURRENT_DATE)
                        THEN 1 ELSE 0 
                    END) as urgent_count,
                    MIN(LEAST(
                        CASE WHEN cut_off_si >= NOW() THEN EXTRACT(EPOCH FROM cut_off_si - NOW()) / 86400 ELSE 999 END,
                        CASE WHEN cut_off_vgm >= NOW() THEN EXTRACT(EPOCH FROM cut_off_vgm - NOW()) / 86400 ELSE 999 END,
                        CASE WHEN cut_off_cy >= NOW() THEN EXTRACT(EPOCH FROM cut_off_cy - NOW()) / 86400 ELSE 999 END
                    )) as nearest_days
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

        // Active Shipments: Exclude DRAFT (not started), DELIVERED, CANCELLED, COMPLETED
        let activeShipments = { active_count: 0 };
        try {
            const activeShipmentsResult = await pool.query(`
                SELECT COUNT(*) as active_count
                FROM shipments
                WHERE status NOT IN ('DRAFT', 'DELIVERED', 'CANCELLED', 'COMPLETED')
            `);
            activeShipments = activeShipmentsResult.rows[0] || activeShipments;
        } catch (e) { /* ignore */ }

        // Get active truck dispatches count
        let dispatchCounts = { total: 0, active: 0 };
        try {
            const dispatchResult = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('SCHEDULED', 'IN_TRANSIT') THEN 1 ELSE 0 END) as active
                FROM truck_dispatches
            `);
            dispatchCounts = dispatchResult.rows[0] || dispatchCounts;
        } catch (e) { /* truck_dispatches table may not exist yet */ }

        // FIX A3: Invoice metrics — these are PAYABLES (costs to vendors)
        let invoiceMetrics = { overdue: 0, overdue_amount: 0, pending: 0, pending_amount: 0, total_payable: 0 };
        try {
            const invoiceResult = await pool.query(`
                SELECT 
                    SUM(CASE WHEN status = 'OVERDUE' OR (status = 'PENDING' AND due_date < CURRENT_DATE) THEN 1 ELSE 0 END) as overdue,
                    SUM(CASE WHEN status = 'OVERDUE' OR (status = 'PENDING' AND due_date < CURRENT_DATE) THEN amount_usd ELSE 0 END) as overdue_amount,
                    SUM(CASE WHEN status = 'PENDING' AND (due_date >= CURRENT_DATE OR due_date IS NULL) THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'PENDING' AND (due_date >= CURRENT_DATE OR due_date IS NULL) THEN amount_usd ELSE 0 END) as pending_amount,
                    SUM(CASE WHEN status IN ('PENDING', 'OVERDUE') THEN amount_usd ELSE 0 END) as total_payable
                FROM invoices
                WHERE status NOT IN ('CANCELLED', 'PAID')
            `);
            invoiceMetrics = invoiceResult.rows[0] || invoiceMetrics;
        } catch (e) { /* invoices table may not exist yet */ }

        // NEW B3: Bookings confirmed but without truck dispatch
        let bookingsWithoutDispatch = 0;
        try {
            const bwdResult = await pool.query(`
                SELECT COUNT(*) as count
                FROM bookings b
                WHERE b.status = 'CONFIRMED'
                AND b.type = 'FCL'
                AND NOT EXISTS (
                    SELECT 1 FROM truck_dispatches td WHERE td.booking_id = b.id
                )
            `);
            bookingsWithoutDispatch = parseInt(bwdResult.rows[0]?.count) || 0;
        } catch (e) { /* ignore */ }

        // NEW C1: Completed shipments this month
        let completedThisMonth = 0;
        let completedLastMonth = 0;
        try {
            const completedResult = await pool.query(`
                SELECT 
                    SUM(CASE WHEN updated_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 ELSE 0 END) as this_month,
                    SUM(CASE WHEN updated_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                             AND updated_at < DATE_TRUNC('month', CURRENT_DATE) THEN 1 ELSE 0 END) as last_month
                FROM shipments
                WHERE status IN ('DELIVERED', 'COMPLETED')
            `);
            completedThisMonth = parseInt(completedResult.rows[0]?.this_month) || 0;
            completedLastMonth = parseInt(completedResult.rows[0]?.last_month) || 0;
        } catch (e) { /* ignore */ }

        // NEW C2: On-time delivery rate (DELIVERED where ata <= eta)
        let onTimeRate = null;
        try {
            const onTimeResult = await pool.query(`
                SELECT 
                    COUNT(*) as total_delivered,
                    SUM(CASE WHEN ata IS NOT NULL AND eta IS NOT NULL AND ata <= eta THEN 1 ELSE 0 END) as on_time
                FROM shipments
                WHERE status IN ('DELIVERED', 'COMPLETED')
                AND ata IS NOT NULL
            `);
            const totalDel = parseInt(onTimeResult.rows[0]?.total_delivered) || 0;
            const onTime = parseInt(onTimeResult.rows[0]?.on_time) || 0;
            onTimeRate = totalDel > 0 ? Math.round((onTime / totalDel) * 100) : null;
        } catch (e) { /* ignore */ }

        const shipments = shipmentsResult.rows[0] || { total: 0, booked: 0, doc_in_progress: 0, ready_to_load: 0, loading: 0, customs: 0, in_transit: 0, arrived: 0, delivered: 0 };
        const bookings = bookingsResult.rows[0] || { total: 0, fcl: 0, air: 0, pending: 0, confirmed: 0 };
        const documents = documentsResult.rows[0] || { total: 0, validated: 0, awaiting_review: 0 };

        const response = {
            success: true,
            metrics: {
                shipments: {
                    total: parseInt(shipments.total) || 0,
                    booked: parseInt(shipments.booked) || 0,
                    docInProgress: parseInt(shipments.doc_in_progress) || 0,
                    readyToLoad: parseInt(shipments.ready_to_load) || 0,
                    loading: parseInt(shipments.loading) || 0,
                    customs: parseInt(shipments.customs) || 0,
                    inTransit: parseInt(shipments.in_transit) || 0,
                    arrived: parseInt(shipments.arrived) || 0,
                    delivered: parseInt(shipments.delivered) || 0,
                    activeCount: parseInt(activeShipments.active_count) || 0,
                    completedThisMonth,
                    completedLastMonth,
                    onTimeRate,
                },
                bookings: {
                    total: parseInt(bookings.total) || 0,
                    fcl: parseInt(bookings.fcl) || 0,
                    air: parseInt(bookings.air) || 0,
                    pending: parseInt(bookings.pending) || 0,
                    confirmed: parseInt(bookings.confirmed) || 0,
                    allocated: parseInt(bookings.allocated) || 0,
                    withoutDispatch: bookingsWithoutDispatch,
                },
                documents: {
                    total: parseInt(documents.total) || 0,
                    validated: parseInt(documents.validated) || 0,
                    awaitingReview: parseInt(documents.awaiting_review) || 0,
                    shipmentsWithoutDocs: parseInt(shipmentsWithoutDocsResult.rows[0]?.count) || 0,
                    shipmentsWithUnvalidatedDocs,
                },
                alerts: {
                    total: parseInt(alerts.total) || 0,
                    critical: parseInt(alerts.critical) || 0,
                    unread: parseInt(alerts.unread) || 0,
                },
                deadlines: {
                    upcoming: parseInt(deadlines.upcoming_count) || 0,
                    urgent: parseInt(deadlines.urgent_count) || 0,
                    nearestDays: deadlines.nearest_days != null ? Math.round(parseFloat(deadlines.nearest_days)) : null,
                },
                dispatches: {
                    total: parseInt(dispatchCounts.total) || 0,
                    active: parseInt(dispatchCounts.active) || 0,
                },
                invoices: {
                    overdue: parseInt(invoiceMetrics.overdue) || 0,
                    overdueAmount: parseFloat(invoiceMetrics.overdue_amount) || 0,
                    pending: parseInt(invoiceMetrics.pending) || 0,
                    pendingAmount: parseFloat(invoiceMetrics.pending_amount) || 0,
                    totalPayable: parseFloat(invoiceMetrics.total_payable) || 0,
                },
            },
            timestamp: new Date().toISOString(),
        };

        // Store in cache
        metricsCache = response;
        metricsCacheTime = now;

        res.json(response);
    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        // Return zeros - no mock data
        res.json({
            success: true,
            metrics: {
                shipments: { total: 0, booked: 0, docInProgress: 0, readyToLoad: 0, loading: 0, customs: 0, inTransit: 0, arrived: 0, delivered: 0, activeCount: 0, completedThisMonth: 0, completedLastMonth: 0, onTimeRate: null },
                bookings: { total: 0, fcl: 0, air: 0, pending: 0, confirmed: 0, withoutDispatch: 0 },
                documents: { total: 0, validated: 0, awaitingReview: 0, shipmentsWithoutDocs: 0, shipmentsWithUnvalidatedDocs: 0 },
                alerts: { total: 0, critical: 0, unread: 0 },
                deadlines: { upcoming: 0, urgent: 0, nearestDays: null },
                dispatches: { total: 0, active: 0 },
                invoices: { overdue: 0, overdueAmount: 0, pending: 0, pendingAmount: 0, totalPayable: 0 },
            },
            timestamp: new Date().toISOString(),
        });
    }
});

// Get recent shipments for dashboard — with extended info
router.get('/recent-shipments', authenticateToken, async (req, res) => {
    try {
        // Only show active shipments — exclude DRAFT (not started) and DELIVERED/COMPLETED/CANCELLED (finished)
        // FIX A4: Include container info + doc completion stats
        const { rows } = await pool.query(`
            SELECT s.id, s.shipment_number, s.type, s.status, s.origin_country, s.destination_country, 
                   c.company_name as customer_name, s.etd, s.eta, s.created_at,
                   b.booking_number,
                   s.container_type, s.container_count,
                   (SELECT COUNT(*) FROM documents d WHERE d.shipment_id = s.id AND d.deleted_at IS NULL) as total_docs,
                   (SELECT COUNT(*) FROM documents d WHERE d.shipment_id = s.id AND d.deleted_at IS NULL AND d.status IN ('APPROVED', 'VALIDATED')) as validated_docs
            FROM shipments s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN bookings b ON b.shipment_id = s.id
            WHERE s.status NOT IN ('DRAFT', 'DELIVERED', 'COMPLETED', 'CANCELLED')
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
router.get('/upcoming-deadlines', authenticateToken, async (req, res) => {
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
