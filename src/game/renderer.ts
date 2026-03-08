import { GameState, Ragdoll, Particle, DamageText, ARENA_WIDTH, ARENA_HEIGHT, GROUND_Y } from './types';
import { getCenter } from './physics';

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, canvas: HTMLCanvasElement) {
  const scaleX = canvas.width / ARENA_WIDTH;
  const scaleY = canvas.height / ARENA_HEIGHT;
  
  ctx.save();
  
  // Screen shake
  if (state.screenShake.x !== 0 || state.screenShake.y !== 0) {
    ctx.translate(state.screenShake.x, state.screenShake.y);
  }
  
  ctx.scale(scaleX, scaleY);
  
  // Background
  renderBackground(ctx, state);
  
  // Arena floor
  renderFloor(ctx, state);
  
  // Particles behind fighters
  for (const p of state.particles) {
    if (p.type === 'dust' || p.type === 'trail') renderParticle(ctx, p);
  }
  
  // Ragdolls
  for (const ragdoll of state.ragdolls) {
    if (ragdoll.alive) renderRagdoll(ctx, ragdoll, state);
  }
  
  // Dead ragdolls (faded)
  for (const ragdoll of state.ragdolls) {
    if (!ragdoll.alive) renderDeadRagdoll(ctx, ragdoll);
  }
  
  // Particles in front
  for (const p of state.particles) {
    if (p.type !== 'dust' && p.type !== 'trail') renderParticle(ctx, p);
  }
  
  // Damage texts
  for (const dt of state.damageTexts) {
    renderDamageText(ctx, dt);
  }
  
  // HUD
  renderHUD(ctx, state);
  
  ctx.restore();
}

function renderBackground(ctx: CanvasRenderingContext2D, state: GameState) {
  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
  grad.addColorStop(0, '#0a0a15');
  grad.addColorStop(0.5, '#0d0d1a');
  grad.addColorStop(1, '#111122');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  
  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x < ARENA_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < ARENA_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_WIDTH, y);
    ctx.stroke();
  }
  
  // Ambient glow from active fighters
  for (const r of state.ragdolls) {
    if (!r.alive) continue;
    const c = getCenter(r);
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 80);
    g.addColorStop(0, r.color + '10');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(c.x - 80, c.y - 80, 160, 160);
  }
}

function renderFloor(ctx: CanvasRenderingContext2D, state: GameState) {
  // Main floor
  const floorGrad = ctx.createLinearGradient(0, GROUND_Y, 0, ARENA_HEIGHT);
  floorGrad.addColorStop(0, '#1a1a2e');
  floorGrad.addColorStop(1, '#0f0f1a');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, GROUND_Y, ARENA_WIDTH, ARENA_HEIGHT - GROUND_Y);
  
  // Floor line with glow
  ctx.shadowColor = '#ff224466';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = '#ff224488';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(ARENA_WIDTH, GROUND_Y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  
  // Floor segments
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < ARENA_WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x, ARENA_HEIGHT);
    ctx.stroke();
  }
}

function renderRagdoll(ctx: CanvasRenderingContext2D, ragdoll: Ragdoll, state: GameState) {
  const joints = ragdoll.joints;
  const color = ragdoll.color;
  const glow = ragdoll.glowColor;
  
  ctx.save();
  
  // Glow effect
  ctx.shadowColor = color;
  ctx.shadowBlur = ragdoll.rage > 50 ? 20 + Math.sin(state.time * 0.1) * 10 : 8;
  
  // Shield visual
  if (ragdoll.shieldActive) {
    const c = getCenter(ragdoll);
    ctx.strokeStyle = glow + '66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 45, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Body limb connections
  const drawLimb = (a: number, b: number, width?: number) => {
    ctx.lineWidth = width || 3.5;
    ctx.beginPath();
    ctx.moveTo(joints[a].pos.x, joints[a].pos.y);
    ctx.lineTo(joints[b].pos.x, joints[b].pos.y);
    ctx.stroke();
  };
  
  // Torso (thicker)
  drawLimb(1, 2, 5);
  drawLimb(2, 3, 4.5);
  
  // Arms
  drawLimb(4, 5, 3);
  drawLimb(5, 6, 3);
  drawLimb(7, 8, 3);
  drawLimb(8, 9, 3);
  
  // Shoulders
  drawLimb(1, 4, 3.5);
  drawLimb(1, 7, 3.5);
  
  // Legs
  drawLimb(3, 10, 3.5);
  drawLimb(10, 11, 3);
  drawLimb(11, 12, 3);
  drawLimb(3, 13, 3.5);
  drawLimb(13, 14, 3);
  drawLimb(14, 15, 3);
  
  // Head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(joints[0].pos.x, joints[0].pos.y, joints[0].radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Eyes
  ctx.shadowBlur = 0;
  const headX = joints[0].pos.x;
  const headY = joints[0].pos.y;
  const eyeOff = ragdoll.facing * 3;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(headX + eyeOff - 2.5, headY - 2, 2, 0, Math.PI * 2);
  ctx.arc(headX + eyeOff + 2.5, headY - 2, 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Fists (highlighted)
  ctx.fillStyle = glow;
  ctx.shadowColor = glow;
  ctx.shadowBlur = ragdoll.attackCooldown > 0 ? 15 : 5;
  ctx.beginPath();
  ctx.arc(joints[6].pos.x, joints[6].pos.y, joints[6].radius + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(joints[9].pos.x, joints[9].pos.y, joints[9].radius + 1, 0, Math.PI * 2);
  ctx.fill();
  
  // Feet
  ctx.fillStyle = color;
  ctx.shadowBlur = 3;
  ctx.beginPath();
  ctx.arc(joints[12].pos.x, joints[12].pos.y, joints[12].radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(joints[15].pos.x, joints[15].pos.y, joints[15].radius, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
  
  // Health bar above head
  const barWidth = 36;
  const barHeight = 4;
  const barX = joints[0].pos.x - barWidth / 2;
  const barY = joints[0].pos.y - joints[0].radius - 14;
  
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
  
  // Health
  const healthPercent = ragdoll.health / ragdoll.maxHealth;
  const healthColor = healthPercent > 0.5 ? '#00ff88' : healthPercent > 0.25 ? '#ffaa00' : '#ff2244';
  ctx.fillStyle = healthColor;
  ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  
  // Name tag
  ctx.font = 'bold 8px Orbitron, sans-serif';
  ctx.fillStyle = glow;
  ctx.textAlign = 'center';
  ctx.fillText(ragdoll.name, joints[0].pos.x, barY - 4);
}

function renderDeadRagdoll(ctx: CanvasRenderingContext2D, ragdoll: Ragdoll) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  
  const joints = ragdoll.joints;
  const drawLimb = (a: number, b: number) => {
    ctx.beginPath();
    ctx.moveTo(joints[a].pos.x, joints[a].pos.y);
    ctx.lineTo(joints[b].pos.x, joints[b].pos.y);
    ctx.stroke();
  };
  
  drawLimb(1, 2); drawLimb(2, 3);
  drawLimb(4, 5); drawLimb(5, 6);
  drawLimb(7, 8); drawLimb(8, 9);
  drawLimb(1, 4); drawLimb(1, 7);
  drawLimb(3, 10); drawLimb(10, 11); drawLimb(11, 12);
  drawLimb(3, 13); drawLimb(13, 14); drawLimb(14, 15);
  
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.arc(joints[0].pos.x, joints[0].pos.y, joints[0].radius, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function renderParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  const lifeRatio = Math.max(0, p.life / p.maxLife);
  ctx.globalAlpha = p.alpha * lifeRatio;
  if (ctx.globalAlpha <= 0.01) { ctx.restore(); return; }
  
  const r = (v: number) => Math.max(0.1, v);
  
  switch (p.type) {
    case 'spark':
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r(p.size), 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'blood':
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r(p.size), 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'dust':
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r(p.size), 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'shockwave':
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.5, 3 * lifeRatio);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r(p.size * (1 - lifeRatio) * 40), 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'trail':
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r(p.size * lifeRatio), 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'fire':
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r(p.size * lifeRatio), 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'lightning':
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.5, p.size);
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + (Math.random() - 0.5) * 20, p.y + (Math.random() - 0.5) * 20);
      ctx.stroke();
      break;
  }
  
  ctx.restore();
}

function renderDamageText(ctx: CanvasRenderingContext2D, dt: DamageText) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, dt.life / 15);
  ctx.font = `bold ${dt.size}px Orbitron, sans-serif`;
  ctx.fillStyle = dt.color;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.textAlign = 'center';
  ctx.strokeText(dt.text, dt.x, dt.y);
  ctx.fillText(dt.text, dt.x, dt.y);
  ctx.restore();
}

function renderHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  // Round counter
  ctx.font = 'bold 14px "Press Start 2P", Orbitron, sans-serif';
  ctx.fillStyle = '#ffffff88';
  ctx.textAlign = 'center';
  ctx.fillText(`ROUND ${state.roundNumber}`, ARENA_WIDTH / 2, 25);
  
  // Alive count
  const alive = state.ragdolls.filter(r => r.alive).length;
  ctx.font = 'bold 10px Orbitron, sans-serif';
  ctx.fillStyle = alive <= 3 ? '#ff4444' : '#aaaaaa';
  ctx.fillText(`${alive} FIGHTERS REMAINING`, ARENA_WIDTH / 2, 44);
  
  // Fighter status strip at bottom
  const stripY = ARENA_HEIGHT - 25;
  const stripWidth = ARENA_WIDTH - 40;
  const itemWidth = stripWidth / 10;
  
  for (let i = 0; i < state.ragdolls.length; i++) {
    const r = state.ragdolls[i];
    const x = 20 + i * itemWidth;
    
    ctx.globalAlpha = r.alive ? 1 : 0.3;
    
    // Mini health bar
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, stripY, itemWidth - 4, 12);
    
    if (r.alive) {
      const hp = r.health / r.maxHealth;
      ctx.fillStyle = r.color;
      ctx.fillRect(x, stripY, (itemWidth - 4) * hp, 12);
    }
    
    // Name
    ctx.font = '6px Orbitron, sans-serif';
    ctx.fillStyle = r.alive ? '#fff' : '#666';
    ctx.textAlign = 'left';
    ctx.fillText(r.name, x + 2, stripY + 9);
    
    // Kill count
    if (r.kills > 0) {
      ctx.fillStyle = '#ffaa00';
      ctx.textAlign = 'right';
      ctx.fillText(`${r.kills}K`, x + itemWidth - 6, stripY + 9);
    }
  }
  ctx.globalAlpha = 1;
}

export function renderWinnerScreen(ctx: CanvasRenderingContext2D, winner: Ragdoll, state: GameState, canvas: HTMLCanvasElement, countdownTimer: number) {
  const scaleX = canvas.width / ARENA_WIDTH;
  const scaleY = canvas.height / ARENA_HEIGHT;
  
  ctx.save();
  ctx.scale(scaleX, scaleY);
  
  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  
  // Winner glow
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 - 40;
  
  const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
  glowGrad.addColorStop(0, winner.color + '33');
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  
  // "WINNER" text
  ctx.font = 'bold 48px "Press Start 2P", Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = winner.color;
  ctx.shadowBlur = 30;
  ctx.fillStyle = winner.color;
  ctx.fillText('WINNER', cx, cy - 50);
  
  // Fighter name
  ctx.font = 'bold 32px Orbitron, sans-serif';
  ctx.shadowBlur = 20;
  ctx.fillStyle = winner.glowColor;
  ctx.fillText(winner.name, cx, cy + 10);
  
  // Stats
  ctx.shadowBlur = 0;
  ctx.font = '14px Orbitron, sans-serif';
  ctx.fillStyle = '#aaa';
  ctx.fillText(`Kills: ${winner.kills}  |  Damage Dealt: ${Math.round(winner.damageDealt)}  |  HP Remaining: ${Math.round(winner.health)}`, cx, cy + 50);
  
  // Style badge
  ctx.font = 'bold 12px Orbitron, sans-serif';
  ctx.fillStyle = winner.color + 'cc';
  ctx.fillText(`Style: ${winner.style.toUpperCase()}`, cx, cy + 75);
  
  // Leaderboard
  const sorted = [...state.ragdolls].sort((a, b) => b.kills - a.kills || b.damageDealt - a.damageDealt);
  ctx.font = '10px Orbitron, sans-serif';
  const lbY = cy + 110;
  ctx.fillStyle = '#888';
  ctx.fillText('LEADERBOARD', cx, lbY);
  
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const r = sorted[i];
    ctx.fillStyle = r.id === winner.id ? winner.color : '#666';
    ctx.font = '9px Orbitron, sans-serif';
    ctx.fillText(`${i + 1}. ${r.name} - ${r.kills} kills - ${Math.round(r.damageDealt)} dmg`, cx, lbY + 18 + i * 16);
  }
  
  // Countdown
  ctx.font = 'bold 16px Orbitron, sans-serif';
  ctx.fillStyle = '#ffffff88';
  ctx.fillText(`Next round in ${Math.ceil(countdownTimer / 60)}...`, cx, ARENA_HEIGHT - 50);
  
  ctx.restore();
}
