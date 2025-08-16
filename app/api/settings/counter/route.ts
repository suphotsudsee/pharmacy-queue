export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot, setCounterName } from '@/lib/store';
import { Room } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getRoom(req: NextRequest): Room {
  const r = req.nextUrl.searchParams.get('room');
  return r === 'exam' || r === 'pharmacy' ? r : 'pharmacy';
}

export async function GET(req: NextRequest) {
  const room = getRoom(req);
  const { counterName } = getSnapshot(room);
  return NextResponse.json({ counterName });
}

export async function POST(req: NextRequest) {
  const room = getRoom(req);
  const body = await req.json().catch(() => ({}));
  if (typeof body.counterName === 'string') {
    setCounterName(room, body.counterName.trim());
    const { counterName } = getSnapshot(room);
    return NextResponse.json({ ok: true, counterName });
  }
  return NextResponse.json({ ok: false, error: 'counterName is required' }, { status: 400 });
}
