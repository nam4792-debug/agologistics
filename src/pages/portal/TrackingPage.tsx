import { useState } from 'react';
import {
    Search,
    MapPin,
    Calendar,
    Package,
    Ship,
    CheckCircle,
    Clock,
    Loader2,
    ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrackingResult {
    shipment: {
        shipmentNumber: string;
        type: string;
        status: string;
        origin: string;
        destination: string;
        etd: string;
        eta: string;
        atd: string | null;
        ata: string | null;
        cargoDescription: string;
        customer: string;
    };
    timeline: Array<{
        status: string;
        label: string;
        completed: boolean;
        current: boolean;
    }>;
}

export function TrackingPage() {
    const [trackingNumber, setTrackingNumber] = useState('');
    const [result, setResult] = useState<TrackingResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleTrack = async () => {
        if (!trackingNumber.trim()) return;
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const res = await fetch(`${apiUrl}/api/portal/track/${trackingNumber.trim()}`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Shipment not found');
            }
            const data = await res.json();
            setResult(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to track shipment');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (d: string | null) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
            {/* Header */}
            <div className="px-6 py-8 text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <Ship className="w-8 h-8 text-blue-400" />
                    <h1 className="text-3xl font-bold text-white">Shipment Tracking</h1>
                </div>
                <p className="text-blue-300/70">Track your shipment status in real-time</p>
            </div>

            {/* Search Box */}
            <div className="max-w-2xl mx-auto px-6">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                            placeholder="Enter shipment number (e.g. SH-2026-ABCD)"
                            className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur border border-white/20 rounded-xl text-white placeholder-slate-400 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <button
                        onClick={handleTrack}
                        disabled={loading || !trackingNumber.trim()}
                        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>Track <ArrowRight className="w-5 h-5" /></>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-center">
                        {error}
                    </div>
                )}
            </div>

            {/* Results */}
            {result && (
                <div className="max-w-4xl mx-auto px-6 mt-10 pb-20 space-y-6">
                    {/* Shipment Info Card */}
                    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm text-blue-300/70">Shipment Number</p>
                                <h2 className="text-2xl font-bold text-white">{result.shipment.shipmentNumber}</h2>
                            </div>
                            <span className={cn(
                                'px-4 py-2 rounded-full text-sm font-semibold',
                                {
                                    'bg-green-500/20 text-green-300': result.shipment.status === 'COMPLETED' || result.shipment.status === 'DELIVERED',
                                    'bg-blue-500/20 text-blue-300': result.shipment.status === 'IN_TRANSIT',
                                    'bg-yellow-500/20 text-yellow-300': result.shipment.status === 'DRAFT' || result.shipment.status === 'BOOKED',
                                    'bg-purple-500/20 text-purple-300': result.shipment.status === 'CUSTOMS' || result.shipment.status === 'ARRIVED',
                                }
                            )}>
                                {result.shipment.status.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="flex items-center gap-3">
                                <MapPin className="w-5 h-5 text-blue-400" />
                                <div>
                                    <p className="text-xs text-blue-300/50">Origin</p>
                                    <p className="text-white font-medium">{result.shipment.origin || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="w-5 h-5 text-green-400" />
                                <div>
                                    <p className="text-xs text-blue-300/50">Destination</p>
                                    <p className="text-white font-medium">{result.shipment.destination}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-yellow-400" />
                                <div>
                                    <p className="text-xs text-blue-300/50">ETD / ATD</p>
                                    <p className="text-white font-medium">{formatDate(result.shipment.atd || result.shipment.etd)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-purple-400" />
                                <div>
                                    <p className="text-xs text-blue-300/50">ETA / ATA</p>
                                    <p className="text-white font-medium">{formatDate(result.shipment.ata || result.shipment.eta)}</p>
                                </div>
                            </div>
                        </div>

                        {result.shipment.cargoDescription && (
                            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
                                <Package className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-xs text-blue-300/50">Cargo</p>
                                    <p className="text-white">{result.shipment.cargoDescription}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status Timeline */}
                    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-6">Shipment Progress</h3>
                        <div className="flex items-center justify-between relative">
                            {/* Progress line */}
                            <div className="absolute top-5 left-0 right-0 h-0.5 bg-white/10" />
                            <div
                                className="absolute top-5 left-0 h-0.5 bg-blue-500 transition-all"
                                style={{
                                    width: `${((result.timeline.filter(t => t.completed).length - 1) / Math.max(result.timeline.length - 1, 1)) * 100}%`
                                }}
                            />

                            {result.timeline.map((step, i) => (
                                <div key={i} className="relative flex flex-col items-center z-10" style={{ width: `${100 / result.timeline.length}%` }}>
                                    <div className={cn(
                                        'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                                        step.current
                                            ? 'bg-blue-500 ring-4 ring-blue-500/30'
                                            : step.completed
                                                ? 'bg-green-500'
                                                : 'bg-slate-700'
                                    )}>
                                        {step.completed && !step.current ? (
                                            <CheckCircle className="w-5 h-5 text-white" />
                                        ) : step.current ? (
                                            <Clock className="w-5 h-5 text-white animate-pulse" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                                        )}
                                    </div>
                                    <p className={cn(
                                        'text-xs mt-2 text-center',
                                        step.current ? 'text-blue-300 font-semibold' : step.completed ? 'text-green-300' : 'text-slate-500'
                                    )}>
                                        {step.label}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
