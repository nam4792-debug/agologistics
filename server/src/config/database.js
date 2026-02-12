const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false // Required for Render.com and most cloud providers
    } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle PostgreSQL client', err);
    process.exit(-1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await pool.end();
    console.log('👋 PostgreSQL pool has ended');
    process.exit(0);
});

module.exports = pool;
