/**
 * Data Validation Middleware
 * 
 * Validates request body fields BEFORE they reach the route handler.
 * If validation passes → handler runs as normal.
 * If validation fails → returns 400 with clear error messages.
 * 
 * ZERO IMPACT on existing logic — this is a "gate" that sits BEFORE the handler.
 */

const pool = require('../config/database');

// ─── Core validation functions ─────────────────────────────
const validators = {
    required: (value, fieldName) => {
        if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
            return `${fieldName} is required`;
        }
        return null;
    },

    type: (value, fieldName, expectedType) => {
        if (value === undefined || value === null) return null; // skip if not provided
        switch (expectedType) {
            case 'string':
                if (typeof value !== 'string') return `${fieldName} must be a string`;
                break;
            case 'number':
                if (isNaN(Number(value))) return `${fieldName} must be a number`;
                break;
            case 'uuid':
                if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
                    return `${fieldName} must be a valid UUID`;
                }
                break;
            case 'date':
                if (typeof value === 'string' && value.trim() === '') return null; // empty = not provided
                if (typeof value !== 'string' || isNaN(Date.parse(value))) {
                    return `${fieldName} must be a valid date`;
                }
                break;
            case 'email':
                if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return `${fieldName} must be a valid email address`;
                }
                break;
        }
        return null;
    },

    enum: (value, fieldName, allowedValues) => {
        if (value === undefined || value === null) return null;
        if (!allowedValues.includes(value)) {
            return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
        }
        return null;
    },

    minLength: (value, fieldName, min) => {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string' && value.trim().length < min) {
            return `${fieldName} must be at least ${min} characters`;
        }
        return null;
    },

    maxLength: (value, fieldName, max) => {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string' && value.length > max) {
            return `${fieldName} must be at most ${max} characters`;
        }
        return null;
    },

    min: (value, fieldName, minVal) => {
        if (value === undefined || value === null) return null;
        if (Number(value) < minVal) {
            return `${fieldName} must be at least ${minVal}`;
        }
        return null;
    },

    max: (value, fieldName, maxVal) => {
        if (value === undefined || value === null) return null;
        if (Number(value) > maxVal) {
            return `${fieldName} must be at most ${maxVal}`;
        }
        return null;
    },

    after: (value, fieldName, otherFieldName, otherValue) => {
        if (!value || !otherValue) return null;
        const d1 = new Date(value);
        const d2 = new Date(otherValue);
        if (d1 <= d2) {
            return `${fieldName} must be after ${otherFieldName}`;
        }
        return null;
    },
};

// ─── Unique check (async) ──────────────────────────────────
async function checkUnique(value, fieldName, table, column, excludeId = null) {
    if (!value) return null;
    try {
        let query = `SELECT id FROM ${table} WHERE ${column} = $1`;
        const params = [value];
        if (excludeId) {
            query += ' AND id != $2';
            params.push(excludeId);
        }
        const { rows } = await pool.query(query, params);
        if (rows.length > 0) {
            return `${fieldName} "${value}" already exists`;
        }
    } catch (err) {
        // Table might not exist — skip
    }
    return null;
}

// ─── Relationship check (async) ────────────────────────────
async function checkExists(value, fieldName, table) {
    if (!value) return null;
    try {
        const { rows } = await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [value]);
        if (rows.length === 0) {
            return `${fieldName} references a non-existent record`;
        }
    } catch (err) {
        // Skip if table doesn't exist
    }
    return null;
}

// ─── Delete guard (async) ──────────────────────────────────
async function checkNoActiveReferences(value, fieldName, references) {
    for (const ref of references) {
        try {
            let query = `SELECT COUNT(*) as count FROM ${ref.table} WHERE ${ref.column} = $1`;
            if (ref.statusFilter) {
                query += ` AND status NOT IN (${ref.statusFilter.map((_, i) => `$${i + 2}`).join(', ')})`;
            }
            const params = [value, ...(ref.statusFilter || [])];
            const { rows } = await pool.query(query, params);
            const count = parseInt(rows[0].count);
            if (count > 0) {
                return `Cannot delete: ${fieldName} has ${count} active ${ref.label || ref.table}`;
            }
        } catch (err) {
            // Table might not exist
        }
    }
    return null;
}

// ─── Main validate middleware factory ──────────────────────
function validate(rules) {
    return async (req, res, next) => {
        const errors = [];
        const body = req.body;

        for (const [field, fieldRules] of Object.entries(rules)) {
            // Resolve value (support both snake_case and camelCase)
            const snakeField = field;
            const camelField = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            const value = body[snakeField] !== undefined ? body[snakeField] : body[camelField];

            const displayName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            // Required check
            if (fieldRules.required) {
                const err = validators.required(value, displayName);
                if (err) { errors.push(err); continue; }
            }

            // Type check
            if (fieldRules.type) {
                const err = validators.type(value, displayName, fieldRules.type);
                if (err) errors.push(err);
            }

            // Enum check
            if (fieldRules.enum) {
                const err = validators.enum(value, displayName, fieldRules.enum);
                if (err) errors.push(err);
            }

            // Length checks
            if (fieldRules.minLength) {
                const err = validators.minLength(value, displayName, fieldRules.minLength);
                if (err) errors.push(err);
            }
            if (fieldRules.maxLength) {
                const err = validators.maxLength(value, displayName, fieldRules.maxLength);
                if (err) errors.push(err);
            }

            // Number range
            if (fieldRules.min !== undefined) {
                const err = validators.min(value, displayName, fieldRules.min);
                if (err) errors.push(err);
            }
            if (fieldRules.max !== undefined) {
                const err = validators.max(value, displayName, fieldRules.max);
                if (err) errors.push(err);
            }

            // Date comparison
            if (fieldRules.after) {
                const otherField = fieldRules.after;
                const otherSnake = otherField;
                const otherCamel = otherField.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
                const otherValue = body[otherSnake] !== undefined ? body[otherSnake] : body[otherCamel];
                const otherDisplay = otherField.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const err = validators.after(value, displayName, otherDisplay, otherValue);
                if (err) errors.push(err);
            }

            // Unique check (async)
            if (fieldRules.unique) {
                const { table, column } = fieldRules.unique;
                const err = await checkUnique(value, displayName, table, column, req.params?.id);
                if (err) errors.push(err);
            }

            // Exists check (async) — verify foreign key reference
            if (fieldRules.exists) {
                const err = await checkExists(value, displayName, fieldRules.exists);
                if (err) errors.push(err);
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors,
                message: errors[0], // Show first error as main message
            });
        }

        next();
    };
}

// ─── Delete guard middleware factory ───────────────────────
function guardDelete(entityName, references) {
    return async (req, res, next) => {
        const id = req.params.id;
        const err = await checkNoActiveReferences(id, entityName, references);
        if (err) {
            return res.status(409).json({ error: err });
        }
        next();
    };
}

// ─── Optimistic lock middleware ────────────────────────────
function checkVersion(table) {
    return async (req, res, next) => {
        const { id } = req.params;
        const clientVersion = req.body.version || req.body._version;

        // If client doesn't send version, skip locking (backward compatible)
        if (clientVersion === undefined || clientVersion === null) {
            return next();
        }

        try {
            const { rows } = await pool.query(
                `SELECT version FROM ${table} WHERE id = $1`,
                [id]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Record not found' });
            }

            const serverVersion = rows[0].version || 0;
            if (parseInt(clientVersion) !== serverVersion) {
                return res.status(409).json({
                    error: 'Conflict: This record was modified by another user. Please refresh and try again.',
                    currentVersion: serverVersion,
                    yourVersion: parseInt(clientVersion),
                });
            }
        } catch (err) {
            // version column might not exist yet — skip
        }

        next();
    };
}

// ═══════════════════════════════════════════════════════════
// VALIDATION RULES PER ENTITY
// ═══════════════════════════════════════════════════════════

const RULES = {
    booking: {
        create: {
            type: { required: true, enum: ['FCL', 'AIR'] },
            origin_port: { minLength: 2 },
            destination_port: { required: true, minLength: 2 },
            freight_rate_usd: { type: 'number', min: 0 },
            container_count: { type: 'number', min: 1, max: 100 },
            eta: { type: 'date', after: 'etd' },
        },
        update: {
            type: { enum: ['FCL', 'AIR'] },
            freight_rate_usd: { type: 'number', min: 0 },
            container_count: { type: 'number', min: 1, max: 100 },
            eta: { type: 'date', after: 'etd' },
            status: { enum: ['PENDING', 'CONFIRMED', 'ALLOCATED', 'CANCELLED'] },
        },
    },

    shipment: {
        create: {
            type: { required: true, enum: ['FCL', 'AIR'] },
            destination_port: { required: true, minLength: 2 },
            cargo_description: { required: true, minLength: 2 },
            cargo_weight_kg: { type: 'number', min: 0 },
            container_count: { type: 'number', min: 1, max: 100 },
            incoterm: { enum: ['FOB', 'CIF', 'CFR', 'EXW', 'FCA', 'DDP', 'DAP', 'CPT', 'CIP'] },
            eta: { type: 'date', after: 'etd' },
        },
        update: {
            type: { enum: ['FCL', 'AIR'] },
            status: {
                enum: [
                    'DRAFT', 'BOOKED', 'BOOKING_CONFIRMED',
                    'DOCUMENTATION_IN_PROGRESS', 'READY_TO_LOAD',
                    'LOADING', 'LOADED',
                    'CUSTOMS_SUBMITTED', 'CUSTOMS_CLEARED',
                    'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'CANCELLED'
                ]
            },
            cargo_weight_kg: { type: 'number', min: 0 },
            container_count: { type: 'number', min: 1, max: 100 },
            incoterm: { enum: ['FOB', 'CIF', 'CFR', 'EXW', 'FCA', 'DDP', 'DAP', 'CPT', 'CIP'] },
            eta: { type: 'date', after: 'etd' },
        },
    },

    customer: {
        create: {
            company_name: { required: true, minLength: 2, maxLength: 200 },
            email: { type: 'email' },
            phone: { maxLength: 20 },
            country: { maxLength: 100 },
        },
        update: {
            company_name: { minLength: 2, maxLength: 200 },
            email: { type: 'email' },
            phone: { maxLength: 20 },
        },
    },

    invoice: {
        create: {
            invoice_number: { required: true, minLength: 2, unique: { table: 'invoices', column: 'invoice_number' } },
            amount_usd: { required: true, type: 'number', min: 0.01 },
            status: { enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'] },
        },
        statusChange: {
            status: { required: true, enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'] },
        },
    },

    provider: {
        create: {
            company_name: { required: true, minLength: 2, maxLength: 200 },
            email: { type: 'email' },
            grade: { enum: ['A', 'B', 'C', 'D'] },
            credit_limit_monthly: { type: 'number', min: 0 },
        },
        update: {
            company_name: { minLength: 2, maxLength: 200 },
            email: { type: 'email' },
            grade: { enum: ['A', 'B', 'C', 'D'] },
            credit_limit_monthly: { type: 'number', min: 0 },
        },
    },

    task: {
        create: {
            title: { required: true, minLength: 2 },
            task_type: { required: true },
            deadline: { required: true, type: 'date' },
            priority: { enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        },
    },
};

// ─── Delete guards ─────────────────────────────────────────
const DELETE_GUARDS = {
    customer: guardDelete('Customer', [
        { table: 'shipments', column: 'customer_id', label: 'shipments', statusFilter: ['COMPLETED', 'CANCELLED'] },
    ]),
    provider: guardDelete('Vendor', [
        { table: 'bookings', column: 'forwarder_id', label: 'bookings', statusFilter: ['CANCELLED'] },
        { table: 'invoices', column: 'forwarder_id', label: 'invoices', statusFilter: ['PAID', 'CANCELLED'] },
    ]),
};

module.exports = {
    validate,
    guardDelete,
    checkVersion,
    RULES,
    DELETE_GUARDS,
};
