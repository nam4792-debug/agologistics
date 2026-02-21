const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('./auth');
const auditService = require('../services/auditService');
const { validate, RULES } = require('../middleware/validator');

// Gap #6: Invoice/Cost Management API

// Get all invoices or filter by shipment
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { shipmentId, status } = req.query;
        let query = `
            SELECT i.*, 
                   s.shipment_number,
                   s.type as shipment_type
            FROM invoices i
            LEFT JOIN shipments s ON i.shipment_id = s.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (shipmentId) {
            query += ` AND i.shipment_id = $${paramIndex++}`;
            params.push(shipmentId);
        }
        if (status) {
            query += ` AND i.status = $${paramIndex++}`;
            params.push(status);
        }

        query += ' ORDER BY i.created_at DESC';

        const { rows } = await pool.query(query, params);

        // Calculate summary
        const isOverdue = (inv) => inv.status === 'OVERDUE' || (inv.status === 'PENDING' && inv.due_date && new Date(inv.due_date) < new Date());
        const summary = {
            totalAmount: rows.reduce((sum, inv) => sum + parseFloat(inv.amount_usd || 0), 0),
            pendingAmount: rows.filter(i => i.status === 'PENDING' && !isOverdue(i)).reduce((sum, inv) => sum + parseFloat(inv.amount_usd || 0), 0),
            paidAmount: rows.filter(i => i.status === 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_usd || 0), 0),
            overdueCount: rows.filter(i => isOverdue(i)).length,
            overdueAmount: rows.filter(i => isOverdue(i)).reduce((sum, inv) => sum + parseFloat(inv.amount_usd || 0), 0),
        };

        res.json({ invoices: rows, summary });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.json({ invoices: [], summary: {} });
    }
});

// Get single invoice
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT i.*, s.shipment_number 
             FROM invoices i 
             LEFT JOIN shipments s ON i.shipment_id = s.id
             WHERE i.id = $1`,
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json({ invoice: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create invoice
router.post('/', authenticateToken, validate(RULES.invoice.create), async (req, res) => {
    try {
        const body = req.body;
        const shipmentId = body.shipment_id || body.shipmentId;
        const invoiceNumber = body.invoice_number || body.invoiceNumber || `INV-${Date.now().toString(36).toUpperCase()}`;
        const vendorName = body.vendor_name || body.vendorName || '';
        const amountUsd = parseFloat(body.amount_usd || body.amountUsd || body.amount) || 0;
        const currency = body.currency || 'USD';
        const issueDate = body.issue_date || body.issueDate || null;
        const dueDate = body.due_date || body.dueDate || null;
        const category = body.category || 'FREIGHT';
        const notes = body.notes || null;
        const forwarderId = body.forwarder_id || body.forwarderId || null;

        if (!amountUsd) {
            return res.status(400).json({ error: 'Invoice amount is required' });
        }

        const { rows } = await pool.query(
            `INSERT INTO invoices 
             (shipment_id, invoice_number, vendor_name, amount_usd, currency, 
              issue_date, due_date, status, category, forwarder_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9)
             RETURNING *`,
            [shipmentId || null, invoiceNumber, vendorName, amountUsd, currency, issueDate, dueDate, category, forwarderId]
        );

        // Update shipment total cost
        if (shipmentId) {
            await pool.query(
                `UPDATE shipments SET total_cost_usd = (
                    SELECT COALESCE(SUM(amount_usd), 0) FROM invoices WHERE shipment_id = $1 AND status != 'CANCELLED'
                 ), updated_at = NOW() WHERE id = $1`,
                [shipmentId]
            );
        }

        // Audit trail
        auditService.log('invoice', rows[0].id, 'CREATE', req.user?.userId || null, {
            invoice_number: invoiceNumber,
            amount: amountUsd,
            vendor: vendorName,
        });

        res.status(201).json({ invoice: rows[0] });
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Update invoice status (PENDING → PAID / CANCELLED)
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'DISPUTED'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` });
        }

        // BUG-16: Only set paid_date when marking as PAID, don't reset for other statuses
        let query, params;
        if (status === 'PAID') {
            query = 'UPDATE invoices SET status = $1, paid_date = NOW() WHERE id = $2 RETURNING *';
            params = [status, req.params.id];
        } else {
            query = 'UPDATE invoices SET status = $1 WHERE id = $2 RETURNING *';
            params = [status, req.params.id];
        }

        const { rows } = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Recalculate shipment total cost
        if (rows[0].shipment_id) {
            await pool.query(
                `UPDATE shipments SET total_cost_usd = (
                    SELECT COALESCE(SUM(amount_usd), 0) FROM invoices WHERE shipment_id = $1 AND status NOT IN ('CANCELLED')
                 ), updated_at = NOW() WHERE id = $1`,
                [rows[0].shipment_id]
            );
        }

        // Audit trail
        auditService.log('invoice', req.params.id, 'STATUS_CHANGE', req.user?.userId || null, {
            invoice_number: rows[0].invoice_number,
            status: { new: status },
        });

        res.json({ invoice: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark invoice discrepancy
router.patch('/:id/discrepancy', authenticateToken, async (req, res) => {
    try {
        const { hasDiscrepancy, discrepancyNotes } = req.body;

        const { rows } = await pool.query(
            `UPDATE invoices SET has_discrepancy = $1, discrepancy_notes = $2 WHERE id = $3 RETURNING *`,
            [hasDiscrepancy, discrepancyNotes, req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        res.json({ invoice: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete invoice
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'DELETE FROM invoices WHERE id = $1 RETURNING shipment_id',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Recalculate shipment total cost
        if (rows[0].shipment_id) {
            await pool.query(
                `UPDATE shipments SET total_cost_usd = (
                    SELECT COALESCE(SUM(amount_usd), 0) FROM invoices WHERE shipment_id = $1 AND status NOT IN ('CANCELLED')
                 ), updated_at = NOW() WHERE id = $1`,
                [rows[0].shipment_id]
            );
        }

        // Audit trail
        auditService.log('invoice', req.params.id, 'DELETE', req.user?.userId || null, {});

        res.json({ message: 'Invoice deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get invoices for a specific shipment
router.get('/shipment/:shipmentId', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM invoices WHERE shipment_id = $1 ORDER BY created_at DESC`,
            [req.params.shipmentId]
        );

        const summary = {
            total: rows.reduce((sum, inv) => sum + parseFloat(inv.amount_usd || 0), 0),
            paid: rows.filter(i => i.status === 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amount_usd || 0), 0),
            pending: rows.filter(i => i.status === 'PENDING').reduce((sum, inv) => sum + parseFloat(inv.amount_usd || 0), 0),
        };

        res.json({ invoices: rows, summary });
    } catch (error) {
        res.json({ invoices: [], summary: {} });
    }
});

module.exports = router;
