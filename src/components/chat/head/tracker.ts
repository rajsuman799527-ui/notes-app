import { BASE, Detector, Neutral, sensFactor } from '../../../lib/headDetect';
import type { Pose } from '../../../lib/headPositions';
import type { CamFrame } from './useHeadCam';
import { getHM } from './headStore';

export type TrackOut = { rel: Pose | null; hit: string | null; recal: boolean };

/** Neutral pose + recogniser wired to the person's saved settings. */
export function makeTracker() {
  const s0 = getHM().settings;
  const neutral = new Neutral(s0.neutral);
  const det = new Detector();
  return {
    det,
    neutral,
    push(f: CamFrame, ignore = false): TrackOut {
      const { settings, moves } = getHM();
      if (!f.pose || f.faces !== 1 || f.dark || f.small) { neutral.lost(f.t); det.reset(); return { rel: null, hit: null, recal: neutral.recalibrating }; }
      const rel = neutral.apply(f.t, f.pose);
      if (!rel) { det.reset(); return { rel: null, hit: null, recal: true }; }
      if (ignore) { det.reset(); return { rel, hit: null, recal: false }; }
      const base = settings.tune || BASE;
      const levels = [settings.sensitivity, ...Object.values(moves).filter((m) => m.enabled && m.sensitivity != null).map((m) => m.sensitivity!)];
      const minF = Math.min(...levels.map(sensFactor));
      det.setThresholds(base, minF);
      const h = det.push(f.t, rel);
      if (!h) return { rel, hit: null, recal: false };
      const own = sensFactor(moves[h.id]?.sensitivity ?? settings.sensitivity);
      return { rel, hit: h.score >= own / minF - 0.001 ? h.id : null, recal: false };
    },
  };
}
