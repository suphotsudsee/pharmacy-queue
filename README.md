# Pharmacy Queue (Thai TTS) – Local v5

ระบบเรียกคิวห้องยา พร้อมเสียงประกาศภาษาไทย (ใช้ Web Speech API) และปุ่มควบคุม
- Next.js 14 (App Router) + React 18
- API คิวแบบ in-memory เหมาะสำหรับเดโม/ใช้งานใน LAN
- ปุ่ม: เรียกถัดไป, เรียกซ้ำ, ข้าม, เสร็จสิ้น, ทดสอบเสียง
- ปุ่ม "เปิดเสียง" เพื่อให้เบราว์เซอร์อนุญาตเล่นเสียง (แก้ปัญหา autoplay)

## การใช้งาน
```bash
npm install
npm run dev
# เปิด http://localhost:3000
```
> สำหรับ production: `npm run build && npm start`

## หมายเหตุ
- เสียงใช้ Web Speech API (ถ้ามีเสียงไทยติดเครื่อง เช่น Google/Android/Edge จะชัดเจน)
- ถ้าไม่มีเสียงไทย ให้เพิ่มไฟล์เสียง MP3 ใน `public/sounds/th/` แล้วแก้ `lib/tts.ts` ให้ใช้โหมดไฟล์


## สร้างเป็น .exe (Electron)
```bash
npm install
# สร้างไฟล์ build ของ Next
npm run build
# ติดตั้ง dependencies สำหรับ Electron (รวมอยู่ใน devDependencies)
# แล้วสร้างไฟล์ติดตั้ง Windows
npm run electron:build
```
ไฟล์ .exe จะอยู่ในโฟลเดอร์ `dist/` (แพ็กด้วย NSIS)
โหมดพัฒนา (เปิดเป็น Desktop App):
```bash
npm run electron:dev
```


## หน้าจอแสดงผลฝั่งประชาชน (TV Mode)
เปิดที่: `/display`
- ตัวเลขใหญ่ เต็มจอ อ่านง่าย
- แสดง "กำลังเรียก" และคิวถัดไป 8 หมายเลข
- ปุ่ม "เต็มจอ" สำหรับ TV/จอมอนิเตอร์
- ตัวเลือก "เสียงเตือนเมื่อเปลี่ยนหมายเลข" (ใช้ไฟล์ `public/sounds/chime.mp3`)


## ชื่อช่องบริการ
- ปรับได้จากหน้าแรก (ฟิลด์ "ชื่อช่องบริการ")
- จะแสดงบนหน้าจอประชาชน `/display` มุมซ้ายบน
- API: `GET/POST /api/settings/counter`


## การบันทึกชื่อช่องบริการถาวร
- ตอนนี้ชื่อช่องบริการจะถูกเก็บใน `data/settings.json`
- เมื่อแก้ไขชื่อช่อง ระบบจะบันทึกลงไฟล์นี้ทันที
- ปิด-เปิดโปรแกรมใหม่ ค่าจะยังคงอยู่


## การบันทึกถาวร (Persistent Settings)
- บันทึกชื่อช่องบริการไว้ที่ `data/settings.json`
- เมื่อแก้ไขชื่อช่อง ระบบจะเขียนไฟล์ทันที
- เปิด/ปิดแอป ค่าจะยังคงเดิม


## ใช้เสียง Google Cloud Text-to-Speech (ภาษาไทย)
1) สร้าง Service Account และดาวน์โหลดไฟล์ JSON (มีสิทธิ์ Cloud Text-to-Speech)
2) วางไฟล์ไว้ที่ `data/gcp-sa.json` (หรือที่ใดก็ได้)
3) ตั้งค่า Environment Variable ก่อนรัน:
   - Windows PowerShell:
     ```powershell
     $env:GOOGLE_APPLICATION_CREDENTIALS="./data/gcp-sa.json"
     npm run dev
     ```
   - CMD:
     ```bat
     set GOOGLE_APPLICATION_CREDENTIALS=./data/gcp-sa.json
     npm run dev
     ```
   - Linux/macOS:
     ```bash
     export GOOGLE_APPLICATION_CREDENTIALS=./data/gcp-sa.json
     npm run dev
     ```
4) ในหน้าเว็บ เลือกเครื่องยนต์เสียง: **Google TTS**
5) ระบบจะเรียก `/api/tts` สร้างเสียงไทยเป็น MP3 และแคชไว้ที่ `data/tts-cache/`


### แก้ปัญหา Google TTS ไม่มีเสียง / error
- ข้อความแจ้งเตือนขึ้นว่า `Missing GOOGLE_APPLICATION_CREDENTIALS` → ยังไม่ได้ตั้งค่า env var ให้ชี้ไปที่ไฟล์ service-account JSON
- ขึ้นว่า `Credentials file not found: ...` → path ผิดหรือไฟล์หาย
- ตรวจว่าเปิด **Text-to-Speech API** แล้วใน Google Cloud
- ดู log ฝั่งเซิร์ฟเวอร์เพื่อทราบ stack trace เพิ่มเติม


## เสียงไทยแบบ Google Translate (แคช MP3)
- API: `POST /api/gt-tts` รับ `{ text, tl }` และบันทึกเสียงเป็น MP3 ใน `data/tts-gt-cache/`
- เล่นไฟล์ผ่าน `GET /api/gt-tts/file/:id`
- ตั้งค่าเริ่มต้นให้ใช้โหมด **Google Translate (แคช MP3)** แล้ว


## โหมดเสียง (คงเหลือเฉพาะ Google Translate TTS แบบแคช MP3)
ระบบจะเรียก `https://translate.google.com/translate_tts` ฝั่งเซิร์ฟเวอร์ แล้วแคชไฟล์ไว้ที่ `data/tts-gt-cache/`.
- API: `POST /api/gt-tts` (body: `{ text }`) -> `{ ok, id }`
- API: `GET /api/gt-tts/file/:id` -> MP3 จากแคช
- UI จะเล่นเสียงทุกครั้งผ่านไฟล์ที่แคช
"# pharmacy-queue" 
