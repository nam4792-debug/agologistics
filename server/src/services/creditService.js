const pool = require('../config/database');

class CreditService {
    /**
     * Get vendor (forwarder) credit status
     * Calculates outstanding balance from unpaid invoices
     */
    async getVendorCreditStatus(forwarderId) {
        try {
            // Get forwarder credit limit
            const { rows: forwarders } = await pool.query(
                `SELECT id, company_name, credit_limit_monthly FROM forwarders WHERE id = $1`,
                [forwarderId]
            );

            if (forwarders.length === 0) {
                return null;
            }

            const forwarder = forwarders[0];
            const creditLimit = parseFloat(forwarder.credit_limit_monthly) || 0;

            // Calculate outstanding balance (unpaid invoices for this forwarder)
            const { rows: balanceResult } = await pool.query(
                `SELECT COALESCE(SUM(amount_usd), 0) as outstanding
                 FROM invoices 
                 WHERE forwarder_id = $1 AND status NOT IN ('PAID', 'CANCELLED')`,
                [forwarderId]
            );

            const outstanding = parseFloat(balanceResult[0].outstanding) || 0;

            // Calculate overdue count
            const { rows: overdueResult } = await pool.query(
                `SELECT COUNT(*) as overdue_count 
                 FROM invoices 
                 WHERE forwarder_id = $1 
                   AND (status = 'OVERDUE' OR (status = 'PENDING' AND due_date IS NOT NULL AND due_date < NOW()))`,
                [forwarderId]
            );

            const overdueCount = parseInt(overdueResult[0].overdue_count) || 0;

            // Determine status
            let status = 'GREEN';
            let message = null;

            if (creditLimit > 0) {
                const usedPercent = (outstanding / creditLimit) * 100;

                if (usedPercent >= 100) {
                    status = 'RED';
                    message = `Vendor "${forwarder.company_name}" has exceeded credit limit (${usedPercent.toFixed(0)}% - $${outstanding.toLocaleString()} / $${creditLimit.toLocaleString()})`;
                } else if (usedPercent >= 80) {
                    status = 'YELLOW';
                    message = `Vendor "${forwarder.company_name}" is approaching credit limit (${usedPercent.toFixed(0)}% - $${outstanding.toLocaleString()} / $${creditLimit.toLocaleString()})`;
                }
            }

            if (overdueCount > 0) {
                status = 'RED';
                message = `Vendor "${forwarder.company_name}" has ${overdueCount} overdue unpaid invoice(s). Risk of cargo hold!`;
            }

            return {
                forwarderId,
                companyName: forwarder.company_name,
                creditLimit,
                outstanding,
                available: Math.max(0, creditLimit - outstanding),
                usedPercent: creditLimit > 0 ? Math.min(100, (outstanding / creditLimit) * 100) : 0,
                overdueCount,
                status, // GREEN, YELLOW, RED
                message,
            };
        } catch (error) {
            console.error('Error getting vendor credit status:', error);
            return null;
        }
    }

    /**
     * Check credit before confirming a booking
     * Returns warning object if near/over limit, null if OK
     */
    async checkCreditBeforeBooking(forwarderId, newFreightRate = 0) {
        if (!forwarderId) return null;

        const creditStatus = await this.getVendorCreditStatus(forwarderId);
        if (!creditStatus || creditStatus.creditLimit === 0) {
            // No credit limit set — no warning
            return null;
        }

        const projectedOutstanding = creditStatus.outstanding + newFreightRate;
        const projectedPercent = (projectedOutstanding / creditStatus.creditLimit) * 100;

        let warning = null;

        if (creditStatus.overdueCount > 0) {
            warning = {
                level: 'RED',
                title: '⚠️ Warning: Vendor has overdue invoices',
                message: `${creditStatus.companyName} has ${creditStatus.overdueCount} overdue unpaid invoice(s). Risk of cargo hold if booking continues!`,
                outstanding: creditStatus.outstanding,
                creditLimit: creditStatus.creditLimit,
                overdueCount: creditStatus.overdueCount,
            };
        } else if (projectedPercent >= 100) {
            warning = {
                level: 'RED',
                title: '⚠️ Warning: Credit limit exceeded',
                message: `After this booking, total outstanding with ${creditStatus.companyName} will be $${projectedOutstanding.toLocaleString()} (${projectedPercent.toFixed(0)}%), exceeding limit of $${creditStatus.creditLimit.toLocaleString()}.`,
                outstanding: creditStatus.outstanding,
                projected: projectedOutstanding,
                creditLimit: creditStatus.creditLimit,
            };
        } else if (projectedPercent >= 80) {
            warning = {
                level: 'YELLOW',
                title: '⚡ Notice: Approaching credit limit',
                message: `After this booking, total outstanding with ${creditStatus.companyName} will be $${projectedOutstanding.toLocaleString()} (${projectedPercent.toFixed(0)}%), near limit of $${creditStatus.creditLimit.toLocaleString()}.`,
                outstanding: creditStatus.outstanding,
                projected: projectedOutstanding,
                creditLimit: creditStatus.creditLimit,
            };
        }

        return warning;
    }
}

module.exports = new CreditService();
