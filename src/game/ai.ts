import { Ragdoll, GameState, ARENA_WIDTH, GROUND_Y } from './types';
import { getCenter, applyForceToJoint, applyForceToAll, dist, normalize } from './physics';

function findNearestEnemy(self: Ragdoll, state: GameState): Ragdoll | null {
  const center = getCenter(self);
  let nearest: Ragdoll | null = null;
  let nearestDist = Infinity;
  
  for (const r of state.ragdolls) {
    if (r.id === self.id || !r.alive) continue;
    const d = dist(center, getCenter(r));
    if (d < nearestDist) {
      nearestDist = d;
      nearest = r;
    }
  }
  return nearest;
}

function findWeakestEnemy(self: Ragdoll, state: GameState): Ragdoll | null {
  let weakest: Ragdoll | null = null;
  let lowestHP = Infinity;
  for (const r of state.ragdolls) {
    if (r.id === self.id || !r.alive) continue;
    if (r.health < lowestHP) {
      lowestHP = r.health;
      weakest = r;
    }
  }
  return weakest;
}

function findMostDangerousEnemy(self: Ragdoll, state: GameState): Ragdoll | null {
  let dangerous: Ragdoll | null = null;
  let mostKills = -1;
  for (const r of state.ragdolls) {
    if (r.id === self.id || !r.alive) continue;
    if (r.kills > mostKills) {
      mostKills = r.kills;
      dangerous = r;
    }
  }
  return dangerous;
}

function countAlive(state: GameState): number {
  return state.ragdolls.filter(r => r.alive).length;
}

function isOnGround(ragdoll: Ragdoll): boolean {
  return ragdoll.joints.some(j => j.pos.y + j.radius >= GROUND_Y - 5);
}

function jump(ragdoll: Ragdoll, power: number = 8) {
  if (isOnGround(ragdoll)) {
    applyForceToAll(ragdoll, 0, -power);
  }
}

function moveToward(ragdoll: Ragdoll, targetX: number, speed: number = 0.6) {
  const center = getCenter(ragdoll);
  const dir = targetX > center.x ? 1 : -1;
  ragdoll.facing = dir;
  // Apply force to feet and hip for natural movement
  applyForceToJoint(ragdoll, 12, dir * speed, 0);
  applyForceToJoint(ragdoll, 15, dir * speed, 0);
  applyForceToJoint(ragdoll, 3, dir * speed * 0.5, 0);
}

function dodge(ragdoll: Ragdoll, awayFromX: number) {
  if (ragdoll.dodgeCooldown > 0) return;
  const center = getCenter(ragdoll);
  const dir = awayFromX > center.x ? -1 : 1;
  applyForceToAll(ragdoll, dir * 6, -3);
  ragdoll.dodgeCooldown = 40;
}

function punch(ragdoll: Ragdoll, target: Ragdoll, power: number = 5) {
  if (ragdoll.attackCooldown > 0) return;
  const targetCenter = getCenter(target);
  const selfCenter = getCenter(ragdoll);
  const dx = targetCenter.x - selfCenter.x;
  const dy = targetCenter.y - selfCenter.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return;
  
  // Punch with both fists toward target
  const nx = dx / d;
  const ny = dy / d;
  const fistIdx = Math.random() > 0.5 ? 6 : 9;
  applyForceToJoint(ragdoll, fistIdx, nx * power * 2, ny * power * 1.5 - 1);
  ragdoll.attackCooldown = 12 + Math.random() * 8;
}

function kick(ragdoll: Ragdoll, target: Ragdoll, power: number = 6) {
  if (ragdoll.attackCooldown > 0) return;
  const targetCenter = getCenter(target);
  const selfCenter = getCenter(ragdoll);
  const dx = targetCenter.x - selfCenter.x;
  const dy = targetCenter.y - selfCenter.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return;
  
  const nx = dx / d;
  const ny = dy / d;
  const footIdx = Math.random() > 0.5 ? 12 : 15;
  applyForceToJoint(ragdoll, footIdx, nx * power * 2.5, ny * power - 2);
  ragdoll.attackCooldown = 18 + Math.random() * 10;
}

function uppercut(ragdoll: Ragdoll, target: Ragdoll) {
  if (ragdoll.attackCooldown > 0 || ragdoll.specialCooldown > 0) return;
  const targetCenter = getCenter(target);
  const selfCenter = getCenter(ragdoll);
  const dx = targetCenter.x - selfCenter.x;
  const d = Math.abs(dx);
  if (d === 0) return;
  const dir = dx > 0 ? 1 : -1;
  
  applyForceToJoint(ragdoll, 6, dir * 4, -12);
  applyForceToJoint(ragdoll, 9, dir * 4, -12);
  ragdoll.attackCooldown = 25;
  ragdoll.specialCooldown = 60;
}

function spinKick(ragdoll: Ragdoll, target: Ragdoll) {
  if (ragdoll.attackCooldown > 0 || ragdoll.specialCooldown > 0) return;
  const targetCenter = getCenter(target);
  const selfCenter = getCenter(ragdoll);
  const dx = targetCenter.x - selfCenter.x;
  const dir = dx > 0 ? 1 : -1;
  
  applyForceToJoint(ragdoll, 12, dir * 10, -3);
  applyForceToJoint(ragdoll, 15, dir * 10, -3);
  applyForceToAll(ragdoll, dir * 2, -2);
  ragdoll.attackCooldown = 20;
  ragdoll.specialCooldown = 50;
}

function bodySlam(ragdoll: Ragdoll, target: Ragdoll) {
  if (ragdoll.attackCooldown > 0 || ragdoll.specialCooldown > 0) return;
  const targetCenter = getCenter(target);
  const selfCenter = getCenter(ragdoll);
  const dx = targetCenter.x - selfCenter.x;
  const dir = dx > 0 ? 1 : -1;
  
  jump(ragdoll, 10);
  applyForceToAll(ragdoll, dir * 8, 0);
  ragdoll.attackCooldown = 30;
  ragdoll.specialCooldown = 80;
}

export function updateAI(ragdoll: Ragdoll, state: GameState) {
  if (!ragdoll.alive || ragdoll.stunTimer > 0) {
    ragdoll.stunTimer = Math.max(0, ragdoll.stunTimer - 1);
    return;
  }
  
  ragdoll.attackCooldown = Math.max(0, ragdoll.attackCooldown - 1);
  ragdoll.dodgeCooldown = Math.max(0, ragdoll.dodgeCooldown - 1);
  ragdoll.specialCooldown = Math.max(0, ragdoll.specialCooldown - 1);
  
  const center = getCenter(ragdoll);
  const alive = countAlive(state);
  
  let target: Ragdoll | null;
  
  switch (ragdoll.style) {
    case 'aggressive':
      target = findNearestEnemy(ragdoll, state);
      if (!target) return;
      aggressiveAI(ragdoll, target, center, state);
      break;
    case 'defensive':
      target = findNearestEnemy(ragdoll, state);
      if (!target) return;
      defensiveAI(ragdoll, target, center, state);
      break;
    case 'berserker':
      target = alive <= 3 ? findWeakestEnemy(ragdoll, state) : findNearestEnemy(ragdoll, state);
      if (!target) return;
      berserkerAI(ragdoll, target, center, state);
      break;
    case 'tactical':
      target = findWeakestEnemy(ragdoll, state);
      if (!target) return;
      tacticalAI(ragdoll, target, center, state);
      break;
    case 'assassin':
      target = findWeakestEnemy(ragdoll, state) || findNearestEnemy(ragdoll, state);
      if (!target) return;
      assassinAI(ragdoll, target, center, state);
      break;
  }
  
  // Keep away from edges
  if (center.x < 50) applyForceToAll(ragdoll, 1.5, 0);
  if (center.x > ARENA_WIDTH - 50) applyForceToAll(ragdoll, -1.5, 0);
}

function aggressiveAI(self: Ragdoll, target: Ragdoll, center: { x: number; y: number }, state: GameState) {
  const targetCenter = getCenter(target);
  const d = dist(center, targetCenter);
  
  moveToward(self, targetCenter.x, 0.8);
  
  if (d < 80) {
    if (Math.random() < 0.5) {
      punch(self, target, 6);
    } else {
      kick(self, target, 7);
    }
    if (self.rage > 50 && self.specialCooldown <= 0) {
      uppercut(self, target);
    }
  } else if (d < 120) {
    // Close gap aggressively
    applyForceToAll(self, (targetCenter.x - center.x) > 0 ? 2 : -2, 0);
    if (Math.random() < 0.3) jump(self, 6);
  }
  
  self.rage = Math.min(100, self.rage + 0.3);
}

function defensiveAI(self: Ragdoll, target: Ragdoll, center: { x: number; y: number }, state: GameState) {
  const targetCenter = getCenter(target);
  const d = dist(center, targetCenter);
  
  if (d < 90) {
    // Counter attack when close
    if (self.attackCooldown <= 0) {
      if (Math.random() < 0.6) {
        punch(self, target, 5);
      } else {
        kick(self, target, 6);
      }
    }
    // Try to create distance
    if (Math.random() < 0.15) {
      dodge(self, targetCenter.x);
    }
  } else if (d < 150) {
    // Maintain optimal distance
    if (d < 110) {
      const dir = center.x > targetCenter.x ? 1 : -1;
      moveToward(self, center.x + dir * 50, 0.4);
    }
  } else {
    // Approach cautiously
    moveToward(self, targetCenter.x, 0.4);
  }
  
  // Shield at low health
  if (self.health < 30) {
    self.shieldActive = true;
    if (self.specialCooldown <= 0 && d < 80) {
      spinKick(self, target);
    }
  }
}

function berserkerAI(self: Ragdoll, target: Ragdoll, center: { x: number; y: number }, state: GameState) {
  const targetCenter = getCenter(target);
  const d = dist(center, targetCenter);
  const rageMultiplier = 1 + (self.rage / 100) * 0.8;
  
  // Always charge
  moveToward(self, targetCenter.x, 1.0 * rageMultiplier);
  
  if (d < 100) {
    const r = Math.random();
    if (r < 0.35) punch(self, target, 7 * rageMultiplier);
    else if (r < 0.65) kick(self, target, 8 * rageMultiplier);
    else if (self.specialCooldown <= 0) bodySlam(self, target);
    
    if (Math.random() < 0.2) jump(self, 7);
  }
  
  self.rage = Math.min(100, self.rage + 0.5);
  if (self.health < self.maxHealth * 0.5) {
    self.rage = Math.min(100, self.rage + 0.8);
  }
}

function tacticalAI(self: Ragdoll, target: Ragdoll, center: { x: number; y: number }, state: GameState) {
  const targetCenter = getCenter(target);
  const d = dist(center, targetCenter);
  
  // Find threats nearby
  const nearbyThreats = state.ragdolls.filter(r => 
    r.id !== self.id && r.alive && dist(center, getCenter(r)) < 120
  );
  
  // If surrounded, dodge out
  if (nearbyThreats.length >= 2 && self.dodgeCooldown <= 0) {
    const avgX = nearbyThreats.reduce((s, r) => s + getCenter(r).x, 0) / nearbyThreats.length;
    dodge(self, avgX);
    return;
  }
  
  if (d < 85) {
    if (target.stunTimer > 0) {
      // Punish stunned opponents
      punch(self, target, 7);
      kick(self, target, 7);
    } else {
      if (Math.random() < 0.4) punch(self, target, 5);
      else kick(self, target, 5);
    }
    if (self.specialCooldown <= 0 && target.health < 25) {
      uppercut(self, target);
    }
  } else {
    moveToward(self, targetCenter.x, 0.6);
    if (d > 200) jump(self, 5);
  }
}

function assassinAI(self: Ragdoll, target: Ragdoll, center: { x: number; y: number }, state: GameState) {
  const targetCenter = getCenter(target);
  const d = dist(center, targetCenter);
  
  // Stalk weakened targets
  if (target.health > 50 && d > 150) {
    // Wait for opportunities, move slowly
    moveToward(self, targetCenter.x, 0.3);
    return;
  }
  
  if (d < 70) {
    // Quick burst attack
    if (self.specialCooldown <= 0) {
      spinKick(self, target);
      punch(self, target, 8);
    } else {
      punch(self, target, 6);
    }
    // Disengage after attack
    if (self.attackCooldown > 5) {
      dodge(self, targetCenter.x);
    }
  } else if (d < 140) {
    // Approach for kill
    moveToward(self, targetCenter.x, 0.9);
    if (Math.random() < 0.15) jump(self, 6);
  } else {
    moveToward(self, targetCenter.x, 0.5);
  }
}
