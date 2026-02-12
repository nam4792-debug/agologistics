const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Login with device binding
router.post('/login', async (req, res) => {
    try {
        const { email, password, deviceId, deviceName, osInfo } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID is required' });
        }

        // Find user
        const { rows } = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND status = $2',
            [email, 'ACTIVE']
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Get user's license
        const { rows: licenseRows } = await pool.query(
            'SELECT * FROM licenses WHERE user_id = $1',
            [user.id]
        );

        if (licenseRows.length === 0) {
            return res.status(403).json({ error: 'No license found for this account' });
        }

        const license = licenseRows[0];

        // Check if license is revoked
        if (license.revoked) {
            return res.status(403).json({
                error: 'License has been revoked',
                reason: license.revoked_reason
            });
        }

        // Check if license is expired
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            return res.status(403).json({ error: 'License has expired' });
        }

        // Check device activation
        const { rows: deviceRows } = await pool.query(
            'SELECT * FROM device_activations WHERE license_key = $1',
            [license.license_key]
        );

        if (deviceRows.length === 0) {
            // First login - activate device
            await pool.query(
                `INSERT INTO device_activations (license_key, user_id, device_id, device_name, os_info)
                 VALUES ($1, $2, $3, $4, $5)`,
                [license.license_key, user.id, deviceId, deviceName, osInfo]
            );
            console.log(`✅ Device activated for ${email}: ${deviceName}`);
        } else {
            // Check if device matches
            const activation = deviceRows[0];
            if (activation.device_id !== deviceId) {
                return res.status(403).json({
                    error: 'This account is bound to a different device',
                    boundDevice: activation.device_name,
                    message: 'Please contact admin to reset device binding'
                });
            }

            // Update last_seen
            await pool.query(
                'UPDATE device_activations SET last_seen = NOW() WHERE device_id = $1',
                [deviceId]
            );
        }

        // If user is ADMIN, check whitelist
        if (user.role === 'ADMIN') {
            const { rows: whitelistRows } = await pool.query(
                'SELECT * FROM admin_whitelist WHERE device_id = $1 AND revoked = false',
                [deviceId]
            );

            if (whitelistRows.length === 0) {
                // Check if this is the primary admin device (hardcoded in seed)
                const { rows: primaryAdmin } = await pool.query(
                    `SELECT * FROM admin_whitelist 
                     WHERE notes = 'Primary Admin Device' AND device_id = $1`,
                    [deviceId]
                );

                if (primaryAdmin.length === 0) {
                    return res.status(403).json({
                        error: 'Admin access denied',
                        message: 'This device is not whitelisted for admin access'
                    });
                }
            }
        }

        // Generate JWT
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                deviceId: deviceId
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        // Remove password from response
        delete user.password_hash;

        res.json({
            token,
            user,
            license: {
                type: license.type,
                expiresAt: license.expires_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, email, full_name, role, department, phone, avatar_url, status FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register (admin only)
router.post('/register', async (req, res) => {
    try {
        const { email, password, fullName, role, department } = req.body;

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
        const { rows } = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, role, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role, department`,
            [email, passwordHash, fullName, role || 'STAFF', department]
        );

        res.status(201).json({ user: rows[0] });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid token' });
    }
}

module.exports = router;
module.exports.authenticateToken = authenticateToken;
