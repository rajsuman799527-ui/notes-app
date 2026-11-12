import { useEffect, useSyncExternalStore } from 'react';
import { getHeadMoves, saveHeadMoves } from 'zitejs/api';
import { cacheGet, cacheSet, getSession } from '../../../lib/session';
import { POSITIONS, type Pose } from '../../../lib/headPositions';
import type { Thresholds } from '../../../lib/headDetect';
import { toast } from 'sonner';

export type HMSettings = { enabled: boolean; sensitivity: number; sendInstantly: boolean; partnerConsent: boolean; setupDone: boolean; neutral: Pose | null; tune: Thresholds | null };
export type HMMove = { message: string; enabled: boolean; sensitivity?: number | null };
type State = { settings: HMSettings; moves: Record<string, HMMove>; loaded: boolean };

export const DEFAULT_SETTINGS: HMSettings = { enabled: true, sensitivity: 2, sendInstantly: false, partnerConsent: false, setupDone: false, neutral: null, tune: null };
const defaultMoves = (): Record<string, HMMove> => Object.fromEntries(POSITIONS.map((p) => [p.id, { message: p.defaultMessage, enabled: p.defaultOn, sensitivity: null }]));

let state: State = (() => {
  const c = cacheGet<State>('headmoves.v2');
  return c ? { ...c, settings: { ...DEFAULT_SETTINGS, ...c.settings }, moves: { ...defaultMoves(), ...c.moves } } : { settings: DEFAULT_SETTINGS, moves: defaultMoves(), loaded: false };
})();
const subs = new Set<() => void>();
const set = (s: State) => { state = s; cacheSet('headmoves.v2', s); subs.forEach((f) => f()); };
let loading = false;

async function load() {
  const token = getSession()?.token;
  if (loading || !token) return;
  loading = true;
  try {
    const r = await getHeadMoves({ token });
    const moves = defaultMoves();
    r.moves.forEach((m) => { if (moves[m.positionId]) moves[m.positionId] = { message: m.message, enabled: m.enabled, sensitivity: m.sensitivity }; });
    set({ settings: r.settings ? { ...DEFAULT_SETTINGS, ...r.settings } : DEFAULT_SETTINGS, moves, loaded: true });
  } catch { /* keep cache */ }
  loading = false;
}

export function useHeadMoves() {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
  useEffect(() => { if (!state.loaded) load(); }, []);
  return s;
}

export function getHM() { return state; }

const token = () => getSession()?.token;

export async function updateSettings(p: Partial<HMSettings>) {
  set({ ...state, settings: { ...state.settings, ...p } });
  const t = token();
  if (!t) return;
  const { neutral, tune, ...rest } = p;
  try {
    await saveHeadMoves({ token: t, settings: { ...rest, ...(neutral ? { neutral } : {}), ...(tune !== undefined ? { tune: tune || { yaw: 0, pitch: 0, roll: 0 } } : {}) } });
  } catch { toast("Couldn't save"); }
}

export async function updateMove(id: string, m: HMMove) {
  set({ ...state, moves: { ...state.moves, [id]: m } });
  const t = token();
  if (!t) return;
  try { await saveHeadMoves({ token: t, moves: [{ positionId: id, message: m.message, enabled: m.enabled, sensitivity: m.sensitivity ?? null }] }); } catch { toast("Couldn't save"); }
}

export async function resetMoves() {
  const d = defaultMoves();
  set({ ...state, moves: d, settings: { ...state.settings, sensitivity: 2, sendInstantly: false, tune: null } });
  const t = token();
  if (!t) return;
  try {
    await saveHeadMoves({ token: t, settings: { sensitivity: 2, sendInstantly: false, tune: { yaw: 0, pitch: 0, roll: 0 } }, moves: POSITIONS.map((p) => ({ positionId: p.id, message: d[p.id].message, enabled: d[p.id].enabled, sensitivity: null })) });
  } catch { toast("Couldn't save"); }
}
  
