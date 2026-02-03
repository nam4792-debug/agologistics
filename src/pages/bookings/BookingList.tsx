import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Anchor,
    Plane,
    Calendar,
    Clock,
    AlertTriangle,
    Plus,
    Filter,
    Search,
    Eye,
    CheckCircle,
    RefreshCw,
    Loader2,
    Trash2,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatusBadge } from '@/components/ui';
import { formatCurrency, formatDate, calculateDaysRemaining, cn } from '@/lib/utils';
import { NewBookingModal } from '@/components/modals';
import toast from 'react-hot-toast';

interface BookingListProps {
    type: 'FCL' | 'AIR';
}

interface BookingData {
    id: string;
    booking_number: string;
    type: string;
    status: string;
    vessel_flight?: string;
    voyage_number?: string;
    route?: string;
    origin_port?: string;
    destination_port?: string;
    container_type?: string;
    container_count?: number;
    etd?: string;
    eta?: string;
    freight_rate_usd?: number;
    cut_off_si?: string;
    cut_off_vgm?: string;
    cut_off_cargo?: string;
    cut_off_cy?: string;
    created_at: string;
}

export function BookingList({ type }: BookingListProps) {
    const navigate = useNavigate();
    const [showNewBookingModal, setShowNewBookingModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [bookings, setBookings] = useState<BookingData[]>([]);
    const [loading, setLoading] = useState(true);

    const statusOptions = [
        { value: 'ALL', label: 'All Statuses' },
        { value: 'AVAILABLE', label: 'Available' },
        { value: 'ALLOCATED', label: 'Allocated' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'USED', label: 'Used' },
        { value: 'CANCELLED', label: 'Cancelled' },
        { value: 'EXPIRED', label: 'Expired' },
    ];

    // Fetch bookings from API
    const fetchBookings = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3001/api/bookings?type=${type}`);
            const data = await res.json();
            if (data.bookings) {
                setBookings(data.bookings);
            }
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, [type]);

    const filteredBookings = bookings.filter(b => {
        const matchesSearch =
            b.booking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.route?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.vessel_flight?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.origin_port?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.destination_port?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const availableCount = filteredBookings.filter(b => b.status === 'AVAILABLE' || b.status === 'PENDING').length;
    const allocatedCount = filteredBookings.filter(b => b.status === 'ALLOCATED' || b.status === 'CONFIRMED').length;
    const usedCount = filteredBookings.filter(b => b.status === 'USED').length;

    const handleBookingCreated = () => {
        toast.success('Booking created successfully!');
        fetchBookings();
        setShowNewBookingModal(false);
    };

    const handleViewDetails = (bookingId: string) => {
        navigate(`/bookings/${bookingId}`);
    };

    const handleConfirmBooking = async (bookingId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/bookings/${bookingId}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
            });

            if (response.ok) {
                toast.success('Booking confirmed! Workflow tasks created.');
                fetchBookings();
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to confirm booking');
            }
        } catch (error) {
            toast.error('Failed to confirm booking');
        }
    };

    const handleDeleteBooking = async (booking: BookingData) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete booking ${booking.booking_number}?\n\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/bookings/${booking.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
            });

            if (response.ok) {
                toast.success(`Booking ${booking.booking_number} deleted successfully`);
                fetchBookings();
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to delete booking');
            }
        } catch (error) {
            toast.error('Failed to delete booking');
        }
    };

    return (
        <>
            <NewBookingModal
                isOpen={showNewBookingModal}
                onClose={() => setShowNewBookingModal(false)}
                onSuccess={handleBookingCreated}
                bookingType={type}
            />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] flex items-center gap-3">
                            {type === 'FCL' ? <Anchor className="w-8 h-8" /> : <Plane className="w-8 h-8" />}
                            {type === 'FCL' ? 'FCL Bookings' : 'Air Freight Bookings'}
                        </h1>
                        <p className="text-[hsl(var(--muted-foreground))] mt-1">
                            {type === 'FCL' ? 'Manage your container booking pool' : 'Weekly air freight capacity management'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchBookings} disabled={loading}>
                            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button onClick={() => setShowNewBookingModal(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            New Booking
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-blue-500/10 border-blue-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-blue-400">Available/Pending</p>
                                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{availableCount}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-blue-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-yellow-500/10 border-yellow-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-yellow-400">Allocated/Confirmed</p>
                                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{allocatedCount}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-yellow-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-500/10 border-green-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-green-400">Used</p>
                                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{usedCount}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                    {type === 'FCL' ? <Anchor className="w-5 h-5 text-green-400" /> : <Plane className="w-5 h-5 text-green-400" />}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-purple-500/10 border-purple-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-purple-400">Total Bookings</p>
                                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                        {filteredBookings.length}
                                    </p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-purple-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <Input
                                    placeholder="Search bookings..."
                                    icon={<Search className="w-4 h-4" />}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="w-full md:w-48">
                                <Select
                                    options={statusOptions}
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                />
                            </div>
                            <Button variant="outline">
                                <Filter className="w-4 h-4 mr-2" />
                                More Filters
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Loading State */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
                    </div>
                ) : (
                    <>
                        {/* Bookings Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredBookings.map((booking) => {
                                const cutOffDate = booking.cut_off_cargo || booking.cut_off_cy;
                                const daysToCargoCustom = cutOffDate ? calculateDaysRemaining(cutOffDate) : 999;
                                const isUrgent = daysToCargoCustom <= 3 && daysToCargoCustom > 0;
                                const isCritical = daysToCargoCustom <= 1 && daysToCargoCustom > 0;

                                const route = booking.route ||
                                    (booking.origin_port && booking.destination_port
                                        ? `${booking.origin_port} → ${booking.destination_port}`
                                        : 'N/A');

                                return (
                                    <Card
                                        key={booking.id}
                                        hover
                                        className={cn(
                                            isCritical && 'border-red-500/50',
                                            isUrgent && !isCritical && 'border-yellow-500/50'
                                        )}
                                    >
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="font-semibold text-[hsl(var(--foreground))]">{booking.booking_number}</span>
                                                <StatusBadge status={booking.status} />
                                            </div>

                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-[hsl(var(--muted-foreground))]">Route</span>
                                                    <span className="text-[hsl(var(--foreground))] font-medium">{route}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[hsl(var(--muted-foreground))]">Vessel/Flight</span>
                                                    <span className="text-[hsl(var(--foreground))]">{booking.vessel_flight || 'TBD'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[hsl(var(--muted-foreground))]">Container</span>
                                                    <span className="text-[hsl(var(--foreground))]">{booking.container_type || 'N/A'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[hsl(var(--muted-foreground))]">ETD</span>
                                                    <span className="text-[hsl(var(--foreground))]">{booking.etd ? formatDate(booking.etd) : 'TBD'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[hsl(var(--muted-foreground))]">Freight Rate</span>
                                                    <span className="text-[hsl(var(--foreground))] font-medium">
                                                        {booking.freight_rate_usd ? formatCurrency(booking.freight_rate_usd) : 'TBD'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Cut-off Times */}
                                            {(booking.cut_off_si || booking.cut_off_vgm || cutOffDate) && (
                                                <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                                                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">Cut-off Times</p>
                                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                                        <div className="text-center p-2 rounded bg-[hsl(var(--secondary))]">
                                                            <p className="text-[hsl(var(--muted-foreground))]">SI</p>
                                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                                {booking.cut_off_si ? formatDate(booking.cut_off_si).split(',')[0] : '—'}
                                                            </p>
                                                        </div>
                                                        <div className="text-center p-2 rounded bg-[hsl(var(--secondary))]">
                                                            <p className="text-[hsl(var(--muted-foreground))]">VGM</p>
                                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                                {booking.cut_off_vgm ? formatDate(booking.cut_off_vgm).split(',')[0] : '—'}
                                                            </p>
                                                        </div>
                                                        <div className={cn(
                                                            'text-center p-2 rounded',
                                                            isCritical && 'bg-red-500/20',
                                                            isUrgent && !isCritical && 'bg-yellow-500/20',
                                                            !isUrgent && 'bg-[hsl(var(--secondary))]'
                                                        )}>
                                                            <p className="text-[hsl(var(--muted-foreground))]">Cargo</p>
                                                            <p className={cn(
                                                                'font-medium',
                                                                isCritical && 'text-red-400',
                                                                isUrgent && !isCritical && 'text-yellow-400',
                                                                !isUrgent && 'text-[hsl(var(--foreground))]'
                                                            )}>
                                                                {cutOffDate ? formatDate(cutOffDate).split(',')[0] : '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Countdown for urgent bookings */}
                                            {(isUrgent || isCritical) && booking.status !== 'USED' && booking.status !== 'CANCELLED' && (
                                                <div className={cn(
                                                    'mt-3 p-2 rounded text-center text-sm font-medium',
                                                    isCritical ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                                )}>
                                                    <Clock className="w-4 h-4 inline mr-1" />
                                                    {daysToCargoCustom === 1 ? 'Cargo cut-off tomorrow!' : `${daysToCargoCustom} days to cargo cut-off`}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="mt-4 flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1"
                                                    onClick={() => handleViewDetails(booking.id)}
                                                >
                                                    <Eye className="w-3 h-3 mr-1" />
                                                    View
                                                </Button>
                                                {(booking.status === 'AVAILABLE' || booking.status === 'PENDING') && (
                                                    <Button
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={() => handleConfirmBooking(booking.id)}
                                                    >
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Confirm
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                                                    onClick={() => handleDeleteBooking(booking)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        {filteredBookings.length === 0 && (
                            <div className="text-center py-12">
                                {type === 'FCL' ? <Anchor className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" /> : <Plane className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />}
                                <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No bookings found</h3>
                                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                    Create a new booking to get started
                                </p>
                                <Button className="mt-4" onClick={() => setShowNewBookingModal(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Booking
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
