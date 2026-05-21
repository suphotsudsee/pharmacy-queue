const thaiDigits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const thaiPlaces = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

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

export async function speakCall(number: number, tail = 'กรุณาติดต่อรับยา', room = 'pharmacy') {
  if (typeof window === 'undefined') return;
  const text = `ขอเชิญหมายเลข ${readThaiNumber(number)} ${tail}`;
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    console.error('TTS failed:', data);
    alert(data?.error || 'ไม่สามารถสร้างเสียงประกาศได้');
    return;
  }

  if (soundMode === 'both' || soundMode === 'notebook-only') {
    const audio = new Audio(`/api/tts/audio?id=${data.id}`);
    await audio.play().catch(()=>{});
  }

  if (soundMode === 'both' || soundMode === 'tv-only') {
    await fetch(`/api/queue/current?room=${room}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room,
        queueNumber: number,
        text,
        ttsId: data.id,
        calledAt: Date.now(),
      }),
    }).catch((error) => {
      console.error('Queue current update failed:', error);
    });
  }
}
