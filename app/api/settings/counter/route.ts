export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot, setCounterName, setSystemTitle } from '@/lib/store';
import { Room } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getRoom(req: NextRequest): Room {
  const r = req.nextUrl.searchParams.get('room');
  return r === 'exam' || r === 'pharmacy' ? r : 'pharmacy';
}

export async function GET(req: NextRequest) {
  const room = getRoom(req);
  const { counterName, systemTitle } = getSnapshot(room);
  return NextResponse.json({ counterName, systemTitle });
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
  if (updated) {
    const { counterName, systemTitle } = getSnapshot(room);
    return NextResponse.json({ ok: true, counterName, systemTitle });
  }
  return NextResponse.json({ ok: false, error: 'counterName or systemTitle is required' }, { status: 400 });
}
