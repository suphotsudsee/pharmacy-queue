export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getSnapshot } from '@/lib/store';
import { subscribeQueue } from '@/lib/queue-events';
import type { Room } from '@/lib/types';

function getRoom(req: NextRequest): Room {
  const r = req.nextUrl.searchParams.get('room');
  return r === 'exam' || r === 'pharmacy' ? r : 'pharmacy';
}

export async function GET(req: NextRequest) {
  const room = getRoom(req);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(getSnapshot(room))}\n\n`)
        );
      };

      send();
      const unsubscribe = subscribeQueue(room, send);

      req.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
