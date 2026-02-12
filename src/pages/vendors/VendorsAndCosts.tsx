import { useState, useEffect } from 'react';
import {
    Building,
    DollarSign,
    TrendingUp,
    Users,
    Plus,
    Eye,
    Search,
    Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui';
import { cn, formatCurrency } from '@/lib/utils';
import { NewVendorModal, ProviderDetailModal } from '@/components/modals';
import { API_URL } from '@/lib/api';

interface VendorStats {
    totalDebt: number;
    totalPending: number;
    activeVendors: number;
}

interface Vendor {
    id: string;
    name: string;
    code: string;
    type: string;
    contact: string;
    email: string;
    phone: string;
    status: string;
    performanceScore: number;
    grade: string;
}

interface FreightCost {
    id: string;
    booking_number: string;
    forwarder_name: string;
    origin_port: string;
    destination_port: string;
    freight_rate_usd: number;
    status: string;
    created_at: string;
}

export function VendorsAndCosts() {
    const [stats, setStats] = useState<VendorStats>({ totalDebt: 0, totalPending: 0, activeVendors: 0 });
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [freightCosts, setFreightCosts] = useState<FreightCost[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewVendorModal, setShowNewVendorModal] = useState(false);
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch stats
            const statsRes = await fetch(`${API_URL}/api/providers/stats`);
            const statsData = await statsRes.json();
            if (statsData.success) {
                setStats(statsData.stats);
            }

            // Fetch vendors
            const vendorsRes = await fetch(`${API_URL}/api/providers`);
            const vendorsData = await vendorsRes.json();
            if (vendorsData.success) {
                setVendors(vendorsData.providers || []);
            }

            // Fetch freight costs from bookings
            const bookingsRes = await fetch(`${API_URL}/api/bookings`);
            const bookingsData = await bookingsRes.json();
            if (bookingsData.bookings) {
                setFreightCosts(bookingsData.bookings.filter((b: FreightCost) => b.freight_rate_usd > 0));
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredVendors = vendors.filter(v =>
        v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.code?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const gradeColors: Record<string, string> = {
        'A': 'bg-green-500/20 text-green-400 border-green-500/30',
        'B': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'C': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'D': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'F': 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    const statusColors: Record<string, string> = {
        'CONFIRMED': 'bg-green-500/20 text-green-400',
        'PENDING': 'bg-yellow-500/20 text-yellow-400',
        'CANCELLED': 'bg-red-500/20 text-red-400',
    };

    return (
        <>
            <NewVendorModal
                isOpen={showNewVendorModal}
                onClose={() => setShowNewVendorModal(false)}
                onSuccess={fetchData}
            />
            <ProviderDetailModal
                isOpen={showDetailModal}
                onClose={() => {
                    setShowDetailModal(false);
                    setSelectedVendorId(null);
                }}
                providerId={selectedVendorId}
            />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] flex items-center gap-3">
                            <Building className="w-8 h-8" />
                            Vendors & Costs
                        </h1>
                        <p className="text-[hsl(var(--muted-foreground))] mt-1">
                            Manage vendors and track freight costs
                        </p>
                    </div>
                    <Button onClick={() => setShowNewVendorModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Vendor
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Outstanding</p>
                                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                        {formatCurrency(stats.totalDebt)}
                                    </p>
                                    <p className="text-xs text-blue-400 mt-1">From confirmed bookings</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-blue-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Pending Amount</p>
                                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                        {formatCurrency(stats.totalPending)}
                                    </p>
                                    <p className="text-xs text-yellow-400 mt-1">Awaiting confirmation</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-yellow-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Active Vendors</p>
                                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                        {stats.activeVendors}
                                    </p>
                                    <p className="text-xs text-green-400 mt-1">Registered forwarders</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-green-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Freight Cost</p>
                                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                        {formatCurrency(stats.totalDebt + stats.totalPending)}
                                    </p>
                                    <p className="text-xs text-purple-400 mt-1">All bookings</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                    <TrendingUp className="w-6 h-6 text-purple-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Vendor List */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Vendors
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                <Input
                                    placeholder="Search vendors..."
                                    className="pl-10 w-64"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">Loading...</div>
                        ) : filteredVendors.length === 0 ? (
                            <div className="text-center py-8">
                                <Building className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                                <p className="text-[hsl(var(--muted-foreground))]">No vendors found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredVendors.map((vendor) => (
                                    <div
                                        key={vendor.id}
                                        className="p-4 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-all cursor-pointer"
                                        onClick={() => {
                                            setSelectedVendorId(vendor.id);
                                            setShowDetailModal(true);
                                        }}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                                    {vendor.name?.charAt(0) || 'V'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-[hsl(var(--foreground))]">{vendor.name}</p>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{vendor.type}</p>
                                                </div>
                                            </div>
                                            <Badge className={cn('text-xs', gradeColors[vendor.grade] || gradeColors['C'])}>
                                                Grade {vendor.grade || 'C'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-[hsl(var(--muted-foreground))]">{vendor.contact || 'No contact'}</span>
                                            <Button size="sm" variant="ghost">
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Freight Costs Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            Freight Costs by Booking
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {freightCosts.length === 0 ? (
                            <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                                No freight costs recorded
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-[hsl(var(--border))]">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-[hsl(var(--muted-foreground))]">Booking #</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-[hsl(var(--muted-foreground))]">Vendor</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-[hsl(var(--muted-foreground))]">Route</th>
                                            <th className="text-right py-3 px-4 text-sm font-medium text-[hsl(var(--muted-foreground))]">Amount</th>
                                            <th className="text-center py-3 px-4 text-sm font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {freightCosts.slice(0, 10).map((cost) => (
                                            <tr key={cost.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]">
                                                <td className="py-3 px-4 font-medium text-[hsl(var(--foreground))]">
                                                    {cost.booking_number}
                                                </td>
                                                <td className="py-3 px-4 text-[hsl(var(--muted-foreground))]">
                                                    {cost.forwarder_name || '-'}
                                                </td>
                                                <td className="py-3 px-4 text-[hsl(var(--muted-foreground))]">
                                                    {cost.origin_port} → {cost.destination_port}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-[hsl(var(--foreground))]">
                                                    {formatCurrency(cost.freight_rate_usd)}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <Badge className={cn('text-xs', statusColors[cost.status] || 'bg-gray-500/20 text-gray-400')}>
                                                        {cost.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
