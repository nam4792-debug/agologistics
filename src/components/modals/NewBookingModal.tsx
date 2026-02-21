import { useState, useEffect } from 'react';
import { X, Anchor, Plane, Loader2, Ship } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import toast from 'react-hot-toast';
import { fetchApi } from '@/lib/api';

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

    const isAir = bookingType === 'AIR';

    const [formData, setFormData] = useState({
        forwarderId: '',
        vesselFlight: '',
        voyageNumber: '',
        originPort: '',
        destinationPort: '',
        // FCL fields
        containerType: '40GP',
        containerCount: '1',
        // Air fields
        airline: '',
        mawbNumber: '',
        pieces: '',
        weight: '',
        cbm: '',
        // Cargo
        cargoDescription: '',
        // Schedule
        etd: '',
        eta: '',
        // Deadlines — FCL: SI/VGM/CY | Air: Cargo Acceptance / Doc
        cutOffSI: '',
        cutOffVGM: '',
        cutOffCY: '',
        cutOffCargoAcceptance: '',
        cutOffDoc: '',
        // Cost
        freightRate: '',
        notes: '',
        shippingLine: '',
    });

    useEffect(() => {
        if (isOpen) {
            loadForwarders();
        }
    }, [isOpen]);

    const loadForwarders = async () => {
        try {
            const data = await fetchApi('/api/bookings/forwarders');
            if (data.forwarders) {
                setForwarders(data.forwarders.map((f: { id: string; company_name: string }) => ({
                    value: f.id,
                    label: f.company_name
                })));
            }
        } catch (e) {
            setForwarders([]);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!formData.originPort || !formData.destinationPort || !formData.etd) {
            setError(`Please fill in: ${isAir ? 'Airport of Loading' : 'Origin Port'}, ${isAir ? 'Airport of Discharge' : 'Destination Port'}, and ETD`);
            return;
        }

        // Additional validation per type
        if (!isAir && !formData.cutOffCY) {
            setError('Please fill in CY Cut-off date');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const bookingNumber = `BK-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

            const payload: Record<string, unknown> = {
                booking_number: bookingNumber,
                forwarder_id: formData.forwarderId || null,
                type: bookingType,
                route: `${formData.originPort} → ${formData.destinationPort}`,
                origin_port: formData.originPort,
                destination_port: formData.destinationPort,
                etd: formData.etd,
                eta: formData.eta || null,
                freight_rate_usd: parseFloat(formData.freightRate) || 0,
                cargo_description: formData.cargoDescription || null,
                notes: formData.notes || null,
            };

            if (isAir) {
                // Air-specific fields
                payload.vessel_flight = formData.vesselFlight; // Flight number
                payload.voyage_number = formData.voyageNumber || null;
                payload.shipping_line = formData.airline || null; // Store airline in shipping_line column
                payload.container_type = null;
                payload.container_count = parseInt(formData.pieces) || 1;
                // Store Air cut-offs: cargo acceptance → cut_off_cy, doc → cut_off_si
                payload.cut_off_cy = formData.cutOffCargoAcceptance || null;
                payload.cut_off_si = formData.cutOffDoc || null;
                payload.cut_off_vgm = null;
                // Store weight/cbm/mawb in notes for now
                const airMeta: string[] = [];
                if (formData.mawbNumber) airMeta.push(`MAWB: ${formData.mawbNumber}`);
                if (formData.weight) airMeta.push(`Weight: ${formData.weight}kg`);
                if (formData.cbm) airMeta.push(`Volume: ${formData.cbm}cbm`);
                if (airMeta.length > 0) {
                    payload.notes = [airMeta.join(' | '), formData.notes].filter(Boolean).join('\n');
                }
            } else {
                // FCL-specific fields
                payload.vessel_flight = formData.vesselFlight;
                payload.voyage_number = formData.voyageNumber;
                payload.shipping_line = formData.shippingLine || null;
                payload.container_type = formData.containerType;
                payload.container_count = parseInt(formData.containerCount) || 1;
                payload.cut_off_si = formData.cutOffSI || null;
                payload.cut_off_vgm = formData.cutOffVGM || null;
                payload.cut_off_cy = formData.cutOffCY;
            }

            const result = await fetchApi('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

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
                airline: '',
                mawbNumber: '',
                pieces: '',
                weight: '',
                cbm: '',
                cargoDescription: '',
                etd: '',
                eta: '',
                cutOffSI: '',
                cutOffVGM: '',
                cutOffCY: '',
                cutOffCargoAcceptance: '',
                cutOffDoc: '',
                freightRate: '',
                notes: '',
                shippingLine: '',
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

            {/* Modal */}
            <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAir ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'gradient-primary'}`}>
                            {isAir ? (
                                <Plane className="w-5 h-5 text-white" />
                            ) : (
                                <Anchor className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
                                New {bookingType} Booking
                            </h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                {isAir ? 'Create a new air freight booking' : 'Create a new container booking'}
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="bg-[hsl(var(--secondary))]/50 rounded-xl p-4 border border-[hsl(var(--border))]">

                        {/* Row 1: Carrier/Vessel + Route + Forwarder */}
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    {isAir ? 'Flight Number' : 'Vessel Name'}
                                </label>
                                <Input
                                    value={formData.vesselFlight}
                                    onChange={(e) => handleChange('vesselFlight', e.target.value)}
                                    placeholder={isAir ? 'VN1234 / CX892' : 'EVER GIVEN'}
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    {isAir ? 'Route Code' : 'Voyage Number'}
                                </label>
                                <Input
                                    value={formData.voyageNumber}
                                    onChange={(e) => handleChange('voyageNumber', e.target.value)}
                                    placeholder={isAir ? 'SGN-NRT' : 'V.2609E'}
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    {isAir ? 'Airline / Carrier' : 'Shipping Line'}
                                </label>
                                {isAir ? (
                                    <Input
                                        value={formData.airline}
                                        onChange={(e) => handleChange('airline', e.target.value)}
                                        placeholder="Vietnam Airlines, Cathay..."
                                        className="h-9"
                                    />
                                ) : (
                                    <Input
                                        value={formData.shippingLine}
                                        onChange={(e) => handleChange('shippingLine', e.target.value)}
                                        placeholder="Evergreen, MSC, Maersk..."
                                        className="h-9"
                                    />
                                )}
                            </div>
                            <div>
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

                        {/* Row 2: Origin & Destination — POL/POD for FCL, AOL/AOD for Air */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    {isAir ? 'Airport of Loading (AOL) *' : 'Port of Loading (POL) *'}
                                </label>
                                <Input
                                    value={formData.originPort}
                                    onChange={(e) => handleChange('originPort', e.target.value)}
                                    placeholder={isAir ? 'SGN — Tan Son Nhat, HAN — Noi Bai...' : 'VNCLI — Cat Lai, VNHPH — Hai Phong...'}
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                    {isAir ? 'Airport of Discharge (AOD) *' : 'Port of Discharge (POD) *'}
                                </label>
                                <Input
                                    value={formData.destinationPort}
                                    onChange={(e) => handleChange('destinationPort', e.target.value)}
                                    placeholder={isAir ? 'NRT — Narita, SIN — Changi...' : 'INMAA — Chennai, JPTYO — Tokyo...'}
                                    className="h-9"
                                />
                            </div>
                        </div>

                        {/* Row 3: FCL → Container | Air → Pieces/Weight/CBM/MAWB */}
                        {isAir ? (
                            <div className="grid grid-cols-4 gap-3 mb-4">
                                <div>
                                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                        MAWB Number
                                    </label>
                                    <Input
                                        value={formData.mawbNumber}
                                        onChange={(e) => handleChange('mawbNumber', e.target.value)}
                                        placeholder="180-12345678"
                                        className="h-9"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                        Pieces (pcs)
                                    </label>
                                    <Input
                                        type="number"
                                        value={formData.pieces}
                                        onChange={(e) => handleChange('pieces', e.target.value)}
                                        placeholder="100"
                                        min="1"
                                        className="h-9"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                        Gross Weight (kg)
                                    </label>
                                    <Input
                                        type="number"
                                        value={formData.weight}
                                        onChange={(e) => handleChange('weight', e.target.value)}
                                        placeholder="500"
                                        className="h-9"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                        Volume (CBM)
                                    </label>
                                    <Input
                                        type="number"
                                        value={formData.cbm}
                                        onChange={(e) => handleChange('cbm', e.target.value)}
                                        placeholder="2.5"
                                        step="0.1"
                                        className="h-9"
                                    />
                                </div>
                            </div>
                        ) : (
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
                        <div className="grid grid-cols-3 gap-3 mb-4">
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
                                    placeholder={isAir ? 'per kg' : 'per container'}
                                    className="h-9"
                                />
                            </div>
                        </div>

                        {/* Row 5: Deadlines — different for FCL vs Air */}
                        {isAir ? (
                            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 mb-4">
                                <p className="text-xs font-semibold text-purple-400 mb-2">✈️ AIR FREIGHT CUT-OFFS</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                            Cargo Acceptance Cut-off
                                        </label>
                                        <Input
                                            type="datetime-local"
                                            value={formData.cutOffCargoAcceptance}
                                            onChange={(e) => handleChange('cutOffCargoAcceptance', e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                                            Document Cut-off
                                        </label>
                                        <Input
                                            type="datetime-local"
                                            value={formData.cutOffDoc}
                                            onChange={(e) => handleChange('cutOffDoc', e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
                                <p className="text-xs font-semibold text-yellow-400 mb-2">⚠️ OCEAN CUT-OFF DEADLINES</p>
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
                        )}

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
                                {isAir ? <Plane className="w-4 h-4 mr-2" /> : <Ship className="w-4 h-4 mr-2" />}
                                Create Booking
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
