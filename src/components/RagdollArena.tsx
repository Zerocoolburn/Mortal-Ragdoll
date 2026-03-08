import { useEffect, useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════
// MATH
// ═══════════════════════════════════════════════════════
const W = 1280, H = 720, GY = 575, GRAV = 0.4;
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
// RAGDOLL SYSTEM (Verlet Integration)
// ═══════════════════════════════════════════════════════
interface RPoint { pos: V; old: V; acc: V; mass: number; pinned: boolean }
interface RStick { a: number; b: number; len: number; stiff: number }

// Skeleton: 17 points. Feet at y≈0 relative to f.y=GY so they sit ON the ground
function createRagdoll(x: number, y: number) {
  const offsets: V[] = [
    v(0, -108),  // 0 head
    v(0, -93),   // 1 neck
    v(0, -72),   // 2 chest
    v(0, -52),   // 3 belly
    v(0, -36),   // 4 hip
    v(-15, -86), // 5 lShoulder
    v(-28, -64), // 6 lElbow
    v(-35, -46), // 7 lHand
    v(15, -86),  // 8 rShoulder
    v(28, -64),  // 9 rElbow
    v(35, -46),  // 10 rHand
    v(-9, -33),  // 11 lHip
    v(-11, -16), // 12 lKnee
    v(-9, -1),   // 13 lFoot ← ON the ground
    v(9, -33),   // 14 rHip
    v(11, -16),  // 15 rKnee
    v(9, -1),    // 16 rFoot ← ON the ground
  ];
  const pts: RPoint[] = offsets.map(o => ({
    pos: v(x + o.x, y + o.y), old: v(x + o.x, y + o.y),
    acc: v(0, 0), mass: 1, pinned: false,
  }));
  pts[0].mass = 0.8;
  pts[13].mass = 1.5; pts[16].mass = 1.5;

  const sticks: RStick[] = [
    // Spine
    { a: 0, b: 1, len: 15, stiff: 1 },
    { a: 1, b: 2, len: 21, stiff: 1 },
    { a: 2, b: 3, len: 20, stiff: 0.9 },
    { a: 3, b: 4, len: 16, stiff: 0.9 },
    // Left arm
    { a: 1, b: 5, len: 16, stiff: 0.8 },
    { a: 5, b: 6, len: 26, stiff: 0.7 },
    { a: 6, b: 7, len: 20, stiff: 0.6 },
    // Right arm
    { a: 1, b: 8, len: 16, stiff: 0.8 },
    { a: 8, b: 9, len: 26, stiff: 0.7 },
    { a: 9, b: 10, len: 20, stiff: 0.6 },
    // Left leg
    { a: 4, b: 11, len: 10, stiff: 0.9 },
    { a: 11, b: 12, len: 18, stiff: 0.85 },
    { a: 12, b: 13, len: 16, stiff: 0.85 },
    // Right leg
    { a: 4, b: 14, len: 10, stiff: 0.9 },
    { a: 14, b: 15, len: 18, stiff: 0.85 },
    { a: 15, b: 16, len: 16, stiff: 0.85 },
    // Cross braces
    { a: 2, b: 5, len: 20, stiff: 0.5 },
    { a: 2, b: 8, len: 20, stiff: 0.5 },
    { a: 4, b: 11, len: 10, stiff: 0.5 },
    { a: 4, b: 14, len: 10, stiff: 0.5 },
    { a: 0, b: 2, len: 36, stiff: 0.4 },
    { a: 11, b: 14, len: 18, stiff: 0.4 },
    { a: 5, b: 8, len: 30, stiff: 0.4 },
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
    if (p.pos.y > GY) {
      p.pos.y = GY;
      if (vel.y > 0) p.old.y = p.pos.y + vel.y * bounce;
      p.old.x = p.pos.x - vel.x * 0.7;
    }
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
    // Extra ground enforcement after constraints
    for (const p of pts) {
      if (p.pos.y > GY) p.pos.y = GY;
    }
  }
}

// ═══════════════════════════════════════════════════════
// FIGHTER
// ═══════════════════════════════════════════════════════
type FState = 'idle' | 'walk' | 'walkBack' | 'jump' | 'crouch' | 'slash' | 'heavySlash' | 'stab' | 'overhead' | 'jumpAtk' | 'block' | 'hit' | 'stagger' | 'ko' | 'ragdoll' | 'dodge' | 'taunt';

interface Weapon {
  name: string; len: number; weight: number;
  slashDmg: number; stabDmg: number; heavyDmg: number;
  speed: number; color: string; blade: string;
  type: 'sword' | 'axe' | 'spear' | 'greatsword';
}

const WEAPONS: Record<string, Weapon> = {
  longsword:  { name: 'Longsword',  len: 70,  weight: 1,   slashDmg: 14, stabDmg: 11, heavyDmg: 24, speed: 1,   color: '#888', blade: '#ccd', type: 'sword' },
  greatsword: { name: 'Greatsword', len: 95,  weight: 1.8, slashDmg: 20, stabDmg: 14, heavyDmg: 38, speed: 0.6, color: '#777', blade: '#aab', type: 'greatsword' },
  axe:        { name: 'Battle Axe', len: 65,  weight: 1.5, slashDmg: 18, stabDmg: 8,  heavyDmg: 34, speed: 0.7, color: '#654', blade: '#999', type: 'axe' },
  spear:      { name: 'Spear',      len: 110, weight: 0.8, slashDmg: 9,  stabDmg: 20, heavyDmg: 16, speed: 1.2, color: '#876', blade: '#bbc', type: 'spear' },
};

interface AtkDef { frames: number; hitStart: number; hitEnd: number; dmgKey: 'slashDmg' | 'stabDmg' | 'heavyDmg'; kb: V; stCost: number; canSever: boolean }
const ATK: Record<string, AtkDef> = {
  slash:      { frames: 32, hitStart: 9,  hitEnd: 17, dmgKey: 'slashDmg', kb: v(8, -2),  stCost: 14, canSever: true },
  heavySlash: { frames: 50, hitStart: 18, hitEnd: 30, dmgKey: 'heavyDmg', kb: v(16, -8), stCost: 28, canSever: true },
  stab:       { frames: 26, hitStart: 10, hitEnd: 16, dmgKey: 'stabDmg',  kb: v(6, -1),  stCost: 10, canSever: false },
  overhead:   { frames: 46, hitStart: 20, hitEnd: 28, dmgKey: 'heavyDmg', kb: v(12, -14),stCost: 24, canSever: true },
  jumpAtk:    { frames: 30, hitStart: 8,  hitEnd: 20, dmgKey: 'heavyDmg', kb: v(10, -10),stCost: 20, canSever: true },
};

interface Blood { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; sz: number; grounded: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string; sz: number }
interface Pool { x: number; y: number; r: number; a: number }
interface SevLimb { pts: V[]; vel: V; angV: number; ang: number; color: string; w: number; life: number; isHead: boolean }
interface GoreChunk { x: number; y: number; vx: number; vy: number; sz: number; life: number; rot: number; rotV: number; color: string }

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
  };
}

function poseRagdoll(f: Fighter) {
  const r = f.rag;
  const s = f.facing;
  const bob2 = f.state === 'idle' ? Math.sin(f.bob) * 2 : 0;
  const co = f.state === 'crouch' ? 15 : 0;
  const wk = f.state === 'walk' || f.state === 'walkBack' ? f.walkCycle : 0;
  const ap = f.dur > 0 ? f.frame / f.dur : 0;
  const jmp = !f.grounded ? -10 : 0;

  const legSwing = Math.sin(wk) * 8;
  const legBob = Math.cos(wk) * 2;

  const targets: V[] = [
    v(0, -108 + bob2 + co + jmp),
    v(0, -93 + bob2 + co + jmp),
    v(0, -72 + bob2 + co + jmp),
    v(0, -52 + co + jmp),
    v(0, -36 + jmp),
    v(-15 * s, -86 + bob2 + co + jmp),
    v(-28 * s, -64 + bob2 + co + jmp),
    v(-35 * s, -46 + bob2 + co + jmp),
    v(15 * s, -86 + bob2 + co + jmp),
    v(28 * s, -64 + bob2 + co + jmp),
    v(35 * s, -46 + bob2 + co + jmp),
    v(-9 * s, -33 + jmp),
    v((-11 - legSwing) * s, -16 + legBob + jmp),
    v((-9 - legSwing * 1.1) * s, -1),
    v(9 * s, -33 + jmp),
    v((11 + legSwing) * s, -16 - legBob + jmp),
    v((9 + legSwing * 1.1) * s, -1),
  ];

  // Hit reaction
  if (f.hitImpact > 0) {
    const hd = f.hitDir;
    const imp = f.hitImpact;
    for (let i = 0; i < 11; i++) {
      targets[i] = vadd(targets[i], vscl(hd, imp * (1 - i * 0.06)));
    }
  }

  // Dodge roll pose
  if (f.state === 'dodge') {
    const roll = ap * Math.PI * 2;
    for (let i = 0; i < targets.length; i++) {
      targets[i].y += Math.sin(roll) * 20;
      targets[i].x += Math.cos(roll) * 5 * s;
    }
  }

  // Attack arm poses
  if (['slash', 'heavySlash', 'stab', 'overhead', 'jumpAtk'].includes(f.state)) {
    const reach = ap < 0.3 ? -15 : ap < 0.6 ? 28 : 10;
    const lift = ap < 0.3 ? -25 : ap < 0.6 ? 5 : -5;
    targets[9] = v((28 + reach) * s, -64 + lift + bob2 + co + jmp);
    targets[10] = v((35 + reach * 1.3) * s, -46 + lift + bob2 + co + jmp);
  }

  if (f.state === 'block') {
    targets[9] = v(18 * s, -80 + bob2 + co);
    targets[10] = v(22 * s, -62 + bob2 + co);
    targets[6] = v(-8 * s, -74 + bob2 + co);
    targets[7] = v(-3 * s, -58 + bob2 + co);
  }

  // Taunt pose
  if (f.state === 'taunt') {
    targets[9] = v(20 * s, -90 + bob2);
    targets[10] = v(25 * s, -100 + bob2);
    targets[6] = v(-20 * s, -90 + bob2);
    targets[7] = v(-25 * s, -100 + bob2);
  }

  // GROUND CLAMP: No target should place a point below the ground
  for (let i = 0; i < targets.length; i++) {
    if (f.y + targets[i].y > GY) {
      targets[i].y = GY - f.y;
    }
  }

  const blend = f.ragdolling ? 0 : 0.35;
  for (let i = 0; i < r.pts.length && i < targets.length; i++) {
    const target = vadd(v(f.x, f.y), targets[i]);
    r.pts[i].pos = vlerp(r.pts[i].pos, target, blend);
    if (!f.ragdolling) {
      r.pts[i].old = vlerp(r.pts[i].old, target, blend * 0.8);
    }
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
    shake: 0, slowMo: 1, slowTimer: 0,
    round: 1, timer: 99 * 60,
    rs: 'intro' as 'intro' | 'fight' | 'ko',
    introTimer: 100, koTimer: 0,
    keys: new Set<string>(),
  });
  const [hud, setHud] = useState({
    p1hp: 100, p2hp: 100, timer: 99, round: 1,
    p1st: 100, p2st: 100, p1w: 0, p2w: 0,
    rs: 'intro', n1: 'SIEGFRIED', n2: 'NIGHTMARE',
    w1: 'Greatsword', w2: 'Battle Axe',
  });

  const spawnBlood = useCallback((x: number, y: number, dir: number, count: number, power: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.blood.push({
        x: x + rng(-8, 8), y: y - rng(0, 10),
        vx: dir * (2 + rng(0, power * 7)) + rng(-1, 1) * power * 4,
        vy: -(2 + rng(0, power * 8)) + rng(0, 3),
        life: 140 + rng(0, 180), maxLife: 320, sz: 1.5 + rng(0, 4.5) * power,
        grounded: false,
      });
    }
  }, []);

  const spawnGore = useCallback((x: number, y: number, count: number, dir: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.gore.push({
        x, y, vx: dir * rng(2, 10) + rng(-3, 3), vy: -rng(4, 14),
        sz: rng(2, 6), life: 200 + rng(0, 200), rot: rng(0, 6.28), rotV: rng(-0.3, 0.3),
        color: pick(['#600', '#800', '#500', '#711', '#400']),
      });
    }
  }, []);

  const spawnSparks = useCallback((x: number, y: number, count: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.sparks.push({
        x, y, vx: rng(-8, 8) * 2, vy: -(2 + rng(0, 12)),
        life: 8 + rng(0, 14), color: Math.random() > 0.3 ? '#ffa' : '#ff8', sz: 1 + rng(0, 3),
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
      life: 800, isHead: part === 'head',
    });
    // Massive blood fountain
    spawnBlood(f.x, f.y - 60, dir, 70, 4.5);
    spawnBlood(f.x, f.y - 70, -dir * 0.5, 35, 4);
    spawnBlood(f.x, f.y - 65, 0, 25, 3.5);
    // Gore chunks from the wound
    spawnGore(f.x, f.y - 55, 8, dir);
    f.bleedTimer = 500;
    g.shake = 25; g.slowMo = 0.12; g.slowTimer = 35;
  }, [spawnBlood, spawnGore]);

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
    ctx.beginPath();
    ctx.ellipse(p[4].pos.x, GY + 2, 30, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    drawBone(4, 11, 8, f.color);
    drawBone(11, 12, 7, f.color);
    drawBone(12, 13, 6, f.color);
    drawBone(4, 14, 8, f.color);
    drawBone(14, 15, 7, f.color);
    drawBone(15, 16, 6, f.color);
    // Boots
    if (!f.severed.has('leftLeg')) {
      ctx.fillStyle = '#333'; ctx.beginPath();
      ctx.ellipse(p[13].pos.x + 4, Math.min(p[13].pos.y, GY), 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (!f.severed.has('rightLeg')) {
      ctx.fillStyle = '#333'; ctx.beginPath();
      ctx.ellipse(p[16].pos.x + 4, Math.min(p[16].pos.y, GY), 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Torso
    drawBone(1, 2, 12, f.color);
    drawBone(2, 3, 11, f.color);
    drawBone(3, 4, 10, f.color);
    // Armor cross
    const chestMid = vlerp(p[2].pos, p[3].pos, 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p[2].pos.x - 6, p[2].pos.y); ctx.lineTo(p[4].pos.x + 6, p[4].pos.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(chestMid.x - 8, chestMid.y); ctx.lineTo(chestMid.x + 8, chestMid.y); ctx.stroke();

    // Shoulders
    drawBone(1, 5, 7, f.color);
    drawBone(1, 8, 7, f.color);
    // Arms
    drawBone(5, 6, 6, f.skin);
    drawBone(6, 7, 5, f.skin);
    drawBone(8, 9, 6, f.skin);
    drawBone(9, 10, 5, f.skin);
    // Gauntlets
    if (!f.severed.has('leftArm')) {
      ctx.fillStyle = f.color; ctx.beginPath();
      ctx.arc(p[7].pos.x, p[7].pos.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (!f.severed.has('rightArm')) {
      ctx.fillStyle = f.color; ctx.beginPath();
      ctx.arc(p[10].pos.x, p[10].pos.y, 4, 0, Math.PI * 2); ctx.fill();
    }

    // Sever stumps with blood gushing
    ['leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'head'].forEach(part => {
      if (!f.severed.has(part)) return;
      const idx = part === 'leftArm' ? 5 : part === 'rightArm' ? 8 :
        part === 'leftLeg' ? 11 : part === 'rightLeg' ? 14 : 1;
      // Bloody stump
      ctx.fillStyle = '#900'; ctx.beginPath();
      ctx.arc(p[idx].pos.x, p[idx].pos.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#600'; ctx.beginPath();
      ctx.arc(p[idx].pos.x, p[idx].pos.y, 4, 0, Math.PI * 2); ctx.fill();
      // Gushing blood streams
      if (f.bleedTimer > 0) {
        const spurts = 4 + Math.floor(rng(0, 4));
        for (let ss2 = 0; ss2 < spurts; ss2++) {
          const bx = p[idx].pos.x + rng(-8, 8);
          const by = p[idx].pos.y - rng(0, 18);
          ctx.fillStyle = `rgba(220,0,0,${0.4 + rng(0, 0.5)})`;
          ctx.beginPath();
          ctx.arc(bx, by, 1.5 + rng(0, 3.5), 0, Math.PI * 2);
          ctx.fill();
        }
        // Blood stream arc
        ctx.strokeStyle = `rgba(200,0,0,${Math.min(1, f.bleedTimer / 250)})`;
        ctx.lineWidth = 2.5 + rng(0, 2);
        ctx.beginPath();
        ctx.moveTo(p[idx].pos.x, p[idx].pos.y);
        ctx.quadraticCurveTo(
          p[idx].pos.x + rng(-25, 25),
          p[idx].pos.y + 10 + rng(0, 20),
          p[idx].pos.x + rng(-35, 35),
          p[idx].pos.y + 20 + rng(0, 25)
        );
        ctx.stroke();
      }
    });

    // ── WEAPON ──
    if (!f.severed.has('rightArm')) {
      const hand = p[10].pos;
      const ang = f.wAngle * f.facing;
      const wl = f.weapon.len;
      const tipX = hand.x + Math.cos(ang) * wl;
      const tipY = hand.y + Math.sin(ang) * wl;

      const isAtk = ['slash', 'heavySlash', 'overhead', 'stab', 'jumpAtk'].includes(f.state);
      const ap2 = f.dur > 0 ? f.frame / f.dur : 0;
      if (isAtk && ap2 > 0.2 && ap2 < 0.7) {
        ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - Math.abs(ap2 - 0.45) * 4)})`;
        ctx.lineWidth = 16;
        ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();
        ctx.strokeStyle = `rgba(200,200,255,0.1)`;
        ctx.lineWidth = 24;
        ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();
      }

      ctx.strokeStyle = f.weapon.blade;
      ctx.lineWidth = f.weapon.type === 'greatsword' ? 5 : f.weapon.type === 'axe' ? 4 : 3;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hand.x + Math.cos(ang + 0.05) * 5, hand.y + Math.sin(ang + 0.05) * 5);
      ctx.lineTo(tipX + Math.cos(ang + 0.05) * -3, tipY + Math.sin(ang + 0.05) * -3);
      ctx.stroke();
      ctx.strokeStyle = f.weapon.color; ctx.lineWidth = 3;
      const hx = hand.x - Math.cos(ang) * 14, hy = hand.y - Math.sin(ang) * 14;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = '#aa9'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hand.x + Math.sin(ang) * 6, hand.y - Math.cos(ang) * 6);
      ctx.lineTo(hand.x - Math.sin(ang) * 6, hand.y + Math.cos(ang) * 6);
      ctx.stroke();
      if (f.weapon.type === 'axe') {
        const ax = tipX - Math.cos(ang) * 8, ay = tipY - Math.sin(ang) * 8;
        ctx.fillStyle = '#999'; ctx.beginPath();
        ctx.moveTo(ax + Math.sin(ang) * 12, ay - Math.cos(ang) * 12);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(ax - Math.sin(ang) * 12, ay + Math.cos(ang) * 12);
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
        ctx.fillStyle = '#111';
        ctx.fillRect(-7, -4, 3, 4); ctx.fillRect(4, -4, 3, 4);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 6, 5, 0, Math.PI); ctx.stroke(); // grin
      } else {
        const ed = f.facing > 0 ? 1 : -1;
        ctx.fillStyle = '#111';
        ctx.fillRect(-7 * ed - 1, -4, 3, 4); ctx.fillRect(3 * ed, -4, 3, 4);
        ctx.fillStyle = '#eee';
        ctx.fillRect(-7 * ed, -3, 1.5, 1.5); ctx.fillRect(3 * ed + 1, -3, 1.5, 1.5);
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
      return true;
    };
    const doDodge = (f: Fighter, dir: number) => {
      if (f.dodgeCool > 0 || f.stamina < 12) return;
      f.stamina -= 12;
      f.dodgeCool = 25;
      f.vx = dir * 10;
      ss(f, 'dodge' as FState, 18);
    };

    const startRagdoll = (f: Fighter, impulse: V, duration: number) => {
      f.ragdolling = true;
      f.ragTimer = duration;
      f.state = 'ragdoll' as FState;
      f.frame = 0; f.dur = duration;
      for (let i = 0; i < 11; i++) {
        const pt = f.rag.pts[i];
        const imp = vscl(impulse, (1 - i * 0.05) * (0.7 + rng(0, 0.3)));
        pt.old = vsub(pt.pos, imp);
      }
    };

    // ═══════════════════════════════════════════════════════
    // ADVANCED AI SYSTEM - Dual Independent AI
    // ═══════════════════════════════════════════════════════
    type AIStyle = 'berserker' | 'assassin' | 'guardian' | 'wild' | 'tactician' | 'showboat' | 'juggernaut';
    type AIIntent = 'pressure' | 'retreat' | 'circle' | 'feint' | 'punish' | 'bait' | 'rush' | 'rest' | 'jumpAtk' | 'dodgeIn' | 'taunt' | 'executeCombo';

    const mkPersonality = () => ({
      style: pick(['berserker', 'assassin', 'guardian', 'wild', 'tactician', 'showboat', 'juggernaut'] as AIStyle[]),
      aggression: 0.3 + rng(0, 0.7),
      patience: 0.1 + rng(0, 0.9),
      riskTaking: 0.2 + rng(0, 0.8),
      preferredAtk: pick(['slash', 'stab', 'heavySlash', 'overhead'] as const),
      comboChance: 0.3 + rng(0, 0.5),
      dodgeSkill: 0.2 + rng(0, 0.6),
      tauntsAfterKill: rng(0, 1) > 0.5,
    });

    const mkAiMem = () => ({
      intent: 'pressure' as AIIntent,
      intentTimer: 0,
      timesHit: 0,
      consecutiveBlocks: 0,
      circleDir: Math.random() > 0.5 ? 1 : -1,
      styleShiftTimer: 80 + rng(0, 200),
      dashCooldown: 0,
      feinting: false,
      feintTimer: 0,
      comboStep: 0,
      rushMomentum: 0,
      comboSeq: [] as string[],
      lastAtkLanded: false,
      excitement: 0,
    });

    const aiData = [
      { personality: mkPersonality(), mem: mkAiMem() },
      { personality: mkPersonality(), mem: mkAiMem() },
    ];

    const pickIntent = (bot: Fighter, pl: Fighter, p2: ReturnType<typeof mkPersonality>, m: ReturnType<typeof mkAiMem>): AIIntent => {
      const d = Math.abs(bot.x - pl.x);
      const hp = bot.hp / 100, plHp = pl.hp / 100, st = bot.stamina / 100;
      const r = Math.random();

      // Near death
      if (hp < 0.15) return r < 0.5 * p2.riskTaking ? 'rush' : r < 0.8 ? 'dodgeIn' : 'retreat';
      // Smell blood
      if (plHp < 0.2) return r < 0.5 ? 'rush' : r < 0.7 ? 'executeCombo' : 'pressure';
      // Exhausted
      if (st < 0.15) return 'rest';
      // After landing a hit, keep pressing
      if (m.lastAtkLanded && r < 0.6) return r < 0.3 ? 'executeCombo' : 'pressure';
      // High excitement = more aggression
      if (m.excitement > 5) return r < 0.4 ? 'rush' : r < 0.6 ? 'jumpAtk' : 'pressure';

      switch (p2.style) {
        case 'berserker': return pick(['rush', 'pressure', 'pressure', 'executeCombo', 'jumpAtk']);
        case 'assassin': return pick(['feint', 'dodgeIn', 'punish', 'circle', 'stab' as AIIntent]);
        case 'guardian': return pick(['bait', 'circle', 'punish', 'retreat', 'pressure']);
        case 'wild': return pick(['rush', 'pressure', 'feint', 'retreat', 'circle', 'punish', 'bait', 'jumpAtk', 'taunt', 'dodgeIn', 'executeCombo']);
        case 'tactician':
          if (m.timesHit > 3) return 'retreat';
          return d < 100 ? pick(['punish', 'circle', 'dodgeIn']) : pick(['pressure', 'feint', 'bait']);
        case 'showboat': return r < 0.15 ? 'taunt' : pick(['feint', 'pressure', 'executeCombo', 'jumpAtk']);
        case 'juggernaut': return pick(['pressure', 'pressure', 'rush', 'heavySlash' as AIIntent, 'overhead' as AIIntent]);
        default: return 'pressure';
      }
    };

    const AI_COMBOS = [
      ['slash', 'slash', 'stab'],
      ['stab', 'stab', 'slash'],
      ['slash', 'heavySlash'],
      ['stab', 'overhead'],
      ['slash', 'stab', 'heavySlash'],
      ['slash', 'slash', 'overhead'],
    ];

    const ai = (bot: Fighter, pl: Fighter, idx: number) => {
      if (bot.state === 'ko' || bot.state === 'ragdoll') return;

      const pers = aiData[idx].personality;
      const mem = aiData[idx].mem;

      bot.aiTimer--;
      bot.dodgeCool = Math.max(0, bot.dodgeCool - 1);
      mem.dashCooldown = Math.max(0, mem.dashCooldown - 1);
      mem.feintTimer = Math.max(0, mem.feintTimer - 1);
      mem.excitement = Math.max(0, mem.excitement - 0.02);

      // Style shift for unpredictability
      mem.styleShiftTimer--;
      if (mem.styleShiftTimer <= 0) {
        pers.style = pick(['berserker', 'assassin', 'guardian', 'wild', 'tactician', 'showboat', 'juggernaut'] as AIStyle[]);
        pers.aggression = 0.3 + rng(0, 0.7);
        pers.riskTaking = 0.2 + rng(0, 0.8);
        pers.preferredAtk = pick(['slash', 'stab', 'heavySlash', 'overhead'] as const);
        mem.styleShiftTimer = 60 + rng(0, 200);
        mem.circleDir *= -1;
      }

      if (bot.aiTimer > 0) return;
      if (bot.state === 'hit' || bot.state === 'stagger') return;

      const d = Math.abs(bot.x - pl.x);
      const wr = bot.weapon.len + 25;
      const isPlAtk = ['slash', 'heavySlash', 'stab', 'overhead', 'jumpAtk'].includes(pl.state);
      const isPlRecovering = pl.dur > 0 && pl.frame > pl.dur * 0.6;
      const isPlBlocking = pl.state === 'block';
      const st = bot.stamina / 100;
      const atWall = bot.x < 90 || bot.x > W - 90;

      mem.intentTimer--;
      if (mem.intentTimer <= 0) {
        mem.intent = pickIntent(bot, pl, pers, mem);
        mem.intentTimer = 12 + Math.floor(rng(0, 30));
      }

      // ── REACTIVE LAYER ──
      if (isPlAtk && d < 120) {
        const r = Math.random();
        if (r < 0.12) {
          ss(bot, 'block'); bot.aiTimer = 4 + rng(0, 5) | 0;
          mem.consecutiveBlocks++;
          if (mem.consecutiveBlocks >= 2) { mem.intent = 'punish'; mem.intentTimer = 12; mem.consecutiveBlocks = 0; }
          return;
        } else if (r < 0.22 && bot.dodgeCool <= 0 && bot.stamina > 12) {
          doDodge(bot, -bot.facing);
          bot.aiTimer = 3; mem.intent = 'punish'; mem.intentTimer = 10;
          return;
        } else if (r < 0.6 && ca(bot) && st > 0.12) {
          // Trade: attack into their attack
          doAtk(bot, pick(['slash', 'stab', 'heavySlash', 'overhead']));
          bot.aiTimer = 1 + rng(0, 3) | 0;
          return;
        }
      }

      // Punish recovery
      if (isPlRecovering && d < wr + 25 && ca(bot)) {
        doAtk(bot, pick(['slash', 'stab', 'heavySlash']));
        bot.aiTimer = 1 + rng(0, 3) | 0;
        mem.comboStep = 1;
        return;
      }

      // ── INTENT EXECUTION ──
      switch (mem.intent) {
        case 'pressure': {
          if (d > wr + 15) {
            ss(bot, 'walk');
            bot.aiTimer = 1 + rng(0, 3) | 0;
            if (d > 130 && rng(0, 1) < 0.5 && mem.dashCooldown <= 0) {
              bot.vx = bot.facing * (8 + rng(0, 5));
              mem.dashCooldown = 10;
            }
          } else if (ca(bot) && st > 0.1) {
            const r = Math.random();
            if (r < 0.25) doAtk(bot, 'slash');
            else if (r < 0.45) doAtk(bot, 'stab');
            else if (r < 0.65 && bot.stamina > 24) doAtk(bot, 'heavySlash');
            else if (r < 0.8 && bot.stamina > 20) doAtk(bot, 'overhead');
            else doAtk(bot, pers.preferredAtk);
            bot.aiTimer = 2 + rng(0, 4) | 0;
            mem.comboStep++;
            if (mem.comboStep < 4 && rng(0, 1) < pers.comboChance) bot.aiTimer = 1;
            else mem.comboStep = 0;
          } else {
            ss(bot, 'walk'); bot.aiTimer = 1 + rng(0, 3) | 0;
          }
          break;
        }

        case 'executeCombo': {
          if (mem.comboSeq.length === 0) {
            mem.comboSeq = [...pick(AI_COMBOS)];
          }
          if (d > wr + 10) {
            ss(bot, 'walk');
            bot.vx += bot.facing * 4;
            bot.aiTimer = 1 + rng(0, 2) | 0;
          } else if (ca(bot) && mem.comboSeq.length > 0) {
            const next = mem.comboSeq.shift()!;
            if (doAtk(bot, next)) {
              bot.aiTimer = 1 + rng(0, 2) | 0;
            } else {
              mem.comboSeq = [];
              mem.intent = 'retreat';
              mem.intentTimer = 20;
            }
            if (mem.comboSeq.length === 0) {
              mem.intent = rng(0, 1) < 0.5 ? 'pressure' : 'circle';
              mem.intentTimer = 15;
            }
          }
          break;
        }

        case 'retreat': {
          if (d < 160) {
            ss(bot, 'walkBack');
            bot.aiTimer = 2 + rng(0, 4) | 0;
            if (rng(0, 1) < 0.3 && mem.dashCooldown <= 0) {
              bot.vx = -bot.facing * 8; mem.dashCooldown = 10;
            }
          } else {
            mem.intent = rng(0, 1) < 0.6 ? 'pressure' : 'circle';
            mem.intentTimer = 15 + rng(0, 20);
          }
          if (d < wr && ca(bot) && rng(0, 1) < 0.45) {
            doAtk(bot, rng(0, 1) < 0.5 ? 'stab' : 'slash');
            bot.aiTimer = 2;
          }
          break;
        }

        case 'circle': {
          bot.vx = mem.circleDir * 4;
          if (d < 80) bot.vx += -bot.facing * 2.5;
          else if (d > 180) ss(bot, 'walk');
          else ss(bot, rng(0, 1) > 0.5 ? 'walk' : 'walkBack');
          bot.aiTimer = 2 + rng(0, 5) | 0;
          if (rng(0, 1) < 0.15) mem.circleDir *= -1;
          if (d < wr + 5 && rng(0, 1) < 0.45 * pers.aggression && ca(bot)) {
            doAtk(bot, pick(['slash', 'stab', 'heavySlash', 'overhead']));
            bot.aiTimer = 2 + rng(0, 3) | 0;
          }
          break;
        }

        case 'feint': {
          if (d > wr + 30) {
            ss(bot, 'walk'); bot.aiTimer = 1 + rng(0, 3) | 0;
          } else if (mem.feintTimer <= 0) {
            if (!mem.feinting) {
              mem.feinting = true;
              bot.vx = bot.facing * 6;
              ss(bot, 'walk'); bot.aiTimer = 2;
            } else {
              mem.feinting = false;
              mem.feintTimer = 10 + rng(0, 15);
              if (ca(bot) && rng(0, 1) < 0.65) {
                doAtk(bot, rng(0, 1) < 0.5 ? 'slash' : 'stab');
                bot.aiTimer = 1;
              } else {
                bot.vx = -bot.facing * 6; bot.aiTimer = 2;
              }
              if (isPlBlocking || isPlAtk) { mem.intent = 'punish'; mem.intentTimer = 15; }
            }
          } else {
            if (rng(0, 1) < 0.35 && ca(bot) && d < wr) {
              doAtk(bot, 'stab'); bot.aiTimer = 3;
            } else bot.aiTimer = 2 + rng(0, 4) | 0;
          }
          break;
        }

        case 'punish': {
          if (d > wr + 5) {
            ss(bot, 'walk');
            bot.vx += bot.facing * 5;
            bot.aiTimer = 1 + rng(0, 2) | 0;
          } else if (ca(bot)) {
            const r = Math.random();
            if (r < 0.35) doAtk(bot, 'heavySlash');
            else if (r < 0.55) doAtk(bot, 'overhead');
            else if (r < 0.8) doAtk(bot, 'slash');
            else doAtk(bot, 'stab');
            bot.aiTimer = 1 + rng(0, 3) | 0;
          }
          break;
        }

        case 'bait': {
          if (d > 220) {
            ss(bot, 'walk'); bot.aiTimer = 2 + rng(0, 3) | 0;
          } else if (d < 90) {
            ss(bot, 'walkBack'); bot.aiTimer = 2 + rng(0, 3) | 0;
          } else {
            ss(bot, rng(0, 1) < 0.4 ? (rng(0, 1) < 0.5 ? 'walk' : 'walkBack') : 'idle');
            bot.aiTimer = 2 + rng(0, 5) | 0;
            if ((isPlAtk || isPlRecovering) && ca(bot)) {
              doAtk(bot, rng(0, 1) < 0.4 ? 'heavySlash' : 'slash');
              bot.aiTimer = 1;
              mem.intent = 'pressure'; mem.intentTimer = 20;
            }
          }
          break;
        }

        case 'rush': {
          mem.rushMomentum = Math.min(mem.rushMomentum + 1, 12);
          if (d > wr) {
            ss(bot, 'walk');
            bot.vx += bot.facing * (5 + mem.rushMomentum * 0.4);
            if (mem.dashCooldown <= 0 && d > 100) {
              bot.vx = bot.facing * 12; mem.dashCooldown = 8;
            }
            bot.aiTimer = 1 + rng(0, 2) | 0;
          } else if (ca(bot)) {
            doAtk(bot, pick(['slash', 'stab', 'heavySlash', 'overhead']));
            bot.aiTimer = 1 + rng(0, 3) | 0;
            if (rng(0, 1) < 0.7 && bot.stamina > 15) bot.aiTimer = 1;
          }
          if (st < 0.1) { mem.intent = 'retreat'; mem.intentTimer = 25; mem.rushMomentum = 0; }
          break;
        }

        case 'jumpAtk': {
          if (d > wr + 40) {
            ss(bot, 'walk');
            bot.vx += bot.facing * 5;
            bot.aiTimer = 1 + rng(0, 2) | 0;
          } else if (bot.grounded && ca(bot)) {
            bot.vy = -12; bot.grounded = false;
            bot.vx = bot.facing * 6;
            doAtk(bot, 'jumpAtk');
            bot.aiTimer = 3;
            mem.intent = 'pressure'; mem.intentTimer = 20;
          }
          break;
        }

        case 'dodgeIn': {
          if (d > wr + 40 && bot.dodgeCool <= 0 && bot.stamina > 12) {
            doDodge(bot, bot.facing);
            bot.aiTimer = 2;
            mem.intent = 'punish'; mem.intentTimer = 10;
          } else if (d <= wr + 40 && ca(bot)) {
            doAtk(bot, pick(['slash', 'stab']));
            bot.aiTimer = 2;
          } else {
            ss(bot, 'walk'); bot.aiTimer = 2;
          }
          break;
        }

        case 'taunt': {
          if (d > 200) {
            ss(bot, 'taunt' as FState, 40);
            bot.aiTimer = 30;
            mem.excitement += 3;
          }
          mem.intent = 'pressure'; mem.intentTimer = 15;
          break;
        }

        case 'rest': {
          if (d < 140) {
            ss(bot, 'walkBack');
            if (rng(0, 1) < 0.2 && mem.dashCooldown <= 0) {
              bot.vx = -bot.facing * 6; mem.dashCooldown = 12;
            }
          } else ss(bot, 'idle');
          bot.aiTimer = 3 + rng(0, 6) | 0;
          if (isPlAtk && d < 110 && ca(bot)) {
            if (rng(0, 1) < 0.45) { doAtk(bot, 'slash'); bot.aiTimer = 2; }
            else { ss(bot, 'block'); bot.aiTimer = 5; }
          }
          if (st > 0.45) { mem.intent = pickIntent(bot, pl, pers, mem); mem.intentTimer = 25; }
          break;
        }
      }

      // Wall escape
      if (atWall && d < 130) {
        if (rng(0, 1) < 0.4 && bot.grounded) {
          bot.vy = -10; bot.grounded = false;
          bot.vx = bot.x < W / 2 ? 8 : -8;
          bot.aiTimer = 3;
        } else if (rng(0, 1) < 0.3 && bot.dodgeCool <= 0) {
          doDodge(bot, bot.x < W / 2 ? 1 : -1);
          bot.aiTimer = 2;
        } else if (ca(bot)) {
          doAtk(bot, pick(['heavySlash', 'overhead', 'slash']));
          bot.aiTimer = 1;
        }
      }
    };

    const tick = () => {
      fc++;
      const spd = g.slowMo;
      if (g.slowTimer > 0) { g.slowTimer--; if (g.slowTimer <= 0) g.slowMo = 1; }

      const [p1, p2] = g.fighters;

      if (g.rs === 'intro') { g.introTimer--; if (g.introTimer <= 0) g.rs = 'fight'; }
      if (g.rs === 'ko') {
        g.koTimer--;
        if (g.koTimer <= 0) {
          g.round++;
          if (p1.wins >= 2 || p2.wins >= 2 || g.round > 3) { g.round = 1; p1.wins = 0; p2.wins = 0; }
          const wk1 = Object.keys(WEAPONS).find(k => WEAPONS[k].name === p1.weapon.name) || 'greatsword';
          const wk2 = Object.keys(WEAPONS).find(k => WEAPONS[k].name === p2.weapon.name) || 'axe';
          // Randomize weapons each round for variety
          const allWeps = Object.keys(WEAPONS);
          const f1 = mkFighter(350, p1.name, p1.color, p1.skin, p1.hair, rng(0,1)<0.3 ? pick(allWeps) : wk1, true);
          const f2 = mkFighter(930, p2.name, p2.color, p2.skin, p2.hair, rng(0,1)<0.3 ? pick(allWeps) : wk2, true);
          f1.wins = p1.wins; f2.wins = p2.wins;
          g.fighters[0] = f1; g.fighters[1] = f2;
          g.blood = []; g.limbs = []; g.pools = []; g.sparks = []; g.gore = [];
          g.rs = 'intro'; g.introTimer = 80; g.timer = 99 * 60;
          // Reset AI personalities for fresh fights
          aiData[0] = { personality: mkPersonality(), mem: mkAiMem() };
          aiData[1] = { personality: mkPersonality(), mem: mkAiMem() };
        }
      }

      if (g.rs !== 'fight') {
        g.fighters.forEach(f => { if (f.ragdolling) stepRagdoll(f.rag.pts, f.rag.sticks, spd, 0.3); });
        if (fc % 3 === 0) setHud({ p1hp: p1.hp, p2hp: p2.hp, timer: Math.ceil(g.timer / 60), round: g.round, p1st: p1.stamina, p2st: p2.stamina, p1w: p1.wins, p2w: p2.wins, rs: g.rs, n1: p1.name, n2: p2.name, w1: p1.weapon.name, w2: p2.weapon.name });
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
        else if (g.keys.has('s') && g.keys.has('shift')) { ss(p1, 'block'); p1HasInput = true; }
        else if (g.keys.has('s')) { ss(p1, 'crouch'); p1HasInput = true; }
        else if (g.keys.has('w') && p1.grounded) { p1.vy = -11; p1.grounded = false; ss(p1, 'jump'); p1HasInput = true; }
        else if (g.keys.has('a')) { p1.vx = -3.5; if (p1.grounded) ss(p1, p1.facing === -1 ? 'walk' : 'walkBack'); p1HasInput = true; }
        else if (g.keys.has('d')) { p1.vx = 3.5; if (p1.grounded) ss(p1, p1.facing === 1 ? 'walk' : 'walkBack'); p1HasInput = true; }
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
            if (f.state === 'ragdoll') {
              f.ragTimer -= spd;
              if (f.ragTimer <= 0 && f.hp > 0) { f.ragdolling = false; ss(f, 'idle'); }
            } else if (f.state !== 'ko') ss(f, 'idle');
          }
        }

        if (f.ragdolling && f.state === 'ragdoll') {
          f.ragTimer -= spd;
          if (f.ragTimer <= 0 && f.hp > 0) { f.ragdolling = false; ss(f, 'idle'); }
        }

        if (ca(f) || f.state === 'block') f.stamina = Math.min(100, f.stamina + 0.15);
        f.dodgeCool = Math.max(0, f.dodgeCool - spd);

        if (!f.grounded) {
          f.vy += GRAV * spd;
          f.y += f.vy * spd;
          if (f.y >= GY) { f.y = GY; f.vy = 0; f.grounded = true; if (f.state === 'jump') ss(f, 'idle'); }
        }

        f.x += f.vx * spd;
        f.vx *= 0.86;
        if (f.state === 'walk') { f.x += f.facing * 3.2 * spd; f.walkCycle += 0.14 * spd; }
        else if (f.state === 'walkBack') { f.x -= f.facing * 2.2 * spd; f.walkCycle += 0.1 * spd; }
        f.x = clamp(f.x, 50, W - 50);
        f.bob += 0.04 * spd;

        if (f.hitImpact > 0) f.hitImpact *= 0.84;

        const ap2 = f.dur > 0 ? f.frame / f.dur : 0;
        if (f.state === 'slash') f.wTarget = ap2 < 0.3 ? -2.0 : ap2 < 0.55 ? 1.5 : 0.3;
        else if (f.state === 'heavySlash') f.wTarget = ap2 < 0.35 ? -2.5 : ap2 < 0.6 ? 2.2 : 0.2;
        else if (f.state === 'stab') f.wTarget = ap2 < 0.3 ? -0.3 : ap2 < 0.55 ? 0.15 : -0.3;
        else if (f.state === 'overhead') f.wTarget = ap2 < 0.4 ? -2.8 : ap2 < 0.6 ? 2.0 : -0.2;
        else if (f.state === 'jumpAtk') f.wTarget = ap2 < 0.25 ? -2.5 : ap2 < 0.65 ? 2.5 : 0.5;
        else f.wTarget = f.state === 'block' ? -1.3 : -0.5;
        f.wAngle += (f.wTarget - f.wAngle) * 0.22;

        // Bleed from stumps
        if (f.bleedTimer > 0) {
          f.bleedTimer -= spd;
          f.hp -= 0.025 * spd;
          if (fc % 3 === 0) {
            for (const part of f.severed) {
              const idx2 = part === 'leftArm' ? 5 : part === 'rightArm' ? 8 :
                part === 'leftLeg' ? 11 : part === 'rightLeg' ? 14 : 1;
              if (f.rag.pts[idx2]) {
                spawnBlood(f.rag.pts[idx2].pos.x, f.rag.pts[idx2].pos.y, rng(-1.5, 1.5), 4, 2.5);
              }
            }
          }
        }

        if (f.comboTimer > 0) { f.comboTimer -= spd; if (f.comboTimer <= 0) f.combo = 0; }

        // Ragdoll physics
        if (f.ragdolling) {
          stepRagdoll(f.rag.pts, f.rag.sticks, spd, 0.3);
          f.x = f.rag.pts[4].pos.x;
          f.y = Math.min(GY, f.rag.pts[4].pos.y);
        } else {
          poseRagdoll(f);
          stepRagdoll(f.rag.pts, f.rag.sticks, spd * 0.5, 0.2);
        }

        if (f.hp <= 0 && f.state !== 'ko') {
          f.hp = 0; ss(f, 'ko');
          startRagdoll(f, v(f.facing * -5, -6), 999);
          o.wins++; g.rs = 'ko'; g.koTimer = 250; g.shake = 15;
        }
      });

      // Body collision
      const dx = g.fighters[1].x - g.fighters[0].x;
      const dist = Math.abs(dx);
      if (dist < 50 && dist > 0) {
        const push = (50 - dist) / 2;
        const dir = dx > 0 ? 1 : -1;
        g.fighters[0].x -= push * dir;
        g.fighters[1].x += push * dir;
        g.fighters.forEach(f => f.x = clamp(f.x, 50, W - 50));
      }

      // ── HIT DETECTION ──
      g.fighters.forEach((f, idx) => {
        const o = g.fighters[1 - idx];
        const ad = ATK[f.state];
        if (!ad || f.hitDealt) return;
        if (f.state === 'dodge') return;
        const hs = Math.round(ad.hitStart / f.weapon.speed);
        const he = Math.round(ad.hitEnd / f.weapon.speed);
        if (f.frame < hs || f.frame > he) return;

        const hand = f.rag.pts[10].pos;
        const ang = f.wAngle * f.facing;
        const tipX = hand.x + Math.cos(ang) * f.weapon.len * 0.8;
        const tipY = hand.y + Math.sin(ang) * f.weapon.len * 0.8;

        let hitPt: V | null = null;
        let hitJoint = -1;
        // Skip dodging opponents
        if (o.state === 'dodge') return;
        
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
          const dmg = f.weapon[ad.dmgKey];
          const hitDir2 = v(f.facing, -0.3);

          // Track hit in AI memory
          if (aiData[idx]) aiData[idx].mem.lastAtkLanded = true;
          if (aiData[idx]) aiData[idx].mem.excitement += 2;
          if (aiData[1 - idx]) aiData[1 - idx].mem.timesHit++;
          if (aiData[1 - idx]) aiData[1 - idx].mem.lastAtkLanded = false;

          if (o.state === 'block' && o.stamina > 5) {
            o.vx = f.facing * ad.kb.x * 0.3;
            o.stamina -= dmg * 0.7;
            spawnSparks((f.x + o.x) / 2, hitPt.y, 12);
            g.shake = 4;
            for (let i = 0; i < 5; i++) {
              o.rag.pts[i].old = vsub(o.rag.pts[i].pos, vscl(hitDir2, -2.5));
            }
          } else {
            f.combo++; f.comboTimer = 80;
            let finalDmg = dmg;
            if (f.combo > 1) finalDmg *= (1 + f.combo * 0.15);

            o.hp = Math.max(0, o.hp - finalDmg);
            o.vx = f.facing * ad.kb.x;
            o.vy = ad.kb.y;
            if (ad.kb.y < -4) o.grounded = false;

            o.hitDir = vnorm(hitDir2);
            o.hitImpact = dmg * 0.6;

            const impForce = dmg * 0.4;
            for (let i = 0; i < o.rag.pts.length; i++) {
              const dd = vlen(vsub(o.rag.pts[i].pos, hitPt));
              if (dd < 90) {
                const falloff = 1 - dd / 90;
                const imp = vscl(hitDir2, impForce * falloff);
                o.rag.pts[i].old = vsub(o.rag.pts[i].pos, imp);
              }
            }

            if (dmg >= 18) {
              startRagdoll(o, vscl(hitDir2, dmg * 0.5), 35 + dmg);
              g.shake = 12; g.slowMo = 0.25; g.slowTimer = 14;
            } else {
              ss(o, dmg >= 13 ? 'stagger' : 'hit', dmg >= 13 ? 25 : 14);
              g.shake = 6;
            }

            // MASSIVE blood
            spawnBlood(hitPt.x, hitPt.y, f.facing, Math.round(dmg * 2), dmg / 7);
            spawnBlood(hitPt.x, hitPt.y - 12, f.facing * -0.5, Math.round(dmg * 1.2), dmg / 9);
            spawnBlood(hitPt.x, hitPt.y + 5, 0, Math.round(dmg * 0.5), dmg / 10);
            if (hitJoint >= 0 && hitJoint < o.rag.pts.length) {
              spawnBlood(o.rag.pts[hitJoint].pos.x, o.rag.pts[hitJoint].pos.y, f.facing, 15, 2.5);
              spawnBlood(o.rag.pts[hitJoint].pos.x, o.rag.pts[hitJoint].pos.y - 8, 0, 8, 2);
            }
            // Gore chunks on heavy hits
            if (dmg >= 15) spawnGore(hitPt.x, hitPt.y, Math.round(dmg / 5), f.facing);

            // Dismemberment - very frequent
            if (o.hp < 65 && rng(0, 1) < 0.45) {
              const parts = ['leftArm', 'rightArm'].filter(p3 => !o.severed.has(p3));
              if (o.hp < 40) parts.push(...['leftLeg', 'rightLeg'].filter(p3 => !o.severed.has(p3)));
              if (o.hp < 12) parts.push('head');
              if (parts.length > 0) {
                sever(o, pick(parts), f.facing);
                if (rng(0, 1) < 0.35) {
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
              g.shake = 35; g.slowMo = 0.06; g.slowTimer = 50;
              // Massive blood explosion
              spawnBlood(hitPt.x, hitPt.y, f.facing, 100, 6);
              spawnBlood(hitPt.x, hitPt.y - 25, -f.facing, 50, 5);
              spawnBlood(hitPt.x, hitPt.y - 50, 0, 40, 4);
              spawnBlood(hitPt.x + f.facing * 20, hitPt.y - 35, f.facing * 0.5, 30, 5);
              spawnGore(hitPt.x, hitPt.y, 15, f.facing);
              // ALWAYS sever head + limbs
              if (!o.severed.has('head')) sever(o, 'head', f.facing);
              const lp = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].filter(p3 => !o.severed.has(p3));
              if (lp.length > 0) sever(o, pick(lp), f.facing);
              if (lp.length > 1 && rng(0, 1) < 0.7) {
                const rem = lp.filter(p3 => !o.severed.has(p3));
                if (rem.length > 0) sever(o, pick(rem), f.facing);
              }
            }
          }
        }
      });

      // Update blood
      g.blood = g.blood.filter(b => {
        if (b.grounded) { b.life -= spd * 0.15; return b.life > 0; }
        b.x += b.vx * spd; b.y += b.vy * spd;
        b.vy += 0.35 * spd; b.vx *= 0.99; b.life -= spd;
        if (b.y >= GY) {
          b.grounded = true; b.y = GY; b.vy = 0; b.vx = 0;
          if (g.pools.length < 150) {
            const ex = g.pools.find(p3 => Math.abs(p3.x - b.x) < 25);
            if (ex) ex.r = Math.min(50, ex.r + 1.2);
            else g.pools.push({ x: b.x, y: GY, r: 3 + rng(0, 7), a: 0.8 });
          }
        }
        return b.life > 0;
      });

      g.sparks = g.sparks.filter(s => { s.x += s.vx * spd; s.y += s.vy * spd; s.vy += 0.4 * spd; s.life -= spd; return s.life > 0; });
      g.gore = g.gore.filter(gc => {
        gc.x += gc.vx * spd; gc.y += gc.vy * spd;
        gc.vy += 0.3 * spd; gc.rot += gc.rotV * spd;
        if (gc.y >= GY) { gc.y = GY; gc.vy *= -0.3; gc.vx *= 0.6; gc.rotV *= 0.5; }
        gc.life -= spd; return gc.life > 0;
      });
      g.limbs = g.limbs.filter(l => {
        l.pts.forEach(p3 => { p3.x += l.vel.x * spd; p3.y += l.vel.y * spd; });
        l.vel.y += 0.3 * spd; l.ang += l.angV * spd;
        if (l.pts[0] && l.pts[0].y >= GY) { l.vel.x *= 0.7; l.vel.y *= -0.2; l.angV *= 0.7; l.pts[0].y = GY; }
        l.life -= spd;
        // Severed head/limbs leave blood trail
        if (l.life > 100 && l.pts[0] && l.pts[0].y < GY && fc % 4 === 0) {
          spawnBlood(l.pts[0].x, l.pts[0].y, rng(-1, 1), 2, 1.5);
        }
        return l.life > 0;
      });
      g.pools.forEach(p3 => p3.a = Math.max(0.08, p3.a - 0.0002));
      if (g.shake > 0) g.shake *= 0.87;

      if (fc % 3 === 0) setHud({ p1hp: p1.hp, p2hp: p2.hp, timer: Math.ceil(g.timer / 60), round: g.round, p1st: p1.stamina, p2st: p2.stamina, p1w: p1.wins, p2w: p2.wins, rs: g.rs, n1: p1.name, n2: p2.name, w1: p1.weapon.name, w2: p2.weapon.name });
    };

    // ── RENDER ──
    const render = () => {
      tick();
      const shk = g.shake;
      const sx = shk > 0.5 ? rng(-1, 1) * shk * 2 : 0;
      const sy = shk > 0.5 ? rng(-1, 1) * shk * 2 : 0;
      ctx.save(); ctx.translate(sx, sy);

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, GY);
      sky.addColorStop(0, '#040410'); sky.addColorStop(0.5, '#0a0a20'); sky.addColorStop(1, '#141430');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GY);

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 45; i++) ctx.fillRect((i * 137 + 30) % W, (i * 73 + 10) % (GY * 0.5), 1 + (i % 2), 1 + (i % 2));

      ctx.fillStyle = 'rgba(160,140,120,0.07)';
      ctx.beginPath(); ctx.arc(180, 110, 55, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#0b0b1a'; ctx.beginPath(); ctx.moveTo(0, GY);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, GY - 90 - Math.sin(x * 0.006) * 50 - Math.sin(x * 0.014) * 25);
      ctx.lineTo(W, GY); ctx.fill();

      ctx.fillStyle = '#070714';
      ctx.fillRect(500, GY - 230, 280, 230);
      ctx.beginPath(); ctx.moveTo(480, GY - 230); ctx.lineTo(640, GY - 320); ctx.lineTo(800, GY - 230); ctx.fill();
      ctx.fillRect(505, GY - 290, 30, 290); ctx.fillRect(745, GY - 270, 30, 270);
      ctx.fillStyle = '#1a0808';
      [540, 610, 680, 740].forEach(wx => { ctx.fillRect(wx, GY - 175, 14, 18); ctx.fillRect(wx, GY - 125, 14, 18); });

      // Ground
      const gnd = ctx.createLinearGradient(0, GY - 3, 0, H);
      gnd.addColorStop(0, '#1a1008'); gnd.addColorStop(1, '#0a0604');
      ctx.fillStyle = gnd; ctx.fillRect(0, GY - 3, W, H - GY + 3);
      ctx.strokeStyle = '#3a2a15'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, GY); ctx.lineTo(W, GY); ctx.stroke();

      // Blood pools
      g.pools.forEach(p3 => {
        ctx.fillStyle = `rgba(130,0,0,${p3.a})`;
        ctx.beginPath(); ctx.ellipse(p3.x, p3.y + 2, p3.r, p3.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(90,0,0,${p3.a * 0.6})`;
        ctx.beginPath(); ctx.ellipse(p3.x, p3.y + 2, p3.r * 0.5, p3.r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      });

      // Severed limbs
      g.limbs.forEach(l => {
        if (l.pts.length === 0) return;
        ctx.save(); ctx.translate(l.pts[0].x, l.pts[0].y); ctx.rotate(l.ang);
        if (l.isHead) {
          // Render severed head with face
          ctx.fillStyle = l.color;
          ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = '#111';
          ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-2, 1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(2, 1); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 6, 4, 0, Math.PI); ctx.stroke();
          // Blood drip from neck
          ctx.fillStyle = '#800';
          ctx.beginPath(); ctx.arc(0, 12, 5, 0, Math.PI * 2); ctx.fill();
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
        ctx.restore();
      });

      // Gore chunks
      g.gore.forEach(gc => {
        ctx.save(); ctx.translate(gc.x, gc.y); ctx.rotate(gc.rot);
        ctx.fillStyle = gc.color;
        ctx.fillRect(-gc.sz / 2, -gc.sz / 2, gc.sz, gc.sz);
        ctx.restore();
      });

      // Fighters
      g.fighters.forEach(f => drawFighter(ctx, f, fc));

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
        }
      });

      // Sparks
      g.sparks.forEach(s => {
        ctx.globalAlpha = s.life / 20; ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.sz * (s.life / 20), 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Intro
      if (g.rs === 'intro') {
        const p3 = 1 - g.introTimer / 80;
        ctx.fillStyle = `rgba(0,0,0,${0.6 * (1 - p3)})`; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2 - 50);
        ctx.scale(0.5 + p3 * 0.5, 0.5 + p3 * 0.5);
        ctx.font = 'bold 60px Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#a88'; ctx.globalAlpha = Math.min(1, p3 * 3);
        ctx.fillText(`ROUND ${g.round}`, 0, 0);
        if (p3 > 0.5) { ctx.font = 'bold 40px Georgia, serif'; ctx.fillStyle = '#c44'; ctx.globalAlpha = (p3 - 0.5) * 2; ctx.fillText('FIGHT!', 0, 50); }
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
        ctx.fillStyle = '#200'; ctx.fillText('K.O.', 3, 3);
        ctx.fillStyle = '#a00'; ctx.fillText('K.O.', 0, 0);
        // Combo count
        const winner = g.fighters.find(f => f.hp > 0);
        if (winner && winner.combo > 2) {
          ctx.font = 'bold 30px Georgia, serif';
          ctx.fillStyle = '#ff4';
          ctx.fillText(`${winner.combo} HIT COMBO!`, 0, 50);
        }
        ctx.restore();
      }

      ctx.restore();
      aid = requestAnimationFrame(render);
    };
    aid = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(aid); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [drawFighter, spawnBlood, spawnSparks, sever, spawnGore]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black select-none">
      <canvas ref={canvasRef} width={W} height={H} className="max-w-full max-h-full" />
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ maxWidth: W, margin: '0 auto' }}>
        <div className="flex items-start justify-between p-3 gap-3">
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-bold text-red-400 font-mono tracking-widest">{hud.n1}</span>
              <span className="text-[9px] text-red-400/40 font-mono">{hud.w1}</span>
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
        WASD Move • J Slash • K Stab • L Heavy • U Overhead • S+Shift Block
      </div>
    </div>
  );
};

export default RagdollArena;
