import { useRef, useEffect, useState, useCallback } from 'react';
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
const ARENA_R = 12;
const WALK_SPEED = 3.5;
const SPRINT_SPEED = 5.5;

interface V3 { x: number; y: number; z: number }
const v3 = (x=0,y=0,z=0): V3 => ({x,y,z});
const sub3 = (a: V3, b: V3): V3 => ({x:a.x-b.x, y:a.y-b.y, z:a.z-b.z});
const len3 = (a: V3) => Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z);
const dist3 = (a: V3, b: V3) => len3(sub3(a,b));
const norm3 = (a: V3): V3 => { const l = len3(a)||1; return {x:a.x/l,y:a.y/l,z:a.z/l}; };
const lerp = (a: number, b: number, t: number) => a + (b-a)*t;

// Limb rendering: [jointA, jointB, thickness]
const LIMBS: [number,number,number][] = [
  [0,1,.12],[1,2,.14],[2,3,.13],
  [1,4,.1],[4,5,.08],[5,6,.07],
  [1,7,.1],[7,8,.08],[8,9,.07],
  [3,10,.11],[10,11,.09],[11,12,.08],
  [3,13,.11],[13,14,.09],[14,15,.08],
];

// ═══════════════════════════════════════════════════════
// BOT - Hybrid approach: controlled body + ragdoll on hit
// ═══════════════════════════════════════════════════════
interface Bot {
  id: number; name: string; color: number; hex: string; glow: string; style: Style;
  // Position & movement (controlled)
  pos: V3;           // ground position (x, 0, z)
  vel: V3;           // movement velocity
  facing: number;    // angle in radians (Y rotation)
  walkPhase: number; // for leg animation
  // Ragdoll joints (relative to pos, for rendering & hit effects)
  joints: V3[];      // 16 joint positions (world space)
  jointVel: V3[];    // velocities for ragdoll effects
  ragdollTimer: number; // > 0 means in ragdoll mode (knocked down)
  // Combat
  hp: number; alive: boolean; stun: number;
  atkCd: number; dodgeCd: number; specCd: number;
  kills: number; dmg: number; rage: number; combo: number; lastHit: number;
  // Sword
  swordAngle: number;    // current swing angle
  swinging: boolean;     // actively swinging
  swingDir: number;      // 1 or -1
  swingTimer: number;
  swordTipPos: V3;       // for hit detection
  // Rendering refs
  group: THREE.Group|null;
  limbMeshes: THREE.Mesh[];
  headMesh: THREE.Mesh|null;
  swordMesh: THREE.Mesh|null;
  swordTrail: THREE.Mesh|null;
  footMeshes: THREE.Mesh[];
}

interface Spark { p: V3; v: V3; life: number; ml: number; color: number; mesh: THREE.Mesh|null }
interface GameState {
  bots: Bot[]; sparks: Spark[]; t: number; over: boolean;
  winner: Bot|null; round: number; slow: number; winTimer: number; shakeIntensity: number;
}

// ═══════════════════════════════════════════════════════
// SKELETON - Standing pose joint offsets from feet center
// ═══════════════════════════════════════════════════════
const STAND_POSE: V3[] = [
  v3(0, 1.95, 0),    // 0 head
  v3(0, 1.75, 0),    // 1 neck
  v3(0, 1.45, 0),    // 2 chest
  v3(0, 1.1, 0),     // 3 hip
  v3(-.22, 1.65, 0), // 4 L shoulder
  v3(-.42, 1.35, 0), // 5 L elbow
  v3(-.55, 1.1, 0),  // 6 L hand
  v3(.22, 1.65, 0),  // 7 R shoulder
  v3(.42, 1.35, 0),  // 8 R elbow
  v3(.55, 1.1, 0),   // 9 R hand (sword hand)
  v3(-.12, 1.0, 0),  // 10 L hip joint
  v3(-.13, .55, 0),  // 11 L knee
  v3(-.14, .05, 0),  // 12 L foot
  v3(.12, 1.0, 0),   // 13 R hip joint
  v3(.13, .55, 0),   // 14 R knee
  v3(.14, .05, 0),   // 15 R foot
];

function mkBot(i: number): Bot {
  const angle = (i / 10) * Math.PI * 2;
  const r = 6 + Math.random() * 3;
  const px = Math.cos(angle) * r, pz = Math.sin(angle) * r;
  const joints = STAND_POSE.map(o => v3(px + o.x, o.y, pz + o.z));
  return {
    id: i, name: NAMES[i], color: COLORS[i], hex: HEX[i], glow: GLOWS[i], style: STYLES[i],
    pos: v3(px, 0, pz), vel: v3(), facing: angle + Math.PI, walkPhase: Math.random()*6.28,
    joints, jointVel: joints.map(() => v3()), ragdollTimer: 0,
    hp: 100, alive: true, stun: 0, atkCd: 0, dodgeCd: 0, specCd: 0,
    kills: 0, dmg: 0, rage: 0, combo: 0, lastHit: -1,
    swordAngle: -0.5, swinging: false, swingDir: 1, swingTimer: 0, swordTipPos: v3(),
    group: null, limbMeshes: [], headMesh: null, swordMesh: null, swordTrail: null, footMeshes: [],
  };
}

// ═══════════════════════════════════════════════════════
// WALKING ANIMATION - Procedural IK-like joint placement
// ═══════════════════════════════════════════════════════
function updateSkeleton(b: Bot, dt: number) {
  if (!b.alive) return;
  const speed = Math.sqrt(b.vel.x*b.vel.x + b.vel.z*b.vel.z);
  const isWalking = speed > 0.3;

  if (isWalking) {
    b.walkPhase += dt * speed * 2.8;
  }

  const sin = Math.sin(b.walkPhase);
  const cos = Math.cos(b.walkPhase);
  const cf = Math.cos(b.facing), sf = Math.sin(b.facing);
  // Right = perpendicular to facing
  const rx = -sf, rz = cf;

  // Body bob
  const bobY = isWalking ? Math.abs(sin) * 0.06 : 0;
  const leanFwd = isWalking ? 0.08 : 0;

  // Place joints relative to pos
  for (let i = 0; i < 16; i++) {
    const o = STAND_POSE[i];
    // Rotate offset by facing
    const ox = o.x * (-sf) + o.z * cf; // rotated x
    const oz = o.x * cf + o.z * sf;    // rotated z (wrong, let me fix)
    // Actually proper rotation around Y axis:
    const rotX = o.x * Math.cos(b.facing) - o.z * Math.sin(b.facing);
    const rotZ = o.x * Math.sin(b.facing) + o.z * Math.cos(b.facing);

    let targetX = b.pos.x + rotX;
    let targetY = o.y + bobY;
    let targetZ = b.pos.z + rotZ;

    // Lean forward when walking
    if (i <= 2) { // head, neck, chest lean
      targetX += cf * leanFwd * (3 - i) * 0.5;
      targetZ += sf * leanFwd * (3 - i) * 0.5;
    }

    // Leg animation
    if (isWalking) {
      const legSwing = 0.25;
      if (i === 12) { // L foot
        targetX += cf * sin * legSwing;
        targetZ += sf * sin * legSwing;
        targetY = Math.max(0.05, targetY + Math.max(0, sin) * 0.15);
      } else if (i === 15) { // R foot
        targetX -= cf * sin * legSwing;
        targetZ -= sf * sin * legSwing;
        targetY = Math.max(0.05, targetY + Math.max(0, -sin) * 0.15);
      } else if (i === 11) { // L knee
        targetX += cf * sin * legSwing * 0.5;
        targetZ += sf * sin * legSwing * 0.5;
        targetY += Math.max(0, sin) * 0.1;
      } else if (i === 14) { // R knee
        targetX -= cf * sin * legSwing * 0.5;
        targetZ -= sf * sin * legSwing * 0.5;
        targetY += Math.max(0, -sin) * 0.1;
      }
      // Arm swing (opposite to legs)
      if (i === 6) { // L hand
        targetX -= cf * sin * 0.15;
        targetZ -= sf * sin * 0.15;
      } else if (i === 5) { // L elbow
        targetX -= cf * sin * 0.08;
        targetZ -= sf * sin * 0.08;
      }
    }

    // Sword arm (right arm) - controlled by swing
    if (i === 9) { // R hand
      const sa = b.swordAngle;
      const handDist = 0.55;
      targetX = b.pos.x + Math.cos(b.facing + sa) * handDist;
      targetY = 1.3 + Math.sin(sa) * 0.3;
      targetZ = b.pos.z + Math.sin(b.facing + sa) * handDist;
    } else if (i === 8) { // R elbow
      const sa = b.swordAngle * 0.5;
      const eDist = 0.35;
      targetX = b.pos.x + Math.cos(b.facing + sa) * eDist + rx * 0.1;
      targetY = 1.45;
      targetZ = b.pos.z + Math.sin(b.facing + sa) * eDist;
    }

    // Ragdoll influence
    if (b.ragdollTimer > 0) {
      const ragdollWeight = Math.min(1, b.ragdollTimer * 2);
      // Apply velocities
      b.joints[i].x += b.jointVel[i].x * dt;
      b.joints[i].y += b.jointVel[i].y * dt;
      b.joints[i].z += b.jointVel[i].z * dt;
      b.jointVel[i].y -= 15 * dt; // gravity
      b.jointVel[i].x *= 0.97; b.jointVel[i].y *= 0.99; b.jointVel[i].z *= 0.97;
      if (b.joints[i].y < 0.05) { b.joints[i].y = 0.05; b.jointVel[i].y *= -0.3; }
      // Blend
      b.joints[i].x = lerp(targetX, b.joints[i].x, ragdollWeight);
      b.joints[i].y = lerp(targetY, b.joints[i].y, ragdollWeight);
      b.joints[i].z = lerp(targetZ, b.joints[i].z, ragdollWeight);
    } else {
      // Smooth interpolation to target
      const spd = 15;
      b.joints[i].x = lerp(b.joints[i].x, targetX, dt * spd);
      b.joints[i].y = lerp(b.joints[i].y, targetY, dt * spd);
      b.joints[i].z = lerp(b.joints[i].z, targetZ, dt * spd);
    }
  }

  // Update sword tip position (for hit detection) - extends from right hand
  const hand = b.joints[9];
  const swordLen = 0.9;
  const tipAngle = b.facing + b.swordAngle;
  b.swordTipPos = {
    x: hand.x + Math.cos(tipAngle) * swordLen,
    y: hand.y + Math.sin(b.swordAngle * 0.5) * swordLen * 0.5 + 0.3,
    z: hand.z + Math.sin(tipAngle) * swordLen,
  };
}

// ═══════════════════════════════════════════════════════
// MOVEMENT & PHYSICS
// ═══════════════════════════════════════════════════════
function updateMovement(b: Bot, dt: number) {
  if (!b.alive) return;
  // Ragdoll recovery
  if (b.ragdollTimer > 0) {
    b.ragdollTimer -= dt;
    b.vel.x *= 0.95; b.vel.z *= 0.95;
    if (b.ragdollTimer <= 0) {
      b.ragdollTimer = 0;
      // Reset joint velocities
      for (const jv of b.jointVel) { jv.x = 0; jv.y = 0; jv.z = 0; }
    }
  }

  // Apply velocity with friction
  b.pos.x += b.vel.x * dt;
  b.pos.z += b.vel.z * dt;
  b.vel.x *= (1 - 5 * dt); // friction
  b.vel.z *= (1 - 5 * dt);

  // Arena boundary
  const hd = Math.sqrt(b.pos.x*b.pos.x + b.pos.z*b.pos.z);
  if (hd > ARENA_R - 0.5) {
    const nx = b.pos.x/hd, nz = b.pos.z/hd;
    b.pos.x = nx * (ARENA_R - 0.5);
    b.pos.z = nz * (ARENA_R - 0.5);
    const dot = b.vel.x*nx + b.vel.z*nz;
    if (dot > 0) { b.vel.x -= dot*nx; b.vel.z -= dot*nz; }
  }

  // Sword swing update
  if (b.swinging) {
    b.swingTimer -= dt;
    b.swordAngle += b.swingDir * dt * 12; // fast swing
    if (b.swingTimer <= 0) {
      b.swinging = false;
      b.swordAngle = -0.5; // return to rest
    }
  } else {
    // Gentle idle sword sway
    b.swordAngle = lerp(b.swordAngle, -0.5 + Math.sin(b.walkPhase * 0.3) * 0.1, dt * 3);
  }

  // Cooldowns
  b.atkCd = Math.max(0, b.atkCd - dt);
  b.dodgeCd = Math.max(0, b.dodgeCd - dt);
  b.specCd = Math.max(0, b.specCd - dt);
  b.stun = Math.max(0, b.stun - dt);
}

// ═══════════════════════════════════════════════════════
// AI - Walking & sword fighting
// ═══════════════════════════════════════════════════════
function walkTo(b: Bot, tx: number, tz: number, speed: number) {
  const dx = tx - b.pos.x, dz = tz - b.pos.z;
  const d = Math.sqrt(dx*dx + dz*dz) || 1;
  b.vel.x += (dx/d) * speed * 0.5;
  b.vel.z += (dz/d) * speed * 0.5;
  // Turn to face target
  const targetAngle = Math.atan2(dz, dx);
  let diff = targetAngle - b.facing;
  while (diff > Math.PI) diff -= Math.PI*2;
  while (diff < -Math.PI) diff += Math.PI*2;
  b.facing += diff * 0.1; // smooth turning
}

function swingSword(b: Bot, dir: number = 1) {
  if (b.atkCd > 0 || b.swinging || b.ragdollTimer > 0) return;
  b.swinging = true;
  b.swingDir = dir;
  b.swingTimer = 0.3;
  b.swordAngle = dir > 0 ? -1.5 : 1.5; // wind up
  b.atkCd = 0.5 + Math.random() * 0.2;
}

function heavySwing(b: Bot) {
  if (b.atkCd > 0 || b.swinging || b.specCd > 0 || b.ragdollTimer > 0) return;
  b.swinging = true;
  b.swingDir = 1;
  b.swingTimer = 0.45;
  b.swordAngle = -2.0;
  b.atkCd = 0.8;
  b.specCd = 1.5;
}

function dodge(b: Bot, awayX: number, awayZ: number) {
  if (b.dodgeCd > 0 || b.ragdollTimer > 0) return;
  const dx = b.pos.x - awayX, dz = b.pos.z - awayZ;
  const d = Math.sqrt(dx*dx + dz*dz) || 1;
  b.vel.x += (dx/d) * 8;
  b.vel.z += (dz/d) * 8;
  b.dodgeCd = 1.2;
}

function circleTarget(b: Bot, tc: V3, radius: number, speed: number, clockwise: number = 1) {
  const dx = b.pos.x - tc.x, dz = b.pos.z - tc.z;
  const d = Math.sqrt(dx*dx + dz*dz) || 1;
  // Tangent direction
  const tx = -dz/d * clockwise, tz = dx/d * clockwise;
  // Also move toward/away from target to maintain radius
  const radialForce = (d - radius) * 0.5;
  b.vel.x += (tx * speed + (dx/d) * (-radialForce)) * 0.3;
  b.vel.z += (tz * speed + (dz/d) * (-radialForce)) * 0.3;
  // Face target
  const targetAngle = Math.atan2(tc.z - b.pos.z, tc.x - b.pos.x);
  let diff = targetAngle - b.facing;
  while (diff > Math.PI) diff -= Math.PI*2;
  while (diff < -Math.PI) diff += Math.PI*2;
  b.facing += diff * 0.08;
}

function nearest(self: Bot, bots: Bot[]): Bot|null {
  let best: Bot|null = null, bd = Infinity;
  for (const b of bots) {
    if (b.id === self.id || !b.alive) continue;
    const d = dist3(self.pos, b.pos);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function weakest(self: Bot, bots: Bot[]): Bot|null {
  let best: Bot|null = null, bh = Infinity;
  for (const b of bots) {
    if (b.id === self.id || !b.alive) continue;
    if (b.hp < bh) { bh = b.hp; best = b; }
  }
  return best;
}

function runAI(b: Bot, s: GameState, dt: number) {
  if (!b.alive || b.stun > 0 || b.ragdollTimer > 0.3) return;

  const t = (b.style==='tact'||b.style==='assassin')
    ? (weakest(b, s.bots) || nearest(b, s.bots))
    : nearest(b, s.bots);
  if (!t) return;

  const d = dist3(b.pos, t.pos);
  const rm = 1 + b.rage/200;
  const swordRange = 2.0;

  switch (b.style) {
    case 'aggro':
      if (d > swordRange) walkTo(b, t.pos.x, t.pos.z, SPRINT_SPEED * rm);
      else {
        circleTarget(b, t.pos, 1.5, 2, Math.sin(s.t * 1.5 + b.id) > 0 ? 1 : -1);
        if (Math.random() < 0.06) swingSword(b, Math.random()>.5?1:-1);
        if (b.rage > 60 && Math.random() < 0.02) heavySwing(b);
      }
      b.rage = Math.min(100, b.rage + dt*6);
      break;
    case 'def':
      if (d < swordRange * 0.8) {
        circleTarget(b, t.pos, 2.0, 3, 1);
        if (d < 1.8 && Math.random() < 0.04) swingSword(b);
        if (t.swinging && Math.random() < 0.1) dodge(b, t.pos.x, t.pos.z);
      } else if (d > 4) walkTo(b, t.pos.x, t.pos.z, WALK_SPEED);
      else circleTarget(b, t.pos, 2.5, 2, -1);
      if (b.hp < 30 && Math.random() < 0.03) heavySwing(b);
      break;
    case 'zerk':
      walkTo(b, t.pos.x, t.pos.z, SPRINT_SPEED * rm * 1.2);
      if (d < swordRange) {
        if (Math.random() < 0.08 * rm) swingSword(b, Math.random()>.5?1:-1);
        if (Math.random() < 0.03 * rm) heavySwing(b);
      }
      b.rage = Math.min(100, b.rage + dt*(b.hp < 50 ? 20 : 10));
      break;
    case 'tact': {
      const threats = s.bots.filter(r => r.id!==b.id && r.alive && dist3(b.pos, r.pos) < 3);
      if (threats.length >= 2 && b.dodgeCd <= 0) {
        const ax = threats.reduce((s,r)=>s+r.pos.x,0)/threats.length;
        const az = threats.reduce((s,r)=>s+r.pos.z,0)/threats.length;
        dodge(b, ax, az); break;
      }
      if (d < swordRange) {
        circleTarget(b, t.pos, 1.8, 2.5, Math.sin(s.t + b.id*2) > 0 ? 1 : -1);
        if (t.stun > 0 || t.ragdollTimer > 0) { // Punish downed enemies
          swingSword(b); if (Math.random() < 0.05) heavySwing(b);
        } else if (Math.random() < 0.04) swingSword(b);
      } else walkTo(b, t.pos.x, t.pos.z, WALK_SPEED * 1.1);
      break;
    }
    case 'assassin':
      if (t.hp > 50 && d > 5) { walkTo(b, t.pos.x, t.pos.z, WALK_SPEED * 0.7); break; }
      if (d < swordRange) {
        if (Math.random() < 0.06) { heavySwing(b); } // go for kill
        else if (Math.random() < 0.05) swingSword(b);
        // Disengage after attack
        if (b.atkCd > 0.3 && b.dodgeCd <= 0) dodge(b, t.pos.x, t.pos.z);
      } else {
        walkTo(b, t.pos.x, t.pos.z, d < 4 ? SPRINT_SPEED : WALK_SPEED * 0.8);
      }
      break;
  }

  // Stay in arena
  const hd = Math.sqrt(b.pos.x*b.pos.x + b.pos.z*b.pos.z);
  if (hd > ARENA_R - 2) {
    b.vel.x -= b.pos.x/hd * 3 * dt;
    b.vel.z -= b.pos.z/hd * 3 * dt;
  }
}

// ═══════════════════════════════════════════════════════
// SWORD HIT DETECTION
// ═══════════════════════════════════════════════════════
function checkSwordHits(s: GameState) {
  for (const atk of s.bots) {
    if (!atk.alive || !atk.swinging) continue;
    for (const def of s.bots) {
      if (def.id === atk.id || !def.alive) continue;
      // Check sword tip against defender body
      const tipDist = dist3(atk.swordTipPos, {x: def.pos.x, y: 1.2, z: def.pos.z});
      // Also check sword line against defender
      const handDist = dist3(atk.joints[9], {x: def.pos.x, y: 1.2, z: def.pos.z});
      if (tipDist < 0.6 || handDist < 0.5) {
        applySwordHit(s, atk, def);
      }
    }
  }
  // Body separation
  for (let i = 0; i < s.bots.length; i++) {
    for (let j = i+1; j < s.bots.length; j++) {
      const a = s.bots[i], b = s.bots[j];
      if (!a.alive || !b.alive) continue;
      const d = dist3(a.pos, b.pos);
      if (d < 0.7 && d > 0) {
        const nx = (a.pos.x-b.pos.x)/d, nz = (a.pos.z-b.pos.z)/d;
        const p = (0.7-d)*3;
        a.vel.x += nx*p; a.vel.z += nz*p;
        b.vel.x -= nx*p; b.vel.z -= nz*p;
      }
    }
  }
}

function applySwordHit(s: GameState, atk: Bot, def: Bot) {
  // Prevent multi-hit per swing
  if (atk.swingTimer < 0.05) return;

  const isHeavy = atk.specCd > 1;
  let dmg = isHeavy ? 18 + Math.random()*8 : 8 + Math.random()*6;
  if (atk.rage > 50) dmg *= 1 + atk.rage/250;
  if (def.lastHit === atk.id) { atk.combo++; dmg *= 1 + atk.combo * 0.1; } else atk.combo = 1;
  dmg = Math.min(dmg, 35);

  def.hp -= dmg; def.lastHit = atk.id;
  atk.dmg += dmg; atk.rage = Math.min(100, atk.rage + dmg * 0.4);

  // Knockback
  const dx = def.pos.x - atk.pos.x, dz = def.pos.z - atk.pos.z;
  const d = Math.sqrt(dx*dx + dz*dz) || 1;
  const kb = isHeavy ? 6 : 3;
  def.vel.x += (dx/d) * kb;
  def.vel.z += (dz/d) * kb;

  // Ragdoll effect on hit
  if (dmg > 12 || isHeavy) {
    def.ragdollTimer = Math.min(1.5, 0.3 + dmg * 0.03);
    def.stun = def.ragdollTimer * 0.8;
    for (let i = 0; i < def.jointVel.length; i++) {
      def.jointVel[i].x += (dx/d) * kb * (0.5 + Math.random());
      def.jointVel[i].y += 2 + Math.random() * 3;
      def.jointVel[i].z += (dz/d) * kb * (0.5 + Math.random());
    }
  } else {
    def.stun = 0.15;
  }

  // Sparks at hit point
  const hx = (atk.swordTipPos.x + def.pos.x)/2;
  const hy = 1.2;
  const hz = (atk.swordTipPos.z + def.pos.z)/2;
  addSparks(s, hx, hy, hz, Math.min(8, 3 + (dmg*.3)|0), atk.color, 3);
  s.shakeIntensity += dmg * 0.012;

  // Stop multi-hit
  atk.swingTimer = 0;

  // Death
  if (def.hp <= 0) {
    def.hp = 0; def.alive = false; atk.kills++; atk.rage = 100;
    s.slow = 0.15;
    def.ragdollTimer = 5;
    for (let i = 0; i < def.jointVel.length; i++) {
      def.jointVel[i].x += (dx/d) * 10 * (0.5 + Math.random());
      def.jointVel[i].y += 3 + Math.random() * 5;
      def.jointVel[i].z += (dz/d) * 10 * (0.5 + Math.random());
    }
    addSparks(s, def.pos.x, 1, def.pos.z, 15, def.color, 5);
    addSparks(s, def.pos.x, 1, def.pos.z, 8, 0xff6600, 3);
    s.shakeIntensity += 0.3;
  }
}

function addSparks(s: GameState, x: number, y: number, z: number, n: number, color: number, spd: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random()*Math.PI*2, b = Math.random()*Math.PI*.8;
    const sp = Math.random()*spd + spd*.3;
    s.sparks.push({
      p: {x:x+(Math.random()-.5)*.2, y:y+Math.random()*.2, z:z+(Math.random()-.5)*.2},
      v: {x:Math.cos(a)*Math.cos(b)*sp, y:Math.sin(b)*sp+2, z:Math.sin(a)*Math.cos(b)*sp},
      life:.3+Math.random()*.4, ml:.3+Math.random()*.4, color, mesh:null,
    });
  }
}

// ═══════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════
function mkState(round: number): GameState {
  return { bots: Array.from({length:10},(_,i)=>mkBot(i)), sparks:[], t:0, over:false, winner:null, round, slow:1, winTimer:0, shakeIntensity:0 };
}

function updateState(s: GameState, dt: number): boolean {
  s.t += dt;
  if (s.slow < 1) s.slow = Math.min(1, s.slow + dt * 1.5);
  const adt = dt * s.slow;
  for (const b of s.bots) { updateMovement(b, adt); updateSkeleton(b, adt); }
  for (const b of s.bots) runAI(b, s, adt);
  checkSwordHits(s);

  for (let i = s.sparks.length-1; i>=0; i--) {
    const p = s.sparks[i];
    p.p.x += p.v.x*adt; p.p.y += p.v.y*adt; p.p.z += p.v.z*adt;
    p.v.y -= 10*adt; p.v.x *= .97; p.v.z *= .97; p.life -= adt;
    if (p.life <= 0) { if(p.mesh?.parent) p.mesh.parent.remove(p.mesh); s.sparks.splice(i,1); }
  }
  if (s.sparks.length > 200) {
    const ex = s.sparks.splice(0, s.sparks.length-200);
    for (const sp of ex) { if(sp.mesh?.parent) sp.mesh.parent.remove(sp.mesh); }
  }
  s.shakeIntensity *= .9; if (s.shakeIntensity < .001) s.shakeIntensity = 0;

  const alive = s.bots.filter(b=>b.alive);
  if (alive.length <= 1 && !s.over) {
    s.over = true; s.winner = alive[0]||null;
    if (s.winner) addSparks(s, s.winner.pos.x, 1.5, s.winner.pos.z, 25, s.winner.color, 6);
    return true;
  }
  return s.over;
}

// ═══════════════════════════════════════════════════════
// THREE.JS RENDERING
// ═══════════════════════════════════════════════════════
const _tmpV = new THREE.Vector3();
const _tmpQ = new THREE.Quaternion();
const _up = new THREE.Vector3(0,1,0);

function posLimb(mesh: THREE.Mesh, a: V3, b: V3, t: number) {
  mesh.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
  _tmpV.set(b.x-a.x,b.y-a.y,b.z-a.z);
  const l = _tmpV.length();
  if (l < 0.001) return;
  _tmpV.normalize();
  _tmpQ.setFromUnitVectors(_up, _tmpV);
  mesh.quaternion.copy(_tmpQ);
  mesh.scale.set(t, l, t);
}

const sphereGeo = new THREE.SphereGeometry(1,12,8);
const cylGeo = new THREE.CylinderGeometry(1,1,1,8,1);
const swordBlade = new THREE.BoxGeometry(0.03, 0.9, 0.08);
const swordGuard = new THREE.BoxGeometry(0.02, 0.04, 0.15);
const sparkGeo = new THREE.SphereGeometry(1,6,4);

function createBotMeshes(bot: Bot, scene: THREE.Group) {
  const mat = new THREE.MeshStandardMaterial({ color:bot.color, emissive:bot.color, emissiveIntensity:0.35, roughness:0.3, metalness:0.6 });
  const group = new THREE.Group();

  bot.limbMeshes = LIMBS.map(() => { const m = new THREE.Mesh(cylGeo,mat); m.castShadow=true; group.add(m); return m; });

  const head = new THREE.Mesh(sphereGeo, mat); head.castShadow=true; group.add(head); bot.headMesh = head;

  // Feet
  const fL = new THREE.Mesh(sphereGeo, mat); fL.castShadow=true; group.add(fL);
  const fR = new THREE.Mesh(sphereGeo, mat); fR.castShadow=true; group.add(fR);
  bot.footMeshes = [fL, fR];

  // Sword
  const swordMat = new THREE.MeshStandardMaterial({ color:0xccccdd, emissive:bot.color, emissiveIntensity:0.3, roughness:0.1, metalness:0.9 });
  const guardMat = new THREE.MeshStandardMaterial({ color:0x886622, roughness:0.4, metalness:0.7 });
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(swordBlade, swordMat); blade.position.y = 0.5; blade.castShadow=true;
  const guard = new THREE.Mesh(swordGuard, guardMat); guard.position.y = 0.04;
  sword.add(blade); sword.add(guard);
  group.add(sword);
  bot.swordMesh = sword as any;

  // Sword trail (thin plane that follows swing)
  const trailGeo = new THREE.PlaneGeometry(0.8, 0.05);
  const trailMat = new THREE.MeshBasicMaterial({ color:bot.color, transparent:true, opacity:0.5, side:THREE.DoubleSide });
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
    const [a,b,t] = LIMBS[i];
    posLimb(bot.limbMeshes[i], j[a], j[b], t);
  }

  if (bot.headMesh) { bot.headMesh.position.set(j[0].x,j[0].y,j[0].z); bot.headMesh.scale.setScalar(0.14); }
  if (bot.footMeshes[0]) { bot.footMeshes[0].position.set(j[12].x,j[12].y,j[12].z); bot.footMeshes[0].scale.setScalar(0.07); }
  if (bot.footMeshes[1]) { bot.footMeshes[1].position.set(j[15].x,j[15].y,j[15].z); bot.footMeshes[1].scale.setScalar(0.07); }

  // Sword position (attached to right hand, extending outward)
  if (bot.swordMesh) {
    const hand = j[9];
    bot.swordMesh.position.set(hand.x, hand.y, hand.z);
    // Orient sword: face forward along the attack direction
    const sa = bot.facing + bot.swordAngle;
    bot.swordMesh.rotation.set(0, -sa + Math.PI/2, bot.swordAngle * 0.3);
  }

  // Sword trail visibility
  if (bot.swordTrail) {
    bot.swordTrail.visible = bot.swinging;
    if (bot.swinging) {
      const hand = j[9];
      const tip = bot.swordTipPos;
      bot.swordTrail.position.set((hand.x+tip.x)/2, (hand.y+tip.y)/2, (hand.z+tip.z)/2);
      _tmpV.set(tip.x-hand.x, tip.y-hand.y, tip.z-hand.z);
      const l = _tmpV.length();
      bot.swordTrail.scale.set(l, 3, 1);
      bot.swordTrail.lookAt(tip.x, tip.y, tip.z);
      (bot.swordTrail.material as THREE.MeshBasicMaterial).opacity = bot.swingTimer / 0.3 * 0.6;
    }
  }

  // Dead visual
  if (!bot.alive) {
    bot.group.traverse(child => {
      const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m?.opacity !== undefined) { m.transparent = true; m.opacity = 0.25; m.emissiveIntensity = 0.05; }
    });
  }
}

function updateSparkMeshes(sparks: Spark[], scene: THREE.Group) {
  for (const sp of sparks) {
    if (!sp.mesh) {
      sp.mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({color:sp.color}));
      scene.add(sp.mesh);
    }
    sp.mesh.position.set(sp.p.x,sp.p.y,sp.p.z);
    const a = Math.max(0, sp.life/sp.ml);
    sp.mesh.scale.setScalar(0.04 * a * 2);
    (sp.mesh.material as THREE.MeshBasicMaterial).opacity = a;
    (sp.mesh.material as THREE.MeshBasicMaterial).transparent = true;
  }
}

// ═══════════════════════════════════════════════════════
// SCENE
// ═══════════════════════════════════════════════════════
function GameScene({ state, onUpdate }: { state: React.MutableRefObject<GameState>; onUpdate: (s:GameState)=>void }) {
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

  useFrame((_,rawDt) => {
    const dt = Math.min(rawDt, 1/30);
    const s = state.current;

    if (s.over) {
      s.winTimer += dt;
      // Still update dead ragdolls
      for (const b of s.bots) { updateMovement(b, dt); updateSkeleton(b, dt); }
      for (const b of s.bots) updateBotMeshes(b);
      updateSparkMeshes(s.sparks, sparkRef.current);
      if (s.winTimer >= 5) {
        while (groupRef.current.children.length) groupRef.current.remove(groupRef.current.children[0]);
        while (sparkRef.current.children.length) sparkRef.current.remove(sparkRef.current.children[0]);
        const ns = mkState(s.round+1);
        state.current = ns; init.current = false;
        for (const bot of ns.bots) createBotMeshes(bot, groupRef.current);
        init.current = true; onUpdate(ns);
        return;
      }
    } else {
      updateState(s, dt);
    }

    for (const b of s.bots) updateBotMeshes(b);
    updateSparkMeshes(s.sparks, sparkRef.current);

    // Camera
    const alive = s.bots.filter(b=>b.alive);
    let cx=0, cz=0;
    if (alive.length) { for (const b of alive) { cx+=b.pos.x; cz+=b.pos.z; } cx/=alive.length; cz/=alive.length; }
    camAngle.current += dt * 0.12;
    const cd = 9 + alive.length * 0.4;
    const ch = 5 + alive.length * 0.25;
    const shake = s.shakeIntensity;
    camera.position.lerp(
      _tmpV.set(
        cx + Math.cos(camAngle.current)*cd + (Math.random()-.5)*shake,
        ch + (Math.random()-.5)*shake,
        cz + Math.sin(camAngle.current)*cd + (Math.random()-.5)*shake
      ), 0.03
    );
    camera.lookAt(cx, 1.2, cz);

    if (Math.floor(s.t*10) % 3 === 0) onUpdate({...s});
  });

  return <><group ref={groupRef}/><group ref={sparkRef}/></>;
}

function Arena() {
  return <>
    <ambientLight intensity={0.18} color={0x334466}/>
    <directionalLight position={[10,15,5]} intensity={1.2} color={0xffeedd} castShadow
      shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-far={50} shadow-camera-left={-15} shadow-camera-right={15}
      shadow-camera-top={15} shadow-camera-bottom={-15}/>
    <pointLight position={[0,8,0]} intensity={2} color={0xff2244} distance={25}/>
    <pointLight position={[-8,5,-8]} intensity={1.2} color={0x4488ff} distance={20}/>
    <pointLight position={[8,5,8]} intensity={1.2} color={0x00ff88} distance={20}/>
    <spotLight position={[0,12,0]} angle={0.6} penumbra={0.5} intensity={1.5} color={0xffffff} castShadow/>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><circleGeometry args={[ARENA_R,64]}/><meshStandardMaterial color={0x111122} roughness={0.8} metalness={0.3}/></mesh>
    <gridHelper args={[ARENA_R*2,24,0x222244,0x181830]} position={[0,.01,0]}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.02,0]}><ringGeometry args={[ARENA_R-.15,ARENA_R,64]}/><meshStandardMaterial color={0xff2244} emissive={0xff2244} emissiveIntensity={0.8}/></mesh>
    <fog attach="fog" args={[0x080810,15,35]}/>
  </>;
}

// ═══════════════════════════════════════════════════════
// HUD
// ═══════════════════════════════════════════════════════
function HUD({ state }: { state: GameState }) {
  const alive = state.bots.filter(b=>b.alive).length;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{fontFamily:"'Orbitron',sans-serif"}}>
      <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-1">
        <div className="text-xs tracking-[.3em] text-foreground/40 font-display">ROUND {state.round}</div>
        <div className={`text-xs tracking-widest ${alive<=3?'text-primary':'text-foreground/30'}`}>{alive} FIGHTERS REMAINING</div>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex gap-1">
        {state.bots.map(b=>(
          <div key={b.id} className={`flex-1 relative h-7 rounded-sm overflow-hidden border ${b.alive?'border-border':'border-border/20'}`} style={{opacity:b.alive?1:0.3}}>
            <div className="absolute inset-0 bg-muted"/>
            {b.alive && <div className="absolute inset-y-0 left-0 transition-all duration-150" style={{width:`${b.hp}%`,backgroundColor:b.hex,opacity:0.7}}/>}
            <div className="absolute inset-0 flex items-center justify-between px-1">
              <span className="text-[6px] font-bold text-foreground/80 truncate">{b.name}</span>
              {b.kills>0 && <span className="text-[6px] text-accent font-bold">{b.kills}K</span>}
            </div>
          </div>
        ))}
      </div>
      {state.over && state.winner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 animate-in fade-in duration-500">
          <div className="text-5xl font-display tracking-widest mb-4 text-glow-red" style={{color:state.winner.hex}}>WINNER</div>
          <div className="text-3xl font-heading font-bold mb-6" style={{color:state.winner.glow}}>{state.winner.name}</div>
          <div className="text-sm text-foreground/50 mb-3">Kills: {state.winner.kills} &nbsp;|&nbsp; DMG: {Math.round(state.winner.dmg)} &nbsp;|&nbsp; HP: {Math.round(state.winner.hp)}</div>
          <div className="text-xs font-bold mb-8" style={{color:state.winner.hex+'cc'}}>{state.winner.style.toUpperCase()}</div>
          <div className="text-xs text-foreground/40 mb-2 tracking-widest">LEADERBOARD</div>
          <div className="flex flex-col gap-1 items-center">
            {[...state.bots].sort((a,b)=>b.kills-a.kills||b.dmg-a.dmg).slice(0,5).map((r,i)=>(
              <div key={r.id} className="text-[11px]" style={{color:r.id===state.winner!.id?state.winner!.hex:'#666'}}>
                {i+1}. {r.name} — {r.kills}K — {Math.round(r.dmg)} dmg
              </div>
            ))}
          </div>
          <div className="mt-8 text-sm text-foreground/30 animate-pulse">Next round in {Math.max(1,Math.ceil(5-state.winTimer))}...</div>
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
      <Canvas shadows camera={{position:[0,8,15],fov:50,near:0.1,far:100}}
        gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.2}}>
        <Arena/>
        <GameScene state={stateRef} onUpdate={setHudState}/>
      </Canvas>
      <HUD state={hudState}/>
    </div>
  );
};

export default RagdollArena;
