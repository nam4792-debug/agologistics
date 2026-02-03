import { useState, useEffect } from 'react';
import {
    BarChart3,
    TrendingUp,
    Ship,
    DollarSign,
    Clock,
    Calendar,
    Loader2,
    RefreshCw,
    Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Select } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

interface BookingData {
    id: string;
    booking_number: string;
    status: string;
    type?: string;
    origin_port?: string;
    destination_port?: string;
    freight_rate?: number;
    container_count?: number;
    created_at?: string;
}

interface ShipmentData {
    id: string;
    shipment_number: string;
    status: string;
    type?: string;
    destination_country?: string;
}

export function AnalyticsPage() {
    const [period, setPeriod] = useState('MONTH');
    const [bookings, setBookings] = useState<BookingData[]>([]);
    const [shipments, setShipments] = useState<ShipmentData[]>([]);
    const [loading, setLoading] = useState(true);

    const periodOptions = [
        { value: 'WEEK', label: 'This Week' },
        { value: 'MONTH', label: 'This Month' },
        { value: 'QUARTER', label: 'This Quarter' },
        { value: 'YEAR', label: 'This Year' },
    ];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bookingsRes, shipmentsRes] = await Promise.all([
                fetch('http://localhost:3001/api/bookings?status=CONFIRMED'),
                fetch('http://localhost:3001/api/shipments'),
            ]);

            const bookingsData = await bookingsRes.json();
            const shipmentsData = await shipmentsRes.json();

            setBookings(bookingsData.bookings || []);
            setShipments(shipmentsData.shipments || []);
        } catch (error) {
            console.error('Failed to fetch analytics data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate stats from real data
    const confirmedStatuses = ['BOOKING_CONFIRMED', 'DOCUMENTATION_IN', 'READY_TO', 'LOADING', 'LOADED', 'IN_TRANSIT'];
    const activeShipments = shipments.filter(s => confirmedStatuses.includes(s.status));

    const totalRevenue = bookings.reduce((sum, b) => sum + (b.freight_rate || 0), 0);
    const totalContainers = bookings.reduce((sum, b) => sum + (b.container_count || 0), 0);

    // Group by destination
    const destinationCounts: Record<string, number> = {};
    shipments.forEach(s => {
        const dest = s.destination_country || 'Other';
        destinationCounts[dest] = (destinationCounts[dest] || 0) + 1;
    });

    const destinations = Object.entries(destinationCounts)
        .map(([country, count]) => ({
            country,
            count,
            percentage: Math.round((count / Math.max(shipments.length, 1)) * 100),
            flag: getCountryFlag(country),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    // Group by type
    const fclBookings = bookings.filter(b => b.type === 'FCL').length;
    const airBookings = bookings.filter(b => b.type === 'AIR').length;
    const lclBookings = bookings.filter(b => b.type === 'LCL').length;

    function getCountryFlag(country: string): string {
        const flags: Record<string, string> = {
            'Vietnam': '🇻🇳',
            'India': '🇮🇳',
            'China': '🇨🇳',
            'Japan': '🇯🇵',
            'UAE': '🇦🇪',
            'Netherlands': '🇳🇱',
            'Singapore': '🇸🇬',
            'Thailand': '🇹🇭',
            'Korea': '🇰🇷',
            'USA': '🇺🇸',
        };
        return flags[country] || '🌍';
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] flex items-center gap-3">
                        <BarChart3 className="w-8 h-8" />
                        Analytics
                    </h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Real-time insights from confirmed bookings
                    </p>
                </div>
                <div className="flex gap-2">
                    <div className="w-40">
                        <Select
                            options={periodOptions}
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button>
                        <Calendar className="w-4 h-4 mr-2" />
                        Export Report
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="gradient-primary text-white">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-white/80">Confirmed Bookings</p>
                                <p className="text-3xl font-bold">{bookings.length}</p>
                                <p className="text-sm text-white/80 mt-1">
                                    <TrendingUp className="w-3 h-3 inline mr-1" />
                                    Active bookings
                                </p>
                            </div>
                            <Ship className="w-10 h-10 text-white/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-white/80">Active Shipments</p>
                                <p className="text-3xl font-bold">{activeShipments.length}</p>
                                <p className="text-sm text-white/80 mt-1">
                                    <TrendingUp className="w-3 h-3 inline mr-1" />
                                    In progress
                                </p>
                            </div>
                            <Clock className="w-10 h-10 text-white/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-white/80">Total Revenue</p>
                                <p className="text-3xl font-bold">{formatCurrency(totalRevenue)}</p>
                                <p className="text-sm text-white/80 mt-1">
                                    <TrendingUp className="w-3 h-3 inline mr-1" />
                                    From confirmed
                                </p>
                            </div>
                            <DollarSign className="w-10 h-10 text-white/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-white/80">Total Containers</p>
                                <p className="text-3xl font-bold">{totalContainers}</p>
                                <p className="text-sm text-white/80 mt-1">
                                    <Package className="w-3 h-3 inline mr-1" />
                                    TEU/FEU
                                </p>
                            </div>
                            <BarChart3 className="w-10 h-10 text-white/50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Booking Type Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Booking Type Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 flex items-end justify-around gap-8 px-8">
                            {[
                                { type: 'FCL', count: fclBookings, color: 'bg-blue-500' },
                                { type: 'AIR', count: airBookings, color: 'bg-purple-500' },
                                { type: 'LCL', count: lclBookings, color: 'bg-cyan-500' },
                            ].map((item) => (
                                <div key={item.type} className="flex flex-col items-center gap-2 flex-1">
                                    <div className="flex items-end h-48 w-full justify-center">
                                        <div
                                            className={`w-16 ${item.color} rounded-t`}
                                            style={{ height: `${Math.max((item.count / Math.max(bookings.length, 1)) * 100, 10)}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">{item.type}</span>
                                    <span className="text-lg font-bold text-[hsl(var(--foreground))]">{item.count}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-center gap-6 mt-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-blue-500" />
                                <span className="text-sm text-[hsl(var(--muted-foreground))]">FCL</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-purple-500" />
                                <span className="text-sm text-[hsl(var(--muted-foreground))]">Air</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-cyan-500" />
                                <span className="text-sm text-[hsl(var(--muted-foreground))]">LCL</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Destination Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Destinations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {destinations.length > 0 ? (
                            <div className="space-y-4">
                                {destinations.map((dest) => (
                                    <div key={dest.country} className="flex items-center gap-4">
                                        <span className="text-2xl">{dest.flag}</span>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-sm text-[hsl(var(--foreground))]">{dest.country}</span>
                                                <span className="text-sm text-[hsl(var(--muted-foreground))]">{dest.count} shipments</span>
                                            </div>
                                            <div className="h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[hsl(var(--primary))] rounded-full"
                                                    style={{ width: `${dest.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-[hsl(var(--muted-foreground))] py-8">No destination data</p>
                        )}
                    </CardContent>
                </Card>

                {/* Revenue by Booking */}
                <Card>
                    <CardHeader>
                        <CardTitle>Revenue by Booking</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {bookings.length > 0 ? (
                            <div className="space-y-3">
                                {bookings.slice(0, 6).map((booking) => (
                                    <div key={booking.id} className="flex items-center gap-4">
                                        <div className="w-3 h-3 rounded bg-[hsl(var(--primary))]" />
                                        <span className="w-28 text-sm text-[hsl(var(--muted-foreground))]">{booking.booking_number}</span>
                                        <div className="flex-1 h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-[hsl(var(--primary))]"
                                                style={{ width: `${Math.min((booking.freight_rate || 0) / Math.max(totalRevenue, 1) * 100 * bookings.length, 100)}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium text-[hsl(var(--foreground))] w-24 text-right">
                                            {formatCurrency(booking.freight_rate || 0)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-[hsl(var(--muted-foreground))] py-8">No booking data</p>
                        )}
                    </CardContent>
                </Card>

                {/* Shipment Status Overview */}
                <Card>
                    <CardHeader>
                        <CardTitle>Shipment Status Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { status: 'Booking Confirmed', count: shipments.filter(s => s.status === 'BOOKING_CONFIRMED').length, color: 'bg-blue-500' },
                                { status: 'Documentation In', count: shipments.filter(s => s.status === 'DOCUMENTATION_IN').length, color: 'bg-cyan-500' },
                                { status: 'Loading', count: shipments.filter(s => s.status === 'LOADING' || s.status === 'LOADED').length, color: 'bg-yellow-500' },
                                { status: 'In Transit', count: shipments.filter(s => s.status === 'IN_TRANSIT').length, color: 'bg-green-500' },
                            ].map((item) => (
                                <div key={item.status} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.color}/20`}>
                                            <span className="text-lg font-bold">{item.count}</span>
                                        </div>
                                        <p className="font-medium text-[hsl(var(--foreground))]">{item.status}</p>
                                    </div>
                                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
