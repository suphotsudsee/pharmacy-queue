
export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';
import crypto from 'crypto';
import textToSpeech from '@google-cloud/text-to-speech';

// CREDENTIALS_DIAG
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

type Body = { text?: string; voice?: { languageCode?: string; name?: string; ssmlGender?: string } };

const cacheDir = path.join(process.cwd(), 'data', 'tts-cache');

function makeId(text: string, voice: any) {
  const v = JSON.stringify(voice || {});
  return crypto.createHash('sha1').update(text + '|' + v).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const text = (body.text || '').toString().trim();
    if (!text) {
      return new Response(JSON.stringify({ ok: false, error: 'text is required' }), { status: 400 });
    }
    const voice = body.voice || { languageCode: 'th-TH', name: 'th-TH-Standard-A' };
        if (!credPath) {
          return new Response(JSON.stringify({ ok: false, error: 'Missing GOOGLE_APPLICATION_CREDENTIALS env var. Set it to your service-account JSON path.' }), { status: 500 });
        }
        try {
          const fs = await import('fs');
          if (!fs.existsSync(credPath)) {
            return new Response(JSON.stringify({ ok: false, error: `Credentials file not found: ${credPath}` }), { status: 500 });
          }
        } catch {}
        
    const id = makeId(text, voice);
    const mp3Path = path.join(cacheDir, id + '.mp3');
    if (fs.existsSync(mp3Path)) {
      return new Response(JSON.stringify({ ok: true, id }), { headers: { 'content-type': 'application/json' } });
    }

    const client = new textToSpeech.TextToSpeechClient();
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: voice.languageCode || 'th-TH', name: voice.name, ssmlGender: voice.ssmlGender as any },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0.0 },
    });

    if (!response.audioContent) {
      return new Response(JSON.stringify({ ok: false, error: 'No audioContent' }), { status: 500 });
    }
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(mp3Path, Buffer.from(response.audioContent as Uint8Array));

    return new Response(JSON.stringify({ ok: true, id }), { headers: { 'content-type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
}
