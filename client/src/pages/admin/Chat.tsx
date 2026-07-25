import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { useChatMessages } from "@/hooks/use-websocket";
import { Loader2, Send, X, Paperclip, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation, Message, User } from "@shared/schema";

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
      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
      <span className="text-xs text-amber-400 truncate">{name || "Download file"}</span>
    </a>
  );
}

export default function AdminChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConv, setActiveConv] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: conversations, isLoading } = useQuery<(Conversation & { user?: User; lastMessage?: string })[]>({
    queryKey: ["/api/chat/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/chat/conversations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 5000,
  });

  useChatMessages((msg) => {
    if (activeConv && msg.conversationId === activeConv) {
      setMessages(prev => [...prev, msg]);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
  });

  const loadMessages = async (convId: number) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`, { credentials: "include" });
      if (res.ok) setMessages(await res.json());
    } catch {}
    setLoadingMsgs(false);
  };

  useEffect(() => { if (activeConv) loadMessages(activeConv); }, [activeConv]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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

  const closeConversation = async (convId: number) => {
    await fetch(`/api/chat/conversations/${convId}`, {
      method: "PATCH",
      credentials: "include",
    });
    queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
  };

  const activeConvData = conversations?.find(c => c.id === activeConv);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-display font-bold mb-6" data-testid="text-admin-chat">Support Chat</h1>

      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        <div className="w-full md:w-80 flex-shrink-0 space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
          ) : conversations?.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No conversations</p>
          ) : (
            conversations?.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv.id)}
                className={cn(
                  "w-full p-3 rounded-xl border text-left transition-all",
                  activeConv === conv.id ? "bg-amber-500/10 border-amber-500/30" : "bg-card border-white/5 hover:border-white/10"
                )}
                data-testid={`admin-conv-${conv.id}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <p className="font-bold text-sm">{conv.user?.firstName} {conv.user?.lastName}</p>
                    <p className="text-[10px] text-muted-foreground">{conv.user?.email}</p>
                  </div>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full",
                    conv.status === "open" ? "bg-emerald-400/10 text-emerald-400" : "bg-secondary text-muted-foreground"
                  )}>
                    {conv.status}
                  </span>
                </div>
                {conv.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate mt-1">{conv.lastMessage}</p>
                )}
              </button>
            ))
          )}
        </div>

        <div className="hidden md:flex flex-1 flex-col bg-card rounded-2xl border border-white/5 overflow-hidden">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation to reply
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div>
                  <h3 className="font-bold text-sm">{activeConvData?.user?.firstName} {activeConvData?.user?.lastName}</h3>
                  <p className="text-xs text-muted-foreground">{activeConvData?.subject}</p>
                </div>
                <div className="flex gap-2">
                  {activeConvData?.status === "open" && (
                    <button
                      onClick={() => closeConversation(activeConv)}
                      className="px-3 py-1 bg-secondary text-muted-foreground rounded-lg text-xs font-medium hover:bg-secondary/80"
                      data-testid="button-close-conversation"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={cn("max-w-[70%] p-3 rounded-2xl text-sm",
                        msg.isAdmin
                          ? "bg-amber-500/20 text-foreground ml-auto rounded-br-none"
                          : "bg-secondary/50 text-foreground rounded-bl-none"
                      )}
                      data-testid={`admin-msg-${msg.id}`}
                    >
                      {msg.content && <p>{msg.content}</p>}
                      {msg.attachmentUrl && (
                        <AttachmentRender url={msg.attachmentUrl} name={msg.attachmentName} />
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''}
                      </p>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {attachmentUrl && (
                <div className="flex items-center gap-2 mx-3 mb-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  {isImageUrl(attachmentUrl) ? (
                    <img src={attachmentUrl} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                  <span className="text-xs text-foreground truncate flex-1">{attachmentName}</span>
                  <button onClick={clearAttachment} className="p-1 hover:bg-white/10 rounded" data-testid="button-admin-clear-attachment">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}

              <div className="p-3 border-t border-white/5 flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-admin-file-upload"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-all shrink-0 disabled:opacity-50"
                  data-testid="button-admin-attach-file"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a reply..."
                  className="flex-1 bg-secondary/50 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  data-testid="input-admin-chat"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || (!input.trim() && !attachmentUrl)}
                  className="w-10 h-10 bg-amber-500 text-black rounded-xl flex items-center justify-center hover:bg-amber-400 transition-all disabled:opacity-50"
                  data-testid="button-admin-send"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
