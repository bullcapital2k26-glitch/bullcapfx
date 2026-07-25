import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShieldCheck, Clock, XCircle, CheckCircle2, Eye, Loader2, X } from "lucide-react";
import type { KycDocument } from "@shared/schema";
import type { User } from "@shared/schema";

type KycWithUser = KycDocument & { user?: User };

function StatusBadge({ status }: { status: string }) {
  if (status === "verified") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400">Verified</span>;
  if (status === "pending") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400">Pending</span>;
  if (status === "rejected") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400">Rejected</span>;
  return null;
}

function DocModal({ doc, onClose, onVerify, onReject, loading }: {
  doc: KycWithUser;
  onClose: () => void;
  onVerify: () => void;
  onReject: (note: string) => void;
  loading: boolean;
}) {
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" data-testid="kyc-modal">
      <div className="bg-card rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="font-bold">KYC Document Review</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" data-testid="button-close-modal">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
              {doc.user?.firstName?.[0] || "U"}
            </div>
            <div>
              <p className="font-bold text-sm">{doc.user?.firstName} {doc.user?.lastName}</p>
              <p className="text-xs text-muted-foreground">{doc.user?.email}</p>
            </div>
            <div className="ml-auto"><StatusBadge status={doc.status} /></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-secondary/20 rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Document Type</p>
              <p className="font-medium">{doc.documentType === "aadhaar" ? "Government ID" : "Driving License"}</p>
            </div>
            <div className="p-2 bg-secondary/20 rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Status</p>
              <p className="font-medium capitalize">{doc.status}</p>
            </div>
            <div className="p-2 bg-secondary/20 rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Full Name</p>
              <p className="font-medium">{doc.fullName}</p>
            </div>
            <div className="p-2 bg-secondary/20 rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Document No.</p>
              <p className="font-mono text-sm">{doc.documentNumber}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">Front Side</p>
              <img src={doc.frontImageData} alt="Front" className="w-full h-36 object-cover rounded-xl border border-white/10" data-testid="img-front" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">Back Side</p>
              <img src={doc.backImageData} alt="Back" className="w-full h-36 object-cover rounded-xl border border-white/10" data-testid="img-back" />
            </div>
          </div>

          {doc.adminNote && (
            <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-sm text-rose-400">
              <strong>Admin Note:</strong> {doc.adminNote}
            </div>
          )}

          {doc.status === "pending" && (
            <div className="space-y-2">
              {showRejectInput ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    placeholder="Rejection reason (optional)"
                    className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-rose-500"
                    data-testid="input-reject-note"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { onReject(rejectNote); }}
                      disabled={loading}
                      className="py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                      data-testid="button-confirm-reject"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4" /> Reject</>}
                    </button>
                    <button onClick={() => setShowRejectInput(false)} className="py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-sm font-bold transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onVerify}
                    disabled={loading}
                    className="py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                    data-testid="button-verify-kyc"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Verify</>}
                  </button>
                  <button
                    onClick={() => setShowRejectInput(true)}
                    disabled={loading}
                    className="py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-sm border border-rose-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                    data-testid="button-reject-kyc"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminKYC() {
  const { toast } = useToast();
  const [selectedDoc, setSelectedDoc] = useState<KycWithUser | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "rejected">("all");

  const { data: docs, isLoading } = useQuery<KycWithUser[]>({
    queryKey: ["/api/admin/kyc"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote?: string }) => {
      return await apiRequest("PATCH", `/api/admin/kyc/${id}`, { status, adminNote });
    },
    onSuccess: (_, vars) => {
      toast({
        title: vars.status === "verified" ? "KYC Verified" : "KYC Rejected",
        description: vars.status === "verified" ? "Document has been verified successfully." : "Document has been rejected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc"] });
      setSelectedDoc(null);
    },
    onError: (err: any) => {
      toast({ title: "Action Failed", description: err.message, variant: "destructive" });
    },
  });

  const filtered = docs?.filter(d => filter === "all" || d.status === filter) || [];
  const counts = {
    all: docs?.length || 0,
    pending: docs?.filter(d => d.status === "pending").length || 0,
    verified: docs?.filter(d => d.status === "verified").length || 0,
    rejected: docs?.filter(d => d.status === "rejected").length || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold font-display" data-testid="admin-kyc-title">KYC Verification</h1>
          <p className="text-sm text-muted-foreground">Review and verify user identity documents</p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {(["all", "pending", "verified", "rejected"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "p-3 rounded-xl border text-sm font-medium transition-all text-left",
                filter === f ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-card border-white/5 hover:border-white/10"
              )}
              data-testid={`filter-${f}`}
            >
              <p className="text-lg font-bold font-mono">{counts[f]}</p>
              <p className="text-xs text-muted-foreground capitalize">{f}</p>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No KYC documents found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-4 p-4 bg-card rounded-xl border border-white/5 hover:border-white/10 transition-all"
                data-testid={`kyc-row-${doc.id}`}
              >
                <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center font-bold text-sm shrink-0">
                  {doc.user?.firstName?.[0] || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{doc.user?.firstName} {doc.user?.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{doc.user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {doc.documentType === "aadhaar" ? "Government ID" : "Driving License"} · Submitted {doc.submittedAt ? new Date(doc.submittedAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={doc.status} />
                  <button
                    onClick={() => setSelectedDoc(doc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-xs font-bold transition-all"
                    data-testid={`button-review-${doc.id}`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDoc && (
        <DocModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onVerify={() => updateMutation.mutate({ id: selectedDoc.id, status: "verified" })}
          onReject={(note) => updateMutation.mutate({ id: selectedDoc.id, status: "rejected", adminNote: note })}
          loading={updateMutation.isPending}
        />
      )}
    </AdminLayout>
  );
}
