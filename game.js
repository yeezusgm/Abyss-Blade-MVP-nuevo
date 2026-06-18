/* ================================================
   ABYSS BLADE — game.js
   Motor: Canvas 2D puro
   ================================================ */

"use strict";

// ── Utilidades ─────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Canvas & Contexto ───────────────────────────────
const canvas = $('gameCanvas');
const ctx    = canvas.getContext('2d');

let W, H;
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ── Estado global ───────────────────────────────────
let gameRunning  = false;
let gamePaused   = false;
let animFrameId  = null;
let currentLevel = 1;

// ── Sistema de narrativa ────────────────────────────
const narrativeQueue = [];
let narrativeActive  = false;
let narrativeTyping  = '';
let narrativeTarget  = '';
let narrativeTypeTick = 0;
let narrativePaused  = false;

const NARRATIVES = {
  intro: [
    { speaker: 'TOM', portrait: '⚔', text: 'El abismo... puedo sentir su oscuridad. La espada tiembla en mi mano.' },
    { speaker: 'ORÁCULO', portrait: '🌀', text: 'Tom, los guardianes han sellado el camino. Debes eliminarlos a todos para abrir el portal al siguiente nivel.' },
    { speaker: 'TOM', portrait: '⚔', text: 'Entendido. Que tiemblen ante la Abyss Blade.' },
  ],
  level2: [
    { speaker: 'ORÁCULO', portrait: '🌀', text: 'La Forja del Abismo... aquí los enemigos son más peligrosos. ¡Ten cuidado con los elites!' },
    { speaker: 'TOM', portrait: '⚔', text: 'No importa cuántos vengan. El abismo será conquistado.' },
  ],
  victory: [
    { speaker: 'TOM', portrait: '⚔', text: 'El abismo cae. La luz regresa al reino subterráneo.' },
    { speaker: 'ORÁCULO', portrait: '🌀', text: '¡Lo has conseguido, portador! La Abyss Blade ha cumplido su destino.' },
  ],
};

// ── Cofres interactivos ─────────────────────────────
let chests = [];

function makeChest(x, y, reward) {
  return { x, y, w: 32, h: 28, opened: false, reward, nearPlayer: false, glowPulse: 0 };
}

function spawnChestsLevel1() {
  chests = [
    makeChest(1800, 1060, 'heal50'),
    makeChest(3720, 220,  'heal50'),
  ];
}

function spawnChestsLevel2() {
  chests = [
    makeChest(1820, 3070, 'heal75'),
    makeChest(3720, 2230, 'heal75'),
  ];
}

function updateChests(dt) {
  let anyNear = false;
  for (const c of chests) {
    if (c.opened) continue;
    c.glowPulse = (c.glowPulse || 0) + 0.04;
    const dist = Math.hypot(player.x - c.x, player.y - c.y);
    c.nearPlayer = dist < 80;
    if (c.nearPlayer) anyNear = true;
    if (c.nearPlayer && keys['KeyF']) {
      openChest(c);
    }
  }
  const hint = $('interact-hint');
  if (anyNear) hint.classList.remove('hidden');
  else hint.classList.add('hidden');
}

function openChest(c) {
  if (c.opened) return;
  c.opened = true;
  const amount = c.reward === 'heal75' ? 75 : 50;
  player.hp = Math.min(player.maxHp, player.hp + amount);
  updateHealthBar();
  showScreenMsg('+' + amount + ' VIDA — ¡Cofre abierto!', '#e8c84a', 120);
  for (let i = 0; i < 20; i++) {
    spawnParticle(c.x + c.w/2, c.y, (Math.random()-0.5)*7, -Math.random()*5-1, Math.random()>0.5 ? '#e8c84a' : '#ffffff', 25+Math.random()*18);
  }
}

function drawChests() {
  for (const c of chests) {
    if (!inView(c.x - 10, c.y - 10, c.w + 20, c.h + 20)) continue;
    const pulse = Math.sin((c.glowPulse || 0)) * 0.3 + 0.7;
    ctx.save();
    if (!c.opened) {
      // Aura
      const aura = ctx.createRadialGradient(c.x + c.w/2, c.y + c.h/2, 0, c.x + c.w/2, c.y + c.h/2, 36);
      aura.addColorStop(0, `rgba(232,200,74,${0.2*pulse})`);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(c.x + c.w/2, c.y + c.h/2, 36, 0, Math.PI*2);
      ctx.fill();
    }
    // Cuerpo del cofre
    const grad = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h);
    if (c.opened) {
      grad.addColorStop(0, '#2a2010'); grad.addColorStop(1, '#1a1008');
    } else {
      grad.addColorStop(0, '#6a4a10'); grad.addColorStop(1, '#3a2808');
    }
    ctx.fillStyle = grad;
    roundRect(ctx, c.x, c.y + (c.opened ? 8 : 0), c.w, c.h - (c.opened ? 8 : 0), 3);
    ctx.fill();
    // Tapa
    const lidH = c.opened ? 4 : 10;
    const lidY = c.opened ? c.y - 6 : c.y;
    ctx.fillStyle = c.opened ? '#2a2010' : '#8a5a14';
    roundRect(ctx, c.x - 2, lidY, c.w + 4, lidH, 3);
    ctx.fill();
    // Borde dorado
    ctx.strokeStyle = c.opened ? 'rgba(100,80,20,0.4)' : `rgba(232,200,74,${0.6*pulse})`;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#e8c84a';
    ctx.shadowBlur = c.opened ? 0 : 8*pulse;
    roundRect(ctx, c.x, c.y, c.w, c.h, 3);
    ctx.stroke();
    // Cerradura
    if (!c.opened) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(232,200,74,${0.9*pulse})`;
      ctx.beginPath();
      ctx.arc(c.x + c.w/2, c.y + c.h/2, 4, 0, Math.PI*2);
      ctx.fill();
    }
    // Partículas de magia si no abierto
    if (!c.opened && Math.random() < 0.15) {
      spawnParticle(c.x + Math.random()*c.w, c.y, (Math.random()-0.5)*1.5, -Math.random()*1.5-0.5, '#e8c84a', 18+Math.random()*12);
    }
    ctx.restore();
  }
}

// ── Ataque del jugador ───────────────────────────────
const attack = {
  active: false,
  timer:  0,
  duration: 18,      // frames que dura el swing
  cooldown: 0,
  cooldownMax: 28,
  angle: 0,          // ángulo actual del swing
  hitEnemies: [],    // enemigos ya golpeados en este ataque
};

// ── Enemigos ─────────────────────────────────────────
let enemies = [];

// ── Portal al nivel 2 ────────────────────────────────
const portal = {
  x: 4480, y: 1220, w: 50, h: 80,
  active: false,    // se activa al matar todos los enemigos del nivel 1
  pulse: 0,
};

// ── Mensajes en pantalla ─────────────────────────────
let screenMsg = { text: '', timer: 0, color: '#4af0ff' };

// ── Cursor personalizado ─────────────────────────────
(function initCursor() {
  const el = $('custom-cursor');
  if (!el) return;
  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let cx = mx, cy = my;
  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

  // Hover sobre cualquier botón → cursor dorado
  function attachHover(btn) {
    if (!btn) return;
    btn.addEventListener('mouseenter', () => el.classList.add('on-btn'));
    btn.addEventListener('mouseleave', () => el.classList.remove('on-btn'));
  }
  attachHover($('start-btn'));
  document.querySelectorAll('.pause-btn').forEach(attachHover);

  function moveCursor() {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    el.style.left = cx + 'px';
    el.style.top  = cy + 'px';
    requestAnimationFrame(moveCursor);
  }
  moveCursor();

  // Ocultar durante el juego, mostrar en pausa / inicio
  window.addEventListener('gameStarted',  () => { el.style.display = 'none'; });
  window.addEventListener('gamePaused',   () => { el.style.display = 'block'; });
  window.addEventListener('gameResumed',  () => { el.style.display = 'none'; });
  window.addEventListener('gameToStart',  () => { el.style.display = 'block'; });
})();

// ── Pociones de curación ─────────────────────────────
let healthPickups = [];

function spawnHealthPickupsLevel1() {
  healthPickups = [
    makePickup(550,  1880),
    makePickup(1150, 1660),
    makePickup(1860, 1060),
    makePickup(2450, 1520),
    makePickup(2900, 1520),
    makePickup(3300, 1760),
    makePickup(3720, 220),
    makePickup(4200, 1460),
  ];
}

function spawnHealthPickupsLevel2() {
  healthPickups = [
    makePickup(650,  3860),
    makePickup(1150, 3640),
    makePickup(1650, 3480),
    makePickup(1870, 3060),
    makePickup(2500, 3160),
    makePickup(2710, 3380),
    makePickup(3060, 2560),
    makePickup(3490, 2320),
    makePickup(4110, 3470),
    makePickup(4570, 3220),
  ];
}

function makePickup(x, y) {
  return { x, y, w: 18, h: 22, collected: false, bobOffset: Math.random() * Math.PI * 2, healAmount: 30 };
}

function updateHealthPickups(dt) {
  for (const p of healthPickups) {
    if (p.collected) continue;
    if (aabbOverlap(player, { x: p.x, y: p.y, w: p.w, h: p.h })) {
      p.collected = true;
      const healed = Math.min(p.healAmount, player.maxHp - player.hp);
      player.hp = Math.min(player.maxHp, player.hp + p.healAmount);
      updateHealthBar();
      // Partículas de curación
      for (let i = 0; i < 14; i++) {
        spawnParticle(
          p.x + p.w / 2, p.y + p.h / 2,
          (Math.random() - 0.5) * 5,
          -Math.random() * 4 - 1,
          Math.random() > 0.5 ? '#44ff88' : '#aaffcc',
          22 + Math.random() * 14
        );
      }
      if (healed > 0) showScreenMsg('+' + p.healAmount + ' VIDA', '#44ff88', 60);
    }
  }
}

// ── Input ────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (narrativeActive && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ')) {
    advanceNarrative();
    e.preventDefault();
    return;
  }
  if (e.code === 'Escape' && gameRunning) togglePause();
  e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ── Constantes de física ────────────────────────────
const GRAVITY      = 0.55;
const MAX_FALL     = 18;
const MOVE_SPEED   = 3.8;
const JUMP_FORCE   = -13;
const DOUBLE_JUMP  = -11;
const COYOTE_TIME  = 8;   // frames de gracia al borde
const JUMP_BUFFER  = 10;  // frames de pre-input

// ── Cámara ───────────────────────────────────────────
const cam = { x: 0, y: 0, lerp: 0.09 };

// ── Mundo ────────────────────────────────────────────
const WORLD_W = 4800;
const WORLD_H = 4400;

// ── Plataformas ──────────────────────────────────────
// {x, y, w, h, type}  type: 'solid'|'thin'|'crumble'
const platforms = [
  // Suelo principal
  { x: 0,    y: 1900, w: 4800, h: 80,  type: 'solid' },

  // Zona inicio
  { x: 100,  y: 1720, w: 200,  h: 20,  type: 'thin'  },
  { x: 380,  y: 1600, w: 160,  h: 20,  type: 'thin'  },
  { x: 600,  y: 1480, w: 220,  h: 20,  type: 'thin'  },
  { x: 880,  y: 1360, w: 180,  h: 20,  type: 'thin'  },

  // Caverna izquierda profunda
  { x: 0,    y: 1400, w: 120,  h: 20,  type: 'solid' },
  { x: 0,    y: 1200, w: 200,  h: 20,  type: 'solid' },
  { x: 150,  y: 1050, w: 160,  h: 20,  type: 'thin'  },
  { x: 360,  y: 900,  w: 200,  h: 20,  type: 'thin'  },

  // Bloque elevado central
  { x: 1100, y: 1700, w: 300,  h: 25,  type: 'solid' },
  { x: 1100, y: 1500, w: 180,  h: 20,  type: 'thin'  },
  { x: 1340, y: 1350, w: 220,  h: 20,  type: 'thin'  },
  { x: 1600, y: 1220, w: 160,  h: 20,  type: 'thin'  },
  { x: 1800, y: 1100, w: 200,  h: 25,  type: 'solid' },

  // Torre izquierda
  { x: 500,  y: 1750, w: 140,  h: 20,  type: 'thin'  },
  { x: 340,  y: 1630, w: 120,  h: 20,  type: 'thin'  },
  { x: 200,  y: 1510, w: 100,  h: 20,  type: 'thin'  },
  { x: 60,   y: 1400, w: 80,   h: 20,  type: 'thin'  },

  // Zona derecha media
  { x: 2100, y: 1700, w: 260,  h: 20,  type: 'thin'  },
  { x: 2400, y: 1560, w: 200,  h: 20,  type: 'thin'  },
  { x: 2640, y: 1420, w: 240,  h: 25,  type: 'solid' },
  { x: 2900, y: 1560, w: 200,  h: 20,  type: 'thin'  },
  { x: 3100, y: 1680, w: 160,  h: 20,  type: 'thin'  },
  { x: 3300, y: 1800, w: 220,  h: 25,  type: 'solid' },

  // Zona derecha alta
  { x: 2200, y: 1000, w: 300,  h: 25,  type: 'solid' },
  { x: 2540, y: 860,  w: 180,  h: 20,  type: 'thin'  },
  { x: 2760, y: 720,  w: 200,  h: 20,  type: 'thin'  },
  { x: 3000, y: 600,  w: 240,  h: 25,  type: 'solid' },
  { x: 3280, y: 480,  w: 160,  h: 20,  type: 'thin'  },
  { x: 3480, y: 360,  w: 200,  h: 20,  type: 'thin'  },
  { x: 3720, y: 260,  w: 300,  h: 25,  type: 'solid' },

  // Zona extremo derecho
  { x: 3500, y: 1750, w: 300,  h: 25,  type: 'solid' },
  { x: 3860, y: 1630, w: 200,  h: 20,  type: 'thin'  },
  { x: 4100, y: 1500, w: 240,  h: 20,  type: 'thin'  },
  { x: 4350, y: 1370, w: 200,  h: 20,  type: 'thin'  },
  { x: 4550, y: 1250, w: 250,  h: 20,  type: 'thin'  },

  // Techos / overhead
  { x: 700,  y: 700,  w: 400,  h: 25,  type: 'solid' },
  { x: 1200, y: 600,  w: 300,  h: 20,  type: 'thin'  },
  { x: 1600, y: 500,  w: 280,  h: 20,  type: 'thin'  },

  // Paredes verticales decorativas (plataformas estrechas)
  { x: 980,  y: 1600, w: 20,   h: 180, type: 'solid' },
  { x: 2080, y: 1400, w: 20,   h: 300, type: 'solid' },
  { x: 3460, y: 1100, w: 20,   h: 300, type: 'solid' },

  // ── NIVEL 2: FORJA DEL ABISMO ──────────────────────
  // Suelo del nivel 2
  { x: 0,    y: 3900, w: 4800, h: 80,  type: 'solid' },

  // Entrada del nivel 2
  { x: 100,  y: 3730, w: 220,  h: 20,  type: 'thin'  },
  { x: 380,  y: 3610, w: 180,  h: 20,  type: 'thin'  },
  { x: 600,  y: 3490, w: 200,  h: 20,  type: 'thin'  },
  { x: 840,  y: 3370, w: 160,  h: 25,  type: 'solid' },

  // Zona lava izquierda
  { x: 0,    y: 3560, w: 140,  h: 20,  type: 'solid' },
  { x: 0,    y: 3380, w: 200,  h: 20,  type: 'solid' },
  { x: 180,  y: 3240, w: 180,  h: 20,  type: 'thin'  },
  { x: 380,  y: 3100, w: 200,  h: 20,  type: 'thin'  },

  // Puente central
  { x: 1050, y: 3700, w: 320,  h: 25,  type: 'solid' },
  { x: 1080, y: 3520, w: 200,  h: 20,  type: 'thin'  },
  { x: 1330, y: 3380, w: 240,  h: 20,  type: 'thin'  },
  { x: 1600, y: 3250, w: 180,  h: 20,  type: 'thin'  },
  { x: 1820, y: 3100, w: 220,  h: 25,  type: 'solid' },

  // Torre central izquierda
  { x: 520,  y: 3770, w: 150,  h: 20,  type: 'thin'  },
  { x: 370,  y: 3640, w: 120,  h: 20,  type: 'thin'  },
  { x: 220,  y: 3510, w: 100,  h: 20,  type: 'thin'  },

  // Zona derecha media nivel 2
  { x: 2100, y: 3700, w: 280,  h: 20,  type: 'thin'  },
  { x: 2420, y: 3560, w: 200,  h: 20,  type: 'thin'  },
  { x: 2660, y: 3420, w: 240,  h: 25,  type: 'solid' },
  { x: 2940, y: 3560, w: 200,  h: 20,  type: 'thin'  },
  { x: 3140, y: 3680, w: 160,  h: 20,  type: 'thin'  },
  { x: 3340, y: 3800, w: 220,  h: 25,  type: 'solid' },

  // Zona alta nivel 2
  { x: 2200, y: 3000, w: 300,  h: 25,  type: 'solid' },
  { x: 2540, y: 2860, w: 180,  h: 20,  type: 'thin'  },
  { x: 2760, y: 2720, w: 200,  h: 20,  type: 'thin'  },
  { x: 3000, y: 2600, w: 240,  h: 25,  type: 'solid' },
  { x: 3280, y: 2480, w: 160,  h: 20,  type: 'thin'  },
  { x: 3480, y: 2360, w: 200,  h: 20,  type: 'thin'  },
  { x: 3720, y: 2260, w: 300,  h: 25,  type: 'solid' },

  // Zona extremo derecho nivel 2
  { x: 3540, y: 3760, w: 300,  h: 25,  type: 'solid' },
  { x: 3880, y: 3640, w: 200,  h: 20,  type: 'thin'  },
  { x: 4100, y: 3510, w: 240,  h: 20,  type: 'thin'  },
  { x: 4360, y: 3380, w: 200,  h: 20,  type: 'thin'  },
  { x: 4560, y: 3260, w: 240,  h: 20,  type: 'thin'  },

  // Pilares de lava nivel 2
  { x: 970,  y: 3560, w: 20,   h: 200, type: 'solid' },
  { x: 2070, y: 3400, w: 20,   h: 300, type: 'solid' },
  { x: 3450, y: 3100, w: 20,   h: 300, type: 'solid' },
];

// ── Decoraciones del fondo (stalactitas, cristales) ──
const decorations = generateDecorations();
function generateDecorations() {
  const items = [];
  const rng = mulberry32(0xABCD1234);

  // Stalactitas del techo
  for (let i = 0; i < 80; i++) {
    const x  = rng() * WORLD_W;
    const y  = rng() * 400 + 100;
    const h  = rng() * 120 + 30;
    const w  = rng() * 18 + 6;
    items.push({ type: 'stalactite', x, y, w, h });
  }
  // Estalagmitas del suelo
  for (let i = 0; i < 60; i++) {
    const x  = rng() * WORLD_W;
    const y  = 1900 - (rng() * 100 + 20);
    const h  = rng() * 90 + 20;
    const w  = rng() * 14 + 5;
    items.push({ type: 'stalagmite', x, y, w, h });
  }
  // Cristales brillantes
  for (let i = 0; i < 50; i++) {
    const x    = rng() * WORLD_W;
    const y    = rng() * WORLD_H * 0.85 + 200;
    const size = rng() * 20 + 8;
    const hue  = rng() > 0.5 ? 190 : 270; // cian o violeta
    items.push({ type: 'crystal', x, y, size, hue });
  }
  // Charcos de luz en el suelo
  for (let i = 0; i < 30; i++) {
    const x = rng() * WORLD_W;
    const y = 1900 + 35;
    const r = rng() * 60 + 30;
    items.push({ type: 'pool', x, y, r });
  }
  return items;
}

// RNG determinista
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── PARTÍCULAS DEL JUGADOR ───────────────────────────
const particles = [];
function spawnParticle(x, y, vx, vy, color, life) {
  particles.push({ x, y, vx, vy, color, life, maxLife: life, size: 3 + Math.random() * 3 });
}

// ── NÚMEROS DE DAÑO ──────────────────────────────────
const damageNumbers = [];
function spawnDamageNumber(x, y, amount) {
  damageNumbers.push({ x, y, vy: -2.5, life: 55, maxLife: 55, text: String(amount), color: amount >= 34 ? '#ff6622' : '#ffffff' });
}
function updateDamageNumbers(dt) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i];
    d.y += d.vy * dt;
    d.vy *= 0.95;
    d.life--;
    if (d.life <= 0) damageNumbers.splice(i, 1);
  }
}
function drawDamageNumbers() {
  for (const d of damageNumbers) {
    const alpha = Math.min(1, d.life / 20);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 15px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = d.color;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 10;
    ctx.fillText(d.text, d.x, d.y);
    ctx.restore();
  }
}

// ── SCREEN SHAKE ─────────────────────────────────────
const shake = { x: 0, y: 0, intensity: 0, duration: 0 };
function triggerShake(intensity, duration) {
  if (intensity > shake.intensity) {
    shake.intensity = intensity;
    shake.duration  = duration;
  }
}
function updateShake(dt) {
  if (shake.duration > 0) {
    shake.duration -= dt;
    shake.x = (Math.random() - 0.5) * shake.intensity;
    shake.y = (Math.random() - 0.5) * shake.intensity;
    shake.intensity *= 0.88;
    if (shake.duration <= 0) { shake.x = 0; shake.y = 0; shake.intensity = 0; }
  }
}

// ── Jugador (Tom) ────────────────────────────────────
const player = {
  x: 200, y: 1800,
  w: 28, h: 42,
  vx: 0, vy: 0,
  onGround: false,
  facingRight: true,
  // Doble salto
  jumpsLeft: 2,
  // Coyote time
  coyoteTimer: 0,
  // Jump buffer
  jumpBuffer: 0,
  // Animación
  frame: 0,
  frameTick: 0,
  state: 'idle',   // idle | run | jump | fall | land
  landTimer: 0,
  // Salud
  hp: 100,
  maxHp: 100,
  // Efecto de daño
  damageFlash: 0,
  // Sombra bajo el personaje
  shadowY: 0,
};

// ── Parallax layers ──────────────────────────────────
// Cada capa: factor de parallax, y unos "puntos" de fondo
const bgLayers = [
  { factor: 0.05, color: '#0a0a14', items: generateBgLayer(0.05, 120, 'circle') },
  { factor: 0.15, color: '#0d0d20', items: generateBgLayer(0.15, 80,  'rect')   },
  { factor: 0.30, color: '#111130', items: generateBgLayer(0.30, 50,  'arch')   },
];

function generateBgLayer(factor, count, shape) {
  const arr = [];
  const rng = mulberry32(Math.round(factor * 10000));
  for (let i = 0; i < count; i++) {
    arr.push({
      x:    rng() * WORLD_W,
      y:    rng() * WORLD_H,
      size: rng() * 60 + 10,
      shape,
      alpha: rng() * 0.15 + 0.03,
    });
  }
  return arr;
}

// ── Tiempo / delta ───────────────────────────────────
let lastTime = 0;

// ── Pantalla de inicio ───────────────────────────────
(function buildParticles() {
  const container = $('particles');
  for (let i = 0; i < 35; i++) {
    const p  = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 1;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      bottom:${Math.random()*30}%;
      animation-duration:${4 + Math.random()*8}s;
      animation-delay:${Math.random()*5}s;
      background:${Math.random()>0.5 ? '#4af0ff' : '#a060ff'};
      filter:blur(${Math.random()*2}px);
    `;
    container.appendChild(p);
  }
})();

$('start-btn').addEventListener('click', startGame);

// ── Iniciar juego ────────────────────────────────────
function startGame() {
  $('start-screen').style.opacity = '0';
  $('start-screen').style.transition = 'opacity 0.6s';
  setTimeout(() => {
    $('start-screen').style.display = 'none';
    window.dispatchEvent(new Event('gameStarted'));
    $('hud').classList.remove('hidden');
    $('hud').classList.add('fade-in');
    gameRunning = true;
    resetPlayer();
    requestAnimationFrame(loop);
    // Iniciar narrativa de introducción
    setTimeout(() => startNarrative('intro'), 800);
  }, 600);
}

// ── Checkpoint del nivel actual ──────────────────────
const checkpoint = { level: 1, x: 200, y: 1800 };

function resetPlayer() {
  // Reinicio completo (botón Reiniciar del menú pausa)
  checkpoint.level = 1;
  checkpoint.x = 200;
  checkpoint.y = 1800;
  respawnPlayer();
  currentLevel = 1;
  portal.active = false;
  window._victoryShown = false;
  spawnEnemiesLevel1();
  spawnHealthPickupsLevel1();
  spawnChestsLevel1();
  $('zone-name').textContent = '— Cavernas del Abismo —';
  $('area-label').textContent = 'Nivel 1';
  $('objective-text').textContent = 'Elimina a todos los guardianes del abismo';
  updateHealthBar();
}

function respawnPlayer() {
  // Reaparece en el checkpoint del nivel actual (no reinicia el nivel)
  player.x = checkpoint.x;
  player.y = checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround    = false;
  player.jumpsLeft   = 2;
  player.coyoteTimer = 0;
  player.jumpBuffer  = 0;
  player.hp = player.maxHp;
  player.damageFlash = 0;
  updateHealthBar();
}

// ── Pausa ────────────────────────────────────────────
function togglePause() {
  gamePaused = !gamePaused;
  $('pause-screen').classList.toggle('hidden', !gamePaused);
  window.dispatchEvent(new Event(gamePaused ? 'gamePaused' : 'gameResumed'));
}
window.resumeGame  = () => {
  gamePaused = false;
  $('pause-screen').classList.add('hidden');
  window.dispatchEvent(new Event('gameResumed'));
};
window.restartGame = () => {
  gamePaused = false;
  $('pause-screen').classList.add('hidden');
  window.dispatchEvent(new Event('gameResumed'));
  resetPlayer();
};
window.goToStartScreen = () => {
  gamePaused   = false;
  gameRunning  = false;
  cancelAnimationFrame(animFrameId);
  $('pause-screen').classList.add('hidden');
  // Restaurar pantalla de inicio
  const ss = $('start-screen');
  ss.style.display    = 'flex';
  ss.style.opacity    = '0';
  ss.style.transition = 'opacity 0.5s';
  requestAnimationFrame(() => { ss.style.opacity = '1'; });
  $('hud').classList.add('hidden');
  resetPlayer();
  window.dispatchEvent(new Event('gameToStart'));
};

// ── HUD ──────────────────────────────────────────────
function updateHealthBar() {
  $('health-bar').style.width = (player.hp / player.maxHp * 100) + '%';
}

// ── Loop principal ───────────────────────────────────
function loop(ts) {
  if (!gameRunning) return;
  animFrameId = requestAnimationFrame(loop);
  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;
  if (!gamePaused) {
    update(dt);
    render();
  }
}

// ── UPDATE ───────────────────────────────────────────
function update(dt) {
  if (narrativePaused) { updateNarrative(); return; }
  handleInput();
  applyPhysics(dt);
  resolveCollisions();
  updateCamera();
  updateParticles(dt);
  updatePlayerAnim(dt);
  clampPlayerToWorld();
  updateAttack(dt);
  updateEnemies(dt);
  updatePortal(dt);
  updateHealthPickups(dt);
  updateChests(dt);
  updateNarrative();
  updateDamageNumbers(dt);
  updateShake(dt);
  updateScreenMsg(dt);
}

function handleInput() {
  const left  = keys['ArrowLeft']  || keys['KeyA'];
  const right = keys['ArrowRight'] || keys['KeyD'];
  const jump  = keys['Space'] || keys['KeyZ'] || keys['ArrowUp'] || keys['KeyW'];

  // Ataque con P
  if (keys['KeyP'] && !attack.active && attack.cooldown <= 0) {
    startAttack();
  }

  // Movimiento horizontal
  if (left)  { player.vx = -MOVE_SPEED; player.facingRight = false; }
  else if (right) { player.vx = MOVE_SPEED; player.facingRight = true; }
  else {
    // Fricción
    player.vx *= player.onGround ? 0.72 : 0.92;
    if (Math.abs(player.vx) < 0.1) player.vx = 0;
  }

  // Buffer de salto
  if (jump) {
    if (player.jumpBuffer <= 0) player.jumpBuffer = JUMP_BUFFER;
  }

  // Ejecutar salto
  if (player.jumpBuffer > 0) {
    if (player.onGround || player.coyoteTimer > 0) {
      doJump(JUMP_FORCE);
      player.jumpBuffer  = 0;
      player.coyoteTimer = 0;
    } else if (player.jumpsLeft > 0) {
      doJump(DOUBLE_JUMP);
      player.jumpBuffer = 0;
    }
    player.jumpBuffer--;
  } else if (player.jumpBuffer > 0) player.jumpBuffer--;

  // Caída más rápida si soltamos salto
  if (!jump && player.vy < 0) player.vy *= 0.88;
}

function doJump(force) {
  player.vy = force;
  player.jumpsLeft = Math.max(0, player.jumpsLeft - 1);
  // Partículas de salto
  for (let i = 0; i < 8; i++) {
    spawnParticle(
      player.x + player.w / 2,
      player.y + player.h,
      (Math.random() - 0.5) * 4,
      Math.random() * 2 + 1,
      Math.random() > 0.5 ? '#4af0ff' : '#a060ff',
      18 + Math.random() * 12
    );
  }
}

function applyPhysics(dt) {
  player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL);
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Timers
  if (player.coyoteTimer > 0) player.coyoteTimer--;
  if (player.landTimer   > 0) player.landTimer--;
  if (player.damageFlash > 0) player.damageFlash--;
}

function resolveCollisions() {
  const wasOnGround = player.onGround;
  player.onGround   = false;

  for (const p of platforms) {
    if (!aabbOverlap(player, p)) continue;

    const overlapX = overlapAmount(
      player.x, player.x + player.w,
      p.x,      p.x + p.w
    );
    const overlapY = overlapAmount(
      player.y, player.y + player.h,
      p.y,      p.y + p.h
    );

    if (p.type === 'thin') {
      // Solo colisión desde arriba
      const prevBottom = player.y + player.h - player.vy;
      if (player.vy >= 0 && prevBottom <= p.y + 4) {
        player.y  = p.y - player.h;
        player.vy = 0;
        player.onGround  = true;
        player.jumpsLeft = 2;
      }
    } else {
      // Colisión completa: empujar por el eje con menor overlap
      if (overlapX < overlapY) {
        if (player.x + player.w / 2 < p.x + p.w / 2) {
          player.x = p.x - player.w;
        } else {
          player.x = p.x + p.w;
        }
        player.vx = 0;
      } else {
        if (player.y + player.h / 2 < p.y + p.h / 2) {
          // Suelo
          player.y  = p.y - player.h;
          player.vy = 0;
          player.onGround  = true;
          player.jumpsLeft = 2;
        } else {
          // Techo
          player.y  = p.y + p.h;
          player.vy = Math.max(player.vy, 0);
        }
      }
    }
  }

  // Coyote time: si acaba de dejar el suelo, contar frames
  if (wasOnGround && !player.onGround) {
    player.coyoteTimer = COYOTE_TIME;
  }
  // Aterrizaje
  if (!wasOnGround && player.onGround) {
    player.landTimer = 8;
    for (let i = 0; i < 12; i++) {
      spawnParticle(
        player.x + player.w / 2 + (Math.random() - 0.5) * player.w,
        player.y + player.h,
        (Math.random() - 0.5) * 3,
        -Math.random() * 2,
        '#4af0ff88',
        14 + Math.random() * 10
      );
    }
  }
}

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}
function overlapAmount(a1, a2, b1, b2) {
  return Math.min(a2, b2) - Math.max(a1, b1);
}

function clampPlayerToWorld() {
  if (player.x < 0)            { player.x = 0;            player.vx = 0; }
  if (player.x + player.w > WORLD_W) { player.x = WORLD_W - player.w; player.vx = 0; }
  // Foso (caída sin fondo = respawn en checkpoint)
  if (player.y > WORLD_H + 200) respawnPlayer();
}

// ── ATAQUE ───────────────────────────────────────────
function startAttack() {
  attack.active    = true;
  attack.timer     = attack.duration;
  attack.cooldown  = attack.cooldownMax;
  attack.hitEnemies = [];
  player.state     = 'attack';
  // Partículas de espada
  const cx = player.x + player.w / 2 + (player.facingRight ? 30 : -30);
  const cy = player.y + player.h / 2;
  for (let i = 0; i < 10; i++) {
    spawnParticle(cx, cy,
      (Math.random() - 0.5) * 6 + (player.facingRight ? 3 : -3),
      (Math.random() - 0.5) * 6,
      Math.random() > 0.5 ? '#4af0ff' : '#ffffff',
      14 + Math.random() * 10
    );
  }
}

function updateAttack(dt) {
  if (attack.cooldown > 0) attack.cooldown--;

  if (!attack.active) return;
  attack.timer--;

  // Progreso del swing (0 → 1)
  const progress = 1 - attack.timer / attack.duration;
  attack.angle = (player.facingRight ? -1 : 1) * (progress * Math.PI * 0.9 - Math.PI * 0.1);

  // Hitbox de espada
  const reach = 58;
  const swordCX = player.x + player.w / 2 + (player.facingRight ? 1 : -1) * Math.cos(attack.angle) * reach;
  const swordCY = player.y + player.h / 2 + Math.sin(attack.angle) * reach * 0.5;
  const hitBox  = { x: swordCX - 22, y: swordCY - 22, w: 44, h: 44 };

  for (const e of enemies) {
    if (e.dead) continue;
    if (attack.hitEnemies.includes(e)) continue;
    if (aabbOverlap(hitBox, e)) {
      attack.hitEnemies.push(e);
      damageEnemy(e, 34);
      // Retroceso del enemigo
      e.vx = (player.facingRight ? 1 : -1) * 5;
      e.vy = -4;
    }
  }

  if (attack.timer <= 0) {
    attack.active = false;
    if (player.state === 'attack') player.state = 'idle';
  }
}

// ── ENEMIGOS ─────────────────────────────────────────
function spawnEnemiesLevel1() {
  enemies = [
    makeEnemy(900,  1840, 'grunt'),
    makeEnemy(1400, 1440, 'grunt'),
    makeEnemy(1900, 1060, 'grunt'),
    makeEnemy(2200, 1640, 'archer'),
    makeEnemy(2700, 1380, 'grunt'),
    makeEnemy(3100, 1640, 'grunt'),
    makeEnemy(3400, 1760, 'archer'),
    makeEnemy(4100, 1460, 'elite'),  // guardián del portal
  ];
}

function spawnEnemiesLevel2() {
  enemies = [
    makeEnemy(600,  3840, 'grunt'),
    makeEnemy(1100, 3680, 'grunt'),
    makeEnemy(1600, 3520, 'archer'),
    makeEnemy(2000, 3360, 'elite'),
    makeEnemy(2500, 3200, 'grunt'),
    makeEnemy(2800, 3060, 'grunt'),
    makeEnemy(3200, 2900, 'archer'),
    makeEnemy(3600, 2760, 'elite'),
    makeEnemy(4000, 2620, 'grunt'),
    makeEnemy(4400, 2480, 'elite'),
  ];
}

function makeEnemy(x, y, type) {
  const stats = {
    grunt:  { hp: 60,  maxHp: 60,  speed: 1.2, dmg: 12, color: '#cc2244', w: 30, h: 38 },
    archer: { hp: 40,  maxHp: 40,  speed: 0.8, dmg: 10, color: '#9933cc', w: 26, h: 36 },
    elite:  { hp: 120, maxHp: 120, speed: 1.8, dmg: 20, color: '#ff6600', w: 34, h: 44 },
  };
  const s = stats[type];
  return {
    x, y, w: s.w, h: s.h,
    vx: 0, vy: 0,
    hp: s.hp, maxHp: s.maxHp,
    speed: s.speed, dmg: s.dmg,
    color: s.color,
    type,
    onGround: false,
    facingRight: false,
    dead: false,
    deathTimer: 0,
    flashTimer: 0,
    patrolTimer: 0,
    patrolDir: Math.random() > 0.5 ? 1 : -1,
    aggroRange: type === 'archer' ? 420 : 200,
    attackTimer: 0,
    // proyectil para archer
    projectiles: [],
  };
}

function updateEnemies(dt) {
  let aliveCount = 0;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    if (e.dead) {
      e.deathTimer--;
      if (e.deathTimer <= 0) enemies.splice(i, 1);
      continue;
    }

    aliveCount++;
    if (e.flashTimer > 0) e.flashTimer--;
    if (e.attackTimer > 0) e.attackTimer--;

    // IA simple
    const distX = player.x - e.x;
    const distY = player.y - e.y;
    const dist  = Math.sqrt(distX * distX + distY * distY);

    // Gravedad
    e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);

    if (dist < e.aggroRange) {
      // Perseguir al jugador
      e.facingRight = distX > 0;
      if (e.type === 'archer') {
        // Archer se queda quieto y dispara
        e.vx *= 0.8;
        if (e.attackTimer <= 0 && dist < 400) {
          e.attackTimer = 90;
          // Disparar proyectil
          const speed = 5;
          const angle = Math.atan2(distY, distX);
          e.projectiles.push({
            x: e.x + e.w / 2, y: e.y + e.h / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 80,
          });
        }
      } else {
        // Grunt/Elite van hacia el jugador
        e.vx = e.facingRight ? e.speed : -e.speed;
        // Ataque cuerpo a cuerpo
        if (dist < 40 && e.attackTimer <= 0) {
          e.attackTimer = 55;
          damagePlayer(e.dmg);
        }
      }
    } else {
      // Patrullar
      e.patrolTimer--;
      if (e.patrolTimer <= 0) {
        e.patrolTimer   = 60 + Math.random() * 80;
        e.patrolDir    *= -1;
      }
      e.vx = e.patrolDir * e.speed * 0.5;
      e.facingRight = e.vx > 0;
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // Colisión simple con plataformas
    e.onGround = false;
    for (const p of platforms) {
      if (!aabbOverlap(e, p)) continue;
      if (p.type === 'thin') {
        const prevBottom = e.y + e.h - e.vy;
        if (e.vy >= 0 && prevBottom <= p.y + 4) {
          e.y = p.y - e.h; e.vy = 0; e.onGround = true;
        }
      } else {
        const ox = overlapAmount(e.x, e.x + e.w, p.x, p.x + p.w);
        const oy = overlapAmount(e.y, e.y + e.h, p.y, p.y + p.h);
        if (ox < oy) {
          e.x += (e.x + e.w / 2 < p.x + p.w / 2) ? -ox : ox;
          e.vx = 0;
        } else {
          if (e.y + e.h / 2 < p.y + p.h / 2) {
            e.y = p.y - e.h; e.vy = 0; e.onGround = true;
          } else {
            e.y = p.y + p.h; e.vy = Math.max(e.vy, 0);
          }
        }
      }
    }

    // Clamp al mundo
    e.x = Math.max(0, Math.min(WORLD_W - e.w, e.x));

    // Actualizar proyectiles del archer
    for (let j = e.projectiles.length - 1; j >= 0; j--) {
      const pb = e.projectiles[j];
      pb.x += pb.vx * dt;
      pb.y += pb.vy * dt;
      pb.life--;
      // Colisión con jugador
      if (aabbOverlap({ x: pb.x - 6, y: pb.y - 6, w: 12, h: 12 }, player)) {
        damagePlayer(e.dmg);
        spawnParticle(pb.x, pb.y, 0, -2, '#9933cc', 14);
        e.projectiles.splice(j, 1);
        continue;
      }
      if (pb.life <= 0) e.projectiles.splice(j, 1);
    }
  }

  // Activar portal cuando no hay enemigos vivos (nivel 1)
  if (currentLevel === 1 && aliveCount === 0 && enemies.length >= 0) {
    if (!portal.active) {
      portal.active = true;
      showScreenMsg('¡PORTAL ABIERTO! — Avanza al siguiente nivel', '#e8c84a', 200);
    }
  }
  if (currentLevel === 2 && aliveCount === 0 && enemies.length === 0) {
    if (!window._victoryShown) {
      window._victoryShown = true;
      setTimeout(() => startNarrative('victory'), 600);
    }
  }
  // Actualizar contador de enemigos en HUD
  updateEnemyCounter(aliveCount);
}

function damageEnemy(e, amount) {
  e.hp -= amount;
  e.flashTimer = 14;
  // Partículas de sangre/magia mejoradas
  for (let i = 0; i < 12; i++) {
    spawnParticle(
      e.x + e.w / 2, e.y + e.h / 2,
      (Math.random() - 0.5) * 9,
      -Math.random() * 5,
      i % 3 === 0 ? '#ffffff' : e.color,
      18 + Math.random() * 12
    );
  }
  // Número de daño flotante
  spawnDamageNumber(e.x + e.w/2, e.y, amount);
  // Screen shake leve
  triggerShake(3, 6);
  if (e.hp <= 0) {
    e.dead      = true;
    e.deathTimer = 35;
    triggerShake(6, 12);
    // Explosión de muerte
    for (let i = 0; i < 22; i++) {
      spawnParticle(
        e.x + e.w / 2, e.y + e.h / 2,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        i % 2 === 0 ? e.color : '#4af0ff',
        22 + Math.random() * 22
      );
    }
  }
}

function damagePlayer(amount) {
  if (player.damageFlash > 0) return; // invencibilidad temporal
  player.hp = Math.max(0, player.hp - amount);
  player.damageFlash = 30;
  updateHealthBar();
  if (player.hp <= 0) {
    showScreenMsg('— TOM HA CAÍDO —', '#ff3355', 180);
    setTimeout(() => { respawnPlayer(); }, 1500);
  }
}

// ── PORTAL ───────────────────────────────────────────
function updatePortal(dt) {
  if (!portal.active) return;
  portal.pulse = (portal.pulse + 0.05) % (Math.PI * 2);

  // Colisión jugador → portal
  if (currentLevel === 1 && aabbOverlap(player, portal)) {
    enterLevel2();
  }
}

function enterLevel2() {
  currentLevel = 2;
  portal.active = false;
  // Guardar checkpoint del nivel 2
  checkpoint.level = 2;
  checkpoint.x = 300;
  checkpoint.y = 3800;
  // Reposicionar jugador al inicio del nivel 2
  player.x = checkpoint.x;
  player.y = checkpoint.y;
  player.vx = 0; player.vy = 0;
  player.hp = player.maxHp;
  updateHealthBar();
  spawnEnemiesLevel2();
  spawnHealthPickupsLevel2();
  spawnChestsLevel2();
  $('zone-name').textContent = '— Forja del Abismo —';
  $('area-label').textContent = 'Nivel 2';
  $('objective-text').textContent = 'Conquista la Forja y derrota a los elites';
  showScreenMsg('NIVEL 2 — FORJA DEL ABISMO', '#e8c84a', 180);
  setTimeout(() => startNarrative('level2'), 1200);
}

// ── MENSAJES EN PANTALLA ─────────────────────────────
function showScreenMsg(text, color, duration) {
  screenMsg.text  = text;
  screenMsg.color = color || '#4af0ff';
  screenMsg.timer = duration || 120;
}
function updateScreenMsg(dt) {
  if (screenMsg.timer > 0) screenMsg.timer--;
}

// ── CONTADOR DE ENEMIGOS ──────────────────────────────
function updateEnemyCounter(aliveCount) {
  const el = $('enemy-counter');
  if (!el) return;
  if (aliveCount > 0) {
    el.textContent = '☠ ENEMIGOS: ' + aliveCount;
    el.style.display = 'block';
  } else {
    el.textContent = '';
  }
}

// ── SISTEMA DE NARRATIVA ──────────────────────────────
function startNarrative(key) {
  if (!NARRATIVES[key]) return;
  narrativeQueue.length = 0;
  NARRATIVES[key].forEach(n => narrativeQueue.push(n));
  narrativeActive = true;
  narrativePaused = true;
  gamePaused = true;
  showNextNarrativeSlide();
}

function showNextNarrativeSlide() {
  if (narrativeQueue.length === 0) {
    endNarrative();
    return;
  }
  const slide = narrativeQueue.shift();
  $('narrative-speaker').textContent = slide.speaker;
  $('narrative-portrait').textContent = slide.portrait || '⚔';
  narrativeTarget = slide.text;
  narrativeTyping = '';
  narrativeTypeTick = 0;
  $('narrative-text').textContent = '';
  $('narrative-box').classList.remove('hidden');
}

function endNarrative() {
  narrativeActive = false;
  narrativePaused = false;
  gamePaused = false;
  $('narrative-box').classList.add('hidden');
}

function updateNarrative() {
  if (!narrativeActive) return;
  // Efecto de tipeo
  if (narrativeTyping.length < narrativeTarget.length) {
    narrativeTypeTick++;
    if (narrativeTypeTick % 2 === 0) {
      narrativeTyping += narrativeTarget[narrativeTyping.length];
      $('narrative-text').textContent = narrativeTyping;
    }
  }
}

function advanceNarrative() {
  if (!narrativeActive) return;
  // Si está escribiendo, mostrar todo el texto de golpe
  if (narrativeTyping.length < narrativeTarget.length) {
    narrativeTyping = narrativeTarget;
    $('narrative-text').textContent = narrativeTyping;
    return;
  }
  showNextNarrativeSlide();
}

function updateCamera() {
  const targetX = player.x + player.w / 2 - W / 2;
  const targetY = player.y + player.h / 2 - H / 2;
  cam.x += (targetX - cam.x) * cam.lerp;
  cam.y += (targetY - cam.y) * cam.lerp;
  cam.x = Math.max(0, Math.min(WORLD_W - W, cam.x));
  cam.y = Math.max(0, Math.min(WORLD_H - H, cam.y));
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx * dt;
    p.y  += p.vy * dt;
    p.vy += 0.12 * dt;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updatePlayerAnim(dt) {
  if (!player.onGround) {
    player.state = player.vy < 0 ? 'jump' : 'fall';
  } else if (Math.abs(player.vx) > 0.5) {
    player.state = 'run';
  } else {
    player.state = player.landTimer > 0 ? 'land' : 'idle';
  }

  player.frameTick += dt;
  const speed = player.state === 'run' ? 6 : 14;
  if (player.frameTick >= speed) {
    player.frameTick = 0;
    player.frame = (player.frame + 1) % 4;
  }
}

// ── RENDER ───────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H);

  // Fondo de cielo de caverna
  drawBackground();

  // Guardar estado de cámara (con shake)
  ctx.save();
  ctx.translate(-cam.x + shake.x, -cam.y + shake.y);

  // Parallax
  drawParallax();

  // Decoraciones
  drawDecorations();

  // Plataformas
  drawPlatforms();

  // Partículas
  drawParticles();

  // Jugador
  drawPlayer();

  // Arco del ataque
  drawAttackSwing();

  // Pociones
  drawHealthPickups();

  // Cofres
  drawChests();

  // Enemigos
  drawEnemies();

  // Números de daño
  drawDamageNumbers();

  // Portal
  drawPortal();

  ctx.restore();

  // Viñeta
  drawVignette();

  // HUD mensaje
  drawScreenMsg();
}

// ── Fondo de caverna ─────────────────────────────────
function drawBackground() {
  const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.8);
  grad.addColorStop(0,   '#0d0d20');
  grad.addColorStop(0.5, '#080810');
  grad.addColorStop(1,   '#050508');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ── Parallax ─────────────────────────────────────────
function drawParallax() {
  for (const layer of bgLayers) {
    const offX = cam.x * layer.factor;
    const offY = cam.y * layer.factor;
    ctx.save();
    ctx.translate(offX, offY);
    for (const item of layer.items) {
      ctx.globalAlpha = item.alpha;
      ctx.fillStyle   = layer.color;
      if (item.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.shape === 'rect') {
        ctx.fillRect(item.x, item.y, item.size, item.size * 0.4);
      } else if (item.shape === 'arch') {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size, Math.PI, 0);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ── Decoraciones ─────────────────────────────────────
const tick = { v: 0 };
function drawDecorations() {
  tick.v += 0.03;

  for (const d of decorations) {
    if (!inView(d.x - 200, d.y - 200, 400, 400)) continue;

    if (d.type === 'stalactite') {
      const grad = ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.h);
      grad.addColorStop(0, '#1a1a30');
      grad.addColorStop(1, '#0a0a18');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(d.x - d.w / 2, d.y);
      ctx.lineTo(d.x + d.w / 2, d.y);
      ctx.lineTo(d.x, d.y + d.h);
      ctx.closePath();
      ctx.fill();

    } else if (d.type === 'stalagmite') {
      const grad = ctx.createLinearGradient(d.x, d.y - d.h, d.x, d.y);
      grad.addColorStop(0, '#1e1e38');
      grad.addColorStop(1, '#0d0d20');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(d.x - d.w / 2, d.y);
      ctx.lineTo(d.x + d.w / 2, d.y);
      ctx.lineTo(d.x, d.y - d.h);
      ctx.closePath();
      ctx.fill();

    } else if (d.type === 'crystal') {
      const pulse = Math.sin(tick.v + d.x * 0.01) * 0.4 + 0.6;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.globalAlpha = 0.55 * pulse;
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, d.size);
      grd.addColorStop(0, `hsla(${d.hue}, 90%, 75%, 1)`);
      grd.addColorStop(1, `hsla(${d.hue}, 70%, 40%, 0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const r = i % 2 === 0 ? d.size : d.size * 0.55;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

    } else if (d.type === 'pool') {
      const pulse = Math.sin(tick.v * 0.5 + d.x * 0.01) * 0.3 + 0.7;
      ctx.save();
      ctx.globalAlpha = 0.18 * pulse;
      const grd = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
      grd.addColorStop(0, '#4af0ff');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

// ── Plataformas ───────────────────────────────────────
function drawPlatforms() {
  for (const p of platforms) {
    if (!inView(p.x, p.y, p.w, p.h)) continue;

    if (p.type === 'solid') {
      // Base oscura
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      grad.addColorStop(0, '#1e2040');
      grad.addColorStop(1, '#0d0f1e');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // Borde superior con glow
      ctx.strokeStyle = '#3a3a70';
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = 'rgba(74,240,255,0.18)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(p.x + 2, p.y + 1);
      ctx.lineTo(p.x + p.w - 2, p.y + 1);
      ctx.stroke();
      // Textura de piedra (lineas horizontales sutiles)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth   = 1;
      for (let yy = p.y + 8; yy < p.y + p.h; yy += 12) {
        ctx.beginPath();
        ctx.moveTo(p.x, yy);
        ctx.lineTo(p.x + p.w, yy);
        ctx.stroke();
      }

    } else {
      // Plataforma delgada — efecto de madera mágica
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      grad.addColorStop(0, '#2a2060');
      grad.addColorStop(1, '#15103a');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // Runa brillante en el borde
      ctx.strokeStyle = 'rgba(74,240,255,0.5)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + 4, p.y + 1);
      ctx.lineTo(p.x + p.w - 4, p.y + 1);
      ctx.stroke();
      // Puntos de runa
      ctx.fillStyle = 'rgba(74,240,255,0.7)';
      ctx.beginPath(); ctx.arc(p.x + 8, p.y + 3, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + p.w - 8, p.y + 3, 2, 0, Math.PI*2); ctx.fill();
    }
  }
}

// ── Partículas ───────────────────────────────────────
function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Jugador Tom ───────────────────────────────────────
function drawPlayer() {
  const x  = Math.round(player.x);
  const y  = Math.round(player.y);
  const w  = player.w;
  const h  = player.h;
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  if (!player.facingRight) ctx.scale(-1, 1);

  // Squash & stretch según estado
  let sx = 1, sy = 1;
  if (player.state === 'jump')       { sx = 0.82; sy = 1.22; }
  else if (player.state === 'fall')  { sx = 1.14; sy = 0.88; }
  else if (player.landTimer > 4)     { sx = 1.30; sy = 0.72; }
  else if (player.state === 'run') {
    const bob = Math.sin(tick.v * 6) * 0.06;
    sx = 1 + bob; sy = 1 - bob;
  }
  ctx.scale(sx, sy);

  const hw = w / 2;
  const hh = h / 2;

  // Sombra bajo el personaje (aura)
  const auraGrd = ctx.createRadialGradient(0, hh, 0, 0, hh, hw * 1.8);
  auraGrd.addColorStop(0, 'rgba(74,240,255,0.20)');
  auraGrd.addColorStop(1, 'transparent');
  ctx.fillStyle = auraGrd;
  ctx.beginPath();
  ctx.ellipse(0, hh + 4, hw * 1.8, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Capa de daño (flash rojo)
  const flashAlpha = player.damageFlash > 0 ? player.damageFlash / 20 : 0;

  // ─ Cuerpo principal ─
  const bodyGrd = ctx.createLinearGradient(-hw, -hh, hw, hh);
  if (flashAlpha > 0) {
    bodyGrd.addColorStop(0, `rgba(255,80,100,${0.9 + flashAlpha * 0.1})`);
    bodyGrd.addColorStop(1, `rgba(180,20,40,0.9)`);
  } else {
    bodyGrd.addColorStop(0, '#2a2850');
    bodyGrd.addColorStop(0.5, '#1c1a38');
    bodyGrd.addColorStop(1, '#111028');
  }
  ctx.fillStyle = bodyGrd;
  roundRect(ctx, -hw, -hh, w, h * 0.75, 5);
  ctx.fill();

  // Capucha / cabeza
  const headGrd = ctx.createLinearGradient(-hw * 0.8, -hh, hw * 0.8, -hh * 0.2);
  headGrd.addColorStop(0, flashAlpha > 0 ? '#ff5060' : '#22204a');
  headGrd.addColorStop(1, flashAlpha > 0 ? '#cc1030' : '#181630');
  ctx.fillStyle = headGrd;
  ctx.beginPath();
  ctx.arc(0, -hh * 0.6, hw * 0.75, 0, Math.PI * 2);
  ctx.fill();

  // Borde del cuerpo
  ctx.strokeStyle = flashAlpha > 0 ? 'rgba(255,120,140,0.6)' : 'rgba(100,90,180,0.5)';
  ctx.lineWidth   = 1.2;
  roundRect(ctx, -hw, -hh, w, h * 0.75, 5);
  ctx.stroke();

  // Ojos brillantes
  const eyeX = hw * 0.3;
  const eyeY = -hh * 0.55;
  const eyeColor = player.jumpsLeft < 2 ? '#ff80ff' : '#4af0ff';
  ctx.fillStyle = eyeColor;
  ctx.shadowColor = eyeColor;
  ctx.shadowBlur  = 8;
  ctx.beginPath(); ctx.arc(eyeX, eyeY, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur  = 0;

  // Detalles de la capa
  ctx.strokeStyle = 'rgba(74,240,255,0.3)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.7, -hh * 0.2);
  ctx.lineTo(-hw * 0.7, hh * 0.6);
  ctx.stroke();

  // ─ Espada del abismo ─
  drawSword(hh);

  // ─ Piernas ─
  const legOffset = player.state === 'run' ? Math.sin(tick.v * 7) * 6 : 0;
  ctx.fillStyle = flashAlpha > 0 ? '#cc1030' : '#1a183a';
  // pierna delantera
  roundRect(ctx, hw * 0.08, hh * 0.68 - legOffset, hw * 0.38, hh * 0.42, 3);
  ctx.fill();
  // pierna trasera
  ctx.globalAlpha = 0.7;
  roundRect(ctx, -hw * 0.46, hh * 0.68 + legOffset, hw * 0.38, hh * 0.42, 3);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawSword(hh) {
  ctx.save();
  ctx.translate(14, -hh * 0.1);

  const t = tick.v;
  const idleSwing = Math.sin(t * 1.2) * 0.04;
  ctx.rotate(idleSwing - 0.3);

  // Aura de la espada (más intensa durante ataque)
  const attackGlow = attack.active ? (1 - attack.timer / attack.duration) * 0.7 : 0;
  const swordAura = ctx.createLinearGradient(0, 0, 0, -40);
  swordAura.addColorStop(0, `rgba(74,240,255,0)`);
  swordAura.addColorStop(0.4, `rgba(74,240,255,${0.12 + attackGlow * 0.3})`);
  swordAura.addColorStop(1, `rgba(74,240,255,${0.35 + attackGlow * 0.5})`);
  ctx.fillStyle   = swordAura;
  ctx.strokeStyle = 'transparent';
  const auraW = 3 + attackGlow * 8;
  ctx.beginPath();
  ctx.moveTo(-auraW, 8);
  ctx.lineTo( auraW, 8);
  ctx.lineTo( 1, -52);
  ctx.lineTo(-1, -52);
  ctx.closePath();
  ctx.fill();

  // Hoja
  const bladeGrd = ctx.createLinearGradient(-2, 0, 2, -44);
  bladeGrd.addColorStop(0, '#8888cc');
  bladeGrd.addColorStop(0.5, attack.active ? '#88ffff' : '#4af0ff');
  bladeGrd.addColorStop(1, '#ccffff');
  ctx.fillStyle = bladeGrd;
  ctx.shadowColor = '#4af0ff';
  ctx.shadowBlur  = attack.active ? 18 : 0;
  ctx.beginPath();
  ctx.moveTo(-2, 6);
  ctx.lineTo( 2, 6);
  ctx.lineTo( 0.5, -44);
  ctx.lineTo(-0.5, -44);
  ctx.closePath();
  ctx.fill();

  // Punta glow
  ctx.shadowColor = '#4af0ff';
  ctx.shadowBlur  = attack.active ? 22 : 12;
  ctx.beginPath();
  ctx.arc(0, -44, attack.active ? 4 : 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowBlur  = 0;

  // Guardia
  ctx.fillStyle   = '#5040a0';
  ctx.strokeStyle = 'rgba(74,240,255,0.5)';
  ctx.lineWidth   = 0.8;
  roundRect(ctx, -7, 3, 14, 5, 2);
  ctx.fill();
  ctx.stroke();

  // Mango
  ctx.fillStyle = '#2a1a50';
  roundRect(ctx, -2.5, 8, 5, 10, 1.5);
  ctx.fill();

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x, y + h - r,     r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,          r);
  ctx.closePath();
}

// ── Viñeta ────────────────────────────────────────────
function drawVignette() {
  const grad = ctx.createRadialGradient(W/2, H/2, H * 0.25, W/2, H/2, H * 0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,10,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Línea de scanlines ligera
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < H; y += 3) {
    ctx.fillRect(0, y, W, 1);
  }
}

// ── Culling (fuera de pantalla) ───────────────────────
function inView(x, y, w, h) {
  return x < cam.x + W + 100 && x + w > cam.x - 100 &&
         y < cam.y + H + 100 && y + h > cam.y - 100;
}

// ── DIBUJAR ENEMIGOS ─────────────────────────────────
function drawEnemies() {
  for (const e of enemies) {
    if (!inView(e.x - 20, e.y - 20, e.w + 40, e.h + 40)) continue;

    const flash = e.flashTimer > 0;
    const alpha = e.dead ? e.deathTimer / 35 : 1;
    ctx.globalAlpha = alpha;

    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;

    // Barra de vida
    if (!e.dead && e.hp < e.maxHp) {
      const barW = e.w + 10;
      const barX = e.x - 5;
      const barY = e.y - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX, barY, barW, 5);
      ctx.fillStyle = e.type === 'elite' ? '#ff6600' : e.type === 'archer' ? '#9933cc' : '#cc2244';
      ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), 5);
    }
    // Etiqueta de tipo élite
    if (e.type === 'elite' && !e.dead) {
      ctx.save();
      ctx.font = 'bold 9px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,102,0,0.85)';
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 8;
      ctx.fillText('ÉLITE', e.x + e.w/2, e.y - 14);
      ctx.restore();
    }

    // Cuerpo
    ctx.save();
    ctx.translate(cx, cy);
    if (!e.facingRight) ctx.scale(-1, 1);

    const hw = e.w / 2;
    const hh = e.h / 2;

    // Aura de enemigo
    const aura = ctx.createRadialGradient(0, hh, 0, 0, hh, hw * 1.6);
    aura.addColorStop(0, flash ? 'rgba(255,80,80,0.3)' : `${e.color}33`);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.ellipse(0, hh + 4, hw * 1.6, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo principal
    const bodyG = ctx.createLinearGradient(-hw, -hh, hw, hh);
    bodyG.addColorStop(0, flash ? '#ff4060' : e.color + 'cc');
    bodyG.addColorStop(1, flash ? '#aa1030' : '#1a0510');
    ctx.fillStyle = bodyG;
    roundRect(ctx, -hw, -hh, e.w, e.h * 0.72, 4);
    ctx.fill();

    // Cabeza
    ctx.fillStyle = flash ? '#ff5070' : e.color + 'aa';
    ctx.beginPath();
    ctx.arc(0, -hh * 0.55, hw * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // Ojos malvados
    ctx.fillStyle = flash ? '#ffffff' : '#ffdd00';
    ctx.shadowColor = '#ffdd00';
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(hw * 0.28, -hh * 0.5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Arma según tipo
    if (e.type === 'archer') {
      // Arco
      ctx.strokeStyle = flash ? '#ff4060' : '#774499';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hw * 0.5, 0, 14, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.stroke();
      // Flecha
      ctx.strokeStyle = '#ccaaff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hw * 0.3, -4); ctx.lineTo(hw * 1.1, -4);
      ctx.stroke();
    } else if (e.type === 'elite') {
      // Hacha
      ctx.fillStyle = flash ? '#ff8040' : '#884422';
      ctx.beginPath();
      ctx.moveTo(hw * 0.6, -hh * 0.2);
      ctx.lineTo(hw * 1.4, -hh * 0.6);
      ctx.lineTo(hw * 1.4, hh * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Cuchillo del grunt
      ctx.fillStyle = flash ? '#ff6080' : '#556688';
      ctx.beginPath();
      ctx.moveTo(hw * 0.5, 0);
      ctx.lineTo(hw * 1.3, -hh * 0.3);
      ctx.lineTo(hw * 1.3, hh * 0.1);
      ctx.closePath();
      ctx.fill();
    }

    // Piernas
    ctx.fillStyle = flash ? '#aa1030' : '#1a0a20';
    roundRect(ctx, hw * 0.08, hh * 0.66, hw * 0.38, hh * 0.42, 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.7;
    roundRect(ctx, -hw * 0.46, hh * 0.66, hw * 0.38, hh * 0.42, 2);
    ctx.fill();
    ctx.globalAlpha = alpha;

    ctx.restore();

    // Proyectiles del archer
    for (const pb of e.projectiles) {
      if (!inView(pb.x - 8, pb.y - 8, 16, 16)) continue;
      ctx.save();
      ctx.shadowColor = '#aa44ff';
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = '#cc88ff';
      ctx.beginPath();
      ctx.arc(pb.x, pb.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

// ── DIBUJAR PORTAL ───────────────────────────────────
function drawPortal() {
  if (!portal.active || currentLevel !== 1) return;
  const { x, y, w, h } = portal;
  const pulse = Math.sin(portal.pulse) * 0.3 + 0.7;
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.save();
  // Aura exterior
  const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70);
  aura.addColorStop(0, `rgba(232,200,74,${0.15 * pulse})`);
  aura.addColorStop(0.5, `rgba(160,96,255,${0.08 * pulse})`);
  aura.addColorStop(1, 'transparent');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 70, 70, 0, 0, Math.PI * 2);
  ctx.fill();

  // Marco del portal
  ctx.strokeStyle = `rgba(232,200,74,${0.6 + pulse * 0.4})`;
  ctx.lineWidth = 3;
  ctx.shadowColor = '#e8c84a';
  ctx.shadowBlur = 20 * pulse;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.stroke();

  // Interior giratorio
  const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
  inner.addColorStop(0, `rgba(160,96,255,${0.6 * pulse})`);
  inner.addColorStop(0.5, `rgba(74,240,255,${0.3 * pulse})`);
  inner.addColorStop(1, `rgba(232,200,74,${0.1 * pulse})`);
  ctx.fillStyle = inner;
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

  // Texto
  ctx.shadowBlur = 0;
  ctx.fillStyle  = `rgba(232,200,74,${0.8 + pulse * 0.2})`;
  ctx.font       = 'bold 11px Cinzel, serif';
  ctx.textAlign  = 'center';
  ctx.fillText('NIVEL 2', cx, y - 12);

  ctx.restore();
}

// ── DIBUJAR SWING DEL ATAQUE ─────────────────────────
function drawAttackSwing() {
  if (!attack.active) return;
  const cx  = player.x + player.w / 2;
  const cy  = player.y + player.h / 2;
  const dir = player.facingRight ? 1 : -1;
  const progress = 1 - attack.timer / attack.duration;
  const startA = dir > 0 ? -Math.PI * 0.7 : Math.PI * 0.3;
  const endA   = dir > 0 ? Math.PI * 0.1  : Math.PI * 1.1;

  ctx.save();
  ctx.translate(cx, cy);

  // Arco del swing
  const swingAlpha = Math.sin(progress * Math.PI) * 0.6;
  ctx.strokeStyle = `rgba(74,240,255,${swingAlpha})`;
  ctx.lineWidth   = 10;
  ctx.lineCap     = 'round';
  ctx.shadowColor = '#4af0ff';
  ctx.shadowBlur  = 18;
  ctx.beginPath();
  ctx.arc(0, 0, 50, startA, startA + (endA - startA) * progress * dir * dir);
  ctx.stroke();

  // Estela brillante en la punta
  const tipX = Math.cos(attack.angle * dir) * 55;
  const tipY = Math.sin(attack.angle) * 55;
  const tipG = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 14);
  tipG.addColorStop(0, 'rgba(255,255,255,0.9)');
  tipG.addColorStop(1, 'rgba(74,240,255,0)');
  ctx.fillStyle = tipG;
  ctx.beginPath();
  ctx.arc(tipX, tipY, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── DIBUJAR POCIONES ─────────────────────────────────
function drawHealthPickups() {
  for (const p of healthPickups) {
    if (p.collected) continue;
    if (!inView(p.x - 10, p.y - 20, p.w + 20, p.h + 30)) continue;

    const bob  = Math.sin(tick.v * 2.2 + p.bobOffset) * 4;
    const glow = Math.sin(tick.v * 2.2 + p.bobOffset) * 0.3 + 0.7;
    const cx   = p.x + p.w / 2;
    const cy   = p.y + p.h / 2 + bob;

    ctx.save();

    // Aura de curación
    const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
    aura.addColorStop(0, `rgba(68,255,136,${0.18 * glow})`);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();

    // Sombra/suelo
    ctx.globalAlpha = 0.25 * glow;
    ctx.fillStyle = '#44ff88';
    ctx.beginPath();
    ctx.ellipse(cx, p.y + p.h + 4, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Cuerpo del frasco (vial)
    const vialG = ctx.createLinearGradient(p.x + 2, cy - 7, p.x + p.w - 2, cy + 7);
    vialG.addColorStop(0, '#aaffcc');
    vialG.addColorStop(0.4, '#44ff88');
    vialG.addColorStop(1, '#117744');
    ctx.fillStyle = vialG;
    ctx.shadowColor = '#44ff88';
    ctx.shadowBlur  = 10 * glow;
    // Forma de poción: rectángulo redondeado abajo + cuello estrecho arriba
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 2);
    ctx.lineTo(cx - 5, cy - 8);
    ctx.lineTo(cx + 5, cy - 8);
    ctx.lineTo(cx + 7, cy - 2);
    ctx.arcTo(cx + 7, cy + 9, cx, cy + 9, 7);
    ctx.arcTo(cx - 7, cy + 9, cx - 7, cy - 2, 7);
    ctx.closePath();
    ctx.fill();

    // Tapón
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#cc8844';
    ctx.beginPath();
    ctx.rect(cx - 4, cy - 11, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#eeaa66';
    ctx.beginPath();
    ctx.rect(cx - 3, cy - 13, 6, 3);
    ctx.fill();

    // Cruz de vida encima
    ctx.fillStyle = `rgba(255,255,255,${0.85 * glow})`;
    ctx.fillRect(cx - 1, cy - 6, 2, 6);
    ctx.fillRect(cx - 3, cy - 4, 6, 2);

    // Brillo interior (reflejo)
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy, 2, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
function drawScreenMsg() {
  if (screenMsg.timer <= 0) return;
  const alpha = Math.min(1, screenMsg.timer / 30);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 24px Cinzel Decorative, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = screenMsg.color;
  ctx.shadowColor = screenMsg.color;
  ctx.shadowBlur = 20;
  ctx.fillText(screenMsg.text, W / 2, H / 2 - 40);
  ctx.restore();
}