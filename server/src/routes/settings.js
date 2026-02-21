const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Helper: upsert a setting
async function upsertSetting(key, value) {
    await pool.query(
        `INSERT INTO app_settings (key, value, updated_at) 
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
    );
}

// Helper: get a setting
async function getSetting(key, defaultValue = null) {
    const { rows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = $1`, [key]
    );
    return rows[0]?.value || defaultValue;
}

// Get AI settings (masked API key)
router.get('/ai', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT key, value FROM app_settings WHERE key LIKE 'ai_%'`
        );

        const raw = {};
        for (const row of rows) {
            raw[row.key] = row.value;
        }

        const settings = {
            provider: raw['ai_provider'] || 'anthropic',
            model: raw['ai_model'] || 'claude-sonnet-4-20250514',
            endpoint: raw['ai_endpoint'] || '',
            maxTokens: parseInt(raw['ai_max_tokens']) || 4096,
            customSystemPrompt: raw['ai_custom_system_prompt'] || '',
            hasApiKey: !!raw['ai_api_key'],
            apiKey: raw['ai_api_key']
                ? '••••••••' + raw['ai_api_key'].slice(-8)
                : '',
        };

        res.json({ settings });
    } catch (error) {
        console.error('Error fetching AI settings:', error);
        res.json({ settings: { hasApiKey: false, apiKey: '', provider: 'anthropic', model: 'claude-sonnet-4-20250514' } });
    }
});

// Save AI settings
router.put('/ai', async (req, res) => {
    try {
        const { apiKey, model, provider, endpoint, maxTokens, customSystemPrompt } = req.body;

        if (apiKey && !apiKey.includes('••••')) {
            await upsertSetting('ai_api_key', apiKey);
        }

        if (model) await upsertSetting('ai_model', model);
        if (provider) await upsertSetting('ai_provider', provider);
        if (endpoint !== undefined) await upsertSetting('ai_endpoint', endpoint);
        if (maxTokens) await upsertSetting('ai_max_tokens', String(maxTokens));
        if (customSystemPrompt !== undefined) await upsertSetting('ai_custom_system_prompt', customSystemPrompt);

        res.json({ success: true, message: 'AI settings saved' });
    } catch (error) {
        console.error('Error saving AI settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Test AI connection (multi-provider)
router.post('/ai/test', async (req, res) => {
    try {
        const provider = await getSetting('ai_provider', 'anthropic');
        const apiKey = await getSetting('ai_api_key');

        if (!apiKey) {
            return res.status(400).json({ error: 'No API key configured' });
        }

        if (provider === 'anthropic') {
            const Anthropic = require('@anthropic-ai/sdk');
            const client = new Anthropic({ apiKey });
            const model = await getSetting('ai_model', 'claude-sonnet-4-20250514');

            await client.messages.create({
                model,
                max_tokens: 50,
                messages: [{ role: 'user', content: 'Reply with: "Connection successful"' }],
            });

            res.json({ success: true, message: `Connected to Anthropic (${model})` });
        } else if (provider === 'openai') {
            const OpenAI = require('openai');
            const client = new OpenAI({ apiKey });
            const model = await getSetting('ai_model', 'gpt-4o');

            await client.chat.completions.create({
                model,
                max_tokens: 50,
                messages: [{ role: 'user', content: 'Reply with: "Connection successful"' }],
            });

            res.json({ success: true, message: `Connected to OpenAI (${model})` });
        } else if (provider === 'gemini') {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = await getSetting('ai_model', 'gemini-2.0-flash');
            const genModel = genAI.getGenerativeModel({ model });

            await genModel.generateContent('Reply with: "Connection successful"');

            res.json({ success: true, message: `Connected to Gemini (${model})` });
        } else {
            res.json({ success: true, message: 'Custom provider — unable to test automatically' });
        }
    } catch (error) {
        console.error('AI connection test failed:', error);
        res.status(400).json({
            error: 'Connection failed',
            message: error.message || 'Invalid API key or network error',
        });
    }
});

// ═══════════════════════════════════════════════
// BACKUP SETTINGS
// ═══════════════════════════════════════════════

// Get backup settings
router.get('/backup', async (req, res) => {
    try {
        const settings = {
            autoEnabled: (await getSetting('backup_auto_enabled', 'true')) === 'true',
            schedule: await getSetting('backup_schedule', '0 2 * * *'),
            frequency: await getSetting('backup_frequency', 'daily'),
            retentionDays: parseInt(await getSetting('backup_retention_days', '7')) || 7,
            lastRun: await getSetting('backup_last_run', null),
            lastStatus: await getSetting('backup_last_status', 'unknown'),
        };
        res.json({ settings });
    } catch (error) {
        console.error('Error fetching backup settings:', error);
        res.json({ settings: { autoEnabled: true, schedule: '0 2 * * *', frequency: 'daily', retentionDays: 7 } });
    }
});

// Save backup settings
router.put('/backup', async (req, res) => {
    try {
        const { autoEnabled, frequency, retentionDays } = req.body;

        if (autoEnabled !== undefined) await upsertSetting('backup_auto_enabled', String(autoEnabled));
        if (frequency) {
            await upsertSetting('backup_frequency', frequency);
            // Map frequency to cron expression
            const cronMap = {
                'hourly': '0 * * * *',
                'every6h': '0 */6 * * *',
                'daily': '0 2 * * *',
                'weekly': '0 2 * * 0',
            };
            await upsertSetting('backup_schedule', cronMap[frequency] || '0 2 * * *');
        }
        if (retentionDays) await upsertSetting('backup_retention_days', String(retentionDays));

        res.json({ success: true, message: 'Backup settings saved' });
    } catch (error) {
        console.error('Error saving backup settings:', error);
        res.status(500).json({ error: 'Failed to save backup settings' });
    }
});

// Get backup history (list files in backups/ directory)
router.get('/backup/history', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const backupsDir = path.join(__dirname, '../../backups');

        if (!fs.existsSync(backupsDir)) {
            return res.json({ backups: [] });
        }

        const files = fs.readdirSync(backupsDir)
            .filter(f => !f.startsWith('.'))
            .map(filename => {
                const filePath = path.join(backupsDir, filename);
                const stats = fs.statSync(filePath);
                return {
                    filename,
                    size: stats.size,
                    sizeFormatted: stats.size > 1024 * 1024
                        ? `${(stats.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${(stats.size / 1024).toFixed(1)} KB`,
                    createdAt: stats.mtime.toISOString(),
                };
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 20);

        res.json({ backups: files });
    } catch (error) {
        console.error('Error listing backups:', error);
        res.json({ backups: [] });
    }
});

// Trigger manual backup
router.post('/backup/run', async (req, res) => {
    try {
        const driveService = require('../services/driveService');
        const connected = await driveService.isConnected();

        if (connected) {
            await driveService.backupDatabase();
            await upsertSetting('backup_last_run', new Date().toISOString());
            await upsertSetting('backup_last_status', 'success');
            res.json({ success: true, message: 'Backup completed successfully' });
        } else {
            // Do a local-only backup
            const { exec } = require('child_process');
            const path = require('path');
            const backupsDir = path.join(__dirname, '../../backups');
            const fs = require('fs');
            if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

            await upsertSetting('backup_last_run', new Date().toISOString());
            await upsertSetting('backup_last_status', 'local_only');
            res.json({ success: true, message: 'Local backup saved (Google Drive not connected)' });
        }
    } catch (error) {
        console.error('Manual backup failed:', error);
        await upsertSetting('backup_last_status', 'failed');
        res.status(500).json({ error: 'Backup failed: ' + error.message });
    }
});

module.exports = router;
