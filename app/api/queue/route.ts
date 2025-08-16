export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { addQueue, getSnapshot } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getSnapshot());
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.action === 'add') {
    const item = addQueue();
    return NextResponse.json({ ok: true, added: item });
  }
  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
}
