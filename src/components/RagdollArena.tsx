import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const NAMES = ['BLAZE','VENOM','PHANTOM','TITAN','STORM','WRAITH','NOVA','FANG','REAPER','JINX'];
const COLORS = [0xff2244,0x00ff88,0x4488ff,0xffaa00,0xff00ff,0x00ffff,0xff6600,0x88ff00,0xff0088,0xaa44ff];
const HEX = ['#ff2244','#00ff88','#4488ff','#ffaa00','#ff00ff','#00ffff','#ff6600','#88ff00','#ff0088','#aa44ff'];
const GLOWS = ['#ff6688','#66ffbb','#88bbff','#ffcc55','#ff66ff','#66ffff','#ff9944','#bbff55','#ff55aa','#cc88ff'];
type Style = 'aggro'|'def'|'zerk'|'tact'|'assassin';
const STYLES: Style[] = ['aggro','def','zerk','tact','assassin','aggro','zerk','tact','assassin','def'];
const ARENA_R = 10;

interface V3 { x: number; y: number; z: number }
const v3 = (x=0,y=0,z=0): V3 => ({x,y,z});
const dist3 = (a: V3, b: V3) => Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2);
const lerp = (a: number, b: number, t: number) => a+(b-a)*t;
const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));

// Attack types with different properties
type AtkType = 'slash_r'|'slash_l'|'thrust'|'overhead'|'sweep'|'spin';
interface AtkDef { type: AtkType; dmg: number; range: number; speed: number; dur: number; kb: number; startAngle: number; endAngle: number; yOffset: number }
const ATTACKS: Record<AtkType, AtkDef> = {
  slash_r:  { type:'slash_r',  dmg:10, range:1.8, speed:14, dur:0.25, kb:3,  startAngle:-1.8, endAngle:1.2, yOffset:0 },
  slash_l:  { type:'slash_l',  dmg:10, range:1.8, speed:14, dur:0.25, kb:3,  startAngle:1.8,  endAngle:-1.2, yOffset:0 },
  thrust:   { type:'thrust',   dmg:14, range:2.2, speed:16, dur:0.2,  kb:4,  startAngle:0,    endAngle:0, yOffset:0.3 },
  overhead: { type:'overhead',  dmg:18, range:1.6, speed:10, dur:0.35, kb:5,  startAngle:-0.3, endAngle:-0.3, yOffset:0.8 },
  sweep:    { type:'sweep',    dmg:8,  range:2.0, speed:12, dur:0.3,  kb:2,  startAngle:-2.5, endAngle:2.5, yOffset:-0.3 },
  spin:     { type:'spin',     dmg:22, range:1.9, speed:8,  dur:0.5,  kb:7,  startAngle:0,    endAngle:6.28, yOffset:0 },
};

// Skeleton joint indices
const J = { head:0, neck:1, chest:2, hip:3, lShoulder:4, lElbow:5, lHand:6, rShoulder:7, rElbow:8, rHand:9, lHip:10, lKnee:11, lFoot:12, rHip:13, rKnee:14, rFoot:15 };
const LIMBS: [number,number,number][] = [
  [0,1,.12],[1,2,.14],[2,3,.13],
  [1,4,.1],[4,5,.08],[5,6,.07],
  [1,7,.1],[7,8,.08],[8,9,.07],
  [3,10,.11],[10,11,.09],[11,12,.08],
  [3,13,.11],[13,14,.09],[14,15,.08],
];

// Base standing pose
const STAND: V3[] = [
  v3(0,1.95,0), v3(0,1.75,0), v3(0,1.45,0), v3(0,1.1,0),
  v3(-.22,1.65,0), v3(-.42,1.35,0), v3(-.55,1.1,0),
  v3(.22,1.65,0), v3(.42,1.35,0), v3(.55,1.1,0),
  v3(-.12,1.0,0), v3(-.13,.55,0), v3(-.14,.05,0),
  v3(.12,1.0,0), v3(.13,.55,0), v3(.14,.05,0),
];

// ═══════════════════════════════════════════════════════
// BOT
// ═══════════════════════════════════════════════════════
interface Bot {
  id: number; name: string; color: number; hex: string; glow: string; style: Style;
  pos: V3; vel: V3; facing: number; targetFacing: number; walkPhase: number;
  joints: V3[]; jointVel: V3[]; ragdollTimer: number;
  hp: number; alive: boolean; stun: number;
  // Combat
  atkCd: number; dodgeCd: number; specCd: number; blockCd: number;
  kills: number; dmg: number; rage: number; combo: number; lastHit: number;
  // Current attack
  atk: AtkDef|null; atkTimer: number; atkProgress: number; hitThisSwing: Set<number>;
  // Sword visual
  swordAngle: number; swordY: number; swordTipPos: V3;
  // AI state
  aiState: 'approach'|'engage'|'circle'|'retreat'|'flank'; aiTimer: number;
  circleDir: number; strafeDir: number;
  blocking: boolean; blockTimer: number;
  // Movement intent
  moveX: number; moveZ: number; sprinting: boolean;
  // Rendering
  group: THREE.Group|null; limbMeshes: THREE.Mesh[]; headMesh: THREE.Mesh|null;
  swordMesh: THREE.Mesh|null; swordTrail: THREE.Mesh|null; footMeshes: THREE.Mesh[];
  bodyTilt: number; // lean into movement
}

interface Spark { p: V3; v: V3; life: number; ml: number; color: number; mesh: THREE.Mesh|null }
interface GameState {
  bots: Bot[]; sparks: Spark[]; t: number; over: boolean;
  winner: Bot|null; round: number; slow: number; winTimer: number; shakeIntensity: number;
}

function mkBot(i: number): Bot {
  const angle = (i / 10) * Math.PI * 2;
  const r = 4 + Math.random() * 2; // Start closer for faster action
  const px = Math.cos(angle) * r, pz = Math.sin(angle) * r;
  const joints = STAND.map(o => v3(px + o.x, o.y, pz + o.z));
  return {
    id: i, name: NAMES[i], color: COLORS[i], hex: HEX[i], glow: GLOWS[i], style: STYLES[i],
    pos: v3(px, 0, pz), vel: v3(), facing: angle + Math.PI, targetFacing: angle + Math.PI,
    walkPhase: Math.random() * 6.28,
    joints, jointVel: joints.map(() => v3()), ragdollTimer: 0,
    hp: 100, alive: true, stun: 0,
    atkCd: 0.5 + Math.random(), dodgeCd: 0, specCd: 0, blockCd: 0,
    kills: 0, dmg: 0, rage: 0, combo: 0, lastHit: -1,
    atk: null, atkTimer: 0, atkProgress: 0, hitThisSwing: new Set(),
    swordAngle: -0.5, swordY: 0, swordTipPos: v3(),
    aiState: 'approach', aiTimer: 0, circleDir: Math.random() > 0.5 ? 1 : -1,
    strafeDir: Math.random() > 0.5 ? 1 : -1,
    blocking: false, blockTimer: 0,
    moveX: 0, moveZ: 0, sprinting: false,
    group: null, limbMeshes: [], headMesh: null, swordMesh: null, swordTrail: null, footMeshes: [],
    bodyTilt: 0,
  };
}

// ═══════════════════════════════════════════════════════
// ATTACK SYSTEM
// ═══════════════════════════════════════════════════════
function startAttack(b: Bot, type: AtkType) {
  if (b.atk || b.atkCd > 0 || b.ragdollTimer > 0 || b.stun > 0) return;
  const def = ATTACKS[type];
  b.atk = def;
  b.atkTimer = def.dur;
  b.atkProgress = 0;
  b.hitThisSwing.clear();
  // Lunge forward on attack
  const lunge = type === 'thrust' ? 4 : type === 'spin' ? 1 : 2.5;
  b.vel.x += Math.cos(b.facing) * lunge;
  b.vel.z += Math.sin(b.facing) * lunge;
  b.atkCd = def.dur + 0.15; // small recovery window
}

function comboAttack(b: Bot) {
  const chainsMap: Record<Style, AtkType[]> = {
    aggro: ['slash_r','slash_l','overhead'],
    def: ['thrust','slash_r'],
    zerk: ['slash_r','slash_l','slash_r','spin'],
    tact: ['thrust','slash_l','sweep'],
    assassin: ['thrust','thrust','overhead'],
  };
  const chains = chainsMap[b.style];
  const idx = b.combo % chains.length;
  startAttack(b, chains[idx]);
}

// ═══════════════════════════════════════════════════════
// WALKING ANIMATION
// ═══════════════════════════════════════════════════════
function updateSkeleton(b: Bot, dt: number) {
  if (!b.alive && b.ragdollTimer <= 0) return;

  const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.z * b.vel.z);
  const isWalking = speed > 0.5;
  const isRunning = speed > 3.5;

  if (isWalking) b.walkPhase += dt * speed * 3.2;

  const sin = Math.sin(b.walkPhase);
  const cos = Math.cos(b.walkPhase);
  const cf = Math.cos(b.facing), sf = Math.sin(b.facing);

  // Body dynamics
  const bobY = isWalking ? Math.abs(sin) * (isRunning ? 0.1 : 0.05) : 0;
  const leanFwd = isWalking ? (isRunning ? 0.15 : 0.06) : 0;
  const hipSway = isWalking ? sin * 0.03 : 0;

  // Body tilt toward movement direction
  const targetTilt = isWalking ? clamp(speed * 0.02, 0, 0.15) : 0;
  b.bodyTilt = lerp(b.bodyTilt, targetTilt, dt * 5);

  // Attack pose modifications
  let atkSwordAngle = -0.5;
  let atkSwordY = 0;
  let atkChestTwist = 0;
  let atkLArmAngle = 0;

  if (b.atk && b.atkTimer > 0) {
    const p = 1 - b.atkTimer / b.atk.dur; // 0->1 progress
    b.atkProgress = p;
    const a = b.atk;
    
    if (a.type === 'spin') {
      atkChestTwist = p * a.endAngle;
      atkSwordAngle = -0.8;
    } else if (a.type === 'thrust') {
      atkSwordAngle = lerp(0, 0, p); // straight forward
      atkSwordY = lerp(0.2, a.yOffset, Math.min(1, p * 2));
      atkLArmAngle = -0.3; // pull back left arm
    } else if (a.type === 'overhead') {
      const upPhase = Math.min(1, p * 3);
      const downPhase = clamp((p - 0.33) * 3, 0, 1);
      atkSwordAngle = lerp(-0.5, -0.3, upPhase);
      atkSwordY = lerp(0.6, -0.3, downPhase);
    } else {
      // Slash
      atkSwordAngle = lerp(a.startAngle, a.endAngle, p);
      atkChestTwist = lerp(a.startAngle * 0.3, a.endAngle * 0.2, p);
    }
  } else if (b.blocking) {
    atkSwordAngle = 0.3;
    atkSwordY = 0.4;
    atkLArmAngle = 0.8;
  }

  b.swordAngle = atkSwordAngle;
  b.swordY = atkSwordY;

  // Place all joints
  for (let i = 0; i < 16; i++) {
    const o = STAND[i];
    // Rotate by facing + chest twist for upper body
    const twist = i <= 9 ? atkChestTwist : 0;
    const fa = b.facing + twist;
    const cfa = Math.cos(fa), sfa = Math.sin(fa);
    const rotX = o.x * cfa - o.z * sfa;
    const rotZ = o.x * sfa + o.z * cfa;

    let tx = b.pos.x + rotX;
    let ty = o.y + bobY;
    let tz = b.pos.z + rotZ;

    // Body lean
    if (i <= 3) {
      tx += cf * leanFwd * (3 - i) * 0.4;
      tz += sf * leanFwd * (3 - i) * 0.4;
      // Hip sway
      const perpX = -sf, perpZ = cf;
      tx += perpX * hipSway * (i === 3 ? 1 : 0.5);
      tz += perpZ * hipSway * (i === 3 ? 1 : 0.5);
    }

    // Leg animation - proper gait cycle
    if (isWalking) {
      const stride = isRunning ? 0.4 : 0.28;
      const lift = isRunning ? 0.2 : 0.12;
      const kneeForward = 0.15;

      if (i === J.lFoot) {
        tx += cf * sin * stride;
        tz += sf * sin * stride;
        ty = Math.max(0.05, ty + Math.max(0, sin) * lift);
      } else if (i === J.rFoot) {
        tx -= cf * sin * stride;
        tz -= sf * sin * stride;
        ty = Math.max(0.05, ty + Math.max(0, -sin) * lift);
      } else if (i === J.lKnee) {
        tx += cf * sin * stride * 0.5;
        tz += sf * sin * stride * 0.5;
        ty += Math.max(0, sin) * kneeForward + 0.02;
      } else if (i === J.rKnee) {
        tx -= cf * sin * stride * 0.5;
        tz -= sf * sin * stride * 0.5;
        ty += Math.max(0, -sin) * kneeForward + 0.02;
      }
      // Left arm swing (opposite legs) - when not attacking
      if (!b.atk && !b.blocking) {
        if (i === J.lHand) {
          tx -= cf * sin * 0.2;
          tz -= sf * sin * 0.2;
          ty -= Math.abs(sin) * 0.05;
        } else if (i === J.lElbow) {
          tx -= cf * sin * 0.1;
          tz -= sf * sin * 0.1;
        }
      }
    }

    // Left arm special poses
    if (atkLArmAngle !== 0 && (i === J.lHand || i === J.lElbow)) {
      const armFac = i === J.lHand ? 1 : 0.5;
      tx += (-sf) * atkLArmAngle * 0.3 * armFac;
      tz += cf * atkLArmAngle * 0.3 * armFac;
    }

    // Sword arm (right arm)
    if (i === J.rHand) {
      const handDist = b.atk?.type === 'thrust' ? 0.7 : 0.55;
      tx = b.pos.x + Math.cos(b.facing + b.swordAngle) * handDist;
      ty = 1.3 + b.swordY;
      tz = b.pos.z + Math.sin(b.facing + b.swordAngle) * handDist;
    } else if (i === J.rElbow) {
      const sa = b.swordAngle * 0.4;
      tx = b.pos.x + Math.cos(b.facing + sa) * 0.35 + (-sf) * 0.12;
      ty = 1.5 + b.swordY * 0.5;
      tz = b.pos.z + Math.sin(b.facing + sa) * 0.35;
    }

    // Ragdoll
    if (b.ragdollTimer > 0) {
      const w = clamp(b.ragdollTimer * 2.5, 0, 1);
      b.joints[i].x += b.jointVel[i].x * dt;
      b.joints[i].y += b.jointVel[i].y * dt;
      b.joints[i].z += b.jointVel[i].z * dt;
      b.jointVel[i].y -= 18 * dt;
      b.jointVel[i].x *= 0.96; b.jointVel[i].z *= 0.96;
      if (b.joints[i].y < 0.05) { b.joints[i].y = 0.05; b.jointVel[i].y *= -0.2; b.jointVel[i].x *= 0.8; b.jointVel[i].z *= 0.8; }
      b.joints[i].x = lerp(tx, b.joints[i].x, w);
      b.joints[i].y = lerp(ty, b.joints[i].y, w);
      b.joints[i].z = lerp(tz, b.joints[i].z, w);
    } else {
      const spd = b.atk ? 20 : 15;
      b.joints[i].x = lerp(b.joints[i].x, tx, dt * spd);
      b.joints[i].y = lerp(b.joints[i].y, ty, dt * spd);
      b.joints[i].z = lerp(b.joints[i].z, tz, dt * spd);
    }
  }

  // Sword tip for hit detection
  const hand = b.joints[J.rHand];
  const swordLen = b.atk?.type === 'thrust' ? 1.1 : 0.9;
  const tipAngle = b.facing + b.swordAngle;
  b.swordTipPos = {
    x: hand.x + Math.cos(tipAngle) * swordLen,
    y: hand.y + b.swordY * 0.5 + 0.3,
    z: hand.z + Math.sin(tipAngle) * swordLen,
  };
}

// ═══════════════════════════════════════════════════════
// MOVEMENT
// ═══════════════════════════════════════════════════════
function updateMovement(b: Bot, dt: number) {
  if (!b.alive) {
    if (b.ragdollTimer > 0) b.ragdollTimer -= dt;
    return;
  }

  if (b.ragdollTimer > 0) {
    b.ragdollTimer -= dt;
    b.vel.x *= 0.93; b.vel.z *= 0.93;
    if (b.ragdollTimer <= 0) {
      b.ragdollTimer = 0;
      for (const jv of b.jointVel) { jv.x = 0; jv.y = 0; jv.z = 0; }
    }
    b.pos.x += b.vel.x * dt;
    b.pos.z += b.vel.z * dt;
  } else {
    // Apply movement intent
    const spd = b.sprinting ? 5.5 : 3.8;
    const atkSlowdown = b.atk ? 0.4 : 1;
    const blockSlowdown = b.blocking ? 0.5 : 1;
    b.vel.x += b.moveX * spd * atkSlowdown * blockSlowdown * dt * 8;
    b.vel.z += b.moveZ * spd * atkSlowdown * blockSlowdown * dt * 8;
    b.pos.x += b.vel.x * dt;
    b.pos.z += b.vel.z * dt;
    b.vel.x *= (1 - 8 * dt);
    b.vel.z *= (1 - 8 * dt);
  }

  // Smooth facing
  let diff = b.targetFacing - b.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turnSpeed = b.atk ? 4 : (b.blocking ? 6 : 10);
  b.facing += diff * clamp(turnSpeed * dt, 0, 0.9);

  // Arena boundary  
  const hd = Math.sqrt(b.pos.x * b.pos.x + b.pos.z * b.pos.z);
  if (hd > ARENA_R - 0.5) {
    const nx = b.pos.x / hd, nz = b.pos.z / hd;
    b.pos.x = nx * (ARENA_R - 0.5);
    b.pos.z = nz * (ARENA_R - 0.5);
    const dot = b.vel.x * nx + b.vel.z * nz;
    if (dot > 0) { b.vel.x -= dot * nx * 1.5; b.vel.z -= dot * nz * 1.5; }
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
  b.stun = Math.max(0, b.stun - dt);

  if (b.blocking) {
    b.blockTimer -= dt;
    if (b.blockTimer <= 0) b.blocking = false;
  }
}

// ═══════════════════════════════════════════════════════
// AI
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
  let best: Bot | null = null, bh = Infinity;
  for (const b of bots) {
    if (b.id === self.id || !b.alive) continue;
    if (b.hp < bh) { bh = b.hp; best = b; }
  }
  return best;
}

function faceTarget(b: Bot, tx: number, tz: number) {
  b.targetFacing = Math.atan2(tz - b.pos.z, tx - b.pos.x);
}

function moveToward(b: Bot, tx: number, tz: number, sprint = false) {
  const dx = tx - b.pos.x, dz = tz - b.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  b.moveX = dx / d;
  b.moveZ = dz / d;
  b.sprinting = sprint;
  faceTarget(b, tx, tz);
}

function strafe(b: Bot, target: V3, dir: number, dist: number) {
  // Move perpendicular to target direction
  const dx = target.x - b.pos.x, dz = target.z - b.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  const perpX = -dz / d * dir, perpZ = dx / d * dir;
  // Also maintain distance
  const radial = (d - dist) * 0.4;
  b.moveX = perpX * 0.7 + (dx / d) * radial;
  b.moveZ = perpZ * 0.7 + (dz / d) * radial;
  faceTarget(b, target.x, target.z);
}

function dodgeBack(b: Bot, awayX: number, awayZ: number) {
  if (b.dodgeCd > 0 || b.ragdollTimer > 0) return;
  const dx = b.pos.x - awayX, dz = b.pos.z - awayZ;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  b.vel.x += (dx / d) * 7;
  b.vel.z += (dz / d) * 7;
  b.dodgeCd = 0.8;
}

function dodgeSide(b: Bot, target: V3) {
  if (b.dodgeCd > 0 || b.ragdollTimer > 0) return;
  const dx = target.x - b.pos.x, dz = target.z - b.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  const dir = b.strafeDir;
  b.vel.x += (-dz / d * dir) * 6;
  b.vel.z += (dx / d * dir) * 6;
  b.dodgeCd = 0.7;
  b.strafeDir *= -1;
}

function startBlock(b: Bot) {
  if (b.blockCd > 0 || b.atk || b.ragdollTimer > 0) return;
  b.blocking = true;
  b.blockTimer = 0.3 + Math.random() * 0.3;
  b.blockCd = 0.6;
}

function runAI(b: Bot, s: GameState, dt: number) {
  if (!b.alive || b.stun > 0 || b.ragdollTimer > 0.5) {
    b.moveX = 0; b.moveZ = 0;
    return;
  }

  // Pick target
  const t = (b.style === 'assassin' || b.style === 'tact')
    ? (weakest(b, s.bots) || nearest(b, s.bots))
    : nearest(b, s.bots);
  if (!t) { b.moveX = 0; b.moveZ = 0; return; }

  const d = dist3(b.pos, t.pos);
  b.aiTimer -= dt;

  // Rage buildup
  b.rage = clamp(b.rage + dt * (b.style === 'zerk' ? 8 : 3) * (b.hp < 50 ? 2 : 1), 0, 100);

  // Reactive: dodge/block incoming attacks
  if (t.atk && d < t.atk.range + 0.5) {
    const reactChance = { aggro: 0.15, def: 0.4, zerk: 0.05, tact: 0.3, assassin: 0.25 }[b.style];
    if (Math.random() < reactChance * dt * 10) {
      if (b.style === 'def' && Math.random() < 0.6) startBlock(b);
      else if (Math.random() < 0.5) dodgeSide(b, t.pos);
      else dodgeBack(b, t.pos.x, t.pos.z);
    }
  }

  // AI state machine
  if (b.aiTimer <= 0) {
    b.aiTimer = 0.3 + Math.random() * 0.5;
    b.circleDir = Math.random() > 0.4 ? b.circleDir : -b.circleDir;
    
    if (d > 4) b.aiState = 'approach';
    else if (d < 1.2 && b.hp < 30) b.aiState = 'retreat';
    else if (d < 2.5) b.aiState = 'engage';
    else b.aiState = Math.random() < 0.3 ? 'flank' : 'circle';
  }

  const engageRange = 2.2;

  switch (b.aiState) {
    case 'approach':
      moveToward(b, t.pos.x, t.pos.z, d > 5);
      if (d < engageRange) b.aiState = 'engage';
      break;

    case 'engage': {
      faceTarget(b, t.pos.x, t.pos.z);
      
      // Attack patterns based on style
      const atkChance = {
        aggro: 0.12, def: 0.06, zerk: 0.18, tact: 0.08, assassin: 0.1
      }[b.style];
      
      if (d < engageRange && !b.atk && b.atkCd <= 0) {
        if (Math.random() < atkChance) {
          // Choose attack based on style and situation
          if (b.combo > 0 && b.combo < 3 && Math.random() < 0.6) {
            comboAttack(b);
          } else {
            b.combo = 0;
            const picks: AtkType[] = {
              aggro: ['slash_r','slash_l','overhead'],
              def: ['thrust','slash_r'],
              zerk: ['slash_r','slash_l','spin','overhead'],
              tact: ['thrust','sweep','slash_l'],
              assassin: ['thrust','overhead','slash_r'],
            }[b.style];
            startAttack(b, picks[Math.floor(Math.random() * picks.length)]);
          }
        }
      }

      // Slight strafe while engaging
      if (!b.atk) {
        strafe(b, t.pos, b.circleDir, 1.6);
      } else {
        // Move toward target during attack
        if (d > 1.5) {
          b.moveX = Math.cos(b.facing) * 0.5;
          b.moveZ = Math.sin(b.facing) * 0.5;
        }
      }

      // Special attacks
      if (b.rage > 70 && b.specCd <= 0 && d < 2 && Math.random() < 0.03) {
        startAttack(b, 'spin');
        b.rage = 0;
        b.specCd = 3;
      }

      if (d > 3) b.aiState = 'approach';
      break;
    }

    case 'circle':
      strafe(b, t.pos, b.circleDir, 2.5);
      if (d < engageRange && Math.random() < 0.3) b.aiState = 'engage';
      if (d > 4) b.aiState = 'approach';
      break;

    case 'flank': {
      // Try to get behind target
      const behindX = t.pos.x - Math.cos(t.facing) * 2;
      const behindZ = t.pos.z - Math.sin(t.facing) * 2;
      moveToward(b, behindX, behindZ, true);
      faceTarget(b, t.pos.x, t.pos.z);
      if (d < engageRange) b.aiState = 'engage';
      break;
    }

    case 'retreat':
      dodgeBack(b, t.pos.x, t.pos.z);
      b.moveX = (b.pos.x - t.pos.x);
      b.moveZ = (b.pos.z - t.pos.z);
      const rd = Math.sqrt(b.moveX ** 2 + b.moveZ ** 2) || 1;
      b.moveX /= rd; b.moveZ /= rd;
      b.sprinting = true;
      faceTarget(b, t.pos.x, t.pos.z);
      if (d > 5 || b.hp > 40) b.aiState = 'circle';
      break;
  }

  // Arena avoidance
  const hd = Math.sqrt(b.pos.x ** 2 + b.pos.z ** 2);
  if (hd > ARENA_R - 2) {
    b.moveX -= b.pos.x / hd * 0.5;
    b.moveZ -= b.pos.z / hd * 0.5;
  }

  // Normalize
  const ml = Math.sqrt(b.moveX ** 2 + b.moveZ ** 2);
  if (ml > 1) { b.moveX /= ml; b.moveZ /= ml; }
}

// ═══════════════════════════════════════════════════════
// HIT DETECTION
// ═══════════════════════════════════════════════════════
function checkHits(s: GameState) {
  for (const atk of s.bots) {
    if (!atk.alive || !atk.atk || atk.atkTimer <= 0) continue;
    
    for (const def of s.bots) {
      if (def.id === atk.id || !def.alive || atk.hitThisSwing.has(def.id)) continue;

      // Check sword tip and mid-blade against defender
      const bodyY = 1.2;
      const tipD = dist3(atk.swordTipPos, { x: def.pos.x, y: bodyY, z: def.pos.z });
      const handD = dist3(atk.joints[J.rHand], { x: def.pos.x, y: bodyY, z: def.pos.z });
      const midX = (atk.swordTipPos.x + atk.joints[J.rHand].x) / 2;
      const midZ = (atk.swordTipPos.z + atk.joints[J.rHand].z) / 2;
      const midD = Math.sqrt((midX - def.pos.x) ** 2 + (bodyY - bodyY) ** 2 + (midZ - def.pos.z) ** 2);

      if (tipD < 0.5 || handD < 0.4 || midD < 0.45) {
        atk.hitThisSwing.add(def.id);
        applyHit(s, atk, def);
      }
    }
  }

  // Body separation
  for (let i = 0; i < s.bots.length; i++) {
    for (let j = i + 1; j < s.bots.length; j++) {
      const a = s.bots[i], b = s.bots[j];
      if (!a.alive || !b.alive) continue;
      const d = dist3(a.pos, b.pos);
      if (d < 0.6 && d > 0) {
        const nx = (a.pos.x - b.pos.x) / d, nz = (a.pos.z - b.pos.z) / d;
        const p = (0.6 - d) * 4;
        a.vel.x += nx * p; a.vel.z += nz * p;
        b.vel.x -= nx * p; b.vel.z -= nz * p;
      }
    }
  }
}

function applyHit(s: GameState, atk: Bot, def: Bot) {
  const a = atk.atk!;
  
  // Block check
  if (def.blocking) {
    // Blocked! Small stun on attacker instead
    atk.stun = 0.3;
    atk.vel.x -= Math.cos(atk.facing) * 3;
    atk.vel.z -= Math.sin(atk.facing) * 3;
    addSparks(s, (atk.pos.x + def.pos.x) / 2, 1.3, (atk.pos.z + def.pos.z) / 2, 6, 0xffffff, 4);
    s.shakeIntensity += 0.05;
    def.blocking = false;
    return;
  }

  let dmg = a.dmg * (0.8 + Math.random() * 0.4);
  if (atk.rage > 50) dmg *= 1 + atk.rage / 200;
  // Backstab bonus
  const angleToDef = Math.atan2(def.pos.z - atk.pos.z, def.pos.x - atk.pos.x);
  let faceDiff = angleToDef - def.facing;
  while (faceDiff > Math.PI) faceDiff -= Math.PI * 2;
  while (faceDiff < -Math.PI) faceDiff += Math.PI * 2;
  if (Math.abs(faceDiff) < Math.PI * 0.4) dmg *= 1.5; // backstab!

  dmg = Math.min(dmg, 40);
  def.hp -= dmg;
  def.lastHit = atk.id;
  atk.dmg += dmg;
  atk.rage = clamp(atk.rage + dmg * 0.5, 0, 100);

  // Knockback
  const dx = def.pos.x - atk.pos.x, dz = def.pos.z - atk.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  def.vel.x += (dx / d) * a.kb;
  def.vel.z += (dz / d) * a.kb;

  // Ragdoll on heavy hits
  if (dmg > 14 || a.type === 'overhead' || a.type === 'spin') {
    def.ragdollTimer = clamp(0.4 + dmg * 0.02, 0.3, 1.2);
    def.stun = def.ragdollTimer * 0.7;
    for (const jv of def.jointVel) {
      jv.x += (dx / d) * a.kb * (0.5 + Math.random() * 0.5);
      jv.y += 2 + Math.random() * 2;
      jv.z += (dz / d) * a.kb * (0.5 + Math.random() * 0.5);
    }
  } else {
    def.stun = 0.12;
  }

  // VFX
  const hx = (atk.swordTipPos.x + def.pos.x) / 2;
  const hz = (atk.swordTipPos.z + def.pos.z) / 2;
  addSparks(s, hx, 1.2, hz, clamp(3 + (dmg * 0.3) | 0, 3, 10), atk.color, 3);
  if (dmg > 14) addSparks(s, hx, 1.2, hz, 4, 0xff4400, 2);
  s.shakeIntensity += dmg * 0.01;

  // Death
  if (def.hp <= 0) {
    def.hp = 0; def.alive = false; atk.kills++; atk.rage = 100;
    s.slow = 0.12;
    def.ragdollTimer = 5;
    for (const jv of def.jointVel) {
      jv.x += (dx / d) * 12 * (0.5 + Math.random());
      jv.y += 4 + Math.random() * 5;
      jv.z += (dz / d) * 12 * (0.5 + Math.random());
    }
    addSparks(s, def.pos.x, 1, def.pos.z, 20, def.color, 5);
    addSparks(s, def.pos.x, 1, def.pos.z, 10, 0xff6600, 4);
    s.shakeIntensity += 0.35;
  }
}

function addSparks(s: GameState, x: number, y: number, z: number, n: number, color: number, spd: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI * 0.8;
    const sp = Math.random() * spd + spd * 0.3;
    s.sparks.push({
      p: { x: x + (Math.random() - .5) * .2, y: y + Math.random() * .2, z: z + (Math.random() - .5) * .2 },
      v: { x: Math.cos(a) * Math.cos(b) * sp, y: Math.sin(b) * sp + 2, z: Math.sin(a) * Math.cos(b) * sp },
      life: .3 + Math.random() * .4, ml: .3 + Math.random() * .4, color, mesh: null,
    });
  }
}

// ═══════════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════════
function mkState(round: number): GameState {
  return { bots: Array.from({ length: 10 }, (_, i) => mkBot(i)), sparks: [], t: 0, over: false, winner: null, round, slow: 1, winTimer: 0, shakeIntensity: 0 };
}

function updateState(s: GameState, dt: number): boolean {
  s.t += dt;
  if (s.slow < 1) s.slow = Math.min(1, s.slow + dt * 2);
  const adt = dt * s.slow;
  for (const b of s.bots) runAI(b, s, adt);
  for (const b of s.bots) { updateMovement(b, adt); updateSkeleton(b, adt); }
  checkHits(s);

  // Sparks
  for (let i = s.sparks.length - 1; i >= 0; i--) {
    const p = s.sparks[i];
    p.p.x += p.v.x * adt; p.p.y += p.v.y * adt; p.p.z += p.v.z * adt;
    p.v.y -= 12 * adt; p.v.x *= .96; p.v.z *= .96; p.life -= adt;
    if (p.life <= 0) { if (p.mesh?.parent) p.mesh.parent.remove(p.mesh); s.sparks.splice(i, 1); }
  }
  if (s.sparks.length > 150) {
    const ex = s.sparks.splice(0, s.sparks.length - 150);
    for (const sp of ex) { if (sp.mesh?.parent) sp.mesh.parent.remove(sp.mesh); }
  }
  s.shakeIntensity *= .88;
  if (s.shakeIntensity < .001) s.shakeIntensity = 0;

  const alive = s.bots.filter(b => b.alive);
  if (alive.length <= 1 && !s.over) {
    s.over = true;
    s.winner = alive[0] || null;
    if (s.winner) addSparks(s, s.winner.pos.x, 1.5, s.winner.pos.z, 30, s.winner.color, 7);
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
  mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  _tmpV.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const l = _tmpV.length();
  if (l < 0.001) return;
  _tmpV.normalize();
  _tmpQ.setFromUnitVectors(_up, _tmpV);
  mesh.quaternion.copy(_tmpQ);
  mesh.scale.set(t, l, t);
}

const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
const swordBlade = new THREE.BoxGeometry(0.03, 0.9, 0.08);
const swordGuard = new THREE.BoxGeometry(0.02, 0.04, 0.15);
const sparkGeo = new THREE.SphereGeometry(1, 6, 4);

function createBotMeshes(bot: Bot, scene: THREE.Group) {
  const mat = new THREE.MeshStandardMaterial({
    color: bot.color, emissive: bot.color, emissiveIntensity: 0.4,
    roughness: 0.25, metalness: 0.65,
  });
  const group = new THREE.Group();

  bot.limbMeshes = LIMBS.map(() => {
    const m = new THREE.Mesh(cylGeo, mat);
    m.castShadow = true;
    group.add(m);
    return m;
  });

  const head = new THREE.Mesh(sphereGeo, mat);
  head.castShadow = true;
  group.add(head);
  bot.headMesh = head;

  const fL = new THREE.Mesh(sphereGeo, mat); fL.castShadow = true; group.add(fL);
  const fR = new THREE.Mesh(sphereGeo, mat); fR.castShadow = true; group.add(fR);
  bot.footMeshes = [fL, fR];

  // Sword
  const swordMat = new THREE.MeshStandardMaterial({
    color: 0xdddde0, emissive: bot.color, emissiveIntensity: 0.25,
    roughness: 0.08, metalness: 0.95,
  });
  const guardMat = new THREE.MeshStandardMaterial({ color: 0x886622, roughness: 0.4, metalness: 0.7 });
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(swordBlade, swordMat); blade.position.y = 0.5; blade.castShadow = true;
  const guard = new THREE.Mesh(swordGuard, guardMat); guard.position.y = 0.04;
  sword.add(blade); sword.add(guard);
  group.add(sword);
  bot.swordMesh = sword as any;

  // Sword trail
  const trailGeo = new THREE.PlaneGeometry(0.9, 0.06);
  const trailMat = new THREE.MeshBasicMaterial({ color: bot.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
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
    bot.headMesh.scale.setScalar(0.14);
  }
  if (bot.footMeshes[0]) { bot.footMeshes[0].position.set(j[12].x, j[12].y, j[12].z); bot.footMeshes[0].scale.setScalar(0.07); }
  if (bot.footMeshes[1]) { bot.footMeshes[1].position.set(j[15].x, j[15].y, j[15].z); bot.footMeshes[1].scale.setScalar(0.07); }

  // Sword
  if (bot.swordMesh) {
    const hand = j[J.rHand];
    bot.swordMesh.position.set(hand.x, hand.y, hand.z);
    const sa = bot.facing + bot.swordAngle;
    bot.swordMesh.rotation.set(bot.swordY * 0.5, -sa + Math.PI / 2, bot.swordAngle * 0.2);
  }

  // Trail
  if (bot.swordTrail) {
    const isAtk = bot.atk && bot.atkTimer > 0;
    bot.swordTrail.visible = !!isAtk;
    if (isAtk) {
      const hand = j[J.rHand];
      const tip = bot.swordTipPos;
      bot.swordTrail.position.set((hand.x + tip.x) / 2, (hand.y + tip.y) / 2, (hand.z + tip.z) / 2);
      _tmpV.set(tip.x - hand.x, tip.y - hand.y, tip.z - hand.z);
      const l = _tmpV.length();
      bot.swordTrail.scale.set(l, 4, 1);
      bot.swordTrail.lookAt(tip.x, tip.y, tip.z);
      (bot.swordTrail.material as THREE.MeshBasicMaterial).opacity = (bot.atkTimer / (bot.atk?.dur || 0.3)) * 0.7;
    }
  }

  // Dead
  if (!bot.alive) {
    bot.group.traverse(child => {
      const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m?.opacity !== undefined) { m.transparent = true; m.opacity = 0.2; m.emissiveIntensity = 0.03; }
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
    sp.mesh.scale.setScalar(0.05 * a * 2);
    (sp.mesh.material as THREE.MeshBasicMaterial).opacity = a;
    (sp.mesh.material as THREE.MeshBasicMaterial).transparent = true;
  }
}

// ═══════════════════════════════════════════════════════
// SCENE
// ═══════════════════════════════════════════════════════
function GameScene({ state, onUpdate }: { state: React.MutableRefObject<GameState>; onUpdate: (s: GameState) => void }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null!);
  const sparkRef = useRef<THREE.Group>(null!);
  const init = useRef(false);
  const camAngle = useRef(0);

  useEffect(() => {
    if (init.current || !groupRef.current) return;
    init.current = true;
    for (const bot of state.current.bots) createBotMeshes(bot, groupRef.current);
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const s = state.current;

    if (s.over) {
      s.winTimer += dt;
      for (const b of s.bots) { updateMovement(b, dt); updateSkeleton(b, dt); }
      for (const b of s.bots) updateBotMeshes(b);
      updateSparkMeshes(s.sparks, sparkRef.current);
      if (s.winTimer >= 5) {
        while (groupRef.current.children.length) groupRef.current.remove(groupRef.current.children[0]);
        while (sparkRef.current.children.length) sparkRef.current.remove(sparkRef.current.children[0]);
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

    // Dynamic camera tracking action center
    const alive = s.bots.filter(b => b.alive);
    let cx = 0, cz = 0;
    if (alive.length) {
      for (const b of alive) { cx += b.pos.x; cz += b.pos.z; }
      cx /= alive.length; cz /= alive.length;
    }
    // Camera follows the closest fight
    let fightX = cx, fightZ = cz;
    let minFightDist = Infinity;
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const d = dist3(alive[i].pos, alive[j].pos);
        if (d < minFightDist && d < 4) {
          minFightDist = d;
          fightX = (alive[i].pos.x + alive[j].pos.x) / 2;
          fightZ = (alive[i].pos.z + alive[j].pos.z) / 2;
        }
      }
    }
    const lookX = lerp(cx, fightX, 0.6);
    const lookZ = lerp(cz, fightZ, 0.6);

    camAngle.current += dt * 0.15;
    const cd = 7 + alive.length * 0.3;
    const ch = 4.5 + alive.length * 0.2;
    const shake = s.shakeIntensity;
    camera.position.lerp(
      _tmpV.set(
        lookX + Math.cos(camAngle.current) * cd + (Math.random() - .5) * shake,
        ch + (Math.random() - .5) * shake,
        lookZ + Math.sin(camAngle.current) * cd + (Math.random() - .5) * shake
      ), 0.04
    );
    camera.lookAt(lookX, 1, lookZ);

    if (Math.floor(s.t * 10) % 3 === 0) onUpdate({ ...s });
  });

  return <><group ref={groupRef} /><group ref={sparkRef} /></>;
}

function Arena() {
  return <>
    <ambientLight intensity={0.15} color={0x334466} />
    <directionalLight position={[10, 15, 5]} intensity={1.3} color={0xffeedd} castShadow
      shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-far={50} shadow-camera-left={-15} shadow-camera-right={15}
      shadow-camera-top={15} shadow-camera-bottom={-15} />
    <pointLight position={[0, 8, 0]} intensity={2.5} color={0xff2244} distance={25} />
    <pointLight position={[-8, 5, -8]} intensity={1.5} color={0x4488ff} distance={20} />
    <pointLight position={[8, 5, 8]} intensity={1.5} color={0x00ff88} distance={20} />
    <spotLight position={[0, 12, 0]} angle={0.6} penumbra={0.5} intensity={2} color={0xffffff} castShadow />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[ARENA_R, 64]} />
      <meshStandardMaterial color={0x0a0a18} roughness={0.85} metalness={0.3} />
    </mesh>
    <gridHelper args={[ARENA_R * 2, 20, 0x1a1a33, 0x111128]} position={[0, .01, 0]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .02, 0]}>
      <ringGeometry args={[ARENA_R - .15, ARENA_R, 64]} />
      <meshStandardMaterial color={0xff2244} emissive={0xff2244} emissiveIntensity={1} />
    </mesh>
    <fog attach="fog" args={[0x060610, 12, 30]} />
  </>;
}

// ═══════════════════════════════════════════════════════
// HUD
// ═══════════════════════════════════════════════════════
function HUD({ state }: { state: GameState }) {
  const alive = state.bots.filter(b => b.alive).length;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ fontFamily: "'Orbitron',sans-serif" }}>
      <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-1">
        <div className="text-xs tracking-[.3em] text-foreground/40 font-display">ROUND {state.round}</div>
        <div className={`text-xs tracking-widest ${alive <= 3 ? 'text-primary' : 'text-foreground/30'}`}>{alive} FIGHTERS REMAINING</div>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex gap-1">
        {state.bots.map(b => (
          <div key={b.id} className={`flex-1 relative h-7 rounded-sm overflow-hidden border ${b.alive ? 'border-border' : 'border-border/20'}`} style={{ opacity: b.alive ? 1 : 0.3 }}>
            <div className="absolute inset-0 bg-muted" />
            {b.alive && <div className="absolute inset-y-0 left-0 transition-all duration-150" style={{ width: `${b.hp}%`, backgroundColor: b.hex, opacity: 0.7 }} />}
            <div className="absolute inset-0 flex items-center justify-between px-1">
              <span className="text-[6px] font-bold text-foreground/80 truncate">{b.name}</span>
              {b.kills > 0 && <span className="text-[6px] text-accent font-bold">{b.kills}K</span>}
            </div>
          </div>
        ))}
      </div>
      {state.over && state.winner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 animate-in fade-in duration-500">
          <div className="text-5xl font-display tracking-widest mb-4" style={{ color: state.winner.hex }}>WINNER</div>
          <div className="text-3xl font-heading font-bold mb-6" style={{ color: state.winner.glow }}>{state.winner.name}</div>
          <div className="text-sm text-foreground/50 mb-3">Kills: {state.winner.kills} &nbsp;|&nbsp; DMG: {Math.round(state.winner.dmg)} &nbsp;|&nbsp; HP: {Math.round(state.winner.hp)}</div>
          <div className="text-xs font-bold mb-8" style={{ color: state.winner.hex + 'cc' }}>{state.winner.style.toUpperCase()}</div>
          <div className="text-xs text-foreground/40 mb-2 tracking-widest">LEADERBOARD</div>
          <div className="flex flex-col gap-1 items-center">
            {[...state.bots].sort((a, b) => b.kills - a.kills || b.dmg - a.dmg).slice(0, 5).map((r, i) => (
              <div key={r.id} className="text-[11px]" style={{ color: r.id === state.winner!.id ? state.winner!.hex : '#666' }}>
                {i + 1}. {r.name} — {r.kills}K — {Math.round(r.dmg)} dmg
              </div>
            ))}
          </div>
          <div className="mt-8 text-sm text-foreground/30 animate-pulse">Next round in {Math.max(1, Math.ceil(5 - state.winTimer))}...</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
const RagdollArena = () => {
  const stateRef = useRef<GameState>(mkState(1));
  const [hudState, setHudState] = useState<GameState>(stateRef.current);
  return (
    <div className="w-full h-full relative bg-background">
      <Canvas shadows camera={{ position: [0, 6, 12], fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}>
        <Arena />
        <GameScene state={stateRef} onUpdate={setHudState} />
      </Canvas>
      <HUD state={hudState} />
    </div>
  );
};

export default RagdollArena;
