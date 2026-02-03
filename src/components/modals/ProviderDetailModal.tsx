import { useState, useEffect } from 'react';
import {
    X,
    Building,
    Mail,
    Phone,
    Package,
    DollarSign,
    Clock,
    Loader2,
    AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface ProviderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    providerId: string | null;
}

interface ProviderDebt {
    totalDebt: number;
    pendingAmount: number;
    confirmedBookingsCount: number;
    pendingBookingsCount: number;
    totalBookingsCount: number;
}

interface Booking {
    id: string;
    booking_number: string;
    type: string;
    status: string;
    vessel_flight: string;
    route: string;
    origin_port: string;
    destination_port: string;
    freight_rate: number;
    etd: string;
    eta: string;
    created_at: string;
}

interface Provider {
    id: string;
    name: string;
    contact: string;
    email: string;
    phone: string;
    status: string;
}

export function ProviderDetailModal({ isOpen, onClose, providerId }: ProviderDetailModalProps) {
    const [loading, setLoading] = useState(true);
    const [provider, setProvider] = useState<Provider | null>(null);
    const [debt, setDebt] = useState<ProviderDebt | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);

    useEffect(() => {
        if (isOpen && providerId) {
            fetchProviderDebt();
        }
    }, [isOpen, providerId]);

    const fetchProviderDebt = async () => {
        if (!providerId) return;

        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3001/api/providers/${providerId}/debt`);
            const data = await res.json();

            if (data.success) {
                setProvider(data.provider);
                setDebt(data.debt);
                setBookings(data.bookings || []);
            }
        } catch (error) {
            console.error('Error fetching provider debt:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[hsl(var(--card))] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-[hsl(var(--border))]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                            <Building className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
                                {loading ? 'Loading...' : provider?.name || 'Provider Details'}
                            </h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Payment & Booking Details
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Provider Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Mail className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                    <span className="text-[hsl(var(--foreground))]">{provider?.email || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                    <span className="text-[hsl(var(--foreground))]">{provider?.phone || 'N/A'}</span>
                                </div>
                            </div>

                            {/* Debt Summary Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                <Card className="border-red-500/30 bg-red-500/5">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DollarSign className="w-4 h-4 text-red-400" />
                                            <span className="text-sm text-red-400">Total Debt</span>
                                        </div>
                                        <p className="text-2xl font-bold text-red-400">
                                            {formatCurrency(debt?.totalDebt || 0)}
                                        </p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                            From {debt?.confirmedBookingsCount || 0} confirmed bookings
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="border-yellow-500/30 bg-yellow-500/5">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-4 h-4 text-yellow-400" />
                                            <span className="text-sm text-yellow-400">Pending</span>
                                        </div>
                                        <p className="text-2xl font-bold text-yellow-400">
                                            {formatCurrency(debt?.pendingAmount || 0)}
                                        </p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                            From {debt?.pendingBookingsCount || 0} pending bookings
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="border-blue-500/30 bg-blue-500/5">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Package className="w-4 h-4 text-blue-400" />
                                            <span className="text-sm text-blue-400">Total Bookings</span>
                                        </div>
                                        <p className="text-2xl font-bold text-blue-400">
                                            {debt?.totalBookingsCount || 0}
                                        </p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                            All time
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* No bookings message */}
                            {bookings.length === 0 && (
                                <div className="text-center py-8 bg-[hsl(var(--secondary))] rounded-lg">
                                    <AlertTriangle className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
                                    <p className="text-[hsl(var(--foreground))] font-medium">No bookings found</p>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        This provider has no bookings linked to it yet.
                                    </p>
                                </div>
                            )}

                            {/* Bookings List */}
                            {bookings.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">
                                        Recent Bookings
                                    </h3>
                                    <div className="space-y-3">
                                        {bookings.map((booking) => (
                                            <div
                                                key={booking.id}
                                                className="flex items-center justify-between p-4 bg-[hsl(var(--secondary))] rounded-lg"
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-[hsl(var(--foreground))]">
                                                            {booking.booking_number}
                                                        </span>
                                                        <Badge variant={booking.type === 'FCL' ? 'default' : 'secondary'}>
                                                            {booking.type}
                                                        </Badge>
                                                        <Badge
                                                            variant={
                                                                booking.status === 'CONFIRMED' ? 'success' :
                                                                    booking.status === 'PENDING' ? 'warning' : 'secondary'
                                                            }
                                                        >
                                                            {booking.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                        {booking.origin_port || 'N/A'} → {booking.destination_port || 'N/A'}
                                                    </p>
                                                    {booking.etd && (
                                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                                            ETD: {formatDate(booking.etd)}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className={cn(
                                                        'text-lg font-bold',
                                                        booking.status === 'CONFIRMED' ? 'text-red-400' : 'text-yellow-400'
                                                    )}>
                                                        {formatCurrency(booking.freight_rate)}
                                                    </p>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        {booking.status === 'CONFIRMED' ? 'Payable' : 'Pending'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))/50]">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
