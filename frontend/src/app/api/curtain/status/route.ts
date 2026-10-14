import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getTuyaClient } from '@/lib/tuya-client';
import { getExecutionStatus } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = getTuyaClient();
    const position = await client.getDeviceStatus();
    const execution = await getExecutionStatus();

    return NextResponse.json({
      position,
      timestamp: new Date().toISOString(),
      execution,
    });
  } catch (error) {
    console.error('Error in GET /api/curtain/status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status', details: String(error) },
      { status: 500 }
    );
  }
}
