import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { gcpFetch, gcpJsonResponse } from '@/lib/gcp';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await gcpFetch('/schedule');
    const { data, status } = await gcpJsonResponse(res);
    return NextResponse.json(data, { status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch schedule', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const res = await gcpFetch('/schedule', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const { data, status } = await gcpJsonResponse(res);
    return NextResponse.json(data, { status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update schedule', details: String(error) },
      { status: 500 }
    );
  }
}
