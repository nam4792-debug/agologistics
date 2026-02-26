/**
 * Rich Sample Data Seed — designed to populate Analytics, Risk, and Report pages
 * with impressive, realistic data for leadership presentation.
 * Run via: curl -X POST https://logispro-api.onrender.com/api/seed/rich-data
 */

const express = require('express');
const router = express.Router();
const pool = require('./src/config/database');

// This is a standalone script — we'll add the route to seed.js instead
// Usage: node server/seed-rich-data.js (connects directly to DB)

async function seedRichData() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get admin user
        const adminResult = await client.query("SELECT id FROM users WHERE email = 'admin@logispro.vn'");
        if (adminResult.rows.length === 0) {
            throw new Error('Admin user not found. Run /api/seed/init first.');
        }
        const adminId = adminResult.rows[0].id;

        // Get existing customer IDs
        const customerResult = await client.query('SELECT id, company_name FROM customers ORDER BY id');
        let customerIds = customerResult.rows.map(r => r.id);

        // If no customers, create some
        if (customerIds.length === 0) {
            const newCustomers = [
                { code: 'CUST-JP001', name: 'Tokyo Fresh Fruits Co., Ltd', contact: 'Tanaka Yuki', email: 'tanaka@tokyofresh.jp', phone: '+81-3-1234-5678', address: '2-1-1 Tsukiji, Chuo-ku, Tokyo', country: 'Japan' },
                { code: 'CUST-KR001', name: 'Seoul Premium Produce', contact: 'Kim Min-ho', email: 'kimminbo@seoulpremium.kr', phone: '+82-2-345-6789', address: '123 Gangnam-daero, Gangnam-gu, Seoul', country: 'South Korea' },
                { code: 'CUST-SG001', name: 'Singapore Fresh Market Pte Ltd', contact: 'Lim Wei Ming', email: 'weiming@sgfresh.sg', phone: '+65-6234-5678', address: '1 Pasir Panjang Rd, Singapore', country: 'Singapore' },
                { code: 'CUST-NL001', name: 'Holland Fresh Import BV', contact: 'Jan de Vries', email: 'j.devries@hollandfresh.nl', phone: '+31-10-234-5678', address: 'Spaanse Polder 12, Rotterdam', country: 'Netherlands' },
                { code: 'CUST-US001', name: 'California Exotic Fruits Inc.', contact: 'Michael Chen', email: 'mchen@calexotic.com', phone: '+1-213-456-7890', address: '456 Market St, Los Angeles, CA', country: 'USA' },
                { code: 'CUST-AE001', name: 'Dubai Fresh Trading LLC', contact: 'Ahmed Al-Rashid', email: 'ahmed@dubaifresh.ae', phone: '+971-4-345-6789', address: 'Al Aweer Central Market, Dubai', country: 'UAE' },
                { code: 'CUST-AU001', name: 'Melbourne Tropical Imports Pty', contact: 'Sarah Thompson', email: 'sarah@meltropical.com.au', phone: '+61-3-9876-5432', address: '22 Market Lane, Melbourne VIC', country: 'Australia' },
                { code: 'CUST-CN001', name: 'Guangzhou Fruit Trading Co.', contact: 'Wang Lei', email: 'wanglei@gzfruit.cn', phone: '+86-20-8765-4321', address: 'Jiangnan Fruit Market, Guangzhou', country: 'China' },
            ];
            for (const c of newCustomers) {
                const res = await client.query(
                    `INSERT INTO customers (customer_code, company_name, contact_name, email, phone, address, country, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT (customer_code) DO UPDATE SET company_name = EXCLUDED.company_name
                     RETURNING id`,
                    [c.code, c.name, c.contact, c.email, c.phone, c.address, c.country, adminId]
                );
                customerIds.push(res.rows[0].id);
            }
        }

        // Get existing forwarder IDs
        const fwdResult = await client.query('SELECT id, company_name FROM forwarders ORDER BY id');
        let forwarderIds = fwdResult.rows.map(r => r.id);

        if (forwarderIds.length === 0) {
            const forwarders = [
                { name: 'Vinalink Logistics JSC', code: 'FWD-VINALINK', contact: 'Nguyen Van Thanh', email: 'thanh@vinalink.com.vn', phone: '+84-28-3822-1234', address: '28 Le Duan, D.1, HCMC', grade: 'A', onTime: 95.0, docAcc: 98.0, cost: 85.0 },
                { name: 'Gemadept Shipping', code: 'FWD-GEMADEPT', contact: 'Tran Minh Duc', email: 'duc.tm@gemadept.com.vn', phone: '+84-28-3823-5678', address: '6 Le Thanh Ton, D.1, HCMC', grade: 'B', onTime: 88.0, docAcc: 90.0, cost: 90.0 },
                { name: 'Bee Logistics Corp', code: 'FWD-BEE', contact: 'Le Hoang Nam', email: 'nam@beelogistics.com', phone: '+84-28-3825-9999', address: '123 Nguyen Hue, D.1, HCMC', grade: 'A', onTime: 92.0, docAcc: 95.0, cost: 82.0 },
            ];
            for (const f of forwarders) {
                const res = await client.query(
                    `INSERT INTO forwarders (company_name, provider_code, contact_name, email, phone, address, grade, on_time_rate, doc_accuracy_rate, cost_score, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                     ON CONFLICT (provider_code) DO UPDATE SET company_name = EXCLUDED.company_name
                     RETURNING id`,
                    [f.name, f.code, f.contact, f.email, f.phone, f.address, f.grade, f.onTime, f.docAcc, f.cost, adminId]
                );
                forwarderIds.push(res.rows[0].id);
            }
        }

        // Helper
        const today = new Date();
        const addDays = (d, days) => { const r = new Date(d); r.setDate(r.getDate() + days); return r; };
        const subtractDays = (d, days) => addDays(d, -days);
        const fmt = (d) => d.toISOString().split('T')[0];
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        const ports = [
            { origin: 'Cat Lai, HCMC', dest: 'Tokyo Port', country: 'Japan' },
            { origin: 'Cat Lai, HCMC', dest: 'Busan Port', country: 'South Korea' },
            { origin: 'Cat Lai, HCMC', dest: 'Singapore PSA', country: 'Singapore' },
            { origin: 'Cat Lai, HCMC', dest: 'Rotterdam Europoort', country: 'Netherlands' },
            { origin: 'Tan Son Nhat, HCMC', dest: 'Los Angeles LAX', country: 'USA' },
            { origin: 'Tan Son Nhat, HCMC', dest: 'Dubai DWC', country: 'UAE' },
            { origin: 'Cat Lai, HCMC', dest: 'Melbourne Port', country: 'Australia' },
            { origin: 'Hai Phong Port', dest: 'Guangzhou Nansha', country: 'China' },
        ];

        const vessels = ['EVER GIVEN', 'MSC OSCAR', 'COSCO FORTUNE', 'ONE STORK', 'OOCL HONG KONG', 'CMA CGM MARCO POLO', 'MAERSK HONAM'];
        const flights = ['VN302', 'KE682', 'SQ176', 'EK392', 'JL752', 'TK164', 'QF88'];
        const shippingLines = ['Evergreen', 'MSC', 'COSCO', 'ONE', 'OOCL', 'CMA CGM', 'Maersk'];
        const airlines = ['Vietnam Airlines', 'Korean Air', 'Singapore Airlines', 'Emirates', 'JAL', 'Turkish Airlines', 'Qantas'];
        const containerTypes = ['20RF', '40RF', '40HC'];
        const cargoDescs = [
            'Fresh Dragon Fruit (Hylocereus)',
            'Fresh Rambutan (Nephelium lappaceum)',
            'Fresh Mango (Mangifera indica)',
            'Fresh Passion Fruit (Passiflora edulis)',
            'Fresh Lychee (Litchi chinensis)',
            'Fresh Longan (Dimocarpus longan)',
            'Dried Jackfruit Chips',
            'Fresh Star Fruit (Averrhoa carambola)',
            'Fresh Pomelo (Citrus maxima)',
            'Frozen Durian Puree',
        ];
        const incoterms = ['FOB', 'CFR', 'CIF', 'EXW'];

        // ========================================
        // CREATE 25 SHIPMENTS across 6 months
        // ========================================
        const shipmentStatuses = ['Booked', 'Doc In Progress', 'Ready to Load', 'Loading', 'Customs', 'In Transit', 'Arrived', 'Delivered'];
        const shipmentData = [];

        for (let i = 0; i < 25; i++) {
            const monthOffset = Math.floor(i / 5); // ~5 per month spread across 6 months
            const daysAgo = monthOffset * 30 + Math.floor(Math.random() * 25);
            const createdAt = subtractDays(today, daysAgo);
            const port = ports[i % ports.length];
            const isFCL = Math.random() > 0.3; // 70% FCL, 30% AIR
            const type = isFCL ? 'FCL' : 'AIR';

            // Older shipments more likely to be delivered
            let status;
            if (daysAgo > 120) status = 'Delivered';
            else if (daysAgo > 90) status = pick(['Delivered', 'Arrived']);
            else if (daysAgo > 60) status = pick(['In Transit', 'Arrived', 'Delivered']);
            else if (daysAgo > 30) status = pick(['In Transit', 'Customs', 'Arrived']);
            else status = pick(['Booked', 'Doc In Progress', 'Ready to Load', 'Loading', 'In Transit']);

            const etd = addDays(createdAt, 5 + Math.floor(Math.random() * 10));
            const transitDays = isFCL ? (15 + Math.floor(Math.random() * 20)) : (2 + Math.floor(Math.random() * 5));
            const eta = addDays(etd, transitDays);
            const totalCost = isFCL
                ? (2500 + Math.floor(Math.random() * 4000))
                : (3500 + Math.floor(Math.random() * 6000));
            const weight = isFCL
                ? (5000 + Math.floor(Math.random() * 20000))
                : (500 + Math.floor(Math.random() * 4000));

            const shipNum = `SHP-${String(2025)}-${String(i + 10).padStart(3, '0')}`;
            const customerId = pick(customerIds);
            const forwarderId = pick(forwarderIds);

            const res = await client.query(
                `INSERT INTO shipments (shipment_number, type, status, customer_id, forwarder_id,
                    origin_port, destination_port, destination_country,
                    cargo_description, cargo_weight_kg, incoterm,
                    etd, eta, total_cost_usd, created_by, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                 ON CONFLICT (shipment_number) DO UPDATE SET status = EXCLUDED.status
                 RETURNING id`,
                [shipNum, type, status, customerId, forwarderId,
                    port.origin, port.dest, port.country,
                    pick(cargoDescs), weight, pick(incoterms),
                    fmt(etd), fmt(eta), totalCost, adminId, fmt(createdAt)]
            );
            shipmentData.push({ id: res.rows[0].id, type, shipNum, createdAt, etd, customerId, forwarderId });
        }

        // ========================================
        // CREATE 35 BOOKINGS across 6 months with varied statuses
        // ========================================
        const bookingStatuses = ['PENDING', 'CONFIRMED', 'ALLOCATED', 'USED', 'CANCELLED'];
        const bookingData = [];

        for (let i = 0; i < 35; i++) {
            const monthOffset = Math.floor(i / 6); // ~6 per month
            const daysAgo = monthOffset * 30 + Math.floor(Math.random() * 28);
            const createdAt = subtractDays(today, daysAgo);
            const isFCL = Math.random() > 0.3;
            const type = isFCL ? 'FCL' : 'AIR';
            const port = ports[i % ports.length];

            // Status distribution — older = more completed/used
            let status;
            if (daysAgo > 120) status = pick(['USED', 'USED', 'CANCELLED']);
            else if (daysAgo > 60) status = pick(['CONFIRMED', 'ALLOCATED', 'USED', 'CANCELLED']);
            else if (daysAgo > 30) status = pick(['CONFIRMED', 'ALLOCATED', 'PENDING']);
            else status = pick(['PENDING', 'PENDING', 'CONFIRMED', 'ALLOCATED']);

            const etd = addDays(createdAt, 7 + Math.floor(Math.random() * 14));
            const transitDays = isFCL ? (15 + Math.floor(Math.random() * 20)) : (2 + Math.floor(Math.random() * 5));
            const eta = addDays(etd, transitDays);
            const freightRate = isFCL
                ? (1800 + Math.floor(Math.random() * 3200))
                : (2500 + Math.floor(Math.random() * 5000));

            // Cut-off dates relative to ETD
            const cutOffSI = subtractDays(etd, 5 + Math.floor(Math.random() * 3));
            const cutOffVGM = subtractDays(etd, 3 + Math.floor(Math.random() * 2));
            const cutOffCargo = subtractDays(etd, 2 + Math.floor(Math.random() * 2));

            const bookNum = `BK-${type === 'FCL' ? 'FCL' : 'AIR'}-${String(i + 20).padStart(3, '0')}`;
            const forwarderId = pick(forwarderIds);

            // Link some bookings to shipments
            const shipment = (status === 'ALLOCATED' || status === 'USED') && shipmentData.length > 0
                ? pick(shipmentData)
                : null;

            const res = await client.query(
                `INSERT INTO bookings (booking_number, type, status, forwarder_id,
                    origin_port, destination_port, vessel_flight, voyage_number,
                    shipping_line, container_type, container_count,
                    freight_rate_usd, etd, eta,
                    cut_off_si, cut_off_vgm, cut_off_cargo,
                    shipment_id, created_by, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                 ON CONFLICT (booking_number) DO UPDATE SET status = EXCLUDED.status
                 RETURNING id`,
                [bookNum, type, status, forwarderId,
                    port.origin, port.dest,
                    isFCL ? pick(vessels) : pick(flights),
                    isFCL ? `V${100 + i}E` : null,
                    isFCL ? pick(shippingLines) : pick(airlines),
                    isFCL ? pick(containerTypes) : null,
                    isFCL ? (1 + Math.floor(Math.random() * 3)) : (10 + Math.floor(Math.random() * 50)),
                    freightRate, fmt(etd), fmt(eta),
                    fmt(cutOffSI), fmt(cutOffVGM), fmt(cutOffCargo),
                    shipment ? shipment.id : null, adminId, fmt(createdAt)]
            );
            bookingData.push({ id: res.rows[0].id, bookNum, status });
        }

        // Add 5 URGENT bookings with deadlines TODAY/TOMORROW/NEXT 3 DAYS for Risk page
        const urgentBookings = [
            { suffix: 'URG01', etdOffset: 1, siOffset: 0, status: 'CONFIRMED', label: 'SI cut-off TODAY' },
            { suffix: 'URG02', etdOffset: 2, siOffset: -1, status: 'CONFIRMED', label: 'SI cut-off OVERDUE' },
            { suffix: 'URG03', etdOffset: 3, siOffset: 1, status: 'PENDING', label: 'VGM tomorrow' },
            { suffix: 'URG04', etdOffset: 4, siOffset: 2, status: 'ALLOCATED', label: 'Cargo in 2 days' },
            { suffix: 'URG05', etdOffset: 6, siOffset: 3, status: 'CONFIRMED', label: 'SI in 3 days' },
        ];
        for (const ub of urgentBookings) {
            const port = pick(ports);
            const etd = addDays(today, ub.etdOffset);
            const bookNum = `BK-FCL-${ub.suffix}`;
            await client.query(
                `INSERT INTO bookings (booking_number, type, status, forwarder_id,
                    origin_port, destination_port, vessel_flight, voyage_number,
                    shipping_line, container_type, container_count,
                    freight_rate_usd, etd, eta,
                    cut_off_si, cut_off_vgm, cut_off_cargo,
                    created_by, created_at)
                 VALUES ($1, 'FCL', $2, $3, $4, $5, $6, $7, $8, '40RF', 2,
                    $9, $10, $11, $12, $13, $14, $15, $16)
                 ON CONFLICT (booking_number) DO UPDATE SET
                    status = EXCLUDED.status, etd = EXCLUDED.etd, eta = EXCLUDED.eta,
                    cut_off_si = EXCLUDED.cut_off_si, cut_off_vgm = EXCLUDED.cut_off_vgm, cut_off_cargo = EXCLUDED.cut_off_cargo`,
                [bookNum, ub.status, pick(forwarderIds),
                    port.origin, port.dest,
                    pick(vessels), `V-URG${ub.etdOffset}`,
                    pick(shippingLines),
                    2800 + Math.floor(Math.random() * 2000),
                    fmt(etd), fmt(addDays(etd, 20)),
                    fmt(addDays(today, ub.siOffset)),           // SI cut-off
                    fmt(addDays(today, ub.siOffset + 1)),       // VGM cut-off
                    fmt(addDays(today, ub.siOffset + 2)),       // Cargo cut-off
                    adminId, fmt(subtractDays(today, 5))]
            );
        }

        // ========================================
        // CREATE 20 INVOICES across 6 months
        // ========================================
        const invoiceCategories = ['Freight', 'Terminal Handling', 'Customs Clearance', 'Insurance', 'Documentation', 'Trucking'];
        const invoiceStatuses = ['PAID', 'PENDING', 'OVERDUE'];

        for (let i = 0; i < 20; i++) {
            const monthOffset = Math.floor(i / 4); // ~4 per month
            const daysAgo = monthOffset * 30 + Math.floor(Math.random() * 25);
            const createdAt = subtractDays(today, daysAgo);
            const category = pick(invoiceCategories);

            let amount;
            if (category === 'Freight') amount = 2000 + Math.floor(Math.random() * 5000);
            else if (category === 'Terminal Handling') amount = 300 + Math.floor(Math.random() * 700);
            else if (category === 'Customs Clearance') amount = 200 + Math.floor(Math.random() * 500);
            else if (category === 'Insurance') amount = 100 + Math.floor(Math.random() * 300);
            else if (category === 'Trucking') amount = 400 + Math.floor(Math.random() * 600);
            else amount = 50 + Math.floor(Math.random() * 200);

            // Older invoices more likely paid
            let status;
            if (daysAgo > 90) status = 'PAID';
            else if (daysAgo > 60) status = pick(['PAID', 'PAID', 'OVERDUE']);
            else if (daysAgo > 30) status = pick(['PAID', 'PENDING', 'OVERDUE']);
            else status = pick(['PENDING', 'PENDING', 'PAID']);

            const shipment = shipmentData.length > 0 ? pick(shipmentData) : null;
            const invoiceNum = `INV-${String(2025)}-${String(i + 20).padStart(3, '0')}`;

            await client.query(
                `INSERT INTO invoices (invoice_number, shipment_id, vendor_name, category,
                    amount_usd, status, due_date, notes, created_by, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (invoice_number) DO UPDATE SET amount_usd = EXCLUDED.amount_usd`,
                [invoiceNum, shipment?.id || null,
                    pick(['Vinalink Logistics JSC', 'Gemadept Shipping', 'Bee Logistics Corp', 'Cat Lai Terminal', 'TBS Customs Broker']),
                    category, amount, status,
                    fmt(addDays(createdAt, 30)), // Due 30 days after creation
                    `${category} charges for export shipment`,
                    adminId, fmt(createdAt)]
            );
        }

        // ========================================
        // CREATE 15 DOCUMENTS for shipments
        // ========================================
        const docTypes = ['Bill of Lading', 'Commercial Invoice', 'Packing List', 'Certificate of Origin', 'Phytosanitary Certificate', 'Fumigation Certificate'];
        const docStatuses = ['VALIDATED', 'PENDING', 'REJECTED'];

        for (let i = 0; i < 15; i++) {
            const shipment = shipmentData.length > 0 ? pick(shipmentData) : null;
            if (!shipment) continue;

            const docType = docTypes[i % docTypes.length];
            const docNum = `DOC-${String(i + 20).padStart(3, '0')}`;

            // Older docs more likely validated
            const status = Math.random() > 0.3 ? 'VALIDATED' : pick(['PENDING', 'REJECTED']);

            await client.query(
                `INSERT INTO documents (document_number, shipment_id, type, status, file_name, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (document_number) DO NOTHING`,
                [docNum, shipment.id, docType, status, `${docType.toLowerCase().replace(/ /g, '_')}_${shipment.shipNum}.pdf`, adminId]
            );
        }

        // ========================================
        // CREATE NOTIFICATIONS for Risk page
        // ========================================
        const notifTypes = [
            { type: 'DEADLINE_WARNING', title: '⏰ SI Cut-off approaching for BK-FCL-URG01', message: 'SI submission deadline is TODAY. Please submit shipping instructions immediately.' },
            { type: 'DEADLINE_CRITICAL', title: '🔴 VGM cut-off OVERDUE for BK-FCL-URG02', message: 'VGM submission deadline has passed. Contact shipping line for extension.' },
            { type: 'DOCUMENT_ISSUE', title: '📋 Phytosanitary Certificate rejected for SHP-2025-010', message: 'Certificate rejected by customs. Please resubmit with corrected details.' },
            { type: 'SHIPMENT_DELAYED', title: '🚢 Vessel delay: EVER GIVEN ETA pushed by 3 days', message: 'Port congestion at destination causing delays. New ETA updated.' },
            { type: 'COST_ALERT', title: '💰 Invoice INV-2025-022 overdue by 15 days', message: 'Freight invoice from Vinalink Logistics is overdue. Please arrange payment.' },
            { type: 'QUALITY_ALERT', title: '🍎 Temperature alert: Container CAIU2345678', message: 'Temperature reading 4.2°C exceeds threshold (2°C) for dragon fruit shipment.' },
            { type: 'COMPLIANCE', title: '📜 Export license expiring for Japan market', message: 'Phytosanitary export license expires in 7 days. Renewal required.' },
            { type: 'BOOKING_CONFIRMED', title: '✅ Booking BK-FCL-025 confirmed by Maersk', message: 'Container allocation confirmed. Vessel: MSC OSCAR, ETD: next week.' },
        ];

        for (const notif of notifTypes) {
            await client.query(
                `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
                 VALUES ($1, $2, $3, $4, false, $5)`,
                [adminId, notif.type, notif.title, notif.message, fmt(subtractDays(today, Math.floor(Math.random() * 5)))]
            );
        }

        // ========================================
        // CREATE TASKS for workflow
        // ========================================
        const taskData = [
            { title: 'Submit SI for BK-FCL-URG01', status: 'PENDING', priority: 'HIGH', dueOffset: 0 },
            { title: 'Arrange VGM weighing for BK-FCL-URG03', status: 'PENDING', priority: 'MEDIUM', dueOffset: 1 },
            { title: 'Prepare Phytosanitary Certificate', status: 'IN_PROGRESS', priority: 'HIGH', dueOffset: 2 },
            { title: 'Book trucking for cargo delivery', status: 'PENDING', priority: 'MEDIUM', dueOffset: 3 },
            { title: 'Submit Customs Declaration', status: 'COMPLETED', priority: 'HIGH', dueOffset: -2 },
            { title: 'Verify Bill of Lading draft', status: 'IN_PROGRESS', priority: 'HIGH', dueOffset: 1 },
            { title: 'Confirm loading schedule with terminal', status: 'PENDING', priority: 'MEDIUM', dueOffset: 2 },
            { title: 'Review Commercial Invoice for accuracy', status: 'COMPLETED', priority: 'LOW', dueOffset: -5 },
            { title: 'Arrange insurance for high-value cargo', status: 'PENDING', priority: 'HIGH', dueOffset: 4 },
            { title: 'Send arrival notice to consignee', status: 'COMPLETED', priority: 'MEDIUM', dueOffset: -1 },
        ];

        for (const task of taskData) {
            await client.query(
                `INSERT INTO tasks (title, status, priority, due_date, assigned_to, created_by, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [task.title, task.status, task.priority, fmt(addDays(today, task.dueOffset)), adminId, adminId, fmt(subtractDays(today, 3))]
            );
        }

        await client.query('COMMIT');

        return {
            success: true,
            message: 'Rich sample data created successfully',
            summary: {
                customers: customerIds.length,
                forwarders: forwarderIds.length,
                shipments: shipmentData.length,
                bookings: bookingData.length + urgentBookings.length,
                invoices: 20,
                documents: 15,
                notifications: notifTypes.length,
                tasks: taskData.length,
                urgentBookings: urgentBookings.length,
            }
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { seedRichData };
