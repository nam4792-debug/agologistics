#!/usr/bin/env node

/**
 * Production Database Seeder
 * Run this in Render Shell to seed the production database
 * 
 * Usage:
 *   node seed-production.js
 */

const { Pool } = require('pg');

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function seedDatabase() {
    console.log('🌱 Starting production database seeding...\n');

    try {
        // Check connection
        await pool.query('SELECT NOW()');
        console.log('✅ Connected to database\n');

        // Create admin user
        console.log('Creating admin user...');
        const bcrypt = require('bcryptjs');
        const adminPassword = await bcrypt.hash('admin123', 10);

        const adminResult = await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE 
      SET password_hash = EXCLUDED.password_hash
      RETURNING id, email
    `, ['admin@logispro.vn', adminPassword, 'Admin User', 'ADMIN', 'ACTIVE']);

        const adminId = adminResult.rows[0].id;
        console.log(`✅ Admin user: ${adminResult.rows[0].email}`);

        // Create admin license
        console.log('\nCreating admin license...');
        const crypto = require('crypto');
        const adminLicenseKey = crypto.randomBytes(16).toString('hex')
            .toUpperCase()
            .match(/.{1,4}/g)
            .join('-')
            .substring(0, 19);

        await pool.query(`
      INSERT INTO licenses (license_key, user_id, type, max_devices, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (license_key) DO NOTHING
    `, [adminLicenseKey, adminId, 'PREMIUM', 99, 'ACTIVE']);

        console.log(`✅ License: ${adminLicenseKey}`);

        // Create sample users
        console.log('\nCreating sample users...');

        const sampleUsers = [
            { email: 'logistics@logispro.vn', name: 'Logistics Manager', role: 'USER' },
            { email: 'sales@logispro.vn', name: 'Sales Coordinator', role: 'USER' }
        ];

        for (const user of sampleUsers) {
            const password = await bcrypt.hash('admin123', 10);
            const userResult = await pool.query(`
        INSERT INTO users (email, password_hash, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash
        RETURNING id, email
      `, [user.email, password, user.name, user.role, 'ACTIVE']);

            // Create license for user
            const licenseKey = crypto.randomBytes(16).toString('hex')
                .toUpperCase()
                .match(/.{1,4}/g)
                .join('-')
                .substring(0, 19);

            await pool.query(`
        INSERT INTO licenses (license_key, user_id, type, max_devices, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (license_key) DO NOTHING
      `, [licenseKey, userResult.rows[0].id, 'STANDARD', 1, 'ACTIVE']);

            console.log(`✅ User: ${user.email} (License: ${licenseKey})`);
        }

        console.log('\n🎉 Database seeding complete!\n');
        console.log('📝 Login credentials:');
        console.log('   Email: admin@logispro.vn');
        console.log('   Password: admin123\n');
        console.log('⚠️  Note: Admin device needs to be whitelisted after first login\n');

    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
