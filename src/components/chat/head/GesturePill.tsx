import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { haptic } from '../../../lib/session';

/** Preview pill with a 1.5 s countdown before a gesture message is sent. */
export default function GesturePill({ text, onSend, onCancel }: { text: string; onSend: () => void; onCancel: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => { haptic(10); onSend(); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  const r = 9, c = 2 * Math.PI * r;
  return (
    <motion.div initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.95 }}
      className="glass absolute bottom-[96px] left-1/2 z-30 flex max-w-[86%] -translate-x-1/2 items-center gap-3 rounded-full py-2 pl-3 pr-2">
      <svg width="22" height="22" className="shrink-0">
        <circle cx="11" cy="11" r={r} fill="none" stroke="rgba(30,107,255,0.15)" strokeWidth="2.5" />
        <motion.circle cx="11" cy="11" r={r} fill="none" stroke="#1E6BFF" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: 0 }} animate={{ strokeDashoffset: c }} transition={{ duration: 1.5, ease: 'linear' }} transform="rotate(-90 11 11)" />
      </svg>
      <span className="truncate text-[15px] font-semibold">{text}</span>
      <button onClick={onCancel} className="press shrink-0 rounded-full bg-[#EEF2F8] px-3 py-1.5 text-[13px] font-semibold text-muted-foreground">Cancel</button>
    </motion.div>
  );
}
