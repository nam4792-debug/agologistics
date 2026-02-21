import React, { useState, useEffect } from 'react';
import {
    DollarSign,
    Search,
    FileText,
    Clock,
    CheckCircle,
    AlertTriangle,
    Loader2,
    RefreshCw,
    ExternalLink,
    Plus,
    X,
} from 'lucide-react';
import { Card, CardContent, Button, Input, Badge } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { CostBreakdownPanel } from '@/components/CostManagement';

interface Invoice {
    id: string;
    invoice_number: string;
    shipment_id: string;
    shipment_number?: string;
    shipment_type?: string;
    vendor_name?: string;
    amount_usd: number;
    currency: string;
    status: string;
    due_date?: string;
    paid_date?: string;
    notes?: string;
    created_at: string;
}

interface InvoiceSummary {
    totalAmount: number;
    pendingAmount: number;
    paidAmount: number;
    overdueCount: number;
    overdueAmount: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    PENDING: { label: 'Pending', color: 'text-yellow-400 bg-yellow-500/20', icon: <Clock className="w-3.5 h-3.5" /> },
    PAID: { label: 'Paid', color: 'text-green-400 bg-green-500/20', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    OVERDUE: { label: 'Overdue', color: 'text-red-400 bg-red-500/20', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    CANCELLED: { label: 'Cancelled', color: 'text-gray-400 bg-gray-500/20', icon: <FileText className="w-3.5 h-3.5" /> },
};

export function InvoiceList() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [summary, setSummary] = useState<InvoiceSummary>({ totalAmount: 0, pendingAmount: 0, paidAmount: 0, overdueCount: 0, overdueAmount: 0 });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [shipments, setShipments] = useState<Array<{ value: string; label: string }>>([]);
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
    const [newInvoice, setNewInvoice] = useState({
        invoice_number: '',
        vendor_name: '',
        amount_usd: '',
        category: 'Ocean Freight',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        shipment_id: '',
    });

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const data = await fetchApi('/api/invoices');
            if (data.invoices) {
                setInvoices(data.invoices);
                setSummary(data.summary || { totalAmount: 0, pendingAmount: 0, paidAmount: 0, overdueCount: 0 });
            }
        } catch (error) {
            console.error('Failed to fetch invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateInvoice = async () => {
        if (!newInvoice.vendor_name || !newInvoice.amount_usd) {
            toast.error('Vendor name and amount are required');
            return;
        }
        setCreating(true);
        try {
            await fetchApi('/api/invoices', {
                method: 'POST',
                body: JSON.stringify({
                    ...newInvoice,
                    amount_usd: parseFloat(newInvoice.amount_usd),
                    currency: 'USD',
                    status: 'PENDING',
                }),
            });
            toast.success('Invoice created successfully');
            setShowCreateModal(false);
            setNewInvoice({
                invoice_number: '',
                vendor_name: '',
                amount_usd: '',
                category: 'Ocean Freight',
                issue_date: new Date().toISOString().split('T')[0],
                due_date: '',
                shipment_id: '',
            });
            fetchInvoices();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to create invoice');
        } finally {
            setCreating(false);
        }
    };

    useEffect(() => { fetchInvoices(); }, []);

    // Fetch shipments for dropdown
    useEffect(() => {
        const loadShipments = async () => {
            try {
                const data = await fetchApi('/api/shipments');
                if (data.shipments) {
                    setShipments(data.shipments.map((s: any) => ({
                        value: s.id,
                        label: s.shipment_number || s.id,
                    })));
                }
            } catch (e) {
                console.error('Failed to load shipments:', e);
            }
        };
        loadShipments();
    }, []);

    const handleMarkStatus = async (invoiceId: string, newStatus: string) => {
        try {
            await fetchApi(`/api/invoices/${invoiceId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus }),
            });
            toast.success(`Invoice marked as ${newStatus.toLowerCase()}`);
            fetchInvoices();
        } catch (error: any) {
            toast.error(error?.message || `Failed to update invoice status`);
        }
    };

    const handleDeleteInvoice = async (invoiceId: string) => {
        const confirmed = window.confirm('Delete this invoice? This action cannot be undone.');
        if (!confirmed) return;
        try {
            await fetchApi(`/api/invoices/${invoiceId}`, {
                method: 'DELETE',
            });
            toast.success('Invoice deleted');
            fetchInvoices();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to delete invoice');
        }
    };

    // Determine if an invoice is overdue
    const isOverdue = (inv: Invoice) =>
        inv.status === 'PENDING' && inv.due_date && new Date(inv.due_date) < new Date();

    // Filter invoices
    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = !searchQuery ||
            inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.shipment_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase());

        const effectiveStatus = isOverdue(inv) ? 'OVERDUE' : inv.status;
        const matchesStatus = statusFilter === 'ALL' || effectiveStatus === statusFilter;

        return matchesSearch && matchesStatus;
    });

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
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Invoices</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Manage all invoices and track payments
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Invoice
                    </Button>
                    <Button variant="outline" onClick={fetchInvoices}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Create Invoice Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[hsl(var(--card))] rounded-xl p-6 max-w-lg w-full mx-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Create Invoice</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1 block">Invoice Number</label>
                                <input
                                    className="w-full p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    placeholder="Auto-generated if empty"
                                    value={newInvoice.invoice_number}
                                    onChange={(e) => setNewInvoice(p => ({ ...p, invoice_number: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1 block">Vendor Name *</label>
                                <input
                                    className="w-full p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    placeholder="e.g., MSC Vietnam"
                                    value={newInvoice.vendor_name}
                                    onChange={(e) => setNewInvoice(p => ({ ...p, vendor_name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1 block">Amount (USD) *</label>
                                <input
                                    type="number"
                                    className="w-full p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    placeholder="0.00"
                                    value={newInvoice.amount_usd}
                                    onChange={(e) => setNewInvoice(p => ({ ...p, amount_usd: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1 block">Category</label>
                                <select
                                    className="w-full p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    value={newInvoice.category}
                                    onChange={(e) => setNewInvoice(p => ({ ...p, category: e.target.value }))}
                                >
                                    <option value="Ocean Freight">Ocean Freight</option>
                                    <option value="Air Freight">Air Freight</option>
                                    <option value="Terminal Handling">Terminal Handling</option>
                                    <option value="Customs Brokerage">Customs Brokerage</option>
                                    <option value="Trucking">Trucking</option>
                                    <option value="Forwarding Fee">Forwarding Fee</option>
                                    <option value="Insurance">Insurance</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1 block">Issue Date</label>
                                <input
                                    type="date"
                                    className="w-full p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    value={newInvoice.issue_date}
                                    onChange={(e) => setNewInvoice(p => ({ ...p, issue_date: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1 block">Due Date</label>
                                <input
                                    type="date"
                                    className="w-full p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    value={newInvoice.due_date}
                                    onChange={(e) => setNewInvoice(p => ({ ...p, due_date: e.target.value }))}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm text-[hsl(var(--muted-foreground))] mb-1 block">Linked Shipment</label>
                                <select
                                    className="w-full p-2.5 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    value={newInvoice.shipment_id}
                                    onChange={(e) => setNewInvoice(p => ({ ...p, shipment_id: e.target.value }))}
                                >
                                    <option value="">No shipment linked</option>
                                    {shipments.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                            <Button onClick={handleCreateInvoice} disabled={creating}>
                                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                Create Invoice
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                    {formatCurrency(summary.totalAmount)}
                                </p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Amount</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-yellow-400">
                                    {formatCurrency(summary.pendingAmount)}
                                </p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Pending</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-green-400">
                                    {formatCurrency(summary.paidAmount)}
                                </p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Paid</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-red-400">
                                    {formatCurrency(summary.overdueAmount || 0)}
                                </p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Overdue ({summary.overdueCount || 0})</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Filter */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Search by invoice number, shipment, or vendor..."
                                icon={<Search className="w-4 h-4" />}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-1">
                            {['ALL', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={cn(
                                        'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                        statusFilter === status
                                            ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                                            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]'
                                    )}
                                >
                                    {status === 'ALL' ? 'All' : statusConfig[status]?.label || status}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Invoice Table */}
            <Card>
                <CardContent className="p-0">
                    {filteredInvoices.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[hsl(var(--border))]">
                                        <th className="text-left p-4 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Invoice #</th>
                                        <th className="text-left p-4 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Shipment</th>
                                        <th className="text-left p-4 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Vendor</th>
                                        <th className="text-right p-4 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Amount</th>
                                        <th className="text-left p-4 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Status</th>
                                        <th className="text-left p-4 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Due Date</th>
                                        <th className="text-left p-4 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Created</th>
                                        <th className="text-right p-4 text-sm font-semibold text-[hsl(var(--muted-foreground))]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.map(inv => {
                                        const overdue = isOverdue(inv);
                                        const effectiveStatus = overdue ? 'OVERDUE' : inv.status;
                                        const config = statusConfig[effectiveStatus] || statusConfig.PENDING;
                                        return (
                                            <React.Fragment key={inv.id}>
                                                <tr
                                                    className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] transition-colors"
                                                >
                                                    <td className="p-4">
                                                        <span className="font-medium text-[hsl(var(--foreground))]">
                                                            {inv.invoice_number || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {inv.shipment_number ? (
                                                            <button
                                                                onClick={() => navigate(`/shipments/${inv.shipment_id}`)}
                                                                className="text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                                                            >
                                                                {inv.shipment_number}
                                                                <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                        ) : (
                                                            <span className="text-[hsl(var(--muted-foreground))]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-[hsl(var(--foreground))]">
                                                        {inv.vendor_name || '—'}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <span className="font-semibold text-[hsl(var(--foreground))]">
                                                            {formatCurrency(parseFloat(String(inv.amount_usd)) || 0)}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <Badge className={cn('flex items-center gap-1 w-fit', config.color)}>
                                                            {config.icon}
                                                            {config.label}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={cn(
                                                            'text-sm',
                                                            overdue ? 'text-red-400 font-semibold' : 'text-[hsl(var(--muted-foreground))]'
                                                        )}>
                                                            {inv.due_date ? formatDate(inv.due_date) : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
                                                        {formatDate(inv.created_at)}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {inv.status === 'PENDING' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-green-400 hover:bg-green-500/10"
                                                                    onClick={() => handleMarkStatus(inv.id, 'PAID')}
                                                                >
                                                                    Mark Paid
                                                                </Button>
                                                            )}
                                                            {inv.status === 'PAID' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-yellow-400 hover:bg-yellow-500/10"
                                                                    onClick={() => handleMarkStatus(inv.id, 'PENDING')}
                                                                >
                                                                    Reopen
                                                                </Button>
                                                            )}
                                                            {inv.shipment_id && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => navigate(`/shipments/${inv.shipment_id}`)}
                                                                >
                                                                    View
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-blue-400 hover:bg-blue-500/10"
                                                                onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                                                            >
                                                                {expandedInvoiceId === inv.id ? 'Hide' : 'Breakdown'}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-400 hover:bg-red-500/10"
                                                                onClick={() => handleDeleteInvoice(inv.id)}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {expandedInvoiceId === inv.id && (
                                                    <tr>
                                                        <td colSpan={8} className="p-4 bg-white/5">
                                                            <CostBreakdownPanel invoiceId={inv.id} invoiceAmount={parseFloat(String(inv.amount_usd)) || 0} />
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <FileText className="w-16 h-16 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                            <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                No invoices found
                            </h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-2">
                                {searchQuery
                                    ? `No results for "${searchQuery}"`
                                    : 'Invoices will appear here when shipments have associated costs'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
