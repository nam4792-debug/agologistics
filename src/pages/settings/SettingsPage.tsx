import { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon,
    User,
    Bell,
    Shield,
    Globe,
    Palette,
    Cloud,
    Key,
    Mail,
    Save,
    ChevronRight,
    Brain,
    Users,
    Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AISettingsPanel } from '@/components/settings';
import { IntegrationsPanel } from '@/components/settings/IntegrationsPanel';
import { NewCustomerModal } from '@/components/modals';

const settingsSections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'ai', label: 'AI Configuration', icon: Brain },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'localization', label: 'Localization', icon: Globe },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'integrations', label: 'Integrations', icon: Cloud },
    { id: 'api', label: 'API Keys', icon: Key },
];

export function SettingsPage() {
    const [activeSection, setActiveSection] = useState('profile');
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [customers, setCustomers] = useState<Array<{ id: string; code: string; name: string; contact: string; email: string; phone: string; country: string }>>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    const fetchCustomers = async () => {
        setLoadingCustomers(true);
        try {
            const res = await fetch('http://localhost:3001/api/customers');
            const data = await res.json();
            if (data.success) {
                setCustomers(data.customers || []);
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setLoadingCustomers(false);
        }
    };

    // Handle URL params for tab selection (e.g., from OAuth callback)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && settingsSections.find(s => s.id === tab)) {
            setActiveSection(tab);
        }
    }, []);

    // Load customers when customers tab is selected
    useEffect(() => {
        if (activeSection === 'customers') {
            fetchCustomers();
        }
    }, [activeSection]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] flex items-center gap-3">
                    <SettingsIcon className="w-8 h-8" />
                    Settings
                </h1>
                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                    Manage your account and application preferences
                </p>
            </div>

            <div className="flex gap-6">
                {/* Sidebar Navigation */}
                <div className="w-64 flex-shrink-0">
                    <Card>
                        <CardContent className="p-2">
                            {settingsSections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={cn(
                                        'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left',
                                        activeSection === section.id
                                            ? 'bg-[hsl(var(--primary))] text-white'
                                            : 'hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                                    )}
                                >
                                    <section.icon className="w-5 h-5" />
                                    <span className="flex-1">{section.label}</span>
                                    {activeSection === section.id && (
                                        <ChevronRight className="w-4 h-4" />
                                    )}
                                </button>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Content Area */}
                <div className="flex-1">
                    {activeSection === 'profile' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Profile Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-2xl font-bold text-white">
                                        NM
                                    </div>
                                    <div>
                                        <Button variant="outline">Change Avatar</Button>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                                            JPG, PNG max 2MB
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="First Name" defaultValue="Nguyen" />
                                    <Input label="Last Name" defaultValue="Manager" />
                                    <Input label="Email" type="email" defaultValue="nguyen@rosette.vn" icon={<Mail className="w-4 h-4" />} />
                                    <Input label="Phone" type="tel" defaultValue="+84 28 1234 5678" />
                                    <div className="col-span-2">
                                        <Input label="Company" defaultValue="Rosette Exports Co., Ltd." />
                                    </div>
                                    <Select
                                        label="Role"
                                        options={[
                                            { value: 'admin', label: 'Administrator' },
                                            { value: 'manager', label: 'Export Manager' },
                                            { value: 'staff', label: 'Staff' },
                                        ]}
                                        value="manager"
                                    />
                                    <Select
                                        label="Department"
                                        options={[
                                            { value: 'export', label: 'Export' },
                                            { value: 'logistics', label: 'Logistics' },
                                            { value: 'finance', label: 'Finance' },
                                        ]}
                                        value="export"
                                    />
                                </div>

                                <div className="flex justify-end pt-4 border-t border-[hsl(var(--border))]">
                                    <Button>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Changes
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeSection === 'customers' && (
                        <>
                            <NewCustomerModal
                                isOpen={showCustomerModal}
                                onClose={() => setShowCustomerModal(false)}
                                onSuccess={fetchCustomers}
                            />
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Customer Management</CardTitle>
                                    <Button onClick={() => { fetchCustomers(); setShowCustomerModal(true); }}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        New Customer
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {loadingCustomers ? (
                                        <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                                            Loading customers...
                                        </div>
                                    ) : customers.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Users className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                                            <p className="text-[hsl(var(--muted-foreground))]">No customers yet</p>
                                            <Button className="mt-4" onClick={() => setShowCustomerModal(true)}>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Add First Customer
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {customers.map((customer) => (
                                                <div
                                                    key={customer.id}
                                                    className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/80 transition-colors"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                                                            {customer.name?.charAt(0) || 'C'}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-[hsl(var(--foreground))]">{customer.name}</p>
                                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                                {customer.code} • {customer.country || 'No country'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm text-[hsl(var(--foreground))]">{customer.contact || '-'}</p>
                                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{customer.email || '-'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {activeSection === 'notifications' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Notification Preferences</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {[
                                    { title: 'Email Notifications', desc: 'Receive updates via email', enabled: true },
                                    { title: 'Push Notifications', desc: 'Browser push notifications', enabled: true },
                                    { title: 'Shipment Updates', desc: 'Status changes and delays', enabled: true },
                                    { title: 'Document Alerts', desc: 'Missing or expiring documents', enabled: true },
                                    { title: 'Cut-off Reminders', desc: '48h and 24h before cut-off', enabled: true },
                                    { title: 'Risk Alerts', desc: 'High and critical risk notifications', enabled: true },
                                    { title: 'Invoice Updates', desc: 'New invoices and discrepancies', enabled: false },
                                    { title: 'Weekly Summary', desc: 'Weekly performance digest', enabled: true },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))]">
                                        <div>
                                            <p className="font-medium text-[hsl(var(--foreground))]">{item.title}</p>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{item.desc}</p>
                                        </div>
                                        <button
                                            className={cn(
                                                'w-12 h-6 rounded-full transition-colors relative',
                                                item.enabled ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                                                    item.enabled ? 'left-7' : 'left-1'
                                                )}
                                            />
                                        </button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {activeSection === 'ai' && (
                        <AISettingsPanel />
                    )}

                    {activeSection === 'localization' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Localization Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label="Language"
                                        options={[
                                            { value: 'en', label: '🇺🇸 English' },
                                            { value: 'vi', label: '🇻🇳 Tiếng Việt' },
                                        ]}
                                        value="en"
                                    />
                                    <Select
                                        label="Timezone"
                                        options={[
                                            { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho Chi Minh (GMT+7)' },
                                            { value: 'Asia/Singapore', label: 'Asia/Singapore (GMT+8)' },
                                            { value: 'UTC', label: 'UTC (GMT+0)' },
                                        ]}
                                        value="Asia/Ho_Chi_Minh"
                                    />
                                    <Select
                                        label="Date Format"
                                        options={[
                                            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                                            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                                            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                                        ]}
                                        value="DD/MM/YYYY"
                                    />
                                    <Select
                                        label="Currency"
                                        options={[
                                            { value: 'USD', label: '$ USD' },
                                            { value: 'VND', label: '₫ VND' },
                                            { value: 'EUR', label: '€ EUR' },
                                        ]}
                                        value="USD"
                                    />
                                </div>

                                <div className="flex justify-end pt-4 border-t border-[hsl(var(--border))]">
                                    <Button>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Changes
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeSection === 'appearance' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Appearance Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-3">Theme</label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {[
                                            { id: 'dark', label: 'Dark', icon: '🌙' },
                                            { id: 'light', label: 'Light', icon: '☀️' },
                                            { id: 'system', label: 'System', icon: '💻' },
                                        ].map((theme) => (
                                            <button
                                                key={theme.id}
                                                className={cn(
                                                    "p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors",
                                                    theme.id === 'dark'
                                                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                                                        : "border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]"
                                                )}
                                            >
                                                <span className="text-2xl">{theme.icon}</span>
                                                <span className="text-sm font-medium">{theme.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-3">Accent Color</label>
                                    <div className="flex gap-3">
                                        {['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'].map((color) => (
                                            <button
                                                key={color}
                                                className={cn(
                                                    "w-10 h-10 rounded-full border-2",
                                                    color === '#3b82f6' ? "border-white ring-2 ring-[hsl(var(--primary))]" : "border-transparent"
                                                )}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label="Font Size"
                                        options={[
                                            { value: 'small', label: 'Small' },
                                            { value: 'medium', label: 'Medium (Default)' },
                                            { value: 'large', label: 'Large' },
                                        ]}
                                        value="medium"
                                    />
                                    <Select
                                        label="Density"
                                        options={[
                                            { value: 'comfortable', label: 'Comfortable' },
                                            { value: 'compact', label: 'Compact' },
                                        ]}
                                        value="comfortable"
                                    />
                                </div>

                                <div className="flex justify-end pt-4 border-t border-[hsl(var(--border))]">
                                    <Button>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Changes
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeSection === 'integrations' && (
                        <IntegrationsPanel />
                    )}

                    {activeSection === 'api' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>API Keys</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="p-4 rounded-lg bg-[hsl(var(--secondary))]">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-[hsl(var(--foreground))]">Production API Key</p>
                                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Active</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 p-2 bg-[hsl(var(--background))] rounded font-mono text-sm">
                                            ros_prod_****************************abcd
                                        </code>
                                        <Button variant="outline" size="sm">Copy</Button>
                                        <Button variant="outline" size="sm">Regenerate</Button>
                                    </div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                                        Last used: Today at 14:32 • Rate limit: 1000 req/min
                                    </p>
                                </div>

                                <div className="p-4 rounded-lg bg-[hsl(var(--secondary))]">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-medium text-[hsl(var(--foreground))]">Test API Key</p>
                                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Test Mode</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 p-2 bg-[hsl(var(--background))] rounded font-mono text-sm">
                                            ros_test_****************************efgh
                                        </code>
                                        <Button variant="outline" size="sm">Copy</Button>
                                        <Button variant="outline" size="sm">Regenerate</Button>
                                    </div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                                        Last used: Yesterday • Rate limit: 100 req/min
                                    </p>
                                </div>

                                <div>
                                    <h4 className="font-medium text-[hsl(var(--foreground))] mb-3">API Usage This Month</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-3 rounded-lg bg-[hsl(var(--secondary))] text-center">
                                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">12,456</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Requests</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-[hsl(var(--secondary))] text-center">
                                            <p className="text-2xl font-bold text-green-400">99.8%</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Success Rate</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-[hsl(var(--secondary))] text-center">
                                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">45ms</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Avg Latency</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeSection === 'security' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Security Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    {[
                                        { title: 'Two-Factor Authentication', desc: 'Add an extra layer of security', enabled: true },
                                        { title: 'Session Timeout', desc: 'Auto-logout after 30 minutes of inactivity', enabled: true },
                                        { title: 'Login Notifications', desc: 'Get notified of new device logins', enabled: true },
                                        { title: 'IP Whitelist', desc: 'Restrict access to specific IPs', enabled: false },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))]">
                                            <div>
                                                <p className="font-medium text-[hsl(var(--foreground))]">{item.title}</p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">{item.desc}</p>
                                            </div>
                                            <button
                                                className={cn(
                                                    'w-12 h-6 rounded-full transition-colors relative',
                                                    item.enabled ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                                                        item.enabled ? 'left-7' : 'left-1'
                                                    )}
                                                />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-4 border-t border-[hsl(var(--border))]">
                                    <h4 className="font-medium text-[hsl(var(--foreground))] mb-3">Change Password</h4>
                                    <div className="grid grid-cols-1 gap-4 max-w-md">
                                        <Input label="Current Password" type="password" />
                                        <Input label="New Password" type="password" />
                                        <Input label="Confirm New Password" type="password" />
                                    </div>
                                    <Button className="mt-4">Update Password</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
