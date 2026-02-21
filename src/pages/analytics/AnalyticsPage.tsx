import { useState, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { fetchApi } from '@/lib/api';

interface BookingData {
    id: string;
    booking_number: string;
    status: string;
    type?: string;
    origin_port?: string;
    destination_port?: string;
    freight_rate_usd?: number | string;
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
    const [bookings, setBookings] = useState<BookingData[]>([]);
    const [shipments, setShipments] = useState<ShipmentData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bookingsData, shipmentsData] = await Promise.all([
                fetchApi('/api/bookings'),
                fetchApi('/api/shipments'),
            ]);

            setBookings(bookingsData.bookings || []);
            setShipments(shipmentsData.shipments || []);
        } catch (error) {
            console.error('Failed to fetch analytics data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Active = in-progress bookings (not CANCELLED, USED, or COMPLETED)
    const activeBookings = bookings.filter(b => !['CANCELLED', 'USED', 'COMPLETED'].includes(b.status));
    // Active shipments = currently in workflow (not COMPLETED, DELIVERED, or CANCELLED)
    const activeShipments = shipments.filter(s => !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(s.status));

    const totalRevenue = activeBookings.reduce((sum, b) => sum + (parseFloat(String(b.freight_rate_usd)) || 0), 0);
    const totalContainers = activeBookings.reduce((sum, b) => sum + (parseInt(String(b.container_count)) || 0), 0);

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
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    // Group by type (exclude cancelled) — FCL and AIR
    const fclBookings = activeBookings.filter(b => b.type === 'FCL').length;
    const airBookings = activeBookings.filter(b => b.type === 'AIR').length;

    // Group shipments by actual status
    const statusCounts: Record<string, number> = {};
    shipments.forEach(s => {
        const status = s.status || 'UNKNOWN';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const statusEntries = Object.entries(statusCounts)
        .map(([status, count]) => ({ status: status.replace(/_/g, ' '), count }))
        .sort((a, b) => b.count - a.count);

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
                    <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                        Analytics
                    </h1>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        Operational insights from active bookings and shipments
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* KPI Cards — clean, no icons, no gradients */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-5">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Active Bookings</p>
                        <p className="text-3xl font-bold text-[hsl(var(--foreground))] mt-1">{activeBookings.length}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                            of {bookings.length} total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Active Shipments</p>
                        <p className="text-3xl font-bold text-[hsl(var(--foreground))] mt-1">{activeShipments.length}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                            of {shipments.length} total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Revenue</p>
                        <p className="text-3xl font-bold text-[hsl(var(--foreground))] mt-1">{formatCurrency(totalRevenue)}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                            From active bookings
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Containers</p>
                        <p className="text-3xl font-bold text-[hsl(var(--foreground))] mt-1">{totalContainers}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                            TEU/FEU
                        </p>
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
                                { type: 'FCL', count: fclBookings, color: 'bg-[hsl(var(--primary))]' },
                                { type: 'AIR', count: airBookings, color: 'bg-[hsl(var(--primary))]/60' },
                            ].filter(item => item.count > 0).map((item) => (
                                <div key={item.type} className="flex flex-col items-center gap-2 flex-1">
                                    <div className="flex items-end h-48 w-full justify-center">
                                        <div
                                            className={`w-16 ${item.color} rounded-t`}
                                            style={{ height: `${Math.max((item.count / Math.max(activeBookings.length, 1)) * 100, 10)}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">{item.type}</span>
                                    <span className="text-lg font-bold text-[hsl(var(--foreground))]">{item.count}</span>
                                </div>
                            ))}
                            {fclBookings === 0 && airBookings === 0 && (
                                <p className="text-center text-[hsl(var(--muted-foreground))] py-8">No booking data</p>
                            )}
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
                                        <span className="w-24 text-sm font-medium text-[hsl(var(--foreground))]">{dest.country}</span>
                                        <div className="flex-1">
                                            <div className="h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[hsl(var(--primary))] rounded-full"
                                                    style={{ width: `${dest.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                        <span className="text-sm text-[hsl(var(--muted-foreground))] w-20 text-right">{dest.count} {dest.count === 1 ? 'shipment' : 'shipments'}</span>
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
                        {activeBookings.length > 0 ? (
                            <div className="space-y-3">
                                {[...activeBookings]
                                    .sort((a, b) => (parseFloat(String(b.freight_rate_usd)) || 0) - (parseFloat(String(a.freight_rate_usd)) || 0))
                                    .slice(0, 6).map((booking) => {
                                        const rate = parseFloat(String(booking.freight_rate_usd)) || 0;
                                        const maxRate = Math.max(...activeBookings.map(b => parseFloat(String(b.freight_rate_usd)) || 0), 1);
                                        return (
                                            <div key={booking.id} className="flex items-center gap-4">
                                                <span className="w-32 text-sm text-[hsl(var(--muted-foreground))] truncate">{booking.booking_number}</span>
                                                <div className="flex-1 h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-[hsl(var(--primary))]"
                                                        style={{ width: `${Math.max((rate / maxRate) * 100, 2)}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-[hsl(var(--foreground))] w-24 text-right">
                                                    {formatCurrency(rate)}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        ) : (
                            <p className="text-center text-[hsl(var(--muted-foreground))] py-8">No booking data</p>
                        )}
                    </CardContent>
                </Card>

                {/* Shipment Status Overview — uses real statuses from data */}
                <Card>
                    <CardHeader>
                        <CardTitle>Shipment Status Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {statusEntries.length > 0 ? statusEntries.map((item) => (
                                <div key={item.status} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{item.status}</p>
                                    <span className="text-lg font-bold text-[hsl(var(--foreground))]">{item.count}</span>
                                </div>
                            )) : (
                                <p className="text-center text-[hsl(var(--muted-foreground))] py-8">No shipment data</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
