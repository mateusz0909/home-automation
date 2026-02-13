import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { gcpFetch, gcpJsonResponse } from '@/lib/gcp';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await gcpFetch('/status');
    const { data, status } = await gcpJsonResponse(res);
    return NextResponse.json(data, { status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch status', details: String(error) },
      { status: 500 }
    );
  }
}
