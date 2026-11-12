import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archive, Bold, Check, ChevronLeft, Copy, Folder, Italic, List, ListChecks, MoreHorizontal, Palette, Pin, Plus, Trash2, X } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@project/components/ui/dropdown-menu';
import { notesApi, uid, TINTS, useNotesState, type Note, type Tint } from '../../lib/notes';
import { haptic } from '../../lib/session';
import { useIsLandscapeTablet, useIsTablet } from '../../lib/useLayout';

const TINT_ORDER: Tint[] = ['white', 'blue', 'lilac', 'mint', 'peach'];
const isEmpty = (n: Note) => !n.title.trim() && !n.body.trim() && !n.items.some((i) => i.text.trim());

export default function Editor({ initial, onClose }: { initial: Note; onClose: () => void }) {
  const [note, setNote] = useState<Note>(initial);
  const [saved, setSaved] = useState(false);
  const { folders } = useNotesState();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);
  const tablet = useIsTablet();
  const land = useIsLandscapeTablet();

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaved(false);
    const t = setTimeout(() => {
      if (isEmpty(note) && !notesApi.get(note.id)) return;
      const tags = Array.from(new Set([...note.tags, ...(note.body.match(/#[\p{L}\d_-]+/gu) || []).map((t) => t.slice(1).toLowerCase())]));
      notesApi.upsert({ ...note, tags, updatedAt: Date.now() });
      setSaved(true);
    }, 350);
    return () => clearTimeout(t);
  }, [note]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [note.body, note.kind]);

  const set = (p: Partial<Note>) => setNote((n) => ({ ...n, ...p }));
  const close = () => {
    if (isEmpty(note) && notesApi.get(note.id)) notesApi.destroy(note.id);
    onClose();
  };
  const wrap = (mark: string) => {
    const el = bodyRef.current;
    if (!el || note.kind !== 'text') return;
    const { selectionStart: s, selectionEnd: e } = el;
    const v = note.body;
    set({ body: v.slice(0, s) + mark + v.slice(s, e) + mark + v.slice(e) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + mark.length, e + mark.length); });
  };
  const bullet = () => {
    if (note.kind !== 'text') return;
    const el = bodyRef.current;
    const pos = el?.selectionStart ?? note.body.length;
    const ls = note.body.lastIndexOf('\n', pos - 1) + 1;
    set({ body: note.body.slice(0, ls) + '• ' + note.body.slice(ls) });
  };
  const toggleChecklist = () => {
    haptic();
    if (note.kind === 'text') {
      const lines = note.body.split('\n').map((l) => l.replace(/^•\s*/, '').trim()).filter(Boolean);
      set({ kind: 'checklist', body: '', items: (lines.length ? lines : ['']).map((t) => ({ id: uid(), text: t, done: false })) });
    } else {
      set({ kind: 'text', body: note.items.map((i) => `• ${i.text}`).join('\n'), items: [] });
    }
  };
  const cycleTint = () => set({ tint: TINT_ORDER[(TINT_ORDER.indexOf(note.tint) + 1) % TINT_ORDER.length] });

  const sheetCls = !tablet
    ? 'fixed inset-0 z-40 mx-auto flex max-w-[430px] flex-col overflow-y-auto'
    : land
      ? 'fixed bottom-3 right-3 top-3 z-40 flex w-[min(560px,48vw)] flex-col overflow-y-auto rounded-[28px] shadow-[0_20px_60px_rgba(20,60,140,0.2)]'
      : 'fixed inset-x-0 bottom-0 top-[6dvh] z-40 mx-auto flex w-[min(720px,calc(100vw-32px))] flex-col overflow-y-auto rounded-t-[28px] shadow-[0_20px_60px_rgba(20,60,140,0.2)]';
  return (
    <>
    {tablet && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} className="fixed inset-0 z-40 bg-[rgba(14,23,38,0.18)] backdrop-blur-[3px]" />}
    <motion.div
      initial={land ? { x: '110%' } : { y: '100%' }} animate={land ? { x: 0 } : { y: 0 }} exit={land ? { x: '110%' } : { y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={sheetCls}
      style={{ background: note.tint === 'white' ? '#FFFFFF' : TINTS[note.tint] }}
    >
      <div className="safe-top glass sticky top-0 z-10 !rounded-none !border-x-0 !border-t-0">
        <div className="flex h-14 items-center justify-between px-3">
          <button onClick={close} className="press flex items-center gap-0.5 rounded-full px-2 py-1.5 font-medium text-primary">
            <ChevronLeft className="h-6 w-6" strokeWidth={1.75} /> Notes
          </button>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[12px] font-medium text-[hsl(var(--tertiary))]">{saved ? 'Saved' : ''}</span>
            <button aria-label="Pin" onClick={() => { haptic(); set({ pinned: !note.pinned }); }} className={`press flex h-10 w-10 items-center justify-center rounded-full ${note.pinned ? 'text-primary' : 'text-muted-foreground'}`}>
              <Pin className={`h-5 w-5 ${note.pinned ? 'fill-primary/20' : ''}`} strokeWidth={1.75} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="More" className="press flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground"><MoreHorizontal className="h-5 w-5" strokeWidth={1.75} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                <DropdownMenuItem onClick={() => { notesApi.upsert(note); notesApi.duplicate(note.id); onClose(); }}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
                <DropdownMenuItem onClick={cycleTint}><Palette className="mr-2 h-4 w-4" />Change color</DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><Folder className="mr-2 h-4 w-4" />Move to folder</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="rounded-2xl">
                    <DropdownMenuItem onClick={() => set({ folder: null })}>{!note.folder && <Check className="mr-2 h-4 w-4" />}None</DropdownMenuItem>
                    {folders.map((f) => <DropdownMenuItem key={f} onClick={() => set({ folder: f })}>{note.folder === f && <Check className="mr-2 h-4 w-4" />}{f}</DropdownMenuItem>)}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => { notesApi.upsert({ ...note, archived: true, pinned: false }); onClose(); }}><Archive className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => { if (notesApi.get(note.id)) notesApi.trash(note.id); onClose(); }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className={`flex-1 px-6 pt-4 ${tablet ? 'pb-6' : 'pb-40'}`}>
        <input value={note.title} onChange={(e) => set({ title: e.target.value })} placeholder="Title" autoFocus={!initial.title}
          className="w-full bg-transparent text-[28px] font-bold tracking-tight outline-none placeholder:text-[hsl(var(--tertiary))]" />
        {note.kind === 'text' ? (
          <textarea ref={bodyRef} value={note.body} onChange={(e) => set({ body: e.target.value })} placeholder="Start writing…"
            className="mt-3 min-h-[50vh] w-full resize-none bg-transparent text-[16px] leading-[1.65] outline-none placeholder:text-[hsl(var(--tertiary))]" />
        ) : (
          <ChecklistEditor items={note.items} onChange={(items) => set({ items })} />
        )}
        <p className="mt-6 text-[12px] font-medium text-[hsl(var(--tertiary))]">Last edited {new Date(note.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
      </div>

      <div className={`glass z-20 flex h-12 items-center justify-around rounded-full px-2 ${tablet ? 'sticky bottom-4 mx-4 mb-4' : 'fixed'}`}
        style={tablet ? undefined : { bottom: 'calc(16px + env(safe-area-inset-bottom))', left: 'max(20px, calc(50% - 195px))', right: 'max(20px, calc(50% - 195px))' }}>
        {[
          { icon: Bold, on: () => wrap('**'), label: 'Bold' },
          { icon: Italic, on: () => wrap('_'), label: 'Italic' },
          { icon: List, on: bullet, label: 'Bullet' },
          { icon: ListChecks, on: toggleChecklist, label: 'Checklist', active: note.kind === 'checklist' },
        ].map(({ icon: I, on, label, active }) => (
          <button key={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={on}
            className={`press flex h-9 w-11 items-center justify-center rounded-full ${active ? 'bg-primary text-white' : 'text-foreground'}`}>
            <I className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        ))}
        <button aria-label="Color" onClick={cycleTint} className="press flex h-9 w-11 items-center justify-center">
          <span className="h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(30,107,255,0.3)]" style={{ background: note.tint === 'white' ? '#fff' : TINTS[note.tint] }} />
        </button>
      </div>
    </motion.div>
    </>
  );
}

function ChecklistEditor({ items, onChange }: { items: Note['items']; onChange: (i: Note['items']) => void }) {
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const add = (after?: number) => {
    const it = { id: uid(), text: '', done: false };
    const next = [...items];
    next.splice(after === undefined ? next.length : after + 1, 0, it);
    onChange(next);
    setTimeout(() => refs.current[it.id]?.focus(), 30);
  };
  return (
    <div className="mt-3 space-y-1">
      <AnimatePresence initial={false}>
        {items.map((it, idx) => (
          <motion.div key={it.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 py-1.5">
            <button aria-label="Toggle" onClick={() => { haptic(); onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x))); }}
              className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] transition-colors ${it.done ? 'border-primary bg-primary' : 'border-[#AFC6EA] bg-white'}`}>
              <AnimatePresence>{it.done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}><Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /></motion.span>}</AnimatePresence>
            </button>
            <div className="relative flex-1">
              <input ref={(el) => (refs.current[it.id] = el)} value={it.text} placeholder="List item"
                onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); add(idx); }
                  if (e.key === 'Backspace' && !it.text && items.length > 1) { e.preventDefault(); onChange(items.filter((x) => x.id !== it.id)); }
                }}
                className={`w-full bg-transparent text-[16px] outline-none transition-colors ${it.done ? 'text-[hsl(var(--tertiary))] line-through' : ''}`} />
            </div>
            <button aria-label="Remove item" onClick={() => onChange(items.filter((x) => x.id !== it.id))} className="text-[hsl(var(--tertiary))]"><X className="h-4 w-4" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
      <button onClick={() => add()} className="flex items-center gap-3 py-2 text-[15px] font-medium text-primary"><Plus className="h-5 w-5" strokeWidth={1.75} />Add item</button>
    </div>
  );
}
