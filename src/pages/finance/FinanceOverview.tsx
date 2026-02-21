import { useState, useEffect } from 'react';
import {
    DollarSign,
    FileText,
    Clock,
    CheckCircle,
    Loader2,
    RefreshCw,
    AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { fetchApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface Invoice {
    id: string;
    invoice_number: string;
    shipment_id?: string;
    shipment_number?: string;
    vendor_name?: string;
    amount_usd: number;
    status: string;
    due_date?: string;
    created_at: string;
}

interface InvoiceSummary {
    totalAmount: number;
    pendingAmount: number;
    paidAmount: number;
    overdueCount: number;
}

export function FinanceOverview() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [summary, setSummary] = useState<InvoiceSummary>({ totalAmount: 0, pendingAmount: 0, paidAmount: 0, overdueCount: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch REAL invoices from database
            const data = await fetchApi('/api/invoices');
            if (data.invoices) {
                setInvoices(data.invoices);
                setSummary(data.summary || { totalAmount: 0, pendingAmount: 0, paidAmount: 0, overdueCount: 0 });
            }
        } catch (error) {
            console.error('Failed to fetch finance data:', error);
            setInvoices([]);
        } finally {
            setLoading(false);
        }
    };

    const isOverdue = (inv: Invoice) =>
        inv.status === 'PENDING' && inv.due_date && new Date(inv.due_date) < new Date();

    const getStatusConfig = (inv: Invoice) => {
        const overdue = isOverdue(inv);
        if (overdue || inv.status === 'OVERDUE') {
            return { label: 'Overdue', color: 'text-red-400 bg-red-500/20', icon: <AlertTriangle className="w-4 h-4 text-red-400" /> };
        }
        switch (inv.status) {
            case 'PAID': return { label: 'Paid', color: 'text-green-400 bg-green-500/20', icon: <CheckCircle className="w-4 h-4 text-green-400" /> };
            case 'PENDING': return { label: 'Pending', color: 'text-yellow-400 bg-yellow-500/20', icon: <Clock className="w-4 h-4 text-yellow-400" /> };
            default: return { label: inv.status, color: 'text-gray-400 bg-gray-500/20', icon: <FileText className="w-4 h-4 text-gray-400" /> };
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
                        <DollarSign className="w-8 h-8" />
                        Finance & Invoices
                    </h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Track invoices, payments and costs
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button onClick={() => navigate('/invoices')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Manage Invoices
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Total Amount</p>
                                <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{formatCurrency(summary.totalAmount)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-blue-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-yellow-500/30">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-yellow-400">Pending</p>
                                <p className="text-2xl font-bold text-yellow-400">{formatCurrency(summary.pendingAmount)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-yellow-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-green-500/30">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-400">Paid</p>
                                <p className="text-2xl font-bold text-green-400">{formatCurrency(summary.paidAmount)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-green-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-red-500/30">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-red-400">Overdue</p>
                                <p className="text-2xl font-bold text-red-400">{summary.overdueCount}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-red-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Real Invoices from Database */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Invoices
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
                        View All →
                    </Button>
                </CardHeader>
                <CardContent>
                    {invoices.length > 0 ? (
                        <div className="space-y-4">
                            {invoices.slice(0, 8).map((invoice) => {
                                const config = getStatusConfig(invoice);
                                return (
                                    <div
                                        key={invoice.id}
                                        className={cn(
                                            'p-4 rounded-lg border transition-all hover:bg-[hsl(var(--secondary))] cursor-pointer',
                                            (isOverdue(invoice) || invoice.status === 'OVERDUE') && 'border-red-500/30'
                                        )}
                                        onClick={() => invoice.shipment_id && navigate(`/shipments/${invoice.shipment_id}`)}
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', config.color.split(' ')[1])}>
                                                    {config.icon}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-[hsl(var(--foreground))]">{invoice.invoice_number || '—'}</p>
                                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                        {invoice.vendor_name || 'No vendor'} • {invoice.shipment_number || 'No shipment'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="font-semibold text-[hsl(var(--foreground))]">{formatCurrency(parseFloat(String(invoice.amount_usd)) || 0)}</p>
                                                </div>

                                                <div className="text-right">
                                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Due</p>
                                                    <p className="text-sm text-[hsl(var(--foreground))]">{invoice.due_date ? formatDate(invoice.due_date) : '—'}</p>
                                                </div>

                                                <Badge className={cn('flex items-center gap-1', config.color)}>
                                                    {config.label}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No invoices yet</h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                Create invoices from the Invoices page
                            </p>
                            <Button className="mt-4" onClick={() => navigate('/invoices')}>
                                Go to Invoices
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Payment Status Overview */}
            <Card>
                <CardHeader>
                    <CardTitle>Payment Status Overview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[
                            { status: 'Pending', count: invoices.filter(i => i.status === 'PENDING' && !isOverdue(i)).length, color: 'bg-yellow-500' },
                            { status: 'Overdue', count: invoices.filter(i => i.status === 'OVERDUE' || isOverdue(i)).length, color: 'bg-red-500' },
                            { status: 'Paid', count: invoices.filter(i => i.status === 'PAID').length, color: 'bg-green-500' },
                        ].map((item) => (
                            <div key={item.status} className="flex items-center gap-4">
                                <div className={cn('w-3 h-3 rounded-full', item.color)} />
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">{item.status}</span>
                                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                                            {item.count} invoice{item.count !== 1 ? 's' : ''}
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
    );
}
