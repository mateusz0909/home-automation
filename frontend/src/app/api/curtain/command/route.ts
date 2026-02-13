import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { gcpFetch, gcpJsonResponse } from '@/lib/gcp';

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const res = await gcpFetch('/command', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const { data, status } = await gcpJsonResponse(res);
    return NextResponse.json(data, { status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send command', details: String(error) },
      { status: 500 }
    );
  }
}
