import { useEffect, useRef, useState } from 'react';
import { landmarkAngles, loadLandmarker, matrixAngles } from '../../../lib/headDetect';
import type { Pose } from '../../../lib/headPositions';

export type CamFrame = { t: number; faces: number; small: boolean; dark: boolean; pose: Pose | null };
export type CamState = 'idle' | 'loading' | 'running' | 'denied' | 'error';

type LM = { detectForVideo: (v: HTMLVideoElement, t: number) => { faceLandmarks: { x: number; y: number }[][]; facialTransformationMatrixes?: { data: number[] }[] } };

/** Front camera + in-browser face tracking at ~30 fps. Nothing is recorded, stored or uploaded. */
export function useHeadCam(active: boolean, onFrame: (f: CamFrame) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cb = useRef(onFrame);
  cb.current = onFrame;
  const [state, setState] = useState<CamState>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) { setState('idle'); return; }
    let stream: MediaStream | null = null;
    let raf = 0;
    let dead = false;
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 24;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let smooth: Pose | null = null;
    let dark = false, n = 0, lastT = 0;
    // sign agreement between matrix angles and landmark proxies (handles any axis convention)
    let corrY = 1, corrP = 1;
    let prevM: { yaw: number; pitch: number } | null = null, prevL: Pose | null = null;

    const stop = () => {
      dead = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
      stream = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const onVis = () => { if (document.visibilityState === 'hidden') { stop(); setState('idle'); } };
    document.addEventListener('visibilitychange', onVis);

    (async () => {
      setState('loading');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false });
      } catch (e) {
        if (!dead) setState((e as Error)?.name === 'NotAllowedError' ? 'denied' : 'error');
        return;
      }
      if (dead) { stream.getTracks().forEach((tr) => tr.stop()); return; }
      const track = stream.getVideoTracks()[0];
      track.onended = () => { if (!dead) { stop(); setState('error'); } };
      let muteTimer = 0;
      track.onmute = () => { muteTimer = window.setTimeout(() => !dead && setAttempt((a) => a + 1), 1500); };
      track.onunmute = () => clearTimeout(muteTimer);
      const v = videoRef.current!;
      v.srcObject = stream;
      v.onpause = () => { if (!dead) v.play().catch(() => {}); };
      await v.play().catch(() => {});
      let lm: LM;
      try { lm = await loadLandmarker(); } catch { if (!dead) setState('error'); stop(); return; }
      if (dead) return;
      setState('running');

      const tick = () => {
        if (dead) return;
        raf = requestAnimationFrame(tick);
        const t = performance.now();
        if (t - lastT < 32 || v.readyState < 2) return;
        lastT = t;
        if (n++ % 15 === 0 && ctx) {
          ctx.drawImage(v, 0, 0, 32, 24);
          const px = ctx.getImageData(0, 0, 32, 24).data;
          let s = 0;
          for (let i = 0; i < px.length; i += 4) s += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          dark = s / (px.length / 4) < 40;
        }
        try {
          const r = lm.detectForVideo(v, t);
          const faces = r.faceLandmarks.length;
          let small = false, pose: Pose | null = null;
          if (faces === 1) {
            const pts = r.faceLandmarks[0];
            const xs = pts.map((p) => p.x);
            small = Math.max(...xs) - Math.min(...xs) < 0.16;
            const L = landmarkAngles(pts, v.videoWidth / Math.max(1, v.videoHeight));
            let raw: Pose = L;
            const mtx = r.facialTransformationMatrixes?.[0];
            if (mtx) {
              const M = matrixAngles(mtx.data);
              if (prevM && prevL) {
                corrY = corrY * 0.97 + (M.yaw - prevM.yaw) * (L.yaw - prevL.yaw);
                corrP = corrP * 0.97 + (M.pitch - prevM.pitch) * (L.pitch - prevL.pitch);
              }
              prevM = M; prevL = L;
              raw = { yaw: 0.55 * M.yaw * Math.sign(corrY || 1) + 0.45 * L.yaw, pitch: 0.55 * M.pitch * Math.sign(corrP || 1) + 0.45 * L.pitch, roll: L.roll };
            }
            const a = 0.6;
            smooth = smooth ? { yaw: smooth.yaw + a * (raw.yaw - smooth.yaw), pitch: smooth.pitch + a * (raw.pitch - smooth.pitch), roll: smooth.roll + a * (raw.roll - smooth.roll) } : raw;
            pose = smooth;
          } else { smooth = null; prevM = null; prevL = null; }
          cb.current({ t, faces, small, dark, pose });
        } catch { /* skip frame */ }
      };
      tick();
    })();

    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [active, attempt]);

  return { videoRef, state, retry: () => setAttempt((a) => a + 1) };
}

export function camStatus(state: CamState, f: CamFrame | null, recal = false) {
  if (state === 'loading' || state === 'idle') return 'Starting camera';
  if (state === 'denied') return 'Camera blocked';
  if (state === 'error') return 'Camera unavailable';
  if (!f || f.faces === 0) return 'Face not found';
  if (f.dark) return 'Need more light';
  if (f.small) return 'Move closer';
  if (recal) return 'Hold still for a moment';
  return 'Ready';
}
