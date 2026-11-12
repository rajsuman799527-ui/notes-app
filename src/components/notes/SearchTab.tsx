import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { fmtDate, preview, useNotesState, type Note } from '../../lib/notes';
import { getPrefs, setPrefs } from '../../lib/session';

function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  const start = Math.max(0, i - 30);
  return (
    <>
      {start > 0 && '…'}{text.slice(start, i)}
      <mark className="rounded bg-[#D6E9FF] px-0.5 text-[#0B3FBF]">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function SearchTab({ onOpen }: { onOpen: (n: Note) => void }) {
  const { notes } = useNotesState();
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState(getPrefs().recent);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250); }, []);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return notes.filter((n) => !n.deletedAt && `${n.title} ${preview(n)} ${n.tags.join(' ')}`.toLowerCase().includes(s));
  }, [q, notes]);
  const remember = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r !== t)].slice(0, 6);
    setRecent(next);
    setPrefs({ recent: next });
  };
  return (
    <div className="px-5 pb-36 pt-14 tab:pt-12">
      <h1 className="large-title">Search</h1>
      <div className="card-soft mt-4 flex h-12 items-center gap-2 rounded-full px-4">
        <Search className="h-4 w-4 text-[hsl(var(--tertiary))]" strokeWidth={1.75} />
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && remember(q)} placeholder="Search notes"
          className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-[hsl(var(--tertiary))]" />
        {q && <button aria-label="Clear" onClick={() => setQ('')}><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>
      {!q && recent.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
            <button onClick={() => { setRecent([]); setPrefs({ recent: [] }); }} className="text-[13px] font-medium text-primary">Clear</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {recent.map((r) => <button key={r} onClick={() => setQ(r)} className="press card-soft h-9 rounded-full px-4 text-[14px]">{r}</button>)}
          </div>
        </div>
      )}
      <div className="mt-5 space-y-2.5">
        {results.map((n, i) => (
          <motion.button key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => { remember(q); onOpen(n); }} className="card-soft block w-full rounded-[20px] p-4 text-left">
            <p className="text-[15px] font-[650]"><Hl text={n.title || 'Untitled'} q={q} /></p>
            <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground"><Hl text={preview(n)} q={q} /></p>
            <p className="mt-2 text-[12px] font-medium text-[hsl(var(--tertiary))]">{fmtDate(n.updatedAt)}</p>
          </motion.button>
        ))}
        {q && !results.length && <p className="pt-16 text-center text-muted-foreground">No results for “{q}”</p>}
      </div>
    </div>
  );
}
