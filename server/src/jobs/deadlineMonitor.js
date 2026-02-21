const pool = require('../config/database');
const notificationService = require('../services/notificationService');

// Main deadline check function
async function checkDeadlines(io) {
    console.log('🔍 Checking booking deadlines...');

    try {
        // ===== PHASE 1: Pre-confirm monitoring (pending bookings) =====
        await checkPreConfirmDeadlines(io);

        // ===== PHASE 2: Post-confirm monitoring (confirmed but no dispatch) =====
        await checkPostConfirmDeadlines(io);

        console.log('✅ Deadline check complete\n');
    } catch (error) {
        console.error('❌ Error checking deadlines:', error);
    }
}

// Phase 1: Original pre-confirm deadline tracking
async function checkPreConfirmDeadlines(io) {
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
        AND b.status != 'CANCELLED'
    `);

    if (bookings.length === 0) {
        console.log('   No pending pre-confirm bookings found');
        return;
    }

    console.log(`   Found ${bookings.length} pending pre-confirm bookings`);

    const now = new Date();

    for (const booking of bookings) {
        const deadlines = getValidDeadlines(booking);
        if (deadlines.length === 0) continue;

        const earliestDeadline = deadlines[0];
        const hoursUntil = (earliestDeadline.date - now) / (1000 * 60 * 60);

        const alertInfo = determineAlert(booking, hoursUntil);

        if (alertInfo.shouldAlert) {
            const alertData = {
                type: `DEADLINE_${alertInfo.alertType.toUpperCase()}`,
                priority: alertInfo.priority,
                title: getAlertTitle(alertInfo.alertType, booking),
                message: getPreConfirmMessage(alertInfo.alertType, booking, hoursUntil, earliestDeadline.type),
                bookingId: booking.booking_id,
                actionUrl: `/bookings/${booking.booking_id}`,
                actionLabel: 'View Booking',
            };

            await notificationService.send(alertData, io);
            await markAlertSent(booking.id, alertInfo.alertType);
            console.log(`   ⚠️ Pre-confirm alert: ${booking.booking_number} - ${alertInfo.alertType.toUpperCase()}`);
        }
    }
}

// Phase 2: Post-confirm deadline tracking (confirmed but missing dispatch)
async function checkPostConfirmDeadlines(io) {
    const { rows: bookings } = await pool.query(`
      SELECT 
        bd.*,
        b.booking_number,
        b.route,
        b.vessel_flight,
        b.type,
        b.id as b_id
      FROM booking_deadlines bd
      JOIN bookings b ON bd.booking_id = b.id
      WHERE bd.sales_confirmed = true
        AND b.status = 'CONFIRMED'
        AND b.status != 'CANCELLED'
        AND NOT EXISTS (
          SELECT 1 FROM truck_dispatches td 
          WHERE td.booking_id = b.id 
          AND td.status NOT IN ('CANCELLED')
        )
    `);

    if (bookings.length === 0) {
        console.log('   No confirmed bookings without dispatch found');
        return;
    }

    console.log(`   Found ${bookings.length} confirmed bookings without dispatch`);

    const now = new Date();

    for (const booking of bookings) {
        const deadlines = getValidDeadlines(booking);
        if (deadlines.length === 0) continue;

        const earliestDeadline = deadlines[0];
        const hoursUntil = (earliestDeadline.date - now) / (1000 * 60 * 60);

        // Only alert if deadline is within 72 hours (more aggressive for post-confirm)
        if (hoursUntil > 72) continue;

        let priority = 'MEDIUM';
        let urgency = '';

        if (hoursUntil < 0) {
            priority = 'CRITICAL';
            urgency = 'OVERDUE';
        } else if (hoursUntil <= 12) {
            priority = 'CRITICAL';
            urgency = 'VERY URGENT';
        } else if (hoursUntil <= 24) {
            priority = 'HIGH';
            urgency = 'URGENT';
        } else if (hoursUntil <= 48) {
            priority = 'MEDIUM';
            urgency = 'ATTENTION NEEDED';
        } else {
            priority = 'LOW';
            urgency = 'REMINDER';
        }

        const alertData = {
            type: 'DISPATCH_NEEDED',
            priority,
            title: `🚛 ${urgency}: No truck dispatched for ${booking.booking_number}`,
            message: `Booking confirmed but no truck assigned. ${hoursUntil > 0 ? hoursUntil.toFixed(1) : '0'} hours until Cut-off ${earliestDeadline.type}. Route: ${booking.route || 'N/A'}. DISPATCH TRUCK NOW!`,
            bookingId: booking.booking_id,
            actionUrl: `/bookings/${booking.booking_id}`,
            actionLabel: 'Dispatch Truck Now',
        };

        await notificationService.send(alertData, io);
        console.log(`   🚛 Post-confirm alert: ${booking.booking_number} - ${urgency}`);
    }
}

// Helper: Get valid (non-NaN) deadlines sorted earliest first
function getValidDeadlines(booking) {
    return [
        { type: 'SI', date: new Date(booking.cut_off_si) },
        { type: 'VGM', date: new Date(booking.cut_off_vgm) },
        { type: 'CY', date: new Date(booking.cut_off_cy) },
    ]
        .filter(d => !isNaN(d.date.getTime()))
        .sort((a, b) => a.date - b.date);
}

// Helper: Determine which alert tier to send
function determineAlert(booking, hoursUntil) {
    let shouldAlert = false;
    let alertType = null;
    let priority = 'MEDIUM';

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

    return { shouldAlert, alertType, priority };
}

// Helper: Mark alert as sent
async function markAlertSent(deadlineId, alertType) {
    const columnName = `alert_sent_${alertType}`;
    await pool.query(
        `UPDATE booking_deadlines 
         SET ${columnName} = true, updated_at = NOW()
         WHERE id = $1`,
        [deadlineId]
    );
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
        overdue: 'OVERDUE',
        '6h': '6 HOURS LEFT',
        '12h': '12 HOURS LEFT',
        '24h': '24 HOURS LEFT',
        '48h': '48 HOURS LEFT',
    };

    return `${icons[type]} ${labels[type]}: ${booking.booking_number}`;
}

function getPreConfirmMessage(type, booking, hours, deadlineType) {
    if (type === 'overdue') {
        return `Booking is ${Math.abs(hours).toFixed(1)} hours past deadline. Sales has not confirmed. CANCEL BOOKING IMMEDIATELY! (Cut-off ${deadlineType})`;
    }

    return `${hours.toFixed(1)} hours until Cut-off ${deadlineType}. Route: ${booking.route || 'N/A'}. Vessel: ${booking.vessel_flight || 'N/A'}. Sales needs to confirm soon.`;
}

module.exports = {
    checkDeadlines,
};
