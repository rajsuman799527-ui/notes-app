// Device session + local chat cache
const SESSION = 'notes.device';
const CACHE_PREFIX = 'notes.c.';

export type Session = { uid: string; token: string };

export function getSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION) || 'null');
  } catch {
    return null;
  }
}
export function setSession(s: Session) {
  localStorage.setItem(SESSION, JSON.stringify(s));
}
export function cacheGet<T>(k: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + k) || 'null');
  } catch {
    return null;
  }
}
export function cacheSet(k: string, v: unknown) {
  try {
    localStorage.setItem(CACHE_PREFIX + k, JSON.stringify(v));
  } catch {
    /* quota */
  }
}
export function clearChatCache() {
  Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k));
}
export function wipeDevice() {
  clearChatCache();
  localStorage.removeItem(SESSION);
  localStorage.removeItem('notes.v1');
  localStorage.removeItem('notes.folders.v1');
  localStorage.removeItem('notes.prefs');
}

export type Prefs = { view: 'list' | 'book'; sound: boolean; recent: string[]; lockCycles: number; motionAsked: boolean; idleSec: number; hmNumbers: boolean };
export function getPrefs(): Prefs {
  const d: Prefs = { view: 'list', sound: true, recent: [], lockCycles: 0, motionAsked: false, idleSec: 15, hmNumbers: false };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem('notes.prefs') || '{}') };
  } catch {
    return d;
  }
}
export function setPrefs(p: Partial<Prefs>) {
  localStorage.setItem('notes.prefs', JSON.stringify({ ...getPrefs(), ...p }));
}

export const haptic = (ms = 8) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* noop */
  }
};
