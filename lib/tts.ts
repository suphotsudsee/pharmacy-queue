
let tailText = 'กรุณาติดต่อรับยา';

export function setTailText(t: string) { tailText = t; }

export async function speakCall(number: number, tail?: string) {
  if (typeof window === 'undefined') return;
  const text = `ขอเชิญหมายเลข ${number} ${tail ?? tailText}`;
  const res = await fetch('/api/gt-tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    console.error('GT TTS failed:', data);
    alert('ไม่สามารถดึงเสียงจาก Google Translate ได้');
    return;
  }
  const audio = new Audio(`/api/gt-tts/file/${data.id}`);
  await audio.play().catch(()=>{});
}
