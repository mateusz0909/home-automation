import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { gcpFetch, gcpJsonResponse } from '@/lib/gcp';

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const limit = req.nextUrl.searchParams.get('limit') || '10';
    const res = await gcpFetch(`/logs?limit=${limit}`);
    const { data, status } = await gcpJsonResponse(res);
    return NextResponse.json(data, { status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch logs', details: String(error) },
      { status: 500 }
    );
  }
}
