import { useEffect, useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
const W = 1280, H = 720, GROUND_Y = 580, GRAVITY = 0.35;
const DT = 1; // physics timestep

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
interface V2 { x: number; y: number }
const v2 = (x = 0, y = 0): V2 => ({ x, y });
const v2add = (a: V2, b: V2): V2 => ({ x: a.x + b.x, y: a.y + b.y });
const v2sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, y: a.y - b.y });
const v2scl = (a: V2, s: number): V2 => ({ x: a.x * s, y: a.y * s });
const v2len = (a: V2) => Math.sqrt(a.x * a.x + a.y * a.y);
const v2lerp = (a: V2, b: V2, t: number): V2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const v2rot = (a: V2, r: number): V2 => ({ x: a.x * Math.cos(r) - a.y * Math.sin(r), y: a.x * Math.sin(r) + a.y * Math.cos(r) });

type FState = 'idle' | 'walk' | 'walkBack' | 'jump' | 'crouch' | 'slash' | 'heavySlash' | 'stab' | 'overhead' | 'block' | 'hit' | 'stagger' | 'ko' | 'dead';

// Ragdoll joint
interface Joint {
  pos: V2; prevPos: V2; vel: V2;
  pinned: boolean;
}

// Ragdoll bone constraint
interface Bone {
  j1: number; j2: number; len: number;
}

// Severed limb
interface SeveredLimb {
  joints: V2[]; bones: [number, number][]; vel: V2; angVel: number; angle: number;
  color: string; thickness: number; life: number;
}

// Blood particle
interface Blood {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  type: 'drop' | 'spray' | 'pool';
}

// Weapon definition
interface Weapon {
  name: string; length: number; weight: number;
  slashDmg: number; stabDmg: number; heavyDmg: number;
  speed: number; // attack speed multiplier (lower = slower)
  color: string; bladeColor: string;
  type: 'sword' | 'axe' | 'spear' | 'greatsword';
}

const WEAPONS: Record<string, Weapon> = {
  longsword: { name: 'Longsword', length: 70, weight: 1, slashDmg: 15, stabDmg: 12, heavyDmg: 25, speed: 1, color: '#888', bladeColor: '#ccd', type: 'sword' },
  greatsword: { name: 'Greatsword', length: 95, weight: 1.8, slashDmg: 22, stabDmg: 15, heavyDmg: 40, speed: 0.6, color: '#777', bladeColor: '#aab', type: 'greatsword' },
  axe: { name: 'Battle Axe', length: 65, weight: 1.5, slashDmg: 20, stabDmg: 8, heavyDmg: 35, speed: 0.7, color: '#654', bladeColor: '#999', type: 'axe' },
  spear: { name: 'Spear', length: 110, weight: 0.8, slashDmg: 10, stabDmg: 22, heavyDmg: 18, speed: 1.2, color: '#876', bladeColor: '#bbc', type: 'spear' },
};

// Attack definitions
interface AttackDef {
  frames: number; hitStart: number; hitEnd: number;
  dmgKey: 'slashDmg' | 'stabDmg' | 'heavyDmg';
  knockback: V2; staminaCost: number;
  canDismember: boolean;
}

const ATTACK_DEFS: Record<string, AttackDef> = {
  slash:      { frames: 35, hitStart: 10, hitEnd: 18, dmgKey: 'slashDmg', knockback: v2(6, -2), staminaCost: 15, canDismember: false },
  heavySlash: { frames: 55, hitStart: 20, hitEnd: 32, dmgKey: 'heavyDmg', knockback: v2(12, -5), staminaCost: 30, canDismember: true },
  stab:       { frames: 30, hitStart: 12, hitEnd: 18, dmgKey: 'stabDmg', knockback: v2(4, -1), staminaCost: 12, canDismember: false },
  overhead:   { frames: 50, hitStart: 22, hitEnd: 30, dmgKey: 'heavyDmg', knockback: v2(8, -10), staminaCost: 25, canDismember: true },
};

// Fighter with ragdoll skeleton
interface Fighter {
  x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; stamina: number; maxStamina: number;
  state: FState; frame: number; stateTimer: number;
  facing: 1 | -1; grounded: boolean;
  weapon: Weapon;
  combo: number; comboTimer: number;
  blockStun: number; hitStun: number;
  name: string; color: string; skinColor: string; hairColor: string;
  isAI: boolean; wins: number;
  aiTimer: number; aiAction: string;
  walkCycle: number; idleBob: number;
  // Ragdoll
  joints: Joint[]; bones: Bone[];
  ragdolling: boolean;
  // Dismemberment
  severedParts: Set<string>; // 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'head'
  bleedTimer: number;
  // Weapon swing angle
  weaponAngle: number; weaponTargetAngle: number;
  // hit tracking
  hitDealt: boolean;
}

// Joint indices
const J = {
  head: 0, neck: 1, chest: 2, hip: 3,
  lShoulder: 4, lElbow: 5, lHand: 6,
  rShoulder: 7, rElbow: 8, rHand: 9,
  lHip: 10, lKnee: 11, lFoot: 12,
  rHip: 13, rKnee: 14, rFoot: 15,
};

function createSkeleton(x: number, y: number): { joints: Joint[]; bones: Bone[] } {
  const offsets: V2[] = [
    v2(0, -90),   // head
    v2(0, -75),   // neck
    v2(0, -55),   // chest
    v2(0, -20),   // hip
    v2(-15, -70), // lShoulder
    v2(-30, -50), // lElbow
    v2(-40, -35), // lHand
    v2(15, -70),  // rShoulder
    v2(30, -50),  // rElbow
    v2(40, -35),  // rHand
    v2(-10, -18), // lHip
    v2(-12, 10),  // lKnee
    v2(-12, 40),  // lFoot
    v2(10, -18),  // rHip
    v2(12, 10),   // rKnee
    v2(12, 40),   // rFoot
  ];
  const joints: Joint[] = offsets.map(o => ({
    pos: v2(x + o.x, y + o.y), prevPos: v2(x + o.x, y + o.y), vel: v2(), pinned: false,
  }));
  const boneList: [number, number][] = [
    [J.head, J.neck], [J.neck, J.chest], [J.chest, J.hip],
    [J.neck, J.lShoulder], [J.lShoulder, J.lElbow], [J.lElbow, J.lHand],
    [J.neck, J.rShoulder], [J.rShoulder, J.rElbow], [J.rElbow, J.rHand],
    [J.hip, J.lHip], [J.lHip, J.lKnee], [J.lKnee, J.lFoot],
    [J.hip, J.rHip], [J.rHip, J.rKnee], [J.rKnee, J.rFoot],
  ];
  const bones: Bone[] = boneList.map(([j1, j2]) => ({
    j1, j2, len: v2len(v2sub(joints[j1].pos, joints[j2].pos)),
  }));
  return { joints, bones };
}

function createFighter(x: number, name: string, color: string, skin: string, hair: string, weaponKey: string, isAI: boolean): Fighter {
  const skel = createSkeleton(x, GROUND_Y);
  return {
    x, y: GROUND_Y, vx: 0, vy: 0,
    hp: 100, maxHp: 100, stamina: 100, maxStamina: 100,
    state: 'idle', frame: 0, stateTimer: 0,
    facing: 1, grounded: true,
    weapon: WEAPONS[weaponKey],
    combo: 0, comboTimer: 0, blockStun: 0, hitStun: 0,
    name, color, skinColor: skin, hairColor: hair,
    isAI, wins: 0, aiTimer: 0, aiAction: 'idle',
    walkCycle: 0, idleBob: Math.random() * Math.PI * 2,
    joints: skel.joints, bones: skel.bones,
    ragdolling: false,
    severedParts: new Set(),
    bleedTimer: 0,
    weaponAngle: -0.5, weaponTargetAngle: -0.5,
    hitDealt: false,
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
const RagdollArena = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef({
    fighters: [
      createFighter(350, 'SIEGFRIED', '#8B0000', '#e8b878', '#2a1a0a', 'greatsword', false),
      createFighter(930, 'NIGHTMARE', '#1a1a4a', '#c4956a', '#111', 'axe', true),
    ],
    blood: [] as Blood[],
    severedLimbs: [] as SeveredLimb[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }[],
    screenShake: 0,
    slowMo: 1,
    slowMoTimer: 0,
    round: 1,
    timer: 99 * 60,
    roundState: 'intro' as 'intro' | 'fight' | 'ko',
    introTimer: 100,
    koTimer: 0,
    keys: new Set<string>(),
    bloodPools: [] as { x: number; y: number; radius: number; opacity: number }[],
    clashSparks: [] as { x: number; y: number; timer: number; angle: number }[],
  });

  const [hud, setHud] = useState({
    p1hp: 100, p2hp: 100, timer: 99, round: 1,
    p1st: 100, p2st: 100, p1w: 0, p2w: 0,
    rs: 'intro', p1name: 'SIEGFRIED', p2name: 'NIGHTMARE',
    p1weapon: 'Greatsword', p2weapon: 'Battle Axe',
  });

  // ─── BLOOD SPAWNER ────────────────────────────────────────
  const spawnBlood = useCallback((x: number, y: number, dir: number, count: number, intensity: number) => {
    const g = gameRef.current;
    for (let i = 0; i < count; i++) {
      const spread = intensity * 0.5;
      g.blood.push({
        x, y: y - Math.random() * 10,
        vx: dir * (2 + Math.random() * intensity * 3) + (Math.random() - 0.5) * spread * 4,
        vy: -(2 + Math.random() * intensity * 4) + Math.random() * 2,
        life: 60 + Math.random() * 80, maxLife: 140,
        size: 1.5 + Math.random() * 3 * intensity,
        type: Math.random() > 0.7 ? 'spray' : 'drop',
      });
    }
  }, []);

  const spawnSparks = useCallback((x: number, y: number, count: number) => {
    const g = gameRef.current;
    for (let i = 0; i < count; i++) {
      g.particles.push({
        x, y, vx: (Math.random() - 0.5) * 15, vy: -(3 + Math.random() * 8),
        life: 10 + Math.random() * 15, maxLife: 25,
        color: Math.random() > 0.5 ? '#ff8' : '#ffa',
        size: 1 + Math.random() * 3,
      });
    }
    g.clashSparks.push({ x, y, timer: 12, angle: Math.random() * Math.PI * 2 });
  }, []);

  // ─── DISMEMBER ─────────────────────────────────────────────
  const dismember = useCallback((fighter: Fighter, part: string, dir: number) => {
    if (fighter.severedParts.has(part)) return;
    fighter.severedParts.add(part);
    const g = gameRef.current;

    // Spawn severed limb geometry
    const limbJoints: V2[] = [];
    const limbBones: [number, number][] = [];
    let color = fighter.skinColor;
    let thickness = 5;

    if (part === 'leftArm') {
      [J.lShoulder, J.lElbow, J.lHand].forEach(j => limbJoints.push({ ...fighter.joints[j].pos }));
      limbBones.push([0, 1], [1, 2]);
    } else if (part === 'rightArm') {
      [J.rShoulder, J.rElbow, J.rHand].forEach(j => limbJoints.push({ ...fighter.joints[j].pos }));
      limbBones.push([0, 1], [1, 2]);
    } else if (part === 'leftLeg') {
      [J.lHip, J.lKnee, J.lFoot].forEach(j => limbJoints.push({ ...fighter.joints[j].pos }));
      limbBones.push([0, 1], [1, 2]); thickness = 7;
    } else if (part === 'rightLeg') {
      [J.rHip, J.rKnee, J.rFoot].forEach(j => limbJoints.push({ ...fighter.joints[j].pos }));
      limbBones.push([0, 1], [1, 2]); thickness = 7;
    } else if (part === 'head') {
      limbJoints.push({ ...fighter.joints[J.head].pos });
      color = fighter.skinColor; thickness = 12;
    }

    g.severedLimbs.push({
      joints: limbJoints, bones: limbBones,
      vel: v2(dir * (5 + Math.random() * 8), -(8 + Math.random() * 6)),
      angVel: (Math.random() - 0.5) * 0.3, angle: 0,
      color, thickness, life: 300,
    });

    // Blood fountain at sever point
    spawnBlood(fighter.x, fighter.y - 50, dir, 25, 3);
    fighter.bleedTimer = 180;
    g.screenShake = 12;
    g.slowMo = 0.3;
    g.slowMoTimer = 20;
  }, [spawnBlood]);

  // ─── DRAW FIGHTER ──────────────────────────────────────────
  const drawFighter = useCallback((ctx: CanvasRenderingContext2D, f: Fighter, t: number) => {
    ctx.save();
    ctx.translate(f.x, f.y);
    const s = f.facing;
    ctx.scale(s, 1);

    const bob = f.state === 'idle' ? Math.sin(f.idleBob + t * 0.04) * 2 : 0;
    const ap = f.stateTimer > 0 ? f.frame / f.stateTimer : 0;
    const crouching = f.state === 'crouch';
    const co = crouching ? 20 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 30 + (crouching ? 5 : 0), 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── LEGS ──
    if (!f.severedParts.has('leftLeg') && !f.severedParts.has('rightLeg')) {
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      const ls = crouching ? 18 : 12;
      let ll = 0, rl2 = 0;
      if (crouching) { ll = 0.7; rl2 = -0.7; }
      else if (f.state === 'walk' || f.state === 'walkBack') { ll = Math.sin(f.walkCycle) * 0.45; rl2 = Math.sin(f.walkCycle + Math.PI) * 0.45; }
      else if (f.state === 'jump') { ll = -0.4; rl2 = 0.4; }

      if (!f.severedParts.has('leftLeg')) {
        const lx = -ls - Math.sin(ll) * 32, ly = -co + 38 + Math.cos(ll) * 4;
        ctx.beginPath(); ctx.moveTo(-ls, -co); ctx.lineTo(lx, ly); ctx.stroke();
        // Boot
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 8, ly + 3); ctx.stroke();
      }
      if (!f.severedParts.has('rightLeg')) {
        const rx = ls + Math.sin(rl2) * 32, ry = -co + 38 + Math.cos(rl2) * 4;
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(ls, -co); ctx.lineTo(rx, ry); ctx.stroke();
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 8, ry + 3); ctx.stroke();
      }
    }
    // Stump blood for severed legs
    ['leftLeg', 'rightLeg'].forEach((part, i) => {
      if (f.severedParts.has(part)) {
        const sx = i === 0 ? -12 : 12;
        ctx.fillStyle = '#600';
        ctx.beginPath(); ctx.arc(sx, -co, 5, 0, Math.PI * 2); ctx.fill();
      }
    });

    // ── TORSO ──
    const ty = -(48 + bob - co);
    const th = crouching ? 28 : 46;
    // Armor plate look
    const grad = ctx.createLinearGradient(-16, ty, 16, ty + th);
    grad.addColorStop(0, f.color);
    grad.addColorStop(0.5, f.color + 'cc');
    grad.addColorStop(1, f.color);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(-16, ty, 32, th, 5); ctx.fill();
    // Armor detail
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-12, ty + 10); ctx.lineTo(12, ty + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ty + 5); ctx.lineTo(0, ty + th - 5); ctx.stroke();

    // ── ARMS + WEAPON ──
    const shoulderY = ty + 6;
    let la = 0, ra2 = 0, lf = 0.5, rf = 0.5;

    if (f.state === 'idle') {
      la = Math.sin(t * 0.025) * 0.08 - 0.2;
      ra2 = 0.3;
      lf = 0.7; rf = 0.6;
    } else if (f.state === 'walk' || f.state === 'walkBack') {
      la = Math.sin(f.walkCycle + Math.PI) * 0.3;
      ra2 = Math.sin(f.walkCycle) * 0.15 + 0.2;
    } else if (f.state === 'block') {
      la = -0.9; ra2 = -0.7; lf = 1.3; rf = 1.1;
    } else if (f.state === 'hit' || f.state === 'stagger') {
      la = 0.6; ra2 = 0.9;
    } else if (f.state === 'slash') {
      // Weapon arm swings
      if (ap < 0.3) { ra2 = -1.2 + ap * 2; rf = 1.0; }
      else if (ap < 0.5) { ra2 = 0.8; rf = 0.2; }
      else { ra2 = 0.8 - (ap - 0.5) * 1.5; }
      la = -0.4;
    } else if (f.state === 'heavySlash') {
      if (ap < 0.35) { ra2 = -1.8; la = -1.2; rf = 1.2; }
      else if (ap < 0.55) { ra2 = 1.2; la = 0.5; rf = 0.1; }
      else { ra2 = 1.2 - (ap - 0.55) * 2; la = 0.5 - (ap - 0.55); }
    } else if (f.state === 'stab') {
      if (ap < 0.3) { ra2 = -0.3; rf = 1.5; }
      else if (ap < 0.55) { ra2 = 0.1; rf = 0.0; }
      else { ra2 = 0.1 - (ap - 0.55) * 0.5; rf = (ap - 0.55) * 1.5; }
      la = -0.3;
    } else if (f.state === 'overhead') {
      if (ap < 0.4) { ra2 = -2.0 + ap * 0.5; la = -1.5; rf = 1.0; }
      else if (ap < 0.6) { ra2 = 1.5; la = 0.8; rf = 0.0; }
      else { ra2 = 1.5 - (ap - 0.6) * 3; la = 0.8 - (ap - 0.6) * 2; }
    }

    ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = f.skinColor;

    // Left arm
    if (!f.severedParts.has('leftArm')) {
      const lex = -16 - Math.cos(la) * 20, ley = shoulderY + Math.sin(la) * 20 + 14;
      ctx.beginPath(); ctx.moveTo(-16, shoulderY); ctx.lineTo(lex, ley);
      ctx.lineTo(lex - Math.cos(la - lf) * 18, ley + Math.sin(la - lf) * 18 + 7);
      ctx.stroke();
      // Gauntlet
      ctx.strokeStyle = f.color; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(lex - Math.cos(la - lf) * 14, ley + Math.sin(la - lf) * 14 + 5);
      ctx.lineTo(lex - Math.cos(la - lf) * 18, ley + Math.sin(la - lf) * 18 + 7);
      ctx.stroke();
      ctx.strokeStyle = f.skinColor; ctx.lineWidth = 6;
    } else {
      ctx.fillStyle = '#600'; ctx.beginPath(); ctx.arc(-16, shoulderY, 4, 0, Math.PI * 2); ctx.fill();
    }

    // Right arm + weapon
    if (!f.severedParts.has('rightArm')) {
      const rex = 16 + Math.cos(ra2) * 20, rey = shoulderY + Math.sin(ra2) * 20 + 14;
      const handX = rex + Math.cos(ra2 + rf) * 18, handY = rey + Math.sin(ra2 + rf) * 18 + 7;
      ctx.beginPath(); ctx.moveTo(16, shoulderY); ctx.lineTo(rex, rey);
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Draw weapon from hand
      const wAngle = f.weaponAngle;
      const wLen = f.weapon.length;
      const tipX = handX + Math.cos(wAngle) * wLen;
      const tipY = handY + Math.sin(wAngle) * wLen;

      // Weapon trail for attacks
      if (['slash', 'heavySlash', 'overhead'].includes(f.state) && ap > 0.25 && ap < 0.65) {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 12;
        ctx.beginPath(); ctx.moveTo(handX, handY); ctx.lineTo(tipX, tipY); ctx.stroke();
      }

      // Weapon blade
      ctx.strokeStyle = f.weapon.bladeColor;
      ctx.lineWidth = f.weapon.type === 'greatsword' ? 5 : f.weapon.type === 'axe' ? 4 : 3;
      ctx.beginPath(); ctx.moveTo(handX, handY); ctx.lineTo(tipX, tipY); ctx.stroke();

      // Handle
      ctx.strokeStyle = f.weapon.color;
      ctx.lineWidth = 3;
      const handleLen = 15;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(handX - Math.cos(wAngle) * handleLen, handY - Math.sin(wAngle) * handleLen);
      ctx.stroke();

      // Axe head
      if (f.weapon.type === 'axe') {
        const axeX = tipX - Math.cos(wAngle) * 8;
        const axeY = tipY - Math.sin(wAngle) * 8;
        const perpX = -Math.sin(wAngle) * 12;
        const perpY = Math.cos(wAngle) * 12;
        ctx.fillStyle = '#999';
        ctx.beginPath();
        ctx.moveTo(axeX + perpX, axeY + perpY);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(axeX - perpX, axeY - perpY);
        ctx.closePath(); ctx.fill();
      }

      // Spear tip
      if (f.weapon.type === 'spear') {
        ctx.fillStyle = '#ccd';
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - Math.cos(wAngle) * 12 + Math.sin(wAngle) * 5, tipY - Math.sin(wAngle) * 12 - Math.cos(wAngle) * 5);
        ctx.lineTo(tipX - Math.cos(wAngle) * 12 - Math.sin(wAngle) * 5, tipY - Math.sin(wAngle) * 12 + Math.cos(wAngle) * 5);
        ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#600'; ctx.beginPath(); ctx.arc(16, shoulderY, 4, 0, Math.PI * 2); ctx.fill();
    }

    // ── HEAD ──
    if (!f.severedParts.has('head')) {
      const headY = ty - 16;
      const tilt = f.state === 'hit' ? 0.15 : f.state === 'stagger' ? 0.3 : f.state === 'block' ? -0.1 : 0;
      ctx.save(); ctx.translate(0, headY); ctx.rotate(tilt);

      // Hair
      ctx.fillStyle = f.hairColor;
      ctx.beginPath(); ctx.arc(0, -3, 16, Math.PI * 1.1, Math.PI * -0.1); ctx.fill();

      // Face
      ctx.fillStyle = f.skinColor;
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();

      // Helmet / headband
      ctx.fillStyle = f.color;
      ctx.fillRect(-15, -9, 30, 6);

      // Eyes
      if (f.state === 'ko' || f.state === 'dead') {
        ctx.lineWidth = 2; ctx.strokeStyle = '#111';
        [-5, 5].forEach(ex => {
          ctx.beginPath(); ctx.moveTo(ex - 3, -3); ctx.lineTo(ex + 3, 1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ex + 3, -3); ctx.lineTo(ex - 3, 1); ctx.stroke();
        });
      } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(-7, -4, 4, 4);
        ctx.fillRect(3, -4, 4, 4);
        ctx.fillStyle = '#eee';
        ctx.fillRect(-6, -3, 2, 2);
        ctx.fillRect(4, -3, 2, 2);
      }

      // Mouth
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (f.state === 'hit' || f.state === 'stagger') ctx.arc(0, 7, 4, 0, Math.PI);
      else if (['slash', 'heavySlash', 'overhead', 'stab'].includes(f.state)) { ctx.moveTo(-3, 6); ctx.lineTo(3, 8); }
      else { ctx.moveTo(-2, 7); ctx.lineTo(2, 7); }
      ctx.stroke();

      ctx.restore();
    } else {
      // Blood stump
      ctx.fillStyle = '#600';
      ctx.beginPath(); ctx.arc(0, ty - 8, 6, 0, Math.PI * 2); ctx.fill();
    }

    // Bleed effect
    if (f.bleedTimer > 0 && t % 4 === 0) {
      ctx.fillStyle = `rgba(120,0,0,${f.bleedTimer / 180})`;
      ctx.beginPath();
      ctx.arc((Math.random() - 0.5) * 20, -(Math.random() * 60 + 10), 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, []);

  // ─── GAME LOOP ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const g = gameRef.current;

    const onKeyDown = (e: KeyboardEvent) => { g.keys.add(e.key.toLowerCase()); e.preventDefault(); };
    const onKeyUp = (e: KeyboardEvent) => { g.keys.delete(e.key.toLowerCase()); e.preventDefault(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let fc = 0, animId = 0;

    const ss = (f: Fighter, state: FState, dur?: number) => {
      if (f.state === 'dead' || f.state === 'ko') return;
      f.state = state; f.frame = 0; f.stateTimer = dur || 0; f.hitDealt = false;
    };
    const canAct = (f: Fighter) => ['idle', 'walk', 'walkBack', 'crouch'].includes(f.state);
    const doAtk = (f: Fighter, type: string) => {
      const def = ATTACK_DEFS[type];
      if (!def || !canAct(f)) return;
      if (f.stamina < def.staminaCost) return;
      f.stamina -= def.staminaCost;
      const frames = Math.round(def.frames / f.weapon.speed);
      ss(f, type as FState, frames);
    };

    // AI
    const runAI = (bot: Fighter, pl: Fighter) => {
      if (bot.state === 'ko' || bot.state === 'dead' || bot.state === 'hit' || bot.state === 'stagger') return;
      bot.aiTimer--;
      if (bot.aiTimer > 0) return;

      const d = Math.abs(bot.x - pl.x);
      const fp = (pl.x > bot.x && bot.facing === 1) || (pl.x < bot.x && bot.facing === -1);
      const weaponRange = bot.weapon.length + 30;

      // React to attacks
      if (['slash', 'heavySlash', 'stab', 'overhead'].includes(pl.state) && d < 130) {
        if (Math.random() > 0.4 && bot.stamina > 10) {
          ss(bot, 'block');
          bot.aiTimer = 15 + Math.random() * 10 | 0;
          return;
        }
        if (Math.random() > 0.5) { bot.vx = -bot.facing * 6; bot.aiTimer = 12; return; }
      }

      if (d < weaponRange && fp && canAct(bot)) {
        const r = Math.random();
        if (r < 0.3) doAtk(bot, 'slash');
        else if (r < 0.5) doAtk(bot, 'stab');
        else if (r < 0.7 && bot.stamina > 25) doAtk(bot, 'heavySlash');
        else if (r < 0.8 && bot.stamina > 20) doAtk(bot, 'overhead');
        else ss(bot, 'block');
        bot.aiTimer = 12 + Math.random() * 18 | 0;
      } else if (d < weaponRange + 80) {
        // Approach carefully
        if (Math.random() > 0.3) {
          ss(bot, 'walk');
          bot.aiTimer = 8 + Math.random() * 15 | 0;
        } else {
          ss(bot, 'block');
          bot.aiTimer = 10 + Math.random() * 10 | 0;
        }
      } else {
        ss(bot, 'walk');
        bot.aiTimer = 10 + Math.random() * 15 | 0;
      }
    };

    // ── TICK ──
    const tick = () => {
      fc++;
      const speed = g.slowMo;
      if (g.slowMoTimer > 0) { g.slowMoTimer--; if (g.slowMoTimer <= 0) g.slowMo = 1; }

      const [p1, p2] = g.fighters;

      // Round states
      if (g.roundState === 'intro') {
        g.introTimer--;
        if (g.introTimer <= 0) g.roundState = 'fight';
      }
      if (g.roundState === 'ko') {
        g.koTimer--;
        if (g.koTimer <= 0) {
          g.round++;
          if (p1.wins >= 2 || p2.wins >= 2 || g.round > 3) { g.round = 1; p1.wins = 0; p2.wins = 0; }
          // Reset fighters
          const f1 = createFighter(350, p1.name, p1.color, p1.skinColor, p1.hairColor, Object.keys(WEAPONS).find(k => WEAPONS[k].name === p1.weapon.name) || 'greatsword', false);
          const f2 = createFighter(930, p2.name, p2.color, p2.skinColor, p2.hairColor, Object.keys(WEAPONS).find(k => WEAPONS[k].name === p2.weapon.name) || 'axe', true);
          f1.wins = p1.wins; f2.wins = p2.wins;
          g.fighters[0] = f1; g.fighters[1] = f2;
          g.blood = []; g.severedLimbs = []; g.bloodPools = []; g.particles = [];
          g.roundState = 'intro'; g.introTimer = 80; g.timer = 99 * 60;
        }
      }

      if (g.roundState !== 'fight') {
        if (fc % 3 === 0) setHud({
          p1hp: p1.hp, p2hp: p2.hp, timer: Math.ceil(g.timer / 60), round: g.round,
          p1st: p1.stamina, p2st: p2.stamina, p1w: p1.wins, p2w: p2.wins,
          rs: g.roundState, p1name: p1.name, p2name: p2.name,
          p1weapon: p1.weapon.name, p2weapon: p2.weapon.name,
        });
        return;
      }

      g.timer--;
      if (g.timer <= 0) {
        if (p1.hp >= p2.hp) { p1.wins++; ss(p2, 'ko'); } else { p2.wins++; ss(p1, 'ko'); }
        g.roundState = 'ko'; g.koTimer = 150;
      }

      // ── PLAYER INPUT ──
      if (canAct(p1) || p1.state === 'block') {
        if (g.keys.has('j')) doAtk(p1, 'slash');
        else if (g.keys.has('k')) doAtk(p1, 'stab');
        else if (g.keys.has('l')) doAtk(p1, 'heavySlash');
        else if (g.keys.has('u')) doAtk(p1, 'overhead');
        else if (g.keys.has('s') && g.keys.has('shift')) ss(p1, 'block');
        else if (g.keys.has('s')) ss(p1, 'crouch');
        else if (g.keys.has('w') && p1.grounded) { p1.vy = -10; p1.grounded = false; ss(p1, 'jump'); }
        else if (g.keys.has('a')) { p1.vx = -3.5; if (p1.grounded) ss(p1, p1.facing === -1 ? 'walk' : 'walkBack'); }
        else if (g.keys.has('d')) { p1.vx = 3.5; if (p1.grounded) ss(p1, p1.facing === 1 ? 'walk' : 'walkBack'); }
        else if (p1.grounded) ss(p1, 'idle');
      }

      runAI(p2, p1);

      // ── UPDATE FIGHTERS ──
      g.fighters.forEach((f, idx) => {
        const o = g.fighters[1 - idx];
        if (canAct(f)) f.facing = o.x > f.x ? 1 : -1;

        // Advance frames
        if (f.stateTimer > 0) {
          f.frame += speed;
          if (f.frame >= f.stateTimer) {
            if (f.state !== 'ko' && f.state !== 'dead') ss(f, 'idle');
          }
        }

        // Stamina regen
        if (canAct(f) || f.state === 'block') f.stamina = Math.min(f.maxStamina, f.stamina + 0.15);

        // Gravity
        if (!f.grounded) {
          f.vy += GRAVITY * speed;
          f.y += f.vy * speed;
          if (f.y >= GROUND_Y) { f.y = GROUND_Y; f.vy = 0; f.grounded = true; if (f.state === 'jump') ss(f, 'idle'); }
        }

        // Movement
        f.x += f.vx * speed;
        f.vx *= 0.88;
        if (f.state === 'walk') { f.x += f.facing * 3 * speed; f.walkCycle += 0.1 * speed; }
        else if (f.state === 'walkBack') { f.x -= f.facing * 2 * speed; f.walkCycle += 0.08 * speed; }
        f.x = Math.max(50, Math.min(W - 50, f.x));
        f.idleBob += 0.04 * speed;

        // Weapon angle
        const atkState = f.state as string;
        const ap2 = f.stateTimer > 0 ? f.frame / f.stateTimer : 0;
        if (atkState === 'slash') {
          f.weaponTargetAngle = ap2 < 0.3 ? -2.0 : ap2 < 0.55 ? 1.5 : 0.5;
        } else if (atkState === 'heavySlash') {
          f.weaponTargetAngle = ap2 < 0.35 ? -2.5 : ap2 < 0.6 ? 2.0 : 0.3;
        } else if (atkState === 'stab') {
          f.weaponTargetAngle = ap2 < 0.3 ? -0.3 : ap2 < 0.55 ? 0.1 : -0.3;
        } else if (atkState === 'overhead') {
          f.weaponTargetAngle = ap2 < 0.4 ? -2.8 : ap2 < 0.6 ? 1.8 : 0.0;
        } else {
          f.weaponTargetAngle = f.state === 'block' ? -1.2 : -0.5;
        }
        f.weaponAngle += (f.weaponTargetAngle - f.weaponAngle) * 0.25;

        // Bleed
        if (f.bleedTimer > 0) {
          f.bleedTimer -= speed;
          f.hp -= 0.02 * speed;
          if (fc % 8 === 0) spawnBlood(f.x, f.y - 40, f.facing, 2, 0.5);
        }

        // Combo decay
        if (f.comboTimer > 0) { f.comboTimer -= speed; if (f.comboTimer <= 0) f.combo = 0; }

        // KO check from bleed
        if (f.hp <= 0 && f.state !== 'ko' && f.state !== 'dead') {
          f.hp = 0;
          ss(f, 'ko');
          o.wins++;
          g.roundState = 'ko'; g.koTimer = 180;
          g.screenShake = 10;
        }
      });

      // Body collision
      const minDist = 55;
      const dx = g.fighters[1].x - g.fighters[0].x;
      const dist = Math.abs(dx);
      if (dist < minDist && dist > 0) {
        const push = (minDist - dist) / 2;
        const dir = dx > 0 ? 1 : -1;
        g.fighters[0].x -= push * dir;
        g.fighters[1].x += push * dir;
        g.fighters.forEach(f => f.x = Math.max(50, Math.min(W - 50, f.x)));
      }

      // ── HIT DETECTION ──
      g.fighters.forEach((f, idx) => {
        const o = g.fighters[1 - idx];
        const atkDef = ATTACK_DEFS[f.state];
        if (!atkDef || f.hitDealt) return;

        const scaledHitStart = Math.round(atkDef.hitStart / f.weapon.speed);
        const scaledHitEnd = Math.round(atkDef.hitEnd / f.weapon.speed);

        if (f.frame >= scaledHitStart && f.frame <= scaledHitEnd) {
          const hitX = f.x + f.facing * (f.weapon.length * 0.7);
          const hitY = f.y - 50;
          const hitDist = Math.abs(hitX - o.x);
          const hitDistY = Math.abs(hitY - (o.y - 50));

          if (hitDist < 55 && hitDistY < 60) {
            f.hitDealt = true;
            const dmg = f.weapon[atkDef.dmgKey];

            if (o.state === 'block' && o.stamina > 5) {
              // Blocked
              o.vx = f.facing * atkDef.knockback.x * 0.3;
              o.stamina -= dmg * 0.8;
              spawnSparks((f.x + o.x) / 2, (f.y + o.y) / 2 - 50, 8);
              g.screenShake = 3;
            } else {
              // Hit!
              f.combo++; f.comboTimer = 60;
              let finalDmg = dmg;
              if (f.combo > 1) finalDmg *= (1 + f.combo * 0.1);

              o.hp = Math.max(0, o.hp - finalDmg);
              o.vx = f.facing * atkDef.knockback.x;
              o.vy = atkDef.knockback.y;
              if (atkDef.knockback.y < -3) o.grounded = false;

              // Stagger or hit reaction
              if (dmg >= 20) {
                ss(o, 'stagger', 30);
                g.screenShake = 8;
                g.slowMo = 0.4; g.slowMoTimer = 8;
              } else {
                ss(o, 'hit', 18);
                g.screenShake = 4;
              }

              // Blood
              spawnBlood(o.x, o.y - 45, f.facing, Math.round(dmg * 0.8), dmg / 15);

              // Dismemberment check
              if (atkDef.canDismember && o.hp < 25 && Math.random() < 0.35) {
                const parts = ['leftArm', 'rightArm'].filter(p => !o.severedParts.has(p));
                if (o.hp < 10) parts.push(...['leftLeg', 'rightLeg'].filter(p => !o.severedParts.has(p)));
                if (o.hp <= 0) parts.push('head');
                if (parts.length > 0) {
                  dismember(o, parts[Math.floor(Math.random() * parts.length)], f.facing);
                }
              }

              // KO
              if (o.hp <= 0) {
                ss(o, 'ko');
                f.wins++;
                g.roundState = 'ko'; g.koTimer = 180;
                g.screenShake = 15;
                g.slowMo = 0.2; g.slowMoTimer = 25;
                spawnBlood(o.x, o.y - 40, f.facing, 30, 3);
              }
            }
          }
        }
      });

      // ── UPDATE PARTICLES ──
      g.blood = g.blood.filter(b => {
        b.x += b.vx * speed; b.y += b.vy * speed;
        b.vy += 0.25 * speed; b.vx *= 0.99;
        b.life -= speed;
        // Create blood pool on ground
        if (b.y >= GROUND_Y && b.type !== 'pool') {
          b.type = 'pool'; b.vy = 0; b.vx = 0; b.y = GROUND_Y;
          if (g.bloodPools.length < 50) {
            const existing = g.bloodPools.find(p => Math.abs(p.x - b.x) < 20);
            if (existing) { existing.radius = Math.min(25, existing.radius + 1); }
            else { g.bloodPools.push({ x: b.x, y: GROUND_Y, radius: 3 + Math.random() * 5, opacity: 0.6 }); }
          }
        }
        return b.life > 0;
      });

      g.particles = g.particles.filter(p => { p.x += p.vx * speed; p.y += p.vy * speed; p.vy += 0.3 * speed; p.life -= speed; return p.life > 0; });
      g.clashSparks = g.clashSparks.filter(s => { s.timer -= speed; return s.timer > 0; });
      g.severedLimbs = g.severedLimbs.filter(l => {
        l.joints.forEach(j => { j.x += l.vel.x * speed; j.y += l.vel.y * speed; });
        l.vel.y += 0.3 * speed;
        l.angle += l.angVel * speed;
        if (l.joints[0] && l.joints[0].y >= GROUND_Y) { l.vel.x *= 0.8; l.vel.y *= -0.3; l.angVel *= 0.8; }
        l.life -= speed;
        return l.life > 0;
      });
      g.bloodPools.forEach(p => p.opacity = Math.max(0.1, p.opacity - 0.0005));

      if (g.screenShake > 0) g.screenShake *= 0.9;

      if (fc % 3 === 0) setHud({
        p1hp: p1.hp, p2hp: p2.hp, timer: Math.ceil(g.timer / 60), round: g.round,
        p1st: p1.stamina, p2st: p2.stamina, p1w: p1.wins, p2w: p2.wins,
        rs: g.roundState, p1name: p1.name, p2name: p2.name,
        p1weapon: p1.weapon.name, p2weapon: p2.weapon.name,
      });
    };

    // ── RENDER ──
    const render = () => {
      tick();

      const shk = gameRef.current.screenShake;
      const sx = shk > 0.5 ? (Math.random() - 0.5) * shk * 2 : 0;
      const sy = shk > 0.5 ? (Math.random() - 0.5) * shk * 2 : 0;
      ctx.save(); ctx.translate(sx, sy);

      // ── BACKGROUND ──
      const skyG = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      skyG.addColorStop(0, '#050510'); skyG.addColorStop(0.4, '#0a0a20'); skyG.addColorStop(0.8, '#121230'); skyG.addColorStop(1, '#1a1535');
      ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, GROUND_Y);

      // Distant mountains
      ctx.fillStyle = '#0c0c1e';
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, GROUND_Y - 100 - Math.sin(x * 0.006) * 50 - Math.sin(x * 0.013) * 25);
      ctx.lineTo(W, GROUND_Y); ctx.fill();

      // Ruined castle
      ctx.fillStyle = '#08081a';
      ctx.fillRect(480, GROUND_Y - 240, 320, 240);
      ctx.beginPath(); ctx.moveTo(460, GROUND_Y - 240); ctx.lineTo(640, GROUND_Y - 330); ctx.lineTo(820, GROUND_Y - 240); ctx.fill();
      // Broken towers
      ctx.fillRect(490, GROUND_Y - 300, 35, 300);
      ctx.fillRect(755, GROUND_Y - 280, 35, 280);
      // Windows (glowing)
      ctx.fillStyle = '#221515';
      [530, 600, 670, 730].forEach(wx => { ctx.fillRect(wx, GROUND_Y - 180, 15, 20); ctx.fillRect(wx, GROUND_Y - 130, 15, 20); });

      // Moon
      ctx.fillStyle = 'rgba(180,160,140,0.08)';
      ctx.beginPath(); ctx.arc(200, 120, 50, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(180,160,140,0.04)';
      ctx.beginPath(); ctx.arc(200, 120, 70, 0, Math.PI * 2); ctx.fill();

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 40; i++) ctx.fillRect((i * 137.5 + 50) % W, (i * 73.1 + 20) % (GROUND_Y * 0.5), 1 + (i % 2), 1 + (i % 2));

      // Ground
      const gG = ctx.createLinearGradient(0, GROUND_Y - 5, 0, H);
      gG.addColorStop(0, '#1a1008'); gG.addColorStop(0.3, '#140c06'); gG.addColorStop(1, '#0a0604');
      ctx.fillStyle = gG; ctx.fillRect(0, GROUND_Y - 5, W, H - GROUND_Y + 5);

      // Ground line with crack detail
      ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x + 15, GROUND_Y + 8); ctx.lineTo(x + 30, GROUND_Y + 3); ctx.stroke();
      }

      // ── BLOOD POOLS ──
      const gg = gameRef.current;
      gg.bloodPools.forEach(p => {
        ctx.fillStyle = `rgba(80,0,0,${p.opacity})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, p.radius, p.radius * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      });

      // ── SEVERED LIMBS ──
      gg.severedLimbs.forEach(l => {
        ctx.save();
        if (l.joints.length > 0) ctx.translate(l.joints[0].x, l.joints[0].y);
        ctx.rotate(l.angle);
        ctx.strokeStyle = l.color; ctx.lineWidth = l.thickness; ctx.lineCap = 'round';
        l.bones.forEach(([a, b]) => {
          if (l.joints[a] && l.joints[b]) {
            const ja = v2sub(l.joints[a], l.joints[0] || v2());
            const jb = v2sub(l.joints[b], l.joints[0] || v2());
            ctx.beginPath(); ctx.moveTo(ja.x, ja.y); ctx.lineTo(jb.x, jb.y); ctx.stroke();
          }
        });
        // Blood drip from limb
        ctx.fillStyle = '#600';
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // ── FIGHTERS ──
      gg.fighters.forEach(f => drawFighter(ctx, f, fc));

      // ── BLOOD DROPS ──
      gg.blood.forEach(b => {
        if (b.type === 'pool') return;
        const alpha = b.life / b.maxLife;
        ctx.fillStyle = b.type === 'spray'
          ? `rgba(160,0,0,${alpha})`
          : `rgba(120,0,0,${alpha * 0.8})`;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.size * (0.5 + alpha * 0.5), 0, Math.PI * 2); ctx.fill();
      });

      // ── SPARKS ──
      gg.particles.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Clash spark flashes
      gg.clashSparks.forEach(s => {
        const a = s.timer / 12;
        ctx.strokeStyle = `rgba(255,255,200,${a})`; ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const ang = s.angle + (i / 8) * Math.PI * 2;
          const len = (12 - s.timer) * 5;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(ang) * 3, s.y + Math.sin(ang) * 3);
          ctx.lineTo(s.x + Math.cos(ang) * len, s.y + Math.sin(ang) * len);
          ctx.stroke();
        }
      });

      // ── ROUND INTRO ──
      if (gg.roundState === 'intro') {
        const p = 1 - gg.introTimer / 80;
        ctx.fillStyle = `rgba(0,0,0,${0.6 * (1 - p)})`; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2 - 50);
        ctx.scale(0.5 + p * 0.5, 0.5 + p * 0.5);
        ctx.font = 'bold 64px "Georgia", serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#a88'; ctx.globalAlpha = Math.min(1, p * 3);
        ctx.fillText(`ROUND ${gg.round}`, 0, 0);
        if (p > 0.5) {
          ctx.font = 'bold 42px "Georgia", serif'; ctx.fillStyle = '#c44';
          ctx.globalAlpha = (p - 0.5) * 2;
          ctx.fillText('FIGHT!', 0, 55);
        }
        ctx.restore();
      }

      // ── KO ──
      if (gg.roundState === 'ko') {
        const p = 1 - gg.koTimer / 180;
        // Dramatic vignette
        const vig = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W / 2);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, `rgba(0,0,0,${Math.min(0.6, p * 2)})`);
        ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

        ctx.save(); ctx.translate(W / 2, H / 2 - 40);
        const sc = p < 0.15 ? p / 0.15 : 1;
        ctx.scale(sc, sc);
        ctx.font = 'bold 88px "Georgia", serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#200'; ctx.fillText('K.O.', 3, 3);
        ctx.fillStyle = '#a00'; ctx.fillText('K.O.', 0, 0);
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [drawFighter, spawnBlood, spawnSparks, dismember]);

  // ─── HUD ───────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black select-none">
      <canvas ref={canvasRef} width={W} height={H} className="max-w-full max-h-full" />

      {/* HUD Overlay */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ maxWidth: W, margin: '0 auto' }}>
        <div className="flex items-start justify-between p-3 gap-3">
          {/* P1 */}
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-bold text-red-400 font-mono tracking-widest">{hud.p1name}</span>
              <span className="text-[9px] text-red-400/50 font-mono">{hud.p1weapon}</span>
            </div>
            <div className="h-5 bg-black/80 border border-red-900/60 rounded-sm overflow-hidden relative">
              <div className="h-full transition-all duration-300 rounded-sm" style={{ width: `${hud.p1hp}%`, background: 'linear-gradient(180deg, #b22 0%, #711 100%)' }} />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
            </div>
            <div className="h-1.5 bg-black/50 border border-yellow-900/30 mt-0.5 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-200" style={{ width: `${hud.p1st}%`, background: 'linear-gradient(90deg, #a80, #cc0)' }} />
            </div>
            <div className="flex gap-1 mt-1">
              {[0, 1].map(i => <div key={i} className={`w-2.5 h-2.5 rounded-full border ${i < hud.p1w ? 'bg-red-600 border-red-500' : 'border-red-900/40'}`} />)}
            </div>
          </div>

          {/* Timer */}
          <div className="text-center px-3">
            <div className="text-3xl font-bold text-white/90 font-mono tabular-nums min-w-[50px]" style={{ fontFamily: 'Georgia, serif' }}>{hud.timer}</div>
            <div className="text-[9px] text-white/30 font-mono tracking-widest">ROUND {hud.round}</div>
          </div>

          {/* P2 */}
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1 justify-end">
              <span className="text-[9px] text-blue-400/50 font-mono">{hud.p2weapon}</span>
              <span className="text-xs font-bold text-blue-400 font-mono tracking-widest">{hud.p2name}</span>
            </div>
            <div className="h-5 bg-black/80 border border-blue-900/60 rounded-sm overflow-hidden relative">
              <div className="h-full transition-all duration-300 rounded-sm ml-auto" style={{ width: `${hud.p2hp}%`, background: 'linear-gradient(180deg, #33a 0%, #226 100%)' }} />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
            </div>
            <div className="h-1.5 bg-black/50 border border-yellow-900/30 mt-0.5 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-200 ml-auto" style={{ width: `${hud.p2st}%`, background: 'linear-gradient(90deg, #cc0, #a80)' }} />
            </div>
            <div className="flex gap-1 mt-1 justify-end">
              {[0, 1].map(i => <div key={i} className={`w-2.5 h-2.5 rounded-full border ${i < hud.p2w ? 'bg-blue-600 border-blue-500' : 'border-blue-900/40'}`} />)}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/20 text-[10px] font-mono pointer-events-none text-center tracking-wider">
        WASD Move • J Slash • K Stab • L Heavy • U Overhead • S+Shift Block
      </div>
    </div>
  );
};

export default RagdollArena;
