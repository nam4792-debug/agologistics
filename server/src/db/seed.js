const pool = require('../config/database');
const { v4: uuid } = require('uuid');

async function seedDatabase() {
    console.log('🌱 Seeding database with sample data...\n');

    try {
        // Get user IDs
        const { rows: users } = await pool.query('SELECT id, email FROM users LIMIT 1');
        const userId = users[0]?.id;

        // Get forwarder IDs
        const { rows: forwarders } = await pool.query('SELECT id FROM forwarders LIMIT 1');
        const forwarderId = forwarders[0]?.id;

        // Get customer IDs
        const { rows: customers } = await pool.query('SELECT id FROM customers LIMIT 1');
        const customerId = customers[0]?.id;

        if (!userId || !forwarderId || !customerId) {
            console.log('⚠️ Please run db:init first to create base data');
            process.exit(1);
        }

        // Create sample shipments
        const shipmentData = [
            {
                shipment_number: 'A59FX15608',
                type: 'FCL',
                status: 'IN_TRANSIT',
                origin_port: 'Ho Chi Minh City',
                destination_port: 'Chennai',
                origin_country: 'Vietnam',
                destination_country: 'India',
                cargo_description: 'Fresh Dragon Fruit',
                cargo_weight_kg: 18500,
                container_count: 1,
                container_type: '40RF',
                incoterm: 'CIF',
                etd: new Date('2026-02-05'),
                eta: new Date('2026-02-12'),
            },
            {
                shipment_number: 'A59FX15609',
                type: 'FCL',
                status: 'CUSTOMS_CLEARED',
                origin_port: 'Ho Chi Minh City',
                destination_port: 'Tokyo',
                origin_country: 'Vietnam',
                destination_country: 'Japan',
                cargo_description: 'Fresh Mango',
                cargo_weight_kg: 22000,
                container_count: 1,
                container_type: '40RF',
                incoterm: 'FOB',
                etd: new Date('2026-02-01'),
                eta: new Date('2026-02-05'),
            },
            {
                shipment_number: 'A59FX15610',
                type: 'FCL',
                status: 'LOADING',
                origin_port: 'Ho Chi Minh City',
                destination_port: 'Shanghai',
                origin_country: 'Vietnam',
                destination_country: 'China',
                cargo_description: 'Agricultural Products',
                cargo_weight_kg: 24000,
                container_count: 2,
                container_type: '40RF',
                incoterm: 'CFR',
                etd: new Date('2026-02-02'),
                eta: new Date('2026-02-08'),
            },
        ];

        for (const shipment of shipmentData) {
            await pool.query(
                `INSERT INTO shipments 
         (shipment_number, type, status, customer_id, forwarder_id,
          origin_port, destination_port, origin_country, destination_country,
          cargo_description, cargo_weight_kg, container_count, container_type,
          incoterm, etd, eta, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (shipment_number) DO NOTHING`,
                [
                    shipment.shipment_number,
                    shipment.type,
                    shipment.status,
                    customerId,
                    forwarderId,
                    shipment.origin_port,
                    shipment.destination_port,
                    shipment.origin_country,
                    shipment.destination_country,
                    shipment.cargo_description,
                    shipment.cargo_weight_kg,
                    shipment.container_count,
                    shipment.container_type,
                    shipment.incoterm,
                    shipment.etd,
                    shipment.eta,
                    userId,
                ]
            );
        }

        console.log('✅ Shipments created');

        // Get shipment ID for bookings
        const { rows: shipments } = await pool.query(
            "SELECT id FROM shipments WHERE shipment_number = 'A59FX15608'"
        );
        const shipmentId = shipments[0]?.id;

        // Create sample bookings with deadlines
        const now = new Date();
        const bookingData = [
            {
                booking_number: 'BK-2026-0145',
                type: 'FCL',
                status: 'PENDING',
                vessel_flight: 'COSCO SHIPPING TAURUS',
                voyage_number: 'V.2608W',
                route: 'Ho Chi Minh → Chennai',
                origin_port: 'Ho Chi Minh City',
                destination_port: 'Chennai',
                container_type: '40RF',
                container_count: 1,
                etd: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
                eta: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
                freight_rate_usd: 2850,
                // Deadlines - 2 days from now (for testing alerts)
                cut_off_si: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
                cut_off_vgm: new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000),
                cut_off_cy: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
            },
            {
                booking_number: 'BK-2026-0146',
                type: 'FCL',
                status: 'PENDING',
                vessel_flight: 'EVERGREEN EVER GIVEN',
                voyage_number: 'V.2609E',
                route: 'Ho Chi Minh → Tokyo',
                origin_port: 'Ho Chi Minh City',
                destination_port: 'Tokyo',
                container_type: '40RF',
                container_count: 1,
                etd: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
                eta: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
                freight_rate_usd: 3200,
                // Deadlines - 10 hours from now (for urgent alert testing)
                cut_off_si: new Date(now.getTime() + 10 * 60 * 60 * 1000),
                cut_off_vgm: new Date(now.getTime() + 12 * 60 * 60 * 1000),
                cut_off_cy: new Date(now.getTime() + 18 * 60 * 60 * 1000),
            },
        ];

        for (const booking of bookingData) {
            const { rows: bookingRows } = await pool.query(
                `INSERT INTO bookings 
         (booking_number, shipment_id, forwarder_id, type, status,
          vessel_flight, voyage_number, route, origin_port, destination_port,
          container_type, container_count, etd, eta, freight_rate_usd, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (booking_number) DO NOTHING
         RETURNING id`,
                [
                    booking.booking_number,
                    shipmentId,
                    forwarderId,
                    booking.type,
                    booking.status,
                    booking.vessel_flight,
                    booking.voyage_number,
                    booking.route,
                    booking.origin_port,
                    booking.destination_port,
                    booking.container_type,
                    booking.container_count,
                    booking.etd,
                    booking.eta,
                    booking.freight_rate_usd,
                    userId,
                ]
            );

            if (bookingRows.length > 0) {
                // Create deadlines for booking
                await pool.query(
                    `INSERT INTO booking_deadlines 
           (booking_id, cut_off_si, cut_off_vgm, cut_off_cy)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
                    [
                        bookingRows[0].id,
                        booking.cut_off_si,
                        booking.cut_off_vgm,
                        booking.cut_off_cy,
                    ]
                );
            }
        }

        console.log('✅ Bookings with deadlines created');

        // Create sample alerts
        await pool.query(
            `INSERT INTO alerts (shipment_id, type, severity, title, description)
       VALUES 
         ($1, 'DOCUMENT_MISSING', 'HIGH', 'Missing Phytosanitary Certificate', 'Shipment requires phytosanitary certificate for fresh produce'),
         ($1, 'DEADLINE_APPROACHING', 'MEDIUM', 'SI Cut-off in 48h', 'Shipping instruction deadline approaching')
       ON CONFLICT DO NOTHING`,
            [shipmentId]
        );

        console.log('✅ Sample alerts created');

        console.log('\n🎉 Database seeding complete!\n');
        console.log('📊 Sample data created:');
        console.log('   - 3 shipments');
        console.log('   - 2 bookings with deadlines');
        console.log('   - 2 alerts\n');
        console.log('💡 Tip: Run the server to test deadline monitoring!');
        console.log('   The second booking has deadlines ~10 hours away for testing.\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seedDatabase();
