const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const crypto = require('crypto');

/**
 * Generate a random license key
 * Format: XXXX-XXXX-XXXX-XXXX
 */
function generateLicenseKey() {
    const segments = [];
    for (let i = 0; i < 4; i++) {
        const segment = crypto.randomBytes(2).toString('hex').toUpperCase();
        segments.push(segment);
    }
    return segments.join('-');
}

/**
 * Create a new license
 * POST /api/licenses
 * Body: { userId, type, expiresAt, maxDevices }
 */
router.post('/', async (req, res) => {
    try {
        const { userId, type = 'STANDARD', expiresAt, maxDevices = 1 } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const licenseKey = generateLicenseKey();

        const { rows } = await pool.query(
            `INSERT INTO licenses (license_key, user_id, type, max_devices, expires_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [licenseKey, userId, type, maxDevices, expiresAt || null]
        );

        res.status(201).json({ license: rows[0] });
    } catch (error) {
        console.error('Create license error:', error);
        res.status(500).json({ error: 'Failed to create license' });
    }
});

/**
 * Validate a license key
 * GET /api/licenses/:key/validate
 */
router.get('/:key/validate', async (req, res) => {
    try {
        const { key } = req.params;

        const { rows } = await pool.query(
            `SELECT l.*, u.email, u.full_name, u.status as user_status
             FROM licenses l
             JOIN users u ON l.user_id = u.id
             WHERE l.license_key = $1`,
            [key]
        );

        if (rows.length === 0) {
            return res.status(404).json({ valid: false, error: 'License not found' });
        }

        const license = rows[0];

        // Check if revoked
        if (license.revoked) {
            return res.status(403).json({
                valid: false,
                error: 'License has been revoked',
                reason: license.revoked_reason
            });
        }

        // Check if expired
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            return res.status(403).json({
                valid: false,
                error: 'License has expired'
            });
        }

        // Check if user is active
        if (license.user_status !== 'ACTIVE') {
            return res.status(403).json({
                valid: false,
                error: 'User account is inactive'
            });
        }

        res.json({
            valid: true,
            license: {
                key: license.license_key,
                type: license.type,
                maxDevices: license.max_devices,
                expiresAt: license.expires_at,
                user: {
                    email: license.email,
                    fullName: license.full_name
                }
            }
        });
    } catch (error) {
        console.error('Validate license error:', error);
        res.status(500).json({ error: 'Failed to validate license' });
    }
});

/**
 * Revoke a license
 * PUT /api/licenses/:id/revoke
 * Body: { reason }
 */
router.put('/:id/revoke', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const { rows } = await pool.query(
            `UPDATE licenses
             SET revoked = true, revoked_at = NOW(), revoked_reason = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [reason || 'Revoked by admin', id]
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

/**
 * Get all licenses
 * GET /api/licenses
 */
router.get('/', async (req, res) => {
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

module.exports = router;
