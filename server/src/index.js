require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

// ============================================
// CRASH PROTECTION — Prevents server from dying
// ============================================
process.on('uncaughtException', (err) => {
    console.error('🔴 Uncaught Exception (server stays alive):', err.message);
    console.error(err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔴 Unhandled Rejection (server stays alive):', reason);
});

// Import configs
const pool = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const licensesRoutes = require('./routes/licenses');
const adminRoutes = require('./routes/admin');
const bookingsRoutes = require('./routes/bookings');
const shipmentsRoutes = require('./routes/shipments');
const documentsRoutes = require('./routes/documents');
const notificationsRoutes = require('./routes/notifications');
const tasksRoutes = require('./routes/tasks');
const truckDispatchesRoutes = require('./routes/truckDispatches');
const dashboardRoutes = require('./routes/dashboard');
const syncRoutes = require('./routes/sync');
const providersRoutes = require('./routes/providers');
const searchRoutes = require('./routes/search');
const customersRoutes = require('./routes/customers');
const qcStaffRoutes = require('./routes/qcstaff');

// Import jobs
const { checkDeadlines } = require('./jobs/deadlineMonitor');
const { initSyncJobs } = require('./jobs/syncJob');
const { updateVendorPerformance } = require('./jobs/vendorPerformance');
const auditService = require('./services/auditService');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true,
    },
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || true,  // true = reflect request origin (needed for Electron file://)
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/seed', require('./routes/seed'));
app.use('/api/licenses', licensesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/shipments', shipmentsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/truck-dispatches', truckDispatchesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/qc-staff', qcStaffRoutes);

// Gap #6: Invoice routes
const invoicesRoutes = require('./routes/invoices');
app.use('/api/invoices', invoicesRoutes);

// Cost Management routes
const costManagementRoutes = require('./routes/costManagement');
app.use('/api/costs', costManagementRoutes);

// Reporting routes
const reportingRoutes = require('./routes/reporting');
app.use('/api/reports', reportingRoutes);

// Customer Portal routes
const portalRoutes = require('./routes/customerPortal');
app.use('/api/portal', portalRoutes);

// AI Document Analysis routes
const aiRoutes = require('./routes/ai');
app.use('/api/ai', aiRoutes);

// Settings routes (AI config etc.)
const settingsRoutes = require('./routes/settings');
app.use('/api/settings', settingsRoutes);

// Activity Log routes
const activityLogRoutes = require('./routes/activityLog');
app.use('/api/activity-log', activityLogRoutes);

// Gap #9: Audit trail route
app.get('/api/audit-log/:entityType/:entityId', async (req, res) => {
    try {
        const history = await auditService.getHistory(req.params.entityType, req.params.entityId);
        res.json({ auditLog: history });
    } catch (error) {
        res.json({ auditLog: [] });
    }
});
app.get('/api/audit-log/recent', async (req, res) => {
    try {
        const activity = await auditService.getRecentActivity(parseInt(req.query.limit) || 20);
        res.json({ auditLog: activity });
    } catch (error) {
        res.json({ auditLog: [] });
    }
});

// Test endpoint to trigger deadline check manually
app.post('/api/test/trigger-deadline-check', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Test endpoints disabled in production' });
    }
    await checkDeadlines(io);
    res.json({ message: 'Deadline check triggered' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('join', (room) => {
        socket.join(room);
        console.log(`👤 Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('leave', (room) => {
        socket.leave(room);
        console.log(`👤 Socket ${socket.id} left room: ${room}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// Serve frontend static files
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// SPA catch-all route
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
        res.status(404).json({ error: 'API endpoint not found' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// Start server
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, async () => {
    console.log(`\n🚀 LogisPro Server running on ${HOST}:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   API:    http://localhost:${PORT}/api\n`);

    // Deadline monitoring (non-fatal)
    console.log('📅 Starting deadline monitor (every 5 minutes)...');
    try { await checkDeadlines(io); } catch (e) {
        console.error('⚠️ Deadline check failed on startup (non-fatal):', e.message);
    }
    setInterval(async () => {
        try { await checkDeadlines(io); } catch (e) {
            console.error('⚠️ Deadline check failed (non-fatal):', e.message);
        }
    }, 5 * 60 * 1000);
    console.log('✅ Deadline monitor started');

    // Vendor performance (non-fatal)
    console.log('📊 Starting vendor performance updater (every 1 hour)...');
    try { await updateVendorPerformance(); } catch (e) {
        console.error('⚠️ Vendor perf update failed on startup (non-fatal):', e.message);
    }
    setInterval(async () => {
        try { await updateVendorPerformance(); } catch (e) {
            console.error('⚠️ Vendor perf update failed (non-fatal):', e.message);
        }
    }, 60 * 60 * 1000);
    console.log('✅ Vendor performance updater started');

    // Schema migrations
    try {
        const fs = require('fs');
        const migrationPath = require('path').join(__dirname, 'db', 'schema.sql');
        if (fs.existsSync(migrationPath)) {
            const schema = fs.readFileSync(migrationPath, 'utf-8');
            await pool.query(schema);
            console.log('✅ Schema migrations applied');
        }
    } catch (e) {
        console.log('⚠️ Schema migration note:', e.message);
    }

    // Sync jobs
    try { initSyncJobs(); } catch (e) {
        console.error('⚠️ Sync jobs init failed (non-fatal):', e.message);
    }
    console.log('');
});

module.exports = { app, io, server };
