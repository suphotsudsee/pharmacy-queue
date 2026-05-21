'use client';
import React from 'react';
import type { Room } from '@/lib/types';

type Snapshot = { current: number|null; items: { number: number; status: string; createdAt: number }[]; tailNumber: number; counterName: string };
type AudioPart = { id: string; rate: number };
type CurrentQueue = { queueNumber: number | string; text: string; ttsId: string; audioParts?: AudioPart[]; calledAt: number } | null;

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

export default function DisplayPage() {
  return (
    <main style={{ width: '100%', height: '100vh', background: '#030712', color: '#e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 4, background: 'white', transform: 'translateX(50%)' }} />
      <Board room="exam" />
      <Board room="pharmacy" />
    </main>
  );
}

function Board({ room }: { room: Room }) {
  const [snap, setSnap] = React.useState<Snapshot | null>(null);
  const [audioEnabled, setAudioEnabled] = React.useState(false);
  const audioEnabledRef = React.useRef(audioEnabled);
  const lastCalledAtRef = React.useRef(0);

  React.useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  const applySnapshot = React.useCallback((data: Snapshot) => {
    setSnap(data);
  }, []);

  const refresh = React.useCallback(async () => {
    const res = await fetch(`/api/queue?room=${room}`, { cache: 'no-store' });
    const data: Snapshot = await res.json();
    applySnapshot(data);
  }, [room, applySnapshot]);

  React.useEffect(() => {
    refresh();
    const events = new EventSource(`/api/queue/events?room=${room}`);
    events.onmessage = (event) => {
      const data: Snapshot = JSON.parse(event.data);
      applySnapshot(data);
    };
    return () => events.close();
  }, [room, refresh, applySnapshot]);

  const pollCurrentQueue = React.useCallback(async () => {
    const res = await fetch(`/api/queue/current?room=${room}`, { cache: 'no-store' });
    const data: CurrentQueue = await res.json();
    if (!data?.calledAt) return;

    const previousCalledAt = lastCalledAtRef.current;
    lastCalledAtRef.current = data.calledAt;
    if (!previousCalledAt || previousCalledAt === data.calledAt) return;

    if (audioEnabledRef.current && data.ttsId) {
      await playAudioParts(data.audioParts?.length ? data.audioParts : [{ id: data.ttsId, rate: 1 }]);
    }
  }, [room]);

  React.useEffect(() => {
    pollCurrentQueue();
    const timer = window.setInterval(pollCurrentQueue, 1000);
    return () => window.clearInterval(timer);
  }, [pollCurrentQueue]);

  const enableAudio = async () => {
    setAudioEnabled(true);
    audioEnabledRef.current = true;
    const silent = new Audio('/silent.mp3');
    await silent.play().catch(() => {});
    await pollCurrentQueue();
  };

  const skipped = (snap?.items ?? [])
    .filter(i => i.status === 'skipped')
    .map(i => i.number)
    .slice(0, 20);

  const toggleFull = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  return (
<div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', height: '100vh' }}>
  {/* ส่วนบน: แสดงตัวเลข */}
  <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
    <div style={{ position: 'absolute', top: 20, left: 24, fontSize: 32, fontWeight: 800, opacity: 1.2 }}>{snap?.counterName ?? (room === 'exam' ? 'ห้องตรวจ' : 'ช่องยา')}</div>
    <div>
      <div style={{ textAlign: 'center', opacity: 0.8, fontSize: 28, letterSpacing: 1 }}>ขณะนี้กำลังเรียก</div>
      <div style={{ fontSize: '22vw', lineHeight: 1, fontWeight: 900, textAlign: 'center', marginTop: 10 }}>
        {snap?.current ?? '-'}
      </div>
    </div>
  </section>

  {/* ส่วนล่าง: คิวที่ข้าม */}
  <section style={{ padding: '32px 28px', position: 'relative' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>คิวที่ข้าม</h2>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10, marginTop: 16 }}>
      {skipped.length === 0 ? <div style={{ opacity: 0.7, gridColumn: '1 / -1' }}>ไม่มีคิวที่ข้าม</div> : null}
      {skipped.map(n => <Card key={n} n={n} tone="skipped" />)}
    </div>

    <div style={{ position: 'absolute', bottom: 16, left: 28, opacity: 0.6 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={audioEnabled} readOnly />
          เสียงประกาศ
        </label>
        <button onClick={enableAudio} style={audioEnabled ? btnOk() : btn()}>เปิดเสียงประกาศ</button>
        <button onClick={toggleFull} style={btn()}>เต็มจอ</button>
        <button onClick={refresh} style={btn()}>รีเฟรช</button>
      </div>
    </div>

    <div style={{ position: 'absolute', bottom: 16, right: 28, opacity: 0.6, fontSize: 12 }}>
      {room === 'exam' ? 'ห้องตรวจ' : 'ห้องยา'} · อัปเดตอัตโนมัติเมื่อคิวเปลี่ยน
    </div>
  </section>
</div>
  );
}

function Card({ n, tone }: { n: number; tone: 'calling'|'waiting'|'skipped' }) {
  const bg = tone === 'calling' ? '#0ea5e9' : tone === 'skipped' ? '#dc2626' : '#111827';
  const fg = tone === 'calling' ? 'black' : '#e5e7eb';
  return (
    <div style={{ background: bg, color: fg, borderRadius: 16, padding: '2px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '4vh' }}>
      {n}
    </div>
  );
}

function btn() {
  return {
    background: '#1f2937', color: 'white', border: 'none', padding: '10px 12px',
    borderRadius: 10, fontWeight: 700, cursor: 'pointer'
  } as React.CSSProperties;
}

function btnOk() {
  return {
    background: '#16a34a', color: 'white', border: 'none', padding: '10px 12px',
    borderRadius: 10, fontWeight: 700, cursor: 'pointer'
  } as React.CSSProperties;
}
