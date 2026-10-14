'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/dashboard');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Network communication failure. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {/* Background ambient solar glow */}
      <div className="absolute top-1/4 h-80 w-80 rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />

      <div className="panel-chassis relative w-full max-w-sm p-6 sm:p-8">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center pb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary shadow-lg shadow-primary/10 mb-3">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16v16H4z" />
              <path d="M9 4v16" />
              <path d="M15 4v16" />
              <path d="M4 12h16" opacity="0.3" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            CURTAIN OS
          </h1>
          <p className="text-xs font-mono text-muted-foreground pt-0.5">
            Architectural Automation Cockpit
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs font-mono text-muted-foreground uppercase">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="h-10 border-border/80 bg-[#090b10] text-sm text-foreground focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-mono text-muted-foreground uppercase">
                Password
              </Label>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="h-10 border-border/80 bg-[#090b10] text-sm text-foreground focus-visible:ring-primary"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium text-xs sm:text-sm hover:bg-primary/90 mt-2"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Authenticating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                Access Cockpit
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        <div className="mt-6 border-t border-border/60 pt-4 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/80">
            <Lock className="h-3 w-3" />
            Tuya IoT & Upstash Serverless Backbone
          </span>
        </div>
      </div>
    </div>
  );
}
