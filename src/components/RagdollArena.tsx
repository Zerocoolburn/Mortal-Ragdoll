import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════
const NAMES = ['BLAZE','VENOM','PHANTOM','TITAN','STORM','WRAITH','NOVA','FANG','REAPER','JINX'];
const COLORS = [0xff2244,0x00ff88,0x4488ff,0xffaa00,0xff00ff,0x00ffff,0xff6600,0x88ff00,0xff0088,0xaa44ff];
const HEX = ['#ff2244','#00ff88','#4488ff','#ffaa00','#ff00ff','#00ffff','#ff6600','#88ff00','#ff0088','#aa44ff'];
const GLOWS = ['#ff6688','#66ffbb','#88bbff','#ffcc55','#ff66ff','#66ffff','#ff9944','#bbff55','#ff55aa','#cc88ff'];
type Style = 'aggro'|'def'|'zerk'|'tact'|'assassin';
const STYLES: Style[] = ['aggro','def','zerk','tact','assassin','aggro','zerk','tact','assassin','def'];
const GROUND = 0;
const GRAVITY = -15;
const ARENA_R = 12;

interface V3 { x: number; y: number; z: number }
interface Joint3 { p: V3; pp: V3; v: V3; r: number; m: number }
interface Con3 { a: number; b: number; len: number; s: number }

// Limb definitions for rendering: [jointA, jointB, thickness]
const LIMBS: [number,number,number][] = [
  [0,1,.12],[1,2,.14],[2,3,.13], // spine
  [1,4,.1],[4,5,.08],[5,6,.07], // L arm
  [1,7,.1],[7,8,.08],[8,9,.07], // R arm
  [3,10,.11],[10,11,.09],[11,12,.08], // L leg
  [3,13,.11],[13,14,.09],[14,15,.08], // R leg
];

interface Bot3 {
  id: number; name: string; joints: Joint3[]; cons: Con3[];
  color: number; hex: string; glow: string; style: Style;
  hp: number; alive: boolean; stun: number; atkCd: number;
  dodgeCd: number; specCd: number; kills: number; dmg: number;
  rage: number; combo: number; lastHit: number;
  group: THREE.Group | null; // mesh group ref
  limbMeshes: THREE.Mesh[]; jointMeshes: THREE.Mesh[];
  headMesh: THREE.Mesh | null; fistGlowL: THREE.Mesh | null; fistGlowR: THREE.Mesh | null;
}

interface Spark { p: V3; v: V3; life: number; ml: number; color: number; sz: number; mesh: THREE.Mesh | null }

interface GameState {
  bots: Bot3[]; sparks: Spark[]; t: number; over: boolean;
  winner: Bot3|null; round: number; slow: number; winTimer: number;
  shakeIntensity: number;
}

// ═══════════════════════════════════════════════════════
// 3D MATH
// ═══════════════════════════════════════════════════════
const v3 = (x=0,y=0,z=0): V3 => ({x,y,z});
const add3 = (a: V3, b: V3): V3 => ({x:a.x+b.x, y:a.y+b.y, z:a.z+b.z});
const sub3 = (a: V3, b: V3): V3 => ({x:a.x-b.x, y:a.y-b.y, z:a.z-b.z});
const scale3 = (a: V3, s: number): V3 => ({x:a.x*s, y:a.y*s, z:a.z*s});
const len3 = (a: V3) => Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z);
const dist3 = (a: V3, b: V3) => len3(sub3(a,b));
const norm3 = (a: V3): V3 => { const l = len3(a)||1; return {x:a.x/l,y:a.y/l,z:a.z/l}; };

// ═══════════════════════════════════════════════════════
// RAGDOLL CREATION
// ═══════════════════════════════════════════════════════
function mkJoint3(x: number, y: number, z: number, r: number, m: number): Joint3 {
  return { p: v3(x,y,z), pp: v3(x,y,z), v: v3(), r, m };
}

function mkBot3(i: number): Bot3 {
  const angle = (i / 10) * Math.PI * 2;
  const spawnR = 6 + Math.random() * 3;
  const bx = Math.cos(angle) * spawnR;
  const bz = Math.sin(angle) * spawnR;
  const j = (ox: number, oy: number, oz: number, r: number, m: number) =>
    mkJoint3(bx+ox, oy, bz+oz, r, m);

  const joints: Joint3[] = [
    j(0, 2.0, 0, .14, 3),    // 0 head
    j(0, 1.75, 0, .06, 2),   // 1 neck
    j(0, 1.45, 0, .1, 4),    // 2 chest
    j(0, 1.1, 0, .1, 4),     // 3 hip
    j(-.25, 1.65, 0, .06, 1.5), // 4 L shoulder
    j(-.5, 1.4, 0, .05, 1),   // 5 L elbow
    j(-.65, 1.15, 0, .06, 1.5), // 6 L hand
    j(.25, 1.65, 0, .06, 1.5),  // 7 R shoulder
    j(.5, 1.4, 0, .05, 1),    // 8 R elbow
    j(.65, 1.15, 0, .06, 1.5),  // 9 R hand
    j(-.12, 1.0, 0, .06, 2),  // 10 L hip
    j(-.14, .55, 0, .05, 1.5), // 11 L knee
    j(-.15, .08, 0, .07, 2),  // 12 L foot
    j(.12, 1.0, 0, .06, 2),   // 13 R hip
    j(.14, .55, 0, .05, 1.5),  // 14 R knee
    j(.15, .08, 0, .07, 2),   // 15 R foot
  ];

  const c = (a: number, b: number, s=.85): Con3 => ({a, b, len: dist3(joints[a].p, joints[b].p), s});
  const cons: Con3[] = [
    c(0,1,.95), c(1,2,.9), c(2,3,.9),
    c(1,4,.85), c(4,5,.8), c(5,6,.8),
    c(1,7,.85), c(7,8,.8), c(8,9,.8),
    c(3,10,.85), c(10,11,.8), c(11,12,.8),
    c(3,13,.85), c(13,14,.8), c(14,15,.8),
    c(0,2,.5), c(4,7,.4), c(10,13,.4), c(2,10,.3), c(2,13,.3),
  ];

  return {
    id: i, name: NAMES[i], joints, cons,
    color: COLORS[i], hex: HEX[i], glow: GLOWS[i], style: STYLES[i],
    hp: 100, alive: true, stun: 0, atkCd: 0, dodgeCd: 0, specCd: 0,
    kills: 0, dmg: 0, rage: 0, combo: 0, lastHit: -1,
    group: null, limbMeshes: [], jointMeshes: [], headMesh: null,
    fistGlowL: null, fistGlowR: null,
  };
}

function center3(b: Bot3): V3 {
  let cx=0,cy=0,cz=0;
  for (const j of b.joints) { cx+=j.p.x; cy+=j.p.y; cz+=j.p.z; }
  const n = b.joints.length;
  return {x:cx/n, y:cy/n, z:cz/n};
}

function pushAll3(b: Bot3, fx: number, fy: number, fz: number) {
  for (const j of b.joints) { j.v.x+=fx/j.m; j.v.y+=fy/j.m; j.v.z+=fz/j.m; }
}

function pushJoint3(b: Bot3, i: number, fx: number, fy: number, fz: number) {
  const j = b.joints[i]; j.v.x+=fx/j.m; j.v.y+=fy/j.m; j.v.z+=fz/j.m;
}

// ═══════════════════════════════════════════════════════
// PHYSICS
// ═══════════════════════════════════════════════════════
function stepPhysics3(b: Bot3, dt: number) {
  for (const j of b.joints) {
    j.v.y += GRAVITY * dt;
    const onG = j.p.y <= j.r + GROUND;
    const f = onG ? 0.92 : 0.998;
    j.v.x *= f; j.v.y *= (onG ? 0.92 : 0.999); j.v.z *= f;
    j.pp = {...j.p};
    j.p.x += j.v.x * dt;
    j.p.y += j.v.y * dt;
    j.p.z += j.v.z * dt;
    // Ground
    if (j.p.y < j.r + GROUND) { j.p.y = j.r + GROUND; j.v.y *= -0.3; j.v.x *= 0.9; j.v.z *= 0.9; }
    // Arena boundary (circular)
    const hDist = Math.sqrt(j.p.x*j.p.x + j.p.z*j.p.z);
    if (hDist > ARENA_R) {
      const n = {x: j.p.x/hDist, y: 0, z: j.p.z/hDist};
      j.p.x = n.x * ARENA_R; j.p.z = n.z * ARENA_R;
      const dot = j.v.x*n.x + j.v.z*n.z;
      j.v.x -= 2*dot*n.x; j.v.z -= 2*dot*n.z;
      j.v.x *= 0.5; j.v.z *= 0.5;
    }
    // Ceiling
    if (j.p.y > 8) { j.p.y = 8; j.v.y *= -0.3; }
  }
  // Constraints
  for (let iter = 0; iter < 4; iter++) {
    for (const c of b.cons) {
      const a = b.joints[c.a], bb = b.joints[c.b];
      const d = sub3(bb.p, a.p);
      const dl = len3(d) || .001;
      const diff = (dl - c.len) / dl;
      const tm = a.m + bb.m;
      const ma = c.s * diff * (a.m / tm);
      const mb = c.s * diff * (bb.m / tm);
      a.p.x += d.x*ma; a.p.y += d.y*ma; a.p.z += d.z*ma;
      bb.p.x -= d.x*mb; bb.p.y -= d.y*mb; bb.p.z -= d.z*mb;
    }
  }
}

// ═══════════════════════════════════════════════════════
// AI
// ═══════════════════════════════════════════════════════
function nearest3(self: Bot3, bots: Bot3[]): Bot3|null {
  let best: Bot3|null = null, bd = Infinity;
  const sc = center3(self);
  for (const b of bots) {
    if (b.id === self.id || !b.alive) continue;
    const d = dist3(sc, center3(b));
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function weakest3(self: Bot3, bots: Bot3[]): Bot3|null {
  let best: Bot3|null = null, bh = Infinity;
  for (const b of bots) {
    if (b.id === self.id || !b.alive) continue;
    if (b.hp < bh) { bh = b.hp; best = b; }
  }
  return best;
}

function moveTo3(b: Bot3, tx: number, tz: number, spd: number) {
  const c = center3(b);
  const dx = tx - c.x, dz = tz - c.z;
  const d = Math.sqrt(dx*dx + dz*dz) || 1;
  const nx = dx/d, nz = dz/d;
  pushJoint3(b, 12, nx*spd, 0, nz*spd);
  pushJoint3(b, 15, nx*spd, 0, nz*spd);
  pushJoint3(b, 3, nx*spd*.5, 0, nz*spd*.5);
}

function jump3(b: Bot3, pow=5) {
  if (b.joints.some(j => j.p.y <= j.r + GROUND + 0.05)) pushAll3(b, 0, pow, 0);
}

function punch3(a: Bot3, t: Bot3, pow: number) {
  if (a.atkCd > 0) return;
  const tc = center3(t), sc = center3(a);
  const d = norm3(sub3(tc, sc));
  const fi = Math.random() > .5 ? 6 : 9;
  pushJoint3(a, fi, d.x*pow*3, pow*1.5 + 1, d.z*pow*3);
  a.atkCd = .25 + Math.random()*.15;
}

function kick3(a: Bot3, t: Bot3, pow: number) {
  if (a.atkCd > 0) return;
  const tc = center3(t), sc = center3(a);
  const d = norm3(sub3(tc, sc));
  const fi = Math.random() > .5 ? 12 : 15;
  pushJoint3(a, fi, d.x*pow*4, pow + 1, d.z*pow*4);
  a.atkCd = .35 + Math.random()*.15;
}

function dodge3(b: Bot3, awayX: number, awayZ: number) {
  if (b.dodgeCd > 0) return;
  const c = center3(b);
  const dx = c.x - awayX, dz = c.z - awayZ;
  const d = Math.sqrt(dx*dx + dz*dz) || 1;
  pushAll3(b, (dx/d)*4, 2, (dz/d)*4);
  b.dodgeCd = .8;
}

function special3(a: Bot3, t: Bot3, type: number) {
  if (a.atkCd > 0 || a.specCd > 0) return;
  const tc = center3(t), sc = center3(a);
  const d = norm3(sub3(tc, sc));
  if (type === 0) { // uppercut
    pushJoint3(a, 6, d.x*5, 10, d.z*5);
    pushJoint3(a, 9, d.x*5, 10, d.z*5);
    a.atkCd = .5; a.specCd = 1.2;
  } else if (type === 1) { // spin kick
    pushJoint3(a, 12, d.x*8, 2, d.z*8);
    pushJoint3(a, 15, -d.z*8, 2, d.x*8);
    pushAll3(a, d.x*2, 1, d.z*2);
    a.atkCd = .4; a.specCd = 1;
  } else { // flying slam
    jump3(a, 7);
    pushAll3(a, d.x*6, 0, d.z*6);
    a.atkCd = .6; a.specCd = 1.5;
  }
}

function runAI3(b: Bot3, s: GameState, dt: number) {
  if (!b.alive || b.stun > 0) { b.stun = Math.max(0, b.stun - dt); return; }
  b.atkCd = Math.max(0, b.atkCd - dt);
  b.dodgeCd = Math.max(0, b.dodgeCd - dt);
  b.specCd = Math.max(0, b.specCd - dt);

  const bc = center3(b);
  const t = (b.style==='tact'||b.style==='assassin') ? (weakest3(b, s.bots) || nearest3(b, s.bots)) : nearest3(b, s.bots);
  if (!t) return;
  const tc = center3(t), d = dist3(bc, tc);
  const rm = 1 + b.rage/150;

  switch (b.style) {
    case 'aggro':
      moveTo3(b, tc.x, tc.z, .6*rm);
      if (d < 1.8) { Math.random()<.5 ? punch3(b,t,1.5) : kick3(b,t,1.8); if (b.rage>50) special3(b,t,0); }
      else if (d < 3 && Math.random()<.02) jump3(b,4);
      b.rage = Math.min(100, b.rage + dt*8);
      break;
    case 'def':
      if (d < 2) { Math.random()<.6 ? punch3(b,t,1.2) : kick3(b,t,1.5); if (Math.random()<.08) dodge3(b,tc.x,tc.z); }
      else if (d > 4) moveTo3(b, tc.x, tc.z, .35);
      if (b.hp < 30 && b.specCd <= 0 && d < 2) special3(b,t,1);
      break;
    case 'zerk':
      moveTo3(b, tc.x, tc.z, .8*rm);
      if (d < 2.2) {
        const r = Math.random();
        if (r<.35) punch3(b,t,2*rm); else if (r<.65) kick3(b,t,2.2*rm); else special3(b,t,2);
        if (Math.random()<.1) jump3(b,5);
      }
      b.rage = Math.min(100, b.rage + dt*(b.hp<50 ? 25 : 12));
      break;
    case 'tact': {
      const threats = s.bots.filter(r => r.id!==b.id && r.alive && dist3(bc, center3(r)) < 3);
      if (threats.length >= 2 && b.dodgeCd <= 0) {
        const ax = threats.reduce((s,r)=>s+center3(r).x,0)/threats.length;
        const az = threats.reduce((s,r)=>s+center3(r).z,0)/threats.length;
        dodge3(b, ax, az); break;
      }
      if (d < 2) {
        if (t.stun > 0) { punch3(b,t,2); kick3(b,t,2); }
        else Math.random()<.4 ? punch3(b,t,1.3) : kick3(b,t,1.3);
        if (b.specCd<=0 && t.hp<25) special3(b,t,0);
      } else moveTo3(b, tc.x, tc.z, .5);
      break;
    }
    case 'assassin':
      if (t.hp > 50 && d > 4) { moveTo3(b, tc.x, tc.z, .25); break; }
      if (d < 1.6) {
        if (b.specCd<=0) { special3(b,t,1); punch3(b,t,2); }
        else punch3(b,t,1.5);
        if (b.atkCd > .2) dodge3(b, tc.x, tc.z);
      } else if (d < 3.5) { moveTo3(b, tc.x, tc.z, .7); if (Math.random()<.03) jump3(b,4); }
      else moveTo3(b, tc.x, tc.z, .4);
      break;
  }
  // Stay in arena
  const hd = Math.sqrt(bc.x*bc.x + bc.z*bc.z);
  if (hd > ARENA_R - 2) {
    pushAll3(b, -bc.x/hd*1.5, 0, -bc.z/hd*1.5);
  }
}

// ═══════════════════════════════════════════════════════
// HIT DETECTION
// ═══════════════════════════════════════════════════════
function checkHits3(s: GameState) {
  const atkIdx = [6,9,12,15];
  for (let i = 0; i < s.bots.length; i++) {
    for (let j = i+1; j < s.bots.length; j++) {
      const a = s.bots[i], b = s.bots[j];
      if (!a.alive || !b.alive) continue;
      const ca = center3(a), cb = center3(b), d = dist3(ca, cb);
      if (d < .8 && d > 0) {
        const n = norm3(sub3(ca, cb));
        const p = (.8 - d) * 2;
        pushAll3(a, n.x*p, n.y*p, n.z*p);
        pushAll3(b, -n.x*p, -n.y*p, -n.z*p);
      }
      tryHit3(s, a, b, atkIdx);
      tryHit3(s, b, a, atkIdx);
    }
  }
}

function tryHit3(s: GameState, atk: Bot3, def: Bot3, atkIdx: number[]) {
  for (const ai of atkIdx) {
    const aj = atk.joints[ai];
    const spd = len3(aj.v);
    if (spd < 3 || atk.atkCd > .3) continue;
    for (let bi = 0; bi < def.joints.length; bi++) {
      const bj = def.joints[bi];
      const d = dist3(aj.p, bj.p);
      if (d < aj.r + bj.r + .08) {
        applyHit3(s, atk, def, ai, bi, spd);
        return;
      }
    }
  }
}

function applyHit3(s: GameState, atk: Bot3, def: Bot3, ai: number, bi: number, spd: number) {
  const isFist = ai===6||ai===9, isFoot = ai===12||ai===15, isHead = bi===0;
  let dmg = spd * 0.8;
  if (isFist) dmg *= 1.3; if (isFoot) dmg *= 1.5; if (isHead) dmg *= 1.8;
  if (atk.rage > 50) dmg *= 1 + atk.rage/200;
  if (def.lastHit === atk.id) { atk.combo++; dmg *= 1 + atk.combo*.12; } else atk.combo = 1;
  dmg = Math.min(dmg, 30);

  def.hp -= dmg; def.lastHit = atk.id;
  def.stun = Math.min(.4, .1 + dmg*.01);
  atk.dmg += dmg; atk.rage = Math.min(100, atk.rage + dmg*.5);

  const aj = atk.joints[ai], bj = def.joints[bi];
  const d = norm3(sub3(bj.p, aj.p));
  const kb = 1.5 + dmg * .1;
  pushAll3(def, d.x*kb*spd*.3, kb*spd*.15 + 1, d.z*kb*spd*.3);

  // Sparks
  const hx = (aj.p.x+bj.p.x)/2, hy = (aj.p.y+bj.p.y)/2, hz = (aj.p.z+bj.p.z)/2;
  addSparks(s, hx, hy, hz, Math.min(6, 2+(dmg*.2)|0), atk.color, 3);

  s.shakeIntensity += dmg * .015;

  if (def.hp <= 0) {
    def.hp = 0; def.alive = false; atk.kills++; atk.rage = 100;
    s.slow = 0.15;
    const dc = center3(def);
    addSparks(s, dc.x, dc.y, dc.z, 15, def.color, 5);
    addSparks(s, dc.x, dc.y, dc.z, 8, 0xff6600, 3);
    s.shakeIntensity += .3;
  }
}

function addSparks(s: GameState, x: number, y: number, z: number, n: number, color: number, spd: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random()*Math.PI*2, b = Math.random()*Math.PI - Math.PI/2;
    const sp = Math.random()*spd + spd*.3;
    s.sparks.push({
      p: {x: x+(Math.random()-.5)*.2, y: y+(Math.random()-.5)*.2, z: z+(Math.random()-.5)*.2},
      v: {x: Math.cos(a)*Math.cos(b)*sp, y: Math.sin(b)*sp + 2, z: Math.sin(a)*Math.cos(b)*sp},
      life: .3+Math.random()*.4, ml: .3+Math.random()*.4, color, sz: .02+Math.random()*.04,
      mesh: null,
    });
  }
}

// ═══════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════
function mkState3(round: number): GameState {
  return {
    bots: Array.from({length:10},(_,i)=>mkBot3(i)),
    sparks: [], t: 0, over: false, winner: null,
    round, slow: 1, winTimer: 0, shakeIntensity: 0,
  };
}

function updateState3(s: GameState, dt: number): boolean {
  s.t += dt;
  if (s.slow < 1) s.slow = Math.min(1, s.slow + dt * 1.5);
  const adt = dt * s.slow;

  for (const b of s.bots) { if (b.alive) stepPhysics3(b, adt); }
  for (const b of s.bots) { if (b.alive) runAI3(b, s, adt); }
  checkHits3(s);

  // Sparks
  for (let i = s.sparks.length-1; i >= 0; i--) {
    const p = s.sparks[i];
    p.p.x += p.v.x*adt; p.p.y += p.v.y*adt; p.p.z += p.v.z*adt;
    p.v.y -= 10*adt; p.v.x *= .97; p.v.z *= .97;
    p.life -= adt;
    if (p.life <= 0) {
      if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
      s.sparks.splice(i, 1);
    }
  }
  if (s.sparks.length > 200) {
    const excess = s.sparks.splice(0, s.sparks.length - 200);
    for (const sp of excess) { if (sp.mesh && sp.mesh.parent) sp.mesh.parent.remove(sp.mesh); }
  }

  s.shakeIntensity *= .9;
  if (s.shakeIntensity < .001) s.shakeIntensity = 0;

  const alive = s.bots.filter(b => b.alive);
  if (alive.length <= 1 && !s.over) {
    s.over = true; s.winner = alive[0] || null;
    if (s.winner) { const c = center3(s.winner); addSparks(s, c.x, c.y, c.z, 25, s.winner.color, 6); }
    return true;
  }
  return s.over;
}

// ═══════════════════════════════════════════════════════
// THREE.JS SCENE COMPONENT
// ═══════════════════════════════════════════════════════
const _tmpV = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();
const _tmpQ = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

function positionLimb(mesh: THREE.Mesh, a: V3, b: V3, thickness: number) {
  _tmpV.set((a.x+b.x)/2, (a.y+b.y)/2, (a.z+b.z)/2);
  mesh.position.copy(_tmpV);
  _tmpV.set(b.x-a.x, b.y-a.y, b.z-a.z);
  const l = _tmpV.length();
  _tmpV.normalize();
  _tmpQ.setFromUnitVectors(_up, _tmpV);
  mesh.quaternion.copy(_tmpQ);
  mesh.scale.set(thickness, l, thickness);
}

// Shared geometries
const sphereGeo = new THREE.SphereGeometry(1, 12, 8);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
const sparkGeo = new THREE.SphereGeometry(1, 6, 4);

function createBotMeshes(bot: Bot3, scene: THREE.Group) {
  const mat = new THREE.MeshStandardMaterial({
    color: bot.color,
    emissive: bot.color,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.6,
  });
  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0x333333, emissive: 0x222222, emissiveIntensity: 0.1,
    roughness: 0.8, metalness: 0.2, transparent: true, opacity: 0.3,
  });

  const group = new THREE.Group();
  group.name = `bot_${bot.id}`;

  // Limbs
  bot.limbMeshes = [];
  for (const [_a, _b, _t] of LIMBS) {
    const mesh = new THREE.Mesh(cylGeo, mat);
    mesh.castShadow = true;
    group.add(mesh);
    bot.limbMeshes.push(mesh);
  }

  // Head
  const head = new THREE.Mesh(sphereGeo, mat);
  head.castShadow = true;
  group.add(head);
  bot.headMesh = head;

  // Fist glows
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: bot.color, emissiveIntensity: 1.2,
    roughness: 0, metalness: 1,
  });
  const fistL = new THREE.Mesh(sphereGeo, glowMat);
  const fistR = new THREE.Mesh(sphereGeo, glowMat);
  group.add(fistL); group.add(fistR);
  bot.fistGlowL = fistL; bot.fistGlowR = fistR;

  // Feet
  const footL = new THREE.Mesh(sphereGeo, mat);
  const footR = new THREE.Mesh(sphereGeo, mat);
  footL.castShadow = true; footR.castShadow = true;
  group.add(footL); group.add(footR);
  bot.jointMeshes = [footL, footR];

  scene.add(group);
  bot.group = group;
}

function updateBotMeshes(bot: Bot3) {
  if (!bot.group) return;
  const j = bot.joints;

  // Limbs
  for (let i = 0; i < LIMBS.length; i++) {
    const [a, b, t] = LIMBS[i];
    positionLimb(bot.limbMeshes[i], j[a].p, j[b].p, t);
  }

  // Head
  if (bot.headMesh) {
    bot.headMesh.position.set(j[0].p.x, j[0].p.y, j[0].p.z);
    bot.headMesh.scale.setScalar(j[0].r);
  }

  // Fists
  if (bot.fistGlowL) {
    bot.fistGlowL.position.set(j[6].p.x, j[6].p.y, j[6].p.z);
    bot.fistGlowL.scale.setScalar(j[6].r * 1.5);
  }
  if (bot.fistGlowR) {
    bot.fistGlowR.position.set(j[9].p.x, j[9].p.y, j[9].p.z);
    bot.fistGlowR.scale.setScalar(j[9].r * 1.5);
  }

  // Feet
  if (bot.jointMeshes[0]) {
    bot.jointMeshes[0].position.set(j[12].p.x, j[12].p.y, j[12].p.z);
    bot.jointMeshes[0].scale.setScalar(j[12].r);
  }
  if (bot.jointMeshes[1]) {
    bot.jointMeshes[1].position.set(j[15].p.x, j[15].p.y, j[15].p.z);
    bot.jointMeshes[1].scale.setScalar(j[15].r);
  }

  // Alive/dead visual
  if (!bot.alive && bot.group.visible) {
    bot.group.traverse(child => {
      if ((child as THREE.Mesh).material) {
        const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.transparent = true; m.opacity = 0.2; m.emissiveIntensity = 0.05;
      }
    });
  }
}

// Spark mesh pooling
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
function updateSparkMeshes(sparks: Spark[], scene: THREE.Group) {
  for (const sp of sparks) {
    if (!sp.mesh) {
      const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: sp.color }));
      scene.add(m);
      sp.mesh = m;
    }
    sp.mesh.position.set(sp.p.x, sp.p.y, sp.p.z);
    const a = Math.max(0, sp.life / sp.ml);
    sp.mesh.scale.setScalar(sp.sz * a * 2);
    (sp.mesh.material as THREE.MeshBasicMaterial).opacity = a;
    (sp.mesh.material as THREE.MeshBasicMaterial).transparent = true;
  }
}

// ─── Main scene component ───
function GameScene({ state, onStateChange }: { state: React.MutableRefObject<GameState>; onStateChange: (s: GameState) => void }) {
  const { camera, scene } = useThree();
  const groupRef = useRef<THREE.Group>(null!);
  const sparkGroupRef = useRef<THREE.Group>(null!);
  const initialized = useRef(false);
  const camAngle = useRef(0);

  useEffect(() => {
    if (initialized.current || !groupRef.current) return;
    initialized.current = true;
    for (const bot of state.current.bots) {
      createBotMeshes(bot, groupRef.current);
    }
  }, []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1/30); // cap delta
    const s = state.current;

    if (s.over) {
      s.winTimer += delta;
      if (s.winTimer >= 5) {
        // Cleanup
        if (groupRef.current) {
          while (groupRef.current.children.length) groupRef.current.remove(groupRef.current.children[0]);
        }
        if (sparkGroupRef.current) {
          while (sparkGroupRef.current.children.length) sparkGroupRef.current.remove(sparkGroupRef.current.children[0]);
        }
        const newState = mkState3(s.round + 1);
        state.current = newState;
        initialized.current = false;
        for (const bot of newState.bots) {
          createBotMeshes(bot, groupRef.current);
        }
        initialized.current = true;
        onStateChange(newState);
        return;
      }
    } else {
      updateState3(s, delta);
    }

    // Update meshes
    for (const bot of s.bots) updateBotMeshes(bot);
    updateSparkMeshes(s.sparks, sparkGroupRef.current);

    // Camera - orbit around the action center, track fights
    const aliveC = s.bots.filter(b => b.alive);
    let cx = 0, cy = 1.5, cz = 0;
    if (aliveC.length > 0) {
      for (const b of aliveC) { const c = center3(b); cx += c.x; cy += c.y; cz += c.z; }
      cx /= aliveC.length; cy /= aliveC.length; cz /= aliveC.length;
    }
    camAngle.current += delta * 0.15;
    const camDist = 10 + aliveC.length * 0.5;
    const camH = 6 + aliveC.length * 0.3;
    const tx = cx + Math.cos(camAngle.current) * camDist;
    const tz = cz + Math.sin(camAngle.current) * camDist;

    // Shake
    const shake = s.shakeIntensity;
    camera.position.lerp(
      _tmpV.set(tx + (Math.random()-.5)*shake, camH + (Math.random()-.5)*shake, tz + (Math.random()-.5)*shake),
      0.03
    );
    camera.lookAt(cx, cy * 0.8, cz);

    // Trigger re-render for HUD
    if (s.t % 10 < delta * 60) onStateChange({...s});
  });

  return (
    <>
      <group ref={groupRef} />
      <group ref={sparkGroupRef} />
    </>
  );
}

// ─── Arena environment ───
function Arena() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} color={0x334466} />
      <directionalLight position={[10, 15, 5]} intensity={1} color={0xffeedd} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-far={50} shadow-camera-left={-15} shadow-camera-right={15}
        shadow-camera-top={15} shadow-camera-bottom={-15}
      />
      <pointLight position={[0, 8, 0]} intensity={2} color={0xff2244} distance={25} />
      <pointLight position={[-8, 5, -8]} intensity={1} color={0x4488ff} distance={20} />
      <pointLight position={[8, 5, 8]} intensity={1} color={0x00ff88} distance={20} />

      {/* Ground */}
      <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <circleGeometry args={[ARENA_R, 64]} />
        <meshStandardMaterial color={0x111122} roughness={0.8} metalness={0.3} />
      </mesh>

      {/* Grid on ground */}
      <gridHelper args={[ARENA_R*2, 24, 0x222244, 0x181830]} position={[0, 0.01, 0]} />

      {/* Arena edge ring */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[ARENA_R - .15, ARENA_R, 64]} />
        <meshStandardMaterial color={0xff2244} emissive={0xff2244} emissiveIntensity={0.8} />
      </mesh>

      {/* Fog / atmosphere */}
      <fog attach="fog" args={[0x080810, 15, 35]} />
    </>
  );
}

// ═══════════════════════════════════════════════════════
// HUD OVERLAY
// ═══════════════════════════════════════════════════════
function HUD({ state }: { state: GameState }) {
  const alive = state.bots.filter(b => b.alive).length;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ fontFamily: "'Orbitron', sans-serif" }}>
      {/* Top bar */}
      <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-1">
        <div className="text-xs tracking-[.3em] text-foreground/40 font-display">ROUND {state.round}</div>
        <div className={`text-xs tracking-widest ${alive <= 3 ? 'text-primary' : 'text-foreground/30'}`}>
          {alive} FIGHTERS REMAINING
        </div>
      </div>

      {/* Bottom fighter strip */}
      <div className="absolute bottom-3 left-3 right-3 flex gap-1">
        {state.bots.map(b => (
          <div key={b.id} className={`flex-1 relative h-7 rounded-sm overflow-hidden border ${b.alive ? 'border-border' : 'border-border/20'}`}
               style={{ opacity: b.alive ? 1 : 0.3 }}>
            <div className="absolute inset-0 bg-muted" />
            {b.alive && (
              <div className="absolute inset-y-0 left-0 transition-all duration-150"
                   style={{ width: `${b.hp}%`, backgroundColor: b.hex, opacity: 0.7 }} />
            )}
            <div className="absolute inset-0 flex items-center justify-between px-1">
              <span className="text-[6px] font-bold text-foreground/80 truncate">{b.name}</span>
              {b.kills > 0 && <span className="text-[6px] text-accent font-bold">{b.kills}K</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Winner overlay */}
      {state.over && state.winner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 animate-in fade-in duration-500">
          <div className="text-5xl font-display tracking-widest mb-4 text-glow-red" style={{ color: state.winner.hex }}>
            WINNER
          </div>
          <div className="text-3xl font-heading font-bold mb-6" style={{ color: state.winner.glow }}>
            {state.winner.name}
          </div>
          <div className="text-sm text-foreground/50 mb-3">
            Kills: {state.winner.kills} &nbsp;|&nbsp; DMG: {Math.round(state.winner.dmg)} &nbsp;|&nbsp; HP: {Math.round(state.winner.hp)}
          </div>
          <div className="text-xs font-bold mb-8" style={{ color: state.winner.hex + 'cc' }}>
            {state.winner.style.toUpperCase()}
          </div>

          {/* Leaderboard */}
          <div className="text-xs text-foreground/40 mb-2 tracking-widest">LEADERBOARD</div>
          <div className="flex flex-col gap-1 items-center">
            {[...state.bots].sort((a,b) => b.kills - a.kills || b.dmg - a.dmg).slice(0,5).map((r, i) => (
              <div key={r.id} className="text-[11px]"
                   style={{ color: r.id === state.winner!.id ? state.winner!.hex : '#666' }}>
                {i+1}. {r.name} — {r.kills}K — {Math.round(r.dmg)} dmg
              </div>
            ))}
          </div>

          <div className="mt-8 text-sm text-foreground/30 animate-pulse">
            Next round in {Math.max(1, Math.ceil(5 - state.winTimer))}...
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
  const stateRef = useRef<GameState>(mkState3(1));
  const [hudState, setHudState] = useState<GameState>(stateRef.current);

  const handleStateChange = useCallback((s: GameState) => {
    setHudState(s);
  }, []);

  return (
    <div className="w-full h-full relative bg-background">
      <Canvas
        shadows
        camera={{ position: [0, 8, 15], fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <Arena />
        <GameScene state={stateRef} onStateChange={handleStateChange} />
      </Canvas>
      <HUD state={hudState} />
    </div>
  );
};

export default RagdollArena;
