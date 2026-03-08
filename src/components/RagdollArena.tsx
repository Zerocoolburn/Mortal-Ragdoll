import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
// MATH HELPERS
// ═══════════════════════════════════════════════════════════════
interface V3 { x: number; y: number; z: number }
const v = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
const vadd = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const vsub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const vscl = (a: V3, s: number): V3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const vlen = (a: V3) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
const vnorm = (a: V3): V3 => { const l = vlen(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const vdist = (a: V3, b: V3) => vlen(vsub(a, b));
const vdot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const vlerp = (a: V3, b: V3, t: number): V3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));
const rng = (a = 0, b = 1) => a + Math.random() * (b - a);
const rngInt = (a: number, b: number) => Math.floor(rng(a, b + 1));
const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const smoothDamp = (cur: number, tgt: number, vel: { v: number }, time: number, dt: number): [number, { v: number }] => {
  const omega = 2 / Math.max(time, 0.0001);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - tgt;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return [tgt + (change + temp) * exp, vel];
};

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const ARENA_R = 14;
const GRAVITY = 28;
const BOT_COUNT = 10;
const MAX_SPARKS = 200;
const MAX_BLOOD = 120;

const NAMES = ['KAEL', 'VIPER', 'GHOST', 'ATLAS', 'TEMPEST', 'SHADE', 'HELIOS', 'CLAW', 'GRIM', 'NEON'];
const COLORS = [0xe63946, 0x06d6a0, 0x118ab2, 0xffd166, 0xef476f, 0x26547c, 0xff6b35, 0x7209b7, 0xf72585, 0x4cc9f0];
const HEX = ['#e63946', '#06d6a0', '#118ab2', '#ffd166', '#ef476f', '#26547c', '#ff6b35', '#7209b7', '#f72585', '#4cc9f0'];

type Style = 'aggro' | 'tank' | 'berserker' | 'duelist' | 'assassin';
const STYLES: Style[] = ['aggro', 'tank', 'berserker', 'duelist', 'assassin', 'aggro', 'berserker', 'duelist', 'assassin', 'tank'];

type WeaponType = 'longsword' | 'greatsword' | 'spear' | 'axe' | 'daggers';
const WEAPON_TYPES: WeaponType[] = ['longsword', 'greatsword', 'spear', 'axe', 'daggers', 'longsword', 'daggers', 'spear', 'greatsword', 'axe'];

interface WeaponDef {
  type: WeaponType; name: string;
  reach: number; speed: number; dmg: number; kb: number;
  bladeLen: number; weight: number; guardBreak: number;
  combos: AtkType[][];
}
const WEAPONS: Record<WeaponType, WeaponDef> = {
  longsword: {
    type: 'longsword', name: 'Longsword', reach: 1.1, speed: 1.0, dmg: 1.0, kb: 1.0,
    bladeLen: 0.9, weight: 1, guardBreak: 1,
    combos: [['slash_r', 'slash_l', 'thrust'], ['slash_r', 'overhead'], ['thrust', 'slash_r', 'slash_l', 'overhead']]
  },
  greatsword: {
    type: 'greatsword', name: 'Greatsword', reach: 1.4, speed: 0.6, dmg: 1.9, kb: 2.2,
    bladeLen: 1.2, weight: 2.5, guardBreak: 2.5,
    combos: [['overhead', 'sweep'], ['slash_r', 'overhead', 'sweep'], ['sweep', 'spin']]
  },
  spear: {
    type: 'spear', name: 'Spear', reach: 1.7, speed: 1.15, dmg: 0.85, kb: 0.7,
    bladeLen: 1.5, weight: 0.8, guardBreak: 0.6,
    combos: [['thrust', 'thrust', 'sweep'], ['thrust', 'slash_r', 'thrust'], ['sweep', 'thrust', 'thrust']]
  },
  axe: {
    type: 'axe', name: 'War Axe', reach: 0.95, speed: 0.75, dmg: 1.6, kb: 1.8,
    bladeLen: 0.8, weight: 1.8, guardBreak: 2,
    combos: [['overhead', 'slash_r'], ['slash_r', 'overhead', 'sweep'], ['overhead', 'overhead']]
  },
  daggers: {
    type: 'daggers', name: 'Twin Daggers', reach: 0.6, speed: 1.8, dmg: 0.55, kb: 0.4,
    bladeLen: 0.4, weight: 0.3, guardBreak: 0.5,
    combos: [['slash_r', 'slash_l', 'slash_r', 'slash_l', 'thrust'], ['thrust', 'slash_r', 'slash_l'], ['slash_r', 'slash_l', 'thrust', 'slash_r', 'slash_l', 'thrust']]
  },
};

type AtkType = 'slash_r' | 'slash_l' | 'thrust' | 'overhead' | 'sweep' | 'spin';
interface AtkDef {
  dmg: number; dur: number; kb: number; staminaCost: number;
  armStart: number; armEnd: number; yStart: number; yEnd: number;
  windUp: number; // fraction of dur that's wind-up (no damage)
}
const ATTACKS: Record<AtkType, AtkDef> = {
  slash_r: { dmg: 14, dur: 0.28, kb: 3.5, staminaCost: 12, armStart: -2.2, armEnd: 1.8, yStart: 0.15, yEnd: -0.1, windUp: 0.15 },
  slash_l: { dmg: 14, dur: 0.28, kb: 3.5, staminaCost: 12, armStart: 2.2, armEnd: -1.8, yStart: 0.15, yEnd: -0.1, windUp: 0.15 },
  thrust: { dmg: 18, dur: 0.22, kb: 5, staminaCost: 14, armStart: 0, armEnd: 0, yStart: 0.3, yEnd: 0.3, windUp: 0.3 },
  overhead: { dmg: 26, dur: 0.4, kb: 7, staminaCost: 22, armStart: -0.15, armEnd: -0.15, yStart: 1.0, yEnd: -0.5, windUp: 0.25 },
  sweep: { dmg: 11, dur: 0.32, kb: 2.5, staminaCost: 14, armStart: -3.0, armEnd: 3.0, yStart: -0.3, yEnd: -0.3, windUp: 0.1 },
  spin: { dmg: 32, dur: 0.55, kb: 9, staminaCost: 38, armStart: 0, armEnd: 6.28, yStart: 0.05, yEnd: 0.05, windUp: 0.2 },
};

// Skeleton joints
const J = {
  head: 0, neck: 1, chest: 2, spine: 3, hip: 4,
  lShoulder: 5, lElbow: 6, lHand: 7,
  rShoulder: 8, rElbow: 9, rHand: 10,
  lHip: 11, lKnee: 12, lFoot: 13,
  rHip: 14, rKnee: 15, rFoot: 16,
};
const JOINT_COUNT = 17;

const LIMBS: [number, number, number][] = [
  [J.head, J.neck, 0.035],
  [J.neck, J.chest, 0.11],
  [J.chest, J.spine, 0.1],
  [J.spine, J.hip, 0.09],
  [J.neck, J.lShoulder, 0.08],
  [J.lShoulder, J.lElbow, 0.07],
  [J.lElbow, J.lHand, 0.055],
  [J.neck, J.rShoulder, 0.08],
  [J.rShoulder, J.rElbow, 0.07],
  [J.rElbow, J.rHand, 0.055],
  [J.hip, J.lHip, 0.08],
  [J.lHip, J.lKnee, 0.08],
  [J.lKnee, J.lFoot, 0.065],
  [J.hip, J.rHip, 0.08],
  [J.rHip, J.rKnee, 0.08],
  [J.rKnee, J.rFoot, 0.065],
];

// Rest pose offsets from hip center
const REST: V3[] = [
  v(0, 1.88, 0),   // head
  v(0, 1.7, 0),    // neck
  v(0, 1.45, 0),   // chest
  v(0, 1.22, 0),   // spine
  v(0, 1.02, 0),   // hip
  v(-0.22, 1.62, 0), // lShoulder
  v(-0.38, 1.32, 0), // lElbow
  v(-0.4, 1.05, 0),  // lHand
  v(0.22, 1.62, 0),  // rShoulder
  v(0.38, 1.32, 0),  // rElbow
  v(0.4, 1.05, 0),   // rHand
  v(-0.12, 0.96, 0), // lHip
  v(-0.13, 0.5, 0),  // lKnee
  v(-0.13, 0.03, 0), // lFoot
  v(0.12, 0.96, 0),  // rHip
  v(0.13, 0.5, 0),   // rKnee
  v(0.13, 0.03, 0),  // rFoot
];

// ═══════════════════════════════════════════════════════════════
// ARENA OBSTACLES
// ═══════════════════════════════════════════════════════════════
interface Pillar { x: number; z: number; r: number; h: number }
const PILLARS: Pillar[] = (() => {
  const out: Pillar[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    out.push({ x: Math.cos(a) * 7, z: Math.sin(a) * 7, r: 0.55, h: 3.2 });
  }
  return out;
})();

// ═══════════════════════════════════════════════════════════════
// BOT TYPE
// ═══════════════════════════════════════════════════════════════
interface Bot {
  id: number; name: string; color: number; hex: string; style: Style;
  weapon: WeaponDef;
  // Transform
  pos: V3; vel: V3; facing: number; tgtFacing: number;
  // Walk
  walkPhase: number; walkSpeed: number;
  // Skeleton
  joints: V3[]; jvel: V3[]; ragdoll: number;
  // Stats
  hp: number; maxHp: number; alive: boolean;
  stamina: number; maxStamina: number;
  stun: number; rage: number;
  bleed: number; bleedTick: number;
  // Combat
  atk: AtkDef | null; atkType: AtkType | null; atkTimer: number; atkProg: number;
  atkCd: number; hitBag: Set<number>;
  combo: number; comboIdx: number; comboChain: AtkType[] | null; comboTimer: number;
  blocking: boolean; blockTimer: number; parryWindow: number; blockCd: number;
  dodgeCd: number;
  // Scoring
  kills: number; dmgDealt: number; parries: number; hits: number;
  lastHitBy: number;
  // AI
  aiState: string; aiTimer: number; aiTarget: number;
  circleDir: number; patience: number;
  moveX: number; moveZ: number; sprint: boolean;
  // Render
  swordAng: number; swordY: number;
  tipPos: V3; basePos: V3;
  bodyTilt: number; breathPhase: number;
  deathTime: number;
  // Mesh refs
  grp: THREE.Group | null; limbMeshes: THREE.Mesh[]; headMesh: THREE.Mesh | null;
  weaponGrp: THREE.Group | null; trail: THREE.Mesh | null;
  footL: THREE.Mesh | null; footR: THREE.Mesh | null;
}

interface Spark { p: V3; v: V3; life: number; maxLife: number; color: number; size: number; mesh: THREE.Mesh | null }
interface Blood { x: number; z: number; size: number; age: number; mesh: THREE.Mesh | null }
interface Ann { text: string; color: string; time: number; big: boolean }

interface GameState {
  bots: Bot[];
  sparks: Spark[];
  blood: Blood[];
  t: number; dt: number;
  over: boolean; winner: Bot | null;
  round: number; winTimer: number;
  shake: number; slowMo: number; slowTimer: number;
  anns: Ann[];
  camFocus: V3; camAngle: number;
}

function mkBot(i: number): Bot {
  const ang = (i / BOT_COUNT) * Math.PI * 2;
  const r = 4 + rng(0, 2.5);
  const px = Math.cos(ang) * r, pz = Math.sin(ang) * r;
  const wt = WEAPON_TYPES[i];
  const w = WEAPONS[wt];
  const hp = wt === 'greatsword' ? 140 : wt === 'axe' ? 130 : wt === 'daggers' ? 100 : wt === 'spear' ? 110 : 120;
  return {
    id: i, name: NAMES[i], color: COLORS[i], hex: HEX[i], style: STYLES[i],
    weapon: w,
    pos: v(px, 0, pz), vel: v(), facing: ang + Math.PI, tgtFacing: ang + Math.PI,
    walkPhase: rng(0, 6.28), walkSpeed: 0,
    joints: REST.map(o => v(px + o.x, o.y, pz + o.z)),
    jvel: Array.from({ length: JOINT_COUNT }, () => v()),
    ragdoll: 0,
    hp, maxHp: hp, alive: true,
    stamina: 100, maxStamina: 100,
    stun: 0, rage: 0,
    bleed: 0, bleedTick: 0,
    atk: null, atkType: null, atkTimer: 0, atkProg: 0,
    atkCd: rng(0.1, 0.4), hitBag: new Set(),
    combo: 0, comboIdx: 0, comboChain: null, comboTimer: 0,
    blocking: false, blockTimer: 0, parryWindow: 0, blockCd: 0,
    dodgeCd: 0,
    kills: 0, dmgDealt: 0, parries: 0, hits: 0,
    lastHitBy: -1,
    aiState: 'seek', aiTimer: 0, aiTarget: -1,
    circleDir: rng() > 0.5 ? 1 : -1, patience: rng(0.2, 0.8),
    moveX: 0, moveZ: 0, sprint: false,
    swordAng: -0.5, swordY: 0,
    tipPos: v(), basePos: v(),
    bodyTilt: 0, breathPhase: rng(0, 6),
    deathTime: 0,
    grp: null, limbMeshes: [], headMesh: null,
    weaponGrp: null, trail: null,
    footL: null, footR: null,
  };
}

// ═══════════════════════════════════════════════════════════════
// COMBAT
// ═══════════════════════════════════════════════════════════════
function startAtk(b: Bot, type: AtkType): boolean {
  if (b.atk || b.atkCd > 0 || b.ragdoll > 0.2 || b.stun > 0) return false;
  const a = ATTACKS[type];
  if (b.stamina < a.staminaCost * 0.4) return false;
  b.atk = a;
  b.atkType = type;
  b.atkTimer = a.dur / b.weapon.speed;
  b.atkProg = 0;
  b.hitBag.clear();
  b.stamina -= a.staminaCost;
  b.blocking = false;
  // Lunge
  const lunge = type === 'thrust' ? 6 : type === 'spin' ? 2 : type === 'overhead' ? 4 : 3.5;
  b.vel.x += Math.cos(b.facing) * lunge;
  b.vel.z += Math.sin(b.facing) * lunge;
  b.atkCd = a.dur / b.weapon.speed + 0.05;
  return true;
}

function startCombo(b: Bot): boolean {
  if (!b.comboChain) {
    b.comboChain = b.weapon.combos[rngInt(0, b.weapon.combos.length - 1)];
    b.comboIdx = 0;
  }
  if (b.comboIdx >= b.comboChain.length) {
    b.comboChain = null;
    b.comboIdx = 0;
    b.combo = 0;
    return false;
  }
  const type = b.comboChain[b.comboIdx];
  if (startAtk(b, type)) {
    b.comboIdx++;
    b.combo++;
    b.comboTimer = 0.35;
    return true;
  }
  return false;
}

function block(b: Bot): boolean {
  if (b.blockCd > 0 || b.atk || b.ragdoll > 0 || b.stamina < 8) return false;
  b.blocking = true;
  b.blockTimer = 0.35 + rng(0, 0.3);
  b.parryWindow = 0.1;
  b.blockCd = 0.4;
  b.stamina -= 6;
  return true;
}

function dodge(b: Bot, dx: number, dz: number, power = 9) {
  if (b.dodgeCd > 0 || b.ragdoll > 0.2 || b.stamina < 16 || b.atk) return;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  b.vel.x += (dx / d) * power;
  b.vel.z += (dz / d) * power;
  b.dodgeCd = 0.5;
  b.stamina -= 14;
  b.blocking = false;
}

// ═══════════════════════════════════════════════════════════════
// SKELETON ANIMATION
// ═══════════════════════════════════════════════════════════════
function animSkeleton(b: Bot, dt: number) {
  if (!b.alive && b.ragdoll <= 0) return;

  const spd = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
  const walking = spd > 0.4;
  const running = spd > 3;
  const sprinting = spd > 5.5;

  b.walkSpeed = lerp(b.walkSpeed, spd, dt * 8);
  if (walking) b.walkPhase += dt * b.walkSpeed * 3.2;
  b.breathPhase += dt * 2.2;

  const s = Math.sin(b.walkPhase);
  const c = Math.cos(b.walkPhase);
  const cf = Math.cos(b.facing), sf = Math.sin(b.facing);
  const breath = Math.sin(b.breathPhase);

  // Walking dynamics
  const bob = walking ? Math.abs(s) * (sprinting ? 0.1 : running ? 0.06 : 0.03) : breath * 0.006;
  const lean = walking ? clamp(spd * 0.02, 0, 0.18) : 0;
  const sway = walking ? s * (running ? 0.04 : 0.025) : 0;
  const shoulderTwist = walking ? s * (running ? 0.06 : 0.03) : 0;

  b.bodyTilt = lerp(b.bodyTilt, lean, dt * 8);

  // Attack animation state
  let atkArm = -0.5, atkY = 0, chestTwist = 0, rArmExt = 0, lArmPose = 0;

  if (b.atk && b.atkTimer > 0) {
    const totalDur = b.atk.dur / b.weapon.speed;
    const p = 1 - b.atkTimer / totalDur;
    b.atkProg = p;
    const a = b.atk;
    const wr = b.weapon.reach;
    const inWindUp = p < a.windUp;

    if (b.atkType === 'spin') {
      chestTwist = p * a.armEnd;
      atkArm = -0.7;
      rArmExt = inWindUp ? -0.1 : 0.35 * wr;
    } else if (b.atkType === 'thrust') {
      const wu = clamp(p / a.windUp, 0, 1);
      const ext = clamp((p - a.windUp) / (1 - a.windUp), 0, 1);
      atkArm = 0;
      atkY = lerp(0.1, a.yEnd, ext);
      rArmExt = lerp(-0.2, 0.55 * wr, ext);
      lArmPose = lerp(0, -0.5, wu);
    } else if (b.atkType === 'overhead') {
      const wu = clamp(p / a.windUp, 0, 1);
      const slam = clamp((p - a.windUp) / (1 - a.windUp), 0, 1);
      atkY = lerp(0.9, -0.5, slam);
      atkArm = lerp(-0.2, -0.2, wu);
      rArmExt = lerp(-0.05, 0.25 * wr, slam);
      lArmPose = inWindUp ? 0.4 : 0;
    } else if (b.atkType === 'sweep') {
      const ep = inWindUp ? 0 : (p - a.windUp) / (1 - a.windUp);
      atkArm = lerp(a.armStart, a.armEnd, ep);
      atkY = a.yStart;
      chestTwist = lerp(a.armStart * 0.15, a.armEnd * 0.15, ep);
    } else {
      // Slashes
      const ep = inWindUp ? 0 : (p - a.windUp) / (1 - a.windUp);
      atkArm = lerp(a.armStart, a.armEnd, ep);
      atkY = lerp(a.yStart, a.yEnd, ep);
      chestTwist = lerp(a.armStart * 0.2, a.armEnd * 0.12, ep);
      rArmExt = inWindUp ? -0.08 : 0.15 * wr;
    }
  } else if (b.blocking) {
    atkArm = 0.15; atkY = 0.45; lArmPose = 0.8; rArmExt = 0.08;
  } else {
    // Idle stance per weapon
    switch (b.weapon.type) {
      case 'spear': atkArm = 0.08; atkY = 0.15; break;
      case 'daggers': atkArm = -0.25; atkY = -0.05; break;
      case 'greatsword': atkArm = -0.55; atkY = 0.08; break;
      case 'axe': atkArm = -0.35; atkY = -0.02; break;
    }
  }

  b.swordAng = atkArm;
  b.swordY = atkY;

  // Place joints
  const interpRate = b.atk ? 24 : 20;
  for (let i = 0; i < JOINT_COUNT; i++) {
    const o = REST[i];
    const twist = i <= 10 ? chestTwist : 0;
    const sTwist = (i >= 5 && i <= 10) ? shoulderTwist : 0;
    const fa = b.facing + twist + sTwist;
    const cfa = Math.cos(fa), sfa = Math.sin(fa);
    const rx = o.x * cfa - o.z * sfa;
    const rz = o.x * sfa + o.z * cfa;

    let tx = b.pos.x + rx;
    let ty = o.y + bob;
    let tz = b.pos.z + rz;

    // Breathing
    if (i === J.chest || i === J.neck || i === J.spine) ty += breath * 0.004;

    // Lean
    if (i <= 4) {
      const lm = (4 - i) * 0.28;
      tx += cf * b.bodyTilt * lm;
      tz += sf * b.bodyTilt * lm;
      tx += (-sf) * sway * (i === J.hip ? 1.3 : 0.5);
      tz += cf * sway * (i === J.hip ? 1.3 : 0.5);
    }

    // Legs - proper gait
    if (walking) {
      const stride = sprinting ? 0.52 : running ? 0.38 : 0.24;
      const lift = sprinting ? 0.22 : running ? 0.15 : 0.08;
      const kneeFwd = sprinting ? 0.18 : 0.1;

      if (i === J.lFoot) {
        tx += cf * s * stride; tz += sf * s * stride;
        ty = Math.max(0.03, ty + Math.max(0, s) * lift);
      } else if (i === J.rFoot) {
        tx -= cf * s * stride; tz -= sf * s * stride;
        ty = Math.max(0.03, ty + Math.max(0, -s) * lift);
      } else if (i === J.lKnee) {
        tx += cf * s * stride * 0.45; tz += sf * s * stride * 0.45;
        ty += Math.max(0, s) * kneeFwd;
        tx += (-sf) * 0.03; tz += cf * 0.03;
      } else if (i === J.rKnee) {
        tx -= cf * s * stride * 0.45; tz -= sf * s * stride * 0.45;
        ty += Math.max(0, -s) * kneeFwd;
        tx += sf * 0.03; tz += (-cf) * 0.03;
      } else if (i === J.lHip) {
        tx += cf * s * 0.04; tz += sf * s * 0.04;
      } else if (i === J.rHip) {
        tx -= cf * s * 0.04; tz -= sf * s * 0.04;
      }

      // Arm swing (when not attacking)
      if (!b.atk && !b.blocking) {
        if (i === J.lHand) {
          tx -= cf * s * 0.22; tz -= sf * s * 0.22;
          ty -= Math.abs(s) * 0.06;
        } else if (i === J.lElbow) {
          tx -= cf * s * 0.1; tz -= sf * s * 0.1;
        }
      }
    }

    // Left arm combat pose
    if (lArmPose !== 0 && (i === J.lHand || i === J.lElbow)) {
      const f = i === J.lHand ? 1 : 0.5;
      tx += (-sf) * lArmPose * 0.22 * f;
      tz += cf * lArmPose * 0.22 * f;
      ty += lArmPose * 0.12 * f;
    }

    // Right arm (weapon)
    if (i === J.rHand) {
      const handD = 0.48 + rArmExt;
      tx = b.pos.x + Math.cos(b.facing + b.swordAng) * handD;
      ty = 1.28 + b.swordY;
      tz = b.pos.z + Math.sin(b.facing + b.swordAng) * handD;
    } else if (i === J.rElbow) {
      const sa = b.swordAng * 0.3;
      tx = b.pos.x + Math.cos(b.facing + sa) * 0.3 + (-sf) * 0.12;
      ty = 1.48 + b.swordY * 0.35;
      tz = b.pos.z + Math.sin(b.facing + sa) * 0.3;
    } else if (i === J.rShoulder) {
      tx += Math.cos(b.facing + b.swordAng * 0.08) * rArmExt * 0.25;
      tz += Math.sin(b.facing + b.swordAng * 0.08) * rArmExt * 0.25;
    }

    // Dual weapon left hand mirror
    if (b.weapon.type === 'daggers' && !b.blocking && (i === J.lHand || i === J.lElbow)) {
      const mir = b.swordAng * -0.65;
      if (i === J.lHand) {
        tx = b.pos.x + Math.cos(b.facing + mir) * 0.42;
        ty = 1.22 + b.swordY * 0.55;
        tz = b.pos.z + Math.sin(b.facing + mir) * 0.42;
      }
    }

    // Ragdoll physics
    if (b.ragdoll > 0) {
      const w = clamp(b.ragdoll * 3, 0, 1);
      b.joints[i].x += b.jvel[i].x * dt;
      b.joints[i].y += b.jvel[i].y * dt;
      b.joints[i].z += b.jvel[i].z * dt;
      b.jvel[i].y -= GRAVITY * dt;
      b.jvel[i].x *= 0.965; b.jvel[i].z *= 0.965;
      if (b.joints[i].y < 0.03) {
        b.joints[i].y = 0.03;
        b.jvel[i].y *= -0.2;
        b.jvel[i].x *= 0.7; b.jvel[i].z *= 0.7;
      }
      b.joints[i].x = lerp(tx, b.joints[i].x, w);
      b.joints[i].y = lerp(ty, b.joints[i].y, w);
      b.joints[i].z = lerp(tz, b.joints[i].z, w);
    } else {
      b.joints[i].x = lerp(b.joints[i].x, tx, dt * interpRate);
      b.joints[i].y = lerp(b.joints[i].y, ty, dt * interpRate);
      b.joints[i].z = lerp(b.joints[i].z, tz, dt * interpRate);
    }
  }

  // Sword tip/base for hit detection
  const hand = b.joints[J.rHand];
  const bl = b.weapon.bladeLen * b.weapon.reach;
  const ta = b.facing + b.swordAng;
  b.basePos = { ...hand };
  b.tipPos = { x: hand.x + Math.cos(ta) * bl, y: hand.y + b.swordY * 0.4 + 0.3, z: hand.z + Math.sin(ta) * bl };
}

// ═══════════════════════════════════════════════════════════════
// PHYSICS
// ═══════════════════════════════════════════════════════════════
function updatePhysics(b: Bot, dt: number) {
  if (!b.alive) {
    if (b.ragdoll > 0) b.ragdoll -= dt;
    return;
  }

  // Regen
  const stRegen = b.atk ? 6 : b.blocking ? 10 : b.sprint ? 8 : 28;
  b.stamina = clamp(b.stamina + stRegen * dt, 0, b.maxStamina);

  // Bleed
  if (b.bleed > 0) {
    b.bleedTick -= dt;
    if (b.bleedTick <= 0) { b.hp -= b.bleed; b.bleedTick = 0.4; b.bleed = Math.max(0, b.bleed - 0.4); }
  }

  // Combo
  if (b.comboTimer > 0) { b.comboTimer -= dt; if (b.comboTimer <= 0) { b.combo = 0; b.comboChain = null; b.comboIdx = 0; } }

  if (b.ragdoll > 0) {
    b.ragdoll -= dt;
    b.vel.x *= 0.92; b.vel.z *= 0.92;
    if (b.ragdoll <= 0) { b.ragdoll = 0; for (const jv of b.jvel) { jv.x = 0; jv.y = 0; jv.z = 0; } }
    b.pos.x += b.vel.x * dt;
    b.pos.z += b.vel.z * dt;
  } else {
    const base = b.sprint ? 7 : 4.5;
    const atkSlow = b.atk ? 0.3 : 1;
    const blkSlow = b.blocking ? 0.35 : 1;
    const stFactor = b.stamina < 15 ? 0.55 : 1;
    const spd = base * atkSlow * blkSlow * stFactor;

    b.vel.x += b.moveX * spd * dt * 14;
    b.vel.z += b.moveZ * spd * dt * 14;
    b.pos.x += b.vel.x * dt;
    b.pos.z += b.vel.z * dt;
    b.vel.x *= (1 - 10 * dt);
    b.vel.z *= (1 - 10 * dt);

    if (b.sprint) b.stamina -= 12 * dt;
  }

  // Facing
  const fd = angDiff(b.facing, b.tgtFacing);
  const turnSpd = b.atk ? 6 : b.blocking ? 8 : 14;
  b.facing += fd * clamp(turnSpd * dt, 0, 0.94);

  // Arena bounds
  const hd = Math.sqrt(b.pos.x * b.pos.x + b.pos.z * b.pos.z);
  if (hd > ARENA_R - 0.7) {
    const nx = b.pos.x / hd, nz = b.pos.z / hd;
    b.pos.x = nx * (ARENA_R - 0.7);
    b.pos.z = nz * (ARENA_R - 0.7);
    const d = b.vel.x * nx + b.vel.z * nz;
    if (d > 0) { b.vel.x -= d * nx * 1.8; b.vel.z -= d * nz * 1.8; }
  }

  // Pillars
  for (const p of PILLARS) {
    const dx = b.pos.x - p.x, dz = b.pos.z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < p.r + 0.35) {
      const push = p.r + 0.35 - d;
      const nx = dx / (d || 1), nz = dz / (d || 1);
      b.pos.x += nx * push;
      b.pos.z += nz * push;
      const dot = b.vel.x * nx + b.vel.z * nz;
      if (dot < 0) { b.vel.x -= dot * nx * 1.5; b.vel.z -= dot * nz * 1.5; }
    }
  }

  // Atk timer
  if (b.atk) {
    b.atkTimer -= dt;
    if (b.atkTimer <= 0) { b.atk = null; b.atkType = null; b.atkTimer = 0; }
  }

  // Cooldowns
  b.atkCd = Math.max(0, b.atkCd - dt);
  b.dodgeCd = Math.max(0, b.dodgeCd - dt);
  b.blockCd = Math.max(0, b.blockCd - dt);
  b.stun = Math.max(0, b.stun - dt);

  if (b.blocking) {
    b.blockTimer -= dt;
    b.parryWindow = Math.max(0, b.parryWindow - dt);
    if (b.blockTimer <= 0) b.blocking = false;
  }

  if (b.hp <= 0 && b.alive) { b.hp = 0; b.alive = false; }
}

// ═══════════════════════════════════════════════════════════════
// AI — ADVANCED TACTICAL BRAIN
// ═══════════════════════════════════════════════════════════════
function pickTarget(b: Bot, bots: Bot[]): Bot | null {
  let best: Bot | null = null, bs = -Infinity;
  for (const o of bots) {
    if (o.id === b.id || !o.alive) continue;
    const d = vdist(b.pos, o.pos);
    let score = 0;
    switch (b.style) {
      case 'assassin':
        score = 200 - o.hp - d * 15 + (o.atk ? 30 : 0); // target weakened/distracted
        break;
      case 'duelist':
        score = 150 - d * 10 + o.kills * 20; // target strongest nearby
        break;
      case 'berserker':
        score = 300 - d * 25; // always nearest
        break;
      case 'tank':
        score = 100 - d * 12 + (o.atk ? 20 : 0); // intercept attackers
        break;
      default:
        score = 200 - d * 18;
    }
    if (score > bs) { bs = score; best = o; }
  }
  return best;
}

function isFacingMe(me: Bot, them: Bot): boolean {
  const a = Math.atan2(me.pos.z - them.pos.z, me.pos.x - them.pos.x);
  return Math.abs(angDiff(them.facing, a)) < Math.PI * 0.4;
}

function isBehind(me: Bot, them: Bot): boolean {
  const a = Math.atan2(me.pos.z - them.pos.z, me.pos.x - them.pos.x);
  return Math.abs(angDiff(them.facing, a)) > Math.PI * 0.6;
}

function countNear(b: Bot, bots: Bot[], r: number): number {
  let c = 0;
  for (const o of bots) if (o.id !== b.id && o.alive && vdist(b.pos, o.pos) < r) c++;
  return c;
}

function facePos(b: Bot, x: number, z: number) {
  b.tgtFacing = Math.atan2(z - b.pos.z, x - b.pos.x);
}

function moveToPos(b: Bot, x: number, z: number, sprint = false) {
  const dx = x - b.pos.x, dz = z - b.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  b.moveX = dx / d; b.moveZ = dz / d;
  b.sprint = sprint;
  facePos(b, x, z);
}

function strafeAround(b: Bot, tgt: V3, dir: number, idealDist: number) {
  const dx = tgt.x - b.pos.x, dz = tgt.z - b.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  const perpX = -dz / d * dir, perpZ = dx / d * dir;
  const radial = (d - idealDist) * 0.6;
  b.moveX = perpX * 0.7 + (dx / d) * radial;
  b.moveZ = perpZ * 0.7 + (dz / d) * radial;
  facePos(b, tgt.x, tgt.z);
}

function runAI(b: Bot, s: GameState) {
  if (!b.alive || b.stun > 0 || b.ragdoll > 0.35) {
    b.moveX = 0; b.moveZ = 0;
    return;
  }

  const dt = s.dt;
  b.aiTimer -= dt;

  // Pick target
  const tgt = pickTarget(b, s.bots);
  if (!tgt) { b.moveX = 0; b.moveZ = 0; return; }
  b.aiTarget = tgt.id;

  const d = vdist(b.pos, tgt.pos);
  const wRange = b.weapon.reach * 1.8 + 0.4;
  const engRange = wRange + 0.4;

  // Style-specific reaction rates
  const reactRate = { aggro: 0.25, tank: 0.55, berserker: 0.1, duelist: 0.4, assassin: 0.35 }[b.style];

  // Rage buildup
  const rageRate = { aggro: 5, tank: 2.5, berserker: 10, duelist: 4, assassin: 6 }[b.style];
  b.rage = clamp(b.rage + dt * rageRate * (b.hp < b.maxHp * 0.4 ? 3 : 1), 0, 100);

  // ── REACTIVE: dodge/block/parry incoming attacks ──
  if (tgt.atk && tgt.atkTimer > 0 && d < tgt.weapon.reach * 2.2 + 1) {
    if (rng() < reactRate * dt * 18) {
      if (b.style === 'tank' || (b.style === 'duelist' && rng() < 0.6)) {
        block(b);
      } else if (b.style === 'assassin') {
        const dx = tgt.pos.x - b.pos.x, dz = tgt.pos.z - b.pos.z;
        const dd = Math.sqrt(dx * dx + dz * dz) || 1;
        dodge(b, -dz / dd * b.circleDir, dx / dd * b.circleDir, 8);
        b.circleDir *= -1;
      } else if (rng() < 0.35) {
        block(b);
      } else {
        dodge(b, b.pos.x - tgt.pos.x, b.pos.z - tgt.pos.z);
      }
    }
  }

  // ── STATE TRANSITIONS ──
  if (b.aiTimer <= 0) {
    b.aiTimer = 0.08 + rng(0, 0.18); // Very fast decision cycle
    b.circleDir = rng() > 0.3 ? b.circleDir : -b.circleDir;

    const nearby = countNear(b, s.bots, 3.5);

    if (b.style === 'berserker' && (b.rage > 70 || b.hp < b.maxHp * 0.3)) {
      b.aiState = 'berserk';
    } else if (d > 6) {
      b.aiState = nearby > 2 ? 'retreat' : 'chase';
    } else if (d < engRange + 0.6) {
      if (b.style === 'assassin' && !isBehind(b, tgt) && d > 2) {
        b.aiState = 'flank';
      } else {
        b.aiState = 'fight';
      }
    } else if (d < 4.5) {
      b.aiState = rng() < 0.45 ? 'circle' : (rng() < 0.35 ? 'flank' : 'approach');
    } else {
      b.aiState = 'approach';
    }
  }

  // ── EXECUTE STATE ──
  switch (b.aiState) {
    case 'chase':
    case 'approach':
      moveToPos(b, tgt.pos.x, tgt.pos.z, d > 5);
      if (d < engRange) b.aiState = 'fight';
      break;

    case 'fight': {
      facePos(b, tgt.pos.x, tgt.pos.z);

      // Attack decision — HIGH aggression
      const atkRate = { aggro: 0.35, tank: 0.18, berserker: 0.28, duelist: 0.22, assassin: 0.3 }[b.style];

      if (d < engRange && !b.atk && b.atkCd <= 0 && b.stun <= 0) {
        if (rng() < atkRate) {
          if (b.comboTimer > 0 && b.comboChain && rng() < 0.75) {
            startCombo(b);
          } else {
            b.comboChain = null; b.comboIdx = 0; b.combo = 0;
            // Smart attack selection
            if (isBehind(b, tgt)) {
              startAtk(b, 'overhead');
            } else if (tgt.blocking && rng() < 0.45) {
              startAtk(b, b.weapon.guardBreak > 1.5 ? 'overhead' : 'sweep');
            } else if (tgt.stun > 0) {
              startAtk(b, 'thrust');
            } else {
              startCombo(b);
            }
          }
        }
      }

      // Movement during engagement
      if (!b.atk) {
        strafeAround(b, tgt.pos, b.circleDir, wRange * 0.65);
      } else {
        if (d > wRange * 0.5) {
          b.moveX = Math.cos(b.facing) * 0.65;
          b.moveZ = Math.sin(b.facing) * 0.65;
        } else {
          b.moveX *= 0.25; b.moveZ *= 0.25;
        }
      }

      // Rage special
      if (b.rage > 80 && b.stamina > 35 && d < wRange && rng() < 0.06) {
        startAtk(b, 'spin');
        b.rage = 0;
      }

      if (d > engRange + 2) b.aiState = 'approach';
      break;
    }

    case 'berserk':
      facePos(b, tgt.pos.x, tgt.pos.z);
      moveToPos(b, tgt.pos.x, tgt.pos.z, true);
      if (d < engRange && !b.atk && b.atkCd <= 0) {
        if (rng() < 0.45) {
          if (b.comboTimer > 0 && b.comboChain) startCombo(b);
          else { b.comboChain = null; startCombo(b); }
        }
      }
      if (b.rage < 25 && b.hp > b.maxHp * 0.5) b.aiState = 'fight';
      break;

    case 'circle':
      strafeAround(b, tgt.pos, b.circleDir, 2.5);
      if (d < engRange && rng() < 0.4) b.aiState = 'fight';
      if (d > 5.5) b.aiState = 'approach';
      break;

    case 'flank': {
      const behind = {
        x: tgt.pos.x - Math.cos(tgt.facing) * 2.8,
        z: tgt.pos.z - Math.sin(tgt.facing) * 2.8,
      };
      moveToPos(b, behind.x, behind.z, true);
      facePos(b, tgt.pos.x, tgt.pos.z);
      if (d < engRange || isBehind(b, tgt)) b.aiState = 'fight';
      break;
    }

    case 'retreat': {
      const ax = b.pos.x - tgt.pos.x, az = b.pos.z - tgt.pos.z;
      const ad = Math.sqrt(ax * ax + az * az) || 1;
      b.moveX = ax / ad; b.moveZ = az / ad;
      b.sprint = true;
      facePos(b, tgt.pos.x, tgt.pos.z);
      if (rng() < 0.06) dodge(b, ax, az);
      if (d > 7 || b.hp > b.maxHp * 0.5) b.aiState = 'circle';
      break;
    }
  }

  // Arena edge avoidance
  const hd = Math.sqrt(b.pos.x ** 2 + b.pos.z ** 2);
  if (hd > ARENA_R - 3) {
    const str = (hd - (ARENA_R - 3)) / 3;
    b.moveX -= (b.pos.x / hd) * str * 0.8;
    b.moveZ -= (b.pos.z / hd) * str * 0.8;
  }

  // Pillar avoidance
  for (const p of PILLARS) {
    const dx = b.pos.x - p.x, dz = b.pos.z - p.z;
    const pd = Math.sqrt(dx * dx + dz * dz);
    if (pd < p.r + 1.8) {
      const str = 0.4 * (1 - pd / (p.r + 1.8));
      b.moveX += (dx / (pd || 1)) * str;
      b.moveZ += (dz / (pd || 1)) * str;
    }
  }

  // Normalize
  const ml = Math.sqrt(b.moveX ** 2 + b.moveZ ** 2);
  if (ml > 1) { b.moveX /= ml; b.moveZ /= ml; }
}

// ═══════════════════════════════════════════════════════════════
// HIT DETECTION
// ═══════════════════════════════════════════════════════════════
function checkHits(s: GameState) {
  for (const atk of s.bots) {
    if (!atk.alive || !atk.atk || atk.atkTimer <= 0) continue;
    // Only deal damage after wind-up
    const totalDur = atk.atk.dur / atk.weapon.speed;
    const prog = 1 - atk.atkTimer / totalDur;
    if (prog < atk.atk.windUp) continue;

    for (const def of s.bots) {
      if (def.id === atk.id || !def.alive || atk.hitBag.has(def.id)) continue;

      const bodyCenter = { x: def.pos.x, y: 1.15, z: def.pos.z };
      // 4-point blade check
      const pts = [atk.tipPos, atk.basePos, vlerp(atk.basePos, atk.tipPos, 0.33), vlerp(atk.basePos, atk.tipPos, 0.66)];
      let hit = false;
      for (const pt of pts) {
        if (vdist(pt, bodyCenter) < 0.5) { hit = true; break; }
      }
      if (!hit) continue;

      atk.hitBag.add(def.id);
      applyHit(s, atk, def);
    }
  }

  // Body separation
  for (let i = 0; i < s.bots.length; i++) {
    for (let j = i + 1; j < s.bots.length; j++) {
      const a = s.bots[i], b = s.bots[j];
      if (!a.alive || !b.alive) continue;
      const d = vdist(a.pos, b.pos);
      if (d < 0.6 && d > 0) {
        const nx = (a.pos.x - b.pos.x) / d, nz = (a.pos.z - b.pos.z) / d;
        const p = (0.6 - d) * 6;
        a.vel.x += nx * p; a.vel.z += nz * p;
        b.vel.x -= nx * p; b.vel.z -= nz * p;
      }
    }
  }
}

function applyHit(s: GameState, atk: Bot, def: Bot) {
  const a = atk.atk!;
  const w = atk.weapon;

  // PARRY
  if (def.blocking && def.parryWindow > 0) {
    atk.stun = 0.65;
    atk.vel.x -= Math.cos(atk.facing) * 6;
    atk.vel.z -= Math.sin(atk.facing) * 6;
    def.parries++;
    emitSparks(s, (atk.pos.x + def.pos.x) / 2, 1.4, (atk.pos.z + def.pos.z) / 2, 14, 0xffffff, 7);
    emitSparks(s, (atk.pos.x + def.pos.x) / 2, 1.4, (atk.pos.z + def.pos.z) / 2, 8, 0xffff00, 5);
    s.shake += 0.15;
    addAnn(s, 'PARRY!', '#ffff44', true);
    def.blocking = false;
    return;
  }

  // BLOCK
  if (def.blocking) {
    const blockDmg = 18 * w.guardBreak;
    atk.stun = 0.2;
    atk.vel.x -= Math.cos(atk.facing) * 3;
    atk.vel.z -= Math.sin(atk.facing) * 3;
    def.stamina -= blockDmg;
    emitSparks(s, (atk.pos.x + def.pos.x) / 2, 1.3, (atk.pos.z + def.pos.z) / 2, 8, 0xaaaaaa, 4);
    s.shake += 0.06;
    if (def.stamina <= 0) {
      def.blocking = false;
      def.stun = 0.55;
      addAnn(s, 'GUARD BREAK!', '#ff6600', false);
    }
    return;
  }

  // DAMAGE
  let dmg = a.dmg * w.dmg * (0.82 + rng(0, 0.36));
  if (atk.rage > 50) dmg *= 1 + atk.rage / 280;

  // Backstab
  if (isBehind(atk, def)) {
    dmg *= 1.85;
    addAnn(s, 'BACKSTAB!', '#ff4444', true);
  }

  // Headshot
  if (atk.tipPos.y > 1.55 && Math.abs(atk.tipPos.y - def.joints[J.head].y) < 0.25) {
    dmg *= 1.45;
    addAnn(s, 'HEADSHOT!', '#ff8800', false);
  }

  dmg = Math.min(dmg, 60);
  def.hp -= dmg;
  def.lastHitBy = atk.id;
  atk.dmgDealt += dmg;
  atk.hits++;
  atk.rage = clamp(atk.rage + dmg * 0.35, 0, 100);

  // Bleed
  if (dmg > 14) { def.bleed += dmg * 0.07; def.bleedTick = 0.4; }

  // Knockback
  const dx = def.pos.x - atk.pos.x, dz = def.pos.z - atk.pos.z;
  const dd = Math.sqrt(dx * dx + dz * dz) || 1;
  def.vel.x += (dx / dd) * a.kb * w.kb;
  def.vel.z += (dz / dd) * a.kb * w.kb;

  // Ragdoll on heavy
  if (dmg > 15 || atk.atkType === 'overhead' || atk.atkType === 'spin') {
    def.ragdoll = clamp(0.25 + dmg * 0.018, 0.2, 1.2);
    def.stun = def.ragdoll * 0.7;
    for (const jv of def.jvel) {
      jv.x += (dx / dd) * a.kb * w.kb * rng(0.3, 0.7);
      jv.y += rng(1.5, 3);
      jv.z += (dz / dd) * a.kb * w.kb * rng(0.3, 0.7);
    }
  } else {
    def.stun = 0.08;
  }

  // VFX
  const hx = (atk.tipPos.x + def.pos.x) / 2;
  const hz = (atk.tipPos.z + def.pos.z) / 2;
  emitSparks(s, hx, 1.2, hz, clamp(3 + (dmg * 0.35) | 0, 3, 12), atk.color, 4);
  if (dmg > 15) emitSparks(s, hx, 1.2, hz, 5, 0xff3300, 3);
  emitBlood(s, hx, hz, 0.25 + dmg * 0.012);
  s.shake += dmg * 0.01;

  // DEATH
  if (def.hp <= 0) {
    def.hp = 0; def.alive = false; atk.kills++; atk.rage = 100;
    s.slowMo = 0.06; s.slowTimer = 0.7;
    def.ragdoll = 8; def.deathTime = s.t;
    for (const jv of def.jvel) {
      jv.x += (dx / dd) * 18 * rng(0.3, 1.2);
      jv.y += rng(3, 9);
      jv.z += (dz / dd) * 18 * rng(0.3, 1.2);
    }
    emitSparks(s, def.pos.x, 1.2, def.pos.z, 30, def.color, 7);
    emitSparks(s, def.pos.x, 1.2, def.pos.z, 15, 0xff5500, 5);
    emitBlood(s, def.pos.x, def.pos.z, 1.8);
    s.shake += 0.55;

    const alive = s.bots.filter(b => b.alive).length;
    addAnn(s, `${atk.name} killed ${def.name}`, atk.hex, false);
    if (atk.kills >= 4) addAnn(s, `${atk.name} — RAMPAGE!`, atk.hex, true);
    else if (atk.kills >= 3) addAnn(s, `${atk.name} — KILLING SPREE!`, atk.hex, true);
    else if (atk.kills === 2) addAnn(s, `${atk.name} — DOUBLE KILL`, atk.hex, true);
    if (alive <= 3 && alive > 1) addAnn(s, `${alive} REMAIN`, '#ffffff', true);
    if (alive === 1) addAnn(s, `${atk.name} WINS!`, atk.hex, true);
  }
}

function emitSparks(s: GameState, x: number, y: number, z: number, n: number, color: number, spd: number) {
  for (let i = 0; i < n; i++) {
    const a = rng(0, Math.PI * 2), b = rng(0, Math.PI * 0.7);
    const sp = rng(spd * 0.3, spd);
    s.sparks.push({
      p: v(x + rng(-0.12, 0.12), y + rng(0, 0.1), z + rng(-0.12, 0.12)),
      v: v(Math.cos(a) * Math.cos(b) * sp, Math.sin(b) * sp + 1.2, Math.sin(a) * Math.cos(b) * sp),
      life: rng(0.15, 0.4), maxLife: rng(0.15, 0.4), color, size: rng(0.025, 0.055), mesh: null,
    });
  }
}

function emitBlood(s: GameState, x: number, z: number, size: number) {
  s.blood.push({ x: x + rng(-0.25, 0.25), z: z + rng(-0.25, 0.25), size: size * rng(0.7, 1.3), age: 0, mesh: null });
}

function addAnn(s: GameState, text: string, color: string, big: boolean) {
  s.anns.push({ text, color, time: s.t, big });
  if (s.anns.length > 6) s.anns.shift();
}

// ═══════════════════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════════════════
function mkState(round: number): GameState {
  return {
    bots: Array.from({ length: BOT_COUNT }, (_, i) => mkBot(i)),
    sparks: [], blood: [],
    t: 0, dt: 0,
    over: false, winner: null,
    round, winTimer: 0,
    shake: 0, slowMo: 1, slowTimer: 0,
    anns: [],
    camFocus: v(), camAngle: 0,
  };
}

function tick(s: GameState, rawDt: number): boolean {
  const dt = Math.min(rawDt, 1 / 20);
  s.dt = dt;
  s.t += dt;

  // Slow motion
  let adt = dt;
  if (s.slowMo < 1) {
    s.slowTimer -= dt;
    adt = dt * s.slowMo;
    if (s.slowTimer <= 0) s.slowMo = Math.min(1, s.slowMo + dt * 4);
    else s.slowMo = lerp(s.slowMo, 1, dt * 0.6);
  }

  // AI + Physics + Animation
  for (const b of s.bots) { s.dt = adt; runAI(b, s); }
  for (const b of s.bots) { updatePhysics(b, adt); animSkeleton(b, adt); }
  checkHits(s);
  s.dt = dt; // restore

  // Bleed particles
  for (const b of s.bots) {
    if (b.alive && b.bleed > 0 && rng() < 0.25) {
      emitSparks(s, b.pos.x + rng(-0.15, 0.15), 1 + rng(0, 0.4), b.pos.z + rng(-0.15, 0.15), 1, 0x880000, 1);
    }
  }

  // Sparks update
  for (let i = s.sparks.length - 1; i >= 0; i--) {
    const p = s.sparks[i];
    p.p.x += p.v.x * adt; p.p.y += p.v.y * adt; p.p.z += p.v.z * adt;
    p.v.y -= 16 * adt; p.v.x *= 0.95; p.v.z *= 0.95;
    p.life -= adt;
    if (p.life <= 0) { if (p.mesh?.parent) p.mesh.parent.remove(p.mesh); s.sparks.splice(i, 1); }
  }
  if (s.sparks.length > MAX_SPARKS) {
    const ex = s.sparks.splice(0, s.sparks.length - MAX_SPARKS);
    for (const sp of ex) if (sp.mesh?.parent) sp.mesh.parent.remove(sp.mesh);
  }

  // Blood age
  for (const bp of s.blood) bp.age += dt;
  if (s.blood.length > MAX_BLOOD) {
    const ex = s.blood.splice(0, s.blood.length - MAX_BLOOD);
    for (const bp of ex) if (bp.mesh?.parent) bp.mesh.parent.remove(bp.mesh);
  }

  s.shake *= 0.82;
  if (s.shake < 0.001) s.shake = 0;

  s.anns = s.anns.filter(a => s.t - a.time < 3.5);

  const alive = s.bots.filter(b => b.alive);
  if (alive.length <= 1 && !s.over) {
    s.over = true;
    s.winner = alive[0] || null;
    if (s.winner) {
      emitSparks(s, s.winner.pos.x, 1.5, s.winner.pos.z, 50, s.winner.color, 9);
    }
    return true;
  }
  return s.over;
}

// ═══════════════════════════════════════════════════════════════
// THREE.JS RENDERING
// ═══════════════════════════════════════════════════════════════
const _tv = new THREE.Vector3();
const _tq = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

const sharedCylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
const sharedSphereGeo = new THREE.SphereGeometry(1, 12, 8);
const sharedSparkGeo = new THREE.SphereGeometry(1, 4, 3);
const sharedBloodGeo = new THREE.CircleGeometry(1, 10);

function posLimb(m: THREE.Mesh, a: V3, b: V3, t: number) {
  m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  _tv.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const l = _tv.length();
  if (l < 0.001) return;
  _tv.normalize();
  _tq.setFromUnitVectors(_up, _tv);
  m.quaternion.copy(_tq);
  m.scale.set(t, l, t);
}

function createWeapon(b: Bot): THREE.Group {
  const g = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xddddee, emissive: b.color, emissiveIntensity: 0.12, roughness: 0.08, metalness: 0.92 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x442211, roughness: 0.7, metalness: 0.25 });
  const w = b.weapon;

  if (w.type === 'longsword' || w.type === 'greatsword') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, w.bladeLen, 0.012), bladeMat);
    blade.position.y = w.bladeLen / 2 + 0.08; blade.castShadow = true; g.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.035, w.type === 'greatsword' ? 0.16 : 0.12),
      new THREE.MeshStandardMaterial({ color: 0x775533, roughness: 0.35, metalness: 0.65 }));
    guard.position.y = 0.06; g.add(guard);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, w.type === 'greatsword' ? 0.18 : 0.1, 6), handleMat);
    handle.position.y = -0.02; g.add(handle);
  } else if (w.type === 'axe') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, w.bladeLen, 6), handleMat);
    handle.position.y = w.bladeLen / 2; handle.castShadow = true; g.add(handle);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.14), bladeMat);
    head.position.y = w.bladeLen - 0.04; head.castShadow = true; g.add(head);
  } else if (w.type === 'spear') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, w.bladeLen, 6), handleMat);
    shaft.position.y = w.bladeLen / 2; shaft.castShadow = true; g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.14, 5), bladeMat);
    tip.position.y = w.bladeLen + 0.04; tip.castShadow = true; g.add(tip);
  } else if (w.type === 'daggers') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.025, w.bladeLen, 0.007), bladeMat);
    blade.position.y = w.bladeLen / 2 + 0.04; blade.castShadow = true; g.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.025, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x775533, roughness: 0.35, metalness: 0.65 }));
    guard.position.y = 0.03; g.add(guard);
  }
  return g;
}

function createBot(b: Bot, scene: THREE.Group) {
  const mat = new THREE.MeshStandardMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.55 });
  const grp = new THREE.Group();

  b.limbMeshes = LIMBS.map(() => {
    const m = new THREE.Mesh(sharedCylGeo, mat.clone());
    m.castShadow = true; grp.add(m); return m;
  });

  const head = new THREE.Mesh(sharedSphereGeo, mat.clone());
  head.castShadow = true; grp.add(head);
  b.headMesh = head;

  const footMat = mat.clone();
  const fL = new THREE.Mesh(sharedSphereGeo, footMat); fL.castShadow = true; grp.add(fL);
  const fR = new THREE.Mesh(sharedSphereGeo, footMat); fR.castShadow = true; grp.add(fR);
  b.footL = fL; b.footR = fR;

  const wpn = createWeapon(b);
  grp.add(wpn); b.weaponGrp = wpn;

  // Trail
  const trailMat = new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.06), trailMat);
  trail.visible = false; grp.add(trail);
  b.trail = trail;

  scene.add(grp);
  b.grp = grp;
}

function renderBot(b: Bot) {
  if (!b.grp) return;
  const j = b.joints;

  for (let i = 0; i < LIMBS.length; i++) {
    const [a, bi, t] = LIMBS[i];
    posLimb(b.limbMeshes[i], j[a], j[bi], t);
  }

  if (b.headMesh) {
    b.headMesh.position.set(j[0].x, j[0].y, j[0].z);
    b.headMesh.scale.setScalar(0.12);
  }

  if (b.footL) { b.footL.position.set(j[13].x, j[13].y, j[13].z); b.footL.scale.setScalar(0.06); }
  if (b.footR) { b.footR.position.set(j[16].x, j[16].y, j[16].z); b.footR.scale.setScalar(0.06); }

  if (b.weaponGrp) {
    const hand = j[J.rHand];
    b.weaponGrp.position.set(hand.x, hand.y, hand.z);
    const sa = b.facing + b.swordAng;
    b.weaponGrp.rotation.set(b.swordY * 0.55, -sa + Math.PI / 2, b.swordAng * 0.12);
  }

  if (b.trail) {
    const isAtk = b.atk && b.atkTimer > 0;
    b.trail.visible = !!isAtk;
    if (isAtk) {
      const hand = j[J.rHand];
      b.trail.position.set((hand.x + b.tipPos.x) / 2, (hand.y + b.tipPos.y) / 2, (hand.z + b.tipPos.z) / 2);
      _tv.set(b.tipPos.x - hand.x, b.tipPos.y - hand.y, b.tipPos.z - hand.z);
      const l = _tv.length();
      b.trail.scale.set(l * 1.3, 4, 1);
      b.trail.lookAt(b.tipPos.x, b.tipPos.y, b.tipPos.z);
      const totalDur = (b.atk?.dur || 0.3) / b.weapon.speed;
      (b.trail.material as THREE.MeshBasicMaterial).opacity = (b.atkTimer / totalDur) * 0.7;
    }
  }

  // Death fade
  if (!b.alive) {
    b.grp.traverse(child => {
      const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m?.opacity !== undefined) {
        m.transparent = true;
        m.opacity = Math.max(0.05, m.opacity - 0.008);
        m.emissiveIntensity = Math.max(0.01, (m.emissiveIntensity || 0) - 0.005);
      }
    });
  }
}

function renderSparks(sparks: Spark[], scene: THREE.Group) {
  for (const sp of sparks) {
    if (!sp.mesh) {
      sp.mesh = new THREE.Mesh(sharedSparkGeo, new THREE.MeshBasicMaterial({ color: sp.color }));
      scene.add(sp.mesh);
    }
    sp.mesh.position.set(sp.p.x, sp.p.y, sp.p.z);
    const t = sp.life / sp.maxLife;
    sp.mesh.scale.setScalar(sp.size * t);
    (sp.mesh.material as THREE.MeshBasicMaterial).opacity = t;
    (sp.mesh.material as THREE.MeshBasicMaterial).transparent = true;
  }
}

function renderBlood(blood: Blood[], scene: THREE.Group) {
  for (const bp of blood) {
    if (!bp.mesh) {
      bp.mesh = new THREE.Mesh(sharedBloodGeo, new THREE.MeshStandardMaterial({
        color: 0x440000, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 0.65,
      }));
      bp.mesh.rotation.x = -Math.PI / 2;
      bp.mesh.position.y = 0.012;
      scene.add(bp.mesh);
    }
    bp.mesh.position.set(bp.x, 0.012, bp.z);
    bp.mesh.scale.setScalar(bp.size * Math.min(1, bp.age * 3.5));
    if (bp.age > 12) {
      (bp.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.65 - (bp.age - 12) * 0.04);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENE COMPONENT
// ═══════════════════════════════════════════════════════════════
function GameScene({ state, onHud }: { state: React.MutableRefObject<GameState>; onHud: (s: GameState) => void }) {
  const { camera } = useThree();
  const botsRef = useRef<THREE.Group>(null!);
  const sparksRef = useRef<THREE.Group>(null!);
  const bloodRef = useRef<THREE.Group>(null!);
  const inited = useRef(false);
  const camAng = useRef(0);
  const camTgt = useRef(v());
  const camDist = useRef(9);
  const camH = useRef(5);
  const frameCount = useRef(0);
  const camDistVel = useRef({ v: 0 });
  const camHVel = useRef({ v: 0 });

  useEffect(() => {
    if (inited.current || !botsRef.current) return;
    inited.current = true;
    for (const b of state.current.bots) createBot(b, botsRef.current);
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = state.current;

    if (s.over) {
      s.winTimer += dt;
      for (const b of s.bots) { updatePhysics(b, dt); animSkeleton(b, dt); }
      for (const b of s.bots) renderBot(b);
      renderSparks(s.sparks, sparksRef.current);
      renderBlood(s.blood, bloodRef.current);

      // Winner sparks
      if (s.winner?.alive && frameCount.current % 4 === 0) {
        emitSparks(s, s.winner.pos.x + rng(-1, 1), 2 + rng(0, 1), s.winner.pos.z + rng(-1, 1), 2, s.winner.color, 3.5);
      }

      if (s.winTimer >= 5.5) {
        while (botsRef.current.children.length) botsRef.current.remove(botsRef.current.children[0]);
        while (sparksRef.current.children.length) sparksRef.current.remove(sparksRef.current.children[0]);
        while (bloodRef.current.children.length) bloodRef.current.remove(bloodRef.current.children[0]);
        const ns = mkState(s.round + 1);
        state.current = ns;
        inited.current = false;
        for (const b of ns.bots) createBot(b, botsRef.current);
        inited.current = true;
        onHud(ns);
        return;
      }
    } else {
      tick(s, dt);
    }

    for (const b of s.bots) renderBot(b);
    renderSparks(s.sparks, sparksRef.current);
    renderBlood(s.blood, bloodRef.current);

    // ═══ CINEMATIC CAMERA ═══
    const alive = s.bots.filter(b => b.alive);
    let cx = 0, cz = 0;
    if (alive.length) {
      for (const b of alive) { cx += b.pos.x; cz += b.pos.z; }
      cx /= alive.length; cz /= alive.length;
    }

    // Find most intense duel
    let fightX = cx, fightZ = cz, bestIntensity = 0;
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const d = vdist(alive[i].pos, alive[j].pos);
        if (d > 5) continue;
        const intensity = (alive[i].atk ? 3 : 0) + (alive[j].atk ? 3 : 0) + (6 / (d + 0.3))
          + (alive[i].ragdoll > 0 ? 2 : 0) + (alive[j].ragdoll > 0 ? 2 : 0);
        if (intensity > bestIntensity) {
          bestIntensity = intensity;
          fightX = (alive[i].pos.x + alive[j].pos.x) / 2;
          fightZ = (alive[i].pos.z + alive[j].pos.z) / 2;
        }
      }
    }

    // Camera focus blend: center of alive vs fight epicenter
    const focusBlend = clamp(bestIntensity / 8, 0.3, 0.8);
    const lookX = lerp(cx, fightX, focusBlend);
    const lookZ = lerp(cz, fightZ, focusBlend);
    camTgt.current = vlerp(camTgt.current, v(lookX, 0, lookZ), 0.06);

    // Dynamic distance
    const tgtDist = alive.length > 5 ? 7 + alive.length * 0.35 : (alive.length > 2 ? 5.5 : 4);
    const tgtH = alive.length > 5 ? 4 + alive.length * 0.2 : (alive.length > 2 ? 3.2 : 2.5);

    let [newDist] = smoothDamp(camDist.current, tgtDist, camDistVel.current, 0.8, dt);
    let [newH] = smoothDamp(camH.current, tgtH, camHVel.current, 0.8, dt);

    // Close-up on slow-mo
    if (s.slowMo < 0.4) {
      newDist = lerp(newDist, 3, dt * 5);
      newH = lerp(newH, 1.8, dt * 5);
    }

    camDist.current = newDist;
    camH.current = newH;

    camAng.current += dt * (0.15 + bestIntensity * 0.012);
    const sh = s.shake;

    camera.position.lerp(
      _tv.set(
        camTgt.current.x + Math.cos(camAng.current) * camDist.current + rng(-1, 1) * sh,
        camH.current + rng(-1, 1) * sh * 0.4,
        camTgt.current.z + Math.sin(camAng.current) * camDist.current + rng(-1, 1) * sh
      ), 0.06
    );
    camera.lookAt(camTgt.current.x, 1.0, camTgt.current.z);

    // HUD update throttle
    frameCount.current++;
    if (frameCount.current % 3 === 0) onHud({ ...s });
  });

  return <>
    <group ref={botsRef} />
    <group ref={sparksRef} />
    <group ref={bloodRef} />
  </>;
}

// ═══════════════════════════════════════════════════════════════
// ARENA ENVIRONMENT
// ═══════════════════════════════════════════════════════════════
function ArenaEnv() {
  return <>
    {/* Ambient */}
    <ambientLight intensity={0.06} color={0x1a1a30} />
    {/* Main directional */}
    <directionalLight position={[10, 20, 8]} intensity={1.3} color={0xffeedd} castShadow
      shadow-mapSize-width={2048} shadow-mapSize-height={2048}
      shadow-camera-far={50} shadow-camera-left={-18} shadow-camera-right={18}
      shadow-camera-top={18} shadow-camera-bottom={-18} />
    {/* Dramatic accent lights — fewer, targeted */}
    <pointLight position={[0, 12, 0]} intensity={2.5} color={0xff2244} distance={28} decay={2} />
    <pointLight position={[-8, 5, -8]} intensity={1.5} color={0x2244ff} distance={20} decay={2} />
    <pointLight position={[8, 5, 8]} intensity={1.5} color={0x00cc55} distance={20} decay={2} />
    {/* Overhead spot */}
    <spotLight position={[0, 18, 0]} angle={0.45} penumbra={0.7} intensity={2.5} color={0xffffff} castShadow distance={40} decay={1.5} />

    {/* Arena floor */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[ARENA_R, 64]} />
      <meshStandardMaterial color={0x0a0a18} roughness={0.88} metalness={0.3} />
    </mesh>

    {/* Grid */}
    <gridHelper args={[ARENA_R * 2, 28, 0x151530, 0x0c0c1e]} position={[0, 0.004, 0]} />

    {/* Boundary ring */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
      <ringGeometry args={[ARENA_R - 0.15, ARENA_R + 0.05, 64]} />
      <meshStandardMaterial color={0xcc1133} emissive={0xff1133} emissiveIntensity={0.8} />
    </mesh>

    {/* Center mark */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
      <ringGeometry args={[0.8, 0.88, 32]} />
      <meshStandardMaterial color={0x221122} emissive={0xff1133} emissiveIntensity={0.1} transparent opacity={0.35} />
    </mesh>

    {/* Pillars */}
    {PILLARS.map((p, i) => (
      <group key={i} position={[p.x, 0, p.z]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[p.r * 0.85, p.r, p.h, 10]} />
          <meshStandardMaterial color={0x161628} roughness={0.65} metalness={0.45} />
        </mesh>
        {/* Cap */}
        <mesh position={[0, p.h, 0]}>
          <cylinderGeometry args={[p.r * 1.05, p.r * 0.85, 0.08, 10]} />
          <meshStandardMaterial color={0x2a1a2a} emissive={0xff2244} emissiveIntensity={0.2} />
        </mesh>
      </group>
    ))}

    <fog attach="fog" args={[0x050510, 18, 40]} />
  </>;
}

// ═══════════════════════════════════════════════════════════════
// HUD
// ═══════════════════════════════════════════════════════════════
function HUD({ state }: { state: GameState }) {
  const alive = state.bots.filter(b => b.alive).length;
  const sorted = [...state.bots].sort((a, b) => b.kills - a.kills || b.dmgDealt - a.dmgDealt);

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ fontFamily: "'Rajdhani','Orbitron',monospace" }}>
      {/* Top bar */}
      <div className="absolute top-3 left-0 right-0 flex flex-col items-center gap-0.5">
        <div className="text-[9px] tracking-[.5em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>Round {state.round}</div>
        <div className={`text-[11px] tracking-[.35em] font-bold ${alive <= 3 ? 'animate-pulse' : ''}`}
          style={{ color: alive <= 3 ? '#ff4466' : 'rgba(255,255,255,0.18)' }}>
          {alive} REMAINING
        </div>
      </div>

      {/* Kill feed */}
      <div className="absolute top-14 right-4 flex flex-col gap-1 items-end max-w-[280px]">
        {state.anns.map((a, i) => {
          const age = state.t - a.time;
          const op = age < 0.25 ? age / 0.25 : age > 2.8 ? (3.5 - age) / 0.7 : 1;
          return (
            <div key={`${a.text}-${i}`}
              className={`${a.big ? 'text-lg font-black tracking-widest' : 'text-[10px] font-semibold tracking-wider'} transition-all`}
              style={{
                color: a.color, opacity: Math.max(0, op),
                textShadow: `0 0 8px ${a.color}44, 0 0 16px ${a.color}22`,
                transform: a.big && age < 0.3 ? `scale(${1 + (0.3 - age) * 3})` : 'none',
              }}>
              {a.text}
            </div>
          );
        })}
      </div>

      {/* Health bars */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex gap-[2px]">
        {state.bots.map(b => (
          <div key={b.id} className={`flex-1 relative h-7 rounded-sm overflow-hidden ${b.alive ? '' : 'opacity-15'}`}
            style={{ border: `1px solid ${b.alive ? b.hex + '55' : '#1a1a1a'}` }}>
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} />
            {b.alive && (
              <div className="absolute inset-y-0 left-0 transition-all duration-150"
                style={{ width: `${(b.hp / b.maxHp) * 100}%`, background: `linear-gradient(180deg, ${b.hex}bb, ${b.hex}44)` }} />
            )}
            {b.alive && (
              <div className="absolute bottom-0 left-0 h-[2px] transition-all duration-75"
                style={{ width: `${b.stamina}%`, background: '#6688cc' }} />
            )}
            {b.alive && b.bleed > 0 && (
              <div className="absolute inset-0 animate-pulse" style={{ background: 'rgba(255,0,0,0.08)' }} />
            )}
            <div className="absolute inset-0 flex items-center justify-between px-0.5">
              <span className="text-[6px] font-bold truncate drop-shadow-lg" style={{ color: 'rgba(255,255,255,0.75)' }}>{b.name}</span>
              {b.kills > 0 && <span className="text-[6px] font-bold" style={{ color: '#ffcc33' }}>{b.kills}K</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Slow-mo overlay */}
      {state.slowMo < 0.4 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-3xl font-black tracking-[0.8em] animate-pulse" style={{ color: 'rgba(255,255,255,0.06)' }}>
            SLOW MOTION
          </div>
        </div>
      )}

      {/* Winner screen */}
      {state.over && state.winner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(0,0,0,0.88)' }}>
          <div className="text-5xl font-black tracking-[.25em] mb-2"
            style={{ color: state.winner.hex, textShadow: `0 0 25px ${state.winner.hex}, 0 0 50px ${state.winner.hex}44` }}>
            CHAMPION
          </div>
          <div className="text-3xl font-bold mb-5" style={{ color: state.winner.hex }}>
            {state.winner.name}
          </div>
          <div className="text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {state.winner.weapon.name} • {state.winner.style.toUpperCase()}
          </div>
          <div className="flex gap-5 text-xs mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <span>⚔ {state.winner.kills} Kills</span>
            <span>💀 {Math.round(state.winner.dmgDealt)} DMG</span>
            <span>❤ {Math.round(state.winner.hp)} HP</span>
            {state.winner.parries > 0 && <span>⛊ {state.winner.parries} Parries</span>}
          </div>

          <div className="text-[10px] tracking-[.3em] mb-2" style={{ color: 'rgba(255,255,255,0.22)' }}>LEADERBOARD</div>
          <div className="flex flex-col gap-0.5 items-center">
            {sorted.slice(0, 5).map((r, i) => (
              <div key={r.id} className="flex gap-3 text-[10px] items-center"
                style={{ color: r.id === state.winner!.id ? state.winner!.hex : 'rgba(255,255,255,0.3)' }}>
                <span className="w-3 text-right font-bold">{i + 1}.</span>
                <span className="w-16 font-bold">{r.name}</span>
                <span className="w-14 text-right">{r.kills}K / {Math.round(r.dmgDealt)}D</span>
                <span className="w-14 text-right" style={{ color: 'rgba(255,255,255,0.15)' }}>{r.weapon.name}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 text-xs animate-pulse" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Next round in {Math.max(1, Math.ceil(5.5 - state.winTimer))}...
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
const RagdollArena = () => {
  const stateRef = useRef<GameState>(mkState(1));
  const [hudState, setHudState] = useState<GameState>(stateRef.current);

  return (
    <div className="w-full h-full relative bg-black">
      <Canvas shadows
        camera={{ position: [0, 6, 12], fov: 46, near: 0.1, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
        dpr={[1, 1.5]}
      >
        <ArenaEnv />
        <GameScene state={stateRef} onHud={setHudState} />
      </Canvas>
      <HUD state={hudState} />
    </div>
  );
};

export default RagdollArena;
