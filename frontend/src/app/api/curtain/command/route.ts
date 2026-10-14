import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getTuyaClient } from '@/lib/tuya-client';
import { cancelExecution } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const command = body?.command;

    if (!command || !['open', 'close', 'stop'].includes(command)) {
      return NextResponse.json(
        { error: 'command must be one of: open, close, stop' },
        { status: 400 }
      );
    }

    // Cancel any running gradual sequence so user's manual action takes precedence
    await cancelExecution(`Manual '${command}' command issued`);

    const client = getTuyaClient();
    const success = await client.sendDirectionalCommand(command);

    // Give curtain a second to react before checking status
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const position = await client.getDeviceStatus();

    return NextResponse.json({
      message: success
        ? `Command '${command}' sent successfully`
        : `Command '${command}' failed`,
      success,
      command,
      position,
    });
  } catch (error) {
    console.error('Error in command route:', error);
    return NextResponse.json(
      { error: 'Failed to send command', details: String(error) },
      { status: 500 }
    );
  }
}
