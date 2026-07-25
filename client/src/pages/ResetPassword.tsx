import { useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") || "";
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-card rounded-2xl p-6 border border-white/5 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="font-bold text-lg" data-testid="text-invalid-token">Invalid Reset Link</h2>
          <p className="text-sm text-muted-foreground">This password reset link is invalid or missing a token.</p>
          <Link href="/login" className="text-primary hover:text-primary/80 text-sm font-medium" data-testid="link-login">Back to Login</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Reset failed");
        return;
      }
      setSuccess(true);
      toast({ title: "Password Reset Successfully", description: "You can now sign in with your new password." });
      setTimeout(() => setLocation("/login"), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md bg-card rounded-2xl p-6 border border-white/5 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
          <h2 className="font-bold text-lg" data-testid="text-reset-success">Password Reset Successful</h2>
          <p className="text-sm text-muted-foreground">Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold text-lg">B</div>
            <span className="font-display font-bold text-2xl">Bull Capital FX</span>
          </div>
          <h1 className="text-2xl font-display font-bold mb-2" data-testid="heading-reset-password">Set New Password</h1>
          <p className="text-muted-foreground text-sm">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-6 border border-white/5 space-y-4">
          {error && (
            <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2" data-testid="text-reset-error">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:border-primary transition-colors"
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
              data-testid="input-confirm-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="button-reset-password"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Reset Password <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
