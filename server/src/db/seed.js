const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');

// IMPORTANT: Set your machine's device ID here after first run
// Run the app once to get your device ID from the console, then paste it here
const PRIMARY_ADMIN_DEVICE_ID = process.env.PRIMARY_ADMIN_DEVICE_ID || 'SET_YOUR_DEVICE_ID_HERE';

async function seedDatabase() {
    console.log('🌱 Seeding database with initial data...\n');

    try {
        // Check if users already exist
        const { rows: existingUsers } = await pool.query('SELECT COUNT(*) as count FROM users');
        if (existingUsers[0].count > 0) {
            console.log('⚠️  Database already seeded. Skipping...\n');
            return;
        }

        const passwordHash = await bcrypt.hash('admin123', 10);

        // Create admin user
        const { rows: adminRows } = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, role, department)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            ['admin@logispro.vn', passwordHash, 'Primary Admin', 'ADMIN', 'IT']
        );

        const admin = adminRows[0];
        console.log('✅ Admin user created:');
        console.log(`   Email: ${admin.email}`);
        console.log(`   Password: admin123`);
        console.log(`   Role: ${admin.role}\n`);

        // Generate license for admin
        function generateLicenseKey() {
            const segments = [];
            for (let i = 0; i < 4; i++) {
                const segment = crypto.randomBytes(2).toString('hex').toUpperCase();
                segments.push(segment);
            }
            return segments.join('-');
        }

        const adminLicenseKey = generateLicenseKey();
        const { rows: licenseRows } = await pool.query(
            `INSERT INTO licenses (license_key, user_id, type, max_devices, expires_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [adminLicenseKey, admin.id, 'PREMIUM', 1, null] // No expiration for admin
        );

        console.log('✅ Admin license created:');
        console.log(`   License Key: ${adminLicenseKey}`);
        console.log(`   Type: PREMIUM`);
        console.log(`   Expires: Never\n`);

        // Add primary admin device to whitelist
        if (PRIMARY_ADMIN_DEVICE_ID !== 'SET_YOUR_DEVICE_ID_HERE') {
            await pool.query(
                `INSERT INTO admin_whitelist (device_id, device_name, granted_by, notes)
                 VALUES ($1, $2, $3, $4)`,
                [PRIMARY_ADMIN_DEVICE_ID, 'Primary Admin Device', admin.id, 'Primary Admin Device']
            );
            console.log('✅ Primary admin device whitelisted');
            console.log(`   Device ID: ${PRIMARY_ADMIN_DEVICE_ID}\n`);
        } else {
            console.log('⚠️  PRIMARY_ADMIN_DEVICE_ID not set!');
            console.log('   To whitelist your device:');
            console.log('   1. Login to the app once to get your device ID');
            console.log('   2. Set PRIMARY_ADMIN_DEVICE_ID environment variable');
            console.log('   3. Or manually insert into admin_whitelist table\n');
        }

        // Create sample staff users
        const staffUsers = [
            { email: 'logistics@logispro.vn', name: 'Logistics Manager', role: 'LOGISTICS_MANAGER', dept: 'Logistics' },
            { email: 'sales@logispro.vn', name: 'Sales Coordinator', role: 'SALES', dept: 'Sales' },
        ];

        for (const staff of staffUsers) {
            const { rows: userRows } = await pool.query(
                `INSERT INTO users (email, password_hash, full_name, role, department)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [staff.email, passwordHash, staff.name, staff.role, staff.dept]
            );

            // Create license for staff
            const licenseKey = generateLicenseKey();
            await pool.query(
                `INSERT INTO licenses (license_key, user_id, type, max_devices)
                 VALUES ($1, $2, $3, $4)`,
                [licenseKey, userRows[0].id, 'STANDARD', 1]
            );

            console.log(`✅ ${staff.name} created (${staff.email}/${licenseKey})`);
        }

        console.log('\n✅ Sample users created');
        console.log('   All accounts use password: admin123\n');

        // Create sample forwarders
        const forwarders = [
            { name: 'ABC Logistics', contact: 'John Smith', email: 'john@abclogistics.com', grade: 'A' },
            { name: 'Global Shipping Co', contact: 'Sarah Lee', email: 'sarah@globalshipping.com', grade: 'A' },
            { name: 'FastCargo VN', contact: 'Minh Nguyen', email: 'minh@fastcargo.vn', grade: 'B' },
        ];

        for (const fwd of forwarders) {
            await pool.query(
                `INSERT INTO forwarders (company_name, contact_name, email, phone, grade, on_time_rate, doc_accuracy_rate)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [fwd.name, fwd.contact, fwd.email, '+84-28-1234-5678', fwd.grade, 94.5, 98.2]
            );
        }

        console.log('✅ Sample forwarders created\n');

        // Create sample customers
        const customers = [
            { code: 'CUST001', name: 'Chennai Fresh Foods', contact: 'Raj Kumar', country: 'India' },
            { code: 'CUST002', name: 'Tokyo Fruits Import', contact: 'Takeshi Honda', country: 'Japan' },
            { code: 'CUST003', name: 'Dubai Premium Goods', contact: 'Ahmed Al-Rashid', country: 'UAE' },
        ];

        for (const cust of customers) {
            await pool.query(
                `INSERT INTO customers (customer_code, company_name, contact_name, email, phone, country)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [cust.code, cust.name, cust.contact, `${cust.contact.toLowerCase().replace(' ', '.')}@${cust.name.toLowerCase().replace(/\s+/g, '')}.com`, '+1-234-567-8900', cust.country]
            );
        }

        console.log('✅ Sample customers created\n');

        console.log('🎉 Database seeding complete!\n');
        console.log('📝 Next steps:');
        console.log('   1. Start the server: npm run dev');
        console.log('   2. Login with admin@logispro.vn / admin123');
        console.log('   3. Your device will be automatically bound to the license');
        console.log('   4. Set your device ID as PRIMARY_ADMIN_DEVICE_ID for admin access\n');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    seedDatabase()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = seedDatabase;
