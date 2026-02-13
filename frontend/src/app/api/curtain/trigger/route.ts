import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { gcpFetch, gcpJsonResponse } from '@/lib/gcp';

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine for trigger
    }

    const res = await gcpFetch('/trigger', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const { data, status } = await gcpJsonResponse(res);
    return NextResponse.json(data, { status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to trigger automation', details: String(error) },
      { status: 500 }
    );
  }
}
