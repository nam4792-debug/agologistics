const pool = require('../config/database');
const nodemailer = require('nodemailer');

class NotificationService {
    constructor() {
        // Initialize email transporter
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    /**
     * Send notification via database + Socket.io + email
     */
    async send(options, io) {
        const {
            type,
            priority = 'MEDIUM',
            title,
            message,
            bookingId,
            shipmentId,
            userId,
            actionUrl,
            actionLabel,
        } = options;

        try {
            // ── Duplicate check: skip if same type + reference exists within 24h ──
            const refId = bookingId || shipmentId || null;
            if (refId) {
                const refColumn = bookingId ? 'booking_id' : 'shipment_id';
                const { rows: existing } = await pool.query(
                    `SELECT id FROM notifications 
                     WHERE type = $1 AND ${refColumn} = $2 
                     AND created_at > NOW() - INTERVAL '24 hours'
                     LIMIT 1`,
                    [type, refId]
                );
                if (existing.length > 0) {
                    // Already notified about this same issue recently — skip
                    return null;
                }
            }

            // 1. Save to database
            const { rows } = await pool.query(
                `INSERT INTO notifications 
         (user_id, type, priority, title, message, booking_id, shipment_id, action_url, action_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
                [userId || null, type, priority, title, message, bookingId || null, shipmentId || null, actionUrl, actionLabel]
            );

            const notification = rows[0];

            // 2. Get recipients (if no specific userId, send to all logistics staff)
            let recipients = [];
            if (userId) {
                recipients = [userId];
            } else {
                const { rows: users } = await pool.query(
                    `SELECT id, email FROM users 
           WHERE role IN ('LOGISTICS_COORDINATOR', 'LOGISTICS_MANAGER', 'ADMIN')
           AND status = 'ACTIVE'`
                );
                recipients = users;
            }

            // 3. Send via Socket.io (real-time popup)
            if (io) {
                for (const recipient of recipients) {
                    const recipientId = recipient.id || recipient;
                    io.to(`user_${recipientId}`).emit('notification', {
                        id: notification.id,
                        type,
                        priority,
                        title,
                        message,
                        bookingId,
                        shipmentId,
                        actionUrl,
                        actionLabel,
                        createdAt: notification.created_at,
                    });
                }

                // Also broadcast to general notifications channel
                io.emit('notification:new', {
                    id: notification.id,
                    type,
                    priority,
                    title,
                    message,
                    createdAt: notification.created_at,
                });
            }

            // 4. Send email (if SMTP configured)
            if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                for (const recipient of recipients) {
                    if (recipient.email) {
                        await this.sendEmail(recipient.email, title, message, priority);
                    }
                }
            }

            console.log(`📬 Notification sent: ${title}`);
            return notification;
        } catch (error) {
            console.error('❌ Failed to send notification:', error);
            throw error;
        }
    }

    /**
     * Send email notification
     */
    async sendEmail(to, subject, message, priority) {
        try {
            const priorityColors = {
                CRITICAL: '#dc2626',
                HIGH: '#ea580c',
                MEDIUM: '#ca8a04',
                LOW: '#2563eb',
            };

            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
            .header { background: ${priorityColors[priority] || '#4f46e5'}; color: white; padding: 20px; }
            .content { padding: 20px; }
            .footer { background: #f9fafb; padding: 15px; text-align: center; color: #6b7280; font-size: 12px; }
            .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: ${priorityColors[priority] || '#4f46e5'}; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Ago Logistics Alert</h1>
            </div>
            <div class="content">
              <p><span class="priority-badge">${priority}</span></p>
              <h2>${subject}</h2>
              <p>${message}</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #6b7280;">Log in to Ago Logistics to view details and take action.</p>
            </div>
            <div class="footer">
              <p>Ago Logistics - Export Logistics Management System</p>
              <p>&copy; 2026 Ago Import Export Co.,Ltd</p>
            </div>
          </div>
        </body>
        </html>
      `;

            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || 'Ago Logistics <noreply@agologistics.app>',
                to,
                subject: `[${priority}] ${subject}`,
                html,
            });

            console.log(`📧 Email sent to ${to}`);
        } catch (error) {
            console.error(`❌ Failed to send email to ${to}:`, error.message);
        }
    }

    /**
     * Get notifications for a user
     */
    async getForUser(userId, options = {}) {
        const { limit = 50, unreadOnly = false } = options;

        let query = `
      SELECT n.*, 
             b.booking_number,
             s.shipment_number
      FROM notifications n
      LEFT JOIN bookings b ON n.booking_id = b.id
      LEFT JOIN shipments s ON n.shipment_id = s.id
      WHERE n.user_id = $1 OR n.user_id IS NULL
    `;

        if (unreadOnly) {
            query += ' AND n.is_read = false';
        }

        query += ' ORDER BY n.created_at DESC LIMIT $2';

        const { rows } = await pool.query(query, [userId, limit]);
        return rows;
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        await pool.query(
            `UPDATE notifications 
       SET is_read = true, read_at = NOW()
       WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
            [notificationId, userId]
        );
    }

    /**
     * Mark all notifications as read for user
     */
    async markAllAsRead(userId) {
        await pool.query(
            `UPDATE notifications 
       SET is_read = true, read_at = NOW()
       WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false`,
            [userId]
        );
    }
}

module.exports = new NotificationService();
