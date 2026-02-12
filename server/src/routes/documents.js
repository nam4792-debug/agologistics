const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const pool = require('../config/database');
const { authenticateToken } = require('./auth');

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
router.get('/', async (req, res) => {
    try {
        const { shipmentId } = req.query;
        let query = 'SELECT * FROM documents ORDER BY created_at DESC';
        const params = [];

        if (shipmentId) {
            query = 'SELECT * FROM documents WHERE shipment_id = $1 ORDER BY created_at DESC';
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
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { shipmentId, documentType, documentNumber, issueDate, expiryDate, issuer } = req.body;

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

        // Save to database
        const { rows } = await pool.query(
            `INSERT INTO documents 
       (shipment_id, document_type, document_number, version,
        file_path, file_name, file_size_bytes, file_type, file_hash,
        issue_date, expiry_date, issuer, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'UPLOADED')
       RETURNING *`,
            [
                shipmentId,
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
router.post('/upload-multiple', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { shipmentId, documentType } = req.body;

        if (!shipmentId) {
            return res.status(400).json({ error: 'shipmentId is required' });
        }

        const documents = [];

        for (const file of req.files) {
            const fileBuffer = await fs.readFile(file.path);
            const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            const { rows } = await pool.query(
                `INSERT INTO documents 
         (shipment_id, document_type, file_path, file_name, file_size_bytes, file_type, file_hash, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'UPLOADED')
         RETURNING *`,
                [
                    shipmentId,
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
router.get('/shipment/:shipmentId', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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
router.get('/:id/download', async (req, res) => {
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
router.get('/:id/preview', async (req, res) => {
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
router.patch('/:id/status', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'UPDATE documents SET deleted_at = NOW() WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
