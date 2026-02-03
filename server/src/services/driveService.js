const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

// Paths
const CREDENTIALS_PATH = path.join(__dirname, '../../config/google-credentials.json');
const TOKEN_PATH = path.join(__dirname, '../../config/google-token.json');
const BACKUPS_DIR = path.join(__dirname, '../../backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// OAuth2 scopes
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
];

class DriveService {
    constructor() {
        this.oauth2Client = null;
        this.drive = null;
        this.rootFolderId = null;
    }

    /**
     * Initialize OAuth2 client from credentials file
     */
    async initializeClient() {
        if (!fs.existsSync(CREDENTIALS_PATH)) {
            throw new Error('Google credentials file not found. Please add google-credentials.json to server/config/');
        }

        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web || {};

        if (!client_id || !client_secret) {
            throw new Error('Invalid credentials file format');
        }

        this.oauth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris?.[0] || 'http://localhost:3001/api/sync/callback'
        );

        // Try to load existing token
        if (fs.existsSync(TOKEN_PATH)) {
            const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
            this.oauth2Client.setCredentials(token);
            this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

            // Load root folder ID from database
            await this.loadRootFolderId();
            return true;
        }

        return false;
    }

    /**
     * Generate OAuth2 authorization URL
     */
    getAuthUrl() {
        if (!this.oauth2Client) {
            throw new Error('OAuth2 client not initialized');
        }

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent'
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async authenticate(code) {
        if (!this.oauth2Client) {
            await this.initializeClient();
        }

        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);

        // Save token to file
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

        // Initialize Drive API
        this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

        // Create or get root folder
        await this.ensureRootFolder();

        // Save connection status to database
        await this.saveConnectionStatus(tokens);

        return true;
    }

    /**
     * Check if connected to Google Drive
     */
    async isConnected() {
        try {
            if (!fs.existsSync(TOKEN_PATH)) {
                return false;
            }

            await this.initializeClient();

            // Test API access
            await this.drive.files.list({ pageSize: 1 });
            return true;
        } catch (error) {
            console.error('Drive connection check failed:', error.message);
            return false;
        }
    }

    /**
     * Disconnect from Google Drive
     */
    async disconnect() {
        if (fs.existsSync(TOKEN_PATH)) {
            fs.unlinkSync(TOKEN_PATH);
        }

        // Update database
        await pool.query(`
            UPDATE sync_status 
            SET connected = 0, access_token = NULL, refresh_token = NULL, token_expiry = NULL
            WHERE provider = 'google_drive'
        `);

        this.drive = null;
        this.rootFolderId = null;
    }

    /**
     * Ensure LogisPro root folder exists in Drive
     */
    async ensureRootFolder() {
        if (this.rootFolderId) return this.rootFolderId;

        // Search for existing folder
        const response = await this.drive.files.list({
            q: "name = 'LogisPro Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields: 'files(id, name)'
        });

        if (response.data.files.length > 0) {
            this.rootFolderId = response.data.files[0].id;
        } else {
            // Create new folder
            const folder = await this.drive.files.create({
                requestBody: {
                    name: 'LogisPro Backups',
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            this.rootFolderId = folder.data.id;
        }

        // Save to database
        await pool.query(`
            INSERT INTO sync_status (id, provider, connected, root_folder_id)
            VALUES ('main', 'google_drive', 1, ?)
            ON CONFLICT(id) DO UPDATE SET root_folder_id = ?, connected = 1
        `, [this.rootFolderId, this.rootFolderId]);

        return this.rootFolderId;
    }

    /**
     * Load root folder ID from database
     */
    async loadRootFolderId() {
        const result = await pool.query(`
            SELECT root_folder_id FROM sync_status WHERE provider = 'google_drive'
        `);
        if (result.rows.length > 0 && result.rows[0].root_folder_id) {
            this.rootFolderId = result.rows[0].root_folder_id;
        }
    }

    /**
     * Save connection status to database
     */
    async saveConnectionStatus(tokens) {
        await pool.query(`
            INSERT INTO sync_status (id, provider, connected, access_token, refresh_token, token_expiry, root_folder_id)
            VALUES ('main', 'google_drive', 1, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                connected = 1,
                access_token = ?,
                refresh_token = ?,
                token_expiry = ?,
                root_folder_id = ?
        `, [
            tokens.access_token,
            tokens.refresh_token,
            tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            this.rootFolderId,
            tokens.access_token,
            tokens.refresh_token,
            tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            this.rootFolderId
        ]);
    }

    /**
     * Get or create a subfolder in Drive
     */
    async getOrCreateFolder(name, parentId = null) {
        const parent = parentId || this.rootFolderId;

        // Search for existing folder
        const response = await this.drive.files.list({
            q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and '${parent}' in parents and trashed = false`,
            fields: 'files(id, name)'
        });

        if (response.data.files.length > 0) {
            return response.data.files[0].id;
        }

        // Create new folder
        const folder = await this.drive.files.create({
            requestBody: {
                name: name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parent]
            },
            fields: 'id'
        });

        return folder.data.id;
    }

    /**
     * Upload a file to Google Drive
     */
    async uploadFile(filePath, fileName, folderId = null) {
        if (!this.drive) {
            throw new Error('Not connected to Google Drive');
        }

        const parent = folderId || this.rootFolderId;
        const fileMetadata = {
            name: fileName,
            parents: [parent]
        };

        const media = {
            mimeType: 'application/octet-stream',
            body: fs.createReadStream(filePath)
        };

        const response = await this.drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, size, createdTime'
        });

        return response.data;
    }

    /**
     * Backup the SQLite database to Google Drive
     */
    async backupDatabase() {
        if (!this.drive) {
            await this.initializeClient();
        }

        const dbPath = path.join(__dirname, '../../data/logispro.db');
        if (!fs.existsSync(dbPath)) {
            throw new Error('Database file not found');
        }

        // Create backup folder
        const backupFolderId = await this.getOrCreateFolder('Database Backups');

        // Create timestamped backup filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `logispro_backup_${timestamp}.db`;

        // Copy database to temp location (to avoid locking issues)
        const tempBackupPath = path.join(BACKUPS_DIR, backupFileName);
        fs.copyFileSync(dbPath, tempBackupPath);

        try {
            // Upload to Drive
            const uploadResult = await this.uploadFile(tempBackupPath, backupFileName, backupFolderId);

            // Save backup record to database
            const stats = fs.statSync(tempBackupPath);
            await pool.query(`
                INSERT INTO backups (id, provider, file_id, file_name, file_size_bytes, backup_type)
                VALUES (?, 'google_drive', ?, ?, ?, 'database')
            `, [
                `backup-${Date.now()}`,
                uploadResult.id,
                backupFileName,
                stats.size
            ]);

            // Update last sync time
            await pool.query(`
                UPDATE sync_status SET last_sync = datetime('now') WHERE provider = 'google_drive'
            `);

            console.log(`✅ Database backed up to Google Drive: ${backupFileName}`);
            return uploadResult;
        } finally {
            // Clean up local temp file after 24 hours
            setTimeout(() => {
                if (fs.existsSync(tempBackupPath)) {
                    fs.unlinkSync(tempBackupPath);
                }
            }, 24 * 60 * 60 * 1000);
        }
    }

    /**
     * Sync a single document to Google Drive
     */
    async syncDocument(document) {
        if (!this.drive) {
            await this.initializeClient();
        }

        // Create documents folder
        const docsFolderId = await this.getOrCreateFolder('Documents');

        // Create shipment subfolder if shipment_id exists
        let targetFolderId = docsFolderId;
        if (document.shipment_id) {
            targetFolderId = await this.getOrCreateFolder(`Shipment_${document.shipment_id}`, docsFolderId);
        }

        // Check if file exists locally
        const uploadsDir = path.join(__dirname, '../../uploads');
        const filePath = path.join(uploadsDir, document.file_path || document.file_name);

        if (!fs.existsSync(filePath)) {
            console.warn(`Document file not found: ${filePath}`);
            return null;
        }

        // Upload file
        const uploadResult = await this.uploadFile(filePath, document.file_name, targetFolderId);

        // Update document sync record
        await pool.query(`
            INSERT INTO document_sync (document_id, drive_file_id, synced_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(document_id) DO UPDATE SET drive_file_id = ?, synced_at = datetime('now')
        `, [document.id, uploadResult.id, uploadResult.id]);

        return uploadResult;
    }

    /**
     * Sync all unsynced documents
     */
    async syncAllDocuments() {
        if (!this.drive) {
            await this.initializeClient();
        }

        // Get unsynced documents
        const result = await pool.query(`
            SELECT d.* FROM documents d
            LEFT JOIN document_sync ds ON d.id = ds.document_id
            WHERE ds.document_id IS NULL AND d.deleted_at IS NULL
        `);

        const documents = result.rows;
        console.log(`📄 Syncing ${documents.length} documents to Google Drive...`);

        const results = [];
        for (const doc of documents) {
            try {
                const result = await this.syncDocument(doc);
                if (result) {
                    results.push({ success: true, document: doc.file_name, driveId: result.id });
                }
            } catch (error) {
                console.error(`Failed to sync document ${doc.id}:`, error.message);
                results.push({ success: false, document: doc.file_name, error: error.message });
            }
        }

        // Update last sync time
        await pool.query(`
            UPDATE sync_status SET last_sync = datetime('now') WHERE provider = 'google_drive'
        `);

        return results;
    }

    /**
     * List all backups from Google Drive
     */
    async listBackups() {
        const result = await pool.query(`
            SELECT * FROM backups 
            WHERE provider = 'google_drive' 
            ORDER BY created_at DESC 
            LIMIT 30
        `);
        return result.rows;
    }

    /**
     * Get sync status
     */
    async getSyncStatus() {
        const connected = await this.isConnected();

        const statusResult = await pool.query(`
            SELECT * FROM sync_status WHERE provider = 'google_drive'
        `);

        const backupsResult = await pool.query(`
            SELECT COUNT(*) as count FROM backups WHERE provider = 'google_drive'
        `);

        const syncedDocsResult = await pool.query(`
            SELECT COUNT(*) as count FROM document_sync
        `);

        const totalDocsResult = await pool.query(`
            SELECT COUNT(*) as count FROM documents WHERE deleted_at IS NULL
        `);

        return {
            connected,
            lastSync: statusResult.rows[0]?.last_sync || null,
            totalBackups: backupsResult.rows[0]?.count || 0,
            syncedDocuments: syncedDocsResult.rows[0]?.count || 0,
            totalDocuments: totalDocsResult.rows[0]?.count || 0
        };
    }
}

// Singleton instance
const driveService = new DriveService();

module.exports = driveService;
