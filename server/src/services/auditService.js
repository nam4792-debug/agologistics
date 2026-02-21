const pool = require('../config/database');

/**
 * Gap #9: Audit Trail Service
 * Logs all critical changes for traceability
 */
class AuditService {
    /**
     * Log a change to the audit trail
     * @param {string} entityType - 'booking', 'shipment', 'dispatch', etc.
     * @param {string} entityId - UUID of the entity
     * @param {string} action - 'CREATE', 'UPDATE', 'DELETE', 'CANCEL', 'CONFIRM'
     * @param {string|null} userId - Who performed the action
     * @param {object|null} changes - { field: { old: X, new: Y } }
     * @param {string|null} ipAddress - Request IP
     */
    async log(entityType, entityId, action, userId = null, changes = null, ipAddress = null) {
        try {
            await pool.query(
                `INSERT INTO audit_log (entity_type, entity_id, action, user_id, changes, ip_address)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [entityType, entityId, action, userId, changes ? JSON.stringify(changes) : null, ipAddress]
            );
        } catch (error) {
            // Don't let audit failures break the main flow
            console.error('❌ Audit log error:', error.message);
        }
    }

    /**
     * Get audit history for an entity
     */
    async getHistory(entityType, entityId) {
        const { rows } = await pool.query(
            `SELECT al.*, u.full_name as user_name
             FROM audit_log al
             LEFT JOIN users u ON al.user_id = u.id
             WHERE al.entity_type = $1 AND al.entity_id = $2
             ORDER BY al.created_at DESC
             LIMIT 50`,
            [entityType, entityId]
        );
        return rows;
    }

    /**
     * Get recent audit activity across all entities
     */
    async getRecentActivity(limit = 20) {
        const { rows } = await pool.query(
            `SELECT al.*, u.full_name as user_name
             FROM audit_log al
             LEFT JOIN users u ON al.user_id = u.id
             ORDER BY al.created_at DESC
             LIMIT $1`,
            [limit]
        );
        return rows;
    }
}

module.exports = new AuditService();
