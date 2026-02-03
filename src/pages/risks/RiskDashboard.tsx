import { useState, useEffect } from 'react';
import {
    AlertTriangle,
    Shield,
    CheckCircle,
    Clock,
    AlertCircle,
    XCircle,
    ChevronRight,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';

interface BookingData {
    id: string;
    booking_number: string;
    status: string;
    origin_port?: string;
    destination_port?: string;
    etd?: string;
    cut_off_si?: string;
    cut_off_vgm?: string;
    cut_off_cy?: string;
}

interface RiskItem {
    id: string;
    title: string;
    bookingNumber: string;
    level: string;
    score: number;
    category: string;
    daysRemaining: number | null;
}

interface AlertItem {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

const riskLevelColors: Record<string, { bg: string; text: string; border: string }> = {
    CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
    HIGH: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
    MEDIUM: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
    LOW: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
};

export function RiskDashboard() {
    const [bookings, setBookings] = useState<BookingData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch confirmed bookings to analyze risks
            const res = await fetch('http://localhost:3001/api/bookings?status=CONFIRMED');
            const data = await res.json();
            setBookings(data.bookings || []);
        } catch (error) {
            console.error('Failed to fetch risk data:', error);
            setBookings([]);
        } finally {
            setLoading(false);
        }
    };

    // Calculate days until a date
    const calculateDaysUntil = (dateStr: string) => {
        if (!dateStr) return null;
        const target = new Date(dateStr);
        const now = new Date();
        return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Generate risk items from confirmed bookings based on deadlines
    const riskItems: RiskItem[] = bookings.flatMap(booking => {
        const risks: RiskItem[] = [];

        // Check CY Cut-off
        const daysToCY = calculateDaysUntil(booking.cut_off_cy || '');
        if (daysToCY !== null && daysToCY <= 3) {
            risks.push({
                id: `${booking.id}-cy`,
                title: 'CY Cut-off Approaching',
                bookingNumber: booking.booking_number,
                level: daysToCY <= 1 ? 'CRITICAL' : daysToCY <= 2 ? 'HIGH' : 'MEDIUM',
                score: daysToCY <= 1 ? 95 : daysToCY <= 2 ? 80 : 65,
                category: 'DEADLINE',
                daysRemaining: daysToCY,
            });
        }

        // Check SI Cut-off
        const daysToSI = calculateDaysUntil(booking.cut_off_si || '');
        if (daysToSI !== null && daysToSI <= 2) {
            risks.push({
                id: `${booking.id}-si`,
                title: 'SI Cut-off Approaching',
                bookingNumber: booking.booking_number,
                level: daysToSI <= 1 ? 'CRITICAL' : 'HIGH',
                score: daysToSI <= 1 ? 90 : 75,
                category: 'DOCUMENTS',
                daysRemaining: daysToSI,
            });
        }

        // Check VGM Cut-off
        const daysToVGM = calculateDaysUntil(booking.cut_off_vgm || '');
        if (daysToVGM !== null && daysToVGM <= 2) {
            risks.push({
                id: `${booking.id}-vgm`,
                title: 'VGM Cut-off Approaching',
                bookingNumber: booking.booking_number,
                level: daysToVGM <= 1 ? 'CRITICAL' : 'HIGH',
                score: daysToVGM <= 1 ? 88 : 72,
                category: 'COMPLIANCE',
                daysRemaining: daysToVGM,
            });
        }

        // Check ETD
        const daysToETD = calculateDaysUntil(booking.etd || '');
        if (daysToETD !== null && daysToETD <= 5 && daysToETD > 0) {
            risks.push({
                id: `${booking.id}-etd`,
                title: 'Ship Departure Approaching',
                bookingNumber: booking.booking_number,
                level: daysToETD <= 2 ? 'HIGH' : 'MEDIUM',
                score: daysToETD <= 2 ? 70 : 50,
                category: 'OPERATIONAL',
                daysRemaining: daysToETD,
            });
        }

        return risks;
    }).sort((a, b) => b.score - a.score);

    // Generate alerts from confirmed bookings
    const alerts: AlertItem[] = bookings.slice(0, 3).map(booking => ({
        id: booking.id,
        type: 'INFO',
        title: 'Booking Confirmed',
        message: `Booking ${booking.booking_number} is confirmed for ${booking.origin_port} → ${booking.destination_port}`,
        isRead: false,
        createdAt: new Date().toISOString(),
    }));

    const criticalRisks = riskItems.filter(r => r.level === 'CRITICAL').length;
    const highRisks = riskItems.filter(r => r.level === 'HIGH').length;
    const mediumRisks = riskItems.filter(r => r.level === 'MEDIUM').length;

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
                        <Shield className="w-8 h-8" />
                        Risks & Alerts
                    </h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Real-time risk monitoring for confirmed bookings
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Risk Report
                    </Button>
                </div>
            </div>

            {/* Risk Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-red-500/50 bg-red-500/5">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-red-400">Critical</p>
                                <p className="text-3xl font-bold text-red-400">{criticalRisks}</p>
                            </div>
                            <XCircle className="w-10 h-10 text-red-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-500/50 bg-orange-500/5">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-orange-400">High</p>
                                <p className="text-3xl font-bold text-orange-400">{highRisks}</p>
                            </div>
                            <AlertTriangle className="w-10 h-10 text-orange-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-yellow-500/50 bg-yellow-500/5">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-yellow-400">Medium</p>
                                <p className="text-3xl font-bold text-yellow-400">{mediumRisks}</p>
                            </div>
                            <AlertCircle className="w-10 h-10 text-yellow-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-green-500/50 bg-green-500/5">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-400">Low / No Risk</p>
                                <p className="text-3xl font-bold text-green-400">{bookings.length - riskItems.length}</p>
                            </div>
                            <CheckCircle className="w-10 h-10 text-green-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Active Risks */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Active Risks (from Confirmed Bookings)</CardTitle>
                    <Badge variant="secondary">{riskItems.length} Risks</Badge>
                </CardHeader>
                <CardContent>
                    {riskItems.length > 0 ? (
                        <div className="space-y-3">
                            {riskItems.map((risk) => {
                                const colors = riskLevelColors[risk.level];
                                return (
                                    <div
                                        key={risk.id}
                                        className={cn(
                                            'p-4 rounded-lg border cursor-pointer transition-all hover:bg-[hsl(var(--secondary))]',
                                            colors.border
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', colors.bg)}>
                                                    <span className={cn('text-xl font-bold', colors.text)}>{risk.score}</span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-[hsl(var(--foreground))]">{risk.title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="secondary" className="text-xs">{risk.category}</Badge>
                                                        <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                                            Booking: {risk.bookingNumber}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {risk.daysRemaining !== null && (
                                                    <div className={cn('flex items-center gap-1 text-sm font-medium', colors.text)}>
                                                        <Clock className="w-4 h-4" />
                                                        {risk.daysRemaining} day(s)
                                                    </div>
                                                )}
                                                <Badge className={cn(colors.bg, colors.text, 'border-0')}>
                                                    {risk.level}
                                                </Badge>
                                                <ChevronRight className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
                            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No Active Risks</h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                {bookings.length > 0
                                    ? 'All confirmed bookings are on track!'
                                    : 'Confirm bookings to monitor risks'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Recent Booking Confirmations</CardTitle>
                    <Button variant="ghost" size="sm">Mark All Read</Button>
                </CardHeader>
                <CardContent>
                    {alerts.length > 0 ? (
                        <div className="space-y-3">
                            {alerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className="p-4 border-l-4 border-l-blue-400 bg-blue-400/5 rounded-r-lg cursor-pointer transition-all hover:bg-[hsl(var(--secondary))]"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-[hsl(var(--foreground))]">{alert.title}</p>
                                                {!alert.isRead && (
                                                    <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />
                                                )}
                                            </div>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{alert.message}</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                                                {formatDate(alert.createdAt)}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="sm">View</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-[hsl(var(--muted-foreground))] py-8">No recent alerts</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
