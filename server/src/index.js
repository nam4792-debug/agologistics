require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

// Import configs
const pool = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
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

// Import jobs
const { checkDeadlines } = require('./jobs/deadlineMonitor');
const { initSyncJobs } = require('./jobs/syncJob');

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
    origin: '*',
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

// Test endpoint to trigger deadline check manually
app.post('/api/test/trigger-deadline-check', async (req, res) => {
    await checkDeadlines(io);
    res.json({ message: 'Deadline check triggered' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join user's personal room for notifications
    socket.on('join', (room) => {
        socket.join(room);
        console.log(`👤 Socket ${socket.id} joined room: ${room}`);
    });

    // Leave room
    socket.on('leave', (room) => {
        socket.leave(room);
        console.log(`👤 Socket ${socket.id} left room: ${room}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
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

server.listen(PORT, async () => {
    console.log(`\n🚀 LogisPro Server running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   API:    http://localhost:${PORT}/api\n`);

    // Start deadline monitoring with setInterval (every 5 minutes)
    console.log('📅 Starting deadline monitor (every 5 minutes)...');

    // Run immediately on startup
    await checkDeadlines(io);

    // Then run every 5 minutes
    setInterval(async () => {
        await checkDeadlines(io);
    }, 5 * 60 * 1000);

    console.log('✅ Deadline monitor started');

    // Initialize Google Drive sync jobs
    initSyncJobs();
    console.log('');
});

module.exports = { app, io, server };
