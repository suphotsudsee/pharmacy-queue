'use client';
import React from 'react';
import AudioAnnouncer from '@/components/AudioAnnouncer';
import { speakCall } from '@/lib/tts';
import type { Room } from '@/lib/types';

type Snapshot = { current: number|null; items: { number: number; status: string; createdAt: number }[]; tailNumber: number; counterName: string };

export default function Page() {
  const [tails, setTails] = React.useState<Record<Room, string>>({
    exam: 'กรุณาติดต่อห้องตรวจ',
    pharmacy: 'กรุณาติดต่อรับยา'
  });

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: '20px auto', padding: 20, maxWidth: 1400 }}>
      <QueueControl room="exam" title="ระบบเรียกคิวห้องตรวจ" tail={tails.exam} />
      <QueueControl room="pharmacy" title="ระบบเรียกคิวห้องยา" tail={tails.pharmacy} />
      <div style={{ gridColumn: '1 / -1' }}>
        <AudioAnnouncer tails={tails} setTails={setTails} />
      </div>
    </main>
  );
}

function QueueControl({ room, title, tail }: { room: Room; title: string; tail: string }) {
  const [snap, setSnap] = React.useState<Snapshot | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const res = await fetch(`/api/queue?room=${room}`, { cache: 'no-store' });
    setSnap(await res.json());
  }, [room]);

  React.useEffect(() => { refresh(); const t = setInterval(refresh, 2000); return () => clearInterval(t); }, [refresh]);

  const action = async (url: string, after?: (n:number|null)=>void) => {
    setLoading(true);
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
    setLoading(false);
    await refresh();
    if (after) after(data.current);
  };

  const callNext = async () => action(`/api/queue/next?room=${room}`, async (n) => { if (n) await speakCall(n, tail); });
  const callRepeat = async () => action(`/api/queue/repeat?room=${room}`, async (n) => { if (n) await speakCall(n, tail); });
  const callSkip = async () => action(`/api/queue/skip?room=${room}`);
  const callDone = async () => action(`/api/queue/done?room=${room}`);
  const callSkippedNumber = async (n:number) => action(`/api/queue/call?room=${room}&number=${n}`, async (m) => { if (m) await speakCall(m, tail); });

  const add = async () => {
    setLoading(true);
    await fetch(`/api/queue?room=${room}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add' }) });
    setLoading(false);
    await refresh();
  };

  const current = snap?.current ?? null;
  const waiting = (snap?.items ?? []).filter(i => i.status === 'waiting').map(i => i.number);
  const called = (snap?.items ?? []).filter(i => i.status === 'calling').map(i => i.number);
  const done = (snap?.items ?? []).filter(i => i.status === 'done').map(i => i.number);
  const skipped = (snap?.items ?? []).filter(i => i.status === 'skipped').map(i => i.number);

  return (
    <div style={{ background: '#0b1020', borderRadius: 16, padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 20px' }}>
        <label style={{ opacity: 0.85 }}>ชื่อช่องบริการ:</label>
        <input
          value={snap?.counterName ?? ''}
          onChange={async (e) => {
            const val = e.target.value;
            await fetch(`/api/settings/counter?room=${room}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ counterName: val })
            });
            await refresh();
          }}
          style={{ background: '#0b1020', border: '1px solid #243056', color: 'white', padding: '8px 10px', borderRadius: 8, minWidth: 220 }}
          placeholder="เช่น ช่อง 1"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#121738', borderRadius: 16, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>คิวปัจจุบัน</h2>
          <div style={{ fontSize: 80, fontWeight: 900, textAlign: 'center', lineHeight: '1', margin: '8px 0 16px' }}>
            {current ?? '-'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={callNext} disabled={loading} style={btnPri}>เรียกถัดไป</button>
            <button onClick={callRepeat} disabled={loading || !current} style={btnSec}>เรียกซ้ำ</button>
            <button onClick={callSkip} disabled={loading || !current} style={btnWarn}>ข้าม</button>
            <button onClick={callDone} disabled={loading || !current} style={btnOk}>เสร็จสิ้น</button>
          </div>
        </div>
        <div style={{ background: '#121738', borderRadius: 16, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>จัดการคิว</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={add} disabled={loading} style={btnPri}>ลงทะเบียนคิวใหม่</button>
            <button onClick={refresh} disabled={loading} style={btnSec}>รีเฟรช</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Panel title="กำลังเรียก" items={called} highlight />
            <Panel title="รอเรียก" items={waiting} />
            <Panel title="เสร็จสิ้น" items={done} />
            <Panel title="ถูกข้าม" items={skipped} onItemClick={callSkippedNumber} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, items, highlight=false, onItemClick }: { title: string; items: number[]; highlight?: boolean; onItemClick?: (n:number)=>void }) {
  return (
    <div style={{ background: highlight ? '#0e1c4f' : '#0b1020', borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.length === 0 ? <span style={{ opacity: 0.7 }}>-</span> :
          items.map(n => (
            <span
              key={n}
              style={{...pill, cursor: onItemClick ? 'pointer' : undefined}}
              onClick={() => onItemClick?.(n)}
            >
              {n}
            </span>
          ))}
      </div>
    </div>
  );
}

const pill: React.CSSProperties = {
  background: '#1f2a4d', padding: '6px 10px', borderRadius: 999, fontWeight: 700
};
const btnPri: React.CSSProperties = {
  background: '#22c55e', border: 'none', color: 'white', padding: '10px 14px',
  borderRadius: 10, cursor: 'pointer', fontWeight: 700
};
const btnSec: React.CSSProperties = {
  background: '#3b82f6', border: 'none', color: 'white', padding: '10px 14px',
  borderRadius: 10, cursor: 'pointer', fontWeight: 700
};
const btnWarn: React.CSSProperties = {
  background: '#f59e0b', border: 'none', color: 'white', padding: '10px 14px',
  borderRadius: 10, cursor: 'pointer', fontWeight: 700
};
const btnOk: React.CSSProperties = {
  background: '#8b5cf6', border: 'none', color: 'white', padding: '10px 14px',
  borderRadius: 10, cursor: 'pointer', fontWeight: 700
};
