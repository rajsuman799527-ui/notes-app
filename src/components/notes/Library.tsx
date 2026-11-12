import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Folder, FolderPlus, Hash, RotateCcw, Trash2 } from 'lucide-react';
import NoteCard from './NoteCard';
import { notesApi, useNotesState, type Note } from '../../lib/notes';
import type { LibraryMode } from './Drawer';

const TITLES: Record<LibraryMode, string> = { all: 'All Notes', folders: 'Folders', tags: 'Tags', archive: 'Archive', trash: 'Trash' };

export default function Library({ mode, onClose, onOpen }: { mode: LibraryMode; onClose: () => void; onOpen: (n: Note) => void }) {
  const { notes, folders } = useNotesState();
  const [sub, setSub] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const live = notes.filter((n) => !n.deletedAt);
  const tags = Array.from(new Set(live.flatMap((n) => n.tags))).sort();

  let list: Note[] = [];
  if (mode === 'all') list = live.filter((n) => !n.archived);
  if (mode === 'archive') list = live.filter((n) => n.archived);
  if (mode === 'trash') list = notes.filter((n) => n.deletedAt);
  if (mode === 'folders' && sub) list = live.filter((n) => n.folder === sub);
  if (mode === 'tags' && sub) list = live.filter((n) => n.tags.includes(sub));
  list = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  const showGroups = (mode === 'folders' || mode === 'tags') && !sub;

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="app-bg fixed inset-0 z-40 mx-auto max-w-[430px] overflow-y-auto tab:max-w-[760px] tab:shadow-[0_0_80px_rgba(20,60,140,0.15)]">
      <div className="safe-top glass sticky top-0 z-10 !rounded-none !border-x-0 !border-t-0">
        <div className="flex h-14 items-center px-3">
          <button onClick={() => (sub ? setSub(null) : onClose())} className="press flex items-center font-medium text-primary"><ChevronLeft className="h-6 w-6" strokeWidth={1.75} />{sub ? TITLES[mode] : 'Notes'}</button>
        </div>
      </div>
      <div className="px-5 pb-16 tab:grid-cols-2">
        <h1 className="large-title pt-3">{sub ?? TITLES[mode]}</h1>
        {mode === 'trash' && <p className="mt-1 text-[13px] text-muted-foreground">Notes are removed after 30 days.</p>}

        {showGroups && mode === 'folders' && (
          <div className="mt-5 space-y-2">
            {folders.map((f) => (
              <div key={f} className="card-soft flex h-14 items-center gap-3 rounded-[20px] px-4">
                <button onClick={() => setSub(f)} className="flex flex-1 items-center gap-3 text-left">
                  <Folder className="h-5 w-5 text-primary" strokeWidth={1.75} /><span className="flex-1 font-medium">{f}</span>
                  <span className="text-sm text-[hsl(var(--tertiary))]">{live.filter((n) => n.folder === f).length}</span>
                  <ChevronRight className="h-4 w-4 text-[hsl(var(--tertiary))]" />
                </button>
                <button aria-label="Remove folder" onClick={() => notesApi.removeFolder(f)} className="text-[hsl(var(--tertiary))]"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); notesApi.addFolder(newFolder); setNewFolder(''); }} className="card-soft flex h-14 items-center gap-3 rounded-[20px] px-4">
              <FolderPlus className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="New folder" className="flex-1 bg-transparent outline-none" />
              {newFolder.trim() && <button className="font-semibold text-primary">Add</button>}
            </form>
          </div>
        )}
        {showGroups && mode === 'tags' && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((t) => <button key={t} onClick={() => setSub(t)} className="press card-soft flex h-10 items-center gap-1.5 rounded-full px-4 font-medium"><Hash className="h-4 w-4 text-primary" />{t}</button>)}
            {!tags.length && <p className="text-muted-foreground">Add #tags inside a note to see them here.</p>}
          </div>
        )}

        {!showGroups && (
          <div className="mt-5">
            {mode === 'trash' && list.length > 0 && (
              <button onClick={() => notesApi.emptyTrash()} className="mb-4 text-[14px] font-semibold text-destructive">Empty trash</button>
            )}
            {list.map((n, i) =>
              mode === 'trash' ? (
                <div key={n.id} className="card-soft mb-3 flex items-center gap-3 rounded-[20px] p-4">
                  <div className="min-w-0 flex-1"><p className="truncate font-[650]">{n.title || 'Untitled'}</p><p className="text-[12px] text-[hsl(var(--tertiary))]">Deleted {new Date(n.deletedAt!).toLocaleDateString()}</p></div>
                  <button aria-label="Restore" onClick={() => notesApi.restore(n.id)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-[#EAF3FF] text-primary"><RotateCcw className="h-4 w-4" /></button>
                  <button aria-label="Delete forever" onClick={() => notesApi.destroy(n.id)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-[#FDECEC] text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              ) : mode === 'archive' ? (
                <div key={n.id} className="relative">
                  <NoteCard note={n} index={i} wide onOpen={() => onOpen(n)} />
                  <button onClick={() => notesApi.patch(n.id, { archived: false }, false)} className="absolute bottom-6 right-4 text-[13px] font-semibold text-primary">Unarchive</button>
                </div>
              ) : (
                <NoteCard key={n.id} note={n} index={i} wide onOpen={() => onOpen(n)} />
              ),
            )}
            {!list.length && <p className="pt-16 text-center text-muted-foreground">Nothing here yet</p>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
