const pool = require('./src/config/database');

async function fixLicense() {
    try {
        console.log('🔧 Fixing license device limits...');

        // 1. Update all licenses to allow 99 devices
        const updateRes = await pool.query('UPDATE licenses SET max_devices = 99');
        console.log(`✅ Updated ${updateRes.rowCount} licenses to max_devices = 99`);

        // 2. Clear existing device bindings (correct table name: device_activations)
        const deleteRes = await pool.query('DELETE FROM device_activations');
        console.log(`✅ Cleared ${deleteRes.rowCount} existing device bindings from device_activations`);

        console.log('🎉 You can now login from any device!');
    } catch (error) {
        console.error('❌ Error fixing license:', error);
    } finally {
        await pool.end();
    }
}

fixLicense();
