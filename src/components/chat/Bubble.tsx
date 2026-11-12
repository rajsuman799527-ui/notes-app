import { useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Reply } from 'lucide-react';
import Ticks from './Ticks';
import { haptic } from '../../lib/session';

export type UiMessage = {
  id: string;
  clientId: string | null;
  text: string;
  fromMe: boolean;
  status: string; // sending | failed | sent | delivered | seen
  deleted: boolean;
  createdAt: string;
  replyTo: { id: string; text: string; fromMe: boolean } | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
};

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u;

export function RichText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2" onClick={(e) => e.stopPropagation()}>{p}</a>
        ) : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function BubbleBody({ m, partnerName, onQuote }: { m: UiMessage; partnerName: string; onQuote?: (id: string) => void }) {
  const emojiOnly = !m.deleted && m.text.length <= 12 && EMOJI_ONLY.test(m.text);
  const time = new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <div className={`relative max-w-full px-3.5 pb-1.5 pt-2 ${m.fromMe ? 'rounded-[20px] rounded-br-[6px] bg-[#D6E9FF] text-[#0B3FBF]' : 'rounded-[20px] rounded-bl-[6px] bg-white text-foreground shadow-[0_4px_14px_rgba(20,60,140,0.08)]'} ${emojiOnly ? '!bg-transparent !shadow-none px-1' : ''}`}>
      {m.replyTo && (
        <button onClick={(e) => { e.stopPropagation(); onQuote?.(m.replyTo!.id); }}
          className={`mb-1.5 block w-full rounded-[12px] border-l-[3px] border-primary px-2.5 py-1.5 text-left ${m.fromMe ? 'bg-white/50' : 'bg-[#EEF5FF]'}`}>
          <p className="text-[12px] font-semibold text-primary">{m.replyTo.fromMe ? 'You' : partnerName}</p>
          <p className="truncate text-[13px] text-muted-foreground">{m.replyTo.text}</p>
        </button>
      )}
      {m.deleted ? (
        <p className="text-[15px] italic text-[hsl(var(--tertiary))]">This message was deleted</p>
      ) : (
        <p className={`whitespace-pre-wrap break-words ${emojiOnly ? 'text-[44px] leading-tight' : 'text-[15.5px] leading-[1.4]'}`}><RichText text={m.text} /></p>
      )}
      <span className={`float-right ml-2 mt-1 flex items-center gap-1 text-[11px] ${m.fromMe ? 'text-[#4F7AC9]' : 'text-[hsl(var(--tertiary))]'}`}>
        {time}
        {m.fromMe && m.status !== 'failed' && <Ticks status={m.status} />}
      </span>
      {m.reactions.length > 0 && (
        <div className={`absolute -bottom-3 flex gap-0.5 ${m.fromMe ? 'right-2' : 'left-2'}`}>
          {m.reactions.map((r) => (
            <motion.span key={r.emoji} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className={`flex h-6 items-center rounded-full bg-white px-1.5 text-[13px] shadow-[0_2px_8px_rgba(20,60,140,0.15)] ${r.mine ? 'ring-1 ring-primary/40' : ''}`}>
              {r.emoji}{r.count > 1 && <span className="ml-0.5 text-[11px] text-muted-foreground">{r.count}</span>}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Bubble({
  m, partnerName, tight, highlight, onReply, onLongPress, onQuote, onRetry,
}: {
  m: UiMessage; partnerName: string; tight: boolean; highlight: boolean;
  onReply: () => void; onLongPress: (rect: DOMRect) => void; onQuote: (id: string) => void; onRetry: () => void;
}) {
  const x = useMotionValue(0);
  const iconScale = useTransform(x, (v) => Math.min(1, Math.abs(v) / 64));
  const crossed = useRef(false);
  const timer = useRef<number>();
  const ref = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const startPress = () => {
    moved.current = false;
    timer.current = window.setTimeout(() => {
      if (!moved.current && ref.current) { haptic(10); onLongPress(ref.current.getBoundingClientRect()); }
    }, 420);
  };
  const cancelPress = () => clearTimeout(timer.current);

  return (
    <div id={`m-${m.id}`} className={`relative flex ${m.fromMe ? 'justify-end' : 'justify-start'} ${tight ? 'mt-0.5' : 'mt-2.5'} ${m.reactions.length ? 'mb-3' : ''}`}>
      <motion.div style={{ scale: iconScale, opacity: iconScale }}
        className={`absolute top-1/2 -mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary shadow ${m.fromMe ? 'right-2' : 'left-2'}`}>
        <Reply className="h-4 w-4" />
      </motion.div>
      <motion.div
        ref={ref}
        style={{ x }}
        drag={m.deleted ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={m.fromMe ? 0.35 : { left: 0, right: 0.35 }}
        onDragStart={() => { moved.current = true; cancelPress(); }}
        onDrag={(_, i) => {
          const over = Math.abs(i.offset.x) > 60;
          if (over && !crossed.current) haptic(6);
          crossed.current = over;
        }}
        onDragEnd={() => {
          if (crossed.current) onReply();
          crossed.current = false;
          animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
        }}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => { e.preventDefault(); if (ref.current) onLongPress(ref.current.getBoundingClientRect()); }}
        className="relative max-w-[78%] select-none tab:max-w-[62%]"
      >
        <motion.div animate={{ backgroundColor: highlight ? 'rgba(125,180,255,0.35)' : 'rgba(125,180,255,0)' }} className="rounded-[22px]">
          <BubbleBody m={m} partnerName={partnerName} onQuote={onQuote} />
        </motion.div>
        {m.status === 'failed' && (
          <button onClick={onRetry} className="absolute -left-14 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-destructive">Retry</button>
        )}
      </motion.div>
    </div>
  );
}
