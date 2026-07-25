import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="bg-card p-8 rounded-2xl border border-white/5 shadow-2xl text-center max-w-md w-full">
        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
        </div>
        <h1 className="text-4xl font-bold mb-4 font-display" data-testid="text-404">404</h1>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <a className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/80 transition-all w-full" data-testid="link-return-home">
            Return Home
          </a>
        </Link>
      </div>
    </div>
  );
}
