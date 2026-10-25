/* =========================================
   LAST DOJO V3 - ENTITIES & CHARACTER ART (entities.js)
   All characters are drawn procedurally with a dark
   ink outline so they read clearly on any background.
========================================= */

import { PLAYER } from './config.js';

const OUT = '#17110f';

// ---------- colour helpers ----------
const mixCache = new Map();
function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) {
    const key = a + b + t;
    let v = mixCache.get(key);
    if (v) return v;
    const A = hexToRgb(a), B = hexToRgb(b);
    v = `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
    mixCache.set(key, v);
    return v;
}

// ---------- outlined drawing primitives ----------
function limb(c, pts, w, col) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.strokeStyle = OUT; c.lineWidth = w + 3; c.stroke();
    c.strokeStyle = col; c.lineWidth = w; c.stroke();
}
function box(c, x, y, w, h, col) {
    c.fillStyle = OUT; c.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    c.fillStyle = col; c.fillRect(x, y, w, h);
}
function circ(c, x, y, r, col) {
    c.fillStyle = OUT; c.beginPath(); c.arc(x, y, r + 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function ell(c, x, y, rx, ry, col) {
    c.fillStyle = OUT; c.beginPath(); c.ellipse(x, y, rx + 1.5, ry + 1.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}

// Two-bone joint solver: given a shoulder/hip and a hand/foot, place the elbow/knee
// using the limb length, bent to the anatomically correct side.
// 'elbow' bends down/back (forearm swings forward); 'knee' bends forward.
function joint(ax, ay, bx, by, len, kind) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
    const h = Math.sqrt(Math.max(0, len * len - (d / 2) * (d / 2)));
    let nx = -dy / d, ny = dx / d;
    const score = kind === 'elbow' ? ny - nx : nx + ny * 0.1;
    if (score < 0) { nx = -nx; ny = -ny; }
    return [(ax + bx) / 2 + nx * h, (ay + by) / 2 + ny * h];
}
const UPPER_ARM = 8.5, THIGH = 7.5;

// =========================================
// ENTITY CLASSES
// =========================================
export class Player {
    constructor(x, y) {
        this.type = 'player';
        this.x = x; this.y = y; this.w = 40; this.h = 40;
        this.hp = PLAYER.hp; this.maxHp = PLAYER.hp; this.ghostHp = PLAYER.hp;
        this.stamina = PLAYER.stamina; this.maxStamina = PLAYER.stamina;
        this.infection = 0; this.essence = 0; this.food = 0;
        this.speed = PLAYER.speed; this.dmg = PLAYER.dmg;
        this.facingRight = true; this.isMoving = false; this.walkPhase = 0;
        this.attackType = null; this.attackTimer = 0; this.attackMax = 1;
        this.chain = 0; this.chainTimer = 0; this.finisher = false;
        this.dashTimer = 0; this.dashCd = 0; this.dashVx = 0; this.dashVy = 0; this.dashHit = new Set();
        this.spinCd = 0; this.iFrames = 0; this.hurtTimer = 0; this.hitTimer = 0;
        this.staggerTimer = 0; this.eatTimer = 0; this.rushTimer = 0;
        this.surgeWarn = 0; this.staminaDelay = 0; this.sanctTime = 0;
        this.mealTier = 0; this.mealBonus = 0;   // tonight's meal, if any
        this.kvx = 0; this.kvy = 0;
        this.trail = [];
        this.tech = {};
    }
    t(id) { return this.tech[id] || 0; }
}

export class Enemy {
    constructor(type, x, y, stats) {
        this.type = type;
        this.x = x; this.y = y;
        this.w = stats.size; this.h = stats.size;
        this.hp = stats.hp; this.maxHp = stats.hp;
        this.speed = stats.spd; this.dmg = stats.dmg; this.keg = stats.keg;
        this.windupMax = stats.windup; this.dojoDmg = stats.dojoDmg;
        this.kbRes = stats.kbRes !== undefined ? stats.kbRes : 1;
        this.isBoss = !!stats.boss;
        this.facingRight = true; this.isMoving = false;
        this.walkPhase = Math.random() * 6; this.seed = Math.random() * 100;
        this.tint = Math.floor(Math.random() * 4);
        this.vx = 0; this.vy = 0;
        this.hitTimer = 0; this.stunTimer = 0; this.biteTimer = 0; this.attackWind = 0;
        this.spawnTimer = 0; this.spawnMax = 1;
        this.burning = false; this.shade = false; this.dead = false; this.handled = false;
        this.aggroTimer = 0; this.aggro = false;
        this.anchorX = x; this.anchorY = y;
        this.dojoOffX = (Math.random() - 0.5) * 140; this.dojoOffY = (Math.random() - 0.5) * 50;
        this.state = 'idle'; this.stateTimer = 0; this.fuse = 0;
        this.shootTimer = 60 + Math.random() * 60; this.specialTimer = 180; this.summonTimer = 360;
        this.castTimer = 0; this.phase2 = false;
        this.chargeVx = 0; this.chargeVy = 0; this.targetDist = 0; this.travelled = 0;
        this.damagedWhileStunned = false; this.calm = 0; // frames before a new boar may notice the master
    }
}

export class Corpse {
    constructor(z, dirX, yeet = false) {
        Object.assign(this, {
            type: z.type, w: z.w, h: z.h, x: z.x, tint: z.tint, seed: z.seed,
            isAlpha: z.isAlpha, isBrood: z.isBrood, shade: z.shade,
            facingRight: z.facingRight, isMoving: false, walkPhase: 0, hitTimer: 0
        });
        this.dead = true;
        this.groundY = z.y;
        this.y = z.y;
        this.vx = dirX * (Math.random() * 5 + (yeet ? 14 : 4));
        this.z = 0; this.vz = -(Math.random() * 5 + (yeet ? 14 : 4));
        this.rot = 0;
        this.spin = dirX * (0.15 + Math.random() * 0.2) * (yeet ? 2 : 1);
        this.life = 150;
    }
    update() {
        this.x += this.vx;
        this.z += this.vz; this.vz += 0.8;
        if (this.z > 0) {
            this.z = 0; this.vz *= -0.35; this.vx *= 0.5; this.spin *= 0.5;
            if (Math.abs(this.vz) < 1) this.vz = 0;
        }
        this.vx *= 0.97;
        this.rot += this.spin;
        this.y = this.groundY + this.z;
        this.life--;
    }
}

export class Loot {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.z = 0; this.vz = -4 - Math.random() * 3;
        this.vx = (Math.random() - 0.5) * 3;
        this.age = 0;
    }
    update() {
        this.age++;
        if (this.vz !== 0 || this.z < 0) {
            this.x += this.vx; this.z += this.vz; this.vz += 0.45;
            if (this.z >= 0) { this.z = 0; this.vz = this.vz > 2 ? -this.vz * 0.35 : 0; this.vx *= 0.5; }
        }
    }
}

export class Projectile {
    constructor(x, y, vx, vy, owner) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = 220; this.owner = owner; this.reflected = false; this.dead = false;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life--; }
}

export class Particle {
    constructor(x, y, color, o = {}) {
        this.x = x; this.y = y; this.color = color;
        const sp = o.speed !== undefined ? o.speed : 5;
        const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread !== undefined ? o.spread : 0.6) : Math.random() * Math.PI * 2;
        const v = sp * (0.4 + Math.random() * 0.8);
        this.vx = Math.cos(a) * v; this.vy = Math.sin(a) * v - (o.lift || 0);
        this.grav = o.grav !== undefined ? o.grav : 0.25;
        this.drag = o.drag !== undefined ? o.drag : 0.94;
        this.size = o.size || (2 + Math.random() * 3);
        this.max = o.life || (18 + Math.random() * 18);
        this.life = this.max;
        this.shape = o.shape || 'sq';
        this.glow = !!o.glow;
        this.rot = Math.random() * 6; this.vr = (Math.random() - 0.5) * 0.3;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vx *= this.drag; this.vy = this.vy * this.drag + this.grav;
        this.rot += this.vr;
        this.life--;
    }
    draw(c) {
        const t = this.life / this.max;
        c.globalAlpha = Math.min(1, t * 1.5);
        c.fillStyle = this.color;
        if (this.shape === 'petal') {
            c.save(); c.translate(this.x, this.y); c.rotate(this.rot);
            c.beginPath(); c.ellipse(0, 0, this.size, this.size * 0.55, 0, 0, Math.PI * 2); c.fill();
            c.restore();
        } else if (this.shape === 'smoke') {
            const r = this.size * (1.6 - t);
            c.beginPath(); c.arc(this.x, this.y, r, 0, Math.PI * 2); c.fill();
        } else if (this.shape === 'spark') {
            c.strokeStyle = this.color; c.lineWidth = 2;
            c.beginPath(); c.moveTo(this.x, this.y); c.lineTo(this.x - this.vx * 2, this.y - this.vy * 2); c.stroke();
        } else {
            const s = this.size * (0.5 + t * 0.5);
            c.fillRect(this.x - s / 2, this.y - s / 2, s, s);
        }
        c.globalAlpha = 1;
    }
}

export class FloatText {
    constructor(x, y, text, color, size = 16) {
        this.x = x; this.y = y; this.text = text; this.color = color; this.size = size;
        this.life = 60; this.vy = -1.6;
    }
    update() { this.y += this.vy; this.vy *= 0.95; this.life--; }
    draw(c) {
        const age = 60 - this.life;
        const pop = age < 6 ? 1 + (6 - age) * 0.08 : 1;
        c.globalAlpha = Math.min(1, this.life / 25);
        c.font = `700 ${Math.round(this.size * pop)}px 'Zen Kaku Gothic New', 'Trebuchet MS', sans-serif`;
        c.textAlign = 'center';
        c.lineWidth = 4; c.strokeStyle = 'rgba(15,10,10,0.9)';
        c.strokeText(this.text, this.x, this.y);
        c.fillStyle = this.color; c.fillText(this.text, this.x, this.y);
        c.globalAlpha = 1;
    }
}

export class Decal {
    constructor(x, y, color, scale = 1, life = 900) {
        this.x = x; this.y = y; this.color = color; this.life = life;
        this.blobs = [];
        const n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
            this.blobs.push({
                dx: (Math.random() - 0.5) * 26 * scale, dy: (Math.random() - 0.5) * 10 * scale,
                r: (5 + Math.random() * 9) * scale
            });
        }
    }
    update() { this.life--; }
    draw(c) {
        c.globalAlpha = Math.min(1, this.life / 200);
        c.fillStyle = this.color;
        for (const b of this.blobs) {
            c.beginPath(); c.ellipse(this.x + b.dx, this.y + b.dy, b.r, b.r * 0.5, 0, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
    }
}

export class Pool {
    // kind: 'acid' | 'erupt' | 'lava'
    constructor(x, y, kind, life = 240, warn = 0) {
        this.x = x; this.y = y; this.kind = kind; this.life = life; this.warn = warn; this.warnMax = Math.max(1, warn);
        this.rx = kind === 'erupt' ? 46 : (kind === 'lava' ? 44 : 28);
        this.ry = this.rx * 0.45;
    }
    get active() { return this.warn <= 0; }
    update() { if (this.warn > 0) this.warn--; else if (this.kind !== 'lava') this.life--; }
    contains(px, py) {
        const dx = px - this.x, dy = py - this.y;
        return (dx * dx) / (this.rx * this.rx) + (dy * dy) / (this.ry * this.ry) <= 1;
    }
    draw(c, frames) {
        if (this.warn > 0) {
            const p = 1 - this.warn / this.warnMax;
            c.strokeStyle = `rgba(255,60,40,${0.4 + Math.sin(frames * 0.5) * 0.3})`;
            c.lineWidth = 2; c.setLineDash([6, 5]);
            c.beginPath(); c.ellipse(this.x, this.y, this.rx, this.ry, 0, 0, Math.PI * 2); c.stroke();
            c.setLineDash([]);
            c.fillStyle = 'rgba(255,60,40,0.2)';
            c.beginPath(); c.ellipse(this.x, this.y, this.rx * p, this.ry * p, 0, 0, Math.PI * 2); c.fill();
            return;
        }
        const fade = this.kind === 'lava' ? 1 : Math.min(1, this.life / 60);
        const cols = { acid: ['#8fbf2f', '#d4e157'], erupt: ['#5e0b10', '#e53935'], lava: ['#bf360c', '#ffab40'] }[this.kind];
        c.globalAlpha = 0.75 * fade;
        c.fillStyle = cols[0];
        c.beginPath(); c.ellipse(this.x, this.y, this.rx, this.ry, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = cols[1];
        for (let i = 0; i < 3; i++) {
            const a = frames * 0.05 + i * 2.1;
            const r = 2 + ((frames + i * 20) % 40) / 10;
            c.beginPath(); c.arc(this.x + Math.cos(a) * this.rx * 0.5, this.y + Math.sin(a) * this.ry * 0.5, r, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
    }
}

export class Cache {
    constructor(x, y) { this.x = x; this.y = y; this.w = 44; this.h = 34; this.hp = 3; this.hitTimer = 0; this.dead = false; }
}

// Short-lived combat visuals
export class Slash {
    constructor(x, y, dir, big = false) {
        this.x = x; this.y = y; this.dir = dir; this.big = big; this.life = big ? 12 : 9; this.max = this.life;
    }
    update() { this.life--; }
    draw(c) {
        const t = this.life / this.max;
        const r = (this.big ? 34 : 24) * (1.2 - t * 0.4);
        c.save(); c.translate(this.x, this.y); c.scale(this.dir, 1);
        c.globalAlpha = t;
        c.strokeStyle = this.big ? '#fff3c4' : '#ffffff';
        c.lineWidth = (this.big ? 7 : 4) * t + 1; c.lineCap = 'round';
        c.beginPath(); c.arc(-6, 0, r, -1.1, 1.1); c.stroke();
        c.restore(); c.globalAlpha = 1;
    }
}

export class Ring {
    constructor(x, y, r0, r1, life, color, width = 4) {
        Object.assign(this, { x, y, r0, r1, life, max: life, color, width });
    }
    update() { this.life--; }
    draw(c) {
        const t = 1 - this.life / this.max;
        const r = this.r0 + (this.r1 - this.r0) * t;
        c.globalAlpha = 1 - t;
        c.strokeStyle = this.color; c.lineWidth = this.width * (1 - t) + 1;
        c.beginPath(); c.ellipse(this.x, this.y, r, r * 0.5, 0, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
    }
}

// =========================================
// CHARACTER ART
// =========================================
const BUILDS = {
    normal: { tw: 16, th: 17, hw: 14, hh: 13, aw: 4.5, lw: 5 },
    thin:   { tw: 12, th: 16, hw: 12, hh: 12, aw: 3.5, lw: 4 },
    brute:  { tw: 24, th: 19, hw: 12, hh: 11, aw: 7,   lw: 6.5 },
    fat:    { tw: 26, th: 20, hw: 11, hh: 11, aw: 3.5, lw: 5 }
};

const ZLOOK = {
    walker:  { skin: '#7f9b6c', build: 'normal', eye: '#e8e070' },
    shade:   { skin: '#5e7553', build: 'normal', eye: '#cfd8ff' },
    runner:  { skin: '#a7ab8e', build: 'thin',   eye: '#ff4a3d', shirt: '#4a4a52', pants: '#2b2b30' },
    brute:   { skin: '#6e5480', build: 'brute',  eye: '#ffd54f', shirt: null, pants: '#2e2a38' },
    spitter: { skin: '#a9b83a', build: 'normal', eye: '#ffffff', shirt: '#4f553a', pants: '#2f3322' },
    bloater: { skin: '#93a04e', build: 'fat',    eye: '#f0e68c', shirt: null, pants: '#3a3a2a' },
    alpha:   { skin: '#8e3b3b', build: 'brute',  eye: '#ff1744', shirt: null, pants: '#1f1414' },
    brood:   { skin: '#7e5a8c', build: 'normal', eye: '#e1bee7', shirt: '#3d2f45', pants: '#241a2a' }
};
const SHIRTS = ['#4b5d73', '#6b4f3a', '#5c5c66', '#7a3b3b'];
const PANTS = ['#2f3542', '#3b3028', '#2b2b2b', '#33302a'];

export function drawEntity(c, e, frames) {
    if (e.type === 'boar') return drawBoar(c, e, frames);
    if (e.type === 'warlord') return drawWarlord(c, e, frames);
    if (e.type === 'player') return drawPlayer(c, e, frames);
    return drawZombie(c, e, frames);
}

// Shared humanoid skeleton. `look` holds colours, `pose` holds limb targets.
function humanoid(c, e, frames, look, pose) {
    const b = BUILDS[look.build];
    const s = e.w / 40;
    const flash = e.hitTimer > 0;
    const burn = e.burning ? 0.5 : 0;
    const C = col => flash ? '#ffffff' : (burn ? mix(col, '#2a1a10', burn) : col);

    c.save();
    const lift = e.spawnTimer > 0 ? (e.spawnTimer / e.spawnMax) * e.h * 0.9 : 0;
    c.translate(e.x + e.w / 2, e.y + e.h + lift);
    if (e.dead) { c.translate(0, -e.h * 0.4); c.rotate(e.rot || 0); c.translate(0, e.h * 0.4); }
    if (!e.facingRight) c.scale(-1, 1);
    c.scale(s, s);

    const hipY = -13 - (pose.bob || 0);
    const topY = hipY - b.th;
    const shY = topY + 3;

    // legs
    const L = pose.legs;
    const kb = pose.knees ? pose.knees.bk : joint(-2, hipY, L.bk[0], L.bk[1], THIGH, 'knee');
    const kf = pose.knees ? pose.knees.fr : joint(2, hipY, L.fr[0], L.fr[1], THIGH, 'knee');
    limb(c, [-2, hipY, kb[0], kb[1], L.bk[0], L.bk[1]], b.lw, C(mix(look.pants, '#000000', 0.25)));
    limb(c, [2, hipY, kf[0], kf[1], L.fr[0], L.fr[1]], b.lw, C(look.pants));

    // upper body leans around the hip
    c.translate(0, hipY); c.rotate(pose.lean || 0); c.translate(0, -hipY);

    // back arm
    const A = pose.arms;
    const upperBack = look.sleeve ? mix(look.sleeve, '#000000', 0.2) : mix(look.skin, '#000000', 0.25);
    const eb = joint(-1, shY, A.bk[0], A.bk[1], UPPER_ARM, 'elbow');
    limb(c, [-1, shY, eb[0], eb[1], A.bk[0], A.bk[1]], b.aw, C(upperBack));

    // torso
    if (look.build === 'fat') {
        const pulse = 1 + (e.fuse || 0) / 60 * 0.25 + Math.sin(frames * 0.15 + e.seed) * 0.03;
        ell(c, 2, hipY - 9, 15 * pulse, 13 * pulse, C(look.skin));
        c.strokeStyle = C('#5d6b2a'); c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(-6, hipY - 14); c.lineTo(0, hipY - 9); c.lineTo(-3, hipY - 3);
        c.moveTo(6, hipY - 16); c.lineTo(9, hipY - 8); c.stroke();
        if (e.fuse > 0 && Math.floor(frames / 4) % 2 === 0) {
            c.fillStyle = 'rgba(255,240,120,0.45)';
            c.beginPath(); c.ellipse(2, hipY - 9, 15 * pulse, 13 * pulse, 0, 0, Math.PI * 2); c.fill();
        }
    } else {
        const shirt = look.shirt === null ? look.skin : look.shirt;
        box(c, -b.tw / 2, topY, b.tw, b.th, C(shirt));
        if (look.gi) {
            c.fillStyle = C('#cfc6b4'); c.fillRect(-b.tw / 2, topY, 4, b.th);
            c.strokeStyle = C('#a59c8a'); c.lineWidth = 1.2;
            c.beginPath(); c.moveTo(-3, topY); c.lineTo(3, topY + 9); c.lineTo(6, topY); c.stroke();
            box(c, -b.tw / 2, hipY - 4, b.tw, 3.5, C('#1d1d1d'));
            c.fillStyle = C('#1d1d1d'); c.fillRect(-4, hipY - 1, 2.5, 5); c.fillRect(-1.5, hipY - 1, 2.5, 4);
        } else if (look.shirt !== null) {
            // torn hem and a rip showing skin
            c.fillStyle = C(look.skin);
            c.beginPath(); c.moveTo(-b.tw / 2 + 3, hipY); c.lineTo(-b.tw / 2 + 6, hipY - 5); c.lineTo(-b.tw / 2 + 9, hipY); c.fill();
            c.fillRect(2, topY + 5, 4, 3);
        } else {
            c.strokeStyle = C(mix(look.skin, '#000000', 0.35)); c.lineWidth = 1.2;
            c.beginPath(); c.moveTo(-5, topY + 7); c.lineTo(5, topY + 7); c.moveTo(0, topY + 9); c.lineTo(0, hipY - 2); c.stroke();
        }
        if (look.spikes) {
            c.fillStyle = C('#e8dcc4');
            for (let i = 0; i < 3; i++) {
                const y0 = topY + 3 + i * 5;
                c.beginPath(); c.moveTo(-b.tw / 2, y0); c.lineTo(-b.tw / 2 - 7, y0 - 3); c.lineTo(-b.tw / 2, y0 + 3); c.fill();
            }
        }
        if (look.eggs) {
            for (let i = 0; i < 3; i++) {
                const p = Math.sin(frames * 0.1 + i) * 0.8;
                circ(c, -b.tw / 2 - 3, topY + 4 + i * 5, 3.5 + p, C('#b48ac4'));
            }
        }
    }

    // head
    let hl, hy;
    if (look.build === 'fat') {
        hl = -5; hy = hipY - 22 - b.hh;
    } else {
        hl = -b.hw / 2 + (look.build === 'brute' ? 3 : 0) + (pose.headX || 0);
        hy = (look.build === 'brute' ? topY - b.hh + 4 : topY - b.hh) + (pose.headY || 0);
    }
    box(c, hl, hy, b.hw, b.hh, C(look.skin));

    if (look.gi) {
        // hair, topknot, headband
        c.fillStyle = C('#1e1714'); c.fillRect(hl, hy, b.hw, 4);
        box(c, hl - 2, hy - 3, 5, 4, C('#1e1714'));
        c.fillStyle = C('#c0392b'); c.fillRect(hl, hy + 4, b.hw, 2.6);
        const wave = Math.sin(frames * 0.25) * 2 + (e.isMoving ? Math.sin(frames * 0.5) * 2 : 0);
        c.strokeStyle = C('#c0392b'); c.lineWidth = 2;
        c.beginPath(); c.moveTo(hl, hy + 5); c.lineTo(hl - 7, hy + 4 + wave); c.moveTo(hl, hy + 6); c.lineTo(hl - 6, hy + 8 + wave * 0.6); c.stroke();
        // eye
        c.fillStyle = look.eyeGlow && !flash ? look.eye : C('#1b1b1b');
        c.fillRect(hl + b.hw - 5, hy + 7, 2, 2.5);
        if (look.eyeGlow && !flash) {
            c.globalAlpha = 0.35; c.fillRect(hl + b.hw - 7, hy + 6, 6, 4.5); c.globalAlpha = 1;
        }
        // kegare veins
        if (look.veins > 0 && !flash) {
            c.strokeStyle = 'rgba(123,63,160,0.95)'; c.lineWidth = 1;
            c.beginPath(); c.moveTo(hl + 2, hy + 12); c.lineTo(hl + 4, hy + 9); c.lineTo(hl + 3, hy + 7);
            if (look.veins > 1) { c.moveTo(-5, topY + 2); c.lineTo(-2, topY + 7); c.lineTo(-4, topY + 11); }
            c.stroke();
        }
    } else {
        // sunken eyes and mouth
        c.fillStyle = C('#1b1414'); c.fillRect(hl + b.hw - 6, hy + 4, 4, 3);
        c.fillStyle = flash ? '#fff' : look.eye; c.fillRect(hl + b.hw - 4.5, hy + 5, 1.5, 1.5);
        if (pose.mouthOpen) { c.fillStyle = C('#5a0f0f'); c.fillRect(hl + b.hw - 6, hy + 8, 5, 3.5); }
        else { c.fillStyle = C('#1b1414'); c.fillRect(hl + b.hw - 6, hy + 9, 4, 1.4); }
        if (look.sac) {
            const p = 4.5 + Math.sin(frames * 0.2 + e.seed) * 1.2 + (e.attackWind > 0 ? 2 : 0);
            circ(c, hl + b.hw - 3, hy + b.hh + 2, p, C('#d6e05a'));
        }
    }

    // front arm (sleeve then forearm for the gi)
    const fx = A.fr[0], fy = A.fr[1];
    const [ex, ey] = joint(1, shY, fx, fy, UPPER_ARM, 'elbow');
    if (look.sleeve) {
        limb(c, [1, shY, ex, ey], b.aw + 1, C(look.sleeve));
        limb(c, [ex, ey, fx, fy], b.aw, C(look.skin));
        box(c, fx - 2.5, fy - 2.5, 5, 5, C(look.skin));
    } else {
        limb(c, [1, shY, ex, ey, fx, fy], b.aw, C(look.skin));
    }

    c.restore();

    // burning flames drawn upright, in world space
    if (e.burning && !e.dead) {
        const cx = e.x + e.w / 2, cy = e.y + e.h * 0.4;
        for (let i = 0; i < 3; i++) {
            const fx2 = cx + (i - 1) * e.w * 0.22;
            const fh = e.h * (0.35 + Math.abs(Math.sin(frames * 0.3 + i * 2 + e.seed)) * 0.35);
            c.fillStyle = i === 1 ? 'rgba(255,214,90,0.85)' : 'rgba(255,120,30,0.8)';
            c.beginPath(); c.moveTo(fx2 - 6, cy + 8); c.quadraticCurveTo(fx2, cy - fh, fx2 + 6, cy + 8); c.fill();
        }
    }
}

// ---------- Player ----------
function drawPlayer(c, p, frames) {
    const sw = p.isMoving ? Math.sin(p.walkPhase) : 0;
    const legs = { bk: [-sw * 6, -Math.max(0, -Math.sin(p.walkPhase)) * 2.5], fr: [sw * 6, -Math.max(0, Math.sin(p.walkPhase)) * 2.5] };
    let arms, lean = 0, headX = 0, knees = null, headY = 0;
    let bob = p.isMoving ? Math.abs(Math.cos(p.walkPhase)) * 1.2 : Math.sin(frames * 0.07) * 0.5;

    if (p.pose === 'meditate') {
        // seated, legs crossed, hands resting on knees
        bob = -9; legs.bk = [3, 0]; legs.fr = [-3, 0];
        knees = { bk: [-10, -2], fr: [10, -2] };
        arms = { bk: [-4, -9], fr: [7, -9] };
        lean = Math.sin(frames * 0.03) * 0.02;
    } else if (p.pose === 'kneel') {
        // one knee down, exhausted
        bob = -5; legs.fr = [8, 0]; legs.bk = [-12, -1];
        knees = { fr: [9, -10], bk: [-3, 0] };
        arms = { bk: [0, -9], fr: [9, -14] };
        lean = 0.28; headY = 2;
    } else if (p.pose === 'clutch') {
        // hunched, both hands pressed to the chest
        bob = -1; legs.fr = [6, 0]; legs.bk = [-7, 0];
        arms = { bk: [4, -23], fr: [6, -25] };
        lean = 0.22 + Math.sin(frames * 0.5) * 0.03;
    } else if (p.staggerTimer > 0) {
        arms = { bk: [-6, -34 + Math.sin(frames * 0.6) * 3], fr: [8, -35 + Math.cos(frames * 0.6) * 3] };
        lean = Math.sin(frames * 0.3) * 0.15;
    } else if (p.attackType === 'spin') {
        arms = { bk: [-16, -27], fr: [16, -27] };
        legs.fr = [15, -13]; legs.bk = [-3, 0];
        lean = -0.05;
    } else if (p.attackType === 'punch') {
        const prog = 1 - p.attackTimer / p.attackMax;
        const ext = prog < 0.25 ? prog / 0.25 : Math.max(0, 1 - (prog - 0.25) / 0.75);
        const reach = p.finisher ? 22 : 16;
        arms = { bk: [6, -31], fr: [8 + ext * reach, -27] };
        lean = ext * (p.finisher ? 0.22 : 0.12);
        headX = ext * 1.5;
        legs.fr = [7, 0]; legs.bk = [-6, 0];
    } else if (p.dashTimer > 0) {
        arms = { bk: [-11, -20], fr: [-8, -18] };
        lean = 0.35; legs.fr = [9, -2]; legs.bk = [-9, -3];
    } else if (p.eatTimer > 0) {
        arms = { bk: [6, -31], fr: [6, -36 + Math.sin(frames * 0.6) * 1.5] };
    } else if (p.hurtTimer > 0) {
        arms = { bk: [-4, -32], fr: [4, -33] }; lean = -0.18;
    } else if (p.isMoving) {
        arms = { bk: [-sw * 5 + 1, -17], fr: [sw * 5 + 3, -17] };
        lean = 0.05;
    } else {
        // fighting stance: fists up
        const br = Math.sin(frames * 0.07) * 0.8;
        arms = { bk: [7, -30 + br], fr: [11, -28 + br] };
        legs.fr = [6, 0]; legs.bk = [-5, 0];
    }

    const skulls = Math.floor(p.infection);
    const look = {
        build: 'normal', gi: true, skin: '#efc391', shirt: '#f2ede1', sleeve: '#f2ede1', pants: '#e6dfcf',
        veins: skulls, eyeGlow: p.rushTimer > 0 || skulls >= 1,
        eye: p.rushTimer > 0 ? '#ff2a2a' : '#c77dff'
    };

    // dash / rush afterimages
    for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        c.save(); c.globalAlpha = 0.1 + i * 0.05;
        c.fillStyle = p.rushTimer > 0 ? '#ff3b3b' : '#9fd8ff';
        c.beginPath(); c.ellipse(t.x + 20, t.y + 22, 9, 18, 0, 0, Math.PI * 2); c.fill();
        c.restore();
    }

    if (p.rushTimer > 0) {
        c.save(); c.globalAlpha = 0.22 + Math.sin(frames * 0.4) * 0.1;
        c.fillStyle = '#ff2a2a';
        c.beginPath(); c.ellipse(p.x + 20, p.y + 22, 22, 28, 0, 0, Math.PI * 2); c.fill();
        c.restore();
    }

    c.save();
    if (p.iFrames > 0 && p.dashTimer <= 0 && Math.floor(frames / 4) % 2 === 0) c.globalAlpha = 0.45;
    humanoid(c, p, frames, look, { legs, arms, lean, bob, headX, headY, knees });
    c.restore();

    if (p.staggerTimer > 0) {
        c.fillStyle = '#c77dff';
        for (let i = 0; i < 3; i++) {
            const a = frames * 0.15 + i * 2.1;
            c.fillRect(p.x + 20 + Math.cos(a) * 14 - 2, p.y - 6 + Math.sin(a) * 4, 4, 4);
        }
    }
}

// ---------- Zombies ----------
function drawZombie(c, z, frames) {
    let key = z.isAlpha ? 'alpha' : (z.isBrood ? 'brood' : z.type);
    if (z.shade && key === 'walker') key = 'shade';
    const look = { ...(ZLOOK[key] || ZLOOK.walker) };
    if (look.shirt === undefined) { look.shirt = SHIRTS[z.tint % 4]; look.pants = PANTS[z.tint % 4]; }
    if (key === 'alpha') look.spikes = true;
    if (key === 'brood') { look.eggs = true; look.sac = true; }
    if (key === 'spitter') look.sac = true;

    const ph = z.walkPhase;
    const moving = z.isMoving && !z.dead;
    const sw = moving ? Math.sin(ph) : 0;
    const legs = { bk: [-sw * 5, -Math.max(0, -Math.sin(ph)) * 2], fr: [sw * 5, -Math.max(0, Math.sin(ph)) * 2] };
    const sway = Math.sin(frames * 0.08 + z.seed);
    let arms, lean = 0.08 + sway * 0.04, mouthOpen = false, headY = 0;

    if (z.dead) {
        arms = { bk: [-14, -26], fr: [14, -26] }; lean = 0;
    } else if (z.spawnTimer > 0) {
        arms = { bk: [6, -42], fr: [10, -44 + sway * 2] }; lean = 0;
    } else if (z.attackWind > 0) {
        arms = { bk: [-4, -41], fr: [2, -43] }; lean = -0.12; mouthOpen = true;
    } else if (z.biteTimer > 38) {
        arms = { bk: [16, -24], fr: [19, -26] }; lean = 0.3; mouthOpen = true;
    } else if (z.stunTimer > 0) {
        arms = { bk: [-5, -18], fr: [4, -16] }; lean = -0.15; headY = 2;
    } else if (z.type === 'runner') {
        arms = { bk: [-9 - sw * 3, -18], fr: [-6 + sw * 3, -17] }; lean = 0.35;
    } else if (z.type === 'spitter' && z.shootTimer < 20) {
        arms = { bk: [4, -20], fr: [6, -20] }; lean = -0.1; mouthOpen = true;
    } else {
        arms = { bk: [13, -25 + sway * 2], fr: [15, -27 - sway * 2] };
    }
    if (z.type === 'brute' || z.isAlpha) lean += 0.12;

    humanoid(c, z, frames, look, { legs, arms, lean, mouthOpen, headY, bob: moving ? Math.abs(Math.cos(ph)) : 0 });

    if (z.stunTimer > 0 && !z.dead) drawStars(c, z.x + z.w / 2, z.y - 4, frames);
}

function drawStars(c, x, y, frames) {
    c.fillStyle = '#ffd54f';
    for (let i = 0; i < 3; i++) {
        const a = frames * 0.18 + i * 2.1;
        c.fillRect(x + Math.cos(a) * 12 - 2, y + Math.sin(a) * 4 - 2, 4, 4);
    }
}

// ---------- Boar ----------
function drawBoar(c, z, frames) {
    const s = z.w / 58;
    const flash = z.hitTimer > 0;
    const C = col => flash ? '#ffffff' : col;
    const charging = z.state === 'charge';
    const moving = (z.isMoving || charging) && !z.dead;
    const leg = moving ? Math.sin(frames * (charging ? 0.9 : 0.35)) * 6 : 0;

    c.save();
    c.translate(z.x + z.w / 2, z.y + z.h);
    if (z.dead) { c.translate(0, -z.h * 0.4); c.rotate(z.rot || 0); c.translate(0, z.h * 0.4); }
    if (!z.facingRight) c.scale(-1, 1);
    if (z.state === 'windup' && !z.dead) c.translate((Math.random() - 0.5) * 3, 0);
    c.scale(s, s);

    const dark = '#3a2418', mid = '#5b3a29', light = '#7a523b';
    limb(c, [-14, -12, -14 + leg, 0], 6, C(dark));
    limb(c, [10, -12, 10 - leg, 0], 6, C(dark));
    ell(c, -2, -22, 24, 14, C(mid));
    c.fillStyle = C(light); c.beginPath(); c.ellipse(-4, -28, 16, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = C(dark);
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-14 + i * 5, -33); c.lineTo(-11 + i * 5, -40 - (i % 2) * 3); c.lineTo(-8 + i * 5, -33); c.fill(); }
    limb(c, [-8, -12, -8 - leg, 0], 6, C(mid));
    limb(c, [16, -12, 16 + leg, 0], 6, C(mid));
    ell(c, 22, -21, 12, 10, C(mid));
    box(c, 30, -24, 7, 8, C('#d99a8a'));
    c.fillStyle = C('#3a2418'); c.fillRect(34, -22, 1.5, 1.5); c.fillRect(34, -19, 1.5, 1.5);
    c.fillStyle = C('#f3ead8'); c.beginPath(); c.moveTo(28, -15); c.lineTo(36, -26); c.lineTo(31, -14); c.fill();
    c.fillStyle = z.state === 'windup' ? '#ff1f1f' : '#120c0a'; c.fillRect(22, -26, 3, 3);
    c.fillStyle = C(dark); c.beginPath(); c.moveTo(16, -28); c.lineTo(13, -37); c.lineTo(20, -30); c.fill();
    c.strokeStyle = C(dark); c.lineWidth = 2; c.beginPath(); c.moveTo(-26, -26); c.quadraticCurveTo(-32, -30, -29, -22); c.stroke();
    c.restore();

    if (z.state === 'stunned' && !z.dead) drawStars(c, z.x + z.w / 2, z.y - 2, frames);
    if (z.state === 'windup' && !z.dead) {
        c.fillStyle = '#ff3b30'; c.font = "900 22px 'Zen Kaku Gothic New', sans-serif"; c.textAlign = 'center';
        c.lineWidth = 4; c.strokeStyle = '#000'; c.strokeText('!', z.x + z.w / 2, z.y - 6);
        c.fillText('!', z.x + z.w / 2, z.y - 6);
    }
}

// ---------- Magatsuhi's Vessel (samurai armor) ----------
function drawWarlord(c, z, frames) {
    const s = z.w / 40;
    const flash = z.hitTimer > 0;
    const burn = z.burning ? 0.4 : 0;
    const C = col => flash ? '#ffffff' : (burn ? mix(col, '#3a1a08', burn) : col);
    const moving = z.isMoving && !z.dead;
    const sw = moving ? Math.sin(z.walkPhase) : 0;

    c.save();
    const lift = z.spawnTimer > 0 ? (z.spawnTimer / z.spawnMax) * z.h : 0;
    c.translate(z.x + z.w / 2, z.y + z.h + lift);
    if (z.dead) { c.translate(0, -z.h * 0.4); c.rotate(z.rot || 0); c.translate(0, z.h * 0.4); }
    if (!z.facingRight) c.scale(-1, 1);
    c.scale(s, s);

    const lacquer = '#1d1c24', plate = '#2b2a35', cord = '#b71c1c', gold = '#d4a017';

    const wave = Math.sin(frames * 0.12) * 2;
    c.fillStyle = C('#5c0d12');
    c.beginPath(); c.moveTo(-8, -31); c.lineTo(-17 + wave, -3); c.lineTo(-12 + wave, -6); c.lineTo(-9, -1); c.lineTo(-4, -28); c.fill();

    limb(c, [-3, -13, -3 - sw * 5, 0], 5.5, C(lacquer));
    limb(c, [3, -13, 3 + sw * 5, 0], 5.5, C(plate));

    box(c, -11, -16, 22, 8, C(lacquer));
    c.strokeStyle = C(cord); c.lineWidth = 1;
    for (let i = -8; i <= 8; i += 5) { c.beginPath(); c.moveTo(i, -16); c.lineTo(i, -8); c.stroke(); }

    let swordHand = [12, -22], swordTip = [32, -6];
    let backHand = [7, -22];
    if (z.state === 'swordWind') { swordHand = [-2, -42]; swordTip = [-20, -58]; backHand = [0, -40]; }
    else if (z.state === 'slash') { swordHand = [15, -27]; swordTip = [44, -22]; backHand = [10, -26]; }
    else if (z.castTimer > 0) { swordHand = [10, -44]; swordTip = [14, -70]; backHand = [-8, -42]; }

    limb(c, [-6, -28, backHand[0], backHand[1]], 5, C(lacquer));

    box(c, -10, -32, 20, 17, C(lacquer));
    c.strokeStyle = C(cord); c.lineWidth = 1.2;
    for (let y = -28; y < -16; y += 4) { c.beginPath(); c.moveTo(-10, y); c.lineTo(10, y); c.stroke(); }
    c.fillStyle = C('#3c3b48'); c.fillRect(-8, -31, 16, 2);
    if (z.phase2 && !flash) {
        c.strokeStyle = '#ff3d3d'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(-6, -30); c.lineTo(-2, -24); c.lineTo(-5, -18); c.moveTo(4, -29); c.lineTo(2, -21); c.stroke();
    }

    box(c, -14, -33, 7, 11, C(plate));
    box(c, 7, -33, 7, 11, C(plate));
    c.strokeStyle = C(cord); c.lineWidth = 1;
    for (let y = -30; y < -22; y += 3) { c.beginPath(); c.moveTo(-14, y); c.lineTo(-7, y); c.moveTo(7, y); c.lineTo(14, y); c.stroke(); }

    c.fillStyle = C(lacquer);
    c.beginPath(); c.moveTo(-9, -36); c.lineTo(-13, -31); c.lineTo(5, -31); c.lineTo(3, -36); c.fill();
    box(c, -7, -46, 14, 12, C('#a01818'));
    box(c, -8, -50, 16, 5, C(lacquer));
    c.fillStyle = C('#f3ead8'); c.fillRect(2, -37, 1.5, 2.5); c.fillRect(5, -37, 1.5, 2.5);
    c.fillStyle = flash ? '#fff' : '#ff3b3b';
    c.fillRect(1, -43, 3, 2); c.fillRect(5, -43, 2.5, 2);
    c.strokeStyle = C(gold); c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -50); c.quadraticCurveTo(-9, -54, -9, -61); c.moveTo(0, -50); c.quadraticCurveTo(9, -54, 9, -61); c.stroke();

    limb(c, [swordHand[0], swordHand[1], swordTip[0], swordTip[1]], 2.2, C('#d8dde6'));
    const ang = Math.atan2(swordTip[1] - swordHand[1], swordTip[0] - swordHand[0]);
    c.fillStyle = C(gold); c.fillRect(swordHand[0] + Math.cos(ang) * 3 - 2, swordHand[1] + Math.sin(ang) * 3 - 2, 4, 4);
    limb(c, [6, -28, swordHand[0], swordHand[1]], 5, C(plate));
    c.restore();
}
