const cron = require('node-cron');
const driveService = require('../services/driveService');

/**
 * Initialize background sync jobs
 */
function initSyncJobs() {
    console.log('🔄 Initializing Google Drive sync jobs...');

    // Daily database backup at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
        console.log('⏰ Running scheduled database backup...');
        try {
            const connected = await driveService.isConnected();
            if (connected) {
                await driveService.backupDatabase();
                console.log('✅ Scheduled database backup completed');
            } else {
                console.log('⚠️ Skipping backup - not connected to Google Drive');
            }
        } catch (error) {
            console.error('❌ Scheduled backup failed:', error.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh'
    });

    // Sync documents every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        console.log('⏰ Running scheduled document sync...');
        try {
            const connected = await driveService.isConnected();
            if (connected) {
                await driveService.syncAllDocuments();
                console.log('✅ Scheduled document sync completed');
            } else {
                console.log('⚠️ Skipping sync - not connected to Google Drive');
            }
        } catch (error) {
            console.error('❌ Scheduled document sync failed:', error.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh'
    });

    // Cleanup old local backups (keep last 7 days) - runs daily at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
        console.log('🧹 Cleaning up old local backups...');
        try {
            const fs = require('fs');
            const path = require('path');
            const backupsDir = path.join(__dirname, '../../backups');

            if (!fs.existsSync(backupsDir)) return;

            const files = fs.readdirSync(backupsDir);
            const now = Date.now();
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

            let deletedCount = 0;
            for (const file of files) {
                const filePath = path.join(backupsDir, file);
                const stats = fs.statSync(filePath);

                if (stats.mtime.getTime() < sevenDaysAgo) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`✅ Deleted ${deletedCount} old backup files`);
            }
        } catch (error) {
            console.error('❌ Backup cleanup failed:', error.message);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh'
    });

    console.log('✅ Sync jobs scheduled:');
    console.log('   - Database backup: Daily at 2:00 AM');
    console.log('   - Document sync: Every 6 hours');
    console.log('   - Cleanup old backups: Daily at 3:00 AM');
}

module.exports = { initSyncJobs };
