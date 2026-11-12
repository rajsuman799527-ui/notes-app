import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { register } from 'zitejs/api';
import DigitBoxes from './DigitBoxes';
import { setSession } from '../lib/session';
import { seedNotes } from '../lib/notes';

function PaperArt() {
  return (
    <div className="relative mx-auto h-48 w-40">
      <div className="absolute inset-0 translate-x-5 rotate-6 rounded-[22px] bg-[#DCEBFF]" />
      <div className="absolute inset-0 -translate-x-3 -rotate-3 rounded-[22px] bg-[#EEF0FF]" />
      <div className="card-soft absolute inset-0 overflow-hidden rounded-[22px]">
        <div className="absolute right-0 top-0 h-10 w-10 rounded-bl-[16px] bg-[#EAF3FF]" />
        <div className="space-y-3 p-5 pt-8">
          {[80, 60, 70, 45].map((w, i) => (
            <div key={i} className="h-2 rounded-full bg-[#EAF3FF]" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!confirming && first.length === 2) setTimeout(() => setConfirming(true), 180);
  }, [first, confirming]);

  useEffect(() => {
    if (second.length < 2) return;
    if (second !== first) {
      setHint("Numbers didn't match. Try again.");
      setFirst(''); setSecond(''); setConfirming(false);
      return;
    }
    setBusy(true);
    register({ code: second })
      .then((r) => {
        setSession(r);
        seedNotes();
        setStep(2);
      })
      .catch(() => {
        setHint("Couldn't save right now. Check your connection.");
        setSecond('');
      })
      .finally(() => setBusy(false));
  }, [second, first]);

  return (
    <div className="app-bg flex min-h-full flex-col px-6 pb-10 pt-16">
      <div className="mb-10 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div key={i} animate={{ width: i === step ? 22 : 8 }} className={`h-2 rounded-full ${i <= step ? 'bg-primary' : 'bg-[#D6E4FA]'}`} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="flex flex-1 flex-col"
        >
          {step === 0 && (
            <>
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <PaperArt />
                <h1 className="large-title mt-12">Your notes, beautifully kept</h1>
                <p className="mt-3 text-muted-foreground">Write, plan and check things off. Everything stays tidy and close at hand.</p>
              </div>
              <button onClick={() => setStep(1)} className="press h-14 rounded-full bg-primary font-semibold text-white shadow-[0_10px_30px_rgba(30,107,255,0.35)]">Continue</button>
            </>
          )}
          {step === 1 && (
            <div className="flex flex-1 flex-col items-center text-center">
              <h1 className="text-[26px] font-bold tracking-tight">{confirming ? 'Enter it once more' : 'Choose a page number'}</h1>
              <p className="mt-2 text-muted-foreground">Used to jump to a page quickly</p>
              <div className="mt-12">
                {confirming ? (
                  <DigitBoxes key="b" value={second} onChange={setSecond} autoFocus disabled={busy} />
                ) : (
                  <DigitBoxes key="a" value={first} onChange={(v) => { setHint(''); setFirst(v); }} autoFocus />
                )}
              </div>
              <p className="mt-6 h-5 text-sm text-muted-foreground">{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /> : hint}</p>
            </div>
          )}
          {step === 2 && (
            <>
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white shadow-[0_16px_40px_rgba(30,107,255,0.35)]">
                  <motion.div initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}><Check className="h-11 w-11" strokeWidth={2.5} /></motion.div>
                </motion.div>
                <h1 className="large-title mt-10">All set</h1>
                <p className="mt-3 text-muted-foreground">We added a few notes to get you started.</p>
              </div>
              <button onClick={onDone} className="press h-14 rounded-full bg-primary font-semibold text-white shadow-[0_10px_30px_rgba(30,107,255,0.35)]">Open Notes</button>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
