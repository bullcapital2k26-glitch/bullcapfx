import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Loader2, ChevronLeft, Headphones, Paperclip, X, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useChatMessages } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import type { Conversation, Message } from "@shared/schema";

type MessageWithSender = Message & { senderName?: string; senderEmail?: string };

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp)$/i.test(url);
}

function AttachmentRender({ url, name }: { url: string; name?: string | null }) {
  if (isImageUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
        <img src={url} alt={name || "attachment"} className="max-w-[220px] rounded-lg border border-white/10" data-testid="img-attachment" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-1.5 px-3 py-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors" data-testid="link-attachment">
      <FileText className="w-4 h-4 text-primary shrink-0" />
      <span className="text-xs text-primary truncate">{name || "Download file"}</span>
    </a>
  );
}

export default function OnlineService() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [conversations, setConversations] = useState<(Conversation & { lastMessage?: string })[]>([]);
  const [activeConv, setActiveConv] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useChatMessages((msg) => {
    if (activeConv && msg.conversationId === activeConv) {
      loadMessages(activeConv);   // reload to get senderName from API
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

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { if (activeConv) loadMessages(activeConv); }, [activeConv]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/chat/upload", { method: "POST", body: formData, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAttachmentUrl(data.url);
        setAttachmentName(data.name);
      }
    } catch {}
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearAttachment = () => {
    setAttachmentUrl(null);
    setAttachmentName(null);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachmentUrl) || !activeConv) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/conversations/${activeConv}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: input.trim() || "",
          ...(attachmentUrl ? { attachmentUrl, attachmentName } : {}),
        }),
        credentials: "include",
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setInput("");
        clearAttachment();
      }
    } catch {}
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 bg-card border-b border-white/5 shrink-0">
        <button
          onClick={() => setLocation("/profile")}
          className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back-profile"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
          <Headphones className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base">Online Service</h1>
          <p className="text-xs text-muted-foreground">Live support — we're here to help</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">Online</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 py-4 overflow-hidden">
        {!activeConv ? (
          <div className="flex-1 flex flex-col gap-4">
            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/15 text-center">
              <MessageCircle className="w-10 h-10 text-primary mx-auto mb-3" />
              <h2 className="font-bold text-lg mb-1">How can we help?</h2>
              <p className="text-sm text-muted-foreground mb-4">Our support team typically replies within a few minutes.</p>
              <button
                onClick={createConversation}
                className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/80 transition-all"
                data-testid="button-new-conversation"
              >
                Start New Conversation
              </button>
            </div>

            {conversations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Previous Conversations</h3>
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConv(conv.id)}
                    className="w-full p-4 bg-card rounded-xl border border-white/5 hover:border-white/10 text-left transition-all"
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
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5 mb-4">
              <button
                onClick={() => { setActiveConv(null); setMessages([]); clearAttachment(); }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                data-testid="button-chat-back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-sm">Support Chat</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pb-4" data-testid="messages-container">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="text-center py-10">
                      <h3 className="font-bold text-base text-foreground mb-1">Welcome to Bull Capital FX</h3>
                      <p className="text-sm text-primary mb-3">Your one stop trading partner</p>
                      <p className="text-xs text-muted-foreground">Send a message and our team will assist you shortly.</p>
                    </div>
                  )}
                  {messages.map(msg => {
                    const isOwn = msg.senderId === user?.id;
                    const displayName = msg.isAdmin
                      ? "Support Agent"
                      : (msg.senderName || msg.senderEmail || "Client");
                    return (
                      <div
                        key={msg.id}
                        className={cn("max-w-[80%] flex flex-col", isOwn ? "ml-auto items-end" : "items-start")}
                        data-testid={`message-${msg.id}`}
                      >
                        <p className={cn(
                          "text-[11px] font-semibold mb-1 px-1",
                          isOwn ? "text-primary/70" : msg.isAdmin ? "text-primary" : "text-emerald-400"
                        )}>
                          {displayName}
                        </p>
                        <div className={cn(
                          "p-3 rounded-2xl text-sm",
                          isOwn
                            ? "bg-primary/20 text-foreground rounded-br-none"
                            : "bg-card border border-white/5 text-foreground rounded-bl-none"
                        )}>
                          {msg.content && <p>{msg.content}</p>}
                          {msg.attachmentUrl && (
                            <AttachmentRender url={msg.attachmentUrl} name={msg.attachmentName} />
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {attachmentUrl && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl mb-2">
                {isImageUrl(attachmentUrl) ? (
                  <img src={attachmentUrl} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                )}
                <span className="text-xs text-foreground truncate flex-1">{attachmentName}</span>
                <button onClick={clearAttachment} className="p-1 hover:bg-white/10 rounded" data-testid="button-clear-attachment">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-white/5 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-upload"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-11 h-11 flex items-center justify-center rounded-xl border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-all shrink-0 disabled:opacity-50"
                data-testid="button-attach-file"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-secondary/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                data-testid="input-chat-message"
              />
              <button
                onClick={sendMessage}
                disabled={sending || (!input.trim() && !attachmentUrl)}
                className="w-11 h-11 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/80 transition-all disabled:opacity-50 shrink-0"
                data-testid="button-send-message"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
