import { useState } from 'react';
import { Shield, Users, Key, Activity } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { AdminUserTable } from './AdminUserTable';
import { AdminLicensePanel } from './AdminLicensePanel';
import { AdminStatsCards } from './AdminStatsCards';
import { AdminWhitelist } from './AdminWhitelist';

export function AdminDashboard() {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'users' | 'licenses' | 'whitelist' | 'stats'>('users');

    if (!user || user.role !== 'ADMIN') {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
                    <p className="text-muted-foreground">Admin access required</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'licenses', label: 'Licenses', icon: Key },
        { id: 'whitelist', label: 'Admin Whitelist', icon: Shield },
        { id: 'stats', label: 'Statistics', icon: Activity },
    ] as const;

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-card">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
                            <p className="text-sm text-muted-foreground">System management and configuration</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                    ${activeTab === tab.id
                                            ? 'bg-primary text-primary-foreground shadow-md'
                                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                        }
                  `}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {activeTab === 'users' && <AdminUserTable />}
                {activeTab === 'licenses' && <AdminLicensePanel />}
                {activeTab === 'whitelist' && <AdminWhitelist />}
                {activeTab === 'stats' && <AdminStatsCards />}
            </div>
        </div>
    );
}
