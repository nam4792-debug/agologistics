const pool = require('../config/database');
const notificationService = require('../services/notificationService');

// Main deadline check function
async function checkDeadlines(io) {
    console.log('🔍 Checking booking deadlines...');

    try {
        // Query pending bookings with their deadlines
        const { rows: bookings } = await pool.query(`
      SELECT 
        bd.*,
        b.booking_number,
        b.route,
        b.vessel_flight,
        b.type
      FROM booking_deadlines bd
      JOIN bookings b ON bd.booking_id = b.id
      WHERE bd.status = 'PENDING' 
        AND bd.sales_confirmed = false
    `);

        if (bookings.length === 0) {
            console.log('   No pending bookings found');
            return;
        }

        console.log(`   Found ${bookings.length} pending bookings`);

        const now = new Date();

        for (const booking of bookings) {
            // Find earliest deadline
            const deadlines = [
                { type: 'SI', date: new Date(booking.cut_off_si) },
                { type: 'VGM', date: new Date(booking.cut_off_vgm) },
                { type: 'CY', date: new Date(booking.cut_off_cy) },
            ].sort((a, b) => a.date - b.date);

            const earliestDeadline = deadlines[0];
            const hoursUntil = (earliestDeadline.date - now) / (1000 * 60 * 60);

            let shouldAlert = false;
            let alertType = null;
            let priority = 'MEDIUM';

            // Check which alert to send
            if (hoursUntil < 0 && !booking.alert_sent_overdue) {
                shouldAlert = true;
                alertType = 'overdue';
                priority = 'CRITICAL';
            } else if (hoursUntil <= 6 && hoursUntil > 0 && !booking.alert_sent_6h) {
                shouldAlert = true;
                alertType = '6h';
                priority = 'CRITICAL';
            } else if (hoursUntil <= 12 && hoursUntil > 6 && !booking.alert_sent_12h) {
                shouldAlert = true;
                alertType = '12h';
                priority = 'HIGH';
            } else if (hoursUntil <= 24 && hoursUntil > 12 && !booking.alert_sent_24h) {
                shouldAlert = true;
                alertType = '24h';
                priority = 'MEDIUM';
            } else if (hoursUntil <= 48 && hoursUntil > 24 && !booking.alert_sent_48h) {
                shouldAlert = true;
                alertType = '48h';
                priority = 'LOW';
            }

            if (shouldAlert) {
                const alertData = {
                    type: `DEADLINE_${alertType.toUpperCase()}`,
                    priority,
                    title: getAlertTitle(alertType, booking),
                    message: getAlertMessage(alertType, booking, hoursUntil, earliestDeadline.type),
                    bookingId: booking.booking_id,
                    actionUrl: `/bookings/${booking.booking_id}`,
                    actionLabel: 'Xem Booking',
                };

                // Send notification
                await notificationService.send(alertData, io);

                // Mark alert as sent
                const columnName = `alert_sent_${alertType.replace('h', 'h')}`;
                await pool.query(
                    `UPDATE booking_deadlines 
           SET ${columnName} = true,
               updated_at = NOW()
           WHERE id = $1`,
                    [booking.id]
                );

                console.log(`   ⚠️ Alert sent: ${booking.booking_number} - ${alertType.toUpperCase()}`);
            }
        }

        console.log('✅ Deadline check complete\n');
    } catch (error) {
        console.error('❌ Error checking deadlines:', error);
    }
}

function getAlertTitle(type, booking) {
    const icons = {
        overdue: '🚨',
        '6h': '🔴',
        '12h': '🟠',
        '24h': '🟡',
        '48h': '🔵',
    };

    const labels = {
        overdue: 'QUÁ DEADLINE',
        '6h': 'CÒN 6 GIỜ',
        '12h': 'CÒN 12 GIỜ',
        '24h': 'CÒN 24 GIỜ',
        '48h': 'CÒN 48 GIỜ',
    };

    return `${icons[type]} ${labels[type]}: ${booking.booking_number}`;
}

function getAlertMessage(type, booking, hours, deadlineType) {
    if (type === 'overdue') {
        return `Booking đã quá deadline ${Math.abs(hours).toFixed(1)} giờ. Sales chưa confirm. CẦN HỦY BOOKING NGAY! (Cut-off ${deadlineType})`;
    }

    return `Còn ${hours.toFixed(1)} giờ đến Cut-off ${deadlineType}. Tuyến: ${booking.route || 'N/A'}. Tàu: ${booking.vessel_flight || 'N/A'}. Sales cần confirm sớm.`;
}

module.exports = {
    checkDeadlines,
};
