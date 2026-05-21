export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { dataPath } from '@/lib/paths';

const cacheDir = dataPath('tts-cache');
const sha1Pattern = /^[a-f0-9]{40}$/;

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id') || '';
    if (!sha1Pattern.test(id)) {
      return new Response('Invalid id', { status: 400 });
    }

    const filePath = path.join(cacheDir, `${id}.mp3`);
    if (!fs.existsSync(filePath)) {
      return new Response('Not found', { status: 404 });
    }

    const data = fs.readFileSync(filePath);
    return new Response(data, {
      headers: {
        'content-type': 'audio/mpeg',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Error', { status: 500 });
  }
}
