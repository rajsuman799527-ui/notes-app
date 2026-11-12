import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, LayoutGrid, Search } from 'lucide-react';
import NoteCard from './NoteCard';
import BookView from './BookView';
import { useNotesState, type Note } from '../../lib/notes';
import { getPrefs, setPrefs } from '../../lib/session';

export function useScrolled(threshold = 40) {
  const [s, setS] = useState(false);
  useEffect(() => {
    const f = () => setS(window.scrollY > threshold);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, [threshold]);
  return s;
}

export function TopBar({ title, scrolled, right }: { title: string; scrolled: boolean; right?: React.ReactNode }) {
  return (
    <div className={`safe-top fixed left-1/2 top-0 z-20 w-full max-w-[430px] -translate-x-1/2 transition-all duration-300 tab:static tab:max-w-none tab:translate-x-0 ${scrolled ? 'glass rounded-b-[20px] !border-t-0 tab:!border-0 tab:!bg-transparent tab:!shadow-none tab:![backdrop-filter:none]' : ''}`}>
      <div className="flex h-12 items-center justify-between px-5">
        <motion.span animate={{ opacity: scrolled ? 1 : 0, y: scrolled ? 0 : 6 }} className="text-[16px] font-[650] tab:invisible">{title}</motion.span>
        {right}
      </div>
    </div>
  );
}

export default function NotesHome({ onOpen, onSearch, onNew }: { onOpen: (n: Note) => void; onSearch: () => void; onNew: () => void }) {
  const { notes } = useNotesState();
  const [view, setView] = useState(getPrefs().view);
  const scrolled = useScrolled();
  const live = notes.filter((n) => !n.deletedAt && !n.archived).sort((a, b) => b.updatedAt - a.updatedAt);
  const pinned = live.filter((n) => n.pinned);
  const recent = live.filter((n) => !n.pinned);
  const toggle = () => {
    const v = view === 'list' ? 'book' : 'list';
    setView(v);
    setPrefs({ view: v });
  };

  const toggleBtn = (
    <button onClick={toggle} aria-label="Change view" className="press card-soft flex h-9 w-9 items-center justify-center rounded-full">
      {view === 'list' ? <BookOpen className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} /> : <LayoutGrid className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />}
    </button>
  );

  return (
    <div className="px-5 pb-36">
      <TopBar title="Notes" scrolled={scrolled} right={toggleBtn} />
      <h1 className="large-title pt-14 tab:pt-0">Notes</h1>
      <button onClick={onSearch} className="card-soft mt-4 flex h-11 w-full items-center gap-2 rounded-full px-4 text-[15px] text-[hsl(var(--tertiary))]">
        <Search className="h-4 w-4" strokeWidth={1.75} /> Search
      </button>
      <AnimatePresence mode="wait">
        {view === 'book' ? (
          <motion.div key="book" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BookView notes={[...pinned, ...recent]} onOpen={onOpen} />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {live.length === 0 && (
              <div className="flex flex-col items-center pt-24 text-center">
                <div className="card-soft relative h-28 w-24 rounded-[18px]"><div className="absolute right-0 top-0 h-8 w-8 rounded-bl-[12px] bg-[#EAF3FF]" /></div>
                <p className="mt-6 text-[20px] font-[650]">Nothing here yet</p>
                <button onClick={onNew} className="press mt-5 h-12 rounded-full bg-primary px-6 font-semibold text-white">Write a note</button>
              </div>
            )}
            {pinned.length > 0 && (
              <>
                <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Pinned</p>
                <div className="tab:grid tab:grid-cols-2 tab:gap-3 land:grid-cols-3">{pinned.map((n, i) => <NoteCard key={n.id} note={n} index={i} wide onOpen={() => onOpen(n)} />)}</div>
              </>
            )}
            {recent.length > 0 && (
              <>
                <p className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
                <div className="columns-2 gap-3 tab:columns-3 land:columns-4">
                  {recent.map((n, i) => <NoteCard key={n.id} note={n} index={i + 1} onOpen={() => onOpen(n)} />)}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
