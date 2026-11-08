(() => {
'use strict';

// ============================================================
//  Hungry Hungry Unicorns  —  a fairy game for two sisters
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let W = 0, H = 0, DPR = 1;
const PLAY_TOP = 84;          // keep unicorns below the score bar
const JOY_R = 60;             // touch joystick radius (2 players)
const TIMER_SECONDS = 60;

// ---------- helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const FONT = "'Fredoka', 'Arial Rounded MT Bold', 'Comic Sans MS', sans-serif";

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function star(c, x, y, r, points = 5) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / points;
    const rr = i % 2 === 0 ? r : r * 0.45;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

// ---------- palettes ----------
const UNICORN_COLORS = [
  { name: 'Pink',    body: '#ff9ecf', dark: '#e0609f' },
  { name: 'Purple',  body: '#c39bff', dark: '#8a5cf0' },
  { name: 'Blue',    body: '#8fd0ff', dark: '#4a9be0' },
  { name: 'Mint',    body: '#9ff0c8', dark: '#3fc08a' },
  { name: 'Yellow',  body: '#ffe58a', dark: '#e0b830' },
  { name: 'Peach',   body: '#ffb995', dark: '#e8804f' },
  { name: 'White',   body: '#ffffff', dark: '#c9c3e6' },
  { name: 'Rainbow', body: 'rainbow', dark: '#b060e0' },
];
const MANE = ['#ff5e7e', '#ffb347', '#fff26b', '#7ee787', '#6ec6ff', '#b48cff'];
const BALL_COLORS = ['#ff6b8a', '#ffa94d', '#ffe066', '#8ce99a', '#66d9e8', '#9775fa', '#f783ac', '#63e6be', '#ff8787', '#74c0fc'];
const FLOWER_COLORS = ['#ff6b8a', '#ffd43b', '#ff922b', '#f783ac', '#da77f2', '#74c0fc', '#fff'];
const FAIRY_COLORS = ['#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#f78c6b', '#c77dff'];
const HAIR_COLORS = ['#f4a261', '#6d3b1f', '#ffe066', '#2b2d42', '#e07a5f', '#9b5de5'];
const POWERS = {
  speed:  { icon: '⚡', label: 'ZOOM!',      dur: 6 },
  giant:  { icon: '⭐', label: 'BIG MOUTH!', dur: 6 },
  magnet: { icon: '🧲', label: 'MAGNET!',    dur: 6 },
};
const YUMS = ['Yum!', 'Nom nom!', 'Mmm!', 'Chomp!', 'Yummy!', 'Gobble!', 'Tasty!'];

// ---------- save data ----------
const DEFAULTS = { names: ['', ''], colors: [0, 1], players: 1, mode: 'timer', best: 0, muted: false };
let save;
try { save = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('hhu-save') || '{}')); }
catch { save = Object.assign({}, DEFAULTS); }
function persist() { try { localStorage.setItem('hhu-save', JSON.stringify(save)); } catch { /* ignore */ } }

// ---------- sound (all synthesized, no files) ----------
const Sound = {
  ctx: null, muted: save.muted,
  init() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise(dur, vol) {
    if (!this.ctx || this.muted) return;
    const n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = buf; g.gain.value = vol;
    s.connect(g).connect(this.ctx.destination); s.start();
  },
  chomp()   { this.tone(340, 0.13, 'square', 0.1, 0, 80); this.noise(0.09, 0.12); },
  power()   { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.16, i * 0.07)); },
  tick()    { this.tone(880, 0.1, 'sine', 0.18); },
  go()      { this.tone(660, 0.25, 'triangle', 0.2); this.tone(990, 0.45, 'triangle', 0.2, 0.12); },
  fanfare() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.2, i * 0.13)); },
  cheer()   { for (let i = 0; i < 4; i++) this.tone(rand(380, 620), 0.35, 'sine', 0.05, i * 0.04, rand(700, 1000)); },
  click()   { this.tone(700, 0.07, 'sine', 0.12, 0, 1000); },
};

// ---------- state ----------
const state = {
  screen: 'home', playing: false, paused: false, ended: false,
  players: 1, mode: 'timer', countdown: 0, timeLeft: 0, targetBalls: 0,
  unicorns: [], balls: [], particles: [], floaters: [],
  cheer: 0, lastTick: -1, winner: null, confetti: 0, demo: [],
};
const scenery = { groundH: 0, groundY: 0, hills: [], flowers: [], mushrooms: [], lights: [], crowd: [], clouds: [] };

const screens = { home: $('#home'), setup: $('#setup'), hud: $('#hud'), pause: $('#pause'), results: $('#results') };
function show(...names) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', !names.includes(k));
  state.screen = names[0];
}

// ---------- resize & scenery ----------
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildScenery();
}
window.addEventListener('resize', resize);

function buildScenery() {
  const g = scenery;
  g.groundH = Math.max(70, H * 0.13); g.groundY = H - g.groundH;
  g.flowers = []; for (let i = 0; i < Math.floor(W / 26); i++) g.flowers.push({ x: rand(0, W), y: g.groundY + rand(6, g.groundH - 8), size: rand(5, 10), color: pick(FLOWER_COLORS), phase: rand(0, 7), stem: rand(10, 24) });
  g.mushrooms = []; for (let i = 0; i < Math.floor(W / 170) + 2; i++) g.mushrooms.push({ x: rand(20, W - 20), y: g.groundY + rand(14, g.groundH - 12), size: rand(14, 26), color: pick(['#ff5e7e', '#ff8fa3', '#ffb347', '#da77f2']) });
  g.lights = []; for (let i = 0; i < 45; i++) g.lights.push({ x: rand(0, W), y: rand(0, g.groundY), r: rand(2, 5), phase: rand(0, 7), speed: rand(6, 16), color: pick(['#fff7b0', '#ffd6f5', '#c8f5ff', '#e0ffd6']) });
  g.clouds = []; for (let i = 0; i < 5; i++) g.clouds.push({ x: rand(0, W), y: rand(40, H * 0.4), s: rand(0.7, 1.4), speed: rand(8, 18) });
  const n = Math.max(4, Math.floor(W / 140));
  g.crowd = []; for (let i = 0; i < n; i++) g.crowd.push({ x: (i + 0.5) * (W / n) + rand(-25, 25), y: g.groundY + rand(18, g.groundH - 18), s: rand(15, 21), phase: rand(0, 7), color: pick(FAIRY_COLORS), hair: pick(HAIR_COLORS), wing: pick(['rgba(255,255,255,.75)', 'rgba(200,240,255,.75)', 'rgba(255,220,250,.75)']) });
  g.hills = [{ y: g.groundY - 46, amp: 44, freq: 0.0035, off: 1.3, color: '#b7e4c7' }, { y: g.groundY - 22, amp: 30, freq: 0.0065, off: 4, color: '#95d5b2' }];
}

// ---------- drawing: scenery ----------
function drawBackground(t) {
  const g = scenery;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#9fd3ff'); sky.addColorStop(0.55, '#e4c6ff'); sky.addColorStop(1, '#ffd9ec');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  // rainbow arc
  ctx.save(); ctx.globalAlpha = 0.45; ctx.lineWidth = Math.max(10, W * 0.012);
  MANE.forEach((m, i) => { ctx.strokeStyle = m; ctx.beginPath(); ctx.arc(W * 0.75, g.groundY + 40, Math.max(4, W * 0.34 - i * ctx.lineWidth), Math.PI, Math.PI * 2); ctx.stroke(); });
  ctx.restore();

  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of g.clouds) {
    const x = ((c.x + t * c.speed) % (W + 200)) - 100;
    ctx.beginPath();
    ctx.arc(x, c.y, 22 * c.s, 0, Math.PI * 2); ctx.arc(x + 25 * c.s, c.y - 12 * c.s, 28 * c.s, 0, Math.PI * 2);
    ctx.arc(x + 55 * c.s, c.y, 22 * c.s, 0, Math.PI * 2); ctx.fill();
  }

  // floating lights
  for (const l of g.lights) {
    const y = ((l.y - t * l.speed) % g.groundY + g.groundY) % g.groundY;
    const a = 0.35 + 0.35 * Math.sin(t * 2 + l.phase);
    ctx.fillStyle = l.color; ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(l.x + Math.sin(t + l.phase) * 8, y, l.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // hills
  for (const h of g.hills) {
    ctx.fillStyle = h.color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, h.y + Math.sin(x * h.freq + h.off) * h.amp);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }

  // ground
  const gr = ctx.createLinearGradient(0, g.groundY, 0, H); gr.addColorStop(0, '#7ccf86'); gr.addColorStop(1, '#4fae62');
  ctx.fillStyle = gr; ctx.fillRect(0, g.groundY, W, g.groundH);

  // mushrooms
  for (const m of g.mushrooms) {
    ctx.fillStyle = '#fff3e0'; roundRect(ctx, m.x - m.size * 0.22, m.y - m.size * 0.6, m.size * 0.44, m.size * 0.7, m.size * 0.1); ctx.fill();
    ctx.fillStyle = m.color; ctx.beginPath(); ctx.ellipse(m.x, m.y - m.size * 0.55, m.size * 0.6, m.size * 0.42, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; [[-0.3, -0.75], [0.1, -0.85], [0.35, -0.65]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(m.x + dx * m.size, m.y + dy * m.size, m.size * 0.08, 0, Math.PI * 2); ctx.fill(); });
  }

  // flowers
  for (const f of g.flowers) {
    const sway = Math.sin(t * 1.5 + f.phase) * 3;
    ctx.strokeStyle = '#2f9e44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(f.x + sway, f.y - f.stem / 2, f.x + sway, f.y - f.stem); ctx.stroke();
    ctx.fillStyle = f.color;
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + t * 0.3; ctx.beginPath(); ctx.arc(f.x + sway + Math.cos(a) * f.size * 0.55, f.y - f.stem + Math.sin(a) * f.size * 0.55, f.size * 0.42, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(f.x + sway, f.y - f.stem, f.size * 0.3, 0, Math.PI * 2); ctx.fill();
  }

  // cheering fairy crowd
  const cheer = state.cheer;
  for (const f of g.crowd) {
    const bounce = -Math.abs(Math.sin(t * (4 + cheer * 3) + f.phase)) * (6 + cheer * 22);
    drawFairy(ctx, f.x, f.y + bounce, f.s, f.color, f.hair, f.wing, t, f.phase, cheer > 0.15);
    if (cheer > 0.3 && Math.random() < 0.06) state.particles.push(makeSpark(f.x + rand(-20, 20), f.y - 30 + bounce, pick(MANE), 0.5));
  }
}

// ---------- drawing: fairy ----------
function drawFairy(c, x, y, s, color, hair, wing, t, phase, armsUp) {
  c.save(); c.translate(x, y); c.scale(s / 20, s / 20);
  const flap = 0.55 + 0.45 * Math.abs(Math.sin(t * 16 + phase));
  // wings
  c.fillStyle = wing;
  c.beginPath(); c.ellipse(-8 * flap, -14, 9 * flap, 7, -0.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(8 * flap, -14, 9 * flap, 7, 0.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(-6 * flap, -5, 6 * flap, 5, 0.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(6 * flap, -5, 6 * flap, 5, -0.4, 0, Math.PI * 2); c.fill();
  // legs
  c.strokeStyle = '#ffdcc2'; c.lineWidth = 2.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-3, 3); c.lineTo(-3.5, 10); c.moveTo(3, 3); c.lineTo(3.5, 10); c.stroke();
  // dress
  c.fillStyle = color; c.beginPath(); c.moveTo(-8, 4); c.lineTo(8, 4); c.lineTo(0, -13); c.closePath(); c.fill();
  // arms
  c.strokeStyle = '#ffdcc2'; c.lineWidth = 2.2;
  const hy = armsUp ? -24 : -4, hx = armsUp ? 9 : 8;
  c.beginPath(); c.moveTo(-4, -9); c.lineTo(-hx, hy); c.moveTo(4, -9); c.lineTo(hx, hy); c.stroke();
  // wand
  c.strokeStyle = '#ffe066'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 4, hy - 7); c.stroke();
  c.fillStyle = '#fff176'; star(c, hx + 4, hy - 8, 3.5); c.fill();
  // head
  c.fillStyle = '#ffdcc2'; c.beginPath(); c.arc(0, -18, 6, 0, Math.PI * 2); c.fill();
  // hair
  c.fillStyle = hair; c.beginPath(); c.arc(0, -19, 6.5, Math.PI, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(-5.5, -16, 2.2, 0, Math.PI * 2); c.arc(5.5, -16, 2.2, 0, Math.PI * 2); c.fill();
  // face
  c.fillStyle = '#3a1f4a'; c.beginPath(); c.arc(-2, -18, 0.9, 0, Math.PI * 2); c.arc(2, -18, 0.9, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#3a1f4a'; c.lineWidth = 0.9; c.beginPath(); c.arc(0, -16.5, 2, 0.2, Math.PI - 0.2); c.stroke();
  c.restore();
}

// ---------- drawing: unicorn ----------
function rainbowGradient(c, x0, x1) {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  MANE.forEach((m, i) => g.addColorStop(i / (MANE.length - 1), m));
  return g;
}

function drawUnicorn(c, u, t) {
  const r = u.r, col = u.color;
  const spd = Math.hypot(u.vx || 0, u.vy || 0);
  const hover = Math.sin(t * 3 + u.bob) * r * 0.06 + (u.jump || 0);
  c.save(); c.translate(u.x, u.y + hover); c.scale(u.facing, 1);

  const active = Object.keys(u.powers).filter(k => u.powers[k] > 0);
  if (active.length) {
    const g = c.createRadialGradient(0, -r * 0.2, r * 0.4, 0, -r * 0.2, r * 1.8);
    g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, -r * 0.2, r * 1.8, 0, Math.PI * 2); c.fill();
  }
  const bodyFill = col.body === 'rainbow' ? rainbowGradient(c, -r, r * 1.3) : col.body;

  // tail
  c.lineCap = 'round'; c.lineWidth = r * 0.14;
  MANE.forEach((m, i) => {
    c.strokeStyle = m; c.beginPath();
    const sx = -r * 0.9, sy = -r * 0.3 + i * r * 0.07;
    c.moveTo(sx, sy);
    c.quadraticCurveTo(sx - r * 0.55, sy - r * 0.15 + Math.sin(t * 4 + i) * r * 0.08, sx - r * 0.7 + Math.sin(t * 5 + i) * r * 0.06, sy + r * 0.35 + i * r * 0.04);
    c.stroke();
  });

  // legs
  const swing = Math.sin(t * 12 + u.bob) * Math.min(1, spd / 200) * 0.4;
  c.strokeStyle = col.dark; c.lineWidth = r * 0.05;
  [[-0.5, 1], [-0.2, -1], [0.25, 1], [0.55, -1]].forEach(([lx, dir]) => {
    c.save(); c.translate(lx * r, r * 0.4); c.rotate(swing * dir);
    c.fillStyle = bodyFill; roundRect(c, -r * 0.11, 0, r * 0.22, r * 0.55, r * 0.1); c.fill(); c.stroke();
    c.fillStyle = '#b48cff'; roundRect(c, -r * 0.12, r * 0.42, r * 0.24, r * 0.15, r * 0.06); c.fill();
    c.restore();
  });

  // body
  c.fillStyle = bodyFill; c.beginPath(); c.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-r * 0.1, r * 0.18, r * 0.6, r * 0.33, 0, 0, Math.PI * 2); c.fill();

  // neck + head
  const hx = r * 0.8, hy = -r * 0.75;
  c.fillStyle = bodyFill; c.beginPath();
  c.moveTo(r * 0.3, -r * 0.35); c.lineTo(hx - r * 0.25, hy - r * 0.25); c.lineTo(hx + r * 0.2, hy); c.lineTo(r * 0.9, -r * 0.05); c.closePath(); c.fill();
  c.beginPath(); c.arc(hx, hy, r * 0.42, 0, Math.PI * 2); c.fill(); c.stroke();

  // snout
  const sx = hx + r * 0.36, sy = hy + r * 0.16;
  c.fillStyle = bodyFill; c.beginPath(); c.ellipse(sx, sy, r * 0.32, r * 0.25, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(sx, sy, r * 0.29, r * 0.22, 0, 0, Math.PI * 2); c.fill();

  // mouth
  const m = u.mouth;
  if (m > 0.12) {
    c.fillStyle = '#7a2a4a'; c.beginPath(); c.ellipse(sx + r * 0.08, sy + r * 0.14, r * (0.1 + 0.2 * m), r * (0.04 + 0.3 * m), 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff7aa8'; c.beginPath(); c.ellipse(sx + r * 0.08, sy + r * 0.2 + r * 0.12 * m, r * (0.07 + 0.1 * m), r * (0.03 + 0.12 * m), 0, 0, Math.PI * 2); c.fill();
  } else {
    c.strokeStyle = col.dark; c.lineWidth = r * 0.04; c.beginPath(); c.arc(sx + r * 0.06, sy + r * 0.08, r * 0.1, 0.3, Math.PI - 0.5); c.stroke();
  }
  c.fillStyle = col.dark; c.beginPath(); c.arc(sx + r * 0.18, sy - r * 0.05, r * 0.03, 0, Math.PI * 2); c.fill();

  // blush
  c.fillStyle = 'rgba(255,120,160,0.45)'; c.beginPath(); c.ellipse(hx + r * 0.1, hy + r * 0.2, r * 0.12, r * 0.07, 0, 0, Math.PI * 2); c.fill();

  // eye
  const ex = hx + r * 0.08, ey = hy - r * 0.08;
  if (u.happy > 0) {
    c.strokeStyle = '#3a1f4a'; c.lineWidth = r * 0.06; c.lineCap = 'round';
    c.beginPath(); c.arc(ex, ey + r * 0.05, r * 0.12, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  } else {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, r * 0.14, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a1f4a'; c.beginPath(); c.arc(ex + r * 0.03, ey + r * 0.01, r * 0.085, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + r * 0.065, ey - r * 0.035, r * 0.035, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3a1f4a'; c.lineWidth = r * 0.03; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const a = -Math.PI * 0.8 + i * 0.4; c.beginPath(); c.moveTo(ex + Math.cos(a) * r * 0.14, ey + Math.sin(a) * r * 0.14); c.lineTo(ex + Math.cos(a) * r * 0.21, ey + Math.sin(a) * r * 0.21); c.stroke(); }
  }

  // ear
  c.fillStyle = bodyFill; c.strokeStyle = col.dark; c.lineWidth = r * 0.05;
  c.beginPath(); c.moveTo(hx - r * 0.12, hy - r * 0.3); c.lineTo(hx - r * 0.05, hy - r * 0.64); c.lineTo(hx + r * 0.12, hy - r * 0.36); c.closePath(); c.fill(); c.stroke();

  // horn
  const L = [hx - r * 0.02, hy - r * 0.38], R = [hx + r * 0.22, hy - r * 0.34], T = [hx + r * 0.26, hy - r * 1.12];
  const horn = c.createLinearGradient(L[0], L[1], T[0], T[1]); horn.addColorStop(0, '#ffe680'); horn.addColorStop(1, '#ffb703');
  c.fillStyle = horn; c.beginPath(); c.moveTo(...L); c.lineTo(...R); c.lineTo(...T); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(200,120,0,0.5)'; c.lineWidth = r * 0.025;
  for (let i = 1; i <= 3; i++) { const f = i / 4.2; c.beginPath(); c.moveTo(lerp(L[0], T[0], f), lerp(L[1], T[1], f)); c.lineTo(lerp(R[0], T[0], f), lerp(R[1], T[1], f)); c.stroke(); }

  // mane
  for (let i = 0; i < 6; i++) {
    const f = i / 5;
    const mx = lerp(hx - r * 0.2, r * 0.2, f), my = lerp(hy - r * 0.38, -r * 0.5, f);
    c.fillStyle = MANE[i]; c.beginPath(); c.arc(mx - Math.sin(t * 3 + i) * r * 0.03, my + r * 0.04, r * (0.18 - f * 0.04), 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = MANE[0]; c.beginPath(); c.arc(hx - r * 0.3, hy - r * 0.42, r * 0.12, 0, Math.PI * 2); c.fill();

  // fairy rider
  drawFairy(c, -r * 0.12, -r * 0.74, r * 0.5, u.fairy, u.hair, 'rgba(255,255,255,0.78)', t, u.bob, u.happy > 0 || spd > 180);

  c.restore();
}

// ---------- drawing: balls, particles, text ----------
function drawBall(c, b, t) {
  const bobY = Math.sin(t * 2.5 + b.bob) * 3;
  c.save(); c.translate(b.x, b.y + bobY); c.scale(b.scale, b.scale);
  if (b.kind !== 'normal') {
    const pulse = 0.8 + 0.2 * Math.sin(t * 6 + b.bob);
    c.fillStyle = `rgba(255,255,255,${0.4 * pulse})`; c.beginPath(); c.arc(0, 0, b.r * 1.9 * pulse, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = b.color; c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2); c.fill();
  const sh = c.createRadialGradient(-b.r * 0.3, -b.r * 0.3, b.r * 0.2, 0, 0, b.r);
  sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(0.6, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.22)');
  c.fillStyle = sh; c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2); c.fill();
  if (b.kind !== 'normal') {
    c.font = `${b.r * 1.3}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(POWERS[b.kind].icon, 0, b.r * 0.08);
  }
  c.restore();
}

function makeSpark(x, y, color, life = 0.7) {
  return { type: 'spark', x, y, vx: rand(-220, 220), vy: rand(-280, 100), life, max: life, color, size: rand(4, 9), rot: rand(0, 7), spin: rand(-8, 8) };
}
function spawnSparkles(x, y, n, colors) { for (let i = 0; i < n; i++) state.particles.push(makeSpark(x, y, pick(colors), rand(0.5, 0.9))); }
function spawnDust(u) {
  state.particles.push({ type: 'dust', x: u.x - u.facing * u.r * 0.9 + rand(-6, 6), y: u.y + rand(-u.r * 0.3, u.r * 0.3), vx: -u.vx * 0.1 + rand(-20, 20), vy: rand(-30, 10), life: rand(0.4, 0.8), max: 0.8, color: pick(MANE), size: rand(3, 6) });
}
function spawnConfetti() {
  state.particles.push({ type: 'confetti', x: rand(0, W), y: -10, vx: rand(-30, 30), vy: rand(90, 200), life: 5, max: 5, color: pick(BALL_COLORS), size: rand(7, 12), rot: rand(0, 7), spin: rand(-5, 5), phase: rand(0, 7) });
}
function addFloater(x, y, text, color, size = 26) { state.floaters.push({ x, y, text, color, size, life: 1.1, max: 1.1 }); }

function updateParticles(dt, t) {
  const P = state.particles;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.life -= dt; if (p.life <= 0) { P.splice(i, 1); continue; }
    if (p.type === 'spark') p.vy += 420 * dt;
    if (p.type === 'confetti') { p.vx = Math.sin(t * 3 + p.phase) * 60; if (p.y > H + 20) p.life = 0; }
    p.x += p.vx * dt; p.y += p.vy * dt; if (p.spin) p.rot += p.spin * dt;
  }
  const F = state.floaters;
  for (let i = F.length - 1; i >= 0; i--) { F[i].life -= dt; F[i].y -= 55 * dt; if (F[i].life <= 0) F.splice(i, 1); }
}

function drawParticles(c) {
  for (const p of state.particles) {
    c.save(); c.globalAlpha = clamp(p.life / p.max, 0, 1); c.fillStyle = p.color; c.translate(p.x, p.y);
    if (p.type === 'spark') { c.rotate(p.rot); star(c, 0, 0, p.size, 4); c.fill(); }
    else if (p.type === 'dust') { c.beginPath(); c.arc(0, 0, p.size * (p.life / p.max), 0, Math.PI * 2); c.fill(); }
    else { c.rotate(p.rot); c.fillRect(-p.size / 2, -p.size * 0.7, p.size, p.size * 1.4); }
    c.restore();
  }
  for (const f of state.floaters) {
    c.save(); c.globalAlpha = clamp(f.life / f.max * 1.5, 0, 1);
    c.font = `700 ${f.size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 6; c.strokeStyle = 'rgba(90,40,130,0.9)'; c.strokeText(f.text, f.x, f.y);
    c.fillStyle = f.color; c.fillText(f.text, f.x, f.y); c.restore();
  }
}

function drawBigText(text, y, size, color = '#fff', scale = 1) {
  ctx.save(); ctx.translate(W / 2, y); ctx.scale(scale, scale);
  ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = size * 0.14; ctx.lineJoin = 'round'; ctx.strokeStyle = '#8a4bd1'; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color; ctx.fillText(text, 0, 0); ctx.restore();
}

// ---------- game setup ----------
const baseRadius = () => clamp(Math.min(W, H) * 0.065, 30, 60);
const maxSpeed = () => clamp(Math.min(W, H) * 0.8, 320, 700);

function makeUnicorn(i, players) {
  const ci = save.colors[i] % UNICORN_COLORS.length, color = UNICORN_COLORS[ci];
  return {
    i, color, name: (save.names[i] || '').trim() || `${color.name} Unicorn`,
    fairy: FAIRY_COLORS[(ci + 1 + i) % FAIRY_COLORS.length], hair: HAIR_COLORS[(ci + i * 2) % HAIR_COLORS.length],
    x: players === 1 ? W / 2 : W * (0.3 + 0.4 * i), y: (PLAY_TOP + H) / 2,
    vx: 0, vy: 0, facing: i === 0 ? 1 : -1, eaten: 0, baseR: baseRadius(), r: baseRadius(),
    mouth: 0, happy: 0, bob: rand(0, 7), jump: 0,
    powers: { speed: 0, giant: 0, magnet: 0 }, target: null, joy: null, pointerId: null,
  };
}

function spawnBall(instant) {
  const r = clamp(Math.min(W, H) * 0.021, 11, 19);
  let x, y, tries = 0;
  do { x = rand(r + 10, W - r - 10); y = rand(PLAY_TOP + r + 10, H - r - 10); tries++; }
  while (tries < 25 && state.unicorns.some(u => dist(u.x, u.y, x, y) < u.r * 3));
  const powerCount = state.balls.filter(b => b.kind !== 'normal').length;
  const kind = powerCount < 2 && Math.random() < 0.12 ? pick(Object.keys(POWERS)) : 'normal';
  const a = rand(0, Math.PI * 2), spd = rand(15, 45);
  state.balls.push({ x, y, r: kind === 'normal' ? r : r * 1.2, color: kind === 'normal' ? pick(BALL_COLORS) : '#fff8c4', kind, bob: rand(0, 7), scale: instant ? 1 : 0, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd });
}

function startGame() {
  Sound.init();
  state.players = save.players; state.mode = save.mode;
  state.unicorns = []; state.balls = []; state.particles = []; state.floaters = [];
  for (let i = 0; i < state.players; i++) state.unicorns.push(makeUnicorn(i, state.players));
  state.targetBalls = state.mode === 'eatall' ? 30 + 15 * (state.players - 1) : 16 + 8 * (state.players - 1);
  for (let i = 0; i < state.targetBalls; i++) spawnBall(true);
  state.timeLeft = TIMER_SECONDS; state.countdown = 3.999; state.lastTick = -1;
  state.playing = true; state.paused = false; state.ended = false; state.cheer = 0; state.winner = null; state.confetti = 0;
  buildHud(); show('hud'); updateHud(true);
}

function endGame() {
  state.playing = false; state.ended = true; state.cheer = 2.5; state.confetti = 4;
  const sorted = [...state.unicorns].sort((a, b) => b.eaten - a.eaten);
  const tie = sorted.length > 1 && sorted[0].eaten === sorted[1].eaten;
  state.winner = sorted.length > 1 && !tie ? sorted[0] : null;
  for (const u of state.unicorns) { u.joy = null; u.target = null; u.pointerId = null; }
  Sound.fanfare();

  let bestNote = '';
  if (state.mode === 'timer') {
    const top = sorted[0].eaten;
    if (top > (save.best || 0)) { save.best = top; persist(); bestNote = `🏆 New best score: ${top} balls!`; }
    else if (save.best) bestNote = `Best ever: ${save.best} balls`;
  }
  $('#results-title').textContent = state.players === 1 ? `🎉 You ate ${sorted[0].eaten} balls! 🎉`
    : tie ? "🎉 It's a tie! Everybody wins! 🎉" : `🎉 ${state.winner.name} wins! 🎉`;
  $('#results-cards').innerHTML = sorted.map(u =>
    `<div class="card ${u === state.winner ? 'winner' : ''}"><span class="dot" style="background:${swatchBg(u.color)}"></span><span class="cname">${escapeHtml(u.name)}</span><span>${u.eaten} 🟣</span></div>`).join('');
  $('#results-best').textContent = bestNote;
  setTimeout(() => { if (state.ended) show('results'); }, 900);
}

function goHome() {
  state.playing = false; state.ended = false; state.paused = false;
  state.unicorns = []; state.balls = []; state.floaters = [];
  show('home');
}

// ---------- input ----------
const keys = {};
const ARROWS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const WASD = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (state.playing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' && state.playing) togglePause();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function keyDir(u) {
  const sets = state.players === 1 ? [ARROWS, WASD] : [u.i === 0 ? ARROWS : WASD];
  let x = 0, y = 0;
  for (const s of sets) { if (keys[s.left]) x -= 1; if (keys[s.right]) x += 1; if (keys[s.up]) y -= 1; if (keys[s.down]) y += 1; }
  return x || y ? { x: Math.sign(x), y: Math.sign(y) } : null;
}

canvas.addEventListener('pointerdown', e => {
  if (!state.playing || state.paused) return;
  Sound.init();
  const p = { x: e.clientX, y: e.clientY };
  if (e.pointerType === 'mouse') { state.unicorns[0].target = p; return; }
  if (state.players === 1) { const u = state.unicorns[0]; u.target = p; u.pointerId = e.pointerId; }
  else {
    const u = p.x < W / 2 ? state.unicorns[0] : state.unicorns[1];
    if (!u.joy) u.joy = { id: e.pointerId, ox: p.x, oy: p.y, dx: 0, dy: 0 };
  }
});
canvas.addEventListener('pointermove', e => {
  if (!state.playing) return;
  const p = { x: e.clientX, y: e.clientY };
  if (e.pointerType === 'mouse') { if (!state.paused) state.unicorns[0].target = p; return; }
  for (const u of state.unicorns) {
    if (u.joy && u.joy.id === e.pointerId) {
      let dx = p.x - u.joy.ox, dy = p.y - u.joy.oy; const d = Math.hypot(dx, dy);
      if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
      u.joy.dx = dx; u.joy.dy = dy;
    }
    if (u.pointerId === e.pointerId) u.target = p;
  }
});
const pointerEnd = e => {
  for (const u of state.unicorns) {
    if (u.joy && u.joy.id === e.pointerId) u.joy = null;
    if (u.pointerId === e.pointerId) u.pointerId = null;
  }
};
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);

// ---------- update ----------
function updateUnicorn(u, dt, t) {
  const spdMax = maxSpeed() * (u.powers.speed > 0 ? 1.7 : 1);
  let tx = 0, ty = 0, hasInput = false;
  const kd = keyDir(u);
  if (kd) { const n = Math.hypot(kd.x, kd.y) || 1; tx = kd.x / n * spdMax; ty = kd.y / n * spdMax; hasInput = true; u.target = null; }
  else if (u.joy) { tx = u.joy.dx / JOY_R * spdMax; ty = u.joy.dy / JOY_R * spdMax; hasInput = true; }
  else if (u.target) {
    const dx = u.target.x - u.x, dy = u.target.y - u.y, d = Math.hypot(dx, dy);
    if (d > 6) { const s = Math.min(spdMax, d * 6); tx = dx / d * s; ty = dy / d * s; hasInput = true; }
  }
  const k = 1 - Math.exp(-(hasInput ? 8 : 5) * dt);
  u.vx = lerp(u.vx, tx, k); u.vy = lerp(u.vy, ty, k);
  u.x = clamp(u.x + u.vx * dt, u.r * 0.9, W - u.r * 0.9);
  u.y = clamp(u.y + u.vy * dt, PLAY_TOP + u.r * 0.9, H - u.r * 0.6);
  if (Math.abs(u.vx) > 25) u.facing = u.vx > 0 ? 1 : -1;

  for (const p in u.powers) if (u.powers[p] > 0) u.powers[p] = Math.max(0, u.powers[p] - dt);
  u.happy = Math.max(0, u.happy - dt);

  let nearest = Infinity;
  for (const b of state.balls) { const d = dist(u.x + u.facing * u.r * 0.9, u.y - u.r * 0.5, b.x, b.y); if (d < nearest) nearest = d; }
  const want = nearest < u.r * 3 ? clamp(1 - (nearest - u.r) / (u.r * 2), 0.3, 1) : 0;
  u.mouth = lerp(u.mouth, want, 1 - Math.exp(-10 * dt));

  const spd = Math.hypot(u.vx, u.vy);
  if (spd > 120 && Math.random() < spd / 900) spawnDust(u);
}

function eat(u, b) {
  u.eaten++; u.r = u.baseR * (1 + Math.min(u.eaten, 40) * 0.015);
  u.happy = 0.45; u.mouth = 1; state.cheer = Math.min(1.5, state.cheer + 0.8);
  spawnSparkles(b.x, b.y, 14, MANE);
  if (b.kind === 'normal') {
    Sound.chomp();
    if (u.eaten % 5 === 0) { Sound.cheer(); addFloater(b.x, b.y - 20, pick(YUMS), '#fff', 32); }
    else addFloater(b.x, b.y - 20, pick(YUMS), '#fff', 22);
  } else {
    u.powers[b.kind] = POWERS[b.kind].dur; Sound.power();
    addFloater(b.x, b.y - 24, `${POWERS[b.kind].icon} ${POWERS[b.kind].label}`, '#ffe066', 34);
    spawnSparkles(b.x, b.y, 24, ['#fff', '#ffe066', '#ffd166']);
  }
}

function update(dt, t) {
  updateParticles(dt, t);
  state.cheer = Math.max(0, state.cheer - dt * 1.2);
  if (state.screen === 'home' || state.screen === 'setup') updateDemo(dt, t);

  if (state.ended) {
    if (state.confetti > 0) { state.confetti -= dt; for (let i = 0; i < 3; i++) spawnConfetti(); }
    for (const u of state.unicorns) {
      const celebrate = !state.winner || u === state.winner;
      u.happy = 1; u.mouth = 0;
      u.jump = celebrate ? -Math.abs(Math.sin(t * 5 + u.bob)) * 36 : 0;
      u.vx = celebrate ? Math.sin(t * 5) * 300 : 0; u.vy = 0;
    }
    return;
  }
  if (!state.playing || state.paused) return;

  if (state.countdown > -0.7) {
    const prev = Math.ceil(state.countdown); state.countdown -= dt; const cur = Math.ceil(state.countdown);
    if (cur !== prev) { if (cur <= 0) Sound.go(); else Sound.tick(); }
  }
  for (const b of state.balls) b.scale = Math.min(1, b.scale + dt * 3);
  if (state.countdown > 0) return;

  for (const b of state.balls) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } else if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y < PLAY_TOP + b.r) { b.y = PLAY_TOP + b.r; b.vy = Math.abs(b.vy); } else if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
  }
  for (const u of state.unicorns) updateUnicorn(u, dt, t);

  for (const u of state.unicorns) if (u.powers.magnet > 0) for (const b of state.balls) {
    const d = dist(u.x, u.y, b.x, b.y);
    if (d < 300 && d > 1) { const f = 420 * dt; b.x += (u.x - b.x) / d * f; b.y += (u.y - b.y) / d * f; }
  }

  for (const u of state.unicorns) {
    const mx = u.x + u.facing * u.r * 1.0, my = u.y - u.r * 0.55;
    const eatR = u.r * 0.7 * (u.powers.giant > 0 ? 2 : 1);
    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i]; if (b.scale < 0.6) continue;
      if (dist(mx, my, b.x, b.y) < eatR + b.r || dist(u.x, u.y, b.x, b.y) < u.r * 0.6 + b.r) { state.balls.splice(i, 1); eat(u, b); }
    }
  }

  if (state.mode !== 'eatall') while (state.balls.length < state.targetBalls) spawnBall(false);

  if (state.mode === 'timer') {
    state.timeLeft -= dt;
    const s = Math.ceil(state.timeLeft);
    if (s <= 5 && s >= 1 && s !== state.lastTick) { state.lastTick = s; Sound.tick(); }
    if (state.timeLeft <= 0) { state.timeLeft = 0; endGame(); }
  }
  if (state.mode === 'eatall' && state.balls.length === 0) endGame();
  updateHud(false);
}

// idle unicorns gliding around on the home/setup screens
function updateDemo(dt, t) {
  if (state.demo.length === 0) {
    state.demo = [0, 1].map(i => Object.assign(makeUnicorn(i, 2), { color: UNICORN_COLORS[i === 0 ? 0 : 2], r: baseRadius() * 0.9, phase: i * 3 }));
  }
  state.demo.forEach((u, i) => {
    const nx = W * 0.5 + Math.sin(t * 0.35 + u.phase) * W * 0.36;
    const ny = H * 0.62 + Math.cos(t * 0.7 + u.phase) * H * 0.12 + i * 30;
    u.vx = (nx - u.x) / dt; u.x = nx; u.y = ny; u.facing = u.vx > 0 ? 1 : -1;
    u.mouth = Math.max(0, Math.sin(t * 2 + u.phase));
    if (Math.random() < 0.15) spawnDust(u);
  });
}

// ---------- render ----------
function render(t) {
  drawBackground(t);
  if (state.screen === 'home' || state.screen === 'setup') {
    for (const u of state.demo) drawUnicorn(ctx, u, t);
    drawParticles(ctx);
    return;
  }
  for (const b of state.balls) drawBall(ctx, b, t);
  for (const u of [...state.unicorns].sort((a, b) => a.y - b.y)) drawUnicorn(ctx, u, t);
  drawParticles(ctx);

  // touch joysticks
  for (const u of state.unicorns) if (u.joy) {
    ctx.save(); ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(u.joy.ox, u.joy.oy, JOY_R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = u.color.body === 'rainbow' ? '#c39bff' : u.color.body; ctx.beginPath(); ctx.arc(u.joy.ox + u.joy.dx, u.joy.oy + u.joy.dy, 28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (state.playing && state.countdown > -0.7) {
    const n = Math.ceil(state.countdown);
    const frac = state.countdown - Math.floor(state.countdown);
    drawBigText(n >= 1 ? String(n) : 'GO!', H * 0.42, Math.min(W, H) * 0.25, n >= 1 ? '#fff' : '#ffe066', 1 + frac * 0.3);
    if (state.players === 2 && n >= 1) {
      const a = state.unicorns[0], b = state.unicorns[1];
      drawBigText(`👈 ${a.name}      ${b.name} 👉`, H * 0.62, Math.min(W, H) * 0.05);
      drawBigText('arrows / left side          W A S D / right side', H * 0.69, Math.min(W, H) * 0.03);
    } else if (n >= 1) {
      drawBigText('Fly to the balls and gobble them up!', H * 0.62, Math.min(W, H) * 0.045);
    }
  }
  if (state.playing && state.mode === 'timer' && state.timeLeft <= 5.5 && state.timeLeft > 0 && state.countdown <= 0) {
    drawBigText(String(Math.ceil(state.timeLeft)), H * 0.4, Math.min(W, H) * 0.3, '#ff8fc8', 1 + (state.timeLeft % 1) * 0.3);
  }
  if (state.paused) {
    ctx.fillStyle = 'rgba(80,30,120,0.2)'; ctx.fillRect(0, 0, W, H);
  }
}

// ---------- HUD ----------
const hud = { s1: $('#score-1'), s2: $('#score-2'), timer: $('#timer'), last: {} };
function swatchBg(color) { return color.body === 'rainbow' ? `linear-gradient(135deg, ${MANE.join(',')})` : color.body; }
function buildHud() {
  const els = [hud.s1, hud.s2];
  els.forEach((el, i) => {
    const u = state.unicorns[i];
    el.classList.toggle('hidden', !u);
    if (u) el.querySelector('.dot').style.background = swatchBg(u.color);
  });
  hud.timer.classList.remove('urgent');
  hud.last = {};
}
function updateHud(force) {
  state.unicorns.forEach((u, i) => {
    const el = i === 0 ? hud.s1 : hud.s2;
    if (force || hud.last['n' + i] !== u.eaten) { el.querySelector('.num').textContent = u.eaten; hud.last['n' + i] = u.eaten; }
    const pw = Object.keys(u.powers).filter(k => u.powers[k] > 0).map(k => POWERS[k].icon).join('');
    if (force || hud.last['p' + i] !== pw) { el.querySelector('.power').textContent = pw; hud.last['p' + i] = pw; }
  });
  let txt;
  if (state.mode === 'timer') { const s = Math.ceil(state.timeLeft); txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; hud.timer.classList.toggle('urgent', s <= 10 && state.countdown <= 0); }
  else if (state.mode === 'eatall') txt = `${state.balls.length} left`;
  else txt = '∞';
  if (force || hud.last.t !== txt) { hud.timer.textContent = txt; hud.last.t = txt; }
}

function togglePause() {
  if (!state.playing || state.countdown > 0) return;
  state.paused = !state.paused;
  if (state.paused) { for (const u of state.unicorns) { u.joy = null; u.pointerId = null; } show('hud', 'pause'); }
  else show('hud');
  Sound.click();
}

// ---------- setup screen ----------
const pickers = [$('#picker-1'), $('#picker-2')];
const previews = [];
const MODE_HINTS = { timer: 'Gobble as many balls as you can in one minute!', eatall: 'Eat every single ball to finish the game!', free: 'Balls keep coming forever. Play as long as you like!' };

function escapeHtml(s) { return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }

function refreshSetup() {
  $$('#player-row .choice').forEach(b => b.classList.toggle('selected', +b.dataset.players === save.players));
  $$('#mode-row .choice').forEach(b => b.classList.toggle('selected', b.dataset.mode === save.mode));
  $('#mode-hint').textContent = MODE_HINTS[save.mode];
  pickers[1].classList.toggle('hidden', save.players < 2);
  pickers.forEach((p, i) => {
    p.querySelectorAll('.swatch').forEach(s => s.classList.toggle('selected', +s.dataset.idx === save.colors[i]));
    const inp = p.querySelector('.name'); if (inp.value !== save.names[i]) inp.value = save.names[i];
  });
}

pickers.forEach((p, i) => {
  const sw = p.querySelector('.swatches');
  UNICORN_COLORS.forEach((c, idx) => {
    const b = document.createElement('button'); b.className = 'swatch'; b.dataset.idx = idx; b.title = c.name; b.setAttribute('aria-label', c.name);
    b.style.background = swatchBg(c);
    b.addEventListener('click', () => { save.colors[i] = idx; persist(); refreshSetup(); Sound.click(); });
    sw.appendChild(b);
  });
  p.querySelector('.name').addEventListener('input', e => { save.names[i] = e.target.value; persist(); });
  const pc = p.querySelector('.preview');
  previews.push({ canvas: pc, ctx: pc.getContext('2d'), u: Object.assign(makeUnicorn(i, 2), { x: 100, y: 95, r: 36, facing: 1, vx: 0, vy: 0 }) });
});
$$('#player-row .choice').forEach(b => b.addEventListener('click', () => { save.players = +b.dataset.players; persist(); refreshSetup(); Sound.click(); }));
$$('#mode-row .choice').forEach(b => b.addEventListener('click', () => { save.mode = b.dataset.mode; persist(); refreshSetup(); Sound.click(); }));

function drawPreviews(t) {
  previews.forEach((p, i) => {
    if (i === 1 && save.players < 2) return;
    const c = p.ctx; c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, 200, 160);
    const ci = save.colors[i] % UNICORN_COLORS.length;
    p.u.color = UNICORN_COLORS[ci]; p.u.fairy = FAIRY_COLORS[(ci + 1 + i) % FAIRY_COLORS.length]; p.u.hair = HAIR_COLORS[(ci + i * 2) % HAIR_COLORS.length];
    p.u.mouth = Math.max(0, Math.sin(t * 2.5 + i)); p.u.happy = Math.sin(t * 0.8 + i) > 0.7 ? 1 : 0;
    drawUnicorn(c, p.u, t);
  });
}

// ---------- buttons ----------
$('#btn-play').addEventListener('click', () => { Sound.init(); Sound.click(); refreshSetup(); show('setup'); });
$('#btn-back').addEventListener('click', () => { Sound.click(); show('home'); });
$('#btn-go').addEventListener('click', () => { document.activeElement && document.activeElement.blur(); startGame(); });
$('#btn-pause').addEventListener('click', togglePause);
$('#btn-resume').addEventListener('click', togglePause);
$('#btn-finish').addEventListener('click', () => { state.paused = false; show('hud'); endGame(); });
$('#btn-pause-home').addEventListener('click', () => { Sound.click(); goHome(); });
$('#btn-again').addEventListener('click', () => { Sound.click(); startGame(); });
$('#btn-change').addEventListener('click', () => { Sound.click(); state.ended = false; state.unicorns = []; state.balls = []; refreshSetup(); show('setup'); });
$('#btn-home').addEventListener('click', () => { Sound.click(); goHome(); });
const muteBtn = $('#btn-mute');
muteBtn.textContent = Sound.muted ? '🔇' : '🔊';
muteBtn.addEventListener('click', () => { Sound.muted = !Sound.muted; save.muted = Sound.muted; persist(); muteBtn.textContent = Sound.muted ? '🔇' : '🔊'; Sound.click(); });

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  update(dt, t); render(t);
  if (state.screen === 'setup') drawPreviews(t);
  requestAnimationFrame(frame);
}
resize(); refreshSetup(); show('home');
requestAnimationFrame(frame);
})();
