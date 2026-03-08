import { useRef, useEffect, useCallback } from 'react';

// ─── Constants ───
const W = 1200, H = 700, GY = 620, G = 0.45, FRIC = 0.985;
const NAMES = ['BLAZE','VENOM','PHANTOM','TITAN','STORM','WRAITH','NOVA','FANG','REAPER','JINX'];
const COLORS = ['#ff2244','#00ff88','#4488ff','#ffaa00','#ff00ff','#00ffff','#ff6600','#88ff00','#ff0088','#aa44ff'];
const GLOWS =  ['#ff6688','#66ffbb','#88bbff','#ffcc55','#ff66ff','#66ffff','#ff9944','#bbff55','#ff55aa','#cc88ff'];
const STYLES: AI[] = ['aggro','def','zerk','tact','assassin','aggro','zerk','tact','assassin','def'];
type AI = 'aggro'|'def'|'zerk'|'tact'|'assassin';

// ─── Interfaces ───
interface V2 { x: number; y: number }
interface Joint { x: number; y: number; px: number; py: number; vx: number; vy: number; r: number; m: number }
interface Con { a: number; b: number; len: number; s: number }
interface Bot {
  id: number; name: string; joints: Joint[]; cons: Con[]; color: string; glow: string;
  hp: number; alive: boolean; stun: number; atkCd: number; dodgeCd: number; specCd: number;
  kills: number; dmgDone: number; rage: number; style: AI; facing: number; combo: number; lastHit: number;
}
interface Ptcl { x: number; y: number; vx: number; vy: number; life: number; ml: number; color: string; sz: number; t: number }
interface DmgTxt { x: number; y: number; txt: string; life: number; color: string; sz: number }
interface State {
  bots: Bot[]; ptcls: Ptcl[]; txts: DmgTxt[]; shakeX: number; shakeY: number;
  t: number; over: boolean; winner: Bot|null; round: number; slow: number; winTimer: number;
}

// ─── Glow texture cache (replaces expensive shadowBlur) ───
const glowCache = new Map<string, HTMLCanvasElement>();
function getGlow(color: string, radius: number): HTMLCanvasElement {
  const key = `${color}_${radius|0}`;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  const s = radius * 2 + 4;
  c.width = s; c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, radius);
  g.addColorStop(0, color + 'cc');
  g.addColorStop(0.4, color + '66');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  glowCache.set(key, c);
  return c;
}

// ─── Physics helpers ───
function dist(a: V2, b: V2) { return Math.hypot(a.x - b.x, a.y - b.y); }

function mkJoint(x: number, y: number, r: number, m: number): Joint {
  return { x, y, px: x, py: y, vx: 0, vy: 0, r, m };
}

function mkBot(i: number): Bot {
  const bx = 80 + (W - 160) * (i / 9), by = GY - 60;
  const j = (ox: number, oy: number, r: number, m: number) => mkJoint(bx+ox, by+oy, r, m);
  const joints = [
    j(0,-55,10,3), j(0,-42,4,2), j(0,-28,6,4), j(0,-10,6,4),       // head,neck,torso,hip
    j(-14,-38,4,1.5), j(-26,-24,3,1), j(-34,-12,4,1.5),             // L arm
    j(14,-38,4,1.5), j(26,-24,3,1), j(34,-12,4,1.5),                // R arm
    j(-8,0,4,2), j(-10,18,3,1.5), j(-12,36,5,2),                    // L leg
    j(8,0,4,2), j(10,18,3,1.5), j(12,36,5,2),                       // R leg
  ];
  const c = (a: number, b: number, s=0.8): Con => ({ a, b, len: dist(joints[a], joints[b]), s });
  const cons = [
    c(0,1,.95),c(1,2,.9),c(2,3,.9), c(1,4,.85),c(4,5,.8),c(5,6,.8),
    c(1,7,.85),c(7,8,.8),c(8,9,.8), c(3,10,.85),c(10,11,.8),c(11,12,.8),
    c(3,13,.85),c(13,14,.8),c(14,15,.8), c(0,2,.5),c(4,7,.4),c(10,13,.4),c(2,10,.3),c(2,13,.3),
  ];
  return {
    id: i, name: NAMES[i], joints, cons, color: COLORS[i], glow: GLOWS[i],
    hp: 100, alive: true, stun: 0, atkCd: 0, dodgeCd: 0, specCd: 0,
    kills: 0, dmgDone: 0, rage: 0, style: STYLES[i], facing: i < 5 ? 1 : -1, combo: 0, lastHit: -1,
  };
}

function center(b: Bot): V2 {
  let cx = 0, cy = 0;
  for (const j of b.joints) { cx += j.x; cy += j.y; }
  return { x: cx / b.joints.length, y: cy / b.joints.length };
}

function pushAll(b: Bot, fx: number, fy: number) {
  for (const j of b.joints) { j.vx += fx / j.m; j.vy += fy / j.m; }
}

function pushJoint(b: Bot, i: number, fx: number, fy: number) {
  const j = b.joints[i]; j.vx += fx / j.m; j.vy += fy / j.m;
}

function stepPhysics(b: Bot, dt: number) {
  for (const j of b.joints) {
    j.vy += G * dt;
    const onG = j.y + j.r >= GY;
    const f = onG ? FRIC : 0.998;
    j.vx *= f; j.vy *= f;
    j.px = j.x; j.py = j.y;
    j.x += j.vx * dt; j.y += j.vy * dt;
    if (j.x - j.r < 0) { j.x = j.r; j.vx *= -0.4; }
    if (j.x + j.r > W) { j.x = W - j.r; j.vx *= -0.4; }
    if (j.y + j.r > GY) { j.y = GY - j.r; j.vy *= -0.4; j.vx *= 0.92; }
    if (j.y - j.r < 0) { j.y = j.r; j.vy *= -0.4; }
  }
  for (let it = 0; it < 4; it++) {
    for (const c of b.cons) {
      const a = b.joints[c.a], b2 = b.joints[c.b];
      const dx = b2.x - a.x, dy = b2.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const diff = (d - c.len) / d;
      const tm = a.m + b2.m;
      const ma = c.s * diff * (a.m / tm), mb = c.s * diff * (b2.m / tm);
      a.x += dx * ma; a.y += dy * ma;
      b2.x -= dx * mb; b2.y -= dy * mb;
    }
  }
}

// ─── AI ───
function nearest(self: Bot, bots: Bot[]): Bot | null {
  let best: Bot|null = null, bd = Infinity;
  const sc = center(self);
  for (const b of bots) {
    if (b.id === self.id || !b.alive) continue;
    const d = dist(sc, center(b));
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function weakest(self: Bot, bots: Bot[]): Bot | null {
  let best: Bot|null = null, bh = Infinity;
  for (const b of bots) {
    if (b.id === self.id || !b.alive) continue;
    if (b.hp < bh) { bh = b.hp; best = b; }
  }
  return best;
}

function moveToward(b: Bot, tx: number, spd: number) {
  const dir = tx > center(b).x ? 1 : -1;
  b.facing = dir;
  pushJoint(b, 12, dir * spd, 0);
  pushJoint(b, 15, dir * spd, 0);
  pushJoint(b, 3, dir * spd * 0.5, 0);
}

function jump(b: Bot, p = 8) {
  if (b.joints.some(j => j.y + j.r >= GY - 5)) pushAll(b, 0, -p);
}

function punch(a: Bot, t: Bot, pow: number) {
  if (a.atkCd > 0) return;
  const tc = center(t), sc = center(a);
  const d = dist(sc, tc) || 1;
  const nx = (tc.x - sc.x) / d, ny = (tc.y - sc.y) / d;
  pushJoint(a, Math.random() > .5 ? 6 : 9, nx * pow * 2, ny * pow * 1.5 - 1);
  a.atkCd = 12 + Math.random() * 8;
}

function kick(a: Bot, t: Bot, pow: number) {
  if (a.atkCd > 0) return;
  const tc = center(t), sc = center(a);
  const d = dist(sc, tc) || 1;
  const nx = (tc.x - sc.x) / d, ny = (tc.y - sc.y) / d;
  pushJoint(a, Math.random() > .5 ? 12 : 15, nx * pow * 2.5, ny * pow - 2);
  a.atkCd = 18 + Math.random() * 10;
}

function dodge(b: Bot, awayX: number) {
  if (b.dodgeCd > 0) return;
  const dir = awayX > center(b).x ? -1 : 1;
  pushAll(b, dir * 6, -3);
  b.dodgeCd = 40;
}

function special(a: Bot, t: Bot, type: number) {
  if (a.atkCd > 0 || a.specCd > 0) return;
  const tc = center(t), sc = center(a);
  const dir = tc.x > sc.x ? 1 : -1;
  if (type === 0) { // uppercut
    pushJoint(a, 6, dir * 4, -12); pushJoint(a, 9, dir * 4, -12);
    a.atkCd = 25; a.specCd = 60;
  } else if (type === 1) { // spin kick
    pushJoint(a, 12, dir * 10, -3); pushJoint(a, 15, dir * 10, -3); pushAll(a, dir * 2, -2);
    a.atkCd = 20; a.specCd = 50;
  } else { // body slam
    jump(a, 10); pushAll(a, dir * 8, 0);
    a.atkCd = 30; a.specCd = 80;
  }
}

function runAI(b: Bot, s: State) {
  if (!b.alive || b.stun > 0) { b.stun = Math.max(0, b.stun - 1); return; }
  b.atkCd = Math.max(0, b.atkCd - 1);
  b.dodgeCd = Math.max(0, b.dodgeCd - 1);
  b.specCd = Math.max(0, b.specCd - 1);
  const bc = center(b);
  const t = b.style === 'tact' || b.style === 'assassin' ? weakest(b, s.bots) || nearest(b, s.bots) : nearest(b, s.bots);
  if (!t) return;
  const tc = center(t), d = dist(bc, tc);
  const rm = 1 + b.rage / 150;

  switch (b.style) {
    case 'aggro':
      moveToward(b, tc.x, 0.8 * rm);
      if (d < 80) { Math.random() < .5 ? punch(b, t, 6) : kick(b, t, 7); if (b.rage > 50) special(b, t, 0); }
      else if (d < 120 && Math.random() < .3) jump(b, 6);
      b.rage = Math.min(100, b.rage + 0.3);
      break;
    case 'def':
      if (d < 90) { Math.random() < .6 ? punch(b, t, 5) : kick(b, t, 6); if (Math.random() < .15) dodge(b, tc.x); }
      else if (d > 150) moveToward(b, tc.x, 0.4);
      else if (d < 110) moveToward(b, bc.x + (bc.x > tc.x ? 1 : -1) * 50, 0.4);
      if (b.hp < 30 && b.specCd <= 0 && d < 80) special(b, t, 1);
      break;
    case 'zerk':
      moveToward(b, tc.x, 1.0 * rm);
      if (d < 100) {
        const r = Math.random();
        if (r < .35) punch(b, t, 7 * rm); else if (r < .65) kick(b, t, 8 * rm); else special(b, t, 2);
        if (Math.random() < .2) jump(b, 7);
      }
      b.rage = Math.min(100, b.rage + (b.hp < 50 ? 1.3 : 0.5));
      break;
    case 'tact': {
      const threats = s.bots.filter(r => r.id !== b.id && r.alive && dist(bc, center(r)) < 120);
      if (threats.length >= 2 && b.dodgeCd <= 0) {
        const ax = threats.reduce((s, r) => s + center(r).x, 0) / threats.length;
        dodge(b, ax); break;
      }
      if (d < 85) {
        if (t.stun > 0) { punch(b, t, 7); kick(b, t, 7); }
        else Math.random() < .4 ? punch(b, t, 5) : kick(b, t, 5);
        if (b.specCd <= 0 && t.hp < 25) special(b, t, 0);
      } else { moveToward(b, tc.x, 0.6); if (d > 200) jump(b, 5); }
      break;
    }
    case 'assassin':
      if (t.hp > 50 && d > 150) { moveToward(b, tc.x, 0.3); break; }
      if (d < 70) {
        if (b.specCd <= 0) { special(b, t, 1); punch(b, t, 8); }
        else punch(b, t, 6);
        if (b.atkCd > 5) dodge(b, tc.x);
      } else if (d < 140) { moveToward(b, tc.x, 0.9); if (Math.random() < .15) jump(b, 6); }
      else moveToward(b, tc.x, 0.5);
      break;
  }
  if (bc.x < 50) pushAll(b, 1.5, 0);
  if (bc.x > W - 50) pushAll(b, -1.5, 0);
}

// ─── Hit detection & handling ───
function checkHits(s: State) {
  const atkIdx = [6, 9, 12, 15]; // fists + feet
  for (let i = 0; i < s.bots.length; i++) {
    for (let j = i + 1; j < s.bots.length; j++) {
      const a = s.bots[i], b = s.bots[j];
      if (!a.alive || !b.alive) continue;
      // Separation
      const ca = center(a), cb = center(b), d = dist(ca, cb);
      if (d < 30 && d > 0) {
        const p = (30 - d) * 0.15, nx = (ca.x - cb.x) / d, ny = (ca.y - cb.y) / d;
        pushAll(a, nx * p, ny * p); pushAll(b, -nx * p, -ny * p);
      }
      // Attack checks both ways
      tryHit(s, a, b, atkIdx);
      tryHit(s, b, a, atkIdx);
    }
  }
}

function tryHit(s: State, atk: Bot, def: Bot, atkIdx: number[]) {
  for (const ai of atkIdx) {
    const aj = atk.joints[ai];
    const spd = Math.hypot(aj.vx, aj.vy);
    if (spd < 2.5 || atk.atkCd > 15) continue;
    for (let bi = 0; bi < def.joints.length; bi++) {
      const bj = def.joints[bi];
      const d = Math.hypot(aj.x - bj.x, aj.y - bj.y);
      if (d < aj.r + bj.r + 2) {
        applyHit(s, atk, def, ai, bi, spd);
        return;
      }
    }
  }
}

function applyHit(s: State, atk: Bot, def: Bot, ai: number, bi: number, spd: number) {
  const isFist = ai === 6 || ai === 9, isFoot = ai === 12 || ai === 15, isHead = bi === 0;
  let dmg = spd * 1.2;
  if (isFist) dmg *= 1.3; if (isFoot) dmg *= 1.5; if (isHead) dmg *= 1.8;
  if (atk.rage > 50) dmg *= 1 + atk.rage / 200;
  if (def.lastHit === atk.id) { atk.combo++; dmg *= 1 + atk.combo * 0.15; } else atk.combo = 1;
  dmg = Math.min(dmg, 35);

  def.hp -= dmg; def.lastHit = atk.id; def.stun = Math.min(15, 5 + dmg * 0.3);
  atk.dmgDone += dmg; atk.rage = Math.min(100, atk.rage + dmg * 0.3);

  const aj = atk.joints[ai], bj = def.joints[bi];
  const d = Math.hypot(bj.x - aj.x, bj.y - aj.y) || 1;
  const kb = 1.5 + dmg * 0.08;
  pushAll(def, ((bj.x - aj.x) / d) * kb * spd * 0.5, ((bj.y - aj.y) / d) * kb * spd * 0.3 - 2);

  const hx = (aj.x + bj.x) / 2, hy = (aj.y + bj.y) / 2;
  addPtcls(s, hx, hy, Math.min(8, 3 + (dmg * 0.3) | 0), atk.color, 3);
  if (dmg > 15) { s.shakeX += (Math.random() - .5) * dmg * 0.4; s.shakeY += (Math.random() - .5) * dmg * 0.4; }
  else { s.shakeX += (Math.random() - .5) * dmg * 0.2; s.shakeY += (Math.random() - .5) * dmg * 0.2; }
  s.txts.push({ x: hx + (Math.random()-.5)*20, y: hy - 15, txt: `-${Math.round(dmg)}`, life: 40, color: isHead ? '#fff' : atk.glow, sz: Math.min(20, 10 + dmg * 0.4) });

  if (def.hp <= 0) {
    def.hp = 0; def.alive = false; atk.kills++; atk.rage = 100; s.slow = 0.3;
    const dc = center(def);
    addPtcls(s, dc.x, dc.y, 20, def.color, 5);
    addPtcls(s, dc.x, dc.y, 10, '#ff6600', 3);
    s.shakeX += (Math.random()-.5) * 12; s.shakeY += (Math.random()-.5) * 12;
    s.txts.push({ x: dc.x, y: dc.y - 30, txt: `${def.name} OUT`, life: 60, color: '#ff4444', sz: 14 });
  }
}

function addPtcls(s: State, x: number, y: number, n: number, color: string, spd: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = Math.random() * spd + spd * 0.3;
    s.ptcls.push({ x: x + (Math.random()-.5)*6, y: y + (Math.random()-.5)*6, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: 15 + Math.random()*20, ml: 15 + Math.random()*20, color, sz: 1 + Math.random()*3, t: 0 });
  }
}

// ─── Create state ───
function mkState(round: number): State {
  return {
    bots: Array.from({length: 10}, (_, i) => mkBot(i)),
    ptcls: [], txts: [], shakeX: 0, shakeY: 0, t: 0,
    over: false, winner: null, round, slow: 1, winTimer: 0,
  };
}

// ─── Update ───
function update(s: State): boolean {
  s.t++;
  if (s.slow < 1) s.slow = Math.min(1, s.slow + 0.02);
  const dt = s.slow;

  for (const b of s.bots) { if (b.alive) stepPhysics(b, dt); }
  for (const b of s.bots) { if (b.alive) runAI(b, s); }
  checkHits(s);

  // Particles
  for (let i = s.ptcls.length - 1; i >= 0; i--) {
    const p = s.ptcls[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.1; p.vx *= 0.98; p.life -= dt;
    if (p.life <= 0) s.ptcls.splice(i, 1);
  }
  if (s.ptcls.length > 300) s.ptcls.splice(0, s.ptcls.length - 300);

  // Damage texts
  for (let i = s.txts.length - 1; i >= 0; i--) {
    s.txts[i].y -= 0.8; s.txts[i].life -= 1;
    if (s.txts[i].life <= 0) s.txts.splice(i, 1);
  }

  s.shakeX *= 0.85; s.shakeY *= 0.85;
  if (Math.abs(s.shakeX) < 0.1) s.shakeX = 0;
  if (Math.abs(s.shakeY) < 0.1) s.shakeY = 0;

  const alive = s.bots.filter(b => b.alive);
  if (alive.length <= 1 && !s.over) {
    s.over = true; s.winner = alive[0] || null;
    if (s.winner) { const c = center(s.winner); addPtcls(s, c.x, c.y, 30, s.winner.color, 6); }
    return true;
  }
  return s.over;
}

// ─── Render ───
// Pre-render background once
let bgCanvas: HTMLCanvasElement | null = null;
function getBg(): HTMLCanvasElement {
  if (bgCanvas) return bgCanvas;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = W; bgCanvas.height = H;
  const c = bgCanvas.getContext('2d')!;
  const grad = c.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#080810'); grad.addColorStop(0.5, '#0a0a16'); grad.addColorStop(1, '#0e0e1e');
  c.fillStyle = grad; c.fillRect(0, 0, W, H);
  // Grid
  c.strokeStyle = 'rgba(255,255,255,0.015)'; c.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  // Floor
  const fg = c.createLinearGradient(0, GY, 0, H);
  fg.addColorStop(0, '#14142a'); fg.addColorStop(1, '#0a0a18');
  c.fillStyle = fg; c.fillRect(0, GY, W, H - GY);
  // Floor line
  c.strokeStyle = '#ff224466'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, GY); c.lineTo(W, GY); c.stroke();
  // Floor segments
  c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 1;
  for (let x = 0; x < W; x += 60) { c.beginPath(); c.moveTo(x, GY); c.lineTo(x, H); c.stroke(); }
  return bgCanvas;
}

function render(ctx: CanvasRenderingContext2D, s: State, cw: number, ch: number) {
  const sx = cw / W, sy = ch / H;
  ctx.save();
  if (s.shakeX || s.shakeY) ctx.translate(s.shakeX * sx, s.shakeY * sy);
  ctx.scale(sx, sy);

  // BG (pre-rendered)
  ctx.drawImage(getBg(), 0, 0);

  // Ambient glow from fighters (cheap radial gradients)
  for (const b of s.bots) {
    if (!b.alive) continue;
    const bc = center(b);
    const gc = getGlow(b.color, 60);
    ctx.globalAlpha = 0.15;
    ctx.drawImage(gc, bc.x - 62, bc.y - 62);
    ctx.globalAlpha = 1;
  }

  // Particles (simple circles, no shadow)
  for (const p of s.ptcls) {
    const a = Math.max(0, p.life / p.ml);
    if (a < 0.01) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const r = Math.max(0.3, p.sz * a);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Dead bots
  for (const b of s.bots) { if (!b.alive) drawBot(ctx, b, s, true); }
  // Alive bots
  for (const b of s.bots) { if (b.alive) drawBot(ctx, b, s, false); }

  // Damage texts
  for (const t of s.txts) {
    ctx.globalAlpha = Math.min(1, t.life / 15);
    ctx.font = `bold ${t.sz}px Orbitron,sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillText(t.txt, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // HUD
  drawHUD(ctx, s);

  ctx.restore();
}

function drawBot(ctx: CanvasRenderingContext2D, b: Bot, s: State, dead: boolean) {
  const j = b.joints;
  ctx.globalAlpha = dead ? 0.2 : 1;
  const col = dead ? '#555' : b.color;
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const limb = (a: number, bi: number, w: number) => {
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(j[a].x, j[a].y); ctx.lineTo(j[bi].x, j[bi].y); ctx.stroke();
  };

  // Body
  limb(1,2,5); limb(2,3,4.5);
  limb(1,4,3.5); limb(4,5,3); limb(5,6,3);
  limb(1,7,3.5); limb(7,8,3); limb(8,9,3);
  limb(3,10,3.5); limb(10,11,3); limb(11,12,3);
  limb(3,13,3.5); limb(13,14,3); limb(14,15,3);

  // Head
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(j[0].x, j[0].y, j[0].r, 0, 6.283); ctx.fill();

  if (!dead) {
    // Glow on fists (pre-rendered texture instead of shadowBlur)
    const gc = getGlow(b.glow, 16);
    ctx.drawImage(gc, j[6].x - 18, j[6].y - 18);
    ctx.drawImage(gc, j[9].x - 18, j[9].y - 18);

    // Fist dots
    ctx.fillStyle = b.glow;
    ctx.beginPath(); ctx.arc(j[6].x, j[6].y, j[6].r + 1, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(j[9].x, j[9].y, j[9].r + 1, 0, 6.283); ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    const eo = b.facing * 3;
    ctx.beginPath();
    ctx.arc(j[0].x + eo - 2.5, j[0].y - 2, 1.8, 0, 6.283);
    ctx.arc(j[0].x + eo + 2.5, j[0].y - 2, 1.8, 0, 6.283);
    ctx.fill();

    // Feet
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(j[12].x, j[12].y, j[12].r, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(j[15].x, j[15].y, j[15].r, 0, 6.283); ctx.fill();

    // HP bar
    const bw = 36, bh = 4;
    const bx = j[0].x - bw/2, by = j[0].y - j[0].r - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx-1, by-1, bw+2, bh+2);
    const hp = b.hp / 100;
    ctx.fillStyle = hp > .5 ? '#00ff88' : hp > .25 ? '#ffaa00' : '#ff2244';
    ctx.fillRect(bx, by, bw * hp, bh);

    // Name
    ctx.font = 'bold 7px Orbitron,sans-serif'; ctx.fillStyle = b.glow; ctx.textAlign = 'center';
    ctx.fillText(b.name, j[0].x, by - 3);

    // Rage aura
    if (b.rage > 60) {
      const bc = center(b);
      const gc2 = getGlow(b.color, 40);
      ctx.globalAlpha = (b.rage - 60) / 200;
      ctx.drawImage(gc2, bc.x - 42, bc.y - 42);
      ctx.globalAlpha = 1;
    }
  }
  ctx.globalAlpha = 1;
}

function drawHUD(ctx: CanvasRenderingContext2D, s: State) {
  ctx.font = 'bold 14px "Press Start 2P",Orbitron,sans-serif';
  ctx.fillStyle = '#ffffff77'; ctx.textAlign = 'center';
  ctx.fillText(`ROUND ${s.round}`, W/2, 25);

  const alive = s.bots.filter(b => b.alive).length;
  ctx.font = 'bold 10px Orbitron,sans-serif';
  ctx.fillStyle = alive <= 3 ? '#ff4444' : '#999';
  ctx.fillText(`${alive} FIGHTERS REMAINING`, W/2, 44);

  // Bottom strip
  const sy = H - 25, sw = W - 40, iw = sw / 10;
  for (let i = 0; i < 10; i++) {
    const b = s.bots[i], x = 20 + i * iw;
    ctx.globalAlpha = b.alive ? 1 : 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, sy, iw - 4, 12);
    if (b.alive) { ctx.fillStyle = b.color; ctx.fillRect(x, sy, (iw - 4) * (b.hp / 100), 12); }
    ctx.font = '6px Orbitron,sans-serif'; ctx.fillStyle = b.alive ? '#fff' : '#555'; ctx.textAlign = 'left';
    ctx.fillText(b.name, x + 2, sy + 9);
    if (b.kills > 0) { ctx.fillStyle = '#ffaa00'; ctx.textAlign = 'right'; ctx.fillText(`${b.kills}K`, x + iw - 6, sy + 9); }
  }
  ctx.globalAlpha = 1;
}

function drawWinner(ctx: CanvasRenderingContext2D, s: State, cw: number, ch: number) {
  const sx = cw / W, sy2 = ch / H;
  ctx.save(); ctx.scale(sx, sy2);
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);

  const w = s.winner;
  if (!w) { ctx.restore(); return; }
  const cx = W / 2, cy = H / 2 - 40;

  // Winner glow
  const gc = getGlow(w.color, 180);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(gc, cx - 182, cy - 182);
  ctx.globalAlpha = 1;

  ctx.font = 'bold 48px "Press Start 2P",Orbitron,sans-serif';
  ctx.textAlign = 'center'; ctx.fillStyle = w.color;
  ctx.fillText('WINNER', cx, cy - 50);

  ctx.font = 'bold 32px Orbitron,sans-serif'; ctx.fillStyle = w.glow;
  ctx.fillText(w.name, cx, cy + 10);

  ctx.font = '14px Orbitron,sans-serif'; ctx.fillStyle = '#aaa';
  ctx.fillText(`Kills: ${w.kills}  |  DMG: ${Math.round(w.dmgDone)}  |  HP: ${Math.round(w.hp)}`, cx, cy + 50);

  ctx.font = 'bold 12px Orbitron,sans-serif'; ctx.fillStyle = w.color + 'cc';
  ctx.fillText(`${w.style.toUpperCase()}`, cx, cy + 75);

  // Leaderboard
  const sorted = [...s.bots].sort((a, b) => b.kills - a.kills || b.dmgDone - a.dmgDone);
  ctx.font = '10px Orbitron,sans-serif'; ctx.fillStyle = '#888';
  const ly = cy + 110;
  ctx.fillText('LEADERBOARD', cx, ly);
  for (let i = 0; i < 5; i++) {
    const r = sorted[i];
    ctx.fillStyle = r.id === w.id ? w.color : '#666';
    ctx.font = '9px Orbitron,sans-serif';
    ctx.fillText(`${i+1}. ${r.name} - ${r.kills}K - ${Math.round(r.dmgDone)} dmg`, cx, ly + 18 + i * 16);
  }

  ctx.font = 'bold 16px Orbitron,sans-serif'; ctx.fillStyle = '#ffffff88';
  ctx.fillText(`Next round in ${Math.ceil((300 - s.winTimer) / 60)}...`, cx, H - 50);

  ctx.restore();
}

// ─── Component ───
const RagdollArena = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State>(mkState(1));
  const animRef = useRef<number>(0);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = stateRef.current;

    if (s.over) {
      s.winTimer++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      render(ctx, s, canvas.width, canvas.height);
      drawWinner(ctx, s, canvas.width, canvas.height);
      if (s.winTimer >= 300) {
        stateRef.current = mkState(s.round + 1);
      }
    } else {
      update(s);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      render(ctx, s, canvas.width, canvas.height);
    }
    animRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    animRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
  }, [loop]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};

export default RagdollArena;
