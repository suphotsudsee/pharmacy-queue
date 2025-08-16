import * as fs from 'fs';
import * as path from 'path';

const settingsFile = path.join(process.cwd(), 'data', 'settings.json');

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { counterName: 'ช่องยา 1' };
  }
}

function saveSettings(name: string) {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify({ counterName: name }, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export type QueueItem = { number: number; status: 'waiting'|'calling'|'done'|'skipped'; createdAt: number };
type State = {
  current: number | null;
  items: QueueItem[];
  tailNumber: number;
  counterName: string;
};
const g = global as any;
if (!g.__QUEUE_STATE__) {
  const initialSettings = loadSettings();
  g.__QUEUE_STATE__ = { current: null, items: [], tailNumber: 0, counterName: initialSettings.counterName } as State;
}
export const state: State = g.__QUEUE_STATE__;
export function addQueue(): QueueItem {
  const num = ++state.tailNumber;
  const item: QueueItem = { number: num, status: 'waiting', createdAt: Date.now() };
  state.items.push(item);
  return item;
}
export function getSnapshot() {
  return {
    current: state.current,
    items: state.items,
    tailNumber: state.tailNumber,
    counterName: state.counterName,
  };
}
export function nextQueue() {
  // finish current if still calling
  if (state.current !== null) {
    const cur = state.items.find(i => i.number === state.current);
    if (cur && cur.status === 'calling') cur.status = 'done';
  }
  // pick next waiting
  const next = state.items.find(i => i.status === 'waiting');
  if (!next) { state.current = null; return null; }
  next.status = 'calling';
  state.current = next.number;
  return next.number;
}
export function repeatCurrent() { return state.current; }
export function skipCurrent() {
  if (state.current === null) return null;
  const cur = state.items.find(i => i.number === state.current);
  if (cur) cur.status = 'skipped';
  // pick next
  const next = state.items.find(i => i.status === 'waiting');
  state.current = next ? next.number : null;
  if (next) next.status = 'calling';
  return state.current;
}
export function doneCurrent() {
  if (state.current === null) return null;
  const cur = state.items.find(i => i.number === state.current);
  if (cur) cur.status = 'done';
  // pick next
  const next = state.items.find(i => i.status === 'waiting');
  state.current = next ? next.number : null;
  if (next) next.status = 'calling';
  return state.current;
}


export function setCounterName(name: string) {
  saveSettings(name);
  state.counterName = name || 'ช่องยา 1';
}
