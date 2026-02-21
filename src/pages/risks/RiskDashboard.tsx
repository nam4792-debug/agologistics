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
    Bell,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import { fetchApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
    bookingId: string;
    bookingNumber: string;
    level: string;
    score: number;
    category: string;
    daysRemaining: number | null;
    isOverdue: boolean;
}

interface NotificationItem {
    id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

const riskLevelColors: Record<string, { bg: string; text: string; border: string }> = {
    OVERDUE: { bg: 'bg-red-700/30', text: 'text-red-300', border: 'border-red-600/60' },
    CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
    HIGH: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
    MEDIUM: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
    LOW: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
};

export function RiskDashboard() {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState<BookingData[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bookingsRes, notificationsRes] = await Promise.all([
                fetchApi('/api/bookings'),
                fetchApi('/api/notifications'),
            ]);
            // Include all active bookings (exclude CANCELLED, USED, COMPLETED)
            const activeBookings = (bookingsRes.bookings || []).filter(
                (b: BookingData) => !['CANCELLED', 'USED', 'COMPLETED'].includes(b.status)
            );
            setBookings(activeBookings);
            setNotifications(notificationsRes.notifications || []);
        } catch (error) {
            console.error('Failed to fetch risk data:', error);
            setBookings([]);
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    // Calculate days until a date (positive = future, negative = past)
    const calculateDaysUntil = (dateStr: string) => {
        if (!dateStr) return null;
        const target = new Date(dateStr);
        const now = new Date();
        return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Determine risk level and score based on days remaining
    // Score is calculated dynamically: overdue = 100 (max urgency), then decreases as deadline is further away
    const classifyRisk = (days: number, deadlineName: string) => {
        const isOverdue = days < 0;

        if (isOverdue) {
            // Overdue: score = 100 (capped), level = OVERDUE
            return {
                title: `${deadlineName} — OVERDUE`,
                level: 'OVERDUE' as string,
                score: 100,
                isOverdue: true,
            };
        } else if (days === 0) {
            // Due today
            return {
                title: `${deadlineName} — TODAY`,
                level: 'CRITICAL' as string,
                score: 98,
                isOverdue: false,
            };
        } else if (days <= 1) {
            return {
                title: `${deadlineName} — Tomorrow`,
                level: 'CRITICAL' as string,
                score: 90,
                isOverdue: false,
            };
        } else if (days <= 3) {
            return {
                title: `${deadlineName} Approaching`,
                level: 'HIGH' as string,
                score: Math.max(60, 85 - (days * 5)),
                isOverdue: false,
            };
        } else {
            return {
                title: `${deadlineName} Upcoming`,
                level: 'MEDIUM' as string,
                score: Math.max(30, 60 - (days * 5)),
                isOverdue: false,
            };
        }
    };

    // Generate risk items from active bookings based on deadlines
    const riskItems: RiskItem[] = bookings.flatMap(booking => {
        const risks: RiskItem[] = [];

        // Deadline checks: [field, display name, category, upcoming threshold]
        const deadlineChecks: [string | undefined, string, string, number][] = [
            [booking.cut_off_cy, 'CY Cut-off', 'DEADLINE', 5],
            [booking.cut_off_si, 'SI Cut-off', 'DOCUMENTS', 4],
            [booking.cut_off_vgm, 'VGM Cut-off', 'COMPLIANCE', 4],
            [booking.etd, 'Ship Departure', 'OPERATIONAL', 7],
        ];

        for (const [dateValue, name, category, threshold] of deadlineChecks) {
            const days = calculateDaysUntil(dateValue || '');
            if (days === null) continue;

            // Show risk if: overdue (within 30 days) OR approaching (within threshold)
            const isOverdue = days < 0;
            if (isOverdue && Math.abs(days) > 30) continue; // Skip very old overdue items
            if (!isOverdue && days > threshold) continue;   // Skip far-future deadlines

            const classification = classifyRisk(days, name);

            risks.push({
                id: `${booking.id}-${name.replace(/\s/g, '').toLowerCase()}`,
                bookingId: booking.id,
                bookingNumber: booking.booking_number,
                category,
                daysRemaining: days,
                ...classification,
            });
        }

        return risks;
    }).sort((a, b) => b.score - a.score);

    // Count bookings with at least one risk (not risk items, which can be multiple per booking)
    const bookingsWithRisk = new Set(riskItems.map(r => r.bookingId));
    const bookingsNoRisk = Math.max(0, bookings.length - bookingsWithRisk.size);

    const overdueRisks = riskItems.filter(r => r.level === 'OVERDUE').length;
    const criticalRisks = riskItems.filter(r => r.level === 'CRITICAL').length;
    const highRisks = riskItems.filter(r => r.level === 'HIGH').length;
    const mediumRisks = riskItems.filter(r => r.level === 'MEDIUM').length;

    const handleMarkAllRead = async () => {
        try {
            await fetchApi('/api/notifications/read-all', { method: 'PUT' });
            toast.success('All notifications marked as read');
            fetchData();
        } catch {
            toast.error('Failed to mark notifications as read');
        }
    };

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
                        Real-time risk monitoring for active bookings
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Risk Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="border-red-700/60 bg-red-700/10">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-red-300">Overdue</p>
                                <p className="text-3xl font-bold text-red-300">{overdueRisks}</p>
                            </div>
                            <XCircle className="w-10 h-10 text-red-300" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-red-500/50 bg-red-500/5">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-red-400">Critical</p>
                                <p className="text-3xl font-bold text-red-400">{criticalRisks}</p>
                            </div>
                            <AlertTriangle className="w-10 h-10 text-red-400" />
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
                            <AlertCircle className="w-10 h-10 text-orange-400" />
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
                            <Clock className="w-10 h-10 text-yellow-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-green-500/50 bg-green-500/5">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-400">No Risk</p>
                                <p className="text-3xl font-bold text-green-400">{bookingsNoRisk}</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">of {bookings.length} bookings</p>
                            </div>
                            <CheckCircle className="w-10 h-10 text-green-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Active Risks */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Active Risks (from Active Bookings)</CardTitle>
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
                                        onClick={() => navigate(`/bookings/${risk.bookingId}`)}
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
                                                        {risk.daysRemaining < 0
                                                            ? `${Math.abs(risk.daysRemaining)} day${Math.abs(risk.daysRemaining) !== 1 ? 's' : ''} overdue`
                                                            : risk.daysRemaining === 0
                                                                ? 'Due today'
                                                                : `${risk.daysRemaining} day${risk.daysRemaining !== 1 ? 's' : ''} left`
                                                        }
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

            {/* Real Notifications from Database */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5" />
                        Recent Notifications
                    </CardTitle>
                    {notifications.filter(n => !n.is_read).length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                            Mark All Read
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {notifications.length > 0 ? (
                        <div className="space-y-3">
                            {notifications.slice(0, 10).map((notification) => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        'p-4 border-l-4 rounded-r-lg transition-all',
                                        notification.type === 'WARNING' ? 'border-l-yellow-400 bg-yellow-400/5' :
                                            notification.type === 'ERROR' ? 'border-l-red-400 bg-red-400/5' :
                                                notification.type === 'SUCCESS' ? 'border-l-green-400 bg-green-400/5' :
                                                    'border-l-blue-400 bg-blue-400/5',
                                        !notification.is_read && 'ring-1 ring-[hsl(var(--primary))]/20'
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-[hsl(var(--foreground))]">{notification.title}</p>
                                                {!notification.is_read && (
                                                    <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />
                                                )}
                                            </div>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{notification.message}</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                                                {formatDate(notification.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-[hsl(var(--muted-foreground))] py-8">No notifications yet</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
