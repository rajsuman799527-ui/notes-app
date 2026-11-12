import { useSyncExternalStore } from 'react';

export type Tint = 'blue' | 'lilac' | 'mint' | 'peach' | 'white';
export type ChecklistItem = { id: string; text: string; done: boolean };
export type Note = {
  id: string;
  title: string;
  body: string;
  kind: 'text' | 'checklist';
  items: ChecklistItem[];
  pinned: boolean;
  tint: Tint;
  folder: string | null;
  tags: string[];
  archived: boolean;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export const TINTS: Record<Tint, string> = {
  blue: '#EEF5FF',
  lilac: '#F4F0FF',
  mint: '#ECFAF3',
  peach: '#FFF3EC',
  white: '#FFFFFF',
};

const KEY = 'notes.v1';
const FOLDERS = 'notes.folders.v1';
const DAY = 86400000;
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

type State = { notes: Note[]; folders: string[] };
let state: State = load();
const subs = new Set<() => void>();

function load(): State {
  try {
    const notes: Note[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    const folders: string[] = JSON.parse(localStorage.getItem(FOLDERS) || '["Personal","Study"]');
    const cutoff = Date.now() - 30 * DAY;
    return { notes: notes.filter((n) => !n.deletedAt || n.deletedAt > cutoff), folders };
  } catch {
    return { notes: [], folders: ['Personal', 'Study'] };
  }
}
function commit(next: State) {
  state = next;
  localStorage.setItem(KEY, JSON.stringify(state.notes));
  localStorage.setItem(FOLDERS, JSON.stringify(state.folders));
  subs.forEach((f) => f());
}

export function useNotesState() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
  );
}

export function blankNote(partial: Partial<Note> = {}): Note {
  const now = Date.now();
  return {
    id: uid(), title: '', body: '', kind: 'text', items: [], pinned: false, tint: 'white',
    folder: null, tags: [], archived: false, deletedAt: null, createdAt: now, updatedAt: now, ...partial,
  };
}

export const notesApi = {
  upsert(n: Note) {
    const exists = state.notes.some((x) => x.id === n.id);
    commit({ ...state, notes: exists ? state.notes.map((x) => (x.id === n.id ? n : x)) : [n, ...state.notes] });
  },
  patch(id: string, p: Partial<Note>, touch = true) {
    commit({
      ...state,
      notes: state.notes.map((x) => (x.id === id ? { ...x, ...p, updatedAt: touch ? Date.now() : x.updatedAt } : x)),
    });
  },
  trash(id: string) { notesApi.patch(id, { deletedAt: Date.now(), pinned: false }, false); },
  restore(id: string) { notesApi.patch(id, { deletedAt: null, archived: false }, false); },
  destroy(id: string) { commit({ ...state, notes: state.notes.filter((x) => x.id !== id) }); },
  emptyTrash() { commit({ ...state, notes: state.notes.filter((x) => !x.deletedAt) }); },
  duplicate(id: string) {
    const n = state.notes.find((x) => x.id === id);
    if (n) notesApi.upsert({ ...n, id: uid(), title: n.title ? `${n.title} copy` : '', pinned: false, createdAt: Date.now(), updatedAt: Date.now() });
  },
  addFolder(name: string) {
    const v = name.trim();
    if (v && !state.folders.includes(v)) commit({ ...state, folders: [...state.folders, v] });
  },
  removeFolder(name: string) {
    commit({ folders: state.folders.filter((f) => f !== name), notes: state.notes.map((n) => (n.folder === name ? { ...n, folder: null } : n)) });
  },
  get(id: string) { return state.notes.find((x) => x.id === id); },
};

export function seedNotes() {
  if (state.notes.length) return;
  const now = Date.now();
  const it = (t: string, d = false): ChecklistItem => ({ id: uid(), text: t, done: d });
  const notes: Note[] = [
    blankNote({
      title: 'Weekly plan', pinned: true, tint: 'blue', folder: 'Personal', tags: ['planning'],
      body: 'Mon: gym 7am, finish slides for Thursday\nTue: call the bank about the card\nWed: dinner with Aanya at 8\nThu: presentation 11am, then groceries\nFri: early finish, laundry\nWeekend: clean the balcony, long walk, read',
      createdAt: now - 2 * DAY, updatedAt: now - 3 * 3600000,
    }),
    blankNote({
      title: 'Groceries', kind: 'checklist', tint: 'mint', tags: ['home'],
      items: [it('Oat milk', true), it('Eggs (12)', true), it('Spinach'), it('Basmati rice'), it('Greek yogurt'), it('Lemons'), it('Coffee beans')],
      createdAt: now - 4 * DAY, updatedAt: now - 1 * DAY,
    }),
    blankNote({
      title: 'Books to read', tint: 'lilac', folder: 'Personal', tags: ['reading'],
      body: '• The Midnight Library, Matt Haig\n• Atomic Habits, James Clear\n• Klara and the Sun, Kazuo Ishiguro\n• Sapiens, Yuval Noah Harari\n• Tomorrow, and Tomorrow, and Tomorrow',
      createdAt: now - 12 * DAY, updatedAt: now - 9 * DAY,
    }),
    blankNote({
      title: 'Lemon garlic pasta', tint: 'peach', tags: ['recipes'],
      body: 'Serves 2, about 20 min.\n\n200g spaghetti, 3 cloves garlic, 1 lemon (zest + juice), olive oil, chilli flakes, parmesan, parsley.\n\nCook pasta, keep a cup of water. Gently fry garlic and chilli in oil. Toss in pasta, lemon, splash of pasta water, cheese. Finish with parsley and black pepper.',
      createdAt: now - 16 * DAY, updatedAt: now - 15 * DAY,
    }),
    blankNote({
      title: 'Photosynthesis notes', tint: 'blue', folder: 'Study', tags: ['biology'],
      body: 'Light reactions happen in the thylakoid membranes: water is split, O₂ released, ATP and NADPH made.\n\nCalvin cycle in the stroma uses ATP + NADPH to fix CO₂ into glucose. Rubisco is the key enzyme.\n\nRevise: limiting factors graph.',
      createdAt: now - 20 * DAY, updatedAt: now - 19 * DAY,
    }),
  ];
  commit({ ...state, notes });
}

export function fmtDate(t: number) {
  const d = new Date(t);
  const diff = Date.now() - t;
  if (diff < DAY && d.getDate() === new Date().getDate()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diff < 2 * DAY) return 'Yesterday';
  if (diff < 7 * DAY) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function preview(n: Note) {
  if (n.kind === 'checklist') return n.items.map((i) => i.text).join(', ');
  return n.body.replace(/[*_]/g, '');
}
