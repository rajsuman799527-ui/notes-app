import { motion } from 'framer-motion';
import { Check, Pin } from 'lucide-react';
import { fmtDate, preview, TINTS, type Note } from '../../lib/notes';

export function ProgressRing({ value, size = 22 }: { value: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#DCE8FB" strokeWidth={3} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--primary))" strokeWidth={3} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: 'stroke-dashoffset 400ms ease' }} />
    </svg>
  );
}

export default function NoteCard({ note, onOpen, index = 0, wide }: { note: Note; onOpen: () => void; index?: number; wide?: boolean }) {
  const done = note.items.filter((i) => i.done).length;
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28, delay: index * 0.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="card-soft mb-3 block w-full break-inside-avoid rounded-[20px] p-4 text-left"
      style={{ background: TINTS[note.tint] }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-[15px] font-[650] leading-snug tracking-tight">{note.title || 'Untitled'}</h3>
        {note.pinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 rotate-45 text-primary" strokeWidth={1.75} />}
        {note.kind === 'checklist' && note.items.length > 0 && <ProgressRing value={done / note.items.length} />}
      </div>
      {note.kind === 'checklist' ? (
        <div className="mt-2.5 space-y-1.5">
          {note.items.slice(0, 3).map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border ${i.done ? 'border-primary bg-primary' : 'border-[#BFD3F2] bg-white'}`}>
                {i.done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </span>
              <span className={`truncate ${i.done ? 'line-through opacity-60' : ''}`}>{i.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={`mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground ${wide ? 'line-clamp-2' : 'line-clamp-3'}`}>{preview(note) || 'No additional text'}</p>
      )}
      <p className="mt-3 text-[12px] font-medium text-[hsl(var(--tertiary))]">{fmtDate(note.updatedAt)}</p>
    </motion.button>
  );
}
