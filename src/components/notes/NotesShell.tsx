import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { FileText, ListChecks, Plus, Search } from 'lucide-react';
import GlassNav, { Fab } from '../GlassNav';
import NotesHome from './NotesHome';
import Checklists from './Checklists';
import SearchTab from './SearchTab';
import Editor from './Editor';
import Drawer, { type LibraryMode } from './Drawer';
import Library from './Library';
import { blankNote, uid, type Note } from '../../lib/notes';

export type NotesTab = 'notes' | 'checklists' | 'search';

export default function NotesShell({ tab, setTab, onUnlock }: { tab: NotesTab; setTab: (t: NotesTab) => void; onUnlock: () => void }) {
  const [editing, setEditing] = useState<Note | null>(null);
  const [library, setLibrary] = useState<LibraryMode | null>(null);
  const newNote = () =>
    setEditing(tab === 'checklists' ? blankNote({ kind: 'checklist', items: [{ id: uid(), text: '', done: false }] }) : blankNote());

  return (
    <div className="app-bg min-h-[100dvh] tab:pl-[max(104px,calc(50%-536px))] tab:pr-[max(16px,calc(50%-624px))]">
      {tab === 'notes' && <NotesHome onOpen={setEditing} onSearch={() => setTab('search')} onNew={newNote} />}
      {tab === 'checklists' && <Checklists onOpen={setEditing} onNew={newNote} />}
      {tab === 'search' && <SearchTab onOpen={setEditing} />}
      <GlassNav layoutId="notes-nav" active={tab} onChange={(k) => setTab(k as NotesTab)}
        tabs={[
          { key: 'notes', label: 'Notes', icon: FileText },
          { key: 'checklists', label: 'Checklists', icon: ListChecks },
          { key: 'search', label: 'Search', icon: Search },
        ]} />
      <Fab icon={Plus} label="New note" onClick={newNote} />
      <Drawer onLibrary={setLibrary} onUnlock={onUnlock} />
      <AnimatePresence>{library && <Library key={library} mode={library} onClose={() => setLibrary(null)} onOpen={setEditing} />}</AnimatePresence>
      <AnimatePresence>{editing && <Editor key={editing.id} initial={editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}
