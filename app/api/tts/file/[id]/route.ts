
export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const cacheDir = path.join(process.cwd(), 'data', 'tts-cache');

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const id = context.params.id.replace(/[^a-f0-9]/g, '');
    const p = path.join(cacheDir, id + '.mp3');
    if (!fs.existsSync(p)) return new Response('Not found', { status: 404 });
    const data = fs.readFileSync(p);
    return new Response(data, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
  } catch {
    return new Response('Error', { status: 500 });
  }
}
