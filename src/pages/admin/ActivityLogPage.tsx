import { useState, useEffect, useCallback } from 'react';
import {
    Activity,
    Clock,
    Filter,
    ChevronLeft,
    ChevronRight,
    FileText,
    Ship,
    Package,
    Truck,
    DollarSign,
    Upload,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    RefreshCw,
    Star,
    Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchApi } from '@/lib/api';

const ACTION_ICONS: Record<string, any> = {
    CREATE: { icon: FileText, color: 'var(--color-emerald-500, #10b981)', bg: 'rgba(16,185,129,0.1)' },
    UPDATE: { icon: Edit, color: 'var(--color-blue-500, #3b82f6)', bg: 'rgba(59,130,246,0.1)' },
    DELETE: { icon: Trash2, color: 'var(--color-red-500, #ef4444)', bg: 'rgba(239,68,68,0.1)' },
    CONFIRM: { icon: CheckCircle, color: 'var(--color-emerald-500, #10b981)', bg: 'rgba(16,185,129,0.1)' },
    CANCEL: { icon: XCircle, color: 'var(--color-orange-500, #f97316)', bg: 'rgba(249,115,22,0.1)' },
    STATUS_CHANGE: { icon: RefreshCw, color: 'var(--color-purple-500, #a855f7)', bg: 'rgba(168,85,247,0.1)' },
    UPLOAD: { icon: Upload, color: 'var(--color-cyan-500, #06b6d4)', bg: 'rgba(6,182,212,0.1)' },
    COMPLETE: { icon: Star, color: 'var(--color-green-600, #16a34a)', bg: 'rgba(22,163,74,0.1)' },
    VERSION_UPLOAD: { icon: Upload, color: 'var(--color-indigo-500, #6366f1)', bg: 'rgba(99,102,241,0.1)' },
};

const ENTITY_ICONS: Record<string, any> = {
    booking: Package,
    shipment: Ship,
    invoice: DollarSign,
    document: FileText,
    dispatch: Truck,
    task: CheckCircle,
    customer: Users,
    provider: Truck,
};

const ENTITY_COLORS: Record<string, string> = {
    booking: '#f59e0b',
    shipment: '#6366f1',
    invoice: '#ec4899',
    document: '#8b5cf6',
    dispatch: '#ef4444',
    task: '#10b981',
    customer: '#0ea5e9',
    provider: '#f97316',
};

interface ActivityItem {
    id: string;
    entity_type: string;
    entity_id: string;
    action: string;
    user_id: string;
    changes: any;
    ip_address: string;
    created_at: string;
    user_name: string;
    user_email: string;
}

interface Summary {
    todayCount: number;
    weekCount: number;
    byAction: { action: string; count: string }[];
    byEntity: { entity_type: string; count: string }[];
    recentUsers: { full_name: string; email: string; actions: string }[];
}

export function ActivityLogPage() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [entityFilter, setEntityFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const limit = 20;

    const fetchActivities = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                limit: String(limit),
                offset: String(page * limit),
            });
            if (entityFilter) params.set('entity_type', entityFilter);
            if (actionFilter) params.set('action', actionFilter);

            const data = await fetchApi(`/api/activity-log?${params}`);
            setActivities(data.activities || []);
            setTotal(data.total || 0);
        } catch (err) {
            toast.error('Failed to fetch activity log');
        } finally {
            setLoading(false);
        }
    }, [page, entityFilter, actionFilter]);

    const fetchSummary = useCallback(async () => {
        try {
            const data = await fetchApi('/api/activity-log/summary');
            setSummary(data);
        } catch {
            // non-critical
        }
    }, []);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHour = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHour < 24) return `${diffHour}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            CREATE: 'Created',
            UPDATE: 'Updated',
            DELETE: 'Deleted',
            CONFIRM: 'Confirmed',
            CANCEL: 'Cancelled',
            STATUS_CHANGE: 'Status Changed',
            UPLOAD: 'Uploaded',
            COMPLETE: 'Completed',
            VERSION_UPLOAD: 'New Version',
        };
        return labels[action] || action;
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Activity style={{ color: 'hsl(var(--primary))' }} size={28} />
                        Activity Log
                    </h1>
                    <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '4px', fontSize: '14px' }}>
                        Track all changes and actions performed in the system
                    </p>
                </div>
                <button
                    onClick={() => { fetchActivities(); fetchSummary(); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                        background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))',
                        border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                    }}
                >
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div style={{
                        background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px',
                        padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px',
                    }}>
                        <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>Today</span>
                        <span style={{ fontSize: '28px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{summary.todayCount}</span>
                        <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>actions recorded</span>
                    </div>
                    <div style={{
                        background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px',
                        padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px',
                    }}>
                        <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>This Week</span>
                        <span style={{ fontSize: '28px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>{summary.weekCount}</span>
                        <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>actions recorded</span>
                    </div>
                    <div style={{
                        background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px',
                        padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px',
                    }}>
                        <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>Most Active Entity</span>
                        <span style={{ fontSize: '28px', fontWeight: 700, color: 'hsl(var(--foreground))', textTransform: 'capitalize' }}>
                            {summary.byEntity[0]?.entity_type || 'N/A'}
                        </span>
                        <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                            {summary.byEntity[0]?.count || 0} changes this week
                        </span>
                    </div>
                    <div style={{
                        background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px',
                        padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px',
                    }}>
                        <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))', fontWeight: 500 }}>Top Action</span>
                        <span style={{ fontSize: '28px', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                            {getActionLabel(summary.byAction[0]?.action || 'N/A')}
                        </span>
                        <span style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                            {summary.byAction[0]?.count || 0} times this week
                        </span>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{
                display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center',
                padding: '16px', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px',
            }}>
                <Filter size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
                <select
                    value={entityFilter}
                    onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}
                    style={{
                        padding: '8px 12px', borderRadius: '8px', border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontSize: '13px',
                    }}
                >
                    <option value="">All Entities</option>
                    <option value="booking">Bookings</option>
                    <option value="shipment">Shipments</option>
                    <option value="invoice">Invoices</option>
                    <option value="document">Documents</option>
                    <option value="dispatch">Dispatches</option>
                    <option value="task">Tasks</option>
                    <option value="customer">Customers</option>
                    <option value="provider">Vendors</option>
                </select>
                <select
                    value={actionFilter}
                    onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
                    style={{
                        padding: '8px 12px', borderRadius: '8px', border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontSize: '13px',
                    }}
                >
                    <option value="">All Actions</option>
                    <option value="CREATE">Create</option>
                    <option value="UPDATE">Update</option>
                    <option value="DELETE">Delete</option>
                    <option value="CONFIRM">Confirm</option>
                    <option value="CANCEL">Cancel</option>
                    <option value="STATUS_CHANGE">Status Change</option>
                    <option value="UPLOAD">Upload</option>
                    <option value="COMPLETE">Complete</option>
                    <option value="VERSION_UPLOAD">Version Upload</option>
                </select>
                <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
                    {total} total records
                </span>
            </div>

            {/* Activity Timeline */}
            <div style={{
                background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px',
                overflow: 'hidden',
            }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                        Loading activity log...
                    </div>
                ) : activities.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                        <Activity size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                        <p>No activities recorded yet</p>
                        <p style={{ fontSize: '13px', marginTop: '4px' }}>Activities will appear here as changes are made in the system</p>
                    </div>
                ) : (
                    <div>
                        {activities.map((item, idx) => {
                            const actionMeta = ACTION_ICONS[item.action] || ACTION_ICONS.UPDATE;
                            const ActionIcon = actionMeta.icon;
                            const EntityIcon = ENTITY_ICONS[item.entity_type] || FileText;
                            const entityColor = ENTITY_COLORS[item.entity_type] || '#6b7280';
                            const isExpanded = expandedId === item.id;

                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex', gap: '16px', padding: '16px 20px',
                                        borderBottom: idx < activities.length - 1 ? '1px solid hsl(var(--border))' : 'none',
                                        cursor: 'pointer', transition: 'background 0.15s',
                                        background: isExpanded ? 'hsl(var(--accent) / 0.3)' : 'transparent',
                                    }}
                                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                    onMouseOver={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'hsl(var(--accent) / 0.15)'; }}
                                    onMouseOut={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    {/* Timeline dot */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '10px',
                                            background: actionMeta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <ActionIcon size={18} style={{ color: actionMeta.color }} />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                                background: `${entityColor}18`, color: entityColor,
                                            }}>
                                                <EntityIcon size={12} />
                                                {item.entity_type}
                                            </span>
                                            <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))', fontSize: '14px' }}>
                                                {getActionLabel(item.action)}
                                            </span>
                                            {item.changes?.booking_number && (
                                                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>
                                                    • {item.changes.booking_number}
                                                </span>
                                            )}
                                            {item.changes?.shipment_number && (
                                                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>
                                                    • {item.changes.shipment_number}
                                                </span>
                                            )}
                                            {item.changes?.invoice_number && (
                                                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>
                                                    • {item.changes.invoice_number}
                                                </span>
                                            )}
                                            {item.changes?.file_name && (
                                                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '13px' }}>
                                                    • {item.changes.file_name}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={12} />
                                                {formatTime(item.created_at)}
                                            </span>
                                            {item.user_name && (
                                                <span>by {item.user_name}</span>
                                            )}
                                            {item.entity_id && (
                                                <span style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.6 }}>
                                                    ID: {item.entity_id.slice(0, 8)}...
                                                </span>
                                            )}
                                        </div>

                                        {/* Expanded details */}
                                        {isExpanded && item.changes && Object.keys(item.changes).length > 0 && (
                                            <div style={{
                                                marginTop: '12px', padding: '12px', borderRadius: '8px',
                                                background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))',
                                                fontSize: '13px',
                                            }}>
                                                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--foreground))' }}>Change Details</div>
                                                {Object.entries(item.changes).map(([key, value]) => (
                                                    <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                                        <span style={{ color: 'hsl(var(--muted-foreground))', minWidth: '120px', fontWeight: 500 }}>
                                                            {key.replace(/_/g, ' ')}:
                                                        </span>
                                                        <span style={{ color: 'hsl(var(--foreground))' }}>
                                                            {typeof value === 'object' && value !== null
                                                                ? (value as any).old !== undefined
                                                                    ? `${(value as any).old || '—'} → ${(value as any).new || '—'}`
                                                                    : JSON.stringify(value)
                                                                : String(value)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                        padding: '16px', borderTop: '1px solid hsl(var(--border))',
                    }}>
                        <button
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            style={{
                                padding: '6px 12px', borderRadius: '6px', border: '1px solid hsl(var(--border))',
                                background: 'hsl(var(--background))', color: 'hsl(var(--foreground))',
                                cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1,
                                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px',
                            }}
                        >
                            <ChevronLeft size={14} /> Previous
                        </button>
                        <span style={{ fontSize: '13px', color: 'hsl(var(--muted-foreground))' }}>
                            Page {page + 1} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                            disabled={page >= totalPages - 1}
                            style={{
                                padding: '6px 12px', borderRadius: '6px', border: '1px solid hsl(var(--border))',
                                background: 'hsl(var(--background))', color: 'hsl(var(--foreground))',
                                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1,
                                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px',
                            }}
                        >
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
