import { useState } from 'react';
import { X, UserCheck, Loader2, User, Mail, Phone, Briefcase } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { fetchApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface NewQCStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const qcRoles = [
    { value: 'QC Inspector', label: 'QC Inspector' },
    { value: 'QC Supervisor', label: 'QC Supervisor' },
    { value: 'QC Manager', label: 'QC Manager' },
    { value: 'QC Lead', label: 'QC Lead' },
];

export function NewQCStaffModal({ isOpen, onClose, onSuccess }: NewQCStaffModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        full_name: '',
        role: 'QC Inspector',
        email: '',
        phone: '',
        department: '',
    });

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.full_name.trim()) {
            setError('Full name is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await fetchApi('/api/qc-staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            toast.success(`QC Staff "${formData.full_name}" added!`);
            onSuccess?.();
            onClose();

            // Reset form
            setFormData({
                full_name: '',
                role: 'QC Inspector',
                email: '',
                phone: '',
                department: '',
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create QC staff');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
                                New QC Staff
                            </h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Add a quality control person
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
                            <User className="w-4 h-4 inline mr-2" />
                            Full Name *
                        </label>
                        <Input
                            value={formData.full_name}
                            onChange={(e) => handleChange('full_name', e.target.value)}
                            placeholder="Nguyen Van A"
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                <Briefcase className="w-4 h-4 inline mr-2" />
                                QC Role
                            </label>
                            <Select
                                options={qcRoles}
                                value={formData.role}
                                onChange={(e) => handleChange('role', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                                <Briefcase className="w-4 h-4 inline mr-2" />
                                Department
                            </label>
                            <Input
                                value={formData.department}
                                onChange={(e) => handleChange('department', e.target.value)}
                                placeholder="Quality Department"
                            />
                        </div>
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
                                placeholder="qc@company.com"
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
                                Adding...
                            </>
                        ) : (
                            <>
                                <UserCheck className="w-4 h-4 mr-2" />
                                Add QC Staff
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
