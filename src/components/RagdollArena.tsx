import { useEffect, useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════
// MATH
// ═══════════════════════════════════════════════════════
const W = 1280, H = 720, GY = 575, GRAV = 0.4;
const WALL_L = 50, WALL_R = W - 50;
interface V { x: number; y: number }
const v = (x = 0, y = 0): V => ({ x, y });
const vadd = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
const vsub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
const vscl = (a: V, s: number): V => ({ x: a.x * s, y: a.y * s });
const vlen = (a: V) => Math.sqrt(a.x * a.x + a.y * a.y);
const vnorm = (a: V): V => { const l = vlen(a) || 1; return { x: a.x / l, y: a.y / l }; };
const vlerp = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const clamp = (v2: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v2));
const rng = (mn: number, mx: number) => mn + Math.random() * (mx - mn);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ═══════════════════════════════════════════════════════
// RAGDOLL SYSTEM
// ═══════════════════════════════════════════════════════
interface RPoint { pos: V; old: V; acc: V; mass: number; pinned: boolean }
interface RStick { a: number; b: number; len: number; stiff: number }

function createRagdoll(x: number, y: number) {
  const S = 1.35;
  const offsets: V[] = [
    v(0, -108*S), v(0, -93*S), v(0, -72*S), v(0, -52*S), v(0, -36*S),
    v(-15*S, -86*S), v(-28*S, -64*S), v(-35*S, -46*S),
    v(15*S, -86*S), v(28*S, -64*S), v(35*S, -46*S),
    v(-9*S, -33*S), v(-11*S, -16*S), v(-9*S, -1),
    v(9*S, -33*S), v(11*S, -16*S), v(9*S, -1),
  ];
  const pts: RPoint[] = offsets.map(o => ({
    pos: v(x + o.x, y + o.y), old: v(x + o.x, y + o.y),
    acc: v(0, 0), mass: 1, pinned: false,
  }));
  pts[0].mass = 0.8; pts[13].mass = 1.5; pts[16].mass = 1.5;

  const sticks: RStick[] = [
    { a: 0, b: 1, len: 15, stiff: 1 }, { a: 1, b: 2, len: 21, stiff: 1 },
    { a: 2, b: 3, len: 20, stiff: 0.9 }, { a: 3, b: 4, len: 16, stiff: 0.9 },
    { a: 1, b: 5, len: 16, stiff: 0.8 }, { a: 5, b: 6, len: 26, stiff: 0.7 }, { a: 6, b: 7, len: 20, stiff: 0.6 },
    { a: 1, b: 8, len: 16, stiff: 0.8 }, { a: 8, b: 9, len: 26, stiff: 0.7 }, { a: 9, b: 10, len: 20, stiff: 0.6 },
    { a: 4, b: 11, len: 10, stiff: 0.9 }, { a: 11, b: 12, len: 18, stiff: 0.85 }, { a: 12, b: 13, len: 16, stiff: 0.85 },
    { a: 4, b: 14, len: 10, stiff: 0.9 }, { a: 14, b: 15, len: 18, stiff: 0.85 }, { a: 15, b: 16, len: 16, stiff: 0.85 },
    { a: 2, b: 5, len: 20, stiff: 0.5 }, { a: 2, b: 8, len: 20, stiff: 0.5 },
    { a: 4, b: 11, len: 10, stiff: 0.5 }, { a: 4, b: 14, len: 10, stiff: 0.5 },
    { a: 0, b: 2, len: 36, stiff: 0.4 }, { a: 11, b: 14, len: 18, stiff: 0.4 }, { a: 5, b: 8, len: 30, stiff: 0.4 },
  ];
  return { pts, sticks };
}

function stepRagdoll(pts: RPoint[], sticks: RStick[], dt: number, bounce: number) {
  for (const p of pts) {
    if (p.pinned) continue;
    const vel = vsub(p.pos, p.old);
    p.old = { ...p.pos };
    p.pos = vadd(p.pos, vadd(vscl(vel, 0.97), vscl(p.acc, dt * dt)));
    p.acc = v(0, GRAV * p.mass);
    if (p.pos.y > GY) { p.pos.y = GY; if (vel.y > 0) p.old.y = p.pos.y + vel.y * bounce; p.old.x = p.pos.x - vel.x * 0.7; }
    p.pos.x = clamp(p.pos.x, 30, W - 30);
  }
  for (let iter = 0; iter < 6; iter++) {
    for (const s of sticks) {
      const a = pts[s.a], b = pts[s.b];
      const delta = vsub(b.pos, a.pos);
      const dist = vlen(delta) || 0.01;
      const diff = (s.len - dist) / dist * s.stiff;
      const offset = vscl(delta, diff * 0.5);
      if (!a.pinned) a.pos = vsub(a.pos, offset);
      if (!b.pinned) b.pos = vadd(b.pos, offset);
    }
    for (const p of pts) { if (p.pos.y > GY) p.pos.y = GY; }
  }
}

// ═══════════════════════════════════════════════════════
// FIGHTER
// ═══════════════════════════════════════════════════════
type FState = 'idle' | 'walk' | 'walkBack' | 'jump' | 'crouch' | 'slash' | 'heavySlash' | 'stab' | 'overhead' | 'jumpAtk' | 'uppercut' | 'spinSlash' | 'dashStab' | 'limbSmash' | 'backflipKick' | 'execution' | 'shoot' | 'wallRun' | 'wallJump' | 'wallFlip' | 'divekick' | 'block' | 'hit' | 'stagger' | 'ko' | 'ragdoll' | 'dodge' | 'taunt' | 'pickup';

interface Weapon {
  name: string; len: number; weight: number;
  slashDmg: number; stabDmg: number; heavyDmg: number;
  speed: number; color: string; blade: string;
  type: 'sword' | 'axe' | 'spear' | 'greatsword';
}

const WEAPONS: Record<string, Weapon> = {
  longsword:  { name: 'Longsword',  len: 70,  weight: 1,   slashDmg: 12, stabDmg: 9,  heavyDmg: 20, speed: 1.3, color: '#888', blade: '#ccd', type: 'sword' },
  greatsword: { name: 'Greatsword', len: 95,  weight: 1.8, slashDmg: 16, stabDmg: 11, heavyDmg: 30, speed: 0.8, color: '#777', blade: '#aab', type: 'greatsword' },
  axe:        { name: 'Battle Axe', len: 65,  weight: 1.5, slashDmg: 14, stabDmg: 7,  heavyDmg: 28, speed: 0.9, color: '#654', blade: '#999', type: 'axe' },
  spear:      { name: 'Spear',      len: 110, weight: 0.8, slashDmg: 7,  stabDmg: 16, heavyDmg: 14, speed: 1.4, color: '#876', blade: '#bbc', type: 'spear' },
};

interface AtkDef { frames: number; hitStart: number; hitEnd: number; dmgKey: 'slashDmg' | 'stabDmg' | 'heavyDmg'; kb: V; stCost: number; canSever: boolean }
const ATK: Record<string, AtkDef> = {
  slash:      { frames: 18, hitStart: 5,  hitEnd: 11, dmgKey: 'slashDmg', kb: v(5, -1),   stCost: 8,  canSever: true },
  heavySlash: { frames: 32, hitStart: 12, hitEnd: 22, dmgKey: 'heavyDmg', kb: v(12, -6),  stCost: 18, canSever: true },
  stab:       { frames: 14, hitStart: 5,  hitEnd: 10, dmgKey: 'stabDmg',  kb: v(4, 0),    stCost: 6,  canSever: false },
  overhead:   { frames: 30, hitStart: 14, hitEnd: 22, dmgKey: 'heavyDmg', kb: v(8, -10),  stCost: 16, canSever: true },
  jumpAtk:    { frames: 22, hitStart: 6,  hitEnd: 16, dmgKey: 'heavyDmg', kb: v(8, -8),   stCost: 14, canSever: true },
  uppercut:   { frames: 20, hitStart: 6,  hitEnd: 14, dmgKey: 'slashDmg', kb: v(3, -16),  stCost: 12, canSever: true },
  spinSlash:  { frames: 24, hitStart: 6,  hitEnd: 18, dmgKey: 'heavyDmg', kb: v(10, -4),  stCost: 15, canSever: true },
  dashStab:   { frames: 16, hitStart: 4,  hitEnd: 12, dmgKey: 'stabDmg',  kb: v(14, -2),  stCost: 10, canSever: false },
  limbSmash:    { frames: 26, hitStart: 8,  hitEnd: 18, dmgKey: 'heavyDmg', kb: v(14, -12), stCost: 14, canSever: true },
  backflipKick: { frames: 28, hitStart: 8,  hitEnd: 20, dmgKey: 'heavyDmg', kb: v(8, -18),  stCost: 16, canSever: true },
  execution:    { frames: 50, hitStart: 15, hitEnd: 40, dmgKey: 'heavyDmg', kb: v(4, -4),   stCost: 20, canSever: true },
  shoot:        { frames: 10, hitStart: 3,  hitEnd: 4,  dmgKey: 'stabDmg',  kb: v(6, -2),   stCost: 4,  canSever: false },
  wallFlip:     { frames: 24, hitStart: 6,  hitEnd: 18, dmgKey: 'heavyDmg', kb: v(12, -14), stCost: 14, canSever: true },
  divekick:     { frames: 20, hitStart: 4,  hitEnd: 16, dmgKey: 'heavyDmg', kb: v(10, 8),   stCost: 12, canSever: true },
};

interface Blood { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; sz: number; grounded: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string; sz: number }
interface Pool { x: number; y: number; r: number; a: number }
interface SevLimb { pts: V[]; vel: V; angV: number; ang: number; color: string; w: number; life: number; isHead: boolean; grounded: boolean; id: number }
interface GoreChunk { x: number; y: number; vx: number; vy: number; sz: number; life: number; rot: number; rotV: number; color: string }
interface Afterimage { x: number; y: number; pts: V[]; alpha: number; color: string }
interface ImpactRing { x: number; y: number; r: number; maxR: number; life: number; color: string }
interface Lightning { x1: number; y1: number; x2: number; y2: number; life: number; branches: V[][] }
interface Bullet { x: number; y: number; vx: number; vy: number; life: number; owner: number; dmg: number; trail: V[] }
interface MuzzleFlash { x: number; y: number; ang: number; life: number }
interface WallSpark { x: number; y: number; vx: number; vy: number; life: number }

let limbIdCounter = 0;

interface Fighter {
  x: number; y: number; vx: number; vy: number;
  hp: number; stamina: number;
  state: FState; frame: number; dur: number;
  facing: 1 | -1; grounded: boolean;
  weapon: Weapon;
  combo: number; comboTimer: number;
  name: string; color: string; skin: string; hair: string;
  isAI: boolean; wins: number;
  aiTimer: number;
  walkCycle: number; bob: number;
  rag: { pts: RPoint[]; sticks: RStick[] };
  ragdolling: boolean; ragTimer: number;
  severed: Set<string>; bleedTimer: number;
  wAngle: number; wTarget: number; hitDealt: boolean;
  hitDir: V; hitImpact: number;
  dodgeCool: number;
  heldLimb: SevLimb | null;
  limbSwingAng: number;
  wallRunTimer: number;
  wallSide: -1 | 0 | 1;
  gunCooldown: number;
  muzzleFlash: number;
}

function mkFighter(x: number, name: string, color: string, skin: string, hair: string, wKey: string, isAI: boolean): Fighter {
  return {
    x, y: GY, vx: 0, vy: 0, hp: 100, stamina: 100,
    state: 'idle', frame: 0, dur: 0, facing: 1, grounded: true,
    weapon: WEAPONS[wKey], combo: 0, comboTimer: 0,
    name, color, skin, hair, isAI, wins: 0, aiTimer: 0,
    walkCycle: 0, bob: Math.random() * 6.28,
    rag: createRagdoll(x, GY), ragdolling: false, ragTimer: 0,
    severed: new Set(), bleedTimer: 0,
    wAngle: -0.5, wTarget: -0.5, hitDealt: false,
    hitDir: v(), hitImpact: 0, dodgeCool: 0,
    heldLimb: null, limbSwingAng: 0,
    wallRunTimer: 0, wallSide: 0, gunCooldown: 0, muzzleFlash: 0,
  };
}

function poseRagdoll(f: Fighter) {
  const r = f.rag;
  const s = f.facing;
  const S = 1.35;
  const bob2 = f.state === 'idle' ? Math.sin(f.bob) * 2 : 0;
  const co = f.state === 'crouch' ? 15 : 0;
  const wk = f.state === 'walk' || f.state === 'walkBack' ? f.walkCycle : 0;
  const ap = f.dur > 0 ? f.frame / f.dur : 0;
  const jmp = !f.grounded ? -10 : 0;
  const legSwing = Math.sin(wk) * 12 * S;
  const legBend = Math.abs(Math.sin(wk)) * 6 * S;

  const lHipX = -9 * s * S, rHipX = 9 * s * S;
  const hipY = -33 * S + jmp;
  const footY = -1;
  const lFootX = (lHipX - legSwing * 0.8 * s);
  const rFootX = (rHipX + legSwing * 0.8 * s);
  const lKneeX = (lHipX + lFootX) / 2 + s * 4 * S;
  const lKneeY = (hipY + footY) / 2 - legBend - 4 * S;
  const rKneeX = (rHipX + rFootX) / 2 + s * 4 * S;
  const rKneeY = (hipY + footY) / 2 - legBend - 4 * S;

  const targets: V[] = [
    v(0, -108 * S + bob2 + co + jmp), v(0, -93 * S + bob2 + co + jmp),
    v(0, -72 * S + bob2 + co + jmp), v(0, -52 * S + co + jmp), v(0, hipY),
    v(-15 * s * S, -86 * S + bob2 + co + jmp), v(-28 * s * S, -64 * S + bob2 + co + jmp), v(-35 * s * S, -46 * S + bob2 + co + jmp),
    v(15 * s * S, -86 * S + bob2 + co + jmp), v(28 * s * S, -64 * S + bob2 + co + jmp), v(35 * s * S, -46 * S + bob2 + co + jmp),
    v(lHipX, hipY), v(lKneeX, lKneeY + jmp), v(lFootX, footY),
    v(rHipX, hipY), v(rKneeX, rKneeY + jmp), v(rFootX, footY),
  ];

  if (f.hitImpact > 0) {
    const hd = f.hitDir; const imp = f.hitImpact;
    for (let i = 0; i < 11; i++) targets[i] = vadd(targets[i], vscl(hd, imp * (1 - i * 0.06)));
  }

  if (f.state === 'dodge') {
    const roll = ap * Math.PI * 2;
    for (let i = 0; i < targets.length; i++) { targets[i].y += Math.sin(roll) * 20; targets[i].x += Math.cos(roll) * 5 * s; }
  }

  // Wall run pose: body against wall, legs running upward
  if (f.state === 'wallRun') {
    const ws = f.wallSide; // -1 = left wall, 1 = right wall
    const runCycle = f.walkCycle * 2;
    const legA = Math.sin(runCycle) * 25;
    const legB = Math.cos(runCycle) * 25;
    // Lean body toward wall
    for (let i = 0; i < 5; i++) targets[i].x += ws * 15;
    // Arms reach out
    targets[6] = v((-28 - 10) * s * S, (-64 - 20) * S);
    targets[7] = v((-35 - 15) * s * S, (-46 - 25) * S);
    targets[9] = v((28 + 10) * s * S, (-64 - 20) * S);
    targets[10] = v((35 + 15) * s * S, (-46 - 25) * S);
    // Legs run vertically
    targets[12] = v(lKneeX + ws * 8, -20 + legA);
    targets[13] = v(lFootX + ws * 12, -5 + legA * 1.5);
    targets[15] = v(rKneeX + ws * 8, -20 + legB);
    targets[16] = v(rFootX + ws * 12, -5 + legB * 1.5);
  }

  // Wall flip: spectacular aerial flip off the wall
  if (f.state === 'wallFlip') {
    const flipAng = ap * Math.PI * 2.5;
    const flipH = Math.sin(ap * Math.PI) * 100;
    const flipX = f.facing * ap * 80;
    for (let i = 0; i < targets.length; i++) {
      const cx = 0, cy = -60 * S;
      const dx2 = targets[i].x - cx, dy2 = targets[i].y - cy;
      targets[i].x = cx + dx2 * Math.cos(flipAng) - dy2 * Math.sin(flipAng) + flipX;
      targets[i].y = cy + dx2 * Math.sin(flipAng) + dy2 * Math.cos(flipAng) - flipH;
    }
    // Extend legs for kick at peak
    if (ap > 0.25 && ap < 0.65) {
      targets[16] = v(f.facing * 60 * S, -90 * S - flipH * 0.5);
      targets[15] = v(f.facing * 40 * S, -70 * S - flipH * 0.5);
    }
  }

  // Divekick: plummet down at angle with extended leg
  if (f.state === 'divekick') {
    const diveAng = ap * Math.PI * 0.5;
    // Tuck body
    for (let i = 0; i < 5; i++) {
      targets[i].x += f.facing * 20 * ap;
      targets[i].y -= 10;
    }
    // Extend lead leg downward-forward
    targets[15] = v(f.facing * 50 * S, 10 + 30 * ap);
    targets[16] = v(f.facing * 65 * S, 20 + 40 * ap);
    // Tuck other leg
    targets[12] = v(-f.facing * 5 * S, -40 * S);
    targets[13] = v(-f.facing * 10 * S, -25 * S);
    // Arms back
    targets[6] = v(-f.facing * 30 * S, (-64 - 10 * Math.sin(diveAng)) * S);
    targets[9] = v(f.facing * 10 * S, (-64 + 5 * Math.sin(diveAng)) * S);
  }

  // Shoot pose: aim pistol with left hand
  if (f.state === 'shoot') {
    // Left arm extends to aim
    targets[6] = v((-28 + 25 * s) * S, (-70) * S + bob2);
    targets[7] = v((-35 + 55 * s) * S, (-65) * S + bob2);
    // Recoil effect
    if (ap > 0.2 && ap < 0.5) {
      targets[7] = vadd(targets[7], v(-s * 8, -5));
    }
  }

  if (['slash', 'heavySlash', 'stab', 'overhead', 'jumpAtk', 'uppercut', 'spinSlash', 'dashStab', 'limbSmash', 'backflipKick', 'execution'].includes(f.state)) {
    const reach = ap < 0.3 ? -15 : ap < 0.6 ? 28 : 10;
    const lift = ap < 0.3 ? -25 : ap < 0.6 ? 5 : -5;
    targets[9] = v((28 + reach) * s * S, (-64 + lift) * S + bob2 + co + jmp);
    targets[10] = v((35 + reach * 1.3) * s * S, (-46 + lift) * S + bob2 + co + jmp);
    if (f.state === 'uppercut') {
      const uLift = ap < 0.25 ? 0 : ap < 0.5 ? -30 : -15;
      targets[9] = v((20 + reach * 0.6) * s * S, (-74 + uLift) * S + bob2 + jmp);
      targets[10] = v((25 + reach * 0.8) * s * S, (-56 + uLift) * S + bob2 + jmp);
    }
    if (f.state === 'spinSlash') {
      const spinAng = ap * Math.PI * 2;
      const sx2 = Math.cos(spinAng) * 30, sy2 = Math.sin(spinAng) * 15;
      targets[9] = v((28 + sx2) * s * S, (-64 + sy2) * S + bob2 + jmp);
      targets[10] = v((35 + sx2 * 1.2) * s * S, (-46 + sy2) * S + bob2 + jmp);
    }
    if (f.state === 'dashStab') {
      targets[9] = v((30 + reach * 1.5) * s * S, -70 * S + bob2 + jmp);
      targets[10] = v((40 + reach * 1.8) * s * S, -62 * S + bob2 + jmp);
    }
    if (f.state === 'limbSmash' && f.heldLimb) {
      const limbReach = ap < 0.25 ? -20 : ap < 0.55 ? 35 : 5;
      const limbLift = ap < 0.25 ? -35 : ap < 0.55 ? 10 : -10;
      targets[6] = v((-28 + limbReach) * s * S, (-64 + limbLift) * S + bob2 + co + jmp);
      targets[7] = v((-35 + limbReach * 1.3) * s * S, (-46 + limbLift) * S + bob2 + co + jmp);
    }
    if (f.state === 'backflipKick') {
      const flipAng = ap * Math.PI * 2;
      const flipH = Math.sin(flipAng) * 70;
      const flipX = -Math.cos(flipAng) * 25 * s;
      for (let i = 0; i < targets.length; i++) {
        const cx = 0, cy = -60 * S;
        const dx2 = targets[i].x - cx, dy2 = targets[i].y - cy;
        targets[i].x = cx + dx2 * Math.cos(flipAng) - dy2 * Math.sin(flipAng) + flipX;
        targets[i].y = cy + dx2 * Math.sin(flipAng) + dy2 * Math.cos(flipAng) + flipH - 50;
      }
      if (ap > 0.3 && ap < 0.7) {
        targets[16] = v(s * 55 * S, -90 * S + flipH);
        targets[15] = v(s * 35 * S, -70 * S + flipH);
      }
    }
    if (f.state === 'execution') {
      const subAp = (ap * 5) % 1;
      const slamDown = subAp < 0.4 ? -40 + subAp * 100 : subAp < 0.6 ? 0 : -20;
      targets[9] = v(30 * s * S, (-50 + slamDown) * S);
      targets[10] = v(40 * s * S, (-35 + slamDown) * S);
      const bodyBob = Math.sin(subAp * Math.PI) * 15;
      for (let i = 0; i < 5; i++) targets[i].y += bodyBob;
    }
  }

  if (f.state === 'pickup') {
    targets[6] = v(-10 * s, -20 + bob2); targets[7] = v(-5 * s, 0);
    targets[9] = v(10 * s, -20 + bob2); targets[10] = v(5 * s, 0);
    targets[0] = v(0, -85 + bob2 + co);
  }

  if (f.state === 'block') {
    targets[9] = v(18 * s, -80 + bob2 + co); targets[10] = v(22 * s, -62 + bob2 + co);
    targets[6] = v(-8 * s, -74 + bob2 + co); targets[7] = v(-3 * s, -58 + bob2 + co);
  }

  if (f.state === 'taunt') {
    targets[9] = v(20 * s, -90 + bob2); targets[10] = v(25 * s, -100 + bob2);
    targets[6] = v(-20 * s, -90 + bob2); targets[7] = v(-25 * s, -100 + bob2);
  }

  for (let i = 0; i < targets.length; i++) {
    if (f.y + targets[i].y > GY) targets[i].y = GY - f.y;
  }

  const blend = f.ragdolling ? 0 : 0.45;
  for (let i = 0; i < r.pts.length && i < targets.length; i++) {
    const target = vadd(v(f.x, f.y), targets[i]);
    const b = (i >= 11) ? Math.min(blend * 1.4, 0.6) : blend;
    r.pts[i].pos = vlerp(r.pts[i].pos, target, b);
    if (!f.ragdolling) r.pts[i].old = vlerp(r.pts[i].old, target, b * 0.85);
  }
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const RagdollArena = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const G = useRef({
    fighters: [
      mkFighter(350, 'SIEGFRIED', '#8B0000', '#e8b878', '#2a1a0a', 'greatsword', true),
      mkFighter(930, 'NIGHTMARE', '#1a1a4a', '#c4956a', '#111', 'axe', true),
    ],
    blood: [] as Blood[],
    sparks: [] as Spark[],
    pools: [] as Pool[],
    limbs: [] as SevLimb[],
    gore: [] as GoreChunk[],
    afterimages: [] as Afterimage[],
    rings: [] as ImpactRing[],
    lightnings: [] as Lightning[],
    bullets: [] as Bullet[],
    muzzleFlashes: [] as MuzzleFlash[],
    wallSparks: [] as WallSpark[],
    slowMo: 1, slowTimer: 0,
    flash: 0, flashColor: '#fff',
    round: 1, timer: 99 * 60,
    rs: 'intro' as 'intro' | 'fight' | 'ko',
    introTimer: 100, koTimer: 0,
    keys: new Set<string>(),
    bgTime: 0,
    clouds: Array.from({ length: 8 }, () => ({ x: rng(0, W), y: rng(20, 200), w: rng(60, 200), speed: rng(0.1, 0.5), opacity: rng(0.02, 0.08) })),
    torches: [{ x: 505, y: GY - 55 }, { x: 775, y: GY - 55 }, { x: 90, y: GY - 45 }, { x: 1190, y: GY - 45 }],
  });
  const [hud, setHud] = useState({
    p1hp: 100, p2hp: 100, timer: 99, round: 1,
    p1st: 100, p2st: 100, p1w: 0, p2w: 0,
    rs: 'intro', n1: 'SIEGFRIED', n2: 'NIGHTMARE',
    w1: 'Greatsword', w2: 'Battle Axe',
    p1limb: false, p2limb: false,
  });

  const spawnBlood = useCallback((x: number, y: number, dir: number, count: number, power: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.blood.push({
        x: x + rng(-8, 8), y: y - rng(0, 10),
        vx: dir * (2 + rng(0, power * 7)) + rng(-1, 1) * power * 4,
        vy: -(2 + rng(0, power * 8)) + rng(0, 3),
        life: 140 + rng(0, 180), maxLife: 320, sz: 1.5 + rng(0, 4.5) * power, grounded: false,
      });
    }
  }, []);

  const spawnGore = useCallback((x: number, y: number, count: number, dir: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.gore.push({
        x, y, vx: dir * rng(2, 10) + rng(-3, 3), vy: -rng(4, 14),
        sz: rng(2, 8), life: 200 + rng(0, 200), rot: rng(0, 6.28), rotV: rng(-0.3, 0.3),
        color: pick(['#600', '#800', '#500', '#711', '#400', '#900', '#520']),
      });
    }
  }, []);

  const spawnSparks = useCallback((x: number, y: number, count: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.sparks.push({
        x, y, vx: rng(-8, 8) * 2, vy: -(2 + rng(0, 12)),
        life: 8 + rng(0, 14), color: pick(['#ffa', '#ff8', '#ffd', '#fa0', '#f80']), sz: 1 + rng(0, 3),
      });
    }
  }, []);

  const spawnRing = useCallback((x: number, y: number, maxR: number, color: string) => {
    G.current.rings.push({ x, y, r: 5, maxR, life: 1, color });
  }, []);

  const spawnLightning = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const branches: V[][] = [];
    for (let b = 0; b < 3; b++) {
      const pts: V[] = [v(x1, y1)];
      const steps = 5 + Math.floor(rng(0, 5));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        pts.push(v(x1 + (x2 - x1) * t + rng(-30, 30), y1 + (y2 - y1) * t + rng(-20, 20)));
      }
      branches.push(pts);
    }
    G.current.lightnings.push({ x1, y1, x2, y2, life: 8, branches });
  }, []);

  const spawnAfterimage = useCallback((f: Fighter) => {
    const pts = f.rag.pts.map(p => ({ ...p.pos }));
    G.current.afterimages.push({ x: f.x, y: f.y, pts, alpha: 0.4, color: f.color });
  }, []);

  const spawnBullet = useCallback((f: Fighter, idx: number) => {
    const g = G.current;
    const hand = f.rag.pts[7].pos;
    const ang = Math.atan2(g.fighters[1 - idx].y - 60 - hand.y, g.fighters[1 - idx].x - hand.x) + rng(-0.1, 0.1);
    const speed = 22;
    g.bullets.push({
      x: hand.x, y: hand.y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      life: 40, owner: idx, dmg: 8 + rng(0, 5),
      trail: [{ x: hand.x, y: hand.y }],
    });
    g.muzzleFlashes.push({ x: hand.x + Math.cos(ang) * 15, y: hand.y + Math.sin(ang) * 15, ang, life: 4 });
    // Muzzle sparks
    for (let i = 0; i < 6; i++) {
      g.sparks.push({
        x: hand.x, y: hand.y,
        vx: Math.cos(ang + rng(-0.5, 0.5)) * rng(3, 10),
        vy: Math.sin(ang + rng(-0.5, 0.5)) * rng(3, 10),
        life: 5 + rng(0, 8), color: pick(['#ff8', '#ffa', '#fa0']), sz: 1 + rng(0, 2),
      });
    }
    f.muzzleFlash = 4;
  }, []);

  const spawnWallSparks = useCallback((x: number, y: number, count: number, dir: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.wallSparks.push({
        x, y: y + rng(-10, 10),
        vx: dir * rng(2, 8), vy: rng(-4, 2),
        life: 8 + rng(0, 10),
      });
    }
  }, []);

  const sever = useCallback((f: Fighter, part: string, dir: number) => {
    if (f.severed.has(part)) return;
    f.severed.add(part);
    const g = G.current;
    const pts: V[] = [];
    const indices = part === 'leftArm' ? [5, 6, 7] : part === 'rightArm' ? [8, 9, 10] :
      part === 'leftLeg' ? [11, 12, 13] : part === 'rightLeg' ? [14, 15, 16] : [0];
    indices.forEach(i => { if (f.rag.pts[i]) pts.push({ ...f.rag.pts[i].pos }); });
    g.limbs.push({
      pts, vel: v(dir * (6 + rng(0, 14)), -(10 + rng(0, 14))),
      angV: rng(-0.6, 0.6), ang: 0,
      color: part === 'head' ? f.skin : f.color,
      w: part.includes('Leg') ? 7 : part === 'head' ? 14 : 5,
      life: 1200, isHead: part === 'head', grounded: false, id: limbIdCounter++,
    });
    spawnBlood(f.x, f.y - 60, dir, 90, 5);
    spawnBlood(f.x, f.y - 70, -dir * 0.5, 45, 4.5);
    spawnBlood(f.x, f.y - 65, 0, 35, 4);
    spawnGore(f.x, f.y - 55, 12, dir);
    spawnRing(f.x, f.y - 50, 80, '#a00');
    f.bleedTimer = 600;
    // NO screen shake - just slow-mo and flash for dismemberments
    g.slowMo = 0.1; g.slowTimer = 40;
    g.flash = 8; g.flashColor = '#600';
  }, [spawnBlood, spawnGore, spawnRing]);

  // ─── DRAW FIGHTER ──────────────────────────────────────
  const drawFighter = useCallback((ctx: CanvasRenderingContext2D, f: Fighter, t: number) => {
    const p = f.rag.pts;

    const drawBone = (a: number, b: number, w: number, col: string) => {
      if (f.severed.has('leftArm') && [5, 6, 7].includes(a) && [5, 6, 7].includes(b)) return;
      if (f.severed.has('rightArm') && [8, 9, 10].includes(a) && [8, 9, 10].includes(b)) return;
      if (f.severed.has('leftLeg') && [11, 12, 13].includes(a) && [11, 12, 13].includes(b)) return;
      if (f.severed.has('rightLeg') && [14, 15, 16].includes(a) && [14, 15, 16].includes(b)) return;
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p[a].pos.x, p[a].pos.y); ctx.lineTo(p[b].pos.x, p[b].pos.y); ctx.stroke();
    };

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(p[4].pos.x, GY + 2, 30, 7, 0, 0, Math.PI * 2); ctx.fill();

    // Wall run dust
    if (f.state === 'wallRun') {
      const wallX = f.wallSide < 0 ? WALL_L : WALL_R;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(150,130,100,${0.15 + rng(0, 0.1)})`;
        ctx.beginPath(); ctx.arc(wallX + f.wallSide * rng(-5, 15), f.y + rng(-20, 10), rng(2, 6), 0, Math.PI * 2); ctx.fill();
      }
    }

    // Legs
    drawBone(4, 11, 8, f.color); drawBone(11, 12, 7, f.color); drawBone(12, 13, 6, f.color);
    drawBone(4, 14, 8, f.color); drawBone(14, 15, 7, f.color); drawBone(15, 16, 6, f.color);
    if (!f.severed.has('leftLeg')) { ctx.fillStyle = '#333'; ctx.beginPath(); ctx.ellipse(p[13].pos.x + 4, Math.min(p[13].pos.y, GY), 8, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    if (!f.severed.has('rightLeg')) { ctx.fillStyle = '#333'; ctx.beginPath(); ctx.ellipse(p[16].pos.x + 4, Math.min(p[16].pos.y, GY), 8, 4, 0, 0, Math.PI * 2); ctx.fill(); }

    // Torso
    drawBone(1, 2, 12, f.color); drawBone(2, 3, 11, f.color); drawBone(3, 4, 10, f.color);
    const chestMid = vlerp(p[2].pos, p[3].pos, 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p[2].pos.x - 6, p[2].pos.y); ctx.lineTo(p[4].pos.x + 6, p[4].pos.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(chestMid.x - 8, chestMid.y); ctx.lineTo(chestMid.x + 8, chestMid.y); ctx.stroke();

    // Shoulders & Arms
    drawBone(1, 5, 7, f.color); drawBone(1, 8, 7, f.color);
    drawBone(5, 6, 6, f.skin); drawBone(6, 7, 5, f.skin);
    drawBone(8, 9, 6, f.skin); drawBone(9, 10, 5, f.skin);
    if (!f.severed.has('leftArm')) { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(p[7].pos.x, p[7].pos.y, 4, 0, Math.PI * 2); ctx.fill(); }
    if (!f.severed.has('rightArm')) { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(p[10].pos.x, p[10].pos.y, 4, 0, Math.PI * 2); ctx.fill(); }

    // Sever stumps
    ['leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'head'].forEach(part => {
      if (!f.severed.has(part)) return;
      const idx = part === 'leftArm' ? 5 : part === 'rightArm' ? 8 : part === 'leftLeg' ? 11 : part === 'rightLeg' ? 14 : 1;
      ctx.fillStyle = '#900'; ctx.beginPath(); ctx.arc(p[idx].pos.x, p[idx].pos.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#600'; ctx.beginPath(); ctx.arc(p[idx].pos.x, p[idx].pos.y, 4, 0, Math.PI * 2); ctx.fill();
      if (f.bleedTimer > 0) {
        for (let ss2 = 0; ss2 < 6; ss2++) {
          ctx.fillStyle = `rgba(220,0,0,${0.4 + rng(0, 0.5)})`;
          ctx.beginPath(); ctx.arc(p[idx].pos.x + rng(-8, 8), p[idx].pos.y - rng(0, 18), 1.5 + rng(0, 3.5), 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = `rgba(200,0,0,${Math.min(1, f.bleedTimer / 250)})`; ctx.lineWidth = 2.5 + rng(0, 2);
        ctx.beginPath(); ctx.moveTo(p[idx].pos.x, p[idx].pos.y);
        ctx.quadraticCurveTo(p[idx].pos.x + rng(-25, 25), p[idx].pos.y + 10 + rng(0, 20), p[idx].pos.x + rng(-35, 35), p[idx].pos.y + 20 + rng(0, 25));
        ctx.stroke();
      }
    });

    // ── PISTOL (left hand) ──
    if (!f.severed.has('leftArm')) {
      const lhand = p[7].pos;
      const g = G.current;
      const oIdx = f === g.fighters[0] ? 1 : 0;
      const other = g.fighters[oIdx];
      const gunAng = Math.atan2(other.y - 60 - lhand.y, other.x - lhand.x);

      // Draw pistol
      ctx.save();
      ctx.translate(lhand.x, lhand.y);
      ctx.rotate(gunAng);
      // Gun body
      ctx.fillStyle = '#444';
      ctx.fillRect(0, -3, 18, 6);
      // Barrel
      ctx.fillStyle = '#666';
      ctx.fillRect(14, -2, 8, 4);
      // Grip
      ctx.fillStyle = '#332';
      ctx.fillRect(2, 3, 6, 8);
      // Muzzle flash
      if (f.muzzleFlash > 0) {
        const mfSize = f.muzzleFlash * 4;
        const mfGrad = ctx.createRadialGradient(22, 0, 1, 22, 0, mfSize);
        mfGrad.addColorStop(0, 'rgba(255,255,200,0.9)');
        mfGrad.addColorStop(0.3, 'rgba(255,180,50,0.6)');
        mfGrad.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = mfGrad;
        ctx.beginPath(); ctx.arc(22, 0, mfSize, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ── WEAPON (right hand) ──
    if (!f.severed.has('rightArm')) {
      const hand = p[10].pos;
      const ang = f.wAngle * f.facing;
      const wl = f.weapon.len;
      const tipX = hand.x + Math.cos(ang) * wl;
      const tipY = hand.y + Math.sin(ang) * wl;

      const isAtk = ['slash', 'heavySlash', 'overhead', 'stab', 'jumpAtk', 'uppercut', 'spinSlash', 'dashStab', 'limbSmash', 'backflipKick', 'execution', 'wallFlip', 'divekick'].includes(f.state);
      const ap2 = f.dur > 0 ? f.frame / f.dur : 0;
      if (isAtk && ap2 > 0.2 && ap2 < 0.7) {
        ctx.strokeStyle = `rgba(255,255,255,${0.2 * (1 - Math.abs(ap2 - 0.45) * 4)})`;
        ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();
        ctx.strokeStyle = `rgba(200,200,255,0.12)`;
        ctx.lineWidth = 28; ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();
      }

      ctx.strokeStyle = f.weapon.blade;
      ctx.lineWidth = f.weapon.type === 'greatsword' ? 5 : f.weapon.type === 'axe' ? 4 : 3;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hand.x + Math.cos(ang + 0.05) * 5, hand.y + Math.sin(ang + 0.05) * 5);
      ctx.lineTo(tipX + Math.cos(ang + 0.05) * -3, tipY + Math.sin(ang + 0.05) * -3); ctx.stroke();
      ctx.strokeStyle = f.weapon.color; ctx.lineWidth = 3;
      const hx = hand.x - Math.cos(ang) * 14, hy = hand.y - Math.sin(ang) * 14;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = '#aa9'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hand.x + Math.sin(ang) * 6, hand.y - Math.cos(ang) * 6);
      ctx.lineTo(hand.x - Math.sin(ang) * 6, hand.y + Math.cos(ang) * 6); ctx.stroke();
      if (f.weapon.type === 'axe') {
        const ax = tipX - Math.cos(ang) * 8, ay = tipY - Math.sin(ang) * 8;
        ctx.fillStyle = '#999'; ctx.beginPath();
        ctx.moveTo(ax + Math.sin(ang) * 12, ay - Math.cos(ang) * 12);
        ctx.lineTo(tipX, tipY); ctx.lineTo(ax - Math.sin(ang) * 12, ay + Math.cos(ang) * 12);
        ctx.closePath(); ctx.fill();
      }
      if (f.weapon.type === 'spear') {
        ctx.fillStyle = '#ccd'; ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - Math.cos(ang) * 14 + Math.sin(ang) * 5, tipY - Math.sin(ang) * 14 - Math.cos(ang) * 5);
        ctx.lineTo(tipX - Math.cos(ang) * 14 - Math.sin(ang) * 5, tipY - Math.sin(ang) * 14 + Math.cos(ang) * 5);
        ctx.closePath(); ctx.fill();
      }
    }

    // ── HELD LIMB (in left hand) ──
    if (f.heldLimb && !f.severed.has('leftArm')) {
      const lhand = p[7].pos;
      ctx.save(); ctx.translate(lhand.x, lhand.y); ctx.rotate(f.limbSwingAng * f.facing);
      if (f.heldLimb.isHead) {
        ctx.fillStyle = f.heldLimb.color;
        ctx.beginPath(); ctx.arc(0, -15, 13, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#111';
        ctx.beginPath(); ctx.moveTo(-5, -17); ctx.lineTo(-2, -14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, -17); ctx.lineTo(2, -14); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -9, 4, 0, Math.PI); ctx.stroke();
        ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = f.heldLimb.color; ctx.lineWidth = f.heldLimb.w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -35); ctx.stroke();
        ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(0, -35, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = f.heldLimb.color; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ── HEAD ──
    if (!f.severed.has('head')) {
      const hPos = p[0].pos;
      const nPos = p[1].pos;
      const headAng = Math.atan2(hPos.x - nPos.x, -(hPos.y - nPos.y));
      ctx.save(); ctx.translate(hPos.x, hPos.y); ctx.rotate(headAng);
      ctx.fillStyle = f.hair;
      ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI * 1.1, -0.1 * Math.PI); ctx.fill();
      ctx.fillStyle = f.skin;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = f.color; ctx.fillRect(-14, -8, 28, 5);
      if (f.state === 'ko' || f.state === 'ragdoll') {
        ctx.lineWidth = 2; ctx.strokeStyle = '#111';
        [-5, 5].forEach(ex => {
          ctx.beginPath(); ctx.moveTo(ex - 3, -2); ctx.lineTo(ex + 3, 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ex + 3, -2); ctx.lineTo(ex - 3, 2); ctx.stroke();
        });
      } else if (f.state === 'taunt') {
        ctx.fillStyle = '#111'; ctx.fillRect(-7, -4, 3, 4); ctx.fillRect(4, -4, 3, 4);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 6, 5, 0, Math.PI); ctx.stroke();
      } else {
        const ed = f.facing > 0 ? 1 : -1;
        ctx.fillStyle = '#111'; ctx.fillRect(-7 * ed - 1, -4, 3, 4); ctx.fillRect(3 * ed, -4, 3, 4);
        ctx.fillStyle = '#eee'; ctx.fillRect(-7 * ed, -3, 1.5, 1.5); ctx.fillRect(3 * ed + 1, -3, 1.5, 1.5);
      }
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5; ctx.beginPath();
      if (f.state === 'hit' || f.state === 'stagger' || f.state === 'ragdoll') ctx.arc(0, 7, 4, 0, Math.PI);
      else { ctx.moveTo(-2, 6); ctx.lineTo(2, 6); }
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  // ─── GAME LOOP ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const g = G.current;

    const kd = (e: KeyboardEvent) => { g.keys.add(e.key.toLowerCase()); e.preventDefault(); };
    const ku = (e: KeyboardEvent) => { g.keys.delete(e.key.toLowerCase()); e.preventDefault(); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    let fc = 0, aid = 0;

    const ss = (f: Fighter, state: FState, dur?: number) => {
      if (f.state === 'ragdoll' && state !== 'idle' && state !== 'ragdoll') {
        if (f.ragTimer > 0) return;
        f.ragdolling = false;
      }
      if (f.state === 'ko') return;
      f.state = state; f.frame = 0; f.dur = dur || 0; f.hitDealt = false;
    };
    const ca = (f: Fighter) => ['idle', 'walk', 'walkBack', 'crouch'].includes(f.state);
    const doAtk = (f: Fighter, t: string) => {
      const d = ATK[t];
      if (!d || !ca(f) || f.stamina < d.stCost) return false;
      f.stamina -= d.stCost;
      ss(f, t as FState, Math.round(d.frames / f.weapon.speed));
      if (t === 'dashStab') { f.vx = f.facing * 12; }
      if (t === 'uppercut') { f.vy = -6; f.grounded = false; }
      if (t === 'spinSlash') { f.vx = f.facing * 5; }
      if (t === 'backflipKick') { f.vy = -12; f.vx = -f.facing * 6; f.grounded = false; }
      if (t === 'execution') { f.vx = f.facing * 8; }
      if (t === 'wallFlip') { f.vy = -14; f.vx = f.facing * 10; f.grounded = false; f.wallSide = 0; f.wallRunTimer = 0; }
      if (t === 'divekick') { f.vy = 8; f.vx = f.facing * 6; f.grounded = false; }
      spawnAfterimage(f);
      return true;
    };

    const doShoot = (f: Fighter, idx: number) => {
      if (f.gunCooldown > 0 || f.severed.has('leftArm') || f.stamina < 4) return false;
      f.stamina -= 4;
      f.gunCooldown = 18;
      ss(f, 'shoot', 10);
      spawnBullet(f, idx);
      return true;
    };

    const startWallRun = (f: Fighter, side: -1 | 1) => {
      if (f.wallRunTimer > 0 || f.state === 'wallRun') return;
      f.state = 'wallRun' as FState;
      f.wallSide = side;
      f.wallRunTimer = 60; // max wall run frames
      f.vy = -6;
      f.grounded = false;
    };

    const doDodge = (f: Fighter, dir: number) => {
      if (f.dodgeCool > 0 || f.stamina < 12) return;
      f.stamina -= 12; f.dodgeCool = 25; f.vx = dir * 10;
      ss(f, 'dodge' as FState, 18);
      spawnAfterimage(f);
    };

    const tryPickupLimb = (f: Fighter) => {
      if (f.heldLimb || !ca(f)) return false;
      let best: SevLimb | null = null, bestD = 80;
      for (const l of g.limbs) {
        if (!l.grounded) continue;
        const d = Math.abs(l.pts[0].x - f.x) + Math.abs(l.pts[0].y - (f.y));
        if (d < bestD) { bestD = d; best = l; }
      }
      if (best) {
        f.heldLimb = best;
        g.limbs = g.limbs.filter(l => l.id !== best!.id);
        ss(f, 'pickup' as FState, 20);
        return true;
      }
      return false;
    };

    const doLimbSmash = (f: Fighter) => {
      if (!f.heldLimb || !ca(f) || f.stamina < 18) return false;
      f.stamina -= 18;
      f.vy = -9; f.grounded = false;
      ss(f, 'limbSmash' as FState, 36);
      spawnAfterimage(f);
      return true;
    };

    const throwLimb = (f: Fighter) => {
      if (!f.heldLimb) return;
      const limb = f.heldLimb;
      limb.pts = [v(f.rag.pts[7].pos.x, f.rag.pts[7].pos.y)];
      limb.vel = v(f.facing * 18, -8);
      limb.angV = f.facing * 1.2;
      limb.life = 300;
      limb.grounded = false;
      g.limbs.push(limb);
      f.heldLimb = null;
    };

    const startRagdoll = (f: Fighter, impulse: V, duration: number) => {
      f.ragdolling = true; f.ragTimer = duration;
      f.state = 'ragdoll' as FState; f.frame = 0; f.dur = duration;
      for (let i = 0; i < 11; i++) {
        const pt = f.rag.pts[i];
        const imp = vscl(impulse, (1 - i * 0.05) * (0.7 + rng(0, 0.3)));
        pt.old = vsub(pt.pos, imp);
      }
      if (f.heldLimb) throwLimb(f);
    };

    // ═══════════════════════════════════════════════════════
    // AI
    // ═══════════════════════════════════════════════════════
    type AIStyle = 'berserker' | 'assassin' | 'guardian' | 'wild' | 'tactician' | 'showboat' | 'juggernaut' | 'gunslinger' | 'acrobat';
    type AIIntent = 'pressure' | 'retreat' | 'circle' | 'feint' | 'punish' | 'bait' | 'rush' | 'rest' | 'jumpAtk' | 'dodgeIn' | 'taunt' | 'executeCombo' | 'pickupLimb' | 'limbAttack' | 'throwLimb' | 'shoot' | 'wallRun' | 'wallFlipAtk' | 'divekickAtk' | 'airCombo';

    const mkPersonality = () => ({
      style: pick(['berserker', 'assassin', 'guardian', 'wild', 'tactician', 'showboat', 'juggernaut', 'gunslinger', 'acrobat'] as AIStyle[]),
      aggression: 0.3 + rng(0, 0.7), patience: 0.1 + rng(0, 0.9), riskTaking: 0.2 + rng(0, 0.8),
      preferredAtk: pick(['slash', 'stab', 'heavySlash', 'overhead'] as const),
      comboChance: 0.3 + rng(0, 0.5), dodgeSkill: 0.2 + rng(0, 0.6), tauntsAfterKill: rng(0, 1) > 0.5,
    });

    const mkAiMem = () => ({
      intent: 'pressure' as AIIntent, intentTimer: 0, timesHit: 0, consecutiveBlocks: 0,
      circleDir: Math.random() > 0.5 ? 1 : -1, styleShiftTimer: 80 + rng(0, 200),
      dashCooldown: 0, feinting: false, feintTimer: 0, comboStep: 0, rushMomentum: 0,
      comboSeq: [] as string[], lastAtkLanded: false, excitement: 0,
    });

    const aiData = [
      { personality: mkPersonality(), mem: mkAiMem() },
      { personality: mkPersonality(), mem: mkAiMem() },
    ];

    const pickIntent = (bot: Fighter, pl: Fighter, p2: ReturnType<typeof mkPersonality>, m: ReturnType<typeof mkAiMem>): AIIntent => {
      const d = Math.abs(bot.x - pl.x);
      const hp = bot.hp / 100, plHp = pl.hp / 100, st = bot.stamina / 100;
      const r = Math.random();

      const nearbyLimb = g.limbs.some(l => l.grounded && Math.abs(l.pts[0].x - bot.x) < 120);
      if (!bot.heldLimb && nearbyLimb && r < 0.25) return 'pickupLimb';
      if (bot.heldLimb && r < 0.3) return d < 100 ? 'limbAttack' : r < 0.15 ? 'throwLimb' : 'rush';

      // Wall run / acrobatics
      const nearWall = bot.x < WALL_L + 60 || bot.x > WALL_R - 60;
      if (nearWall && r < 0.25 && st > 0.2) return 'wallRun';
      if (!bot.grounded && r < 0.2) return 'divekickAtk';
      if (d > 200 && r < 0.2) return 'shoot';
      if (d > 150 && r < 0.15 && st > 0.15) return 'shoot';

      if (hp < 0.15) return r < 0.5 * p2.riskTaking ? 'rush' : r < 0.7 ? 'wallRun' : r < 0.85 ? 'shoot' : 'retreat';
      if (plHp < 0.2) return r < 0.3 ? 'rush' : r < 0.5 ? 'executeCombo' : r < 0.65 ? 'shoot' : 'pressure';
      if (plHp < 0.3 && d < 80 && r < 0.35) return 'executeCombo';
      if (st < 0.15) return r < 0.4 ? 'shoot' : 'rest';
      if (m.lastAtkLanded && r < 0.6) return r < 0.2 ? 'shoot' : r < 0.4 ? 'executeCombo' : 'pressure';
      if (m.excitement > 5) return r < 0.3 ? 'rush' : r < 0.45 ? 'jumpAtk' : r < 0.55 ? 'wallRun' : 'pressure';

      switch (p2.style) {
        case 'berserker': return pick(['rush', 'pressure', 'pressure', 'executeCombo', 'jumpAtk', 'wallRun']);
        case 'assassin': return pick(['feint', 'dodgeIn', 'punish', 'circle', 'shoot', 'wallRun']);
        case 'guardian': return pick(['bait', 'circle', 'punish', 'retreat', 'shoot', 'pressure']);
        case 'wild': return pick(['rush', 'pressure', 'feint', 'retreat', 'circle', 'punish', 'bait', 'jumpAtk', 'taunt', 'dodgeIn', 'executeCombo', 'shoot', 'wallRun', 'divekickAtk']);
        case 'gunslinger': return pick(['shoot', 'shoot', 'shoot', 'retreat', 'dodgeIn', 'wallRun', 'pressure']);
        case 'acrobat': return pick(['wallRun', 'wallRun', 'backflipKick' as AIIntent, 'jumpAtk', 'divekickAtk', 'wallFlipAtk', 'pressure']);
        case 'tactician':
          if (m.timesHit > 3) return r < 0.3 ? 'shoot' : 'retreat';
          return d < 100 ? pick(['punish', 'circle', 'dodgeIn', 'shoot']) : pick(['pressure', 'feint', 'bait', 'shoot']);
        case 'showboat': return r < 0.15 ? 'taunt' : pick(['feint', 'pressure', 'executeCombo', 'jumpAtk', 'wallRun', 'shoot']);
        case 'juggernaut': return pick(['pressure', 'pressure', 'rush', 'heavySlash' as AIIntent, 'overhead' as AIIntent, 'shoot']);
        default: return 'pressure';
      }
    };

    const AI_COMBOS = [
      ['slash', 'slash', 'stab', 'slash', 'stab', 'stab', 'uppercut', 'jumpAtk', 'backflipKick', 'heavySlash'],
      ['stab', 'stab', 'slash', 'stab', 'slash', 'uppercut', 'backflipKick', 'spinSlash'],
      ['slash', 'stab', 'slash', 'stab', 'slash', 'stab', 'heavySlash'],
      ['dashStab', 'slash', 'slash', 'uppercut', 'jumpAtk', 'backflipKick', 'overhead'],
      ['slash', 'slash', 'slash', 'slash', 'spinSlash', 'backflipKick', 'heavySlash'],
      ['stab', 'slash', 'stab', 'uppercut', 'backflipKick', 'jumpAtk'],
      ['dashStab', 'stab', 'stab', 'slash', 'slash', 'overhead'],
      ['spinSlash', 'stab', 'slash', 'stab', 'uppercut', 'backflipKick', 'heavySlash'],
      ['uppercut', 'jumpAtk', 'backflipKick', 'execution'],
      ['dashStab', 'spinSlash', 'backflipKick', 'heavySlash'],
      ['slash', 'slash', 'dashStab', 'uppercut', 'backflipKick'],
      ['stab', 'stab', 'stab', 'stab', 'spinSlash', 'execution'],
      ['backflipKick', 'dashStab', 'backflipKick', 'uppercut', 'jumpAtk'],
      ['uppercut', 'backflipKick', 'spinSlash', 'backflipKick', 'execution'],
      // Wall flip combos
      ['wallFlip', 'slash', 'slash', 'uppercut', 'backflipKick'],
      ['dashStab', 'slash', 'wallFlip', 'heavySlash'],
      // Divekick combos
      ['divekick', 'stab', 'stab', 'spinSlash', 'uppercut'],
      ['uppercut', 'divekick', 'slash', 'execution'],
    ];

    const ai = (bot: Fighter, pl: Fighter, idx: number) => {
      if (bot.state === 'ko' || bot.state === 'ragdoll') return;
      const pers = aiData[idx].personality;
      const mem = aiData[idx].mem;
      bot.aiTimer--; bot.dodgeCool = Math.max(0, bot.dodgeCool - 1);
      mem.dashCooldown = Math.max(0, mem.dashCooldown - 1);
      mem.feintTimer = Math.max(0, mem.feintTimer - 1);
      mem.excitement = Math.max(0, mem.excitement - 0.02);

      mem.styleShiftTimer--;
      if (mem.styleShiftTimer <= 0) {
        pers.style = pick(['berserker', 'assassin', 'guardian', 'wild', 'tactician', 'showboat', 'juggernaut', 'gunslinger', 'acrobat'] as AIStyle[]);
        pers.aggression = 0.3 + rng(0, 0.7); pers.riskTaking = 0.2 + rng(0, 0.8);
        pers.preferredAtk = pick(['slash', 'stab', 'heavySlash', 'overhead'] as const);
        mem.styleShiftTimer = 60 + rng(0, 200); mem.circleDir *= -1;
      }

      if (bot.aiTimer > 0) return;
      if (bot.state === 'hit' || bot.state === 'stagger' || bot.state === 'pickup' || bot.state === 'wallRun' as FState) return;

      const d = Math.abs(bot.x - pl.x);
      const wr = bot.weapon.len + 25;
      const isPlAtk = ['slash', 'heavySlash', 'stab', 'overhead', 'jumpAtk', 'uppercut', 'spinSlash', 'dashStab', 'limbSmash', 'shoot', 'wallFlip', 'divekick'].includes(pl.state);
      const isPlRecovering = pl.dur > 0 && pl.frame > pl.dur * 0.6;
      const st = bot.stamina / 100;

      mem.intentTimer--;
      if (mem.intentTimer <= 0) {
        mem.intent = pickIntent(bot, pl, pers, mem);
        mem.intentTimer = 5 + Math.floor(rng(0, 12));
      }

      // Reactive layer
      if (isPlAtk && d < 120) {
        const r = Math.random();
        if (r < 0.08) { ss(bot, 'block'); bot.aiTimer = 4 + rng(0, 5) | 0; mem.consecutiveBlocks++; if (mem.consecutiveBlocks >= 2) { mem.intent = 'punish'; mem.intentTimer = 12; mem.consecutiveBlocks = 0; } return; }
        else if (r < 0.14 && bot.dodgeCool <= 0 && bot.stamina > 12) { doDodge(bot, -bot.facing); bot.aiTimer = 3; mem.intent = 'punish'; mem.intentTimer = 10; return; }
        else if (r < 0.25) { doShoot(bot, idx); bot.aiTimer = 2; return; }
        else if (r < 0.7 && ca(bot) && st > 0.06) {
          if (bot.heldLimb && rng(0, 1) < 0.5) { doLimbSmash(bot); } else { doAtk(bot, pick(['slash', 'stab', 'uppercut', 'dashStab', 'spinSlash'])); }
          bot.aiTimer = 0; mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; return;
        }
      }

      if (isPlRecovering && d < wr + 25 && ca(bot)) {
        if (bot.heldLimb && rng(0, 1) < 0.4) doLimbSmash(bot);
        else doAtk(bot, pick(['slash', 'stab', 'uppercut', 'dashStab']));
        bot.aiTimer = 0; mem.comboStep = 1; mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; return;
      }

      switch (mem.intent) {
        case 'shoot': {
          if (d < 60) { mem.intent = 'pressure'; mem.intentTimer = 5; break; }
          if (ca(bot) || bot.state === 'walk' || bot.state === 'walkBack') {
            doShoot(bot, idx);
            bot.aiTimer = 6 + rng(0, 10) | 0;
            // Move while shooting
            if (d < 150) { bot.vx = -bot.facing * 4; }
            else if (d > 300) { bot.vx = bot.facing * 3; }
            if (rng(0, 1) < 0.4) { mem.intent = 'pressure'; mem.intentTimer = 10; }
          }
          break;
        }
        case 'wallRun': {
          // Run toward nearest wall
          const nearLeft = bot.x < W / 2;
          const wallDir = nearLeft ? -1 : 1;
          const wallX = nearLeft ? WALL_L : WALL_R;
          const wallDist = Math.abs(bot.x - wallX);
          if (wallDist > 30) {
            bot.vx = -wallDir * 5;
            ss(bot, 'walk'); bot.aiTimer = 1;
          } else if (bot.grounded) {
            // Start wall run!
            startWallRun(bot, nearLeft ? -1 : 1);
            bot.aiTimer = 8;
          } else {
            mem.intent = 'pressure'; mem.intentTimer = 10;
          }
          break;
        }
        case 'wallFlipAtk': {
          // Run to wall then flip off
          const nearLeft2 = bot.x < W / 2;
          const wallX2 = nearLeft2 ? WALL_L : WALL_R;
          const wallDist2 = Math.abs(bot.x - wallX2);
          if (wallDist2 > 30 && bot.grounded) {
            bot.vx = nearLeft2 ? -5 : 5; ss(bot, 'walk'); bot.aiTimer = 1;
          } else if (bot.grounded) {
            startWallRun(bot, nearLeft2 ? -1 : 1);
            bot.aiTimer = 5;
          } else if (bot.state === 'wallRun') {
            // Flip off wall with attack
            doAtk(bot, 'wallFlip');
            bot.aiTimer = 2;
            mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; mem.intentTimer = 20;
          } else {
            mem.intent = 'pressure'; mem.intentTimer = 8;
          }
          break;
        }
        case 'divekickAtk': {
          if (bot.grounded) {
            // Jump first
            bot.vy = -12; bot.grounded = false; bot.vx = bot.facing * 5;
            ss(bot, 'jump'); bot.aiTimer = 6;
            mem.intent = 'divekickAtk'; mem.intentTimer = 15;
          } else if (!bot.grounded && bot.y < GY - 50) {
            doAtk(bot, 'divekick');
            bot.aiTimer = 2;
            mem.intent = 'pressure'; mem.intentTimer = 15;
          } else {
            mem.intent = 'pressure'; mem.intentTimer = 10;
          }
          break;
        }
        case 'airCombo': {
          if (bot.grounded) {
            bot.vy = -11; bot.grounded = false; bot.vx = bot.facing * 8;
            ss(bot, 'jump'); bot.aiTimer = 4;
          } else {
            doAtk(bot, pick(['jumpAtk', 'divekick', 'backflipKick']));
            bot.aiTimer = 0;
            mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; mem.intentTimer = 20;
          }
          break;
        }
        case 'pickupLimb': {
          const nearest = g.limbs.filter(l => l.grounded).sort((a, b) => Math.abs(a.pts[0].x - bot.x) - Math.abs(b.pts[0].x - bot.x))[0];
          if (nearest) {
            const ld = nearest.pts[0].x - bot.x;
            if (Math.abs(ld) < 40) {
              tryPickupLimb(bot);
              bot.aiTimer = 8;
              mem.intent = 'pressure'; mem.intentTimer = 20;
            } else {
              bot.vx = Math.sign(ld) * 4;
              ss(bot, 'walk'); bot.aiTimer = 2;
            }
          } else {
            mem.intent = 'pressure'; mem.intentTimer = 15;
          }
          break;
        }
        case 'limbAttack': {
          if (d > 80) { ss(bot, 'walk'); bot.vx += bot.facing * 4; bot.aiTimer = 1 + rng(0, 2) | 0; }
          else if (ca(bot)) {
            doLimbSmash(bot);
            bot.aiTimer = 2 + rng(0, 4) | 0;
            mem.intent = rng(0, 1) < 0.5 ? 'pressure' : 'taunt'; mem.intentTimer = 15;
          }
          break;
        }
        case 'throwLimb': {
          if (bot.heldLimb && ca(bot)) {
            throwLimb(bot);
            bot.aiTimer = 5; mem.intent = 'rush'; mem.intentTimer = 15;
          }
          break;
        }
        case 'pressure': {
          if (d > wr + 15) {
            ss(bot, 'walk'); bot.aiTimer = 1;
            if (d > 100 && rng(0, 1) < 0.6 && mem.dashCooldown <= 0) { bot.vx = bot.facing * (10 + rng(0, 6)); mem.dashCooldown = 8; }
            // Shoot while closing distance
            if (d > 150 && rng(0, 1) < 0.3) { doShoot(bot, idx); }
          } else if (ca(bot) && st > 0.06) {
            const r = Math.random();
            if (bot.heldLimb && r < 0.2) doLimbSmash(bot);
            else if (r < 0.15) doAtk(bot, 'slash');
            else if (r < 0.28) doAtk(bot, 'stab');
            else if (r < 0.36) doAtk(bot, 'dashStab');
            else if (r < 0.44) doAtk(bot, 'uppercut');
            else if (r < 0.52) doAtk(bot, 'spinSlash');
            else if (r < 0.60 && bot.stamina > 18) doAtk(bot, 'heavySlash');
            else if (r < 0.67 && bot.stamina > 16) doAtk(bot, 'overhead');
            else if (r < 0.72) { doShoot(bot, idx); }
            else if (r < 0.78) doAtk(bot, 'backflipKick');
            else doAtk(bot, pers.preferredAtk);
            bot.aiTimer = 1;
            mem.comboStep++;
            if (mem.comboStep < 8 && rng(0, 1) < 0.85) bot.aiTimer = 0;
            else mem.comboStep = 0;
          } else { ss(bot, 'walk'); bot.aiTimer = 1; }
          break;
        }
        case 'executeCombo': {
          if (mem.comboSeq.length === 0) mem.comboSeq = [...pick(AI_COMBOS)];
          if (d > wr + 10) { ss(bot, 'walk'); bot.vx += bot.facing * 6; bot.aiTimer = 1; }
          else if (ca(bot) && mem.comboSeq.length > 0) {
            const next = mem.comboSeq.shift()!;
            if (next === 'wallFlip' || next === 'divekick') {
              // These need special setup
              if (next === 'wallFlip') { mem.intent = 'wallFlipAtk'; mem.intentTimer = 20; }
              else { mem.intent = 'divekickAtk'; mem.intentTimer = 15; }
            } else if (doAtk(bot, next)) { bot.aiTimer = 0; }
            else { mem.comboSeq = []; mem.intent = 'retreat'; mem.intentTimer = 10; }
            if (mem.comboSeq.length === 0) { mem.intent = rng(0, 1) < 0.7 ? 'pressure' : 'taunt'; mem.intentTimer = 8; }
          }
          break;
        }
        case 'retreat': {
          if (d < 160) {
            ss(bot, 'walkBack'); bot.aiTimer = 2 + rng(0, 4) | 0;
            if (rng(0, 1) < 0.3 && mem.dashCooldown <= 0) { bot.vx = -bot.facing * 8; mem.dashCooldown = 10; }
            // Shoot while retreating
            if (rng(0, 1) < 0.35) { doShoot(bot, idx); }
          }
          else { mem.intent = rng(0, 1) < 0.6 ? 'pressure' : 'circle'; mem.intentTimer = 15 + rng(0, 20); }
          if (d < wr && ca(bot) && rng(0, 1) < 0.45) { doAtk(bot, rng(0, 1) < 0.5 ? 'stab' : 'slash'); bot.aiTimer = 2; }
          break;
        }
        case 'circle': {
          bot.vx = mem.circleDir * 4;
          if (d < 80) bot.vx += -bot.facing * 2.5;
          else if (d > 180) ss(bot, 'walk');
          else ss(bot, rng(0, 1) > 0.5 ? 'walk' : 'walkBack');
          bot.aiTimer = 2 + rng(0, 5) | 0;
          if (rng(0, 1) < 0.15) mem.circleDir *= -1;
          if (rng(0, 1) < 0.2) doShoot(bot, idx);
          if (d < wr + 5 && rng(0, 1) < 0.45 * pers.aggression && ca(bot)) { doAtk(bot, pick(['slash', 'stab', 'heavySlash', 'overhead'])); bot.aiTimer = 2 + rng(0, 3) | 0; }
          break;
        }
        case 'feint': {
          if (d > wr + 30) { ss(bot, 'walk'); bot.aiTimer = 1 + rng(0, 3) | 0; }
          else if (mem.feintTimer <= 0) {
            if (!mem.feinting) { mem.feinting = true; bot.vx = bot.facing * 6; ss(bot, 'walk'); bot.aiTimer = 2; }
            else {
              mem.feinting = false; mem.feintTimer = 10 + rng(0, 15);
              if (ca(bot) && rng(0, 1) < 0.65) { doAtk(bot, rng(0, 1) < 0.5 ? 'slash' : 'stab'); bot.aiTimer = 1; }
              else { bot.vx = -bot.facing * 6; bot.aiTimer = 2; }
            }
          } else { ss(bot, 'walk'); bot.aiTimer = 2 + rng(0, 3) | 0; }
          break;
        }
        case 'punish': {
          if (d > wr) { ss(bot, 'walk'); bot.vx += bot.facing * 5; bot.aiTimer = 1; }
          else if (ca(bot)) { doAtk(bot, pick(['heavySlash', 'overhead', 'stab'])); bot.aiTimer = 1 + rng(0, 3) | 0; mem.intent = 'pressure'; mem.intentTimer = 15; }
          break;
        }
        case 'bait': {
          if (d < 100) { ss(bot, 'walkBack'); bot.aiTimer = 2 + rng(0, 3) | 0; if (rng(0, 1) < 0.2) doShoot(bot, idx); }
          else if (d < 200) { ss(bot, 'idle'); bot.aiTimer = 3 + rng(0, 6) | 0; }
          else { mem.intent = 'pressure'; mem.intentTimer = 15; }
          if (isPlAtk && d < wr + 20 && ca(bot)) { doAtk(bot, 'stab'); bot.aiTimer = 1; mem.intent = 'executeCombo'; }
          break;
        }
        case 'rush': {
          mem.rushMomentum += 2;
          if (d > wr) {
            ss(bot, 'walk'); bot.vx += bot.facing * (8 + Math.min(mem.rushMomentum * 0.8, 12)); bot.aiTimer = 0;
            if (d > 200 && rng(0, 1) < 0.3) doShoot(bot, idx);
          }
          else if (ca(bot)) {
            doAtk(bot, pick(['dashStab', 'slash', 'slash', 'uppercut', 'spinSlash', 'stab', 'backflipKick']));
            bot.aiTimer = 0; mem.comboStep = 1;
            if (mem.rushMomentum > 15) { mem.intent = 'executeCombo'; mem.comboSeq = [...pick(AI_COMBOS)]; mem.intentTimer = 20; mem.rushMomentum = 0; }
          }
          break;
        }
        case 'rest': {
          if (d < 120) { ss(bot, 'walkBack'); bot.aiTimer = 3; if (rng(0, 1) < 0.3) doShoot(bot, idx); }
          else { ss(bot, 'idle'); bot.aiTimer = 5 + rng(0, 10) | 0; }
          if (bot.stamina > 50) { mem.intent = 'pressure'; mem.intentTimer = 15; }
          break;
        }
        case 'jumpAtk': {
          if (d > 120) { ss(bot, 'walk'); bot.vx += bot.facing * 6; bot.aiTimer = 1; }
          else if (bot.grounded && ca(bot)) {
            bot.vy = -11; bot.grounded = false; bot.vx = bot.facing * 7;
            ss(bot, 'jump'); bot.aiTimer = 4;
            setTimeout(() => { if (bot.state === 'jump') doAtk(bot, pick(['jumpAtk', 'divekick'])); }, 100);
            mem.intent = 'pressure'; mem.intentTimer = 15;
          }
          break;
        }
        case 'dodgeIn': {
          if (d > 150) { doDodge(bot, bot.facing); bot.aiTimer = 5; }
          else if (d < wr && ca(bot)) { doAtk(bot, 'stab'); bot.aiTimer = 2; mem.intent = 'retreat'; mem.intentTimer = 15; }
          else { ss(bot, 'walk'); bot.aiTimer = 2; }
          break;
        }
        case 'taunt': {
          if (d > 100) { ss(bot, 'taunt', 40); bot.aiTimer = 20; mem.intent = 'pressure'; mem.intentTimer = 15; }
          else { mem.intent = 'pressure'; mem.intentTimer = 5; }
          break;
        }
        default: { ss(bot, 'walk'); bot.aiTimer = 2; break; }
      }
    };

    // ═══════════════════════════════════════════════════════
    // TICK
    // ═══════════════════════════════════════════════════════
    const tick = () => {
      fc++;
      g.bgTime += 0.016;
      if (g.slowTimer > 0) { g.slowTimer--; } else g.slowMo = Math.min(1, g.slowMo + 0.06);
      if (g.flash > 0) g.flash -= 0.5;
      const spd = g.slowMo;
      const [p1, p2] = g.fighters;

      // Intro
      if (g.rs === 'intro') {
        g.introTimer -= spd;
        if (g.introTimer <= 0) g.rs = 'fight';
        p1.facing = 1; p2.facing = -1;
        if (p1.x < 450) { p1.x += 2; ss(p1, 'walk'); }
        if (p2.x > 830) { p2.x -= 2; ss(p2, 'walk'); }
      }

      // KO
      if (g.rs === 'ko') {
        g.koTimer -= spd;
        if (g.koTimer <= 0) {
          g.round++;
          const w1 = pick(Object.keys(WEAPONS)), w2 = pick(Object.keys(WEAPONS));
          const f1 = mkFighter(350, p1.name, p1.color, p1.skin, p1.hair, w1, true);
          const f2 = mkFighter(930, p2.name, p2.color, p2.skin, p2.hair, w2, true);
          f1.wins = p1.wins; f2.wins = p2.wins;
          g.fighters[0] = f1; g.fighters[1] = f2;
          g.blood = []; g.limbs = []; g.pools = []; g.sparks = []; g.gore = [];
          g.afterimages = []; g.rings = []; g.lightnings = []; g.bullets = []; g.muzzleFlashes = []; g.wallSparks = [];
          g.rs = 'intro'; g.introTimer = 80; g.timer = 99 * 60;
          aiData[0] = { personality: mkPersonality(), mem: mkAiMem() };
          aiData[1] = { personality: mkPersonality(), mem: mkAiMem() };
        }
      }

      if (g.rs !== 'fight') {
        g.fighters.forEach(f => { if (f.ragdolling) stepRagdoll(f.rag.pts, f.rag.sticks, spd, 0.3); });
        if (fc % 3 === 0) setHud({ p1hp: p1.hp, p2hp: p2.hp, timer: Math.ceil(g.timer / 60), round: g.round, p1st: p1.stamina, p2st: p2.stamina, p1w: p1.wins, p2w: p2.wins, rs: g.rs, n1: p1.name, n2: p2.name, w1: p1.weapon.name, w2: p2.weapon.name, p1limb: !!p1.heldLimb, p2limb: !!p2.heldLimb });
        return;
      }

      g.timer--;
      if (g.timer <= 0) {
        if (p1.hp >= p2.hp) { p1.wins++; ss(p2, 'ko'); startRagdoll(p2, v(5, -8), 999); }
        else { p2.wins++; ss(p1, 'ko'); startRagdoll(p1, v(-5, -8), 999); }
        g.rs = 'ko'; g.koTimer = 180;
      }

      // Player override
      let p1HasInput = false;
      if (ca(p1) || p1.state === 'block') {
        if (g.keys.has('j')) { doAtk(p1, 'slash'); p1HasInput = true; }
        else if (g.keys.has('k')) { doAtk(p1, 'stab'); p1HasInput = true; }
        else if (g.keys.has('l')) { doAtk(p1, 'heavySlash'); p1HasInput = true; }
        else if (g.keys.has('u')) { doAtk(p1, 'overhead'); p1HasInput = true; }
        else if (g.keys.has('i')) { doLimbSmash(p1); p1HasInput = true; }
        else if (g.keys.has('o')) { tryPickupLimb(p1); p1HasInput = true; }
        else if (g.keys.has('p')) { throwLimb(p1); p1HasInput = true; }
        else if (g.keys.has('f')) { doShoot(p1, 0); p1HasInput = true; }
        else if (g.keys.has('r')) { doAtk(p1, 'backflipKick'); p1HasInput = true; }
        else if (g.keys.has('t')) { doAtk(p1, 'divekick'); p1HasInput = true; }
        else if (g.keys.has('s') && g.keys.has('shift')) { ss(p1, 'block'); p1HasInput = true; }
        else if (g.keys.has('s')) { ss(p1, 'crouch'); p1HasInput = true; }
        else if (g.keys.has('w') && p1.grounded) { p1.vy = -11; p1.grounded = false; ss(p1, 'jump'); p1HasInput = true; }
        else if (g.keys.has('a')) { p1.vx = -3.5; if (p1.grounded) ss(p1, p1.facing === -1 ? 'walk' : 'walkBack'); p1HasInput = true; }
        else if (g.keys.has('d')) { p1.vx = 3.5; if (p1.grounded) ss(p1, p1.facing === 1 ? 'walk' : 'walkBack'); p1HasInput = true; }
      }
      // Wall run input: press toward wall while near it
      if (!p1HasInput && !p1.grounded) {
        if (g.keys.has('a') && p1.x < WALL_L + 40) { startWallRun(p1, -1); p1HasInput = true; }
        if (g.keys.has('d') && p1.x > WALL_R - 40) { startWallRun(p1, 1); p1HasInput = true; }
      }
      // Wall run jump off
      if (p1.state === 'wallRun' && g.keys.has('w')) {
        doAtk(p1, 'wallFlip');
        p1HasInput = true;
      }

      if (!p1HasInput) ai(p1, p2, 0);
      ai(p2, p1, 1);

      // Update fighters
      g.fighters.forEach((f, idx) => {
        const o = g.fighters[1 - idx];
        if (ca(f)) f.facing = o.x > f.x ? 1 : -1;

        if (f.dur > 0) {
          f.frame += spd;
          if (f.frame >= f.dur) {
            if (f.state === 'ragdoll') { f.ragTimer -= spd; if (f.ragTimer <= 0 && f.hp > 0) { f.ragdolling = false; ss(f, 'idle'); } }
            else if (f.state !== 'ko') ss(f, 'idle');
          }
        }

        if (f.ragdolling && f.state === 'ragdoll') { f.ragTimer -= spd; if (f.ragTimer <= 0 && f.hp > 0) { f.ragdolling = false; ss(f, 'idle'); } }

        if (ca(f) || f.state === 'block') f.stamina = Math.min(100, f.stamina + 0.35);
        f.dodgeCool = Math.max(0, f.dodgeCool - spd);
        if (f.gunCooldown > 0) f.gunCooldown -= spd;
        if (f.muzzleFlash > 0) f.muzzleFlash -= spd;

        // Wall run physics
        if (f.state === 'wallRun') {
          f.wallRunTimer -= spd;
          f.vy = -4.5; // Run upward
          f.y += f.vy * spd;
          f.walkCycle += 0.25 * spd;
          // Clamp to wall
          if (f.wallSide < 0) f.x = WALL_L + 5;
          else f.x = WALL_R - 5;
          // Wall sparks
          if (fc % 4 === 0) spawnWallSparks(f.x, f.y - 30, 3, -f.wallSide);
          // Can't go above certain height or timer expires
          if (f.y < 120 || f.wallRunTimer <= 0) {
            // Auto wall flip!
            f.facing = -f.wallSide as 1 | -1;
            doAtk(f, 'wallFlip');
          }
          // Afterimage during wall run
          if (fc % 3 === 0) spawnAfterimage(f);
        }

        if (!f.grounded && f.state !== 'wallRun') {
          f.vy += GRAV * spd; f.y += f.vy * spd;
          if (f.y >= GY) {
            f.y = GY; f.vy = 0; f.grounded = true;
            if (f.state === 'jump') ss(f, 'idle');
            if (f.state === 'divekick') {
              // Ground slam impact
              spawnRing(f.x, GY, 60, '#fa0');
              for (let i = 0; i < 8; i++) {
                g.sparks.push({ x: f.x + rng(-20, 20), y: GY, vx: rng(-6, 6), vy: -rng(3, 10), life: 10 + rng(0, 8), color: '#fa0', sz: 1.5 + rng(0, 2) });
              }
            }
          }
        }

        // Auto wall run for AI: when touching walls while airborne
        if (f.isAI && !f.grounded && f.state !== 'wallRun' && f.state !== 'wallFlip') {
          if (f.x <= WALL_L + 10 && rng(0, 1) < 0.4) startWallRun(f, -1);
          else if (f.x >= WALL_R - 10 && rng(0, 1) < 0.4) startWallRun(f, 1);
        }

        f.x += f.vx * spd; f.vx *= 0.86;
        if (f.state === 'walk') { f.x += f.facing * 3.2 * spd; f.walkCycle += 0.14 * spd; }
        else if (f.state === 'walkBack') { f.x -= f.facing * 2.2 * spd; f.walkCycle += 0.1 * spd; }
        f.x = clamp(f.x, WALL_L, WALL_R);
        f.bob += 0.04 * spd;
        if (f.hitImpact > 0) f.hitImpact *= 0.84;

        // Limb swing angle
        if (f.state === 'limbSmash') {
          const ap2 = f.dur > 0 ? f.frame / f.dur : 0;
          f.limbSwingAng = ap2 < 0.3 ? -2.5 : ap2 < 0.6 ? 2.0 : 0;
        } else {
          f.limbSwingAng *= 0.85;
        }

        const ap2 = f.dur > 0 ? f.frame / f.dur : 0;
        if (f.state === 'slash') f.wTarget = ap2 < 0.3 ? -2.0 : ap2 < 0.55 ? 1.5 : 0.3;
        else if (f.state === 'heavySlash') f.wTarget = ap2 < 0.35 ? -2.5 : ap2 < 0.6 ? 2.2 : 0.2;
        else if (f.state === 'stab') f.wTarget = ap2 < 0.3 ? -0.3 : ap2 < 0.55 ? 0.15 : -0.3;
        else if (f.state === 'overhead') f.wTarget = ap2 < 0.4 ? -2.8 : ap2 < 0.6 ? 2.0 : -0.2;
        else if (f.state === 'jumpAtk') f.wTarget = ap2 < 0.25 ? -2.5 : ap2 < 0.65 ? 2.5 : 0.5;
        else if (f.state === 'uppercut') f.wTarget = ap2 < 0.3 ? -1.0 : ap2 < 0.5 ? -2.8 : -0.5;
        else if (f.state === 'spinSlash') { const spin = ap2 * Math.PI * 2; f.wTarget = Math.sin(spin) * 2.5; }
        else if (f.state === 'dashStab') f.wTarget = ap2 < 0.2 ? -0.2 : ap2 < 0.7 ? 0.1 : -0.3;
        else if (f.state === 'backflipKick') f.wTarget = -1.5 + Math.sin(ap2 * Math.PI * 2) * 1.5;
        else if (f.state === 'execution') { const subAp = (ap2 * 5) % 1; f.wTarget = subAp < 0.4 ? -2.5 : subAp < 0.6 ? 2.5 : 0; }
        else if (f.state === 'wallFlip') f.wTarget = Math.sin(ap2 * Math.PI * 2.5) * 2.5;
        else if (f.state === 'divekick') f.wTarget = 1.0;
        else if (f.state === 'block') f.wTarget = -1.2;
        else if (f.state === 'shoot') f.wTarget = -0.5;
        else f.wTarget = -0.5;
        f.wAngle += (f.wTarget - f.wAngle) * 0.38;

        if (f.state === 'dodge') f.vx = (f.facing === 1 ? -1 : 1) * 8 * (1 - ap2);

        if (f.bleedTimer > 0) {
          f.bleedTimer -= spd;
          f.severed.forEach(part => {
            const pidx = part === 'leftArm' ? 5 : part === 'rightArm' ? 8 : part === 'leftLeg' ? 11 : part === 'rightLeg' ? 14 : 1;
            if (fc % 4 === 0 && f.rag.pts[pidx]) {
              spawnBlood(f.rag.pts[pidx].pos.x, f.rag.pts[pidx].pos.y, rng(-1, 1), 4, 2.5);
            }
          });
        }
        if (f.comboTimer > 0) { f.comboTimer -= spd; if (f.comboTimer <= 0) f.combo = 0; }

        stepRagdoll(f.rag.pts, f.rag.sticks, spd, 0.3);
        if (!f.ragdolling) poseRagdoll(f);

        // Afterimages during attacks
        if (['slash', 'heavySlash', 'stab', 'overhead', 'jumpAtk', 'uppercut', 'spinSlash', 'dashStab', 'backflipKick', 'execution', 'wallFlip', 'divekick'].includes(f.state) && fc % 3 === 0) {
          spawnAfterimage(f);
        }
      });

      // ─── BULLET PHYSICS ──────────────────────────────
      g.bullets = g.bullets.filter(b => {
        b.x += b.vx * spd;
        b.y += b.vy * spd;
        b.vy += 0.05 * spd; // very slight drop
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 8) b.trail.shift();
        b.life -= spd;

        // Hit detection against fighters
        const target = g.fighters[1 - b.owner];
        if (target.state !== 'ko' && target.state !== 'dodge') {
          for (let i = 0; i < target.rag.pts.length; i++) {
            const tp = target.rag.pts[i].pos;
            const dd = vlen(vsub(v(b.x, b.y), tp));
            if (dd < 25) {
              // Bullet hit!
              const hitDir = vnorm(v(b.vx, b.vy));
              target.hp = Math.max(0, target.hp - b.dmg);
              target.vx += hitDir.x * 4;
              target.vy += hitDir.y * 2;
              target.hitDir = hitDir;
              target.hitImpact = b.dmg * 0.5;
              spawnBlood(b.x, b.y, hitDir.x > 0 ? 1 : -1, 25, 3);
              spawnSparks(b.x, b.y, 8);
              spawnRing(b.x, b.y, 30, '#fa0');
              if (b.dmg >= 10) {
                ss(target, 'hit', 12);
              }
              // KO from bullet
              if (target.hp <= 0) {
                const shooter = g.fighters[b.owner];
                ss(target, 'ko');
                startRagdoll(target, vscl(hitDir, 18), 999);
                shooter.wins++; g.rs = 'ko'; g.koTimer = 280;
                g.slowMo = 0.05; g.slowTimer = 55;
                g.flash = 15; g.flashColor = '#fff';
                spawnBlood(b.x, b.y, hitDir.x > 0 ? 1 : -1, 80, 6);
                spawnGore(b.x, b.y, 10, hitDir.x > 0 ? 1 : -1);
                spawnRing(b.x, b.y, 100, '#f00');
              }
              return false; // bullet consumed
            }
          }
        }

        // Bullet hit ground or walls
        if (b.y > GY || b.x < 10 || b.x > W - 10) {
          spawnSparks(b.x, Math.min(b.y, GY), 5);
          return false;
        }

        return b.life > 0;
      });

      // ─── MELEE HIT DETECTION ─────────────────────────
      g.fighters.forEach((f, idx) => {
        const o = g.fighters[1 - idx];
        const atkName = f.state === 'limbSmash' ? 'limbSmash' : f.state;
        const ad = ATK[atkName];
        if (!ad || f.hitDealt) return;
        if (f.state === 'dodge' || f.state === 'shoot') return;
        const hs = Math.round(ad.hitStart / f.weapon.speed);
        const he = Math.round(ad.hitEnd / f.weapon.speed);
        if (f.frame < hs || f.frame > he) return;

        let tipX: number, tipY: number;
        if (f.state === 'limbSmash' && f.heldLimb) {
          const lhand = f.rag.pts[7].pos;
          tipX = lhand.x + Math.cos(f.limbSwingAng * f.facing) * 45;
          tipY = lhand.y + Math.sin(f.limbSwingAng * f.facing) * 45;
        } else if (f.state === 'divekick') {
          // Divekick uses feet
          tipX = f.rag.pts[16].pos.x;
          tipY = f.rag.pts[16].pos.y;
        } else if (f.state === 'wallFlip') {
          // Wall flip uses both weapon and feet
          const hand = f.rag.pts[10].pos;
          const ang = f.wAngle * f.facing;
          tipX = hand.x + Math.cos(ang) * f.weapon.len * 0.8;
          tipY = hand.y + Math.sin(ang) * f.weapon.len * 0.8;
        } else {
          const hand = f.rag.pts[10].pos;
          const ang = f.wAngle * f.facing;
          tipX = hand.x + Math.cos(ang) * f.weapon.len * 0.8;
          tipY = hand.y + Math.sin(ang) * f.weapon.len * 0.8;
        }

        if (o.state === 'dodge') return;

        let hitPt: V | null = null;
        let hitJoint = -1;
        for (let i = 0; i < o.rag.pts.length; i++) {
          const op = o.rag.pts[i].pos;
          const dd = vlen(vsub(v(tipX, tipY), op));
          if (dd < 38) { hitPt = op; hitJoint = i; break; }
        }
        if (!hitPt) {
          const hitDist = Math.abs(tipX - o.x);
          const hitDistY = Math.abs(tipY - (o.y - 55));
          if (hitDist < 55 && hitDistY < 65) { hitPt = v(o.x, o.y - 55); hitJoint = 2; }
        }

        if (hitPt) {
          f.hitDealt = true;
          let dmg = f.weapon[ad.dmgKey];
          if (f.state === 'limbSmash' && f.heldLimb) {
            dmg *= 1.5;
            spawnBlood(hitPt.x, hitPt.y, f.facing, 60, 5);
            spawnGore(hitPt.x, hitPt.y, 10, f.facing);
            spawnRing(hitPt.x, hitPt.y, 100, '#f40');
            spawnLightning(f.rag.pts[7].pos.x, f.rag.pts[7].pos.y, hitPt.x, hitPt.y);
            f.heldLimb = null;
            g.flash = 6; g.flashColor = '#ff4';
          }
          if (f.state === 'execution') {
            dmg *= 2.5;
            spawnBlood(hitPt.x, hitPt.y, f.facing, 80, 6);
            spawnGore(hitPt.x, hitPt.y, 15, f.facing);
            spawnRing(hitPt.x, hitPt.y, 120, '#f00');
            spawnLightning(hitPt.x, hitPt.y - 50, hitPt.x + rng(-60, 60), hitPt.y + 30);
            g.flash = 10; g.flashColor = '#a00';
            g.slowMo = 0.15; g.slowTimer = 25;
          }
          if (f.state === 'backflipKick') {
            dmg *= 1.3;
            spawnRing(hitPt.x, hitPt.y, 80, '#ff8');
            g.slowMo = 0.3; g.slowTimer = 12;
          }
          if (f.state === 'wallFlip') {
            dmg *= 1.8;
            spawnRing(hitPt.x, hitPt.y, 90, '#8ff');
            spawnLightning(hitPt.x - 40, hitPt.y - 80, hitPt.x + 40, hitPt.y + 20);
            g.slowMo = 0.2; g.slowTimer = 18;
            g.flash = 6; g.flashColor = '#8af';
          }
          if (f.state === 'divekick') {
            dmg *= 1.6;
            spawnRing(hitPt.x, hitPt.y, 70, '#fa0');
            g.slowMo = 0.25; g.slowTimer = 15;
            g.flash = 5; g.flashColor = '#fa0';
            // Ground slam on divekick
            for (let i = 0; i < 12; i++) {
              g.sparks.push({ x: hitPt.x + rng(-15, 15), y: hitPt.y, vx: rng(-8, 8), vy: -rng(4, 12), life: 10 + rng(0, 10), color: '#fa0', sz: 1.5 + rng(0, 2.5) });
            }
          }

          const hitDir2 = v(f.facing, -0.3);
          if (aiData[idx]) { aiData[idx].mem.lastAtkLanded = true; aiData[idx].mem.excitement += 2; }
          if (aiData[1 - idx]) { aiData[1 - idx].mem.timesHit++; aiData[1 - idx].mem.lastAtkLanded = false; }

          if (o.state === 'block' && o.stamina > 5) {
            o.vx = f.facing * ad.kb.x * 0.3; o.stamina -= dmg * 0.7;
            spawnSparks((f.x + o.x) / 2, hitPt.y, 15);
            spawnRing((f.x + o.x) / 2, hitPt.y, 50, '#ff8');
            for (let i = 0; i < 5; i++) o.rag.pts[i].old = vsub(o.rag.pts[i].pos, vscl(hitDir2, -2.5));
          } else {
            f.combo++; f.comboTimer = 80;
            let finalDmg = dmg;
            if (f.combo > 1) finalDmg *= (1 + f.combo * 0.15);
            o.hp = Math.max(0, o.hp - finalDmg);
            o.vx = f.facing * ad.kb.x; o.vy = ad.kb.y;
            if (ad.kb.y < -4) o.grounded = false;
            o.hitDir = vnorm(hitDir2); o.hitImpact = dmg * 0.6;

            const impForce = dmg * 0.4;
            for (let i = 0; i < o.rag.pts.length; i++) {
              const dd = vlen(vsub(o.rag.pts[i].pos, hitPt));
              if (dd < 90) { const falloff = 1 - dd / 90; o.rag.pts[i].old = vsub(o.rag.pts[i].pos, vscl(hitDir2, impForce * falloff)); }
            }

            if (dmg >= 18) {
              startRagdoll(o, vscl(hitDir2, dmg * 0.5), 35 + dmg);
              spawnRing(hitPt.x, hitPt.y, 70, '#a00');
            } else {
              ss(o, dmg >= 13 ? 'stagger' : 'hit', dmg >= 13 ? 25 : 14);
            }

            spawnBlood(hitPt.x, hitPt.y, f.facing, Math.round(dmg * 2.5), dmg / 6);
            spawnBlood(hitPt.x, hitPt.y - 12, f.facing * -0.5, Math.round(dmg * 1.5), dmg / 8);
            spawnBlood(hitPt.x, hitPt.y + 5, 0, Math.round(dmg * 0.7), dmg / 9);
            if (hitJoint >= 0 && hitJoint < o.rag.pts.length) {
              spawnBlood(o.rag.pts[hitJoint].pos.x, o.rag.pts[hitJoint].pos.y, f.facing, 18, 3);
            }
            if (dmg >= 15) spawnGore(hitPt.x, hitPt.y, Math.round(dmg / 4), f.facing);

            // Dismemberment
            if (o.hp < 65 && rng(0, 1) < 0.5) {
              const parts = ['leftArm', 'rightArm'].filter(p3 => !o.severed.has(p3));
              if (o.hp < 40) parts.push(...['leftLeg', 'rightLeg'].filter(p3 => !o.severed.has(p3)));
              if (o.hp < 12) parts.push('head');
              if (parts.length > 0) {
                sever(o, pick(parts), f.facing);
                if (rng(0, 1) < 0.4) {
                  const rem = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].filter(p3 => !o.severed.has(p3));
                  if (rem.length > 0) sever(o, pick(rem), f.facing);
                }
              }
            }

            // KO
            if (o.hp <= 0) {
              ss(o, 'ko');
              startRagdoll(o, vscl(hitDir2, 22), 999);
              f.wins++; g.rs = 'ko'; g.koTimer = 280;
              g.slowMo = 0.05; g.slowTimer = 55;
              g.flash = 15; g.flashColor = '#fff';
              spawnBlood(hitPt.x, hitPt.y, f.facing, 120, 7);
              spawnBlood(hitPt.x, hitPt.y - 25, -f.facing, 60, 6);
              spawnBlood(hitPt.x, hitPt.y - 50, 0, 50, 5);
              spawnGore(hitPt.x, hitPt.y, 20, f.facing);
              spawnRing(hitPt.x, hitPt.y, 150, '#f00');
              spawnRing(hitPt.x, hitPt.y, 200, '#a00');
              spawnLightning(hitPt.x, hitPt.y, hitPt.x + rng(-100, 100), hitPt.y - rng(50, 150));
              spawnLightning(hitPt.x, hitPt.y, hitPt.x + rng(-80, 80), hitPt.y + rng(-30, 60));
              if (!o.severed.has('head')) sever(o, 'head', f.facing);
              const lp = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].filter(p3 => !o.severed.has(p3));
              if (lp.length > 0) sever(o, pick(lp), f.facing);
              if (lp.length > 1 && rng(0, 1) < 0.7) { const rem = lp.filter(p3 => !o.severed.has(p3)); if (rem.length > 0) sever(o, pick(rem), f.facing); }
            }
          }
        }
      });

      // Update particles
      g.blood = g.blood.filter(b => {
        if (b.grounded) { b.life -= spd * 0.15; return b.life > 0; }
        b.x += b.vx * spd; b.y += b.vy * spd; b.vy += 0.35 * spd; b.vx *= 0.99; b.life -= spd;
        if (b.y >= GY) {
          b.grounded = true; b.y = GY; b.vy = 0; b.vx = 0;
          if (g.pools.length < 180) {
            const ex = g.pools.find(p3 => Math.abs(p3.x - b.x) < 25);
            if (ex) ex.r = Math.min(55, ex.r + 1.5);
            else g.pools.push({ x: b.x, y: GY, r: 3 + rng(0, 7), a: 0.85 });
          }
        }
        return b.life > 0;
      });

      g.sparks = g.sparks.filter(s => { s.x += s.vx * spd; s.y += s.vy * spd; s.vy += 0.4 * spd; s.life -= spd; return s.life > 0; });
      g.gore = g.gore.filter(gc => {
        gc.x += gc.vx * spd; gc.y += gc.vy * spd; gc.vy += 0.3 * spd; gc.rot += gc.rotV * spd;
        if (gc.y >= GY) { gc.y = GY; gc.vy *= -0.3; gc.vx *= 0.6; gc.rotV *= 0.5; }
        gc.life -= spd; return gc.life > 0;
      });
      g.limbs = g.limbs.filter(l => {
        if (l.grounded) { l.life -= spd * 0.3; return l.life > 0; }
        l.pts.forEach(p3 => { p3.x += l.vel.x * spd; p3.y += l.vel.y * spd; });
        l.vel.y += 0.3 * spd; l.ang += l.angV * spd;
        if (l.pts[0] && l.pts[0].y >= GY) {
          l.vel.x *= 0.7; l.vel.y *= -0.2; l.angV *= 0.7; l.pts[0].y = GY;
          if (Math.abs(l.vel.y) < 1) { l.grounded = true; l.vel = v(0, 0); }
        }
        l.life -= spd * 0.2;
        if (l.life > 100 && l.pts[0] && l.pts[0].y < GY && fc % 3 === 0) spawnBlood(l.pts[0].x, l.pts[0].y, rng(-1, 1), 3, 2);
        return l.life > 0;
      });
      g.pools.forEach(p3 => p3.a = Math.max(0.08, p3.a - 0.0002));
      g.afterimages = g.afterimages.filter(a => { a.alpha -= 0.03; return a.alpha > 0; });
      g.rings = g.rings.filter(r => { r.r += (r.maxR - r.r) * 0.15; r.life -= 0.06; return r.life > 0; });
      g.lightnings = g.lightnings.filter(l => { l.life -= 1; return l.life > 0; });
      g.muzzleFlashes = g.muzzleFlashes.filter(m => { m.life -= spd; return m.life > 0; });
      g.wallSparks = g.wallSparks.filter(ws => { ws.x += ws.vx * spd; ws.y += ws.vy * spd; ws.vy += 0.2 * spd; ws.life -= spd; return ws.life > 0; });

      if (fc % 3 === 0) setHud({ p1hp: p1.hp, p2hp: p2.hp, timer: Math.ceil(g.timer / 60), round: g.round, p1st: p1.stamina, p2st: p2.stamina, p1w: p1.wins, p2w: p2.wins, rs: g.rs, n1: p1.name, n2: p2.name, w1: p1.weapon.name, w2: p2.weapon.name, p1limb: !!p1.heldLimb, p2limb: !!p2.heldLimb });
    };

    // ── RENDER ──
    const render = () => {
      tick();
      ctx.save();

      // ── EPIC BACKGROUND ──
      const sky = ctx.createLinearGradient(0, 0, 0, GY);
      sky.addColorStop(0, '#020108');
      sky.addColorStop(0.2, '#060318');
      sky.addColorStop(0.4, '#0a0520');
      sky.addColorStop(0.6, '#10082a');
      sky.addColorStop(1, '#141430');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GY);

      // Stars
      for (let i = 0; i < 80; i++) {
        const sx2 = (i * 137 + 30) % W;
        const sy2 = (i * 73 + 10) % (GY * 0.6);
        const twinkle = 0.3 + Math.sin(g.bgTime * (1 + i * 0.1) + i) * 0.3;
        ctx.fillStyle = `rgba(255,255,${200 + (i % 55)},${twinkle})`;
        const sz = 0.5 + (i % 3);
        ctx.fillRect(sx2, sy2, sz, sz);
        if (sz > 1.5) {
          ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.15})`;
          ctx.beginPath(); ctx.arc(sx2, sy2, sz * 3, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Moon
      const moonX = 180, moonY = 100;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 120);
      moonGlow.addColorStop(0, 'rgba(200,180,140,0.15)');
      moonGlow.addColorStop(0.5, 'rgba(160,140,100,0.05)');
      moonGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = moonGlow; ctx.fillRect(moonX - 120, moonY - 120, 240, 240);
      ctx.fillStyle = 'rgba(220,210,180,0.12)'; ctx.beginPath(); ctx.arc(moonX, moonY, 55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(240,230,200,0.08)'; ctx.beginPath(); ctx.arc(moonX, moonY, 45, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,190,160,0.06)'; ctx.beginPath(); ctx.arc(moonX - 10, moonY - 8, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(moonX + 15, moonY + 5, 12, 0, Math.PI * 2); ctx.fill();

      // Clouds
      g.clouds.forEach(c => {
        c.x += c.speed;
        if (c.x > W + 100) c.x = -c.w;
        ctx.fillStyle = `rgba(40,30,60,${c.opacity})`;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.w * 0.25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(60,40,80,${c.opacity * 0.5})`;
        ctx.beginPath(); ctx.ellipse(c.x + c.w * 0.3, c.y - 5, c.w * 0.6, c.w * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      });

      // Mountains
      ctx.fillStyle = '#070512';
      ctx.beginPath(); ctx.moveTo(0, GY);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, GY - 120 - Math.sin(x * 0.004) * 60 - Math.sin(x * 0.012) * 30);
      ctx.lineTo(W, GY); ctx.fill();
      ctx.fillStyle = '#0a0818';
      ctx.beginPath(); ctx.moveTo(0, GY);
      for (let x = 0; x <= W; x += 25) ctx.lineTo(x, GY - 80 - Math.sin(x * 0.007 + 1) * 40 - Math.sin(x * 0.018) * 20);
      ctx.lineTo(W, GY); ctx.fill();

      // Castle
      ctx.fillStyle = '#08061a';
      ctx.fillRect(480, GY - 260, 320, 260);
      ctx.fillRect(460, GY - 310, 50, 310);
      ctx.fillRect(770, GY - 290, 50, 290);
      for (let bx = 460; bx < 820; bx += 20) ctx.fillRect(bx, GY - 275, 12, 15);
      ctx.beginPath(); ctx.moveTo(450, GY - 310); ctx.lineTo(485, GY - 370); ctx.lineTo(520, GY - 310); ctx.fill();
      ctx.beginPath(); ctx.moveTo(760, GY - 290); ctx.lineTo(795, GY - 345); ctx.lineTo(830, GY - 290); ctx.fill();
      ctx.fillRect(600, GY - 320, 80, 320);
      ctx.beginPath(); ctx.moveTo(590, GY - 320); ctx.lineTo(640, GY - 390); ctx.lineTo(690, GY - 320); ctx.fill();
      ctx.fillStyle = '#1a0808';
      const windowGlow = (wx: number, wy: number) => {
        ctx.fillStyle = '#1a0808'; ctx.fillRect(wx, wy, 14, 20);
        const flicker = 0.3 + Math.sin(g.bgTime * 3 + wx * 0.1) * 0.15;
        ctx.fillStyle = `rgba(255,120,30,${flicker * 0.3})`; ctx.fillRect(wx + 1, wy + 1, 12, 18);
        const wg = ctx.createRadialGradient(wx + 7, wy + 10, 2, wx + 7, wy + 10, 25);
        wg.addColorStop(0, `rgba(255,120,30,${flicker * 0.1})`);
        wg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = wg; ctx.fillRect(wx - 18, wy - 15, 50, 50);
      };
      [510, 570, 630, 690, 750].forEach(wx => { windowGlow(wx, GY - 200); windowGlow(wx, GY - 140); });
      [620, 660].forEach(wx => windowGlow(wx, GY - 280));

      // Arena walls (visible barriers)
      // Left wall
      ctx.fillStyle = '#0c0a1a';
      ctx.fillRect(WALL_L - 8, 80, 12, GY - 80);
      ctx.fillStyle = '#181530';
      ctx.fillRect(WALL_L - 4, 80, 4, GY - 80);
      // Right wall
      ctx.fillRect(WALL_R - 4, 80, 12, GY - 80);
      ctx.fillStyle = '#181530';
      ctx.fillRect(WALL_R, 80, 4, GY - 80);
      // Wall scuff marks (show wall-runnable)
      for (let wy = 150; wy < GY; wy += 60) {
        ctx.strokeStyle = 'rgba(100,80,60,0.15)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(WALL_L - 2, wy); ctx.lineTo(WALL_L + 3, wy + 15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(WALL_R + 2, wy); ctx.lineTo(WALL_R - 3, wy + 15); ctx.stroke();
      }

      // Torches
      g.torches.forEach(torch => {
        ctx.strokeStyle = '#443'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(torch.x, torch.y + 50); ctx.lineTo(torch.x, torch.y); ctx.stroke();
        const fireH = 12 + Math.sin(g.bgTime * 8 + torch.x) * 4;
        const fireW = 6 + Math.sin(g.bgTime * 6 + torch.x * 0.5) * 2;
        const fg = ctx.createRadialGradient(torch.x, torch.y - fireH / 2, 1, torch.x, torch.y, fireH);
        fg.addColorStop(0, 'rgba(255,200,50,0.8)');
        fg.addColorStop(0.4, 'rgba(255,100,20,0.5)');
        fg.addColorStop(1, 'rgba(255,50,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.ellipse(torch.x, torch.y - fireH * 0.3, fireW, fireH, 0, 0, Math.PI * 2); ctx.fill();
        const glow = ctx.createRadialGradient(torch.x, GY, 5, torch.x, GY, 80);
        glow.addColorStop(0, `rgba(255,120,30,${0.04 + Math.sin(g.bgTime * 5 + torch.x) * 0.02})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow; ctx.fillRect(torch.x - 80, GY - 60, 160, 70);
        if (fc % 12 === 0) {
          g.sparks.push({ x: torch.x + rng(-3, 3), y: torch.y - fireH, vx: rng(-1, 1), vy: -rng(1, 4), life: 15 + rng(0, 10), color: '#fa0', sz: 1 + rng(0, 1.5) });
        }
      });

      // Fog
      ctx.fillStyle = `rgba(20,15,40,${0.08 + Math.sin(g.bgTime * 0.3) * 0.03})`;
      ctx.fillRect(0, GY - 50, W, 60);

      // Ground
      const gnd = ctx.createLinearGradient(0, GY - 3, 0, H);
      gnd.addColorStop(0, '#1a1008'); gnd.addColorStop(0.5, '#120a06'); gnd.addColorStop(1, '#0a0604');
      ctx.fillStyle = gnd; ctx.fillRect(0, GY - 3, W, H - GY + 3);
      ctx.strokeStyle = '#3a2a15'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, GY); ctx.lineTo(W, GY); ctx.stroke();
      ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, GY + 3); ctx.lineTo(x + 20, GY + 3); ctx.stroke();
      }

      // Blood pools
      g.pools.forEach(p3 => {
        ctx.fillStyle = `rgba(130,0,0,${p3.a})`;
        ctx.beginPath(); ctx.ellipse(p3.x, p3.y + 2, p3.r, p3.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(90,0,0,${p3.a * 0.6})`;
        ctx.beginPath(); ctx.ellipse(p3.x, p3.y + 2, p3.r * 0.5, p3.r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(200,0,0,${p3.a * 0.15})`;
        ctx.beginPath(); ctx.ellipse(p3.x - p3.r * 0.2, p3.y + 1, p3.r * 0.2, p3.r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      });

      // Afterimages
      g.afterimages.forEach(ai2 => {
        ctx.globalAlpha = ai2.alpha * 0.4;
        ctx.strokeStyle = ai2.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
        const drawAiBone = (a: number, b: number) => {
          if (ai2.pts[a] && ai2.pts[b]) {
            ctx.beginPath(); ctx.moveTo(ai2.pts[a].x, ai2.pts[a].y); ctx.lineTo(ai2.pts[b].x, ai2.pts[b].y); ctx.stroke();
          }
        };
        drawAiBone(0, 1); drawAiBone(1, 2); drawAiBone(2, 3); drawAiBone(3, 4);
        drawAiBone(5, 6); drawAiBone(6, 7); drawAiBone(8, 9); drawAiBone(9, 10);
        drawAiBone(11, 12); drawAiBone(12, 13); drawAiBone(14, 15); drawAiBone(15, 16);
      });
      ctx.globalAlpha = 1;

      // Severed limbs
      g.limbs.forEach(l => {
        if (l.pts.length === 0) return;
        ctx.save(); ctx.translate(l.pts[0].x, l.pts[0].y); ctx.rotate(l.ang);
        if (l.isHead) {
          ctx.fillStyle = l.color;
          ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = '#111';
          ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-2, 1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(2, 1); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 6, 4, 0, Math.PI); ctx.stroke();
          ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(0, 12, 5, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.strokeStyle = l.color; ctx.lineWidth = l.w; ctx.lineCap = 'round';
          for (let i = 1; i < l.pts.length; i++) {
            const d = vsub(l.pts[i], l.pts[0]);
            ctx.beginPath();
            if (i === 1) ctx.moveTo(0, 0); else ctx.moveTo(l.pts[i - 1].x - l.pts[0].x, l.pts[i - 1].y - l.pts[0].y);
            ctx.lineTo(d.x, d.y); ctx.stroke();
          }
          ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        }
        if (l.grounded) {
          ctx.strokeStyle = `rgba(255,255,100,${0.1 + Math.sin(g.bgTime * 4) * 0.08})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      });

      // Gore chunks
      g.gore.forEach(gc => {
        ctx.save(); ctx.translate(gc.x, gc.y); ctx.rotate(gc.rot);
        ctx.fillStyle = gc.color;
        ctx.fillRect(-gc.sz / 2, -gc.sz / 2, gc.sz, gc.sz);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-gc.sz / 4, -gc.sz / 4, gc.sz / 2, gc.sz / 2);
        ctx.restore();
      });

      // Fighters
      g.fighters.forEach(f => drawFighter(ctx, f, fc));

      // Bullets with trails
      g.bullets.forEach(b => {
        // Trail
        if (b.trail.length > 1) {
          for (let i = 1; i < b.trail.length; i++) {
            const a = i / b.trail.length;
            ctx.strokeStyle = `rgba(255,200,50,${a * 0.5})`;
            ctx.lineWidth = 2 * a;
            ctx.beginPath(); ctx.moveTo(b.trail[i - 1].x, b.trail[i - 1].y); ctx.lineTo(b.trail[i].x, b.trail[i].y); ctx.stroke();
          }
        }
        // Bullet
        ctx.fillStyle = '#ff8';
        ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.x, b.y, 1, 0, Math.PI * 2); ctx.fill();
        // Bullet glow
        const bg = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 12);
        bg.addColorStop(0, 'rgba(255,200,50,0.3)');
        bg.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.fill();
      });

      // Muzzle flashes
      g.muzzleFlashes.forEach(m => {
        const mfSize = m.life * 8;
        const mfGrad = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, mfSize);
        mfGrad.addColorStop(0, `rgba(255,255,200,${m.life / 4 * 0.8})`);
        mfGrad.addColorStop(0.4, `rgba(255,180,50,${m.life / 4 * 0.4})`);
        mfGrad.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = mfGrad;
        ctx.beginPath(); ctx.arc(m.x, m.y, mfSize, 0, Math.PI * 2); ctx.fill();
      });

      // Wall sparks
      g.wallSparks.forEach(ws => {
        ctx.fillStyle = `rgba(255,200,100,${ws.life / 18})`;
        ctx.beginPath(); ctx.arc(ws.x, ws.y, 1.5, 0, Math.PI * 2); ctx.fill();
      });

      // Blood particles
      g.blood.forEach(b => {
        if (b.grounded) {
          ctx.fillStyle = `rgba(160,0,0,${(b.life / b.maxLife) * 0.5})`;
          ctx.beginPath(); ctx.ellipse(b.x, b.y + 1, b.sz * 1.3, b.sz * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        } else {
          const a = b.life / b.maxLife;
          ctx.fillStyle = `rgba(210,10,10,${a * 0.9})`;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.sz * (0.6 + a * 0.4), 0, Math.PI * 2); ctx.fill();
          if (b.sz > 2.5) {
            ctx.fillStyle = `rgba(255,60,30,${a * 0.45})`;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.sz * 0.3, 0, Math.PI * 2); ctx.fill();
          }
          if (b.sz > 3) {
            ctx.strokeStyle = `rgba(180,0,0,${a * 0.3})`; ctx.lineWidth = b.sz * 0.3;
            ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 2, b.y - b.vy * 2); ctx.stroke();
          }
        }
      });

      // Sparks
      g.sparks.forEach(s => {
        ctx.globalAlpha = s.life / 20; ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.sz * (s.life / 20), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = s.color; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx, s.y - s.vy); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Impact rings
      g.rings.forEach(ring => {
        ctx.strokeStyle = ring.color;
        ctx.globalAlpha = ring.life * 0.6;
        ctx.lineWidth = 3 * ring.life;
        ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Lightning
      g.lightnings.forEach(l => {
        ctx.globalAlpha = l.life / 8;
        l.branches.forEach(branch => {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 + l.life * 0.3;
          ctx.beginPath();
          branch.forEach((p2, i) => { if (i === 0) ctx.moveTo(p2.x, p2.y); else ctx.lineTo(p2.x, p2.y); });
          ctx.stroke();
          ctx.strokeStyle = '#aaf'; ctx.lineWidth = 4 + l.life * 0.5;
          ctx.beginPath();
          branch.forEach((p2, i) => { if (i === 0) ctx.moveTo(p2.x, p2.y); else ctx.lineTo(p2.x, p2.y); });
          ctx.stroke();
        });
      });
      ctx.globalAlpha = 1;

      // Screen flash
      if (g.flash > 0) {
        ctx.fillStyle = g.flashColor;
        ctx.globalAlpha = g.flash / 15 * 0.4;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      // Intro
      if (g.rs === 'intro') {
        const p3 = 1 - g.introTimer / 80;
        ctx.fillStyle = `rgba(0,0,0,${0.6 * (1 - p3)})`; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2 - 50);
        ctx.scale(0.5 + p3 * 0.5, 0.5 + p3 * 0.5);
        ctx.font = 'bold 60px Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#a88'; ctx.globalAlpha = Math.min(1, p3 * 3);
        ctx.fillText(`ROUND ${g.round}`, 0, 0);
        if (p3 > 0.5) {
          ctx.font = 'bold 40px Georgia, serif'; ctx.fillStyle = '#c44'; ctx.globalAlpha = (p3 - 0.5) * 2;
          ctx.fillText('FIGHT!', 0, 50);
        }
        ctx.restore();
      }

      // KO
      if (g.rs === 'ko') {
        const p3 = 1 - g.koTimer / 280;
        const vig = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W / 2);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, `rgba(0,0,0,${Math.min(0.7, p3 * 2)})`);
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2 - 40);
        const sc = p3 < 0.1 ? p3 / 0.1 : 1;
        ctx.scale(sc, sc);
        ctx.font = 'bold 85px Georgia, serif'; ctx.textAlign = 'center';
        ctx.shadowBlur = 30; ctx.shadowColor = '#f00';
        ctx.fillStyle = '#200'; ctx.fillText('K.O.', 3, 3);
        ctx.fillStyle = '#a00'; ctx.fillText('K.O.', 0, 0);
        ctx.shadowBlur = 0;
        const winner = g.fighters.find(f => f.hp > 0);
        if (winner && winner.combo > 2) {
          ctx.font = 'bold 30px Georgia, serif';
          ctx.fillStyle = '#ff4'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff0';
          ctx.fillText(`${winner.combo} HIT COMBO!`, 0, 50);
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      }

      // Vignette
      const vig2 = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7);
      vig2.addColorStop(0, 'rgba(0,0,0,0)'); vig2.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vig2; ctx.fillRect(0, 0, W, H);

      ctx.restore();
      aid = requestAnimationFrame(render);
    };
    aid = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(aid); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [drawFighter, spawnBlood, spawnSparks, sever, spawnGore, spawnAfterimage, spawnRing, spawnLightning, spawnBullet, spawnWallSparks]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black select-none">
      <canvas ref={canvasRef} width={W} height={H} className="max-w-full max-h-full" />
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ maxWidth: W, margin: '0 auto' }}>
        <div className="flex items-start justify-between p-3 gap-3">
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-bold text-red-400 font-mono tracking-widest">{hud.n1}</span>
              <span className="text-[9px] text-red-400/40 font-mono">{hud.w1}</span>
              {hud.p1limb && <span className="text-[9px] text-yellow-400 font-mono">🦴</span>}
            </div>
            <div className="h-5 bg-black/80 border border-red-900/50 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-300" style={{ width: `${hud.p1hp}%`, background: 'linear-gradient(180deg,#b22,#711)' }} />
            </div>
            <div className="h-1.5 bg-black/50 border border-yellow-900/30 mt-0.5 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-200" style={{ width: `${hud.p1st}%`, background: 'linear-gradient(90deg,#a80,#cc0)' }} />
            </div>
            <div className="flex gap-1 mt-1">{[0, 1].map(i => <div key={i} className={`w-2.5 h-2.5 rounded-full border ${i < hud.p1w ? 'bg-red-600 border-red-500' : 'border-red-900/40'}`} />)}</div>
          </div>
          <div className="text-center px-3">
            <div className="text-3xl font-bold text-white/80 font-mono tabular-nums min-w-[50px]" style={{ fontFamily: 'Georgia,serif' }}>{hud.timer}</div>
            <div className="text-[9px] text-white/25 font-mono tracking-widest">ROUND {hud.round}</div>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1 justify-end">
              <span className="text-[9px] text-blue-400/40 font-mono">{hud.w2}</span>
              <span className="text-xs font-bold text-blue-400 font-mono tracking-widest">{hud.n2}</span>
              {hud.p2limb && <span className="text-[9px] text-yellow-400 font-mono">🦴</span>}
            </div>
            <div className="h-5 bg-black/80 border border-blue-900/50 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-300 ml-auto" style={{ width: `${hud.p2hp}%`, background: 'linear-gradient(180deg,#33a,#226)' }} />
            </div>
            <div className="h-1.5 bg-black/50 border border-yellow-900/30 mt-0.5 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-200 ml-auto" style={{ width: `${hud.p2st}%`, background: 'linear-gradient(90deg,#cc0,#a80)' }} />
            </div>
            <div className="flex gap-1 mt-1 justify-end">{[0, 1].map(i => <div key={i} className={`w-2.5 h-2.5 rounded-full border ${i < hud.p2w ? 'bg-blue-600 border-blue-500' : 'border-blue-900/40'}`} />)}</div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/15 text-[10px] font-mono pointer-events-none tracking-wider">
        WASD Move • J Slash • K Stab • L Heavy • U Overhead • F Shoot • R Backflip • T Divekick
      </div>
    </div>
  );
};

export default RagdollArena;
