const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('./auth');

// ═══════════════════════════════════════════════
// DASHBOARD OVERVIEW
// ═══════════════════════════════════════════════
router.get('/overview', authenticateToken, async (req, res) => {
    try {
        const { period } = req.query; // 'week', 'month', 'quarter', 'year'
        let dateFilter = '';
        if (period === 'week') dateFilter = "AND s.created_at >= NOW() - INTERVAL '7 days'";
        else if (period === 'month') dateFilter = "AND s.created_at >= NOW() - INTERVAL '30 days'";
        else if (period === 'quarter') dateFilter = "AND s.created_at >= NOW() - INTERVAL '90 days'";
        else if (period === 'year') dateFilter = "AND s.created_at >= NOW() - INTERVAL '365 days'";

        // Shipments overview
        const { rows: shipmentStats } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'IN_TRANSIT' THEN 1 END) as in_transit,
                COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft,
                COUNT(CASE WHEN type = 'FCL' THEN 1 END) as fcl_count,
                COUNT(CASE WHEN type = 'AIR' THEN 1 END) as air_count,
                COALESCE(SUM(total_cost_usd), 0) as total_cost
            FROM shipments s WHERE 1=1 ${dateFilter}
        `);

        // Invoice overview
        const { rows: invoiceStats } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COALESCE(SUM(amount_usd), 0) as total_amount,
                COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount_usd ELSE 0 END), 0) as paid_amount,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount_usd ELSE 0 END), 0) as pending_amount,
                COUNT(CASE WHEN status = 'OVERDUE' OR (status = 'PENDING' AND due_date < NOW()) THEN 1 END) as overdue_count
            FROM invoices i WHERE 1=1
        `);

        // Customer count
        const { rows: customerStats } = await pool.query('SELECT COUNT(*) as total FROM customers');

        // Booking overview — all statuses
        const { rows: bookingStats } = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmed,
                COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'ALLOCATED' THEN 1 END) as allocated,
                COUNT(CASE WHEN status = 'USED' THEN 1 END) as used,
                COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
                COALESCE(SUM(CASE WHEN status NOT IN ('CANCELLED') THEN freight_rate_usd ELSE 0 END), 0) as total_freight_revenue
            FROM bookings b WHERE 1=1 ${dateFilter.replace('s.', 'b.')}
        `);

        res.json({
            shipments: shipmentStats[0],
            invoices: invoiceStats[0],
            customers: customerStats[0],
            bookings: bookingStats[0],
        });
    } catch (error) {
        console.error('Error fetching overview:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════
// MONTHLY TRENDS (for charts)
// ═══════════════════════════════════════════════
router.get('/trends', authenticateToken, async (req, res) => {
    try {
        const { months } = req.query;
        const monthCount = parseInt(req.query.months || '6');

        // Shipments per month
        const { rows: shipmentTrends } = await pool.query(`
            SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
                COUNT(*) as shipment_count,
                COALESCE(SUM(total_cost_usd), 0) as total_cost
            FROM shipments
            WHERE created_at >= NOW() - INTERVAL '${monthCount} months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month
        `);

        // Invoices per month
        const { rows: invoiceTrends } = await pool.query(`
            SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
                COALESCE(SUM(amount_usd), 0) as total_amount,
                COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount_usd ELSE 0 END), 0) as paid_amount
            FROM invoices
            WHERE created_at >= NOW() - INTERVAL '${monthCount} months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month
        `);

        // Bookings per month
        const { rows: bookingTrends } = await pool.query(`
            SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
                COUNT(*) as booking_count
            FROM bookings
            WHERE created_at >= NOW() - INTERVAL '${monthCount} months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month
        `);

        res.json({
            shipments: shipmentTrends,
            invoices: invoiceTrends,
            bookings: bookingTrends,
        });
    } catch (error) {
        console.error('Error fetching trends:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════
// COST ANALYSIS
// ═══════════════════════════════════════════════
router.get('/cost-analysis', authenticateToken, async (req, res) => {
    try {
        // Top vendors by cost
        const { rows: topVendors } = await pool.query(`
            SELECT 
                COALESCE(f.company_name, i.vendor_name, 'Unknown') as vendor_name,
                COUNT(i.id) as invoice_count,
                COALESCE(SUM(i.amount_usd), 0) as total_amount
            FROM invoices i
            LEFT JOIN forwarders f ON i.forwarder_id = f.id
            WHERE i.status != 'CANCELLED'
            GROUP BY COALESCE(f.company_name, i.vendor_name, 'Unknown')
            ORDER BY total_amount DESC
            LIMIT 10
        `);

        // Cost by category
        const { rows: costByCategory } = await pool.query(`
            SELECT 
                COALESCE(category, 'UNCATEGORIZED') as category,
                COUNT(*) as count,
                COALESCE(SUM(amount_usd), 0) as total
            FROM invoices
            WHERE status != 'CANCELLED'
            GROUP BY category
            ORDER BY total DESC
        `);

        // Cost by shipment type
        const { rows: costByType } = await pool.query(`
            SELECT 
                s.type,
                COUNT(DISTINCT s.id) as shipment_count,
                COALESCE(SUM(i.amount_usd), 0) as total_cost,
                CASE WHEN COUNT(DISTINCT s.id) > 0 
                     THEN COALESCE(SUM(i.amount_usd), 0) / COUNT(DISTINCT s.id) 
                     ELSE 0 END as avg_cost
            FROM shipments s
            LEFT JOIN invoices i ON i.shipment_id = s.id AND i.status != 'CANCELLED'
            GROUP BY s.type
            ORDER BY total_cost DESC
        `);

        res.json({
            topVendors,
            costByCategory,
            costByType,
        });
    } catch (error) {
        console.error('Error fetching cost analysis:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════
// SHIPMENT PERFORMANCE
// ═══════════════════════════════════════════════
router.get('/performance', authenticateToken, async (req, res) => {
    try {
        // Shipments by status
        const { rows: byStatus } = await pool.query(`
            SELECT status, COUNT(*) as count
            FROM shipments
            GROUP BY status
            ORDER BY count DESC
        `);

        // On-time performance (shipments delivered on or before ETA)
        const { rows: onTimePerfRows } = await pool.query(`
            SELECT 
                COUNT(*) as total_with_dates,
                COUNT(CASE WHEN ata IS NOT NULL AND eta IS NOT NULL AND ata <= eta THEN 1 END) as on_time,
                COUNT(CASE WHEN ata IS NOT NULL AND eta IS NOT NULL AND ata > eta THEN 1 END) as delayed
            FROM shipments
            WHERE ata IS NOT NULL AND eta IS NOT NULL
        `);

        // Customer ranking (by shipment count and revenue)
        const { rows: customerRanking } = await pool.query(`
            SELECT 
                c.company_name as customer_name,
                COUNT(s.id) as shipment_count,
                COALESCE(SUM(s.total_cost_usd), 0) as total_revenue
            FROM customers c
            LEFT JOIN shipments s ON s.customer_id = c.id
            GROUP BY c.id, c.company_name
            ORDER BY shipment_count DESC
            LIMIT 10
        `);

        const onTimePerf = onTimePerfRows[0] || {};

        res.json({
            byStatus,
            onTimePerformance: {
                total: parseInt(onTimePerf.total_with_dates) || 0,
                onTime: parseInt(onTimePerf.on_time) || 0,
                delayed: parseInt(onTimePerf.delayed) || 0,
                onTimeRate: onTimePerf.total_with_dates > 0
                    ? Math.round((onTimePerf.on_time / onTimePerf.total_with_dates) * 100)
                    : 0,
            },
            customerRanking,
        });
    } catch (error) {
        console.error('Error fetching performance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════
// EXPORT ENDPOINTS
// ═══════════════════════════════════════════════

// Export shipments as JSON (CSV-ready)
router.get('/export/shipments', authenticateToken, async (req, res) => {
    try {
        const { format } = req.query;

        const { rows } = await pool.query(`
            SELECT 
                s.shipment_number, s.type, s.status,
                c.company_name as customer,
                s.origin_port, s.destination_port,
                s.etd, s.eta, s.atd, s.ata,
                s.container_count, s.cargo_description,
                s.cargo_weight_kg, s.total_cost_usd,
                s.incoterm, s.created_at
            FROM shipments s
            LEFT JOIN customers c ON s.customer_id = c.id
            ORDER BY s.created_at DESC
        `);

        if (format === 'csv') {
            const headers = Object.keys(rows[0] || {}).join(',');
            const csvRows = rows.map(r => Object.values(r).map(v => `"${v || ''}"`).join(','));
            const csv = [headers, ...csvRows].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=shipments_export.csv');
            return res.send(csv);
        }

        res.json({ data: rows, count: rows.length });
    } catch (error) {
        console.error('Error exporting shipments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export invoices as JSON (CSV-ready)
router.get('/export/invoices', authenticateToken, async (req, res) => {
    try {
        const { format } = req.query;

        const { rows } = await pool.query(`
            SELECT 
                i.invoice_number, i.vendor_name, i.amount_usd, i.currency,
                i.status, i.category, i.issue_date, i.due_date, i.paid_date,
                s.shipment_number,
                f.company_name as forwarder
            FROM invoices i
            LEFT JOIN shipments s ON i.shipment_id = s.id
            LEFT JOIN forwarders f ON i.forwarder_id = f.id
            ORDER BY i.created_at DESC
        `);

        if (format === 'csv') {
            const headers = Object.keys(rows[0] || {}).join(',');
            const csvRows = rows.map(r => Object.values(r).map(v => `"${v || ''}"`).join(','));
            const csv = [headers, ...csvRows].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=invoices_export.csv');
            return res.send(csv);
        }

        res.json({ data: rows, count: rows.length });
    } catch (error) {
        console.error('Error exporting invoices:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export customers
router.get('/export/customers', authenticateToken, async (req, res) => {
    try {
        const { format } = req.query;

        const { rows } = await pool.query(`
            SELECT 
                c.company_name, c.contact_name, c.email, c.phone, c.country,
                COUNT(s.id) as shipment_count,
                COALESCE(SUM(s.total_cost_usd), 0) as total_revenue
            FROM customers c
            LEFT JOIN shipments s ON s.customer_id = c.id
            GROUP BY c.id, c.company_name, c.contact_name, c.email, c.phone, c.country
            ORDER BY c.company_name
        `);

        if (format === 'csv') {
            const headers = Object.keys(rows[0] || {}).join(',');
            const csvRows = rows.map(r => Object.values(r).map(v => `"${v || ''}"`).join(','));
            const csv = [headers, ...csvRows].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=customers_export.csv');
            return res.send(csv);
        }

        res.json({ data: rows, count: rows.length });
    } catch (error) {
        console.error('Error exporting customers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
