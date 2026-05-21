export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentQueueCall, setCurrentQueueCall } from '@/lib/store';
import { Room } from '@/lib/types';

const sha1Pattern = /^[a-f0-9]{40}$/;

function getRoom(req: NextRequest, body?: { room?: string }): Room {
  const r = body?.room || req.nextUrl.searchParams.get('room');
  return r === 'exam' || r === 'pharmacy' ? r : 'pharmacy';
}

export async function GET(req: NextRequest) {
  const room = getRoom(req);
  return NextResponse.json(getCurrentQueueCall(room) || null, {
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const room = getRoom(req, body);
  const queueNumber = body?.queueNumber;
  const text = (body?.text ?? '').toString().trim();
  const ttsId = (body?.ttsId ?? '').toString();
  const calledAt = Number(body?.calledAt || Date.now());

  if (queueNumber === undefined || queueNumber === null || !text || !sha1Pattern.test(ttsId)) {
    return NextResponse.json({ ok: false, error: 'Invalid current queue payload' }, { status: 400 });
  }

  const current = setCurrentQueueCall(room, {
    queueNumber,
    text,
    ttsId,
    calledAt: Number.isFinite(calledAt) ? calledAt : Date.now(),
  });

  return NextResponse.json({ ok: true, current }, {
    headers: { 'cache-control': 'no-store' },
  });
}
