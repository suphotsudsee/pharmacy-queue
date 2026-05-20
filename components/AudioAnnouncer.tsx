'use client';
import React from 'react';
import { speakCall } from '@/lib/tts';
import type { Room } from '@/lib/types';

type Props = {
  systemTitles: Record<Room, string>;
  tails: Record<Room, string>;
  setSystemTitles: React.Dispatch<React.SetStateAction<Record<Room, string>>>;
  setTails: React.Dispatch<React.SetStateAction<Record<Room, string>>>;
};

export default function AudioAnnouncer({ systemTitles, tails, setSystemTitles, setTails }: Props) {
  const [enabled, setEnabled] = React.useState(false);
  const [testNum, setTestNum] = React.useState(1);

  const enableAudio = async () => {
    try { setEnabled(true); } catch {}
  };

  const updateTail = (room: Room) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTails(t => ({ ...t, [room]: val }));
  };

  const updateSystemTitle = (room: Room) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSystemTitles((titles) => ({ ...titles, [room]: val }));
    await fetch(`/api/settings/counter?room=${room}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemTitle: val }),
    });
  };

  return (
    <div style={{ background: '#121738', borderRadius: 10, padding: 10, marginTop: 10, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={enableAudio} style={btnStyle}>{enabled ? 'พร้อมเล่นเสียง' : 'เปิดเสียง'}</button>
        <label style={labelStyle}>
          ทดสอบหมายเลข:
          <input type="number" value={testNum} onChange={e => setTestNum(parseInt(e.target.value || '0'))} style={{ ...inputStyle, width: 92 }} />
        </label>
        <label style={labelStyle}>
          หางเสียงห้องตรวจ:
          <input value={tails.exam} onChange={updateTail('exam')} style={inputStyle} placeholder="ข้อความต่อท้าย" />
        </label>
        <label style={labelStyle}>
          หางเสียงห้องจ่ายยา:
          <input value={tails.pharmacy} onChange={updateTail('pharmacy')} style={inputStyle} placeholder="ข้อความต่อท้าย" />
        </label>
        <label style={labelStyle}>
          ชื่อระบบห้องตรวจ:
          <input value={systemTitles.exam} onChange={updateSystemTitle('exam')} style={{ ...inputStyle, minWidth: 240 }} placeholder="ระบบเรียกคิวห้องตรวจ" />
        </label>
        <label style={labelStyle}>
          ชื่อระบบห้องจ่ายยา:
          <input value={systemTitles.pharmacy} onChange={updateSystemTitle('pharmacy')} style={{ ...inputStyle, minWidth: 240 }} placeholder="ระบบเรียกคิวห้องจ่ายยา" />
        </label>
        <button onClick={() => enabled && speakCall(testNum, tails.exam)} style={btnStyle}>ทดสอบห้องตรวจ</button>
        <button onClick={() => enabled && speakCall(testNum, tails.pharmacy)} style={btnStyle}>ทดสอบห้องจ่ายยา</button>
      </div>
      {!enabled && <p style={{ margin: '6px 0 0', opacity: 0.8, fontSize: 13 }}>ต้องกด "เปิดเสียง" ก่อน เพื่อให้เบราว์เซอร์อนุญาตเล่นเสียง</p>}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  flexWrap: 'wrap',
  fontSize: 13,
};

const btnStyle: React.CSSProperties = {
  background: '#3b82f6',
  border: 'none',
  color: 'white',
  padding: '8px 10px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  background: '#0b1020',
  border: '1px solid #243056',
  color: 'white',
  padding: '6px 8px',
  borderRadius: 6,
  fontSize: 13,
};
