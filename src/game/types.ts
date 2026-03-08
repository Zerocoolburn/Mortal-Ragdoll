export interface Vec2 {
  x: number;
  y: number;
}

export interface Joint {
  pos: Vec2;
  prevPos: Vec2;
  vel: Vec2;
  radius: number;
  mass: number;
  pinned?: boolean;
}

export interface Constraint {
  a: number;
  b: number;
  length: number;
  stiffness: number;
}

export interface Ragdoll {
  id: number;
  name: string;
  joints: Joint[];
  constraints: Constraint[];
  color: string;
  glowColor: string;
  health: number;
  maxHealth: number;
  alive: boolean;
  stunTimer: number;
  attackCooldown: number;
  comboCount: number;
  lastHitBy: number | null;
  kills: number;
  damageDealt: number;
  style: 'aggressive' | 'defensive' | 'berserker' | 'tactical' | 'assassin';
  dodgeCooldown: number;
  specialCooldown: number;
  shieldActive: boolean;
  rage: number;
  facing: number; // -1 or 1
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'spark' | 'blood' | 'dust' | 'shockwave' | 'trail' | 'fire' | 'lightning';
  alpha: number;
  rotation: number;
  rotationSpeed: number;
}

export interface DamageText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  size: number;
}

export interface GameState {
  ragdolls: Ragdoll[];
  particles: Particle[];
  damageTexts: DamageText[];
  screenShake: Vec2;
  time: number;
  gameOver: boolean;
  winner: Ragdoll | null;
  roundNumber: number;
  slowMotion: number;
  lastKillTime: number;
}

export const ARENA_WIDTH = 1200;
export const ARENA_HEIGHT = 700;
export const GROUND_Y = 620;
export const GRAVITY = 0.45;
export const FRICTION = 0.985;
export const AIR_FRICTION = 0.998;
export const BOUNCE = 0.4;

export const FIGHTER_NAMES = [
  'BLAZE', 'VENOM', 'PHANTOM', 'TITAN', 'STORM',
  'WRAITH', 'NOVA', 'FANG', 'REAPER', 'JINX'
];

export const FIGHTER_COLORS = [
  { main: '#ff2244', glow: '#ff6688' },
  { main: '#00ff88', glow: '#66ffbb' },
  { main: '#4488ff', glow: '#88bbff' },
  { main: '#ffaa00', glow: '#ffcc55' },
  { main: '#ff00ff', glow: '#ff66ff' },
  { main: '#00ffff', glow: '#66ffff' },
  { main: '#ff6600', glow: '#ff9944' },
  { main: '#88ff00', glow: '#bbff55' },
  { main: '#ff0088', glow: '#ff55aa' },
  { main: '#aa44ff', glow: '#cc88ff' },
];

export const FIGHTER_STYLES: Ragdoll['style'][] = [
  'aggressive', 'defensive', 'berserker', 'tactical', 'assassin',
  'aggressive', 'berserker', 'tactical', 'assassin', 'defensive'
];
