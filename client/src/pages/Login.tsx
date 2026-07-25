import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Login Failed", description: data.message, variant: "destructive" });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-3 mb-4">
            <img src="/logo.svg" alt="Bull Capital FX" className="w-28 h-28 md:w-[135px] md:h-[135px] object-contain" data-testid="logo-icon" />
            <span className="font-display font-bold text-2xl md:text-3xl" data-testid="brand-name">Bull Capital FX</span>
          </div>
          <h1 className="text-2xl font-display font-bold mb-2" data-testid="login-heading">Welcome Back</h1>
          <p className="text-muted-foreground text-sm">Sign in to your trading account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-6 border border-white/5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
              data-testid="input-email"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full bg-secondary/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:border-primary transition-colors"
                data-testid="input-password"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primary/80 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="button-login"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link href="/forgot-password" className="text-primary hover:text-primary/80 font-medium" data-testid="link-forgot-password">
            Forgot Password?
          </Link>
        </p>

        <p className="text-center text-sm text-muted-foreground mt-3">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary hover:text-primary/80 font-medium" data-testid="link-signup">
            Create Account
          </Link>
        </p>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Risk Warning: CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.
        </p>
      </div>
    </div>
  );
}
