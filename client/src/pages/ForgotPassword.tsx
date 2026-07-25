import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold text-lg">B</div>
            <span className="font-display font-bold text-2xl">Bull Capital FX</span>
          </div>
          <h1 className="text-2xl font-display font-bold mb-2" data-testid="heading-forgot-password">Reset Password</h1>
          <p className="text-muted-foreground text-sm">Enter your email to request a password reset</p>
        </div>

        {submitted ? (
          <div className="bg-card rounded-2xl p-6 border border-white/5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-green-400" />
            </div>
            <h2 className="font-bold text-lg" data-testid="text-reset-submitted">Request Submitted</h2>
            <p className="text-sm text-muted-foreground">
              If an account with this email exists, a reset link has been generated. Please contact support via live chat or email to receive your reset link.
            </p>
            <Link href="/login" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium" data-testid="link-back-login">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-6 border border-white/5 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                data-testid="input-reset-email"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="button-submit-reset"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Reset Request"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/login" className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1" data-testid="link-login">
            <ArrowLeft className="w-3 h-3" /> Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
