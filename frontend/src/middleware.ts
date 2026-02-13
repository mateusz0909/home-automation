import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from './lib/config';
import { validateSessionToken } from './lib/auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — no auth needed
  if (
    pathname === '/' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check session for dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token || !validateSessionToken(token)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
