export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { nextQueue } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function POST() {
  const n = nextQueue();
  return NextResponse.json({ ok: true, current: n });
}
