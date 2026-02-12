import { useEffect, useState } from 'react';
import { Shield, Monitor, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input } from '@/components/ui';
import { getCachedDeviceInfo } from '@/lib/deviceId';

interface WhitelistEntry {
    id: string;
    device_id: string;
    device_name?: string;
    granted_by_name?: string;
    granted_at: string;
    notes?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function AdminWhitelist() {
    const { token } = useAuthStore();
    const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newDevice, setNewDevice] = useState({ deviceId: '', deviceName: '', notes: '' });

    const fetchWhitelist = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/whitelist`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch whitelist');

            const data = await response.json();
            setWhitelist(data.whitelist);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWhitelist();
    }, []);

    const handleAddCurrentDevice = async () => {
        try {
            const deviceInfo = await getCachedDeviceInfo();

            const response = await fetch(`${API_URL}/api/admin/whitelist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    deviceId: deviceInfo.deviceId,
                    deviceName: deviceInfo.deviceName,
                    notes: 'Added via admin panel',
                }),
            });

            if (!response.ok) throw new Error('Failed to add device');

            alert('Current device added to whitelist');
            setShowAddForm(false);
            await fetchWhitelist();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to add device');
        }
    };

    const handleAddManual = async () => {
        if (!newDevice.deviceId) {
            alert('Device ID is required');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/admin/whitelist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(newDevice),
            });

            if (!response.ok) throw new Error('Failed to add device');

            alert('Device added to whitelist');
            setNewDevice({ deviceId: '', deviceName: '', notes: '' });
            setShowAddForm(false);
            await fetchWhitelist();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to add device');
        }
    };

    const handleRevoke = async (deviceId: string) => {
        if (!confirm('Revoke admin access for this device?')) return;

        try {
            const response = await fetch(`${API_URL}/api/admin/whitelist/${deviceId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to revoke access');
            }

            alert('Admin access revoked');
            await fetchWhitelist();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to revoke access');
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">Loading whitelist...</div>;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Admin Whitelist</h2>
                </div>
                <Button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Device
                </Button>
            </div>

            {showAddForm && (
                <div className="bg-card rounded-xl border border-border p-6 mb-6">
                    <h3 className="font-semibold text-foreground mb-4">Add Device to Whitelist</h3>

                    <div className="space-y-4">
                        <Button onClick={handleAddCurrentDevice} variant="outline" className="w-full">
                            <Monitor className="w-4 h-4 mr-2" />
                            Add This Device
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="bg-card px-2 text-muted-foreground">OR</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Input
                                placeholder="Device ID (SHA-256 hash)"
                                value={newDevice.deviceId}
                                onChange={(e) => setNewDevice({ ...newDevice, deviceId: e.target.value })}
                            />
                            <Input
                                placeholder="Device Name (optional)"
                                value={newDevice.deviceName}
                                onChange={(e) => setNewDevice({ ...newDevice, deviceName: e.target.value })}
                            />
                            <Input
                                placeholder="Notes (optional)"
                                value={newDevice.notes}
                                onChange={(e) => setNewDevice({ ...newDevice, notes: e.target.value })}
                            />
                            <div className="flex gap-2">
                                <Button onClick={handleAddManual} className="flex-1">Add Manually</Button>
                                <Button onClick={() => setShowAddForm(false)} variant="outline">Cancel</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-secondary/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Device</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Granted By</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Notes</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {whitelist.map((entry) => (
                                <tr key={entry.id} className="hover:bg-secondary/30 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <Monitor className="w-4 h-4 text-muted-foreground" />
                                            <div>
                                                <div className="font-medium text-foreground">{entry.device_name || 'Unknown Device'}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{entry.device_id.slice(0, 16)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-muted-foreground">
                                        {entry.granted_by_name || 'System'}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-muted-foreground">
                                        {new Date(entry.granted_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-muted-foreground">
                                        {entry.notes || '-'}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRevoke(entry.device_id)}
                                                title="Revoke access"
                                                disabled={entry.notes === 'Primary Admin Device'}
                                            >
                                                <Trash2 className="w-4 h-4 text-red-400" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {whitelist.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No devices whitelisted</p>
                </div>
            )}
        </div>
    );
}
