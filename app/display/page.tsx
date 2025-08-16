'use client';
import React from 'react';
import type { Room } from '@/lib/types';

type Snapshot = { current: number|null; items: { number: number; status: string; createdAt: number }[]; tailNumber: number; counterName: string };

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
  const [lastNumber, setLastNumber] = React.useState<number | null>(null);
  const [chime, setChime] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const res = await fetch(`/api/queue?room=${room}`, { cache: 'no-store' });
    const data: Snapshot = await res.json();
    const nextCurrent = data.current ?? null;
    if (chime && nextCurrent && nextCurrent !== lastNumber) {
      try {
        const audio = new Audio('/sounds/chime.mp3');
        await audio.play();
      } catch (e) {}
    }
    setLastNumber(nextCurrent ?? null);
    setSnap(data);
  }, [room, chime, lastNumber]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh]);

  const skipped = (snap?.items ?? [])
    .filter(i => i.status === 'skipped')
    .map(i => i.number)
    .slice(0, 8);

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

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12, marginTop: 16 }}>
      {skipped.length === 0 ? <div style={{ opacity: 0.7, gridColumn: '1 / -1' }}>ไม่มีคิวที่ข้าม</div> : null}
      {skipped.map(n => <Card key={n} n={n} tone="skipped" />)}
    </div>

    <div style={{ position: 'absolute', bottom: 16, left: 28, opacity: 0.6 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={chime} onChange={e => setChime(e.target.checked)} />
          เสียงเตือนเมื่อเปลี่ยนหมายเลข
        </label>
        <button onClick={toggleFull} style={btn()}>เต็มจอ</button>
        <button onClick={refresh} style={btn()}>รีเฟรช</button>
      </div>
    </div>

    <div style={{ position: 'absolute', bottom: 16, right: 28, opacity: 0.6, fontSize: 12 }}>
      {room === 'exam' ? 'ห้องตรวจ' : 'ห้องยา'} · แสดงผลอัตโนมัติทุก 1.5 วินาที
    </div>
  </section>
</div>
  );
}

function Card({ n, tone }: { n: number; tone: 'calling'|'waiting'|'skipped' }) {
  const bg = tone === 'calling' ? '#0ea5e9' : tone === 'skipped' ? '#dc2626' : '#111827';
  const fg = tone === 'calling' ? 'black' : '#e5e7eb';
  return (
    <div style={{ background: bg, color: fg, borderRadius: 16, padding: '22px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '6vh' }}>
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
