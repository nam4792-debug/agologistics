import { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon,
    User,
    Bell,
    Shield,
    Globe,
    Palette,
    Cloud,
    Mail,
    Save,
    ChevronRight,
    Brain,
    Info,
    Database,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AISettingsPanel } from '@/components/settings';
import { IntegrationsPanel } from '@/components/settings/IntegrationsPanel';
import { BackupSettingsPanel } from '@/components/settings/BackupSettingsPanel';
import toast from 'react-hot-toast';

const settingsSections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'ai', label: 'AI Configuration', icon: Brain },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'localization', label: 'Localization', icon: Globe },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'integrations', label: 'Integrations', icon: Cloud },
    { id: 'backup', label: 'Backup', icon: Database },
];

export function SettingsPage() {
    const [activeSection, setActiveSection] = useState('profile');
    const [selectedTheme, setSelectedTheme] = useState(() => localStorage.getItem('app-theme') || 'light');
    const [selectedColor, setSelectedColor] = useState(() => localStorage.getItem('app-accent-color') || '#3B7A3B');
    const [fontSize, setFontSize] = useState(() => localStorage.getItem('app-font-size') || 'medium');
    const [density, setDensity] = useState(() => localStorage.getItem('app-density') || 'comfortable');

    // Apply theme on mount and change
    useEffect(() => {
        applyTheme(selectedTheme);
    }, [selectedTheme]);

    const applyTheme = (theme: string) => {
        const root = document.documentElement;
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', prefersDark);
            root.classList.toggle('light', !prefersDark);
        } else {
            root.classList.toggle('dark', theme === 'dark');
            root.classList.toggle('light', theme === 'light');
        }
    };

    // Listen for OS theme changes when in 'system' mode
    useEffect(() => {
        if (selectedTheme !== 'system') return;
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme('system');
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, [selectedTheme]);

    const applyAccentColor = (hex: string) => {
        // Convert hex to HSL and set as CSS variable
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        document.documentElement.style.setProperty('--primary', `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`);
    };

    const handleSaveAppearance = () => {
        localStorage.setItem('app-theme', selectedTheme);
        localStorage.setItem('app-accent-color', selectedColor);
        localStorage.setItem('app-font-size', fontSize);
        localStorage.setItem('app-density', density);
        applyAccentColor(selectedColor);
        toast.success('Appearance settings saved!');
    };

    // Handle URL params for tab selection (e.g., from OAuth callback)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && settingsSections.find(s => s.id === tab)) {
            setActiveSection(tab);
        }
    }, []);

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
                                    <Input label="First Name" defaultValue="Admin" />
                                    <Input label="Last Name" defaultValue="User" />
                                    <Input label="Email" type="email" defaultValue="admin@logispro.vn" icon={<Mail className="w-4 h-4" />} />
                                    <Input label="Phone" type="tel" defaultValue="+84 28 1234 5678" />
                                    <div className="col-span-2">
                                        <Input label="Company" defaultValue="Ago Import Export Co.,Ltd" />
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


                    {activeSection === 'notifications' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Notification Preferences</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
                                    <Info className="w-5 h-5 text-blue-400 shrink-0" />
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        🔔 Notification preferences will be configurable in a future update.
                                    </p>
                                </div>
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
                                    <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))] opacity-60">
                                        <div>
                                            <p className="font-medium text-[hsl(var(--foreground))]">{item.title}</p>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{item.desc}</p>
                                        </div>
                                        <div
                                            className={cn(
                                                'w-12 h-6 rounded-full relative cursor-not-allowed',
                                                item.enabled ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                                                    item.enabled ? 'left-7' : 'left-1'
                                                )}
                                            />
                                        </div>
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
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-3">Language / Ngôn ngữ</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { id: 'en', label: 'English', flag: '🇺🇸' },
                                            { id: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
                                        ].map((lang) => {
                                            const currentLang = localStorage.getItem('app-language') || 'en';
                                            return (
                                                <button
                                                    key={lang.id}
                                                    onClick={() => {
                                                        localStorage.setItem('app-language', lang.id);
                                                        // Dynamic import to avoid circular dependency
                                                        import('i18next').then(i18n => {
                                                            i18n.default.changeLanguage(lang.id);
                                                        });
                                                        toast.success(`Language changed to ${lang.label}`);
                                                        // Force re-render
                                                        setActiveSection('localization');
                                                    }}
                                                    className={cn(
                                                        "p-4 rounded-lg border-2 flex items-center gap-3 transition-colors",
                                                        lang.id === currentLang
                                                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                                                            : "border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]"
                                                    )}
                                                >
                                                    <span className="text-2xl">{lang.flag}</span>
                                                    <span className="font-medium text-[hsl(var(--foreground))]">{lang.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Timezone', value: 'Asia/Ho Chi Minh (GMT+7)' },
                                        { label: 'Date Format', value: 'DD/MM/YYYY' },
                                        { label: 'Currency', value: '$ USD' },
                                        { label: 'Number Format', value: '1,234.56' },
                                    ].map((item) => (
                                        <div key={item.label} className="p-4 rounded-lg bg-[hsl(var(--secondary))]">
                                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">{item.label}</p>
                                            <p className="font-medium text-[hsl(var(--foreground))]">{item.value}</p>
                                        </div>
                                    ))}
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
                                            { id: 'system', label: 'System', icon: '💻', subtitle: `Detected: ${window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light'}` },
                                        ].map((theme) => (
                                            <button
                                                key={theme.id}
                                                onClick={() => setSelectedTheme(theme.id)}
                                                className={cn(
                                                    "p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors",
                                                    theme.id === selectedTheme
                                                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                                                        : "border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]"
                                                )}
                                            >
                                                <span className="text-2xl">{theme.icon}</span>
                                                <span className="text-sm font-medium">{theme.label}</span>
                                                {'subtitle' in theme && theme.subtitle && (
                                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{theme.subtitle}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-3">Accent Color</label>
                                    <div className="flex gap-3">
                                        {['#3B7A3B', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'].map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => setSelectedColor(color)}
                                                className={cn(
                                                    "w-10 h-10 rounded-full border-2 transition-all",
                                                    color === selectedColor ? "border-white ring-2 ring-[hsl(var(--primary))] scale-110" : "border-transparent hover:scale-105"
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
                                        value={fontSize}
                                        onChange={(e) => setFontSize(e.target.value)}
                                    />
                                    <Select
                                        label="Density"
                                        options={[
                                            { value: 'comfortable', label: 'Comfortable' },
                                            { value: 'compact', label: 'Compact' },
                                        ]}
                                        value={density}
                                        onChange={(e) => setDensity(e.target.value)}
                                    />
                                </div>

                                <div className="flex justify-end pt-4 border-t border-[hsl(var(--border))]">
                                    <Button onClick={handleSaveAppearance}>
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

                    {activeSection === 'backup' && (
                        <BackupSettingsPanel />
                    )}



                    {activeSection === 'security' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Security Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
                                    <Info className="w-5 h-5 text-blue-400 shrink-0" />
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        🔒 Security features will be available in a future update.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    {[
                                        { title: 'Two-Factor Authentication', desc: 'Add an extra layer of security', enabled: false },
                                        { title: 'Session Timeout', desc: 'Auto-logout after 30 minutes of inactivity', enabled: false },
                                        { title: 'Login Notifications', desc: 'Get notified of new device logins', enabled: false },
                                        { title: 'IP Whitelist', desc: 'Restrict access to specific IPs', enabled: false },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))] opacity-60">
                                            <div>
                                                <p className="font-medium text-[hsl(var(--foreground))]">{item.title}</p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">{item.desc}</p>
                                            </div>
                                            <div
                                                className={cn(
                                                    'w-12 h-6 rounded-full relative cursor-not-allowed',
                                                    item.enabled ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                                                        item.enabled ? 'left-7' : 'left-1'
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
