import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getScheduleState, updateConfig } from '@/lib/storage';
import { syncQStashSchedule } from '@/lib/qstash';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const scheduleState = await getScheduleState();
    return NextResponse.json(scheduleState);
  } catch (error) {
    console.error('Error in GET /api/curtain/schedule:', error);
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
    const { cronExpression, timezone } = await req.json();

    if (!cronExpression || !timezone) {
      return NextResponse.json(
        { error: 'cronExpression and timezone are required' },
        { status: 400 }
      );
    }

    // Update Redis config and QStash schedule
    const newConfig = await updateConfig({ cronExpression, timezone });
    try {
      await syncQStashSchedule(newConfig);
    } catch (schedErr) {
      console.warn('QStash schedule sync notice:', schedErr);
    }

    return NextResponse.json({
      message: 'Schedule updated (Redis + QStash)',
      cronExpression,
      timezone,
    });
  } catch (error) {
    console.error('Error in PUT /api/curtain/schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule', details: String(error) },
      { status: 500 }
    );
  }
}
