import * as fs from 'fs';
import * as path from 'path';

function getWritableRoot() {
  const base =
    process.env.PHARMACY_QUEUE_DATA_DIR ||
    process.env.LOCALAPPDATA ||
    process.env.APPDATA ||
    process.cwd();

  return path.join(base, 'Pharmacy Queue');
}

export function dataPath(...parts: string[]) {
  return path.join(getWritableRoot(), 'data', ...parts);
}

export function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
