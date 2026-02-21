import { useEffect, useState } from 'react';
import { Users, Monitor, Ban, RotateCcw, Trash2, CheckCircle, XCircle, UserPlus, X, Loader2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { fetchApi } from '@/lib/api';
import toast from 'react-hot-toast';

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

interface CreateUserForm {
    fullName: string;
    email: string;
    password: string;
    role: string;
    department: string;
}

export function AdminUserTable() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [formData, setFormData] = useState<CreateUserForm>({
        fullName: '',
        email: '',
        password: '',
        role: 'STAFF',
        department: '',
    });

    const fetchUsers = async () => {
        try {
            const data = await fetchApi('/api/admin/users');
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

    const handleCreateUser = async () => {
        if (!formData.fullName || !formData.email || !formData.password) {
            toast.error('Full Name, Email, and Password are required');
            return;
        }
        if (formData.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setCreating(true);
        try {
            const result = await fetchApi('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify({
                    fullName: formData.fullName,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                    department: formData.department || undefined,
                }),
            });
            toast.success(`User created! License key: ${result.license?.license_key || 'generated'}`);
            setShowCreateModal(false);
            setFormData({ fullName: '', email: '', password: '', role: 'STAFF', department: '' });
            await fetchUsers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create user');
        } finally {
            setCreating(false);
        }
    };

    const handleDisableUser = async (userId: string) => {
        if (!confirm('Disable this user account?')) return;

        try {
            await fetchApi(`/api/admin/users/${userId}/disable`, {
                method: 'PUT',
            });
            toast.success('User disabled');
            await fetchUsers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to disable user');
        }
    };

    const handleEnableUser = async (userId: string) => {
        try {
            await fetchApi(`/api/admin/users/${userId}/enable`, {
                method: 'PUT',
            });
            toast.success('User enabled');
            await fetchUsers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to enable user');
        }
    };

    const handleResetDevice = async (userId: string) => {
        if (!confirm('Reset device binding for this user? They will need to login again.')) return;

        try {
            await fetchApi(`/api/admin/users/${userId}/reset-device`, {
                method: 'PUT',
            });
            toast.success('Device binding reset successfully');
            await fetchUsers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to reset device');
        }
    };

    const handleDeleteUser = async (userId: string, email: string) => {
        if (!confirm(`Delete user ${email}? This action cannot be undone.`)) return;

        try {
            await fetchApi(`/api/admin/users/${userId}`, {
                method: 'DELETE',
            });
            toast.success('User deleted');
            await fetchUsers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete user');
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">Loading users...</div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-[hsl(var(--destructive))]/10 flex items-center justify-center mb-4">
                    <XCircle className="w-8 h-8 text-[hsl(var(--destructive))]" />
                </div>
                <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-2">Server Unavailable</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center max-w-md mb-1">
                    {error}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center max-w-md mb-6">
                    The admin panel requires a connection to the server. Please check your network connection or contact your system administrator.
                </p>
                <Button variant="outline" onClick={() => { setLoading(true); setError(''); fetchUsers(); }}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Retry Connection
                </Button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">User Management</h2>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                        {users.length} total users
                    </span>
                    <Button onClick={() => setShowCreateModal(true)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create User
                    </Button>
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

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-[hsl(var(--background))] rounded-xl p-6 w-full max-w-md border border-[hsl(var(--border))]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">Create New User</h2>
                            <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                    Full Name <span className="text-red-400">*</span>
                                </label>
                                <Input
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    placeholder="Nguyen Van A"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                    Email <span className="text-red-400">*</span>
                                </label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="user@company.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                    Password <span className="text-red-400">*</span>
                                </label>
                                <Input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="At least 6 characters"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                    Role
                                </label>
                                <select
                                    className="w-full h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] px-3 text-sm"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="STAFF">Staff</option>
                                    <option value="MANAGER">Manager</option>
                                </select>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                    Admin role is reserved for the primary administrator only.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                    Department
                                </label>
                                <Input
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    placeholder="e.g. Operations, Sales..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[hsl(var(--border))]">
                            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateUser} disabled={creating}>
                                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                                Create User
                            </Button>
                        </div>

                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-4 text-center">
                            A license key will be automatically generated for the new user.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}


