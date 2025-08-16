
export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';

const cacheDir = path.join(process.cwd(), 'data', 'tts-gt-cache');

function makeId(text: string) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text: string = (body?.text ?? '').toString().trim();
    if (!text) return new Response(JSON.stringify({ ok: false, error: 'text is required' }), { status: 400 });

    const id = makeId(text);
    const mp3Path = path.join(cacheDir, id + '.mp3');
    if (fs.existsSync(mp3Path)) {
      return new Response(JSON.stringify({ ok: true, id }), { headers: { 'content-type': 'application/json' } });
    }

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(text)}&tl=th`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*',
        'Referer': 'https://translate.google.com/'
      }
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `fetch failed: ${res.status}` }), { status: 500 });
    }
    const ab = await res.arrayBuffer();
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(mp3Path, Buffer.from(ab));
    return new Response(JSON.stringify({ ok: true, id }), { headers: { 'content-type': 'application/json' } });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
}
