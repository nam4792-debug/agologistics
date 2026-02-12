import { useState, useEffect } from 'react';
import {
    Truck,
    Plus,
    Search,
    MapPin,
    Phone,
    Clock,
    Package,
    CheckCircle,
    AlertTriangle,
    Eye,
    ChevronRight,
    Loader2,
    Calendar,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Badge } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { DispatchModal } from '@/components/logistics';
import toast from 'react-hot-toast';
import { API_URL } from '@/lib/api';

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
    bookingId: string;
    bookingNumber: string;
    driverName: string;
    driverPhone: string;
    truckPlate: string;
    trailerPlate?: string;
    containerNumber?: string;
    sealNumber?: string;
    pickupDatetime: string;
    pickupLocation: string;
    deliveryLocation: string;
    status: string;
}

export function LogisticsPage() {
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
            const bookingsRes = await fetch(`${API_URL}/api/bookings?status=CONFIRMED`);
            const bookingsData = await bookingsRes.json();
            setConfirmedBookings(bookingsData.bookings || []);

            // Fetch dispatches
            const dispatchRes = await fetch(`${API_URL}/api/truck-dispatches`);
            const dispatchData = await dispatchRes.json();
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
    const dispatchedBookingIds = dispatches.map(d => d.bookingId);
    const bookingsAwaitingDispatch = confirmedBookings.filter(
        b => !dispatchedBookingIds.includes(b.id)
    );

    const filteredDispatches = dispatches.filter(d => {
        const matchesSearch =
            d.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.bookingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.containerNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.truckPlate?.toLowerCase().includes(searchQuery.toLowerCase());
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
            case 'SCHEDULED': return <Clock className="w-4 h-4" />;
            case 'IN_TRANSIT': return <Truck className="w-4 h-4" />;
            case 'COMPLETED': return <CheckCircle className="w-4 h-4" />;
            default: return <AlertTriangle className="w-4 h-4" />;
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
                        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] flex items-center gap-3">
                            <Truck className="w-8 h-8" />
                            Logistics & Dispatch
                        </h1>
                        <p className="text-[hsl(var(--muted-foreground))] mt-1">
                            Manage truck dispatches and container movements
                        </p>
                    </div>
                    <Button onClick={() => handleNewDispatch()}>
                        <Plus className="w-4 h-4 mr-2" />
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
                                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
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
                                                        <Package className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
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
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3 text-red-400" />
                                                                <p className={cn(
                                                                    "text-xs font-medium",
                                                                    daysToCY !== null && daysToCY <= 2 ? "text-red-400" : "text-yellow-400"
                                                                )}>
                                                                    CY Close: {booking.cut_off_cy ? formatDate(booking.cut_off_cy) : 'N/A'}
                                                                </p>
                                                            </div>
                                                            {daysToCY !== null && (
                                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                    {daysToCY} day(s) left
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* ETD */}
                                                        <div className="text-right border-l border-[hsl(var(--border))] pl-4">
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3 text-blue-400" />
                                                                <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                                                                    ETD: {booking.etd ? formatDate(booking.etd) : 'N/A'}
                                                                </p>
                                                            </div>
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
                                                            <Truck className="w-4 h-4 mr-1" />
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
                                    icon={<Search className="w-4 h-4" />}
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
                                                {dispatch.driverName?.split(' ').map(n => n[0]).join('') || 'DR'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-[hsl(var(--foreground))]">
                                                        {dispatch.driverName}
                                                    </h3>
                                                    <Badge className={cn("text-xs", getStatusColor(dispatch.status))}>
                                                        {getStatusIcon(dispatch.status)}
                                                        <span className="ml-1">{dispatch.status.replace('_', ' ')}</span>
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />
                                                        {dispatch.driverPhone}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Truck className="w-3 h-3" />
                                                        {dispatch.truckPlate}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Middle - Container & Route */}
                                        <div className="flex-1 lg:border-l lg:border-r border-[hsl(var(--border))] lg:px-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Container</p>
                                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                                        {dispatch.containerNumber || 'N/A'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Seal</p>
                                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                                        {dispatch.sealNumber || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2 text-sm">
                                                <MapPin className="w-3 h-3 text-green-400" />
                                                <span className="text-[hsl(var(--muted-foreground))]">{dispatch.pickupLocation}</span>
                                                <ChevronRight className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                                                <MapPin className="w-3 h-3 text-red-400" />
                                                <span className="text-[hsl(var(--muted-foreground))]">{dispatch.deliveryLocation}</span>
                                            </div>
                                        </div>

                                        {/* Right - Schedule & Actions */}
                                        <div className="flex items-center justify-between lg:flex-col lg:items-end gap-2">
                                            <div className="text-right">
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Pickup</p>
                                                <p className="font-medium text-[hsl(var(--foreground))]">
                                                    {new Date(dispatch.pickupDatetime).toLocaleDateString('vi-VN')}
                                                </p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                    {new Date(dispatch.pickupDatetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <Button variant="outline" size="sm">
                                                <Eye className="w-4 h-4 mr-1" />
                                                Details
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-12">
                            <Truck className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No dispatches found</h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-1">
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
