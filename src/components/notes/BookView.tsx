import { useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { Check } from 'lucide-react';
import { fmtDate, type Note } from '../../lib/notes';
import { useIsTablet } from '../../lib/useLayout';

function PageContent({ note, num, side = 'right' }: { note?: Note; num: number; side?: 'left' | 'right' }) {
  const L = side === 'left';
  if (!note) return <div className={`paper h-full ${L ? 'rounded-l-[18px] rounded-r-[6px]' : 'rounded-r-[18px] rounded-l-[6px]'}`} />;
  return (
    <div className={`paper relative h-full overflow-hidden pt-8 ${L ? 'rounded-l-[18px] rounded-r-[6px] pl-6 pr-9' : 'rounded-r-[18px] rounded-l-[6px] pl-9 pr-6'}`}>
      <div className={`pointer-events-none absolute inset-y-0 w-6 via-[rgba(20,40,90,0.04)] to-transparent ${L ? 'right-0 bg-gradient-to-l from-[rgba(20,40,90,0.16)]' : 'left-0 bg-gradient-to-r from-[rgba(20,40,90,0.14)]'}`} />
      <div className={`pointer-events-none absolute inset-y-4 border-dashed border-[rgba(30,60,120,0.18)] ${L ? 'right-3 border-r' : 'left-3 border-l'}`} />
      <div className={`pointer-events-none absolute bottom-0 h-16 w-16 ${L ? 'left-0 bg-[radial-gradient(circle_at_0%_100%,rgba(20,40,90,0.12),transparent_70%)]' : 'right-0 bg-[radial-gradient(circle_at_100%_100%,rgba(20,40,90,0.12),transparent_70%)]'}`} />
      <p className="text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--tertiary))]">{fmtDate(note.updatedAt)}</p>
      <h2 className="mt-1 text-[26px] font-medium leading-[32px]" style={{ fontFamily: 'var(--font-serif)' }}>{note.title || 'Untitled'}</h2>
      <div className="mt-1 text-[17px] leading-[32px] text-[#27324a]" style={{ fontFamily: 'var(--font-serif)' }}>
        {note.kind === 'checklist'
          ? note.items.map((i) => (
              <div key={i.id} className="flex items-center gap-2">
                <span className={`flex h-4 w-4 items-center justify-center rounded-[4px] border ${i.done ? 'border-primary bg-primary' : 'border-[#9fb5d8]'}`}>{i.done && <Check className="h-3 w-3 text-white" />}</span>
                <span className={i.done ? 'line-through opacity-50' : ''}>{i.text}</span>
              </div>
            ))
          : <p className="line-clamp-[13] whitespace-pre-line">{note.body.replace(/[*_]/g, '')}</p>}
      </div>
      <p className="absolute inset-x-0 bottom-4 text-center text-[13px] italic text-[hsl(var(--tertiary))]" style={{ fontFamily: 'var(--font-serif)' }}>{num}</p>
    </div>
  );
}

export default function BookView({ notes, onOpen }: { notes: Note[]; onOpen: (n: Note) => void }) {
  const [[page, dir], setPage] = useState<[number, number]>([0, 1]);
  const spread = useIsTablet();
  const x = useMotionValue(0);
  const rotateY = useTransform(x, [-260, 0, 260], [-55, 0, 18]);
  const shade = useTransform(x, [-260, 0, 260], [0.35, 0, 0.12]);
  if (!notes.length) return <p className="pt-24 text-center text-muted-foreground">Nothing here yet</p>;
  const go = (d: number) => {
    const step = spread ? 2 : 1;
    const n = page - (spread ? page % 2 : 0) + d * step;
    if (n < 0 || n >= notes.length) return;
    setPage([n, d]);
  };
  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - r.left) / r.width;
    if (rel < 0.33) go(-1);
    else if (rel > 0.67) go(1);
    else onOpen(notes[page]);
  };
  if (spread) {
    const p = page - (page % 2);
    return (
      <div className="mt-6">
        <div className="relative mx-auto flex h-[calc(100dvh-220px)] min-h-[440px] max-w-[1100px]" style={{ perspective: 2000 }}>
          <div className="relative flex-1 cursor-pointer shadow-[0_12px_40px_rgba(20,60,140,0.12)]" onClick={() => (notes[p] ? onOpen(notes[p]) : undefined)}
            onDoubleClick={() => go(-1)}>
            <PageContent side="left" note={notes[p]} num={p + 1} />
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-8 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(20,40,90,0.18),transparent)]" />
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div key={p} custom={dir} className="relative flex-1 cursor-pointer shadow-[0_12px_40px_rgba(20,60,140,0.12)]"
              style={{ transformOrigin: 'left center' }}
              initial={{ rotateY: dir > 0 ? 0 : -90, opacity: dir > 0 ? 0.4 : 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: dir > 0 ? -100 : 0, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.3, 0.7, 0.3, 1] }}
              drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.5} dragSnapToOrigin
              onDragEnd={(_, i) => { if (i.offset.x < -70) go(1); else if (i.offset.x > 70) go(-1); }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX - r.left > r.width * 0.6) go(1); else if (notes[p + 1]) onOpen(notes[p + 1]); }}>
              <PageContent note={notes[p + 1]} num={p + 2} />
            </motion.div>
          </AnimatePresence>
          <button aria-label="Previous page" onClick={() => go(-1)} className="absolute inset-y-0 left-0 z-10 w-12" />
        </div>
        <div className="mx-auto mt-5 h-1 w-1/2 overflow-hidden rounded-full bg-[#DCE8FB]">
          <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${(Math.min(p + 2, notes.length) / notes.length) * 100}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="mt-6">
      <div className="relative h-[calc(100dvh-260px)] min-h-[420px]" style={{ perspective: 1600 }}>
        {notes[page + 1] && <div className="absolute inset-0 shadow-[0_8px_30px_rgba(20,60,140,0.08)]"><PageContent note={notes[page + 1]} num={page + 2} /></div>}
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={page}
            custom={dir}
            className="absolute inset-0 cursor-pointer shadow-[0_12px_40px_rgba(20,60,140,0.14)]"
            style={{ rotateY, x: 0, transformOrigin: 'left center', transformStyle: 'preserve-3d' }}
            variants={{
              enter: (d: number) => (d > 0 ? { opacity: 1, rotateY: 0 } : { rotateY: -100, opacity: 0.6 }),
              center: { rotateY: 0, opacity: 1 },
              exit: (d: number) => (d > 0 ? { rotateY: -105, opacity: 0, zIndex: 5 } : { opacity: 0, zIndex: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.3, 0.7, 0.3, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            dragSnapToOrigin
            onDrag={(_, i) => x.set(i.offset.x)}
            onDragEnd={(_, i) => {
              x.set(0);
              if (i.offset.x < -70) go(1);
              else if (i.offset.x > 70) go(-1);
            }}
            onClick={tap}
          >
            <PageContent note={notes[page]} num={page + 1} />
            <motion.div className="pointer-events-none absolute inset-0 rounded-r-[18px] bg-gradient-to-l from-[rgba(20,40,90,0.5)] to-transparent" style={{ opacity: shade }} />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mx-auto mt-5 h-1 w-2/3 overflow-hidden rounded-full bg-[#DCE8FB]">
        <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${((page + 1) / notes.length) * 100}%` }} />
      </div>
    </div>
  );
}
