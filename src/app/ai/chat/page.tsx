"use client";

import { ToolWorkspace } from "@/components/layout/tool-workspace";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, User, Bot, Trash2 } from "lucide-react";
import { generateChat, hasApiKey, getErrorMessage } from "@/lib/gemini";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;
        if (!hasApiKey()) {
            setError("Please configure your API key in the AI hub first.");
            return;
        }

        const userMessage: Message = { role: "user", content: input.trim() };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);
        setError(null);

        try {
            const response = await generateChat([...messages, userMessage]);
            setMessages(prev => [...prev, { role: "assistant", content: response }]);
        } catch (err) {
            setMessages(messages);
            setInput(userMessage.content);
            setError(getErrorMessage(err));
        }

        setIsLoading(false);
    };

    const clearChat = () => {
        setMessages([]);
        setError(null);
    };

    return (
        <ToolWorkspace category="AI tools" backHref="/ai" title="AI Chat" description="Continue a conversation with your Google Gemini API key.">
            <div className="utility-body mx-auto flex min-h-[34rem] w-full max-w-3xl flex-col rounded-2xl border bg-card p-4 sm:p-5">
                {messages.length > 0 && <div className="mb-3 flex justify-end"><Button variant="outline" size="sm" onClick={clearChat} disabled={isLoading}><Trash2 />Clear</Button></div>}

            {/* Messages */}
            <div role="log" aria-label="Conversation" className="min-h-60 max-h-[65vh] flex-1 overflow-y-auto rounded-xl border bg-muted/30 p-4 mb-4">
                {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        Start a conversation...
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg, i) => (
                            <div key={i} data-message-role={msg.role} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                                {msg.role === "assistant" && (
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Bot className="h-4 w-4 text-primary" />
                                    </div>
                                )}
                                <div className={`max-w-[80%] wrap-anywhere rounded-xl p-3 ${msg.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-background border"
                                    }`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                                {msg.role === "user" && (
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                        <User className="h-4 w-4" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                </div>
                                <div className="bg-background border rounded-xl p-3">
                                    <p className="text-sm text-muted-foreground">Thinking...</p>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-3 mb-4">
                    <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
                <Textarea
                    value={input}
                    aria-label="Message" disabled={isLoading}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="min-h-[60px] resize-none"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                />
                <Button onClick={sendMessage} disabled={!input.trim() || isLoading} className="h-auto" aria-label="Send message">
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
                Requests go directly to Google Gemini
            </p>
            </div>
        </ToolWorkspace>
    );
}
