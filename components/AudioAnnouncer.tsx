'use client';
import React from 'react';
import { speakCall } from '@/lib/tts';
import type { Room } from '@/lib/types';

type Props = {
  systemTitle: string;
  tails: Record<Room, string>;
  setSystemTitle: React.Dispatch<React.SetStateAction<string>>;
  setTails: React.Dispatch<React.SetStateAction<Record<Room, string>>>;
};

export default function AudioAnnouncer({ systemTitle, tails, setSystemTitle, setTails }: Props) {
  const [enabled, setEnabled] = React.useState(false);
  const [testNum, setTestNum] = React.useState(1);

  const enableAudio = async () => {
    try { setEnabled(true); } catch {}
  };

  const updateTail = (room: Room) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTails(t => ({ ...t, [room]: val }));
  };

  const updateSystemTitle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSystemTitle(val);
    await fetch('/api/settings/counter?room=exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemTitle: val }),
    });
  };

  return (
    <div style={{ background: '#121738', borderRadius: 16, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={enableAudio} style={btnStyle}>{enabled ? 'พร้อมเล่นเสียง' : 'เปิดเสียง'}</button>
        <label style={labelStyle}>
          หางเสียงห้องตรวจ:
          <input value={tails.exam} onChange={updateTail('exam')} style={inputStyle} placeholder="ข้อความต่อท้าย" />
        </label>
        <label style={labelStyle}>
          ทดสอบหมายเลข:
          <input type="number" value={testNum} onChange={e => setTestNum(parseInt(e.target.value || '0'))} style={{ ...inputStyle, width: 92 }} />
        </label>
        <label style={labelStyle}>
          ชื่อระบบ:
          <input value={systemTitle} onChange={updateSystemTitle} style={{ ...inputStyle, minWidth: 260 }} placeholder="ระบบเรียกคิวห้องตรวจ" />
        </label>
        <button onClick={() => enabled && speakCall(testNum, tails.exam)} style={btnStyle}>ทดสอบห้องตรวจ</button>
      </div>
      {!enabled && <p style={{ marginTop: 8, opacity: 0.8 }}>ต้องกด "เปิดเสียง" ก่อน เพื่อให้เบราว์เซอร์อนุญาตเล่นเสียง</p>}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const btnStyle: React.CSSProperties = {
  background: '#3b82f6',
  border: 'none',
  color: 'white',
  padding: '10px 14px',
  borderRadius: 10,
  cursor: 'pointer',
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  background: '#0b1020',
  border: '1px solid #243056',
  color: 'white',
  padding: '8px 10px',
  borderRadius: 8,
};
