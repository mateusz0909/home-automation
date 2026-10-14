import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getConfig, updateConfig } from '@/lib/storage';
import { syncQStashSchedule } from '@/lib/qstash';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error in GET /api/curtain/config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch config', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updates = await req.json();
    const newConfig = await updateConfig(updates);

    // If enabled status or schedule changed, sync QStash schedule
    if (
      typeof updates.enabled === 'boolean' ||
      updates.cronExpression ||
      updates.timezone
    ) {
      try {
        await syncQStashSchedule(newConfig);
      } catch (scheduleErr) {
        console.warn('Could not sync QStash schedule:', scheduleErr);
      }
    }

    return NextResponse.json({ message: 'Config updated', config: newConfig });
  } catch (error) {
    console.error('Error in PUT /api/curtain/config:', error);
    return NextResponse.json(
      { error: 'Failed to update config', details: String(error) },
      { status: 500 }
    );
  }
}
