import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Ship,
    Plane,
    Search,
    Plus,
    Eye,
    Trash2,
    ArrowUpDown,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import { Card, CardContent, Button, Input, StatusBadge } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import { NewShipmentModal } from '@/components/modals';
import { useShipments } from '@/hooks';
import toast from 'react-hot-toast';
import { API_URL } from '@/lib/api';

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
    // Filter: Only show shipments with confirmed statuses
    const confirmedStatuses = ['BOOKING_CONFIRMED', 'DOCUMENTATION_IN', 'READY_TO', 'LOADING', 'LOADED', 'IN_TRANSIT'];

    const filteredShipments = (shipments as unknown as ShipmentData[])
        .filter(s => confirmedStatuses.includes(s.status)) // Only show confirmed+
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
                        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Shipments</h1>
                        <p className="text-[hsl(var(--muted-foreground))] mt-1">
                            Manage and track all your export shipments
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={refetch} disabled={loading}>
                            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                            Refresh
                        </Button>
                        <Button onClick={() => setShowNewShipmentModal(true)}>
                            <Plus className="w-4 h-4 mr-2" />
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
                                icon={<Search className="w-4 h-4" />}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="text-lg"
                            />
                            {searchQuery && (
                                <button
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                    onClick={() => setSearchQuery('')}
                                >
                                    ✕
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
                                <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[hsl(var(--secondary))]">
                                        <tr>
                                            <th className="text-left text-sm font-medium text-[hsl(var(--muted-foreground))] px-6 py-4">
                                                <button className="flex items-center gap-1 hover:text-[hsl(var(--foreground))]">
                                                    Shipment <ArrowUpDown className="w-3 h-3" />
                                                </button>
                                            </th>
                                            <th className="text-left text-sm font-medium text-[hsl(var(--muted-foreground))] px-6 py-4">Type</th>
                                            <th className="text-left text-sm font-medium text-[hsl(var(--muted-foreground))] px-6 py-4">Customer</th>
                                            <th className="text-left text-sm font-medium text-[hsl(var(--muted-foreground))] px-6 py-4">Route</th>
                                            <th className="text-left text-sm font-medium text-[hsl(var(--muted-foreground))] px-6 py-4">Container</th>
                                            <th className="text-left text-sm font-medium text-[hsl(var(--muted-foreground))] px-6 py-4">Status</th>
                                            <th className="text-left text-sm font-medium text-[hsl(var(--muted-foreground))] px-6 py-4">ETD/ETA</th>
                                            <th className="text-left text-sm font-medium text-[hsl(var(--muted-foreground))] px-6 py-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredShipments.map((shipment) => (
                                            <tr
                                                key={shipment.id}
                                                className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] transition-colors cursor-pointer"
                                                onClick={() => navigate(`/shipments/${shipment.id}`)}
                                            >
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-[hsl(var(--foreground))]">
                                                        {shipment.shipment_number}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={cn(
                                                        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                                                        shipment.type === 'FCL'
                                                            ? 'bg-blue-500/10 text-blue-400'
                                                            : 'bg-purple-500/10 text-purple-400'
                                                    )}>
                                                        {shipment.type === 'FCL' ? <Ship className="w-3 h-3" /> : <Plane className="w-3 h-3" />}
                                                        {shipment.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-[hsl(var(--foreground))]">
                                                        {shipment.customer_name || 'N/A'}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-[hsl(var(--foreground))]">
                                                        {shipment.origin_country || shipment.origin_port}
                                                    </p>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        → {shipment.destination_country || shipment.destination_port}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {shipment.container_number ? (
                                                        <p className="text-sm text-[hsl(var(--foreground))] font-mono">
                                                            {shipment.container_number}
                                                        </p>
                                                    ) : (
                                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <StatusBadge status={shipment.status} />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-[hsl(var(--foreground))]">
                                                        {shipment.etd ? formatDate(shipment.etd) : '—'}
                                                    </p>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        ETA: {shipment.eta ? formatDate(shipment.eta) : '—'}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <Link to={`/shipments/${shipment.id}`}>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" title="View Details">
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-[hsl(var(--destructive))]"
                                                            title="Delete"
                                                            onClick={async (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (confirm(`Delete shipment ${shipment.shipment_number}?`)) {
                                                                    try {
                                                                        const response = await fetch(`${API_URL}/api/shipments/${shipment.id}`, {
                                                                            method: 'DELETE'
                                                                        });
                                                                        if (response.ok) {
                                                                            toast.success('Shipment deleted successfully');
                                                                            // Real-time sync will auto-update
                                                                        } else {
                                                                            const data = await response.json();
                                                                            toast.error(data.error || 'Failed to delete shipment');
                                                                        }
                                                                    } catch (error) {
                                                                        console.error('Delete failed:', error);
                                                                        toast.error('Failed to delete shipment');
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!loading && filteredShipments.length === 0 && (
                            <div className="text-center py-12">
                                <Ship className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                                <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No shipments found</h3>
                                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                    {searchQuery ? `No results for "${searchQuery}"` : 'Create your first shipment to get started'}
                                </p>
                                {!searchQuery && (
                                    <Button className="mt-4" onClick={() => setShowNewShipmentModal(true)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Shipment
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        Showing {filteredShipments.length} of {shipments.length} shipments
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled>Previous</Button>
                        <Button variant="outline" size="sm">Next</Button>
                    </div>
                </div>
            </div>
        </>
    );
}
