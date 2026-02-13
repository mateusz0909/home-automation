import { NextRequest, NextResponse } from 'next/server';
import { AUTH_USERNAME, AUTH_PASSWORD, SESSION_COOKIE } from '@/lib/config';
import { generateSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      const token = generateSessionToken(username);

      const response = NextResponse.json({ success: true });
      response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
