
export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';
import { dataPath, ensureDir } from '@/lib/paths';

const cacheDir = dataPath('tts-gt-cache');
const pending = ((global as any).__GT_TTS_PENDING__ ??= new Map<string, Promise<string>>()) as Map<string, Promise<string>>;

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

    if (pending.has(id)) {
      await pending.get(id);
      return new Response(JSON.stringify({ ok: true, id }), { headers: { 'content-type': 'application/json' } });
    }

    const work = fetchAndCache(text, id, mp3Path);
    pending.set(id, work);
    await work;
    return new Response(JSON.stringify({ ok: true, id }), { headers: { 'content-type': 'application/json' } });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
}

async function fetchAndCache(text: string, id: string, mp3Path: string) {
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(text)}&tl=th`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*',
        'Referer': 'https://translate.google.com/'
      }
    });
    if (!res.ok) {
      throw new Error(`Google Translate TTS failed: ${res.status}`);
    }
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length < 1000) {
      throw new Error('Google Translate TTS returned an empty audio file');
    }
    ensureDir(cacheDir);
    const tmpPath = `${mp3Path}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, buf);
    fs.renameSync(tmpPath, mp3Path);
    return id;
  } finally {
    pending.delete(id);
  }
}
