-- ============================================
-- COMPREHENSIVE SAMPLE DATA FOR AGO LOGISTICS
-- ============================================

-- 1. CUSTOMERS
INSERT INTO customers (id, customer_code, company_name, contact_name, email, phone, address, country, status) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'CUS-DALAT', 'Da Lat Fresh Vegetables Co.', 'Tran Minh Hieu', 'hieu@dalatfresh.vn', '+84 263 3820 456', '88 Phan Dinh Phung, Da Lat', 'Vietnam', 'ACTIVE'),
  ('c2000000-0000-0000-0000-000000000002', 'CUS-SEAFOOD', 'Mekong Seafood Processing JSC', 'Le Thi Huong', 'huong@mekongseafood.vn', '+84 292 3891 234', '12 Nguyen Trai, Can Tho', 'Vietnam', 'ACTIVE'),
  ('c2000000-0000-0000-0000-000000000003', 'CUS-CACAO', 'Highland Cacao & Coffee Ltd.', 'Pham Quoc Bao', 'bao@highlandcacao.vn', '+84 262 3710 789', '45 Tran Phu, Buon Ma Thuot', 'Vietnam', 'ACTIVE')
ON CONFLICT (customer_code) DO NOTHING;

-- 2. FORWARDERS
INSERT INTO forwarders (id, company_name, contact_name, email, phone, grade, on_time_rate, doc_accuracy_rate, cost_score, status, provider_code, credit_limit_monthly) VALUES
  ('f2000000-0000-0000-0000-000000000001', 'Evergreen Logistics Vietnam', 'Nguyen Van Long', 'long@evergreenlogistics.vn', '+84 28 3930 2222', 'A', 96.50, 98.00, 92.00, 'ACTIVE', 'EVGR', 150000.00),
  ('f2000000-0000-0000-0000-000000000002', 'OOCL Vietnam Co. Ltd.', 'Tran Quang Huy', 'huy@ooclvn.com', '+84 28 3821 5678', 'B', 88.00, 91.50, 85.00, 'ACTIVE', 'OOCL', 100000.00),
  ('f2000000-0000-0000-0000-000000000003', 'Local Freight Express', 'Hoang Thanh Son', 'son@localfreight.vn', '+84 28 3820 9999', 'C', 72.00, 78.50, 70.00, 'ACTIVE', 'LFE', 50000.00)
ON CONFLICT DO NOTHING;

-- 3. UPDATE existing shipment with richer data
UPDATE shipments SET
  cargo_weight_kg = 18500, cargo_volume_cbm = 32.5,
  cargo_description = 'Fresh Dragon Fruit - Grade A Premium Export',
  container_type = '40RF', container_count = 1, incoterm = 'FOB',
  origin_port = 'Cat Lai, HCMC', destination_port = 'Yokohama, Japan',
  origin_country = 'Vietnam', destination_country = 'Japan',
  etd = CURRENT_DATE + INTERVAL '14 days', eta = CURRENT_DATE + INTERVAL '21 days'
WHERE id = 'a1d43d79-19c7-4a1f-a745-7bed42362564';

-- 4. NEW SHIPMENTS
INSERT INTO shipments (id, shipment_number, type, status, customer_id, forwarder_id, origin_port, destination_port, origin_country, destination_country, cargo_description, cargo_weight_kg, cargo_volume_cbm, container_count, container_type, incoterm, etd, eta, atd, ata, total_cost_usd, notes) VALUES
  ('a2000000-0000-0000-0000-000000000002', 'SHP-INTRANSIT01', 'FCL', 'IN_TRANSIT',
   'c2000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001',
   'Cat Lai, HCMC', 'Rotterdam, Netherlands', 'Vietnam', 'Netherlands',
   'Fresh Baby Spinach & Herbs - Vacuum Packed',
   12000, 28.0, 1, '40RF', 'CIF',
   CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '18 days',
   CURRENT_DATE - INTERVAL '9 days', NULL, 8500.00,
   'Temperature: 2-4°C. Urgent delivery for EU supermarket chain.')
ON CONFLICT DO NOTHING;

INSERT INTO shipments (id, shipment_number, type, status, customer_id, forwarder_id, origin_port, destination_port, origin_country, destination_country, cargo_description, cargo_weight_kg, cargo_volume_cbm, container_count, container_type, incoterm, etd, eta, atd, ata, total_cost_usd) VALUES
  ('a2000000-0000-0000-0000-000000000003', 'SHP-CUSTOMS01', 'FCL', 'CUSTOMS_CLEARED',
   'c2000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002',
   'Cat Lai, HCMC', 'Busan, South Korea', 'Vietnam', 'South Korea',
   'Frozen Black Tiger Shrimp - 26/30 Count',
   22000, 35.0, 2, '40RF', 'FOB',
   CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE - INTERVAL '3 days',
   CURRENT_DATE - INTERVAL '24 days', CURRENT_DATE - INTERVAL '4 days', 12800.00)
ON CONFLICT DO NOTHING;

INSERT INTO shipments (id, shipment_number, type, status, customer_id, origin_port, destination_port, origin_country, destination_country, cargo_description, cargo_weight_kg, cargo_volume_cbm, container_count, container_type, incoterm, etd, eta, atd, ata, total_cost_usd) VALUES
  ('a2000000-0000-0000-0000-000000000004', 'SHP-COMPLETED01', 'FCL', 'COMPLETED',
   'c2000000-0000-0000-0000-000000000003',
   'Da Nang Port', 'Hamburg, Germany', 'Vietnam', 'Germany',
   'Fine Robusta Coffee Beans - Screen 18',
   25000, 42.0, 2, '40GP', 'CFR',
   CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '30 days',
   CURRENT_DATE - INTERVAL '59 days', CURRENT_DATE - INTERVAL '29 days', 9200.00)
ON CONFLICT DO NOTHING;

INSERT INTO shipments (id, shipment_number, type, status, customer_id, forwarder_id, origin_port, destination_port, origin_country, destination_country, cargo_description, cargo_weight_kg, cargo_volume_cbm, container_count, container_type, incoterm, etd, eta, total_cost_usd) VALUES
  ('a2000000-0000-0000-0000-000000000005', 'SHP-BOOKED01', 'LCL', 'BOOKED',
   'c2000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000003',
   'Cat Lai, HCMC', 'Los Angeles, USA', 'Vietnam', 'United States',
   'Organic Cacao Nibs - Fair Trade Certified',
   5400, 8.2, 1, '20GP', 'FOB',
   CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '35 days', 4200.00)
ON CONFLICT DO NOTHING;

-- 5. BOOKINGS
INSERT INTO bookings (id, booking_number, shipment_id, forwarder_id, type, status, vessel_flight, voyage_number, route, origin_port, destination_port, container_type, container_count, etd, eta, freight_rate_usd, shipping_line, notes, created_by) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'BKG-EVGR-2026-001',
   'a2000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000001',
   'FCL', 'CONFIRMED', 'EVER GIVEN', 'V.2026W03', 'HCMC → Singapore → Rotterdam',
   'Cat Lai, HCMC', 'Rotterdam, Netherlands', '40RF', 1,
   CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '18 days',
   4200.00, 'Evergreen Marine', 'Reefer booking confirmed. Temperature monitoring active.',
   '07d793bd-17ba-49ae-85cc-5016062efd58'),

  ('b2000000-0000-0000-0000-000000000002', 'BKG-OOCL-2026-015',
   'a1d43d79-19c7-4a1f-a745-7bed42362564', 'f2000000-0000-0000-0000-000000000002',
   'FCL', 'PENDING', 'OOCL TOKYO', 'V.038E', 'HCMC → Hong Kong → Yokohama',
   'Cat Lai, HCMC', 'Yokohama, Japan', '40RF', 1,
   CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '21 days',
   3800.00, 'OOCL', 'Awaiting confirmation. Dragon fruit requires 5-8°C.',
   '07d793bd-17ba-49ae-85cc-5016062efd58'),

  ('b2000000-0000-0000-0000-000000000003', 'BKG-OOCL-2026-008',
   'a2000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002',
   'FCL', 'ALLOCATED', 'HMM ALGECIRAS', 'V.112S', 'HCMC → Busan',
   'Cat Lai, HCMC', 'Busan, South Korea', '40RF', 2,
   CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE - INTERVAL '3 days',
   5600.00, 'HMM', 'Two reefer containers. Frozen shrimp at -18°C.',
   '07d793bd-17ba-49ae-85cc-5016062efd58'),

  ('b2000000-0000-0000-0000-000000000004', 'BKG-EVGR-2025-089',
   'a2000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000001',
   'FCL', 'USED', 'COSCO SHIPPING ALPS', 'V.055W', 'Da Nang → Singapore → Hamburg',
   'Da Nang Port', 'Hamburg, Germany', '40GP', 2,
   CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '30 days',
   3800.00, 'COSCO', 'Completed. All documents received.',
   '07d793bd-17ba-49ae-85cc-5016062efd58'),

  ('b2000000-0000-0000-0000-000000000005', 'BKG-LFE-2026-003',
   'a2000000-0000-0000-0000-000000000005', 'f2000000-0000-0000-0000-000000000003',
   'LCL', 'PENDING', 'TBD', NULL, NULL,
   'Cat Lai, HCMC', 'Los Angeles, USA', '20GP', 1,
   CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '35 days',
   1800.00, 'Yang Ming', 'LCL consolidation. No temperature requirement.',
   '07d793bd-17ba-49ae-85cc-5016062efd58')
ON CONFLICT DO NOTHING;

-- 6. BOOKING DEADLINES
INSERT INTO booking_deadlines (id, booking_id, cut_off_si, cut_off_vgm, cut_off_cy, sales_confirmed) VALUES
  ('bd200000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE - INTERVAL '11 days', true),
  ('bd200000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', CURRENT_DATE + INTERVAL '8 days', CURRENT_DATE + INTERVAL '9 days', CURRENT_DATE + INTERVAL '10 days', false),
  ('bd200000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '28 days', CURRENT_DATE - INTERVAL '27 days', CURRENT_DATE - INTERVAL '26 days', true),
  ('bd200000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004', CURRENT_DATE - INTERVAL '63 days', CURRENT_DATE - INTERVAL '62 days', CURRENT_DATE - INTERVAL '61 days', true),
  ('bd200000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000005', CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE + INTERVAL '5 days', false)
ON CONFLICT DO NOTHING;

-- 7. DOCUMENTS (with file_path NOT NULL)
INSERT INTO documents (id, shipment_id, booking_id, document_type, document_number, file_name, file_path, version, status, created_at) VALUES
  ('d2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'COMMERCIAL_INVOICE', 'CI-DLAT-2026-001', 'commercial_invoice_dalat_spinach.pdf', 'uploads/documents/commercial_invoice_dalat_spinach.pdf', 1, 'APPROVED', NOW() - INTERVAL '12 days'),
  ('d2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'PACKING_LIST', 'PL-DLAT-2026-001', 'packing_list_dalat_spinach.pdf', 'uploads/documents/packing_list_dalat_spinach.pdf', 1, 'APPROVED', NOW() - INTERVAL '12 days'),
  ('d2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'BILL_OF_LADING', 'BL-EVGR-2026W03', 'bill_of_lading_ever_given.pdf', 'uploads/documents/bill_of_lading_ever_given.pdf', 1, 'CHECKED', NOW() - INTERVAL '10 days'),
  ('d2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'PHYTOSANITARY', 'PHYTO-VN-2026-4451', 'phytosanitary_certificate.pdf', 'uploads/documents/phytosanitary_certificate.pdf', 1, 'APPROVED', NOW() - INTERVAL '11 days'),
  ('d2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'CERTIFICATE_OF_ORIGIN', 'CO-VN-2026-8821', 'certificate_of_origin.pdf', 'uploads/documents/certificate_of_origin.pdf', 1, 'CHECKED', NOW() - INTERVAL '11 days'),
  ('d2000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', 'COMMERCIAL_INVOICE', 'CI-MKS-2026-045', 'commercial_invoice_mekong_shrimp.pdf', 'uploads/documents/commercial_invoice_mekong_shrimp.pdf', 1, 'APPROVED', NOW() - INTERVAL '27 days'),
  ('d2000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', 'PACKING_LIST', 'PL-MKS-2026-045', 'packing_list_mekong_shrimp.pdf', 'uploads/documents/packing_list_mekong_shrimp.pdf', 1, 'APPROVED', NOW() - INTERVAL '27 days'),
  ('d2000000-0000-0000-0000-000000000008', 'a2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', 'BILL_OF_LADING', 'BL-HMM-112S-01', 'bill_of_lading_hmm.pdf', 'uploads/documents/bill_of_lading_hmm.pdf', 1, 'CHECKED', NOW() - INTERVAL '25 days'),
  ('d2000000-0000-0000-0000-000000000009', 'a2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', 'CUSTOMS_DECLARATION', 'CD-KR-2026-1102', 'customs_declaration_busan.pdf', 'uploads/documents/customs_declaration_busan.pdf', 1, 'PENDING', NOW() - INTERVAL '5 days'),
  ('d2000000-0000-0000-0000-000000000010', 'a2000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004', 'COMMERCIAL_INVOICE', 'CI-HLC-2025-112', 'commercial_invoice_highland_coffee.pdf', 'uploads/documents/commercial_invoice_highland_coffee.pdf', 1, 'APPROVED', NOW() - INTERVAL '62 days'),
  ('d2000000-0000-0000-0000-000000000011', 'a2000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004', 'PACKING_LIST', 'PL-HLC-2025-112', 'packing_list_highland_coffee.pdf', 'uploads/documents/packing_list_highland_coffee.pdf', 1, 'APPROVED', NOW() - INTERVAL '62 days'),
  ('d2000000-0000-0000-0000-000000000012', 'a2000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004', 'BILL_OF_LADING', 'BL-COSCO-055W', 'bill_of_lading_cosco.pdf', 'uploads/documents/bill_of_lading_cosco.pdf', 1, 'APPROVED', NOW() - INTERVAL '59 days'),
  ('d2000000-0000-0000-0000-000000000013', 'a2000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004', 'CERTIFICATE_OF_ORIGIN', 'CO-VN-2025-7789', 'certificate_of_origin_coffee.pdf', 'uploads/documents/certificate_of_origin_coffee.pdf', 1, 'APPROVED', NOW() - INTERVAL '61 days'),
  ('d2000000-0000-0000-0000-000000000014', 'a2000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004', 'INSURANCE', 'INS-TKM-2025-445', 'insurance_certificate_coffee.pdf', 'uploads/documents/insurance_certificate_coffee.pdf', 1, 'APPROVED', NOW() - INTERVAL '60 days')
ON CONFLICT DO NOTHING;

-- 8. INVOICES
DELETE FROM invoices WHERE invoice_number = 'INV-TEST-001';

INSERT INTO invoices (id, invoice_number, shipment_id, forwarder_id, vendor_name, invoice_date, due_date, amount_usd, currency, status, category, notes) VALUES
  ('e2000000-0000-0000-0000-000000000001', 'INV-EVGR-2026-001', 'a2000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000001', 'Evergreen Logistics Vietnam', CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE + INTERVAL '22 days', 4200.00, 'USD', 'PENDING', 'FREIGHT', 'Ocean freight - 40RF HCMC to Rotterdam'),
  ('e2000000-0000-0000-0000-000000000002', 'INV-EVGR-2026-002', 'a2000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000001', 'Evergreen Logistics Vietnam', CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE + INTERVAL '22 days', 1350.00, 'USD', 'APPROVED', 'LOCAL_CHARGES', 'Local: THC, Seal, Doc fee, VGM'),
  ('e2000000-0000-0000-0000-000000000003', 'INV-OOCL-2026-008', 'a2000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 'OOCL Vietnam Co. Ltd.', CURRENT_DATE - INTERVAL '26 days', CURRENT_DATE - INTERVAL '1 day', 5600.00, 'USD', 'APPROVED', 'FREIGHT', 'Ocean freight - 2x 40RF to Busan'),
  ('e2000000-0000-0000-0000-000000000004', 'INV-EVGR-2025-089', 'a2000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000001', 'Evergreen Logistics Vietnam', CURRENT_DATE - INTERVAL '55 days', CURRENT_DATE - INTERVAL '25 days', 3800.00, 'USD', 'PAID', 'FREIGHT', 'PAID via TT - Hamburg freight'),
  ('e2000000-0000-0000-0000-000000000005', 'INV-OOCL-2026-009', 'a2000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 'OOCL Vietnam Co. Ltd.', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '5 days', 2800.00, 'USD', 'PENDING', 'LOCAL_CHARGES', 'OVERDUE: Local charges Busan + Cold storage')
ON CONFLICT DO NOTHING;

-- 9. TASKS
INSERT INTO tasks (id, booking_id, shipment_id, task_type, title, description, assigned_to, deadline, status, priority) VALUES
  ('12000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'a1d43d79-19c7-4a1f-a745-7bed42362564', 'SI_SUBMISSION', 'Submit SI for BKG-OOCL-2026-015', 'Prepare and submit SI to OOCL for Dragon Fruit to Yokohama.', 'd5f7dfb3-6c0b-4986-a11b-a49a1f75a967', CURRENT_DATE + INTERVAL '7 days', 'PENDING', 'HIGH'),
  ('12000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'a1d43d79-19c7-4a1f-a745-7bed42362564', 'VGM_SUBMISSION', 'Submit VGM for Dragon Fruit container', 'Weigh loaded container and submit VGM via Portnet.', 'd5f7dfb3-6c0b-4986-a11b-a49a1f75a967', CURRENT_DATE + INTERVAL '9 days', 'PENDING', 'HIGH'),
  ('12000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000005', 'TRUCK_DISPATCH', 'Arrange trucking: Dak Lak to Cat Lai', 'Pickup cacao nibs from Highland warehouse to Cat Lai port.', '07d793bd-17ba-49ae-85cc-5016062efd58', CURRENT_DATE + INTERVAL '4 days', 'PENDING', 'MEDIUM'),
  ('12000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000003', 'CUSTOMS_FOLLOWUP', 'Arrange delivery for Shrimp at Busan', 'Customs cleared. Coordinate final delivery to cold storage.', 'd5f7dfb3-6c0b-4986-a11b-a49a1f75a967', CURRENT_DATE + INTERVAL '2 days', 'IN_PROGRESS', 'HIGH'),
  ('12000000-0000-0000-0000-000000000006', 'b2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000005', 'SI_SUBMISSION', 'OVERDUE: Submit SI for Cacao Nibs', 'SI cut-off approaching! Submit to Yang Ming immediately.', 'd5f7dfb3-6c0b-4986-a11b-a49a1f75a967', CURRENT_DATE + INTERVAL '1 day', 'PENDING', 'CRITICAL')
ON CONFLICT DO NOTHING;

INSERT INTO tasks (id, booking_id, shipment_id, task_type, title, description, assigned_to, deadline, status, priority, completed_at, completed_by) VALUES
  ('12000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000004', 'DOC_COLLECTION', 'Collect original B/L from COSCO', 'Original Bill of Lading collected from COSCO Da Nang.', '07d793bd-17ba-49ae-85cc-5016062efd58', CURRENT_DATE - INTERVAL '58 days', 'COMPLETED', 'MEDIUM', CURRENT_DATE - INTERVAL '59 days', '07d793bd-17ba-49ae-85cc-5016062efd58')
ON CONFLICT DO NOTHING;

-- 10. TRUCK DISPATCHES
INSERT INTO truck_dispatches (id, booking_id, shipment_id, truck_company, driver_name, driver_phone, truck_plate, pickup_datetime, warehouse_location, status, notes, created_by) VALUES
  ('1d200000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'Saigon Express Trucking', 'Vo Van Toan', '+84 909 123 456', '51C-123.45', CURRENT_DATE - INTERVAL '11 days', 'Da Lat Fresh warehouse - 88 Phan Dinh Phung', 'COMPLETED', 'Picked up 12 pallets. Arrived Cat Lai 06:30.', '07d793bd-17ba-49ae-85cc-5016062efd58'),
  ('1d200000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000005', 'Highland Transport Co.', 'Nguyen Duc Manh', '+84 907 654 321', '47C-888.99', CURRENT_DATE + INTERVAL '4 days', 'Highland Cacao - 45 Tran Phu, BMT', 'SCHEDULED', 'Pickup cacao nibs. Est. 8 hours to Cat Lai.', '07d793bd-17ba-49ae-85cc-5016062efd58')
ON CONFLICT DO NOTHING;

-- 11. ALERTS
INSERT INTO alerts (id, shipment_id, booking_id, type, severity, title, description, is_resolved) VALUES
  ('a1200000-0000-0000-0000-000000000001', 'a1d43d79-19c7-4a1f-a745-7bed42362564', 'b2000000-0000-0000-0000-000000000002', 'DEADLINE_WARNING', 'HIGH', 'SI Cut-off approaching: BKG-OOCL-2026-015', 'SI cut-off in 8 days for Dragon Fruit to Yokohama.', false),
  ('a1200000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', 'INVOICE_OVERDUE', 'CRITICAL', 'OVERDUE: INV-OOCL-2026-009', 'Invoice $2,800 is 5 days past due. OOCL may hold containers.', false),
  ('a1200000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000005', 'MISSING_DOCUMENT', 'HIGH', 'Missing docs for Cacao to LA', 'No CI, PL, or CO uploaded. SI cut-off in 3 days!', false)
ON CONFLICT DO NOTHING;

INSERT INTO alerts (id, shipment_id, booking_id, type, severity, title, description, is_resolved, resolved_at, resolved_by) VALUES
  ('a1200000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'TEMPERATURE_ALERT', 'MEDIUM', 'Temperature spike on EVER GIVEN', 'Reefer reported 6.2°C at Singapore (target 2-4°C). Auto-corrected.', true, NOW() - INTERVAL '7 days', '07d793bd-17ba-49ae-85cc-5016062efd58')
ON CONFLICT DO NOTHING;

-- 12. NOTIFICATIONS
INSERT INTO notifications (id, user_id, type, priority, title, message, shipment_id, booking_id, action_url, action_label, is_read) VALUES
  (uuid_generate_v4(), '07d793bd-17ba-49ae-85cc-5016062efd58', 'DEADLINE', 'HIGH', 'SI Cut-off in 8 days', 'BKG-OOCL-2026-015: Submit SI for Dragon Fruit to Yokohama.', 'a1d43d79-19c7-4a1f-a745-7bed42362564', 'b2000000-0000-0000-0000-000000000002', '/shipments/a1d43d79-19c7-4a1f-a745-7bed42362564', 'View Shipment', false),
  (uuid_generate_v4(), '07d793bd-17ba-49ae-85cc-5016062efd58', 'INVOICE', 'CRITICAL', 'OVERDUE: INV-OOCL-2026-009', 'Local charges $2,800 for Busan shrimp is 5 days overdue.', 'a2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', '/invoices', 'View Invoices', false),
  (uuid_generate_v4(), '07d793bd-17ba-49ae-85cc-5016062efd58', 'SHIPMENT', 'MEDIUM', 'Shipment arrived at Busan', 'SHP-CUSTOMS01 arrived. Customs clearance in progress.', 'a2000000-0000-0000-0000-000000000003', NULL, '/shipments/a2000000-0000-0000-0000-000000000003', 'View Shipment', false),
  (uuid_generate_v4(), '07d793bd-17ba-49ae-85cc-5016062efd58', 'TASK', 'HIGH', 'New task: Arrange trucking', 'Arrange truck for Cacao from Buon Ma Thuot to Cat Lai.', 'a2000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000005', '/shipments/a2000000-0000-0000-0000-000000000005', 'View Shipment', false),
  (uuid_generate_v4(), '07d793bd-17ba-49ae-85cc-5016062efd58', 'DOCUMENT', 'LOW', 'B/L uploaded for EVER GIVEN', 'BL-EVGR-2026W03 uploaded for spinach to Rotterdam.', 'a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', '/shipments/a2000000-0000-0000-0000-000000000002', 'View Shipment', true);

-- 13. SHIPMENT REVENUE
INSERT INTO shipment_revenue (id, shipment_id, description, amount, currency, amount_usd) VALUES
  (uuid_generate_v4(), 'a2000000-0000-0000-0000-000000000004', 'Ocean freight revenue - Coffee to Hamburg', 9200.00, 'USD', 9200.00),
  (uuid_generate_v4(), 'a2000000-0000-0000-0000-000000000004', 'Documentation handling fee', 250.00, 'USD', 250.00)
ON CONFLICT DO NOTHING;

-- 14. AUDIT LOG
INSERT INTO audit_log (id, entity_type, entity_id, action, user_id, changes, created_at) VALUES
  (uuid_generate_v4(), 'shipment', 'a2000000-0000-0000-0000-000000000002', 'CREATE', '07d793bd-17ba-49ae-85cc-5016062efd58', '{"shipment_number": "SHP-INTRANSIT01", "cargo": "Fresh Baby Spinach & Herbs"}'::jsonb, NOW() - INTERVAL '14 days'),
  (uuid_generate_v4(), 'shipment', 'a2000000-0000-0000-0000-000000000002', 'STATUS_CHANGE', '07d793bd-17ba-49ae-85cc-5016062efd58', '{"shipment_number": "SHP-INTRANSIT01", "status": {"old": "DRAFT", "new": "IN_TRANSIT"}}'::jsonb, NOW() - INTERVAL '9 days'),
  (uuid_generate_v4(), 'booking', 'b2000000-0000-0000-0000-000000000001', 'STATUS_CHANGE', '07d793bd-17ba-49ae-85cc-5016062efd58', '{"booking_number": "BKG-EVGR-2026-001", "status": {"old": "PENDING", "new": "CONFIRMED"}}'::jsonb, NOW() - INTERVAL '14 days'),
  (uuid_generate_v4(), 'shipment', 'a2000000-0000-0000-0000-000000000004', 'STATUS_CHANGE', '07d793bd-17ba-49ae-85cc-5016062efd58', '{"shipment_number": "SHP-COMPLETED01", "status": {"old": "DELIVERED", "new": "COMPLETED"}}'::jsonb, NOW() - INTERVAL '28 days'),
  (uuid_generate_v4(), 'invoice', 'e2000000-0000-0000-0000-000000000004', 'STATUS_CHANGE', '07d793bd-17ba-49ae-85cc-5016062efd58', '{"invoice_number": "INV-EVGR-2025-089", "status": {"old": "APPROVED", "new": "PAID"}, "amount": 3800.00}'::jsonb, NOW() - INTERVAL '25 days');

-- SUMMARY
SELECT 'Customers' as entity, COUNT(*) as count FROM customers
UNION ALL SELECT 'Forwarders', COUNT(*) FROM forwarders
UNION ALL SELECT 'Shipments', COUNT(*) FROM shipments
UNION ALL SELECT 'Bookings', COUNT(*) FROM bookings
UNION ALL SELECT 'Deadlines', COUNT(*) FROM booking_deadlines
UNION ALL SELECT 'Documents', COUNT(*) FROM documents WHERE deleted_at IS NULL
UNION ALL SELECT 'Invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'Tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'Dispatches', COUNT(*) FROM truck_dispatches
UNION ALL SELECT 'Alerts', COUNT(*) FROM alerts
UNION ALL SELECT 'Notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'Audit Log', COUNT(*) FROM audit_log
ORDER BY entity;
