import {
  GameState, Ragdoll, Particle, DamageText, Vec2,
  ARENA_WIDTH, ARENA_HEIGHT, GROUND_Y,
  FIGHTER_NAMES, FIGHTER_COLORS, FIGHTER_STYLES
} from './types';
import { createRagdoll, updatePhysics, checkCollision, getCenter, dist, applyForceToAll } from './physics';
import { updateAI } from './ai';

export function createGameState(roundNumber: number): GameState {
  const ragdolls: Ragdoll[] = [];
  
  for (let i = 0; i < 10; i++) {
    const x = 80 + (ARENA_WIDTH - 160) * (i / 9);
    const y = GROUND_Y - 60;
    ragdolls.push(createRagdoll(
      x, y, i,
      FIGHTER_NAMES[i],
      FIGHTER_COLORS[i].main,
      FIGHTER_COLORS[i].glow,
      FIGHTER_STYLES[i]
    ));
  }
  
  return {
    ragdolls,
    particles: [],
    damageTexts: [],
    screenShake: { x: 0, y: 0 },
    time: 0,
    gameOver: false,
    winner: null,
    roundNumber,
    slowMotion: 1,
    lastKillTime: 0,
  };
}

function spawnParticles(state: GameState, x: number, y: number, count: number, type: Particle['type'], color: string, speed: number = 3) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * speed + speed * 0.3;
    state.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - (type === 'fire' ? 2 : 0),
      life: 20 + Math.random() * 30,
      maxLife: 20 + Math.random() * 30,
      color,
      size: type === 'shockwave' ? 1 : 1 + Math.random() * 3,
      type,
      alpha: 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    });
  }
}

function spawnDamageText(state: GameState, x: number, y: number, damage: number, color: string) {
  state.damageTexts.push({
    x: x + (Math.random() - 0.5) * 20,
    y: y - 15,
    text: `-${Math.round(damage)}`,
    life: 40,
    color,
    size: Math.min(20, 10 + damage * 0.4),
  });
}

function addScreenShake(state: GameState, intensity: number) {
  state.screenShake.x += (Math.random() - 0.5) * intensity;
  state.screenShake.y += (Math.random() - 0.5) * intensity;
}

export function updateGame(state: GameState): boolean {
  state.time++;
  
  const dt = state.slowMotion;
  
  // Decay slow motion
  if (state.slowMotion < 1) {
    state.slowMotion = Math.min(1, state.slowMotion + 0.02);
  }
  
  // Update ragdoll physics
  for (const ragdoll of state.ragdolls) {
    if (!ragdoll.alive) continue;
    updatePhysics(ragdoll, dt);
    
    // Trail particles for fast-moving fighters
    const center = getCenter(ragdoll);
    const speed = Math.sqrt(
      ragdoll.joints[0].vel.x ** 2 + ragdoll.joints[0].vel.y ** 2
    );
    if (speed > 5 && Math.random() < 0.3) {
      spawnParticles(state, center.x, center.y, 1, 'trail', ragdoll.color + '66', 1);
    }
    
    // Rage fire effect
    if (ragdoll.rage > 70 && Math.random() < 0.15) {
      spawnParticles(state, center.x + (Math.random() - 0.5) * 20, center.y - 10, 1, 'fire', ragdoll.color, 1.5);
    }
  }
  
  // AI updates
  for (const ragdoll of state.ragdolls) {
    if (!ragdoll.alive) continue;
    updateAI(ragdoll, state);
  }
  
  // Collision detection between all pairs
  for (let i = 0; i < state.ragdolls.length; i++) {
    for (let j = i + 1; j < state.ragdolls.length; j++) {
      const a = state.ragdolls[i];
      const b = state.ragdolls[j];
      if (!a.alive || !b.alive) continue;
      
      // Check A attacking B
      const hitAB = checkCollision(a, b);
      if (hitAB) {
        handleHit(state, a, b, hitAB.jointA, hitAB.jointB, hitAB.depth);
      }
      
      // Check B attacking A
      const hitBA = checkCollision(b, a);
      if (hitBA) {
        handleHit(state, b, a, hitBA.jointA, hitBA.jointB, hitBA.depth);
      }
      
      // Body separation (prevent overlapping)
      const centerA = getCenter(a);
      const centerB = getCenter(b);
      const d = dist(centerA, centerB);
      if (d < 30 && d > 0) {
        const push = (30 - d) * 0.15;
        const nx = (centerA.x - centerB.x) / d;
        const ny = (centerA.y - centerB.y) / d;
        applyForceToAll(a, nx * push, ny * push);
        applyForceToAll(b, -nx * push, -ny * push);
      }
    }
  }
  
  // Update particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.1;
    p.vx *= 0.98;
    p.life -= dt;
    p.rotation += p.rotationSpeed;
    
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
  
  // Cap particles
  if (state.particles.length > 500) {
    state.particles.splice(0, state.particles.length - 500);
  }
  
  // Update damage texts
  for (let i = state.damageTexts.length - 1; i >= 0; i--) {
    const dt2 = state.damageTexts[i];
    dt2.y -= 0.8;
    dt2.life -= 1;
    if (dt2.life <= 0) {
      state.damageTexts.splice(i, 1);
    }
  }
  
  // Screen shake decay
  state.screenShake.x *= 0.85;
  state.screenShake.y *= 0.85;
  if (Math.abs(state.screenShake.x) < 0.1) state.screenShake.x = 0;
  if (Math.abs(state.screenShake.y) < 0.1) state.screenShake.y = 0;
  
  // Check for winner
  const alive = state.ragdolls.filter(r => r.alive);
  if (alive.length <= 1 && !state.gameOver) {
    state.gameOver = true;
    state.winner = alive.length === 1 ? alive[0] : null;
    if (state.winner) {
      const c = getCenter(state.winner);
      spawnParticles(state, c.x, c.y, 50, 'spark', state.winner.color, 6);
      spawnParticles(state, c.x, c.y, 3, 'shockwave', state.winner.color, 0);
    }
    return true;
  }
  
  return state.gameOver;
}

function handleHit(state: GameState, attacker: Ragdoll, defender: Ragdoll, attackJoint: number, defenseJoint: number, depth: number) {
  // Calculate hit velocity
  const aJoint = attacker.joints[attackJoint];
  const speed = Math.sqrt(aJoint.vel.x ** 2 + aJoint.vel.y ** 2);
  
  if (speed < 2.5) return; // Minimum speed for a hit
  if (attacker.attackCooldown > 15) return; // Recently attacked, prevent spam
  
  // Shield check
  if (defender.shieldActive && Math.random() < 0.5) {
    const c = getCenter(defender);
    spawnParticles(state, c.x, c.y, 8, 'spark', defender.glowColor, 4);
    addScreenShake(state, 3);
    return;
  }
  
  const isFist = attackJoint === 6 || attackJoint === 9;
  const isFoot = attackJoint === 12 || attackJoint === 15;
  const isHead = defenseJoint === 0;
  
  let damage = speed * 1.2 + depth * 0.5;
  let hitType = 'HIT';
  
  if (isFist) {
    damage *= 1.3;
    hitType = 'PUNCH';
  }
  if (isFoot) {
    damage *= 1.5;
    hitType = 'KICK';
  }
  if (isHead) {
    damage *= 1.8;
    hitType = 'HEADSHOT';
  }
  
  // Rage bonus
  if (attacker.rage > 50) {
    damage *= 1 + (attacker.rage / 200);
  }
  
  // Combo bonus
  if (defender.lastHitBy === attacker.id && attacker.comboCount > 0) {
    attacker.comboCount++;
    damage *= 1 + attacker.comboCount * 0.15;
    if (attacker.comboCount >= 3) hitType = `${attacker.comboCount}x COMBO`;
  } else {
    attacker.comboCount = 1;
  }
  
  damage = Math.min(damage, 35); // Cap single hit
  
  defender.health -= damage;
  defender.lastHitBy = attacker.id;
  defender.stunTimer = Math.min(15, 5 + damage * 0.3);
  attacker.damageDealt += damage;
  attacker.rage = Math.min(100, attacker.rage + damage * 0.3);
  
  // Knockback
  const bJoint = defender.joints[defenseJoint];
  const kbMult = 1.5 + damage * 0.08;
  const dx = bJoint.pos.x - aJoint.pos.x;
  const dy = bJoint.pos.y - aJoint.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 0) {
    applyForceToAll(defender, (dx / d) * kbMult * speed * 0.5, (dy / d) * kbMult * speed * 0.3 - 2);
  }
  
  // Effects
  const hitX = (aJoint.pos.x + bJoint.pos.x) / 2;
  const hitY = (aJoint.pos.y + bJoint.pos.y) / 2;
  
  spawnParticles(state, hitX, hitY, Math.floor(4 + damage * 0.4), 'spark', attacker.color, 3 + damage * 0.1);
  spawnParticles(state, hitX, hitY, 2, 'blood', '#ff3344', 2);
  
  if (damage > 15) {
    spawnParticles(state, hitX, hitY, 1, 'shockwave', attacker.color, 0);
    addScreenShake(state, damage * 0.4);
  } else {
    addScreenShake(state, damage * 0.2);
  }
  
  if (isHead) {
    spawnParticles(state, hitX, hitY, 8, 'lightning', '#ffffff', 4);
  }
  
  spawnDamageText(state, hitX, hitY, damage, isHead ? '#ffffff' : attacker.glowColor);
  
  // Death check
  if (defender.health <= 0) {
    defender.health = 0;
    defender.alive = false;
    attacker.kills++;
    attacker.rage = 100;
    state.lastKillTime = state.time;
    
    // Slow motion on kill
    state.slowMotion = 0.3;
    
    // Death explosion
    const dc = getCenter(defender);
    spawnParticles(state, dc.x, dc.y, 30, 'spark', defender.color, 5);
    spawnParticles(state, dc.x, dc.y, 15, 'fire', '#ff6600', 3);
    spawnParticles(state, dc.x, dc.y, 2, 'shockwave', defender.color, 0);
    addScreenShake(state, 12);
    
    state.damageTexts.push({
      x: dc.x,
      y: dc.y - 30,
      text: `${defender.name} ELIMINATED`,
      life: 60,
      color: '#ff4444',
      size: 14,
    });
  }
}
