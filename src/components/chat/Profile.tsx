import { useState } from 'react';
import { Copy, Share2, ChevronRight, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { updateProfile } from 'zitejs/api';
import { Switch } from '@project/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import DigitBoxes from '../DigitBoxes';
import { useChat } from './chatCore';
import { useAct } from './Partners';
import { getPrefs, setPrefs, wipeDevice } from '../../lib/session';
import { TopBar, useScrolled } from '../notes/NotesHome';
import HeadMovesPage from './head/HeadMovesPage';

function RowShell({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const C = onClick ? 'button' : 'div';
  return <C onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left">{children}</C>;
}

export default function Profile() {
  const { data, token, refresh } = useChat();
  const act = useAct();
  const scrolled = useScrolled();
  const [name, setName] = useState(data?.me.name || '');
  const [sound, setSound] = useState(getPrefs().sound);
  const [codeOpen, setCodeOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [signOut, setSignOut] = useState(false);
  const [hmOpen, setHmOpen] = useState(false);
  const [idle, setIdle] = useState(getPrefs().idleSec);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const uid = data?.me.uid || '—';

  const save = async (p: { displayName?: string; hideStatus?: boolean }) => {
    try { await updateProfile({ token, ...p }); toast('Saved'); refresh(); } catch { toast("Couldn't save"); }
  };
  const changeCode = async () => {
    try {
      const r = await updateProfile({ token, currentCode: cur, newCode: next });
      toast(r.message);
      if (r.ok) setCodeOpen(false);
    } catch { toast("Couldn't save"); }
    setCur(''); setNext('');
  };

  return (
    <div className="px-5 pb-36">
      <TopBar title="Profile" scrolled={scrolled} />
      <h1 className="large-title pt-14 tab:pt-0">Profile</h1>
      <div className="mt-5 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1E6BFF] to-[#0B3FBF] p-6 text-white shadow-[0_16px_40px_rgba(30,107,255,0.3)]">
        <p className="text-[12px] font-medium uppercase tracking-widest text-white/70">Your ID</p>
        <p className="mt-2 font-mono text-[34px] font-semibold tracking-[0.12em]">{uid}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => navigator.clipboard.writeText(uid).then(() => toast('Copied'), () => toast('Copy not available'))}
            className="press flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-white/20 font-semibold backdrop-blur"><Copy className="h-4 w-4" />Copy</button>
          <button onClick={() => (navigator.share ? navigator.share({ text: uid }).catch(() => {}) : navigator.clipboard.writeText(uid).then(() => toast('Copied')))}
            className="press flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-white font-semibold text-primary"><Share2 className="h-4 w-4" />Share</button>
        </div>
      </div>

      <div className="card-soft mt-5 divide-y divide-[rgba(30,107,255,0.06)] rounded-[20px]">
        <RowShell>
          <span className="flex-1 font-medium">Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== data?.me.name && save({ displayName: name })} maxLength={40}
            className="w-36 bg-transparent text-right text-muted-foreground outline-none" placeholder="Me" />
        </RowShell>
        <RowShell onClick={() => setCodeOpen(true)}><span className="flex-1 font-medium">Change page number</span><ChevronRight className="h-4 w-4 text-[hsl(var(--tertiary))]" /></RowShell>
        <RowShell>
          <span className="flex-1 font-medium">Hide online and typing status</span>
          <Switch checked={!!data?.me.hideStatus} onCheckedChange={(v) => save({ hideStatus: v })} />
        </RowShell>
        <RowShell>
          <span className="flex-1 font-medium">Notification sound</span>
          <Switch checked={sound} onCheckedChange={(v) => { setSound(v); setPrefs({ sound: v }); }} />
        </RowShell>
        <div className="px-4 py-3">
          <p className="font-medium">Auto-return after</p>
          <div className="mt-2 flex gap-1.5">
            {[10, 15, 30, 60].map((v) => (
              <button key={v} onClick={() => { setIdle(v); setPrefs({ idleSec: v }); }}
                className={`press h-9 flex-1 rounded-full text-[13px] font-semibold ${idle === v ? 'bg-primary text-white' : 'bg-[#EAF3FF] text-primary'}`}>{v === 60 ? '1 min' : `${v} s`}</button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">A 3-second countdown with Stay appears first.</p>
        </div>
        <RowShell onClick={() => setHmOpen(true)}><span className="flex-1 font-medium">Head Moves</span><ChevronRight className="h-4 w-4 text-[hsl(var(--tertiary))]" /></RowShell>
        <RowShell onClick={() => setBlockedOpen(true)}>
          <span className="flex-1 font-medium">Blocked list</span><span className="text-[hsl(var(--tertiary))]">{data?.blocked.length || 0}</span><ChevronRight className="h-4 w-4 text-[hsl(var(--tertiary))]" />
        </RowShell>
      </div>
      <button onClick={() => setSignOut(true)} className="press card-soft mt-4 flex h-[52px] w-full items-center gap-3 rounded-[20px] px-4 font-medium text-destructive">
        <LogOut className="h-5 w-5" strokeWidth={1.75} />Sign out of this device
      </button>

      <HeadMovesPage open={hmOpen} onClose={() => setHmOpen(false)} />
      <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
        <DialogContent className="max-w-[360px] rounded-[28px]">
          <DialogHeader><DialogTitle>Change page number</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Current number</p>
          <DigitBoxes size="sm" masked value={cur} onChange={setCur} autoFocus />
          <p className="mt-2 text-sm text-muted-foreground">New number</p>
          <DigitBoxes size="sm" value={next} onChange={setNext} />
          <button disabled={cur.length < 2 || next.length < 2} onClick={changeCode} className="press mt-3 h-12 rounded-full bg-primary font-semibold text-white disabled:bg-[#C9D9F3]">Save</button>
        </DialogContent>
      </Dialog>

      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent className="max-w-[360px] rounded-[28px]">
          <DialogHeader><DialogTitle>Blocked</DialogTitle></DialogHeader>
          {data?.blocked.map((b) => (
            <div key={b.id} className="flex items-center justify-between">
              <span className="font-mono">{b.uid}</span>
              <button onClick={() => act('unblock', b.id)} className="text-sm font-semibold text-primary">Unblock</button>
            </div>
          ))}
          {!data?.blocked.length && <p className="text-sm text-muted-foreground">No one is blocked.</p>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={signOut} onOpenChange={setSignOut}>
        <AlertDialogContent className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of this device?</AlertDialogTitle>
            <AlertDialogDescription>All local data on this device, including notes, will be wiped. Save your ID first ({uid}) — without this device you won't be able to sign back in to this account.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-destructive hover:bg-destructive/90" onClick={() => { wipeDevice(); window.location.replace('/'); }}>Sign out and wipe</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
