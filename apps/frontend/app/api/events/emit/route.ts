import { NextRequest, NextResponse } from 'next/server';
import { eventBus, type EventName, type EventPayloads } from '@/lib/event-bus';

export const runtime = 'nodejs';

/**
 * POST /api/events/emit
 *
 * Emit a typed event on the in-process event bus so that connected SSE
 * clients receive real-time updates. Used internally by hooks after
 * successful contract mutations (approve/reject, ban/unban, etc.).
 *
 * Body: { type: EventName, data: EventPayloads[EventName] }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: { type: string; data: Record<string, unknown> } = await request.json();

    if (!body.type || !body.data) {
      return NextResponse.json(
        { error: 'Missing "type" or "data" in request body' },
        { status: 400 }
      );
    }

    const validEvents: EventName[] = [
      'post:published',
      'post:scheduled',
      'comment:added',
      'post:approved',
      'post:rejected',
      'message:received',
      'user:banned',
      'user:unbanned',
    ];

    if (!validEvents.includes(body.type as EventName)) {
      return NextResponse.json(
        { error: `Invalid event type: ${body.type}` },
        { status: 400 }
      );
    }

    const eventType = body.type as EventName;
    eventBus.emit(eventType, body.data as EventPayloads[typeof eventType]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
