import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { camStatus, useHeadCam, type CamFrame } from './useHeadCam';
import { makeTracker } from './tracker';
import { updateSettings, useHeadMoves } from './headStore';
import HeadIllustration from './HeadIllustration';
import { BASE } from '../../../lib/headDetect';
import { POSITIONS, type Pose } from '../../../lib/headPositions';
import { haptic } from '../../../lib/session';

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="no-scrollbar fixed inset-0 z-[75] overflow-y-auto bg-gradient-to-b from-[#E4EFFF] to-[#F7FAFF] tab:inset-x-0 tab:top-[4dvh] tab:mx-auto tab:max-h-[92dvh] tab:w-[min(560px,92vw)] tab:rounded-[28px] tab:shadow-[0_20px_60px_rgba(20,60,140,0.25)]">
      <div className="mx-auto max-w-[560px] p-5 safe-top">
        <div className="flex items-center justify-between">
          <h2 className="text-[24px] font-bold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/80"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  const pct = Math.max(-1, Math.min(1, v / 30)) * 50;
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-[13px] font-medium text-muted-foreground">{label}</span>
      <div className="relative h-2 flex-1 rounded-full bg-[#DCE8FB]">
        <span className="absolute left-1/2 top-[-3px] h-[14px] w-px bg-[#AFC4E6]" />
        <span className="absolute top-0 h-2 rounded-full bg-primary" style={{ left: `${50 + Math.min(0, pct)}%`, width: `${Math.abs(pct)}%` }} />
      </div>
      <span className="w-10 text-right font-mono text-[13px] tabular-nums">{v.toFixed(0)}°</span>
    </div>
  );
}

function BigCam({ onFrame, status }: { onFrame: (f: CamFrame) => void; status?: string }) {
  const [last, setLast] = useState<CamFrame | null>(null);
  const { videoRef, state, retry } = useHeadCam(true, (f) => { setLast(f); onFrame(f); });
  return (
    <div className="mt-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] border border-white/80 bg-[#DCE8FB] shadow-[0_12px_32px_rgba(20,60,140,0.15)]">
        <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        <span className="glass absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium">
          <span className={`h-2 w-2 rounded-full ${last?.faces === 1 ? 'bg-[#22C55E]' : 'bg-[#AFC4E6]'}`} />{status || camStatus(state, last)}
        </span>
      </div>
      {(state === 'error' || state === 'denied') && <button onClick={retry} className="mt-2 text-[14px] font-semibold text-primary">Try again</button>}
    </div>
  );
}

export function LiveTest({ onClose }: { onClose: () => void }) {
  const tr = useMemo(() => makeTracker(), []);
  const [rel, setRel] = useState<Pose | null>(null);
  const [recal, setRecal] = useState(false);
  const [hit, setHit] = useState<{ name: string; k: number } | null>(null);
  const onFrame = (f: CamFrame) => {
    const o = tr.push(f);
    setRel(o.rel); setRecal(o.recal);
    if (o.hit) { haptic(10); setHit({ name: POSITIONS.find((p) => p.id === o.hit)?.name || o.hit, k: Date.now() }); }
  };
  return (
    <Overlay title="Live test" onClose={onClose}>
      <BigCam onFrame={onFrame} status={recal ? 'Hold still for a moment' : undefined} />
      <div className="card-soft mt-4 space-y-3 rounded-[20px] p-4">
        <Bar label="Yaw" v={rel?.yaw ?? 0} />
        <Bar label="Pitch" v={rel?.pitch ?? 0} />
        <Bar label="Roll" v={rel?.roll ?? 0} />
      </div>
      <div className="mt-4 flex h-14 items-center justify-center rounded-[20px] bg-white/70">
        {hit ? <motion.span key={hit.k} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-full bg-[#22C55E] px-4 py-1.5 font-semibold text-white">{hit.name}</motion.span>
          : <span className="text-[14px] text-muted-foreground">Try a gesture</span>}
      </div>
    </Overlay>
  );
}

function mainAxes(id: string): (keyof Pose)[] {
  const p = POSITIONS.find((x) => x.id === id)!;
  const m = { yaw: 0, pitch: 0, roll: 0 };
  p.frames.forEach((f) => { m.yaw = Math.max(m.yaw, Math.abs(f.yaw)); m.pitch = Math.max(m.pitch, Math.abs(f.pitch)); m.roll = Math.max(m.roll, Math.abs(f.roll)); });
  const top = Math.max(m.yaw, m.pitch, m.roll);
  return (['yaw', 'pitch', 'roll'] as const).filter((k) => m[k] >= top * 0.7);
}

export function AutoTune({ onClose }: { onClose: () => void }) {
  const { moves } = useHeadMoves();
  const list = useMemo(() => POSITIONS.filter((p) => moves[p.id]?.enabled), [moves]);
  const tr = useMemo(() => makeTracker(), []);
  const [i, setI] = useState(0);
  const [rec, setRec] = useState<number | null>(null);
  const peaks = useRef<Record<string, Pose>>({});
  const cur = useRef<Pose>({ yaw: 0, pitch: 0, roll: 0 });
  const recStart = useRef(0);
  const [done, setDone] = useState<Pose | null>(null);

  const onFrame = (f: CamFrame) => {
    const o = tr.push(f, true);
    if (rec == null || !o.rel) return;
    const c = cur.current;
    cur.current = { yaw: Math.max(c.yaw, Math.abs(o.rel.yaw)), pitch: Math.max(c.pitch, Math.abs(o.rel.pitch)), roll: Math.max(c.roll, Math.abs(o.rel.roll)) };
    const left = 3 - (f.t - recStart.current) / 1000;
    if (left <= 0) {
      peaks.current[list[i].id] = cur.current;
      
