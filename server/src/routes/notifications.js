const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { authenticateToken } = require('./auth');

// Get notifications for current user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { unreadOnly, limit } = req.query;

        const notifications = await notificationService.getForUser(req.user.userId, {
            unreadOnly: unreadOnly === 'true',
            limit: parseInt(limit) || 50,
        });

        // Count unread
        const unreadCount = notifications.filter(n => !n.is_read).length;

        res.json({
            notifications,
            unreadCount,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
    try {
        await notificationService.markAsRead(req.params.id, req.user.userId);
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark all as read
router.patch('/read-all', authenticateToken, async (req, res) => {
    try {
        await notificationService.markAllAsRead(req.user.userId);
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test endpoint - send test notification
router.post('/test', async (req, res) => {
    try {
        const io = req.app.get('io');
        const { title, message, priority } = req.body;

        await notificationService.send({
            type: 'TEST',
            priority: priority || 'MEDIUM',
            title: title || '🔔 Test Notification',
            message: message || 'This is a test notification from LogisPro',
        }, io);

        res.json({ message: 'Test notification sent' });
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
