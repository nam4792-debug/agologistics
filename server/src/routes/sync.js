const express = require('express');
const router = express.Router();
const driveService = require('../services/driveService');

/**
 * GET /api/sync/status
 * Get current sync status
 */
router.get('/status', async (req, res) => {
    try {
        const status = await driveService.getSyncStatus();
        res.json({ success: true, status });
    } catch (error) {
        console.error('Error getting sync status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync/connect
 * Initiate OAuth2 connection flow
 */
router.get('/connect', async (req, res) => {
    try {
        await driveService.initializeClient();
        const authUrl = driveService.getAuthUrl();
        res.json({ success: true, authUrl });
    } catch (error) {
        console.error('Error initiating connection:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync/callback
 * OAuth2 callback handler
 */
router.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }

        await driveService.authenticate(code);

        // Redirect to settings page with success message
        res.redirect('http://localhost:5173/settings?tab=integrations&status=connected');
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`http://localhost:5173/settings?tab=integrations&status=error&message=${encodeURIComponent(error.message)}`);
    }
});

/**
 * POST /api/sync/disconnect
 * Disconnect from Google Drive
 */
router.post('/disconnect', async (req, res) => {
    try {
        await driveService.disconnect();
        res.json({ success: true, message: 'Disconnected from Google Drive' });
    } catch (error) {
        console.error('Error disconnecting:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync/backup
 * Trigger manual database backup
 */
router.post('/backup', async (req, res) => {
    try {
        const connected = await driveService.isConnected();
        if (!connected) {
            return res.status(400).json({ error: 'Not connected to Google Drive' });
        }

        const result = await driveService.backupDatabase();
        res.json({
            success: true,
            message: 'Database backup completed',
            backup: {
                id: result.id,
                name: result.name,
                size: result.size
            }
        });
    } catch (error) {
        console.error('Error backing up database:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sync/documents
 * Sync all documents to Google Drive
 */
router.post('/documents', async (req, res) => {
    try {
        const connected = await driveService.isConnected();
        if (!connected) {
            return res.status(400).json({ error: 'Not connected to Google Drive' });
        }

        const results = await driveService.syncAllDocuments();
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        res.json({
            success: true,
            message: `Synced ${successCount} documents, ${failCount} failed`,
            results
        });
    } catch (error) {
        console.error('Error syncing documents:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sync/backups
 * List all backups
 */
router.get('/backups', async (req, res) => {
    try {
        const backups = await driveService.listBackups();
        res.json({ success: true, backups });
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
