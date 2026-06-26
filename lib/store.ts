import * as fs from 'fs';
import { Room } from './types';
import { dataPath, ensureDir } from './paths';
import { notifyQueue } from './queue-events';

const settingsFile = dataPath('settings.json');

type RoomSettings = {
  counterName: string;
  systemTitle: string;
  queueStartNumber: number;
  kioskTitle: string;
};
type Settings = Record<Room, RoomSettings>;

const defaultSettings: Settings = {
  exam: {
    counterName: 'ห้องตรวจ 1',
    systemTitle: 'ระบบเรียกคิวห้องตรวจ',
    queueStartNumber: 1,
    kioskTitle: 'กดรับบัตรคิว',
  },
  pharmacy: {
    counterName: 'ช่องยา 1',
    systemTitle: 'ระบบเรียกคิวห้องยา',
    queueStartNumber: 1,
    kioskTitle: 'กดรับบัตรคิว',
  },
};

function normalizeQueueStartNumber(value: unknown, fallback = 1) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(1, Math.floor(numberValue));
}

function loadSettings(): Settings {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    const data = JSON.parse(raw);
    return {
      exam: {
        counterName: data?.exam?.counterName ?? defaultSettings.exam.counterName,
        systemTitle: data?.exam?.systemTitle ?? defaultSettings.exam.systemTitle,
        queueStartNumber: normalizeQueueStartNumber(data?.exam?.queueStartNumber, defaultSettings.exam.queueStartNumber),
        kioskTitle: data?.exam?.kioskTitle ?? defaultSettings.exam.kioskTitle,
      },
      pharmacy: {
        counterName: data?.pharmacy?.counterName ?? defaultSettings.pharmacy.counterName,
        systemTitle: data?.pharmacy?.systemTitle ?? defaultSettings.pharmacy.systemTitle,
        queueStartNumber: normalizeQueueStartNumber(data?.pharmacy?.queueStartNumber, defaultSettings.pharmacy.queueStartNumber),
        kioskTitle: data?.pharmacy?.kioskTitle ?? defaultSettings.pharmacy.kioskTitle,
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
        queueStartNumber: state.exam.queueStartNumber,
        kioskTitle: state.exam.kioskTitle,
      },
      pharmacy: {
        counterName: state.pharmacy.counterName,
        systemTitle: state.pharmacy.systemTitle,
        queueStartNumber: state.pharmacy.queueStartNumber,
        kioskTitle: state.pharmacy.kioskTitle,
      },
    };
    ensureDir(dataPath());
    fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export type QueueItem = { number: number; status: 'waiting'|'calling'|'done'|'skipped'; createdAt: number };
export type CurrentQueueCall = {
  queueNumber: number | string;
  text: string;
  ttsId: string;
  audioParts?: { id: string; rate: number }[];
  calledAt: number;
};
type RoomState = {
  current: number | null;
  currentCall: CurrentQueueCall | null;
  items: QueueItem[];
  tailNumber: number;
  counterName: string;
  systemTitle: string;
  queueStartNumber: number;
  kioskTitle: string;
};
type State = Record<Room, RoomState>;

const g = global as any;
if (!g.__MULTI_QUEUE_STATE__) {
  const s = loadSettings();
  g.__MULTI_QUEUE_STATE__ = {
    exam: {
      current: null,
      currentCall: null,
      items: [],
      tailNumber: s.exam.queueStartNumber - 1,
      counterName: s.exam.counterName,
      systemTitle: s.exam.systemTitle,
      queueStartNumber: s.exam.queueStartNumber,
      kioskTitle: s.exam.kioskTitle,
    },
    pharmacy: {
      current: null,
      currentCall: null,
      items: [],
      tailNumber: s.pharmacy.queueStartNumber - 1,
      counterName: s.pharmacy.counterName,
      systemTitle: s.pharmacy.systemTitle,
      queueStartNumber: s.pharmacy.queueStartNumber,
      kioskTitle: s.pharmacy.kioskTitle,
    },
  } as State;
}
export const state: State = g.__MULTI_QUEUE_STATE__;

for (const room of ['exam', 'pharmacy'] as Room[]) {
  state[room].currentCall ??= null;
  state[room].queueStartNumber ??= defaultSettings[room].queueStartNumber;
  state[room].kioskTitle ??= defaultSettings[room].kioskTitle;
}

export function addQueue(room: Room, startNumber?: number): QueueItem {
  const st = state[room];
  if (startNumber !== undefined && st.current === null && st.items.length === 0) {
    st.queueStartNumber = normalizeQueueStartNumber(startNumber, st.queueStartNumber);
    st.tailNumber = st.queueStartNumber - 1;
    saveSettingsFromState(state);
  }
  const num = ++st.tailNumber;
  const item: QueueItem = { number: num, status: 'waiting', createdAt: Date.now() };
  st.items.push(item);
  notifyQueue(room);
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
    queueStartNumber: st.queueStartNumber,
    kioskTitle: st.kioskTitle,
  };
}

export function getCurrentQueueCall(room: Room) {
  return state[room].currentCall;
}

export function setCurrentQueueCall(room: Room, call: CurrentQueueCall) {
  state[room].currentCall = call;
  notifyQueue(room);
  return call;
}

export function nextQueue(room: Room) {
  const st = state[room];
  if (st.current !== null) {
    const cur = st.items.find(i => i.number === st.current);
    if (cur && cur.status === 'calling') cur.status = 'done';
  }
  let next = st.items.find(i => i.status === 'waiting');
  if (!next) {
    next = { number: ++st.tailNumber, status: 'waiting', createdAt: Date.now() };
    st.items.push(next);
  }
  next.status = 'calling';
  st.current = next.number;
  notifyQueue(room);
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
  notifyQueue(room);
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
  notifyQueue(room);
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
  notifyQueue(room);
  return st.current;
}

export function resetQueue(room: Room) {
  const st = state[room];
  st.current = null;
  st.items = [];
  st.tailNumber = st.queueStartNumber - 1;
  notifyQueue(room);
}

export function setCounterName(room: Room, name: string) {
  state[room].counterName = name || defaultSettings[room].counterName;
  saveSettingsFromState(state);
  notifyQueue(room);
}

export function setSystemTitle(room: Room, title: string) {
  state[room].systemTitle = title || defaultSettings[room].systemTitle;
  saveSettingsFromState(state);
  notifyQueue(room);
}

export function setQueueStartNumber(room: Room, value: number) {
  const st = state[room];
  st.queueStartNumber = normalizeQueueStartNumber(value, defaultSettings[room].queueStartNumber);
  if (st.current === null && st.items.length === 0) {
    st.tailNumber = st.queueStartNumber - 1;
  }
  saveSettingsFromState(state);
  notifyQueue(room);
}

export function setKioskTitle(room: Room, title: string) {
  state[room].kioskTitle = title || defaultSettings[room].kioskTitle;
  saveSettingsFromState(state);
  notifyQueue(room);
}
