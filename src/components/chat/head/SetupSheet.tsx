import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Check, ScanFace } from 'lucide-react';
import { Checkbox } from '@project/components/ui/checkbox';
import { Calibrator } from './Calibrate';
import { getHM, updateSettings } from './headStore';
import type { Pose } from '../../../lib/headPositions';
import { haptic } from '../../../lib/session';

export default function SetupSheet({ open, recalibrateOnly, onClose, onFinished }: { open: boolean; recalibrateOnly?: boolean; onClose: () => void; onFinished?: () => void }) {
  return (
    <AnimatePresence>
      {open && <Sheet key="s" recalibrateOnly={recalibrateOnly} onClose={onClose} onFinished={onFinished} />}
    </AnimatePresence>
  );
}

function Sheet({ recalibrateOnly, onClose, onFinished }: { recalibrateOnly?: boolean; onClose: () => void; onFinished?: () => void }) {
  const [step, setStep] = useState(recalibrateOnly ? 3 : 1);
  const [perm, setPerm] = useState<'idle' | 'asking' | 'denied'>('idle');
  const [neutral, setNeutral] = useState<Pose | null>(null);
  const [consent, setConsent] = useState(getHM().settings.partnerConsent);

  const askCamera = async () => {
    setPerm('asking');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      s.getTracks().forEach((t) => t.stop());
      setPerm('idle'); setStep(3);
    } catch { setPerm('denied'); }
  };
  const finish = async () => {
    if (!neutral) return;
    haptic(12);
    await updateSettings(recalibrateOnly ? { neutral } : { neutral, partnerConsent: consent, setupDone: true, enabled: true });
    onFinished?.();
    onClose();
  };

  return (
    <>
      <motion.div className="fixed inset-0 z-[80] bg-[rgba(10,30,70,0.18)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="glass fixed inset-x-0 bottom-0 z-[81] mx-auto max-w-[480px] rounded-t-[28px] p-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {!recalibrateOnly && (
          <div className="mb-4 flex justify-center gap-1.5">
            {[1, 2, 3].map((i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-primary' : 'w-1.5 bg-[#C9D9F3]'}`} />)}
          </div>
        )}
        {step === 1 && (
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF]"><ScanFace className="h-7 w-7 text-primary" strokeWidth={1.6} /></div>
            <h3 className="mt-4 text-[22px] font-bold">Head Move</h3>
            <p className="mt-2 text-[15px] text-muted-foreground">Send preset messages with small head movements — a slow nod says “Hello”, left then right says “Hi”. You choose every message.</p>
            <p className="mt-3 text-[14px] text-muted-foreground">The video stays on this device. Nothing is recorded, saved or sent — your partner only receives the message.</p>
            <p className="mt-3 rounded-2xl bg-[#EAF3FF] px-4 py-3 text-[14px] font-medium text-[#0B3FBF]">The camera light on your phone will be on while this is active.</p>
            <button onClick={() => setStep(2)} className="press mt-6 h-12 w-full rounded-full bg-primary font-semibold text-white">Continue</button>
          </div>
        )}
        {step === 2 && (
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF]"><Camera className="h-7 w-7 text-primary" strokeWidth={1.6} /></div>
            <h3 className="mt-4 text-[22px] font-bold">Camera access</h3>
            {perm !== 'denied' ? (
              <p className="mt-2 text-[15px] text-muted-foreground">To notice your head movements, the front camera is used only while the small camera window is open.</p>
            ) : (
              <p className="mt-2 text-[15px] text-muted-foreground">Camera access is turned off. Open your browser’s site settings (the icon next to the address bar), set Camera to “Allow”, then try again.</p>
            )}
            <button onClick={askCamera} disabled={perm === 'asking'} className="press mt-6 h-12 w-full rounded-full bg-primary font-semibold text-white disabled:opacity-60">
              {perm === 'denied' ? 'Try again' : perm === 'asking' ? 'Waiting…' : 'Allow camera'}
            </button>
          </div>
        )}
        {step === 3 && (
          <div>
            <h3 className="text-center text-[20px] font-bold">{recalibrateOnly ? 'Recalibrate' : 'Calibration'}</h3>
            <p className="mb-4 mt-1 text-center text-[14px] text-muted-foreground">Look straight at the screen for 2 seconds.</p>
            {neutral ? (
              <div className="mx-auto flex h-[168px] w-[168px] items-center justify-center rounded-full bg-[#EAF3FF]"><Check className="h-14 w-14 text-primary" /></div>
            ) : <Calibrator onDone={(p) => { haptic(10); setNeutral(p); }} />}
            {!recalibrateOnly && (
              <label className="mt-5 flex items-start gap-3 text-[14px]">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                My partner knows about and is fine with this feature
              </label>
            )}
            <button disabled={!neutral} onClick={finish} className="press mt-5 h-12 w-full rounded-full bg-primary font-semibold text-white disabled:bg-[#C9D9F3]">Done</button>
          </div>
        )}
      </motion.div>
    </>
  );
}
