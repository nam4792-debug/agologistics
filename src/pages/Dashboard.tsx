import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui';
import { fetchApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { NewShipmentModal } from '@/components/modals';

// Types — aligned with backend dashboard.js response
interface DashboardMetrics {
    shipments: {
        total: number;
        booked: number;
        docInProgress: number;
        readyToLoad: number;
        loading: number;
        customs: number;
        inTransit: number;
        arrived: number;
        delivered: number;
        activeCount: number;
        completedThisMonth: number;
        completedLastMonth: number;
        onTimeRate: number | null;
    };
    bookings: {
        total: number;
        fcl: number;
        air: number;
        pending: number;
        confirmed: number;
        allocated: number;
        withoutDispatch: number;
    };
    documents: {
        total: number;
        validated: number;
        awaitingReview: number;
        shipmentsWithoutDocs?: number;
        shipmentsWithUnvalidatedDocs: number;
    };
    alerts: {
        total: number;
        critical: number;
        unread: number;
    };
    deadlines: {
        upcoming: number;
        urgent: number;
        nearestDays: number | null;
    };
    dispatches: {
        total: number;
        active: number;
    };
    invoices: {
        overdue: number;
        overdueAmount: number;
        pending: number;
        pendingAmount: number;
        totalPayable: number;
    };
}

interface RecentShipment {
    id: string;
    shipment_number: string;
    type: string;
    status: string;
    origin_country: string;
    destination_country: string;
    customer_name: string;
    etd: string;
    eta: string;
    booking_number?: string;
    container_type?: string;
    container_count?: number;
    total_docs: number;
    validated_docs: number;
}

export function Dashboard() {
    const [showNewShipmentModal, setShowNewShipmentModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [recentShipments, setRecentShipments] = useState<RecentShipment[]>([]);
    const navigate = useNavigate();
    const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const metricsData = await fetchApi('/api/dashboard/metrics');
            setMetrics(metricsData.metrics);
            const shipmentsData = await fetchApi('/api/dashboard/recent-shipments');
            setRecentShipments(shipmentsData.shipments || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            setMetrics({
                shipments: { total: 0, booked: 0, docInProgress: 0, readyToLoad: 0, loading: 0, customs: 0, inTransit: 0, arrived: 0, delivered: 0, activeCount: 0, completedThisMonth: 0, completedLastMonth: 0, onTimeRate: null },
                bookings: { total: 0, fcl: 0, air: 0, pending: 0, confirmed: 0, allocated: 0, withoutDispatch: 0 },
                documents: { total: 0, validated: 0, awaitingReview: 0, shipmentsWithoutDocs: 0, shipmentsWithUnvalidatedDocs: 0 },
                alerts: { total: 0, critical: 0, unread: 0 },
                deadlines: { upcoming: 0, urgent: 0, nearestDays: null },
                dispatches: { total: 0, active: 0 },
                invoices: { overdue: 0, overdueAmount: 0, pending: 0, pendingAmount: 0, totalPayable: 0 },
            });
        } finally {
            setLoading(false);
        }
    };

    // Auto-refresh every 60 seconds
    useEffect(() => {
        fetchDashboardData();
        refreshTimer.current = setInterval(() => {
            fetchDashboardData();
        }, 60000);
        return () => {
            if (refreshTimer.current) clearInterval(refreshTimer.current);
        };
    }, []);

    const handleShipmentCreated = () => { navigate('/shipments'); };

    /* ───── Derived values ───── */
    const activeShipments = metrics?.shipments.activeCount ?? 0;
    const activeBookings = metrics?.bookings.total ?? 0;
    const overdueInvoices = metrics?.invoices?.overdue ?? 0;
    const totalPayable = metrics?.invoices?.totalPayable ?? 0;
    const overdueAmount = metrics?.invoices?.overdueAmount ?? 0;
    const pendingAmount = metrics?.invoices?.pendingAmount ?? 0;
    const criticalAlerts = metrics?.alerts.critical ?? 0;
    const unreadAlerts = metrics?.alerts.unread ?? 0;

    // Pipeline — mirrors ShipmentDetail statusFlow (excludes DRAFT, shows real statuses)
    const pipelineItems = [
        { label: 'Booked', value: metrics?.shipments.booked ?? 0, accent: 'bg-sky-500', status: 'BOOKED' },
        { label: 'Documentation', value: metrics?.shipments.docInProgress ?? 0, accent: 'bg-violet-500', status: 'DOCUMENTATION_IN_PROGRESS' },
        { label: 'Ready to Load', value: metrics?.shipments.readyToLoad ?? 0, accent: 'bg-indigo-500', status: 'READY_TO_LOAD' },
        { label: 'Loading', value: metrics?.shipments.loading ?? 0, accent: 'bg-cyan-500', status: 'LOADING' },
        { label: 'Customs', value: metrics?.shipments.customs ?? 0, accent: 'bg-amber-500', status: 'CUSTOMS_SUBMITTED' },
        { label: 'In Transit', value: metrics?.shipments.inTransit ?? 0, accent: 'bg-blue-500', status: 'IN_TRANSIT' },
        { label: 'Arrived', value: metrics?.shipments.arrived ?? 0, accent: 'bg-teal-500', status: 'ARRIVED' },
        { label: 'Delivered', value: metrics?.shipments.delivered ?? 0, accent: 'bg-emerald-500', status: 'DELIVERED' },
    ];
    const maxPipeline = Math.max(...pipelineItems.map(d => d.value), 1);

    // Action items
    const shipmentsWithUnvalidatedDocs = metrics?.documents.shipmentsWithUnvalidatedDocs ?? 0;
    const missingDocs = metrics?.documents.shipmentsWithoutDocs ?? 0;
    const upcomingDeadlines = metrics?.deadlines.upcoming ?? 0;
    const urgentDeadlines = metrics?.deadlines.urgent ?? 0;
    const bookingsWithoutDispatch = metrics?.bookings.withoutDispatch ?? 0;

    // Operational Summary — 4 new useful metrics
    const completedThisMonth = metrics?.shipments.completedThisMonth ?? 0;
    const completedLastMonth = metrics?.shipments.completedLastMonth ?? 0;
    const nearestDeadlineDays = metrics?.deadlines.nearestDays;
    const onTimeRate = metrics?.shipments.onTimeRate;

    // C4: Month-over-month comparison
    const monthChange = completedLastMonth > 0
        ? Math.round(((completedThisMonth - completedLastMonth) / completedLastMonth) * 100)
        : completedThisMonth > 0 ? 100 : 0;

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'IN_TRANSIT': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
            case 'DELIVERED': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
            case 'BOOKED': case 'BOOKING_CONFIRMED': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
            case 'DOCUMENTATION_IN_PROGRESS': return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
            case 'READY_TO_LOAD': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
            case 'LOADING': case 'LOADED': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
            case 'CUSTOMS_SUBMITTED': case 'CUSTOMS_CLEARED': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
            case 'ARRIVED': return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
            default: return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
        }
    };

    const Skeleton = ({ className = '' }: { className?: string }) => (
        <div className={cn("bg-[hsl(var(--secondary))] rounded animate-pulse", className)} />
    );

    // Total attention items
    const totalAttentionItems = shipmentsWithUnvalidatedDocs + missingDocs + upcomingDeadlines + bookingsWithoutDispatch;

    return (
        <>
            <NewShipmentModal
                isOpen={showNewShipmentModal}
                onClose={() => setShowNewShipmentModal(false)}
                onSuccess={handleShipmentCreated}
            />

            <div className="space-y-8">
                {/* ═══ HEADER ═══ */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-[0.15em] mb-1">
                            {formatDate(new Date())}
                        </p>
                        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] tracking-tight leading-none">
                            Dashboard
                        </h1>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading}>
                            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                            Refresh
                        </Button>
                        <Button size="sm" onClick={() => setShowNewShipmentModal(true)}>
                            + New Shipment
                        </Button>
                    </div>
                </div>

                {/* ═══ KPI HERO ROW — no icons, typography-driven ═══ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[hsl(var(--border))] rounded-2xl overflow-hidden">
                    {/* Active Shipments — excludes DRAFT */}
                    <button
                        onClick={() => navigate('/shipments')}
                        className="bg-[hsl(var(--card))] p-6 text-left hover:bg-[hsl(var(--secondary))]/60 transition-colors group"
                    >
                        <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[0.12em]">
                            Active Shipments
                        </p>
                        {loading ? <Skeleton className="h-10 w-16 mt-2" /> : (
                            <p className="text-4xl font-bold text-[hsl(var(--foreground))] mt-2 tabular-nums tracking-tight">
                                {activeShipments}
                            </p>
                        )}
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">
                            {metrics?.shipments.inTransit || 0} in transit · {metrics?.shipments.docInProgress || 0} in docs
                        </p>
                    </button>

                    {/* FIX A1: Active Bookings — only active bookings */}
                    <button
                        onClick={() => navigate('/bookings/fcl')}
                        className="bg-[hsl(var(--card))] p-6 text-left hover:bg-[hsl(var(--secondary))]/60 transition-colors group"
                    >
                        <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[0.12em]">
                            Active Bookings
                        </p>
                        {loading ? <Skeleton className="h-10 w-16 mt-2" /> : (
                            <p className="text-4xl font-bold text-[hsl(var(--foreground))] mt-2 tabular-nums tracking-tight">
                                {activeBookings}
                            </p>
                        )}
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">
                            {metrics?.bookings.pending || 0} pending · {(metrics?.bookings.confirmed || 0) + (metrics?.bookings.allocated || 0)} confirmed
                        </p>
                    </button>

                    {/* Alerts — deduplicated */}
                    <button
                        onClick={() => navigate('/risks')}
                        className="bg-[hsl(var(--card))] p-6 text-left hover:bg-[hsl(var(--secondary))]/60 transition-colors group"
                    >
                        <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[0.12em]">
                            Unread Alerts
                        </p>
                        {loading ? <Skeleton className="h-10 w-16 mt-2" /> : (
                            <p className={cn(
                                "text-4xl font-bold mt-2 tabular-nums tracking-tight",
                                criticalAlerts > 0 ? "text-red-400" : "text-[hsl(var(--foreground))]"
                            )}>
                                {unreadAlerts}
                            </p>
                        )}
                        <p className={cn("text-xs mt-3", criticalAlerts > 0 ? "text-red-400/80" : "text-[hsl(var(--muted-foreground))]")}>
                            {criticalAlerts > 0 ? `${criticalAlerts} critical` : 'All clear'}
                        </p>
                    </button>

                    {/* FIX A3: Outstanding Payables — costs to vendors */}
                    <button
                        onClick={() => navigate('/invoices')}
                        className="bg-[hsl(var(--card))] p-6 text-left hover:bg-[hsl(var(--secondary))]/60 transition-colors group"
                    >
                        <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[0.12em]">
                            Outstanding Payables
                        </p>
                        {loading ? <Skeleton className="h-10 w-16 mt-2" /> : (
                            <p className={cn(
                                "text-4xl font-bold mt-2 tabular-nums tracking-tight",
                                overdueInvoices > 0 ? "text-amber-400" : "text-[hsl(var(--foreground))]"
                            )}>
                                {totalPayable > 0 ? formatCurrency(totalPayable) : '$0'}
                            </p>
                        )}
                        <p className={cn("text-xs mt-3", overdueInvoices > 0 ? "text-amber-400/80" : "text-[hsl(var(--muted-foreground))]")}>
                            {overdueInvoices > 0 ? `${overdueInvoices} overdue · ${formatCurrency(overdueAmount)}` : 'No overdue'}
                            {pendingAmount > 0 && overdueInvoices === 0 ? ` · ${formatCurrency(pendingAmount)} pending` : ''}
                        </p>
                    </button>
                </div>

                {/* ═══ MAIN CONTENT — 2 columns ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* LEFT — Recent Shipments + Operational Summary */}
                    <div className="lg:col-span-7 space-y-6">
                        <Card className="overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
                                <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider">Active Shipments</h2>
                                <Link to="/shipments">
                                    <span className="text-xs text-[hsl(var(--primary))] hover:underline cursor-pointer font-medium">View All →</span>
                                </Link>
                            </div>
                            <div>
                                {loading ? (
                                    <div className="p-6 space-y-4">
                                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                                    </div>
                                ) : recentShipments.length > 0 ? (
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-[hsl(var(--secondary))]/40">
                                                <th className="text-left py-2.5 px-5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider whitespace-nowrap">Shipment</th>
                                                <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Route</th>
                                                <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Container</th>
                                                <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Docs</th>
                                                <th className="text-right py-2.5 px-5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider whitespace-nowrap">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentShipments.map((s, i) => (
                                                <tr
                                                    key={s.id}
                                                    onClick={() => navigate(`/shipments/${s.id}`)}
                                                    className={cn(
                                                        "cursor-pointer hover:bg-[hsl(var(--secondary))]/50 transition-colors",
                                                        i < recentShipments.length - 1 && "border-b border-[hsl(var(--border))]/50"
                                                    )}
                                                >
                                                    <td className="py-3 px-5 whitespace-nowrap">
                                                        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                                            {s.shipment_number}
                                                        </span>
                                                        <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">
                                                            {s.type} · {s.customer_name || 'Customer'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap hidden sm:table-cell">
                                                        <span className="text-sm text-[hsl(var(--foreground))]">
                                                            {(s.origin_country || '').slice(0, 2).toUpperCase()} → {(s.destination_country || '').slice(0, 2).toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap hidden lg:table-cell">
                                                        <span className="text-sm text-[hsl(var(--foreground))] tabular-nums">
                                                            {s.container_count && s.container_type
                                                                ? `${s.container_count}×${s.container_type}`
                                                                : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap hidden md:table-cell">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn(
                                                                "text-sm font-medium tabular-nums",
                                                                Number(s.total_docs) > 0 && Number(s.validated_docs) === Number(s.total_docs)
                                                                    ? "text-emerald-400"
                                                                    : Number(s.total_docs) > 0
                                                                        ? "text-amber-400"
                                                                        : "text-[hsl(var(--muted-foreground))]"
                                                            )}>
                                                                {s.total_docs > 0 ? `${s.validated_docs}/${s.total_docs}` : '0'}
                                                            </span>
                                                            {Number(s.total_docs) > 0 && (
                                                                <div className="w-12 h-1.5 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                                                                    <div
                                                                        className={cn(
                                                                            "h-full rounded-full",
                                                                            Number(s.validated_docs) === Number(s.total_docs) ? "bg-emerald-500" : "bg-amber-500"
                                                                        )}
                                                                        style={{ width: `${(Number(s.validated_docs) / Number(s.total_docs)) * 100}%` }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-5 text-right whitespace-nowrap">
                                                        <Badge className={cn("text-xs border whitespace-nowrap", getStatusStyle(s.status))}>
                                                            {s.status?.replace(/_/g, ' ')}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="text-center py-12 px-6">
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">No active shipments</p>
                                        <Button className="mt-4" size="sm" onClick={() => setShowNewShipmentModal(true)}>
                                            Create First Shipment
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* FIX A5: Operational Summary — 4 new useful metrics replacing duplicates */}
                        <div className="grid grid-cols-4 gap-px bg-[hsl(var(--border))] rounded-xl overflow-hidden">
                            <button
                                onClick={() => navigate('/shipments')}
                                className="bg-[hsl(var(--card))] p-4 text-center hover:bg-[hsl(var(--secondary))]/60 transition-colors"
                            >
                                <p className={cn(
                                    "text-xl font-bold tabular-nums",
                                    shipmentsWithUnvalidatedDocs > 0 ? "text-amber-400" : "text-[hsl(var(--foreground))]"
                                )}>
                                    {shipmentsWithUnvalidatedDocs}
                                </p>
                                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium mt-1">
                                    Pending Docs
                                </p>
                            </button>
                            <button
                                onClick={() => navigate('/bookings/fcl')}
                                className="bg-[hsl(var(--card))] p-4 text-center hover:bg-[hsl(var(--secondary))]/60 transition-colors"
                            >
                                <p className={cn(
                                    "text-xl font-bold tabular-nums",
                                    bookingsWithoutDispatch > 0 ? "text-red-400" : "text-[hsl(var(--foreground))]"
                                )}>
                                    {bookingsWithoutDispatch}
                                </p>
                                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium mt-1">
                                    No Dispatch
                                </p>
                            </button>
                            <button
                                onClick={() => navigate('/risks')}
                                className="bg-[hsl(var(--card))] p-4 text-center hover:bg-[hsl(var(--secondary))]/60 transition-colors"
                            >
                                <p className={cn(
                                    "text-xl font-bold tabular-nums",
                                    nearestDeadlineDays != null && nearestDeadlineDays <= 3 ? "text-red-400" :
                                        nearestDeadlineDays != null && nearestDeadlineDays <= 7 ? "text-amber-400" :
                                            "text-[hsl(var(--foreground))]"
                                )}>
                                    {nearestDeadlineDays != null && nearestDeadlineDays < 999
                                        ? `${nearestDeadlineDays}d`
                                        : '—'}
                                </p>
                                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium mt-1">
                                    Next Deadline
                                </p>
                            </button>
                            <button
                                onClick={() => navigate('/shipments')}
                                className="bg-[hsl(var(--card))] p-4 text-center hover:bg-[hsl(var(--secondary))]/60 transition-colors"
                            >
                                <p className="text-xl font-bold text-[hsl(var(--foreground))] tabular-nums">
                                    {completedThisMonth}
                                    {monthChange !== 0 && (
                                        <span className={cn("text-xs ml-1", monthChange > 0 ? "text-emerald-400" : "text-red-400")}>
                                            {monthChange > 0 ? `+${monthChange}%` : `${monthChange}%`}
                                        </span>
                                    )}
                                </p>
                                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium mt-1">
                                    Completed / Month
                                </p>
                            </button>
                        </div>
                    </div>

                    {/* RIGHT — Pipeline + Attention */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* Shipment Pipeline — click-to-filter */}
                        <Card className="overflow-hidden">
                            <div className="px-6 py-4 border-b border-[hsl(var(--border))]">
                                <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider">Shipment Pipeline</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                {loading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-5 w-full" />)}
                                    </div>
                                ) : (
                                    <>
                                        {pipelineItems.map((item) => (
                                            <button
                                                key={item.label}
                                                onClick={() => navigate(`/shipments?status=${item.status}`)}
                                                className="w-full space-y-1.5 hover:opacity-80 transition-opacity text-left"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">{item.label}</span>
                                                    <span className="text-xs font-bold text-[hsl(var(--foreground))] tabular-nums">{item.value}</span>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                                                    <div
                                                        className={cn("h-full rounded-full transition-all duration-700 ease-out", item.accent)}
                                                        style={{ width: `${Math.max((item.value / maxPipeline) * 100, item.value > 0 ? 6 : 0)}%` }}
                                                    />
                                                </div>
                                            </button>
                                        ))}
                                        {/* FIX A8: Separate Active vs Delivered */}
                                        <div className="pt-3 mt-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">Active</span>
                                            <span className="text-sm font-bold text-[hsl(var(--foreground))] tabular-nums">{activeShipments}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">Delivered</span>
                                            <span className="text-sm font-bold text-emerald-400 tabular-nums">{metrics?.shipments.delivered ?? 0}</span>
                                        </div>
                                        {onTimeRate != null && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">On-time Rate</span>
                                                <span className={cn(
                                                    "text-sm font-bold tabular-nums",
                                                    (onTimeRate ?? 0) >= 90 ? "text-emerald-400" : (onTimeRate ?? 0) >= 70 ? "text-amber-400" : "text-red-400"
                                                )}>
                                                    {onTimeRate}%
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </Card>

                        {/* Needs Attention — fixed labels */}
                        <Card className="overflow-hidden">
                            <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider">Needs Attention</h2>
                                {totalAttentionItems > 0 && (
                                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        {totalAttentionItems} items
                                    </span>
                                )}
                            </div>
                            <div className="divide-y divide-[hsl(var(--border))]/50">
                                {loading ? (
                                    <div className="p-6 space-y-3">
                                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                                    </div>
                                ) : totalAttentionItems > 0 ? (
                                    <>
                                        {shipmentsWithUnvalidatedDocs > 0 && (
                                            <button onClick={() => navigate('/shipments')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-[hsl(var(--secondary))]/50 transition-colors text-left">
                                                <div>
                                                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">Orders pending doc validation</p>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Uploaded but not yet validated</p>
                                                </div>
                                                <span className="text-lg font-bold text-amber-400 tabular-nums">{shipmentsWithUnvalidatedDocs}</span>
                                            </button>
                                        )}
                                        {missingDocs > 0 && (
                                            <button onClick={() => navigate('/shipments?filter=missing-docs')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-[hsl(var(--secondary))]/50 transition-colors text-left">
                                                <div>
                                                    <p className="text-sm font-medium text-red-400">Shipments without documents</p>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Active shipments with no uploaded documents</p>
                                                </div>
                                                <span className="text-lg font-bold text-red-400 tabular-nums">{missingDocs}</span>
                                            </button>
                                        )}
                                        {bookingsWithoutDispatch > 0 && (
                                            <button onClick={() => navigate('/bookings/fcl')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-[hsl(var(--secondary))]/50 transition-colors text-left">
                                                <div>
                                                    <p className="text-sm font-medium text-red-400">Bookings without dispatch</p>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Confirmed but no truck dispatch created</p>
                                                </div>
                                                <span className="text-lg font-bold text-red-400 tabular-nums">{bookingsWithoutDispatch}</span>
                                            </button>
                                        )}
                                        {upcomingDeadlines > 0 && (
                                            <button onClick={() => navigate('/risks')} className="w-full flex items-center justify-between px-6 py-4 hover:bg-[hsl(var(--secondary))]/50 transition-colors text-left">
                                                <div>
                                                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">Deadlines within 7 days</p>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{urgentDeadlines > 0 ? `${urgentDeadlines} urgent (≤ 3 days)` : 'No urgent items'}</p>
                                                </div>
                                                <span className="text-lg font-bold text-[hsl(var(--foreground))] tabular-nums">{upcomingDeadlines}</span>
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">All clear — nothing needs attention</p>
                                    </div>
                                )}
                                <div className="px-6 py-3 bg-[hsl(var(--secondary))]/30">
                                    <Link to="/risks">
                                        <span className="text-xs text-[hsl(var(--primary))] hover:underline cursor-pointer font-medium">
                                            Open Risk Dashboard →
                                        </span>
                                    </Link>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
