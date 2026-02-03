import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Anchor,
    Plane,
    Calendar,
    Clock,
    Ship,
    AlertTriangle,
    CheckCircle,
    FileText,
    Truck,
    User,
    Phone,
    Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, StatusBadge } from '@/components/ui';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface BookingData {
    id: string;
    booking_number: string;
    type: 'FCL' | 'AIR';
    status: string;
    vessel_flight: string;
    voyage_number: string;
    route: string;
    origin_port: string;
    destination_port: string;
    container_type: string;
    container_count: number;
    etd: string;
    eta: string;
    freight_rate_usd: number;
    notes: string;
    cut_off_si: string;
    cut_off_vgm: string;
    cut_off_cy: string;
    sales_confirmed: boolean;
    sales_confirmed_at: string;
    forwarder_name: string;
    forwarder_contact: string;
    shipment_number: string;
    created_at: string;
}

interface TaskData {
    id: string;
    title: string;
    description: string;
    deadline: string;
    status: string;
    assigned_to: string;
}

interface DispatchData {
    id: string;
    driver_name: string;
    driver_phone: string;
    truck_plate: string;
    pickup_datetime: string;
    status: string;
}

export function BookingDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState<BookingData | null>(null);
    const [tasks, setTasks] = useState<TaskData[]>([]);
    const [dispatches, setDispatches] = useState<DispatchData[]>([]);
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (id) {
            loadBookingDetails();
        }
    }, [id]);

    const loadBookingDetails = async () => {
        try {
            const response = await fetch(`http://localhost:3001/api/bookings/${id}`);
            const data = await response.json();

            if (data.booking) {
                setBooking(data.booking);
                setTasks(data.tasks || []);
                setDispatches(data.dispatches || []);
            }
        } catch (error) {
            console.error('Failed to load booking:', error);
            toast.error('Failed to load booking details');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!id) return;
        setConfirming(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/bookings/${id}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
            });

            if (response.ok) {
                toast.success('Booking confirmed! Workflow tasks created.');
                loadBookingDetails();
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to confirm booking');
            }
        } catch (error) {
            toast.error('Failed to confirm booking');
        } finally {
            setConfirming(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">Booking not found</h3>
                <Button className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
            </div>
        );
    }

    const isFCL = booking.type === 'FCL';
    const isPending = booking.status === 'PENDING';
    const isConfirmed = booking.status === 'CONFIRMED' || booking.sales_confirmed;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center",
                        isFCL ? "gradient-primary" : "bg-gradient-to-br from-purple-500 to-pink-500"
                    )}>
                        {isFCL ? <Anchor className="w-7 h-7 text-white" /> : <Plane className="w-7 h-7 text-white" />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
                            {booking.booking_number}
                        </h1>
                        <p className="text-[hsl(var(--muted-foreground))]">
                            {isFCL ? 'FCL Sea Freight' : 'Air Freight'} Booking
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={booking.status} />
                    {isPending && (
                        <Button onClick={handleConfirm} disabled={confirming}>
                            {confirming ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <CheckCircle className="w-4 h-4 mr-2" />
                            )}
                            Confirm Booking
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Route & Schedule */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Ship className="w-5 h-5" />
                            Route & Schedule
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Route</p>
                                <p className="font-semibold text-[hsl(var(--foreground))]">{booking.route}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    {isFCL ? 'Vessel' : 'Flight'}
                                </p>
                                <p className="font-semibold text-[hsl(var(--foreground))]">{booking.vessel_flight}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Origin Port</p>
                                <p className="text-[hsl(var(--foreground))]">{booking.origin_port}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Destination Port</p>
                                <p className="text-[hsl(var(--foreground))]">{booking.destination_port}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">ETD</p>
                                <p className="text-[hsl(var(--foreground))] flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {formatDate(booking.etd)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">ETA</p>
                                <p className="text-[hsl(var(--foreground))] flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {formatDate(booking.eta)}
                                </p>
                            </div>
                        </div>

                        {/* Container Info */}
                        {isFCL && (
                            <div className="pt-4 border-t border-[hsl(var(--border))]">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Container Type</p>
                                        <p className="text-[hsl(var(--foreground))]">{booking.container_type}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Quantity</p>
                                        <p className="text-[hsl(var(--foreground))]">{booking.container_count} x Container</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Freight Rate */}
                        <div className="pt-4 border-t border-[hsl(var(--border))]">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Freight Rate</p>
                                <p className="text-xl font-bold text-[hsl(var(--primary))]">
                                    {formatCurrency(booking.freight_rate_usd)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Deadlines Card */}
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-400">
                            <Clock className="w-5 h-5" />
                            Cut-off Deadlines
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">SI Cut-off</p>
                                <p className="font-semibold text-[hsl(var(--foreground))]">
                                    {booking.cut_off_si ? formatDate(booking.cut_off_si) : 'Not set'}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">VGM Cut-off</p>
                                <p className="font-semibold text-[hsl(var(--foreground))]">
                                    {booking.cut_off_vgm ? formatDate(booking.cut_off_vgm) : 'Not set'}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-[hsl(var(--secondary))] border border-yellow-500/30">
                                <p className="text-xs text-yellow-400">CY Cut-off (Cargo)</p>
                                <p className="font-bold text-yellow-400">
                                    {booking.cut_off_cy ? formatDate(booking.cut_off_cy) : 'Not set'}
                                </p>
                            </div>
                        </div>

                        {isConfirmed && (
                            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                                <div className="flex items-center gap-2 text-green-400">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-sm font-medium">Sales Confirmed</span>
                                </div>
                                {booking.sales_confirmed_at && (
                                    <p className="text-xs text-green-400/70 mt-1">
                                        {formatDate(booking.sales_confirmed_at)}
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Workflow Tasks */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Workflow Tasks
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {tasks.length === 0 ? (
                        <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                            {isPending ? (
                                <p>Confirm this booking to create workflow tasks</p>
                            ) : (
                                <p>No tasks yet</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center",
                                            task.status === 'COMPLETED' ? 'bg-green-500/20' : 'bg-yellow-500/20'
                                        )}>
                                            {task.status === 'COMPLETED' ? (
                                                <CheckCircle className="w-4 h-4 text-green-400" />
                                            ) : (
                                                <Clock className="w-4 h-4 text-yellow-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-[hsl(var(--foreground))]">{task.title}</p>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                {task.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <StatusBadge status={task.status} />
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                            Due: {formatDate(task.deadline)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Truck Dispatch Section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="w-5 h-5" />
                        Truck Dispatch
                    </CardTitle>
                    {isConfirmed && (
                        <Button size="sm" onClick={() => toast.success('Dispatch modal coming soon!')}>
                            Schedule Dispatch
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {dispatches.length === 0 ? (
                        <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No dispatch scheduled yet</p>
                            {isConfirmed && (
                                <p className="text-sm mt-1">Click "Schedule Dispatch" to add truck information</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {dispatches.map((dispatch) => (
                                <div
                                    key={dispatch.id}
                                    className="p-4 rounded-lg bg-[hsl(var(--secondary))]"
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Driver</p>
                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                                                    {dispatch.driver_name}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Phone</p>
                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                                                    {dispatch.driver_phone}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Truck className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Truck</p>
                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                                                    {dispatch.truck_plate}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                            <div>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Pickup</p>
                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                                                    {formatDate(dispatch.pickup_datetime)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Notes */}
            {booking.notes && (
                <Card>
                    <CardHeader>
                        <CardTitle>Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-[hsl(var(--foreground))]">{booking.notes}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
