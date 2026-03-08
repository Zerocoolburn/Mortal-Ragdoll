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

// ═══════════════════════════════════════════════════════
// RAGDOLL SYSTEM (Verlet Integration)
// ═══════════════════════════════════════════════════════
interface RPoint { pos: V; old: V; acc: V; mass: number; pinned: boolean }
interface RStick { a: number; b: number; len: number; stiff: number }

function createRagdoll(x: number, y: number) {
  // 16 points: head, neck, chest, belly, hip,
  // lShoulder, lElbow, lHand, rShoulder, rElbow, rHand,
  // lHip, lKnee, lFoot, rHip, rKnee, rFoot
  const offsets: V[] = [
    v(0, -95),   // 0 head
    v(0, -78),   // 1 neck
    v(0, -58),   // 2 chest
    v(0, -38),   // 3 belly
    v(0, -20),   // 4 hip
    v(-16, -72), // 5 lShoulder
    v(-30, -52), // 6 lElbow
    v(-38, -36), // 7 lHand
    v(16, -72),  // 8 rShoulder
    v(30, -52),  // 9 rElbow
    v(38, -36),  // 10 rHand
    v(-10, -18), // 11 lHip
    v(-14, 8),   // 12 lKnee
    v(-14, 38),  // 13 lFoot
    v(10, -18),  // 14 rHip
    v(14, 8),    // 15 rKnee
    v(14, 38),   // 16 rFoot
  ];
  const pts: RPoint[] = offsets.map(o => ({
    pos: v(x + o.x, y + o.y), old: v(x + o.x, y + o.y),
    acc: v(0, 0), mass: 1, pinned: false,
  }));
  // Head lighter, feet heavier
  pts[0].mass = 0.8;
  pts[13].mass = 1.5; pts[16].mass = 1.5;

  const sticks: RStick[] = [
    // Spine
    { a: 0, b: 1, len: 17, stiff: 1 },
    { a: 1, b: 2, len: 20, stiff: 1 },
    { a: 2, b: 3, len: 20, stiff: 0.9 },
    { a: 3, b: 4, len: 18, stiff: 0.9 },
    // Left arm
    { a: 1, b: 5, len: 16, stiff: 0.8 },
    { a: 5, b: 6, len: 22, stiff: 0.7 },
    { a: 6, b: 7, len: 18, stiff: 0.6 },
    // Right arm
    { a: 1, b: 8, len: 16, stiff: 0.8 },
    { a: 8, b: 9, len: 22, stiff: 0.7 },
    { a: 9, b: 10, len: 18, stiff: 0.6 },
    // Left leg
    { a: 4, b: 11, len: 10, stiff: 0.9 },
    { a: 11, b: 12, len: 28, stiff: 0.8 },
    { a: 12, b: 13, len: 30, stiff: 0.8 },
    // Right leg
    { a: 4, b: 14, len: 10, stiff: 0.9 },
    { a: 14, b: 15, len: 28, stiff: 0.8 },
    { a: 15, b: 16, len: 30, stiff: 0.8 },
    // Cross braces for stability
    { a: 2, b: 5, len: 20, stiff: 0.5 },
    { a: 2, b: 8, len: 20, stiff: 0.5 },
    { a: 4, b: 11, len: 12, stiff: 0.5 },
    { a: 4, b: 14, len: 12, stiff: 0.5 },
    { a: 0, b: 2, len: 37, stiff: 0.4 }, // head-chest brace
    { a: 11, b: 14, len: 20, stiff: 0.4 }, // hip width
    { a: 5, b: 8, len: 32, stiff: 0.4 }, // shoulder width
  ];

  return { pts, sticks };
}

function stepRagdoll(pts: RPoint[], sticks: RStick[], dt: number, bounce: number) {
  // Verlet integration
  for (const p of pts) {
    if (p.pinned) continue;
    const vel = vsub(p.pos, p.old);
    p.old = { ...p.pos };
    p.pos = vadd(p.pos, vadd(vscl(vel, 0.98), vscl(p.acc, dt * dt)));
    p.acc = v(0, GRAV * p.mass); // reset to gravity

    // Ground collision
    if (p.pos.y > GY) {
      p.pos.y = GY;
      if (vel.y > 0) p.old.y = p.pos.y + vel.y * bounce;
      p.old.x = p.pos.x - vel.x * 0.7; // friction
    }
    // Walls
    p.pos.x = clamp(p.pos.x, 30, W - 30);
  }

  // Constraint solving (multiple iterations for stiffness)
  for (let iter = 0; iter < 5; iter++) {
    for (const s of sticks) {
      const a = pts[s.a], b = pts[s.b];
      const delta = vsub(b.pos, a.pos);
      const dist = vlen(delta) || 0.01;
      const diff = (s.len - dist) / dist * s.stiff;
      const offset = vscl(delta, diff * 0.5);
      if (!a.pinned) a.pos = vsub(a.pos, offset);
      if (!b.pinned) b.pos = vadd(b.pos, offset);
    }
  }
}

// ═══════════════════════════════════════════════════════
// FIGHTER
// ═══════════════════════════════════════════════════════
type FState = 'idle' | 'walk' | 'walkBack' | 'jump' | 'crouch' | 'slash' | 'heavySlash' | 'stab' | 'overhead' | 'block' | 'hit' | 'stagger' | 'ko' | 'ragdoll';

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
  slash:      { frames: 35, hitStart: 10, hitEnd: 18, dmgKey: 'slashDmg', kb: v(7, -2),  stCost: 15, canSever: false },
  heavySlash: { frames: 55, hitStart: 20, hitEnd: 32, dmgKey: 'heavyDmg', kb: v(14, -6), stCost: 30, canSever: true },
  stab:       { frames: 30, hitStart: 12, hitEnd: 18, dmgKey: 'stabDmg',  kb: v(5, -1),  stCost: 12, canSever: false },
  overhead:   { frames: 50, hitStart: 22, hitEnd: 30, dmgKey: 'heavyDmg', kb: v(10, -12),stCost: 25, canSever: true },
};

interface Blood { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; sz: number; grounded: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string; sz: number }
interface Pool { x: number; y: number; r: number; a: number }
interface SevLimb { pts: V[]; vel: V; angV: number; ang: number; color: string; w: number; life: number }

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
  // Ragdoll
  rag: { pts: RPoint[]; sticks: RStick[] };
  ragdolling: boolean;
  ragTimer: number;
  // Dismemberment
  severed: Set<string>;
  bleedTimer: number;
  // Weapon
  wAngle: number; wTarget: number;
  hitDealt: boolean;
  // Hit impact direction for body reaction
  hitDir: V;
  hitImpact: number;
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
    hitDir: v(), hitImpact: 0,
  };
}

// Position ragdoll to match animated pose
function poseRagdoll(f: Fighter) {
  const r = f.rag;
  const s = f.facing;
  const bob2 = f.state === 'idle' ? Math.sin(f.bob) * 2 : 0;
  const co = f.state === 'crouch' ? 20 : 0;
  const wk = f.state === 'walk' || f.state === 'walkBack' ? f.walkCycle : 0;
  const ap = f.dur > 0 ? f.frame / f.dur : 0;

  // Target positions relative to hip
  const targets: V[] = [
    v(0, -95 + bob2 + co),     // head
    v(0, -78 + bob2 + co),     // neck
    v(0, -58 + bob2 + co),     // chest
    v(0, -38 + co),            // belly
    v(0, -20),                 // hip
    v(-16 * s, -72 + bob2 + co), // lShoulder
    v(-30 * s, -52 + bob2 + co), // lElbow
    v(-38 * s, -36 + bob2 + co), // lHand
    v(16 * s, -72 + bob2 + co),  // rShoulder
    v(30 * s, -52 + bob2 + co),  // rElbow
    v(38 * s, -36 + bob2 + co),  // rHand
    v(-10 * s, -18),            // lHip
    v((-14 - Math.sin(wk) * 18) * s, 8 + Math.cos(wk) * 3), // lKnee
    v((-14 - Math.sin(wk) * 22) * s, 38),                     // lFoot
    v(10 * s, -18),             // rHip
    v((14 + Math.sin(wk) * 18) * s, 8 - Math.cos(wk) * 3),  // rKnee
    v((14 + Math.sin(wk) * 22) * s, 38),                      // rFoot
  ];

  // Hit reaction: offset body parts based on impact
  if (f.hitImpact > 0) {
    const hd = f.hitDir;
    const imp = f.hitImpact;
    // Upper body reacts more
    for (let i = 0; i < 11; i++) {
      targets[i] = vadd(targets[i], vscl(hd, imp * (1 - i * 0.06)));
    }
  }

  // Attack arm poses
  if (f.state === 'slash' || f.state === 'heavySlash' || f.state === 'stab' || f.state === 'overhead') {
    const reach = ap < 0.3 ? -15 : ap < 0.6 ? 25 : 10;
    const lift = ap < 0.3 ? -20 : ap < 0.6 ? 5 : -5;
    targets[9] = v((30 + reach) * s, -52 + lift + bob2 + co);
    targets[10] = v((38 + reach * 1.3) * s, -36 + lift + bob2 + co);
  }

  if (f.state === 'block') {
    targets[9] = v(20 * s, -65 + bob2 + co);
    targets[10] = v(25 * s, -50 + bob2 + co);
    targets[6] = v(-10 * s, -60 + bob2 + co);
    targets[7] = v(-5 * s, -48 + bob2 + co);
  }

  // Blend ragdoll points toward targets
  const blend = f.ragdolling ? 0 : 0.3;
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
        x: x + (Math.random() - 0.5) * 12, y: y - Math.random() * 10,
        vx: dir * (2 + Math.random() * power * 6) + (Math.random() - 0.5) * power * 5,
        vy: -(2 + Math.random() * power * 7) + Math.random() * 3,
        life: 120 + Math.random() * 160, maxLife: 280, sz: 1.5 + Math.random() * 4 * power,
        grounded: false,
      });
    }
  }, []);

  const spawnSparks = useCallback((x: number, y: number, count: number) => {
    const g = G.current;
    for (let i = 0; i < count; i++) {
      g.sparks.push({
        x, y, vx: (Math.random() - 0.5) * 16, vy: -(2 + Math.random() * 10),
        life: 8 + Math.random() * 12, color: Math.random() > 0.3 ? '#ffa' : '#ff8', sz: 1 + Math.random() * 2.5,
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
      pts, vel: v(dir * (5 + Math.random() * 12), -(8 + Math.random() * 12)),
      angV: (Math.random() - 0.5) * 0.6, ang: 0,
      color: part === 'head' ? f.skin : f.color,
      w: part.includes('Leg') ? 7 : part === 'head' ? 14 : 5,
      life: 600,
    });
    // Massive blood fountain from severed point
    spawnBlood(f.x, f.y - 50, dir, 60, 4);
    spawnBlood(f.x, f.y - 60, -dir * 0.5, 30, 3.5);
    spawnBlood(f.x, f.y - 55, 0, 20, 3);
    f.bleedTimer = 400;
    g.shake = 20; g.slowMo = 0.15; g.slowTimer = 30;
  }, [spawnBlood]);

  // ─── DRAW FIGHTER (from ragdoll points) ───────────────
  const drawFighter = useCallback((ctx: CanvasRenderingContext2D, f: Fighter, t: number) => {
    const p = f.rag.pts;

    // Draw bones as thick lines
    const drawBone = (a: number, b: number, w: number, col: string) => {
      if (f.severed.has('leftArm') && [5, 6, 7].includes(a) && [5, 6, 7].includes(b)) return;
      if (f.severed.has('rightArm') && [8, 9, 10].includes(a) && [8, 9, 10].includes(b)) return;
      if (f.severed.has('leftLeg') && [11, 12, 13].includes(a) && [11, 12, 13].includes(b)) return;
      if (f.severed.has('rightLeg') && [14, 15, 16].includes(a) && [14, 15, 16].includes(b)) return;
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p[a].pos.x, p[a].pos.y); ctx.lineTo(p[b].pos.x, p[b].pos.y); ctx.stroke();
    };

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(p[4].pos.x, GY + 2, 28, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    drawBone(4, 11, 8, f.color);   // hip-lhip
    drawBone(11, 12, 7, f.color);  // lhip-lknee
    drawBone(12, 13, 6, f.color);  // lknee-lfoot
    drawBone(4, 14, 8, f.color);   // hip-rhip
    drawBone(14, 15, 7, f.color);  // rhip-rknee
    drawBone(15, 16, 6, f.color);  // rknee-rfoot
    // Boots
    if (!f.severed.has('leftLeg')) {
      ctx.fillStyle = '#333'; ctx.beginPath();
      ctx.ellipse(p[13].pos.x + 4, p[13].pos.y, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (!f.severed.has('rightLeg')) {
      ctx.fillStyle = '#333'; ctx.beginPath();
      ctx.ellipse(p[16].pos.x + 4, p[16].pos.y, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Torso
    drawBone(1, 2, 12, f.color); // neck-chest
    drawBone(2, 3, 11, f.color); // chest-belly
    drawBone(3, 4, 10, f.color); // belly-hip
    // Armor details on torso
    const chestMid = vlerp(p[2].pos, p[3].pos, 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p[2].pos.x, p[2].pos.y); ctx.lineTo(p[4].pos.x, p[4].pos.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(chestMid.x - 8, chestMid.y);
    ctx.lineTo(chestMid.x + 8, chestMid.y);
    ctx.stroke();

    // Shoulders
    drawBone(1, 5, 7, f.color);   // neck-lshoulder
    drawBone(1, 8, 7, f.color);   // neck-rshoulder

    // Arms
    drawBone(5, 6, 6, f.skin);    // lshoulder-lelbow
    drawBone(6, 7, 5, f.skin);    // lelbow-lhand
    drawBone(8, 9, 6, f.skin);    // rshoulder-relbow
    drawBone(9, 10, 5, f.skin);   // relbow-rhand
    // Gauntlets
    if (!f.severed.has('leftArm')) {
      ctx.fillStyle = f.color; ctx.beginPath();
      ctx.arc(p[7].pos.x, p[7].pos.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (!f.severed.has('rightArm')) {
      ctx.fillStyle = f.color; ctx.beginPath();
      ctx.arc(p[10].pos.x, p[10].pos.y, 4, 0, Math.PI * 2); ctx.fill();
    }

    // Sever stumps
    ['leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'head'].forEach(part => {
      if (!f.severed.has(part)) return;
      const idx = part === 'leftArm' ? 5 : part === 'rightArm' ? 8 :
        part === 'leftLeg' ? 11 : part === 'rightLeg' ? 14 : 1;
      ctx.fillStyle = '#600'; ctx.beginPath();
      ctx.arc(p[idx].pos.x, p[idx].pos.y, 4, 0, Math.PI * 2); ctx.fill();
      // Drip
      if (f.bleedTimer > 0 && t % 6 === 0) {
        ctx.fillStyle = `rgba(100,0,0,${f.bleedTimer / 240})`;
        ctx.beginPath();
        ctx.arc(p[idx].pos.x + (Math.random() - 0.5) * 6, p[idx].pos.y + Math.random() * 8, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // ── WEAPON ──
    if (!f.severed.has('rightArm')) {
      const hand = p[10].pos;
      const ang = f.wAngle * f.facing;
      const wl = f.weapon.len;
      const tipX = hand.x + Math.cos(ang) * wl;
      const tipY = hand.y + Math.sin(ang) * wl;

      // Attack trail
      const isAtk = ['slash', 'heavySlash', 'overhead', 'stab'].includes(f.state);
      const ap2 = f.dur > 0 ? f.frame / f.dur : 0;
      if (isAtk && ap2 > 0.2 && ap2 < 0.7) {
        ctx.strokeStyle = `rgba(255,255,255,${0.12 * (1 - Math.abs(ap2 - 0.45) * 4)})`;
        ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();
        // Motion blur trail
        ctx.strokeStyle = `rgba(200,200,255,${0.08})`;
        ctx.lineWidth = 20;
        ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();
      }

      // Blade
      ctx.strokeStyle = f.weapon.blade;
      ctx.lineWidth = f.weapon.type === 'greatsword' ? 5 : f.weapon.type === 'axe' ? 4 : 3;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(tipX, tipY); ctx.stroke();

      // Blade shine
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hand.x + Math.cos(ang + 0.05) * 5, hand.y + Math.sin(ang + 0.05) * 5);
      ctx.lineTo(tipX + Math.cos(ang + 0.05) * -3, tipY + Math.sin(ang + 0.05) * -3);
      ctx.stroke();

      // Handle
      ctx.strokeStyle = f.weapon.color; ctx.lineWidth = 3;
      const hx = hand.x - Math.cos(ang) * 14, hy = hand.y - Math.sin(ang) * 14;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.lineTo(hx, hy); ctx.stroke();
      // Guard
      ctx.strokeStyle = '#aa9'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hand.x + Math.sin(ang) * 6, hand.y - Math.cos(ang) * 6);
      ctx.lineTo(hand.x - Math.sin(ang) * 6, hand.y + Math.cos(ang) * 6);
      ctx.stroke();

      // Axe head
      if (f.weapon.type === 'axe') {
        const ax = tipX - Math.cos(ang) * 8, ay = tipY - Math.sin(ang) * 8;
        ctx.fillStyle = '#999';
        ctx.beginPath();
        ctx.moveTo(ax + Math.sin(ang) * 12, ay - Math.cos(ang) * 12);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(ax - Math.sin(ang) * 12, ay + Math.cos(ang) * 12);
        ctx.closePath(); ctx.fill();
      }
      if (f.weapon.type === 'spear') {
        ctx.fillStyle = '#ccd';
        ctx.beginPath();
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

      // Hair
      ctx.fillStyle = f.hair;
      ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI * 1.1, -0.1 * Math.PI); ctx.fill();

      // Face
      ctx.fillStyle = f.skin;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();

      // Helmet band
      ctx.fillStyle = f.color; ctx.fillRect(-14, -8, 28, 5);

      // Eyes
      if (f.state === 'ko' || f.state === 'ragdoll') {
        ctx.lineWidth = 2; ctx.strokeStyle = '#111';
        [-5, 5].forEach(ex => {
          ctx.beginPath(); ctx.moveTo(ex - 3, -2); ctx.lineTo(ex + 3, 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ex + 3, -2); ctx.lineTo(ex - 3, 2); ctx.stroke();
        });
      } else {
        const ed = f.facing > 0 ? 1 : -1;
        ctx.fillStyle = '#111';
        ctx.fillRect(-7 * ed - 1, -4, 3, 4);
        ctx.fillRect(3 * ed, -4, 3, 4);
        ctx.fillStyle = '#eee';
        ctx.fillRect(-7 * ed, -3, 1.5, 1.5);
        ctx.fillRect(3 * ed + 1, -3, 1.5, 1.5);
      }

      // Mouth
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
      if (!d || !ca(f) || f.stamina < d.stCost) return;
      f.stamina -= d.stCost;
      ss(f, t as FState, Math.round(d.frames / f.weapon.speed));
    };

    const startRagdoll = (f: Fighter, impulse: V, duration: number) => {
      f.ragdolling = true;
      f.ragTimer = duration;
      f.state = 'ragdoll' as FState;
      f.frame = 0; f.dur = duration;
      // Apply impulse to all upper body points
      for (let i = 0; i < 11; i++) {
        const pt = f.rag.pts[i];
        const imp = vscl(impulse, (1 - i * 0.05) * (0.7 + Math.random() * 0.3));
        pt.old = vsub(pt.pos, imp);
      }
    };

    // ═══════════════════════════════════════════════════════
    // ADVANCED DYNAMIC AI SYSTEM
    // ═══════════════════════════════════════════════════════
    type AIStyle = 'aggressive' | 'defensive' | 'counter' | 'wild' | 'calculated';
    type AIIntent = 'pressure' | 'retreat' | 'circle' | 'feint' | 'punish' | 'bait' | 'rush' | 'rest';

    const mkPersonality = () => ({
      style: (['aggressive', 'defensive', 'counter', 'wild', 'calculated'] as AIStyle[])[Math.floor(Math.random() * 5)],
      aggression: 0.4 + Math.random() * 0.6,
      patience: 0.2 + Math.random() * 0.8,
      riskTaking: 0.2 + Math.random() * 0.8,
      adaptSpeed: 0.3 + Math.random() * 0.7,
      preferredAtk: (['slash', 'stab', 'heavySlash', 'overhead'] as const)[Math.floor(Math.random() * 4)],
      comboChance: 0.3 + Math.random() * 0.5,
      feintChance: 0.1 + Math.random() * 0.3,
    });

    const mkAiMem = () => ({
      intent: 'pressure' as AIIntent,
      intentTimer: 0,
      lastHitBy: '',
      timesHit: 0,
      timesBlocked: 0,
      consecutiveBlocks: 0,
      lastAtk: '',
      lastAtkTime: 0,
      circleDir: Math.random() > 0.5 ? 1 : -1,
      styleShiftTimer: 120 + Math.random() * 200,
      dashCooldown: 0,
      feinting: false,
      feintTimer: 0,
      comboStep: 0,
      retreatTimer: 0,
      rushMomentum: 0,
    });

    // Each fighter gets their own personality and memory
    const aiData = [
      { personality: mkPersonality(), mem: mkAiMem() },
      { personality: mkPersonality(), mem: mkAiMem() },
    ];

    const pickNewIntent = (bot: Fighter, pl: Fighter, personality: ReturnType<typeof mkPersonality>, mem: ReturnType<typeof mkAiMem>): AIIntent => {
      const d = Math.abs(bot.x - pl.x);
      const hpRatio = bot.hp / 100;
      const plHpRatio = pl.hp / 100;
      const stRatio = bot.stamina / 100;
      const r = Math.random();

      if (hpRatio < 0.2) {
        return r < 0.4 * personality.riskTaking ? 'rush' : r < 0.7 ? 'retreat' : 'punish';
      }
      if (plHpRatio < 0.25) {
        return r < 0.6 * personality.aggression ? 'rush' : 'pressure';
      }
      if (stRatio < 0.2) return 'rest';

      switch (personality.style) {
        case 'aggressive':
          if (r < 0.35) return 'pressure';
          if (r < 0.55) return 'rush';
          if (r < 0.7) return 'feint';
          return d > 200 ? 'pressure' : 'punish';
        case 'defensive':
          if (r < 0.3) return 'bait';
          if (r < 0.55) return 'circle';
          if (r < 0.7) return 'retreat';
          return 'punish';
        case 'counter':
          if (r < 0.35) return 'bait';
          if (r < 0.55) return 'punish';
          if (r < 0.75) return 'circle';
          return 'feint';
        case 'wild':
          const choices: AIIntent[] = ['rush', 'pressure', 'feint', 'retreat', 'circle', 'punish', 'bait'];
          return choices[Math.floor(Math.random() * choices.length)];
        case 'calculated':
          if (mem.timesHit > 3) return 'retreat';
          if (d < 100) return r < 0.5 ? 'punish' : 'circle';
          return r < 0.4 ? 'pressure' : r < 0.7 ? 'feint' : 'bait';
        default: return 'pressure';
      }
    };

    const ai = (bot: Fighter, pl: Fighter, idx: number) => {
      if (bot.state === 'ko' || bot.state === 'ragdoll') return;
      
      const aiPersonality = aiData[idx].personality;
      const aiMem = aiData[idx].mem;
      
      bot.aiTimer--;
      aiMem.dashCooldown = Math.max(0, aiMem.dashCooldown - 1);
      aiMem.feintTimer = Math.max(0, aiMem.feintTimer - 1);
      aiMem.retreatTimer = Math.max(0, aiMem.retreatTimer - 1);

      // Style shift mid-fight
      aiMem.styleShiftTimer--;
      if (aiMem.styleShiftTimer <= 0) {
        aiPersonality.style = (['aggressive', 'defensive', 'counter', 'wild', 'calculated'] as AIStyle[])[Math.floor(Math.random() * 5)];
        aiPersonality.aggression = 0.4 + Math.random() * 0.6;
        aiPersonality.patience = 0.2 + Math.random() * 0.8;
        aiPersonality.riskTaking = 0.2 + Math.random() * 0.8;
        aiPersonality.preferredAtk = (['slash', 'stab', 'heavySlash', 'overhead'] as const)[Math.floor(Math.random() * 4)];
        aiMem.styleShiftTimer = 120 + Math.random() * 300;
        aiMem.circleDir *= -1;
      }

      if (bot.aiTimer > 0) return;
      if (bot.state === 'hit' || bot.state === 'stagger') return;

      const d = Math.abs(bot.x - pl.x);
      const wr = bot.weapon.len + 25;
      const isPlAttacking = ['slash', 'heavySlash', 'stab', 'overhead'].includes(pl.state);
      const isPlRecovering = pl.dur > 0 && pl.frame > pl.dur * 0.6;
      const isPlBlocking = pl.state === 'block';
      const stRatio = bot.stamina / 100;
      const atWall = bot.x < 100 || bot.x > W - 100;

      // Pick new intent
      aiMem.intentTimer--;
      if (aiMem.intentTimer <= 0) {
        aiMem.intent = pickNewIntent(bot, pl, aiPersonality, aiMem);
        aiMem.intentTimer = 20 + Math.floor(Math.random() * 40);
      }

      // ── REACTIVE LAYER ──
      if (isPlAttacking && d < 130) {
        const reaction = Math.random();
        if (reaction < 0.15 && bot.stamina > 10) {
          ss(bot, 'block');
          aiMem.consecutiveBlocks++;
          bot.aiTimer = 5 + Math.random() * 8 | 0;
          if (aiMem.consecutiveBlocks >= 2 && Math.random() < 0.7) {
            aiMem.intent = 'punish';
            aiMem.intentTimer = 15;
            aiMem.consecutiveBlocks = 0;
          }
          return;
        } else if (reaction < 0.25 && aiMem.dashCooldown <= 0) {
          bot.vx = -bot.facing * (6 + Math.random() * 3);
          aiMem.dashCooldown = 15;
          bot.aiTimer = 4 + Math.random() * 4 | 0;
          return;
        } else if (reaction < 0.55 && ca(bot) && stRatio > 0.15) {
          // Trade hits! Attack into their attack
          const picks = ['slash', 'stab', 'heavySlash', 'overhead'];
          doAtk(bot, picks[Math.floor(Math.random() * picks.length)]);
          bot.aiTimer = 2 + Math.random() * 4 | 0;
          return;
        }
      }

      // Punish recovery
      if (isPlRecovering && d < wr + 30 && ca(bot)) {
        const picks = ['slash', 'stab', 'heavySlash'];
        doAtk(bot, picks[Math.floor(Math.random() * picks.length)]);
        bot.aiTimer = 2 + Math.random() * 4 | 0;
        aiMem.comboStep = 1;
        return;
      }

      // ── INTENT EXECUTION ──
      switch (aiMem.intent) {
        case 'pressure': {
          if (d > wr + 20) {
            ss(bot, 'walk');
            bot.aiTimer = 2 + Math.random() * 4 | 0;
            if (d > 150 && Math.random() < 0.4 && aiMem.dashCooldown <= 0) {
              bot.vx = bot.facing * (7 + Math.random() * 5);
              aiMem.dashCooldown = 12;
            }
          } else if (ca(bot) && stRatio > 0.1) {
            const r = Math.random();
            if (r < 0.3) doAtk(bot, 'slash');
            else if (r < 0.5) doAtk(bot, 'stab');
            else if (r < 0.7 && bot.stamina > 25) doAtk(bot, 'heavySlash');
            else if (r < 0.85 && bot.stamina > 20) doAtk(bot, 'overhead');
            else doAtk(bot, aiPersonality.preferredAtk);
            bot.aiTimer = 3 + Math.random() * 6 | 0;
            aiMem.comboStep++;
            if (aiMem.comboStep < 4 && Math.random() < 0.5) {
              bot.aiTimer = 1 + Math.random() * 3 | 0;
            } else {
              aiMem.comboStep = 0;
            }
          } else {
            ss(bot, 'walk');
            bot.aiTimer = 2 + Math.random() * 5 | 0;
          }
          break;
        }

        case 'retreat': {
          if (d < 180) {
            ss(bot, 'walkBack');
            bot.aiTimer = 3 + Math.random() * 6 | 0;
            if (Math.random() < 0.25 && aiMem.dashCooldown <= 0) {
              bot.vx = -bot.facing * 7;
              aiMem.dashCooldown = 12;
            }
          } else {
            aiMem.intent = Math.random() < 0.6 ? 'pressure' : 'circle';
            aiMem.intentTimer = 25 + Math.random() * 30;
          }
          if (d < wr && ca(bot) && Math.random() < 0.4) {
            doAtk(bot, Math.random() < 0.5 ? 'stab' : 'slash');
            bot.aiTimer = 3;
          }
          break;
        }

        case 'circle': {
          const lateral = aiMem.circleDir * 3.5;
          bot.vx = lateral;
          if (d < 90) bot.vx += -bot.facing * 2;
          else if (d > 200) ss(bot, 'walk');
          else ss(bot, Math.random() > 0.5 ? 'walk' : 'walkBack');
          bot.aiTimer = 3 + Math.random() * 6 | 0;
          if (Math.random() < 0.12) aiMem.circleDir *= -1;
          if (d < wr + 10 && Math.random() < 0.4 * aiPersonality.aggression && ca(bot)) {
            const picks = ['slash', 'stab', 'heavySlash', 'overhead'];
            doAtk(bot, picks[Math.floor(Math.random() * picks.length)]);
            bot.aiTimer = 3 + Math.random() * 5 | 0;
          }
          break;
        }

        case 'feint': {
          if (d > wr + 40) {
            ss(bot, 'walk');
            bot.aiTimer = 2 + Math.random() * 4 | 0;
          } else if (aiMem.feintTimer <= 0) {
            if (!aiMem.feinting) {
              aiMem.feinting = true;
              bot.vx = bot.facing * 5;
              ss(bot, 'walk');
              bot.aiTimer = 3;
            } else {
              aiMem.feinting = false;
              aiMem.feintTimer = 15 + Math.random() * 20;
              // After feint, immediately attack
              if (ca(bot) && Math.random() < 0.6) {
                doAtk(bot, Math.random() < 0.5 ? 'slash' : 'stab');
                bot.aiTimer = 2;
              } else {
                bot.vx = -bot.facing * 5;
                bot.aiTimer = 3;
              }
              if (isPlBlocking || isPlAttacking) {
                aiMem.intent = 'punish';
                aiMem.intentTimer = 20;
              }
            }
          } else {
            if (Math.random() < 0.3 && ca(bot) && d < wr) {
              doAtk(bot, 'stab');
              bot.aiTimer = 4;
            } else {
              bot.aiTimer = 3 + Math.random() * 5 | 0;
            }
          }
          break;
        }

        case 'punish': {
          if (d > wr + 10) {
            ss(bot, 'walk');
            bot.vx += bot.facing * 4;
            bot.aiTimer = 2 + Math.random() * 3 | 0;
          } else if (ca(bot)) {
            const r = Math.random();
            if (r < 0.3) doAtk(bot, 'heavySlash');
            else if (r < 0.5) doAtk(bot, 'overhead');
            else if (r < 0.75) doAtk(bot, 'slash');
            else doAtk(bot, 'stab');
            bot.aiTimer = 2 + Math.random() * 5 | 0;
          }
          break;
        }

        case 'bait': {
          if (d > 250) {
            ss(bot, 'walk');
            bot.aiTimer = 3 + Math.random() * 4 | 0;
          } else if (d < 100) {
            ss(bot, 'walkBack');
            bot.aiTimer = 3 + Math.random() * 5 | 0;
          } else {
            // Hold position, wait for opening
            if (Math.random() < 0.3) {
              ss(bot, Math.random() < 0.5 ? 'walk' : 'walkBack');
            } else {
              ss(bot, 'idle');
            }
            bot.aiTimer = 3 + Math.random() * 6 | 0;
            // Strike if opponent does something
            if ((isPlAttacking || isPlRecovering) && ca(bot)) {
              doAtk(bot, Math.random() < 0.4 ? 'heavySlash' : 'slash');
              bot.aiTimer = 2;
              aiMem.intent = 'pressure';
              aiMem.intentTimer = 25;
            }
          }
          break;
        }

        case 'rush': {
          aiMem.rushMomentum = Math.min(aiMem.rushMomentum + 1, 10);
          if (d > wr) {
            ss(bot, 'walk');
            bot.vx += bot.facing * (4 + aiMem.rushMomentum * 0.4);
            if (aiMem.dashCooldown <= 0 && d > 120) {
              bot.vx = bot.facing * 11;
              aiMem.dashCooldown = 10;
            }
            bot.aiTimer = 1 + Math.random() * 3 | 0;
          } else if (ca(bot)) {
            const r = Math.random();
            if (r < 0.3) doAtk(bot, 'slash');
            else if (r < 0.5) doAtk(bot, 'stab');
            else if (r < 0.7 && bot.stamina > 25) doAtk(bot, 'heavySlash');
            else doAtk(bot, 'overhead');
            bot.aiTimer = 1 + Math.random() * 4 | 0;
            if (Math.random() < 0.65 && bot.stamina > 15) {
              bot.aiTimer = 1 + Math.random() * 2 | 0;
            }
          }
          if (stRatio < 0.12) {
            aiMem.intent = 'retreat';
            aiMem.intentTimer = 30;
            aiMem.rushMomentum = 0;
          }
          break;
        }

        case 'rest': {
          if (d < 160) {
            ss(bot, 'walkBack');
            if (Math.random() < 0.15 && aiMem.dashCooldown <= 0) {
              bot.vx = -bot.facing * 5;
              aiMem.dashCooldown = 15;
            }
          } else {
            ss(bot, 'idle');
          }
          bot.aiTimer = 4 + Math.random() * 8 | 0;
          if (isPlAttacking && d < 120 && ca(bot)) {
            // Counter-attack instead of just blocking
            if (Math.random() < 0.4) {
              doAtk(bot, 'slash');
              bot.aiTimer = 3;
            } else {
              ss(bot, 'block');
              bot.aiTimer = 6;
            }
          }
          if (stRatio > 0.5) {
            aiMem.intent = pickNewIntent(bot, pl, aiPersonality, aiMem);
            aiMem.intentTimer = 30;
          }
          break;
        }
      }

      // Wall escape
      if (atWall && d < 140) {
        if (Math.random() < 0.5) {
          bot.vy = -9; bot.grounded = false;
          bot.vx = bot.x < W / 2 ? 7 : -7;
          bot.aiTimer = 4;
        } else if (ca(bot)) {
          const picks = ['heavySlash', 'overhead', 'slash'];
          doAtk(bot, picks[Math.floor(Math.random() * picks.length)]);
          bot.aiTimer = 2;
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
          const f1 = mkFighter(350, p1.name, p1.color, p1.skin, p1.hair, wk1, false);
          const f2 = mkFighter(930, p2.name, p2.color, p2.skin, p2.hair, wk2, true);
          f1.wins = p1.wins; f2.wins = p2.wins;
          g.fighters[0] = f1; g.fighters[1] = f2;
          g.blood = []; g.limbs = []; g.pools = []; g.sparks = [];
          g.rs = 'intro'; g.introTimer = 80; g.timer = 99 * 60;
        }
      }

      if (g.rs !== 'fight') {
        // Still step ragdolls during KO for dramatic death physics
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

      // Player input (can override AI for p1 if keys pressed)
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

      // Both fighters use AI (p1 only when no keyboard input)
      if (!p1HasInput) ai(p1, p2, 0);
      ai(p2, p1, 1);

      // Update fighters
      g.fighters.forEach((f, idx) => {
        const o = g.fighters[1 - idx];
        if (ca(f)) f.facing = o.x > f.x ? 1 : -1;

        // Frame advance
        if (f.dur > 0) {
          f.frame += spd;
          if (f.frame >= f.dur) {
            if (f.state === 'ragdoll') {
              f.ragTimer -= spd;
              if (f.ragTimer <= 0 && f.hp > 0) { f.ragdolling = false; ss(f, 'idle'); }
            } else if (f.state !== 'ko') ss(f, 'idle');
          }
        }

        // Ragdoll timer
        if (f.ragdolling && f.state === 'ragdoll') {
          f.ragTimer -= spd;
          if (f.ragTimer <= 0 && f.hp > 0) { f.ragdolling = false; ss(f, 'idle'); }
        }

        // Stamina regen
        if (ca(f) || f.state === 'block') f.stamina = Math.min(100, f.stamina + 0.12);

        // Gravity
        if (!f.grounded) {
          f.vy += GRAV * spd;
          f.y += f.vy * spd;
          if (f.y >= GY) { f.y = GY; f.vy = 0; f.grounded = true; if (f.state === 'jump') ss(f, 'idle'); }
        }

        // Movement
        f.x += f.vx * spd;
        f.vx *= 0.87;
        if (f.state === 'walk') { f.x += f.facing * 3 * spd; f.walkCycle += 0.12 * spd; }
        else if (f.state === 'walkBack') { f.x -= f.facing * 2 * spd; f.walkCycle += 0.09 * spd; }
        f.x = clamp(f.x, 50, W - 50);
        f.bob += 0.04 * spd;

        // Hit impact decay
        if (f.hitImpact > 0) f.hitImpact *= 0.85;

        // Weapon angle
        const ap2 = f.dur > 0 ? f.frame / f.dur : 0;
        if (f.state === 'slash') f.wTarget = ap2 < 0.3 ? -2.0 : ap2 < 0.55 ? 1.5 : 0.3;
        else if (f.state === 'heavySlash') f.wTarget = ap2 < 0.35 ? -2.5 : ap2 < 0.6 ? 2.2 : 0.2;
        else if (f.state === 'stab') f.wTarget = ap2 < 0.3 ? -0.3 : ap2 < 0.55 ? 0.15 : -0.3;
        else if (f.state === 'overhead') f.wTarget = ap2 < 0.4 ? -2.8 : ap2 < 0.6 ? 2.0 : -0.2;
        else f.wTarget = f.state === 'block' ? -1.3 : -0.5;
        f.wAngle += (f.wTarget - f.wAngle) * 0.2;

        // Bleed - continuous blood spurts from stumps
        if (f.bleedTimer > 0) {
          f.bleedTimer -= spd;
          f.hp -= 0.02 * spd;
          if (fc % 4 === 0) {
            // Spurt from each severed part
            for (const part of f.severed) {
              const idx2 = part === 'leftArm' ? 5 : part === 'rightArm' ? 8 :
                part === 'leftLeg' ? 11 : part === 'rightLeg' ? 14 : 1;
              if (f.rag.pts[idx2]) {
                spawnBlood(f.rag.pts[idx2].pos.x, f.rag.pts[idx2].pos.y, (Math.random() - 0.5) * 2, 3, 2);
              }
            }
          }
        }

        // Combo decay
        if (f.comboTimer > 0) { f.comboTimer -= spd; if (f.comboTimer <= 0) f.combo = 0; }

        // Ragdoll physics
        if (f.ragdolling) {
          stepRagdoll(f.rag.pts, f.rag.sticks, spd, 0.3);
          // Update position from hip
          f.x = f.rag.pts[4].pos.x;
          f.y = Math.min(GY, f.rag.pts[4].pos.y);
        } else {
          poseRagdoll(f);
          // Still run constraint solver for nice blending
          stepRagdoll(f.rag.pts, f.rag.sticks, spd * 0.5, 0.2);
        }

        // KO from bleed
        if (f.hp <= 0 && f.state !== 'ko') {
          f.hp = 0; ss(f, 'ko');
          startRagdoll(f, v(f.facing * -5, -6), 999);
          o.wins++; g.rs = 'ko'; g.koTimer = 180; g.shake = 12;
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
        const hs = Math.round(ad.hitStart / f.weapon.speed);
        const he = Math.round(ad.hitEnd / f.weapon.speed);
        if (f.frame < hs || f.frame > he) return;

        // Weapon tip position
        const hand = f.rag.pts[10].pos;
        const ang = f.wAngle * f.facing;
        const tipX = hand.x + Math.cos(ang) * f.weapon.len * 0.8;
        const tipY = hand.y + Math.sin(ang) * f.weapon.len * 0.8;

        // Check against opponent body points
        let hitPt: V | null = null;
        let hitJoint = -1;
        for (let i = 0; i < o.rag.pts.length; i++) {
          const op = o.rag.pts[i].pos;
          const dd = vlen(vsub(v(tipX, tipY), op));
          if (dd < 35) {
            hitPt = op;
            hitJoint = i;
            break;
          }
        }

        // Also check line-based hit
        if (!hitPt) {
          const hitDist = Math.abs(tipX - o.x);
          const hitDistY = Math.abs(tipY - (o.y - 50));
          if (hitDist < 50 && hitDistY < 60) {
            hitPt = v(o.x, o.y - 50);
            hitJoint = 2;
          }
        }

        if (hitPt) {
          f.hitDealt = true;
          const dmg = f.weapon[ad.dmgKey];
          const hitDir2 = v(f.facing, -0.3);

          if (o.state === 'block' && o.stamina > 5) {
            // Blocked - sparks, pushback
            o.vx = f.facing * ad.kb.x * 0.3;
            o.stamina -= dmg * 0.7;
            spawnSparks((f.x + o.x) / 2, hitPt.y, 10);
            g.shake = 3;
            // Push ragdoll points slightly
            for (let i = 0; i < 5; i++) {
              o.rag.pts[i].old = vsub(o.rag.pts[i].pos, vscl(hitDir2, -2));
            }
          } else {
            // HIT!
            f.combo++; f.comboTimer = 80;
            let finalDmg = dmg;
            if (f.combo > 1) finalDmg *= (1 + f.combo * 0.12);

            o.hp = Math.max(0, o.hp - finalDmg);
            o.vx = f.facing * ad.kb.x;
            o.vy = ad.kb.y;
            if (ad.kb.y < -4) o.grounded = false;

            // Physics-based hit reaction on ragdoll
            o.hitDir = vnorm(hitDir2);
            o.hitImpact = dmg * 0.5;

            // Apply impulse to nearby ragdoll joints
            const impForce = dmg * 0.3;
            for (let i = 0; i < o.rag.pts.length; i++) {
              const dd = vlen(vsub(o.rag.pts[i].pos, hitPt));
              if (dd < 80) {
                const falloff = 1 - dd / 80;
                const imp = vscl(hitDir2, impForce * falloff);
                o.rag.pts[i].old = vsub(o.rag.pts[i].pos, imp);
              }
            }

            // Heavy hit → ragdoll
            if (dmg >= 20 && finalDmg >= 18) {
              startRagdoll(o, vscl(hitDir2, dmg * 0.5), 40 + dmg);
              g.shake = 10; g.slowMo = 0.3; g.slowTimer = 12;
            } else {
              ss(o, dmg >= 15 ? 'stagger' : 'hit', dmg >= 15 ? 28 : 16);
              g.shake = 5;
            }

            // Blood - MUCH more visible
            spawnBlood(hitPt.x, hitPt.y, f.facing, Math.round(dmg * 1.5), dmg / 8);
            spawnBlood(hitPt.x, hitPt.y - 10, f.facing * -0.5, Math.round(dmg * 0.8), dmg / 10);

            // Joint-specific blood spray
            if (hitJoint >= 0 && hitJoint < o.rag.pts.length) {
              spawnBlood(o.rag.pts[hitJoint].pos.x, o.rag.pts[hitJoint].pos.y, f.facing, 12, 2);
              spawnBlood(o.rag.pts[hitJoint].pos.x, o.rag.pts[hitJoint].pos.y - 5, 0, 6, 1.8);
            }

            // Dismemberment - very frequent and exaggerated
            if (o.hp < 60 && Math.random() < 0.5) {
              const parts = ['leftArm', 'rightArm'].filter(p => !o.severed.has(p));
              if (o.hp < 40) parts.push(...['leftLeg', 'rightLeg'].filter(p => !o.severed.has(p)));
              if (o.hp < 15) parts.push('head');
              if (parts.length > 0) {
                sever(o, parts[Math.floor(Math.random() * parts.length)], f.facing);
                // Multiple severing
                if (Math.random() < 0.4) {
                  const remaining = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].filter(p => !o.severed.has(p));
                  if (remaining.length > 0) sever(o, remaining[Math.floor(Math.random() * remaining.length)], f.facing);
                }
              }
            }

            // KO - ALWAYS sever head + massive blood fountain
            if (o.hp <= 0) {
              ss(o, 'ko');
              startRagdoll(o, vscl(hitDir2, 20), 999);
              f.wins++; g.rs = 'ko'; g.koTimer = 250;
              g.shake = 30; g.slowMo = 0.08; g.slowTimer = 45;
              // Massive blood explosion
              spawnBlood(hitPt.x, hitPt.y, f.facing, 80, 5);
              spawnBlood(hitPt.x, hitPt.y - 20, -f.facing, 40, 4);
              spawnBlood(hitPt.x, hitPt.y - 40, 0, 30, 3.5);
              spawnBlood(hitPt.x + f.facing * 20, hitPt.y - 30, f.facing * 0.5, 25, 4);
              // ALWAYS sever head on KO
              if (!o.severed.has('head')) sever(o, 'head', f.facing);
              // Sever 1-2 more limbs
              const limbParts = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].filter(p => !o.severed.has(p));
              if (limbParts.length > 0) sever(o, limbParts[Math.floor(Math.random() * limbParts.length)], f.facing);
              if (limbParts.length > 1 && Math.random() < 0.6) {
                const remaining = limbParts.filter(p => !o.severed.has(p));
                if (remaining.length > 0) sever(o, remaining[Math.floor(Math.random() * remaining.length)], f.facing);
              }
            }
          }
        }
      });

      // Update blood
      g.blood = g.blood.filter(b => {
        if (b.grounded) { b.life -= spd * 0.2; return b.life > 0; }
        b.x += b.vx * spd; b.y += b.vy * spd;
        b.vy += 0.35 * spd; b.vx *= 0.99; b.life -= spd;
        if (b.y >= GY) {
          b.grounded = true; b.y = GY; b.vy = 0; b.vx = 0;
          if (g.pools.length < 120) {
            const ex = g.pools.find(p => Math.abs(p.x - b.x) < 20);
            if (ex) ex.r = Math.min(40, ex.r + 1);
            else g.pools.push({ x: b.x, y: GY, r: 3 + Math.random() * 6, a: 0.7 });
          }
        }
        return b.life > 0;
      });

      g.sparks = g.sparks.filter(s => { s.x += s.vx * spd; s.y += s.vy * spd; s.vy += 0.4 * spd; s.life -= spd; return s.life > 0; });
      g.limbs = g.limbs.filter(l => {
        l.pts.forEach(p => { p.x += l.vel.x * spd; p.y += l.vel.y * spd; });
        l.vel.y += 0.3 * spd; l.ang += l.angV * spd;
        if (l.pts[0] && l.pts[0].y >= GY) { l.vel.x *= 0.7; l.vel.y *= -0.2; l.angV *= 0.7; l.pts[0].y = GY; }
        l.life -= spd; return l.life > 0;
      });
      g.pools.forEach(p => p.a = Math.max(0.05, p.a - 0.0003));
      if (g.shake > 0) g.shake *= 0.88;

      if (fc % 3 === 0) setHud({ p1hp: p1.hp, p2hp: p2.hp, timer: Math.ceil(g.timer / 60), round: g.round, p1st: p1.stamina, p2st: p2.stamina, p1w: p1.wins, p2w: p2.wins, rs: g.rs, n1: p1.name, n2: p2.name, w1: p1.weapon.name, w2: p2.weapon.name });
    };

    // ── RENDER ──
    const render = () => {
      tick();
      const shk = g.shake;
      const sx = shk > 0.5 ? (Math.random() - 0.5) * shk * 2 : 0;
      const sy = shk > 0.5 ? (Math.random() - 0.5) * shk * 2 : 0;
      ctx.save(); ctx.translate(sx, sy);

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, GY);
      sky.addColorStop(0, '#040410'); sky.addColorStop(0.5, '#0a0a20'); sky.addColorStop(1, '#141430');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GY);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 45; i++) ctx.fillRect((i * 137 + 30) % W, (i * 73 + 10) % (GY * 0.5), 1 + (i % 2), 1 + (i % 2));

      // Moon
      ctx.fillStyle = 'rgba(160,140,120,0.07)';
      ctx.beginPath(); ctx.arc(180, 110, 55, 0, Math.PI * 2); ctx.fill();

      // Mountains
      ctx.fillStyle = '#0b0b1a'; ctx.beginPath(); ctx.moveTo(0, GY);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, GY - 90 - Math.sin(x * 0.006) * 50 - Math.sin(x * 0.014) * 25);
      ctx.lineTo(W, GY); ctx.fill();

      // Castle
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
      g.pools.forEach(p => {
        ctx.fillStyle = `rgba(120,0,0,${p.a})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, p.r, p.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        // Darker center
        ctx.fillStyle = `rgba(80,0,0,${p.a * 0.6})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, p.r * 0.5, p.r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      });

      // Severed limbs
      g.limbs.forEach(l => {
        if (l.pts.length === 0) return;
        ctx.save(); ctx.translate(l.pts[0].x, l.pts[0].y); ctx.rotate(l.ang);
        ctx.strokeStyle = l.color; ctx.lineWidth = l.w; ctx.lineCap = 'round';
        for (let i = 1; i < l.pts.length; i++) {
          const d = vsub(l.pts[i], l.pts[0]);
          ctx.beginPath();
          if (i === 1) ctx.moveTo(0, 0); else ctx.moveTo(l.pts[i - 1].x - l.pts[0].x, l.pts[i - 1].y - l.pts[0].y);
          ctx.lineTo(d.x, d.y); ctx.stroke();
        }
        ctx.fillStyle = '#600'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // Fighters
      g.fighters.forEach(f => drawFighter(ctx, f, fc));

      // Blood
      g.blood.forEach(b => {
        if (b.grounded) {
          ctx.fillStyle = `rgba(150,0,0,${(b.life / b.maxLife) * 0.5})`;
          ctx.beginPath(); ctx.ellipse(b.x, b.y + 1, b.sz * 1.2, b.sz * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        } else {
          const a = b.life / b.maxLife;
          ctx.fillStyle = `rgba(200,10,10,${a * 0.9})`;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.sz * (0.6 + a * 0.4), 0, Math.PI * 2); ctx.fill();
          // Bright core
          if (b.sz > 2) {
            ctx.fillStyle = `rgba(255,50,30,${a * 0.4})`;
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
        const p = 1 - g.introTimer / 80;
        ctx.fillStyle = `rgba(0,0,0,${0.6 * (1 - p)})`; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2 - 50);
        ctx.scale(0.5 + p * 0.5, 0.5 + p * 0.5);
        ctx.font = 'bold 60px Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#a88'; ctx.globalAlpha = Math.min(1, p * 3);
        ctx.fillText(`ROUND ${g.round}`, 0, 0);
        if (p > 0.5) { ctx.font = 'bold 40px Georgia, serif'; ctx.fillStyle = '#c44'; ctx.globalAlpha = (p - 0.5) * 2; ctx.fillText('FIGHT!', 0, 50); }
        ctx.restore();
      }

      // KO
      if (g.rs === 'ko') {
        const p = 1 - g.koTimer / 200;
        const vig = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W / 2);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, `rgba(0,0,0,${Math.min(0.7, p * 2)})`);
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2 - 40);
        const sc = p < 0.12 ? p / 0.12 : 1;
        ctx.scale(sc, sc);
        ctx.font = 'bold 80px Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#200'; ctx.fillText('K.O.', 3, 3);
        ctx.fillStyle = '#a00'; ctx.fillText('K.O.', 0, 0);
        ctx.restore();
      }

      ctx.restore();
      aid = requestAnimationFrame(render);
    };
    aid = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(aid); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [drawFighter, spawnBlood, spawnSparks, sever]);

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
