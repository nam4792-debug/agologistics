import { useState, useEffect } from 'react';
import {
    DollarSign,
    FileText,
    Upload,
    Clock,
    CheckCircle,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

interface BookingData {
    id: string;
    booking_number: string;
    status: string;
    freight_rate?: number;
    origin_port?: string;
    destination_port?: string;
    etd?: string;
}

interface Invoice {
    id: string;
    number: string;
    bookingNumber: string;
    amount: number;
    quotedAmount: number;
    status: string;
    dueDate: string;
    discrepancy?: { difference: number; percentage: number } | null;
}

export function FinanceOverview() {
    const [bookings, setBookings] = useState<BookingData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch confirmed bookings
            const res = await fetch('http://localhost:3001/api/bookings?status=CONFIRMED');
            const data = await res.json();
            setBookings(data.bookings || []);
        } catch (error) {
            console.error('Failed to fetch finance data:', error);
            setBookings([]);
        } finally {
            setLoading(false);
        }
    };

    // Calculate totals from confirmed bookings
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.freight_rate || 0), 0);
    const confirmedBookingsCount = bookings.length;

    // Generate invoices from confirmed bookings
    const invoices: Invoice[] = bookings.slice(0, 5).map(booking => ({
        id: booking.id,
        number: `INV-${booking.booking_number}`,
        bookingNumber: booking.booking_number,
        amount: booking.freight_rate || 0,
        quotedAmount: booking.freight_rate || 0,
        status: 'PENDING',
        dueDate: booking.etd || new Date().toISOString(),
        discrepancy: null,
    }));

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
                        <DollarSign className="w-8 h-8" />
                        Finance & Invoices
                    </h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Manage costs, invoices, and payment tracking (Confirmed Bookings Only)
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Invoice
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Freight Cost</p>
                                <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{formatCurrency(totalRevenue)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-green-500/30">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-400">Confirmed Bookings</p>
                                <p className="text-2xl font-bold text-green-400">{confirmedBookingsCount}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-green-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-yellow-500/30">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-yellow-400">Pending Invoices</p>
                                <p className="text-2xl font-bold text-yellow-400">{invoices.filter(i => i.status === 'PENDING').length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-yellow-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-blue-500/30">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-400">Avg per Booking</p>
                                <p className="text-2xl font-bold text-blue-400">
                                    {confirmedBookingsCount > 0 ? formatCurrency(totalRevenue / confirmedBookingsCount) : '$0'}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-blue-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Invoices from Confirmed Bookings */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Invoices from Confirmed Bookings
                    </CardTitle>
                    <Button variant="outline" size="sm">View All</Button>
                </CardHeader>
                <CardContent>
                    {invoices.length > 0 ? (
                        <div className="space-y-4">
                            {invoices.map((invoice) => (
                                <div
                                    key={invoice.id}
                                    className={cn(
                                        'p-4 rounded-lg border transition-all hover:bg-[hsl(var(--secondary))]',
                                        invoice.status === 'PENDING' && 'border-yellow-500/30'
                                    )}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-yellow-500/20">
                                                <Clock className="w-6 h-6 text-yellow-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-[hsl(var(--foreground))]">{invoice.number}</p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                    Booking: {invoice.bookingNumber}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="font-semibold text-[hsl(var(--foreground))]">{formatCurrency(invoice.amount)}</p>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Due</p>
                                                <p className="text-sm text-[hsl(var(--foreground))]">{formatDate(invoice.dueDate)}</p>
                                            </div>

                                            <Badge variant="secondary">
                                                {invoice.status}
                                            </Badge>

                                            <Button size="sm">Process</Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No invoices yet</h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                Confirm bookings to generate invoices
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Booking Revenue Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Freight Costs by Booking</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {bookings.length > 0 ? (
                            <div className="space-y-3">
                                {bookings.slice(0, 5).map((booking) => (
                                    <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                        <div>
                                            <p className="font-medium text-[hsl(var(--foreground))]">{booking.booking_number}</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                {booking.origin_port} → {booking.destination_port}
                                            </p>
                                        </div>
                                        <p className="font-semibold text-green-400">{formatCurrency(booking.freight_rate || 0)}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-[hsl(var(--muted-foreground))] py-8">No confirmed bookings</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Payment Status Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[
                                { status: 'Pending', count: invoices.filter(i => i.status === 'PENDING').length, color: 'bg-yellow-500' },
                                { status: 'Validated', count: invoices.filter(i => i.status === 'VALIDATED').length, color: 'bg-green-500' },
                                { status: 'Paid', count: invoices.filter(i => i.status === 'PAID').length, color: 'bg-blue-500' },
                            ].map((item) => (
                                <div key={item.status} className="flex items-center gap-4">
                                    <div className={cn('w-3 h-3 rounded-full', item.color)} />
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-sm text-[hsl(var(--foreground))]">{item.status}</span>
                                            <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                                                {item.count} invoices
                                            </span>
                                        </div>
                                        <div className="h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                                            <div
                                                className={cn('h-full rounded-full', item.color)}
                                                style={{ width: `${invoices.length > 0 ? (item.count / invoices.length) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
