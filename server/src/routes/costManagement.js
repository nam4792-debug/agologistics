const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('./auth');
const auditService = require('../services/auditService');

// ═══════════════════════════════════════════════
// FEE TYPES REFERENCE
// ═══════════════════════════════════════════════
const FEE_TYPES = [
    'FREIGHT',      // Cước vận chuyển chính
    'THC',          // Terminal Handling Charge
    'BL_FEE',       // Phí Bill of Lading
    'DO_FEE',       // Phí Delivery Order
    'CUSTOMS',      // Phí hải quan
    'HANDLING',     // Phí xử lý hàng
    'STORAGE',      // Phí lưu kho
    'INSPECTION',   // Phí kiểm tra
    'INSURANCE',    // Phí bảo hiểm
    'TRUCKING',     // Phí vận chuyển nội địa
    'OTHER',        // Phí khác
];

// ═══════════════════════════════════════════════
// INVOICE LINE ITEMS (Fee Breakdown)
// ═══════════════════════════════════════════════

// Get line items for an invoice
router.get('/invoice/:invoiceId/breakdown', authenticateToken, async (req, res) => {
    try {
        const { rows: lineItems } = await pool.query(
            'SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY created_at',
            [req.params.invoiceId]
        );

        // Get invoice total for comparison
        const { rows: invoiceRows } = await pool.query(
            'SELECT amount_usd, invoice_number FROM invoices WHERE id = $1',
            [req.params.invoiceId]
        );

        const invoice = invoiceRows[0];
        const lineItemsTotal = lineItems.reduce((sum, item) => sum + parseFloat(item.amount_usd || item.amount || 0), 0);

        res.json({
            lineItems,
            summary: {
                invoiceTotal: parseFloat(invoice?.amount_usd || 0),
                lineItemsTotal,
                difference: parseFloat(invoice?.amount_usd || 0) - lineItemsTotal,
                feeTypeBreakdown: FEE_TYPES.map(type => ({
                    type,
                    total: lineItems.filter(li => li.fee_type === type).reduce((s, li) => s + parseFloat(li.amount_usd || li.amount || 0), 0),
                    count: lineItems.filter(li => li.fee_type === type).length,
                })).filter(ft => ft.count > 0),
            },
        });
    } catch (error) {
        console.error('Error fetching line items:', error);
        res.json({ lineItems: [], summary: {} });
    }
});

// Add line item to invoice
router.post('/line-items', authenticateToken, async (req, res) => {
    try {
        const { invoice_id, fee_type, description, amount, currency, amount_usd } = req.body;

        if (!invoice_id || !fee_type || !amount) {
            return res.status(400).json({ error: 'invoice_id, fee_type, and amount are required' });
        }

        if (!FEE_TYPES.includes(fee_type)) {
            return res.status(400).json({ error: `fee_type must be one of: ${FEE_TYPES.join(', ')}` });
        }

        // Auto-convert to USD if currency is different and we have a rate
        let finalAmountUsd = amount_usd || amount;
        if (currency && currency !== 'USD' && !amount_usd) {
            try {
                const { rows: rates } = await pool.query(
                    `SELECT rate FROM exchange_rates 
                     WHERE from_currency = $1 AND to_currency = 'USD' 
                     ORDER BY effective_date DESC LIMIT 1`,
                    [currency]
                );
                if (rates.length > 0) {
                    finalAmountUsd = parseFloat(amount) * parseFloat(rates[0].rate);
                }
            } catch (e) {
                // No exchange rate table yet or no rate found
            }
        }

        const id = uuidv4();
        const { rows } = await pool.query(
            `INSERT INTO invoice_line_items (id, invoice_id, fee_type, description, amount, currency, amount_usd)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [id, invoice_id, fee_type, description || null, amount, currency || 'USD', finalAmountUsd]
        );

        // Optionally update invoice total from line items
        await recalcInvoiceTotal(invoice_id);

        auditService.log('invoice', invoice_id, 'UPDATE', req.user?.userId || null, {
            action: 'ADD_LINE_ITEM',
            fee_type,
            amount: finalAmountUsd,
        });

        res.status(201).json({ lineItem: rows[0] });
    } catch (error) {
        console.error('Error creating line item:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Update a line item
router.put('/line-items/:id', authenticateToken, async (req, res) => {
    try {
        const { fee_type, description, amount, currency, amount_usd } = req.body;

        const { rows } = await pool.query(
            `UPDATE invoice_line_items 
             SET fee_type = COALESCE($1, fee_type),
                 description = COALESCE($2, description),
                 amount = COALESCE($3, amount),
                 currency = COALESCE($4, currency),
                 amount_usd = COALESCE($5, amount_usd)
             WHERE id = $6 RETURNING *`,
            [fee_type, description, amount, currency, amount_usd, req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Line item not found' });
        }

        await recalcInvoiceTotal(rows[0].invoice_id);
        res.json({ lineItem: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a line item
router.delete('/line-items/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'DELETE FROM invoice_line_items WHERE id = $1 RETURNING invoice_id',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Line item not found' });
        }

        await recalcInvoiceTotal(rows[0].invoice_id);
        res.json({ message: 'Line item deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════
// EXCHANGE RATES
// ═══════════════════════════════════════════════

// Get current exchange rates
router.get('/exchange-rates', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT DISTINCT ON (from_currency, to_currency)
                    id, from_currency, to_currency, rate, effective_date, source, created_at
             FROM exchange_rates
             ORDER BY from_currency, to_currency, effective_date DESC`
        );
        res.json({ rates: rows });
    } catch (error) {
        res.json({ rates: [] });
    }
});

// Get exchange rate history
router.get('/exchange-rates/history', authenticateToken, async (req, res) => {
    try {
        const { from, to, limit } = req.query;
        let query = 'SELECT * FROM exchange_rates WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (from) {
            query += ` AND from_currency = $${paramIndex++}`;
            params.push(from);
        }
        if (to) {
            query += ` AND to_currency = $${paramIndex++}`;
            params.push(to);
        }

        query += ` ORDER BY effective_date DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit) || 30);

        const { rows } = await pool.query(query, params);
        res.json({ rates: rows });
    } catch (error) {
        res.json({ rates: [] });
    }
});

// Set exchange rate
router.post('/exchange-rates', authenticateToken, async (req, res) => {
    try {
        const { from_currency, to_currency, rate, effective_date } = req.body;

        if (!from_currency || !to_currency || !rate) {
            return res.status(400).json({ error: 'from_currency, to_currency, and rate are required' });
        }

        const id = uuidv4();
        const { rows } = await pool.query(
            `INSERT INTO exchange_rates (id, from_currency, to_currency, rate, effective_date, source)
             VALUES ($1, $2, $3, $4, $5, 'manual') RETURNING *`,
            [id, from_currency.toUpperCase(), to_currency.toUpperCase(), rate, effective_date || new Date()]
        );

        // Also insert reverse rate
        const reverseId = uuidv4();
        await pool.query(
            `INSERT INTO exchange_rates (id, from_currency, to_currency, rate, effective_date, source)
             VALUES ($1, $2, $3, $4, $5, 'manual')`,
            [reverseId, to_currency.toUpperCase(), from_currency.toUpperCase(), 1 / parseFloat(rate), effective_date || new Date()]
        );

        res.status(201).json({ rate: rows[0] });
    } catch (error) {
        console.error('Error setting exchange rate:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════
// SHIPMENT REVENUE (for P&L)
// ═══════════════════════════════════════════════

// Get revenue for a shipment
router.get('/shipment/:shipmentId/revenue', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM shipment_revenue WHERE shipment_id = $1 ORDER BY created_at',
            [req.params.shipmentId]
        );
        const total = rows.reduce((sum, r) => sum + parseFloat(r.amount_usd || r.amount || 0), 0);
        res.json({ revenue: rows, total });
    } catch (error) {
        res.json({ revenue: [], total: 0 });
    }
});

// Add revenue entry
router.post('/shipment/:shipmentId/revenue', authenticateToken, async (req, res) => {
    try {
        const { description, amount, currency, amount_usd } = req.body;
        const shipmentId = req.params.shipmentId;

        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        let finalAmountUsd = amount_usd || amount;
        if (currency && currency !== 'USD' && !amount_usd) {
            try {
                const { rows: rates } = await pool.query(
                    `SELECT rate FROM exchange_rates 
                     WHERE from_currency = $1 AND to_currency = 'USD' 
                     ORDER BY effective_date DESC LIMIT 1`,
                    [currency]
                );
                if (rates.length > 0) {
                    finalAmountUsd = parseFloat(amount) * parseFloat(rates[0].rate);
                }
            } catch (e) { /* skip */ }
        }

        const id = uuidv4();
        const { rows } = await pool.query(
            `INSERT INTO shipment_revenue (id, shipment_id, description, amount, currency, amount_usd)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [id, shipmentId, description || null, amount, currency || 'USD', finalAmountUsd]
        );

        auditService.log('shipment', shipmentId, 'UPDATE', req.user?.userId || null, {
            action: 'ADD_REVENUE',
            amount: finalAmountUsd,
        });

        res.status(201).json({ revenue: rows[0] });
    } catch (error) {
        console.error('Error adding revenue:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Delete revenue entry
router.delete('/revenue/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'DELETE FROM shipment_revenue WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Revenue entry not found' });
        }
        res.json({ message: 'Revenue entry deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════
// PROFIT & LOSS per Shipment
// ═══════════════════════════════════════════════

router.get('/shipment/:shipmentId/pnl', authenticateToken, async (req, res) => {
    try {
        const shipmentId = req.params.shipmentId;

        // Get shipment info
        const { rows: shipmentRows } = await pool.query(
            `SELECT s.shipment_number, s.type, s.status, s.total_cost_usd,
                    c.company_name as customer_name
             FROM shipments s
             LEFT JOIN customers c ON s.customer_id = c.id
             WHERE s.id = $1`,
            [shipmentId]
        );

        if (shipmentRows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Revenue
        let revenueEntries = [];
        let totalRevenue = 0;
        try {
            const { rows } = await pool.query(
                'SELECT * FROM shipment_revenue WHERE shipment_id = $1 ORDER BY created_at',
                [shipmentId]
            );
            revenueEntries = rows;
            totalRevenue = rows.reduce((sum, r) => sum + parseFloat(r.amount_usd || r.amount || 0), 0);
        } catch (e) { /* table might not exist */ }

        // Costs (from invoices)
        let costEntries = [];
        let totalCost = 0;
        try {
            const { rows } = await pool.query(
                `SELECT i.id, i.invoice_number, i.amount_usd, i.status, i.vendor_name, i.category,
                        f.company_name as forwarder_name
                 FROM invoices i
                 LEFT JOIN forwarders f ON i.forwarder_id = f.id
                 WHERE i.shipment_id = $1 AND i.status != 'CANCELLED'
                 ORDER BY i.created_at`,
                [shipmentId]
            );
            costEntries = rows;
            totalCost = rows.reduce((sum, inv) => sum + parseFloat(inv.amount_usd || 0), 0);
        } catch (e) { /* skip */ }

        // Cost breakdown by fee type (from line items)
        let costBreakdown = [];
        try {
            const { rows } = await pool.query(
                `SELECT li.fee_type, SUM(li.amount_usd) as total
                 FROM invoice_line_items li
                 JOIN invoices inv ON li.invoice_id = inv.id
                 WHERE inv.shipment_id = $1 AND inv.status != 'CANCELLED'
                 GROUP BY li.fee_type
                 ORDER BY total DESC`,
                [shipmentId]
            );
            costBreakdown = rows;
        } catch (e) { /* skip */ }

        const profitLoss = totalRevenue - totalCost;
        const margin = totalRevenue > 0 ? ((profitLoss / totalRevenue) * 100) : 0;

        res.json({
            shipment: shipmentRows[0],
            revenue: {
                entries: revenueEntries,
                total: totalRevenue,
            },
            costs: {
                entries: costEntries,
                total: totalCost,
                breakdown: costBreakdown,
            },
            pnl: {
                profit: profitLoss,
                margin: Math.round(margin * 100) / 100,
                status: profitLoss > 0 ? 'PROFIT' : profitLoss < 0 ? 'LOSS' : 'BREAK_EVEN',
            },
        });
    } catch (error) {
        console.error('Error calculating P&L:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get fee types list
router.get('/fee-types', authenticateToken, (req, res) => {
    res.json({
        feeTypes: FEE_TYPES.map(type => ({
            value: type,
            label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        })),
    });
});

// ═══════════════════════════════════════════════
// HELPER: Recalculate invoice total from line items
// ═══════════════════════════════════════════════
async function recalcInvoiceTotal(invoiceId) {
    try {
        const { rows } = await pool.query(
            'SELECT SUM(amount_usd) as total FROM invoice_line_items WHERE invoice_id = $1',
            [invoiceId]
        );
        const lineItemsTotal = parseFloat(rows[0]?.total || 0);

        if (lineItemsTotal > 0) {
            await pool.query(
                'UPDATE invoices SET amount_usd = $1, updated_at = NOW() WHERE id = $2',
                [lineItemsTotal, invoiceId]
            );

            // Also update shipment total cost
            const { rows: invRows } = await pool.query(
                'SELECT shipment_id FROM invoices WHERE id = $1',
                [invoiceId]
            );
            if (invRows[0]?.shipment_id) {
                await pool.query(
                    `UPDATE shipments SET total_cost_usd = (
                        SELECT COALESCE(SUM(amount_usd), 0) FROM invoices 
                        WHERE shipment_id = $1 AND status != 'CANCELLED'
                     ), updated_at = NOW() WHERE id = $1`,
                    [invRows[0].shipment_id]
                );
            }
        }
    } catch (e) {
        console.error('Error recalculating invoice total:', e.message);
    }
}

module.exports = router;
