export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { skipCurrent } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function POST() {
  const n = skipCurrent();
  return NextResponse.json({ ok: true, current: n });
}
