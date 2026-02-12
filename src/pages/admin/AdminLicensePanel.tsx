import { useEffect, useState } from 'react';
import { Key, Copy, Ban, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';

interface License {
    id: string;
    license_key: string;
    email: string;
    full_name: string;
    type: string;
    max_devices: number;
    activated_devices: number;
    expires_at?: string;
    revoked: boolean;
    created_at: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function AdminLicensePanel() {
    const { token } = useAuthStore();
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLicenses = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/licenses`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch licenses');

            const data = await response.json();
            setLicenses(data.licenses);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLicenses();
    }, []);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('License key copied!');
    };

    const handleRevokeLicense = async (licenseKey: string) => {
        const reason = prompt('Reason for revoking this license:');
        if (!reason) return;

        try {
            const response = await fetch(`${API_URL}/api/admin/licenses/${licenseKey}/revoke`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ reason }),
            });

            if (!response.ok) throw new Error('Failed to revoke license');

            alert('License revoked successfully');
            await fetchLicenses();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to revoke license');
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">Loading licenses...</div>;
    }

    const activeLicenses = licenses.filter((l) => !l.revoked && (!l.expires_at || new Date(l.expires_at) > new Date()));
    const expiredLicenses = licenses.filter((l) => l.expires_at && new Date(l.expires_at) < new Date());
    const revokedLicenses = licenses.filter((l) => l.revoked);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Key className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">License Management</h2>
                </div>
                <div className="flex gap-6 text-sm">
                    <div className="text-green-400">{activeLicenses.length} Active</div>
                    <div className="text-orange-400">{expiredLicenses.length} Expired</div>
                    <div className="text-red-400">{revokedLicenses.length} Revoked</div>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-secondary/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">License Key</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Devices</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {licenses.map((license) => {
                                const isExpired = license.expires_at && new Date(license.expires_at) < new Date();
                                const isActive = !license.revoked && !isExpired;

                                return (
                                    <tr key={license.id} className="hover:bg-secondary/30 transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <code className="text-sm font-mono text-foreground">{license.license_key}</code>
                                                <button
                                                    onClick={() => copyToClipboard(license.license_key)}
                                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                                    title="Copy license key"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Created: {new Date(license.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-foreground">{license.full_name}</div>
                                            <div className="text-sm text-muted-foreground">{license.email}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${license.type === 'PREMIUM' ? 'bg-purple-500/20 text-purple-400' :
                                                    license.type === 'STANDARD' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {license.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-sm text-foreground">
                                                {license.activated_devices} / {license.max_devices}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {license.revoked ? (
                                                <span className="flex items-center gap-1 text-sm text-red-400">
                                                    <Ban className="w-4 h-4" />
                                                    Revoked
                                                </span>
                                            ) : isExpired ? (
                                                <span className="flex items-center gap-1 text-sm text-orange-400">
                                                    Expired
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-sm text-green-400">
                                                    <CheckCircle className="w-4 h-4" />
                                                    Active
                                                </span>
                                            )}
                                            {license.expires_at && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Expires: {new Date(license.expires_at).toLocaleDateString()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {isActive && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRevokeLicense(license.license_key)}
                                                        title="Revoke license"
                                                    >
                                                        <Ban className="w-4 h-4 text-red-400" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
