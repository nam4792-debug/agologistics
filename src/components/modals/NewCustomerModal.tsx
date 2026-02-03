import { useState } from 'react';
import { X, Users, Loader2, User, Mail, Phone, Globe } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import toast from 'react-hot-toast';

interface NewCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function NewCustomerModal({ isOpen, onClose, onSuccess }: NewCustomerModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        company_name: '',
        contact_name: '',
        email: '',
        phone: '',
        country: '',
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
            const response = await fetch('http://localhost:3001/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create customer');
            }

            toast.success(`Customer "${formData.company_name}" created!`);
            onSuccess?.();
            onClose();

            // Reset form
            setFormData({
                company_name: '',
                contact_name: '',
                email: '',
                phone: '',
                country: '',
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create customer');
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
                                New Customer
                            </h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Add a new customer
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
                            <Users className="w-4 h-4 inline mr-2" />
                            Company Name *
                        </label>
                        <Input
                            value={formData.company_name}
                            onChange={(e) => handleChange('company_name', e.target.value)}
                            placeholder="XYZ Trading Co., Ltd"
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
                            placeholder="Jane Smith"
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
                                placeholder="contact@customer.com"
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
                            <Globe className="w-4 h-4 inline mr-2" />
                            Country
                        </label>
                        <Input
                            value={formData.country}
                            onChange={(e) => handleChange('country', e.target.value)}
                            placeholder="Vietnam"
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
                                <Users className="w-4 h-4 mr-2" />
                                Create Customer
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
