import { useEffect, useState } from 'react';
import { Users, Monitor, Ban, RotateCcw, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';

interface User {
    id: string;
    email: string;
    full_name: string;
    role: string;
    department?: string;
    status: string;
    license_key?: string;
    license_type?: string;
    expires_at?: string;
    revoked?: boolean;
    device_name?: string;
    os_info?: string;
    last_seen?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function AdminUserTable() {
    const { token } = useAuthStore();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/users`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch users');

            const data = await response.json();
            setUsers(data.users);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDisableUser = async (userId: string) => {
        if (!confirm('Disable this user account?')) return;

        try {
            const response = await fetch(`${API_URL}/api/admin/users/${userId}/disable`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to disable user');

            await fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to disable user');
        }
    };

    const handleEnableUser = async (userId: string) => {
        try {
            const response = await fetch(`${API_URL}/api/admin/users/${userId}/enable`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to enable user');

            await fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to enable user');
        }
    };

    const handleResetDevice = async (userId: string) => {
        if (!confirm('Reset device binding for this user? They will need to login again.')) return;

        try {
            const response = await fetch(`${API_URL}/api/admin/users/${userId}/reset-device`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to reset device');

            alert('Device binding reset successfully');
            await fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to reset device');
        }
    };

    const handleDeleteUser = async (userId: string, email: string) => {
        if (!confirm(`Delete user ${email}? This action cannot be undone.`)) return;

        try {
            const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to delete user');

            await fetchUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete user');
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">Loading users...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-400">{error}</div>;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">User Management</h2>
                </div>
                <div className="text-sm text-muted-foreground">
                    {users.length} total users
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-secondary/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">License</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Device</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                                    <td className="px-4 py-4">
                                        <div>
                                            <div className="font-medium text-foreground">{user.full_name}</div>
                                            <div className="text-sm text-muted-foreground">{user.email}</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                <span className="px-2 py-0.5 rounded bg-secondary">{user.role}</span>
                                                {user.department && <span className="ml-2">{user.department}</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        {user.license_key ? (
                                            <div>
                                                <div className="text-sm font-mono text-foreground">{user.license_key}</div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    <span className={`px-2 py-0.5 rounded ${user.license_type === 'PREMIUM' ? 'bg-purple-500/20 text-purple-400' :
                                                            user.license_type === 'STANDARD' ? 'bg-blue-500/20 text-blue-400' :
                                                                'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                        {user.license_type}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">No license</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        {user.device_name ? (
                                            <div>
                                                <div className="flex items-center gap-2 text-sm text-foreground">
                                                    <Monitor className="w-4 h-4" />
                                                    {user.device_name}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">{user.os_info}</div>
                                                {user.last_seen && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Last seen: {new Date(user.last_seen).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Not activated</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        {user.status === 'ACTIVE' ? (
                                            <span className="flex items-center gap-1 text-sm text-green-400">
                                                <CheckCircle className="w-4 h-4" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-sm text-red-400">
                                                <XCircle className="w-4 h-4" />
                                                Inactive
                                            </span>
                                        )}
                                        {user.revoked && (
                                            <span className="block text-xs text-red-400 mt-1">License revoked</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {user.device_name && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleResetDevice(user.id)}
                                                    title="Reset device binding"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {user.status === 'ACTIVE' ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDisableUser(user.id)}
                                                    title="Disable account"
                                                >
                                                    <Ban className="w-4 h-4 text-orange-400" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEnableUser(user.id)}
                                                    title="Enable account"
                                                >
                                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteUser(user.id, user.email)}
                                                title="Delete user"
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
        </div>
    );
}
