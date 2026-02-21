const pool = require('./src/config/database');

async function fixLicenseKeyLength() {
    try {
        console.log('🔧 Fixing license_key column length...');

        // Increase license_key length in licenses table
        await pool.query('ALTER TABLE licenses ALTER COLUMN license_key TYPE VARCHAR(500)');
        console.log('✅ Updated licenses.license_key to VARCHAR(500)');

        // Increase license_key length in device_activations table
        await pool.query('ALTER TABLE device_activations ALTER COLUMN license_key TYPE VARCHAR(500)');
        console.log('✅ Updated device_activations.license_key to VARCHAR(500)');

        console.log('🎉 License key length fixed! You can now login.');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixLicenseKeyLength();
