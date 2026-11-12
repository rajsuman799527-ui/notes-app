import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { toast } from 'sonner';
import { camStatus, useHeadCam, type CamFrame } from './useHeadCam';
import { makeTracker } from './tracker';
import { getHM } from './headStore';
import { getPrefs, haptic } from '../../../lib/session';
import type { Pose } from '../../../lib/headPositions';

type Corner = 'tl' | 'tr' | 'bl' | 'br';
const cornerStyle: Record<Corner, React.CSSProperties> = {
  tl: { top: 76, left: 28 }, tr: { top: 76, right: 16 }, bl: { bottom: 128, left: 28 }, br: { bottom: 128, right: 16 },
};

export function HeadTab({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button aria-label="Head Moves camera" onClick={onClick}
      className={`absolute left-0 top-[45%] z-30 flex h-16 w-3.5 items-center justify-center rounded-r-full border border-l-0 border-white/70 shadow-[0_4px_14px_rgba(30,107,255,0.18)] backdrop-blur-xl transition-colors ${active ? 'bg-primary' : 'bg-[rgba(214,230,255,0.85)]'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : 'bg-primary'}`} />
    </button>
  );
}

/** Small crosshair with a dot that follows the head angle. */
export function PoseDot({ rel, size = 34 }: { rel: Pose | null; size?: number }) {
  const c = (v: number) => Math.max(-1, Math.min(1, v / 25));
  // mirrored: user's left shows on the left
  const x = rel ? -c(rel.yaw) * (size / 2 - 5) : 0, y = rel ? -c(rel.pitch) * (size / 2 - 5) : 0;
  return (
    <div className="relative rounded-full border border-white/70 bg-white/40 backdrop-blur" style={{ width: size, height: size }}>
      <span className="absolute left-1/2 top-1 h-[calc(100%-8px)] w-px -translate-x-1/2 bg-white/70" />
      <span className="absolute left-1 top-1/2 h-px w-[calc(100%-8px)] -translate-y-1/2 bg-white/70" />
      <span className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-full ${rel ? 'bg-primary' : 'bg-[#AFC4E6]'}`}
        style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, transition: 'transform 60ms linear' }} />
    </div>
  );
}

export default function MiniCamera({ container, tablet, pending, onGesture, onClose }: {
  container: RefObject<HTMLDivElement>; tablet: boolean; pending: boolean; onGesture: (text: string) => void; onClose: () => void;
}) {
  const [corner, setCorner] = useState<Corner>('tl');
  const [frame, setFrame] = useState<CamFrame | null>(null);
  const [rel, setRel] = useState<Pose | null>(null);
  const [recal, setRecal] = useState(false);
  const tracker = useMemo(() => makeTracker(), []);
  const warned = useRef(false);
  const self = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const w = tablet ? 120 : 96, h = tablet ? 160 : 128;
  const showNums = getPrefs().hmNumbers;

  const onFrame = (f: CamFrame) => {
    setFrame(f);
    const tag = document.activeElement?.tagName;
    const out = tracker.push(f, tag === 'TEXTAREA' || tag === 'INPUT');
    setRel(out.rel); setRecal(out.recal);
    if (out.rel && Math.max(Math.abs(out.rel.yaw), Math.abs(out.rel.pitch)) > 8) window.dispatchEvent(new Event('hm-activity'));
    if (!out.hit) return;
    window.dispatchEvent(new Event('hm-activity'));
    const { settings, moves } = getHM();
    const m = moves[out.hit];
    if (!m?.enabled || !m.message.trim()) return;
    if (!settings.partnerConsent) {
      if (!warned.current) { warned.current = true; toast('Confirm your partner is fine with Head Moves in Profile first'); }
      return;
    }
    haptic(12);
    onGesture(m.message.trim());
  };
  const { videoRef, state, retry } = useHeadCam(true, onFrame);

  useEffect(() => {
    const vis = () => document.visibilityState === 'hidden' && onClose();
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const c = container.current?.getBoundingClientRect();
    const r = self.current?.getBoundingClientRect();
    if (!c || !r) return;
    if (r.left - c.left < 10 && info.offset.x < 0) { onClose(); return; }
    const cx = r.left + r.width / 2 - c.left, cy = r.top + r.height / 2 - c.top;
    setCorner(`${cy < c.height / 2 ? 't' : 'b'}${cx < c.width / 2 ? 'l' : 'r'}` as Corner);
    x.set(0); y.set(0);
  };

  const status = pending ? 'Sending in 1.5 s' : camStatus(state, frame, recal);
  const faceOk = !!frame && frame.faces === 1;
  return (
    <motion.div ref={self} layout drag dragConstraints={container} dragElastic={0.15} dragMomentum={false} onDragEnd={onDragEnd}
      initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.3 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      style={{ ...cornerStyle[corner], x, y, width: w, touchAction: 'none', transformOrigin: 'left center' }} className="absolute z-[35] flex flex-col items-center">
      <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-[#DCE8FB] shadow-[0_12px_32px_rgba(20,60,140,0.22)]" style={{ width: w, height: h }}>
        <video ref={videoRef} playsInline muted className="pointer-events-none h-full w-full -scale-x-100 object-cover" />
        <span className={`absolute left-2 top-2 h-2 w-2 rounded-full ring-2 ring-white/80 ${faceOk ? 'bg-[#22C55E]' : 'bg-[#AFC4E6]'}`} />
        <div className="absolute bottom-1.5 right-1.5"><PoseDot rel={rel} size={tablet ? 34 : 28} /></div>
        {showNums && rel && (
          <span className="absolute left-1.5 top-5 rounded-md bg-black/35 px-1 font-mono text-[9px] leading-tight text-white">
            Y{rel.yaw.toFixed(0)} P{rel.pitch.toFixed(0)} R{rel.roll.toFixed(0)}
          </span>
        )}
      </div>
      <AnimatePresence mode="wait">
        <motion.span key={status} initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className={`glass mt-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status === 'Ready' ? 'text-primary' : ''}`}>{status}</motion.span>
      </AnimatePresence>
      {(state === 'error' || state === 'denied') && (
        <button onClick={retry} className="press mt-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white">Try again</button>
      )}
    </motion.div>
  );
}
