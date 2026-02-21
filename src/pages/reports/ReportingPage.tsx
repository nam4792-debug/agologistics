import { useState, useEffect, useCallback } from 'react';
import {
    BarChart3,
    TrendingUp,
    Download,
    RefreshCw,
    Loader2,
    DollarSign,
    Ship,
    Users,
    FileText,
} from 'lucide-react';
import { Card, CardContent, Button } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import { fetchApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { ExchangeRateSettings } from '@/components/CostManagement';

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
interface OverviewData {
    shipments: { total: number; in_transit: number; completed: number; draft: number; fcl_count: number; air_count: number; total_cost: number };
    invoices: { total: number; total_amount: number; paid_amount: number; pending_amount: number; overdue_count: number };
    customers: { total: number };
    bookings: { total: number; confirmed: number; pending: number; allocated: number; used: number; cancelled: number; total_freight_revenue: number };
}

interface CostAnalysis {
    topVendors: Array<{ vendor_name: string; invoice_count: number; total_amount: number }>;
    costByCategory: Array<{ category: string; count: number; total: number }>;
    costByType: Array<{ type: string; shipment_count: number; total_cost: number; avg_cost: number }>;
}

interface Performance {
    byStatus: Array<{ status: string; count: number }>;
    onTimePerformance: { total: number; onTime: number; delayed: number; onTimeRate: number };
    customerRanking: Array<{ customer_name: string; shipment_count: number; total_revenue: number }>;
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
export function ReportingPage() {
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [costAnalysis, setCostAnalysis] = useState<CostAnalysis | null>(null);
    const [performance, setPerformance] = useState<Performance | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('month');
    const [activeTab, setActiveTab] = useState<'overview' | 'costs' | 'performance' | 'export'>('overview');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [overviewRes, costRes, perfRes] = await Promise.all([
                fetchApi(`/api/reports/overview?period=${period}`),
                fetchApi('/api/reports/cost-analysis'),
                fetchApi('/api/reports/performance'),
            ]);
            setOverview(overviewRes);
            setCostAnalysis(costRes);
            setPerformance(perfRes);
        } catch {
            toast.error('Failed to load reports');
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleExport = async (type: string) => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/reports/export/${type}?format=csv`,
                {
                    headers: {
                        Authorization: `Bearer ${(() => {
                            try { return JSON.parse(localStorage.getItem('logispro-auth') || '{}')?.state?.token || ''; }
                            catch { return ''; }
                        })()}`,
                    },
                }
            );
            if (!response.ok) throw new Error('Export failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success(`${type} exported successfully`);
        } catch {
            toast.error('Export failed');
        }
    };

    const tabs = [
        { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
        { id: 'costs' as const, label: 'Cost Analysis', icon: DollarSign },
        { id: 'performance' as const, label: 'Performance', icon: TrendingUp },
        { id: 'export' as const, label: 'Export Data', icon: Download },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] tracking-tight">
                        Reports & Analytics
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        Business intelligence and data export
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    >
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="quarter">Last 90 Days</option>
                        <option value="year">Last Year</option>
                        <option value="all">All Time</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-1.5" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-[hsl(var(--secondary))] rounded-lg w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                            activeTab === tab.id
                                ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))] mx-auto" />
                    <p className="text-[hsl(var(--muted-foreground))] mt-3">Loading reports...</p>
                </div>
            ) : (
                <>
                    {activeTab === 'overview' && overview && <OverviewTab data={overview} />}
                    {activeTab === 'costs' && costAnalysis && <CostAnalysisTab data={costAnalysis} />}
                    {activeTab === 'performance' && performance && <PerformanceTab data={performance} />}
                    {activeTab === 'export' && <ExportTab onExport={handleExport} />}
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════
function OverviewTab({ data }: { data: OverviewData }) {
    const kpiCards = [
        {
            title: 'Total Shipments',
            value: data.shipments.total,
            sub: `${data.shipments.in_transit} in transit`,
            icon: Ship,
            color: 'text-blue-400 bg-blue-500/10',
        },
        {
            title: 'Total Revenue',
            value: formatCurrency(parseFloat(String(data.bookings.total_freight_revenue))),
            sub: `${formatCurrency(parseFloat(String(data.invoices.pending_amount)))} invoices pending`,
            icon: DollarSign,
            color: 'text-green-400 bg-green-500/10',
        },
        {
            title: 'Customers',
            value: data.customers.total,
            sub: 'Active accounts',
            icon: Users,
            color: 'text-purple-400 bg-purple-500/10',
        },
        {
            title: 'Total Invoices',
            value: data.invoices.total,
            sub: `${data.invoices.overdue_count} overdue`,
            icon: FileText,
            color: data.invoices.overdue_count > 0 ? 'text-red-400 bg-red-500/10' : 'text-yellow-400 bg-yellow-500/10',
        },
    ];

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map((kpi, i) => (
                    <Card key={i}>
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{kpi.title}</p>
                                    <p className="text-2xl font-bold text-[hsl(var(--foreground))] mt-1">{kpi.value}</p>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{kpi.sub}</p>
                                </div>
                                <div className={cn('p-2.5 rounded-lg', kpi.color)}>
                                    <kpi.icon className="w-5 h-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Shipment Type Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardContent className="p-5">
                        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Shipments by Type</h3>
                        <div className="space-y-4">
                            {[
                                { type: 'FCL', count: data.shipments.fcl_count, color: 'bg-blue-500' },
                                { type: 'AIR', count: data.shipments.air_count, color: 'bg-purple-500' },
                            ].map(item => {
                                const pct = data.shipments.total > 0 ? (item.count / data.shipments.total) * 100 : 0;
                                return (
                                    <div key={item.type}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-[hsl(var(--foreground))] font-medium">{item.type}</span>
                                            <span className="text-[hsl(var(--muted-foreground))]">{item.count} ({pct.toFixed(0)}%)</span>
                                        </div>
                                        <div className="h-2.5 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                                            <div className={cn('h-full rounded-full transition-all', item.color)} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5">
                        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Booking Status</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{data.bookings.total}</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Total</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-green-500/10">
                                <p className="text-2xl font-bold text-green-400">{data.bookings.confirmed}</p>
                                <p className="text-xs text-green-400/70 mt-1">Confirmed</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-blue-500/10">
                                <p className="text-2xl font-bold text-blue-400">{data.bookings.allocated}</p>
                                <p className="text-xs text-blue-400/70 mt-1">Allocated</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                                <p className="text-2xl font-bold text-yellow-400">{data.bookings.pending}</p>
                                <p className="text-xs text-yellow-400/70 mt-1">Pending</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-purple-500/10">
                                <p className="text-2xl font-bold text-purple-400">{data.bookings.used}</p>
                                <p className="text-xs text-purple-400/70 mt-1">Used</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-red-500/10">
                                <p className="text-2xl font-bold text-red-400">{data.bookings.cancelled}</p>
                                <p className="text-xs text-red-400/70 mt-1">Cancelled</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════
// COST ANALYSIS TAB
// ═══════════════════════════════════════════════
function CostAnalysisTab({ data }: { data: CostAnalysis }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Vendors */}
                <Card>
                    <CardContent className="p-5">
                        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Top Vendors by Cost</h3>
                        {data.topVendors.length > 0 ? (
                            <div className="space-y-3">
                                {data.topVendors.map((v, i) => {
                                    const maxAmount = data.topVendors[0]?.total_amount || 1;
                                    const pct = (parseFloat(String(v.total_amount)) / parseFloat(String(maxAmount))) * 100;
                                    return (
                                        <div key={i}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-[hsl(var(--foreground))]">{v.vendor_name}</span>
                                                <span className="text-[hsl(var(--muted-foreground))] font-mono">
                                                    {formatCurrency(parseFloat(String(v.total_amount)))}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{v.invoice_count} invoices</p>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-center text-[hsl(var(--muted-foreground))] py-6">No vendor data</p>
                        )}
                    </CardContent>
                </Card>

                {/* Cost by Category */}
                <Card>
                    <CardContent className="p-5">
                        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Cost by Category</h3>
                        {data.costByCategory.length > 0 ? (
                            <div className="space-y-3">
                                {data.costByCategory.map((cat, i) => {
                                    const total = data.costByCategory.reduce((s, c) => s + parseFloat(String(c.total)), 0);
                                    const pct = total > 0 ? (parseFloat(String(cat.total)) / total) * 100 : 0;
                                    return (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                            <div>
                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{cat.category}</p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{cat.count} invoices</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-mono text-[hsl(var(--foreground))]">{formatCurrency(parseFloat(String(cat.total)))}</p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{pct.toFixed(1)}%</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-center text-[hsl(var(--muted-foreground))] py-6">No category data</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Cost by Shipment Type */}
            <Card>
                <CardContent className="p-5">
                    <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Average Cost by Shipment Type</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {data.costByType.map((ct, i) => (
                            <div key={i} className="p-4 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))]">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-lg font-bold text-[hsl(var(--foreground))]">{ct.type}</span>
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{ct.shipment_count} shipments</span>
                                </div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Cost</p>
                                <p className="text-xl font-bold font-mono text-[hsl(var(--foreground))]">
                                    {formatCurrency(parseFloat(String(ct.total_cost)))}
                                </p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                    Avg: <span className="font-mono text-[hsl(var(--foreground))]">{formatCurrency(parseFloat(String(ct.avg_cost)))}</span> /shipment
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Exchange Rate Settings */}
            <ExchangeRateSettings />
        </div>
    );
}

// ═══════════════════════════════════════════════
// PERFORMANCE TAB
// ═══════════════════════════════════════════════
function PerformanceTab({ data }: { data: Performance }) {
    return (
        <div className="space-y-6">
            {/* On-time Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardContent className="p-5">
                        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">On-Time Delivery</h3>
                        <div className="flex items-center justify-center mb-4">
                            <div className="relative w-32 h-32">
                                <svg className="w-full h-full" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3" stroke="hsl(var(--secondary))" />
                                    <circle
                                        cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3"
                                        stroke={data.onTimePerformance.onTimeRate >= 80 ? '#22c55e' : data.onTimePerformance.onTimeRate >= 50 ? '#eab308' : '#ef4444'}
                                        strokeDasharray={`${data.onTimePerformance.onTimeRate} ${100 - data.onTimePerformance.onTimeRate}`}
                                        strokeDashoffset="25"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                        {data.onTimePerformance.onTimeRate}%
                                    </span>
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">On Time</span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded bg-[hsl(var(--secondary))]">
                                <p className="text-lg font-bold text-[hsl(var(--foreground))]">{data.onTimePerformance.total}</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Tracked</p>
                            </div>
                            <div className="p-2 rounded bg-green-500/10">
                                <p className="text-lg font-bold text-green-400">{data.onTimePerformance.onTime}</p>
                                <p className="text-xs text-green-400/70">On Time</p>
                            </div>
                            <div className="p-2 rounded bg-red-500/10">
                                <p className="text-lg font-bold text-red-400">{data.onTimePerformance.delayed}</p>
                                <p className="text-xs text-red-400/70">Delayed</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Status Distribution */}
                <Card>
                    <CardContent className="p-5">
                        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Shipment Status Distribution</h3>
                        <div className="space-y-2">
                            {data.byStatus.map((s, i) => {
                                const total = data.byStatus.reduce((sum, x) => sum + parseInt(String(x.count)), 0);
                                const pct = total > 0 ? (parseInt(String(s.count)) / total) * 100 : 0;
                                return (
                                    <div key={i} className="flex items-center justify-between p-2.5 rounded bg-[hsl(var(--secondary))]">
                                        <div className="flex items-center gap-2">
                                            <div className={cn('w-2 h-2 rounded-full', {
                                                'bg-green-500': s.status === 'COMPLETED',
                                                'bg-blue-500': s.status === 'IN_TRANSIT',
                                                'bg-yellow-500': s.status === 'DRAFT',
                                                'bg-purple-500': s.status === 'BOOKED',
                                                'bg-gray-400': !['COMPLETED', 'IN_TRANSIT', 'DRAFT', 'BOOKED'].includes(s.status),
                                            })} />
                                            <span className="text-sm text-[hsl(var(--foreground))]">
                                                {s.status.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-mono text-[hsl(var(--foreground))]">{s.count}</span>
                                            <span className="text-xs text-[hsl(var(--muted-foreground))] w-12 text-right">{pct.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Customer Ranking */}
            <Card>
                <CardContent className="p-5">
                    <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Top Customers</h3>
                    {data.customerRanking.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[hsl(var(--border))]">
                                        <th className="text-left p-3 text-sm font-semibold text-[hsl(var(--muted-foreground))]">#</th>
                                        <th className="text-left p-3 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Customer</th>
                                        <th className="text-right p-3 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Shipments</th>
                                        <th className="text-right p-3 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Total Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.customerRanking.map((c, i) => (
                                        <tr key={i} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]">
                                            <td className="p-3 text-sm text-[hsl(var(--muted-foreground))]">{i + 1}</td>
                                            <td className="p-3 text-sm font-medium text-[hsl(var(--foreground))]">{c.customer_name}</td>
                                            <td className="p-3 text-sm text-right text-[hsl(var(--foreground))]">{c.shipment_count}</td>
                                            <td className="p-3 text-sm text-right font-mono text-[hsl(var(--foreground))]">
                                                {formatCurrency(parseFloat(String(c.total_revenue)))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center text-[hsl(var(--muted-foreground))] py-6">No customer data</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ═══════════════════════════════════════════════
// EXPORT TAB
// ═══════════════════════════════════════════════
function ExportTab({ onExport }: { onExport: (type: string) => void }) {
    const exports = [
        {
            type: 'shipments',
            title: 'Shipments',
            description: 'Export all shipment data including status, dates, costs, and customer info',
            icon: Ship,
            color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        },
        {
            type: 'invoices',
            title: 'Invoices',
            description: 'Export all invoice data with amounts, status, vendor info, and payment details',
            icon: FileText,
            color: 'text-green-400 bg-green-500/10 border-green-500/20',
        },
        {
            type: 'customers',
            title: 'Customers',
            description: 'Export customer directory with contact details and shipment history',
            icon: Users,
            color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        },
    ];

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-5">
                    <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-2">Data Export</h3>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
                        Download your data as CSV files for use in Excel, Google Sheets, or other tools.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {exports.map(exp => (
                            <div key={exp.type} className={cn('p-5 rounded-xl border transition-colors hover:border-opacity-60', exp.color)}>
                                <exp.icon className="w-8 h-8 mb-3" />
                                <h4 className="text-[hsl(var(--foreground))] font-semibold mb-1">{exp.title}</h4>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4 leading-relaxed">
                                    {exp.description}
                                </p>
                                <Button
                                    size="sm"
                                    onClick={() => onExport(exp.type)}
                                    className="w-full bg-[hsl(var(--primary))] text-white"
                                >
                                    <Download className="w-4 h-4 mr-1.5" />
                                    Export CSV
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
