const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const workflowService = require('../services/workflowService');
const { authenticateToken } = require('./auth');

// Get all tasks
router.get('/', async (req, res) => {
    try {
        const { status, bookingId, assignedTo, type } = req.query;

        let query = `
      SELECT t.*, 
             b.booking_number,
             s.shipment_number,
             u.full_name as assigned_to_name
      FROM tasks t
      LEFT JOIN bookings b ON t.booking_id = b.id
      LEFT JOIN shipments s ON t.shipment_id = s.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE 1=1
    `;

        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND t.status = $${paramIndex++}`;
            params.push(status);
        }

        if (bookingId) {
            query += ` AND t.booking_id = $${paramIndex++}`;
            params.push(bookingId);
        }

        if (assignedTo) {
            query += ` AND t.assigned_to = $${paramIndex++}`;
            params.push(assignedTo);
        }

        if (type) {
            query += ` AND t.task_type = $${paramIndex++}`;
            params.push(type);
        }

        query += ' ORDER BY t.deadline ASC, t.priority DESC';

        const { rows } = await pool.query(query, params);
        res.json({ tasks: rows });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single task
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT t.*, 
              b.booking_number,
              s.shipment_number,
              u.full_name as assigned_to_name
       FROM tasks t
       LEFT JOIN bookings b ON t.booking_id = b.id
       LEFT JOIN shipments s ON t.shipment_id = s.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = $1`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ task: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create task
router.post('/', async (req, res) => {
    try {
        const {
            bookingId,
            shipmentId,
            taskType,
            title,
            description,
            assignedTo,
            deadline,
            priority,
        } = req.body;

        const { rows } = await pool.query(
            `INSERT INTO tasks 
       (booking_id, shipment_id, task_type, title, description, assigned_to, deadline, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [
                bookingId,
                shipmentId,
                taskType,
                title,
                description,
                assignedTo,
                deadline,
                priority || 'MEDIUM',
            ]
        );

        res.status(201).json({ task: rows[0] });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Complete task
router.patch('/:id/complete', authenticateToken, async (req, res) => {
    try {
        const io = req.app.get('io');
        const task = await workflowService.completeTask(
            req.params.id,
            req.user.userId,
            io
        );

        res.json({
            message: 'Task completed',
            task,
        });
    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Update task
router.put('/:id', async (req, res) => {
    try {
        const updates = req.body;
        const fields = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = ['status', 'assigned_to', 'deadline', 'priority', 'description'];

        for (const [key, value] of Object.entries(updates)) {
            const snakeKey = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
            if (allowedFields.includes(snakeKey)) {
                fields.push(`${snakeKey} = $${paramIndex++}`);
                values.push(value);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(req.params.id);

        const { rows } = await pool.query(
            `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ task: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete task
router.delete('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'DELETE FROM tasks WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ message: 'Task deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
