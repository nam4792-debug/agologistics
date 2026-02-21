import { useState, useEffect } from 'react';
import {
    Cloud,
    CloudOff,
    RefreshCw,
    Database,
    FileText,
    Loader2,
    Clock,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { fetchApi } from '@/lib/api';

interface SyncStatus {
    connected: boolean;
    lastSync: string | null;
    totalBackups: number;
    syncedDocuments: number;
    totalDocuments: number;
}

interface Backup {
    id: string;
    file_name: string;
    file_size_bytes: number;
    backup_type: string;
    created_at: string;
}

export function IntegrationsPanel() {
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [status, setStatus] = useState<SyncStatus | null>(null);
    const [backups, setBackups] = useState<Backup[]>([]);



    // Load status on mount
    useEffect(() => {
        loadStatus();
        loadBackups();

        // Check URL params for connection status
        const params = new URLSearchParams(window.location.search);
        const connectionStatus = params.get('status');
        if (connectionStatus === 'connected') {
            toast.success('Connected to Google Drive successfully!');
            window.history.replaceState({}, '', '/settings?tab=integrations');
            loadStatus();
        } else if (connectionStatus === 'error') {
            toast.error(params.get('message') || 'Failed to connect to Google Drive');
            window.history.replaceState({}, '', '/settings?tab=integrations');
        }
    }, []);

    const loadStatus = async () => {
        try {
            const data = await fetchApi('/api/sync/status');
            if (data.success) {
                setStatus(data.status);
            }
        } catch (error) {
            console.error('Failed to load sync status:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadBackups = async () => {
        try {
            const data = await fetchApi('/api/sync/backups');
            if (data.success) {
                setBackups(data.backups || []);
            }
        } catch (error) {
            console.error('Failed to load backups:', error);
        }
    };

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const data = await fetchApi('/api/sync/connect');
            if (data.authUrl) {
                window.location.href = data.authUrl;
            } else {
                toast.error(data.error || 'Failed to initiate connection');
            }
        } catch (error) {
            toast.error('Failed to connect to Google Drive. Make sure google-credentials.json is configured.');
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect Google Drive?')) return;
        try {
            const data = await fetchApi('/api/sync/disconnect', { method: 'POST' });
            if (data.success) {
                toast.success('Disconnected from Google Drive');
                loadStatus();
            }
        } catch (error) {
            toast.error('Failed to disconnect');
        }
    };

    const handleBackup = async () => {
        setBackingUp(true);
        try {
            const data = await fetchApi('/api/sync/backup', { method: 'POST' });
            if (data.success) {
                toast.success('Database backup completed!');
                loadBackups();
                loadStatus();
            } else {
                toast.error(data.error || 'Backup failed');
            }
        } catch (error) {
            toast.error('Failed to backup database');
        } finally {
            setBackingUp(false);
        }
    };

    const handleSyncDocuments = async () => {
        setSyncing(true);
        try {
            const data = await fetchApi('/api/sync/documents', { method: 'POST' });
            if (data.success) {
                toast.success(data.message);
                loadStatus();
            } else {
                toast.error(data.error || 'Sync failed');
            }
        } catch (error) {
            toast.error('Failed to sync documents');
        } finally {
            setSyncing(false);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };



    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Google Drive Integration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center",
                                status?.connected
                                    ? "bg-gradient-to-br from-green-500 to-emerald-500"
                                    : "bg-gradient-to-br from-gray-500 to-gray-600"
                            )}>
                                {status?.connected ? (
                                    <Cloud className="w-6 h-6 text-white" />
                                ) : (
                                    <CloudOff className="w-6 h-6 text-white" />
                                )}
                            </div>
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    Google Drive
                                    <Badge className={cn(
                                        "text-xs",
                                        status?.connected
                                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                                            : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                                    )}>
                                        {status?.connected ? 'Connected' : 'Not connected'}
                                    </Badge>
                                </CardTitle>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    Sync documents and backup database to Google Drive
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {status?.connected ? (
                                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                                    Disconnect
                                </Button>
                            ) : (
                                <Button onClick={handleConnect} disabled={connecting}>
                                    {connecting ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting...</>
                                    ) : (
                                        <><Cloud className="w-4 h-4 mr-2" /> Connect</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>

                {status?.connected && (
                    <CardContent className="border-t border-[hsl(var(--border))]">
                        <div className="grid grid-cols-3 gap-4 py-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{status.syncedDocuments}/{status.totalDocuments}</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Documents Synced</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{status.totalBackups}</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Backups</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{status.lastSync ? formatDate(status.lastSync) : 'Never'}</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Last Sync</p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={handleSyncDocuments} disabled={syncing}>
                                {syncing ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
                                ) : (
                                    <><RefreshCw className="w-4 h-4 mr-2" /> Sync Documents</>
                                )}
                            </Button>
                            <Button variant="outline" className="flex-1" onClick={handleBackup} disabled={backingUp}>
                                {backingUp ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Backing up...</>
                                ) : (
                                    <><Database className="w-4 h-4 mr-2" /> Backup Database</>
                                )}
                            </Button>
                            <Button variant="ghost" size="sm"
                                onClick={() => { loadStatus(); loadBackups(); }}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Backup History */}
            {status?.connected && backups.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Recent Backups
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {backups.slice(0, 5).map((backup) => (
                                <div key={backup.id} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                    <div className="flex items-center gap-3">
                                        <Database className="w-4 h-4 text-blue-400" />
                                        <div>
                                            <p className="text-sm font-medium text-[hsl(var(--foreground))]">{backup.file_name}</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(backup.created_at)} • {formatFileSize(backup.file_size_bytes)}</p>
                                        </div>
                                    </div>
                                    <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">{backup.backup_type}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Auto Sync Schedule */}
            {status?.connected && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Auto Sync Schedule</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-[hsl(var(--secondary))]">
                                <div className="flex items-center gap-2 mb-2">
                                    <Database className="w-5 h-5 text-blue-400" />
                                    <span className="font-medium text-[hsl(var(--foreground))]">Database Backup</span>
                                </div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    Daily at 2:00 AM (Asia/Ho_Chi_Minh)
                                </p>
                            </div>
                            <div className="p-4 rounded-lg bg-[hsl(var(--secondary))]">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText className="w-5 h-5 text-green-400" />
                                    <span className="font-medium text-[hsl(var(--foreground))]">Document Sync</span>
                                </div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    Every 6 hours automatically
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
