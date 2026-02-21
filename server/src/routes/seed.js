const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// POST /api/seed/init - One-time setup for admin license
router.post('/init', async (req, res) => {
    try {
        // Get admin user
        const userResult = await pool.query(
            "SELECT id, email FROM users WHERE email = 'admin@logispro.vn'"
        );

        if (userResult.rows.length === 0) {
            // Create admin user first
            const hash = await bcrypt.hash('admin123', 10);
            const newUser = await pool.query(
                `INSERT INTO users (email, password_hash, full_name, role, status)
         VALUES ('admin@logispro.vn', $1, 'Admin User', 'ADMIN', 'ACTIVE')
         RETURNING id, email`,
                [hash]
            );
            userResult.rows = newUser.rows;
        }

        const adminId = userResult.rows[0].id;

        // Check if license exists
        const licenseCheck = await pool.query(
            'SELECT id FROM licenses WHERE user_id = $1',
            [adminId]
        );

        if (licenseCheck.rows.length > 0) {
            return res.json({ success: true, message: 'Admin already has a license' });
        }

        // Create license
        await pool.query(
            `INSERT INTO licenses (license_key, user_id, type, max_devices, revoked)
       VALUES ('ADMIN-MASTER-KEY-001', $1, 'PREMIUM', 99, false)`,
            [adminId]
        );

        res.json({
            success: true,
            message: 'Admin license created',
            credentials: {
                email: 'admin@logispro.vn',
                password: 'admin123',
                license: 'ADMIN-MASTER-KEY-001'
            }
        });
    } catch (error) {
        console.error('Seed error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/seed/reset - Clear device bindings for admin
router.post('/reset', async (req, res) => {
    try {
        // Clear all device activations
        await pool.query('DELETE FROM device_activations');
        // Clear admin whitelist
        await pool.query('DELETE FROM admin_whitelist');

        res.json({ success: true, message: 'All device bindings and whitelist cleared' });
    } catch (error) {
        console.error('Reset error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/seed/sample-data - Create realistic Vietnamese fruit export sample data
router.post('/sample-data', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get admin user ID
        const adminResult = await client.query("SELECT id FROM users WHERE email = 'admin@logispro.vn'");
        if (adminResult.rows.length === 0) {
            throw new Error('Admin user not found. Run /api/seed/init first.');
        }
        const adminId = adminResult.rows[0].id;

        // ==========================================
        // 0. CLEANUP: Clear ALL data tables before re-seed
        // Delete in dependency order to avoid FK violations
        // ==========================================
        await client.query('DELETE FROM notifications');
        await client.query('DELETE FROM alerts');
        try { await client.query('DELETE FROM audit_log'); } catch (e) { }
        await client.query('DELETE FROM truck_dispatches');
        await client.query('DELETE FROM tasks');
        await client.query('DELETE FROM documents');
        await client.query('DELETE FROM invoices');
        await client.query('DELETE FROM booking_deadlines');
        await client.query('DELETE FROM bookings');
        await client.query('DELETE FROM shipments');
        await client.query('DELETE FROM qc_staff');
        await client.query('DELETE FROM forwarders');
        await client.query('DELETE FROM customers');

        // ==========================================
        // 1. CUSTOMERS (Real import/export partners)
        // Schema: customer_code, company_name, contact_name, email, phone, address, country
        // ==========================================
        const customers = [
            {
                code: 'CUST-JP001',
                name: 'Tokyo Fresh Fruits Co., Ltd.',
                contact_name: 'Tanaka Hiroshi',
                email: 'tanaka@tokyofresh.co.jp',
                phone: '+81-3-1234-5678',
                address: '2-5-1 Tsukiji, Chuo-ku, Tokyo 104-0045',
                country: 'Japan'
            },
            {
                code: 'CUST-KR001',
                name: 'Seoul Tropical Import Inc.',
                contact_name: 'Park Min-jun',
                email: 'park.mj@seoultropical.kr',
                phone: '+82-2-555-0198',
                address: '15 Garak-dong, Songpa-gu, Seoul 05765',
                country: 'South Korea'
            },
            {
                code: 'CUST-EU001',
                name: 'Holland Fresh Produce BV',
                contact_name: 'Jan de Vries',
                email: 'j.devries@hollandfresh.nl',
                phone: '+31-10-234-5678',
                address: 'Spaanse Polder 12, 3014 Rotterdam',
                country: 'Netherlands'
            }
        ];

        const customerIds = [];
        for (const c of customers) {
            const existing = await client.query('SELECT id FROM customers WHERE customer_code = $1', [c.code]);
            if (existing.rows.length > 0) {
                customerIds.push(existing.rows[0].id);
            } else {
                const result = await client.query(
                    `INSERT INTO customers (customer_code, company_name, contact_name, email, phone, address, country)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     RETURNING id`,
                    [c.code, c.name, c.contact_name, c.email, c.phone, c.address, c.country]
                );
                customerIds.push(result.rows[0].id);
            }
        }

        // ==========================================
        // 2. FORWARDERS (Real freight service providers)
        // Schema: company_name, contact_name, email, phone, address, grade, on_time_rate, doc_accuracy_rate, cost_score
        // ==========================================
        const forwarders = [
            {
                name: 'Vinalink Logistics JSC',
                provider_code: 'FWD-VINALINK',
                contact_name: 'Nguyen Van Thanh',
                email: 'thanh.nv@vinalink.com.vn',
                phone: '+84-28-3823-4567',
                address: '45 Nguyen Hue, Dist.1, HCMC',
                grade: 'A',
                on_time_rate: 92.5,
                doc_accuracy_rate: 95.0,
                cost_score: 85.0
            },
            {
                name: 'Gemadept Shipping Corp',
                provider_code: 'FWD-GEMADEPT',
                contact_name: 'Tran Minh Duc',
                email: 'duc.tm@gemadept.com.vn',
                phone: '+84-28-3910-1234',
                address: '6 Le Thanh Ton, Dist.1, HCMC',
                grade: 'B',
                on_time_rate: 88.0,
                doc_accuracy_rate: 90.0,
                cost_score: 90.0
            }
        ];

        const forwarderIds = [];
        for (const f of forwarders) {
            const existing = await client.query('SELECT id FROM forwarders WHERE company_name = $1', [f.name]);
            if (existing.rows.length > 0) {
                forwarderIds.push(existing.rows[0].id);
            } else {
                const result = await client.query(
                    `INSERT INTO forwarders (provider_code, company_name, contact_name, email, phone, address, grade, on_time_rate, doc_accuracy_rate, cost_score)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                     RETURNING id`,
                    [f.provider_code, f.name, f.contact_name, f.email, f.phone, f.address, f.grade, f.on_time_rate, f.doc_accuracy_rate, f.cost_score]
                );
                forwarderIds.push(result.rows[0].id);
            }
        }

        // ==========================================
        // 3. SHIPMENTS (3 at different workflow stages)
        // Schema: shipment_number, type, status, customer_id, origin_port, origin_country,
        //   destination_port, destination_country, container_type, container_count,
        //   cargo_description, cargo_weight_kg, cargo_volume_cbm, incoterm, etd, eta, atd, ata, total_cost_usd
        // ==========================================

        const today = new Date();
        const addDays = (d, days) => {
            const r = new Date(d);
            r.setDate(r.getDate() + days);
            return r.toISOString().split('T')[0]; // DATE format YYYY-MM-DD
        };

        const shipments = [
            {
                number: 'SHP-2026-0001',
                type: 'FCL',
                status: 'IN_TRANSIT',
                customer_id: customerIds[0],
                origin_port: 'Cat Lai, HCMC',
                origin_country: 'Vietnam',
                destination_port: 'Tokyo, Japan',
                destination_country: 'Japan',
                container_type: '40RF',
                container_count: 2,
                cargo_description: 'Fresh Dragon Fruit (White/Red flesh), Grade A, 20MT',
                cargo_weight_kg: 20000,
                cargo_volume_cbm: 56,
                incoterm: 'CIF',
                etd: addDays(today, -5),
                eta: addDays(today, 12),
                atd: addDays(today, -5),
                ata: null,
                total_cost_usd: 8500
            },
            {
                number: 'SHP-2026-0002',
                type: 'FCL',
                status: 'DOCUMENTATION_IN_PROGRESS',
                customer_id: customerIds[1],
                origin_port: 'Cat Lai, HCMC',
                origin_country: 'Vietnam',
                destination_port: 'Busan, South Korea',
                destination_country: 'South Korea',
                container_type: '40RF',
                container_count: 1,
                cargo_description: 'Fresh Mango (Cat Hoa Loc variety), Grade A, 12MT',
                cargo_weight_kg: 12000,
                cargo_volume_cbm: 28,
                incoterm: 'FOB',
                etd: addDays(today, 5),
                eta: addDays(today, 15),
                atd: null,
                ata: null,
                total_cost_usd: 4200
            },
            {
                number: 'SHP-2026-0003',
                type: 'AIR',
                status: 'DELIVERED',
                customer_id: customerIds[2],
                origin_port: 'Tan Son Nhat, HCMC',
                origin_country: 'Vietnam',
                destination_port: 'Amsterdam, Netherlands',
                destination_country: 'Netherlands',
                container_type: null,
                container_count: null,
                cargo_description: 'Fresh Passion Fruit, Premium Grade, 2MT',
                cargo_weight_kg: 2000,
                cargo_volume_cbm: 8,
                incoterm: 'CIF',
                etd: addDays(today, -14),
                eta: addDays(today, -12),
                atd: addDays(today, -14),
                ata: addDays(today, -11),
                total_cost_usd: 12500
            }
        ];

        const shipmentIds = [];
        for (const s of shipments) {
            const existing = await client.query('SELECT id FROM shipments WHERE shipment_number = $1', [s.number]);
            if (existing.rows.length > 0) {
                shipmentIds.push(existing.rows[0].id);
            } else {
                const result = await client.query(
                    `INSERT INTO shipments (shipment_number, type, status, customer_id, origin_port, origin_country,
                     destination_port, destination_country, container_type, container_count,
                     cargo_description, cargo_weight_kg, cargo_volume_cbm, incoterm, etd, eta, atd, ata, total_cost_usd)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
                     RETURNING id`,
                    [s.number, s.type, s.status, s.customer_id, s.origin_port, s.origin_country,
                    s.destination_port, s.destination_country, s.container_type, s.container_count,
                    s.cargo_description, s.cargo_weight_kg, s.cargo_volume_cbm, s.incoterm,
                    s.etd, s.eta, s.atd, s.ata, s.total_cost_usd]
                );
                shipmentIds.push(result.rows[0].id);
            }
        }

        // ==========================================
        // 4. BOOKINGS (Linked to shipments with real deadlines)
        // Schema: booking_number, shipment_id, forwarder_id, type, status, vessel_flight,
        //   voyage_number, origin_port, destination_port, etd, eta, freight_rate_usd, shipping_line
        // ==========================================
        const bookings = [
            {
                number: 'BKG-MSC-2026001',
                shipment_id: shipmentIds[0],
                forwarder_id: forwarderIds[0],
                type: 'FCL',
                status: 'CONFIRMED',
                shipping_line: 'MSC - Mediterranean Shipping Company',
                vessel_flight: 'MSC ANNA',
                voyage_number: 'FA607R',
                origin_port: 'Cat Lai, HCMC',
                destination_port: 'Tokyo, Japan',
                etd: addDays(today, -5),
                eta: addDays(today, 12),
                freight_rate_usd: 2800,
                cut_off_si: addDays(today, -7) + ' 16:00:00',
                cut_off_vgm: addDays(today, -6) + ' 12:00:00',
                cut_off_cy: addDays(today, -5) + ' 08:00:00'
            },
            {
                number: 'BKG-ONE-2026002',
                shipment_id: shipmentIds[1],
                forwarder_id: forwarderIds[1],
                type: 'FCL',
                status: 'ALLOCATED',
                shipping_line: 'ONE - Ocean Network Express',
                vessel_flight: 'ONE COMPETENCE',
                voyage_number: '0125E',
                origin_port: 'Cat Lai, HCMC',
                destination_port: 'Busan, South Korea',
                etd: addDays(today, 5),
                eta: addDays(today, 15),
                freight_rate_usd: 1950,
                cut_off_si: addDays(today, 3) + ' 16:00:00',
                cut_off_vgm: addDays(today, 4) + ' 12:00:00',
                cut_off_cy: addDays(today, 4) + ' 08:00:00'
            },
            {
                number: 'BKG-TK-2026003',
                shipment_id: shipmentIds[2],
                forwarder_id: forwarderIds[0],
                type: 'AIR',
                status: 'USED',
                shipping_line: 'Turkish Airlines Cargo',
                vessel_flight: 'TK659',
                voyage_number: null,
                origin_port: 'Tan Son Nhat, HCMC',
                destination_port: 'Amsterdam, Netherlands',
                etd: addDays(today, -14),
                eta: addDays(today, -12),
                freight_rate_usd: 4500,
                cut_off_si: null,
                cut_off_vgm: null,
                cut_off_cy: null
            }
        ];

        const bookingIds = [];
        for (const b of bookings) {
            const existing = await client.query('SELECT id FROM bookings WHERE booking_number = $1', [b.number]);
            if (existing.rows.length > 0) {
                bookingIds.push(existing.rows[0].id);
            } else {
                const result = await client.query(
                    `INSERT INTO bookings (booking_number, shipment_id, forwarder_id, type, status,
                     shipping_line, vessel_flight, voyage_number, origin_port, destination_port,
                     etd, eta, freight_rate_usd)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                     RETURNING id`,
                    [b.number, b.shipment_id, b.forwarder_id, b.type, b.status,
                    b.shipping_line, b.vessel_flight, b.voyage_number, b.origin_port, b.destination_port,
                    b.etd, b.eta, b.freight_rate_usd]
                );
                bookingIds.push(result.rows[0].id);

                // Create booking deadlines if applicable
                if (b.cut_off_si || b.cut_off_vgm || b.cut_off_cy) {
                    await client.query(
                        `INSERT INTO booking_deadlines (booking_id, cut_off_si, cut_off_vgm, cut_off_cy)
                         VALUES ($1, $2, $3, $4)`,
                        [result.rows[0].id, b.cut_off_si, b.cut_off_vgm, b.cut_off_cy]
                    );
                }
            }
        }

        // ==========================================
        // 5. DOCUMENTS (Real trade documents per shipment)
        // Schema: shipment_id, document_type, document_number, file_path, file_name, status
        // ==========================================
        const documentSets = [
            // Shipment 1: Dragon Fruit to Tokyo (IN_TRANSIT, most docs validated)
            {
                shipment: 0, docs: [
                    { type: 'COMMERCIAL_INVOICE', number: 'AGO-INV-2026-001', status: 'VALIDATED', file_name: 'commercial_invoice_SHP0001.pdf' },
                    { type: 'PACKING_LIST', number: 'AGO-PL-2026-001', status: 'VALIDATED', file_name: 'packing_list_SHP0001.pdf' },
                    { type: 'BILL_OF_LADING', number: 'MSCU-BL-2026-001', status: 'VALIDATED', file_name: 'bill_of_lading_SHP0001.pdf' },
                    { type: 'CERTIFICATE_OF_ORIGIN', number: 'CO-VN-2026-001', status: 'VALIDATED', file_name: 'certificate_origin_SHP0001.pdf' },
                    { type: 'PHYTOSANITARY', number: 'PS-VN-2026-001', status: 'VALIDATED', file_name: 'phytosanitary_SHP0001.pdf' },
                    { type: 'FUMIGATION', number: 'FUM-VN-2026-001', status: 'UPLOADED', file_name: 'fumigation_cert_SHP0001.pdf' },
                ]
            },
            // Shipment 2: Mango to Busan (DOCUMENTATION_IN_PROGRESS)
            {
                shipment: 1, docs: [
                    { type: 'COMMERCIAL_INVOICE', number: 'AGO-INV-2026-002', status: 'UPLOADED', file_name: 'commercial_invoice_SHP0002.pdf' },
                    { type: 'PACKING_LIST', number: 'AGO-PL-2026-002', status: 'UPLOADED', file_name: 'packing_list_SHP0002.pdf' },
                    { type: 'CERTIFICATE_OF_ORIGIN', number: 'CO-VN-2026-002', status: 'UPLOADED', file_name: 'certificate_origin_SHP0002.pdf' },
                ]
            },
            // Shipment 3: Passion Fruit to Rotterdam (DELIVERED, all validated)
            {
                shipment: 2, docs: [
                    { type: 'COMMERCIAL_INVOICE', number: 'AGO-INV-2026-003', status: 'VALIDATED', file_name: 'commercial_invoice_SHP0003.pdf' },
                    { type: 'PACKING_LIST', number: 'AGO-PL-2026-003', status: 'VALIDATED', file_name: 'packing_list_SHP0003.pdf' },
                    { type: 'AIR_WAYBILL', number: 'AWB-TK-2026-003', status: 'VALIDATED', file_name: 'air_waybill_SHP0003.pdf' },
                    { type: 'CERTIFICATE_OF_ORIGIN', number: 'CO-VN-2026-003', status: 'VALIDATED', file_name: 'certificate_origin_SHP0003.pdf' },
                    { type: 'PHYTOSANITARY', number: 'PS-VN-2026-003', status: 'VALIDATED', file_name: 'phytosanitary_SHP0003.pdf' },
                ]
            },
        ];

        for (const set of documentSets) {
            for (const doc of set.docs) {
                const existing = await client.query('SELECT id FROM documents WHERE document_number = $1', [doc.number]);
                if (existing.rows.length === 0) {
                    await client.query(
                        `INSERT INTO documents (shipment_id, document_type, document_number, status, file_path, file_name)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [shipmentIds[set.shipment], doc.type, doc.number, doc.status, '/uploads/' + doc.file_name, doc.file_name]
                    );
                }
            }
        }

        // ==========================================
        // 6. INVOICES (Linked to shipments)
        // Schema: invoice_number, shipment_id, vendor_name, amount_usd, currency, status,
        //   issue_date, due_date, paid_date, category
        // ==========================================
        const invoices = [
            {
                number: 'INV-FRT-2026-001',
                shipment_id: shipmentIds[0],
                forwarder_id: forwarderIds[0], // Vinalink (MSC booking)
                vendor_name: 'MSC Vietnam',
                amount_usd: 5600,
                currency: 'USD',
                status: 'PAID',
                issue_date: addDays(today, -10),
                due_date: addDays(today, 20),
                paid_date: addDays(today, -3),
                category: 'Ocean Freight'
            },
            {
                number: 'INV-THC-2026-001',
                shipment_id: shipmentIds[0],
                forwarder_id: null, // Terminal — no forwarder
                vendor_name: 'Cat Lai Terminal',
                amount_usd: 850,
                currency: 'USD',
                status: 'PENDING',
                issue_date: addDays(today, -5),
                due_date: addDays(today, 25),
                paid_date: null,
                category: 'Terminal Handling'
            },
            {
                number: 'INV-FWD-2026-002',
                shipment_id: shipmentIds[1],
                forwarder_id: forwarderIds[1], // Gemadept
                vendor_name: 'Gemadept Shipping Corp',
                amount_usd: 1950,
                currency: 'USD',
                status: 'PENDING',
                issue_date: addDays(today, -1),
                due_date: addDays(today, 30),
                paid_date: null,
                category: 'Forwarding Fee'
            },
            {
                number: 'INV-AIR-2026-003',
                shipment_id: shipmentIds[2],
                forwarder_id: forwarderIds[0], // Vinalink (TK booking)
                vendor_name: 'Turkish Airlines Cargo',
                amount_usd: 9000,
                currency: 'USD',
                status: 'PAID',
                issue_date: addDays(today, -15),
                due_date: addDays(today, -5),
                paid_date: addDays(today, -8),
                category: 'Air Freight'
            }
        ];

        for (const inv of invoices) {
            const existing = await client.query('SELECT id FROM invoices WHERE invoice_number = $1', [inv.number]);
            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO invoices (invoice_number, shipment_id, forwarder_id, vendor_name, amount_usd, currency, status, issue_date, due_date, paid_date, category)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                    [inv.number, inv.shipment_id, inv.forwarder_id || null, inv.vendor_name, inv.amount_usd, inv.currency, inv.status,
                    inv.issue_date, inv.due_date, inv.paid_date, inv.category]
                );
            }
        }

        // ==========================================
        // 7. TASKS (Deadline-driven operational tasks)
        // Schema: task_type, title, description, shipment_id, booking_id, assigned_to, deadline, status, priority
        // ==========================================
        const tasks = [
            {
                task_type: 'DOCUMENT_PREP',
                title: 'Submit SI (Shipping Instruction) for BKG-ONE-2026002',
                description: 'Prepare and submit shipping instruction to ONE shipping line for Mango shipment to Busan. Deadline: cut-off SI date.',
                shipment_id: shipmentIds[1],
                booking_id: bookingIds[1],
                assigned_to: adminId,
                deadline: addDays(today, 3) + ' 16:00:00',
                status: 'PENDING',
                priority: 'HIGH'
            },
            {
                task_type: 'DOCUMENT_PREP',
                title: 'Submit VGM for BKG-ONE-2026002',
                description: 'Verify Gross Mass and submit VGM certificate for container loading.',
                shipment_id: shipmentIds[1],
                booking_id: bookingIds[1],
                assigned_to: adminId,
                deadline: addDays(today, 4) + ' 12:00:00',
                status: 'PENDING',
                priority: 'HIGH'
            },
            {
                task_type: 'DOCUMENT_PREP',
                title: 'Finalize Commercial Invoice for SHP-2026-0002',
                description: 'Complete commercial invoice with final pricing for Mango shipment to Seoul Tropical Import.',
                shipment_id: shipmentIds[1],
                booking_id: bookingIds[1],
                assigned_to: adminId,
                deadline: addDays(today, 2) + ' 17:00:00',
                status: 'PENDING',
                priority: 'CRITICAL'
            },
            {
                task_type: 'CUSTOMS',
                title: 'Arrange customs clearance for SHP-2026-0001',
                description: 'Dragon fruit shipment arriving Tokyo in 12 days. Coordinate with Tanaka-san for import customs clearance.',
                shipment_id: shipmentIds[0],
                booking_id: bookingIds[0],
                assigned_to: adminId,
                deadline: addDays(today, 10) + ' 09:00:00',
                status: 'PENDING',
                priority: 'MEDIUM'
            },
            {
                task_type: 'PAYMENT',
                title: 'Collect payment from Holland Fresh Produce',
                description: 'Passion fruit shipment delivered. Follow up on payment collection per invoice INV-AIR-2026-003.',
                shipment_id: shipmentIds[2],
                booking_id: bookingIds[2],
                assigned_to: adminId,
                deadline: addDays(today, 7) + ' 17:00:00',
                status: 'PENDING',
                priority: 'MEDIUM'
            }
        ];

        for (const t of tasks) {
            const existing = await client.query('SELECT id FROM tasks WHERE title = $1', [t.title]);
            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO tasks (task_type, title, description, shipment_id, booking_id, assigned_to, deadline, status, priority)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                    [t.task_type, t.title, t.description, t.shipment_id, t.booking_id, t.assigned_to, t.deadline, t.status, t.priority]
                );
            }
        }

        // ==========================================
        // 8. NOTIFICATIONS (System notifications)
        // ==========================================
        const notifications = [
            {
                type: 'DEADLINE_WARNING',
                priority: 'HIGH',
                title: 'SI Cut-off approaching: BKG-ONE-2026002',
                message: 'Shipping Instruction cut-off for the Mango shipment to Busan is in 3 days. Please prepare and submit SI documents.',
            },
            {
                type: 'SHIPMENT_UPDATE',
                priority: 'MEDIUM',
                title: 'Shipment SHP-2026-0001 departed Cat Lai',
                message: 'Dragon fruit shipment on MSC ANNA has departed Cat Lai. ETA Tokyo in 12 days.',
            },
            {
                type: 'DOCUMENT_STATUS',
                priority: 'LOW',
                title: 'Documents validated: SHP-2026-0003',
                message: 'All 5 documents for Passion Fruit shipment to Rotterdam have been validated and approved.',
            },
            {
                type: 'PAYMENT_REMINDER',
                priority: 'MEDIUM',
                title: 'Invoice INV-THC-2026-001 due in 25 days',
                message: 'Terminal handling charge of $850 for Cat Lai Terminal is due. Please process payment.',
            }
        ];

        for (const n of notifications) {
            await client.query(
                `INSERT INTO notifications (user_id, type, priority, title, message)
                 VALUES ($1, $2, $3, $4, $5)`,
                [adminId, n.type, n.priority, n.title, n.message]
            );
        }

        // ==========================================
        // 9. QC STAFF (Quality Control inspectors)
        // Schema: staff_code, full_name, role, email, phone, department, status
        // ==========================================
        const qcStaff = [
            {
                code: 'QC-001',
                name: 'Nguyen Thi Lan',
                role: 'Senior QC Inspector',
                email: 'lan.nt@agofruit.vn',
                phone: '+84-903-111-222',
                department: 'Quality Control'
            },
            {
                code: 'QC-002',
                name: 'Le Van Hung',
                role: 'QC Inspector',
                email: 'hung.lv@agofruit.vn',
                phone: '+84-903-333-444',
                department: 'Quality Control'
            },
            {
                code: 'QC-003',
                name: 'Pham Minh Tuan',
                role: 'QC Inspector',
                email: 'tuan.pm@agofruit.vn',
                phone: '+84-903-555-666',
                department: 'Packaging & QC'
            }
        ];

        for (const q of qcStaff) {
            const existing = await client.query('SELECT id FROM qc_staff WHERE staff_code = $1', [q.code]);
            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO qc_staff (staff_code, full_name, role, email, phone, department)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [q.code, q.name, q.role, q.email, q.phone, q.department]
                );
            }
        }

        // ==========================================
        // 10. ADDITIONAL CUSTOMERS (More markets)
        // ==========================================
        const moreCustomers = [
            {
                code: 'CUST-US001',
                name: 'California Exotic Imports LLC',
                contact_name: 'Michael Chen',
                email: 'michael@calexotic.com',
                phone: '+1-213-555-0142',
                address: '800 S Alameda St, Los Angeles, CA 90021',
                country: 'United States'
            },
            {
                code: 'CUST-AU001',
                name: 'Sydney Fresh Markets Pty Ltd',
                contact_name: 'David Nguyen',
                email: 'david@sydneyfresh.com.au',
                phone: '+61-2-8765-4321',
                address: '250 Parramatta Rd, Flemington Markets, NSW 2129',
                country: 'Australia'
            }
        ];

        const moreCustomerIds = [];
        for (const c of moreCustomers) {
            const existing = await client.query('SELECT id FROM customers WHERE customer_code = $1', [c.code]);
            if (existing.rows.length > 0) {
                moreCustomerIds.push(existing.rows[0].id);
            } else {
                const result = await client.query(
                    `INSERT INTO customers (customer_code, company_name, contact_name, email, phone, address, country)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                    [c.code, c.name, c.contact_name, c.email, c.phone, c.address, c.country]
                );
                moreCustomerIds.push(result.rows[0].id);
            }
        }

        // ==========================================
        // 11. ADDITIONAL FORWARDER
        // ==========================================
        const moreForwarders = [
            {
                name: 'DHL Global Forwarding Vietnam',
                provider_code: 'FWD-DHL',
                contact_name: 'Hoang Anh Tuan',
                email: 'tuan.ha@dhl.com',
                phone: '+84-28-3822-9999',
                address: '100 Nguyen Van Troi, Phu Nhuan, HCMC',
                grade: 'A',
                on_time_rate: 95.0,
                doc_accuracy_rate: 97.0,
                cost_score: 75.0
            }
        ];

        const moreForwarderIds = [];
        for (const f of moreForwarders) {
            const existing = await client.query('SELECT id FROM forwarders WHERE company_name = $1', [f.name]);
            if (existing.rows.length > 0) {
                moreForwarderIds.push(existing.rows[0].id);
            } else {
                const result = await client.query(
                    `INSERT INTO forwarders (provider_code, company_name, contact_name, email, phone, address, grade, on_time_rate, doc_accuracy_rate, cost_score)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                    [f.provider_code, f.name, f.contact_name, f.email, f.phone, f.address, f.grade, f.on_time_rate, f.doc_accuracy_rate, f.cost_score]
                );
                moreForwarderIds.push(result.rows[0].id);
            }
        }

        // ==========================================
        // 12. ADDITIONAL SHIPMENTS (FCL)
        // ==========================================
        const moreShipments = [
            {
                number: 'SHP-2026-0004',
                type: 'FCL',
                status: 'DOCUMENTATION_IN_PROGRESS',
                customer_id: moreCustomerIds[0],
                origin_port: 'Cat Lai, HCMC',
                origin_country: 'Vietnam',
                destination_port: 'Los Angeles, USA',
                destination_country: 'United States',
                container_type: '20RF',
                container_count: 1,
                cargo_description: 'Fresh Pomelo (Nam Roi variety), Grade A, 5MT',
                cargo_weight_kg: 5000,
                cargo_volume_cbm: 15,
                incoterm: 'CFR',
                etd: addDays(today, 8),
                eta: addDays(today, 30),
                atd: null,
                ata: null,
                total_cost_usd: 6800
            },
            {
                number: 'SHP-2026-0005',
                type: 'FCL',
                status: 'DRAFT',
                customer_id: moreCustomerIds[1],
                origin_port: 'Cat Lai, HCMC',
                origin_country: 'Vietnam',
                destination_port: 'Sydney, Australia',
                destination_country: 'Australia',
                container_type: '40RF',
                container_count: 1,
                cargo_description: 'Fresh Lychee (Thieu variety), Premium Grade, 8MT',
                cargo_weight_kg: 8000,
                cargo_volume_cbm: 25,
                incoterm: 'CIF',
                etd: addDays(today, 15),
                eta: addDays(today, 30),
                atd: null,
                ata: null,
                total_cost_usd: 7200
            }
        ];

        const moreShipmentIds = [];
        for (const s of moreShipments) {
            const existing = await client.query('SELECT id FROM shipments WHERE shipment_number = $1', [s.number]);
            if (existing.rows.length > 0) {
                moreShipmentIds.push(existing.rows[0].id);
            } else {
                const result = await client.query(
                    `INSERT INTO shipments (shipment_number, type, status, customer_id, origin_port, origin_country,
                     destination_port, destination_country, container_type, container_count,
                     cargo_description, cargo_weight_kg, cargo_volume_cbm, incoterm, etd, eta, atd, ata, total_cost_usd)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
                    [s.number, s.type, s.status, s.customer_id, s.origin_port, s.origin_country,
                    s.destination_port, s.destination_country, s.container_type, s.container_count,
                    s.cargo_description, s.cargo_weight_kg, s.cargo_volume_cbm, s.incoterm,
                    s.etd, s.eta, s.atd, s.ata, s.total_cost_usd]
                );
                moreShipmentIds.push(result.rows[0].id);
            }
        }

        // ==========================================
        // 13. ADDITIONAL BOOKINGS (Unlinked + Cancelled)
        // For testing "Create Shipment from Booking" feature
        // ==========================================
        const moreBookings = [
            {
                number: 'BKG-EVG-2026004',
                shipment_id: null,  // UNLINKED — for testing
                forwarder_id: forwarderIds[0],
                type: 'FCL',
                status: 'CONFIRMED',
                shipping_line: 'Evergreen Line',
                vessel_flight: 'EVER GOLDEN',
                voyage_number: '0226E',
                origin_port: 'Cat Lai, HCMC',
                destination_port: 'Chennai, India',
                etd: addDays(today, 10),
                eta: addDays(today, 22),
                freight_rate_usd: 2200,
                cut_off_si: addDays(today, 8) + ' 16:00:00',
                cut_off_vgm: addDays(today, 9) + ' 12:00:00',
                cut_off_cy: addDays(today, 9) + ' 08:00:00'
            },
            {
                number: 'BKG-CMA-2026005',
                shipment_id: null,  // UNLINKED — for testing
                forwarder_id: moreForwarderIds[0],
                type: 'FCL',
                status: 'PENDING',
                shipping_line: 'CMA CGM',
                vessel_flight: 'CMA CGM THALASSA',
                voyage_number: '0326W',
                origin_port: 'Cat Lai, HCMC',
                destination_port: 'Dubai, UAE',
                etd: addDays(today, 14),
                eta: addDays(today, 28),
                freight_rate_usd: 1800,
                cut_off_si: null,
                cut_off_vgm: null,
                cut_off_cy: null
            },
            {
                number: 'BKG-HPL-2026006',
                shipment_id: moreShipmentIds[0] || null,
                forwarder_id: forwarderIds[1],
                type: 'FCL',
                status: 'CONFIRMED',
                shipping_line: 'Hapag-Lloyd',
                vessel_flight: 'HAPAG LIMA',
                voyage_number: '0426E',
                origin_port: 'Cat Lai, HCMC',
                destination_port: 'Los Angeles, USA',
                etd: addDays(today, 8),
                eta: addDays(today, 30),
                freight_rate_usd: 3200,
                cut_off_si: addDays(today, 6) + ' 16:00:00',
                cut_off_vgm: addDays(today, 7) + ' 12:00:00',
                cut_off_cy: addDays(today, 7) + ' 08:00:00'
            },
            {
                number: 'BKG-CANC-2026007',
                shipment_id: null,
                forwarder_id: forwarderIds[0],
                type: 'FCL',
                status: 'CANCELLED',
                shipping_line: 'COSCO Shipping',
                vessel_flight: 'COSCO GALAXY',
                voyage_number: '0526N',
                origin_port: 'Cat Lai, HCMC',
                destination_port: 'Shanghai, China',
                etd: addDays(today, -3),
                eta: addDays(today, 7),
                freight_rate_usd: 1500,
                cut_off_si: null,
                cut_off_vgm: null,
                cut_off_cy: null
            }
        ];

        const moreBookingIds = [];
        for (const b of moreBookings) {
            const existing = await client.query('SELECT id FROM bookings WHERE booking_number = $1', [b.number]);
            if (existing.rows.length > 0) {
                moreBookingIds.push(existing.rows[0].id);
            } else {
                const route = b.origin_port && b.destination_port ? `${b.origin_port} → ${b.destination_port}` : '';
                const result = await client.query(
                    `INSERT INTO bookings (booking_number, shipment_id, forwarder_id, type, status,
                     shipping_line, vessel_flight, voyage_number, route, origin_port, destination_port,
                     etd, eta, freight_rate_usd)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
                    [b.number, b.shipment_id, b.forwarder_id, b.type, b.status,
                    b.shipping_line, b.vessel_flight, b.voyage_number, route, b.origin_port, b.destination_port,
                    b.etd, b.eta, b.freight_rate_usd]
                );
                moreBookingIds.push(result.rows[0].id);

                if (b.cut_off_si || b.cut_off_vgm || b.cut_off_cy) {
                    await client.query(
                        `INSERT INTO booking_deadlines (booking_id, cut_off_si, cut_off_vgm, cut_off_cy)
                         VALUES ($1, $2, $3, $4)`,
                        [result.rows[0].id, b.cut_off_si, b.cut_off_vgm, b.cut_off_cy]
                    );
                }
            }
        }

        // ==========================================
        // 14. TRUCK DISPATCHES (Logistics operations)
        // ==========================================
        const dispatches = [
            {
                booking_id: bookingIds[0],
                shipment_id: shipmentIds[0],
                truck_company: 'Saigon Cargo Express',
                driver_name: 'Tran Van Ba',
                driver_phone: '+84-909-123-456',
                truck_plate: '51C-123.45',
                pickup_datetime: addDays(today, -6) + ' 06:00:00',
                warehouse_location: 'Binh Dien Wholesale Market, HCMC',
                status: 'COMPLETED'
            },
            {
                booking_id: bookingIds[1],
                shipment_id: shipmentIds[1],
                truck_company: 'Mekong Transport JSC',
                driver_name: 'Nguyen Tai',
                driver_phone: '+84-909-789-012',
                truck_plate: '51C-678.90',
                pickup_datetime: addDays(today, 4) + ' 05:00:00',
                warehouse_location: 'Tien Giang Fruit Packing Facility',
                status: 'SCHEDULED'
            }
        ];

        for (const d of dispatches) {
            const existing = await client.query(
                'SELECT id FROM truck_dispatches WHERE booking_id = $1 AND truck_plate = $2',
                [d.booking_id, d.truck_plate]
            );
            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO truck_dispatches (booking_id, shipment_id, truck_company, driver_name, driver_phone,
                     truck_plate, pickup_datetime, warehouse_location, status, created_by)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                    [d.booking_id, d.shipment_id, d.truck_company, d.driver_name, d.driver_phone,
                    d.truck_plate, d.pickup_datetime, d.warehouse_location, d.status, adminId]
                );
            }
        }

        // ==========================================
        // 15. ADDITIONAL INVOICES (Overdue + more realistic)
        // ==========================================
        const moreInvoices = [
            {
                number: 'INV-CUST-2026-004',
                shipment_id: shipmentIds[2],
                forwarder_id: forwarderIds[0], // Vinalink
                vendor_name: 'Vinalink Logistics JSC',
                amount_usd: 2800,
                currency: 'USD',
                status: 'OVERDUE',
                issue_date: addDays(today, -30),
                due_date: addDays(today, -5),
                paid_date: null,
                category: 'Customs Brokerage'
            },
            {
                number: 'INV-FWD-2026-005',
                shipment_id: moreShipmentIds[0] || shipmentIds[0],
                forwarder_id: moreForwarderIds[0] || forwarderIds[0], // DHL
                vendor_name: 'DHL Global Forwarding',
                amount_usd: 3200,
                currency: 'USD',
                status: 'PENDING',
                issue_date: addDays(today, -2),
                due_date: addDays(today, 28),
                paid_date: null,
                category: 'Forwarding Fee'
            }
        ];

        for (const inv of moreInvoices) {
            const existing = await client.query('SELECT id FROM invoices WHERE invoice_number = $1', [inv.number]);
            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO invoices (invoice_number, shipment_id, forwarder_id, vendor_name, amount_usd, currency, status, issue_date, due_date, paid_date, category)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                    [inv.number, inv.shipment_id, inv.forwarder_id || null, inv.vendor_name, inv.amount_usd, inv.currency, inv.status,
                    inv.issue_date, inv.due_date, inv.paid_date, inv.category]
                );
            }
        }

        // ==========================================
        // 16. ALERTS (Risk dashboard data)
        // ==========================================
        const alerts = [
            {
                shipment_id: shipmentIds[1],
                booking_id: bookingIds[1],
                type: 'DEADLINE_WARNING',
                severity: 'HIGH',
                title: 'SI Cut-off in 3 days for BKG-ONE-2026002',
                description: 'Shipping Instruction must be submitted before cut-off. Mango shipment to Busan at risk.'
            },
            {
                shipment_id: shipmentIds[2],
                booking_id: null,
                type: 'PAYMENT_OVERDUE',
                severity: 'CRITICAL',
                title: 'Customs brokerage overdue: Vinalink Logistics',
                description: 'Invoice INV-CUST-2026-004 for $2,800 customs brokerage was due 5 days ago. Please process payment.'
            },
            {
                shipment_id: moreShipmentIds[0] || shipmentIds[0],
                booking_id: null,
                type: 'DOCUMENT_INCOMPLETE',
                severity: 'MEDIUM',
                title: 'Missing documents for SHP-2026-0004',
                description: 'LCL Pomelo shipment to LA needs B/L and Phytosanitary certificate. ETD in 8 days.'
            }
        ];

        for (const a of alerts) {
            const existing = await client.query('SELECT id FROM alerts WHERE title = $1', [a.title]);
            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO alerts (shipment_id, booking_id, type, severity, title, description)
                     VALUES ($1,$2,$3,$4,$5,$6)`,
                    [a.shipment_id, a.booking_id, a.type, a.severity, a.title, a.description]
                );
            }
        }

        // ==========================================
        // 17. ADDITIONAL DOCUMENTS (for new shipments)
        // ==========================================
        const moreDocumentSets = [
            // Shipment 4: Pomelo to LA (LCL, DOCUMENTATION_IN_PROGRESS)
            {
                shipment_id: moreShipmentIds[0], docs: [
                    { type: 'COMMERCIAL_INVOICE', number: 'AGO-INV-2026-004', status: 'UPLOADED', file_name: 'commercial_invoice_SHP0004.pdf' },
                    { type: 'PACKING_LIST', number: 'AGO-PL-2026-004', status: 'UPLOADED', file_name: 'packing_list_SHP0004.pdf' },
                ]
            }
        ];

        for (const set of moreDocumentSets) {
            if (!set.shipment_id) continue;
            for (const doc of set.docs) {
                const existing = await client.query('SELECT id FROM documents WHERE document_number = $1', [doc.number]);
                if (existing.rows.length === 0) {
                    await client.query(
                        `INSERT INTO documents (shipment_id, document_type, document_number, status, file_path, file_name)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [set.shipment_id, doc.type, doc.number, doc.status, '/uploads/' + doc.file_name, doc.file_name]
                    );
                }
            }
        }

        // ==========================================
        // 18. ADDITIONAL TASKS (More operational tasks)
        // ==========================================
        const moreTasks = [
            {
                task_type: 'QC_INSPECTION',
                title: 'QC inspection for Pomelo shipment SHP-2026-0004',
                description: 'Inspect Nam Roi pomelo quality before packing. Check for size uniformity, skin condition, and Brix level.',
                shipment_id: moreShipmentIds[0] || shipmentIds[0],
                booking_id: moreBookingIds[2] || null,
                assigned_to: adminId,
                deadline: addDays(today, 5) + ' 10:00:00',
                status: 'PENDING',
                priority: 'HIGH'
            },
            {
                task_type: 'TRUCK_DISPATCH',
                title: 'Schedule container trucking for BKG-EVG-2026004',
                description: 'Book truck for FCL container pickup to Cat Lai port. Booking to Chennai, India.',
                shipment_id: null,
                booking_id: moreBookingIds[0] || null,
                assigned_to: adminId,
                deadline: addDays(today, 8) + ' 08:00:00',
                status: 'PENDING',
                priority: 'MEDIUM'
            }
        ];

        for (const t of moreTasks) {
            const existing = await client.query('SELECT id FROM tasks WHERE title = $1', [t.title]);
            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO tasks (task_type, title, description, shipment_id, booking_id, assigned_to, deadline, status, priority)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                    [t.task_type, t.title, t.description, t.shipment_id, t.booking_id, t.assigned_to, t.deadline, t.status, t.priority]
                );
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Comprehensive sample data created successfully',
            summary: {
                customers: customers.length + moreCustomers.length,
                forwarders: forwarders.length + moreForwarders.length,
                shipments: shipments.length + moreShipments.length,
                bookings: bookings.length + moreBookings.length,
                documents: documentSets.reduce((sum, s) => sum + s.docs.length, 0) + moreDocumentSets.reduce((sum, s) => sum + s.docs.length, 0),
                invoices: invoices.length + moreInvoices.length,
                tasks: tasks.length + moreTasks.length,
                notifications: notifications.length,
                qcStaff: qcStaff.length,
                dispatches: dispatches.length,
                alerts: alerts.length
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Sample data error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;
