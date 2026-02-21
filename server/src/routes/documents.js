const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const pool = require('../config/database');
const { authenticateToken } = require('./auth');
const auditService = require('../services/auditService');

// Configure multer storage
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const shipmentId = req.body.shipmentId || 'general';
        const docType = req.body.documentType || 'general';
        const dir = path.join('./uploads', shipmentId, docType.toLowerCase());

        try {
            await fs.mkdir(dir, { recursive: true });
            cb(null, dir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        cb(null, `${basename}-${uniqueSuffix}${ext}`);
    },
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        '.pdf',
        '.jpg',
        '.jpeg',
        '.png',
        '.docx',
        '.doc',
        '.xlsx',
        '.xls',
    ];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${ext} not allowed. Allowed: ${allowedTypes.join(', ')}`));
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter,
});

// Get all documents or filter by shipmentId query param
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { shipmentId } = req.query;
        let query = 'SELECT * FROM documents WHERE deleted_at IS NULL ORDER BY created_at DESC';
        const params = [];

        if (shipmentId) {
            query = 'SELECT * FROM documents WHERE shipment_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC';
            params.push(shipmentId);
        }

        const { rows } = await pool.query(query, params);
        res.json({ documents: rows });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.json({ documents: [] });
    }
});

// Upload single file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { shipmentId, documentType, documentNumber, issueDate, expiryDate, issuer, bookingId } = req.body;

        if (!shipmentId) {
            return res.status(400).json({ error: 'shipmentId is required' });
        }

        // Calculate file hash
        const fileBuffer = await fs.readFile(req.file.path);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Get current version
        const { rows: existing } = await pool.query(
            `SELECT MAX(version) as max_version FROM documents 
       WHERE shipment_id = $1 AND document_type = $2 AND deleted_at IS NULL`,
            [shipmentId, documentType]
        );
        const version = (existing[0]?.max_version || 0) + 1;

        // Save to database (with optional booking_id)
        const { rows } = await pool.query(
            `INSERT INTO documents 
       (shipment_id, booking_id, document_type, document_number, version,
        file_path, file_name, file_size_bytes, file_type, file_hash,
        issue_date, expiry_date, issuer, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'UPLOADED')
       RETURNING *`,
            [
                shipmentId,
                bookingId || null,
                documentType || 'GENERAL',
                documentNumber,
                version,
                req.file.path,
                req.file.originalname,
                req.file.size,
                req.file.mimetype,
                hash,
                issueDate || null,
                expiryDate || null,
                issuer,
            ]
        );

        console.log(`📄 Document uploaded: ${req.file.originalname} for shipment ${shipmentId}`);

        // Audit trail
        auditService.log('document', rows[0].id, 'UPLOAD', req.user?.userId || null, {
            file_name: req.file.originalname,
            document_type: documentType || 'GENERAL',
            shipment_id: shipmentId,
        });

        res.status(201).json({
            success: true,
            document: rows[0],
            message: 'File uploaded successfully',
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

// Upload multiple files
router.post('/upload-multiple', authenticateToken, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { shipmentId, documentType, bookingId } = req.body;

        if (!shipmentId) {
            return res.status(400).json({ error: 'shipmentId is required' });
        }

        const documents = [];

        for (const file of req.files) {
            const fileBuffer = await fs.readFile(file.path);
            const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            const { rows } = await pool.query(
                `INSERT INTO documents 
         (shipment_id, booking_id, document_type, file_path, file_name, file_size_bytes, file_type, file_hash, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'UPLOADED')
         RETURNING *`,
                [
                    shipmentId,
                    bookingId || null,
                    documentType || 'GENERAL',
                    file.path,
                    file.originalname,
                    file.size,
                    file.mimetype,
                    hash,
                ]
            );

            documents.push(rows[0]);
        }

        res.status(201).json({
            success: true,
            documents,
            message: `${documents.length} files uploaded successfully`,
        });
    } catch (error) {
        console.error('Multi-upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

// Get documents for shipment
router.get('/shipment/:shipmentId', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT d.*, u.full_name as uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.shipment_id = $1 AND d.deleted_at IS NULL
       ORDER BY d.document_type, d.version DESC`,
            [req.params.shipmentId]
        );

        // Group by document type
        const grouped = rows.reduce((acc, doc) => {
            if (!acc[doc.document_type]) {
                acc[doc.document_type] = [];
            }
            acc[doc.document_type].push(doc);
            return acc;
        }, {});

        res.json({
            documents: rows,
            grouped,
            total: rows.length,
        });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single document
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ document: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Download document
router.get('/:id/download', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = rows[0];

        // Check if file exists
        try {
            await fs.access(doc.file_path);
        } catch {
            return res.status(404).json({ error: 'File not found on server' });
        }

        res.download(doc.file_path, doc.file_name);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// Preview document (for PDFs and images)
router.get('/:id/preview', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = rows[0];
        const previewTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

        if (!previewTypes.includes(doc.file_type)) {
            return res.status(400).json({ error: 'Preview not supported for this file type' });
        }

        res.sendFile(path.resolve(doc.file_path));
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ error: 'Preview failed' });
    }
});

// Update document status
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['UPLOADED', 'VALIDATED', 'APPROVED', 'SUBMITTED', 'REJECTED'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
        }

        const { rows } = await pool.query(
            'UPDATE documents SET status = $1 WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ document: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Soft delete document
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'UPDATE documents SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Audit trail
        auditService.log('document', req.params.id, 'DELETE', req.user?.userId || null, {});

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload new version of an existing document
router.post('/upload-version/:docId', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const parentDocId = req.params.docId;

        // Find the original document
        const { rows: existing } = await pool.query(
            'SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL',
            [parentDocId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Original document not found' });
        }

        const parentDoc = existing[0];
        // Find the true root parent (for chains of versions)
        const rootParentId = parentDoc.parent_document_id || parentDoc.id;

        // Mark ALL previous versions in this chain as not latest
        await pool.query(
            `UPDATE documents SET is_latest = false 
             WHERE (id = $1 OR parent_document_id = $1 OR id = $2 OR parent_document_id = $2)
             AND deleted_at IS NULL`,
            [rootParentId, parentDocId]
        );

        // Calculate file hash
        const fileBuffer = await fs.readFile(req.file.path);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Get next version number
        const { rows: versionRows } = await pool.query(
            `SELECT MAX(version) as max_version FROM documents 
             WHERE (id = $1 OR parent_document_id = $1) AND deleted_at IS NULL`,
            [rootParentId]
        );
        const newVersion = (versionRows[0]?.max_version || parentDoc.version || 1) + 1;

        // Insert new version
        const { rows } = await pool.query(
            `INSERT INTO documents 
             (shipment_id, booking_id, document_type, document_number, version,
              file_path, file_name, file_size_bytes, file_type, file_hash,
              issue_date, expiry_date, issuer, status, parent_document_id, is_latest, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'UPLOADED', $14, true, $15)
             RETURNING *`,
            [
                parentDoc.shipment_id,
                parentDoc.booking_id,
                parentDoc.document_type,
                parentDoc.document_number,
                newVersion,
                req.file.path,
                req.file.originalname,
                req.file.size,
                req.file.mimetype,
                hash,
                parentDoc.issue_date,
                parentDoc.expiry_date,
                parentDoc.issuer,
                rootParentId,
                req.user?.userId || null,
            ]
        );

        // Audit trail
        auditService.log('document', rows[0].id, 'VERSION_UPLOAD', req.user?.userId || null, {
            file_name: req.file.originalname,
            version: newVersion,
            parent_document_id: rootParentId,
            document_type: parentDoc.document_type,
        });

        console.log(`📄 New version v${newVersion} uploaded for document ${parentDocId}`);

        res.status(201).json({
            success: true,
            document: rows[0],
            message: `Version ${newVersion} uploaded successfully`,
        });
    } catch (error) {
        console.error('Version upload error:', error);
        res.status(500).json({ error: error.message || 'Version upload failed' });
    }
});

// Get version history for a document
router.get('/:id/versions', authenticateToken, async (req, res) => {
    try {
        const docId = req.params.id;

        // Find the root document (might be the doc itself or its parent)
        const { rows: doc } = await pool.query(
            'SELECT * FROM documents WHERE id = $1 AND deleted_at IS NULL',
            [docId]
        );

        if (doc.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const rootId = doc[0].parent_document_id || doc[0].id;

        // Get all versions in this chain
        const { rows: versions } = await pool.query(
            `SELECT d.*, u.full_name as uploaded_by_name
             FROM documents d
             LEFT JOIN users u ON d.created_by = u.id
             WHERE (d.id = $1 OR d.parent_document_id = $1) AND d.deleted_at IS NULL
             ORDER BY d.version DESC`,
            [rootId]
        );

        res.json({
            versions,
            total: versions.length,
            currentVersion: versions.find(v => v.is_latest)?.version || 1,
        });
    } catch (error) {
        console.error('Error fetching versions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
