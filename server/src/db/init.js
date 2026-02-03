const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  console.log('🔧 Initializing SQLite database...\n');

  try {
    // Create tables
    const { db } = require('../config/database');

    // Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'STAFF',
        department TEXT,
        phone TEXT,
        avatar_url TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Customers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        customer_code TEXT UNIQUE NOT NULL,
        company_name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        country TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Forwarders table
    db.exec(`
      CREATE TABLE IF NOT EXISTS forwarders (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        company_name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        grade TEXT DEFAULT 'B',
        on_time_rate REAL DEFAULT 0,
        doc_accuracy_rate REAL DEFAULT 0,
        cost_score REAL DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Shipments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS shipments (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        shipment_number TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'DRAFT',
        customer_id TEXT,
        forwarder_id TEXT,
        origin_port TEXT,
        destination_port TEXT,
        origin_country TEXT,
        destination_country TEXT,
        cargo_description TEXT,
        cargo_weight_kg REAL,
        cargo_volume_cbm REAL,
        container_count INTEGER DEFAULT 1,
        container_type TEXT,
        incoterm TEXT,
        etd TEXT,
        eta TEXT,
        atd TEXT,
        ata TEXT,
        total_cost_usd REAL DEFAULT 0,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Bookings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        booking_number TEXT UNIQUE NOT NULL,
        shipment_id TEXT,
        forwarder_id TEXT,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        vessel_flight TEXT,
        voyage_number TEXT,
        route TEXT,
        origin_port TEXT,
        destination_port TEXT,
        container_type TEXT,
        container_count INTEGER DEFAULT 1,
        etd TEXT,
        eta TEXT,
        freight_rate_usd REAL,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Booking deadlines table
    db.exec(`
      CREATE TABLE IF NOT EXISTS booking_deadlines (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        booking_id TEXT NOT NULL,
        cut_off_si TEXT NOT NULL,
        cut_off_vgm TEXT NOT NULL,
        cut_off_cy TEXT NOT NULL,
        sales_confirmed INTEGER DEFAULT 0,
        sales_confirmed_at TEXT,
        sales_confirmed_by TEXT,
        alert_sent_48h INTEGER DEFAULT 0,
        alert_sent_24h INTEGER DEFAULT 0,
        alert_sent_12h INTEGER DEFAULT 0,
        alert_sent_6h INTEGER DEFAULT 0,
        alert_sent_overdue INTEGER DEFAULT 0,
        status TEXT DEFAULT 'PENDING',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Notifications table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        user_id TEXT,
        type TEXT NOT NULL,
        priority TEXT DEFAULT 'MEDIUM',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        booking_id TEXT,
        shipment_id TEXT,
        action_url TEXT,
        action_label TEXT,
        is_read INTEGER DEFAULT 0,
        read_at TEXT,
        sent_email INTEGER DEFAULT 0,
        sent_push INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT
      )
    `);

    // Tasks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        booking_id TEXT,
        shipment_id TEXT,
        task_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to TEXT,
        deadline TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        priority TEXT DEFAULT 'MEDIUM',
        completed_at TEXT,
        completed_by TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Truck dispatches table
    db.exec(`
      CREATE TABLE IF NOT EXISTS truck_dispatches (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        booking_id TEXT NOT NULL,
        task_id TEXT,
        truck_company TEXT,
        driver_name TEXT,
        driver_phone TEXT,
        truck_plate TEXT,
        pickup_datetime TEXT NOT NULL,
        warehouse_location TEXT,
        status TEXT DEFAULT 'SCHEDULED',
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Documents table
    db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        shipment_id TEXT NOT NULL,
        document_type TEXT NOT NULL,
        document_number TEXT,
        version INTEGER DEFAULT 1,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size_bytes INTEGER,
        file_type TEXT,
        file_hash TEXT,
        issue_date TEXT,
        expiry_date TEXT,
        issuer TEXT,
        status TEXT DEFAULT 'UPLOADED',
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        deleted_at TEXT
      )
    `);

    // Alerts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
        shipment_id TEXT,
        booking_id TEXT,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'MEDIUM',
        title TEXT NOT NULL,
        description TEXT,
        is_resolved INTEGER DEFAULT 0,
        resolved_at TEXT,
        resolved_by TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    console.log('✅ All tables created\n');

    // Create default users
    const passwordHash = await bcrypt.hash('admin123', 10);

    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, full_name, role, department)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('user-admin-001', 'admin@logispro.vn', passwordHash, 'Admin User', 'ADMIN', 'IT');
    insertUser.run('user-logistics-001', 'logistics@logispro.vn', passwordHash, 'Logistics Manager', 'LOGISTICS_MANAGER', 'Logistics');
    insertUser.run('user-sales-001', 'sales@logispro.vn', passwordHash, 'Sales Coordinator', 'SALES', 'Sales');

    console.log('✅ Default users created:');
    console.log('   - admin@logispro.vn / admin123');
    console.log('   - logistics@logispro.vn / admin123');
    console.log('   - sales@logispro.vn / admin123\n');

    // Create sample forwarders
    const insertForwarder = db.prepare(`
      INSERT OR IGNORE INTO forwarders (id, company_name, contact_name, email, phone, grade, on_time_rate, doc_accuracy_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertForwarder.run('fwd-001', 'ABC Logistics', 'John Smith', 'john@abclogistics.com', '+84-28-1234-5678', 'A', 94.5, 98.2);
    insertForwarder.run('fwd-002', 'Global Shipping Co', 'Sarah Lee', 'sarah@globalshipping.com', '+84-28-2345-6789', 'A', 91.2, 95.8);
    insertForwarder.run('fwd-003', 'FastCargo VN', 'Minh Nguyen', 'minh@fastcargo.vn', '+84-28-3456-7890', 'B', 86.5, 92.1);

    console.log('✅ Sample forwarders created\n');

    // Create sample customers
    const insertCustomer = db.prepare(`
      INSERT OR IGNORE INTO customers (id, customer_code, company_name, contact_name, email, phone, country)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertCustomer.run('cust-001', 'CUST001', 'Chennai Fresh Foods', 'Raj Kumar', 'raj@chennaifresh.in', '+91-44-1234-5678', 'India');
    insertCustomer.run('cust-002', 'CUST002', 'Tokyo Fruits Import', 'Takeshi Honda', 'takeshi@tokyofruits.jp', '+81-3-1234-5678', 'Japan');
    insertCustomer.run('cust-003', 'CUST003', 'Dubai Premium Goods', 'Ahmed Al-Rashid', 'ahmed@dubaipremium.ae', '+971-4-1234-5678', 'UAE');

    console.log('✅ Sample customers created\n');

    // Create sample shipments
    const insertShipment = db.prepare(`
      INSERT OR IGNORE INTO shipments (id, shipment_number, type, status, customer_id, forwarder_id,
        origin_port, destination_port, origin_country, destination_country,
        cargo_description, cargo_weight_kg, container_count, container_type, incoterm, etd, eta, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertShipment.run('ship-001', 'A59FX15608', 'FCL', 'IN_TRANSIT', 'cust-001', 'fwd-001',
      'Ho Chi Minh City', 'Chennai', 'Vietnam', 'India',
      'Fresh Dragon Fruit', 18500, 1, '40RF', 'CIF', '2026-02-05', '2026-02-12', 'user-admin-001');

    console.log('✅ Sample shipments created\n');

    // Create sample bookings with deadlines
    const now = new Date();
    const insertBooking = db.prepare(`
      INSERT OR IGNORE INTO bookings (id, booking_number, shipment_id, forwarder_id, type, status,
        vessel_flight, voyage_number, route, origin_port, destination_port,
        container_type, container_count, etd, eta, freight_rate_usd, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertDeadline = db.prepare(`
      INSERT OR IGNORE INTO booking_deadlines (id, booking_id, cut_off_si, cut_off_vgm, cut_off_cy)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Booking with deadline 10 hours from now (for testing alerts)
    const deadline10h = new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString();
    const deadline12h = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
    const deadline18h = new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString();

    insertBooking.run('book-001', 'BK-2026-0146', 'ship-001', 'fwd-001', 'FCL', 'PENDING',
      'EVERGREEN EVER GIVEN', 'V.2609E', 'Ho Chi Minh → Tokyo', 'Ho Chi Minh City', 'Tokyo',
      '40RF', 1, '2026-02-04', '2026-02-08', 3200, 'user-admin-001');

    insertDeadline.run('dl-001', 'book-001', deadline10h, deadline12h, deadline18h);

    console.log('✅ Sample bookings with deadlines created');
    console.log('   ⏰ Deadline in ~10 hours (for testing alerts)\n');

    console.log('🎉 Database initialization complete!\n');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
