const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('./auth');

// Global search - searches shipments, bookings, customers, vendors, invoices
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.json({ results: [], message: 'Query must be at least 2 characters' });
        }

        const searchTerm = `%${q.trim()}%`;
        const results = {
            shipments: [],
            bookings: [],
            customers: [],
            vendors: [],
            invoices: [],
            exact_match: null
        };

        // Search shipments
        const { rows: shipments } = await pool.query(`
            SELECT s.id, s.shipment_number, s.type, s.status, 
                   s.origin_port, s.destination_port,
                   c.company_name as customer_name
            FROM shipments s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.shipment_number ILIKE $1
               OR s.origin_port ILIKE $1
               OR s.destination_port ILIKE $1
               OR s.cargo_description ILIKE $1
            ORDER BY s.created_at DESC
            LIMIT 10
        `, [searchTerm]);

        results.shipments = shipments;

        // Search bookings
        const { rows: bookings } = await pool.query(`
            SELECT b.id, b.booking_number, b.type, b.status,
                   b.origin_port, b.destination_port, b.vessel_flight,
                   f.company_name as forwarder_name
            FROM bookings b
            LEFT JOIN forwarders f ON b.forwarder_id = f.id
            WHERE b.booking_number ILIKE $1
               OR b.origin_port ILIKE $1
               OR b.destination_port ILIKE $1
               OR b.vessel_flight ILIKE $1
            ORDER BY b.created_at DESC
            LIMIT 10
        `, [searchTerm]);

        results.bookings = bookings;

        // BUG-20: Search customers
        const { rows: customers } = await pool.query(`
            SELECT id, company_name, contact_name, email, phone, customer_code
            FROM customers
            WHERE company_name ILIKE $1
               OR contact_name ILIKE $1
               OR customer_code ILIKE $1
               OR email ILIKE $1
            ORDER BY company_name ASC
            LIMIT 10
        `, [searchTerm]);

        results.customers = customers;

        // BUG-20: Search vendors/forwarders
        const { rows: vendors } = await pool.query(`
            SELECT id, company_name as name, contact_name, email, phone
            FROM forwarders
            WHERE company_name ILIKE $1
               OR contact_name ILIKE $1
               OR email ILIKE $1
            ORDER BY company_name ASC
            LIMIT 10
        `, [searchTerm]);

        results.vendors = vendors;

        // BUG-20: Search invoices
        const { rows: invoices } = await pool.query(`
            SELECT i.id, i.invoice_number, i.status, i.amount_usd, i.currency,
                   s.shipment_number
            FROM invoices i
            LEFT JOIN shipments s ON i.shipment_id = s.id
            WHERE i.invoice_number ILIKE $1
            ORDER BY i.created_at DESC
            LIMIT 10
        `, [searchTerm]);

        results.invoices = invoices;

        // Check for exact match (single result across all categories)
        const totalResults = results.shipments.length + results.bookings.length +
            results.customers.length + results.vendors.length + results.invoices.length;

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
            } else if (results.customers.length === 1) {
                results.exact_match = {
                    type: 'customer',
                    id: results.customers[0].id,
                    redirect: `/customers`
                };
            } else if (results.vendors.length === 1) {
                results.exact_match = {
                    type: 'vendor',
                    id: results.vendors[0].id,
                    redirect: `/vendors`
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

