const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Global search - searches shipments, bookings, documents
router.get('/', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.json({ results: [], message: 'Query must be at least 2 characters' });
        }

        const searchTerm = `%${q.trim()}%`;
        const results = {
            shipments: [],
            bookings: [],
            exact_match: null
        };

        // Search shipments
        const { rows: shipments } = await pool.query(`
            SELECT s.id, s.shipment_number, s.type, s.status, 
                   s.origin_port, s.destination_port,
                   c.company_name as customer_name
            FROM shipments s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.shipment_number LIKE ?
               OR s.origin_port LIKE ?
               OR s.destination_port LIKE ?
            ORDER BY s.created_at DESC
            LIMIT 10
        `, [searchTerm, searchTerm, searchTerm]);

        results.shipments = shipments;

        // Search bookings
        const { rows: bookings } = await pool.query(`
            SELECT b.id, b.booking_number, b.type, b.status,
                   b.origin_port, b.destination_port, b.vessel_flight,
                   f.company_name as forwarder_name
            FROM bookings b
            LEFT JOIN forwarders f ON b.forwarder_id = f.id
            WHERE b.booking_number LIKE ?
               OR b.origin_port LIKE ?
               OR b.destination_port LIKE ?
               OR b.vessel_flight LIKE ?
            ORDER BY b.created_at DESC
            LIMIT 10
        `, [searchTerm, searchTerm, searchTerm, searchTerm]);

        results.bookings = bookings;

        // Check for exact match (single result)
        const totalResults = results.shipments.length + results.bookings.length;

        if (totalResults === 1) {
            if (results.shipments.length === 1) {
                results.exact_match = {
                    type: 'shipment',
                    id: results.shipments[0].id,
                    redirect: `/shipments/${results.shipments[0].id}`
                };
            } else if (results.bookings.length === 1) {
                results.exact_match = {
                    type: 'booking',
                    id: results.bookings[0].id,
                    redirect: `/bookings/${results.bookings[0].id}`
                };
            }
        }

        res.json({
            success: true,
            query: q,
            results,
            total: totalResults
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed', message: error.message });
    }
});

module.exports = router;
