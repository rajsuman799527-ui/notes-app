import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, ArrowRight, FileText, Folder, Hash, Trash2 } from 'lucide-react';
import DigitBoxes from '../DigitBoxes';
import { useNotesState } from '../../lib/notes';
import { unlock } from 'zitejs/api';
import { clearChatCache, getPrefs, getSession, setPrefs, haptic } from '../../lib/session';

export type LibraryMode = 'all' | 'folders' | 'tags' | 'archive' | 'trash';

export default function Drawer({ onLibrary, onUnlock }: { onLibrary: (m: LibraryMode) => void; onUnlock: () => void }) {
  const [open, setOpen] = useState(false);
  const { notes, folders } = useNotesState();
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      touch.current = t.clientX < 22 ? { x: t.clientX, y: t.clientY } : null;
    };
    const move = (e: TouchEvent) => {
      if (!touch.current) return;
      const t = e.touches[0];
      if (t.clientX - touch.current.x > 50 && Math.abs(t.clientY - touch.current.y) < 40) { setOpen(true); touch.current = null; }
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move); };
  }, []);

  const live = notes.filter((n) => !n.deletedAt);
  const rows: { m: LibraryMode; label: string; icon: typeof FileText; count: number }[] = [
    { m: 'all', label: 'All Notes', icon: FileText, count: live.filter((n) => !n.archived).length },
    { m: 'folders', label: 'Folders', icon: Folder, count: folders.length },
    { m: 'tags', label: 'Tags', icon: Hash, count: new Set(live.flatMap((n) => n.tags)).size },
    { m: 'archive', label: 'Archive', icon: Archive, count: live.filter((n) => n.archived).length },
    { m: 'trash', label: 'Trash', icon: Trash2, count: notes.length - live.length },
  ];

  return (
    <>
      <button aria-label="Bookmark" onClick={() => { haptic(); setOpen(true); }}
        className="dots fixed z-20 h-16 w-3.5 rounded-r-[8px] bg-[#DCEBFF] shadow-[2px_4px_12px_rgba(30,107,255,0.15)]"
        style={{ top: '30%', left: 'var(--edge-left)' }} />
      <AnimatePresence>
        {open && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-[rgba(14,23,38,0.18)] backdrop-blur-[3px]" />
            <motion.aside key="dr" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.6, right: 0 }} onDragEnd={(_, i) => i.offset.x < -60 && setOpen(false)}
              className="glass safe-top fixed bottom-0 top-0 z-50 flex w-[78%] max-w-[336px] tab:w-[360px] tab:max-w-[360px] flex-col rounded-r-[28px] !border-l-0"
              style={{ left: 'var(--edge-left)' }}>
              <h2 className="px-6 pb-4 pt-8 text-[28px] font-bold tracking-tight">Notes</h2>
              <div className="flex-1 space-y-0.5 px-3">
                {rows.map(({ m, label, icon: I, count }) => (
                  <button key={m} onClick={() => { setOpen(false); onLibrary(m); }} className="press flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-white/60">
                    <I className="h-5 w-5 text-primary" strokeWidth={1.75} />
                    <span className="flex-1 text-[16px] font-medium">{label}</span>
                    <span className="text-[14px] text-[hsl(var(--tertiary))]">{count}</span>
                  </button>
                ))}
              </div>
              <GoToPage onSuccess={() => { setOpen(false); setTimeout(onUnlock, 120); }} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

const LOCK_KEY = 'notes.gtp.lock';

function GoToPage({ onSuccess }: { onSuccess: () => void }) {
  const [v, setV] = useState('');
  const [lockedUntil, setLockedUntil] = useState(() => Number(localStorage.getItem(LOCK_KEY) || 0));
  const [, tick] = useState(0);
  const fails = useRef(0);
  const busy = useRef(false);
  const locked = lockedUntil > Date.now();

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [locked]);

  const lock = (secs: number) => {
    const until = Date.now() + secs * 1000;
    localStorage.setItem(LOCK_KEY, String(until));
    setLockedUntil(until);
    const cycles = getPrefs().lockCycles + 1;
    if (cycles >= 5) { clearChatCache(); setPrefs({ lockCycles: 0 }); } else setPrefs({ lockCycles: cycles });
  };

  const submit = async (code: string) => {
    const s = getSession();
    if (busy.current || code.length !== 2 || !s) return;
    busy.current = true;
    try {
      const r = await unlock({ token: s.token, code });
      if (r.ok) { haptic(); fails.current = 0; setPrefs({ lockCycles: 0 }); onSuccess(); return; }
      setV('');
      fails.current += 1;
      if (r.lockedSeconds > 0 || fails.current >= 4) { fails.current = 0; lock(r.lockedSeconds || 60); }
    } catch {
      setV('');
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="card-soft m-4 mb-[calc(16px+env(safe-area-inset-bottom))] rounded-[20px] p-4">
      <p className="text-[15px] font-[650]">Go to page</p>
      <div className="mt-3 flex items-center justify-between">
        <DigitBoxes size="sm" masked value={v} disabled={locked} onChange={(x) => { setV(x); if (x.length === 2) submit(x); }} />
        <button aria-label="Go" disabled={locked || v.length < 2} onClick={() => submit(v)}
          className="press flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white disabled:bg-[#C9D9F3]">
          <ArrowRight className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
