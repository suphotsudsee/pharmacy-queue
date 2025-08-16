export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { addQueue, getSnapshot } from '@/lib/store';
import { Room } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getRoom(req: NextRequest): Room {
  const r = req.nextUrl.searchParams.get('room');
  return r === 'exam' || r === 'pharmacy' ? r : 'pharmacy';
}

export async function GET(req: NextRequest) {
  const room = getRoom(req);
  return NextResponse.json(getSnapshot(room));
}
export async function POST(req: NextRequest) {
  const room = getRoom(req);
  const body = await req.json().catch(() => ({}));
  if (body.action === 'add') {
    const item = addQueue(room);
    return NextResponse.json({ ok: true, added: item });
  }
  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
}
