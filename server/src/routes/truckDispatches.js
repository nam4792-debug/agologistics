const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const workflowService = require('../services/workflowService');
const { authenticateToken } = require('./auth');
const auditService = require('../services/auditService');

// Get all truck dispatches
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { bookingId, shipmentId, status } = req.query;

        let query = `
      SELECT td.*, 
             b.booking_number, b.origin_port, b.destination_port, b.vessel_flight, b.shipping_line,
             s.shipment_number,
             u.full_name as created_by_name
      FROM truck_dispatches td
      LEFT JOIN bookings b ON td.booking_id = b.id
      LEFT JOIN shipments s ON b.shipment_id = s.id
      LEFT JOIN users u ON td.created_by = u.id
      WHERE 1=1
    `;

        const params = [];
        let paramIndex = 1;

        if (bookingId) {
            query += ` AND td.booking_id = $${paramIndex++}`;
            params.push(bookingId);
        }

        if (shipmentId) {
            query += ` AND s.id = $${paramIndex++}`;
            params.push(shipmentId);
        }

        if (status) {
            query += ` AND td.status = $${paramIndex++}`;
            params.push(status);
        }

        query += ' ORDER BY td.pickup_datetime DESC';

        const { rows } = await pool.query(query, params);
        res.json({ dispatches: rows });
    } catch (error) {
        console.error('Error fetching dispatches:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single dispatch
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT td.*, 
              b.booking_number, b.route, b.vessel_flight, b.origin_port, b.destination_port, b.shipping_line,
              s.shipment_number,
              u.full_name as created_by_name
       FROM truck_dispatches td
       LEFT JOIN bookings b ON td.booking_id = b.id
       LEFT JOIN shipments s ON b.shipment_id = s.id
       LEFT JOIN users u ON td.created_by = u.id
       WHERE td.id = $1`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Dispatch not found' });
        }

        res.json({ dispatch: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create truck dispatch (triggers workflow)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const io = req.app.get('io');

        const dispatch = await workflowService.createTruckDispatch(
            req.body,
            req.user.userId,
            io
        );

        // Audit trail
        auditService.log('dispatch', dispatch.id, 'CREATE', req.user?.userId || null, {
            booking_id: req.body.bookingId,
            truck_plate: req.body.truckPlate,
            driver: req.body.driverName,
        });

        res.status(201).json({
            message: 'Truck dispatched successfully',
            dispatch,
        });
    } catch (error) {
        console.error('Error creating dispatch:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Update dispatch status
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'LOADING', 'COMPLETED', 'CANCELLED'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
        }

        const { rows } = await pool.query(
            'UPDATE truck_dispatches SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Dispatch not found' });
        }

        // Audit trail
        auditService.log('dispatch', req.params.id, 'STATUS_CHANGE', req.user?.userId || null, {
            status: { new: status },
        });

        res.json({ dispatch: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update dispatch
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const {
            truckCompany,
            driverName,
            driverPhone,
            truckPlate,
            pickupDatetime,
            warehouseLocation,
            notes,
        } = req.body;

        const { rows } = await pool.query(
            `UPDATE truck_dispatches 
       SET truck_company = COALESCE($1, truck_company),
           driver_name = COALESCE($2, driver_name),
           driver_phone = COALESCE($3, driver_phone),
           truck_plate = COALESCE($4, truck_plate),
           pickup_datetime = COALESCE($5, pickup_datetime),
           warehouse_location = COALESCE($6, warehouse_location),
           notes = COALESCE($7, notes),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
            [
                truckCompany,
                driverName,
                driverPhone,
                truckPlate,
                pickupDatetime,
                warehouseLocation,
                notes,
                req.params.id,
            ]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Dispatch not found' });
        }

        // Audit trail
        auditService.log('dispatch', req.params.id, 'UPDATE', req.user?.userId || null, {
            updated_fields: Object.keys(req.body),
        });

        res.json({ dispatch: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete dispatch
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'DELETE FROM truck_dispatches WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Dispatch not found' });
        }

        // Audit trail
        auditService.log('dispatch', req.params.id, 'DELETE', req.user?.userId || null, {});

        res.json({ message: 'Dispatch deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
