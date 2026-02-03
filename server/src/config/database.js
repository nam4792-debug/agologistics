const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'logispro.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

console.log(`📦 Connected to SQLite: ${dbPath}`);

// Helper to run queries similar to pg pool
const pool = {
    query: (sql, params = []) => {
        try {
            // Check if it's a SELECT or RETURNING query
            const isSelect = sql.trim().toUpperCase().startsWith('SELECT') ||
                sql.toUpperCase().includes('RETURNING');

            // Replace $1, $2 placeholders with ? for SQLite
            let sqliteSql = sql;
            let paramIndex = 1;
            while (sqliteSql.includes(`$${paramIndex}`)) {
                sqliteSql = sqliteSql.replace(`$${paramIndex}`, '?');
                paramIndex++;
            }

            // Remove PostgreSQL-specific syntax
            sqliteSql = sqliteSql
                .replace(/ON CONFLICT \(.*?\) DO NOTHING/gi, 'ON CONFLICT DO NOTHING')
                .replace(/ON CONFLICT DO UPDATE[^;]*/gi, 'ON CONFLICT DO NOTHING')
                .replace(/uuid_generate_v4\(\)/gi, "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))")
                .replace(/gen_random_uuid\(\)/gi, "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))")
                .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
                .replace(/BIGSERIAL/gi, 'INTEGER')
                .replace(/TIMESTAMP DEFAULT NOW\(\)/gi, "TEXT DEFAULT (datetime('now'))")
                .replace(/TIMESTAMP/gi, 'TEXT')
                .replace(/NOW\(\)/gi, "datetime('now')")
                .replace(/BOOLEAN/gi, 'INTEGER')
                .replace(/true/g, '1')
                .replace(/false/g, '0')
                .replace(/UUID/gi, 'TEXT')
                .replace(/VARCHAR\(\d+\)/gi, 'TEXT')
                .replace(/DECIMAL\([^)]+\)/gi, 'REAL')
                .replace(/BIGINT/gi, 'INTEGER')
                .replace(/CHAR\(\d+\)/gi, 'TEXT')
                .replace(/REFERENCES [a-z_]+\([a-z_]+\)( ON DELETE CASCADE)?/gi, '')
                .replace(/CREATE EXTENSION[^;]+;/gi, '')
                .replace(/CREATE INDEX[^;]+;/gi, '');

            if (isSelect) {
                const stmt = db.prepare(sqliteSql);
                const rows = stmt.all(...params);
                return Promise.resolve({ rows });
            } else {
                const stmt = db.prepare(sqliteSql);
                const result = stmt.run(...params);

                // For INSERT with RETURNING, simulate it
                if (sql.toUpperCase().includes('RETURNING')) {
                    const returning = sql.match(/RETURNING\s+(.+?)$/i);
                    if (returning && result.lastInsertRowid) {
                        // Get the inserted row
                        const table = sql.match(/INSERT INTO\s+([a-z_]+)/i)?.[1];
                        if (table) {
                            const getStmt = db.prepare(`SELECT * FROM ${table} WHERE rowid = ?`);
                            const row = getStmt.get(result.lastInsertRowid);
                            return Promise.resolve({ rows: row ? [row] : [] });
                        }
                    }
                }

                return Promise.resolve({ rows: [], rowCount: result.changes });
            }
        } catch (error) {
            console.error('SQLite Error:', error.message);
            console.error('SQL:', sql);
            return Promise.reject(error);
        }
    }
};

module.exports = pool;
module.exports.db = db;
