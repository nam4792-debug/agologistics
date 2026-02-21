import { useState, useEffect, useRef } from 'react';
import {
    Send,
    Loader2,
    CheckCircle,
    AlertTriangle,
    XCircle,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { fetchApi } from '@/lib/api';

interface DocumentData {
    id: string;
    document_type: string;
    file_name: string;
    status: string;
}

interface AuditDocChecked {
    type: string;
    file: string;
    status: 'OK' | 'WARNING' | 'ERROR';
    issues: string[];
}

interface AuditCrossCheck {
    field: string;
    values: Record<string, string>;
    status: 'MATCH' | 'MISMATCH' | 'WITHIN_TOLERANCE';
    note: string;
}

interface AuditIssue {
    severity: string;
    document: string;
    field: string;
    issue: string;
    action: string;
}

interface AuditResult {
    audit_status: 'PASS' | 'WARNING' | 'FAIL';
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    documents_checked: AuditDocChecked[];
    missing_documents: string[];
    cross_check_results: AuditCrossCheck[];
    errors: AuditIssue[];
    warnings: AuditIssue[];
    summary: string;
    recommended_actions: string[];
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

const documentTypeLabels: Record<string, string> = {
    COMMERCIAL_INVOICE: 'Commercial Invoice',
    PACKING_LIST: 'Packing List',
    BILL_OF_LADING: 'Bill of Lading',
    CERTIFICATE_OF_ORIGIN: 'Certificate of Origin',
    PHYTOSANITARY: 'Phytosanitary Certificate',
    CUSTOMS_DECLARATION: 'Customs Declaration',
    INSURANCE: 'Insurance Certificate',
    FUMIGATION: 'Fumigation Certificate',
};

type AuditPhase = 'idle' | 'extracting' | 'auditing' | 'done' | 'error';

export function ShipmentAIPanel({
    shipmentId,
    documents,
}: {
    shipmentId: string;
    documents: DocumentData[];
}) {
    const [auditPhase, setAuditPhase] = useState<AuditPhase>('idle');
    const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
    const [_auditRawText, setAuditRawText] = useState<string>('');
    const [auditMeta, setAuditMeta] = useState<{ docsCount: number; tokensUsed: number; cached: number; fresh: number } | null>(null);
    const [auditError, setAuditError] = useState<string>('');

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatting, setChatting] = useState(false);
    const [showChat, setShowChat] = useState(false);

    const [showCrossCheckDetails, setShowCrossCheckDetails] = useState(false);
    const [showDocDetails, setShowDocDetails] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadPreviousAudit();
        loadChatHistory();
    }, [shipmentId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Load previous audit result if exists
    const loadPreviousAudit = async () => {
        try {
            const data = await fetchApi(`/api/ai/results/${shipmentId}`);
            const results = data.results || [];
            const auditResults = results.filter((r: any) => r.analysis_type === 'AUDIT');
            if (auditResults.length > 0) {
                const latest = auditResults[0];
                const parsed = typeof latest.result === 'string' ? JSON.parse(latest.result) : latest.result;
                if (parsed?.structured) {
                    setAuditResult(parsed.structured);
                    setAuditRawText(parsed.text || '');
                    setAuditPhase('done');
                }
            }
        } catch (e) {
            // silent
        }
    };

    const loadChatHistory = async () => {
        try {
            const data = await fetchApi(`/api/ai/chat/${shipmentId}`);
            setChatMessages(data.messages || []);
        } catch (e) {
            // silent
        }
    };

    // ===== MAIN AUDIT HANDLER =====
    const handleAudit = async () => {
        setAuditPhase('extracting');
        setAuditResult(null);
        setAuditError('');
        setAuditRawText('');

        try {
            // Short delay to show extracting phase, then the API handles everything
            setTimeout(() => {
                setAuditPhase('auditing');
            }, 2000);

            const data = await fetchApi(`/api/ai/audit/${shipmentId}`, {
                method: 'POST',
            });

            if (data.success && data.audit) {
                setAuditResult(data.audit);
                setAuditRawText(data.raw_text || '');
                setAuditMeta({
                    docsCount: data.documents_count,
                    tokensUsed: data.tokensUsed,
                    cached: data.extractions_cached,
                    fresh: data.extractions_new,
                });
                setAuditPhase('done');

                if (data.audit_status === 'PASS') {
                    toast.success('✅ All documents passed audit!');
                } else if (data.audit_status === 'WARNING') {
                    toast('⚠️ Audit found warnings — review recommended', { icon: '⚠️' });
                } else {
                    toast.error('❌ Audit found errors — action required');
                }
            } else {
                setAuditError(data.error || 'Audit returned no results');
                setAuditPhase('error');
                toast.error(data.error || 'Audit failed');
            }
        } catch (error: any) {
            setAuditError(error.message || 'AI Audit failed');
            setAuditPhase('error');
            toast.error(error.message || 'AI Audit failed');
        }
    };

    // ===== CHAT HANDLER =====
    const handleSendChat = async () => {
        if (!chatInput.trim() || chatting) return;

        const userMsg = chatInput.trim();
        setChatInput('');
        setChatting(true);

        setChatMessages(prev => [...prev, {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: userMsg,
            created_at: new Date().toISOString(),
        }]);

        try {
            const data = await fetchApi(`/api/ai/chat/${shipmentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg }),
            });
            if (data.success) {
                setChatMessages(prev => [...prev, {
                    id: `ai-${Date.now()}`,
                    role: 'assistant',
                    content: data.reply,
                    created_at: new Date().toISOString(),
                }]);
            } else {
                toast.error(data.error || 'AI did not respond');
            }
        } catch (error: any) {
            toast.error(error.message || 'AI connection error');
        } finally {
            setChatting(false);
        }
    };

    // ===== HELPER: STATUS COLORS =====
    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'PASS': return { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: CheckCircle, label: 'PASSED' };
            case 'WARNING': return { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: AlertTriangle, label: 'WARNINGS' };
            case 'FAIL': return { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: XCircle, label: 'FAILED' };
            default: return { color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20', icon: AlertCircle, label: status };
        }
    };

    const getRiskConfig = (level: string) => {
        switch (level) {
            case 'LOW': return { color: 'text-green-400', bg: 'bg-green-500/20' };
            case 'MEDIUM': return { color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
            case 'HIGH': return { color: 'text-orange-400', bg: 'bg-orange-500/20' };
            case 'CRITICAL': return { color: 'text-red-400', bg: 'bg-red-500/20' };
            default: return { color: 'text-gray-400', bg: 'bg-gray-500/20' };
        }
    };

    const getCrossCheckColor = (status: string) => {
        switch (status) {
            case 'MATCH': return 'text-green-400';
            case 'WITHIN_TOLERANCE': return 'text-yellow-400';
            case 'MISMATCH': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const isAuditing = auditPhase === 'extracting' || auditPhase === 'auditing';

    return (
        <div className="space-y-6">
            {/* === AI AUDIT SECTION === */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>
                        AI Document Audit
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant={showChat ? 'default' : 'outline'}
                            onClick={() => setShowChat(!showChat)}
                        >
                            AI Chat
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Documents list + Audit button */}
                    {documents.length > 0 ? (
                        <div className="space-y-4">
                            {/* Document chips */}
                            <div className="flex flex-wrap gap-2">
                                {documents.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-sm"
                                    >
                                        <span className="text-[hsl(var(--foreground))] font-medium">
                                            {documentTypeLabels[doc.document_type] || doc.document_type}
                                        </span>
                                        <span className="text-[hsl(var(--muted-foreground))] text-xs">
                                            {doc.file_name}
                                        </span>
                                        {doc.status === 'CHECKED' && (
                                            <span className="text-green-400 text-xs font-medium">✓</span>
                                        )}
                                        {doc.status === 'APPROVED' && (
                                            <span className="text-blue-400 text-xs font-medium">✓✓</span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Audit Button */}
                            <Button
                                className="w-full"
                                onClick={handleAudit}
                                disabled={isAuditing}
                                size="lg"
                            >
                                {auditPhase === 'extracting' ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Extracting data from {documents.length} documents...
                                    </>
                                ) : auditPhase === 'auditing' ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Cross-checking all documents...
                                    </>
                                ) : auditPhase === 'done' ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 mr-2" />
                                        Re-run AI Audit ({documents.length} docs)
                                    </>
                                ) : (
                                    <>
                                        Run AI Audit ({documents.length} docs)
                                    </>
                                )}
                            </Button>

                            {/* Progress bar during audit */}
                            {isAuditing && (
                                <div className="space-y-2">
                                    <div className="w-full bg-[hsl(var(--secondary))] rounded-full h-2">
                                        <div
                                            className="bg-purple-500 h-2 rounded-full transition-all duration-1000"
                                            style={{ width: auditPhase === 'extracting' ? '40%' : '80%' }}
                                        />
                                    </div>
                                    <p className="text-xs text-center text-[hsl(var(--muted-foreground))]">
                                        {auditPhase === 'extracting'
                                            ? `Step 1/2: AI is reading and extracting data from each document...`
                                            : `Step 2/2: AI is cross-checking consistency across all documents...`}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-[hsl(var(--muted-foreground))]">
                            <p className="text-sm">Upload documents to enable AI Audit</p>
                        </div>
                    )}

                    {/* Error state */}
                    {auditPhase === 'error' && (
                        <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <XCircle className="w-5 h-5 text-red-400" />
                                <span className="text-sm font-semibold text-red-400">Audit Failed</span>
                            </div>
                            <p className="text-sm text-red-300">{auditError}</p>
                            <Button size="sm" variant="outline" className="mt-2" onClick={handleAudit}>
                                Retry
                            </Button>
                        </div>
                    )}

                    {/* ===== AUDIT RESULTS ===== */}
                    {auditPhase === 'done' && auditResult && (
                        <div className="mt-6 space-y-4">
                            {/* Status Banner */}
                            {(() => {
                                const config = getStatusConfig(auditResult.audit_status);
                                const riskConfig = getRiskConfig(auditResult.risk_level);
                                const StatusIcon = config.icon;
                                return (
                                    <div className={cn("p-4 rounded-xl border", config.bg)}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <StatusIcon className={cn("w-8 h-8", config.color)} />
                                                <div>
                                                    <p className={cn("text-lg font-bold", config.color)}>
                                                        {config.label}
                                                    </p>
                                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                        {auditResult.summary}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge className={cn("text-xs font-semibold", riskConfig.bg, riskConfig.color)}>
                                                Risk: {auditResult.risk_level}
                                            </Badge>
                                        </div>

                                        {/* Quick stats */}
                                        <div className="flex gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                                            <span>{auditResult.documents_checked?.length || 0} docs checked</span>
                                            <span>{auditResult.errors?.length || 0} errors</span>
                                            <span>{auditResult.warnings?.length || 0} warnings</span>
                                            <span>{auditResult.missing_documents?.length || 0} missing</span>
                                            {auditMeta && <span>{auditMeta.tokensUsed} tokens</span>}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Missing Documents */}
                            {auditResult.missing_documents?.length > 0 && (
                                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                    <p className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Missing Documents
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {auditResult.missing_documents.map((doc, i) => (
                                            <Badge key={i} className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                                                {documentTypeLabels[doc] || doc}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {auditResult.errors?.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
                                        <XCircle className="w-4 h-4" />
                                        Errors ({auditResult.errors.length})
                                    </p>
                                    {auditResult.errors.map((err, i) => (
                                        <div key={i} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm text-[hsl(var(--foreground))]">
                                                        <span className="font-semibold text-red-400">{documentTypeLabels[err.document] || err.document}</span>
                                                        {err.field && <span className="text-[hsl(var(--muted-foreground))]"> → {err.field}</span>}
                                                    </p>
                                                    <p className="text-sm text-[hsl(var(--foreground))] mt-1">{err.issue}</p>
                                                    {err.action && (
                                                        <p className="text-xs text-blue-400 mt-1">
                                                            Suggestion: {err.action}
                                                        </p>
                                                    )}
                                                </div>
                                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs shrink-0">
                                                    {err.severity}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Warnings */}
                            {auditResult.warnings?.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Warnings ({auditResult.warnings.length})
                                    </p>
                                    {auditResult.warnings.map((warn, i) => (
                                        <div key={i} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm text-[hsl(var(--foreground))]">
                                                        <span className="font-semibold text-yellow-400">{documentTypeLabels[warn.document] || warn.document}</span>
                                                        {warn.field && <span className="text-[hsl(var(--muted-foreground))]"> → {warn.field}</span>}
                                                    </p>
                                                    <p className="text-sm text-[hsl(var(--foreground))] mt-1">{warn.issue}</p>
                                                    {warn.action && (
                                                        <p className="text-xs text-blue-400 mt-1">
                                                            Suggestion: {warn.action}
                                                        </p>
                                                    )}
                                                </div>
                                                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs shrink-0">
                                                    {warn.severity}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Cross-check Details (collapsible) */}
                            {auditResult.cross_check_results?.length > 0 && (
                                <div>
                                    <button
                                        className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition-colors"
                                        onClick={() => setShowCrossCheckDetails(!showCrossCheckDetails)}
                                    >
                                        {showCrossCheckDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        Cross-check Details ({auditResult.cross_check_results.length} fields)
                                    </button>
                                    {showCrossCheckDetails && (
                                        <div className="mt-2 space-y-1">
                                            {auditResult.cross_check_results.map((cc, i) => (
                                                <div key={i} className="p-2 rounded-lg bg-[hsl(var(--secondary))] text-sm flex items-start gap-3">
                                                    <span className={cn("font-mono text-xs mt-0.5", getCrossCheckColor(cc.status))}>
                                                        {cc.status === 'MATCH' ? '✓' : cc.status === 'WITHIN_TOLERANCE' ? '~' : '✗'}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-[hsl(var(--foreground))]">{cc.field}</span>
                                                            <Badge className={cn("text-[10px]", getCrossCheckColor(cc.status))}>{cc.status}</Badge>
                                                        </div>
                                                        {cc.values && (
                                                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                                                                {Object.entries(cc.values).map(([doc, val]) => (
                                                                    <span key={doc}>
                                                                        <span className="text-[hsl(var(--foreground))]">{documentTypeLabels[doc] || doc}:</span> {val}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {cc.note && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 italic">{cc.note}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Document Details (collapsible) */}
                            {auditResult.documents_checked?.length > 0 && (
                                <div>
                                    <button
                                        className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition-colors"
                                        onClick={() => setShowDocDetails(!showDocDetails)}
                                    >
                                        {showDocDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        Per-Document Results ({auditResult.documents_checked.length})
                                    </button>
                                    {showDocDetails && (
                                        <div className="mt-2 space-y-1">
                                            {auditResult.documents_checked.map((dc, i) => (
                                                <div key={i} className="p-2 rounded-lg bg-[hsl(var(--secondary))] text-sm flex items-center gap-3">
                                                    {dc.status === 'OK' ? (
                                                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                                                    ) : dc.status === 'WARNING' ? (
                                                        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-medium text-[hsl(var(--foreground))]">
                                                            {documentTypeLabels[dc.type] || dc.type}
                                                        </span>
                                                        <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">{dc.file}</span>
                                                        {dc.issues?.length > 0 && (
                                                            <ul className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                                                                {dc.issues.map((issue, j) => (
                                                                    <li key={j}>• {issue}</li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Recommended Actions */}
                            {auditResult.recommended_actions?.length > 0 && (
                                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                    <p className="text-sm font-semibold text-blue-400 mb-2">Recommended Actions</p>
                                    <ul className="space-y-1">
                                        {auditResult.recommended_actions.map((action, i) => (
                                            <li key={i} className="text-sm text-[hsl(var(--foreground))]">{action}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* === AI CHAT PANEL === */}
            {showChat && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            AI Chat — Shipment Assistant
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Chat Messages */}
                        <div className="max-h-[400px] overflow-y-auto space-y-3 mb-4 p-3 rounded-lg bg-[hsl(var(--secondary))]/50">
                            {chatMessages.length === 0 && (
                                <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                                    <p className="text-sm">Ask AI about documents, shipments, or anything.</p>
                                    <div className="flex flex-wrap gap-2 justify-center mt-3">
                                        {['Summarize this shipment', 'Check for missing documents', 'Compare weights across documents'].map((q) => (
                                            <button
                                                key={q}
                                                className="text-xs px-3 py-1.5 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20 transition-colors"
                                                onClick={() => { setChatInput(q); }}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {chatMessages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex",
                                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm",
                                            msg.role === 'user'
                                                ? 'bg-[hsl(var(--primary))] text-white rounded-br-md'
                                                : 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] rounded-bl-md'
                                        )}
                                    >
                                        <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                                    </div>
                                </div>
                            ))}
                            {chatting && (
                                <div className="flex justify-start">
                                    <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-[hsl(var(--secondary))]">
                                        <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--primary))]" />
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendChat();
                                    }
                                }}
                                placeholder="Ask AI about this shipment..."
                                className="flex-1 px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50 text-sm"
                            />
                            <Button
                                onClick={handleSendChat}
                                disabled={!chatInput.trim() || chatting}
                                size="sm"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
