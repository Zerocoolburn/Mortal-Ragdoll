import { Vec2, Joint, Constraint, Ragdoll, ARENA_WIDTH, ARENA_HEIGHT, GROUND_Y, GRAVITY, FRICTION, AIR_FRICTION, BOUNCE } from './types';

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function createRagdoll(x: number, y: number, id: number, name: string, color: string, glowColor: string, style: Ragdoll['style']): Ragdoll {
  // Joint layout:
  // 0: head, 1: neck, 2: torso, 3: hip
  // 4: left shoulder, 5: left elbow, 6: left hand
  // 7: right shoulder, 8: right elbow, 9: right hand
  // 10: left hip, 11: left knee, 12: left foot
  // 13: right hip, 14: right knee, 15: right foot
  const makeJoint = (ox: number, oy: number, r: number, m: number): Joint => ({
    pos: { x: x + ox, y: y + oy },
    prevPos: { x: x + ox, y: y + oy },
    vel: { x: 0, y: 0 },
    radius: r,
    mass: m,
  });

  const joints: Joint[] = [
    makeJoint(0, -55, 10, 3),    // 0 head
    makeJoint(0, -42, 4, 2),     // 1 neck
    makeJoint(0, -28, 6, 4),     // 2 upper torso
    makeJoint(0, -10, 6, 4),     // 3 lower torso
    makeJoint(-14, -38, 4, 1.5), // 4 left shoulder
    makeJoint(-26, -24, 3, 1),   // 5 left elbow
    makeJoint(-34, -12, 4, 1.5), // 6 left hand (fist)
    makeJoint(14, -38, 4, 1.5),  // 7 right shoulder
    makeJoint(26, -24, 3, 1),    // 8 right elbow
    makeJoint(34, -12, 4, 1.5),  // 9 right hand (fist)
    makeJoint(-8, 0, 4, 2),      // 10 left hip
    makeJoint(-10, 18, 3, 1.5),  // 11 left knee
    makeJoint(-12, 36, 5, 2),    // 12 left foot
    makeJoint(8, 0, 4, 2),       // 13 right hip
    makeJoint(10, 18, 3, 1.5),   // 14 right knee
    makeJoint(12, 36, 5, 2),     // 15 right foot
  ];

  const makeCon = (a: number, b: number, stiff: number = 0.8): Constraint => ({
    a, b,
    length: dist(joints[a].pos, joints[b].pos),
    stiffness: stiff,
  });

  const constraints: Constraint[] = [
    makeCon(0, 1, 0.95),   // head-neck
    makeCon(1, 2, 0.9),    // neck-upper torso
    makeCon(2, 3, 0.9),    // upper-lower torso
    makeCon(1, 4, 0.85),   // neck-left shoulder
    makeCon(4, 5, 0.8),    // left shoulder-elbow
    makeCon(5, 6, 0.8),    // left elbow-hand
    makeCon(1, 7, 0.85),   // neck-right shoulder
    makeCon(7, 8, 0.8),    // right shoulder-elbow
    makeCon(8, 9, 0.8),    // right elbow-hand
    makeCon(3, 10, 0.85),  // torso-left hip
    makeCon(10, 11, 0.8),  // left hip-knee
    makeCon(11, 12, 0.8),  // left knee-foot
    makeCon(3, 13, 0.85),  // torso-right hip
    makeCon(13, 14, 0.8),  // right hip-knee
    makeCon(14, 15, 0.8),  // right knee-foot
    // Cross-bracing for stability
    makeCon(0, 2, 0.5),    // head-torso
    makeCon(4, 7, 0.4),    // shoulder-shoulder
    makeCon(10, 13, 0.4),  // hip-hip
    makeCon(2, 10, 0.3),   // cross brace
    makeCon(2, 13, 0.3),   // cross brace
  ];

  return {
    id,
    name,
    joints,
    constraints,
    color,
    glowColor,
    health: 100,
    maxHealth: 100,
    alive: true,
    stunTimer: 0,
    attackCooldown: 0,
    comboCount: 0,
    lastHitBy: null,
    kills: 0,
    damageDealt: 0,
    style,
    dodgeCooldown: 0,
    specialCooldown: 0,
    shieldActive: false,
    rage: 0,
    facing: Math.random() > 0.5 ? 1 : -1,
  };
}

export function getCenter(ragdoll: Ragdoll): Vec2 {
  let cx = 0, cy = 0;
  for (const j of ragdoll.joints) {
    cx += j.pos.x;
    cy += j.pos.y;
  }
  return { x: cx / ragdoll.joints.length, y: cy / ragdoll.joints.length };
}

export function applyForceToAll(ragdoll: Ragdoll, fx: number, fy: number) {
  for (const j of ragdoll.joints) {
    j.vel.x += fx / j.mass;
    j.vel.y += fy / j.mass;
  }
}

export function applyForceToJoint(ragdoll: Ragdoll, idx: number, fx: number, fy: number) {
  const j = ragdoll.joints[idx];
  j.vel.x += fx / j.mass;
  j.vel.y += fy / j.mass;
}

export function updatePhysics(ragdoll: Ragdoll, dt: number) {
  for (const joint of ragdoll.joints) {
    if (joint.pinned) continue;
    joint.vel.y += GRAVITY * dt;
    
    const onGround = joint.pos.y + joint.radius >= GROUND_Y;
    const fric = onGround ? FRICTION : AIR_FRICTION;
    joint.vel.x *= fric;
    joint.vel.y *= fric;
    
    joint.prevPos.x = joint.pos.x;
    joint.prevPos.y = joint.pos.y;
    joint.pos.x += joint.vel.x * dt;
    joint.pos.y += joint.vel.y * dt;
    
    // Arena bounds
    if (joint.pos.x - joint.radius < 0) {
      joint.pos.x = joint.radius;
      joint.vel.x *= -BOUNCE;
    }
    if (joint.pos.x + joint.radius > ARENA_WIDTH) {
      joint.pos.x = ARENA_WIDTH - joint.radius;
      joint.vel.x *= -BOUNCE;
    }
    if (joint.pos.y + joint.radius > GROUND_Y) {
      joint.pos.y = GROUND_Y - joint.radius;
      joint.vel.y *= -BOUNCE;
      joint.vel.x *= 0.92;
    }
    if (joint.pos.y - joint.radius < 0) {
      joint.pos.y = joint.radius;
      joint.vel.y *= -BOUNCE;
    }
  }
  
  // Solve constraints (multiple iterations for stability)
  for (let iter = 0; iter < 5; iter++) {
    for (const con of ragdoll.constraints) {
      const a = ragdoll.joints[con.a];
      const b = ragdoll.joints[con.b];
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d === 0) continue;
      const diff = (d - con.length) / d;
      const totalMass = a.mass + b.mass;
      const moveA = con.stiffness * diff * (a.mass / totalMass);
      const moveB = con.stiffness * diff * (b.mass / totalMass);
      
      if (!a.pinned) {
        a.pos.x += dx * moveA;
        a.pos.y += dy * moveA;
      }
      if (!b.pinned) {
        b.pos.x -= dx * moveB;
        b.pos.y -= dy * moveB;
      }
    }
  }
}

export function checkCollision(a: Ragdoll, b: Ragdoll): { jointA: number; jointB: number; depth: number } | null {
  let best: { jointA: number; jointB: number; depth: number } | null = null;
  let bestDepth = 0;
  
  // Check fist joints (6, 9) and foot joints (12, 15) against all joints of other ragdoll
  const attackJoints = [6, 9, 12, 15];
  
  for (const ai of attackJoints) {
    for (let bi = 0; bi < b.joints.length; bi++) {
      const ja = a.joints[ai];
      const jb = b.joints[bi];
      const d = dist(ja.pos, jb.pos);
      const minDist = ja.radius + jb.radius + 2;
      if (d < minDist && minDist - d > bestDepth) {
        bestDepth = minDist - d;
        best = { jointA: ai, jointB: bi, depth: bestDepth };
      }
    }
  }
  
  return best;
}
