import { motion } from 'framer-motion';
import type { Position, Pose } from '../../../lib/headPositions';

const k = 0.55;
const fx = (p: Pose) => -p.yaw * k;
const fy = (p: Pose) => -p.pitch * k;
const fr = (p: Pose) => -p.roll;

/** Line-art head drawn in SVG. Static shows the key pose; animated loops through the movement. */
export default function HeadIllustration({ pos, animated, size = 96, active }: { pos: Position; animated?: boolean; size?: number; active?: boolean }) {
  const peak = pos.frames.reduce((a, b) => (Math.abs(b.yaw) + Math.abs(b.pitch) + Math.abs(b.roll) > Math.abs(a.yaw) + Math.abs(a.pitch) + Math.abs(a.roll) ? b : a));
  const t = { duration: pos.loop / 1000, repeat: Infinity, ease: 'easeInOut' as const };
  const head = animated ? { animate: { rotate: pos.frames.map(fr) }, transition: t } : { initial: false, animate: { rotate: fr(peak) } };
  const face = animated ? { animate: { x: pos.frames.map(fx), y: pos.frames.map(fy) }, transition: t } : { initial: false, animate: { x: fx(peak), y: fy(peak) } };
  const ears = animated ? { animate: { x: pos.frames.map((p) => p.yaw * 0.25) }, transition: t } : { initial: false, animate: { x: peak.yaw * 0.25 } };
  const stroke = active === false ? '#AFC4E6' : '#1E6BFF';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id="hm-g" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#E6F0FF" /></radialGradient>
      </defs>
      <path d="M38 78 Q38 88 30 94 M62 78 Q62 88 70 94" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <motion.g style={{ originX: '50px', originY: '72px' }} {...head}>
        <motion.g {...ears}>
          <ellipse cx="22" cy="50" rx="4.5" ry="8" fill="url(#hm-g)" stroke={stroke} strokeWidth="2" />
          <ellipse cx="78" cy="50" rx="4.5" ry="8" fill="url(#hm-g)" stroke={stroke} strokeWidth="2" />
        </motion.g>
        <ellipse cx="50" cy="48" rx="27" ry="32" fill="url(#hm-g)" stroke={stroke} strokeWidth="2.2" />
        <clipPath id="hm-clip"><ellipse cx="50" cy="48" rx="26" ry="31" /></clipPath>
        <g clipPath="url(#hm-clip)">
          <motion.g {...face}>
            <path d="M34 39 Q39 36 44 39 M56 39 Q61 36 66 39" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
            <circle cx="39" cy="46" r="2.4" fill={stroke} />
            <circle cx="61" cy="46" r="2.4" fill={stroke} />
            <path d="M50 48 L47 57 Q50 59 53 57" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M42 65 Q50 70 58 65" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          </motion.g>
        </g>
      </motion.g>
    </svg>
  );
}
