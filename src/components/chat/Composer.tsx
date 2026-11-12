import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Smile, X } from 'lucide-react';

const EMOJI = ['😀','😂','😊','😍','🥰','😘','😎','🤔','😴','😭','😡','🥳','🙃','🤗','👀','🔥','✨','💯','🎉','❤️','💙','👍','👌','🙏','👏','💪','🙌','👋','☕','🌙'];

export default function Composer({
  value, onChange, onSend, reply, partnerName, onCancelReply, embedded,
}: {
  embedded?: boolean;
  value: string; onChange: (v: string) => void; onSend: () => void;
  reply: { text: string; fromMe: boolean } | null; partnerName: string; onCancelReply: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [emoji, setEmoji] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 5 * 22 + 16)}px`;
  }, [value]);
  useEffect(() => { if (reply) ref.current?.focus(); }, [reply]);
  const kb = useKeyboardOffset();
  const has = value.trim().length > 0;
  return (
    <div style={{ transform: kb ? `translateY(-${kb}px)` : undefined, paddingBottom: kb ? 8 : undefined }} className={`inset-x-0 bottom-0 z-30 mx-auto px-3 will-change-transform ${embedded ? 'absolute max-w-[820px] pb-[calc(16px+env(safe-area-inset-bottom))]' : 'fixed max-w-[430px] pb-[calc(10px+env(safe-area-inset-bottom))]'}`}>
      <AnimatePresence>
        {emoji && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="glass mb-2 grid grid-cols-10 gap-0.5 rounded-[20px] p-2">
            {EMOJI.map((e) => <button key={e} onClick={() => onChange(value + e)} className="h-9 rounded-xl text-[22px] active:bg-white">{e}</button>)}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="glass overflow-hidden rounded-[26px]">
        <AnimatePresence>
          {reply && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <div className="mx-2 mt-2 flex items-center gap-2 rounded-[16px] bg-white/70 py-2 pl-0 pr-2">
                <div className="h-9 w-[3px] rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-primary">{reply.fromMe ? 'You' : partnerName}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{reply.text}</p>
                </div>
                <button aria-label="Cancel reply" onClick={onCancelReply} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EEF2F8]"><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-end gap-1 p-1.5">
          <button aria-label="Emoji" onClick={() => setEmoji((e) => !e)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${emoji ? 'text-primary' : 'text-muted-foreground'}`}>
            <Smile className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </button>
          <textarea
            ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Message"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); if (has) onSend(); } }}
            onFocus={() => { setEmoji(false); setTimeout(() => window.dispatchEvent(new Event('composer-focus')), 60); }}
            enterKeyHint="send" className="max-h-[126px] flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-[22px] outline-none placeholder:text-[hsl(var(--tertiary))]"
          />
          <AnimatePresence>
            {has && (
              <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                aria-label="Send" onMouseDown={(e) => e.preventDefault()} onClick={() => { onSend(); setEmoji(false); }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_16px_rgba(30,107,255,0.4)]">
                <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** Height of the on-screen keyboard, so the composer rides right on top of it the moment it opens. */
function useKeyboardOffset() {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta && !/interactive-widget/.test(meta.getAttribute('content') || '')) meta.setAttribute('content', `${meta.getAttribute('content')}, interactive-widget=resizes-visual`);
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        setKb(h > 60 ? h : 0);
      });
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); cancelAnimationFrame(raf); };
  }, []);
  return kb;
}
