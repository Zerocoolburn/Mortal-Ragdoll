import { useRef, useEffect, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// MATH
// ═══════════════════════════════════════════════════════════════
interface V2 { x: number; y: number }
const v = (x = 0, y = 0): V2 => ({ x, y });
const vadd = (a: V2, b: V2): V2 => ({ x: a.x + b.x, y: a.y + b.y });
const vsub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, y: a.y - b.y });
const vscl = (a: V2, s: number): V2 => ({ x: a.x * s, y: a.y * s });
const vlen = (a: V2) => Math.sqrt(a.x * a.x + a.y * a.y);
const vnorm = (a: V2): V2 => { const l = vlen(a) || 1; return { x: a.x / l, y: a.y / l }; };
const vdist = (a: V2, b: V2) => vlen(vsub(a, b));
const vlerp = (a: V2, b: V2, t: number): V2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const vrot = (a: V2, ang: number): V2 => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));
const rng = (a = 0, b = 1) => a + Math.random() * (b - a);
const rngInt = (a: number, b: number) => Math.floor(rng(a, b + 1));
const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const ARENA_R = 280;
const BOT_COUNT = 10;
const NAMES = ['KAEL', 'VIPER', 'GHOST', 'ATLAS', 'TEMPEST', 'SHADE', 'HELIOS', 'CLAW', 'GRIM', 'NEON'];
const COLORS = ['#e63946', '#06d6a0', '#118ab2', '#ffd166', '#ef476f', '#26547c', '#ff6b35', '#7209b7', '#f72585', '#4cc9f0'];
const COLORS_DIM = ['#b22d38', '#05a87d', '#0d6d8e', '#ccaa52', '#bf3859', '#1e4360', '#cc562a', '#5b0792', '#c41e6a', '#3da1c0'];

type Style = 'aggro' | 'tank' | 'berserker' | 'duelist' | 'assassin';
const STYLES: Style[] = ['aggro', 'tank', 'berserker', 'duelist', 'assassin', 'aggro', 'berserker', 'duelist', 'assassin', 'tank'];

type WeaponType = 'longsword' | 'greatsword' | 'spear' | 'axe' | 'daggers';
const WEAPON_TYPES: WeaponType[] = ['longsword', 'greatsword', 'spear', 'axe', 'daggers', 'longsword', 'daggers', 'spear', 'greatsword', 'axe'];

interface WeaponDef {
  type: WeaponType; name: string;
  reach: number; speed: number; dmg: number; kb: number;
  bladeLen: number; guardBreak: number;
  combos: AtkType[][];
}
const WEAPONS: Record<WeaponType, WeaponDef> = {
  longsword: { type: 'longsword', name: 'Longsword', reach: 38, speed: 1.0, dmg: 1.0, kb: 1.0, bladeLen: 32, guardBreak: 1, combos: [['slash_r', 'slash_l', 'thrust'], ['slash_r', 'overhead'], ['thrust', 'slash_r', 'slash_l', 'overhead']] },
  greatsword: { type: 'greatsword', name: 'Greatsword', reach: 48, speed: 0.6, dmg: 1.9, kb: 2.2, bladeLen: 42, guardBreak: 2.5, combos: [['overhead', 'sweep'], ['slash_r', 'overhead', 'sweep'], ['sweep', 'spin']] },
  spear: { type: 'spear', name: 'Spear', reach: 55, speed: 1.15, dmg: 0.85, kb: 0.7, bladeLen: 50, guardBreak: 0.6, combos: [['thrust', 'thrust', 'sweep'], ['thrust', 'slash_r', 'thrust'], ['sweep', 'thrust', 'thrust']] },
  axe: { type: 'axe', name: 'War Axe', reach: 34, speed: 0.75, dmg: 1.6, kb: 1.8, bladeLen: 28, guardBreak: 2, combos: [['overhead', 'slash_r'], ['slash_r', 'overhead', 'sweep'], ['overhead', 'overhead']] },
  daggers: { type: 'daggers', name: 'Twin Daggers', reach: 22, speed: 1.8, dmg: 0.55, kb: 0.4, bladeLen: 16, guardBreak: 0.5, combos: [['slash_r', 'slash_l', 'slash_r', 'slash_l', 'thrust'], ['thrust', 'slash_r', 'slash_l'], ['slash_r', 'slash_l', 'thrust', 'slash_r', 'slash_l', 'thrust']] },
};

type AtkType = 'slash_r' | 'slash_l' | 'thrust' | 'overhead' | 'sweep' | 'spin';
interface AtkDef { dmg: number; dur: number; kb: number; stCost: number; angStart: number; angEnd: number; windUp: number; }
const ATTACKS: Record<AtkType, AtkDef> = {
  slash_r: { dmg: 14, dur: 0.28, kb: 80, stCost: 12, angStart: -2.2, angEnd: 1.8, windUp: 0.15 },
  slash_l: { dmg: 14, dur: 0.28, kb: 80, stCost: 12, angStart: 2.2, angEnd: -1.8, windUp: 0.15 },
  thrust: { dmg: 18, dur: 0.22, kb: 110, stCost: 14, angStart: 0, angEnd: 0, windUp: 0.3 },
  overhead: { dmg: 26, dur: 0.4, kb: 160, stCost: 22, angStart: -0.15, angEnd: -0.15, windUp: 0.25 },
  sweep: { dmg: 11, dur: 0.32, kb: 60, stCost: 14, angStart: -3.0, angEnd: 3.0, windUp: 0.1 },
  spin: { dmg: 32, dur: 0.55, kb: 200, stCost: 38, angStart: 0, angEnd: 6.28, windUp: 0.2 },
};

// Skeleton: head, neck, chest, hip, lShoulder, lElbow, lHand, rShoulder, rElbow, rHand, lHip, lKnee, lFoot, rHip, rKnee, rFoot
const JOINT_COUNT = 16;
const J = { head: 0, neck: 1, chest: 2, hip: 3, lSh: 4, lEl: 5, lHd: 6, rSh: 7, rEl: 8, rHd: 9, lHip: 10, lKn: 11, lFt: 12, rHip: 13, rKn: 14, rFt: 15 };
const REST: V2[] = [
  v(0, -36), v(0, -28), v(0, -18), v(0, -2),
  v(-8, -26), v(-14, -16), v(-15, -6),
  v(8, -26), v(14, -16), v(15, -6),
  v(-5, 0), v(-6, 14), v(-6, 28),
  v(5, 0), v(6, 14), v(6, 28),
];
const LIMBS: [number, number, number][] = [
  [J.head, J.neck, 2], [J.neck, J.chest, 4.5], [J.chest, J.hip, 4],
  [J.neck, J.lSh, 3], [J.lSh, J.lEl, 2.8], [J.lEl, J.lHd, 2.2],
  [J.neck, J.rSh, 3], [J.rSh, J.rEl, 2.8], [J.rEl, J.rHd, 2.2],
  [J.hip, J.lHip, 3], [J.lHip, J.lKn, 3], [J.lKn, J.lFt, 2.5],
  [J.hip, J.rHip, 3], [J.rHip, J.rKn, 3], [J.rKn, J.rFt, 2.5],
];

// Pillars
interface Pillar { x: number; y: number; r: number }
const PILLARS: Pillar[] = [0, 1, 2, 3].map(i => {
  const a = (i / 4) * Math.PI * 2 + 0.4;
  return { x: Math.cos(a) * 160, y: Math.sin(a) * 160, r: 18 };
});

// ═══════════════════════════════════════════════════════════════
// BOT
// ═══════════════════════════════════════════════════════════════
interface Bot {
  id: number; name: string; color: string; colorDim: string; style: Style;
  weapon: WeaponDef;
  pos: V2; vel: V2; facing: number; tgtFacing: number;
  walkPhase: number; walkSpd: number;
  joints: V2[];
  hp: number; maxHp: number; alive: boolean;
  stamina: number; stun: number; rage: number;
  bleed: number; bleedTick: number;
  atk: AtkDef | null; atkType: AtkType | null; atkTimer: number; atkProg: number;
  atkCd: number; hitBag: Set<number>;
  comboIdx: number; comboChain: AtkType[] | null; comboTimer: number; combo: number;
  blocking: boolean; blockTimer: number; parryWindow: number; blockCd: number;
  dodgeCd: number;
  kills: number; dmgDealt: number; parries: number; lastHitBy: number;
  aiState: string; aiTimer: number; aiTarget: number;
  circleDir: number;
  moveX: number; moveY: number; sprint: boolean;
  swordAng: number; tipPos: V2; basePos: V2;
  bodyTilt: number; breathPhase: number;
  ragdoll: number; jvel: V2[];
  deathTime: number; opacity: number;
}

interface Spark { p: V2; v: V2; life: number; maxLife: number; color: string; size: number }
interface Blood { x: number; y: number; size: number; age: number; opacity: number }
interface Ann { text: string; color: string; time: number; big: boolean }

interface GameState {
  bots: Bot[]; sparks: Spark[]; blood: Blood[];
  t: number; dt: number;
  over: boolean; winner: Bot | null;
  round: number; winTimer: number;
  shake: number; shakeOff: V2;
  slowMo: number; slowTimer: number;
  anns: Ann[];
}

function mkBot(i: number): Bot {
  const ang = (i / BOT_COUNT) * Math.PI * 2;
  const r = 80 + rng(0, 60);
  const pos = v(Math.cos(ang) * r, Math.sin(ang) * r);
  const wt = WEAPON_TYPES[i];
  const w = WEAPONS[wt];
  const hp = wt === 'greatsword' ? 140 : wt === 'axe' ? 130 : wt === 'daggers' ? 100 : wt === 'spear' ? 110 : 120;
  return {
    id: i, name: NAMES[i], color: COLORS[i], colorDim: COLORS_DIM[i], style: STYLES[i], weapon: w,
    pos, vel: v(), facing: ang + Math.PI, tgtFacing: ang + Math.PI,
    walkPhase: rng(0, 6.28), walkSpd: 0,
    joints: REST.map(o => vadd(pos, o)),
    hp, maxHp: hp, alive: true, stamina: 100, stun: 0, rage: 0,
    bleed: 0, bleedTick: 0,
    atk: null, atkType: null, atkTimer: 0, atkProg: 0, atkCd: rng(0.1, 0.4), hitBag: new Set(),
    comboIdx: 0, comboChain: null, comboTimer: 0, combo: 0,
    blocking: false, blockTimer: 0, parryWindow: 0, blockCd: 0, dodgeCd: 0,
    kills: 0, dmgDealt: 0, parries: 0, lastHitBy: -1,
    aiState: 'seek', aiTimer: 0, aiTarget: -1, circleDir: rng() > 0.5 ? 1 : -1,
    moveX: 0, moveY: 0, sprint: false,
    swordAng: -0.5, tipPos: v(), basePos: v(),
    bodyTilt: 0, breathPhase: rng(0, 6),
    ragdoll: 0, jvel: Array.from({ length: JOINT_COUNT }, () => v()),
    deathTime: 0, opacity: 1,
  };
}

// ═══════════════════════════════════════════════════════════════
// COMBAT
// ═══════════════════════════════════════════════════════════════
function startAtk(b: Bot, type: AtkType): boolean {
  if (b.atk || b.atkCd > 0 || b.ragdoll > 0.2 || b.stun > 0) return false;
  const a = ATTACKS[type];
  if (b.stamina < a.stCost * 0.4) return false;
  b.atk = a; b.atkType = type;
  b.atkTimer = a.dur / b.weapon.speed; b.atkProg = 0;
  b.hitBag.clear(); b.stamina -= a.stCost; b.blocking = false;
  const lunge = type === 'thrust' ? 140 : type === 'spin' ? 50 : type === 'overhead' ? 90 : 80;
  b.vel.x += Math.cos(b.facing) * lunge;
  b.vel.y += Math.sin(b.facing) * lunge;
  b.atkCd = a.dur / b.weapon.speed + 0.05;
  return true;
}

function startCombo(b: Bot): boolean {
  if (!b.comboChain) {
    b.comboChain = b.weapon.combos[rngInt(0, b.weapon.combos.length - 1)];
    b.comboIdx = 0;
  }
  if (b.comboIdx >= b.comboChain.length) { b.comboChain = null; b.comboIdx = 0; b.combo = 0; return false; }
  const type = b.comboChain[b.comboIdx];
  if (startAtk(b, type)) { b.comboIdx++; b.combo++; b.comboTimer = 0.35; return true; }
  return false;
}

function doBlock(b: Bot): boolean {
  if (b.blockCd > 0 || b.atk || b.ragdoll > 0 || b.stamina < 8) return false;
  b.blocking = true; b.blockTimer = 0.35 + rng(0, 0.3); b.parryWindow = 0.1; b.blockCd = 0.4; b.stamina -= 6;
  return true;
}

function doDodge(b: Bot, dx: number, dy: number, power = 220) {
  if (b.dodgeCd > 0 || b.ragdoll > 0.2 || b.stamina < 16 || b.atk) return;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  b.vel.x += (dx / d) * power; b.vel.y += (dy / d) * power;
  b.dodgeCd = 0.5; b.stamina -= 14; b.blocking = false;
}

// ═══════════════════════════════════════════════════════════════
// ANIMATION
// ═══════════════════════════════════════════════════════════════
function snapToUprightPose(b: Bot, blend = 1) {
  const baseRot = b.facing - Math.PI / 2;
  for (let i = 0; i < JOINT_COUNT; i++) {
    const rot = vrot(REST[i], baseRot);
    const tx = b.pos.x + rot.x;
    const ty = b.pos.y + rot.y;
    b.joints[i].x = lerp(b.joints[i].x, tx, blend);
    b.joints[i].y = lerp(b.joints[i].y, ty, blend);
  }
}

// ═══════════════════════════════════════════════════════════════
// ANIMATION
// ═══════════════════════════════════════════════════════════════
function animBot(b: Bot, dt: number) {
  if (!b.alive && b.ragdoll <= 0) return;
  const spd = vlen(b.vel);
  const walking = spd > 10;
  const running = spd > 60;
  const sprinting = spd > 120;

  b.walkSpd = lerp(b.walkSpd, spd, dt * 8);
  if (walking) b.walkPhase += dt * b.walkSpd * 0.12;
  b.breathPhase += dt * 2.2;

  const s = Math.sin(b.walkPhase);
  const cf = Math.cos(b.facing), sf = Math.sin(b.facing);
  const breath = Math.sin(b.breathPhase);

  const bob = walking ? Math.abs(s) * (sprinting ? 2.5 : running ? 1.5 : 0.8) : breath * 0.15;

  // Attack arm angle
  let armAng = -0.5;
  if (b.atk && b.atkTimer > 0) {
    const totalDur = b.atk.dur / b.weapon.speed;
    const p = 1 - b.atkTimer / totalDur;
    b.atkProg = p;
    const inWU = p < b.atk.windUp;
    if (b.atkType === 'spin') {
      armAng = -0.7 + p * b.atk.angEnd;
    } else if (b.atkType === 'thrust') {
      armAng = 0;
    } else if (b.atkType === 'overhead') {
      const slam = inWU ? 0 : (p - b.atk.windUp) / (1 - b.atk.windUp);
      armAng = lerp(-0.3, 0.5, slam);
    } else if (b.atkType === 'sweep') {
      const ep = inWU ? 0 : (p - b.atk.windUp) / (1 - b.atk.windUp);
      armAng = lerp(b.atk.angStart, b.atk.angEnd, ep);
    } else {
      const ep = inWU ? 0 : (p - b.atk.windUp) / (1 - b.atk.windUp);
      armAng = lerp(b.atk.angStart, b.atk.angEnd, ep);
    }
  } else if (b.blocking) {
    armAng = 0.2;
  }
  b.swordAng = armAng;

  // Place joints relative to pos
  const rate = b.atk ? 24 : 20;
  for (let i = 0; i < JOINT_COUNT; i++) {
    const o = REST[i];
    const twist = (i <= 9 && b.atk) ? (b.swordAng * 0.15) : 0;
    const rot = vrot(o, b.facing - Math.PI / 2 + twist);

    let tx = b.pos.x + rot.x;
    let ty = b.pos.y + rot.y - bob;

    // Leg animation
    if (walking) {
      const stride = sprinting ? 12 : running ? 9 : 6;
      if (i === J.lFt) {
        tx += cf * s * stride; ty += sf * s * stride;
      } else if (i === J.rFt) {
        tx -= cf * s * stride; ty -= sf * s * stride;
      } else if (i === J.lKn) {
        tx += cf * s * stride * 0.45; ty += sf * s * stride * 0.45;
      } else if (i === J.rKn) {
        tx -= cf * s * stride * 0.45; ty -= sf * s * stride * 0.45;
      }
      // Arm swing when not attacking
      if (!b.atk && !b.blocking) {
        if (i === J.lHd) { tx -= cf * s * 5; ty -= sf * s * 5; }
        else if (i === J.lEl) { tx -= cf * s * 2.5; ty -= sf * s * 2.5; }
      }
    }

    // Weapon arm
    if (i === J.rHd) {
      const handD = 14 + (b.atk && b.atkType === 'thrust' ? 18 : 0);
      tx = b.pos.x + Math.cos(b.facing + b.swordAng) * handD;
      ty = b.pos.y + Math.sin(b.facing + b.swordAng) * handD;
    } else if (i === J.rEl) {
      tx = b.pos.x + Math.cos(b.facing + b.swordAng * 0.4) * 10;
      ty = b.pos.y + Math.sin(b.facing + b.swordAng * 0.4) * 10;
    }

    // Daggers left hand mirror
    if (b.weapon.type === 'daggers' && !b.blocking && (i === J.lHd || i === J.lEl)) {
      const mir = b.swordAng * -0.65;
      if (i === J.lHd) {
        tx = b.pos.x + Math.cos(b.facing + mir + Math.PI) * 13;
        ty = b.pos.y + Math.sin(b.facing + mir + Math.PI) * 13;
      }
    }

    // Ragdoll
    if (b.ragdoll > 0) {
      const w = clamp(b.ragdoll * 5, 0, 1);
      b.joints[i].x += b.jvel[i].x * dt;
      b.joints[i].y += b.jvel[i].y * dt;
      b.jvel[i].x *= 0.9; b.jvel[i].y *= 0.9;
      // Always pull back toward standing pose so knockdowns recover naturally
      b.joints[i].x = lerp(tx, b.joints[i].x, w);
      b.joints[i].y = lerp(ty, b.joints[i].y, w);
    } else {
      b.joints[i].x = lerp(b.joints[i].x, tx, dt * rate);
      b.joints[i].y = lerp(b.joints[i].y, ty, dt * rate);
    }
  }

  // Sword tip/base
  const hand = b.joints[J.rHd];
  const bl = b.weapon.bladeLen;
  const ta = b.facing + b.swordAng;
  b.basePos = { ...hand };
  b.tipPos = { x: hand.x + Math.cos(ta) * bl, y: hand.y + Math.sin(ta) * bl };
}

// ═══════════════════════════════════════════════════════════════
// PHYSICS
// ═══════════════════════════════════════════════════════════════
function updatePhys(b: Bot, dt: number) {
  if (!b.alive) { if (b.ragdoll > 0) b.ragdoll -= dt; b.opacity = Math.max(0.05, b.opacity - dt * 0.15); return; }
  b.stamina = clamp(b.stamina + (b.atk ? 6 : b.blocking ? 10 : b.sprint ? 8 : 28) * dt, 0, 100);
  if (b.bleed > 0) { b.bleedTick -= dt; if (b.bleedTick <= 0) { b.hp -= b.bleed; b.bleedTick = 0.4; b.bleed = Math.max(0, b.bleed - 0.4); } }
  if (b.comboTimer > 0) { b.comboTimer -= dt; if (b.comboTimer <= 0) { b.combo = 0; b.comboChain = null; b.comboIdx = 0; } }

  if (b.ragdoll > 0) {
    b.ragdoll -= dt; b.vel.x *= 0.88; b.vel.y *= 0.88;
    if (b.ragdoll <= 0) {
      b.ragdoll = 0;
      for (const jv of b.jvel) { jv.x = 0; jv.y = 0; }
      b.vel.x *= 0.45; b.vel.y *= 0.45;
      snapToUprightPose(b, 1);
    }
    b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt;
  } else {
    const base = b.sprint ? 170 : 110;
    const slow = (b.atk ? 0.3 : 1) * (b.blocking ? 0.35 : 1) * (b.stamina < 15 ? 0.55 : 1);
    const spd = base * slow;
    b.vel.x += b.moveX * spd * dt * 14;
    b.vel.y += b.moveY * spd * dt * 14;
    b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt;
    b.vel.x *= (1 - 10 * dt); b.vel.y *= (1 - 10 * dt);
    if (b.sprint) b.stamina -= 12 * dt;
  }

  // Facing
  const fd = angDiff(b.facing, b.tgtFacing);
  b.facing += fd * clamp((b.atk ? 6 : 14) * dt, 0, 0.94);

  // Arena
  const hd = vlen(b.pos);
  if (hd > ARENA_R - 15) {
    const n = vnorm(b.pos);
    b.pos.x = n.x * (ARENA_R - 15); b.pos.y = n.y * (ARENA_R - 15);
    const dot = b.vel.x * n.x + b.vel.y * n.y;
    if (dot > 0) { b.vel.x -= dot * n.x * 1.8; b.vel.y -= dot * n.y * 1.8; }
  }

  // Pillars
  for (const p of PILLARS) {
    const dx = b.pos.x - p.x, dy = b.pos.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < p.r + 10) {
      const push = p.r + 10 - d;
      const nx = dx / (d || 1), ny = dy / (d || 1);
      b.pos.x += nx * push; b.pos.y += ny * push;
    }
  }

  if (b.atk) { b.atkTimer -= dt; if (b.atkTimer <= 0) { b.atk = null; b.atkType = null; } }
  b.atkCd = Math.max(0, b.atkCd - dt);
  b.dodgeCd = Math.max(0, b.dodgeCd - dt);
  b.blockCd = Math.max(0, b.blockCd - dt);
  b.stun = Math.max(0, b.stun - dt);
  if (b.blocking) { b.blockTimer -= dt; b.parryWindow = Math.max(0, b.parryWindow - dt); if (b.blockTimer <= 0) b.blocking = false; }
  if (b.hp <= 0 && b.alive) { b.hp = 0; b.alive = false; }
}

// ═══════════════════════════════════════════════════════════════
// AI
// ═══════════════════════════════════════════════════════════════
function pickTarget(b: Bot, bots: Bot[]): Bot | null {
  let best: Bot | null = null, bs = -Infinity;
  for (const o of bots) {
    if (o.id === b.id || !o.alive) continue;
    const d = vdist(b.pos, o.pos);
    let score = 0;
    switch (b.style) {
      case 'assassin': score = 200 - o.hp - d * 0.5 + (o.atk ? 30 : 0); break;
      case 'duelist': score = 150 - d * 0.4 + o.kills * 20; break;
      case 'berserker': score = 300 - d; break;
      case 'tank': score = 100 - d * 0.5 + (o.atk ? 20 : 0); break;
      default: score = 200 - d * 0.7;
    }
    if (score > bs) { bs = score; best = o; }
  }
  return best;
}

function isBehind(me: Bot, them: Bot): boolean {
  const a = Math.atan2(me.pos.y - them.pos.y, me.pos.x - them.pos.x);
  return Math.abs(angDiff(them.facing, a)) > Math.PI * 0.6;
}

function runAI(b: Bot, s: GameState) {
  if (!b.alive || b.stun > 0 || b.ragdoll > 0.35) { b.moveX = 0; b.moveY = 0; return; }
  const dt = s.dt;
  b.aiTimer -= dt;
  const tgt = pickTarget(b, s.bots);
  if (!tgt) { b.moveX = 0; b.moveY = 0; return; }
  b.aiTarget = tgt.id;
  const d = vdist(b.pos, tgt.pos);
  const wRange = b.weapon.reach * 1.5 + 10;
  const engRange = wRange + 12;

  const reactRate = { aggro: 0.25, tank: 0.55, berserker: 0.1, duelist: 0.4, assassin: 0.35 }[b.style];
  b.rage = clamp(b.rage + dt * ({ aggro: 5, tank: 2.5, berserker: 10, duelist: 4, assassin: 6 }[b.style]) * (b.hp < b.maxHp * 0.4 ? 3 : 1), 0, 100);

  // React to incoming
  if (tgt.atk && tgt.atkTimer > 0 && d < tgt.weapon.reach * 2.5 + 30) {
    if (rng() < reactRate * dt * 18) {
      if (b.style === 'tank' || (b.style === 'duelist' && rng() < 0.6)) doBlock(b);
      else if (b.style === 'assassin') {
        const dx = tgt.pos.x - b.pos.x, dy = tgt.pos.y - b.pos.y;
        const dd = Math.sqrt(dx * dx + dy * dy) || 1;
        doDodge(b, -dy / dd * b.circleDir, dx / dd * b.circleDir, 200);
        b.circleDir *= -1;
      } else if (rng() < 0.35) doBlock(b);
      else doDodge(b, b.pos.x - tgt.pos.x, b.pos.y - tgt.pos.y);
    }
  }

  if (b.aiTimer <= 0) {
    b.aiTimer = 0.08 + rng(0, 0.18);
    b.circleDir = rng() > 0.3 ? b.circleDir : -b.circleDir;
    const nearby = s.bots.filter(o => o.id !== b.id && o.alive && vdist(b.pos, o.pos) < 80).length;
    if (b.style === 'berserker' && (b.rage > 70 || b.hp < b.maxHp * 0.3)) b.aiState = 'berserk';
    else if (d > 150) b.aiState = nearby > 2 ? 'retreat' : 'chase';
    else if (d < engRange + 15) {
      if (b.style === 'assassin' && !isBehind(b, tgt) && d > 50) b.aiState = 'flank';
      else b.aiState = 'fight';
    } else if (d < 120) b.aiState = rng() < 0.45 ? 'circle' : 'approach';
    else b.aiState = 'approach';
  }

  const faceT = () => { b.tgtFacing = Math.atan2(tgt.pos.y - b.pos.y, tgt.pos.x - b.pos.x); };
  const moveT = (sprint = false) => {
    const dx = tgt.pos.x - b.pos.x, dy = tgt.pos.y - b.pos.y;
    const dd = Math.sqrt(dx * dx + dy * dy) || 1;
    b.moveX = dx / dd; b.moveY = dy / dd; b.sprint = sprint; faceT();
  };
  const strafe = (dir: number, idealDist: number) => {
    const dx = tgt.pos.x - b.pos.x, dy = tgt.pos.y - b.pos.y;
    const dd = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / dd * dir, py = dx / dd * dir;
    const rad = (dd - idealDist) * 0.6;
    b.moveX = px * 0.7 + (dx / dd) * rad;
    b.moveY = py * 0.7 + (dy / dd) * rad;
    faceT();
  };

  switch (b.aiState) {
    case 'chase': case 'approach': moveT(d > 120); if (d < engRange) b.aiState = 'fight'; break;
    case 'fight': {
      faceT();
      const atkRate = { aggro: 0.35, tank: 0.18, berserker: 0.28, duelist: 0.22, assassin: 0.3 }[b.style];
      if (d < engRange && !b.atk && b.atkCd <= 0 && b.stun <= 0 && rng() < atkRate) {
        if (b.comboTimer > 0 && b.comboChain && rng() < 0.75) startCombo(b);
        else {
          b.comboChain = null; b.comboIdx = 0; b.combo = 0;
          if (isBehind(b, tgt)) startAtk(b, 'overhead');
          else if (tgt.blocking && rng() < 0.45) startAtk(b, b.weapon.guardBreak > 1.5 ? 'overhead' : 'sweep');
          else if (tgt.stun > 0) startAtk(b, 'thrust');
          else startCombo(b);
        }
      }
      if (!b.atk) strafe(b.circleDir, wRange * 0.6);
      else { if (d > wRange * 0.5) { b.moveX = Math.cos(b.facing) * 0.65; b.moveY = Math.sin(b.facing) * 0.65; } else { b.moveX *= 0.25; b.moveY *= 0.25; } }
      if (b.rage > 80 && b.stamina > 35 && d < wRange && rng() < 0.06) { startAtk(b, 'spin'); b.rage = 0; }
      if (d > engRange + 50) b.aiState = 'approach';
      break;
    }
    case 'berserk': faceT(); moveT(true); if (d < engRange && !b.atk && b.atkCd <= 0 && rng() < 0.45) { if (b.comboTimer > 0 && b.comboChain) startCombo(b); else { b.comboChain = null; startCombo(b); } } if (b.rage < 25 && b.hp > b.maxHp * 0.5) b.aiState = 'fight'; break;
    case 'circle': strafe(b.circleDir, 65); if (d < engRange && rng() < 0.4) b.aiState = 'fight'; if (d > 140) b.aiState = 'approach'; break;
    case 'flank': {
      const behind = { x: tgt.pos.x - Math.cos(tgt.facing) * 70, y: tgt.pos.y - Math.sin(tgt.facing) * 70 };
      const dx2 = behind.x - b.pos.x, dy2 = behind.y - b.pos.y;
      const dd2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
      b.moveX = dx2 / dd2; b.moveY = dy2 / dd2; b.sprint = true; faceT();
      if (d < engRange || isBehind(b, tgt)) b.aiState = 'fight';
      break;
    }
    case 'retreat': {
      const ax = b.pos.x - tgt.pos.x, ay = b.pos.y - tgt.pos.y;
      const ad = Math.sqrt(ax * ax + ay * ay) || 1;
      b.moveX = ax / ad; b.moveY = ay / ad; b.sprint = true; faceT();
      if (rng() < 0.06) doDodge(b, ax, ay);
      if (d > 170 || b.hp > b.maxHp * 0.5) b.aiState = 'circle';
      break;
    }
  }

  // Arena avoidance
  const hd = vlen(b.pos);
  if (hd > ARENA_R - 60) {
    const str = (hd - (ARENA_R - 60)) / 60;
    b.moveX -= (b.pos.x / hd) * str * 0.8;
    b.moveY -= (b.pos.y / hd) * str * 0.8;
  }

  const ml = Math.sqrt(b.moveX ** 2 + b.moveY ** 2);
  if (ml > 1) { b.moveX /= ml; b.moveY /= ml; }
}

// ═══════════════════════════════════════════════════════════════
// HITS
// ═══════════════════════════════════════════════════════════════
function checkHits(s: GameState) {
  for (const atk of s.bots) {
    if (!atk.alive || !atk.atk || atk.atkTimer <= 0) continue;
    const totalDur = atk.atk.dur / atk.weapon.speed;
    const prog = 1 - atk.atkTimer / totalDur;
    if (prog < atk.atk.windUp) continue;
    for (const def of s.bots) {
      if (def.id === atk.id || !def.alive || atk.hitBag.has(def.id)) continue;
      const pts = [atk.tipPos, atk.basePos, vlerp(atk.basePos, atk.tipPos, 0.33), vlerp(atk.basePos, atk.tipPos, 0.66)];
      let hit = false;
      for (const pt of pts) { if (vdist(pt, def.pos) < 16) { hit = true; break; } }
      if (!hit) continue;
      atk.hitBag.add(def.id);
      applyHit(s, atk, def);
    }
  }
  // Body sep
  for (let i = 0; i < s.bots.length; i++) for (let j = i + 1; j < s.bots.length; j++) {
    const a = s.bots[i], b = s.bots[j];
    if (!a.alive || !b.alive) continue;
    const d = vdist(a.pos, b.pos);
    if (d < 18 && d > 0) {
      const n = vnorm(vsub(a.pos, b.pos));
      const p = (18 - d) * 6;
      a.vel.x += n.x * p; a.vel.y += n.y * p;
      b.vel.x -= n.x * p; b.vel.y -= n.y * p;
    }
  }
}

function applyHit(s: GameState, atk: Bot, def: Bot) {
  const a = atk.atk!; const w = atk.weapon;
  if (def.blocking && def.parryWindow > 0) {
    atk.stun = 0.65; atk.vel.x -= Math.cos(atk.facing) * 150; atk.vel.y -= Math.sin(atk.facing) * 150;
    def.parries++;
    emitSparks(s, (atk.pos.x + def.pos.x) / 2, (atk.pos.y + def.pos.y) / 2, 14, '#ffffff', 180);
    emitSparks(s, (atk.pos.x + def.pos.x) / 2, (atk.pos.y + def.pos.y) / 2, 8, '#ffff44', 120);
    s.shake += 0.15; addAnn(s, 'PARRY!', '#ffff44', true); def.blocking = false; return;
  }
  if (def.blocking) {
    atk.stun = 0.2; atk.vel.x -= Math.cos(atk.facing) * 80; atk.vel.y -= Math.sin(atk.facing) * 80;
    def.stamina -= 18 * w.guardBreak;
    emitSparks(s, (atk.pos.x + def.pos.x) / 2, (atk.pos.y + def.pos.y) / 2, 8, '#aaaaaa', 100);
    s.shake += 0.06; if (def.stamina <= 0) { def.blocking = false; def.stun = 0.55; addAnn(s, 'GUARD BREAK!', '#ff6600', false); } return;
  }

  let dmg = a.dmg * w.dmg * (0.82 + rng(0, 0.36));
  if (atk.rage > 50) dmg *= 1 + atk.rage / 280;
  if (isBehind(atk, def)) { dmg *= 1.85; addAnn(s, 'BACKSTAB!', '#ff4444', true); }
  dmg = Math.min(dmg, 60);
  def.hp -= dmg; def.lastHitBy = atk.id; atk.dmgDealt += dmg;
  atk.rage = clamp(atk.rage + dmg * 0.35, 0, 100);
  if (dmg > 14) { def.bleed += dmg * 0.07; def.bleedTick = 0.4; }
  const dx = def.pos.x - atk.pos.x, dy = def.pos.y - atk.pos.y;
  const dd = Math.sqrt(dx * dx + dy * dy) || 1;
  def.vel.x += (dx / dd) * a.kb * w.kb; def.vel.y += (dy / dd) * a.kb * w.kb;
  if (dmg > 15 || atk.atkType === 'overhead' || atk.atkType === 'spin') {
    def.ragdoll = clamp(0.25 + dmg * 0.018, 0.2, 1.2); def.stun = def.ragdoll * 0.7;
    for (const jv of def.jvel) { jv.x += (dx / dd) * a.kb * w.kb * rng(0.3, 0.7); jv.y += (dy / dd) * a.kb * w.kb * rng(0.3, 0.7); }
  } else def.stun = 0.08;

  const hx = (atk.tipPos.x + def.pos.x) / 2, hy = (atk.tipPos.y + def.pos.y) / 2;
  emitSparks(s, hx, hy, clamp(3 + (dmg * 0.35) | 0, 3, 12), atk.color, 100);
  if (dmg > 15) emitSparks(s, hx, hy, 5, '#ff3300', 80);
  emitBlood(s, hx, hy, 5 + dmg * 0.3);
  s.shake += dmg * 0.008;

  if (def.hp <= 0) {
    def.hp = 0; def.alive = false; atk.kills++; atk.rage = 100;
    s.slowMo = 0.06; s.slowTimer = 0.7;
    def.ragdoll = 8; def.deathTime = s.t;
    for (const jv of def.jvel) { jv.x += (dx / dd) * 400 * rng(0.3, 1.2); jv.y += (dy / dd) * 400 * rng(0.3, 1.2); }
    emitSparks(s, def.pos.x, def.pos.y, 30, def.color, 180);
    emitSparks(s, def.pos.x, def.pos.y, 15, '#ff5500', 130);
    emitBlood(s, def.pos.x, def.pos.y, 25);
    s.shake += 0.55;
    const alive = s.bots.filter(b => b.alive).length;
    addAnn(s, `${atk.name} killed ${def.name}`, atk.color, false);
    if (atk.kills >= 4) addAnn(s, `${atk.name} — RAMPAGE!`, atk.color, true);
    else if (atk.kills >= 3) addAnn(s, `${atk.name} — KILLING SPREE!`, atk.color, true);
    else if (atk.kills === 2) addAnn(s, `${atk.name} — DOUBLE KILL`, atk.color, true);
    if (alive <= 3 && alive > 1) addAnn(s, `${alive} REMAIN`, '#ffffff', true);
  }
}

function emitSparks(s: GameState, x: number, y: number, n: number, color: string, spd: number) {
  for (let i = 0; i < n; i++) {
    const a = rng(0, Math.PI * 2);
    const sp = rng(spd * 0.3, spd);
    s.sparks.push({ p: v(x + rng(-3, 3), y + rng(-3, 3)), v: v(Math.cos(a) * sp, Math.sin(a) * sp), life: rng(0.15, 0.4), maxLife: rng(0.15, 0.4), color, size: rng(1.5, 3.5) });
  }
}
function emitBlood(s: GameState, x: number, y: number, size: number) {
  s.blood.push({ x: x + rng(-5, 5), y: y + rng(-5, 5), size: size * rng(0.7, 1.3), age: 0, opacity: 0.5 });
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
    sparks: [], blood: [], t: 0, dt: 0,
    over: false, winner: null, round, winTimer: 0,
    shake: 0, shakeOff: v(), slowMo: 1, slowTimer: 0, anns: [],
  };
}

function gameTick(s: GameState, rawDt: number) {
  const dt = Math.min(rawDt, 1 / 20);
  s.dt = dt; s.t += dt;
  let adt = dt;
  if (s.slowMo < 1) {
    s.slowTimer -= dt; adt = dt * s.slowMo;
    if (s.slowTimer <= 0) s.slowMo = Math.min(1, s.slowMo + dt * 4);
    else s.slowMo = lerp(s.slowMo, 1, dt * 0.6);
  }
  for (const b of s.bots) { s.dt = adt; runAI(b, s); }
  for (const b of s.bots) { updatePhys(b, adt); animBot(b, adt); }
  s.dt = dt;
  checkHits(s);
  for (const b of s.bots) { if (b.alive && b.bleed > 0 && rng() < 0.25) emitSparks(s, b.pos.x + rng(-4, 4), b.pos.y + rng(-4, 4), 1, '#880000', 20); }
  for (let i = s.sparks.length - 1; i >= 0; i--) {
    const p = s.sparks[i];
    p.p.x += p.v.x * adt; p.p.y += p.v.y * adt;
    p.v.x *= 0.94; p.v.y *= 0.94; p.life -= adt;
    if (p.life <= 0) s.sparks.splice(i, 1);
  }
  if (s.sparks.length > 200) s.sparks.splice(0, s.sparks.length - 200);
  for (const bp of s.blood) { bp.age += dt; if (bp.age > 10) bp.opacity = Math.max(0, bp.opacity - dt * 0.03); }
  if (s.blood.length > 120) s.blood.splice(0, s.blood.length - 120);
  s.shake *= 0.82; if (s.shake < 0.001) s.shake = 0;
  s.shakeOff = v(rng(-1, 1) * s.shake * 8, rng(-1, 1) * s.shake * 8);
  s.anns = s.anns.filter(a => s.t - a.time < 3.5);
  const alive = s.bots.filter(b => b.alive);
  if (alive.length <= 1 && !s.over) {
    s.over = true; s.winner = alive[0] || null;
    if (s.winner) emitSparks(s, s.winner.pos.x, s.winner.pos.y, 50, s.winner.color, 200);
  }
  if (s.over) { s.winTimer += dt; if (s.winner?.alive && Math.floor(s.t * 10) % 4 === 0) emitSparks(s, s.winner.pos.x + rng(-20, 20), s.winner.pos.y + rng(-20, 20), 2, s.winner.color, 80); }
}

// ═══════════════════════════════════════════════════════════════
// SVG RENDERER
// ═══════════════════════════════════════════════════════════════
const W = 800;
const H = 700;
const CX = W / 2;
const CY = H / 2 - 20;

function drawBot(b: Bot, s: GameState): string {
  if (!b.alive && b.opacity < 0.06) return '';
  const op = b.alive ? 1 : b.opacity;
  const j = b.joints;
  let svg = `<g opacity="${op.toFixed(2)}">`;

  // Limbs
  for (const [a, bi, t] of LIMBS) {
    svg += `<line x1="${j[a].x.toFixed(1)}" y1="${j[a].y.toFixed(1)}" x2="${j[bi].x.toFixed(1)}" y2="${j[bi].y.toFixed(1)}" stroke="${b.color}" stroke-width="${t.toFixed(1)}" stroke-linecap="round"/>`;
  }

  // Head
  svg += `<circle cx="${j[0].x.toFixed(1)}" cy="${j[0].y.toFixed(1)}" r="5" fill="${b.color}" stroke="${b.colorDim}" stroke-width="0.8"/>`;

  // Eyes (two dots facing direction)
  const ef = b.facing;
  const ecf = Math.cos(ef), esf = Math.sin(ef);
  svg += `<circle cx="${(j[0].x + ecf * 3.5 - esf * 1.5).toFixed(1)}" cy="${(j[0].y + esf * 3.5 + ecf * 1.5).toFixed(1)}" r="1" fill="#fff"/>`;
  svg += `<circle cx="${(j[0].x + ecf * 3.5 + esf * 1.5).toFixed(1)}" cy="${(j[0].y + esf * 3.5 - ecf * 1.5).toFixed(1)}" r="1" fill="#fff"/>`;

  // Weapon
  const hand = j[J.rHd];
  const tip = b.tipPos;
  const isAtk = b.atk && b.atkTimer > 0;
  const wColor = isAtk ? '#ffffff' : '#ccccdd';
  const wWidth = b.weapon.type === 'greatsword' ? 2.5 : b.weapon.type === 'axe' ? 2 : b.weapon.type === 'spear' ? 1.2 : b.weapon.type === 'daggers' ? 1.3 : 1.8;
  svg += `<line x1="${hand.x.toFixed(1)}" y1="${hand.y.toFixed(1)}" x2="${tip.x.toFixed(1)}" y2="${tip.y.toFixed(1)}" stroke="${wColor}" stroke-width="${wWidth}" stroke-linecap="round"/>`;

  // Axe head
  if (b.weapon.type === 'axe') {
    const mid = vlerp(hand, tip, 0.85);
    const perp = vnorm({ x: -(tip.y - hand.y), y: tip.x - hand.x });
    svg += `<polygon points="${(mid.x + perp.x * 5).toFixed(1)},${(mid.y + perp.y * 5).toFixed(1)} ${(mid.x - perp.x * 2).toFixed(1)},${(mid.y - perp.y * 2).toFixed(1)} ${tip.x.toFixed(1)},${tip.y.toFixed(1)}" fill="${wColor}" opacity="0.9"/>`;
  }

  // Spear tip
  if (b.weapon.type === 'spear') {
    const dir = vnorm(vsub(tip, hand));
    const perp = { x: -dir.y, y: dir.x };
    svg += `<polygon points="${(tip.x + dir.x * 6).toFixed(1)},${(tip.y + dir.y * 6).toFixed(1)} ${(tip.x - perp.x * 3).toFixed(1)},${(tip.y - perp.y * 3).toFixed(1)} ${(tip.x + perp.x * 3).toFixed(1)},${(tip.y + perp.y * 3).toFixed(1)}" fill="#ccccdd"/>`;
  }

  // Daggers left hand weapon
  if (b.weapon.type === 'daggers') {
    const lh = j[J.lHd];
    const mir = b.swordAng * -0.65;
    const ltip = { x: lh.x + Math.cos(b.facing + mir + Math.PI) * 16, y: lh.y + Math.sin(b.facing + mir + Math.PI) * 16 };
    svg += `<line x1="${lh.x.toFixed(1)}" y1="${lh.y.toFixed(1)}" x2="${ltip.x.toFixed(1)}" y2="${ltip.y.toFixed(1)}" stroke="${wColor}" stroke-width="1.3" stroke-linecap="round"/>`;
  }

  // Sword trail (attack swing arc)
  if (isAtk) {
    const totalDur = (b.atk?.dur || 0.3) / b.weapon.speed;
    const trailOp = (b.atkTimer / totalDur) * 0.5;
    svg += `<line x1="${hand.x.toFixed(1)}" y1="${hand.y.toFixed(1)}" x2="${tip.x.toFixed(1)}" y2="${tip.y.toFixed(1)}" stroke="${b.color}" stroke-width="${(wWidth + 3).toFixed(1)}" stroke-linecap="round" opacity="${trailOp.toFixed(2)}"/>`;
  }

  // Block shield glow
  if (b.blocking) {
    svg += `<circle cx="${(b.pos.x + Math.cos(b.facing) * 12).toFixed(1)}" cy="${(b.pos.y + Math.sin(b.facing) * 12).toFixed(1)}" r="8" fill="none" stroke="#6688ff" stroke-width="2" opacity="0.5"/>`;
  }

  // Health bar above head
  if (b.alive) {
    const bx = j[0].x - 10, by = j[0].y - 10;
    svg += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="20" height="2.5" fill="#111" rx="1"/>`;
    svg += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${(20 * b.hp / b.maxHp).toFixed(1)}" height="2.5" fill="${b.hp / b.maxHp < 0.3 ? '#ff3333' : b.color}" rx="1"/>`;
    // Stamina
    svg += `<rect x="${bx.toFixed(1)}" y="${(by + 3).toFixed(1)}" width="${(20 * b.stamina / 100).toFixed(1)}" height="1" fill="#4466aa" rx="0.5" opacity="0.6"/>`;
  }

  // Name
  svg += `<text x="${j[0].x.toFixed(1)}" y="${(j[0].y - 14).toFixed(1)}" text-anchor="middle" fill="${b.color}" font-size="5" font-family="monospace" font-weight="bold" opacity="0.7">${b.name}</text>`;

  svg += '</g>';
  return svg;
}

function renderFrame(s: GameState): string {
  let svg = '';

  // Background
  svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="#050510"/>`;

  // Transform group (camera shake + center)
  svg += `<g transform="translate(${(CX + s.shakeOff.x).toFixed(1)},${(CY + s.shakeOff.y).toFixed(1)})">`;

  // Arena floor
  svg += `<circle cx="0" cy="0" r="${ARENA_R}" fill="#0a0a18" stroke="#cc1133" stroke-width="2"/>`;

  // Grid
  for (let i = -ARENA_R; i <= ARENA_R; i += 40) {
    svg += `<line x1="${-ARENA_R}" y1="${i}" x2="${ARENA_R}" y2="${i}" stroke="#151530" stroke-width="0.3"/>`;
    svg += `<line x1="${i}" y1="${-ARENA_R}" x2="${i}" y2="${ARENA_R}" stroke="#151530" stroke-width="0.3"/>`;
  }

  // Center ring
  svg += `<circle cx="0" cy="0" r="25" fill="none" stroke="#221122" stroke-width="1.5" opacity="0.35"/>`;
  // Inner ring
  svg += `<circle cx="0" cy="0" r="${ARENA_R * 0.5}" fill="none" stroke="#1a0a1a" stroke-width="0.8" opacity="0.25"/>`;

  // Blood pools
  for (const bp of s.blood) {
    if (bp.opacity < 0.02) continue;
    const grow = Math.min(1, bp.age * 3);
    svg += `<circle cx="${bp.x.toFixed(1)}" cy="${bp.y.toFixed(1)}" r="${(bp.size * grow).toFixed(1)}" fill="#330000" opacity="${bp.opacity.toFixed(2)}"/>`;
  }

  // Pillars
  for (const p of PILLARS) {
    svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r}" fill="#161628" stroke="#2a1a2a" stroke-width="1.5"/>`;
    svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r * 0.6}" fill="none" stroke="#ff224422" stroke-width="0.5"/>`;
  }

  // Bots (dead first, then alive for z-order)
  for (const b of s.bots) { if (!b.alive) svg += drawBot(b, s); }
  for (const b of s.bots) { if (b.alive) svg += drawBot(b, s); }

  // Sparks
  for (const sp of s.sparks) {
    const t = sp.life / sp.maxLife;
    if (t < 0.05) continue;
    svg += `<circle cx="${sp.p.x.toFixed(1)}" cy="${sp.p.y.toFixed(1)}" r="${(sp.size * t).toFixed(1)}" fill="${sp.color}" opacity="${(t * 0.9).toFixed(2)}"/>`;
  }

  svg += '</g>';
  return svg;
}

// ═══════════════════════════════════════════════════════════════
// REACT COMPONENT
// ═══════════════════════════════════════════════════════════════
const RagdollArena = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const stateRef = useRef<GameState>(mkState(1));
  const rafRef = useRef<number>(0);
  const lastTime = useRef(0);
  const [hudState, setHudState] = useState<GameState>(stateRef.current);
  const frameCount = useRef(0);

  useEffect(() => {
    let running = true;
    const loop = (time: number) => {
      if (!running) return;
      const dt = lastTime.current ? (time - lastTime.current) / 1000 : 1 / 60;
      lastTime.current = time;

      const s = stateRef.current;
      gameTick(s, dt);

      // Auto-restart
      if (s.over && s.winTimer >= 5.5) {
        stateRef.current = mkState(s.round + 1);
        setHudState({ ...stateRef.current });
      }

      // Render SVG
      if (svgRef.current) {
        svgRef.current.innerHTML = renderFrame(s);
      }

      // HUD update throttle
      frameCount.current++;
      if (frameCount.current % 4 === 0) setHudState({ ...s });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  const alive = hudState.bots.filter(b => b.alive).length;
  const sorted = [...hudState.bots].sort((a, b) => b.kills - a.kills || b.dmgDealt - a.dmgDealt);

  return (
    <div className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full max-w-[1400px]"
        style={{ imageRendering: 'auto' }}
      />

      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none select-none" style={{ fontFamily: "'Rajdhani','Orbitron',monospace" }}>
        {/* Top bar */}
        <div className="absolute top-3 left-0 right-0 flex flex-col items-center gap-0.5">
          <div className="text-[9px] tracking-[.5em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>Round {hudState.round}</div>
          <div className={`text-[11px] tracking-[.35em] font-bold ${alive <= 3 ? 'animate-pulse' : ''}`}
            style={{ color: alive <= 3 ? '#ff4466' : 'rgba(255,255,255,0.18)' }}>
            {alive} REMAINING
          </div>
        </div>

        {/* Kill feed */}
        <div className="absolute top-14 right-4 flex flex-col gap-1 items-end max-w-[280px]">
          {hudState.anns.map((a, i) => {
            const age = hudState.t - a.time;
            const op = age < 0.25 ? age / 0.25 : age > 2.8 ? (3.5 - age) / 0.7 : 1;
            return (
              <div key={`${a.text}-${i}`}
                className={`${a.big ? 'text-lg font-black tracking-widest' : 'text-[10px] font-semibold tracking-wider'}`}
                style={{
                  color: a.color, opacity: Math.max(0, op),
                  textShadow: `0 0 8px ${a.color}44`,
                  transform: a.big && age < 0.3 ? `scale(${1 + (0.3 - age) * 3})` : 'none',
                }}>
                {a.text}
              </div>
            );
          })}
        </div>

        {/* Health bars */}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex gap-[2px]">
          {hudState.bots.map(b => (
            <div key={b.id} className={`flex-1 relative h-7 rounded-sm overflow-hidden ${b.alive ? '' : 'opacity-15'}`}
              style={{ border: `1px solid ${b.alive ? b.color + '55' : '#1a1a1a'}` }}>
              <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} />
              {b.alive && (
                <div className="absolute inset-y-0 left-0 transition-all duration-150"
                  style={{ width: `${(b.hp / b.maxHp) * 100}%`, background: `linear-gradient(180deg, ${b.color}bb, ${b.color}44)` }} />
              )}
              {b.alive && (
                <div className="absolute bottom-0 left-0 h-[2px] transition-all duration-75"
                  style={{ width: `${b.stamina}%`, background: '#6688cc' }} />
              )}
              <div className="absolute inset-0 flex items-center justify-between px-0.5">
                <span className="text-[6px] font-bold truncate drop-shadow-lg" style={{ color: 'rgba(255,255,255,0.75)' }}>{b.name}</span>
                {b.kills > 0 && <span className="text-[6px] font-bold" style={{ color: '#ffcc33' }}>{b.kills}K</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Slow-mo */}
        {hudState.slowMo < 0.4 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-3xl font-black tracking-[0.8em] animate-pulse" style={{ color: 'rgba(255,255,255,0.06)' }}>SLOW MOTION</div>
          </div>
        )}

        {/* Winner */}
        {hudState.over && hudState.winner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(0,0,0,0.88)' }}>
            <div className="text-5xl font-black tracking-[.25em] mb-2"
              style={{ color: hudState.winner.color, textShadow: `0 0 25px ${hudState.winner.color}, 0 0 50px ${hudState.winner.color}44` }}>
              CHAMPION
            </div>
            <div className="text-3xl font-bold mb-5" style={{ color: hudState.winner.color }}>{hudState.winner.name}</div>
            <div className="text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{hudState.winner.weapon.name} • {hudState.winner.style.toUpperCase()}</div>
            <div className="flex gap-5 text-xs mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <span>⚔ {hudState.winner.kills} Kills</span>
              <span>💀 {Math.round(hudState.winner.dmgDealt)} DMG</span>
              <span>❤ {Math.round(hudState.winner.hp)} HP</span>
            </div>
            <div className="text-[10px] tracking-[.3em] mb-2" style={{ color: 'rgba(255,255,255,0.22)' }}>LEADERBOARD</div>
            <div className="flex flex-col gap-0.5 items-center">
              {sorted.slice(0, 5).map((r, i) => (
                <div key={r.id} className="flex gap-3 text-[10px] items-center"
                  style={{ color: r.id === hudState.winner!.id ? hudState.winner!.color : 'rgba(255,255,255,0.3)' }}>
                  <span className="w-3 text-right font-bold">{i + 1}.</span>
                  <span className="w-16 font-bold">{r.name}</span>
                  <span className="w-14 text-right">{r.kills}K / {Math.round(r.dmgDealt)}D</span>
                </div>
              ))}
            </div>
            <div className="mt-6 text-xs animate-pulse" style={{ color: 'rgba(255,255,255,0.18)' }}>
              Next round in {Math.max(1, Math.ceil(5.5 - hudState.winTimer))}...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RagdollArena;
