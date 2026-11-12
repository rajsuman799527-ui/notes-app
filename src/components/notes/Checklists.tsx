import { useState } from 'react';
import NoteCard from './NoteCard';
import { TopBar, useScrolled } from './NotesHome';
import { useNotesState, type Note } from '../../lib/notes';

const FILTERS = ['All', 'Today', 'Done'] as const;

export default function Checklists({ onOpen, onNew }: { onOpen: (n: Note) => void; onNew: () => void }) {
  const { notes } = useNotesState();
  const [f, setF] = useState<(typeof FILTERS)[number]>('All');
  const scrolled = useScrolled();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const lists = notes
    .filter((n) => n.kind === 'checklist' && !n.deletedAt && !n.archived)
    .filter((n) => {
      const done = n.items.length > 0 && n.items.every((i) => i.done);
      if (f === 'Done') return done;
      if (f === 'Today') return n.updatedAt >= start.getTime();
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="px-5 pb-36">
      <TopBar title="Checklists" scrolled={scrolled} />
      <h1 className="large-title pt-14 tab:pt-0">Checklists</h1>
      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
        {FILTERS.map((x) => (
          <button key={x} onClick={() => setF(x)} className={`press h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors ${f === x ? 'bg-primary text-white' : 'card-soft text-muted-foreground'}`}>{x}</button>
        ))}
      </div>
      <div className="mt-5 tab:grid tab:grid-cols-2 tab:gap-3 land:grid-cols-3">
        {lists.map((n, i) => <NoteCard key={n.id} note={n} index={i} wide onOpen={() => onOpen(n)} />)}
        {!lists.length && (
          <div className="pt-20 text-center">
            <p className="text-[18px] font-[650]">No checklists here</p>
            <button onClick={onNew} className="press mt-4 h-11 rounded-full bg-primary px-5 font-semibold text-white">New checklist</button>
          </div>
        )}
      </div>
    </div>
  );
}
