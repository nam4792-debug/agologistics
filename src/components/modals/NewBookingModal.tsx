import { useState, useEffect } from 'react';
import { X, Anchor, Plane, Loader2, Ship } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import toast from 'react-hot-toast';
import { API_URL } from '@/lib/api';

interface NewBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (booking: Record<string, unknown>) => void;
    bookingType: 'FCL' | 'AIR';
}

const containerTypes = [
    { value: '20GP', label: "20' GP" },
    { value: '40GP', label: "40' GP" },
    { value: '40HC', label: "40' HC" },
    { value: '40RF', label: "40' RF" },
    { value: '20RF', label: "20' RF" },
];

export function NewBookingModal({ isOpen, onClose, onSuccess, bookingType }: NewBookingModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [forwarders, setForwarders] = useState<Array<{ value: string; label: string }>>([]);

    const [formData, setFormData] = useState({
        forwarderId: '',
        vesselFlight: '',
        voyageNumber: '',
        // POL/POD as free text
        originPort: '',
        destinationPort: '',
        // Container
        containerType: '40GP',
        containerCount: '1',
        // Cargo
        cargoDescription: '',
        weight: '',
        // Schedule
        etd: '',
        eta: '',
        // Deadlines
        cutOffSI: '',
        cutOffVGM: '',
        cutOffCY: '',
        // Cost
        freightRate: '',
        notes: '',
    });

    useEffect(() => {
        if (isOpen) {
            loadForwarders();
        }
    }, [isOpen]);

    const loadForwarders = async () => {
        try {
            const response = await fetch(`${API_URL}/api/bookings/forwarders`);
            const data = await response.json();
            if (data.forwarders) {
                setForwarders(data.forwarders.map((f: { id: string; company_name: string }) => ({
                    value: f.id,
                    label: f.company_name
                })));
            }
        } catch (e) {
            setForwarders([
                { value: 'fwd-001', label: 'ABC Logistics' },
                { value: 'fwd-002', label: 'Global Shipping Co' },
            ]);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!formData.originPort || !formData.destinationPort || !formData.etd || !formData.cutOffCY) {
            setError('Please fill in: Origin Port, Destination Port, ETD, and CY Cut-off');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const bookingNumber = `BK-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

            const payload = {
                booking_number: bookingNumber,
                forwarder_id: formData.forwarderId || null,
                type: bookingType,
                vessel_flight: formData.vesselFlight,
                voyage_number: formData.voyageNumber,
                route: `${formData.originPort} → ${formData.destinationPort}`,
                origin_port: formData.originPort,
                destination_port: formData.destinationPort,
                container_type: bookingType === 'FCL' ? formData.containerType : null,
                container_count: parseInt(formData.containerCount) || 1,
                cargo_description: formData.cargoDescription,
                etd: formData.etd,
                eta: formData.eta || null,
                freight_rate_usd: parseFloat(formData.freightRate) || 0,
                notes: formData.notes || null,
                cut_off_si: formData.cutOffSI || null,
                cut_off_vgm: formData.cutOffVGM || null,
                cut_off_cy: formData.cutOffCY,
            };

            const response = await fetch(`${API_URL}/api/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            toast.success(`Booking ${bookingNumber} created!`);
            onSuccess?.(result.booking);
            onClose();

            // Reset form
            setFormData({
                forwarderId: '',
                vesselFlight: '',
                voyageNumber: '',
                originPort: '',
                destinationPort: '',
                containerType: '40GP',
                containerCount: '1',
                cargoDescription: '',
                weight: '',
                etd: '',
                eta: '',
                cutOffSI: '',
                cutOffVGM: '',
                cutOffCY: '',
                freightRate: '',
                notes: '',
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create booking');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal - Wide for table layout */}
            <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bookingType === 'FCL' ? 'gradient-primary' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
                            {bookingType === 'FCL' ? (
                                <Anchor className="w-5 h-5 text-white" />
                            ) : (
                                <Plane className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
                                New {bookingType} Booking
                            </h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                All fields in table layout
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                    </button>
                </div>

                {/* Form - Table Layout */}
                <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Table-like Grid Layout */}
                    <div className="bg-[hsl(var(--secondary))]/50 rounded-xl p-4 border border-[hsl(var(--border))]">

                        {/* Row 1: Vessel/Flight & Voyage & Forwarder */}
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    {bookingType === 'FCL' ? 'Vessel Name' : 'Flight'}
                                </label>
                                <Input
                                    value={formData.vesselFlight}
                                    onChange={(e) => handleChange('vesselFlight', e.target.value)}
                                    placeholder={bookingType === 'FCL' ? 'EVER GIVEN' : 'VN1234'}
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    Voyage/Route
                                </label>
                                <Input
                                    value={formData.voyageNumber}
                                    onChange={(e) => handleChange('voyageNumber', e.target.value)}
                                    placeholder="V.2609E"
                                    className="h-9"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    Forwarder
                                </label>
                                <Select
                                    options={[{ value: '', label: 'Select Forwarder' }, ...forwarders]}
                                    value={formData.forwarderId}
                                    onChange={(e) => handleChange('forwarderId', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Row 2: POL & POD - FREE TEXT */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    Origin Port (POL) *
                                </label>
                                <Input
                                    value={formData.originPort}
                                    onChange={(e) => handleChange('originPort', e.target.value)}
                                    placeholder="Ho Chi Minh City, Cat Lai, Hai Phong..."
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    Destination Port (POD) *
                                </label>
                                <Input
                                    value={formData.destinationPort}
                                    onChange={(e) => handleChange('destinationPort', e.target.value)}
                                    placeholder="Chennai, Tokyo, Singapore..."
                                    className="h-9"
                                />
                            </div>
                        </div>

                        {/* Row 3: Container & Cargo (FCL only) */}
                        {bookingType === 'FCL' && (
                            <div className="grid grid-cols-4 gap-3 mb-4">
                                <div>
                                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                        Container Type
                                    </label>
                                    <Select
                                        options={containerTypes}
                                        value={formData.containerType}
                                        onChange={(e) => handleChange('containerType', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                        Quantity
                                    </label>
                                    <Input
                                        type="number"
                                        value={formData.containerCount}
                                        onChange={(e) => handleChange('containerCount', e.target.value)}
                                        min="1"
                                        className="h-9"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                        Cargo Description
                                    </label>
                                    <Input
                                        value={formData.cargoDescription}
                                        onChange={(e) => handleChange('cargoDescription', e.target.value)}
                                        placeholder="Fresh Dragon Fruit, Textile, etc."
                                        className="h-9"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Row 4: Schedule */}
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    ETD *
                                </label>
                                <Input
                                    type="date"
                                    value={formData.etd}
                                    onChange={(e) => handleChange('etd', e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    ETA
                                </label>
                                <Input
                                    type="date"
                                    value={formData.eta}
                                    onChange={(e) => handleChange('eta', e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    Freight Rate (USD)
                                </label>
                                <Input
                                    type="number"
                                    value={formData.freightRate}
                                    onChange={(e) => handleChange('freightRate', e.target.value)}
                                    placeholder="0"
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    Weight (kg)
                                </label>
                                <Input
                                    type="number"
                                    value={formData.weight}
                                    onChange={(e) => handleChange('weight', e.target.value)}
                                    placeholder="0"
                                    className="h-9"
                                />
                            </div>
                        </div>

                        {/* Row 5: Deadlines - IMPORTANT */}
                        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
                            <p className="text-xs font-semibold text-yellow-400 mb-2">⚠️ CUT-OFF DEADLINES</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                        SI Cut-off
                                    </label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.cutOffSI}
                                        onChange={(e) => handleChange('cutOffSI', e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                        VGM Cut-off
                                    </label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.cutOffVGM}
                                        onChange={(e) => handleChange('cutOffVGM', e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                        CY Cut-off (Cargo) *
                                    </label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.cutOffCY}
                                        onChange={(e) => handleChange('cutOffCY', e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Row 6: Notes */}
                        <div>
                            <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                Notes
                            </label>
                            <textarea
                                className="w-full px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] text-sm"
                                rows={2}
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                placeholder="Additional notes..."
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t border-[hsl(var(--border))]">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                {bookingType === 'FCL' ? <Ship className="w-4 h-4 mr-2" /> : <Plane className="w-4 h-4 mr-2" />}
                                Create Booking
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
