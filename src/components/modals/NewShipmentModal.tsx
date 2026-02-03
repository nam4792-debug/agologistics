import { useState, useEffect } from 'react';
import { X, Ship, Plane, Loader2, Package, UserCheck } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';

interface NewShipmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (shipment: Record<string, unknown>) => void;
}

const shipmentTypes = [
    { value: 'FCL', label: 'FCL (Sea Freight)' },
    { value: 'AIR', label: 'Air Freight' },
];

const containerTypes = [
    { value: '20GP', label: "20' General Purpose" },
    { value: '40GP', label: "40' General Purpose" },
    { value: '40HC', label: "40' High Cube" },
    { value: '40RF', label: "40' Reefer" },
    { value: '20RF', label: "20' Reefer" },
];

const incoterms = [
    { value: 'FOB', label: 'FOB - Free On Board' },
    { value: 'CIF', label: 'CIF - Cost, Insurance & Freight' },
    { value: 'CFR', label: 'CFR - Cost & Freight' },
    { value: 'EXW', label: 'EXW - Ex Works' },
    { value: 'DDP', label: 'DDP - Delivered Duty Paid' },
];

// Mock QC persons - would come from API
const qcPersons = [
    { value: '', label: 'Select QC Person' },
    { value: 'qc-001', label: 'Nguyen Van A - QC Manager' },
    { value: 'qc-002', label: 'Tran Thi B - QC Supervisor' },
    { value: 'qc-003', label: 'Le Van C - QC Inspector' },
    { value: 'qc-004', label: 'Pham Thi D - QC Inspector' },
];

interface AvailableBooking {
    id: string;
    booking_number: string;
    type: string;
    route: string;
    etd?: string;
    forwarder_name?: string;
}

export function NewShipmentModal({ isOpen, onClose, onSuccess }: NewShipmentModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customers, setCustomers] = useState<Array<{ value: string; label: string }>>([]);
    const [forwarders, setForwarders] = useState<Array<{ value: string; label: string }>>([]);
    const [availableBookings, setAvailableBookings] = useState<AvailableBooking[]>([]);
    const [loadingBookings, setLoadingBookings] = useState(false);

    const [formData, setFormData] = useState({
        type: 'FCL',
        customerId: '',
        forwarderId: '',
        bookingId: '', // NEW: Linked booking
        qcPersonId: '', // NEW: QC person responsible
        originPort: 'Ho Chi Minh City',
        destinationPort: '',
        originCountry: 'Vietnam',
        destinationCountry: '',
        cargoDescription: '',
        cargoWeightKg: '',
        containerType: '40GP',
        containerCount: '1',
        incoterm: 'FOB',
        etd: '',
        eta: '',
    });

    useEffect(() => {
        if (isOpen) {
            loadCustomers();
            loadForwarders();
            loadAvailableBookings();
        }
    }, [isOpen]);

    // When booking is selected, auto-populate related data
    useEffect(() => {
        if (formData.bookingId) {
            const selectedBooking = availableBookings.find(b => b.id === formData.bookingId);
            if (selectedBooking) {
                // Parse route to get ports
                const routeParts = selectedBooking.route?.split(' - ') || [];
                setFormData(prev => ({
                    ...prev,
                    type: selectedBooking.type || prev.type,
                    originPort: routeParts[0] || prev.originPort,
                    destinationPort: routeParts[1] || prev.destinationPort,
                    etd: selectedBooking.etd?.split('T')[0] || prev.etd,
                }));
            }
        }
    }, [formData.bookingId, availableBookings]);

    const loadCustomers = async () => {
        try {
            setCustomers([
                { value: 'cust-001', label: 'Chennai Fresh Foods' },
                { value: 'cust-002', label: 'Tokyo Fruits Import' },
                { value: 'cust-003', label: 'Dubai Premium Goods' },
                { value: 'cust-004', label: 'Shanghai Agricultural Co.' },
                { value: 'cust-005', label: 'Singapore Fresh Market' },
            ]);
        } catch (e) {
            console.error('Failed to load customers:', e);
        }
    };

    const loadForwarders = async () => {
        try {
            setForwarders([
                { value: 'fwd-001', label: 'ABC Logistics' },
                { value: 'fwd-002', label: 'Global Shipping Co' },
                { value: 'fwd-003', label: 'FastCargo VN' },
            ]);
        } catch (e) {
            console.error('Failed to load forwarders:', e);
        }
    };

    const loadAvailableBookings = async () => {
        setLoadingBookings(true);
        try {
            // Fetch bookings that are not yet linked to any shipment
            const res = await fetch('http://localhost:3001/api/bookings?status=CONFIRMED&unlinked=true');
            const data = await res.json();
            setAvailableBookings(data.bookings || []);
        } catch (e) {
            console.error('Failed to load bookings:', e);
            // Mock data for demo
            setAvailableBookings([
                { id: 'bk-001', booking_number: 'BK-2025-0001', type: 'FCL', route: 'Ho Chi Minh - Chennai', etd: '2025-02-15' },
                { id: 'bk-002', booking_number: 'BK-2025-0002', type: 'FCL', route: 'Cat Lai - Singapore', etd: '2025-02-20' },
                { id: 'bk-003', booking_number: 'BK-2025-0003', type: 'AIR', route: 'SGN - NRT', etd: '2025-02-18' },
            ]);
        } finally {
            setLoadingBookings(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.customerId || !formData.destinationPort || !formData.cargoDescription) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const shipmentNumber = `SHP-${Date.now().toString(36).toUpperCase()}`;

            const payload = {
                shipment_number: shipmentNumber,
                type: formData.type,
                customer_id: formData.customerId,
                forwarder_id: formData.forwarderId || null,
                booking_id: formData.bookingId || null, // Link to booking
                qc_person_id: formData.qcPersonId || null, // QC person
                origin_port: formData.originPort,
                destination_port: formData.destinationPort,
                origin_country: formData.originCountry,
                destination_country: formData.destinationCountry,
                cargo_description: formData.cargoDescription,
                cargo_weight_kg: parseFloat(formData.cargoWeightKg) || 0,
                container_type: formData.type === 'FCL' ? formData.containerType : null,
                container_count: parseInt(formData.containerCount) || 1,
                incoterm: formData.incoterm,
                etd: formData.etd || null,
                eta: formData.eta || null,
            };

            const result = await fetch('http://localhost:3001/api/shipments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }).then(r => r.json());

            if (result.error) {
                throw new Error(result.error);
            }

            onSuccess?.(result.shipment);
            onClose();

            // Reset form
            setFormData({
                type: 'FCL',
                customerId: '',
                forwarderId: '',
                bookingId: '',
                qcPersonId: '',
                originPort: 'Ho Chi Minh City',
                destinationPort: '',
                originCountry: 'Vietnam',
                destinationCountry: '',
                cargoDescription: '',
                cargoWeightKg: '',
                containerType: '40GP',
                containerCount: '1',
                incoterm: 'FOB',
                etd: '',
                eta: '',
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create shipment');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const bookingOptions = [
        { value: '', label: loadingBookings ? 'Loading bookings...' : 'No linked booking (create new)' },
        ...availableBookings.map(b => ({
            value: b.id,
            label: `${b.booking_number} - ${b.type} - ${b.route}`,
        })),
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                            {formData.type === 'FCL' ? (
                                <Ship className="w-5 h-5 text-white" />
                            ) : (
                                <Plane className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">New Shipment</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Create a new export shipment</p>
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
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* NEW: Booking Selection - Prominent Position */}
                        <div className="p-4 bg-[hsl(var(--secondary))] rounded-xl border border-[hsl(var(--border))]">
                            <div className="flex items-center gap-2 mb-3">
                                <Package className="w-5 h-5 text-[hsl(var(--primary))]" />
                                <label className="text-sm font-medium text-[hsl(var(--foreground))]">
                                    Link to Confirmed Booking (Optional)
                                </label>
                            </div>
                            <Select
                                options={bookingOptions}
                                value={formData.bookingId}
                                onChange={(e) => handleChange('bookingId', e.target.value)}
                            />
                            {formData.bookingId && (
                                <p className="mt-2 text-xs text-green-400">
                                    ✓ Route and dates will be auto-filled from selected booking
                                </p>
                            )}
                        </div>

                        {/* Row 1: Type & Customer */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    Shipment Type *
                                </label>
                                <Select
                                    options={shipmentTypes}
                                    value={formData.type}
                                    onChange={(e) => handleChange('type', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    Customer *
                                </label>
                                <Select
                                    options={[{ value: '', label: 'Select Customer' }, ...customers]}
                                    value={formData.customerId}
                                    onChange={(e) => handleChange('customerId', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Row 2: Forwarder & QC Person */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    Forwarder
                                </label>
                                <Select
                                    options={[{ value: '', label: 'Select Forwarder' }, ...forwarders]}
                                    value={formData.forwarderId}
                                    onChange={(e) => handleChange('forwarderId', e.target.value)}
                                />
                            </div>
                            {/* NEW: QC Person Field */}
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    <span className="flex items-center gap-1">
                                        <UserCheck className="w-4 h-4" />
                                        QC Person Responsible
                                    </span>
                                </label>
                                <Select
                                    options={qcPersons}
                                    value={formData.qcPersonId}
                                    onChange={(e) => handleChange('qcPersonId', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Row 3: Incoterm */}
                        <div>
                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                Incoterm
                            </label>
                            <Select
                                options={incoterms}
                                value={formData.incoterm}
                                onChange={(e) => handleChange('incoterm', e.target.value)}
                            />
                        </div>

                        {/* Row 4: Origin & Destination Port */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    Origin Port
                                </label>
                                <Input
                                    value={formData.originPort}
                                    onChange={(e) => handleChange('originPort', e.target.value)}
                                    placeholder="e.g. Ho Chi Minh City"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    Destination Port *
                                </label>
                                <Input
                                    value={formData.destinationPort}
                                    onChange={(e) => handleChange('destinationPort', e.target.value)}
                                    placeholder="e.g. Chennai"
                                />
                            </div>
                        </div>

                        {/* Row 5: Countries */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    Origin Country
                                </label>
                                <Input
                                    value={formData.originCountry}
                                    onChange={(e) => handleChange('originCountry', e.target.value)}
                                    placeholder="Vietnam"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    Destination Country
                                </label>
                                <Input
                                    value={formData.destinationCountry}
                                    onChange={(e) => handleChange('destinationCountry', e.target.value)}
                                    placeholder="e.g. India"
                                />
                            </div>
                        </div>

                        {/* Cargo Description */}
                        <div>
                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                Cargo Description *
                            </label>
                            <Input
                                value={formData.cargoDescription}
                                onChange={(e) => handleChange('cargoDescription', e.target.value)}
                                placeholder="e.g. Fresh Dragon Fruit, Agricultural Products"
                            />
                        </div>

                        {/* Row 6: Weight & Container */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    Weight (kg)
                                </label>
                                <Input
                                    type="number"
                                    value={formData.cargoWeightKg}
                                    onChange={(e) => handleChange('cargoWeightKg', e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            {formData.type === 'FCL' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                            Container Type
                                        </label>
                                        <Select
                                            options={containerTypes}
                                            value={formData.containerType}
                                            onChange={(e) => handleChange('containerType', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                            Container Count
                                        </label>
                                        <Input
                                            type="number"
                                            value={formData.containerCount}
                                            onChange={(e) => handleChange('containerCount', e.target.value)}
                                            min="1"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Row 7: Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    ETD (Estimated Departure)
                                </label>
                                <Input
                                    type="date"
                                    value={formData.etd}
                                    onChange={(e) => handleChange('etd', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                    ETA (Estimated Arrival)
                                </label>
                                <Input
                                    type="date"
                                    value={formData.eta}
                                    onChange={(e) => handleChange('eta', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-[hsl(var(--border))]">
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
                                <Ship className="w-4 h-4 mr-2" />
                                Create Shipment
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
