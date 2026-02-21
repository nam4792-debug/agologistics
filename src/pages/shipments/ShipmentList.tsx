import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, Button, Input, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { NewShipmentModal } from '@/components/modals';
import { useShipments } from '@/hooks';
import toast from 'react-hot-toast';
import { fetchApi } from '@/lib/api';

interface ShipmentData {
    id: string;
    shipment_number: string;
    type: string;
    status: string;
    customer_id: string;
    customer_name?: string;
    origin_port: string;
    destination_port: string;
    origin_country: string;
    destination_country: string;
    container_number?: string;
    container_type?: string;
    cargo_description?: string;
    etd: string;
    eta: string;
    created_at: string;
}

export function ShipmentList() {
    const navigate = useNavigate();
    const [showNewShipmentModal, setShowNewShipmentModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Use real-time hook instead of manual fetch
    const { shipments, loading, refetch } = useShipments();

    // Powerful search that searches ALL fields
    const filteredShipments = (shipments as unknown as ShipmentData[])
        .filter(s => {
            if (!searchQuery.trim()) return true;

            const query = searchQuery.toLowerCase().trim();

            // Search across ALL possible fields
            const searchableFields = [
                s.shipment_number,
                s.customer_name,
                s.origin_port,
                s.destination_port,
                s.origin_country,
                s.destination_country,
                s.container_number,
                s.cargo_description,
                s.type,
                s.status,
            ].filter(Boolean);

            return searchableFields.some(field =>
                field?.toString().toLowerCase().includes(query)
            );
        });

    const handleShipmentCreated = () => {
        refetch();
        setShowNewShipmentModal(false);
    };

    return (
        <>
            <NewShipmentModal
                isOpen={showNewShipmentModal}
                onClose={() => setShowNewShipmentModal(false)}
                onSuccess={handleShipmentCreated}
            />

            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] tracking-tight">Shipments</h1>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                            Manage and track all your export shipments
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
                            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                            Refresh
                        </Button>
                        <Button size="sm" onClick={() => setShowNewShipmentModal(true)}>
                            New Shipment
                        </Button>
                    </div>
                </div>

                {/* Single Powerful Search */}
                <Card>
                    <CardContent className="p-4">
                        <div className="relative">
                            <Input
                                placeholder="Search everything: shipment number, customer, container, origin, destination..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-sm"
                                    onClick={() => setSearchQuery('')}
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        {searchQuery && (
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                                Found <span className="font-semibold text-[hsl(var(--foreground))]">{filteredShipments.length}</span> shipments matching "{searchQuery}"
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Shipments Table */}
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[hsl(var(--secondary))]">
                                        <tr>
                                            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-5 py-3 whitespace-nowrap">Shipment</th>
                                            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-4 py-3 whitespace-nowrap">Type</th>
                                            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-4 py-3 whitespace-nowrap">Customer</th>
                                            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-4 py-3 whitespace-nowrap">Route</th>
                                            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-4 py-3 whitespace-nowrap">Status</th>
                                            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-4 py-3 whitespace-nowrap">ETD → ETA</th>
                                            <th className="text-right text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] px-5 py-3 whitespace-nowrap"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredShipments.map((shipment) => {
                                            const fmtShort = (d: string) => {
                                                const date = new Date(d);
                                                return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
                                            };
                                            const originCode = (shipment.origin_country || shipment.origin_port || '').slice(0, 2).toUpperCase();
                                            const destCode = (shipment.destination_country || shipment.destination_port || '').slice(0, 2).toUpperCase();

                                            return (
                                                <tr
                                                    key={shipment.id}
                                                    className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/50 transition-colors cursor-pointer"
                                                    onClick={() => navigate(`/shipments/${shipment.id}`)}
                                                >
                                                    <td className="px-5 py-3 whitespace-nowrap">
                                                        <p className="font-semibold text-sm text-[hsl(var(--foreground))]">
                                                            {shipment.shipment_number}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={cn(
                                                            'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold',
                                                            shipment.type === 'FCL'
                                                                ? 'bg-blue-500/10 text-blue-400'
                                                                : 'bg-purple-500/10 text-purple-400'
                                                        )}>
                                                            {shipment.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="text-sm text-[hsl(var(--foreground))]">
                                                            {shipment.customer_name || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="text-sm text-[hsl(var(--foreground))] font-medium">
                                                            {originCode} → {destCode}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <StatusBadge status={shipment.status} />
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="text-sm text-[hsl(var(--foreground))] tabular-nums">
                                                            {shipment.etd ? fmtShort(shipment.etd) : 'TBD'}
                                                            {' → '}
                                                            {shipment.eta ? fmtShort(shipment.eta) : 'TBD'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs text-[hsl(var(--destructive))] opacity-40 hover:opacity-100"
                                                            title="Delete shipment"
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (confirm(`Delete shipment ${shipment.shipment_number}?`)) {
                                                                    try {
                                                                        await fetchApi(`/api/shipments/${shipment.id}`, { method: 'DELETE' });
                                                                        toast.success('Shipment deleted');
                                                                    } catch (error) {
                                                                        console.error('Delete failed:', error);
                                                                        toast.error('Failed to delete shipment');
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            ✕
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!loading && filteredShipments.length === 0 && (
                            <div className="text-center py-12">
                                <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No shipments found</h3>
                                <p className="text-[hsl(var(--muted-foreground))] mt-1 text-sm">
                                    {searchQuery ? `No results for "${searchQuery}"` : 'Create your first shipment to get started'}
                                </p>
                                {!searchQuery && (
                                    <Button className="mt-4" size="sm" onClick={() => setShowNewShipmentModal(true)}>
                                        Create Shipment
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Results Count */}
                <div className="flex items-center justify-between">
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Showing {filteredShipments.length} of {shipments.length} shipments
                    </p>
                </div>
            </div >
        </>
    );
}
