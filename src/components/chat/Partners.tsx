import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardPaste, Loader2, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { partnerAction, type PartnerActionInputType } from 'zitejs/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { useEffect } from 'react';
import { Avatar, useChat, autoHideHold } from './chatCore';
import { TopBar, useScrolled } from '../notes/NotesHome';

export function formatUid(v: string) {
  const c = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export function useAct() {
  const { token, refresh } = useChat();
  return async (action: PartnerActionInputType['action'], partnershipId?: string, uid?: string) => {
    try {
      console.log('[partner]', action, uid ? `uid=${uid.toUpperCase().replace(/[^A-Z0-9]/g, '')}` : partnershipId);
      const r = await partnerAction({ token, action, partnershipId, uid });
      console.log('[partner] result', r);
      toast(r.message);
      await refresh();
      return r;
    } catch (e) {
      console.error('[partner] failed', e);
      toast('Something went wrong, try again');
      return null;
    }
  };
}

export function AddPartnerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const act = useAct();
  useEffect(() => {
    autoHideHold.current = open;
    return () => { autoHideHold.current = false; };
  }, [open]);
  const send = async () => {
    if (busy) return;
    setBusy(true);
    const r = await act('request', undefined, v);
    setBusy(false);
    if (r?.ok) { setV(''); onClose(); }
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-[rgba(14,23,38,0.2)] backdrop-blur-[3px]" />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(_, i) => i.offset.y > 80 && onClose()}
            className="glass fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] rounded-t-[28px] px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 tab:bottom-[22dvh] tab:max-w-[560px] tab:rounded-[28px] tab:pb-6">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-[#C9D6EA]" />
            <h2 className="mt-5 text-[22px] font-bold tracking-tight">Add partner</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">Enter their ID from their Profile tab.</p>
            <div className="mt-5 flex h-14 items-center gap-2 rounded-[18px] bg-white px-4 ring-1 ring-[rgba(30,107,255,0.12)]">
              <input autoFocus value={v} onChange={(e) => setV(formatUid(e.target.value))} placeholder="XXXX-XXXX" autoCapitalize="characters" autoComplete="off"
                className="flex-1 bg-transparent font-mono text-[20px] tracking-[0.15em] outline-none placeholder:text-[hsl(var(--tertiary))]" />
              <button aria-label="Paste" onClick={async () => { try { setV(formatUid(await navigator.clipboard.readText())); } catch { /* clipboard blocked: type manually */ } }}
                className="press flex h-9 items-center gap-1 rounded-full bg-[#EAF3FF] px-3 text-[13px] font-semibold text-primary">
                <ClipboardPaste className="h-4 w-4" />Paste
              </button>
            </div>
            <button disabled={v.length !== 9 || busy} onClick={send}
              className="press mt-4 flex h-14 w-full items-center justify-center rounded-full bg-primary font-semibold text-white disabled:bg-[#C9D9F3]">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send request'}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Partners({ onAdd }: { onAdd: () => void }) {
  const { data } = useChat();
  const [seg, setSeg] = useState<'partners' | 'requests'>('partners');
  const [blocking, setBlocking] = useState<{ id: string; name: string } | null>(null);
  const act = useAct();
  const scrolled = useScrolled();
  const reqCount = data?.incoming.length || 0;
  return (
    <div className="px-5 pb-36">
      <TopBar title="Partners" scrolled={scrolled} />
      <div className="flex items-end justify-between pt-14 tab:pt-0">
        <h1 className="large-title">Partners</h1>
        <button onClick={onAdd} className="press hidden h-11 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-white tab:flex">Add partner</button>
      </div>
      <div className="card-soft relative mt-4 flex h-11 rounded-full p-1">
        {(['partners', 'requests'] as const).map((s) => (
          <button key={s} onClick={() => setSeg(s)} className="relative flex-1 rounded-full text-[14px] font-semibold capitalize">
            {seg === s && <motion.span layoutId="seg" className="absolute inset-0 rounded-full bg-[#EAF3FF]" transition={{ type: 'spring', stiffness: 300, damping: 28 }} />}
            <span className={`relative ${seg === s ? 'text-primary' : 'text-muted-foreground'}`}>{s}{s === 'requests' && reqCount > 0 ? ` · ${reqCount}` : ''}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-2.5">
        {seg === 'partners' && data?.chats.map((c) => (
          <div key={c.chatId} className="card-soft flex items-center gap-3 rounded-[20px] p-3">
            <Avatar name={c.partner.name} />
            <div className="min-w-0 flex-1"><p className="truncate font-[650]">{c.partner.name}</p><p className="font-mono text-[12px] text-[hsl(var(--tertiary))]">{c.partner.uid}</p></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button aria-label="Options" className="press flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground"><MoreHorizontal className="h-5 w-5" /></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuItem onClick={() => act(c.muted ? 'unmute' : 'mute', c.chatId)}>{c.muted ? 'Unmute' : 'Mute'}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => act('remove', c.chatId)}>Remove</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setBlocking({ id: c.chatId, name: c.partner.name })}>Block</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {seg === 'partners' && data && !data.chats.length && <p className="pt-16 text-center text-muted-foreground">No partners yet</p>}

        {seg === 'requests' && (
          <>
            {data?.incoming.map((r) => (
              <div key={r.id} className="card-soft rounded-[20px] p-4">
                <div className="flex items-center gap-3"><Avatar name={r.name} /><div><p className="font-[650]">{r.name}</p><p className="font-mono text-[12px] text-[hsl(var(--tertiary))]">{r.uid}</p></div></div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => act('accept', r.id)} className="press h-10 flex-1 rounded-full bg-primary font-semibold text-white">Accept</button>
                  <button onClick={() => act('decline', r.id)} className="press h-10 flex-1 rounded-full bg-[#EEF2F8] font-semibold text-muted-foreground">Decline</button>
                </div>
              </div>
            ))}
            {data?.outgoing.map((r) => (
              <div key={r.id} className="card-soft flex items-center gap-3 rounded-[20px] p-3">
                <Avatar name={r.name} />
                <div className="flex-1"><p className="font-mono text-[14px] font-semibold">{r.uid}</p><p className="text-[12px] text-[hsl(var(--tertiary))]">Pending</p></div>
                <button onClick={() => act('cancel', r.id)} className="text-[14px] font-semibold text-primary">Cancel</button>
              </div>
            ))}
            {data && !data.incoming.length && !data.outgoing.length && <p className="pt-16 text-center text-muted-foreground">No requests</p>}
          </>
        )}
      </div>

      <AlertDialog open={!!blocking} onOpenChange={(o) => !o && setBlocking(null)}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Block {blocking?.name}?</AlertDialogTitle>
            <AlertDialogDescription>They won't be able to message you, see your status or find you again. Your chat will be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-destructive hover:bg-destructive/90" onClick={() => blocking && act('block', blocking.id)}>Block</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
