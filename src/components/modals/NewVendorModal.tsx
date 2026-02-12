import { useState } from 'react';
import { X, Building, Loader2, User, Mail, Phone, MapPin } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import toast from 'react-hot-toast';
import { API_URL } from '@/lib/api';

interface NewVendorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function NewVendorModal({ isOpen, onClose, onSuccess }: NewVendorModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
    });

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.company_name.trim()) {
            setError('Company name is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/providers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create vendor');
            }

            toast.success(`Vendor "${formData.company_name}" created!`);
            onSuccess?.();
            onClose();

            // Reset form
            setFormData({
                company_name: '',
                contact_name: '',
                email: '',
                phone: '',
                address: '',
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create vendor');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                            <Building className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
                                New Vendor
                            </h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Add a new forwarder/vendor
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
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                            <Building className="w-4 h-4 inline mr-2" />
                            Company Name *
                        </label>
                        <Input
                            value={formData.company_name}
                            onChange={(e) => handleChange('company_name', e.target.value)}
                            placeholder="ABC Logistics Co., Ltd"
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                            <User className="w-4 h-4 inline mr-2" />
                            Contact Person
                        </label>
                        <Input
                            value={formData.contact_name}
                            onChange={(e) => handleChange('contact_name', e.target.value)}
                            placeholder="John Doe"
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                <Mail className="w-4 h-4 inline mr-2" />
                                Email
                            </label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                placeholder="contact@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                <Phone className="w-4 h-4 inline mr-2" />
                                Phone
                            </label>
                            <Input
                                value={formData.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                placeholder="+84 123 456 789"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                            <MapPin className="w-4 h-4 inline mr-2" />
                            Address
                        </label>
                        <Input
                            value={formData.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                            placeholder="123 Nguyen Hue, District 1, HCMC"
                            className="w-full"
                        />
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
                                <Building className="w-4 h-4 mr-2" />
                                Create Vendor
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
