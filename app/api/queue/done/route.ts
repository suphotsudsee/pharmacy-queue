export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { doneCurrent } from '@/lib/store';
export const dynamic = 'force-dynamic';
export async function POST() {
  const n = doneCurrent();
  return NextResponse.json({ ok: true, current: n });
}
