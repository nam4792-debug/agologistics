import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, Button, Input, Select, StatusBadge } from '@/components/ui';
import { formatCurrency, formatDate, calculateDaysRemaining, cn } from '@/lib/utils';
import { NewBookingModal, EditBookingModal } from '@/components/modals';
import toast from 'react-hot-toast';
import { fetchApi } from '@/lib/api';

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
    shipping_line?: string;
    shipment_id?: string;
    shipment_number?: string;
    forwarder_name?: string;
    created_at: string;
}

export function BookingList({ type }: BookingListProps) {
    const navigate = useNavigate();
    const [showNewBookingModal, setShowNewBookingModal] = useState(false);
    const [editBookingId, setEditBookingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [bookings, setBookings] = useState<BookingData[]>([]);
    const [loading, setLoading] = useState(true);

    const isAir = type === 'AIR';

    const statusOptions = [
        { value: 'ALL', label: 'All Statuses' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'ALLOCATED', label: 'Allocated' },
        { value: 'COMPLETED', label: 'Completed' },
        { value: 'CANCELLED', label: 'Cancelled' },
    ];

    // Fetch bookings from API
    const fetchBookings = async () => {
        setLoading(true);
        try {
            const data = await fetchApi(`/api/bookings?type=${type}`);
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
            b.destination_port?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.forwarder_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.shipping_line?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const pendingCount = filteredBookings.filter(b => b.status === 'PENDING').length;
    const confirmedCount = filteredBookings.filter(b => b.status === 'CONFIRMED' || b.status === 'ALLOCATED').length;
    const completedCount = filteredBookings.filter(b => b.status === 'COMPLETED' || b.status === 'USED').length;
    const totalFreight = filteredBookings.reduce((sum, b) => sum + (parseFloat(String(b.freight_rate_usd)) || 0), 0);

    const handleBookingCreated = () => {
        toast.success('Booking created successfully!');
        fetchBookings();
        setShowNewBookingModal(false);
    };

    const handleViewDetails = (bookingId: string) => {
        navigate(`/bookings/${bookingId}`);
    };

    // Modal states for Electron compatibility (window.prompt/confirm don't work)
    const [cancelTarget, setCancelTarget] = useState<BookingData | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<BookingData | null>(null);

    const handleConfirmBooking = async (bookingId: string) => {
        try {
            await fetchApi(`/api/bookings/${bookingId}/confirm`, {
                method: 'POST',
            });
            toast.success('Booking confirmed! Workflow tasks created.');
            setConfirmTarget(null);
            fetchBookings();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to confirm booking');
        }
    };

    const handleCancelBooking = async () => {
        if (!cancelTarget || !cancelReason.trim()) {
            toast.error('Cancellation reason is required');
            return;
        }

        try {
            await fetchApi(`/api/bookings/${cancelTarget.id}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ reason: cancelReason }),
            });
            toast.success(`Booking ${cancelTarget.booking_number} cancelled`);
            setCancelTarget(null);
            setCancelReason('');
            fetchBookings();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to cancel booking');
        }
    };

    const handleDeleteBooking = async () => {
        if (!deleteTarget) return;

        try {
            await fetchApi(`/api/bookings/${deleteTarget.id}`, {
                method: 'DELETE',
            });
            toast.success(`Booking ${deleteTarget.booking_number} deleted successfully`);
            setDeleteTarget(null);
            fetchBookings();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to delete booking');
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
                        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] tracking-tight">
                            {isAir ? 'Air Freight Bookings' : 'FCL Bookings'}
                        </h1>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                            {isAir ? 'Manage air cargo capacity and shipments' : 'Manage container booking pool and allocations'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={fetchBookings} disabled={loading}>
                            {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                            Refresh
                        </Button>
                        <Button size="sm" onClick={() => setShowNewBookingModal(true)}>
                            New Booking
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-blue-500/10 border-blue-500/20">
                        <CardContent className="p-4">
                            <p className="text-sm text-blue-400">Pending</p>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{pendingCount}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-yellow-500/10 border-yellow-500/20">
                        <CardContent className="p-4">
                            <p className="text-sm text-yellow-400">Confirmed / Allocated</p>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{confirmedCount}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-500/10 border-green-500/20">
                        <CardContent className="p-4">
                            <p className="text-sm text-green-400">Completed</p>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{completedCount}</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-purple-500/10 border-purple-500/20">
                        <CardContent className="p-4">
                            <p className="text-sm text-purple-400">Total Freight Value</p>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                {totalFreight > 0 ? formatCurrency(totalFreight) : '$0'}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <Input
                                    placeholder="Search by booking #, route, vessel, forwarder..."
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

                                // Calculate transit days
                                const transitDays = booking.etd && booking.eta
                                    ? Math.ceil((new Date(booking.eta).getTime() - new Date(booking.etd).getTime()) / (1000 * 60 * 60 * 24))
                                    : null;

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

                                            <div className="space-y-2.5 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-[hsl(var(--muted-foreground))]">Route</span>
                                                    <span className="text-[hsl(var(--foreground))] font-medium text-right max-w-[60%] truncate">{route}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[hsl(var(--muted-foreground))]">
                                                        {isAir ? 'Flight' : 'Vessel'}
                                                    </span>
                                                    <span className="text-[hsl(var(--foreground))]">{booking.vessel_flight || 'TBD'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[hsl(var(--muted-foreground))]">
                                                        {isAir ? 'Airline' : 'Shipping Line'}
                                                    </span>
                                                    <span className="text-[hsl(var(--foreground))]">{booking.shipping_line || 'TBD'}</span>
                                                </div>
                                                {!isAir && (
                                                    <div className="flex justify-between">
                                                        <span className="text-[hsl(var(--muted-foreground))]">Container</span>
                                                        <span className="text-[hsl(var(--foreground))] font-medium">
                                                            {booking.container_count && booking.container_type
                                                                ? `${booking.container_count}×${booking.container_type}`
                                                                : booking.container_type || 'N/A'}
                                                        </span>
                                                    </div>
                                                )}
                                                {isAir && booking.container_count && (
                                                    <div className="flex justify-between">
                                                        <span className="text-[hsl(var(--muted-foreground))]">Pieces</span>
                                                        <span className="text-[hsl(var(--foreground))]">{booking.container_count} pcs</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-[hsl(var(--muted-foreground))]">ETD / ETA</span>
                                                    <span className="text-[hsl(var(--foreground))]">
                                                        {booking.etd ? formatDate(booking.etd) : 'TBD'}
                                                        {booking.eta && ` → ${formatDate(booking.eta)}`}
                                                        {transitDays !== null && transitDays > 0 && (
                                                            <span className="text-[hsl(var(--muted-foreground))] ml-1">({transitDays}d)</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[hsl(var(--muted-foreground))]">Freight Rate</span>
                                                    <span className="text-[hsl(var(--foreground))] font-medium">
                                                        {booking.freight_rate_usd ? formatCurrency(booking.freight_rate_usd) : 'TBD'}
                                                    </span>
                                                </div>
                                                {booking.forwarder_name && (
                                                    <div className="flex justify-between">
                                                        <span className="text-[hsl(var(--muted-foreground))]">Forwarder</span>
                                                        <span className="text-[hsl(var(--foreground))] font-medium">{booking.forwarder_name}</span>
                                                    </div>
                                                )}
                                                {booking.shipment_id && (
                                                    <div className="flex justify-between">
                                                        <span className="text-[hsl(var(--muted-foreground))]">Shipment</span>
                                                        <span className="text-green-400 font-medium">
                                                            {booking.shipment_number || '✓ Linked'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Cut-off Times */}
                                            {!isAir && (booking.cut_off_si || booking.cut_off_vgm || cutOffDate) && (
                                                <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                                                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-2">Cut-off Times</p>
                                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                                        <div className="text-center p-2 rounded bg-[hsl(var(--secondary))]">
                                                            <p className="text-[hsl(var(--muted-foreground))]">SI</p>
                                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                                {booking.cut_off_si ? formatDate(booking.cut_off_si).split(',')[0] : 'TBD'}
                                                            </p>
                                                        </div>
                                                        <div className="text-center p-2 rounded bg-[hsl(var(--secondary))]">
                                                            <p className="text-[hsl(var(--muted-foreground))]">VGM</p>
                                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                                {booking.cut_off_vgm ? formatDate(booking.cut_off_vgm).split(',')[0] : 'TBD'}
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
                                                                {cutOffDate ? formatDate(cutOffDate).split(',')[0] : 'TBD'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Air cut-offs */}
                                            {isAir && (booking.cut_off_cy || booking.cut_off_si) && (
                                                <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                                                    <p className="text-xs font-medium text-purple-400 mb-2">✈️ Air Cut-offs</p>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className={cn(
                                                            'text-center p-2 rounded',
                                                            isCritical ? 'bg-red-500/20' : isUrgent ? 'bg-yellow-500/20' : 'bg-purple-500/10'
                                                        )}>
                                                            <p className="text-[hsl(var(--muted-foreground))]">Cargo Accept</p>
                                                            <p className={cn(
                                                                'font-medium',
                                                                isCritical ? 'text-red-400' : isUrgent ? 'text-yellow-400' : 'text-[hsl(var(--foreground))]'
                                                            )}>
                                                                {booking.cut_off_cy ? formatDate(booking.cut_off_cy).split(',')[0] : 'TBD'}
                                                            </p>
                                                        </div>
                                                        <div className="text-center p-2 rounded bg-purple-500/10">
                                                            <p className="text-[hsl(var(--muted-foreground))]">Doc Cut-off</p>
                                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                                {booking.cut_off_si ? formatDate(booking.cut_off_si).split(',')[0] : 'TBD'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Countdown for urgent bookings */}
                                            {(isUrgent || isCritical) && booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' && (
                                                <div className={cn(
                                                    'mt-3 p-2 rounded text-center text-sm font-medium',
                                                    isCritical ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                                )}>
                                                    {daysToCargoCustom === 1
                                                        ? (isAir ? 'Cargo acceptance closes tomorrow!' : 'Cargo cut-off tomorrow!')
                                                        : `${daysToCargoCustom} days to ${isAir ? 'cargo acceptance' : 'cargo cut-off'}`}
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
                                                    View
                                                </Button>
                                                {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex-1 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50"
                                                        onClick={() => setEditBookingId(booking.id)}
                                                    >
                                                        Edit
                                                    </Button>
                                                )}
                                                {booking.status === 'PENDING' && (
                                                    <Button
                                                        size="sm"
                                                        className="flex-1"
                                                        onClick={() => setConfirmTarget(booking.id)}
                                                    >
                                                        Confirm
                                                    </Button>
                                                )}
                                                {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50"
                                                        onClick={() => setCancelTarget(booking)}
                                                        title="Cancel booking (preserves record)"
                                                    >
                                                        Cancel
                                                    </Button>
                                                )}
                                                {booking.status === 'PENDING' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                                                        onClick={() => setDeleteTarget(booking)}
                                                        title="Permanently delete"
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        {filteredBookings.length === 0 && (
                            <div className="text-center py-12">
                                <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No bookings found</h3>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                    Create a new booking to get started
                                </p>
                                <Button className="mt-4" size="sm" onClick={() => setShowNewBookingModal(true)}>
                                    New Booking
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {editBookingId && (
                <EditBookingModal
                    isOpen={true}
                    bookingId={editBookingId}
                    bookingType={type}
                    onClose={() => setEditBookingId(null)}
                    onSuccess={() => {
                        setEditBookingId(null);
                        fetchBookings();
                    }}
                />
            )}

            {/* Cancel Booking Modal */}
            {cancelTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>
                    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-2">Cancel Booking {cancelTarget.booking_number}?</h3>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">This will cancel the booking and related tasks. The record will be preserved.</p>
                        <textarea
                            className="w-full p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                            rows={3}
                            placeholder="Reason for cancellation (required)..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-2 mt-4 justify-end">
                            <Button variant="outline" size="sm" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>Back</Button>
                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={!cancelReason.trim()} onClick={handleCancelBooking}>Confirm Cancel</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Booking Modal */}
            {confirmTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirmTarget(null)}>
                    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-2">Confirm Booking?</h3>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">This will trigger the workflow and create tasks for this booking.</p>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setConfirmTarget(null)}>Back</Button>
                            <Button size="sm" onClick={() => handleConfirmBooking(confirmTarget)}>Confirm</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Booking Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
                    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-red-400 mb-2">Delete Booking {deleteTarget.booking_number}?</h3>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">This action cannot be undone. The booking will be permanently removed.</p>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Back</Button>
                            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteBooking}>Delete</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
