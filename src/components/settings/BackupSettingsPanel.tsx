import { useState, useEffect, useCallback } from 'react';
import {
    Database,
    Clock,
    Download,
    RefreshCw,
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Select } from '@/components/ui';
import { fetchApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface BackupSettings {
    autoEnabled: boolean;
    schedule: string;
    frequency: string;
    retentionDays: number;
    lastRun: string | null;
    lastStatus: string;
}

interface BackupFile {
    filename: string;
    size: number;
    sizeFormatted: string;
    createdAt: string;
}

export function BackupSettingsPanel() {
    const [settings, setSettings] = useState<BackupSettings | null>(null);
    const [backups, setBackups] = useState<BackupFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [runningBackup, setRunningBackup] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            const [settingsRes, historyRes] = await Promise.all([
                fetchApi('/api/settings/backup'),
                fetchApi('/api/settings/backup/history'),
            ]);
            setSettings(settingsRes.settings);
            setBackups(historyRes.backups || []);
        } catch {
            toast.error('Failed to load backup settings');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await fetchApi('/api/settings/backup', {
                method: 'PUT',
                body: JSON.stringify({
                    autoEnabled: settings.autoEnabled,
                    frequency: settings.frequency,
                    retentionDays: settings.retentionDays,
                }),
            });
            toast.success('Backup settings saved');
        } catch {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleRunBackup = async () => {
        setRunningBackup(true);
        try {
            const res = await fetchApi('/api/settings/backup/run', { method: 'POST' });
            toast.success(res.message || 'Backup completed');
            fetchSettings();
        } catch {
            toast.error('Backup failed');
        } finally {
            setRunningBackup(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[hsl(var(--primary))]" />
                </CardContent>
            </Card>
        );
    }

    if (!settings) return null;

    const statusIcon = {
        success: <CheckCircle className="w-4 h-4 text-green-400" />,
        failed: <XCircle className="w-4 h-4 text-red-400" />,
        local_only: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
        unknown: <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />,
    }[settings.lastStatus] || <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />;

    return (
        <div className="space-y-6">
            {/* Backup Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Backup Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Auto Backup Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))]">
                        <div>
                            <p className="font-medium text-[hsl(var(--foreground))]">Automatic Backup</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Automatically backup database on schedule
                            </p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, autoEnabled: !settings.autoEnabled })}
                            className={cn(
                                'w-12 h-6 rounded-full relative transition-colors',
                                settings.autoEnabled ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'
                            )}
                        >
                            <span className={cn(
                                'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                                settings.autoEnabled ? 'left-7' : 'left-1'
                            )} />
                        </button>
                    </div>

                    {/* Frequency & Retention */}
                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Backup Frequency"
                            value={settings.frequency}
                            onChange={(e) => setSettings({ ...settings, frequency: e.target.value })}
                            options={[
                                { value: 'hourly', label: 'Every Hour' },
                                { value: 'every6h', label: 'Every 6 Hours' },
                                { value: 'daily', label: 'Daily (2:00 AM)' },
                                { value: 'weekly', label: 'Weekly (Sunday)' },
                            ]}
                        />
                        <Select
                            label="Retention Period"
                            value={String(settings.retentionDays)}
                            onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) })}
                            options={[
                                { value: '3', label: '3 Days' },
                                { value: '7', label: '7 Days' },
                                { value: '14', label: '14 Days' },
                                { value: '30', label: '30 Days' },
                            ]}
                        />
                    </div>

                    {/* Last Backup Status */}
                    <div className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))]">
                        <div className="flex items-center gap-2">
                            {statusIcon}
                            <div>
                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">Last Backup</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {settings.lastRun
                                        ? new Date(settings.lastRun).toLocaleString()
                                        : 'Never'}
                                </p>
                            </div>
                        </div>
                        <span className={cn('text-xs px-2 py-1 rounded', {
                            'bg-green-500/10 text-green-400': settings.lastStatus === 'success',
                            'bg-red-500/10 text-red-400': settings.lastStatus === 'failed',
                            'bg-yellow-500/10 text-yellow-400': settings.lastStatus === 'local_only',
                            'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]': settings.lastStatus === 'unknown',
                        })}>
                            {settings.lastStatus === 'success' ? 'Success' :
                                settings.lastStatus === 'failed' ? 'Failed' :
                                    settings.lastStatus === 'local_only' ? 'Local Only' : 'Unknown'}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                            Save Settings
                        </Button>
                        <Button variant="outline" onClick={handleRunBackup} disabled={runningBackup}>
                            {runningBackup ? (
                                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4 mr-1.5" />
                            )}
                            Run Backup Now
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Backup History */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Backup History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {backups.length > 0 ? (
                        <div className="space-y-2">
                            {backups.map((backup, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/80">
                                    <div className="flex items-center gap-3">
                                        <Database className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                        <div>
                                            <p className="text-sm font-medium text-[hsl(var(--foreground))]">{backup.filename}</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                {new Date(backup.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono">{backup.sizeFormatted}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Download className="w-10 h-10 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
                            <p className="text-[hsl(var(--muted-foreground))]">No backups yet</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                Click "Run Backup Now" to create your first backup
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
