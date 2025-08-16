import * as fs from 'fs';
import * as path from 'path';
import { Room } from './types';

const settingsFile = path.join(process.cwd(), 'data', 'settings.json');

type Settings = Record<Room, { counterName: string }>;

function loadSettings(): Settings {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    const data = JSON.parse(raw);
    return {
      exam: { counterName: data?.exam?.counterName ?? 'ห้องตรวจ 1' },
      pharmacy: { counterName: data?.pharmacy?.counterName ?? 'ช่องยา 1' },
    };
  } catch {
    return {
      exam: { counterName: 'ห้องตรวจ 1' },
      pharmacy: { counterName: 'ช่องยา 1' },
    };
  }
}

function saveSettingsFromState(state: State) {
  try {
    const data: Settings = {
      exam: { counterName: state.exam.counterName },
      pharmacy: { counterName: state.pharmacy.counterName },
    };
    fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export type QueueItem = { number: number; status: 'waiting'|'calling'|'done'|'skipped'; createdAt: number };
type RoomState = {
  current: number | null;
  items: QueueItem[];
  tailNumber: number;
  counterName: string;
};
type State = Record<Room, RoomState>;

const g = global as any;
if (!g.__MULTI_QUEUE_STATE__) {
  const s = loadSettings();
  g.__MULTI_QUEUE_STATE__ = {
    exam: { current: null, items: [], tailNumber: 0, counterName: s.exam.counterName },
    pharmacy: { current: null, items: [], tailNumber: 0, counterName: s.pharmacy.counterName },
  } as State;
}
export const state: State = g.__MULTI_QUEUE_STATE__;

export function addQueue(room: Room): QueueItem {
  const st = state[room];
  const num = ++st.tailNumber;
  const item: QueueItem = { number: num, status: 'waiting', createdAt: Date.now() };
  st.items.push(item);
  return item;
}

export function getSnapshot(room: Room) {
  const st = state[room];
  return {
    current: st.current,
    items: st.items,
    tailNumber: st.tailNumber,
    counterName: st.counterName,
  };
}

export function nextQueue(room: Room) {
  const st = state[room];
  if (st.current !== null) {
    const cur = st.items.find(i => i.number === st.current);
    if (cur && cur.status === 'calling') cur.status = 'done';
  }
  const next = st.items.find(i => i.status === 'waiting');
  if (!next) { st.current = null; return null; }
  next.status = 'calling';
  st.current = next.number;
  return next.number;
}

export function repeatCurrent(room: Room) { return state[room].current; }

export function callNumber(room: Room, num: number) {
  const st = state[room];
  const item = st.items.find(
    i => i.number === num && (i.status === 'skipped' || i.status === 'waiting')
  );
  if (!item) return st.current;
  if (st.current !== null) {
    const cur = st.items.find(i => i.number === st.current);
    if (cur && cur.status === 'calling') cur.status = 'waiting';
  }
  item.status = 'calling';
  st.current = num;
  return st.current;
}

export function skipCurrent(room: Room) {
  const st = state[room];
  if (st.current === null) return null;
  const cur = st.items.find(i => i.number === st.current);
  if (cur) cur.status = 'skipped';
  const next = st.items.find(i => i.status === 'waiting');
  st.current = next ? next.number : null;
  if (next) next.status = 'calling';
  return st.current;
}

export function doneCurrent(room: Room) {
  const st = state[room];
  if (st.current === null) return null;
  const cur = st.items.find(i => i.number === st.current);
  if (cur) cur.status = 'done';
  const next = st.items.find(i => i.status === 'waiting');
  st.current = next ? next.number : null;
  if (next) next.status = 'calling';
  return st.current;
}

export function resetQueue(room: Room) {
  const st = state[room];
  st.current = null;
  st.items = [];
  st.tailNumber = 0;
}

export function setCounterName(room: Room, name: string) {
  state[room].counterName = name || (room === 'exam' ? 'ห้องตรวจ 1' : 'ช่องยา 1');
  saveSettingsFromState(state);
}
