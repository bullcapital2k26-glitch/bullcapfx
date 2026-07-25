import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Search, Loader2, Eye, EyeOff, KeyRound, Copy, Clock, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User, Account } from "@shared/schema";
import { formatUSD } from "@/lib/currency";

type ResetRequest = {
  id: number;
  userId: string;
  token: string;
  email: string;
  name: string;
  createdAt: string;
  expiresAt: string;
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [passwordUser, setPasswordUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "resets">("users");
  const [copiedToken, setCopiedToken] = useState<number | null>(null);

  const { data: users, isLoading } = useQuery<(User & { account?: Account })[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: resetRequests, isLoading: resetsLoading } = useQuery<ResetRequest[]>({
    queryKey: ["/api/admin/password-reset-requests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/password-reset-requests", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const res = await fetch(`/api/admin/users/${userId}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Balance Updated" });
      setSelectedUser(null);
      setAdjustAmount("");
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      const user = users?.find(u => u.id === passwordUser);
      toast({ title: "Password Updated", description: `Password updated for ${user?.firstName || "user"}` });
      setPasswordUser(null);
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleResetPassword = (userId: string) => {
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    resetPasswordMutation.mutate({ userId, newPassword });
  };

  const copyResetLink = (token: string, id: number) => {
    const link = `${window.location.origin}/reset-password?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(id);
    toast({ title: "Link Copied", description: "Reset link copied to clipboard" });
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const filtered = users?.filter(u =>
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.firstName || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.lastName || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.ibCode || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <h1 className="text-2xl font-display font-bold mb-6" data-testid="text-admin-users">Users</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "users" ? "bg-amber-500 text-black" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
          data-testid="tab-users"
        >
          All Users
        </button>
        <button
          onClick={() => setActiveTab("resets")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "resets" ? "bg-amber-500 text-black" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
          data-testid="tab-reset-requests"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Password Resets
          {resetRequests && resetRequests.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {resetRequests.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "users" && (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or IB code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-secondary/50 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              data-testid="input-search-users"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
          ) : (
            <div className="space-y-3">
              {filtered?.map(u => (
                <div key={u.id} className="bg-card p-4 rounded-xl border border-white/5" data-testid={`user-card-${u.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center font-bold text-sm overflow-hidden">
                      {u.profileImageUrl ? (
                        <img src={u.profileImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (u.firstName?.[0] || 'U')
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{u.firstName} {u.lastName}</h4>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      {u.ibCode && <p className="text-[10px] text-amber-400">IB: {u.ibCode}</p>}
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-bold text-sm">{formatUSD(parseFloat(u.account?.balance || "0"))}</p>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setSelectedUser(selectedUser === u.id ? null : u.id); setPasswordUser(null); }}
                          className="text-[10px] text-amber-400 hover:underline font-medium"
                          data-testid={`button-adjust-${u.id}`}
                        >
                          Adjust Balance
                        </button>
                        <button
                          onClick={() => { setPasswordUser(passwordUser === u.id ? null : u.id); setSelectedUser(null); setNewPassword(""); setConfirmPassword(""); }}
                          className="text-[10px] text-blue-400 hover:underline font-medium"
                          data-testid={`button-set-password-${u.id}`}
                        >
                          Set Password
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedUser === u.id && (
                    <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                      <input
                        type="number"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        placeholder="Amount (negative to deduct)"
                        className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        data-testid="input-adjust-amount"
                      />
                      <button
                        onClick={() => adjustMutation.mutate({ userId: u.id, amount: parseFloat(adjustAmount) })}
                        disabled={adjustMutation.isPending || !adjustAmount}
                        className="px-4 py-2 bg-amber-500 text-black rounded-lg font-bold text-sm hover:bg-amber-400 transition-all disabled:opacity-50"
                        data-testid="button-confirm-adjust"
                      >
                        {adjustMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                  )}

                  {passwordUser === u.id && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                      <p className="text-xs text-muted-foreground font-medium">Set new password for {u.firstName || u.email}</p>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password (min 6 characters)"
                          className="w-full bg-secondary/50 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          data-testid="input-admin-new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          data-testid="button-toggle-admin-password"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        data-testid="input-admin-confirm-password"
                      />
                      <button
                        onClick={() => handleResetPassword(u.id)}
                        disabled={resetPasswordMutation.isPending || !newPassword || !confirmPassword}
                        className="w-full py-2 bg-blue-500 text-white rounded-lg font-bold text-sm hover:bg-blue-400 transition-all disabled:opacity-50"
                        data-testid="button-admin-reset-password"
                      >
                        {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {filtered?.length === 0 && <p className="text-center py-10 text-muted-foreground">No users found</p>}
            </div>
          )}
        </>
      )}

      {activeTab === "resets" && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Pending password reset requests from users. Copy the reset link and share it with the user via chat or email.
          </p>
          {resetsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
          ) : resetRequests && resetRequests.length > 0 ? (
            <div className="space-y-3">
              {resetRequests.map(r => (
                <div key={r.id} className="bg-card p-4 rounded-xl border border-white/5" data-testid={`reset-request-${r.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm">{r.name || "Unknown"}</h4>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Requested: {new Date(r.createdAt).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Expires: {new Date(r.expiresAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => copyResetLink(r.token, r.id)}
                      className="px-4 py-2 bg-amber-500 text-black rounded-lg font-bold text-sm hover:bg-amber-400 transition-all flex items-center gap-2"
                      data-testid={`button-copy-reset-link-${r.id}`}
                    >
                      {copiedToken === r.id ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No pending reset requests</p>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
