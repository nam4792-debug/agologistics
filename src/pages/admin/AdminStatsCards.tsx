import { useEffect, useState } from 'react';
import { Users, Key, Monitor, Activity, TrendingUp } from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface Stats {
    users: {
        total: string;
        active: string;
        inactive: string;
    };
    licenses: {
        total: string;
        active: string;
        expired: string;
        revoked: string;
    };
    devices: {
        total: string;
    };
    recentActivity: Array<{
        email: string;
        full_name: string;
        device_name: string;
        os_info: string;
        last_seen: string;
    }>;
}



export function AdminStatsCards() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await fetchApi('/api/admin/stats');
                setStats(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">Loading statistics...</div>;
    }

    if (!stats) {
        return <div className="text-center py-8 text-red-400">Failed to load statistics</div>;
    }

    const cards = [
        {
            title: 'Total Users',
            value: stats.users.total,
            icon: Users,
            color: 'from-blue-500 to-cyan-500',
            details: `${stats.users.active} active, ${stats.users.inactive} inactive`,
        },
        {
            title: 'Active Licenses',
            value: stats.licenses.active,
            icon: Key,
            color: 'from-purple-500 to-pink-500',
            details: `${stats.licenses.total} total, ${stats.licenses.revoked} revoked`,
        },
        {
            title: 'Active Devices',
            value: stats.devices.total,
            icon: Monitor,
            color: 'from-green-500 to-emerald-500',
            details: 'Devices currently activated',
        },
        {
            title: 'Expired Licenses',
            value: stats.licenses.expired,
            icon: TrendingUp,
            color: 'from-orange-500 to-red-500',
            details: 'Licenses that have expired',
        },
    ];

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">System Statistics</h2>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.title}
                            className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                                <div className="text-3xl font-bold text-foreground">{card.value}</div>
                            </div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-1">{card.title}</h3>
                            <p className="text-xs text-muted-foreground">{card.details}</p>
                        </div>
                    );
                })}
            </div>

            {/* Recent Activity */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                    <h3 className="font-semibold text-foreground">Recent Activity</h3>
                    <p className="text-sm text-muted-foreground">Last 10 logins</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-secondary/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Device</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Seen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {stats.recentActivity.map((activity, idx) => (
                                <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-foreground">{activity.full_name}</div>
                                        <div className="text-sm text-muted-foreground">{activity.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Monitor className="w-4 h-4 text-muted-foreground" />
                                            <div>
                                                <div className="text-sm text-foreground">{activity.device_name}</div>
                                                <div className="text-xs text-muted-foreground">{activity.os_info}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted-foreground">
                                        {new Date(activity.last_seen).toLocaleString()}
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
