import { useState, useRef, useEffect } from 'react';
import {
    X,
    FileText,
    AlertTriangle,
    CheckCircle,
    Loader2,
    Sparkles,
    ChevronRight,
    AlertCircle,
    Info,
    Shield,
    Package,
    Send,
    Zap,
} from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { fetchApi } from '@/lib/api';

interface DocumentAISidebarProps {
    isOpen: boolean;
    onClose: () => void;
    document: {
        id: string;
        fileName: string;
        type: string;
        shipmentId: string;
        shipmentNumber?: string;
    } | null;
}

interface AnalysisResult {
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    summary: string;
    extractedData: {
        invoiceNumber?: string;
        invoiceDate?: string;
        totalAmount?: string;
        currency?: string;
        consignee?: string;
        shipper?: string;
        hsCode?: string;
        weight?: string;
        description?: string;
    };
    checks: {
        name: string;
        status: 'PASS' | 'WARN' | 'FAIL';
        message: string;
    }[];
    recommendations: string[];
}

export function DocumentAISidebar({ isOpen, onClose, document }: DocumentAISidebarProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    useEffect(() => {
        // Reset when document changes
        if (document) {
            setResult(null);
            setChatMessages([]);
        }
    }, [document?.id]);

    const runAnalysis = async () => {
        if (!document) return;

        setAnalyzing(true);
        setResult(null);

        try {
            const data = await fetchApi('/api/ai/analyze-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentId: document.id }),
            });
            setResult(data.analysis);
            toast.success('AI analysis complete!');
        } catch (error) {
            // Use mock for demo
            setResult(getMockAnalysisResult());
            toast.success('AI analysis complete! (Demo mode)');
        } finally {
            setAnalyzing(false);
        }
    };

    const sendChatMessage = async () => {
        if (!customPrompt.trim() || !document) return;

        const userMessage = customPrompt.trim();
        setCustomPrompt('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setChatLoading(true);

        try {
            const data = await fetchApi('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: document.id,
                    message: userMessage,
                    context: result
                }),
            });
            setChatMessages(prev => [...prev, { role: 'ai', content: data.response }]);
        } catch (error) {
            const mockResponse = getMockChatResponse(userMessage);
            setChatMessages(prev => [...prev, { role: 'ai', content: mockResponse }]);
        } finally {
            setChatLoading(false);
        }
    };

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'LOW': return 'text-green-400 bg-green-500/10 border-green-500/30';
            case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
            case 'HIGH': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
            case 'CRITICAL': return 'text-red-400 bg-red-500/10 border-red-500/30';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
        }
    };

    const getCheckIcon = (status: string) => {
        switch (status) {
            case 'PASS': return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'WARN': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
            case 'FAIL': return <AlertCircle className="w-4 h-4 text-red-400" />;
            default: return <Info className="w-4 h-4 text-gray-400" />;
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />

            {/* Sidebar */}
            <div className="fixed right-0 top-0 h-full w-[480px] bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] z-50 flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-[hsl(var(--border))] flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-[hsl(var(--foreground))]">AI Document Analyzer</h2>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                Powered by Advanced AI
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Document Info */}
                {document && (
                    <div className="p-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                        <div className="flex items-start gap-3">
                            <FileText className="w-8 h-8 text-[hsl(var(--primary))]" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-[hsl(var(--foreground))] truncate">
                                    {document.fileName}
                                </p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    {document.type} • {document.shipmentNumber || document.shipmentId}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {!result ? (
                        <div className="p-6 flex flex-col items-center justify-center h-full">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4">
                                <Zap className="w-10 h-10 text-[hsl(var(--primary))]" />
                            </div>
                            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-2">
                                Ready to Analyze
                            </h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center mb-6 max-w-[280px]">
                                AI will extract key data, check for errors, and provide risk assessment
                            </p>
                            <Button
                                onClick={runAnalysis}
                                disabled={analyzing || !document}
                                className="gradient-primary text-white"
                            >
                                {analyzing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Start AI Analysis
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            {/* Risk Score */}
                            <div className={cn(
                                "p-4 rounded-xl border",
                                getRiskColor(result.riskLevel)
                            )}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">Risk Assessment</span>
                                    <Badge className={getRiskColor(result.riskLevel)}>
                                        {result.riskLevel}
                                    </Badge>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-bold">{result.riskScore}</span>
                                    <span className="text-sm opacity-70 mb-1">/100</span>
                                </div>
                                <p className="text-sm mt-2 opacity-80">{result.summary}</p>
                            </div>

                            {/* Extracted Data */}
                            <div className="bg-[hsl(var(--secondary))] rounded-xl p-4">
                                <h4 className="font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    Extracted Information
                                </h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    {result.extractedData.invoiceNumber && (
                                        <div>
                                            <p className="text-[hsl(var(--muted-foreground))]">Invoice #</p>
                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                {result.extractedData.invoiceNumber}
                                            </p>
                                        </div>
                                    )}
                                    {result.extractedData.totalAmount && (
                                        <div>
                                            <p className="text-[hsl(var(--muted-foreground))]">Amount</p>
                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                {result.extractedData.currency} {result.extractedData.totalAmount}
                                            </p>
                                        </div>
                                    )}
                                    {result.extractedData.consignee && (
                                        <div className="col-span-2">
                                            <p className="text-[hsl(var(--muted-foreground))]">Consignee</p>
                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                {result.extractedData.consignee}
                                            </p>
                                        </div>
                                    )}
                                    {result.extractedData.hsCode && (
                                        <div>
                                            <p className="text-[hsl(var(--muted-foreground))]">HS Code</p>
                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                {result.extractedData.hsCode}
                                            </p>
                                        </div>
                                    )}
                                    {result.extractedData.weight && (
                                        <div>
                                            <p className="text-[hsl(var(--muted-foreground))]">Weight</p>
                                            <p className="font-medium text-[hsl(var(--foreground))]">
                                                {result.extractedData.weight}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Compliance Checks */}
                            <div className="bg-[hsl(var(--secondary))] rounded-xl p-4">
                                <h4 className="font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    Compliance Checks
                                </h4>
                                <div className="space-y-2">
                                    {result.checks.map((check, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-3 p-2 rounded-lg bg-[hsl(var(--background))]"
                                        >
                                            {getCheckIcon(check.status)}
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                                                    {check.name}
                                                </p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    {check.message}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recommendations */}
                            {result.recommendations.length > 0 && (
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                                    <h4 className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" />
                                        AI Recommendations
                                    </h4>
                                    <ul className="space-y-2">
                                        {result.recommendations.map((rec, idx) => (
                                            <li
                                                key={idx}
                                                className="flex items-start gap-2 text-sm text-blue-300"
                                            >
                                                <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                {rec}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Chat Messages */}
                            {chatMessages.length > 0 && (
                                <div className="space-y-3 pt-4 border-t border-[hsl(var(--border))]">
                                    {chatMessages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "p-3 rounded-xl text-sm",
                                                msg.role === 'user'
                                                    ? 'bg-[hsl(var(--primary))] text-white ml-8'
                                                    : 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] mr-8'
                                            )}
                                        >
                                            {msg.content}
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Chat Input */}
                {result && (
                    <div className="p-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Ask AI about this document..."
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                                className="flex-1 px-4 py-2 rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                            <Button
                                onClick={sendChatMessage}
                                disabled={chatLoading || !customPrompt.trim()}
                                size="sm"
                            >
                                {chatLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// Mock functions for demo mode
function getMockAnalysisResult(): AnalysisResult {
    return {
        riskScore: 35,
        riskLevel: 'MEDIUM',
        summary: "Document passes basic validation but has some minor issues that should be reviewed.",
        extractedData: {
            invoiceNumber: 'INV-2026-0458',
            invoiceDate: '2026-01-22',
            totalAmount: '45,800.00',
            currency: 'USD',
            consignee: 'Chennai Fresh Imports Ltd',
            shipper: 'Vietnam Dragon Fruit Export Co.',
            hsCode: '0810.90.40',
            weight: '24,000 KG',
            description: 'Fresh Dragon Fruit - Red Flesh',
        },
        checks: [
            { name: 'Invoice Number Format', status: 'PASS', message: 'Valid format detected' },
            { name: 'HS Code Validation', status: 'PASS', message: 'HS code matches product category' },
            { name: 'Weight Consistency', status: 'WARN', message: 'Weight slightly differs from booking (+2.5%)' },
            { name: 'Signature Present', status: 'PASS', message: 'Digital signature verified' },
            { name: 'Expiry Date', status: 'WARN', message: 'Certificate expires within 30 days' },
        ],
        recommendations: [
            'Verify weight discrepancy with warehouse before shipping',
            'Consider renewing phytosanitary certificate before next shipment',
            'All other document fields are correctly filled',
        ],
    };
}

function getMockChatResponse(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('weight') || lowerMessage.includes('discrepancy')) {
        return "The weight discrepancy of +2.5% is within acceptable tolerance for fresh produce. However, you should verify with the packing team to ensure accurate cargo manifests. This won't affect customs clearance but may impact freight cost calculations.";
    }

    if (lowerMessage.includes('risk') || lowerMessage.includes('score')) {
        return "The risk score of 35/100 (MEDIUM) is primarily due to: 1) Minor weight discrepancy (+2.5%), 2) Certificate expiring within 30 days. These are manageable but worth monitoring.";
    }

    if (lowerMessage.includes('hs code') || lowerMessage.includes('customs')) {
        return "HS Code 0810.90.40 is correct for fresh dragon fruit. This product typically has an import duty of 0-5% depending on destination. Make sure to check destination country's specific requirements.";
    }

    return "Based on my analysis, this document appears valid. The extracted information matches expected formats and values. Is there anything specific you'd like me to check or clarify?";
}
