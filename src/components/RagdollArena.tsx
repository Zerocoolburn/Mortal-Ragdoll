import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════
// CONSTANTS & TYPES
// ═══════════════════════════════════════════════════════
const NAMES = ['BLAZE','VENOM','PHANTOM','TITAN','STORM','WRAITH','NOVA','FANG','REAPER','JINX'];
const COLORS = [0xff2244,0x00ff88,0x4488ff,0xffaa00,0xff00ff,0x00ffff,0xff6600,0x88ff00,0xff0088,0xaa44ff];
const HEX = ['#ff2244','#00ff88','#4488ff','#ffaa00','#ff00ff','#00ffff','#ff6600','#88ff00','#ff0088','#aa44ff'];
const GLOWS = ['#ff6688','#66ffbb','#88bbff','#ffcc55','#ff66ff','#66ffff','#ff9944','#bbff55','#ff55aa','#cc88ff'];
type Style = 'aggro'|'def'|'zerk'|'tact'|'assassin';
const STYLES: Style[] = ['aggro','def','zerk','tact','assassin','aggro','zerk','tact','assassin','def'];
type WeaponType = 'sword'|'axe'|'spear'|'dual'|'greatsword';
const WEAPON_TYPES: WeaponType[] = ['sword','greatsword','spear','axe','dual','sword','dual','spear','greatsword','axe'];
const ARENA_R = 12;
const PILLAR_COUNT = 6;
const GRAVITY = 22;
const MAX_SPARKS = 250;
const MAX_BLOOD = 180;
const MAX_ANNOUNCEMENTS = 5;

interface V3 { x: number; y: number; z: number }
const v3 = (x=0,y=0,z=0): V3 => ({x,y,z});
const add3 = (a: V3, b: V3): V3 => ({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub3 = (a: V3, b: V3): V3 => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale3 = (a: V3, s: number): V3 => ({x:a.x*s,y:a.y*s,z:a.z*s});
const len3 = (a: V3) => Math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z);
const norm3 = (a: V3): V3 => { const l=len3(a)||1; return {x:a.x/l,y:a.y/l,z:a.z/l}; };
const dist3 = (a: V3, b: V3) => len3(sub3(a,b));
const dot3 = (a: V3, b: V3) => a.x*b.x+a.y*b.y+a.z*b.z;
const lerp = (a: number, b: number, t: number) => a+(b-a)*t;
const lerpV3 = (a: V3, b: V3, t: number): V3 => ({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z:lerp(a.z,b.z,t)});
const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));
const rng = (a=0,b=1) => a + Math.random()*(b-a);

// Weapon definitions
interface WeaponDef {
  name: string; type: WeaponType; reach: number; speed: number;
  dmgMult: number; kbMult: number; bladeLen: number; bladeWidth: number;
  comboChain: AtkType[]; guardSize: number;
}
const WEAPONS: Record<WeaponType, WeaponDef> = {
  sword: { name:'Longsword', type:'sword', reach:1.0, speed:1.0, dmgMult:1.0, kbMult:1.0, bladeLen:0.85, bladeWidth:0.04, comboChain:['slash_r','slash_l','thrust','overhead'], guardSize:0.14 },
  axe: { name:'Battle Axe', type:'axe', reach:0.9, speed:0.75, dmgMult:1.5, kbMult:1.6, bladeLen:0.75, bladeWidth:0.12, comboChain:['overhead','slash_r','sweep','overhead'], guardSize:0.06 },
  spear: { name:'Spear', type:'spear', reach:1.5, speed:1.1, dmgMult:0.9, kbMult:0.7, bladeLen:1.3, bladeWidth:0.025, comboChain:['thrust','thrust','sweep','thrust'], guardSize:0.04 },
  dual: { name:'Twin Daggers', type:'dual', reach:0.65, speed:1.6, dmgMult:0.6, kbMult:0.5, bladeLen:0.45, bladeWidth:0.03, comboChain:['slash_r','slash_l','slash_r','slash_l','thrust','spin'], guardSize:0.08 },
  greatsword: { name:'Greatsword', type:'greatsword', reach:1.25, speed:0.55, dmgMult:2.0, kbMult:2.2, bladeLen:1.15, bladeWidth:0.06, comboChain:['overhead','sweep','spin'], guardSize:0.18 },
};

type AtkType = 'slash_r'|'slash_l'|'thrust'|'overhead'|'sweep'|'spin';
interface AtkDef {
  type: AtkType; baseDmg: number; rangeMult: number; dur: number; kb: number;
  startAngle: number; endAngle: number; yStart: number; yEnd: number;
  canCombo: boolean; comboWindow: number; staminaCost: number;
}
const ATTACKS: Record<AtkType, AtkDef> = {
  slash_r:  { type:'slash_r',  baseDmg:12, rangeMult:1.0, dur:0.22, kb:3,  startAngle:-2.0, endAngle:1.5, yStart:0.1, yEnd:-0.1, canCombo:true, comboWindow:0.3, staminaCost:12 },
  slash_l:  { type:'slash_l',  baseDmg:12, rangeMult:1.0, dur:0.22, kb:3,  startAngle:2.0,  endAngle:-1.5, yStart:0.1, yEnd:-0.1, canCombo:true, comboWindow:0.3, staminaCost:12 },
  thrust:   { type:'thrust',   baseDmg:16, rangeMult:1.3, dur:0.18, kb:4.5, startAngle:0, endAngle:0, yStart:0.3, yEnd:0.3, canCombo:true, comboWindow:0.25, staminaCost:15 },
  overhead: { type:'overhead',  baseDmg:22, rangeMult:0.85, dur:0.35, kb:6,  startAngle:-0.2, endAngle:-0.2, yStart:0.9, yEnd:-0.4, canCombo:false, comboWindow:0.15, staminaCost:22 },
  sweep:    { type:'sweep',    baseDmg:10, rangeMult:1.1, dur:0.28, kb:2.5, startAngle:-2.8, endAngle:2.8, yStart:-0.3, yEnd:-0.3, canCombo:true, comboWindow:0.35, staminaCost:14 },
  spin:     { type:'spin',     baseDmg:28, rangeMult:1.0, dur:0.5, kb:8, startAngle:0, endAngle:6.28, yStart:0, yEnd:0, canCombo:false, comboWindow:0, staminaCost:35 },
};

// Skeleton - 16 joints with muscular proportions
const J = { head:0, neck:1, chest:2, hip:3, lShoulder:4, lElbow:5, lHand:6, rShoulder:7, rElbow:8, rHand:9, lHip:10, lKnee:11, lFoot:12, rHip:13, rKnee:14, rFoot:15 };
// Limb connections: [jointA, jointB, thickness]
const LIMBS: [number,number,number][] = [
  [J.head,J.neck,.04],     // neck
  [J.neck,J.chest,.16],    // upper torso (thick)
  [J.chest,J.hip,.15],     // lower torso (thick)
  [J.neck,J.lShoulder,.13],// shoulder
  [J.lShoulder,J.lElbow,.09],// upper arm
  [J.lElbow,J.lHand,.07],  // forearm
  [J.neck,J.rShoulder,.13],// shoulder
  [J.rShoulder,J.rElbow,.09],// upper arm
  [J.rElbow,J.rHand,.07],  // forearm
  [J.hip,J.lHip,.13],      // pelvis
  [J.lHip,J.lKnee,.1],     // thigh
  [J.lKnee,J.lFoot,.08],   // shin
  [J.hip,J.rHip,.13],      // pelvis
  [J.rHip,J.rKnee,.1],     // thigh
  [J.rKnee,J.rFoot,.08],   // shin
];

// Standing pose - more athletic proportions
const STAND: V3[] = [
  v3(0,1.92,0),   // head
  v3(0,1.72,0),   // neck
  v3(0,1.42,0),   // chest
  v3(0,1.05,0),   // hip
  v3(-.24,1.64,0), // lShoulder
  v3(-.40,1.32,0), // lElbow
  v3(-.42,1.05,0), // lHand
  v3(.24,1.64,0),  // rShoulder
  v3(.40,1.32,0),  // rElbow
  v3(.42,1.05,0),  // rHand
  v3(-.14,0.98,0), // lHip
  v3(-.15,0.52,0), // lKnee
  v3(-.15,0.04,0), // lFoot
  v3(.14,0.98,0),  // rHip
  v3(.15,0.52,0),  // rKnee
  v3(.15,0.04,0),  // rFoot
];

// Arena pillars
interface Pillar { x: number; z: number; r: number; h: number }
function makePillars(): Pillar[] {
  const out: Pillar[] = [];
  for (let i = 0; i < PILLAR_COUNT; i++) {
    const a = (i / PILLAR_COUNT) * Math.PI * 2 + 0.3;
    const r = ARENA_R * 0.55;
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: 0.5, h: 3 });
  }
  return out;
}
const PILLARS = makePillars();

// ═══════════════════════════════════════════════════════
// BOT
// ═══════════════════════════════════════════════════════
interface Bot {
  id: number; name: string; color: number; hex: string; glow: string; style: Style;
  weapon: WeaponDef; weaponType: WeaponType;
  pos: V3; vel: V3; facing: number; targetFacing: number; walkPhase: number;
  joints: V3[]; jointVel: V3[]; ragdollTimer: number;
  hp: number; maxHp: number; alive: boolean; stun: number; stamina: number; maxStamina: number;
  // Combat
  atkCd: number; dodgeCd: number; specCd: number; blockCd: number; parryCd: number;
  kills: number; dmg: number; rage: number; combo: number; comboTimer: number; lastHit: number;
  totalHits: number; parries: number;
  // Current attack
  atk: AtkDef|null; atkTimer: number; atkProgress: number; hitThisSwing: Set<number>;
  // Sword visual
  swordAngle: number; swordY: number; swordTipPos: V3; swordBasePos: V3;
  // AI state
  aiState: 'approach'|'engage'|'circle'|'retreat'|'flank'|'hunt'|'berserk';
  aiTimer: number; aiSubTimer: number;
  circleDir: number; strafeDir: number;
  blocking: boolean; blockTimer: number; parryWindow: number;
  feintChance: number; patience: number;
  threatMap: number[]; // threat from each bot
  // Movement
  moveX: number; moveZ: number; sprinting: boolean;
  // Rendering
  group: THREE.Group|null; limbMeshes: THREE.Mesh[]; headMesh: THREE.Mesh|null;
  swordGroup: THREE.Group|null; swordTrail: THREE.Mesh|null;
  footMeshes: THREE.Mesh[]; eyeL: THREE.Mesh|null; eyeR: THREE.Mesh|null;
  bodyTilt: number; breathPhase: number;
  // Status effects
  bleeding: number; bleedTimer: number;
  lastDodgeTime: number;
  deathVel: V3;
}

interface Spark { p: V3; v: V3; life: number; ml: number; color: number; size: number; mesh: THREE.Mesh|null }
interface BloodPool { x: number; z: number; size: number; color: number; mesh: THREE.Mesh|null; age: number }
interface Announcement { text: string; color: string; time: number; size: 'big'|'med'|'small' }

interface GameState {
  bots: Bot[]; sparks: Spark[]; blood: BloodPool[];
  t: number; over: boolean; winner: Bot|null;
  round: number; slow: number; slowTimer: number; winTimer: number; shakeIntensity: number;
  announcements: Announcement[]; killFeedTimer: number;
  intensity: number; // 0-1 combat intensity for dynamic effects
  lastKillTime: number; multiKillTimer: number; multiKillCount: number;
  pillars: Pillar[];
}

function mkBot(i: number): Bot {
  const angle = (i / 10) * Math.PI * 2;
  const r = 3 + rng(0, 2);
  const px = Math.cos(angle) * r, pz = Math.sin(angle) * r;
  const joints = STAND.map(o => v3(px + o.x, o.y, pz + o.z));
  const wt = WEAPON_TYPES[i];
  const weapon = WEAPONS[wt];
  return {
    id: i, name: NAMES[i], color: COLORS[i], hex: HEX[i], glow: GLOWS[i], style: STYLES[i],
    weapon, weaponType: wt,
    pos: v3(px, 0, pz), vel: v3(), facing: angle + Math.PI, targetFacing: angle + Math.PI,
    walkPhase: rng(0, 6.28),
    joints, jointVel: joints.map(() => v3()), ragdollTimer: 0,
    hp: 120, maxHp: 120, alive: true, stun: 0, stamina: 100, maxStamina: 100,
    atkCd: 0.3 + rng(0, 0.5), dodgeCd: 0, specCd: 0, blockCd: 0, parryCd: 0,
    kills: 0, dmg: 0, rage: 0, combo: 0, comboTimer: 0, lastHit: -1,
    totalHits: 0, parries: 0,
    atk: null, atkTimer: 0, atkProgress: 0, hitThisSwing: new Set(),
    swordAngle: -0.5, swordY: 0, swordTipPos: v3(), swordBasePos: v3(),
    aiState: 'approach', aiTimer: 0, aiSubTimer: 0,
    circleDir: rng() > 0.5 ? 1 : -1, strafeDir: rng() > 0.5 ? 1 : -1,
    blocking: false, blockTimer: 0, parryWindow: 0,
    feintChance: rng(0.05, 0.2), patience: rng(0.3, 1),
    threatMap: new Array(10).fill(0),
    moveX: 0, moveZ: 0, sprinting: false,
    group: null, limbMeshes: [], headMesh: null,
    swordGroup: null, swordTrail: null,
    footMeshes: [], eyeL: null, eyeR: null,
    bodyTilt: 0, breathPhase: rng(0, 6.28),
    bleeding: 0, bleedTimer: 0,
    lastDodgeTime: -10,
    deathVel: v3(),
  };
}

// ═══════════════════════════════════════════════════════
// COMBAT SYSTEM
// ═══════════════════════════════════════════════════════
function startAttack(b: Bot, type: AtkType): boolean {
  const adef = ATTACKS[type];
  if (b.atk || b.atkCd > 0 || b.ragdollTimer > 0 || b.stun > 0) return false;
  if (b.stamina < adef.staminaCost * 0.5) return false; // need at least half stamina

  b.atk = adef;
  b.atkTimer = adef.dur / b.weapon.speed;
  b.atkProgress = 0;
  b.hitThisSwing.clear();
  b.stamina -= adef.staminaCost;

  // Lunge
  const lungePower = type === 'thrust' ? 5 : type === 'spin' ? 1.5 : type === 'overhead' ? 3 : 3;
  b.vel.x += Math.cos(b.facing) * lungePower;
  b.vel.z += Math.sin(b.facing) * lungePower;
  b.atkCd = (adef.dur / b.weapon.speed) + 0.08;
  b.comboTimer = adef.comboWindow;
  return true;
}

function comboAttack(b: Bot): boolean {
  const chain = b.weapon.comboChain;
  const idx = b.combo % chain.length;
  return startAttack(b, chain[idx]);
}

function startBlock(b: Bot): boolean {
  if (b.blockCd > 0 || b.atk || b.ragdollTimer > 0 || b.stamina < 10) return false;
  b.blocking = true;
  b.blockTimer = 0.4 + rng(0, 0.4);
  b.parryWindow = 0.12; // first 120ms is a parry
  b.blockCd = 0.5;
  b.stamina -= 8;
  return true;
}

function dodge(b: Bot, dx: number, dz: number, power = 8) {
  if (b.dodgeCd > 0 || b.ragdollTimer > 0 || b.stamina < 20) return;
  const d = Math.sqrt(dx*dx+dz*dz) || 1;
  b.vel.x += (dx/d) * power;
  b.vel.z += (dz/d) * power;
  b.dodgeCd = 0.6;
  b.stamina -= 18;
  b.lastDodgeTime = 0; // will be set to game time in AI
}

// ═══════════════════════════════════════════════════════
// SKELETON ANIMATION
// ═══════════════════════════════════════════════════════
function updateSkeleton(b: Bot, dt: number) {
  if (!b.alive && b.ragdollTimer <= 0) return;

  const speed = Math.sqrt(b.vel.x*b.vel.x + b.vel.z*b.vel.z);
  const isWalking = speed > 0.3;
  const isRunning = speed > 3;
  const isSprinting = speed > 5;

  if (isWalking) b.walkPhase += dt * speed * 3.5;
  b.breathPhase += dt * 2.5;

  const sin = Math.sin(b.walkPhase);
  const cos = Math.cos(b.walkPhase);
  const cf = Math.cos(b.facing), sf = Math.sin(b.facing);
  const breathSin = Math.sin(b.breathPhase);

  // Body dynamics
  const bobY = isWalking ? Math.abs(sin) * (isSprinting ? 0.12 : isRunning ? 0.08 : 0.04) : breathSin * 0.008;
  const leanFwd = isWalking ? (isSprinting ? 0.2 : isRunning ? 0.12 : 0.05) : 0;
  const hipSway = isWalking ? sin * (isRunning ? 0.05 : 0.03) : 0;
  const shoulderRotation = isWalking ? sin * (isRunning ? 0.08 : 0.04) : 0;

  const targetTilt = isWalking ? clamp(speed * 0.025, 0, 0.2) : 0;
  b.bodyTilt = lerp(b.bodyTilt, targetTilt, dt * 6);

  // Attack pose
  let atkSwordAngle = -0.5;
  let atkSwordY = 0;
  let atkChestTwist = 0;
  let atkLArmAngle = 0;
  let atkRArmExtend = 0;

  if (b.atk && b.atkTimer > 0) {
    const totalDur = b.atk.dur / b.weapon.speed;
    const p = 1 - b.atkTimer / totalDur;
    b.atkProgress = p;
    const a = b.atk;

    // Weapon-specific animation multipliers
    const wReach = b.weapon.reach;

    if (a.type === 'spin') {
      atkChestTwist = p * a.endAngle;
      atkSwordAngle = -0.8;
      atkRArmExtend = 0.3 * wReach;
    } else if (a.type === 'thrust') {
      const windUp = clamp(p * 4, 0, 1);
      const extend = clamp((p - 0.25) * 4, 0, 1);
      atkSwordAngle = 0;
      atkSwordY = lerp(0.15, a.yEnd, extend);
      atkRArmExtend = lerp(-0.15, 0.5 * wReach, extend);
      atkLArmAngle = lerp(0, -0.5, windUp);
    } else if (a.type === 'overhead') {
      const raise = clamp(p * 3, 0, 1);
      const slam = clamp((p - 0.33) * 3, 0, 1);
      atkSwordY = lerp(0.8, -0.5, slam);
      atkSwordAngle = lerp(-0.3, -0.3, raise);
      atkRArmExtend = lerp(0, 0.2 * wReach, slam);
    } else if (a.type === 'sweep') {
      atkSwordAngle = lerp(a.startAngle, a.endAngle, p);
      atkSwordY = a.yStart;
      atkChestTwist = lerp(a.startAngle * 0.2, a.endAngle * 0.2, p);
    } else {
      // Slashes
      atkSwordAngle = lerp(a.startAngle, a.endAngle, p);
      atkSwordY = lerp(a.yStart, a.yEnd, p);
      atkChestTwist = lerp(a.startAngle * 0.25, a.endAngle * 0.15, p);
      atkRArmExtend = 0.15 * wReach;
    }
  } else if (b.blocking) {
    atkSwordAngle = 0.2;
    atkSwordY = 0.5;
    atkLArmAngle = 0.9;
    atkRArmExtend = 0.1;
  } else {
    // Idle combat stance - weapon-specific
    if (b.weaponType === 'spear') { atkSwordAngle = 0.1; atkSwordY = 0.2; }
    else if (b.weaponType === 'dual') { atkSwordAngle = -0.3; atkSwordY = 0; }
    else if (b.weaponType === 'greatsword') { atkSwordAngle = -0.6; atkSwordY = 0.1; }
    else if (b.weaponType === 'axe') { atkSwordAngle = -0.4; atkSwordY = 0; }
  }

  b.swordAngle = atkSwordAngle;
  b.swordY = atkSwordY;

  // Place all joints
  for (let i = 0; i < 16; i++) {
    const o = STAND[i];
    const twist = i <= 9 ? atkChestTwist : 0;
    const shoulderTwist = (i >= 4 && i <= 9) ? shoulderRotation : 0;
    const fa = b.facing + twist + shoulderTwist;
    const cfa = Math.cos(fa), sfa = Math.sin(fa);
    const rotX = o.x * cfa - o.z * sfa;
    const rotZ = o.x * sfa + o.z * cfa;

    let tx = b.pos.x + rotX;
    let ty = o.y + bobY;
    let tz = b.pos.z + rotZ;

    // Breathing
    if (i === J.chest || i === J.neck) {
      ty += breathSin * 0.005;
    }

    // Body lean
    if (i <= 3) {
      const leanMult = (3 - i) * 0.35;
      tx += cf * leanFwd * leanMult;
      tz += sf * leanFwd * leanMult;
      const perpX = -sf, perpZ = cf;
      tx += perpX * hipSway * (i === 3 ? 1.2 : 0.5);
      tz += perpZ * hipSway * (i === 3 ? 1.2 : 0.5);
    }

    // Shoulder counter-rotation
    if (i === J.lShoulder || i === J.rShoulder) {
      const dir = i === J.lShoulder ? 1 : -1;
      tx += cf * shoulderRotation * dir * 0.1;
      tz += sf * shoulderRotation * dir * 0.1;
    }

    // Leg animation - proper gait cycle
    if (isWalking) {
      const stride = isSprinting ? 0.5 : isRunning ? 0.38 : 0.26;
      const lift = isSprinting ? 0.25 : isRunning ? 0.18 : 0.1;
      const kneeForward = isSprinting ? 0.2 : 0.12;
      const kneeOut = 0.04;

      if (i === J.lFoot) {
        tx += cf * sin * stride;
        tz += sf * sin * stride;
        ty = Math.max(0.04, ty + Math.max(0, sin) * lift);
      } else if (i === J.rFoot) {
        tx -= cf * sin * stride;
        tz -= sf * sin * stride;
        ty = Math.max(0.04, ty + Math.max(0, -sin) * lift);
      } else if (i === J.lKnee) {
        tx += cf * sin * stride * 0.5;
        tz += sf * sin * stride * 0.5;
        ty += Math.max(0, sin) * kneeForward;
        // Knee outward bend
        tx += (-sf) * kneeOut;
        tz += cf * kneeOut;
      } else if (i === J.rKnee) {
        tx -= cf * sin * stride * 0.5;
        tz -= sf * sin * stride * 0.5;
        ty += Math.max(0, -sin) * kneeForward;
        tx += sf * kneeOut;
        tz += (-cf) * kneeOut;
      } else if (i === J.lHip) {
        tx += cf * sin * 0.05;
        tz += sf * sin * 0.05;
      } else if (i === J.rHip) {
        tx -= cf * sin * 0.05;
        tz -= sf * sin * 0.05;
      }

      // Arm swing (opposite to legs) - when not attacking
      if (!b.atk && !b.blocking) {
        if (i === J.lHand) {
          tx -= cf * sin * 0.25;
          tz -= sf * sin * 0.25;
          ty -= Math.abs(sin) * 0.08;
        } else if (i === J.lElbow) {
          tx -= cf * sin * 0.12;
          tz -= sf * sin * 0.12;
          ty += Math.max(0, -sin) * 0.05; // elbow bends on backstroke
        }
      }
    }

    // Left arm poses
    if (atkLArmAngle !== 0 && (i === J.lHand || i === J.lElbow)) {
      const armFac = i === J.lHand ? 1 : 0.5;
      tx += (-sf) * atkLArmAngle * 0.25 * armFac;
      tz += cf * atkLArmAngle * 0.25 * armFac;
      ty += atkLArmAngle * 0.15 * armFac;
    }

    // Right arm (weapon arm)
    if (i === J.rHand) {
      const handDist = 0.5 + atkRArmExtend;
      tx = b.pos.x + Math.cos(b.facing + b.swordAngle) * handDist;
      ty = 1.3 + b.swordY;
      tz = b.pos.z + Math.sin(b.facing + b.swordAngle) * handDist;
    } else if (i === J.rElbow) {
      const sa = b.swordAngle * 0.35;
      tx = b.pos.x + Math.cos(b.facing + sa) * 0.32 + (-sf) * 0.14;
      ty = 1.5 + b.swordY * 0.4;
      tz = b.pos.z + Math.sin(b.facing + sa) * 0.32;
    } else if (i === J.rShoulder) {
      tx += Math.cos(b.facing + b.swordAngle * 0.1) * atkRArmExtend * 0.3;
      tz += Math.sin(b.facing + b.swordAngle * 0.1) * atkRArmExtend * 0.3;
    }

    // Dual wielder left hand mirrors
    if (b.weaponType === 'dual' && !b.blocking && (i === J.lHand || i === J.lElbow)) {
      const mirrorAngle = b.swordAngle * -0.7;
      if (i === J.lHand) {
        tx = b.pos.x + Math.cos(b.facing + mirrorAngle) * 0.45;
        ty = 1.25 + b.swordY * 0.6;
        tz = b.pos.z + Math.sin(b.facing + mirrorAngle) * 0.45;
      }
    }

    // Ragdoll physics
    if (b.ragdollTimer > 0) {
      const w = clamp(b.ragdollTimer * 2.5, 0, 1);
      b.joints[i].x += b.jointVel[i].x * dt;
      b.joints[i].y += b.jointVel[i].y * dt;
      b.joints[i].z += b.jointVel[i].z * dt;
      b.jointVel[i].y -= GRAVITY * dt;
      b.jointVel[i].x *= 0.97; b.jointVel[i].z *= 0.97;
      if (b.joints[i].y < 0.04) {
        b.joints[i].y = 0.04;
        b.jointVel[i].y *= -0.25;
        b.jointVel[i].x *= 0.75; b.jointVel[i].z *= 0.75;
      }
      b.joints[i].x = lerp(tx, b.joints[i].x, w);
      b.joints[i].y = lerp(ty, b.joints[i].y, w);
      b.joints[i].z = lerp(tz, b.joints[i].z, w);
    } else {
      const spd = b.atk ? 22 : 18;
      b.joints[i].x = lerp(b.joints[i].x, tx, dt * spd);
      b.joints[i].y = lerp(b.joints[i].y, ty, dt * spd);
      b.joints[i].z = lerp(b.joints[i].z, tz, dt * spd);
    }
  }

  // Sword positions for hit detection
  const hand = b.joints[J.rHand];
  const bladeLen = b.weapon.bladeLen * b.weapon.reach;
  const tipAngle = b.facing + b.swordAngle;
  b.swordBasePos = { x: hand.x, y: hand.y, z: hand.z };
  b.swordTipPos = {
    x: hand.x + Math.cos(tipAngle) * bladeLen,
    y: hand.y + b.swordY * 0.4 + 0.35,
    z: hand.z + Math.sin(tipAngle) * bladeLen,
  };
}

// ═══════════════════════════════════════════════════════
// MOVEMENT & PHYSICS
// ═══════════════════════════════════════════════════════
function updateMovement(b: Bot, dt: number, pillars: Pillar[]) {
  if (!b.alive) {
    if (b.ragdollTimer > 0) b.ragdollTimer -= dt;
    return;
  }

  // Stamina regen
  const staminaRegen = b.atk ? 5 : (b.blocking ? 8 : (b.sprinting ? 10 : 25));
  b.stamina = clamp(b.stamina + staminaRegen * dt, 0, b.maxStamina);

  // Bleeding
  if (b.bleeding > 0) {
    b.bleedTimer -= dt;
    if (b.bleedTimer <= 0) {
      b.hp -= b.bleeding;
      b.bleedTimer = 0.5;
      b.bleeding = Math.max(0, b.bleeding - 0.5);
    }
  }

  // Combo timer
  if (b.comboTimer > 0) {
    b.comboTimer -= dt;
    if (b.comboTimer <= 0) b.combo = 0;
  }

  if (b.ragdollTimer > 0) {
    b.ragdollTimer -= dt;
    b.vel.x *= 0.92; b.vel.z *= 0.92;
    if (b.ragdollTimer <= 0) {
      b.ragdollTimer = 0;
      for (const jv of b.jointVel) { jv.x = 0; jv.y = 0; jv.z = 0; }
    }
    b.pos.x += b.vel.x * dt;
    b.pos.z += b.vel.z * dt;
  } else {
    const baseSpd = b.sprinting ? 6.5 : 4.2;
    const atkSlowdown = b.atk ? 0.35 : 1;
    const blockSlowdown = b.blocking ? 0.4 : 1;
    const staminaFactor = b.stamina < 20 ? 0.6 : 1;
    const spd = baseSpd * atkSlowdown * blockSlowdown * staminaFactor;

    b.vel.x += b.moveX * spd * dt * 12;
    b.vel.z += b.moveZ * spd * dt * 12;
    b.pos.x += b.vel.x * dt;
    b.pos.z += b.vel.z * dt;
    b.vel.x *= (1 - 9 * dt);
    b.vel.z *= (1 - 9 * dt);

    if (b.sprinting) b.stamina -= 15 * dt;
  }

  // Smooth facing
  let diff = b.targetFacing - b.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turnSpeed = b.atk ? 5 : (b.blocking ? 7 : 12);
  b.facing += diff * clamp(turnSpeed * dt, 0, 0.92);

  // Arena boundary
  const hd = Math.sqrt(b.pos.x*b.pos.x + b.pos.z*b.pos.z);
  if (hd > ARENA_R - 0.6) {
    const nx = b.pos.x / hd, nz = b.pos.z / hd;
    b.pos.x = nx * (ARENA_R - 0.6);
    b.pos.z = nz * (ARENA_R - 0.6);
    const dot = b.vel.x * nx + b.vel.z * nz;
    if (dot > 0) { b.vel.x -= dot * nx * 1.8; b.vel.z -= dot * nz * 1.8; }
  }

  // Pillar collision
  for (const p of pillars) {
    const dx = b.pos.x - p.x, dz = b.pos.z - p.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < p.r + 0.3) {
      const push = (p.r + 0.3 - d);
      const nx = dx / (d||1), nz = dz / (d||1);
      b.pos.x += nx * push;
      b.pos.z += nz * push;
      const dot = b.vel.x * nx + b.vel.z * nz;
      if (dot < 0) { b.vel.x -= dot * nx * 1.5; b.vel.z -= dot * nz * 1.5; }
    }
  }

  // Attack timer
  if (b.atk) {
    b.atkTimer -= dt;
    if (b.atkTimer <= 0) {
      b.atk = null;
      b.atkTimer = 0;
      b.combo++;
    }
  }

  // Cooldowns
  b.atkCd = Math.max(0, b.atkCd - dt);
  b.dodgeCd = Math.max(0, b.dodgeCd - dt);
  b.specCd = Math.max(0, b.specCd - dt);
  b.blockCd = Math.max(0, b.blockCd - dt);
  b.parryCd = Math.max(0, b.parryCd - dt);
  b.stun = Math.max(0, b.stun - dt);

  if (b.blocking) {
    b.blockTimer -= dt;
    b.parryWindow = Math.max(0, b.parryWindow - dt);
    if (b.blockTimer <= 0) b.blocking = false;
  }

  // Death check
  if (b.hp <= 0 && b.alive) {
    b.hp = 0; b.alive = false;
  }
}

// ═══════════════════════════════════════════════════════
// AI SYSTEM - Advanced tactical brain
// ═══════════════════════════════════════════════════════
function nearest(self: Bot, bots: Bot[]): Bot | null {
  let best: Bot | null = null, bd = Infinity;
  for (const b of bots) {
    if (b.id === self.id || !b.alive) continue;
    const d = dist3(self.pos, b.pos);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function weakest(self: Bot, bots: Bot[]): Bot | null {
  let best: Bot | null = null, bs = Infinity;
  for (const b of bots) {
    if (b.id === self.id || !b.alive) continue;
    const score = b.hp - (b.bleeding * 10);
    if (score < bs) { bs = score; best = b; }
  }
  return best;
}

function mostDangerous(self: Bot, bots: Bot[]): Bot | null {
  let best: Bot | null = null, bs = -Infinity;
  for (const b of bots) {
    if (b.id === self.id || !b.alive) continue;
    const threat = b.kills * 30 + b.dmg + (b.rage * 0.5) - dist3(self.pos, b.pos) * 10;
    if (threat > bs) { bs = threat; best = b; }
  }
  return best;
}

function faceTarget(b: Bot, tx: number, tz: number) {
  b.targetFacing = Math.atan2(tz - b.pos.z, tx - b.pos.x);
}

function moveToward(b: Bot, tx: number, tz: number, sprint = false) {
  const dx = tx - b.pos.x, dz = tz - b.pos.z;
  const d = Math.sqrt(dx*dx + dz*dz) || 1;
  b.moveX = dx / d;
  b.moveZ = dz / d;
  b.sprinting = sprint;
  faceTarget(b, tx, tz);
}

function strafe(b: Bot, target: V3, dir: number, dist: number) {
  const dx = target.x - b.pos.x, dz = target.z - b.pos.z;
  const d = Math.sqrt(dx*dx + dz*dz) || 1;
  const perpX = -dz / d * dir, perpZ = dx / d * dir;
  const radial = (d - dist) * 0.5;
  b.moveX = perpX * 0.65 + (dx / d) * radial;
  b.moveZ = perpZ * 0.65 + (dz / d) * radial;
  faceTarget(b, target.x, target.z);
}

function isTargetAttacking(t: Bot): boolean {
  return !!t.atk && t.atkTimer > 0;
}

function canBackstab(b: Bot, t: Bot): boolean {
  const angleToDef = Math.atan2(b.pos.z - t.pos.z, b.pos.x - t.pos.x);
  let faceDiff = angleToDef - t.facing;
  while (faceDiff > Math.PI) faceDiff -= Math.PI * 2;
  while (faceDiff < -Math.PI) faceDiff += Math.PI * 2;
  return Math.abs(faceDiff) < Math.PI * 0.35;
}

function countNearbyEnemies(b: Bot, bots: Bot[], range: number): number {
  let c = 0;
  for (const o of bots) {
    if (o.id === b.id || !o.alive) continue;
    if (dist3(b.pos, o.pos) < range) c++;
  }
  return c;
}

function runAI(b: Bot, s: GameState, dt: number) {
  if (!b.alive || b.stun > 0 || b.ragdollTimer > 0.4) {
    b.moveX = 0; b.moveZ = 0;
    return;
  }

  // Target selection based on style
  let t: Bot | null = null;
  switch (b.style) {
    case 'assassin': t = weakest(b, s.bots) || nearest(b, s.bots); break;
    case 'tact': t = mostDangerous(b, s.bots) || nearest(b, s.bots); break;
    case 'zerk': t = nearest(b, s.bots); break;
    case 'def': t = nearest(b, s.bots); break;
    case 'aggro': t = nearest(b, s.bots); break;
  }
  if (!t) { b.moveX = 0; b.moveZ = 0; return; }

  const d = dist3(b.pos, t.pos);
  b.aiTimer -= dt;
  b.aiSubTimer -= dt;

  // Update threat map
  for (const o of s.bots) {
    if (o.id === b.id || !o.alive) continue;
    const td = dist3(b.pos, o.pos);
    b.threatMap[o.id] = (o.atk ? 40 : 0) + (100 / (td + 1)) + o.kills * 5;
  }

  // Rage
  const rageGain = { aggro: 4, def: 2, zerk: 8, tact: 3, assassin: 5 }[b.style];
  b.rage = clamp(b.rage + dt * rageGain * (b.hp < 50 ? 2.5 : 1), 0, 100);

  // Weapon range
  const weaponRange = b.weapon.reach * 1.8 + 0.5;
  const engageRange = weaponRange + 0.3;

  // Reactive behaviors - dodge/block/parry
  if (isTargetAttacking(t) && d < t.weapon.reach * 2 + 1) {
    const reactSpeed = { aggro: 0.2, def: 0.5, zerk: 0.08, tact: 0.35, assassin: 0.3 }[b.style];
    if (rng() < reactSpeed * dt * 15) {
      if (b.style === 'def') {
        if (rng() < 0.7) startBlock(b);
        else dodge(b, b.pos.x - t.pos.x, b.pos.z - t.pos.z);
      } else if (b.style === 'assassin') {
        // Assassins prefer sidestep
        const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z;
        const d2 = Math.sqrt(dx*dx+dz*dz) || 1;
        dodge(b, -dz/d2 * b.strafeDir, dx/d2 * b.strafeDir, 7);
        b.strafeDir *= -1;
      } else if (rng() < 0.4) {
        startBlock(b);
      } else {
        dodge(b, b.pos.x - t.pos.x, b.pos.z - t.pos.z);
      }
    }
  }

  // Nearby enemy awareness
  const nearbyCount = countNearbyEnemies(b, s.bots, 3.5);

  // State machine transitions
  if (b.aiTimer <= 0) {
    b.aiTimer = 0.15 + rng(0, 0.35);
    b.circleDir = rng() > 0.35 ? b.circleDir : -b.circleDir;

    // Berserk mode
    if (b.style === 'zerk' && (b.rage > 80 || b.hp < 40)) {
      b.aiState = 'berserk';
    } else if (d > 5) {
      b.aiState = nearbyCount > 2 ? 'retreat' : 'hunt';
    } else if (d < 1 && b.hp < 25 && nearbyCount > 1) {
      b.aiState = 'retreat';
    } else if (d < engageRange + 0.5) {
      if (b.style === 'assassin' && !canBackstab(b, t) && d > 2) {
        b.aiState = 'flank';
      } else {
        b.aiState = 'engage';
      }
    } else if (d < 4) {
      b.aiState = rng() < 0.4 ? 'circle' : (rng() < 0.3 ? 'flank' : 'approach');
    } else {
      b.aiState = 'approach';
    }
  }

  switch (b.aiState) {
    case 'hunt':
    case 'approach':
      moveToward(b, t.pos.x, t.pos.z, d > 4.5);
      if (d < engageRange) b.aiState = 'engage';
      break;

    case 'engage': {
      faceTarget(b, t.pos.x, t.pos.z);

      // Attack frequency by style
      const atkRate = {
        aggro: 0.2, def: 0.1, zerk: 0.15, tact: 0.12, assassin: 0.18
      }[b.style];

      if (d < engageRange && !b.atk && b.atkCd <= 0 && b.stun <= 0) {
        if (rng() < atkRate) {
          // Combo or fresh attack
          if (b.comboTimer > 0 && b.combo > 0 && b.combo < 5 && rng() < 0.65) {
            comboAttack(b);
          } else {
            b.combo = 0;
            // Smart attack selection
            if (canBackstab(b, t)) {
              startAttack(b, 'overhead'); // backstab with heavy hit
            } else if (t.blocking && rng() < 0.4) {
              startAttack(b, 'overhead'); // guard break
            } else if (t.stun > 0 && rng() < 0.5) {
              startAttack(b, 'thrust'); // punish
            } else {
              const chain = b.weapon.comboChain;
              startAttack(b, chain[Math.floor(rng() * chain.length)]);
            }
          }
        }
      }

      // Movement while engaging
      if (!b.atk) {
        strafe(b, t.pos, b.circleDir, weaponRange * 0.7);
      } else {
        // Press forward during attack
        if (d > weaponRange * 0.5) {
          b.moveX = Math.cos(b.facing) * 0.7;
          b.moveZ = Math.sin(b.facing) * 0.7;
        } else {
          b.moveX *= 0.3; b.moveZ *= 0.3;
        }
      }

      // Special spin attack
      if (b.rage > 75 && b.specCd <= 0 && d < weaponRange && b.stamina > 30 && rng() < 0.04) {
        startAttack(b, 'spin');
        b.rage = 0;
        b.specCd = 3;
      }

      if (d > engageRange + 1.5) b.aiState = 'approach';
      break;
    }

    case 'berserk': {
      // Relentless aggression
      faceTarget(b, t.pos.x, t.pos.z);
      moveToward(b, t.pos.x, t.pos.z, true);

      if (d < engageRange && !b.atk && b.atkCd <= 0) {
        if (rng() < 0.35) {
          if (b.combo > 0 && rng() < 0.8) comboAttack(b);
          else {
            b.combo = 0;
            const picks: AtkType[] = ['slash_r','slash_l','overhead','spin'];
            startAttack(b, picks[Math.floor(rng() * picks.length)]);
          }
        }
      }

      if (b.rage < 30 && b.hp > 50) b.aiState = 'engage';
      break;
    }

    case 'circle':
      strafe(b, t.pos, b.circleDir, 2.8);
      if (d < engageRange && rng() < 0.35) b.aiState = 'engage';
      if (d > 5) b.aiState = 'approach';
      break;

    case 'flank': {
      const behindX = t.pos.x - Math.cos(t.facing) * 2.5;
      const behindZ = t.pos.z - Math.sin(t.facing) * 2.5;
      moveToward(b, behindX, behindZ, true);
      faceTarget(b, t.pos.x, t.pos.z);
      if (d < engageRange || canBackstab(b, t)) b.aiState = 'engage';
      break;
    }

    case 'retreat': {
      const awayX = b.pos.x - t.pos.x, awayZ = b.pos.z - t.pos.z;
      const awayD = Math.sqrt(awayX*awayX+awayZ*awayZ) || 1;
      b.moveX = awayX / awayD;
      b.moveZ = awayZ / awayD;
      b.sprinting = true;
      faceTarget(b, t.pos.x, t.pos.z);
      if (rng() < 0.05) dodge(b, awayX, awayZ);
      if (d > 6 || b.hp > 50) b.aiState = 'circle';
      break;
    }
  }

  // Arena avoidance
  const hd = Math.sqrt(b.pos.x**2 + b.pos.z**2);
  if (hd > ARENA_R - 2.5) {
    b.moveX -= b.pos.x / hd * 0.6;
    b.moveZ -= b.pos.z / hd * 0.6;
  }

  // Pillar avoidance
  for (const p of s.pillars) {
    const dx = b.pos.x - p.x, dz = b.pos.z - p.z;
    const pd = Math.sqrt(dx*dx+dz*dz);
    if (pd < p.r + 1.5) {
      const avoidStr = 0.3 * (1 - pd / (p.r + 1.5));
      b.moveX += (dx / (pd||1)) * avoidStr;
      b.moveZ += (dz / (pd||1)) * avoidStr;
    }
  }

  // Normalize
  const ml = Math.sqrt(b.moveX**2 + b.moveZ**2);
  if (ml > 1) { b.moveX /= ml; b.moveZ /= ml; }
}

// ═══════════════════════════════════════════════════════
// HIT DETECTION & DAMAGE
// ═══════════════════════════════════════════════════════
function checkHits(s: GameState) {
  for (const atk of s.bots) {
    if (!atk.alive || !atk.atk || atk.atkTimer <= 0) continue;

    for (const def of s.bots) {
      if (def.id === atk.id || !def.alive || atk.hitThisSwing.has(def.id)) continue;

      // Multi-point blade collision
      const bodyY = 1.15;
      const defBody = { x: def.pos.x, y: bodyY, z: def.pos.z };
      const tipD = dist3(atk.swordTipPos, defBody);
      const baseD = dist3(atk.swordBasePos, defBody);
      // Check 3 points along blade
      const mid1 = lerpV3(atk.swordBasePos, atk.swordTipPos, 0.33);
      const mid2 = lerpV3(atk.swordBasePos, atk.swordTipPos, 0.66);
      const mid1D = dist3(mid1, defBody);
      const mid2D = dist3(mid2, defBody);

      const hitRadius = 0.48;
      if (tipD < hitRadius || baseD < hitRadius || mid1D < hitRadius || mid2D < hitRadius) {
        atk.hitThisSwing.add(def.id);
        applyHit(s, atk, def);
      }
    }
  }

  // Body separation
  for (let i = 0; i < s.bots.length; i++) {
    for (let j = i + 1; j < s.bots.length; j++) {
      const a = s.bots[i], bo = s.bots[j];
      if (!a.alive || !bo.alive) continue;
      const d = dist3(a.pos, bo.pos);
      if (d < 0.65 && d > 0) {
        const nx = (a.pos.x - bo.pos.x) / d, nz = (a.pos.z - bo.pos.z) / d;
        const p = (0.65 - d) * 5;
        a.vel.x += nx * p; a.vel.z += nz * p;
        bo.vel.x -= nx * p; bo.vel.z -= nz * p;
      }
    }
  }
}

function applyHit(s: GameState, atk: Bot, def: Bot) {
  const a = atk.atk!;
  const w = atk.weapon;

  // PARRY - perfect timing block
  if (def.blocking && def.parryWindow > 0) {
    atk.stun = 0.6;
    atk.vel.x -= Math.cos(atk.facing) * 5;
    atk.vel.z -= Math.sin(atk.facing) * 5;
    def.parries++;
    addSparks(s, (atk.pos.x+def.pos.x)/2, 1.4, (atk.pos.z+def.pos.z)/2, 12, 0xffffff, 6);
    addSparks(s, (atk.pos.x+def.pos.x)/2, 1.4, (atk.pos.z+def.pos.z)/2, 6, 0xffff00, 4);
    s.shakeIntensity += 0.12;
    addAnnouncement(s, 'PARRY!', '#ffff44', 'med');
    def.blocking = false;
    return;
  }

  // Normal block
  if (def.blocking) {
    atk.stun = 0.25;
    atk.vel.x -= Math.cos(atk.facing) * 3;
    atk.vel.z -= Math.sin(atk.facing) * 3;
    def.stamina -= 20;
    addSparks(s, (atk.pos.x+def.pos.x)/2, 1.3, (atk.pos.z+def.pos.z)/2, 8, 0xffffff, 4);
    s.shakeIntensity += 0.06;
    if (def.stamina <= 0) {
      def.blocking = false;
      def.stun = 0.5; // guard broken
      addAnnouncement(s, 'GUARD BREAK', '#ff6600', 'small');
    }
    return;
  }

  // Calculate damage
  let dmg = a.baseDmg * w.dmgMult * (0.8 + rng(0, 0.4));
  if (atk.rage > 50) dmg *= 1 + atk.rage / 250;

  // Backstab bonus
  if (canBackstab(atk, def)) {
    dmg *= 1.8;
    addAnnouncement(s, 'BACKSTAB!', '#ff4444', 'med');
  }

  // Headshot (sword tip hits at head level)
  if (atk.swordTipPos.y > 1.6 && Math.abs(atk.swordTipPos.y - def.joints[J.head].y) < 0.25) {
    dmg *= 1.4;
    addAnnouncement(s, 'HEADSHOT', '#ff8800', 'small');
  }

  dmg = Math.min(dmg, 55);
  def.hp -= dmg;
  def.lastHit = atk.id;
  atk.dmg += dmg;
  atk.totalHits++;
  atk.rage = clamp(atk.rage + dmg * 0.4, 0, 100);

  // Bleed on heavy hits
  if (dmg > 15) {
    def.bleeding += dmg * 0.08;
    def.bleedTimer = 0.5;
  }

  // Knockback
  const dx = def.pos.x - atk.pos.x, dz = def.pos.z - atk.pos.z;
  const dd = Math.sqrt(dx*dx + dz*dz) || 1;
  const kbMult = w.kbMult;
  def.vel.x += (dx/dd) * a.kb * kbMult;
  def.vel.z += (dz/dd) * a.kb * kbMult;

  // Ragdoll on heavy hits
  if (dmg > 16 || a.type === 'overhead' || a.type === 'spin') {
    def.ragdollTimer = clamp(0.3 + dmg * 0.02, 0.2, 1.5);
    def.stun = def.ragdollTimer * 0.8;
    for (const jv of def.jointVel) {
      jv.x += (dx/dd) * a.kb * kbMult * rng(0.4, 0.8);
      jv.y += rng(1.5, 3.5);
      jv.z += (dz/dd) * a.kb * kbMult * rng(0.4, 0.8);
    }
  } else {
    def.stun = 0.1;
  }

  // VFX
  const hx = (atk.swordTipPos.x + def.pos.x) / 2;
  const hz = (atk.swordTipPos.z + def.pos.z) / 2;
  const sparkCount = clamp(3 + (dmg * 0.4) | 0, 3, 14);
  addSparks(s, hx, 1.2, hz, sparkCount, atk.color, 3.5);
  if (dmg > 16) addSparks(s, hx, 1.2, hz, 6, 0xff3300, 2.5);

  // Blood
  addBlood(s, hx, 0.02, hz, def.color, 0.3 + dmg * 0.015);

  s.shakeIntensity += dmg * 0.012;

  // Death
  if (def.hp <= 0) {
    def.hp = 0; def.alive = false; atk.kills++; atk.rage = 100;
    s.slow = 0.08; s.slowTimer = 0.6;
    def.ragdollTimer = 6;
    def.deathVel = { x: (dx/dd) * 15, y: 0, z: (dz/dd) * 15 };
    for (const jv of def.jointVel) {
      jv.x += (dx/dd) * 15 * rng(0.3, 1.2);
      jv.y += rng(3, 8);
      jv.z += (dz/dd) * 15 * rng(0.3, 1.2);
    }
    addSparks(s, def.pos.x, 1.2, def.pos.z, 25, def.color, 6);
    addSparks(s, def.pos.x, 1.2, def.pos.z, 15, 0xff5500, 5);
    addBlood(s, def.pos.x, 0.02, def.pos.z, 0x880000, 1.5);
    s.shakeIntensity += 0.5;

    // Kill announcements
    const alive = s.bots.filter(b => b.alive).length;
    if (atk.kills >= 3) addAnnouncement(s, `${atk.name} — KILLING SPREE!`, atk.hex, 'big');
    else if (atk.kills === 2) addAnnouncement(s, `${atk.name} — DOUBLE KILL`, atk.hex, 'med');

    // Multi-kill tracking
    if (s.t - s.lastKillTime < 2) {
      s.multiKillCount++;
      if (s.multiKillCount >= 2) addAnnouncement(s, 'MULTI KILL!', '#ffaa00', 'big');
    } else {
      s.multiKillCount = 1;
    }
    s.lastKillTime = s.t;

    addAnnouncement(s, `${atk.name} killed ${def.name}`, atk.hex, 'small');
    if (alive <= 3) addAnnouncement(s, `${alive} FIGHTERS REMAIN`, '#ffffff', 'med');
  }
}

function addSparks(s: GameState, x: number, y: number, z: number, n: number, color: number, spd: number) {
  for (let i = 0; i < n; i++) {
    const a = rng(0, Math.PI * 2), b2 = rng(0, Math.PI * 0.8);
    const sp = rng(spd * 0.3, spd);
    s.sparks.push({
      p: v3(x + rng(-0.15, 0.15), y + rng(0, 0.15), z + rng(-0.15, 0.15)),
      v: v3(Math.cos(a)*Math.cos(b2)*sp, Math.sin(b2)*sp + 1.5, Math.sin(a)*Math.cos(b2)*sp),
      life: rng(0.2, 0.5), ml: rng(0.2, 0.5), color, size: rng(0.03, 0.07), mesh: null,
    });
  }
}

function addBlood(s: GameState, x: number, y: number, z: number, color: number, size: number) {
  s.blood.push({ x: x + rng(-0.3, 0.3), z: z + rng(-0.3, 0.3), size: size * rng(0.7, 1.3), color: 0x440000, mesh: null, age: 0 });
}

function addAnnouncement(s: GameState, text: string, color: string, size: 'big'|'med'|'small') {
  s.announcements.push({ text, color, time: s.t, size });
  if (s.announcements.length > MAX_ANNOUNCEMENTS) s.announcements.shift();
}

// ═══════════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════════
function mkState(round: number): GameState {
  return {
    bots: Array.from({ length: 10 }, (_, i) => mkBot(i)),
    sparks: [], blood: [],
    t: 0, over: false, winner: null, round,
    slow: 1, slowTimer: 0, winTimer: 0, shakeIntensity: 0,
    announcements: [], killFeedTimer: 0,
    intensity: 0, lastKillTime: -10, multiKillTimer: 0, multiKillCount: 0,
    pillars: PILLARS,
  };
}

function updateState(s: GameState, dt: number): boolean {
  s.t += dt;

  // Slow motion
  let adt = dt;
  if (s.slow < 1) {
    s.slowTimer -= dt;
    adt = dt * s.slow;
    if (s.slowTimer <= 0) s.slow = Math.min(1, s.slow + dt * 3);
    else s.slow = lerp(s.slow, 1, dt * 0.5);
  }

  // Combat intensity
  let combatCount = 0;
  for (const b of s.bots) if (b.alive && b.atk) combatCount++;
  s.intensity = lerp(s.intensity, combatCount / 5, dt * 3);

  for (const b of s.bots) runAI(b, s, adt);
  for (const b of s.bots) { updateMovement(b, adt, s.pillars); updateSkeleton(b, adt); }
  checkHits(s);

  // Bleeding particles
  for (const b of s.bots) {
    if (b.alive && b.bleeding > 0 && rng() < 0.3) {
      addSparks(s, b.pos.x + rng(-0.2, 0.2), 1 + rng(0, 0.5), b.pos.z + rng(-0.2, 0.2), 1, 0x880000, 1);
    }
  }

  // Sparks
  for (let i = s.sparks.length - 1; i >= 0; i--) {
    const p = s.sparks[i];
    p.p.x += p.v.x * adt; p.p.y += p.v.y * adt; p.p.z += p.v.z * adt;
    p.v.y -= 14 * adt; p.v.x *= 0.96; p.v.z *= 0.96; p.life -= adt;
    if (p.life <= 0) { if (p.mesh?.parent) p.mesh.parent.remove(p.mesh); s.sparks.splice(i, 1); }
  }
  if (s.sparks.length > MAX_SPARKS) {
    const ex = s.sparks.splice(0, s.sparks.length - MAX_SPARKS);
    for (const sp of ex) { if (sp.mesh?.parent) sp.mesh.parent.remove(sp.mesh); }
  }

  // Blood pools age
  for (const bp of s.blood) bp.age += dt;
  if (s.blood.length > MAX_BLOOD) {
    const ex = s.blood.splice(0, s.blood.length - MAX_BLOOD);
    for (const bp of ex) { if (bp.mesh?.parent) bp.mesh.parent.remove(bp.mesh); }
  }

  s.shakeIntensity *= 0.85;
  if (s.shakeIntensity < 0.001) s.shakeIntensity = 0;

  // Announcements cleanup
  s.announcements = s.announcements.filter(a => s.t - a.time < 3);

  const alive = s.bots.filter(b => b.alive);
  if (alive.length <= 1 && !s.over) {
    s.over = true;
    s.winner = alive[0] || null;
    if (s.winner) {
      addSparks(s, s.winner.pos.x, 1.5, s.winner.pos.z, 40, s.winner.color, 8);
      addAnnouncement(s, `${s.winner.name} WINS!`, s.winner.hex, 'big');
    }
    return true;
  }
  return s.over;
}

// ═══════════════════════════════════════════════════════
// THREE.JS RENDERING
// ═══════════════════════════════════════════════════════
const _tmpV = new THREE.Vector3();
const _tmpQ = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

function posLimb(mesh: THREE.Mesh, a: V3, b: V3, t: number) {
  mesh.position.set((a.x+b.x)/2, (a.y+b.y)/2, (a.z+b.z)/2);
  _tmpV.set(b.x-a.x, b.y-a.y, b.z-a.z);
  const l = _tmpV.length();
  if (l < 0.001) return;
  _tmpV.normalize();
  _tmpQ.setFromUnitVectors(_up, _tmpV);
  mesh.quaternion.copy(_tmpQ);
  mesh.scale.set(t, l, t);
}

// Shared geometries
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
const sparkGeo = new THREE.SphereGeometry(1, 6, 4);
const bloodGeo = new THREE.CircleGeometry(1, 12);

function createWeaponMesh(bot: Bot): THREE.Group {
  const w = bot.weapon;
  const group = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xccccdd, emissive: bot.color, emissiveIntensity: 0.15,
    roughness: 0.05, metalness: 0.95,
  });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.6, metalness: 0.3 });
  const guardMat = new THREE.MeshStandardMaterial({ color: 0x886633, roughness: 0.35, metalness: 0.7 });

  if (w.type === 'sword' || w.type === 'greatsword') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(w.bladeWidth, w.bladeLen, 0.01 + w.bladeWidth * 0.5), bladeMat);
    blade.position.y = w.bladeLen / 2 + 0.08;
    blade.castShadow = true;
    group.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, w.guardSize), guardMat);
    guard.position.y = 0.06;
    group.add(guard);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 6), handleMat);
    handle.position.y = -0.02;
    group.add(handle);
  } else if (w.type === 'axe') {
    // Handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, w.bladeLen, 6), handleMat);
    handle.position.y = w.bladeLen / 2;
    handle.castShadow = true;
    group.add(handle);
    // Axe head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.15), bladeMat);
    head.position.y = w.bladeLen - 0.05;
    head.castShadow = true;
    group.add(head);
  } else if (w.type === 'spear') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, w.bladeLen, 6), handleMat);
    shaft.position.y = w.bladeLen / 2;
    shaft.castShadow = true;
    group.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.15, 6), bladeMat);
    tip.position.y = w.bladeLen + 0.05;
    tip.castShadow = true;
    group.add(tip);
  } else if (w.type === 'dual') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(w.bladeWidth, w.bladeLen, 0.008), bladeMat);
    blade.position.y = w.bladeLen / 2 + 0.05;
    blade.castShadow = true;
    group.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, w.guardSize), guardMat);
    guard.position.y = 0.04;
    group.add(guard);
  }

  return group;
}

function createBotMeshes(bot: Bot, scene: THREE.Group) {
  const mat = new THREE.MeshStandardMaterial({
    color: bot.color, emissive: bot.color, emissiveIntensity: 0.3,
    roughness: 0.3, metalness: 0.6,
  });
  const group = new THREE.Group();

  bot.limbMeshes = LIMBS.map(() => {
    const m = new THREE.Mesh(cylGeo, mat.clone());
    m.castShadow = true;
    group.add(m);
    return m;
  });

  // Head
  const head = new THREE.Mesh(sphereGeo, mat.clone());
  head.castShadow = true;
  group.add(head);
  bot.headMesh = head;

  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeGeo = new THREE.SphereGeometry(0.025, 6, 4);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  group.add(eyeL); group.add(eyeR);
  bot.eyeL = eyeL; bot.eyeR = eyeR;

  // Feet
  const fL = new THREE.Mesh(sphereGeo, mat.clone()); fL.castShadow = true; group.add(fL);
  const fR = new THREE.Mesh(sphereGeo, mat.clone()); fR.castShadow = true; group.add(fR);
  bot.footMeshes = [fL, fR];

  // Weapon
  const sword = createWeaponMesh(bot);
  group.add(sword);
  bot.swordGroup = sword;

  // Sword trail
  const trailGeo = new THREE.PlaneGeometry(1, 0.08);
  const trailMat = new THREE.MeshBasicMaterial({ color: bot.color, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  const trail = new THREE.Mesh(trailGeo, trailMat);
  group.add(trail);
  bot.swordTrail = trail;

  scene.add(group);
  bot.group = group;
}

function updateBotMeshes(bot: Bot) {
  if (!bot.group) return;
  const j = bot.joints;

  for (let i = 0; i < LIMBS.length; i++) {
    const [a, b, t] = LIMBS[i];
    posLimb(bot.limbMeshes[i], j[a], j[b], t);
  }

  if (bot.headMesh) {
    bot.headMesh.position.set(j[0].x, j[0].y, j[0].z);
    bot.headMesh.scale.setScalar(0.13);
  }

  // Eyes
  if (bot.eyeL && bot.eyeR) {
    const cf = Math.cos(bot.facing), sf = Math.sin(bot.facing);
    bot.eyeL.position.set(j[0].x + cf * 0.1 + (-sf) * 0.04, j[0].y + 0.02, j[0].z + sf * 0.1 + cf * 0.04);
    bot.eyeR.position.set(j[0].x + cf * 0.1 + sf * 0.04, j[0].y + 0.02, j[0].z + sf * 0.1 + (-cf) * 0.04);
    bot.eyeL.scale.setScalar(1); bot.eyeR.scale.setScalar(1);
  }

  // Feet
  if (bot.footMeshes[0]) {
    bot.footMeshes[0].position.set(j[12].x, j[12].y, j[12].z);
    bot.footMeshes[0].scale.setScalar(0.065);
  }
  if (bot.footMeshes[1]) {
    bot.footMeshes[1].position.set(j[15].x, j[15].y, j[15].z);
    bot.footMeshes[1].scale.setScalar(0.065);
  }

  // Weapon
  if (bot.swordGroup) {
    const hand = j[J.rHand];
    bot.swordGroup.position.set(hand.x, hand.y, hand.z);
    const sa = bot.facing + bot.swordAngle;
    bot.swordGroup.rotation.set(bot.swordY * 0.6, -sa + Math.PI / 2, bot.swordAngle * 0.15);
  }

  // Trail
  if (bot.swordTrail) {
    const isAtk = bot.atk && bot.atkTimer > 0;
    bot.swordTrail.visible = !!isAtk;
    if (isAtk) {
      const hand = j[J.rHand];
      const tip = bot.swordTipPos;
      bot.swordTrail.position.set((hand.x+tip.x)/2, (hand.y+tip.y)/2, (hand.z+tip.z)/2);
      _tmpV.set(tip.x-hand.x, tip.y-hand.y, tip.z-hand.z);
      const l = _tmpV.length();
      bot.swordTrail.scale.set(l * 1.2, 5, 1);
      bot.swordTrail.lookAt(tip.x, tip.y, tip.z);
      const op = (bot.atkTimer / ((bot.atk?.dur || 0.3) / bot.weapon.speed)) * 0.8;
      (bot.swordTrail.material as THREE.MeshBasicMaterial).opacity = op;
    }
  }

  // Dead fade
  if (!bot.alive) {
    bot.group.traverse(child => {
      const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m?.opacity !== undefined) {
        m.transparent = true;
        m.opacity = Math.max(0.1, m.opacity - 0.01);
        m.emissiveIntensity = 0.02;
      }
    });
  }
}

function updateSparkMeshes(sparks: Spark[], scene: THREE.Group) {
  for (const sp of sparks) {
    if (!sp.mesh) {
      sp.mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: sp.color }));
      scene.add(sp.mesh);
    }
    sp.mesh.position.set(sp.p.x, sp.p.y, sp.p.z);
    const a = Math.max(0, sp.life / sp.ml);
    sp.mesh.scale.setScalar(sp.size * a * 2.5);
    (sp.mesh.material as THREE.MeshBasicMaterial).opacity = a;
    (sp.mesh.material as THREE.MeshBasicMaterial).transparent = true;
  }
}

function updateBloodMeshes(blood: BloodPool[], scene: THREE.Group) {
  for (const bp of blood) {
    if (!bp.mesh) {
      bp.mesh = new THREE.Mesh(bloodGeo, new THREE.MeshStandardMaterial({
        color: bp.color, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 0.7,
      }));
      bp.mesh.rotation.x = -Math.PI / 2;
      bp.mesh.position.y = 0.015;
      scene.add(bp.mesh);
    }
    bp.mesh.position.set(bp.x, 0.015, bp.z);
    const growFactor = Math.min(1, bp.age * 3);
    bp.mesh.scale.setScalar(bp.size * growFactor);
    const fadeStart = 15;
    if (bp.age > fadeStart) {
      (bp.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.7 - (bp.age - fadeStart) * 0.05);
    }
  }
}

// ═══════════════════════════════════════════════════════
// SCENE COMPONENTS
// ═══════════════════════════════════════════════════════
function GameScene({ state, onUpdate }: { state: React.MutableRefObject<GameState>; onUpdate: (s: GameState) => void }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null!);
  const sparkRef = useRef<THREE.Group>(null!);
  const bloodRef = useRef<THREE.Group>(null!);
  const init = useRef(false);
  const camAngle = useRef(0);
  const camTarget = useRef(v3());
  const camDist = useRef(8);
  const camHeight = useRef(5);
  const lastUpdateFrame = useRef(0);

  useEffect(() => {
    if (init.current || !groupRef.current) return;
    init.current = true;
    for (const bot of state.current.bots) createBotMeshes(bot, groupRef.current);
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 25);
    const s = state.current;

    if (s.over) {
      s.winTimer += dt;
      for (const b of s.bots) { updateMovement(b, dt, s.pillars); updateSkeleton(b, dt); }
      for (const b of s.bots) updateBotMeshes(b);
      updateSparkMeshes(s.sparks, sparkRef.current);
      updateBloodMeshes(s.blood, bloodRef.current);

      // Winner celebration sparks
      if (s.winner && s.winner.alive && Math.floor(s.t * 10) % 3 === 0) {
        addSparks(s, s.winner.pos.x + rng(-1, 1), 2 + rng(0, 1), s.winner.pos.z + rng(-1, 1), 2, s.winner.color, 3);
      }

      if (s.winTimer >= 6) {
        // Clean up
        while (groupRef.current.children.length) groupRef.current.remove(groupRef.current.children[0]);
        while (sparkRef.current.children.length) sparkRef.current.remove(sparkRef.current.children[0]);
        while (bloodRef.current.children.length) bloodRef.current.remove(bloodRef.current.children[0]);
        const ns = mkState(s.round + 1);
        state.current = ns;
        init.current = false;
        for (const bot of ns.bots) createBotMeshes(bot, groupRef.current);
        init.current = true;
        onUpdate(ns);
        return;
      }
    } else {
      updateState(s, dt);
    }

    for (const b of s.bots) updateBotMeshes(b);
    updateSparkMeshes(s.sparks, sparkRef.current);
    updateBloodMeshes(s.blood, bloodRef.current);

    // ═══ CINEMATIC CAMERA ═══
    const alive = s.bots.filter(b => b.alive);
    let cx = 0, cz = 0;
    if (alive.length) {
      for (const b of alive) { cx += b.pos.x; cz += b.pos.z; }
      cx /= alive.length; cz /= alive.length;
    }

    // Find most intense fight
    let fightX = cx, fightZ = cz, fightIntensity = 0;
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const d = dist3(alive[i].pos, alive[j].pos);
        const intensity = (alive[i].atk ? 2 : 0) + (alive[j].atk ? 2 : 0) + (5 / (d + 0.5));
        if (intensity > fightIntensity && d < 5) {
          fightIntensity = intensity;
          fightX = (alive[i].pos.x + alive[j].pos.x) / 2;
          fightZ = (alive[i].pos.z + alive[j].pos.z) / 2;
        }
      }
    }

    const lookX = lerp(cx, fightX, 0.65);
    const lookZ = lerp(cz, fightZ, 0.65);
    camTarget.current = lerpV3(camTarget.current, v3(lookX, 0, lookZ), 0.05);

    // Dynamic camera distance based on alive count
    const targetDist = 5 + alive.length * 0.4;
    const targetHeight = 3.5 + alive.length * 0.25;
    camDist.current = lerp(camDist.current, targetDist, dt * 1.5);
    camHeight.current = lerp(camHeight.current, targetHeight, dt * 1.5);

    // Close-up during slow-mo
    if (s.slow < 0.5) {
      camDist.current = lerp(camDist.current, 3, dt * 4);
      camHeight.current = lerp(camHeight.current, 2, dt * 4);
    }

    camAngle.current += dt * (0.12 + s.intensity * 0.08);
    const shake = s.shakeIntensity;
    camera.position.lerp(
      _tmpV.set(
        camTarget.current.x + Math.cos(camAngle.current) * camDist.current + rng(-1, 1) * shake,
        camHeight.current + rng(-1, 1) * shake * 0.5,
        camTarget.current.z + Math.sin(camAngle.current) * camDist.current + rng(-1, 1) * shake
      ), 0.05
    );
    camera.lookAt(camTarget.current.x, 1.1, camTarget.current.z);

    // Throttled HUD update
    lastUpdateFrame.current++;
    if (lastUpdateFrame.current % 3 === 0) onUpdate({ ...s });
  });

  return <>
    <group ref={groupRef} />
    <group ref={sparkRef} />
    <group ref={bloodRef} />
  </>;
}

function Arena() {
  return <>
    {/* Lighting */}
    <ambientLight intensity={0.08} color={0x222244} />
    <directionalLight position={[12, 18, 8]} intensity={1.5} color={0xffeedd} castShadow
      shadow-mapSize-width={2048} shadow-mapSize-height={2048}
      shadow-camera-far={60} shadow-camera-left={-18} shadow-camera-right={18}
      shadow-camera-top={18} shadow-camera-bottom={-18} />
    {/* Dramatic colored spotlights */}
    <pointLight position={[0, 10, 0]} intensity={3} color={0xff1133} distance={30} />
    <pointLight position={[-10, 6, -10]} intensity={2} color={0x2244ff} distance={25} />
    <pointLight position={[10, 6, 10]} intensity={2} color={0x00ff66} distance={25} />
    <pointLight position={[10, 4, -10]} intensity={1.5} color={0xff8800} distance={20} />
    <pointLight position={[-10, 4, 10]} intensity={1.5} color={0xff00ff} distance={20} />
    <spotLight position={[0, 15, 0]} angle={0.5} penumbra={0.6} intensity={3} color={0xffffff} castShadow />

    {/* Arena floor */}
    <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
      <circleGeometry args={[ARENA_R, 64]} />
      <meshStandardMaterial color={0x080812} roughness={0.85} metalness={0.35} />
    </mesh>

    {/* Grid */}
    <gridHelper args={[ARENA_R*2, 24, 0x151530, 0x0d0d22]} position={[0, 0.005, 0]} />

    {/* Arena boundary ring */}
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[ARENA_R-0.2, ARENA_R, 64]} />
      <meshStandardMaterial color={0xff1133} emissive={0xff1133} emissiveIntensity={1.2} />
    </mesh>

    {/* Inner decorative rings */}
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.01, 0]}>
      <ringGeometry args={[ARENA_R*0.5-0.05, ARENA_R*0.5+0.05, 64]} />
      <meshStandardMaterial color={0x331122} emissive={0xff1133} emissiveIntensity={0.15} transparent opacity={0.4} />
    </mesh>

    {/* Pillars */}
    {PILLARS.map((p, i) => (
      <group key={i} position={[p.x, 0, p.z]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[p.r * 0.8, p.r, p.h, 12]} />
          <meshStandardMaterial color={0x1a1a2e} roughness={0.7} metalness={0.4} />
        </mesh>
        {/* Pillar top glow */}
        <pointLight position={[0, p.h + 0.5, 0]} intensity={0.6} color={0xff4466} distance={4} />
        <mesh position={[0, p.h, 0]}>
          <cylinderGeometry args={[p.r * 1.1, p.r * 0.8, 0.1, 12]} />
          <meshStandardMaterial color={0x332233} emissive={0xff2244} emissiveIntensity={0.3} />
        </mesh>
      </group>
    ))}

    <fog attach="fog" args={[0x040410, 15, 35]} />
  </>;
}

// ═══════════════════════════════════════════════════════
// HUD
// ═══════════════════════════════════════════════════════
function HUD({ state }: { state: GameState }) {
  const alive = state.bots.filter(b => b.alive).length;
  const sorted = [...state.bots].sort((a, b) => b.kills - a.kills || b.dmg - a.dmg);

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ fontFamily: "'Orbitron','Rajdhani',monospace" }}>
      {/* Top bar */}
      <div className="absolute top-3 left-0 right-0 flex flex-col items-center gap-0.5">
        <div className="text-[10px] tracking-[.4em] text-foreground/30 uppercase">Round {state.round}</div>
        <div className={`text-xs tracking-[.3em] font-bold ${alive <= 3 ? 'text-red-400 animate-pulse' : 'text-foreground/25'}`}>
          {alive} REMAINING
        </div>
      </div>

      {/* Kill feed / announcements */}
      <div className="absolute top-16 right-4 flex flex-col gap-1.5 items-end">
        {state.announcements.map((a, i) => {
          const age = state.t - a.time;
          const opacity = age < 0.3 ? age / 0.3 : age > 2.5 ? (3 - age) / 0.5 : 1;
          const sizeClass = a.size === 'big' ? 'text-xl font-black tracking-widest' :
                           a.size === 'med' ? 'text-sm font-bold tracking-wider' :
                           'text-[10px] font-medium tracking-wide';
          return (
            <div key={`${a.text}-${a.time}-${i}`} className={`${sizeClass} transition-all`}
              style={{ color: a.color, opacity: Math.max(0, opacity), textShadow: `0 0 10px ${a.color}55, 0 0 20px ${a.color}33`,
                transform: a.size === 'big' ? `scale(${1 + Math.max(0, 0.3 - age) * 2})` : 'none' }}>
              {a.text}
            </div>
          );
        })}
      </div>

      {/* Health bars - bottom */}
      <div className="absolute bottom-2 left-2 right-2 flex gap-0.5">
        {state.bots.map(b => (
          <div key={b.id} className={`flex-1 relative h-8 rounded overflow-hidden ${b.alive ? '' : 'opacity-20'}`}
            style={{ border: `1px solid ${b.alive ? b.hex + '66' : '#222'}` }}>
            <div className="absolute inset-0 bg-black/60" />
            {/* HP bar */}
            {b.alive && (
              <div className="absolute inset-y-0 left-0 transition-all duration-200"
                style={{ width: `${(b.hp / b.maxHp) * 100}%`, background: `linear-gradient(180deg, ${b.hex}cc, ${b.hex}55)` }} />
            )}
            {/* Stamina bar (tiny bottom) */}
            {b.alive && (
              <div className="absolute bottom-0 left-0 h-[2px] transition-all duration-100"
                style={{ width: `${b.stamina}%`, backgroundColor: '#88aaff' }} />
            )}
            {/* Bleed indicator */}
            {b.alive && b.bleeding > 0 && (
              <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: '#ff000015' }} />
            )}
            <div className="absolute inset-0 flex items-center justify-between px-1">
              <span className="text-[7px] font-bold text-white/80 truncate drop-shadow-lg">{b.name}</span>
              <div className="flex gap-0.5 items-center">
                {b.kills > 0 && <span className="text-[7px] text-yellow-400 font-bold">{b.kills}K</span>}
                {b.parries > 0 && <span className="text-[7px] text-cyan-400">⛊{b.parries}</span>}
              </div>
            </div>
            {/* Weapon icon label */}
            {b.alive && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[6px] text-foreground/30 uppercase tracking-wider whitespace-nowrap">
                {b.weapon.name}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Slow-mo indicator */}
      {state.slow < 0.5 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl font-black text-white/10 tracking-[1em] animate-pulse">
          SLOW MOTION
        </div>
      )}

      {/* Winner screen */}
      {state.over && state.winner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 animate-in fade-in duration-700">
          <div className="text-6xl font-black tracking-[.3em] mb-2"
            style={{ color: state.winner.hex, textShadow: `0 0 30px ${state.winner.hex}, 0 0 60px ${state.winner.hex}55` }}>
            CHAMPION
          </div>
          <div className="text-4xl font-bold mb-6" style={{ color: state.winner.glow }}>
            {state.winner.name}
          </div>
          <div className="text-sm text-foreground/50 mb-2">{state.winner.weapon.name} • {state.winner.style.toUpperCase()}</div>
          <div className="flex gap-6 text-sm text-foreground/60 mb-6">
            <span>⚔ {state.winner.kills} Kills</span>
            <span>💀 {Math.round(state.winner.dmg)} DMG</span>
            <span>❤ {Math.round(state.winner.hp)} HP</span>
            <span>⛊ {state.winner.parries} Parries</span>
          </div>

          {/* Leaderboard */}
          <div className="text-xs text-foreground/35 tracking-[.3em] mb-3">LEADERBOARD</div>
          <div className="flex flex-col gap-1 items-center">
            {sorted.slice(0, 5).map((r, i) => (
              <div key={r.id} className="flex gap-3 text-xs items-center" style={{ color: r.id === state.winner!.id ? state.winner!.hex : '#555' }}>
                <span className="w-4 text-right font-bold">{i+1}.</span>
                <span className="w-20 font-bold">{r.name}</span>
                <span className="w-16 text-right">{r.kills}K / {Math.round(r.dmg)}D</span>
                <span className="w-12 text-right text-foreground/25">{r.weapon.name}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 text-sm text-foreground/25 animate-pulse">
            Next round in {Math.max(1, Math.ceil(6 - state.winTimer))}...
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
const RagdollArena = () => {
  const stateRef = useRef<GameState>(mkState(1));
  const [hudState, setHudState] = useState<GameState>(stateRef.current);

  return (
    <div className="w-full h-full relative bg-black">
      <Canvas shadows camera={{ position: [0, 6, 12], fov: 48, near: 0.1, far: 120 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.4 }}>
        <Arena />
        <GameScene state={stateRef} onUpdate={setHudState} />
      </Canvas>
      <HUD state={hudState} />
    </div>
  );
};

export default RagdollArena;
