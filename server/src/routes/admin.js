const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('./auth');
const crypto = require('crypto');

/**
 * Admin middleware - checks if user is admin AND device is whitelisted
 */
async function requireAdmin(req, res, next) {
    try {
        const { userId, role, deviceId } = req.user;

        if (role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Check if device is whitelisted
        const { rows } = await pool.query(
            'SELECT * FROM admin_whitelist WHERE device_id = $1 AND revoked = false',
            [deviceId]
        );

        if (rows.length === 0) {
            return res.status(403).json({
                error: 'Device not whitelisted for admin access',
                message: 'Contact primary admin to whitelist your device'
            });
        }

        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Get all users
 * GET /api/admin/users
 */
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT u.id, u.email, u.full_name, u.role, u.department, u.phone, u.status, u.created_at,
                    l.license_key, l.type as license_type, l.expires_at, l.revoked,
                    da.device_name, da.os_info, da.last_seen
             FROM users u
             LEFT JOIN licenses l ON u.id = l.user_id
             LEFT JOIN device_activations da ON l.license_key = da.license_key
             ORDER BY u.created_at DESC`
        );

        res.json({ users: rows });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * Create user with license
 * POST /api/admin/users
 */
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email, password, fullName, role = 'STAFF', department, licenseType = 'STANDARD', expiresAt } = req.body;

        if (!email || !password || !fullName) {
            return res.status(400).json({ error: 'Email, password, and full name are required' });
        }

        // Check if user exists
        const { rows: existing } = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const { rows: userRows } = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, role, department)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, full_name, role, department`,
            [email, passwordHash, fullName, role, department]
        );

        const user = userRows[0];

        // Generate license key
        function generateLicenseKey() {
            const segments = [];
            for (let i = 0; i < 4; i++) {
                const segment = crypto.randomBytes(2).toString('hex').toUpperCase();
                segments.push(segment);
            }
            return segments.join('-');
        }

        const licenseKey = generateLicenseKey();

        // Create license
        const { rows: licenseRows } = await pool.query(
            `INSERT INTO licenses (license_key, user_id, type, max_devices, expires_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [licenseKey, user.id, licenseType, 1, expiresAt || null]
        );

        res.status(201).json({
            user,
            license: licenseRows[0]
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * Disable user account
 * PUT /api/admin/users/:id/disable
 */
router.put('/users/:id/disable', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { rows } = await pool.query(
            `UPDATE users SET status = 'INACTIVE', updated_at = NOW()
             WHERE id = $1
             RETURNING id, email, full_name, status`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: rows[0] });
    } catch (error) {
        console.error('Disable user error:', error);
        res.status(500).json({ error: 'Failed to disable user' });
    }
});

/**
 * Enable user account
 * PUT /api/admin/users/:id/enable
 */
router.put('/users/:id/enable', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { rows } = await pool.query(
            `UPDATE users SET status = 'ACTIVE', updated_at = NOW()
             WHERE id = $1
             RETURNING id, email, full_name, status`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: rows[0] });
    } catch (error) {
        console.error('Enable user error:', error);
        res.status(500).json({ error: 'Failed to enable user' });
    }
});

/**
 * Delete user
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query('DELETE FROM users WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

/**
 * Reset device binding
 * PUT /api/admin/users/:id/reset-device
 */
router.put('/users/:id/reset-device', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Get user's license
        const { rows: licenseRows } = await pool.query(
            'SELECT license_key FROM licenses WHERE user_id = $1',
            [id]
        );

        if (licenseRows.length === 0) {
            return res.status(404).json({ error: 'No license found for this user' });
        }

        // Delete device activation
        await pool.query(
            'DELETE FROM device_activations WHERE license_key = $1',
            [licenseRows[0].license_key]
        );

        res.json({ success: true, message: 'Device binding reset successfully' });
    } catch (error) {
        console.error('Reset device error:', error);
        res.status(500).json({ error: 'Failed to reset device binding' });
    }
});

// ============================================
// LICENSE MANAGEMENT
// ============================================

/**
 * Generate new license key
 * POST /api/admin/licenses/generate
 */
router.post('/licenses/generate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId, type = 'STANDARD', expiresAt } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        function generateLicenseKey() {
            const segments = [];
            for (let i = 0; i < 4; i++) {
                const segment = crypto.randomBytes(2).toString('hex').toUpperCase();
                segments.push(segment);
            }
            return segments.join('-');
        }

        const licenseKey = generateLicenseKey();

        const { rows } = await pool.query(
            `INSERT INTO licenses (license_key, user_id, type, max_devices, expires_at)
             VALUES ($1, $2, $3, 1, $4)
             RETURNING *`,
            [licenseKey, userId, type, expiresAt || null]
        );

        res.status(201).json({ license: rows[0] });
    } catch (error) {
        console.error('Generate license error:', error);
        res.status(500).json({ error: 'Failed to generate license' });
    }
});

/**
 * Get all licenses
 * GET /api/admin/licenses
 */
router.get('/licenses', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT l.*, u.email, u.full_name,
                    (SELECT COUNT(*) FROM device_activations WHERE license_key = l.license_key) as activated_devices
             FROM licenses l
             JOIN users u ON l.user_id = u.id
             ORDER BY l.created_at DESC`
        );

        res.json({ licenses: rows });
    } catch (error) {
        console.error('Get licenses error:', error);
        res.status(500).json({ error: 'Failed to fetch licenses' });
    }
});

/**
 * Revoke license
 * PUT /api/admin/licenses/:key/revoke
 */
router.put('/licenses/:key/revoke', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const { reason } = req.body;

        const { rows } = await pool.query(
            `UPDATE licenses
             SET revoked = true, revoked_at = NOW(), revoked_reason = $1, updated_at = NOW()
             WHERE license_key = $2
             RETURNING *`,
            [reason || 'Revoked by admin', key]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'License not found' });
        }

        res.json({ license: rows[0] });
    } catch (error) {
        console.error('Revoke license error:', error);
        res.status(500).json({ error: 'Failed to revoke license' });
    }
});

// ============================================
// ADMIN WHITELIST MANAGEMENT
// ============================================

/**
 * Get admin whitelist
 * GET /api/admin/whitelist
 */
router.get('/whitelist', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT aw.*, u.full_name as granted_by_name
             FROM admin_whitelist aw
             LEFT JOIN users u ON aw.granted_by = u.id
             WHERE aw.revoked = false
             ORDER BY aw.granted_at DESC`
        );

        res.json({ whitelist: rows });
    } catch (error) {
        console.error('Get whitelist error:', error);
        res.status(500).json({ error: 'Failed to fetch whitelist' });
    }
});

/**
 * Add device to whitelist
 * POST /api/admin/whitelist
 */
router.post('/whitelist', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { deviceId, deviceName, notes } = req.body;
        const { userId } = req.user;

        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID is required' });
        }

        const { rows } = await pool.query(
            `INSERT INTO admin_whitelist (device_id, device_name, granted_by, notes)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (device_id) DO UPDATE
             SET revoked = false, granted_at = NOW(), granted_by = $3, notes = $4
             RETURNING *`,
            [deviceId, deviceName, userId, notes]
        );

        res.status(201).json({ whitelist: rows[0] });
    } catch (error) {
        console.error('Add to whitelist error:', error);
        res.status(500).json({ error: 'Failed to add to whitelist' });
    }
});

/**
 * Revoke admin access
 * DELETE /api/admin/whitelist/:deviceId
 */
router.delete('/whitelist/:deviceId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { deviceId } = req.params;

        // Check if this is the primary admin device
        const { rows: primaryCheck } = await pool.query(
            `SELECT * FROM admin_whitelist
             WHERE device_id = $1 AND notes = 'Primary Admin Device'`,
            [deviceId]
        );

        if (primaryCheck.length > 0) {
            return res.status(403).json({ error: 'Cannot revoke primary admin device' });
        }

        const { rows } = await pool.query(
            `UPDATE admin_whitelist
             SET revoked = true, revoked_at = NOW()
             WHERE device_id = $1
             RETURNING *`,
            [deviceId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Device not found in whitelist' });
        }

        res.json({ whitelist: rows[0] });
    } catch (error) {
        console.error('Revoke whitelist error:', error);
        res.status(500).json({ error: 'Failed to revoke admin access' });
    }
});

// ============================================
// STATISTICS
// ============================================

/**
 * Get system statistics
 * GET /api/admin/stats
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Total users
        const { rows: userStats } = await pool.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
                COUNT(*) FILTER (WHERE status = 'INACTIVE') as inactive
             FROM users`
        );

        // Total licenses
        const { rows: licenseStats } = await pool.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE revoked = false AND (expires_at IS NULL OR expires_at > NOW())) as active,
                COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < NOW()) as expired,
                COUNT(*) FILTER (WHERE revoked = true) as revoked
             FROM licenses`
        );

        // Active devices
        const { rows: deviceStats } = await pool.query(
            'SELECT COUNT(*) as total FROM device_activations WHERE is_active = true'
        );

        // Recent activity (last 10 logins)
        const { rows: recentActivity } = await pool.query(
            `SELECT da.*, u.email, u.full_name
             FROM device_activations da
             JOIN users u ON da.user_id = u.id
             ORDER BY da.last_seen DESC
             LIMIT 10`
        );

        res.json({
            users: userStats[0],
            licenses: licenseStats[0],
            devices: deviceStats[0],
            recentActivity
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;
