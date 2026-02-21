import { useState, useEffect } from 'react';
import {
    Key,
    Globe,
    Zap,
    CheckCircle,
    AlertCircle,
    Loader2,
    Save,
    TestTube,
    Brain,
    ExternalLink,
    GraduationCap,
    RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { fetchApi } from '@/lib/api';

interface AISettings {
    provider: 'anthropic' | 'openai' | 'gemini' | 'custom';
    apiKey: string;
    endpoint: string;
    model: string;
    maxTokens: number;
    customSystemPrompt: string;
}

const defaultSettings: AISettings = {
    provider: 'anthropic',
    apiKey: '',
    endpoint: '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    customSystemPrompt: '',
};

const PROVIDERS = {
    anthropic: {
        name: 'Anthropic Claude',
        models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
        defaultEndpoint: 'https://api.anthropic.com',
        docUrl: 'https://console.anthropic.com/account/keys',
        color: 'from-orange-500 to-amber-500',
        description: 'Recommended — Best for document analysis',
    },
    openai: {
        name: 'OpenAI GPT',
        models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
        defaultEndpoint: 'https://api.openai.com/v1',
        docUrl: 'https://platform.openai.com/api-keys',
        color: 'from-green-500 to-emerald-500',
        description: 'Popular general-purpose AI',
    },
    gemini: {
        name: 'Google Gemini',
        models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        defaultEndpoint: 'https://generativelanguage.googleapis.com',
        docUrl: 'https://aistudio.google.com/app/apikey',
        color: 'from-blue-500 to-cyan-500',
        description: 'Google AI with multimodal capabilities',
    },
    custom: {
        name: 'Custom API',
        models: [],
        defaultEndpoint: '',
        docUrl: '',
        color: 'from-purple-500 to-pink-500',
        description: 'Connect your own AI endpoint',
    },
};

const DEFAULT_SYSTEM_PROMPT = `You are a Senior Import-Export Director with over 30 years of experience in logistics and Vietnamese fruit exports. You have deep expertise in:
- Import/export procedures, customs clearance, and incoterms
- Cold chain supply management for fresh fruits
- Phytosanitary regulations, certificates of origin, and fumigation
- Forwarder and shipping line management, freight rate negotiation
- Operational risk analysis and deadline management
- Import/export finance: LC, TT, and invoice reconciliation

Provide detailed, specific answers based on actual system data. Recommend actionable steps when appropriate.`;

export function AISettingsPanel() {
    const [settings, setSettings] = useState<AISettings>(defaultSettings);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const [saving, setSaving] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [showTraining, setShowTraining] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            // Load from backend first
            const data = await fetchApi('/api/settings/ai');
            if (data.settings) {
                setSettings(prev => ({
                    ...prev,
                    provider: data.settings.provider || prev.provider,
                    apiKey: data.settings.apiKey || prev.apiKey,
                    endpoint: data.settings.endpoint || prev.endpoint,
                    model: data.settings.model || prev.model,
                    maxTokens: data.settings.maxTokens || prev.maxTokens,
                    customSystemPrompt: data.settings.customSystemPrompt || prev.customSystemPrompt,
                }));
                return;
            }
        } catch {
            // Fallback to localStorage
        }

        const saved = localStorage.getItem('ai_settings');
        if (saved) {
            try {
                setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
            } catch { /* ignore */ }
        }
    };

    const handleProviderChange = (provider: AISettings['provider']) => {
        const providerConfig = PROVIDERS[provider];
        setSettings(prev => ({
            ...prev,
            provider,
            endpoint: providerConfig.defaultEndpoint,
            model: providerConfig.models[0] || '',
        }));
        setTestResult(null);
    };

    const testConnection = async () => {
        if (!settings.apiKey) {
            toast.error('Please enter an API key');
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            await fetchApi('/api/ai/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            setTestResult('success');
            toast.success('Connection successful!');
        } catch (error) {
            setTestResult('error');
            toast.error('Connection failed. Check your API key and try again.');
        } finally {
            setTesting(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);

        try {
            // Save to backend
            await fetchApi('/api/settings/ai', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            toast.success('AI settings saved successfully!');

            // Also save to localStorage as backup
            localStorage.setItem('ai_settings', JSON.stringify(settings));
        } catch {
            localStorage.setItem('ai_settings', JSON.stringify(settings));
            toast.success('Settings saved locally (backend unavailable)');
        } finally {
            setSaving(false);
        }
    };

    const currentProvider = PROVIDERS[settings.provider];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-[hsl(var(--foreground))] flex items-center gap-3">
                    <Brain className="w-7 h-7" />
                    AI Configuration
                </h2>
                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                    Configure your AI provider for document analysis, risk assessment, and assistant chat
                </p>
            </div>

            {/* Provider Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        AI Provider
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(PROVIDERS).map(([key, provider]) => (
                            <button
                                key={key}
                                onClick={() => handleProviderChange(key as AISettings['provider'])}
                                className={cn(
                                    "p-4 rounded-xl border-2 text-left transition-all",
                                    settings.provider === key
                                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                                        : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3",
                                    provider.color
                                )}>
                                    <Zap className="w-5 h-5 text-white" />
                                </div>
                                <p className="font-semibold text-[hsl(var(--foreground))]">{provider.name}</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                    {provider.description}
                                </p>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* API Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Key className="w-5 h-5" />
                            API Settings
                        </span>
                        {currentProvider.docUrl && (
                            <a
                                href={currentProvider.docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                            >
                                Get API Key
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* API Key */}
                    <div>
                        <label className="text-sm font-medium text-[hsl(var(--foreground))] mb-2 block">
                            API Key
                        </label>
                        <div className="relative">
                            <Input
                                type={showKey ? 'text' : 'password'}
                                placeholder={settings.provider === 'gemini' ? 'AIza...' : 'sk-...'}
                                value={settings.apiKey}
                                onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            >
                                {showKey ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    {/* Endpoint (for custom) */}
                    {settings.provider === 'custom' && (
                        <div>
                            <label className="text-sm font-medium text-[hsl(var(--foreground))] mb-2 block">
                                API Endpoint
                            </label>
                            <Input
                                placeholder="https://your-api.com/v1"
                                value={settings.endpoint}
                                onChange={(e) => setSettings(prev => ({ ...prev, endpoint: e.target.value }))}
                            />
                        </div>
                    )}

                    {/* Model Selection */}
                    <div>
                        <label className="text-sm font-medium text-[hsl(var(--foreground))] mb-2 block">
                            Model
                        </label>
                        {currentProvider.models.length > 0 ? (
                            <select
                                value={settings.model}
                                onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                                className="w-full h-10 px-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                            >
                                {currentProvider.models.map(model => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                            </select>
                        ) : (
                            <Input
                                placeholder="model-name"
                                value={settings.model}
                                onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                            />
                        )}
                    </div>

                    {/* Max Tokens */}
                    <div>
                        <label className="text-sm font-medium text-[hsl(var(--foreground))] mb-2 block">
                            Max Tokens
                        </label>
                        <Input
                            type="number"
                            value={settings.maxTokens}
                            onChange={(e) => setSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 4096 }))}
                            min={1000}
                            max={128000}
                        />
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                            Maximum tokens for AI response (1000 - 128000)
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* AI Training / Custom Prompt */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <GraduationCap className="w-5 h-5" />
                            AI Training — Custom Prompt
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setShowTraining(!showTraining)}>
                            {showTraining ? 'Collapse' : 'Expand'}
                        </Button>
                    </CardTitle>
                </CardHeader>
                {showTraining && (
                    <CardContent className="space-y-4">
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-[hsl(var(--muted-foreground))]">
                            <p className="font-medium text-blue-400 mb-1">💡 How to train your AI</p>
                            <p>Write a custom system prompt to define how your AI assistant behaves. This is added to every conversation. You can specify the AI's expertise, personality, response format, and company-specific knowledge.</p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-[hsl(var(--foreground))] mb-2 block">
                                Custom System Prompt
                            </label>
                            <textarea
                                value={settings.customSystemPrompt}
                                onChange={(e) => setSettings(prev => ({ ...prev, customSystemPrompt: e.target.value }))}
                                placeholder={DEFAULT_SYSTEM_PROMPT}
                                rows={10}
                                className="w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                            />
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                Leave empty to use the default prompt. Your custom prompt will be combined with operational data from the system.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSettings(prev => ({ ...prev, customSystemPrompt: DEFAULT_SYSTEM_PROMPT }))}
                            >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Load Default Prompt
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Test & Save */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {testResult === 'success' && (
                                <div className="flex items-center gap-2 text-green-400">
                                    <CheckCircle className="w-5 h-5" />
                                    <span className="text-sm font-medium">Connection verified</span>
                                </div>
                            )}
                            {testResult === 'error' && (
                                <div className="flex items-center gap-2 text-red-400">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="text-sm font-medium">Connection failed — check API key</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={testConnection}
                                disabled={testing || !settings.apiKey}
                            >
                                {testing ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <TestTube className="w-4 h-4 mr-2" />
                                )}
                                Test Connection
                            </Button>
                            <Button
                                onClick={saveSettings}
                                disabled={saving}
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Save Settings
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Info Box */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    AI Features
                </h4>
                <ul className="text-sm text-[hsl(var(--muted-foreground))] space-y-1">
                    <li>• Document data extraction (Invoice numbers, amounts, dates)</li>
                    <li>• Cross-document validation and anomaly detection</li>
                    <li>• General assistant with full operational data access</li>
                    <li>• Customizable AI persona via Training prompt</li>
                </ul>
            </div>
        </div>
    );
}

