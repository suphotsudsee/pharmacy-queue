export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { repeatCurrent } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function POST() {
  const n = repeatCurrent();
  return NextResponse.json({ ok: true, current: n });
}
