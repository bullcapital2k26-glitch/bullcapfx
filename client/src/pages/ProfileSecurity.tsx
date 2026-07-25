import { useLocation } from "wouter";
import { ArrowLeft, Key, Eye, Shield, Loader2, X, Trash2 } from "lucide-react";
import { useState } from "react";
import { BottomNav } from "@/components/Navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (ua.includes("Mobile")) {
    if (ua.includes("Android")) return "Android Mobile";
    if (ua.includes("iPhone")) return "iPhone";
    return "Mobile Browser";
  }
  if (ua.includes("Windows")) return "Windows PC";
  if (ua.includes("Mac")) return "Mac";
  if (ua.includes("Linux")) return "Linux PC";
  return "Desktop Browser";
}

type LoginEntry = { id: number; ipAddress: string | null; userAgent: string | null; createdAt: string };
type SessionEntry = { id: string; displayId: string; expire: string; isCurrent: boolean };

export default function ProfileSecurity() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword, confirmPassword });
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated successfully" });
      setShowChangePassword(false);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to change password", variant: "destructive" });
    },
  });

  const { data: loginHistoryData, isLoading: historyLoading } = useQuery<LoginEntry[]>({
    queryKey: ["/api/user/login-history"],
    enabled: showLoginHistory,
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<SessionEntry[]>({
    queryKey: ["/api/user/sessions"],
    enabled: showSessions,
  });

  const revokeSession = useMutation({
    mutationFn: async (sid: string) => {
      await apiRequest("DELETE", `/api/user/sessions/${sid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/sessions"] });
      toast({ title: "Session revoked", description: "The session has been terminated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to revoke session", variant: "destructive" });
    },
  });

  const securityItems = [
    { icon: Key, label: "Change Password", desc: "Update your account password", onClick: () => setShowChangePassword(true) },
    { icon: Eye, label: "Login History", desc: "View recent account activity", onClick: () => setShowLoginHistory(true) },
    { icon: Shield, label: "Active Sessions", desc: "Manage your active sessions", onClick: () => setShowSessions(true) },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-6 pt-12 pb-6 bg-gradient-to-b from-secondary/30 to-background border-b border-border">
        <div className="flex items-center gap-4">
          <button onClick={() => setLocation("/profile")} className="p-2 rounded-lg hover:bg-secondary/50 transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold font-display" data-testid="text-page-title">Security</h1>
            <p className="text-sm text-muted-foreground">Account security settings</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-3">
        {securityItems.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            className="w-full flex items-center gap-4 p-4 bg-card hover:bg-card/80 rounded-xl border border-border transition-all group"
            data-testid={`button-${item.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center text-foreground group-hover:text-primary transition-colors">
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-bold text-sm">{item.label}</h4>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {showChangePassword && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" data-testid="modal-change-password">
          <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-display">Change Password</h2>
              <button onClick={() => setShowChangePassword(false)} className="p-2 rounded-lg hover:bg-secondary/50" data-testid="button-close-modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Current Password</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" data-testid="input-current-password" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" data-testid="input-new-password" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" data-testid="input-confirm-password" />
              </div>
            </div>
            <button onClick={() => changePasswordMutation.mutate()}
              disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-submit-password">
              {changePasswordMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : "Update Password"}
            </button>
          </div>
        </div>
      )}

      {showLoginHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" data-testid="modal-login-history">
          <div className="bg-card w-full sm:max-w-md max-h-[80vh] rounded-t-2xl sm:rounded-2xl border border-border p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-display">Login History</h2>
              <button onClick={() => setShowLoginHistory(false)} className="p-2 rounded-lg hover:bg-secondary/50" data-testid="button-close-history">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {historyLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : !loginHistoryData || loginHistoryData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No login history yet</p>
              ) : (
                loginHistoryData.map((entry) => (
                  <div key={entry.id} className="p-3 bg-secondary/30 rounded-xl border border-border" data-testid={`login-entry-${entry.id}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{parseUserAgent(entry.userAgent)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">IP: {entry.ipAddress || "Unknown"}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showSessions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" data-testid="modal-active-sessions">
          <div className="bg-card w-full sm:max-w-md max-h-[80vh] rounded-t-2xl sm:rounded-2xl border border-border p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-display">Active Sessions</h2>
              <button onClick={() => setShowSessions(false)} className="p-2 rounded-lg hover:bg-secondary/50" data-testid="button-close-sessions">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {sessionsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : !sessionsData || sessionsData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No active sessions</p>
              ) : (
                sessionsData.map((session) => (
                  <div key={session.id} className="p-3 bg-secondary/30 rounded-xl border border-border flex items-center gap-3" data-testid={`session-${session.displayId}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium">Session {session.displayId}</span>
                        {session.isCurrent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">CURRENT</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Expires: {new Date(session.expire).toLocaleDateString()} {new Date(session.expire).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!session.isCurrent && (
                      <button
                        onClick={() => revokeSession.mutate(session.id)}
                        disabled={revokeSession.isPending}
                        className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                        data-testid={`button-revoke-${session.displayId}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
