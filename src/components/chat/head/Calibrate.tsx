import { useEffect, useRef, useState } from 'react';
import { camStatus, useHeadCam, type CamFrame } from './useHeadCam';
import type { Pose } from '../../../lib/headPositions';

export function Ring({ progress, color = '#1E6BFF', size }: { progress: number; color?: string; size: number }) {
  const r = size / 2 - 3, c = 2 * Math.PI * r;
  return (
    <svg className="pointer-events-none absolute inset-0" width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(30,107,255,0.15)" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 120ms linear' }} />
    </svg>
  );
}

/** Round mirrored preview used for calibration and testing. */
export function RoundCam({ onFrame, progress = 0, ringColor, size = 168, label }: { onFrame: (f: CamFrame) => void; progress?: number; ringColor?: string; size?: number; label?: string }) {
  const [last, setLast] = useState<CamFrame | null>(null);
  const { videoRef, state, retry } = useHeadCam(true, (f) => { setLast(f); onFrame(f); });
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 rounded-full bg-[#DCE8FB] object-cover p-[6px]" />
        <Ring progress={progress} size={size} color={ringColor} />
      </div>
      <span className="glass mt-3 rounded-full px-3 py-1 text-[12px] font-medium">{label || camStatus(state, last)}</span>
      {(state === 'denied' || state === 'error') && <button onClick={retry} className="mt-2 text-[13px] font-semibold text-primary">Try again</button>}
    </div>
  );
}

/** Look straight for 2 seconds → average pose becomes the neutral pose. */
export function Calibrator({ onDone }: { onDone: (p: Pose) => void }) {
  const [progress, setProgress] = useState(0);
  const samples = useRef<Pose[]>([]);
  const start = useRef<number | null>(null);
  const done = useRef(false);
  const doneCb = useRef(onDone);
  doneCb.current = onDone;
  useEffect(() => () => { done.current = true; }, []);
  const onFrame = (f: CamFrame) => {
    if (done.current) return;
    const ok = f.pose && f.faces === 1 && !f.dark && !f.small;
    if (!ok) { start.current = null; samples.current = []; setProgress(0); return; }
    if (start.current == null) start.current = f.t;
    samples.current.push(f.pose!);
    const p = Math.min(1, (f.t - start.current) / 2000);
    setProgress(p);
    if (p >= 1) {
      done.current = true;
      const s = samples.current, n = s.length;
      doneCb.current({ yaw: s.reduce((a, b) => a + b.yaw, 0) / n, pitch: s.reduce((a, b) => a + b.pitch, 0) / n, roll: s.reduce((a, b) => a + b.roll, 0) / n });
    }
  };
  return <RoundCam onFrame={onFrame} progress={progress} label={progress > 0 && progress < 1 ? 'Hold still…' : progress >= 1 ? 'Saved' : undefined} />;
}
