import { useState, useEffect } from 'react';
import {
    Ship,
    Plane,
    Clock,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    FileCheck,
    Package,
    ArrowRight,
    RefreshCw,
    Truck,
    CheckCircle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { NewShipmentModal } from '@/components/modals';

// Types
interface DashboardMetrics {
    shipments: {
        total: number;
        inTransit: number;
        atPort: number;
        delivered: number;
        pending: number;
        inCustoms: number;
        activeBookings?: number; // ALLOCATED/CONFIRMED/USED bookings where ETA >= today
    };
    bookings: {
        total: number;
        fcl: number;
        air: number;
        pending: number;
        confirmed: number;
    };
    documents: {
        total: number;
        validated: number;
        pending: number;
    };
    alerts: {
        total: number;
        critical: number;
        unread: number;
    };
    deadlines: {
        upcoming: number;
        urgent: number;
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
    container_number?: string;
}

// Metric Card Component
interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: number;
    icon: React.ReactNode;
    iconBg?: string;
    loading?: boolean;
}

function MetricCard({ title, value, subtitle, trend, icon, iconBg = 'gradient-primary', loading }: MetricCardProps) {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</p>
                        {loading ? (
                            <div className="h-8 w-20 bg-[hsl(var(--secondary))] rounded animate-pulse mt-1" />
                        ) : (
                            <p className="text-3xl font-bold text-[hsl(var(--foreground))] mt-1">{value}</p>
                        )}
                        {(subtitle || trend !== undefined) && (
                            <div className="flex items-center gap-2 mt-2">
                                {trend !== undefined && (
                                    <span className={cn(
                                        'flex items-center text-sm font-medium',
                                        trend >= 0 ? 'text-green-400' : 'text-red-400'
                                    )}>
                                        {trend >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                                        {Math.abs(trend)}%
                                    </span>
                                )}
                                {subtitle && <span className="text-sm text-[hsl(var(--muted-foreground))]">{subtitle}</span>}
                            </div>
                        )}
                    </div>
                    <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        iconBg
                    )}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function Dashboard() {
    const [showNewShipmentModal, setShowNewShipmentModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [recentShipments, setRecentShipments] = useState<RecentShipment[]>([]);
    const navigate = useNavigate();

    // Fetch dashboard data from API
    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch metrics
            const metricsRes = await fetch('http://localhost:3001/api/dashboard/metrics');
            const metricsData = await metricsRes.json();
            setMetrics(metricsData.metrics);

            // Fetch recent shipments
            const shipmentsRes = await fetch('http://localhost:3001/api/dashboard/recent-shipments');
            const shipmentsData = await shipmentsRes.json();
            setRecentShipments(shipmentsData.shipments || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            // Show zeros instead of fake data when API fails
            setMetrics({
                shipments: { total: 0, inTransit: 0, atPort: 0, delivered: 0, pending: 0, inCustoms: 0 },
                bookings: { total: 0, fcl: 0, air: 0, pending: 0, confirmed: 0 },
                documents: { total: 0, validated: 0, pending: 0 },
                alerts: { total: 0, critical: 0, unread: 0 },
                deadlines: { upcoming: 0, urgent: 0 },
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const handleShipmentCreated = () => {
        navigate('/shipments');
    };

    // Active Shipments: ALLOCATED/CONFIRMED/USED bookings where ETA >= today
    const activeShipments = metrics?.shipments.activeBookings ?? 0;
    const docAccuracy = metrics ? Math.round((metrics.documents.validated / Math.max(metrics.documents.total, 1)) * 100) : 0;

    return (
        <>
            <NewShipmentModal
                isOpen={showNewShipmentModal}
                onClose={() => setShowNewShipmentModal(false)}
                onSuccess={handleShipmentCreated}
            />

            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Dashboard</h1>
                        <p className="text-[hsl(var(--muted-foreground))] mt-1">
                            Welcome back! Here's your logistics overview.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchDashboardData} disabled={loading}>
                            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button variant="outline">
                            <Clock className="w-4 h-4 mr-2" />
                            {formatDate(new Date())}
                        </Button>
                        <Button onClick={() => setShowNewShipmentModal(true)}>
                            <Ship className="w-4 h-4 mr-2" />
                            New Shipment
                        </Button>
                    </div>
                </div>

                {/* Primary Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Active Shipments"
                        value={activeShipments}
                        subtitle={`${metrics?.shipments.inTransit || 0} in transit`}
                        icon={<Ship className="w-6 h-6 text-white" />}
                        loading={loading}
                    />
                    <MetricCard
                        title="FCL Bookings"
                        value={metrics?.bookings.fcl || 0}
                        subtitle={`${metrics?.bookings.confirmed || 0} confirmed`}
                        icon={<Package className="w-6 h-6 text-white" />}
                        iconBg="bg-gradient-to-br from-blue-500 to-cyan-500"
                        loading={loading}
                    />
                    <MetricCard
                        title="AIR Bookings"
                        value={metrics?.bookings.air || 0}
                        subtitle={`${metrics?.bookings.pending || 0} pending`}
                        icon={<Plane className="w-6 h-6 text-white" />}
                        iconBg="bg-gradient-to-br from-purple-500 to-pink-500"
                        loading={loading}
                    />
                    <MetricCard
                        title="Pending Actions"
                        value={metrics?.alerts.unread || 0}
                        subtitle={`${metrics?.alerts.critical || 0} critical`}
                        icon={<AlertTriangle className="w-6 h-6 text-white" />}
                        iconBg="gradient-warning"
                        loading={loading}
                    />
                </div>

                {/* Secondary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MetricCard
                        title="Documents"
                        value={metrics?.documents.total || 0}
                        subtitle={`${metrics?.documents.pending || 0} pending review`}
                        icon={<FileCheck className="w-6 h-6 text-white" />}
                        iconBg="bg-gradient-to-br from-cyan-500 to-blue-500"
                        loading={loading}
                    />
                    <MetricCard
                        title="Doc Accuracy"
                        value={`${docAccuracy}%`}
                        trend={1.5}
                        icon={<CheckCircle className="w-6 h-6 text-white" />}
                        iconBg="bg-gradient-to-br from-green-500 to-emerald-500"
                        loading={loading}
                    />
                    <MetricCard
                        title="Upcoming Deadlines"
                        value={metrics?.deadlines.upcoming || 0}
                        subtitle={`${metrics?.deadlines.urgent || 0} urgent`}
                        icon={<Clock className="w-6 h-6 text-white" />}
                        iconBg="bg-gradient-to-br from-yellow-500 to-orange-500"
                        loading={loading}
                    />
                    <MetricCard
                        title="Dispatches"
                        value={metrics?.shipments.inTransit || 0}
                        subtitle="trucks on road"
                        icon={<Truck className="w-6 h-6 text-white" />}
                        iconBg="bg-gradient-to-br from-indigo-500 to-purple-500"
                        loading={loading}
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Shipments with Confirmed Bookings */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle>Recent Shipments</CardTitle>
                                <Link to="/shipments">
                                    <Button variant="ghost" size="sm">
                                        View All <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </Link>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className="h-16 bg-[hsl(var(--secondary))] rounded-lg animate-pulse" />
                                        ))}
                                    </div>
                                ) : recentShipments.length > 0 ? (
                                    <div className="space-y-3">
                                        {recentShipments.map((shipment) => (
                                            <Link
                                                key={shipment.id}
                                                to={`/shipments/${shipment.id}`}
                                                className="block"
                                            >
                                                <div className="flex items-center gap-4 p-3 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/80 transition-colors">
                                                    {/* Type Icon */}
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center",
                                                        shipment.type === 'FCL' ? "bg-blue-500/20" : "bg-purple-500/20"
                                                    )}>
                                                        {shipment.type === 'FCL' ?
                                                            <Ship className="w-5 h-5 text-blue-400" /> :
                                                            <Plane className="w-5 h-5 text-purple-400" />
                                                        }
                                                    </div>

                                                    {/* Shipment Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-[hsl(var(--foreground))]">
                                                                {shipment.shipment_number}
                                                            </span>
                                                            {shipment.booking_number && (
                                                                <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                                    {shipment.booking_number}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-[hsl(var(--muted-foreground))] truncate">
                                                            {shipment.customer_name || 'Customer'} • {shipment.origin_country} → {shipment.destination_country}
                                                        </p>
                                                    </div>

                                                    {/* Status */}
                                                    <div className="text-right">
                                                        <Badge className={cn(
                                                            "text-xs",
                                                            shipment.status === 'IN_TRANSIT' && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                                                            shipment.status === 'DELIVERED' && "bg-green-500/20 text-green-400 border-green-500/30",
                                                            shipment.status === 'PENDING' && "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
                                                            shipment.status === 'AT_PORT' && "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
                                                            shipment.status === 'CUSTOMS' && "bg-orange-500/20 text-orange-400 border-orange-500/30",
                                                        )}>
                                                            {shipment.status?.replace('_', ' ')}
                                                        </Badge>
                                                        {shipment.eta && (
                                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                                                ETA: {formatDate(shipment.eta)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Ship className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                                        <p className="text-[hsl(var(--muted-foreground))]">No recent shipments</p>
                                        <Button
                                            className="mt-4"
                                            onClick={() => setShowNewShipmentModal(true)}
                                        >
                                            Create First Shipment
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quick Stats / Alerts */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Status Breakdown */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Shipment Status</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {[
                                    { label: 'In Transit', value: metrics?.shipments.inTransit || 0, color: 'bg-blue-500' },
                                    { label: 'At Port', value: metrics?.shipments.atPort || 0, color: 'bg-cyan-500' },
                                    { label: 'In Customs', value: metrics?.shipments.inCustoms || 0, color: 'bg-orange-500' },
                                    { label: 'Delivered', value: metrics?.shipments.delivered || 0, color: 'bg-green-500' },
                                    { label: 'Pending', value: metrics?.shipments.pending || 0, color: 'bg-yellow-500' },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-3 h-3 rounded-full", item.color)} />
                                            <span className="text-sm text-[hsl(var(--muted-foreground))]">{item.label}</span>
                                        </div>
                                        <span className="font-semibold text-[hsl(var(--foreground))]">{item.value}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Link to="/bookings/fcl" className="block">
                                    <Button variant="outline" className="w-full justify-start">
                                        <Package className="w-4 h-4 mr-2" />
                                        New FCL Booking
                                    </Button>
                                </Link>
                                <Link to="/bookings/air" className="block">
                                    <Button variant="outline" className="w-full justify-start">
                                        <Plane className="w-4 h-4 mr-2" />
                                        New AIR Booking
                                    </Button>
                                </Link>
                                <Link to="/logistics" className="block">
                                    <Button variant="outline" className="w-full justify-start">
                                        <Truck className="w-4 h-4 mr-2" />
                                        Schedule Dispatch
                                    </Button>
                                </Link>
                                <Link to="/documents" className="block">
                                    <Button variant="outline" className="w-full justify-start">
                                        <FileCheck className="w-4 h-4 mr-2" />
                                        Upload Documents
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
