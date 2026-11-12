import { useCallback, useEffect, useRef, useState } from 'react';
import { Toaster } from '@project/components/ui/sonner';
import Setup from './components/Setup';
import NotesShell, { type NotesTab } from './components/notes/NotesShell';
import ChatShell from './components/chat/ChatShell';
import { getSession } from './lib/session';
import { panic } from 'zitejs/api';

function PrivacyShield() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const on = () => setHidden(true), off = () => setHidden(false);
    window.addEventListener('blur', on);
    window.addEventListener('focus', off);
    const vis = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('blur', on); window.removeEventListener('focus', off); document.removeEventListener('visibilitychange', vis); };
  }, []);
  if (!hidden) return null;
  return <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-2xl" aria-hidden />;
}

export default function App() {
  const [ready, setReady] = useState(() => !!getSession());
  const [mode, setMode] = useState<'notes' | 'chat'>('notes');
  const [tab, setTab] = useState<NotesTab>('notes');

  useEffect(() => {
    document.title = 'Notes';
  }, [mode]);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const hide = useCallback(() => {
    if (modeRef.current !== 'chat') return;
    modeRef.current = 'notes';
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.scrollTo(0, 0);
    const s = getSession();
    if (s) panic({ token: s.token }).catch(() => {});
    setMode('notes');
  }, []);

  return (
    <div className="relative mx-auto min-h-[100dvh] max-w-[430px] overflow-x-hidden tab:max-w-[1280px]">
      {!ready ? (
        <Setup onDone={() => setReady(true)} />
      ) : mode === 'notes' ? (
        <NotesShell tab={tab} setTab={setTab} onUnlock={() => { window.scrollTo(0, 0); setMode('chat'); }} />
      ) : (
        <ChatShell onPanic={hide} />
      )}
      <PrivacyShield />
      <Toaster position="top-center" toastOptions={{ className: '!rounded-full !border-white/70 !bg-white/70 !backdrop-blur-xl !shadow-[0_10px_40px_rgba(20,60,140,0.12)] !justify-center' }} />
    </div>
  );
}
