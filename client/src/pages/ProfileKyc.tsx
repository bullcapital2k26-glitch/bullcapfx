import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ShieldCheck, Upload, Loader2, CheckCircle2, Clock, XCircle, FileText } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { KycDocument } from "@shared/schema";

const DOC_TYPES = [
  { value: "aadhaar", label: "Government ID" },
  { value: "driving_license", label: "Driving License" },
];

function StatusBanner({ status, adminNote }: { status: string; adminNote?: string | null }) {
  if (status === "verified") {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20" data-testid="kyc-status-verified">
        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-emerald-400">KYC Verified</p>
          <p className="text-sm text-muted-foreground mt-0.5">Your identity has been successfully verified.</p>
        </div>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20" data-testid="kyc-status-pending">
        <Clock className="w-6 h-6 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-primary">Verification Pending</p>
          <p className="text-sm text-muted-foreground mt-0.5">Your documents are under review. This usually takes 1–2 business days.</p>
        </div>
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20" data-testid="kyc-status-rejected">
        <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-rose-400">Verification Rejected</p>
          {adminNote && <p className="text-sm text-muted-foreground mt-0.5">Reason: {adminNote}</p>}
          <p className="text-sm text-muted-foreground mt-1">Please re-upload your documents below.</p>
        </div>
      </div>
    );
  }
  return null;
}

function compressImage(file: File, maxWidth = 1000, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Failed to load image")); };
    img.src = objectUrl;
  });
}

function ImageUploadBox({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => onChange(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">{label}</label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "w-full h-36 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 overflow-hidden",
          value ? "border-emerald-500/40 bg-emerald-500/5" : "border-border hover:border-primary/50 bg-secondary/30"
        )}
        data-testid={testId}
      >
        {value ? (
          <img src={value} alt={label} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <>
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tap to upload photo</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}

export default function ProfileKyc() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: kyc, isLoading } = useQuery<KycDocument | null>({
    queryKey: ["/api/kyc"],
  });

  const [docType, setDocType] = useState("aadhaar");
  const [fullName, setFullName] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [frontImg, setFrontImg] = useState("");
  const [backImg, setBackImg] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/kyc", {
        documentType: docType,
        fullName: fullName.trim(),
        documentNumber: docNumber.trim(),
        frontImageData: frontImg,
        backImageData: backImg,
      });
    },
    onSuccess: () => {
      toast({ title: "Documents Submitted", description: "Your KYC documents are under review." });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc"] });
      setFullName("");
      setDocNumber("");
      setFrontImg("");
      setBackImg("");
    },
    onError: (err: any) => {
      toast({ title: "Submission Failed", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  const canSubmit = fullName.trim().length >= 2 && docNumber.trim().length >= 4 && frontImg && backImg;
  const isVerified = kyc?.status === "verified";
  const isPending = kyc?.status === "pending";

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="flex items-center gap-3 px-4 py-4 bg-card border-b border-border shrink-0">
        <button
          onClick={() => setLocation("/profile")}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          data-testid="button-back-profile"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base">KYC Verification</h1>
          <p className="text-xs text-muted-foreground">Identity document verification</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {kyc && <StatusBanner status={kyc.status} adminNote={kyc.adminNote} />}

            {!kyc && (
              <div className="p-4 rounded-2xl bg-secondary/40 border border-border">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Why verify your identity?</p>
                    <p className="text-xs text-muted-foreground mt-1">KYC verification is required to enable withdrawals and higher trading limits. It only takes a few minutes.</p>
                  </div>
                </div>
              </div>
            )}

            {!isVerified && !isPending && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Document Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DOC_TYPES.map(dt => (
                      <button
                        key={dt.value}
                        onClick={() => setDocType(dt.value)}
                        className={cn(
                          "p-3 rounded-xl border text-sm font-medium transition-all",
                          docType === dt.value
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                        )}
                        data-testid={`button-doctype-${dt.value}`}
                      >
                        {dt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name (as on document)</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    data-testid="input-full-name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Document Number</label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={e => setDocNumber(e.target.value)}
                    placeholder={docType === "aadhaar" ? "XXXX XXXX XXXX" : "DL-XXXXXXXXXX"}
                    className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors font-mono"
                    data-testid="input-document-number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ImageUploadBox
                    label="Front Side"
                    value={frontImg}
                    onChange={setFrontImg}
                    testId="button-upload-front"
                  />
                  <ImageUploadBox
                    label="Back Side"
                    value={backImg}
                    onChange={setBackImg}
                    testId="button-upload-back"
                  />
                </div>

                <p className="text-[11px] text-muted-foreground text-center">
                  Ensure photos are clear, well-lit, and all corners are visible.
                </p>

                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={!canSubmit || submitMutation.isPending}
                  className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/80 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="button-submit-kyc"
                >
                  {submitMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4" /> Submit for Verification</>
                  )}
                </button>
              </div>
            )}

            {isPending && kyc && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Submitted Document</h3>
                <div className="p-4 bg-card rounded-xl border border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{kyc.documentType === "aadhaar" ? "Government ID" : "Driving License"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{kyc.fullName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Document No.</span>
                    <span className="font-mono text-sm">{kyc.documentNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Submitted</span>
                    <span className="text-xs">{kyc.submittedAt ? new Date(kyc.submittedAt).toLocaleDateString() : "—"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Front</p>
                    <img src={kyc.frontImageData} alt="Front" className="w-full h-28 object-cover rounded-xl border border-border" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Back</p>
                    <img src={kyc.backImageData} alt="Back" className="w-full h-28 object-cover rounded-xl border border-border" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
