import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getConfig, appendLog, setExecutionStatus } from '@/lib/storage';
import { verifyQStashSignature, triggerWorkflow } from '@/lib/qstash';
import { TriggerRequest } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const isUserAuth = await isAuthenticated();
  const isQStashAuth = await verifyQStashSignature(req, rawBody);

  if (!isUserAuth && !isQStashAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isScheduled = isQStashAuth && !isUserAuth;

  let body: TriggerRequest = {};
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Empty or non-JSON body is acceptable
    }
  }

  try {
    const config = await getConfig();

    // If disabled and not explicitly forced, skip scheduled run
    if (!config.enabled && !body.force) {
      if (isScheduled) {
        await appendLog({
          timestamp: new Date().toISOString(),
          trigger: 'scheduled',
          success: true,
          stepsCompleted: 0,
          totalSteps: config.steps.length,
          finalPosition: null,
          durationMs: 0,
          error: 'Automation disabled',
        });
      }

      return NextResponse.json({
        message: 'Automation is disabled',
        hint: 'Set enabled=true in config or pass force=true in request body',
      });
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const steps = body.steps && body.steps.length > 0 ? body.steps : config.steps;

    // Set status to running in Redis immediately
    await setExecutionStatus({
      state: 'running',
      runId,
      currentStep: 0,
      totalSteps: steps.length,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      trigger: isScheduled ? 'scheduled' : 'manual',
    });

    // Start background workflow execution
    const workflowResult = await triggerWorkflow({
      trigger: isScheduled ? 'scheduled' : 'manual',
      force: body.force,
      steps: body.steps,
      runId,
    });

    return NextResponse.json({
      message: 'Gradual opening sequence started',
      success: true,
      runId: workflowResult.workflowRunId || runId,
      stepsCompleted: 0,
      totalSteps: steps.length,
    });
  } catch (error) {
    console.error('Error triggering automation:', error);
    return NextResponse.json(
      { error: 'Failed to trigger automation', details: String(error) },
      { status: 500 }
    );
  }
}
