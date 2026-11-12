import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Switch } from '@project/components/ui/switch';
import HeadIllustration from './HeadIllustration';
import { RoundCam } from './Calibrate';
import { updateMove, useHeadMoves } from './headStore';
import { makeTracker } from './tracker';
import { SENS_STEPS } from '../../../lib/headDetect';
import { POSITIONS, SUGGESTIONS, type Position } from '../../../lib/headPositions';
import { haptic } from '../../../lib/session';
import type { CamFrame } from './useHeadCam';

function Tester({ pos }: { pos: Position }) {
  const tr = useMemo(() => makeTracker(), []);
  const [hit, setHit] = useState<string | null>(null);
  const onFrame = (f: CamFrame) => {
    const out = tr.push(f);
    if (out.hit) { if (out.hit === pos.id) haptic(12); setHit(out.hit); setTimeout(() => setHit(null), 1400); }
  };
  const ok = hit === pos.id;
  const other = hit && !ok ? POSITIONS.find((p) => p.id === hit)?.name : null;
  return (
    <div className="mt-4 flex flex-col items-center">
      <RoundCam size={150} onFrame={onFrame} progress={ok ? 1 : 0} ringColor="#22C55E" label={ok ? undefined : other ? `Saw: ${other}` : undefined} />
      <AnimatePresence>{ok && <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="mt-2 rounded-full bg-[#22C55E] px-3 py-1 text-[13px] font-semibold text-white">Detected</motion.span>}</AnimatePresence>
    </div>
  );
}

export default function MoveSheet({ pos, onClose }: { pos: Position | null; onClose: () => void }) {
  return <AnimatePresence>{pos && <Inner key={pos.id} pos={pos} onClose={onClose} />}</AnimatePresence>;
}

function Inner({ pos, onClose }: { pos: Position; onClose: () => void }) {
  const { moves } = useHeadMoves();
  const cur = moves[pos.id];
  const [msg, setMsg] = useState(cur.message);
  const [on, setOn] = useState(cur.enabled);
  const [sens, setSens] = useState<number | null>(cur.sensitivity ?? null);
  const [testing, setTesting] = useState(false);
  const dirty = () => msg !== cur.message || on !== cur.enabled || sens !== (cur.sensitivity ?? null);
  const save = () => updateMove(pos.id, { message: msg.slice(0, 60), enabled: on, sensitivity: sens });
  const close = () => { if (dirty()) save(); onClose(); };
  const setSensLive = (v: number | null) => { setSens(v); updateMove(pos.id, { message: msg.slice(0, 60), enabled: on, sensitivity: v }); };
  return (
    <>
      <motion.div className="fixed inset-0 z-[72] bg-[rgba(10,30,70,0.2)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="glass no-scrollbar fixed inset-x-0 bottom-0 z-[73] mx-auto max-h-[92dvh] max-w-[560px] overflow-y-auto rounded-t-[28px] p-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h3 className="text-[20px] font-bold">{pos.name}</h3>
          <button aria-label="Close" onClick={close} className="press flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF2F8]"><X className="h-4 w-4" /></button>
        </div>
        {!testing ? (
          <div className="mt-2 flex justify-center rounded-[24px] bg-gradient-to-b from-[#F2F7FF] to-[#E5EFFF] py-4"><HeadIllustration pos={pos} animated size={150} /></div>
        ) : <Tester pos={pos} />}
        <label className="mt-5 block text-[13px] font-medium text-muted-foreground">Message</label>
        <div className="mt-1.5 flex items-center rounded-2xl bg-white/80 px-4 ring-1 ring-[rgba(30,107,255,0.12)] focus-within:ring-primary">
          <input value={msg} maxLength={60} onChange={(e) => setMsg(e.target.value)} placeholder="Type a message" className="h-12 flex-1 bg-transparent text-[16px] outline-none" />
          <span className="text-[12px] text-[hsl(var(--tertiary))]">{msg.length}/60</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setMsg(s)} className={`press rounded-full px-3 py-1.5 text-[13px] font-medium ${msg === s ? 'bg-primary text-white' : 'bg-[#EAF3FF] text-primary'}`}>{s}</button>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className="font-medium">On</span>
          <Switch checked={on} onCheckedChange={setOn} />
        </div>
        <p className="mt-4 text-[13px] font-medium text-muted-foreground">Sensitivity</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[null, 0, 1, 2, 3, 4].map((v) => (
            <button key={String(v)} onClick={() => setSensLive(v)}
              className={`press rounded-full px-2.5 py-1 text-[12px] font-medium ${sens === v ? 'bg-primary text-white' : 'bg-[#EAF3FF] text-primary'}`}>{v == null ? 'Default' : SENS_STEPS[v]}</button>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setTesting((t) => !t)} className="press h-12 flex-1 rounded-full bg-[#EAF3FF] font-semibold text-primary">{testing ? 'Stop test' : 'Test'}</button>
          <button onClick={close} className="press h-12 flex-1 rounded-full bg-primary font-semibold text-white">Save</button>
        </div>
      </motion.div>
    </>
  );
}
