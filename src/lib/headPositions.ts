export type Pose = { yaw: number; pitch: number; roll: number };
export type Position = {
  id: string;
  name: string;
  group: 'Simple' | 'Diagonal' | 'Nod and shake' | 'Two-step';
  defaultMessage: string;
  defaultOn: boolean;
  /** Keyframes for the illustration loop (degrees; yaw + = user's left, pitch + = up, roll + = tilt left). */
  frames: Pose[];
  /** Duration of one illustration loop in ms */
  loop: number;
};

const N: Pose = { yaw: 0, pitch: 0, roll: 0 };
const p = (yaw: number, pitch: number, roll = 0): Pose => ({ yaw, pitch, roll });

export const POSITIONS: Position[] = [
  { id: 'left', name: 'Left', group: 'Simple', defaultMessage: '', defaultOn: false, frames: [N, p(30, 0), p(30, 0), N], loop: 1800 },
  { id: 'right', name: 'Right', group: 'Simple', defaultMessage: '', defaultOn: false, frames: [N, p(-30, 0), p(-30, 0), N], loop: 1800 },
  { id: 'up', name: 'Up', group: 'Simple', defaultMessage: 'Call me', defaultOn: true, frames: [N, p(0, 22), p(0, 22), N], loop: 1800 },
  { id: 'down', name: 'Down', group: 'Simple', defaultMessage: 'Later', defaultOn: true, frames: [N, p(0, -22), p(0, -22), N], loop: 1800 },
  { id: 'tiltL', name: 'Tilt left', group: 'Simple', defaultMessage: '', defaultOn: false, frames: [N, p(0, 0, 22), p(0, 0, 22), N], loop: 1800 },
  { id: 'tiltR', name: 'Tilt right', group: 'Simple', defaultMessage: 'Okay', defaultOn: true, frames: [N, p(0, 0, -22), p(0, 0, -22), N], loop: 1800 },
  { id: 'upL', name: 'Up-left', group: 'Diagonal', defaultMessage: '', defaultOn: false, frames: [N, p(24, 18), p(24, 18), N], loop: 1800 },
  { id: 'upR', name: 'Up-right', group: 'Diagonal', defaultMessage: '', defaultOn: false, frames: [N, p(-24, 18), p(-24, 18), N], loop: 1800 },
  { id: 'downL', name: 'Down-left', group: 'Diagonal', defaultMessage: '', defaultOn: false, frames: [N, p(24, -18), p(24, -18), N], loop: 1800 },
  { id: 'downR', name: 'Down-right', group: 'Diagonal', defaultMessage: '', defaultOn: false, frames: [N, p(-24, -18), p(-24, -18), N], loop: 1800 },
  { id: 'nodSlow', name: 'Slow nod', group: 'Nod and shake', defaultMessage: 'Hello', defaultOn: true, frames: [N, p(0, -20), N, N], loop: 2200 },
  { id: 'nodFast', name: 'Fast nod', group: 'Nod and shake', defaultMessage: '', defaultOn: false, frames: [N, p(0, -20), N, N, N], loop: 1200 },
  { id: 'shakeSlow', name: 'Slow shake', group: 'Nod and shake', defaultMessage: 'Wait', defaultOn: true, frames: [N, p(25, 0), p(-25, 0), N], loop: 2400 },
  { id: 'shakeFast', name: 'Fast shake', group: 'Nod and shake', defaultMessage: '', defaultOn: false, frames: [N, p(25, 0), p(-25, 0), N, N], loop: 1300 },
  { id: 'LR', name: 'Left then Right', group: 'Two-step', defaultMessage: 'Hi', defaultOn: true, frames: [N, p(30, 0), p(30, 0), N, p(-30, 0), p(-30, 0), N], loop: 3000 },
  { id: 'RL', name: 'Right then Left', group: 'Two-step', defaultMessage: 'Busy', defaultOn: true, frames: [N, p(-30, 0), p(-30, 0), N, p(30, 0), p(30, 0), N], loop: 3000 },
  { id: 'UD', name: 'Up then Down', group: 'Two-step', defaultMessage: '', defaultOn: false, frames: [N, p(0, 22), p(0, 22), N, p(0, -22), p(0, -22), N], loop: 3000 },
  { id: 'DU', name: 'Down then Up', group: 'Two-step', defaultMessage: '', defaultOn: false, frames: [N, p(0, -22), p(0, -22), N, p(0, 22), p(0, 22), N], loop: 3000 },
  { id: 'tiltLR', name: 'Tilt left then Tilt right', group: 'Two-step', defaultMessage: '', defaultOn: false, frames: [N, p(0, 0, 22), p(0, 0, 22), N, p(0, 0, -22), p(0, 0, -22), N], loop: 3000 },
  { id: 'doubleNod', name: 'Double nod', group: 'Two-step', defaultMessage: 'Yes', defaultOn: true, frames: [N, p(0, -20), N, p(0, -20), N, N], loop: 1800 },
];

export const SUGGESTIONS = ['Hello', 'Wait', 'Call me', 'Okay', 'Later'];
