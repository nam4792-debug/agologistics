import { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import toast from 'react-hot-toast';
import { fetchApi } from '@/lib/api';

interface EditBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    bookingId: string;
    bookingType: 'FCL' | 'AIR';
}

const containerTypes = [
    { value: '20GP', label: "20' GP" },
    { value: '40GP', label: "40' GP" },
    { value: '40HC', label: "40' HC" },
    { value: '40RF', label: "40' RF" },
    { value: '20RF', label: "20' RF" },
];

export function EditBookingModal({ isOpen, onClose, onSuccess, bookingId, bookingType }: EditBookingModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [forwarders, setForwarders] = useState<Array<{ value: string; label: string }>>([]);

    const isAir = bookingType === 'AIR';

    const [formData, setFormData] = useState({
        vessel_flight: '',
        voyage_number: '',
        origin_port: '',
        destination_port: '',
        container_type: '40GP',
        container_count: '1',
        etd: '',
        eta: '',
        cut_off_si: '',
        cut_off_vgm: '',
        cut_off_cy: '',
        freight_rate_usd: '',
        notes: '',
        shipping_line: '',
        forwarder_id: '',
    });

    useEffect(() => {
        if (isOpen && bookingId) {
            fetchBookingData();
            loadForwarders();
        }
    }, [isOpen, bookingId]);

    const loadForwarders = async () => {
        try {
            const data = await fetchApi('/api/bookings/forwarders');
            if (data.forwarders) {
                setForwarders(data.forwarders.map((f: any) => ({
                    value: f.id,
                    label: f.company_name,
                })));
            }
        } catch (e) {
            console.error('Failed to load forwarders:', e);
        }
    };

    const fetchBookingData = async () => {
        setFetching(true);
        try {
            const data = await fetchApi(`/api/bookings/${bookingId}`);
            const b = data.booking;
            if (b) {
                setFormData({
                    vessel_flight: b.vessel_flight || '',
                    voyage_number: b.voyage_number || '',
                    origin_port: b.origin_port || '',
                    destination_port: b.destination_port || '',
                    container_type: b.container_type || '40GP',
                    container_count: String(b.container_count || 1),
                    etd: b.etd ? new Date(b.etd).toISOString().split('T')[0] : '',
                    eta: b.eta ? new Date(b.eta).toISOString().split('T')[0] : '',
                    cut_off_si: b.cut_off_si ? new Date(b.cut_off_si).toISOString().split('T')[0] : '',
                    cut_off_vgm: b.cut_off_vgm ? new Date(b.cut_off_vgm).toISOString().split('T')[0] : '',
                    cut_off_cy: b.cut_off_cy ? new Date(b.cut_off_cy).toISOString().split('T')[0] : '',
                    freight_rate_usd: b.freight_rate_usd ? String(b.freight_rate_usd) : '',
                    notes: b.notes || '',
                    shipping_line: b.shipping_line || '',
                    forwarder_id: b.forwarder_id || '',
                });
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load booking');
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const payload: Record<string, any> = {
                vessel_flight: formData.vessel_flight,
                voyage_number: formData.voyage_number,
                origin_port: formData.origin_port,
                destination_port: formData.destination_port,
                container_type: formData.container_type,
                container_count: parseInt(formData.container_count) || 1,
                etd: formData.etd || null,
                eta: formData.eta || null,
                freight_rate_usd: parseFloat(formData.freight_rate_usd) || 0,
                notes: formData.notes,
                shipping_line: formData.shipping_line,
                forwarder_id: formData.forwarder_id || null,
                // Include deadline fields for backend to update booking_deadlines
                cut_off_si: formData.cut_off_si || null,
                cut_off_vgm: formData.cut_off_vgm || null,
                cut_off_cy: formData.cut_off_cy || null,
            };

            await fetchApi(`/api/bookings/${bookingId}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });

            toast.success('Booking updated successfully!');
            onSuccess?.();
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Failed to update booking');
            toast.error(err?.message || 'Failed to update booking');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[hsl(var(--border))]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--border))] sticky top-0 bg-[hsl(var(--card))] z-10">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAir ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
                            <Save className={`w-5 h-5 ${isAir ? 'text-purple-400' : 'text-blue-400'}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">
                                Edit {isAir ? 'Air' : 'FCL'} Booking
                            </h2>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                Update booking details and cut-off dates
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors">
                        <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                    </button>
                </div>

                {fetching ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Vessel / Flight Info */}
                        <div>
                            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
                                {isAir ? '✈️ Flight Information' : '🚢 Vessel Information'}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                        {isAir ? 'Flight Number' : 'Vessel Name'}
                                    </label>
                                    <Input
                                        placeholder={isAir ? 'e.g., VN123' : 'e.g., OOCL Hamburg'}
                                        value={formData.vessel_flight}
                                        onChange={(e) => handleChange('vessel_flight', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                        {isAir ? 'Airline / Carrier' : 'Voyage Number'}
                                    </label>
                                    <Input
                                        placeholder={isAir ? 'e.g., Vietnam Airlines' : 'e.g., 025E'}
                                        value={isAir ? formData.shipping_line : formData.voyage_number}
                                        onChange={(e) => handleChange(isAir ? 'shipping_line' : 'voyage_number', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Route */}
                        <div>
                            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
                                📍 Route
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                        {isAir ? 'Airport of Loading (AOL)' : 'Port of Loading (POL)'}
                                    </label>
                                    <Input
                                        placeholder={isAir ? 'e.g., SGN' : 'e.g., Ho Chi Minh City'}
                                        value={formData.origin_port}
                                        onChange={(e) => handleChange('origin_port', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                        {isAir ? 'Airport of Discharge (AOD)' : 'Port of Discharge (POD)'}
                                    </label>
                                    <Input
                                        placeholder={isAir ? 'e.g., NRT' : 'e.g., Yokohama'}
                                        value={formData.destination_port}
                                        onChange={(e) => handleChange('destination_port', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Container / Cargo */}
                        <div>
                            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
                                {isAir ? '📦 Cargo Details' : '📦 Container Details'}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {!isAir ? (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Container Type</label>
                                            <Select
                                                options={containerTypes}
                                                value={formData.container_type}
                                                onChange={(e) => handleChange('container_type', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Container Count</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={formData.container_count}
                                                onChange={(e) => handleChange('container_count', e.target.value)}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Pieces</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={formData.container_count}
                                                onChange={(e) => handleChange('container_count', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Shipping Line</label>
                                            <Input
                                                placeholder="e.g., Vietnam Airlines"
                                                value={formData.shipping_line}
                                                onChange={(e) => handleChange('shipping_line', e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Forwarder */}
                        <div>
                            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
                                🏢 Forwarder
                            </h3>
                            <Select
                                options={[{ value: '', label: 'Select Forwarder...' }, ...forwarders]}
                                value={formData.forwarder_id}
                                onChange={(e) => handleChange('forwarder_id', e.target.value)}
                            />
                        </div>

                        {/* Schedule */}
                        <div>
                            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
                                📅 Schedule
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">ETD</label>
                                    <Input
                                        type="date"
                                        value={formData.etd}
                                        onChange={(e) => handleChange('etd', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">ETA</label>
                                    <Input
                                        type="date"
                                        value={formData.eta}
                                        onChange={(e) => handleChange('eta', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Cut-off Dates — CRITICAL SECTION */}
                        <div className="bg-[hsl(var(--secondary))] rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-3">
                                ⏰ Cut-off Dates {isAir ? '(Air)' : '(FCL)'}
                            </h3>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                                Update these when the vessel/flight schedule changes
                            </p>
                            <div className={`grid ${isAir ? 'grid-cols-2' : 'grid-cols-3'} gap-4`}>
                                {!isAir && (
                                    <div>
                                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">SI Cut-off</label>
                                        <Input
                                            type="date"
                                            value={formData.cut_off_si}
                                            onChange={(e) => handleChange('cut_off_si', e.target.value)}
                                        />
                                    </div>
                                )}
                                {!isAir && (
                                    <div>
                                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">VGM Cut-off</label>
                                        <Input
                                            type="date"
                                            value={formData.cut_off_vgm}
                                            onChange={(e) => handleChange('cut_off_vgm', e.target.value)}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                        {isAir ? 'Cargo Acceptance' : 'CY/Cargo Cut-off'}
                                    </label>
                                    <Input
                                        type="date"
                                        value={formData.cut_off_cy}
                                        onChange={(e) => handleChange('cut_off_cy', e.target.value)}
                                    />
                                </div>
                                {isAir && (
                                    <div>
                                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Doc Cut-off</label>
                                        <Input
                                            type="date"
                                            value={formData.cut_off_si}
                                            onChange={(e) => handleChange('cut_off_si', e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Cost */}
                        <div>
                            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
                                💰 Cost
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Freight Rate (USD)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formData.freight_rate_usd}
                                        onChange={(e) => handleChange('freight_rate_usd', e.target.value)}
                                    />
                                </div>
                                {!isAir && (
                                    <div>
                                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Shipping Line</label>
                                        <Input
                                            placeholder="e.g., MSC, Maersk"
                                            value={formData.shipping_line}
                                            onChange={(e) => handleChange('shipping_line', e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Notes</label>
                            <textarea
                                className="w-full p-3 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] min-h-[80px] resize-none"
                                placeholder="Additional notes..."
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                            />
                        </div>

                        {/* Submit */}
                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" className="flex-1" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
