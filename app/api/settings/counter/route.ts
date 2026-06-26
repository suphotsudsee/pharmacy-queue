export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot, setCounterName, setKioskTitle, setQueueStartNumber, setSystemTitle } from '@/lib/store';
import { Room } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getRoom(req: NextRequest): Room {
  const r = req.nextUrl.searchParams.get('room');
  return r === 'exam' || r === 'pharmacy' ? r : 'pharmacy';
}

export async function GET(req: NextRequest) {
  const room = getRoom(req);
  const { counterName, systemTitle, queueStartNumber, kioskTitle } = getSnapshot(room);
  return NextResponse.json({ counterName, systemTitle, queueStartNumber, kioskTitle });
}

export async function POST(req: NextRequest) {
  const room = getRoom(req);
  const body = await req.json().catch(() => ({}));
  let updated = false;
  if (typeof body.counterName === 'string') {
    setCounterName(room, body.counterName.trim());
    updated = true;
  }
  if (typeof body.systemTitle === 'string') {
    setSystemTitle(room, body.systemTitle.trim());
    updated = true;
  }
  if (typeof body.kioskTitle === 'string') {
    setKioskTitle(room, body.kioskTitle.trim());
    updated = true;
  }
  if (body.queueStartNumber !== undefined) {
    const queueStartNumber = Number(body.queueStartNumber);
    if (!Number.isFinite(queueStartNumber) || queueStartNumber < 1) {
      return NextResponse.json({ ok: false, error: 'queueStartNumber must be at least 1' }, { status: 400 });
    }
    setQueueStartNumber(room, queueStartNumber);
    updated = true;
  }
  if (updated) {
    const { counterName, systemTitle, queueStartNumber, kioskTitle } = getSnapshot(room);
    return NextResponse.json({ ok: true, counterName, systemTitle, queueStartNumber, kioskTitle });
  }
  return NextResponse.json({ ok: false, error: 'counterName, systemTitle, kioskTitle, or queueStartNumber is required' }, { status: 400 });
}
