const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const crypto = require('crypto');

// ═══════════════════════════════════════════════
// PUBLIC: Track shipment without login
// ═══════════════════════════════════════════════
router.get('/track/:trackingNumber', async (req, res) => {
    try {
        const { trackingNumber } = req.params;
        const { rows } = await pool.query(
            `SELECT 
                s.shipment_number, s.type, s.status, s.origin_port, s.destination_port,
                s.etd, s.eta, s.atd, s.ata, s.cargo_description,
                c.company_name AS customer_name
            FROM shipments s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.shipment_number = $1`,
            [trackingNumber.toUpperCase()]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        const shipment = rows[0];

        // Build status timeline
        const statusFlow = ['DRAFT', 'BOOKED', 'IN_TRANSIT', 'ARRIVED', 'CUSTOMS', 'DELIVERED', 'COMPLETED'];
        const currentIndex = statusFlow.indexOf(shipment.status);
        const timeline = statusFlow.map((status, i) => ({
            status,
            label: status.replace(/_/g, ' '),
            completed: i <= currentIndex,
            current: i === currentIndex,
        }));

        res.json({
            shipment: {
                shipmentNumber: shipment.shipment_number,
                type: shipment.type,
                status: shipment.status,
                origin: shipment.origin_port,
                destination: shipment.destination_port,
                etd: shipment.etd,
                eta: shipment.eta,
                atd: shipment.atd,
                ata: shipment.ata,
                cargoDescription: shipment.cargo_description,
                customer: shipment.customer_name,
            },
            timeline,
        });
    } catch (error) {
        console.error('Track shipment error:', error);
        res.status(500).json({ error: 'Failed to track shipment' });
    }
});

// ═══════════════════════════════════════════════
// CUSTOMER AUTH: Login via email + OTP
// ═══════════════════════════════════════════════

// Request OTP
router.post('/login', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        // Find customer by email
        const { rows: customers } = await pool.query(
            'SELECT id, company_name, email FROM customers WHERE email = $1',
            [email.toLowerCase()]
        );

        if (customers.length === 0) {
            return res.status(404).json({ error: 'No account found with this email' });
        }

        const customer = customers[0];

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP as portal token
        await pool.query(
            `INSERT INTO customer_portal_tokens (customer_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [customer.id, otp, expiresAt]
        );

        // In production, this would send an email via nodemailer
        console.log(`🔑 OTP for ${email}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP sent to your email',
            // ONLY for development - remove in production!
            ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
        });
    } catch (error) {
        console.error('Portal login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify OTP
router.post('/verify', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

        const { rows: customers } = await pool.query(
            'SELECT id FROM customers WHERE email = $1',
            [email.toLowerCase()]
        );
        if (customers.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const customerId = customers[0].id;

        // Find valid OTP
        const { rows: tokens } = await pool.query(
            `SELECT id FROM customer_portal_tokens
             WHERE customer_id = $1 AND token = $2 AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [customerId, otp]
        );

        if (tokens.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        // Generate session token
        const jwt = require('jsonwebtoken');
        const sessionToken = jwt.sign(
            { customerId, type: 'portal' },
            process.env.JWT_SECRET || 'logispro-secret-key',
            { expiresIn: '24h' }
        );

        // Clean up used OTP
        await pool.query(
            'DELETE FROM customer_portal_tokens WHERE customer_id = $1',
            [customerId]
        );

        res.json({ success: true, token: sessionToken });
    } catch (error) {
        console.error('OTP verify error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// ═══════════════════════════════════════════════
// PORTAL AUTH MIDDLEWARE
// ═══════════════════════════════════════════════
function portalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Portal login required' });

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'logispro-secret-key');
        if (decoded.type !== 'portal') return res.status(403).json({ error: 'Invalid portal token' });
        req.customerId = decoded.customerId;
        next();
    } catch {
        res.status(401).json({ error: 'Token expired' });
    }
}

// ═══════════════════════════════════════════════
// AUTHENTICATED: Customer's shipments
// ═══════════════════════════════════════════════
router.get('/shipments', portalAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT 
                s.id, s.shipment_number, s.type, s.status,
                s.origin_port, s.destination_port,
                s.etd, s.eta, s.cargo_description,
                s.created_at
            FROM shipments s
            WHERE s.customer_id = $1
            ORDER BY s.created_at DESC`,
            [req.customerId]
        );
        res.json({ shipments: rows });
    } catch (error) {
        console.error('Portal shipments error:', error);
        res.status(500).json({ error: 'Failed to fetch shipments' });
    }
});

// ═══════════════════════════════════════════════
// AUTHENTICATED: Shipment documents
// ═══════════════════════════════════════════════
router.get('/shipments/:id/documents', portalAuth, async (req, res) => {
    try {
        // Verify ownership
        const { rows: shipment } = await pool.query(
            'SELECT id FROM shipments WHERE id = $1 AND customer_id = $2',
            [req.params.id, req.customerId]
        );
        if (shipment.length === 0) return res.status(403).json({ error: 'Access denied' });

        const { rows: docs } = await pool.query(
            `SELECT id, document_type, document_number, version, status, created_at
             FROM documents WHERE shipment_id = $1
             ORDER BY created_at DESC`,
            [req.params.id]
        );
        res.json({ documents: docs });
    } catch (error) {
        console.error('Portal documents error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// ═══════════════════════════════════════════════
// AUTHENTICATED: Customer's invoices
// ═══════════════════════════════════════════════
router.get('/invoices', portalAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT 
                i.id, i.invoice_number, i.amount_usd, i.status, i.due_date, i.created_at,
                s.shipment_number
            FROM invoices i
            LEFT JOIN shipments s ON i.shipment_id = s.id
            WHERE s.customer_id = $1
            ORDER BY i.created_at DESC`,
            [req.customerId]
        );
        res.json({ invoices: rows });
    } catch (error) {
        console.error('Portal invoices error:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

module.exports = router;
