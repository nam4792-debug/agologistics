const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// POST /api/seed/init - One-time setup for admin license
router.post('/init', async (req, res) => {
    try {
        // Get admin user
        const userResult = await pool.query(
            "SELECT id, email FROM users WHERE email = 'admin@logispro.vn'"
        );

        if (userResult.rows.length === 0) {
            // Create admin user first
            const hash = await bcrypt.hash('admin123', 10);
            const newUser = await pool.query(
                `INSERT INTO users (email, password_hash, full_name, role, status)
         VALUES ('admin@logispro.vn', $1, 'Admin User', 'ADMIN', 'ACTIVE')
         RETURNING id, email`,
                [hash]
            );
            userResult.rows = newUser.rows;
        }

        const adminId = userResult.rows[0].id;

        // Check if license exists
        const licenseCheck = await pool.query(
            'SELECT id FROM licenses WHERE user_id = $1',
            [adminId]
        );

        if (licenseCheck.rows.length > 0) {
            return res.json({ success: true, message: 'Admin already has a license' });
        }

        // Create license
        await pool.query(
            `INSERT INTO licenses (license_key, user_id, type, max_devices, revoked)
       VALUES ('ADMIN-MASTER-KEY-001', $1, 'PREMIUM', 99, false)`,
            [adminId]
        );

        res.json({
            success: true,
            message: 'Admin license created',
            credentials: {
                email: 'admin@logispro.vn',
                password: 'admin123',
                license: 'ADMIN-MASTER-KEY-001'
            }
        });
    } catch (error) {
        console.error('Seed error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
