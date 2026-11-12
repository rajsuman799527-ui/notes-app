import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, RotateCcw, ScanFace } from 'lucide-react';
import { Switch } from '@project/components/ui/switch';
import { Slider } from '@project/components/ui/slider';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import HeadIllustration from './HeadIllustration';
import MoveSheet from './MoveSheet';
import SetupSheet from './SetupSheet';
import { resetMoves, updateSettings, useHeadMoves } from './headStore';
import { POSITIONS, type Position } from '../../../lib/headPositions';
import { useIsTablet } from '../../../lib/useLayout';
import { SENS_STEPS as SENS } from '../../../lib/headDetect';
import { getPrefs, setPrefs } from '../../../lib/session';
import { AutoTune, LiveTest } from './Tools';


function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex min-h-[52px] items-center gap-3 px-4"><span className="flex-1 font-medium">{label}</span>{children}</div>;
}

export default function HeadMovesPage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tablet = useIsTablet();
  return (
    <AnimatePresence>
      {open && (
        <>
          {tablet && <motion.div key="bg" className="fixed inset-0 z-[60] bg-[rgba(10,30,70,0.18)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />}
          <motion.div key="pg" initial={tablet ? { opacity: 0, scale: 0.96 } : { x: '100%' }} animate={tablet ? { opacity: 1, scale: 1 } : { x: 0 }} exit={tablet ? { opacity: 0, scale: 0.96 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className={tablet
              ? 'glass no-scrollbar fixed inset-x-0 top-[5dvh] z-[61] mx-auto max-h-[90dvh] w-[min(560px,92vw)] overflow-y-auto rounded-[28px] !bg-[rgba(246,250,255,0.92)]'
              : 'no-scrollbar fixed inset-0 z-[61] mx-auto max-w-[430px] overflow-y-auto bg-gradient-to-b from-[#E4EFFF] via-[#F3F8FF] to-[#F7FAFF]'}>
            <Content onClose={onClose} tablet={tablet} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Content({ onClose, tablet }: { onClose: () => void; tablet: boolean }) {
  const { settings, moves } = useHeadMoves();
  const [edit, setEdit] = useState<Position | null>(null);
  const [recal, setRecal] = useState(false);
  const [reset, setReset] = useState(false);
  const [tool, setTool] = useState<'live' | 'tune' | null>(null);
  const [nums, setNums] = useState(getPrefs().hmNumbers);
  return (
    <div className="px-5 pb-16 safe-top">
      <button onClick={onClose} className="press -ml-2 mt-2 flex h-10 items-center gap-0.5 font-medium text-primary"><ChevronLeft className="h-6 w-6" />{tablet ? 'Close' : 'Profile'}</button>
      <h1 className="large-title mt-1">Head Moves</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">Send preset messages with head movements. Video never leaves this device.</p>

      <div className="card-soft mt-5 divide-y divide-[rgba(30,107,255,0.06)] rounded-[20px]">
        <Row label="Head Moves"><Switch checked={settings.enabled} onCheckedChange={(v) => updateSettings({ enabled: v })} /></Row>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between"><span className="font-medium">Sensitivity</span><span className="text-[14px] text-primary">{SENS[settings.sensitivity] ?? 'Normal'}</span></div>
          <Slider className="mt-3" min={0} max={4} step={1} value={[settings.sensitivity]} onValueChange={([v]) => updateSettings({ sensitivity: v })} />
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">{SENS.map((s) => <span key={s}>{s}</span>)}</div>
        </div>
        <Row label="Send instantly"><Switch checked={settings.sendInstantly} onCheckedChange={(v) => updateSettings({ sendInstantly: v })} /></Row>
        <Row label="Show numbers on mini camera"><Switch checked={nums} onCheckedChange={(v) => { setNums(v); setPrefs({ hmNumbers: v }); }} /></Row>
        <Row label="My partner is fine with this"><Switch checked={settings.partnerConsent} onCheckedChange={(v) => updateSettings({ partnerConsent: v })} /></Row>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => setRecal(true)} className="press card-soft flex h-12 flex-1 items-center justify-center gap-2 rounded-full font-semibold text-primary"><ScanFace className="h-4 w-4" />Recalibrate</button>
        <button onClick={() => setReset(true)} className="press card-soft flex h-12 flex-1 items-center justify-center gap-2 rounded-full font-semibold text-muted-foreground"><RotateCcw className="h-4 w-4" />Reset to default</button>
      </div>

      <div className="mt-2 flex gap-2">
        <button onClick={() => setTool('tune')} className="press card-soft h-12 flex-1 rounded-full font-semibold text-primary">Auto-tune</button>
        <button onClick={() => setTool('live')} className="press card-soft h-12 flex-1 rounded-full font-semibold text-primary">Live test</button>
      </div>

      <div className={`mt-6 grid gap-3 ${tablet ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {POSITIONS.map((p, i) => {
          const m = moves[p.id];
          return (
            <motion.button key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => setEdit(p)} className="press card-soft relative flex flex-col items-center rounded-[20px] px-3 pb-3 pt-2 text-center">
              <span className={`absolute right-3 top-3 h-2 w-2 rounded-full ${m.enabled ? 'bg-primary' : 'bg-[#D3DCEA]'}`} />
              <HeadIllustration pos={p} size={tablet ? 84 : 92} active={m.enabled} />
              <span className="mt-1 text-[14px] font-semibold leading-tight">{p.name}</span>
              <span className={`mt-0.5 w-full truncate text-[12px] ${m.message ? 'text-primary' : 'text-[hsl(var(--tertiary))]'}`}>{m.message || 'No message'}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {tool === 'live' && <LiveTest key="live" onClose={() => setTool(null)} />}
        {tool === 'tune' && <AutoTune key="tune" onClose={() => setTool(null)} />}
      </AnimatePresence>
      <MoveSheet pos={edit} onClose={() => setEdit(null)} />
      <SetupSheet open={recal} recalibrateOnly onClose={() => setRecal(false)} />
      <AlertDialog open={reset} onOpenChange={setReset}>
        <AlertDialogContent className="z-[90] rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Head Moves?</AlertDialogTitle>
            <AlertDialogDescription>All 20 positions go back to their default messages, and sensitivity and auto-tune return to Normal.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={() => resetMoves()}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
