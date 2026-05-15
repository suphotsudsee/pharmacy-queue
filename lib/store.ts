import * as fs from 'fs';
import { Room } from './types';
import { dataPath, ensureDir } from './paths';

const settingsFile = dataPath('settings.json');

type RoomSettings = {
  counterName: string;
  systemTitle: string;
};
type Settings = Record<Room, RoomSettings>;

const defaultSettings: Settings = {
  exam: {
    counterName: 'ห้องตรวจ 1',
    systemTitle: 'ระบบเรียกคิวห้องตรวจ',
  },
  pharmacy: {
    counterName: 'ช่องยา 1',
    systemTitle: 'ระบบเรียกคิวห้องยา',
  },
};

function loadSettings(): Settings {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    const data = JSON.parse(raw);
    return {
      exam: {
        counterName: data?.exam?.counterName ?? defaultSettings.exam.counterName,
        systemTitle: data?.exam?.systemTitle ?? defaultSettings.exam.systemTitle,
      },
      pharmacy: {
        counterName: data?.pharmacy?.counterName ?? defaultSettings.pharmacy.counterName,
        systemTitle: data?.pharmacy?.systemTitle ?? defaultSettings.pharmacy.systemTitle,
      },
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettingsFromState(state: State) {
  try {
    const data: Settings = {
      exam: {
        counterName: state.exam.counterName,
        systemTitle: state.exam.systemTitle,
      },
      pharmacy: {
        counterName: state.pharmacy.counterName,
        systemTitle: state.pharmacy.systemTitle,
      },
    };
    ensureDir(dataPath());
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
  systemTitle: string;
};
type State = Record<Room, RoomState>;

const g = global as any;
if (!g.__MULTI_QUEUE_STATE__) {
  const s = loadSettings();
  g.__MULTI_QUEUE_STATE__ = {
    exam: {
      current: null,
      items: [],
      tailNumber: 0,
      counterName: s.exam.counterName,
      systemTitle: s.exam.systemTitle,
    },
    pharmacy: {
      current: null,
      items: [],
      tailNumber: 0,
      counterName: s.pharmacy.counterName,
      systemTitle: s.pharmacy.systemTitle,
    },
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
    systemTitle: st.systemTitle,
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
  state[room].counterName = name || defaultSettings[room].counterName;
  saveSettingsFromState(state);
}

export function setSystemTitle(room: Room, title: string) {
  state[room].systemTitle = title || defaultSettings[room].systemTitle;
  saveSettingsFromState(state);
}
