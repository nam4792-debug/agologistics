const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  console.log('🔧 Initializing PostgreSQL database...\n');

  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await pool.query(schema);

    console.log('✅ All tables created from schema.sql\n');
    console.log('🎉 Database initialization complete!\n');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = initDatabase;
