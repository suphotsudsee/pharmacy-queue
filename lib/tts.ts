const thaiDigits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const thaiPlaces = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
const normalSpeechRate = 1;
const numberSpeechRate = 0.75;
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

async function playAudioParts(parts: AudioPart[]) {
  for (const part of parts) {
    const audio = new Audio(`/api/tts/audio?id=${part.id}`);
    audio.playbackRate = part.rate;
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
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
