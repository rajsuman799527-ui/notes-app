import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { chatHome, type ChatHomeOutputType } from 'zitejs/api';
import { cacheGet, cacheSet, getPrefs, getSession } from '../../lib/session';

export type HomeData = ChatHomeOutputType;

type Ctx = {
  token: string;
  data: HomeData | null;
  refresh: () => Promise<void>;
  panic: () => void;
  online: boolean;
};
export const ChatCtx = createContext<Ctx>(null as unknown as Ctx);
export const useChat = () => useContext(ChatCtx);

export function useHomeData(paused: boolean) {
  const token = getSession()?.token || '';
  const [data, setData] = useState<HomeData | null>(() => cacheGet<HomeData>('home'));
  const inflight = useRef(false);
  const refresh = useCallback(async () => {
    if (inflight.current || !token) return;
    inflight.current = true;
    try {
      const d = await chatHome({ token });
      setData(d);
      cacheSet('home', d);
    } catch {
      /* keep cached */
    } finally {
      inflight.current = false;
    }
  }, [token]);
  useEffect(() => {
    refresh();
    const t = setInterval(() => !paused && refresh(), 3000);
    return () => clearInterval(t);
  }, [refresh, paused]);
  return { token, data, refresh };
}

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

/** While true (e.g. adding a partner by copying their ID from elsewhere) idle/background auto-hide is paused. */
export const autoHideHold = { current: false };

/** Shake & background → instant. Idle → 3 s countdown (any activity cancels), then trigger. */
export function useAutoHide(trigger: () => void, motionOk: boolean) {
  const cb = useRef(trigger);
  cb.current = trigger;
  const [countdown, setCountdown] = useState<number | null>(null);
  const cd = useRef<number | null>(null);
  const last = useRef(Date.now());
  const stay = useCallback(() => { last.current = Date.now(); cd.current = null; setCountdown(null); }, []);
  useEffect(() => {
    const bump = () => { last.current = Date.now(); if (cd.current != null) { cd.current = null; setCountdown(null); } };
    const idle = setInterval(() => {
      if (autoHideHold.current) { bump(); return; }
      const limit = (getPrefs().idleSec || 15) * 1000;
      const over = Date.now() - last.current - limit;
      if (over < 0) return;
      const left = 3 - Math.floor(over / 1000);
      if (left <= 0) { cd.current = null; setCountdown(null); last.current = Date.now(); cb.current(); return; }
      if (cd.current !== left) { cd.current = left; setCountdown(left); }
    }, 200);
    const vis = () => document.visibilityState === 'hidden' && !autoHideHold.current && cb.current();
    const evs = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'input', 'scroll', 'hm-activity'] as const;
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', vis);
    const ph = () => cb.current();
    window.addEventListener('pagehide', ph);

    let hits: number[] = [];
    let prev: { x: number; y: number; z: number } | null = null;
    const motion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      if (prev) {
        const delta = Math.abs(a.x - prev.x) + Math.abs(a.y - prev.y) + Math.abs(a.z - prev.z);
        if (delta > 32) {
          const now = Date.now();
          hits = [...hits.filter((t) => now - t < 900), now];
          if (hits.length >= 3) { hits = []; cb.current(); }
        }
      }
      prev = { x: a.x, y: a.y, z: a.z };
    };
    if (motionOk) window.addEventListener('devicemotion', motion);
    return () => {
      clearInterval(idle);
      evs.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', ph);
      window.removeEventListener('devicemotion', motion);
    };
  }, [motionOk]);
  return { countdown, stay };
}

export function initials(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '•';
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#CFE3FF] to-[#E3DAFF] font-semibold text-[#0B3FBF]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </div>
  );
}

export function timeShort(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
