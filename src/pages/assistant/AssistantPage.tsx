import { useState, useEffect, useRef } from 'react';
import {
    Bot,
    Send,
    Sparkles,
    User,
    FileText,
    Ship,
    AlertTriangle,
    Clock,
    Lightbulb,
    Trash2,
    Loader2,
    RotateCcw,
    AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    tokensUsed?: number;
}

const suggestedQuestions = [
    'What\'s the operational overview for today?',
    'Which shipments are at risk of missing deadlines?',
    'Compare forwarder performance',
    'Which documents are missing or incomplete?',
    'Analyze shipping costs this month',
    'Summarize unpaid invoices',
    'List urgent tasks to handle',
];

export function AssistantPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load chat history on mount
    useEffect(() => {
        loadHistory();
    }, []);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const loadHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const data = await api.getAssistantHistory();
            if (data.messages && data.messages.length > 0) {
                setMessages(
                    data.messages.map((m: { id: string; role: 'user' | 'assistant'; content: string; created_at: string; tokens_used?: number }) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        timestamp: new Date(m.created_at),
                        tokensUsed: m.tokens_used,
                    }))
                );
                setSessionId(data.sessionId);
            }
        } catch {
            // No history, that's fine
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleSend = async (messageText?: string) => {
        const text = messageText || inputValue.trim();
        if (!text || isTyping) return;

        setError(null);

        const userMessage: Message = {
            id: `user_${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsTyping(true);

        try {
            const data = await api.assistantChat(text, sessionId || undefined);

            if (data.success) {
                const aiMessage: Message = {
                    id: `ai_${Date.now()}`,
                    role: 'assistant',
                    content: data.reply,
                    timestamp: new Date(),
                    tokensUsed: data.tokensUsed,
                };
                setMessages(prev => [...prev, aiMessage]);
                setSessionId(data.sessionId);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unable to connect to AI';
            setError(errorMessage);

            // Add error message to chat
            const errorMsg: Message = {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content: `⚠️ **Error:** ${errorMessage}\n\n${errorMessage.includes('API key')
                    ? '→ Go to **Settings → AI Configuration** to set up your API key.'
                    : '→ Please check the server connection and try again.'
                    }`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleNewConversation = async () => {
        try {
            if (sessionId) {
                await api.clearAssistantHistory(sessionId);
            }
        } catch {
            // Ignore
        }
        setMessages([]);
        setSessionId(null);
        setError(null);
    };

    const handleQuickQuestion = (question: string) => {
        handleSend(question);
    };

    const formatContent = (content: string): string => {
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] flex items-center gap-3">
                        <Bot className="w-8 h-8" />
                        AI Assistant
                    </h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Smart AI assistant — full access to your operational data
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNewConversation}
                        className="flex items-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" />
                        New Conversation
                    </Button>
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-sm">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Online
                    </span>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0">
                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-h-0">
                    <Card className="flex-1 flex flex-col min-h-0">
                        {/* Messages */}
                        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                            {isLoadingHistory ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
                                    <span className="ml-2 text-[hsl(var(--muted-foreground))]">Loading history...</span>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mb-4">
                                        <Sparkles className="w-10 h-10 text-white" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2">
                                        Hello! I'm LogisPro's AI Assistant
                                    </h2>
                                    <p className="text-[hsl(var(--muted-foreground))] max-w-md mb-6">
                                        I have full access to your system's operational data — shipments, bookings, documents, vendors, invoices, and risk alerts. Ask me anything!
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 max-w-lg">
                                        {suggestedQuestions.slice(0, 4).map((q, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleQuickQuestion(q)}
                                                className="text-left text-sm p-3 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={cn(
                                                'flex gap-3',
                                                message.role === 'user' && 'flex-row-reverse'
                                            )}
                                        >
                                            <div className={cn(
                                                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                                                message.role === 'assistant'
                                                    ? 'gradient-primary'
                                                    : 'bg-[hsl(var(--secondary))]'
                                            )}>
                                                {message.role === 'assistant'
                                                    ? <Sparkles className="w-5 h-5 text-white" />
                                                    : <User className="w-5 h-5 text-[hsl(var(--foreground))]" />
                                                }
                                            </div>
                                            <div className={cn(
                                                'max-w-[80%] rounded-2xl px-4 py-3',
                                                message.role === 'assistant'
                                                    ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]'
                                                    : 'gradient-primary text-white'
                                            )}>
                                                <div
                                                    className="text-sm whitespace-pre-wrap leading-relaxed"
                                                    dangerouslySetInnerHTML={{
                                                        __html: formatContent(message.content)
                                                    }}
                                                />
                                                {message.tokensUsed && message.tokensUsed > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-[hsl(var(--border))] opacity-50">
                                                        <span className="text-[10px]">{message.tokensUsed.toLocaleString()} tokens</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {isTyping && (
                                        <div className="flex gap-3">
                                            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                                                <Sparkles className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="bg-[hsl(var(--secondary))] rounded-2xl px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--muted-foreground))]" />
                                                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                                        Analyzing data...
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </CardContent>

                        {/* Error Banner */}
                        {error && (
                            <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                <span className="text-xs text-red-400 truncate">{error}</span>
                                <button
                                    onClick={() => setError(null)}
                                    className="ml-auto text-xs text-red-400 hover:text-red-300"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="p-4 border-t border-[hsl(var(--border))]">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Ask anything about operations, shipments, documents, costs..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    className="flex-1"
                                    disabled={isTyping}
                                />
                                <Button onClick={() => handleSend()} disabled={!inputValue.trim() || isTyping}>
                                    {isTyping ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="w-80 space-y-4 flex-shrink-0">
                    {/* Suggested Questions */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Lightbulb className="w-4 h-4" />
                                Suggested Questions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {suggestedQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleQuickQuestion(q)}
                                    disabled={isTyping}
                                    className="w-full text-left text-sm p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-50"
                                >
                                    {q}
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    {/* AI Capabilities */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                AI Capabilities
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {[
                                { icon: Ship, label: 'Shipment Tracking', desc: 'Real-time status' },
                                { icon: FileText, label: 'Document Review', desc: 'Detect missing items' },
                                { icon: AlertTriangle, label: 'Risk Analysis', desc: 'Proactive alerts' },
                                { icon: Clock, label: 'Deadline Management', desc: 'Cut-off tracking' },
                            ].map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))]/20 flex items-center justify-center">
                                        <item.icon className="w-4 h-4 text-[hsl(var(--primary))]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{item.label}</p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <Card>
                        <CardContent className="pt-4">
                            <Button
                                variant="outline"
                                className="w-full flex items-center gap-2 text-red-400 hover:text-red-300 hover:border-red-400/50"
                                onClick={handleNewConversation}
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear Chat History
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
