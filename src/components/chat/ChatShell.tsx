import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, NotebookPen, UserPlus, Users, UserRound, WifiOff } from 'lucide-react';
import GlassNav, { Fab } from '../GlassNav';
import ChatsList from './ChatsList';
import Partners, { AddPartnerSheet } from './Partners';
import Profile from './Profile';
import ChatScreen from './ChatScreen';
import { ChatCtx, useAutoHide, useHomeData, useOnline } from './chatCore';
import { getPrefs, setPrefs } from '../../lib/session';
import { useIsTablet, useIsWide } from '../../lib/useLayout';

type Tab = 'chats' | 'partners' | 'profile';

function IdlePill({ n, onStay }: { n: number; onStay: () => void }) {
  const r = 9, c = 2 * Math.PI * r;
  return (
    <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="glass fixed left-1/2 top-[calc(10px+env(safe-area-inset-top))] z-[90] flex -translate-x-1/2 items-center gap-2.5 rounded-full py-1.5 pl-2 pr-1.5">
      <span className="relative flex h-[22px] w-[22px] items-center justify-center">
        <svg width="22" height="22" className="absolute inset-0">
          <circle cx="11" cy="11" r={r} fill="none" stroke="rgba(30,107,255,0.15)" strokeWidth="2" />
          <motion.circle key={n} cx="11" cy="11" r={r} fill="none" stroke="#1E6BFF" strokeWidth="2" strokeLinecap="round" strokeDasharray={c}
            initial={{ strokeDashoffset: c * (1 - n / 3) }} animate={{ strokeDashoffset: c * (1 - (n - 1) / 3) }} transition={{ duration: 1, ease: 'linear' }} transform="rotate(-90 11 11)" />
        </svg>
        <span className="text-[12px] font-semibold tabular-nums text-primary">{n}</span>
      </span>
      <button onClick={onStay} className="press rounded-full bg-primary px-3.5 py-1 text-[13px] font-semibold text-white">Stay</button>
    </motion.div>
  );
}

export default function ChatShell({ onPanic }: { onPanic: () => void }) {
  const [tab, setTab] = useState<Tab>('chats');
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const online = useOnline();
  const tablet = useIsTablet();
  const wide = useIsWide();
  const { token, data, refresh } = useHomeData(!!open && !wide);
  const needsMotion = typeof (DeviceMotionEvent as unknown as { requestPermission?: unknown })?.requestPermission === 'function';
  const [motionOk, setMotionOk] = useState(!needsMotion || getPrefs().motionAsked);
  const [askMotion, setAskMotion] = useState(needsMotion && !getPrefs().motionAsked);
  const { countdown, stay } = useAutoHide(onPanic, motionOk);

  // browser back / back gesture closes the open chat
  useEffect(() => {
    const pop = () => setOpen(null);
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const openChat = (c: { id: string; name: string }) => {
    if (!open) window.history.pushState({ chat: 1 }, '');
    setOpen(c);
  };
  const closeChat = useCallback(() => {
    if (window.history.state?.chat) window.history.back();
    else setOpen(null);
    refresh();
  }, [refresh]);

  const enableMotion = async () => {
    try {
      const r = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      setMotionOk(r === 'granted');
    } catch { /* denied */ }
    setPrefs({ motionAsked: true });
    setAskMotion(false);
  };

  const list = (
    <>
      {tab === 'chats' && <ChatsList onOpen={(c) => openChat({ id: c.chatId, name: c.partner.name })} onAdd={() => setAdding(true)} />}
      {tab === 'partners' && <Partners onAdd={() => setAdding(true)} />}
      {tab === 'profile' && <Profile />}
    </>
  );
  const tabletChat = tablet && open;

  return (
    <ChatCtx.Provider value={{ token, data, refresh, panic: onPanic, online }}>
      <motion.div initial={{ clipPath: 'circle(0% at 0% 30%)' }} animate={{ clipPath: 'circle(150% at 0% 30%)' }} transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        className="min-h-[100dvh] bg-gradient-to-b from-[#E4EFFF] via-[#F3F8FF] to-[#F7FAFF]">
        {!online && (
          <div className="glass fixed left-1/2 top-[calc(8px+env(safe-area-inset-top))] z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium">
            <WifiOff className="h-3.5 w-3.5" />You are offline
          </div>
        )}
        <div className="absolute right-0 top-0 z-30 h-11 w-11" onDoubleClick={onPanic} aria-hidden />

        {!tablet && list}
        {tablet && !open && (
          <div className="min-h-[100dvh] pl-[104px] pr-6 pt-4">
            <div className="mx-auto w-full max-w-[720px]">{list}</div>
          </div>
        )}
        {tabletChat && wide && (
          <div className="no-scrollbar fixed inset-y-0 left-0 z-30 w-[360px] overflow-y-auto border-r border-white/60 [&>div]:!px-4">{list}</div>
        )}
        <AnimatePresence>
          {tabletChat && (
            <motion.div key="tchat" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className={`fixed inset-y-0 right-0 z-40 ${wide ? 'left-[360px]' : 'left-0'}`}>
              <ChatScreen key={open!.id} embedded chatId={open!.id} initialName={open!.name} onBack={closeChat} />
            </motion.div>
          )}
        </AnimatePresence>

        {!tabletChat && (
          <GlassNav layoutId="chat-nav" active={tab} onChange={(k) => setTab(k as Tab)}
            tabs={[
              { key: 'chats', label: 'Chats', icon: MessageCircle },
              { key: 'partners', label: 'Partners', icon: Users, dot: (data?.incoming.length || 0) > 0 },
              { key: 'profile', label: 'Profile', icon: UserRound },
            ]} />
        )}
        {!tablet && <Fab icon={UserPlus} label="Add partner" onClick={() => setAdding(true)} />}
        <AddPartnerSheet open={adding} onClose={() => setAdding(false)} />
        <AnimatePresence>
          {open && !tablet && <ChatScreen key={open.id} chatId={open.id} initialName={open.name} onBack={closeChat} />}
        </AnimatePresence>

        {/* instant return to Notes */}
        <button aria-label="Notes" onClick={onPanic}
          className="press fixed right-0 top-[38%] z-[58] flex h-12 w-9 items-center justify-center rounded-l-2xl border border-r-0 border-white/70 bg-[rgba(214,230,255,0.85)] text-primary shadow-[0_4px_14px_rgba(30,107,255,0.18)] backdrop-blur-xl">
          <NotebookPen className="h-4 w-4" strokeWidth={2} />
        </button>

        <AnimatePresence>{countdown != null && <IdlePill key="idle" n={countdown} onStay={stay} />}</AnimatePresence>

        <AnimatePresence>
          {askMotion && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="glass fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-[430px] rounded-t-[28px] p-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
              <h3 className="text-[20px] font-bold">Quick shake to close</h3>
              <p className="mt-1 text-[14px] text-muted-foreground">Allow motion access so a firm shake takes you straight back to your notes.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => { setPrefs({ motionAsked: true }); setAskMotion(false); }} className="press h-12 flex-1 rounded-full bg-[#EEF2F8] font-semibold text-muted-foreground">Not now</button>
                <button onClick={enableMotion} className="press h-12 flex-1 rounded-full bg-primary font-semibold text-white">Allow</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </ChatCtx.Provider>
  );
}
