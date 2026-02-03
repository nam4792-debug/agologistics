import { useState, useEffect } from 'react';
import {
    Users,
    Building,
    Truck,
    Ship,
    FileCheck,
    Search,
    Filter,
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertTriangle,
    Calendar,
    CreditCard,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Select, Badge } from '@/components/ui';
import { cn, formatCurrency } from '@/lib/utils';
import { ProviderDetailModal, NewVendorModal } from '@/components/modals';
import type { ServiceProvider } from '@/types';

// Extended provider with credit info
interface ProviderWithCredit extends ServiceProvider {
    creditLimit: number;
    currentDebt: number;
    paymentDueDate: string;
    lastPaymentDate: string;
}

export function ProviderList() {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [showCreditInfo, setShowCreditInfo] = useState(true);
    const [providers, setProviders] = useState<ProviderWithCredit[]>([]);
    const [_loading, setLoading] = useState(true);
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showNewVendorModal, setShowNewVendorModal] = useState(false);
    const [realDebtStats, setRealDebtStats] = useState<{ totalDebt: number; totalPending: number }>({ totalDebt: 0, totalPending: 0 });

    // Fetch providers from API
    const fetchProviders = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/providers');
            const data = await res.json();
            if (data.success && data.providers) {
                setProviders(data.providers);
            }
        } catch (error) {
            console.error('Error fetching providers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProviders();
        fetchRealDebtStats();
    }, []);

    const fetchRealDebtStats = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/providers/stats');
            const data = await res.json();
            if (data.success) {
                setRealDebtStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching debt stats:', error);
        }
    };

    const allProviders = providers;

    const typeOptions = [
        { value: 'ALL', label: 'All Types' },
        { value: 'FORWARDER', label: 'Forwarders' },
        { value: 'TRANSPORT', label: 'Transport' },
        { value: 'SHIPPING_LINE', label: 'Shipping Lines' },
        { value: 'CUSTOMS_BROKER', label: 'Customs Brokers' },
    ];

    const filteredProviders = allProviders.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === 'ALL' || p.type === typeFilter;
        return matchesSearch && matchesType;
    });

    // Use real debt stats from API
    const totalDebt = realDebtStats.totalDebt;
    const totalCreditLimit = allProviders.reduce((sum, p) => sum + (p.creditLimit || 100000), 0);
    const overLimitProviders = allProviders.filter(p => (p.currentDebt || 0) > (p.creditLimit || 100000));
    const nearLimitProviders = allProviders.filter(p => p.currentDebt >= p.creditLimit * 0.9 && p.currentDebt <= p.creditLimit);

    const gradeColors: Record<string, string> = {
        A: 'bg-green-500/20 text-green-400 border-green-500/50',
        B: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
        C: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
        D: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
        F: 'bg-red-500/20 text-red-400 border-red-500/50',
    };

    const typeIcons: Record<string, typeof Users> = {
        FORWARDER: Building,
        TRANSPORT: Truck,
        SHIPPING_LINE: Ship,
        CUSTOMS_BROKER: FileCheck,
    };

    const getCreditStatus = (provider: ProviderWithCredit) => {
        const ratio = provider.currentDebt / provider.creditLimit;
        if (ratio > 1) return { label: 'OVER LIMIT', color: 'bg-red-500/20 text-red-400 border-red-500/50' };
        if (ratio >= 0.9) return { label: 'NEAR LIMIT', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' };
        if (ratio >= 0.5) return { label: 'MODERATE', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' };
        return { label: 'HEALTHY', color: 'bg-green-500/20 text-green-400 border-green-500/50' };
    };

    const getDaysUntilDue = (dueDate: string) => {
        const today = new Date();
        const due = new Date(dueDate);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const ProviderCard = ({ provider }: { provider: ProviderWithCredit }) => {
        const Icon = typeIcons[provider.type] || Building;
        const creditStatus = getCreditStatus(provider);
        const daysUntilDue = getDaysUntilDue(provider.paymentDueDate);
        const utilizationPercent = Math.min((provider.currentDebt / provider.creditLimit) * 100, 100);
        const isOverLimit = provider.currentDebt > provider.creditLimit;

        return (
            <Card hover className="h-full">
                <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-[hsl(var(--secondary))] flex items-center justify-center">
                                <Icon className="w-6 h-6 text-[hsl(var(--primary))]" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[hsl(var(--foreground))]">{provider.name}</h3>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">{provider.code}</p>
                            </div>
                        </div>
                        <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold border-2',
                            gradeColors[provider.grade]
                        )}>
                            {provider.grade}
                        </div>
                    </div>

                    {/* Credit Information */}
                    {showCreditInfo && (
                        <div className="mb-4 p-4 rounded-xl bg-[hsl(var(--secondary))] space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                                    <CreditCard className="w-4 h-4" />
                                    Credit Status
                                </span>
                                <Badge className={creditStatus.color}>
                                    {isOverLimit && <AlertTriangle className="w-3 h-3 mr-1" />}
                                    {creditStatus.label}
                                </Badge>
                            </div>

                            {/* Debt vs Limit */}
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-[hsl(var(--muted-foreground))]">Current Debt</span>
                                    <span className={cn(
                                        "font-semibold",
                                        isOverLimit ? "text-red-400" : "text-[hsl(var(--foreground))]"
                                    )}>
                                        {formatCurrency(provider.currentDebt)} / {formatCurrency(provider.creditLimit)}
                                    </span>
                                </div>
                                <div className="h-2 bg-[hsl(var(--background))] rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all",
                                            isOverLimit ? "bg-red-500" :
                                                utilizationPercent >= 90 ? "bg-yellow-500" :
                                                    utilizationPercent >= 50 ? "bg-blue-500" : "bg-green-500"
                                        )}
                                        style={{ width: `${utilizationPercent}%` }}
                                    />
                                </div>
                            </div>

                            {/* Payment Due */}
                            <div className="flex justify-between text-sm">
                                <span className="text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Payment Due
                                </span>
                                <span className={cn(
                                    "font-medium",
                                    daysUntilDue <= 7 ? "text-red-400" :
                                        daysUntilDue <= 14 ? "text-yellow-400" : "text-[hsl(var(--foreground))]"
                                )}>
                                    {daysUntilDue <= 0 ? 'OVERDUE!' : `${daysUntilDue} days`}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Performance Score (condensed when credit shown) */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-[hsl(var(--muted-foreground))]">Performance Score</span>
                            <span className="text-lg font-bold text-[hsl(var(--foreground))]">{provider.performanceScore}/100</span>
                        </div>
                        <div className="h-2 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all',
                                    provider.performanceScore >= 90 && 'bg-green-500',
                                    provider.performanceScore >= 80 && provider.performanceScore < 90 && 'bg-blue-500',
                                    provider.performanceScore >= 70 && provider.performanceScore < 80 && 'bg-yellow-500',
                                    provider.performanceScore >= 60 && provider.performanceScore < 70 && 'bg-orange-500',
                                    provider.performanceScore < 60 && 'bg-red-500',
                                )}
                                style={{ width: `${provider.performanceScore}%` }}
                            />
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                            <p className="text-[hsl(var(--muted-foreground))] text-xs">On-Time</p>
                            <p className="font-semibold text-[hsl(var(--foreground))]">{provider.onTimeRate}%</p>
                        </div>
                        <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                            <p className="text-[hsl(var(--muted-foreground))] text-xs">Doc Acc</p>
                            <p className="font-semibold text-[hsl(var(--foreground))]">{provider.docAccuracyRate}%</p>
                        </div>
                    </div>

                    {/* Status and Actions */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[hsl(var(--border))]">
                        <Badge
                            variant={provider.status === 'ACTIVE' ? 'success' : provider.status === 'INACTIVE' ? 'secondary' : 'destructive'}
                        >
                            {provider.status}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => {
                            setSelectedProviderId(provider.id);
                            setShowDetailModal(true);
                        }}>View Details</Button>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <>
            <ProviderDetailModal
                isOpen={showDetailModal}
                onClose={() => {
                    setShowDetailModal(false);
                    setSelectedProviderId(null);
                }}
                providerId={selectedProviderId}
            />
            <NewVendorModal
                isOpen={showNewVendorModal}
                onClose={() => setShowNewVendorModal(false)}
                onSuccess={() => {
                    fetchProviders();
                    fetchRealDebtStats();
                }}
            />
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] flex items-center gap-3">
                            <Users className="w-8 h-8" />
                            Service Providers
                        </h1>
                        <p className="text-[hsl(var(--muted-foreground))] mt-1">
                            Evaluate and manage forwarders, transporters, and customs brokers
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={showCreditInfo ? "default" : "outline"}
                            onClick={() => setShowCreditInfo(!showCreditInfo)}
                        >
                            <DollarSign className="w-4 h-4 mr-2" />
                            {showCreditInfo ? 'Hide' : 'Show'} Credit
                        </Button>
                        <Button onClick={() => setShowNewVendorModal(true)}>
                            <Building className="w-4 h-4 mr-2" />
                            New Vendor
                        </Button>
                    </div>
                </div>

                {/* Credit Stats (shown when credit info enabled) */}
                {showCreditInfo && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Outstanding</p>
                                        <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{formatCurrency(totalDebt)}</p>
                                    </div>
                                    <DollarSign className="w-8 h-8 text-[hsl(var(--primary))]" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Credit Utilization</p>
                                        <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                            {Math.round((totalDebt / totalCreditLimit) * 100)}%
                                        </p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-500/10 border-red-500/20">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-red-400">Over Credit Limit</p>
                                        <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{overLimitProviders.length}</p>
                                    </div>
                                    <AlertTriangle className="w-8 h-8 text-red-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-yellow-500/10 border-yellow-500/20">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-yellow-400">Near Limit (90%+)</p>
                                        <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{nearLimitProviders.length}</p>
                                    </div>
                                    <TrendingDown className="w-8 h-8 text-yellow-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Original Performance Stats (shown when credit hidden) */}
                {!showCreditInfo && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Providers</p>
                                        <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{allProviders.length}</p>
                                    </div>
                                    <Users className="w-8 h-8 text-[hsl(var(--primary))]" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-green-500/10 border-green-500/20">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-green-400">Grade A</p>
                                        <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                            {allProviders.filter(p => p.grade === 'A').length}
                                        </p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-blue-500/10 border-blue-500/20">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-blue-400">Grade B</p>
                                        <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                            {allProviders.filter(p => p.grade === 'B').length}
                                        </p>
                                    </div>
                                    <TrendingUp className="w-8 h-8 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-yellow-500/10 border-yellow-500/20">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-yellow-400">Needs Improvement</p>
                                        <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                            {allProviders.filter(p => p.grade === 'C' || p.grade === 'D' || p.grade === 'F').length}
                                        </p>
                                    </div>
                                    <TrendingDown className="w-8 h-8 text-yellow-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <Input
                                    placeholder="Search providers..."
                                    icon={<Search className="w-4 h-4" />}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="w-full md:w-48">
                                <Select
                                    options={typeOptions}
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                />
                            </div>
                            <Button variant="outline">
                                <Filter className="w-4 h-4 mr-2" />
                                More Filters
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Providers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProviders.map((provider) => (
                        <ProviderCard key={provider.id} provider={provider} />
                    ))}
                </div>

                {filteredProviders.length === 0 && (
                    <div className="text-center py-12">
                        <Users className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                        <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No providers found</h3>
                        <p className="text-[hsl(var(--muted-foreground))] mt-1">
                            Try adjusting your search criteria
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
