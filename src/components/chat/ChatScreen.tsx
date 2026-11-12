import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ChevronLeft, Loader2, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { getMessages, messageAction, sendMessage, type GetMessagesOutputType } from 'zitejs/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { Avatar, useChat } from './chatCore';
import Bubble, { type UiMessage } from './Bubble';
import ReactionOverlay from './ReactionOverlay';
import Composer from './Composer';
import { useAct } from './Partners';
import { cacheGet, cacheSet, getPrefs, haptic } from '../../lib/session';
import { useIsTablet } from '../../lib/useLayout';
import MiniCamera, { HeadTab } from './head/MiniCamera';
import SetupSheet from './head/SetupSheet';
import GesturePill from './head/GesturePill';
import { useHeadMoves } from './head/headStore';

type Partner = GetMessagesOutputType['partner'];

function dayLabel(iso: string) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.06, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.2);
  } catch { /* noop */ }
}

export default function ChatScreen({ chatId, initialName, onBack, embedded }: { chatId: string; initialName: string; onBack: () => void; embedded?: boolean }) {
  const { token, panic, refresh: refreshHome, online } = useChat();
  const act = useAct();
  const cached = cacheGet<{ messages: UiMessage[]; partner: Partner }>(`chat.${chatId}`);
  const [server, setServer] = useState<UiMessage[]>(cached?.messages || []);
  const [older, setOlder] = useState<UiMessage[]>([]);
  const [pending, setPending] = useState<(UiMessage & { replyToId?: string })[]>([]);
  const [partner, setPartner] = useState<Partner | null>(cached?.partner || null);
  const [muted, setMuted] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(!cached);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<UiMessage | null>(null);
  const [overlay, setOverlay] = useState<{ m: UiMessage; rect: DOMRect } | null>(null);
  const [banner, setBanner] = useState<'busy' | 'back' | null>(null);
  const [newChip, setNewChip] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastKey = useRef(0);
  const prevStatus = useRef<string | null>(cached?.partner.status ?? null);
  const lastCount = useRef(0);
  const firstLoad = useRef(true);
  const lastTap = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const tablet = useIsTablet();
  const hm = useHeadMoves();
  const [camOpen, setCamOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [gesture, setGesture] = useState<{ text: string; key: number } | null>(null);
  const closeCam = useCallback(() => { setCamOpen(false); setGesture(null); }, []);
  const onTab = () => {
    haptic();
    if (camOpen) return closeCam();
    if (!hm.settings.setupDone) return setSetupOpen(true);
    setCamOpen(true);
  };

  const poll = useCallback(async () => {
    try {
      const r = await getMessages({ token, chatId, typing: Date.now() - lastKey.current < 3000 });
      setServer(r.messages);
      setHasMore((h) => (firstLoad.current ? r.hasMore : h || r.hasMore));
      setPartner(r.partner);
      setMuted(r.muted);
      setLoading(false);
      cacheSet(`chat.${chatId}`, { messages: r.messages.slice(-40), partner: r.partner });
      setPending((p) => p.filter((x) => !r.messages.some((m) => m.clientId === x.clientId)));
      // busy / back banners
      const prev = prevStatus.current;
      if (r.partner.status === 'busy' && prev !== 'busy' && !firstLoad.current) setBanner('busy');
      if (prev === 'busy' && r.partner.status !== 'busy' && r.partner.backAt && Date.now() - new Date(r.partner.backAt).getTime() < 20000) setBanner('back');
      prevStatus.current = r.partner.status;
      // new incoming
      const incoming = r.messages.filter((m) => !m.fromMe).length;
      if (!firstLoad.current && incoming > lastCount.current) {
        if (getPrefs().sound && !r.muted) beep();
        if (!nearBottom.current) setNewChip(true);
      }
      lastCount.current = incoming;
      firstLoad.current = false;
    } catch {
      setLoading(false);
    }
  }, [token, chatId]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), banner === 'busy' ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [banner]);

  // merge (older pages + latest page + local pending)
  const latestIds = new Set(server.map((m) => m.id));
  const all = [...older.filter((m) => !latestIds.has(m.id)), ...server, ...pending];

  const scrollToBottom = (smooth = true) => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  const lastId = all[all.length - 1]?.id;
  useLayoutEffect(() => {
    if (nearBottom.current) scrollToBottom(!firstLoad.current);
  }, [lastId, all.length]);

  useEffect(() => {
    const f = () => { nearBottom.current = true; scrollToBottom(true); };
    window.addEventListener('composer-focus', f);
    return () => window.removeEventListener('composer-focus', f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = async () => {
    const el = scroller.current!;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom.current) setNewChip(false);
    if (el.scrollTop < 80 && hasMore && !loadingOlder && all.length) {
      setLoadingOlder(true);
      const h = el.scrollHeight;
      try {
        const r = await getMessages({ token, chatId, before: all.find((m) => m.status !== 'sending' && m.status !== 'failed')?.createdAt });
        setOlder((o) => [...r.messages, ...o]);
        setHasMore(r.hasMore);
        requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - h + el.scrollTop; });
      } catch { /* ignore */ }
      setLoadingOlder(false);
    }
  };

  const deliver = async (p: UiMessage & { replyToId?: string }) => {
    setPending((list) => list.map((x) => (x.clientId === p.clientId ? { ...x, status: 'sending' } : x)));
    try {
      const r = await sendMessage({ token, chatId, text: p.text, replyToId: p.replyToId, clientId: p.clientId! });
      setPending((list) => list.map((x) => (x.clientId === p.clientId ? { ...x, id: r.id, status: 'sent', createdAt: r.createdAt } : x)));
    } catch {
      setPending((list) => list.map((x) => (x.clientId === p.clientId ? { ...x, status: 'failed' } : x)));
    }
  };

  useEffect(() => {
    if (!online) return;
    pending.filter((p) => p.status === 'failed').forEach(deliver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const send = (text = draft) => {
    const t = text.trim();
    if (!t) return;
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const p = {
      id: clientId, clientId, text: t, fromMe: true, status: online ? 'sending' : 'failed', deleted: false, createdAt: new Date().toISOString(),
      replyTo: reply ? { id: reply.id, text: reply.text, fromMe: reply.fromMe } : null, reactions: [], replyToId: reply?.id,
    };
    setPending((x) => [...x, p]);
    if (text === draft) setDraft('');
    setReply(null);
    nearBottom.current = true;
    haptic();
    if (online) deliver(p);
  };

  const jumpTo = (id: string) => {
    const el = document.getElementById(`m-${id}`);
    if (!el) return toast('Original message is further up');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(id);
    setTimeout(() => setFlash(null), 1200);
  };

  const doAction = async (action: 'react' | 'deleteMe' | 'deleteAll', m: UiMessage, emoji?: string) => {
    setOverlay(null);
    if (m.status === 'sending' || m.status === 'failed') {
      if (action !== 'react') setPending((p) => p.filter((x) => x.clientId !== m.clientId));
      return;
    }
    // optimistic
    const patch = (list: UiMessage[]) => list.flatMap((x) => {
      if (x.id !== m.id) return [x];
      if (action === 'deleteMe') return [];
      if (action === 'deleteAll') return [{ ...x, deleted: true, text: '', reactions: [] }];
      const had = x.reactions.find((r) => r.mine)?.emoji;
      let rs = x.reactions.map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r)).filter((r) => r.count > 0);
      if (had !== emoji) {
        const ex = rs.find((r) => r.emoji === emoji);
        rs = ex ? rs.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r)) : [...rs, { emoji: emoji!, count: 1, mine: true }];
      }
      return [{ ...x, reactions: rs }];
    });
    setServer(patch); setOlder(patch);
    haptic();
    try { await messageAction({ token, action, messageId: m.id, emoji }); } catch { toast("Couldn't update message"); poll(); }
  };

  const onHeaderTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) panic();
    lastTap.current = now;
  };

  const name = partner?.name || initialName;
  const statusLine = partner?.status === 'typing' ? 'typing…' : partner?.status === 'online' ? 'online' : partner?.status === 'busy' ? 'busy' : '';

  return (
    <motion.div ref={root} initial={embedded ? { opacity: 0 } : { x: '100%' }} animate={embedded ? { opacity: 1 } : { x: 0 }} exit={embedded ? { opacity: 0 } : { x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={embedded ? 'chat-bg relative flex h-full flex-col overflow-hidden' : 'chat-bg fixed inset-0 z-40 mx-auto flex max-w-[430px] flex-col'}>
      <div className={`glass z-20 !rounded-none !border-x-0 !border-t-0 safe-top ${embedded ? 'pl-2' : ''}`} onClick={onHeaderTap}>
        <div className="flex h-14 items-center gap-2 px-2">
          <button aria-label="Back" onClick={(e) => { e.stopPropagation(); onBack(); }} className={`press flex h-10 w-9 items-center justify-center text-primary`}><ChevronLeft className="h-7 w-7" strokeWidth={1.75} /></button>
          <Avatar name={name} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-[650] leading-tight">{name}</p>
            <AnimatePresence mode="wait">
              <motion.p key={statusLine} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`flex items-center gap-1 text-[12px] ${partner?.status === 'busy' ? 'text-amber-600' : 'text-primary'}`}>
                {partner?.status === 'busy' && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}{statusLine}
              </motion.p>
            </AnimatePresence>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="More" onClick={(e) => e.stopPropagation()} className="press flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground"><MoreHorizontal className="h-5 w-5" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onClick={async () => { try { await messageAction({ token, action: 'clearChat', chatId }); setServer([]); setOlder([]); toast('Chat cleared'); } catch { toast("Couldn't clear"); } }}>Clear chat</DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { await act(muted ? 'unmute' : 'mute', chatId); poll(); }}>{muted ? 'Unmute' : 'Mute'}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={async () => { const r = await act('block', chatId); if (r) { refreshHome(); onBack(); } }}>Block</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* invisible corner hit area */}
      <div className="absolute right-0 top-0 z-30 h-11 w-11" style={{ marginTop: 'env(safe-area-inset-top)' }} onClick={onHeaderTap} aria-hidden />

      <AnimatePresence>
        {banner && (
          <motion.div initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="glass absolute left-4 right-4 z-30 flex items-center gap-2 rounded-full px-4 py-3" style={{ top: 'calc(64px + env(safe-area-inset-top))' }}>
            <span className={`h-2 w-2 rounded-full ${banner === 'busy' ? 'bg-amber-400' : 'bg-[hsl(var(--success))]'}`} />
            <span className="text-[14px] font-medium">{banner === 'busy' ? `${name} is busy right now` : `${name} is back`}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex-1 overflow-y-auto px-3 pb-36 pt-3 tab:px-8">
        {loadingOlder && <Loader2 className="mx-auto my-2 h-5 w-5 animate-spin text-primary" />}
        {loading && [0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`mt-3 flex ${i % 2 ? 'justify-end' : ''}`}><div className="shimmer h-10 rounded-[20px]" style={{ width: `${40 + (i * 13) % 35}%` }} /></div>
        ))}
        {!loading && !all.length && <p className="mt-24 text-center text-[14px] text-muted-foreground">Say hello to {name} 👋</p>}
        {all.map((m, i) => {
          const prev = all[i - 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const tight = !!prev && !newDay && prev.fromMe === m.fromMe && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 120000;
          return (
            <Fragment key={m.clientId || m.id}>
              {newDay && <div className="my-3 flex justify-center"><span className="glass rounded-full px-3 py-1 text-[12px] font-medium text-muted-foreground">{dayLabel(m.createdAt)}</span></div>}
              <Bubble m={m} partnerName={name} tight={tight} highlight={flash === m.id}
                onReply={() => setReply(m)} onQuote={jumpTo} onRetry={() => deliver(m)}
                onLongPress={(rect) => setOverlay({ m, rect })} />
            </Fragment>
          );
        })}
      </div>

      <AnimatePresence>
        {newChip && (
          <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            onClick={() => { nearBottom.current = true; scrollToBottom(); setNewChip(false); }}
            className="glass absolute bottom-28 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-primary">
            <ArrowDown className="h-4 w-4" />New messages
          </motion.button>
        )}
        {partner?.status === 'busy' && (
          <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onClick={() => send('Ok, waiting')}
            className="glass absolute bottom-[92px] right-4 z-30 rounded-full px-4 py-2 text-[13px] font-semibold text-primary">Ok, waiting</motion.button>
        )}
      </AnimatePresence>

      {hm.settings.enabled && <HeadTab active={camOpen} onClick={onTab} />}
      <AnimatePresence>
        {camOpen && hm.settings.enabled && (
          <MiniCamera key="cam" container={root} tablet={tablet} pending={!!gesture} onClose={closeCam}
            onGesture={(text) => (hm.settings.sendInstantly ? send(text) : setGesture({ text, key: Date.now() }))} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {gesture && <GesturePill key={gesture.key} text={gesture.text} onCancel={() => setGesture(null)} onSend={() => { send(gesture.text); setGesture(null); }} />}
      </AnimatePresence>
      <SetupSheet open={setupOpen} onClose={() => setSetupOpen(false)} onFinished={() => setCamOpen(true)} />

      <Composer value={draft} onChange={(v) => { setDraft(v); lastKey.current = Date.now(); }} onSend={() => send()}
        reply={reply} partnerName={name} onCancelReply={() => setReply(null)} embedded={embedded} />

      <AnimatePresence>
        {overlay && (
          <ReactionOverlay m={overlay.m} rect={overlay.rect} partnerName={name} onClose={() => setOverlay(null)}
            onReact={(e) => doAction('react', overlay.m, e)}
            onReply={() => { setReply(overlay.m); setOverlay(null); }}
            onCopy={() => { navigator.clipboard.writeText(overlay.m.text).then(() => toast('Copied')); setOverlay(null); }}
            onDeleteMe={() => doAction('deleteMe', overlay.m)} onDeleteAll={() => doAction('deleteAll', overlay.m)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
            }
