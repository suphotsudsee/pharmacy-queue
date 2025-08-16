
export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';

const cacheDir = path.join(process.cwd(), 'data', 'tts-gt-cache');

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = (ctx.params.id || '').replace(/[^a-f0-9]/g, '');
    const p = path.join(cacheDir, id + '.mp3');
    if (!fs.existsSync(p)) return new Response('Not found', { status: 404 });
    const buf = fs.readFileSync(p);
    return new Response(buf, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
  } catch {
    return new Response('Error', { status: 500 });
  }
}
