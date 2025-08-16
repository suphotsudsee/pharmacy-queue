
'use client';
import React from 'react';
import { setTailText, speakCall } from '@/lib/tts';

export default function AudioAnnouncer() {
  const [enabled, setEnabled] = React.useState(false);
  const [tail, setTail] = React.useState('กรุณาติดต่อรับยา');
  const [testNum, setTestNum] = React.useState(1);

  React.useEffect(() => { setTailText(tail); }, [tail]);

  const enableAudio = async () => {
    try { setEnabled(true); } catch {}
  };

  return (
    <div style={{ background: '#121738', borderRadius: 16, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={enableAudio} style={btnStyle}>{enabled ? 'พร้อมเล่นเสียง ✅' : 'เปิดเสียง 🔊'}</button>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          หางเสียง:
          <input value={tail} onChange={e => setTail(e.target.value)} style={inputStyle} placeholder="ข้อความต่อท้าย" />
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          ทดสอบหมายเลข:
          <input type="number" value={testNum} onChange={e => setTestNum(parseInt(e.target.value||'0'))} style={inputStyle} />
        </label>
        <button onClick={() => enabled && speakCall(testNum)} style={btnStyle}>ทดสอบเสียงประกาศ</button>
      </div>
      {!enabled && <p style={{ marginTop: 8, opacity: 0.8 }}>ต้องกด “เปิดเสียง” ก่อนเพื่อให้เบราว์เซอร์อนุญาตเล่นเสียง</p>}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#3b82f6', border: 'none', color: 'white', padding: '10px 14px',
  borderRadius: 10, cursor: 'pointer', fontWeight: 700
};
const inputStyle: React.CSSProperties = {
  background: '#0b1020', border: '1px solid #243056', color: 'white',
  padding: '8px 10px', borderRadius: 8
};
