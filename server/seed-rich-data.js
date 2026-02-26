/**
 * Rich Sample Data Seed — Analytics, Risk, Reports
 * Creates 6 months of data for leadership presentation.
 */

const pool = require('./src/config/database');

async function seedRichData() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const adminResult = await client.query("SELECT id FROM users WHERE email = 'admin@logispro.vn'");
        if (adminResult.rows.length === 0) throw new Error('Admin not found. Run /api/seed/init first.');
        const adminId = adminResult.rows[0].id;

        // Unique suffix to avoid conflicts
        const ts = Date.now().toString(36).substring(2, 6);

        // Get or create customers
        let customerResult = await client.query('SELECT id FROM customers ORDER BY created_at');
        let customerIds = customerResult.rows.map(r => r.id);
        if (customerIds.length === 0) {
            const custs = [
                ['CUST-' + ts + '1', 'Tokyo Fresh Fruits Co.', 'Tanaka Yuki', 'tanaka@tokyofresh.jp', '+81-3-1234', 'Tokyo', 'Japan'],
                ['CUST-' + ts + '2', 'Seoul Premium Produce', 'Kim Min-ho', 'kim@seoul.kr', '+82-2-345', 'Seoul', 'South Korea'],
                ['CUST-' + ts + '3', 'Singapore Fresh Market', 'Lim Wei', 'lim@sg.sg', '+65-6234', 'Singapore', 'Singapore'],
                ['CUST-' + ts + '4', 'Holland Fresh Import BV', 'Jan de Vries', 'jan@hfi.nl', '+31-10-234', 'Rotterdam', 'Netherlands'],
                ['CUST-' + ts + '5', 'California Exotic Fruits', 'Michael Chen', 'mc@cal.com', '+1-213-456', 'LA', 'USA'],
                ['CUST-' + ts + '6', 'Dubai Fresh Trading', 'Ahmed', 'ahmed@dft.ae', '+971-4-345', 'Dubai', 'UAE'],
                ['CUST-' + ts + '7', 'Melbourne Tropical Imports', 'Sarah', 'sarah@mti.au', '+61-3-987', 'Melbourne', 'Australia'],
                ['CUST-' + ts + '8', 'Guangzhou Fruit Trading', 'Wang Lei', 'wang@gzf.cn', '+86-20-876', 'Guangzhou', 'China'],
            ];
            for (const [code, name, contact, email, phone, addr, country] of custs) {
                const r = await client.query(
                    `INSERT INTO customers (customer_code, company_name, contact_name, email, phone, address, country) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                    [code, name, contact, email, phone, addr, country]
                );
                customerIds.push(r.rows[0].id);
            }
        }

        // Get or create forwarders
        let fwdResult = await client.query('SELECT id FROM forwarders ORDER BY created_at');
        let forwarderIds = fwdResult.rows.map(r => r.id);
        if (forwarderIds.length === 0) {
            const fwds = [
                ['Vinalink Logistics', 'FWD-' + ts + '1', 'Nguyen Van Thanh', 'A', 95, 98, 85],
                ['Gemadept Shipping', 'FWD-' + ts + '2', 'Tran Minh Duc', 'B', 88, 90, 90],
                ['Bee Logistics Corp', 'FWD-' + ts + '3', 'Le Hoang Nam', 'A', 92, 95, 82],
            ];
            for (const [name, code, contact, grade, onTime, docAcc, cost] of fwds) {
                const r = await client.query(
                    `INSERT INTO forwarders (company_name, provider_code, contact_name, grade, on_time_rate, doc_accuracy_rate, cost_score) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                    [name, code, contact, grade, onTime, docAcc, cost]
                );
                forwarderIds.push(r.rows[0].id);
            }
        }

        // Helpers
        const today = new Date();
        const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
        const subDays = (d, n) => addDays(d, -n);
        const fmt = (d) => d.toISOString().split('T')[0];
        const fmtTs = (d) => d.toISOString().replace('T', ' ').substring(0, 19);
        const pick = (a) => a[Math.floor(Math.random() * a.length)];

        const ports = [
            { o: 'Cat Lai, HCMC', d: 'Tokyo Port', c: 'Japan' },
            { o: 'Cat Lai, HCMC', d: 'Busan Port', c: 'South Korea' },
            { o: 'Cat Lai, HCMC', d: 'Singapore PSA', c: 'Singapore' },
            { o: 'Cat Lai, HCMC', d: 'Rotterdam Europoort', c: 'Netherlands' },
            { o: 'Tan Son Nhat, HCMC', d: 'Los Angeles LAX', c: 'USA' },
            { o: 'Tan Son Nhat, HCMC', d: 'Dubai DWC', c: 'UAE' },
            { o: 'Cat Lai, HCMC', d: 'Melbourne Port', c: 'Australia' },
            { o: 'Hai Phong Port', d: 'Guangzhou Nansha', c: 'China' },
        ];
        const vessels = ['EVER GIVEN', 'MSC OSCAR', 'COSCO FORTUNE', 'ONE STORK', 'OOCL HONG KONG', 'CMA CGM MARCO POLO', 'MAERSK HONAM'];
        const flights = ['VN302', 'KE682', 'SQ176', 'EK392', 'JL752', 'TK164', 'QF88'];
        const shippingLines = ['Evergreen', 'MSC', 'COSCO', 'ONE', 'OOCL', 'CMA CGM', 'Maersk'];
        const airlines = ['Vietnam Airlines', 'Korean Air', 'Singapore Airlines', 'Emirates', 'JAL', 'Turkish Airlines'];
        const containerTypes = ['20RF', '40RF', '40HC'];
        const cargos = ['Fresh Dragon Fruit', 'Fresh Rambutan', 'Fresh Mango', 'Fresh Passion Fruit', 'Fresh Lychee', 'Fresh Longan', 'Dried Jackfruit', 'Fresh Pomelo', 'Frozen Durian'];
        const incoterms = ['FOB', 'CFR', 'CIF', 'EXW'];
        const vendorNames = ['Vinalink Logistics', 'Gemadept Shipping', 'Bee Logistics', 'Cat Lai Terminal', 'TBS Customs Broker'];

        // ══════════════════════════════════════
        // 25 SHIPMENTS (6 months)
        // ══════════════════════════════════════
        const shipmentIds = [];
        for (let i = 0; i < 25; i++) {
            const daysAgo = Math.floor(i / 5) * 30 + Math.floor(Math.random() * 25);
            const created = subDays(today, daysAgo);
            const port = ports[i % ports.length];
            const isFCL = Math.random() > 0.3;
            const type = isFCL ? 'FCL' : 'AIR';

            let status;
            if (daysAgo > 120) status = 'Delivered';
            else if (daysAgo > 90) status = pick(['Delivered', 'Arrived']);
            else if (daysAgo > 60) status = pick(['In Transit', 'Arrived', 'Delivered']);
            else if (daysAgo > 30) status = pick(['In Transit', 'Customs', 'Arrived']);
            else status = pick(['Booked', 'Doc In Progress', 'Ready to Load', 'In Transit']);

            const etd = addDays(created, 5 + Math.floor(Math.random() * 10));
            const eta = addDays(etd, isFCL ? 15 + Math.floor(Math.random() * 20) : 2 + Math.floor(Math.random() * 5));
            const cost = isFCL ? 2500 + Math.floor(Math.random() * 4000) : 3500 + Math.floor(Math.random() * 6000);
            const weight = isFCL ? 5000 + Math.floor(Math.random() * 20000) : 500 + Math.floor(Math.random() * 4000);

            const r = await client.query(
                `INSERT INTO shipments (shipment_number, type, status, customer_id, forwarder_id,
                    origin_port, destination_port, destination_country,
                    cargo_description, cargo_weight_kg, incoterm,
                    etd, eta, total_cost_usd, created_by, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
                [`SHP-${ts}-${String(i + 1).padStart(3, '0')}`, type, status, pick(customerIds), pick(forwarderIds),
                port.o, port.d, port.c, pick(cargos), weight, pick(incoterms),
                fmt(etd), fmt(eta), cost, adminId, fmtTs(created)]
            );
            shipmentIds.push(r.rows[0].id);
        }

        // ══════════════════════════════════════
        // 35 BOOKINGS (6 months) + 5 URGENT
        // ══════════════════════════════════════
        const bookingIds = [];
        for (let i = 0; i < 35; i++) {
            const daysAgo = Math.floor(i / 6) * 30 + Math.floor(Math.random() * 28);
            const created = subDays(today, daysAgo);
            const isFCL = Math.random() > 0.3;
            const type = isFCL ? 'FCL' : 'AIR';
            const port = ports[i % ports.length];

            let status;
            if (daysAgo > 120) status = pick(['USED', 'USED', 'CANCELLED']);
            else if (daysAgo > 60) status = pick(['CONFIRMED', 'ALLOCATED', 'USED', 'CANCELLED']);
            else if (daysAgo > 30) status = pick(['CONFIRMED', 'ALLOCATED', 'PENDING']);
            else status = pick(['PENDING', 'PENDING', 'CONFIRMED', 'ALLOCATED']);

            const etd = addDays(created, 7 + Math.floor(Math.random() * 14));
            const eta = addDays(etd, isFCL ? 15 + Math.floor(Math.random() * 20) : 2 + Math.floor(Math.random() * 5));
            const freight = isFCL ? 1800 + Math.floor(Math.random() * 3200) : 2500 + Math.floor(Math.random() * 5000);
            const shipId = (status === 'ALLOCATED' || status === 'USED') ? pick(shipmentIds) : null;

            const r = await client.query(
                `INSERT INTO bookings (booking_number, type, status, forwarder_id,
                    origin_port, destination_port, vessel_flight, voyage_number,
                    shipping_line, container_type, container_count,
                    freight_rate_usd, etd, eta, shipment_id, created_by, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
                [`BK-${ts}-${type[0]}${String(i + 1).padStart(3, '0')}`, type, status, pick(forwarderIds),
                port.o, port.d, isFCL ? pick(vessels) : pick(flights), isFCL ? `V${100 + i}E` : null,
                isFCL ? pick(shippingLines) : pick(airlines), isFCL ? pick(containerTypes) : null,
                isFCL ? 1 + Math.floor(Math.random() * 3) : 10 + Math.floor(Math.random() * 50),
                    freight, fmt(etd), fmt(eta), shipId, adminId, fmtTs(created)]
            );
            const bId = r.rows[0].id;
            bookingIds.push(bId);

            // Deadlines
            if (status !== 'CANCELLED' && status !== 'USED') {
                await client.query(
                    `INSERT INTO booking_deadlines (booking_id, cut_off_si, cut_off_vgm, cut_off_cy)
                     VALUES ($1, $2, $3, $4)`,
                    [bId, fmtTs(subDays(etd, 5 + Math.floor(Math.random() * 3))),
                        fmtTs(subDays(etd, 3 + Math.floor(Math.random() * 2))),
                        fmtTs(subDays(etd, 2 + Math.floor(Math.random() * 2)))]
                );
            }
        }

        // 5 URGENT bookings → Risk page
        const urgents = [
            { off: 1, si: 0 }, { off: 2, si: -1 }, { off: 3, si: 1 }, { off: 4, si: 2 }, { off: 6, si: 3 }
        ];
        for (let u = 0; u < urgents.length; u++) {
            const ub = urgents[u];
            const port = pick(ports);
            const etd = addDays(today, ub.off);
            const r = await client.query(
                `INSERT INTO bookings (booking_number, type, status, forwarder_id,
                    origin_port, destination_port, vessel_flight, shipping_line,
                    container_type, container_count, freight_rate_usd, etd, eta, created_by, created_at)
                 VALUES ($1,'FCL',$2,$3,$4,$5,$6,$7,'40RF',2,$8,$9,$10,$11,$12) RETURNING id`,
                [`BK-${ts}-U${u + 1}`, pick(['CONFIRMED', 'PENDING', 'ALLOCATED']), pick(forwarderIds),
                port.o, port.d, pick(vessels), pick(shippingLines),
                2800 + Math.floor(Math.random() * 2000), fmt(etd), fmt(addDays(etd, 20)),
                    adminId, fmtTs(subDays(today, 5))]
            );
            const siDate = addDays(today, ub.si);
            await client.query(
                `INSERT INTO booking_deadlines (booking_id, cut_off_si, cut_off_vgm, cut_off_cy)
                 VALUES ($1, $2, $3, $4)`,
                [r.rows[0].id, fmtTs(siDate), fmtTs(addDays(siDate, 1)), fmtTs(addDays(siDate, 2))]
            );
        }

        // ══════════════════════════════════════
        // 20 INVOICES
        // ══════════════════════════════════════
        const cats = ['Freight', 'Terminal Handling', 'Customs Clearance', 'Insurance', 'Documentation', 'Trucking'];
        for (let i = 0; i < 20; i++) {
            const daysAgo = Math.floor(i / 4) * 30 + Math.floor(Math.random() * 25);
            const created = subDays(today, daysAgo);
            const cat = pick(cats);
            const amt = cat === 'Freight' ? 2000 + Math.floor(Math.random() * 5000)
                : cat === 'Terminal Handling' ? 300 + Math.floor(Math.random() * 700)
                    : cat === 'Trucking' ? 400 + Math.floor(Math.random() * 600)
                        : 100 + Math.floor(Math.random() * 400);
            let status;
            if (daysAgo > 90) status = 'PAID';
            else if (daysAgo > 60) status = pick(['PAID', 'PAID', 'OVERDUE']);
            else if (daysAgo > 30) status = pick(['PAID', 'PENDING', 'OVERDUE']);
            else status = pick(['PENDING', 'PENDING', 'PAID']);

            await client.query(
                `INSERT INTO invoices (invoice_number, shipment_id, vendor_name, category, amount_usd, status, due_date, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [`INV-${ts}-${String(i + 1).padStart(3, '0')}`, pick(shipmentIds),
                pick(vendorNames), cat, amt, status, fmt(addDays(created, 30)), fmtTs(created)]
            );
        }

        // ══════════════════════════════════════
        // 15 DOCUMENTS
        // ══════════════════════════════════════
        const docTypes = ['Bill of Lading', 'Commercial Invoice', 'Packing List', 'Certificate of Origin', 'Phytosanitary Certificate'];
        for (let i = 0; i < 15; i++) {
            const dt = docTypes[i % docTypes.length];
            const stt = Math.random() > 0.3 ? 'VALIDATED' : pick(['UPLOADED', 'REJECTED']);
            await client.query(
                `INSERT INTO documents (document_number, shipment_id, document_type, status, file_path, file_name, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [`DOC-${ts}-${String(i + 1).padStart(3, '0')}`, pick(shipmentIds), dt, stt,
                `/uploads/${dt.replace(/ /g, '_').toLowerCase()}.pdf`, `${dt.replace(/ /g, '_').toLowerCase()}.pdf`, adminId]
            );
        }

        // ══════════════════════════════════════
        // NOTIFICATIONS (8)
        // ══════════════════════════════════════
        const notifs = [
            { t: 'DEADLINE_WARNING', ti: '⏰ SI Cut-off approaching', m: 'SI deadline is TODAY.', p: 'HIGH' },
            { t: 'DEADLINE_CRITICAL', ti: '🔴 VGM cut-off OVERDUE', m: 'VGM deadline has passed.', p: 'HIGH' },
            { t: 'DOCUMENT_ISSUE', ti: '📋 Phytosanitary Cert rejected', m: 'Certificate rejected by customs.', p: 'MEDIUM' },
            { t: 'SHIPMENT_DELAYED', ti: '🚢 Vessel delay: ETA +3 days', m: 'Port congestion at destination.', p: 'MEDIUM' },
            { t: 'COST_ALERT', ti: '💰 Invoice overdue 15 days', m: 'Freight invoice overdue.', p: 'HIGH' },
            { t: 'QUALITY_ALERT', ti: '🍎 Temperature alert: Container', m: 'Reading 4.2°C exceeds 2°C.', p: 'HIGH' },
            { t: 'COMPLIANCE', ti: '📜 Export license expiring', m: 'Expires in 7 days.', p: 'MEDIUM' },
            { t: 'BOOKING_CONFIRMED', ti: '✅ Booking confirmed by Maersk', m: 'Container allocation confirmed.', p: 'LOW' },
        ];
        for (const n of notifs) {
            await client.query(
                `INSERT INTO notifications (user_id, type, title, message, priority, is_read, created_at)
                 VALUES ($1,$2,$3,$4,$5,false,$6)`,
                [adminId, n.t, n.ti, n.m, n.p, fmtTs(subDays(today, Math.floor(Math.random() * 5)))]
            );
        }

        // ══════════════════════════════════════
        // TASKS (10)
        // ══════════════════════════════════════
        const tasks = [
            { tp: 'DOCUMENT_PREP', ti: 'Submit SI for urgent booking', s: 'PENDING', p: 'HIGH', d: 0 },
            { tp: 'DOCUMENT_PREP', ti: 'Arrange VGM weighing', s: 'PENDING', p: 'MEDIUM', d: 1 },
            { tp: 'DOCUMENT_PREP', ti: 'Prepare Phytosanitary Certificate', s: 'IN_PROGRESS', p: 'HIGH', d: 2 },
            { tp: 'LOGISTICS', ti: 'Book trucking for cargo', s: 'PENDING', p: 'MEDIUM', d: 3 },
            { tp: 'CUSTOMS', ti: 'Submit Customs Declaration', s: 'COMPLETED', p: 'HIGH', d: -2 },
            { tp: 'DOCUMENT_PREP', ti: 'Verify Bill of Lading draft', s: 'IN_PROGRESS', p: 'HIGH', d: 1 },
            { tp: 'LOGISTICS', ti: 'Confirm loading schedule', s: 'PENDING', p: 'MEDIUM', d: 2 },
            { tp: 'DOCUMENT_PREP', ti: 'Review Commercial Invoice', s: 'COMPLETED', p: 'LOW', d: -5 },
            { tp: 'PAYMENT', ti: 'Arrange cargo insurance', s: 'PENDING', p: 'HIGH', d: 4 },
            { tp: 'PAYMENT', ti: 'Send arrival notice', s: 'COMPLETED', p: 'MEDIUM', d: -1 },
        ];
        for (const t of tasks) {
            await client.query(
                `INSERT INTO tasks (task_type, title, status, priority, deadline, assigned_to, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [t.tp, t.ti, t.s, t.p, fmtTs(addDays(today, t.d)), adminId, fmtTs(subDays(today, 3))]
            );
        }

        // ALERTS (3)
        const alerts = [
            { t: 'DEADLINE', s: 'CRITICAL', ti: 'SI Cut-off TODAY', desc: 'Urgent booking SI deadline today.' },
            { t: 'DOCUMENT', s: 'HIGH', ti: 'Missing Phytosanitary Certificate', desc: 'Required cert missing.' },
            { t: 'COMPLIANCE', s: 'MEDIUM', ti: 'Export license renewal needed', desc: 'Japan license expires in 7d.' },
        ];
        for (const a of alerts) {
            await client.query(
                `INSERT INTO alerts (type, severity, title, description, is_resolved, created_at)
                 VALUES ($1,$2,$3,$4,false,$5)`,
                [a.t, a.s, a.ti, a.desc, fmtTs(subDays(today, 1))]
            );
        }

        await client.query('COMMIT');
        return {
            success: true,
            message: 'Rich sample data seeded successfully! 🎉',
            summary: {
                customers: customerIds.length,
                forwarders: forwarderIds.length,
                shipments: 25,
                bookings: '35 + 5 urgent = 40',
                invoices: 20,
                documents: 15,
                notifications: 8,
                tasks: 10,
                alerts: 3,
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
