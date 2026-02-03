import { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    actions?: Array<{
        label: string;
        type: 'link' | 'action';
        target?: string;
    }>;
}

const suggestedQuestions = [
    "What's the status of shipment A59FX15608?",
    'Which shipments are at risk of delay?',
    'Compare forwarder performance this month',
    'What documents are pending for approval?',
    'Show cost analysis for air freight',
];

const initialMessages: Message[] = [
    {
        id: '1',
        role: 'assistant',
        content: `Hello! I'm your AI logistics assistant. I can help you with:

• **Shipment tracking** - Check status, ETA, and documents
• **Risk analysis** - Identify potential delays or issues
• **Document verification** - Validate and process shipping documents
• **Cost optimization** - Analyze freight costs and find savings
• **Forwarder insights** - Compare performance and recommendations

How can I assist you today?`,
        timestamp: new Date(),
    },
];

export function AssistantPage() {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const handleSend = () => {
        if (!inputValue.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsTyping(true);

        // Simulate AI response
        setTimeout(() => {
            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `I understand you're asking about "${inputValue}". 

In a production environment, I would connect to your logistics data and provide real-time insights. For now, here's a sample response:

📦 **Quick Analysis**
• I found 3 active shipments matching your query
• 1 shipment has elevated risk due to documentation delays
• Estimated cost savings opportunity: $1,250

Would you like me to drill down into any of these areas?`,
                timestamp: new Date(),
                actions: [
                    { label: 'View Shipments', type: 'link', target: '/shipments' },
                    { label: 'Risk Report', type: 'action' },
                ],
            };

            setMessages(prev => [...prev, aiResponse]);
            setIsTyping(false);
        }, 1500);
    };

    const handleQuickQuestion = (question: string) => {
        setInputValue(question);
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
                        Powered by Claude AI for intelligent logistics insights
                    </p>
                </div>
                <div className="flex items-center gap-2">
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
                                            className="text-sm whitespace-pre-wrap"
                                            dangerouslySetInnerHTML={{
                                                __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                            }}
                                        />
                                        {message.actions && (
                                            <div className="flex gap-2 mt-3 pt-3 border-t border-[hsl(var(--border))]">
                                                {message.actions.map((action, i) => (
                                                    <Button key={i} size="sm" variant="outline" className="text-xs">
                                                        {action.label}
                                                    </Button>
                                                ))}
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
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 rounded-full bg-[hsl(var(--muted-foreground))] animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>

                        {/* Input Area */}
                        <div className="p-4 border-t border-[hsl(var(--border))]">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Ask me anything about your logistics..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    className="flex-1"
                                />
                                <Button onClick={handleSend} disabled={!inputValue.trim() || isTyping}>
                                    <Send className="w-4 h-4" />
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
                                    className="w-full text-left text-sm p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                >
                                    {q}
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                AI Capabilities
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {[
                                { icon: Ship, label: 'Track Shipments', desc: 'Real-time updates' },
                                { icon: FileText, label: 'Document Analysis', desc: 'AI extraction' },
                                { icon: AlertTriangle, label: 'Risk Detection', desc: 'Proactive alerts' },
                                { icon: Clock, label: 'ETA Prediction', desc: 'ML-powered' },
                            ].map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors cursor-pointer"
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
                </div>
            </div>
        </div>
    );
}
