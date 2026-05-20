import type { Room } from './types';

type Listener = () => void;
type ListenerState = Record<Room, Set<Listener>>;

const g = global as typeof global & {
  __QUEUE_EVENT_LISTENERS__?: ListenerState;
};

if (!g.__QUEUE_EVENT_LISTENERS__) {
  g.__QUEUE_EVENT_LISTENERS__ = {
    exam: new Set<Listener>(),
    pharmacy: new Set<Listener>(),
  };
}

const listeners = g.__QUEUE_EVENT_LISTENERS__;

export function subscribeQueue(room: Room, listener: Listener) {
  listeners[room].add(listener);
  return () => listeners[room].delete(listener);
}

export function notifyQueue(room: Room) {
  for (const listener of listeners[room]) {
    listener();
  }
}
