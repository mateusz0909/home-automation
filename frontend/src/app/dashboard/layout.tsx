'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SlidersHorizontal, Clock, Activity, LogOut, Wifi } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navLinks = [
    { href: '/dashboard', label: 'Cockpit', icon: SlidersHorizontal },
    { href: '/dashboard/config', label: 'Schedule & Tuning', icon: Clock },
    { href: '/dashboard/logs', label: 'Activity Logs', icon: Activity },
  ];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Brand & Hardware status */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/10">
              <svg
                width="20"
                height="20"
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
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  CURTAIN OS
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Tuya Cloud
                </span>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                Living Room · Motor 24V
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center rounded-xl border border-border/70 bg-card/60 p-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3 sm:text-sm',
                      isActive
                        ? 'bg-secondary text-foreground shadow-sm shadow-black/20'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{link.label}</span>
                    <span className="sm:hidden">{link.label.split(' ')[0]}</span>
                  </Link>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive sm:h-9 sm:w-auto sm:px-3"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline sm:ml-1.5 text-xs">Sign out</span>
            </Button>
          </nav>
        </div>
      </header>

      <main className="page-shell pb-16">{children}</main>
    </div>
  );
}
