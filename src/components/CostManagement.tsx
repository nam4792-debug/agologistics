import { useState, useEffect, useCallback } from 'react';
import {
    DollarSign,
    Plus,
    Trash2,
    PieChart,
    ArrowUpCircle,
    ArrowDownCircle,
    RefreshCw,
    Loader2,
    X,
    TrendingUp,
    TrendingDown,
    Minus,
} from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';
import { fetchApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
interface LineItem {
    id: string;
    invoice_id: string;
    fee_type: string;
    description: string | null;
    amount: number;
    currency: string;
    amount_usd: number;
    created_at: string;
}

interface FeeTypeOption {
    value: string;
    label: string;
}

const FEE_TYPE_COLORS: Record<string, string> = {
    FREIGHT: 'bg-blue-500',
    THC: 'bg-green-500',
    BL_FEE: 'bg-yellow-500',
    DO_FEE: 'bg-orange-500',
    CUSTOMS: 'bg-red-500',
    HANDLING: 'bg-purple-500',
    STORAGE: 'bg-indigo-500',
    INSPECTION: 'bg-teal-500',
    INSURANCE: 'bg-cyan-500',
    TRUCKING: 'bg-pink-500',
    OTHER: 'bg-gray-500',
};

const FEE_TYPE_OPTIONS: FeeTypeOption[] = [
    { value: 'FREIGHT', label: 'Freight' },
    { value: 'THC', label: 'THC' },
    { value: 'BL_FEE', label: 'B/L Fee' },
    { value: 'DO_FEE', label: 'D/O Fee' },
    { value: 'CUSTOMS', label: 'Customs' },
    { value: 'HANDLING', label: 'Handling' },
    { value: 'STORAGE', label: 'Storage' },
    { value: 'INSPECTION', label: 'Inspection' },
    { value: 'INSURANCE', label: 'Insurance' },
    { value: 'TRUCKING', label: 'Trucking' },
    { value: 'OTHER', label: 'Other' },
];

// ═══════════════════════════════════════════════
// COST BREAKDOWN PANEL
// ═══════════════════════════════════════════════
export function CostBreakdownPanel({ invoiceId, invoiceAmount }: { invoiceId: string; invoiceAmount: number }) {
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newItem, setNewItem] = useState({ fee_type: 'FREIGHT', description: '', amount: '', currency: 'USD' });

    const fetchLineItems = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchApi(`/api/costs/invoice/${invoiceId}/breakdown`);
            setLineItems(data.lineItems || []);
        } catch {
            // Table might not exist yet
            setLineItems([]);
        } finally {
            setLoading(false);
        }
    }, [invoiceId]);

    useEffect(() => { fetchLineItems(); }, [fetchLineItems]);

    const handleAdd = async () => {
        if (!newItem.amount || parseFloat(newItem.amount) <= 0) {
            toast.error('Amount must be greater than 0');
            return;
        }
        setAdding(true);
        try {
            await fetchApi('/api/costs/line-items', {
                method: 'POST',
                body: JSON.stringify({
                    invoice_id: invoiceId,
                    fee_type: newItem.fee_type,
                    description: newItem.description || null,
                    amount: parseFloat(newItem.amount),
                    currency: newItem.currency,
                }),
            });
            toast.success('Line item added');
            setNewItem({ fee_type: 'FREIGHT', description: '', amount: '', currency: 'USD' });
            setShowAddForm(false);
            fetchLineItems();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to add line item');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetchApi(`/api/costs/line-items/${id}`, { method: 'DELETE' });
            toast.success('Line item removed');
            fetchLineItems();
        } catch {
            toast.error('Failed to delete');
        }
    };

    const lineItemsTotal = lineItems.reduce((sum, li) => sum + parseFloat(String(li.amount_usd || li.amount || 0)), 0);

    return (
        <Card className="border border-white/10 bg-white/5">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-blue-400" />
                        <h3 className="text-white font-semibold">Cost Breakdown</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchLineItems} className="text-gray-400 hover:text-white transition-colors">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <Button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Fee
                        </Button>
                    </div>
                </div>

                {/* Add form */}
                {showAddForm && (
                    <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <select
                                value={newItem.fee_type}
                                onChange={(e) => setNewItem({ ...newItem, fee_type: e.target.value })}
                                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                            >
                                {FEE_TYPE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value} className="bg-gray-900">{opt.label}</option>
                                ))}
                            </select>
                            <Input
                                type="number"
                                placeholder="Amount"
                                value={newItem.amount}
                                onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                                className="text-sm"
                            />
                        </div>
                        <Input
                            placeholder="Description (optional)"
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            className="text-sm"
                        />
                        <div className="flex justify-end gap-2">
                            <Button onClick={() => setShowAddForm(false)} className="text-xs px-3 py-1.5 bg-white/10 text-gray-300">
                                <X className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                            <Button onClick={handleAdd} disabled={adding} className="text-xs px-3 py-1.5 bg-blue-600 text-white">
                                {adding ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                                Add
                            </Button>
                        </div>
                    </div>
                )}

                {/* Line items list */}
                {loading ? (
                    <div className="text-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                    </div>
                ) : lineItems.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">
                        No fee breakdown yet. Click "Add Fee" to add line items.
                    </div>
                ) : (
                    <>
                        <div className="space-y-2 mb-4">
                            {lineItems.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className={cn('w-2 h-2 rounded-full', FEE_TYPE_COLORS[item.fee_type] || 'bg-gray-500')} />
                                        <div>
                                            <span className="text-white text-sm font-medium">
                                                {FEE_TYPE_OPTIONS.find(o => o.value === item.fee_type)?.label || item.fee_type}
                                            </span>
                                            {item.description && (
                                                <span className="text-gray-400 text-xs ml-2">{item.description}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-white font-mono text-sm">{formatCurrency(item.amount_usd || item.amount)}</span>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Visual breakdown bar */}
                        <div className="h-3 rounded-full overflow-hidden flex mb-3 bg-white/5">
                            {FEE_TYPE_OPTIONS.map(opt => {
                                const typeTotal = lineItems
                                    .filter(li => li.fee_type === opt.value)
                                    .reduce((s, li) => s + parseFloat(String(li.amount_usd || li.amount || 0)), 0);
                                if (typeTotal <= 0 || lineItemsTotal <= 0) return null;
                                const pct = (typeTotal / lineItemsTotal) * 100;
                                return (
                                    <div
                                        key={opt.value}
                                        className={cn('h-full transition-all', FEE_TYPE_COLORS[opt.value])}
                                        style={{ width: `${pct}%` }}
                                        title={`${opt.label}: ${formatCurrency(typeTotal)} (${pct.toFixed(1)}%)`}
                                    />
                                );
                            })}
                        </div>

                        {/* Totals */}
                        <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                            <span className="text-gray-400">Line Items Total</span>
                            <span className="text-white font-mono font-semibold">{formatCurrency(lineItemsTotal)}</span>
                        </div>
                        {invoiceAmount > 0 && Math.abs(invoiceAmount - lineItemsTotal) > 0.01 && (
                            <div className="flex justify-between text-xs mt-1">
                                <span className="text-yellow-400">⚠ Invoice total ({formatCurrency(invoiceAmount)}) differs</span>
                                <span className="text-yellow-400 font-mono">Δ {formatCurrency(Math.abs(invoiceAmount - lineItemsTotal))}</span>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════
// PROFIT & LOSS PANEL
// ═══════════════════════════════════════════════
interface PnLData {
    shipment: { shipment_number: string; type: string; status: string; customer_name: string };
    revenue: { entries: Array<{ id: string; description: string; amount_usd: number }>; total: number };
    costs: { entries: Array<{ id: string; invoice_number: string; amount_usd: number; vendor_name: string }>; total: number; breakdown: Array<{ fee_type: string; total: number }> };
    pnl: { profit: number; margin: number; status: string };
}

export function ProfitLossPanel({ shipmentId }: { shipmentId: string }) {
    const [data, setData] = useState<PnLData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddRevenue, setShowAddRevenue] = useState(false);
    const [newRevenue, setNewRevenue] = useState({ description: '', amount: '', currency: 'USD' });
    const [adding, setAdding] = useState(false);

    const fetchPnL = useCallback(async () => {
        try {
            setLoading(true);
            const result = await fetchApi(`/api/costs/shipment/${shipmentId}/pnl`);
            setData(result);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [shipmentId]);

    useEffect(() => { fetchPnL(); }, [fetchPnL]);

    const handleAddRevenue = async () => {
        if (!newRevenue.amount || parseFloat(newRevenue.amount) <= 0) {
            toast.error('Amount must be greater than 0');
            return;
        }
        setAdding(true);
        try {
            await fetchApi(`/api/costs/shipment/${shipmentId}/revenue`, {
                method: 'POST',
                body: JSON.stringify({
                    description: newRevenue.description || 'Service Revenue',
                    amount: parseFloat(newRevenue.amount),
                    currency: newRevenue.currency,
                }),
            });
            toast.success('Revenue added');
            setNewRevenue({ description: '', amount: '', currency: 'USD' });
            setShowAddRevenue(false);
            fetchPnL();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to add revenue');
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteRevenue = async (id: string) => {
        try {
            await fetchApi(`/api/costs/revenue/${id}`, { method: 'DELETE' });
            toast.success('Revenue removed');
            fetchPnL();
        } catch {
            toast.error('Failed to delete');
        }
    };

    if (loading) {
        return (
            <Card className="border border-white/10 bg-white/5">
                <CardContent className="p-6 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    const pnlColor = data.pnl.status === 'PROFIT' ? 'text-green-400' : data.pnl.status === 'LOSS' ? 'text-red-400' : 'text-gray-400';
    const PnlIcon = data.pnl.status === 'PROFIT' ? TrendingUp : data.pnl.status === 'LOSS' ? TrendingDown : Minus;

    return (
        <Card className="border border-white/10 bg-white/5">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <h3 className="text-white font-semibold">Profit & Loss</h3>
                    </div>
                    <button onClick={fetchPnL} className="text-gray-400 hover:text-white transition-colors">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {/* P&L Summary Card */}
                <div className={cn('rounded-xl p-4 mb-4 border', {
                    'bg-green-500/10 border-green-500/30': data.pnl.status === 'PROFIT',
                    'bg-red-500/10 border-red-500/30': data.pnl.status === 'LOSS',
                    'bg-white/5 border-white/10': data.pnl.status === 'BREAK_EVEN',
                })}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Net {data.pnl.status.replace('_', ' ')}</p>
                            <p className={cn('text-2xl font-bold font-mono', pnlColor)}>
                                {data.pnl.profit >= 0 ? '+' : ''}{formatCurrency(data.pnl.profit)}
                            </p>
                        </div>
                        <div className="text-right">
                            <PnlIcon className={cn('w-8 h-8', pnlColor)} />
                            <p className={cn('text-sm font-semibold mt-1', pnlColor)}>{data.pnl.margin}%</p>
                        </div>
                    </div>
                </div>

                {/* Revenue Section */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <ArrowUpCircle className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 text-sm font-medium">Revenue</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-green-400 font-mono text-sm">{formatCurrency(data.revenue.total)}</span>
                            <button
                                onClick={() => setShowAddRevenue(!showAddRevenue)}
                                className="text-green-400 hover:text-green-300 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {showAddRevenue && (
                        <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                            <Input
                                placeholder="Description (e.g. Service fee)"
                                value={newRevenue.description}
                                onChange={(e) => setNewRevenue({ ...newRevenue, description: e.target.value })}
                                className="text-sm"
                            />
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    placeholder="Amount"
                                    value={newRevenue.amount}
                                    onChange={(e) => setNewRevenue({ ...newRevenue, amount: e.target.value })}
                                    className="text-sm flex-1"
                                />
                                <Button onClick={handleAddRevenue} disabled={adding} className="text-xs px-3 bg-green-600 text-white">
                                    {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                                </Button>
                                <Button onClick={() => setShowAddRevenue(false)} className="text-xs px-3 bg-white/10 text-gray-300">
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {data.revenue.entries.length > 0 ? (
                        <div className="space-y-1">
                            {data.revenue.entries.map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-white/5 group">
                                    <span className="text-gray-300 text-xs">{entry.description || 'Revenue'}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-green-400 font-mono text-xs">{formatCurrency(entry.amount_usd)}</span>
                                        <button
                                            onClick={() => handleDeleteRevenue(entry.id)}
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-xs px-2">No revenue entries yet</p>
                    )}
                </div>

                {/* Costs Section */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <ArrowDownCircle className="w-4 h-4 text-red-400" />
                            <span className="text-red-400 text-sm font-medium">Costs (from Invoices)</span>
                        </div>
                        <span className="text-red-400 font-mono text-sm">-{formatCurrency(data.costs.total)}</span>
                    </div>

                    {data.costs.entries.length > 0 ? (
                        <div className="space-y-1">
                            {data.costs.entries.map((entry) => (
                                <div key={entry.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-white/5">
                                    <span className="text-gray-300 text-xs">
                                        {entry.invoice_number}
                                        {entry.vendor_name && <span className="text-gray-500 ml-1">({entry.vendor_name})</span>}
                                    </span>
                                    <span className="text-red-400 font-mono text-xs">-{formatCurrency(entry.amount_usd)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-xs px-2">No invoices yet</p>
                    )}

                    {/* Cost breakdown by fee type */}
                    {data.costs.breakdown.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-gray-400 text-xs mb-2">By Fee Type:</p>
                            <div className="grid grid-cols-2 gap-1">
                                {data.costs.breakdown.map((b) => (
                                    <div key={b.fee_type} className="flex items-center justify-between px-2 py-1 rounded bg-white/5">
                                        <div className="flex items-center gap-1.5">
                                            <div className={cn('w-1.5 h-1.5 rounded-full', FEE_TYPE_COLORS[b.fee_type] || 'bg-gray-500')} />
                                            <span className="text-gray-300 text-xs">
                                                {FEE_TYPE_OPTIONS.find(o => o.value === b.fee_type)?.label || b.fee_type}
                                            </span>
                                        </div>
                                        <span className="text-white font-mono text-xs">{formatCurrency(parseFloat(String(b.total)))}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════
// EXCHANGE RATE SETTINGS
// ═══════════════════════════════════════════════
export function ExchangeRateSettings() {
    const [rates, setRates] = useState<Array<{ id: string; from_currency: string; to_currency: string; rate: number; effective_date: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newRate, setNewRate] = useState({ from: 'VND', to: 'USD', rate: '', date: new Date().toISOString().split('T')[0] });
    const [adding, setAdding] = useState(false);

    const fetchRates = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchApi('/api/costs/exchange-rates');
            setRates(data.rates || []);
        } catch {
            setRates([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRates(); }, [fetchRates]);

    const handleAdd = async () => {
        if (!newRate.rate || parseFloat(newRate.rate) <= 0) {
            toast.error('Rate must be greater than 0');
            return;
        }
        setAdding(true);
        try {
            await fetchApi('/api/costs/exchange-rates', {
                method: 'POST',
                body: JSON.stringify({
                    from_currency: newRate.from,
                    to_currency: newRate.to,
                    rate: parseFloat(newRate.rate),
                    effective_date: newRate.date,
                }),
            });
            toast.success('Exchange rate saved');
            setShowAdd(false);
            fetchRates();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save rate');
        } finally {
            setAdding(false);
        }
    };

    return (
        <Card className="border border-white/10 bg-white/5">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-yellow-400" />
                        Exchange Rates
                    </h3>
                    <Button
                        onClick={() => setShowAdd(!showAdd)}
                        className="text-xs px-3 py-1.5 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Set Rate
                    </Button>
                </div>

                {showAdd && (
                    <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <select
                                value={newRate.from}
                                onChange={(e) => setNewRate({ ...newRate, from: e.target.value })}
                                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none"
                            >
                                <option value="VND" className="bg-gray-900">VND</option>
                                <option value="USD" className="bg-gray-900">USD</option>
                                <option value="EUR" className="bg-gray-900">EUR</option>
                                <option value="CNY" className="bg-gray-900">CNY</option>
                            </select>
                            <Input
                                type="number"
                                placeholder="Rate"
                                value={newRate.rate}
                                onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })}
                                className="text-sm"
                            />
                            <Input
                                type="date"
                                value={newRate.date}
                                onChange={(e) => setNewRate({ ...newRate, date: e.target.value })}
                                className="text-sm"
                            />
                        </div>
                        <p className="text-gray-400 text-xs">
                            1 {newRate.from} = {newRate.rate || '?'} USD
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button onClick={() => setShowAdd(false)} className="text-xs px-3 py-1.5 bg-white/10 text-gray-300">Cancel</Button>
                            <Button onClick={handleAdd} disabled={adding} className="text-xs px-3 py-1.5 bg-yellow-600 text-white">
                                {adding ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                                Save Rate
                            </Button>
                        </div>
                    </div>
                )}

                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto my-4" />
                ) : rates.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">No exchange rates set. Click "Set Rate" to add one.</p>
                ) : (
                    <div className="space-y-2">
                        {rates.map((r) => (
                            <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                                <span className="text-white text-sm">
                                    1 {r.from_currency} = <span className="font-mono font-semibold">{Number(r.rate).toFixed(6)}</span> {r.to_currency}
                                </span>
                                <span className="text-gray-400 text-xs">{r.effective_date?.split('T')?.[0]}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
