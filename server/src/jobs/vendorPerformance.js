const pool = require('../config/database');

/**
 * Gap #4: Calculate vendor (forwarder) performance from real booking data
 * Runs periodically to update on_time_rate, doc_accuracy_rate, cost_score
 */
async function updateVendorPerformance() {
    console.log('📊 Updating vendor performance scores...');

    try {
        // Get all active forwarders
        const { rows: forwarders } = await pool.query(
            `SELECT id, company_name FROM forwarders WHERE status = 'ACTIVE'`
        );

        if (forwarders.length === 0) {
            console.log('   No active forwarders found');
            return;
        }

        for (const forwarder of forwarders) {
            // Calculate on-time rate: % of bookings where ATD was within 2 days of ETD
            const { rows: onTimeData } = await pool.query(`
                SELECT 
                    COUNT(*) as total_bookings,
                    SUM(CASE 
                        WHEN s.atd IS NOT NULL AND s.etd IS NOT NULL 
                             AND ABS(EXTRACT(EPOCH FROM (s.atd::timestamp - s.etd::timestamp)) / 86400) <= 2 
                        THEN 1 ELSE 0 
                    END) as on_time_count
                FROM bookings b
                LEFT JOIN shipments s ON b.shipment_id = s.id
                WHERE b.forwarder_id = $1 
                  AND b.status NOT IN ('CANCELLED', 'PENDING')
            `, [forwarder.id]);

            const totalBookings = parseInt(onTimeData[0]?.total_bookings) || 0;
            const onTimeCount = parseInt(onTimeData[0]?.on_time_count) || 0;
            const onTimeRate = totalBookings > 0 ? (onTimeCount / totalBookings * 100) : 0;

            // Calculate cost score: average freight rate vs market (simplified)
            const { rows: costData } = await pool.query(`
                SELECT 
                    AVG(freight_rate_usd) as avg_rate,
                    COUNT(*) as booking_count
                FROM bookings 
                WHERE forwarder_id = $1 
                  AND freight_rate_usd > 0
                  AND status NOT IN ('CANCELLED')
            `, [forwarder.id]);

            // Compare against overall average
            const { rows: marketData } = await pool.query(`
                SELECT AVG(freight_rate_usd) as market_avg
                FROM bookings 
                WHERE freight_rate_usd > 0 AND status NOT IN ('CANCELLED')
            `);

            const vendorAvg = parseFloat(costData[0]?.avg_rate) || 0;
            const marketAvg = parseFloat(marketData[0]?.market_avg) || 0;
            // Cost score: lower is better, scale 0-100 (100 = cheapest)
            const costScore = marketAvg > 0
                ? Math.min(100, Math.max(0, (1 - (vendorAvg - marketAvg) / marketAvg) * 50 + 50))
                : 50;

            // Doc accuracy: % of shipments with all required docs (simplified)
            const { rows: docData } = await pool.query(`
                SELECT 
                    COUNT(DISTINCT s.id) as total_shipments,
                    COUNT(DISTINCT CASE 
                        WHEN d.id IS NOT NULL THEN s.id 
                    END) as shipments_with_docs
                FROM bookings b
                JOIN shipments s ON b.shipment_id = s.id
                LEFT JOIN documents d ON d.shipment_id = s.id AND d.deleted_at IS NULL
                WHERE b.forwarder_id = $1 
                  AND b.status NOT IN ('CANCELLED', 'PENDING')
            `, [forwarder.id]);

            const totalShipments = parseInt(docData[0]?.total_shipments) || 0;
            const shipmentsWithDocs = parseInt(docData[0]?.shipments_with_docs) || 0;
            const docAccuracy = totalShipments > 0 ? (shipmentsWithDocs / totalShipments * 100) : 0;

            // Determine grade based on composite score
            const compositeScore = (onTimeRate * 0.4 + docAccuracy * 0.3 + costScore * 0.3);
            let grade = 'C';
            if (compositeScore >= 80) grade = 'A';
            else if (compositeScore >= 60) grade = 'B';
            else if (compositeScore >= 40) grade = 'C';
            else grade = 'D';

            // Update forwarder record
            await pool.query(`
                UPDATE forwarders 
                SET on_time_rate = $1,
                    doc_accuracy_rate = $2,
                    cost_score = $3,
                    grade = $4
                WHERE id = $5
            `, [
                onTimeRate.toFixed(2),
                docAccuracy.toFixed(2),
                costScore.toFixed(2),
                grade,
                forwarder.id
            ]);

            if (totalBookings > 0) {
                console.log(`   📊 ${forwarder.company_name}: Grade=${grade}, OnTime=${onTimeRate.toFixed(1)}%, Docs=${docAccuracy.toFixed(1)}%, Cost=${costScore.toFixed(1)}`);
            }
        }

        console.log('✅ Vendor performance update complete\n');
    } catch (error) {
        console.error('❌ Error updating vendor performance:', error);
    }
}

module.exports = { updateVendorPerformance };
