import { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { BellOff, Bell, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { partnerAction } from 'zitejs/api';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { Avatar, timeShort, useChat, type HomeData } from './chatCore';
import Ticks from './Ticks';
import { TopBar, useScrolled } from '../notes/NotesHome';

type Chat = HomeData['chats'][number];

function Row({ c, onOpen, onRemove }: { c: Chat; onOpen: () => void; onRemove: () => void }) {
  const ctrl = useAnimation();
  const { token, refresh } = useChat();
  const mute = async () => {
    ctrl.start({ x: 0 });
    try { const r = await partnerAction({ token, action: c.muted ? 'unmute' : 'mute', partnershipId: c.chatId }); toast(r.message); refresh(); } catch { toast("Couldn't update"); }
  };
  return (
    <div className="relative overflow-hidden rounded-[20px]">
      <div className="absolute inset-y-0 right-0 flex">
        <button onClick={mute} className="flex w-20 flex-col items-center justify-center gap-1 bg-[#7DB4FF] text-[12px] font-semibold text-white">
          {c.muted ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}{c.muted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={() => { ctrl.start({ x: 0 }); onRemove(); }} className="flex w-20 flex-col items-center justify-center gap-1 bg-destructive text-[12px] font-semibold text-white">
          <Trash2 className="h-5 w-5" />Remove
        </button>
      </div>
      <motion.button
        animate={ctrl} drag="x" dragConstraints={{ left: -160, right: 0 }} dragElastic={0.1}
        onDragEnd={(_, i) => ctrl.start({ x: i.offset.x < -60 ? -160 : 0, transition: { type: 'spring', stiffness: 300, damping: 28 } })}
        onClick={onOpen}
        className="card-soft relative flex w-full items-center gap-3 rounded-[20px] p-3 text-left"
      >
        <div className="relative">
          <Avatar name={c.partner.name} />
          {c.status === 'online' && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[hsl(var(--success))] ring-2 ring-white" />}
          {c.status === 'busy' && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[16px] font-[650]">{c.partner.name}</p>
            <span className={`shrink-0 text-[12px] ${c.unread ? 'font-semibold text-primary' : 'text-[hsl(var(--tertiary))]'}`}>{timeShort(c.lastAt)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {c.lastFromMe && c.lastStatus && <Ticks status={c.lastStatus} />}
            <p className="flex-1 truncate text-[14px] text-muted-foreground">
              {c.status === 'busy' ? <span className="font-medium text-amber-600">Busy</span> : c.status === 'typing' ? <span className="text-primary">typing…</span> : c.lastText || 'Say hello'}
            </p>
            {c.muted && <BellOff className="h-3.5 w-3.5 text-[hsl(var(--tertiary))]" />}
            {c.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">{c.unread}</span>}
          </div>
        </div>
      </motion.button>
    </div>
  );
}

export default function ChatsList({ onOpen, onAdd }: { onOpen: (c: Chat) => void; onAdd: () => void }) {
  const { data, token, refresh } = useChat();
  const scrolled = useScrolled();
  const [removing, setRemoving] = useState<Chat | null>(null);
  return (
    <div className="px-5 pb-36">
      <TopBar title="Chats" scrolled={scrolled} />
      <h1 className="large-title pt-14 tab:pt-0">Chats</h1>
      <div className="mt-5 space-y-2.5">
        {!data && [0, 1, 2, 3].map((i) => (
          <div key={i} className="card-soft flex items-center gap-3 rounded-[20px] p-3">
            <div className="shimmer h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2"><div className="shimmer h-3 w-1/3 rounded-full" /><div className="shimmer h-3 w-2/3 rounded-full" /></div>
          </div>
        ))}
        {data?.chats.map((c, i) => (
          <motion.div key={c.chatId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Row c={c} onOpen={() => onOpen(c)} onRemove={() => setRemoving(c)} />
          </motion.div>
        ))}
        {data && !data.chats.length && (
          <div className="flex flex-col items-center pt-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#EAF3FF]"><UserPlus className="h-8 w-8 text-primary" strokeWidth={1.75} /></div>
            <p className="mt-5 text-[20px] font-[650]">No chats yet</p>
            <button onClick={onAdd} className="press mt-4 h-12 rounded-full bg-primary px-6 font-semibold text-white">Add a partner</button>
          </div>
        )}
      </div>
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.partner.name}?</AlertDialogTitle>
            <AlertDialogDescription>This deletes the chat for both of you.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-destructive hover:bg-destructive/90" onClick={async () => {
              if (!removing) return;
              try { const r = await partnerAction({ token, action: 'remove', partnershipId: removing.chatId }); toast(r.message); refresh(); } catch { toast("Couldn't remove"); }
            }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
