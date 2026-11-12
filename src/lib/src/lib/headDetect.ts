import type { Pose } from './headPositions';

/* eslint-disable @typescript-eslint/no-explicit-any */
let landmarkerPromise: Promise<any> | null = null;
const VER = '0.10.14';

let muted = false;
/** MediaPipe's wasm prints harmless info lines through console.error/warn — drop just those. */
function muteMediapipeLogs() {
  if (muted) return;
  muted = true;
  const noisy = /XNNPACK|TensorFlow Lite|gl_context|face_landmarker_graph|Graph successfully|OpenGL|^[IWE]\d{4} /;
  for (const k of ['error', 'warn', 'info', 'log'] as const) {
    const orig = console[k].bind(console);
    console[k] = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && noisy.test(args[0])) return;
      orig(...args);
    };
  }
}

/** Loads MediaPipe Face Landmarker from CDN (once per page, GPU with CPU fallback). Runs entirely in the browser. */
export function loadLandmarker() {
  muteMediapipeLogs();
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const url = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/vision_bundle.mjs`;
      const vision: any = await import(/* @vite-ignore */ url);
      const files = await vision.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`);
      const opts = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate },
        runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: false,
        minFaceDetectionConfidence: 0.4, minFacePresenceConfidence: 0.4, minTrackingConfidence: 0.4,
      });
      try { return await vision.FaceLandmarker.createFromOptions(files, opts('GPU')); }
      catch { return await vision.FaceLandmarker.createFromOptions(files, opts('CPU')); }
    })().catch((e) => { landmarkerPromise = null; throw e; });
  }
  return landmarkerPromise;
}

/** Column-major 4x4 matrix → raw yaw/pitch/roll (degrees, camera convention, unmirrored). */
export function matrixAngles(d: ArrayLike<number>) {
  const r = (i: number, j: number) => d[j * 4 + i];
  const deg = 180 / Math.PI;
  return {
    yaw: Math.asin(Math.max(-1, Math.min(1, -r(2, 0)))) * deg,
    pitch: Math.atan2(r(2, 1), r(2, 2)) * deg,
    roll: Math.atan2(r(1, 0), r(0, 0)) * deg,
  };
}

type P = { x: number; y: number };
/** Landmark-based proxies on the unmirrored image, in user's frame: yaw + = user's left, pitch + = up, roll + = tilt left. */
export function landmarkAngles(lm: P[], aspect: number): Pose {
  const nose = lm[1], l = lm[234], r = lm[454], top = lm[10], chin = lm[152], eL = lm[33], eR = lm[263];
  const yaw = ((nose.x - l.x) / Math.max(1e-3, r.x - l.x) - 0.5) * 110;
  const mid = (top.y + chin.y) / 2;
  const pitch = ((mid - nose.y) / Math.max(1e-3, chin.y - top.y)) * 120;
  const roll = Math.atan2((eR.y - eL.y), (eR.x - eL.x) * aspect) * (180 / Math.PI);
  return { yaw, pitch, roll };
}

export const SENS_STEPS = ['Very low', 'Low', 'Normal', 'High', 'Very high'];
const FACTORS = [1.5, 1.2, 1, 0.8, 0.6];
export const sensFactor = (s: number) => FACTORS[Math.max(0, Math.min(4, Math.round(s)))];

export type Thresholds = { yaw: number; pitch: number; roll: number };
export const BASE: Thresholds = { yaw: 12, pitch: 9, roll: 10 };

/** Keeps a neutral pose: starts from calibration, drifts slowly while still, re-centres after the face was lost > 5 s. */
export class Neutral {
  pose: Pose;
  private lastSeen = 0;
  private recal: Pose[] | null = null;
  private prev: Pose | null = null;
  constructor(start: Pose | null) { this.pose = start || { yaw: 0, pitch: 0, roll: 0 }; }
  get recalibrating() { return !!this.recal; }
  lost(t: number) { if (t - this.lastSeen > 5000 && this.lastSeen) this.recal = []; this.prev = null; }
  /** Returns pose relative to neutral, or null while re-centring. */
  apply(t: number, a: Pose): Pose | null {
    if (this.lastSeen && t - this.lastSeen > 5000) this.recal = [];
    if (!this.lastSeen && Math.max(Math.abs(a.yaw - this.pose.yaw), Math.abs(a.pitch - this.pose.pitch), Math.abs(a.roll - this.pose.roll)) > 15) this.recal = [];
    this.lastSeen = t;
    if (this.recal) {
      this.recal.push(a);
      if (this.recal.length >= 15) {
        const n = this.recal.length;
        this.pose = { yaw: this.recal.reduce((s, p) => s + p.yaw, 0) / n, pitch: this.recal.reduce((s, p) => s + p.pitch, 0) / n, roll: this.recal.reduce((s, p) => s + p.roll, 0) / n };
        this.recal = null;
      }
      return null;
    }
    const rel = { yaw: a.yaw - this.pose.yaw, pitch: a.pitch - this.pose.pitch, roll: a.roll - this.pose.roll };
    const still = this.prev && Math.abs(a.yaw - this.prev.yaw) + Math.abs(a.pitch - this.prev.pitch) + Math.abs(a.roll - this.prev.roll) < 0.8;
    this.prev = a;
    if (still && Math.max(Math.abs(rel.yaw), Math.abs(rel.pitch), Math.abs(rel.roll)) < 5) {
      const k = 0.02;
      this.pose = { yaw: this.pose.yaw + k * rel.yaw, pitch: this.pose.pitch + k * rel.pitch, roll: this.pose.roll + k * rel.roll };
    }
    return rel;
  }
}

type Ex = { start: number; end: number; beyond: number; peak: Pose; score: number; prim: string };
export type Hit = { id: string; score: number };

/** Movement-based recogniser: excursions out of the neutral zone, direction reversals and holds. */
export class Detector {
  thr: Thresholds = BASE;
  private inMove = false;
  private moveStart = 0;
  private beyond = 0;
  private prevT = 0;
  private prevA: Pose | null = null;
  private peak: Pose | null = null;
  private score = 0;
  private seq: Ex[] = [];
  private lastNeutral = 0;
  cooldownUntil = 0;

  setThresholds(base: Thresholds, factor: number) {
    this.thr = { yaw: base.yaw * factor, pitch: base.pitch * factor, roll: base.roll * factor };
  }
  reset() { this.inMove = false; this.seq = []; this.peak = null; this.prevA = null; }

  private norm(a: Pose) { return { y: a.yaw / this.thr.yaw, p: a.pitch / this.thr.pitch, r: a.roll / this.thr.roll }; }

  private close(t: number) {
    this.inMove = false;
    if (this.peak && this.score >= 1) this.seq.push({ start: this.moveStart, end: t, beyond: this.beyond, peak: this.peak, score: this.score, prim: this.prim(this.peak) });
    this.lastNeutral = t;
    this.peak = null;
    if (this.seq.length > 5) this.seq = [];
  }

  push(t: number, a: Pose): Hit | null {
    const dt = this.prevT ? Math.min(120, t - this.prevT) : 0;
    this.prevT = t;
    if (t < this.cooldownUntil) { this.reset(); return null; }
    const nz = Math.max(4, Math.min(this.thr.yaw, this.thr.pitch, this.thr.roll) * 0.66); // ~6° neutral zone
    const n = this.norm(a);
    const m = Math.max(Math.abs(n.y), Math.abs(n.p), Math.abs(n.r));
    const dist = Math.max(Math.abs(a.yaw), Math.abs(a.pitch), Math.abs(a.roll));
    if (!this.inMove && dist > nz) { this.inMove = true; this.moveStart = t; this.beyond = 0; this.score = 0; this.peak = null; }
    if (this.inMove) {
      if (m >= 1) this.beyond += dt;
      if (m > this.score) { this.score = m; this.peak = a; }
      // direction reversal: the head swung through to the other side without settling (fast shakes / nods)
      if (this.peak && this.score >= 1 && this.prevA) {
        const cur = this.prim(a), pk = this.prim(this.peak);
        if (m >= 1 && cur !== pk && opposite(cur, pk)) {
          this.close(t);
          this.inMove = true; this.moveStart = t; this.beyond = 0; this.score = m; this.peak = a;
        }
      }
      if (dist <= nz) this.close(t);
    }
    this.prevA = a;
    if (!this.inMove && this.seq.length && t - this.lastNeutral > 380) {
      const hit = this.classify(this.seq);
      this.seq = [];
      if (hit) this.cooldownUntil = t + 1200;
      return hit;
    }
    return null;
  }

  private prim(a: Pose) {
    const n = this.norm(a);
    const ay = Math.abs(n.y), ap = Math.abs(n.p), ar = Math.abs(n.r);
    if (ar > ay && ar > ap) return n.r > 0 ? 'tiltL' : 'tiltR';
    if (ay >= 0.75 && ap >= 0.75 && Math.min(ay, ap) / Math.max(ay, ap) > 0.55) return `${n.p > 0 ? 'up' : 'down'}${n.y > 0 ? 'L' : 'R'}`;
    if (ay >= ap) return n.y > 0 ? 'left' : 'right';
    return n.p > 0 ? 'up' : 'down';
  }

  private classify(seq: Ex[]): Hit | null {
    const ps = seq.map((e) => e.prim);
    const total = seq[seq.length - 1].end - seq[0].start;
    const score = Math.min(...seq.map((e) => e.score));
    const hit = (id: string | null) => (id ? { id, score } : null);
    const held = (e: Ex) => e.beyond >= 300;
    const yawOnly = ps.every((p) => p === 'left' || p === 'right');
    const pitchOnly = ps.every((p) => p === 'up' || p === 'down');
    const rollOnly = ps.every((p) => p.startsWith('tilt'));

    if (ps.length === 1) {
      const e = seq[0];
      if (ps[0] === 'down' && !held(e)) return hit(total < 700 ? 'nodFast' : total <= 2000 ? 'nodSlow' : null);
      return e.beyond >= 150 ? hit(ps[0]) : null;
    }
    if (total > 2000) return null;
    if (pitchOnly) {
      const downs = ps.filter((p) => p === 'down').length;
      if (ps.length === 2 && held(seq[0]) && held(seq[1]) && ps[0] !== ps[1]) return hit(ps[0] === 'up' ? 'UD' : 'DU');
      if (downs >= 2 && total <= 1800) return hit('doubleNod');
      if (downs === 1) return hit(total < 700 ? 'nodFast' : 'nodSlow');
      return null;
    }
    if (yawOnly && ps.includes('left') && ps.includes('right')) {
      if (ps.length === 2 && (held(seq[0]) || held(seq[1]))) return hit(ps[0] === 'left' ? 'LR' : 'RL');
      return hit(total < 700 ? 'shakeFast' : 'shakeSlow');
    }
    if (rollOnly && ps.length === 2 && ps[0] === 'tiltL' && ps[1] === 'tiltR') return hit('tiltLR');
    return null;
  }
}

function opposite(a: string, b: string) {
  const pairs = [['left', 'right'], ['up', 'down'], ['tiltL', 'tiltR']];
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
