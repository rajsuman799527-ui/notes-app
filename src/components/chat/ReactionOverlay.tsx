import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Plus, Reply, Trash, Trash2 } from 'lucide-react';
import { BubbleBody, type UiMessage } from './Bubble';

const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏'];
const ALL = ['😀','😁','😅','🤣','😊','😍','🥰','😘','😎','🤔','😴','🥲','😭','😡','🤯','🥳','😇','🙃','😬','🤗','👀','🔥','✨','💯','🎉','💙','💜','💔','👌','✌️','🤞','💪','🙌','🤝','👋','☕','🍕','🌙','☀️','🌸'];

export default function ReactionOverlay({
  m, rect, partnerName, onClose, onReact, onReply, onCopy, onDeleteMe, onDeleteAll,
}: {
  m: UiMessage; rect: DOMRect; partnerName: string; onClose: () => void; onReact: (e: string) => void;
  onReply: () => void; onCopy: () => void; onDeleteMe: () => void; onDeleteAll: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const vh = window.innerHeight;
  const top = Math.min(Math.max(rect.top, 110), vh - rect.height - 230);
  const mine = m.reactions.find((r) => r.mine)?.emoji;
  const actions = [
    { label: 'Reply', icon: Reply, on: onReply, show: !m.deleted },
    { label: 'Copy', icon: Copy, on: onCopy, show: !m.deleted },
    { label: 'Delete for me', icon: Trash, on: onDeleteMe, show: true },
    { label: 'Delete for everyone', icon: Trash2, on: onDeleteAll, show: m.fromMe && !m.deleted, danger: true },
  ].filter((a) => a.show);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(14,23,38,0.25)] backdrop-blur-md" />
      <div className="absolute mx-auto" style={{ top, left: rect.left, width: rect.width }} onClick={(e) => e.stopPropagation()}>
        {!m.deleted && (
          <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            style={{ transformOrigin: m.fromMe ? 'bottom right' : 'bottom left' }}
            className={`glass absolute bottom-full mb-2 flex items-center gap-0.5 rounded-full p-1.5 ${m.fromMe ? 'right-0' : 'left-0'}`}>
            {QUICK.map((e, i) => (
              <motion.button key={e} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.03 * i, type: 'spring', stiffness: 500, damping: 20 }}
                onClick={() => onReact(e)} className={`flex h-10 w-10 items-center justify-center rounded-full text-[24px] active:scale-125 ${mine === e ? 'bg-[#D6E9FF]' : ''}`}>{e}</motion.button>
            ))}
            <button aria-label="More emoji" onClick={() => setPicker((p) => !p)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-muted-foreground"><Plus className="h-5 w-5" /></button>
          </motion.div>
        )}
        <motion.div initial={{ scale: 1 }} animate={{ scale: 1.03 }} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
          <div className="max-w-full"><BubbleBody m={m} partnerName={partnerName} /></div>
        </motion.div>
        {picker ? (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className={`glass absolute top-full mt-3 grid w-[300px] grid-cols-8 gap-1 rounded-[20px] p-2 ${m.fromMe ? 'right-0' : 'left-0'}`}>
            {ALL.map((e) => <button key={e} onClick={() => onReact(e)} className="h-9 rounded-xl text-[22px] active:bg-white">{e}</button>)}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className={`glass absolute top-full mt-3 w-56 overflow-hidden rounded-[20px] ${m.fromMe ? 'right-0' : 'left-0'}`}>
            {actions.map(({ label, icon: I, on, danger }) => (
              <button key={label} onClick={on} className={`flex h-11 w-full items-center justify-between border-b border-white/50 px-4 text-[15px] last:border-0 active:bg-white/60 ${danger ? 'text-destructive' : ''}`}>
                {label}<I className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
