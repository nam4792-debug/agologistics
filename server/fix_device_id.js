const pool = require('./src/config/database');

async function fixDeviceIdLength() {
    try {
        console.log('🔧 Fixing device_id column length...');

        // Increase device_id length in device_activations table
        await pool.query('ALTER TABLE device_activations ALTER COLUMN device_id TYPE VARCHAR(500)');
        console.log('✅ Updated device_activations.device_id to VARCHAR(500)');

        // Increase device_id length in admin_whitelist table
        await pool.query('ALTER TABLE admin_whitelist ALTER COLUMN device_id TYPE VARCHAR(500)');
        console.log('✅ Updated admin_whitelist.device_id to VARCHAR(500)');

        console.log('🎉 Device ID length fixed! You can now login.');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixDeviceIdLength();
