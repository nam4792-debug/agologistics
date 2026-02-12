-- LogisPro Database Schema
-- Run this file to create all required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role VARCHAR(50) DEFAULT 'STAFF',
  department VARCHAR(100),
  phone VARCHAR(20),
  avatar_url TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code VARCHAR(50) UNIQUE NOT NULL,
  company_name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  country VARCHAR(100),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- QC STAFF TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS qc_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_code VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role VARCHAR(100) DEFAULT 'QC Inspector',
  email VARCHAR(255),
  phone VARCHAR(20),
  department VARCHAR(100),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- FORWARDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS forwarders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  grade CHAR(1) DEFAULT 'B',
  on_time_rate DECIMAL(5,2) DEFAULT 0,
  doc_accuracy_rate DECIMAL(5,2) DEFAULT 0,
  cost_score DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SHIPMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_number VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL, -- FCL, LCL, AIR
  status VARCHAR(50) DEFAULT 'DRAFT',
  
  customer_id UUID REFERENCES customers(id),
  forwarder_id UUID REFERENCES forwarders(id),
  
  origin_port VARCHAR(100),
  destination_port VARCHAR(100),
  origin_country VARCHAR(100),
  destination_country VARCHAR(100),
  
  cargo_description TEXT,
  cargo_weight_kg DECIMAL(12,2),
  cargo_volume_cbm DECIMAL(10,3),
  container_count INTEGER DEFAULT 1,
  container_type VARCHAR(20),
  
  incoterm VARCHAR(10),
  
  etd DATE,
  eta DATE,
  atd DATE,
  ata DATE,
  
  total_cost_usd DECIMAL(15,2) DEFAULT 0,
  
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_customer ON shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_number ON shipments(shipment_number);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_number VARCHAR(50) UNIQUE NOT NULL,
  shipment_id UUID REFERENCES shipments(id),
  forwarder_id UUID REFERENCES forwarders(id),
  
  type VARCHAR(20) NOT NULL, -- FCL, AIR
  status VARCHAR(50) DEFAULT 'PENDING',
  
  vessel_flight VARCHAR(100),
  voyage_number VARCHAR(50),
  route VARCHAR(200),
  
  origin_port VARCHAR(100),
  destination_port VARCHAR(100),
  
  container_type VARCHAR(20),
  container_count INTEGER DEFAULT 1,
  
  etd DATE,
  eta DATE,
  
  freight_rate_usd DECIMAL(12,2),
  
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_shipment ON bookings(shipment_id);

-- ============================================
-- BOOKING DEADLINES TABLE (Key for alerts)
-- ============================================
CREATE TABLE IF NOT EXISTS booking_deadlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  cut_off_si TIMESTAMP,
  cut_off_vgm TIMESTAMP,
  cut_off_cy TIMESTAMP,
  
  sales_confirmed BOOLEAN DEFAULT false,
  sales_confirmed_at TIMESTAMP,
  sales_confirmed_by UUID REFERENCES users(id),
  
  -- Alert tracking flags
  alert_sent_48h BOOLEAN DEFAULT false,
  alert_sent_24h BOOLEAN DEFAULT false,
  alert_sent_12h BOOLEAN DEFAULT false,
  alert_sent_6h BOOLEAN DEFAULT false,
  alert_sent_overdue BOOLEAN DEFAULT false,
  
  status VARCHAR(50) DEFAULT 'PENDING',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_deadlines_status ON booking_deadlines(status);
CREATE INDEX IF NOT EXISTS idx_booking_deadlines_booking ON booking_deadlines(booking_id);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'MEDIUM',
  
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  
  booking_id UUID REFERENCES bookings(id),
  shipment_id UUID REFERENCES shipments(id),
  
  action_url TEXT,
  action_label VARCHAR(100),
  
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  
  sent_email BOOLEAN DEFAULT false,
  sent_push BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id),
  shipment_id UUID REFERENCES shipments(id),
  
  task_type VARCHAR(50) NOT NULL, -- TRUCK_DISPATCH, DOCUMENT_PREP, etc.
  title VARCHAR(200) NOT NULL,
  description TEXT,
  
  assigned_to UUID REFERENCES users(id),
  deadline TIMESTAMP NOT NULL,
  
  status VARCHAR(50) DEFAULT 'PENDING',
  priority VARCHAR(20) DEFAULT 'MEDIUM',
  
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_booking ON tasks(booking_id);

-- ============================================
-- TRUCK DISPATCHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS truck_dispatches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  task_id UUID REFERENCES tasks(id),
  
  truck_company VARCHAR(200),
  driver_name VARCHAR(100),
  driver_phone VARCHAR(20),
  truck_plate VARCHAR(20),
  
  pickup_datetime TIMESTAMP NOT NULL,
  warehouse_location VARCHAR(200),
  
  status VARCHAR(50) DEFAULT 'SCHEDULED',
  notes TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_truck_dispatches_booking ON truck_dispatches(booking_id);
CREATE INDEX IF NOT EXISTS idx_truck_dispatches_status ON truck_dispatches(status);

-- ============================================
-- DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  
  document_type VARCHAR(50) NOT NULL,
  document_number VARCHAR(100),
  version INTEGER DEFAULT 1,
  
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT,
  file_type VARCHAR(50),
  file_hash VARCHAR(64),
  
  issue_date DATE,
  expiry_date DATE,
  issuer VARCHAR(200),
  
  status VARCHAR(50) DEFAULT 'UPLOADED',
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- Soft delete
);

CREATE INDEX IF NOT EXISTS idx_documents_shipment ON documents(shipment_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID REFERENCES shipments(id),
  
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  vendor_name VARCHAR(200),
  
  amount_usd DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  issue_date DATE,
  due_date DATE,
  paid_date DATE,
  
  status VARCHAR(50) DEFAULT 'PENDING',
  category VARCHAR(50),
  
  has_discrepancy BOOLEAN DEFAULT false,
  discrepancy_notes TEXT,
  
  file_path TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_shipment ON invoices(shipment_id);

-- ============================================
-- ALERTS TABLE (for risk dashboard)
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID REFERENCES shipments(id),
  booking_id UUID REFERENCES bookings(id),
  
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'MEDIUM',
  
  title VARCHAR(200) NOT NULL,
  description TEXT,
  
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(is_resolved);

-- ============================================
-- SYNC STATUS TABLE (Google Drive integration)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_status (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL, -- 'google_drive'
  connected INTEGER DEFAULT 0,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TEXT,
  last_sync TEXT,
  root_folder_id TEXT,
  created_at TEXT DEFAULT (NOW())
);

-- ============================================
-- BACKUPS TABLE (Cloud backup history)
-- ============================================
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  file_id TEXT NOT NULL, -- Cloud provider file ID
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  backup_type TEXT, -- 'database' | 'documents'
  created_at TEXT DEFAULT (NOW())
);

CREATE INDEX IF NOT EXISTS idx_backups_provider ON backups(provider);
CREATE INDEX IF NOT EXISTS idx_backups_type ON backups(backup_type);

-- ============================================
-- DOCUMENT SYNC TABLE (Track synced documents)
-- ============================================
CREATE TABLE IF NOT EXISTS document_sync (
  document_id TEXT PRIMARY KEY,
  drive_file_id TEXT,
  synced_at TEXT
);

-- ============================================
-- LICENSE MANAGEMENT TABLES
-- ============================================

-- LICENSE KEYS TABLE
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_key VARCHAR(100) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) DEFAULT 'STANDARD', -- TRIAL, STANDARD, PREMIUM
  max_devices INTEGER DEFAULT 1, -- Device-based: 1 license = 1 device
  expires_at TIMESTAMP,
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  revoked_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(revoked, expires_at);

-- DEVICE ACTIVATIONS TABLE
CREATE TABLE IF NOT EXISTS device_activations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_key VARCHAR(100) REFERENCES licenses(license_key) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(200) UNIQUE NOT NULL, -- Hardware fingerprint (CPU + Motherboard hash)
  device_name VARCHAR(200), -- Computer name
  os_info VARCHAR(100), -- Windows 11, macOS 14.2, etc.
  activated_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_device_activations_license ON device_activations(license_key);
CREATE INDEX IF NOT EXISTS idx_device_activations_device ON device_activations(device_id);
CREATE INDEX IF NOT EXISTS idx_device_activations_user ON device_activations(user_id);

-- ADMIN WHITELIST TABLE (Hardware-locked admin access)
CREATE TABLE IF NOT EXISTS admin_whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id VARCHAR(200) UNIQUE NOT NULL, -- Whitelisted machine ID
  device_name VARCHAR(200),
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_whitelist_device ON admin_whitelist(device_id, revoked);
