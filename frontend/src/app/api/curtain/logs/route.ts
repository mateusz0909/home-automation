import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getRecentLogs, appendLog } from '@/lib/storage';
import { ExecutionLog } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20', 10);
    const logs = await getRecentLogs(limit);
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error in GET /api/curtain/logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const log = (await req.json()) as ExecutionLog;
    await appendLog(log);
    return NextResponse.json({ success: true, message: 'Log recorded' });
  } catch (error) {
    console.error('Error in POST /api/curtain/logs:', error);
    return NextResponse.json(
      { error: 'Failed to save log', details: String(error) },
      { status: 500 }
    );
  }
}
