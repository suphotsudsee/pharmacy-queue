'use client';
import React from 'react';
import type { Room } from '@/lib/types';

type Snapshot = {
  current: number | null;
  items: { number: number; status: string; createdAt: number }[];
  tailNumber: number;
  counterName: string;
  systemTitle: string;
  queueStartNumber: number;
  kioskTitle: string;
};

const KIOSK_ROOM: Room = 'pharmacy';
const KIOSK_QUEUE_ROOMS: Room[] = ['exam', 'pharmacy'];

function printTicket(number: number) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);

  const printDocument = frame.contentWindow?.document;
  if (!printDocument) {
    frame.remove();
    return;
  }

  const issuedAt = new Date().toLocaleString('th-TH');
  printDocument.open();
  printDocument.write(`
    <!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>Queue Ticket ${number}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            color: #000;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            text-align: center;
          }
          .ticket {
            width: 72mm;
            padding: 4mm 2mm;
          }
          .title {
            font-size: 16px;
            font-weight: 800;
            margin-bottom: 4mm;
          }
          .label {
            font-size: 14px;
            font-weight: 700;
          }
          .number {
            font-size: 64px;
            line-height: 1;
            font-weight: 900;
            margin: 2mm 0 4mm;
          }
          .help {
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 3mm;
          }
          .time {
            border-top: 1px dashed #000;
            padding-top: 3mm;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="title">บัตรคิวรับยา</div>
          <div class="label">หมายเลขคิว</div>
          <div class="number">${number}</div>
          <div class="help">กรุณารอเรียกคิวบนจอแสดงผล</div>
          <div class="time">ออกบัตร: ${issuedAt}</div>
        </div>
      </body>
    </html>
  `);
  printDocument.close();

  const cleanup = () => window.setTimeout(() => frame.remove(), 1000);
  frame.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    cleanup();
  }, 100);
}

export default function KioskPage() {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [ticketNumber, setTicketNumber] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const refresh = React.useCallback(async () => {
    const res = await fetch(`/api/queue?room=${KIOSK_ROOM}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('load queue failed');
    const data: Snapshot = await res.json();
    setSnapshot(data);
    return data;
  }, []);

  React.useEffect(() => {
    refresh().catch(() => {});

    const events = new EventSource(`/api/queue/events?room=${KIOSK_ROOM}`);
    events.onmessage = (event) => {
      setSnapshot(JSON.parse(event.data));
    };

    return () => events.close();
  }, [refresh]);

  const issueTicket = async () => {
    setLoading(true);
    setError('');
    try {
      const snapshots = await Promise.all(KIOSK_QUEUE_ROOMS.map(async (room) => {
        if (room === KIOSK_ROOM && snapshot) return [room, snapshot] as const;

        const res = await fetch(`/api/queue?room=${room}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('load queue failed');
        const data: Snapshot = await res.json();
        return [room, data] as const;
      }));
      const snapshotByRoom = Object.fromEntries(snapshots) as Record<Room, Snapshot>;

      const results = await Promise.all(KIOSK_QUEUE_ROOMS.map(async (room) => {
        const res = await fetch(`/api/queue?room=${room}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            queueStartNumber: snapshotByRoom[room].queueStartNumber,
          }),
        });
        if (!res.ok) throw new Error('issue queue failed');
        const data = await res.json();
        if (!data.added?.number && data.added?.number !== 0) throw new Error('missing queue number');
        return [room, data.added.number] as const;
      }));

      const numberByRoom = Object.fromEntries(results) as Record<Room, number>;
      const ticket = numberByRoom[KIOSK_ROOM];
      setTicketNumber(ticket);
      printTicket(ticket);
      await refresh();
    } catch {
      setError('ไม่สามารถออกบัตรคิวได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const waiting = (snapshot?.items ?? []).filter((item) => item.status === 'waiting').length;

  return (
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Pharmacy Queue Kiosk</p>
          <h1 style={titleStyle}>{snapshot?.kioskTitle || 'กดรับบัตรคิว'}</h1>
        </div>
        <div style={timeStyle}>{new Date().toLocaleDateString('th-TH')}</div>
      </section>

      <button
        type="button"
        onClick={issueTicket}
        disabled={loading}
        style={{
          ...kioskButtonStyle,
          opacity: loading ? 0.82 : 1,
        }}
      >
        <span style={buttonLabelStyle}>บัตรคิว</span>
        <span style={buttonTitleStyle}>{loading ? 'กำลังออกบัตรคิว...' : 'กดเพื่อรับบัตรคิว'}</span>
        <span style={buttonHintStyle}>รับหมายเลขคิวและรอเรียกบนจอแสดงผล</span>
        <span style={buttonFooterStyle}>คิวรอเรียก {waiting} คิว</span>
      </button>

      <section style={ticketPanelStyle} aria-live="polite">
        {ticketNumber ? (
          <>
            <div style={ticketLabelStyle}>หมายเลขคิวของคุณ</div>
            <div style={ticketNumberStyle}>{ticketNumber}</div>
            <div style={ticketHelpStyle}>กรุณารอเรียกคิวบนจอแสดงผล</div>
          </>
        ) : (
          <>
            <div style={emptyTicketTitleStyle}>แตะปุ่มใหญ่เพื่อออกบัตรคิว</div>
            <div style={emptyTicketTextStyle}>หมายเลขคิวล่าสุดจะแสดงที่นี่หลังจากกดรับบัตร</div>
          </>
        )}
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  color: '#0f172a',
  padding: 32,
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto auto',
  gap: 24,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 20,
  alignItems: 'flex-start',
};

const eyebrowStyle: React.CSSProperties = {
  margin: '0 0 6px',
  color: '#0f766e',
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: 0,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'clamp(44px, 7vw, 86px)',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
};

const timeStyle: React.CSSProperties = {
  color: '#475569',
  fontSize: 24,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const kioskButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  color: '#ffffff',
  cursor: 'pointer',
  padding: 36,
  minHeight: 360,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  textAlign: 'left',
  background: 'linear-gradient(180deg, #22c55e, #0f766e)',
  boxShadow: '0 18px 40px rgba(15,23,42,0.18)',
};

const buttonLabelStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
};

const buttonTitleStyle: React.CSSProperties = {
  fontSize: 'clamp(56px, 8vw, 104px)',
  lineHeight: 1.02,
  fontWeight: 900,
  letterSpacing: 0,
};

const buttonHintStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  opacity: 0.92,
};

const buttonFooterStyle: React.CSSProperties = {
  alignSelf: 'stretch',
  background: 'rgba(15,23,42,0.22)',
  borderRadius: 8,
  padding: '16px 18px',
  fontSize: 24,
  fontWeight: 900,
};

const ticketPanelStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  minHeight: 190,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 12px 32px rgba(15,23,42,0.08)',
};

const ticketLabelStyle: React.CSSProperties = {
  color: '#0f766e',
  fontSize: 26,
  fontWeight: 900,
};

const ticketNumberStyle: React.CSSProperties = {
  fontSize: 'clamp(90px, 16vw, 180px)',
  lineHeight: 0.9,
  fontWeight: 900,
  letterSpacing: 0,
};

const ticketHelpStyle: React.CSSProperties = {
  color: '#334155',
  fontSize: 28,
  fontWeight: 800,
};

const emptyTicketTitleStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  textAlign: 'center',
};

const emptyTicketTextStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 22,
  fontWeight: 700,
  marginTop: 8,
  textAlign: 'center',
};

const errorStyle: React.CSSProperties = {
  background: '#fee2e2',
  color: '#991b1b',
  border: '1px solid #fecaca',
  borderRadius: 8,
  padding: 16,
  fontSize: 22,
  fontWeight: 800,
  textAlign: 'center',
};
