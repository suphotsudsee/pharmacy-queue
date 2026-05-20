'use client';
import React from 'react';
import AudioAnnouncer from '@/components/AudioAnnouncer';
import { speakCall } from '@/lib/tts';
import type { Room } from '@/lib/types';

type Snapshot = {
  current: number | null;
  items: { number: number; status: string; createdAt: number }[];
  tailNumber: number;
  counterName: string;
  systemTitle: string;
};

export default function Page() {
  const [showDonate, setShowDonate] = React.useState(false);
  const [systemTitles, setSystemTitles] = React.useState<Record<Room, string>>({
    exam: 'ระบบเรียกคิวห้องตรวจ',
    pharmacy: 'ระบบเรียกคิวห้องจ่ายยา',
  });
  const [tails, setTails] = React.useState<Record<Room, string>>({
    exam: 'กรุณาติดต่อห้องตรวจ',
    pharmacy: 'กรุณาติดต่อรับยา',
  });

  const setRoomTitle = React.useCallback((room: Room, title: string) => {
    setSystemTitles((prev) => ({ ...prev, [room]: title }));
  }, []);
  const handleExamTitleLoaded = React.useCallback((title: string) => setRoomTitle('exam', title), [setRoomTitle]);
  const handlePharmacyTitleLoaded = React.useCallback((title: string) => setRoomTitle('pharmacy', title), [setRoomTitle]);

  return (
    <main style={pageStyle}>
      <div style={contentStyle}>
        <div style={roomGridStyle}>
          <QueueControl
            room="exam"
            title={systemTitles.exam}
            roomLabel="คิวห้องตรวจ"
            tail={tails.exam}
            onTitleLoaded={handleExamTitleLoaded}
          />
          <QueueControl
            room="pharmacy"
            title={systemTitles.pharmacy}
            roomLabel="คิวห้องจ่ายยา"
            tail={tails.pharmacy}
            onTitleLoaded={handlePharmacyTitleLoaded}
          />
        </div>
        <AudioAnnouncer
          systemTitles={systemTitles}
          setSystemTitles={setSystemTitles}
          tails={tails}
          setTails={setTails}
        />
      </div>
      <div style={creditStyle}>
        <button type="button" onClick={() => setShowDonate(true)} style={donateButtonStyle}>
          สนับสนุนค่ากาแฟ
        </button>
        <span>Develop by suphot sudsee</span>
      </div>
      {showDonate && (
        <div style={modalBackdropStyle} onClick={() => setShowDonate(false)}>
          <div style={donateModalStyle} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowDonate(false)} style={closeButtonStyle}>x</button>
            <h2 style={donateTitleStyle}>สนับสนุนผู้พัฒนา</h2>
            <p style={donateTextStyle}>หากโปรแกรมนี้มีประโยชน์กับคุณ สามารถสนับสนุนค่ากาแฟให้ผู้พัฒนาได้ครับ</p>
            <img src="/donate-qr.jpg" alt="PromptPay QR code" style={qrStyle} />
          </div>
        </div>
      )}
    </main>
  );
}

function QueueControl({
  room,
  title,
  roomLabel,
  tail,
  onTitleLoaded,
}: {
  room: Room;
  title: string;
  roomLabel: string;
  tail: string;
  onTitleLoaded: (title: string) => void;
}) {
  const [snap, setSnap] = React.useState<Snapshot | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const res = await fetch(`/api/queue?room=${room}`, { cache: 'no-store' });
    const data: Snapshot = await res.json();
    setSnap(data);
    if (data.systemTitle) onTitleLoaded(data.systemTitle);
  }, [room, onTitleLoaded]);

  React.useEffect(() => {
    refresh();
    const events = new EventSource(`/api/queue/events?room=${room}`);
    events.onmessage = (event) => {
      const data: Snapshot = JSON.parse(event.data);
      setSnap(data);
      if (data.systemTitle) onTitleLoaded(data.systemTitle);
    };
    return () => events.close();
  }, [refresh]);

  const action = async (url: string, after?: (n: number | null) => void | Promise<void>) => {
    setLoading(true);
    try {
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      await refresh();
      if (after) await after(data.current);
    } finally {
      setLoading(false);
    }
  };

  const callNext = async () => action(`/api/queue/next?room=${room}`, async (n) => { if (n) await speakCall(n, tail); });
  const callRepeat = async () => action(`/api/queue/repeat?room=${room}`, async (n) => { if (n) await speakCall(n, tail); });
  const callSkip = async () => action(`/api/queue/skip?room=${room}`);
  const callDone = async () => action(`/api/queue/done?room=${room}`);
  const callNumber = async (n: number) => action(`/api/queue/call?room=${room}&number=${n}`, async (m) => { if (m) await speakCall(m, tail); });

  const add = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/queue?room=${room}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add' }),
      });
      if (!res.ok) throw new Error('add queue failed');
      const data = await res.json();
      if (data.added) {
        setSnap((prev) => prev ? {
          ...prev,
          items: [...prev.items, data.added],
          tailNumber: Math.max(prev.tailNumber, data.added.number),
        } : prev);
      }
      await refresh();
    } catch (e) {
      window.alert('ลงทะเบียนคิวใหม่ไม่สำเร็จ กรุณาลองรีเฟรชหน้าโปรแกรม');
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    const ok = window.confirm('ต้องการรีเฟรชข้อมูลทั้งหมดหรือไม่?');
    if (!ok) return;
    setLoading(true);
    await fetch(`/api/queue?room=${room}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    setLoading(false);
    await refresh();
  };

  const current = snap?.current ?? null;
  const waiting = (snap?.items ?? []).filter(i => i.status === 'waiting').map(i => i.number);
  const called = (snap?.items ?? []).filter(i => i.status === 'calling').map(i => i.number);
  const done = (snap?.items ?? []).filter(i => i.status === 'done').map(i => i.number);
  const skipped = (snap?.items ?? []).filter(i => i.status === 'skipped').map(i => i.number);

  return (
    <section style={shellStyle}>
      <div style={roomLabelStyle}>{roomLabel}</div>
      <h1 style={titleStyle}>{title}</h1>
      <div style={controlGridStyle}>
        <div style={currentCardStyle}>
          <h2 style={cardTitleStyle}>คิวปัจจุบัน</h2>
          <div style={currentNumberStyle}>
            {current ?? '-'}
          </div>
          <div style={buttonWrapStyle}>
            <button onClick={callNext} disabled={loading} style={btnPri}>เรียกถัดไป</button>
            <button onClick={callRepeat} disabled={loading || !current} style={btnSec}>เรียกซ้ำ</button>
            <button onClick={callSkip} disabled={loading || !current} style={btnWarn}>ข้าม</button>
            <button onClick={callDone} disabled={loading || !current} style={btnOk}>เสร็จสิ้น</button>
          </div>
        </div>
        <div style={queueCardStyle}>
          <h2 style={cardTitleStyle}>จัดการคิว</h2>
          <div style={buttonWrapStyle}>
            <button onClick={add} disabled={loading} style={btnPri}>ลงทะเบียนคิวใหม่</button>
            <button onClick={reset} disabled={loading} style={btnSec}>รีเฟรช</button>
          </div>
          <div style={panelGridStyle}>
            <Panel title="กำลังเรียก" items={called} highlight />
            <Panel title="รอเรียก" items={waiting} onItemClick={callNumber} />
            <Panel title="เสร็จสิ้น" items={done} />
            <Panel title="ถูกข้าม" items={skipped} onItemClick={callNumber} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Panel({ title, items, highlight = false, onItemClick }: { title: string; items: number[]; highlight?: boolean; onItemClick?: (n: number) => void }) {
  return (
    <div style={highlight ? panelHighlightStyle : panelStyle}>
      <div style={panelTitleStyle}>{title}</div>
      <div style={panelItemsStyle}>
        {items.length === 0 ? <span style={{ opacity: 0.7 }}>-</span> :
          items.map(n => (
            <span
              key={n}
              style={{ ...pill, cursor: onItemClick ? 'pointer' : undefined }}
              onClick={() => onItemClick?.(n)}
            >
              {n}
            </span>
          ))}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#0b1020',
  borderRadius: 8,
  padding: 8,
  minHeight: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const panelHighlightStyle: React.CSSProperties = {
  ...panelStyle,
  background: '#0e1c4f',
};

const panelTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 6,
  fontSize: 14,
  flexShrink: 0,
};

const panelItemsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  alignContent: 'flex-start',
  overflowY: 'auto',
  minHeight: 0,
  paddingRight: 4,
};

const pageStyle: React.CSSProperties = {
  height: '100vh',
  background: '#070c1c',
  color: '#eef3ff',
  padding: '10px 14px 30px',
  overflow: 'hidden',
  boxSizing: 'border-box',
};

const contentStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  maxWidth: 'none',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const shellStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const roomGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  alignItems: 'stretch',
  flex: 1,
  minHeight: 0,
};

const roomLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#14b8a6',
  color: '#031018',
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 4,
  alignSelf: 'flex-start',
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  margin: '0 0 6px',
  letterSpacing: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const controlGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'minmax(250px, 1.35fr) minmax(170px, 0.65fr)',
  gap: 10,
  flex: 1,
  minHeight: 0,
};

const cardStyle: React.CSSProperties = {
  background: '#121738',
  borderRadius: 10,
  padding: 10,
  minHeight: 0,
  overflow: 'hidden',
};

const currentCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: 'flex',
  flexDirection: 'column',
};

const queueCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: 'flex',
  flexDirection: 'column',
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
};

const currentNumberStyle: React.CSSProperties = {
  fontSize: 'clamp(140px, min(34vh, 18vw), 300px)',
  fontWeight: 900,
  textAlign: 'center',
  lineHeight: '0.9',
  margin: 'auto 0',
  minHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
};

const buttonWrapStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
};

const panelGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginTop: 8,
  flex: 1,
  gridTemplateRows: '1fr 1fr',
  minHeight: 0,
};

const pill: React.CSSProperties = {
  background: '#1f2a4d',
  padding: '4px 8px',
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 14,
};

const baseButton: React.CSSProperties = {
  border: 'none',
  color: 'white',
  padding: '8px 10px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14,
};

const btnPri: React.CSSProperties = { ...baseButton, background: '#22c55e' };
const btnSec: React.CSSProperties = { ...baseButton, background: '#3b82f6' };
const btnWarn: React.CSSProperties = { ...baseButton, background: '#f59e0b' };
const btnOk: React.CSSProperties = { ...baseButton, background: '#8b5cf6' };

const creditStyle: React.CSSProperties = {
  position: 'fixed',
  right: 14,
  bottom: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: 'rgba(255,255,255,0.72)',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0,
  zIndex: 20,
};

const donateButtonStyle: React.CSSProperties = {
  background: '#14b8a6',
  border: 'none',
  color: 'white',
  padding: '7px 10px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0,
};

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2,6,23,0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  zIndex: 100,
};

const donateModalStyle: React.CSSProperties = {
  position: 'relative',
  background: '#ffffff',
  color: '#111827',
  borderRadius: 8,
  padding: 18,
  width: 'min(420px, 92vw)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  textAlign: 'center',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 30,
  height: 30,
  border: 'none',
  borderRadius: 6,
  background: '#e5e7eb',
  color: '#111827',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 700,
};

const donateTitleStyle: React.CSSProperties = {
  margin: '8px 32px 6px',
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: 0,
};

const donateTextStyle: React.CSSProperties = {
  margin: '0 0 12px',
  color: '#4b5563',
  fontSize: 14,
  lineHeight: 1.5,
};

const qrStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 320,
  height: 'auto',
  borderRadius: 6,
};
