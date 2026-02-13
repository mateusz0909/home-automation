'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/config', label: 'Config' },
    { href: '/dashboard/logs', label: 'Logs' },
  ];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="text-base font-semibold tracking-tight">🏠 Curtain Control</div>
          <div className="flex flex-wrap items-center gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'border-primary/50 bg-primary/20 text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
          </div>
        </div>
      </nav>
      <main className="page-shell">{children}</main>
    </div>
  );
}
