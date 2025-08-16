export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { doneCurrent } from '@/lib/store';
import { Room } from '@/lib/types';
export const dynamic = 'force-dynamic';
function getRoom(req: NextRequest): Room {
  const r = req.nextUrl.searchParams.get('room');
  return r === 'exam' || r === 'pharmacy' ? r : 'pharmacy';
}

export async function POST(req: NextRequest) {
  const room = getRoom(req);
  const n = doneCurrent(room);
  return NextResponse.json({ ok: true, current: n });
}
