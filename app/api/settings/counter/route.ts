export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getSnapshot, setCounterName } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { counterName } = getSnapshot();
  return NextResponse.json({ counterName });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.counterName === 'string') {
    setCounterName(body.counterName.trim());
    const { counterName } = getSnapshot();
    return NextResponse.json({ ok: true, counterName });
  }
  return NextResponse.json({ ok: false, error: 'counterName is required' }, { status: 400 });
}
