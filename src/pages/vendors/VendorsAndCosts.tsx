import { useState, useEffect } from 'react';
import {
    Building2,
    Plus,
    Pencil,
    Trash2,
    Eye,
    X,
    Check,
    Loader2,
    AlertTriangle,
    TrendingUp,
    DollarSign,
    Users,
    Shield,
    CreditCard,
    RefreshCw,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Badge, Select } from '@/components/ui';
import { cn, formatCurrency } from '@/lib/utils';
import { NewVendorModal, ProviderDetailModal } from '@/components/modals';
import { fetchApi } from '@/lib/api';
import toast from 'react-hot-toast';

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
    address: string;
    status: string;
    performanceScore: number;
    onTimeRate: number;
    docAccuracyRate: number;
    costCompetitiveness: number;
    grade: string;
    creditLimit: number;
    outstandingBalance: number;
    createdAt: string;
}

interface EditForm {
    name: string;
    contact: string;
    email: string;
    phone: string;
    address: string;
    creditLimit: string;
    status: string;
}

export function VendorsAndCosts() {
    const [stats, setStats] = useState<VendorStats>({ totalDebt: 0, totalPending: 0, activeVendors: 0 });
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNewVendorModal, setShowNewVendorModal] = useState(false);
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({ name: '', contact: '', email: '', phone: '', address: '', creditLimit: '0', status: 'ACTIVE' });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsData, vendorsData] = await Promise.all([
                fetchApi('/api/providers/stats'),
                fetchApi('/api/providers'),
            ]);

            if (statsData.success) setStats(statsData.stats);
            if (vendorsData.success) setVendors(vendorsData.providers || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // --- Filters ---
    const filteredVendors = vendors;

    // --- Computed stats ---
    const atRiskCount = vendors.filter(v => {
        const limit = parseFloat(String(v.creditLimit)) || 0;
        const balance = parseFloat(String(v.outstandingBalance)) || 0;
        return limit > 0 && (balance / limit) >= 0.8;
    }).length;

    const avgPerformance = vendors.length > 0
        ? vendors.reduce((sum, v) => sum + (parseFloat(String(v.performanceScore)) || 0), 0) / vendors.length
        : 0;

    // --- Credit utilization helpers ---
    type UtilLevel = 'safe' | 'warning' | 'danger' | 'none';
    const getUtilization = (v: Vendor) => {
        const limit = parseFloat(String(v.creditLimit)) || 0;
        const balance = parseFloat(String(v.outstandingBalance)) || 0;
        if (limit <= 0) return { percent: 0, level: 'none' as UtilLevel };
        const pct = Math.min((balance / limit) * 100, 100);
        const level: UtilLevel = pct >= 80 ? 'danger' : pct >= 60 ? 'warning' : 'safe';
        return { percent: pct, level };
    };

    const utilizationColors: Record<UtilLevel, { bar: string; text: string; bg: string }> = {
        safe: { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        warning: { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10' },
        danger: { bar: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10' },
        none: { bar: 'bg-gray-500', text: 'text-gray-500', bg: 'bg-gray-500/10' },
    };

    const gradeColors: Record<string, string> = {
        'A': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        'B': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        'C': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
        'D': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
        'F': 'bg-red-500/15 text-red-400 border-red-500/30',
    };

    // --- Edit handler ---
    const startEdit = (v: Vendor) => {
        setEditingId(v.id);
        setEditForm({
            name: v.name || '',
            contact: v.contact || '',
            email: v.email || '',
            phone: v.phone || '',
            address: v.address || '',
            creditLimit: String(parseFloat(String(v.creditLimit)) || 0),
            status: v.status || 'ACTIVE',
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        setSaving(true);
        try {
            const res = await fetchApi(`/api/providers/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name,
                    contact: editForm.contact,
                    email: editForm.email,
                    phone: editForm.phone,
                    address: editForm.address,
                    creditLimit: parseFloat(editForm.creditLimit) || 0,
                    status: editForm.status,
                }),
            });
            if (res.success) {
                toast.success('Vendor updated successfully');
                setEditingId(null);
                fetchData();
            } else {
                toast.error(res.error || 'Failed to update vendor');
            }
        } catch (err) {
            toast.error('Failed to update vendor');
        } finally {
            setSaving(false);
        }
    };

    // --- Delete handler ---
    const handleDelete = async (v: Vendor) => {
        if (!confirm(`Delete "${v.name}"? This cannot be undone.`)) return;
        setDeletingId(v.id);
        try {
            const res = await fetchApi(`/api/providers/${v.id}`, { method: 'DELETE' });
            if (res.success) {
                toast.success(`"${v.name}" deleted`);
                fetchData();
            } else {
                toast.error(res.message || res.error || 'Cannot delete vendor');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Cannot delete vendor';
            toast.error(msg);
        } finally {
            setDeletingId(null);
        }
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
                onClose={() => { setShowDetailModal(false); setSelectedVendorId(null); }}
                providerId={selectedVendorId}
            />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] tracking-tight">
                            Vendor Management
                        </h1>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                            Monitor credit limits, debt exposure, and vendor performance
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                            <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button size="sm" onClick={() => setShowNewVendorModal(true)}>
                            <Plus className="w-4 h-4 mr-1.5" />
                            New Vendor
                        </Button>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Outstanding Debt */}
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                    <DollarSign className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Outstanding</p>
                                    <p className="text-xl font-bold text-[hsl(var(--foreground))]">
                                        {formatCurrency(stats.totalDebt)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* At Risk */}
                    <Card className={cn(
                        "border",
                        atRiskCount > 0
                            ? "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20"
                            : "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20"
                    )}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center",
                                    atRiskCount > 0 ? "bg-red-500/20" : "bg-emerald-500/20"
                                )}>
                                    {atRiskCount > 0
                                        ? <AlertTriangle className="w-5 h-5 text-red-400" />
                                        : <Shield className="w-5 h-5 text-emerald-400" />
                                    }
                                </div>
                                <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">At Risk</p>
                                    <p className="text-xl font-bold text-[hsl(var(--foreground))]">
                                        {atRiskCount} <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">vendor{atRiskCount !== 1 && 's'}</span>
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Active Vendors */}
                    <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Active</p>
                                    <p className="text-xl font-bold text-[hsl(var(--foreground))]">
                                        {stats.activeVendors} <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">vendors</span>
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Avg Performance */}
                    <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Avg Score</p>
                                    <p className="text-xl font-bold text-[hsl(var(--foreground))]">
                                        {avgPerformance.toFixed(1)} <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">/ 100</span>
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>



                {/* Vendor Table */}
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
                                <span className="ml-3 text-[hsl(var(--muted-foreground))]">Loading vendors...</span>
                            </div>
                        ) : filteredVendors.length === 0 ? (
                            <div className="text-center py-16">
                                <Building2 className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
                                <p className="text-[hsl(var(--muted-foreground))] font-medium">No vendors found</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] opacity-60 mt-1">
                                    Click "New Vendor" to add one
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/50">
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Vendor</th>
                                            <th className="text-center py-3 px-3 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Grade</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider hidden lg:table-cell">Contact</th>
                                            <th className="text-right py-3 px-4 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Outstanding</th>
                                            <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider min-w-[200px]">Credit Utilization</th>
                                            <th className="text-center py-3 px-4 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Status</th>
                                            <th className="text-center py-3 px-4 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVendors.map((vendor) => {
                                            const util = getUtilization(vendor);
                                            const colors = utilizationColors[util.level];
                                            const isEditing = editingId === vendor.id;
                                            const isDeleting = deletingId === vendor.id;
                                            const balance = parseFloat(String(vendor.outstandingBalance)) || 0;
                                            const limit = parseFloat(String(vendor.creditLimit)) || 0;

                                            if (isEditing) {
                                                return (
                                                    <tr key={vendor.id} className="border-b border-[hsl(var(--border))] bg-[hsl(var(--primary))]/5">
                                                        <td colSpan={7} className="p-4">
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Pencil className="w-4 h-4 text-[hsl(var(--primary))]" />
                                                                    <span className="font-semibold text-[hsl(var(--foreground))]">Editing: {vendor.name}</span>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                    <div>
                                                                        <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Company Name *</label>
                                                                        <Input
                                                                            value={editForm.name}
                                                                            onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                                            className="w-full"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Contact Person</label>
                                                                        <Input
                                                                            value={editForm.contact}
                                                                            onChange={(e) => setEditForm(f => ({ ...f, contact: e.target.value }))}
                                                                            className="w-full"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Email</label>
                                                                        <Input
                                                                            type="email"
                                                                            value={editForm.email}
                                                                            onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                                                                            className="w-full"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Phone</label>
                                                                        <Input
                                                                            value={editForm.phone}
                                                                            onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                                                            className="w-full"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                                                            <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                                                                            Monthly Credit Limit (USD)
                                                                        </label>
                                                                        <Input
                                                                            type="number"
                                                                            value={editForm.creditLimit}
                                                                            onChange={(e) => setEditForm(f => ({ ...f, creditLimit: e.target.value }))}
                                                                            className="w-full"
                                                                            min="0"
                                                                            step="1000"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Status</label>
                                                                        <Select
                                                                            value={editForm.status}
                                                                            onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}
                                                                            className="w-full"
                                                                            options={[
                                                                                { value: 'ACTIVE', label: 'Active' },
                                                                                { value: 'INACTIVE', label: 'Inactive' },
                                                                            ]}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">Address</label>
                                                                    <Input
                                                                        value={editForm.address}
                                                                        onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
                                                                        className="w-full"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-end gap-2 pt-2">
                                                                    <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                                                                        <X className="w-3.5 h-3.5 mr-1" />
                                                                        Cancel
                                                                    </Button>
                                                                    <Button size="sm" onClick={saveEdit} disabled={saving || !editForm.name.trim()}>
                                                                        {saving ? (
                                                                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                                                        ) : (
                                                                            <Check className="w-3.5 h-3.5 mr-1" />
                                                                        )}
                                                                        Save Changes
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return (
                                                <tr
                                                    key={vendor.id}
                                                    className={cn(
                                                        "border-b border-[hsl(var(--border))] transition-colors",
                                                        "hover:bg-[hsl(var(--secondary))]/50",
                                                        util.level === 'danger' && "bg-red-500/[0.03]"
                                                    )}
                                                >
                                                    {/* Vendor Name + Code */}
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                                {vendor.name?.charAt(0) || 'V'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-[hsl(var(--foreground))] text-sm truncate">{vendor.name}</p>
                                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{vendor.code}</p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Grade */}
                                                    <td className="py-3 px-3 text-center">
                                                        <Badge className={cn('text-xs font-bold px-2.5', gradeColors[vendor.grade] || gradeColors['C'])}>
                                                            {vendor.grade || 'C'}
                                                        </Badge>
                                                    </td>

                                                    {/* Contact */}
                                                    <td className="py-3 px-4 hidden lg:table-cell">
                                                        <p className="text-sm text-[hsl(var(--foreground))]">{vendor.contact || '—'}</p>
                                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{vendor.email || ''}</p>
                                                    </td>

                                                    {/* Outstanding Balance */}
                                                    <td className="py-3 px-4 text-right">
                                                        <span className={cn(
                                                            "font-semibold text-sm",
                                                            balance > 0 ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"
                                                        )}>
                                                            {formatCurrency(balance)}
                                                        </span>
                                                    </td>

                                                    {/* Credit Utilization */}
                                                    <td className="py-3 px-4">
                                                        {limit > 0 ? (
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <span className={cn("font-medium", colors.text)}>
                                                                        {util.percent.toFixed(0)}%
                                                                    </span>
                                                                    <span className="text-[hsl(var(--muted-foreground))]">
                                                                        / {formatCurrency(limit)}
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-2 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
                                                                    <div
                                                                        className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
                                                                        style={{ width: `${Math.min(util.percent, 100)}%` }}
                                                                    />
                                                                </div>
                                                                {util.level === 'danger' && (
                                                                    <div className="flex items-center gap-1 text-xs text-red-400">
                                                                        <AlertTriangle className="w-3 h-3" />
                                                                        <span>Approaching limit</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-[hsl(var(--muted-foreground))] italic">
                                                                No limit set
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Status */}
                                                    <td className="py-3 px-4 text-center">
                                                        <Badge className={cn(
                                                            'text-xs',
                                                            vendor.status === 'ACTIVE'
                                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                                : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                                                        )}>
                                                            {vendor.status || 'ACTIVE'}
                                                        </Badge>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => { setSelectedVendorId(vendor.id); setShowDetailModal(true); }}
                                                                className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
                                                                title="View details"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => startEdit(vendor)}
                                                                className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-blue-400 transition-colors"
                                                                title="Edit vendor"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(vendor)}
                                                                disabled={isDeleting}
                                                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors disabled:opacity-50"
                                                                title="Delete vendor"
                                                            >
                                                                {isDeleting ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Table footer */}
                        {!loading && filteredVendors.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30">
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    Showing {filteredVendors.length} of {vendors.length} vendors
                                </p>
                                <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Safe
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-amber-500" /> Warning (≥60%)
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-red-500" /> At Risk (≥80%)
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
