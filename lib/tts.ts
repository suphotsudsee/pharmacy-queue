const thaiDigits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const thaiPlaces = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
const normalSpeechRate = 1;
const numberSpeechRate = 0.75;
const audioOverlapMs = 180;
type AudioPart = { id: string; rate: number };

function readThaiNumberUnderMillion(number: number): string {
  if (number === 0) return 'ศูนย์';

  const digits = String(number).split('').map(Number);
  const parts: string[] = [];

  digits.forEach((digit, index) => {
    if (digit === 0) return;

    const place = digits.length - index - 1;
    if (place === 0) {
      if (digit === 1 && digits.length > 1) {
        parts.push('เอ็ด');
      } else {
        parts.push(thaiDigits[digit]);
      }
      return;
    }

    if (place === 1) {
      if (digit === 1) {
        parts.push('สิบ');
      } else if (digit === 2) {
        parts.push('ยี่สิบ');
      } else {
        parts.push(`${thaiDigits[digit]}สิบ`);
      }
      return;
    }

    parts.push(`${thaiDigits[digit]}${thaiPlaces[place]}`);
  });

  return parts.join('');
}

function readThaiNumber(number: number): string {
  const normalized = Math.trunc(Math.abs(number));
  if (normalized < 1000000) return readThaiNumberUnderMillion(normalized);

  const millionPart = Math.floor(normalized / 1000000);
  const rest = normalized % 1000000;
  return `${readThaiNumber(millionPart)}ล้าน${rest ? readThaiNumberUnderMillion(rest) : ''}`;
}

type SoundMode = 'both' | 'notebook-only' | 'tv-only';

const soundMode: SoundMode = 'both';

async function createTts(text: string) {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    console.error('TTS failed:', data);
    alert(data?.error || 'ไม่สามารถสร้างเสียงประกาศได้');
    return null;
  }
  return data.id as string;
}

function waitForAudioReady(audio: HTMLAudioElement) {
  if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const done = () => {
      audio.removeEventListener('canplaythrough', done);
      audio.removeEventListener('loadeddata', done);
      audio.removeEventListener('error', done);
      resolve();
    };

    audio.addEventListener('canplaythrough', done, { once: true });
    audio.addEventListener('loadeddata', done, { once: true });
    audio.addEventListener('error', done, { once: true });
    window.setTimeout(done, 800);
  });
}

export async function playAudioParts(parts: AudioPart[]) {
  const audios = parts.map((part) => {
    const audio = new Audio(`/api/tts/audio?id=${part.id}`);
    audio.preload = 'auto';
    audio.playbackRate = part.rate;
    audio.load();
    return audio;
  });

  await Promise.all(audios.map(waitForAudioReady));

  for (let index = 0; index < audios.length; index += 1) {
    const audio = audios[index];
    const hasNext = index < audios.length - 1;

    await new Promise<void>((resolve) => {
      let resolved = false;
      let nextStarted = false;
      let nextTimer: number | undefined;

      const resolveOnce = () => {
        if (resolved) return;
        resolved = true;
        if (nextTimer) window.clearTimeout(nextTimer);
        resolve();
      };

      const startNextEarly = () => {
        if (!hasNext || nextStarted || !Number.isFinite(audio.duration)) return;
        const remainingMs = Math.max(0, (audio.duration - audio.currentTime) * 1000);
        nextTimer = window.setTimeout(() => {
          nextStarted = true;
          resolveOnce();
        }, Math.max(0, remainingMs - audioOverlapMs));
      };

      audio.onloadedmetadata = startNextEarly;
      audio.onplay = startNextEarly;
      audio.onended = resolveOnce;
      audio.onerror = resolveOnce;
      audio.play().catch(() => resolveOnce());
    });
  }
}

export async function speakCall(number: number, tail = 'กรุณาติดต่อรับยา', room = 'pharmacy') {
  if (typeof window === 'undefined') return;
  const numberText = readThaiNumber(number);
  const text = `ขอเชิญหมายเลข ${numberText}, ${tail}`;
  const speechParts = [
    { text: 'ขอเชิญหมายเลข', rate: normalSpeechRate },
    { text: numberText, rate: numberSpeechRate },
    { text: tail, rate: normalSpeechRate },
  ].filter((part) => part.text.trim());
  const audioParts: AudioPart[] = [];

  for (const part of speechParts) {
    const id = await createTts(part.text);
    if (!id) return;
    audioParts.push({ id, rate: part.rate });
  }

  if (soundMode === 'both' || soundMode === 'notebook-only') {
    await playAudioParts(audioParts);
  }

  if (soundMode === 'both' || soundMode === 'tv-only') {
    await fetch(`/api/queue/current?room=${room}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room,
        queueNumber: number,
        text,
        ttsId: audioParts[0]?.id,
        audioParts,
        calledAt: Date.now(),
      }),
    }).catch((error) => {
      console.error('Queue current update failed:', error);
    });
  }
}
