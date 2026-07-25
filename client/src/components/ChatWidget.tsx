import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useChatMessages } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";
import type { Conversation, Message } from "@shared/schema";

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<(Conversation & { lastMessage?: string })[]>([]);
  const [activeConv, setActiveConv] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useChatMessages((msg) => {
    if (activeConv && msg.conversationId === activeConv) {
      setMessages(prev => [...prev, msg]);
    }
    loadConversations();
  });

  const loadConversations = async () => {
    try {
      const res = await fetch("/api/chat/conversations", { credentials: "include" });
      if (res.ok) setConversations(await res.json());
    } catch {}
  };

  const loadMessages = async (convId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`, { credentials: "include" });
      if (res.ok) setMessages(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadConversations();
  }, [open]);

  useEffect(() => {
    if (activeConv) loadMessages(activeConv);
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createConversation = async () => {
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "Support Request" }),
        credentials: "include",
      });
      if (res.ok) {
        const conv = await res.json();
        setActiveConv(conv.id);
        loadConversations();
      }
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConv) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/conversations/${activeConv}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
        credentials: "include",
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setInput("");
      }
    } catch {}
    setSending(false);
  };

  if (!user) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-primary text-white rounded-full shadow-lg shadow-primary/25 flex items-center justify-center hover:bg-primary/80 transition-all"
          data-testid="button-chat-open"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-96 z-50 bg-card rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[70vh] overflow-hidden" data-testid="chat-widget">
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-card/95">
            <div className="flex items-center gap-2">
              {activeConv && (
                <button onClick={() => { setActiveConv(null); setMessages([]); }} className="p-1 hover:bg-white/10 rounded" data-testid="button-chat-back">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="font-bold text-sm">
                {activeConv ? "Support Chat" : "Help & Support"}
              </h3>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded" data-testid="button-chat-close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
            {!activeConv ? (
              <div className="space-y-3">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <p className="mb-4">No conversations yet.</p>
                    <button
                      onClick={createConversation}
                      className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/80 transition-all"
                      data-testid="button-new-conversation"
                    >
                      Start New Conversation
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={createConversation}
                      className="w-full px-4 py-3 bg-primary/10 border border-primary/20 text-primary rounded-xl font-bold text-sm hover:bg-primary/20 transition-all mb-2"
                      data-testid="button-new-conversation"
                    >
                      + New Conversation
                    </button>
                    {conversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => setActiveConv(conv.id)}
                        className="w-full p-3 bg-secondary/30 rounded-xl border border-white/5 hover:border-white/10 text-left transition-all"
                        data-testid={`conversation-${conv.id}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sm">{conv.subject}</span>
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full", conv.status === "open" ? "bg-emerald-400/10 text-emerald-400" : "bg-secondary text-muted-foreground")}>
                            {conv.status}
                          </span>
                        </div>
                        {conv.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                        )}
                      </button>
                    ))}
                  </>
                )}
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-4">Send a message to start the conversation.</p>
                )}
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn("max-w-[80%] p-3 rounded-2xl text-sm", msg.senderId === user?.id
                      ? "bg-primary/20 text-foreground ml-auto rounded-br-none"
                      : "bg-secondary/50 text-foreground rounded-bl-none"
                    )}
                    data-testid={`message-${msg.id}`}
                  >
                    {msg.isAdmin && msg.senderId !== user?.id && (
                      <p className="text-[10px] text-primary font-bold mb-1">Support Agent</p>
                    )}
                    <p>{msg.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''}
                    </p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {activeConv && (
            <div className="p-3 border-t border-white/5 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-secondary/50 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                data-testid="input-chat-message"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/80 transition-all disabled:opacity-50"
                data-testid="button-send-message"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
