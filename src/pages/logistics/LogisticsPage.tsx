import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, Button, Input, Badge } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { DispatchModal } from '@/components/logistics';
import toast from 'react-hot-toast';
import { fetchApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface BookingData {
    id: string;
    booking_number: string;
    status: string;
    route?: string;
    origin_port?: string;
    destination_port?: string;
    etd?: string;
    cut_off_cy?: string;
    container_type?: string;
    container_count?: number;
    vessel_flight?: string;
}

interface DispatchData {
    id: string;
    booking_id: string;
    booking_number: string;
    shipment_number?: string;
    origin_port?: string;
    destination_port?: string;
    driver_name: string;
    driver_phone: string;
    truck_plate: string;
    trailer_plate?: string;
    container_number?: string;
    seal_number?: string;
    pickup_datetime: string;
    pickup_location: string;
    delivery_location: string;
    status: string;
}

export function LogisticsPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<{ id: string; number: string; containerType?: string } | null>(null);

    // Real data from API
    const [confirmedBookings, setConfirmedBookings] = useState<BookingData[]>([]);
    const [dispatches, setDispatches] = useState<DispatchData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch confirmed bookings
            const bookingsData = await fetchApi('/api/bookings?status=CONFIRMED');
            setConfirmedBookings(bookingsData.bookings || []);

            // Fetch dispatches
            const dispatchData = await fetchApi('/api/truck-dispatches');
            setDispatches(dispatchData.dispatches || []);
        } catch (error) {
            console.error('Failed to fetch logistics data:', error);
            // Fallback to empty arrays
            setConfirmedBookings([]);
            setDispatches([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter bookings awaiting dispatch (confirmed but no dispatch)
    const dispatchedBookingIds = dispatches.map(d => d.booking_id);
    const bookingsAwaitingDispatch = confirmedBookings.filter(
        b => !dispatchedBookingIds.includes(b.id)
    );

    const filteredDispatches = dispatches.filter(d => {
        const matchesSearch =
            d.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.booking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.container_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.truck_plate?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SCHEDULED': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
            case 'IN_TRANSIT': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
            case 'COMPLETED': return 'text-green-400 bg-green-500/10 border-green-500/30';
            case 'CANCELLED': return 'text-red-400 bg-red-500/10 border-red-500/30';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SCHEDULED': return '●';
            case 'IN_TRANSIT': return '▶';
            case 'COMPLETED': return '✓';
            default: return '!';
        }
    };

    const calculateDaysUntil = (dateStr: string) => {
        if (!dateStr) return null;
        const targetDate = new Date(dateStr);
        const now = new Date();
        const diff = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const handleNewDispatch = (booking?: BookingData) => {
        if (booking) {
            setSelectedBooking({
                id: booking.id,
                number: booking.booking_number,
                containerType: booking.container_type
            });
        } else {
            setSelectedBooking({ id: 'new', number: 'NEW' });
        }
        setShowDispatchModal(true);
    };

    const handleDispatchCreated = () => {
        toast.success('Dispatch created successfully!');
        setSelectedBooking(null);
        fetchData();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
            </div>
        );
    }

    return (
        <>
            {/* Dispatch Modal */}
            {selectedBooking && (
                <DispatchModal
                    isOpen={showDispatchModal}
                    onClose={() => {
                        setShowDispatchModal(false);
                        setSelectedBooking(null);
                    }}
                    onSuccess={handleDispatchCreated}
                    bookingId={selectedBooking.id}
                    bookingNumber={selectedBooking.number}
                    containerType={selectedBooking.containerType || '40GP'}
                />
            )}

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] tracking-tight">
                            Logistics & Dispatch
                        </h1>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                            Manage truck dispatches and container movements
                        </p>
                    </div>
                    <Button size="sm" onClick={() => handleNewDispatch()}>
                        New Dispatch
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Dispatches', value: dispatches.length, color: 'from-blue-500 to-cyan-500' },
                        { label: 'Awaiting Dispatch', value: bookingsAwaitingDispatch.length, color: 'from-yellow-500 to-orange-500' },
                        { label: 'In Transit', value: dispatches.filter(d => d.status === 'IN_TRANSIT').length, color: 'from-purple-500 to-pink-500' },
                        { label: 'Completed', value: dispatches.filter(d => d.status === 'COMPLETED').length, color: 'from-green-500 to-emerald-500' },
                    ].map((stat, i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center",
                                        stat.color
                                    )}>
                                        <span className="text-lg font-bold text-white">{stat.value}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{stat.label}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* ⚠️ URGENT: Confirmed Bookings Without Dispatch - FROM REAL DATA */}
                {bookingsAwaitingDispatch.length > 0 && (
                    <Card className="border-yellow-500/50 bg-yellow-500/5">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-yellow-400 font-bold">!</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-yellow-400 flex items-center gap-2">
                                        Confirmed Bookings Awaiting Dispatch
                                        <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                            {bookingsAwaitingDispatch.length} Booking(s)
                                        </Badge>
                                    </h3>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                        These bookings are confirmed but no truck dispatch has been scheduled yet
                                    </p>
                                    <div className="mt-3 space-y-2">
                                        {bookingsAwaitingDispatch.map((booking) => {
                                            const daysToETD = calculateDaysUntil(booking.etd || '');
                                            const daysToCY = calculateDaysUntil(booking.cut_off_cy || '');

                                            return (
                                                <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                                    <div className="flex items-center gap-3">
                                                        <div>
                                                            <p className="font-medium text-[hsl(var(--foreground))]">{booking.booking_number}</p>
                                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                {booking.origin_port} → {booking.destination_port}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        {/* CY Closing Time */}
                                                        <div className="text-right">
                                                            <p className={cn(
                                                                "text-xs font-medium",
                                                                daysToCY !== null && daysToCY <= 2 ? "text-red-400" : "text-yellow-400"
                                                            )}>
                                                                CY Close: {booking.cut_off_cy ? formatDate(booking.cut_off_cy) : 'N/A'}
                                                            </p>
                                                            {daysToCY !== null && (
                                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                    {daysToCY} day(s) left
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* ETD */}
                                                        <div className="text-right border-l border-[hsl(var(--border))] pl-4">
                                                            <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                                                                ETD: {booking.etd ? formatDate(booking.etd) : 'N/A'}
                                                            </p>
                                                            {daysToETD !== null && (
                                                                <p className={cn(
                                                                    "text-xs",
                                                                    daysToETD <= 3 ? "text-red-400" : daysToETD <= 5 ? "text-yellow-400" : "text-[hsl(var(--muted-foreground))]"
                                                                )}>
                                                                    {daysToETD} day(s) to sail
                                                                </p>
                                                            )}
                                                        </div>

                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleNewDispatch(booking)}
                                                        >
                                                            Schedule
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <Input
                                    placeholder="Search by driver, booking, container, truck plate..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                {['ALL', 'SCHEDULED', 'IN_TRANSIT', 'COMPLETED'].map(status => (
                                    <Button
                                        key={status}
                                        variant={statusFilter === status ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setStatusFilter(status)}
                                    >
                                        {status === 'ALL' ? 'All' : status.replace('_', ' ')}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Dispatch List */}
                <div className="space-y-4">
                    {filteredDispatches.length > 0 ? (
                        filteredDispatches.map((dispatch) => (
                            <Card key={dispatch.id} hover>
                                <CardContent className="p-6">
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        {/* Left - Driver & Vehicle */}
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-lg font-bold">
                                                {dispatch.driver_name?.split(' ').map(n => n[0]).join('') || 'DR'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-[hsl(var(--foreground))]">
                                                        {dispatch.driver_name}
                                                    </h3>
                                                    <Badge className={cn("text-xs", getStatusColor(dispatch.status))}>
                                                        {getStatusIcon(dispatch.status)}
                                                        <span className="ml-1">{dispatch.status.replace('_', ' ')}</span>
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                                                    <span>{dispatch.driver_phone}</span>
                                                    <span>{dispatch.truck_plate}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Middle - Container, Route & Shipment Context */}
                                        <div className="flex-1 lg:border-l lg:border-r border-[hsl(var(--border))] lg:px-6">
                                            {/* Booking + Shipment Reference */}
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                                                    {dispatch.booking_number}
                                                </Badge>
                                                {dispatch.shipment_number && (
                                                    <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                                                        {dispatch.shipment_number}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Container</p>
                                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                                        {dispatch.container_number || 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Seal</p>
                                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                                        {dispatch.seal_number || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2 text-sm">
                                                <span className="text-green-400 text-xs font-medium">From:</span>
                                                <span className="text-[hsl(var(--muted-foreground))]">{dispatch.pickup_location}</span>
                                                <span className="text-[hsl(var(--muted-foreground))]">→</span>
                                                <span className="text-red-400 text-xs font-medium">To:</span>
                                                <span className="text-[hsl(var(--muted-foreground))]">{dispatch.delivery_location}</span>
                                            </div>
                                        </div>

                                        {/* Right - Schedule & Actions */}
                                        <div className="flex items-center justify-between lg:flex-col lg:items-end gap-2">
                                            <div className="text-right">
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Pickup</p>
                                                <p className="font-medium text-[hsl(var(--foreground))]">
                                                    {new Date(dispatch.pickup_datetime).toLocaleDateString('vi-VN')}
                                                </p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                    {new Date(dispatch.pickup_datetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => navigate(`/bookings/${dispatch.booking_id}`)}>
                                                Details
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-12">
                            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No dispatches found</h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                {confirmedBookings.length > 0
                                    ? 'Schedule a dispatch for confirmed bookings above'
                                    : 'Confirm bookings first to schedule dispatches'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
