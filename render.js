/* =========================================
   LAST DOJO V3 - RENDERER (render.js)
   Pre-renders the static world once, then each frame draws:
   sky -> ground -> y-sorted actors/props -> effects ->
   lighting -> screen overlays -> HUD.
========================================= */

import {
    W, H, WORLD_W, HORIZON_Y, FEET_MIN, FOREST_END, SANCT_START,
    DOJO, DOJO_DOOR, SHRINE, SEAL, POT, MEAL, STONE_LANTERNS, SURVIVAL_DAYS, BOSS_NAMES, EPILOGUE
} from './config.js';
import { drawEntity } from './entities.js';
import { sprMeat, sprBandage, sprEssence } from './assets.js';

export const FONT_DISPLAY = "'Shippori Mincho B1', 'Hiragino Mincho ProN', Georgia, serif";
export const FONT_UI = "'Zen Kaku Gothic New', 'Trebuchet MS', 'Segoe UI', sans-serif";

const INK = '#17110f';
const WASHI = '#efe6d2';
const VERMILION = '#c0392b';
const KEGARE = '#8e44ad';
const MOONLIGHT = '#bff4ff';

// deterministic RNG so the world looks the same every load
function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpRGB(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function rgb(a, alpha = 1) { return `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${alpha})`; }
function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
}
function wrapText(c, text, maxW) {
    const words = text.split(' ');
    const lines = []; let line = '';
    for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (c.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
    }
    if (line) lines.push(line);
    return lines;
}

export class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.c = canvas.getContext('2d');
        this.g = game;
        this.light = document.createElement('canvas');
        // the light map is soft, so half resolution looks the same and costs a quarter as much
        this.light.width = W / 2; this.light.height = H / 2;
        this.lc = this.light.getContext('2d');
        this.ambient = [];
        this.buildTreeSprites();
        this.buildDojoSprite();
        this.buildMountains();
        this.buildStars();
    }

    // =========================================
    // ONE-TIME BUILDS
    // =========================================
    buildTreeSprites() {
        const R = rng(7);
        const make = (kind) => {
            const cv = document.createElement('canvas'); cv.width = 150; cv.height = 190;
            const x = cv.getContext('2d');
            const bx = 75, by = 185;
            if (kind === 'cedar') {
                x.fillStyle = '#3a2a20'; x.fillRect(bx - 5, by - 40, 10, 40);
                const tones = ['#163223', '#1f4430', '#2d5b3d'];
                for (let i = 0; i < 5; i++) {
                    const ty = by - 30 - i * 25, hw = 44 - i * 7;
                    x.fillStyle = '#0c1a12';
                    x.beginPath(); x.moveTo(bx - hw - 3, ty + 3); x.lineTo(bx, ty - 46); x.lineTo(bx + hw + 3, ty + 3); x.fill();
                    x.fillStyle = tones[0];
                    x.beginPath(); x.moveTo(bx - hw, ty); x.lineTo(bx, ty - 42); x.lineTo(bx + hw, ty); x.fill();
                    x.fillStyle = tones[1];
                    x.beginPath(); x.moveTo(bx - hw * 0.7, ty - 4); x.lineTo(bx - 2, ty - 40); x.lineTo(bx + hw * 0.1, ty - 4); x.fill();
                    x.fillStyle = tones[2];
                    x.beginPath(); x.moveTo(bx - hw * 0.45, ty - 12); x.lineTo(bx - 3, ty - 38); x.lineTo(bx - hw * 0.1, ty - 12); x.fill();
                }
                return cv;
            }
            const P = {
                oak:    { trunk: '#4a3226', out: '#0e1b0d', tones: ['#1f3d22', '#2c5530', '#3f7239'] },
                sakura: { trunk: '#3d2a2c', out: '#7a3a52', tones: ['#e384a4', '#f2adc3', '#fcd9e4'] },
                maple:  { trunk: '#3d2a22', out: '#4a1410', tones: ['#9c2a1e', '#c8432b', '#e8743a'] }
            }[kind];
            // trunk with roots and two branches
            x.fillStyle = '#120c0a';
            x.beginPath(); x.moveTo(bx - 11, by + 1); x.lineTo(bx - 7, by - 66); x.lineTo(bx + 7, by - 66); x.lineTo(bx + 11, by + 1); x.fill();
            x.fillStyle = P.trunk;
            x.beginPath(); x.moveTo(bx - 9, by); x.lineTo(bx - 5, by - 66); x.lineTo(bx + 5, by - 66); x.lineTo(bx + 9, by); x.fill();
            x.strokeStyle = P.trunk; x.lineWidth = 4; x.lineCap = 'round';
            x.beginPath(); x.moveTo(bx, by - 50); x.lineTo(bx - 22, by - 78); x.moveTo(bx, by - 56); x.lineTo(bx + 20, by - 84); x.stroke();
            x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(bx + 1, by - 64, 4, 64);
            // canopy clusters
            const cl = [];
            for (let i = 0; i < 17; i++) {
                const a = R() * Math.PI * 2, d = Math.sqrt(R());
                cl.push({ x: bx + Math.cos(a) * 44 * d, y: by - 100 + Math.sin(a) * 30 * d, r: 15 + R() * 11 });
            }
            for (const k of cl) { x.fillStyle = P.out; x.beginPath(); x.arc(k.x, k.y, k.r + 3, 0, Math.PI * 2); x.fill(); }
            for (const k of cl) { x.fillStyle = P.tones[0]; x.beginPath(); x.arc(k.x, k.y, k.r, 0, Math.PI * 2); x.fill(); }
            for (const k of cl) { x.fillStyle = P.tones[1]; x.beginPath(); x.arc(k.x - 3, k.y - 4, k.r * 0.75, 0, Math.PI * 2); x.fill(); }
            for (const k of cl) {
                if (k.y > by - 105 || k.x > bx + 15) continue;
                x.fillStyle = P.tones[2]; x.beginPath(); x.arc(k.x - 6, k.y - 7, k.r * 0.4, 0, Math.PI * 2); x.fill();
            }
            if (kind === 'sakura') {
                x.fillStyle = '#fff3f7';
                for (let i = 0; i < 40; i++) x.fillRect(bx - 50 + R() * 100, by - 130 + R() * 60, 2, 2);
            }
            return cv;
        };
        this.treeSprites = {
            oak: [make('oak'), make('oak'), make('oak')],
            cedar: [make('cedar'), make('cedar')],
            sakura: [make('sakura'), make('sakura')],
            maple: [make('maple'), make('maple')]
        };
    }

    buildDojoSprite() {
        const cv = document.createElement('canvas');
        cv.width = 240; cv.height = 220;
        const c = cv.getContext('2d');
        // local coords: footprint left at 40, front base line at 200
        const L = 40, R0 = L + DOJO.w, B = 200, cxm = (L + R0) / 2;
        // foundation
        c.fillStyle = INK; c.fillRect(L - 8, B - 20, DOJO.w + 16, 22);
        c.fillStyle = '#7f7a72'; c.fillRect(L - 6, B - 18, DOJO.w + 12, 18);
        c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
        for (let x = L; x < R0; x += 22) { c.beginPath(); c.moveTo(x, B - 18); c.lineTo(x, B); c.stroke(); }
        c.beginPath(); c.moveTo(L - 6, B - 9); c.lineTo(R0 + 6, B - 9); c.stroke();
        // walls
        c.fillStyle = INK; c.fillRect(L - 2, B - 104, DOJO.w + 4, 88);
        c.fillStyle = '#e9dfc9'; c.fillRect(L, B - 102, DOJO.w, 84);
        c.fillStyle = '#3b2a20';
        for (const x of [L, L + 38, R0 - 42, R0 - 4]) c.fillRect(x, B - 102, 5, 84);
        c.fillRect(L, B - 102, DOJO.w, 5); c.fillRect(L, B - 62, DOJO.w, 4);
        // side lattice windows
        for (const wx of [L + 12, R0 - 32]) {
            c.fillStyle = '#d8c9a6'; c.fillRect(wx, B - 92, 20, 24);
            c.strokeStyle = '#3b2a20'; c.lineWidth = 1.2;
            for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(wx + i * 5, B - 92); c.lineTo(wx + i * 5, B - 68); c.stroke(); }
            for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(wx, B - 92 + i * 6); c.lineTo(wx + 20, B - 92 + i * 6); c.stroke(); }
            c.strokeRect(wx, B - 92, 20, 24);
        }
        // shoji door frame (door panel itself is drawn live so it can glow)
        c.fillStyle = '#3b2a20'; c.fillRect(cxm - 30, B - 82, 60, 64);
        // lower roof skirt
        c.fillStyle = INK;
        c.beginPath(); c.moveTo(L - 28, B - 98); c.quadraticCurveTo(cxm, B - 112, R0 + 28, B - 98); c.lineTo(R0 + 6, B - 124); c.lineTo(L - 6, B - 124); c.fill();
        c.fillStyle = '#2b3140';
        c.beginPath(); c.moveTo(L - 24, B - 100); c.quadraticCurveTo(cxm, B - 112, R0 + 24, B - 100); c.lineTo(R0 + 4, B - 121); c.lineTo(L - 4, B - 121); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.07)';
        for (let x = L - 16; x < R0 + 16; x += 7) { c.beginPath(); c.moveTo(x, B - 101); c.lineTo(x + 4, B - 120); c.stroke(); }
        c.strokeStyle = '#a83228'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(L - 26, B - 99); c.quadraticCurveTo(cxm, B - 110, R0 + 26, B - 99); c.stroke();
        // upper storey
        c.fillStyle = INK; c.fillRect(L + 26, B - 152, DOJO.w - 52, 34);
        c.fillStyle = '#e9dfc9'; c.fillRect(L + 28, B - 150, DOJO.w - 56, 30);
        c.fillStyle = '#3b2a20';
        for (let x = L + 28; x <= R0 - 32; x += 26) c.fillRect(x, B - 150, 4, 30);
        // main roof
        c.fillStyle = INK;
        c.beginPath();
        c.moveTo(L - 36, B - 140); c.quadraticCurveTo(L - 10, B - 148, L + 6, B - 182);
        c.lineTo(R0 - 6, B - 182); c.quadraticCurveTo(R0 + 10, B - 148, R0 + 36, B - 140);
        c.quadraticCurveTo(cxm, B - 158, L - 36, B - 140); c.fill();
        c.fillStyle = '#262b36';
        c.beginPath();
        c.moveTo(L - 31, B - 142); c.quadraticCurveTo(L - 8, B - 150, L + 8, B - 179);
        c.lineTo(R0 - 8, B - 179); c.quadraticCurveTo(R0 + 8, B - 150, R0 + 31, B - 142);
        c.quadraticCurveTo(cxm, B - 158, L - 31, B - 142); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1;
        for (let x = L - 20; x < R0 + 20; x += 7) { c.beginPath(); c.moveTo(x, B - 146); c.lineTo(x + (x < cxm ? 8 : -8), B - 176); c.stroke(); }
        // gable with vermilion and gold crest
        c.fillStyle = INK; c.beginPath(); c.moveTo(cxm - 34, B - 160); c.lineTo(cxm, B - 186); c.lineTo(cxm + 34, B - 160); c.fill();
        c.fillStyle = '#b03a2e'; c.beginPath(); c.moveTo(cxm - 29, B - 162); c.lineTo(cxm, B - 183); c.lineTo(cxm + 29, B - 162); c.fill();
        c.fillStyle = '#d4a017'; c.beginPath(); c.arc(cxm, B - 169, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = INK; c.beginPath(); c.arc(cxm, B - 169, 2, 0, Math.PI * 2); c.fill();
        // ridge with upturned ends
        c.fillStyle = '#1b1f28'; c.fillRect(L + 4, B - 186, DOJO.w - 8, 7);
        c.fillStyle = INK;
        c.beginPath(); c.moveTo(L + 2, B - 186); c.lineTo(L - 6, B - 196); c.lineTo(L + 8, B - 182); c.fill();
        c.beginPath(); c.moveTo(R0 - 2, B - 186); c.lineTo(R0 + 6, B - 196); c.lineTo(R0 - 8, B - 182); c.fill();
        c.strokeStyle = '#a83228'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(L - 34, B - 141); c.quadraticCurveTo(cxm, B - 156, R0 + 34, B - 141); c.stroke();
        // steps
        c.fillStyle = INK; c.fillRect(cxm - 30, B - 2, 60, 12);
        c.fillStyle = '#8a6a4a'; c.fillRect(cxm - 28, B, 56, 4); c.fillStyle = '#6e5238'; c.fillRect(cxm - 28, B + 5, 56, 4);
        this.dojoSprite = cv;
        this.dojoOrigin = { x: DOJO.x - 40, y: DOJO.y + DOJO.h - 200 };
    }

    buildMountains() {
        const R = rng(42);
        const total = W + Math.ceil(WORLD_W * 0.2) + 80;
        const make = (step, base, amp, rough) => {
            const pts = []; let h = base;
            for (let x = 0; x <= total; x += step) {
                h += (R() - 0.5) * rough; h = Math.max(base - amp, Math.min(base + amp * 0.3, h));
                pts.push([x, h]);
            }
            return pts;
        };
        this.farRidge = make(26, 46, 34, 22);
        // one tall Fuji-like peak on the far ridge
        const peakX = 520;
        this.farRidge = this.farRidge.map(([x, y]) => {
            const d = Math.abs(x - peakX);
            return [x, d < 160 ? Math.min(y, 10 + d * 0.32) : y];
        });
        this.nearRidge = make(18, 76, 18, 14);
        this.pagodaX = 860;
    }

    buildStars() {
        const R = rng(3);
        this.stars = [];
        for (let i = 0; i < 70; i++) this.stars.push({ x: R() * W, y: R() * (HORIZON_Y - 10), r: R() < 0.15 ? 1.6 : 1, tw: R() * 6 });
    }

    // The ground layer is built after the game creates its trees, so roots and
    // shade can sit under them.
    buildBackground(trees) {
        const cv = document.createElement('canvas');
        cv.width = WORLD_W; cv.height = H;
        const c = cv.getContext('2d');
        const R = rng(11);

        // base ground colours by region, blended at the borders
        const grad = c.createLinearGradient(0, 0, WORLD_W, 0);
        const f = FOREST_END / WORLD_W, s = SANCT_START / WORLD_W;
        grad.addColorStop(0, '#26391f');
        grad.addColorStop(f - 0.02, '#2b4123');
        grad.addColorStop(f + 0.04, '#4b6a38');
        grad.addColorStop(s - 0.03, '#4f6d3a');
        grad.addColorStop(s + 0.02, '#5c8c44');
        grad.addColorStop(1, '#5f8f46');
        c.fillStyle = grad; c.fillRect(0, HORIZON_Y, WORLD_W, H - HORIZON_Y);

        // grain
        for (let i = 0; i < 26000; i++) {
            const x = R() * WORLD_W, y = HORIZON_Y + R() * (H - HORIZON_Y);
            c.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.045)';
            c.fillRect(x | 0, y | 0, 3, 3);
        }
        // grass tufts
        c.lineWidth = 1.5;
        for (let i = 0; i < 1400; i++) {
            const x = R() * WORLD_W, y = FEET_MIN + R() * (H - FEET_MIN);
            c.strokeStyle = x < FOREST_END ? 'rgba(10,25,8,0.5)' : (x > SANCT_START ? 'rgba(30,70,20,0.55)' : 'rgba(25,50,15,0.5)');
            c.beginPath(); c.moveTo(x - 3, y - 4); c.lineTo(x, y); c.lineTo(x + 3, y - 5); c.stroke();
        }
        // forest litter
        for (let i = 0; i < 700; i++) {
            const x = R() * (FOREST_END + 40), y = FEET_MIN + R() * (H - FEET_MIN);
            c.fillStyle = ['#5a3c22', '#7a4a1f', '#3d2a17', '#6b5a24'][(R() * 4) | 0];
            c.fillRect(x, y, 3, 2);
        }

        // dirt path from the forest to the courtyard
        c.fillStyle = '#6f5a40';
        for (let x = 640; x < 1060; x += 4) {
            const y = 352 + Math.sin(x * 0.012) * 18;
            c.beginPath(); c.ellipse(x, y, 10, 22 + R() * 4, 0, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = 'rgba(0,0,0,0.12)';
        for (let i = 0; i < 300; i++) c.fillRect(640 + R() * 420, 330 + R() * 44, 2, 2);

        // raked gravel courtyard (karesansui) around the Dojo
        const gx = DOJO.x + DOJO.w / 2, gy = 360;
        c.fillStyle = '#8d8577'; c.beginPath(); c.ellipse(gx, gy, 318, 166, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#cdc0a0'; c.beginPath(); c.ellipse(gx, gy, 310, 160, 0, 0, Math.PI * 2); c.fill();
        c.save(); c.beginPath(); c.ellipse(gx, gy, 308, 158, 0, 0, Math.PI * 2); c.clip();
        c.strokeStyle = 'rgba(90,75,50,0.16)'; c.lineWidth = 1.5;
        for (let y = gy - 160; y < gy + 160; y += 7) {
            c.beginPath();
            for (let x = gx - 320; x <= gx + 320; x += 10) c.lineTo(x, y + Math.sin(x * 0.02) * 2);
            c.stroke();
        }
        // ripples around two stone islands
        for (const st of [{ x: gx - 190, y: gy + 70 }, { x: gx + 200, y: gy + 90 }]) {
            c.fillStyle = '#cdc0a0';
            c.beginPath(); c.ellipse(st.x, st.y, 54, 26, 0, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(90,75,50,0.2)';
            for (let r = 18; r < 54; r += 7) { c.beginPath(); c.ellipse(st.x, st.y, r, r * 0.48, 0, 0, Math.PI * 2); c.stroke(); }
            c.fillStyle = INK; c.beginPath(); c.ellipse(st.x, st.y - 2, 17, 10, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#6f6a62'; c.beginPath(); c.ellipse(st.x, st.y - 3, 15, 8.5, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#4f7a35'; c.beginPath(); c.ellipse(st.x - 4, st.y - 7, 7, 3, 0, 0, Math.PI * 2); c.fill();
        }
        c.restore();

        // stepping stones to the sanctuary and the shrine
        for (let x = gx + 300; x < SHRINE.x - 20; x += 36) {
            const y = 352 + Math.sin(x * 0.015) * 16;
            c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x + 1, y + 2, 15, 8, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#9a958b'; c.beginPath(); c.ellipse(x, y, 14, 7.5, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.ellipse(x - 3, y - 2, 7, 3, 0, 0, Math.PI * 2); c.fill();
        }

        // sanctuary: moss, flowers, a white-pebble boundary line
        for (let i = 0; i < 500; i++) {
            const x = SANCT_START + 20 + R() * (WORLD_W - SANCT_START - 20), y = FEET_MIN + R() * (H - FEET_MIN);
            c.fillStyle = ['#ffffff', '#f8bbd0', '#9fc5ff', '#fff59d'][(R() * 4) | 0];
            c.fillRect(x, y, 2, 2); c.fillRect(x + 2, y + 1, 1, 1);
        }
        for (let y = FEET_MIN - 8; y < H; y += 9) {
            c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(SANCT_START + 1, y + 1, 3, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#f2efe6'; c.beginPath(); c.arc(SANCT_START, y, 3, 0, Math.PI * 2); c.fill();
        }

        // koi pond in the sanctuary corner
        const px = 2470, py = 540;
        c.fillStyle = '#6f6a62'; c.beginPath(); c.ellipse(px, py, 120, 46, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#285f78'; c.beginPath(); c.ellipse(px, py, 110, 40, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3a7e98'; c.beginPath(); c.ellipse(px - 20, py - 10, 70, 18, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#4f8f3a';
        for (const l of [[-60, 5], [30, -12], [70, 10]]) { c.beginPath(); c.arc(px + l[0], py + l[1], 8, 0.3, Math.PI * 2); c.fill(); }

        // shade under trees
        for (const t of trees) {
            c.fillStyle = 'rgba(0,0,0,0.22)';
            c.beginPath(); c.ellipse(t.x, t.y, 46 * t.s, 15 * t.s, 0, 0, Math.PI * 2); c.fill();
        }

        // ---- top boundary: forest canopy | estate wall | sanctuary hedge ----
        // forest canopy band
        for (let x = -20; x < FOREST_END + 60; x += 18) {
            const y = HORIZON_Y + 8 + R() * 14, r = 22 + R() * 14;
            c.fillStyle = '#0d1a0c'; c.beginPath(); c.arc(x, y, r + 3, 0, Math.PI * 2); c.fill();
        }
        for (let x = -20; x < FOREST_END + 60; x += 18) {
            const y = HORIZON_Y + 8 + R() * 14, r = 20 + R() * 12;
            c.fillStyle = R() < 0.5 ? '#1b3219' : '#244222'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
            c.fillStyle = 'rgba(120,170,90,0.15)'; c.beginPath(); c.arc(x - 5, y - 6, r * 0.4, 0, Math.PI * 2); c.fill();
        }
        // estate wall (tsuiji-bei)
        const wx0 = FOREST_END + 20, wx1 = SANCT_START - 10;
        c.fillStyle = INK; c.fillRect(wx0, HORIZON_Y + 4, wx1 - wx0, FEET_MIN - HORIZON_Y - 6);
        c.fillStyle = '#e6dcc8'; c.fillRect(wx0 + 2, HORIZON_Y + 14, wx1 - wx0 - 4, FEET_MIN - HORIZON_Y - 22);
        c.fillStyle = 'rgba(0,0,0,0.08)';
        for (let i = 0; i < 400; i++) c.fillRect(wx0 + R() * (wx1 - wx0), HORIZON_Y + 16 + R() * 26, 2, 2);
        c.fillStyle = '#d2c6ad';
        for (let x = wx0 + 70; x < wx1; x += 140) c.fillRect(x, HORIZON_Y + 14, 6, FEET_MIN - HORIZON_Y - 22);
        c.fillStyle = '#7d7468'; c.fillRect(wx0 + 2, FEET_MIN - 12, wx1 - wx0 - 4, 8);
        c.fillStyle = '#2e3440'; c.fillRect(wx0 - 4, HORIZON_Y + 2, wx1 - wx0 + 8, 12);
        c.fillStyle = '#3e4656';
        for (let x = wx0; x < wx1; x += 9) { c.beginPath(); c.arc(x + 4, HORIZON_Y + 14, 4.5, 0, Math.PI); c.fill(); }
        // sanctuary hedge with blossoms
        for (let x = SANCT_START - 30; x < WORLD_W + 30; x += 16) {
            const y = HORIZON_Y + 16 + R() * 10, r = 18 + R() * 8;
            c.fillStyle = '#163014'; c.beginPath(); c.arc(x, y, r + 3, 0, Math.PI * 2); c.fill();
        }
        for (let x = SANCT_START - 30; x < WORLD_W + 30; x += 16) {
            const y = HORIZON_Y + 16 + R() * 10, r = 16 + R() * 8;
            c.fillStyle = R() < 0.5 ? '#2f5a2c' : '#3a6a33'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
            for (let k = 0; k < 4; k++) { c.fillStyle = R() < 0.6 ? '#f6b8cc' : '#ffffff'; c.fillRect(x - 12 + R() * 24, y - 10 + R() * 16, 3, 3); }
        }

        // bottom edge darkening
        const bg = c.createLinearGradient(0, H - 26, 0, H);
        bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.35)');
        c.fillStyle = bg; c.fillRect(0, H - 26, WORLD_W, 26);

        this.bg = cv;
    }

    // =========================================
    // TIME OF DAY
    // =========================================
    phaseInfo() {
        const g = this.g;
        let dl = 0, dusk = 0;
        if (g.state === 'START' || g.state === 'INTRO' || g.state === 'EPILOGUE') return { dl: 0, dusk: 0, blood: 0, p: 0.4 };
        const p = 1 - g.timeTimer / Math.max(1, g.phaseLen);
        if (g.state === 'SUNRISE' || g.state === 'VICTORY') {
            const t = g.state === 'VICTORY' ? 1 : 1 - g.sunriseTimer / 300;
            return { dl: 0.2 + t * 0.8, dusk: 1 - t, blood: 0, p };
        }
        if (g.isDay) {
            dl = p < 0.1 ? 0.35 + 0.65 * (p / 0.1) : (p > 0.85 ? 1 - 0.75 * ((p - 0.85) / 0.15) : 1);
            dusk = p < 0.1 ? 1 - p / 0.1 : (p > 0.78 ? (p - 0.78) / 0.22 : 0);
        } else {
            dl = p < 0.06 ? 0.25 * (1 - p / 0.06) : (p > 0.95 ? 0.25 * ((p - 0.95) / 0.05) : 0);
            dusk = p < 0.06 ? 1 - p / 0.06 : (p > 0.95 ? (p - 0.95) / 0.05 : 0);
        }
        const blood = (g.isSiege && !g.peaceful && !g.isDay) || g.forceBlood ? 1 : 0;
        return { dl, dusk, blood, p };
    }

    // =========================================
    // AMBIENT PARTICLES
    // =========================================
    updateAmbient() {
        const g = this.g;
        const { dl, blood } = this.phaseInfo();
        const cam = g.camera.x;
        const viewL = cam - 40, viewR = cam + W + 40;
        if (this.ambient.length < 90) {
            if (dl > 0.5 && viewR > SANCT_START - 200 && Math.random() < 0.25) {
                this.ambient.push({ k: 'petal', x: viewL + Math.random() * (W + 80), y: HORIZON_Y + Math.random() * 60, vx: -0.6 - Math.random() * 0.6, vy: 0.5 + Math.random() * 0.4, life: 500, rot: Math.random() * 6 });
            }
            if (dl > 0.5 && viewL < FOREST_END && Math.random() < 0.12) {
                this.ambient.push({ k: 'leaf', x: viewL + Math.random() * Math.min(W, FOREST_END - viewL), y: HORIZON_Y + Math.random() * 40, vx: -0.3 - Math.random() * 0.4, vy: 0.6 + Math.random() * 0.3, life: 500, rot: Math.random() * 6 });
            }
            if (dl < 0.3 && !blood && Math.random() < 0.09) {
                this.ambient.push({ k: 'fly', x: viewL + Math.random() * (W + 80), y: FEET_MIN + Math.random() * (H - FEET_MIN - 20), vx: 0, vy: 0, life: 360, ph: Math.random() * 6 });
            }
            if (blood && Math.random() < 0.35) {
                this.ambient.push({ k: 'ember', x: viewL + Math.random() * (W + 80), y: H + 5, vx: (Math.random() - 0.5) * 0.6, vy: -1 - Math.random() * 1.5, life: 300 });
            }
            if (g.sealStone.broken && viewL < SEAL.x && viewR > SEAL.x && Math.random() < 0.06) {
                this.ambient.push({ k: 'wisp', x: SEAL.x + (Math.random() - 0.5) * 20, y: SEAL.y - 14, vx: (Math.random() - 0.5) * 0.3, vy: -0.4, life: 90 });
            }
            const dojoDmg = g.dojo.hp / g.dojo.maxHp;
            if (g.state === 'PLAYING' && dojoDmg < 0.5 && Math.random() < (dojoDmg < 0.25 ? 0.5 : 0.2)) {
                this.ambient.push({ k: 'smoke', x: DOJO.x + 30 + Math.random() * (DOJO.w - 60), y: DOJO.y - 120, vx: 0.2, vy: -0.7, life: 120 });
            }
        }
        for (const a of this.ambient) {
            a.life--;
            if (a.k === 'fly') {
                a.ph += 0.05; a.x += Math.cos(a.ph) * 0.6; a.y += Math.sin(a.ph * 1.3) * 0.4;
            } else {
                a.x += a.vx + (a.k === 'petal' || a.k === 'leaf' ? Math.sin(a.life * 0.05) * 0.5 : 0);
                a.y += a.vy;
                if (a.rot !== undefined) a.rot += 0.05;
            }
        }
        this.ambient = this.ambient.filter(a => a.life > 0 && a.y < H + 10 && a.y > -10);
    }

    // =========================================
    // MAIN DRAW
    // =========================================
    draw() {
        const g = this.g, c = this.c;
        const info = this.phaseInfo();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, W, H);

        const camX = Math.round(g.camera.x);
        let sx = 0, sy = 0;
        if (g.shake > 0 && !g.paused) { sx = (Math.random() - 0.5) * g.shake; sy = (Math.random() - 0.5) * g.shake; }

        this.drawSky(info, camX);

        const z = g.zoom || 1;
        c.save();
        // cinematic zoom around the screen centre
        if (z !== 1) { c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2, -H / 2); }
        c.translate(-camX + sx, sy);
        if (this.bg) c.drawImage(this.bg, camX, 0, W, H, camX, 0, W, H);

        if (info.blood) {
            c.fillStyle = 'rgba(120,10,10,0.12)'; c.fillRect(camX, HORIZON_Y, W, H);
        }
        this.drawGroundLayer(camX);
        this.drawWorld(camX);
        this.drawEffects();
        c.restore();

        // dusk and dawn warmth
        if (info.dusk > 0) { c.fillStyle = `rgba(255,120,50,${info.dusk * 0.13})`; c.fillRect(0, 0, W, H); }
        this.drawLighting(info, camX - sx, sy);
        this.drawScreenFx(info);

        const inRun = ['PLAYING', 'SUNRISE', 'CHOICE', 'DYING'].includes(g.state);
        const cinematic = g.letterboxTarget > 0 || g.letterbox > 0.5;
        if (inRun && !cinematic) {
            this.drawWorldUI(camX - sx, sy);
            this.drawHUD(info);
        }
        if (inRun) this.drawCinema();
        if (g.state === 'EPILOGUE') this.drawStory(EPILOGUE, g.epiIdx, g.epiTimer, 220);
        if (g.state === 'DYING') {
            const t = 1 - g.deathTimer / 90;
            c.fillStyle = g.endReason === 'turned' ? `rgba(40,0,50,${t * 0.75})` : `rgba(30,0,0,${t * 0.75})`;
            c.fillRect(0, 0, W, H);
        }
    }

    // ---------- sky band ----------
    drawSky(info, camX) {
        const c = this.c, g = this.g;
        const dayTop = [93, 156, 214], dayBot = [207, 230, 239];
        const nightTop = [7, 11, 31], nightBot = [29, 39, 82];
        const duskTop = [59, 63, 120], duskBot = [240, 145, 90];
        let top = lerpRGB(nightTop, dayTop, info.dl), bot = lerpRGB(nightBot, dayBot, info.dl);
        if (info.dusk > 0) { top = lerpRGB(top, duskTop, info.dusk * 0.7); bot = lerpRGB(bot, duskBot, info.dusk * 0.8); }
        if (info.blood) { top = [26, 2, 4]; bot = [96, 14, 18]; }
        const gr = c.createLinearGradient(0, 0, 0, HORIZON_Y + 30);
        gr.addColorStop(0, rgb(top)); gr.addColorStop(1, rgb(bot));
        c.fillStyle = gr; c.fillRect(0, 0, W, HORIZON_Y + 40);

        // stars
        if (info.dl < 0.6) {
            for (const s of this.stars) {
                c.globalAlpha = (1 - info.dl / 0.6) * (0.5 + Math.sin(g.frames * 0.03 + s.tw) * 0.35);
                c.fillStyle = info.blood ? '#ffb3a8' : '#ffffff';
                c.fillRect(s.x, s.y, s.r, s.r);
            }
            c.globalAlpha = 1;
        }

        // sun / moon
        const p = info.p;
        const bx = 120 + p * (W - 240), by = 64 - Math.sin(p * Math.PI) * 38;
        if (g.isDay && !['START', 'INTRO', 'EPILOGUE'].includes(g.state) || g.state === 'SUNRISE') {
            const sunY = g.state === 'SUNRISE' ? 80 - (1 - g.sunriseTimer / 300) * 40 : by;
            const sunX = g.state === 'SUNRISE' ? W * 0.5 : bx;
            const halo = c.createRadialGradient(sunX, sunY, 4, sunX, sunY, 60);
            halo.addColorStop(0, 'rgba(255,240,200,0.9)'); halo.addColorStop(1, 'rgba(255,200,120,0)');
            c.fillStyle = halo; c.fillRect(sunX - 60, sunY - 60, 120, 120);
            c.fillStyle = '#fff4d6'; c.beginPath(); c.arc(sunX, sunY, 14, 0, Math.PI * 2); c.fill();
        } else {
            const mx = ['START', 'INTRO', 'EPILOGUE'].includes(g.state) ? W * 0.72 : bx;
            const my = ['START', 'INTRO', 'EPILOGUE'].includes(g.state) ? 46 : by;
            const r = info.blood ? 24 : 15;
            const col = info.blood ? '255,70,60' : '220,235,255';
            const halo = c.createRadialGradient(mx, my, r * 0.5, mx, my, r * 4);
            halo.addColorStop(0, `rgba(${col},0.45)`); halo.addColorStop(1, `rgba(${col},0)`);
            c.fillStyle = halo; c.fillRect(mx - r * 4, my - r * 4, r * 8, r * 8);
            c.fillStyle = info.blood ? '#e53935' : '#f1f5ff';
            c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill();
            c.fillStyle = info.blood ? 'rgba(120,0,0,0.35)' : 'rgba(170,185,210,0.4)';
            c.beginPath(); c.arc(mx - r * 0.3, my - r * 0.2, r * 0.25, 0, Math.PI * 2); c.arc(mx + r * 0.35, my + r * 0.3, r * 0.18, 0, Math.PI * 2); c.fill();
        }

        // far mountains with snow
        const farCol = info.blood ? [60, 14, 18] : lerpRGB([30, 38, 70], [150, 172, 196], info.dl);
        const off1 = camX * 0.08;
        c.fillStyle = rgb(farCol);
        c.beginPath(); c.moveTo(0, HORIZON_Y + 30);
        for (const [x, y] of this.farRidge) { const xx = x - off1; if (xx > -30 && xx < W + 30) c.lineTo(xx, y); }
        c.lineTo(W, HORIZON_Y + 30); c.fill();
        if (!info.blood) {
            c.fillStyle = `rgba(245,248,255,${0.35 + info.dl * 0.5})`;
            c.beginPath();
            const px = 520 - off1;
            c.moveTo(px - 26, 19); c.lineTo(px, 10); c.lineTo(px + 26, 19); c.lineTo(px + 14, 23); c.lineTo(px + 4, 18); c.lineTo(px - 8, 24); c.fill();
        }
        // near ridge and a pagoda silhouette
        const nearCol = info.blood ? [34, 6, 8] : lerpRGB([14, 20, 40], [94, 124, 104], info.dl);
        const off2 = camX * 0.18;
        c.fillStyle = rgb(nearCol);
        c.beginPath(); c.moveTo(0, HORIZON_Y + 30);
        for (const [x, y] of this.nearRidge) { const xx = x - off2; if (xx > -30 && xx < W + 30) c.lineTo(xx, y); }
        c.lineTo(W, HORIZON_Y + 30); c.fill();
        const pxp = this.pagodaX - off2;
        if (pxp > -40 && pxp < W + 40) {
            for (let i = 0; i < 4; i++) {
                const yy = 66 - i * 9, hw = 15 - i * 2.5;
                c.fillRect(pxp - hw, yy, hw * 2, 3);
                c.fillRect(pxp - hw * 0.55, yy + 3, hw * 1.1, 6);
            }
            c.fillRect(pxp - 1, 26, 2, 12);
        }
    }

    // ---------- flat things on the ground ----------
    drawGroundLayer(camX) {
        const g = this.g, c = this.c;
        const inView = (x, pad = 80) => x > camX - pad && x < camX + W + pad;
        for (const d of g.decals) if (inView(d.x)) d.draw(c);
        for (const p of g.pools) if (inView(p.x)) p.draw(c, g.frames);

        // sacred boundary shimmer at night
        const { dl } = this.phaseInfo();
        if (dl < 0.5 && inView(SANCT_START)) {
            const a = (1 - dl * 2) * (0.18 + Math.sin(g.frames * 0.05) * 0.06);
            const gr = c.createLinearGradient(SANCT_START - 30, 0, SANCT_START + 10, 0);
            gr.addColorStop(0, 'rgba(255,230,150,0)'); gr.addColorStop(1, `rgba(255,230,150,${a})`);
            c.fillStyle = gr; c.fillRect(SANCT_START - 30, FEET_MIN - 10, 40, H - FEET_MIN + 10);
        }

        // boss telegraphs on the ground
        for (const e of g.enemies) {
            if (e.dead || !inView(e.x)) continue;
            if (e.type === 'alpha' && e.state === 'slamWind') {
                const fx = e.x + e.w / 2, fy = e.y + e.h, t = 1 - e.stateTimer / 45;
                c.strokeStyle = `rgba(255,50,40,${0.5 + Math.sin(g.frames * 0.6) * 0.3})`; c.lineWidth = 3; c.setLineDash([8, 6]);
                c.beginPath(); c.ellipse(fx, fy, 150, 66, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
                c.fillStyle = 'rgba(255,50,40,0.18)';
                c.beginPath(); c.ellipse(fx, fy, 150 * t, 66 * t, 0, 0, Math.PI * 2); c.fill();
            }
            if (e.type === 'bloater' && e.fuse > 0) {
                const fx = e.x + e.w / 2, fy = e.y + e.h;
                c.strokeStyle = `rgba(230,220,90,${0.3 + (e.fuse / 45) * 0.5})`; c.lineWidth = 2; c.setLineDash([5, 5]);
                c.beginPath(); c.ellipse(fx, fy, 90, 40, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
            }
        }

        // shadows
        const shadowA = 0.28;
        const shadow = (x, y, w) => { c.beginPath(); c.ellipse(x, y, w, w * 0.28, 0, 0, Math.PI * 2); c.fill(); };
        c.fillStyle = `rgba(0,0,0,${shadowA})`;
        const p = g.player;
        if (g.showPlayer()) shadow(p.x + 20, p.y + 39, 15);
        for (const e of g.enemies) if (!e.dead && inView(e.x) && e.spawnTimer <= 0) shadow(e.x + e.w / 2, e.y + e.h - 1, e.w * 0.42);
        for (const l of g.loot) if (inView(l.x)) shadow(l.x, l.y + 2, 9);
        for (const k of g.caches) if (!k.dead && inView(k.x)) shadow(k.x + k.w / 2, k.y + k.h, 26);
        for (const e of g.enemies) {
            if (e.spawnTimer > 0 && !e.dead && inView(e.x)) {
                c.fillStyle = '#2a1d14'; shadow(e.x + e.w / 2, e.y + e.h, e.w * 0.5 * (1 - e.spawnTimer / e.spawnMax * 0.5));
                c.fillStyle = `rgba(0,0,0,${shadowA})`;
            }
        }
    }

    // ---------- y-sorted actors and props ----------
    drawWorld(camX) {
        const g = this.g, c = this.c;
        const list = [];
        const inView = (x, pad = 120) => x > camX - pad && x < camX + W + pad;
        const p = g.player;

        for (const t of g.trees) if (inView(t.x, 90)) list.push({ y: t.y, f: () => this.drawTree(t) });
        list.push({ y: DOJO.y + DOJO.h, f: () => this.drawDojo() });
        if (inView(SEAL.x)) list.push({ y: SEAL.y, f: () => this.drawSealStone() });
        if (inView(POT.x)) list.push({ y: POT.y, f: () => this.drawPot() });
        for (const l of STONE_LANTERNS) if (inView(l.x)) list.push({ y: l.y, f: () => this.drawStoneLantern(l.x, l.y) });
        if (inView(SHRINE.x, 200)) {
            list.push({ y: SHRINE.y, f: () => this.drawShrine() });
            list.push({ y: SHRINE.y + 54, f: () => this.drawTorii(SHRINE.x, SHRINE.y + 54) });
        }
        for (const k of g.caches) if (!k.dead && inView(k.x)) list.push({ y: k.y + k.h, f: () => this.drawCache(k) });
        for (const l of g.loot) if (inView(l.x)) list.push({ y: l.y, f: () => this.drawLoot(l) });
        for (const k of g.corpses) if (inView(k.x)) list.push({ y: k.groundY + k.h, f: () => { c.globalAlpha = Math.min(1, k.life / 60); drawEntity(c, k, g.frames); c.globalAlpha = 1; } });
        for (const e of g.enemies) if (!e.dead && inView(e.x)) {
            list.push({ y: e.y + e.h, f: () => {
                if (e.isBoss && !e.burning) {
                    const glow = c.createRadialGradient(e.x + e.w / 2, e.y + e.h / 2, 4, e.x + e.w / 2, e.y + e.h / 2, e.w);
                    const col = e.type === 'brood' ? '170,0,255' : '255,23,68';
                    glow.addColorStop(0, `rgba(${col},0.28)`); glow.addColorStop(1, `rgba(${col},0)`);
                    c.fillStyle = glow; c.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w * 2, e.h * 2);
                }
                drawEntity(c, e, g.frames);
            } });
        }
        if (g.showPlayer()) list.push({ y: p.y + p.h, f: () => drawEntity(c, p, g.frames), player: true });

        // a ground marker so the master is easy to find in a crowd (not in cutscenes)
        if (g.showPlayer() && !g.letterboxTarget) {
            c.strokeStyle = p.rushTimer > 0 ? 'rgba(255,80,60,0.85)' : 'rgba(239,230,210,0.7)';
            c.lineWidth = 2;
            c.beginPath(); c.ellipse(p.x + 20, p.y + 39, 19, 7, 0, 0, Math.PI * 2); c.stroke();
        }

        list.sort((a, b) => a.y - b.y);
        for (const it of list) it.f();

        // if anything is drawn over the player, show a faint silhouette on top
        if (g.showPlayer()) {
            const pr = { x: p.x + 6, y: p.y, w: 28, h: 40 };
            const covered = g.enemies.some(e => !e.dead && e.y + e.h > p.y + p.h && e.x < pr.x + pr.w && e.x + e.w > pr.x && e.y < pr.y + pr.h && e.y + e.h > pr.y);
            if (covered) { c.save(); c.globalAlpha = 0.4; drawEntity(c, p, g.frames); c.restore(); }
        }

        this.drawSliver();
        this.drawSeals();

        // projectiles
        for (const pr of g.projectiles) {
            if (!inView(pr.x)) continue;
            const col = pr.reflected ? '#7ff3ff' : '#c6e03a';
            c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(pr.x, pr.y + 26, 5, 2, 0, 0, Math.PI * 2); c.fill();
            c.globalAlpha = 0.35; c.fillStyle = col;
            c.beginPath(); c.arc(pr.x - pr.vx * 2, pr.y - pr.vy * 2, 4, 0, Math.PI * 2); c.fill();
            c.globalAlpha = 1;
            c.fillStyle = INK; c.beginPath(); c.arc(pr.x, pr.y, 7, 0, Math.PI * 2); c.fill();
            c.fillStyle = col; c.beginPath(); c.arc(pr.x, pr.y, 5.5, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#ffffff'; c.fillRect(pr.x - 2, pr.y - 3, 2, 2);
        }

        // ambient (petals, leaves, embers, smoke) drawn over the scene
        for (const a of this.ambient) {
            if (!inView(a.x, 20)) continue;
            if (a.k === 'petal') { c.save(); c.translate(a.x, a.y); c.rotate(a.rot); c.fillStyle = '#f8c6d6'; c.fillRect(-2.5, -1.5, 5, 3); c.restore(); }
            else if (a.k === 'leaf') { c.save(); c.translate(a.x, a.y); c.rotate(a.rot); c.fillStyle = '#6f8a3a'; c.fillRect(-3, -1.5, 6, 3); c.restore(); }
            else if (a.k === 'ember') { c.fillStyle = `rgba(255,${120 + (a.life % 60)},60,${Math.min(1, a.life / 100)})`; c.fillRect(a.x, a.y, 2, 2); }
            else if (a.k === 'smoke') { c.fillStyle = `rgba(40,36,36,${(a.life / 120) * 0.35})`; c.beginPath(); c.arc(a.x, a.y, 14 + (120 - a.life) * 0.2, 0, Math.PI * 2); c.fill(); }
            else if (a.k === 'wisp') { c.fillStyle = `rgba(110,40,150,${(a.life / 90) * 0.3})`; c.beginPath(); c.arc(a.x, a.y, 5 + (90 - a.life) * 0.08, 0, Math.PI * 2); c.fill(); }
            else if (a.k === 'fly') { c.fillStyle = `rgba(225,255,140,${0.5 + Math.sin(a.ph * 3) * 0.4})`; c.fillRect(a.x, a.y, 2, 2); }
        }
    }

    drawTree(t) {
        const c = this.c, g = this.g, p = g.player;
        const spr = this.treeSprites[t.kind][t.v % this.treeSprites[t.kind].length];
        const s = t.s;
        // fade the canopy when the player is behind it
        // fade any canopy that hides the player or an enemy standing behind it
        const L = t.x - 52 * s, R = t.x + 52 * s, T = t.y - 145 * s, B = t.y - 40 * s;
        const hides = e => e.x + e.w * 0.85 > L && e.x + e.w * 0.15 < R && e.y + e.h > T && e.y < B && e.y + e.h < t.y + 6;
        let alpha = 1;
        if ((g.showPlayer() && hides(p)) || g.enemies.some(e => !e.dead && hides(e))) alpha = 0.4;
        c.globalAlpha = alpha;
        c.drawImage(spr, t.x - 75 * s, t.y - 185 * s, 150 * s, 190 * s);
        c.globalAlpha = 1;
    }

    drawDojo() {
        const c = this.c, g = this.g;
        const o = this.dojoOrigin;
        const { dl } = this.phaseInfo();
        const B = DOJO.y + DOJO.h, cx = DOJO.x + DOJO.w / 2;
        // siege ward
        if (g.isSiege && !g.peaceful && g.state === 'PLAYING') {
            c.save(); c.globalAlpha = 0.14 + Math.sin(g.frames * 0.1) * 0.05;
            c.fillStyle = '#ffcc33'; c.beginPath(); c.ellipse(cx, B - 10, 140, 60, 0, 0, Math.PI * 2); c.fill(); c.restore();
        }
        c.drawImage(this.dojoSprite, o.x, o.y);
        // shoji door, warm at night
        const glow = 1 - dl;
        c.fillStyle = glow > 0.1 ? `rgb(${230 + 25 * glow},${215 + 10 * glow},${170 - 40 * glow})` : '#e6dcc4';
        c.fillRect(cx - 27, B - 80, 54, 60);
        c.strokeStyle = '#3b2a20'; c.lineWidth = 1.3;
        for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(cx - 27 + i * 9, B - 80); c.lineTo(cx - 27 + i * 9, B - 20); c.stroke(); }
        for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(cx - 27, B - 80 + i * 10); c.lineTo(cx + 27, B - 80 + i * 10); c.stroke(); }
        c.fillStyle = '#3b2a20'; c.fillRect(cx - 1.5, B - 80, 3, 60);
        // hanging paper lanterns
        for (const lx of [DOJO.x + 8, DOJO.x + DOJO.w - 8]) {
            const sway = Math.sin(g.frames * 0.04 + lx) * 1.5;
            c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(lx, B - 100); c.lineTo(lx + sway, B - 92); c.stroke();
            c.fillStyle = INK; c.beginPath(); c.ellipse(lx + sway, B - 82, 8, 11, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = glow > 0.3 ? '#ff7a4a' : '#d64530'; c.beginPath(); c.ellipse(lx + sway, B - 82, 6.5, 9.5, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = INK; c.fillRect(lx + sway - 5, B - 92, 10, 2); c.fillRect(lx + sway - 5, B - 73, 10, 2);
        }
        // damage
        const hpR = g.dojo.hp / g.dojo.maxHp;
        if (hpR < 0.6) {
            c.strokeStyle = INK; c.lineWidth = 2;
            c.beginPath(); c.moveTo(DOJO.x + 20, B - 96); c.lineTo(DOJO.x + 30, B - 80); c.lineTo(DOJO.x + 22, B - 66); c.stroke();
            if (hpR < 0.35) { c.beginPath(); c.moveTo(DOJO.x + DOJO.w - 24, B - 100); c.lineTo(DOJO.x + DOJO.w - 34, B - 84); c.lineTo(DOJO.x + DOJO.w - 26, B - 70); c.stroke(); }
        }
        if (hpR < 0.3 && g.state !== 'START') {
            for (let i = 0; i < 3; i++) {
                const fx = DOJO.x + 30 + i * 50, fh = 14 + Math.abs(Math.sin(g.frames * 0.3 + i * 2)) * 14;
                c.fillStyle = i === 1 ? 'rgba(255,214,90,0.9)' : 'rgba(255,110,30,0.85)';
                c.beginPath(); c.moveTo(fx - 8, B - 134); c.quadraticCurveTo(fx, B - 134 - fh, fx + 8, B - 134); c.fill();
            }
        }
    }

    drawStoneLantern(x, y) {
        const c = this.c;
        const { dl } = this.phaseInfo();
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x, y, 16, 5, 0, 0, Math.PI * 2); c.fill();
        const stone = '#8c877d';
        c.fillStyle = INK; c.fillRect(x - 13, y - 8, 26, 9); c.fillStyle = stone; c.fillRect(x - 11.5, y - 6.5, 23, 6);
        c.fillStyle = INK; c.fillRect(x - 5, y - 28, 10, 22); c.fillStyle = stone; c.fillRect(x - 3.5, y - 27, 7, 20);
        c.fillStyle = INK; c.fillRect(x - 11, y - 44, 22, 18);
        c.fillStyle = dl < 0.6 ? '#ffd27a' : '#5a554d'; c.fillRect(x - 6, y - 41, 12, 11);
        c.fillStyle = stone; c.fillRect(x - 9.5, y - 42.5, 3, 15); c.fillRect(x + 6.5, y - 42.5, 3, 15);
        c.fillStyle = INK; c.beginPath(); c.moveTo(x - 17, y - 43); c.lineTo(x, y - 56); c.lineTo(x + 17, y - 43); c.fill();
        c.fillStyle = stone; c.beginPath(); c.moveTo(x - 14, y - 44.5); c.lineTo(x, y - 54); c.lineTo(x + 14, y - 44.5); c.fill();
        c.fillStyle = INK; c.fillRect(x - 2.5, y - 61, 5, 6);
    }

    drawShrine() {
        const c = this.c, g = this.g;
        const x = SHRINE.x, y = SHRINE.y;
        const { dl } = this.phaseInfo();
        const open = !g.isDay || g.state === 'START';
        // stone pedestal
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x, y, 40, 12, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = INK; c.fillRect(x - 34, y - 14, 68, 16);
        c.fillStyle = '#9a958b'; c.fillRect(x - 32, y - 12, 64, 12);
        c.fillStyle = INK; c.fillRect(x - 24, y - 30, 48, 18);
        c.fillStyle = '#aaa59b'; c.fillRect(x - 22, y - 28, 44, 15);
        c.fillStyle = '#4f7a35'; c.fillRect(x - 20, y - 31, 40, 5);
        // stem and leaves
        c.strokeStyle = '#2f5a2c'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(x, y - 30); c.quadraticCurveTo(x - 6, y - 48, x, y - 62); c.stroke();
        c.fillStyle = '#3f7239';
        c.beginPath(); c.ellipse(x - 12, y - 40, 10, 4, -0.5, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(x + 11, y - 46, 10, 4, 0.5, 0, Math.PI * 2); c.fill();
        const fx = x, fy = y - 68;
        if (open) {
            // the Gekka Bijin in bloom
            const pulse = 1 + Math.sin(g.frames * 0.05) * 0.04 + (g.shrineGlow > 0 ? g.shrineGlow / 60 * 0.3 : 0);
            const halo = c.createRadialGradient(fx, fy, 2, fx, fy, 46 * pulse);
            halo.addColorStop(0, 'rgba(200,250,255,0.75)'); halo.addColorStop(1, 'rgba(160,230,255,0)');
            c.fillStyle = halo; c.fillRect(fx - 50, fy - 50, 100, 100);
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2 + g.frames * 0.004;
                const len = (i % 2 ? 15 : 19) * pulse;
                c.fillStyle = INK;
                c.beginPath(); c.ellipse(fx + Math.cos(a) * len * 0.55, fy + Math.sin(a) * len * 0.4, len * 0.55 + 1.2, 4.6, a, 0, Math.PI * 2); c.fill();
                c.fillStyle = i % 2 ? '#e9fbff' : '#ffffff';
                c.beginPath(); c.ellipse(fx + Math.cos(a) * len * 0.55, fy + Math.sin(a) * len * 0.4, len * 0.55, 3.4, a, 0, Math.PI * 2); c.fill();
            }
            c.fillStyle = '#fff6b0'; c.beginPath(); c.arc(fx, fy, 4.5, 0, Math.PI * 2); c.fill();
            if (g.frames % 8 === 0 && g.state !== 'CHOICE') {
                g.particles.push(new g.ParticleClass(fx + (Math.random() - 0.5) * 20, fy, MOONLIGHT, { speed: 0.6, angle: -Math.PI / 2, spread: 1, grav: -0.02, life: 70, size: 2.5 }));
            }
        } else {
            // closed bud by day
            c.fillStyle = INK; c.beginPath(); c.ellipse(fx, fy + 4, 7, 14, 0.15, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#d7e9c8'; c.beginPath(); c.ellipse(fx, fy + 4, 5.5, 12.5, 0.15, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#9cc28a'; c.fillRect(fx - 4, fy + 10, 8, 4);
        }
    }

    drawTorii(x, y) {
        const c = this.c;
        const red = '#c0392b';
        for (const px of [x - 62, x + 62]) {
            c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(px, y, 12, 4, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = INK; c.fillRect(px - 7, y - 128, 14, 128);
            c.fillStyle = red; c.fillRect(px - 5.5, y - 126, 11, 122);
            c.fillStyle = '#1d1d1d'; c.fillRect(px - 7, y - 10, 14, 10);
        }
        c.fillStyle = INK; c.fillRect(x - 78, y - 112, 156, 10);
        c.fillStyle = red; c.fillRect(x - 76, y - 110.5, 152, 7);
        c.fillStyle = INK;
        c.beginPath(); c.moveTo(x - 94, y - 128); c.quadraticCurveTo(x, y - 136, x + 94, y - 128); c.lineTo(x + 90, y - 140); c.quadraticCurveTo(x, y - 148, x - 90, y - 140); c.fill();
        c.fillStyle = '#1f1f24';
        c.beginPath(); c.moveTo(x - 90, y - 130); c.quadraticCurveTo(x, y - 138, x + 90, y - 130); c.lineTo(x + 88, y - 138); c.quadraticCurveTo(x, y - 146, x - 88, y - 138); c.fill();
        c.fillStyle = red; c.fillRect(x - 84, y - 130, 168, 3);
        c.fillStyle = INK; c.fillRect(x - 9, y - 128, 18, 18);
        c.fillStyle = '#d4a017'; c.fillRect(x - 6.5, y - 125.5, 13, 13);
        // shimenawa rope with paper streamers
        c.strokeStyle = '#d9c68f'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(x - 56, y - 96); c.quadraticCurveTo(x, y - 82, x + 56, y - 96); c.stroke();
        c.fillStyle = '#ffffff';
        for (const sx of [-30, 0, 30]) { c.fillRect(x + sx - 2, y - 90 + Math.abs(sx) * 0.12, 4, 12); }
    }

    drawCache(k) {
        const c = this.c;
        const shake = k.hitTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
        const x = k.x + shake, y = k.y;
        c.fillStyle = INK; c.fillRect(x - 1.5, y - 1.5, k.w + 3, k.h + 3);
        c.fillStyle = k.hitTimer > 0 ? '#ffffff' : '#8d6037'; c.fillRect(x, y, k.w, k.h);
        c.fillStyle = k.hitTimer > 0 ? '#ffffff' : '#6e4627';
        for (let i = 0; i < 3; i++) c.fillRect(x, y + 4 + i * 11, k.w, 2);
        c.fillRect(x + 3, y, 3, k.h); c.fillRect(x + k.w - 6, y, 3, k.h);
        c.strokeStyle = '#d9c68f'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x + k.w, y + k.h - 6); c.moveTo(x + k.w, y + 6); c.lineTo(x, y + k.h - 6); c.stroke();
        if (k.hp < 3) { c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 14, y); c.lineTo(x + 20, y + 12); c.lineTo(x + 16, y + 20); c.stroke(); }
        if (k.hp < 2) { c.beginPath(); c.moveTo(x + 32, y + k.h); c.lineTo(x + 28, y + 18); c.lineTo(x + 34, y + 10); c.stroke(); }
    }

    drawLoot(l) {
        const c = this.c, g = this.g;
        const bob = l.z < 0 ? l.z : Math.sin((g.frames + l.x) * 0.08) * 2 - 2;
        const x = l.x, y = l.y + bob;
        if (l.type === 'meat') c.drawImage(sprMeat, x - 15, y - 24);
        else if (l.type === 'bandage') c.drawImage(sprBandage, x - 15, y - 24);
        else if (l.type === 'essence') {
            c.fillStyle = 'rgba(80,20,110,0.35)';
            c.beginPath(); c.arc(x, y - 12, 14 + Math.sin(g.frames * 0.1) * 2, 0, Math.PI * 2); c.fill();
            c.drawImage(sprEssence, x - 15, y - 27);
            if (g.frames % 10 === 0) g.particles.push(new g.ParticleClass(x, y - 20, '#2d1240', { speed: 0.5, angle: -Math.PI / 2, grav: -0.03, life: 40, size: 3, shape: 'smoke' }));
        } else if (l.type === 'core') {
            const r = 11 + Math.sin(g.frames * 0.1) * 1.5;
            const gl = c.createRadialGradient(x, y - 16, 2, x, y - 16, r * 2.5);
            gl.addColorStop(0, 'rgba(255,255,255,0.9)'); gl.addColorStop(1, 'rgba(190,240,255,0)');
            c.fillStyle = gl; c.fillRect(x - r * 2.5, y - 16 - r * 2.5, r * 5, r * 5);
            c.fillStyle = INK; c.beginPath(); c.arc(x, y - 16, r + 1.5, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#e8fbff'; c.beginPath(); c.arc(x, y - 16, r, 0, Math.PI * 2); c.fill();
            c.fillStyle = VERMILION; c.beginPath(); c.arc(x, y - 16, r * 0.4, 0, Math.PI * 2); c.fill();
        }
    }

    // ---------- the cooking pot beside the Dojo ----------
    drawPot() {
        const c = this.c, g = this.g;
        const filled = g.pot || 0;
        // drawn 30% larger around its base so it stays visible next to the master
        c.save(); c.translate(POT.x, POT.y); c.scale(1.3, 1.3); c.translate(-POT.x, -POT.y);
        const x = POT.x, y = POT.y;
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x, y, 24, 7, 0, 0, Math.PI * 2); c.fill();
        // fire stones and embers
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            c.fillStyle = INK; c.beginPath(); c.ellipse(x + Math.cos(a) * 18, y - 2 + Math.sin(a) * 5, 6, 4, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#7d776c'; c.beginPath(); c.ellipse(x + Math.cos(a) * 18, y - 3 + Math.sin(a) * 5, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
        }
        const flick = Math.sin(g.frames * 0.3) * 2;
        c.fillStyle = 'rgba(255,140,40,0.85)'; c.beginPath(); c.moveTo(x - 8, y - 2); c.quadraticCurveTo(x, y - 16 - flick, x + 8, y - 2); c.fill();
        c.fillStyle = 'rgba(255,220,120,0.9)'; c.beginPath(); c.moveTo(x - 4, y - 3); c.quadraticCurveTo(x, y - 10 - flick, x + 4, y - 3); c.fill();
        // iron pot
        c.fillStyle = INK; c.beginPath(); c.ellipse(x, y - 16, 17, 13, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2f2f36'; c.beginPath(); c.ellipse(x, y - 16, 15, 11.5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.ellipse(x - 6, y - 20, 5, 3, -0.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = INK; c.beginPath(); c.ellipse(x, y - 26, 14, 4, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = filled ? '#7a4a2a' : '#1a1a1f'; c.beginPath(); c.ellipse(x, y - 26, 12, 3, 0, 0, Math.PI * 2); c.fill();
        for (let i = 0; i < filled; i++) { c.fillStyle = '#e5735f'; c.fillRect(x - 8 + i * 6, y - 28, 4, 3); }
        // steam while a meal is cooking
        c.restore();
        if (filled && g.frames % 14 === 0 && g.state === 'PLAYING') {
            g.particles.push(new g.ParticleClass(x + (Math.random() - 0.5) * 12, y - 40, 'rgba(235,235,235,0.5)', { speed: 0.6, angle: -Math.PI / 2, spread: 0.6, grav: -0.03, shape: 'smoke', size: 5, life: 55 }));
        }
    }

    // ---------- the seal stone that held Magatsuhi ----------
    drawSealStone() {
        const c = this.c, g = this.g, st = g.sealStone;
        const x = SEAL.x, y = SEAL.y;
        const shape = [[-30, 0], [-34, -18], [-26, -40], [-6, -52], [16, -48], [30, -34], [33, -12], [28, 0]];
        const poly = (pts, ox, oy, rot, col, grow = 0) => {
            c.save(); c.translate(x + ox, y + oy); c.rotate(rot);
            c.fillStyle = col; c.beginPath();
            pts.forEach(([px, py], i) => {
                const gx = px + Math.sign(px) * grow, gy = py - (py < -5 ? grow : 0);
                i ? c.lineTo(gx, gy) : c.moveTo(gx, gy);
            });
            c.closePath(); c.fill(); c.restore();
        };
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, y, 40, 10, 0, 0, Math.PI * 2); c.fill();

        if (!st.broken) {
            if (st.pulse > 0) {
                const a = (st.pulse / 260) * (0.35 + Math.sin(g.frames * 0.2) * 0.2);
                c.fillStyle = `rgba(150,60,210,${a})`; c.beginPath(); c.ellipse(x, y - 24, 56, 46, 0, 0, Math.PI * 2); c.fill();
            }
            poly(shape, 0, 0, 0, INK, 2.5);
            poly(shape, 0, 0, 0, '#5a5760');
            c.fillStyle = '#6f6c75'; c.beginPath(); c.ellipse(x - 8, y - 38, 12, 6, -0.3, 0, Math.PI * 2); c.fill();
            // shimenawa rope and paper streamers
            c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(x - 33, y - 24); c.quadraticCurveTo(x, y - 14, x + 33, y - 26); c.stroke();
            c.strokeStyle = '#d9c68f'; c.lineWidth = 5; c.stroke();
            c.fillStyle = WASHI;
            for (const sx of [-16, 2, 20]) {
                const yy = y - 20 + Math.abs(sx) * 0.05;
                c.beginPath(); c.moveTo(x + sx, yy); c.lineTo(x + sx + 5, yy + 4); c.lineTo(x + sx + 1, yy + 8); c.lineTo(x + sx + 6, yy + 13); c.lineTo(x + sx + 2, yy + 14); c.lineTo(x + sx - 2, yy + 8); c.lineTo(x + sx + 1, yy + 4); c.closePath(); c.fill();
            }
            if (st.crack > 0) {
                c.strokeStyle = `rgba(210,140,255,${0.5 + st.crack * 0.5})`; c.lineWidth = 1.5 + st.crack * 1.5;
                const L = st.crack;
                c.beginPath();
                c.moveTo(x - 2, y - 50); c.lineTo(x + 4 * L, y - 50 + 16 * L); c.lineTo(x - 6 * L, y - 50 + 30 * L); c.lineTo(x + 2 * L, y - 50 + 46 * L);
                c.moveTo(x + 18, y - 44); c.lineTo(x + 18 - 10 * L, y - 44 + 18 * L);
                c.moveTo(x - 24, y - 36); c.lineTo(x - 24 + 12 * L, y - 36 + 14 * L);
                c.stroke();
            }
        } else {
            // split in two, a dark wound between the halves
            const hole = c.createRadialGradient(x, y - 6, 2, x, y - 6, 26);
            hole.addColorStop(0, 'rgba(60,20,80,0.9)'); hole.addColorStop(1, 'rgba(20,6,26,0)');
            c.fillStyle = hole; c.beginPath(); c.ellipse(x, y - 4, 26, 10, 0, 0, Math.PI * 2); c.fill();
            const left = [[-30, 0], [-34, -18], [-26, -40], [-6, -50], [-3, -28], [-6, 0]];
            const right = [[6, 0], [2, -26], [6, -46], [16, -46], [30, -34], [33, -12], [28, 0]];
            poly(left, -10, 0, -0.22, INK, 2.5); poly(left, -10, 0, -0.22, '#4f4c55');
            poly(right, 10, 0, 0.2, INK, 2.5); poly(right, 10, 0, 0.2, '#4f4c55');
            c.strokeStyle = '#a99a6e'; c.lineWidth = 4;
            c.beginPath(); c.moveTo(x - 46, y - 2); c.quadraticCurveTo(x - 20, y + 6, x - 4, y + 2); c.moveTo(x + 8, y + 4); c.quadraticCurveTo(x + 30, y + 8, x + 44, y); c.stroke();
        }
    }

    // ---------- the escaping sliver of Magatsuhi ----------
    drawSliver() {
        const s = this.g.sliver, c = this.c, f = this.g.frames;
        if (!s) return;
        const tr = s.trail;
        for (let i = 0; i < tr.length; i++) {
            const t = i / Math.max(1, tr.length - 1);
            const r = 3 + t * 11;
            c.fillStyle = `rgba(140,60,200,${0.18 * t})`; c.beginPath(); c.arc(tr[i].x, tr[i].y, r + 6, 0, Math.PI * 2); c.fill();
            c.fillStyle = `rgba(18,6,24,${0.35 + 0.6 * t})`; c.beginPath(); c.arc(tr[i].x, tr[i].y, r, 0, Math.PI * 2); c.fill();
        }
        // writhing tendrils
        c.strokeStyle = 'rgba(30,10,40,0.8)'; c.lineWidth = 2.5; c.lineCap = 'round';
        for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + f * 0.15;
            c.beginPath(); c.moveTo(s.x, s.y);
            c.quadraticCurveTo(s.x + Math.cos(a) * 18, s.y + Math.sin(a) * 18, s.x + Math.cos(a + 0.6) * 26, s.y + Math.sin(a + 0.6) * 22);
            c.stroke();
        }
        c.fillStyle = 'rgba(160,70,220,0.35)'; c.beginPath(); c.arc(s.x, s.y, 22, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#0d0610'; c.beginPath(); c.arc(s.x, s.y, 16, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ff2a3a';
        c.fillRect(s.x - 8, s.y - 4, 5, 3); c.fillRect(s.x + 3, s.y - 4, 5, 3);
        c.fillStyle = 'rgba(255,60,70,0.35)'; c.fillRect(s.x - 10, s.y - 6, 20, 7);
    }

    // ---------- the four technique seals that shatter ----------
    drawSeals() {
        const g = this.g, c = this.c, p = g.player;
        for (const sl of g.seals) {
            if (sl.broken) continue;
            const a = sl.a + g.frames * 0.04;
            const x = p.x + 20 + Math.cos(a) * 46, y = p.y + 18 + Math.sin(a) * 20;
            c.save(); c.translate(x, y); c.rotate(Math.sin(g.frames * 0.1 + sl.a) * 0.15);
            c.fillStyle = 'rgba(255,230,160,0.35)'; c.fillRect(-10, -14, 20, 28);
            c.fillStyle = INK; c.fillRect(-7.5, -11.5, 15, 23);
            c.fillStyle = WASHI; c.fillRect(-6, -10, 12, 20);
            c.strokeStyle = VERMILION; c.lineWidth = 1.6;
            c.beginPath(); c.moveTo(-3, -6); c.lineTo(3, -6); c.moveTo(0, -8); c.lineTo(0, 7); c.moveTo(-3, 2); c.lineTo(3, 5); c.stroke();
            c.restore();
        }
    }

    // ---------- letterbox, subtitles, objective, title card ----------
    drawCinema() {
        const g = this.g, c = this.c;
        const lb = g.letterbox;
        const barH = Math.round(70 * lb);
        if (lb > 0.01) {
            c.fillStyle = '#000';
            c.fillRect(0, 0, W, barH); c.fillRect(0, H - barH, W, barH);
        }

        // objective (only while playing, not during cutscenes)
        if (g.objective && lb < 0.3 && g.state === 'PLAYING') {
            c.font = `500 16px ${FONT_UI}`;
            const lines = wrapText(c, g.objective, 620);
            const h = 18 + lines.length * 22;
            const y = 98;
            const flash = g.objectiveFlash / 40;
            c.fillStyle = 'rgba(16,12,18,0.86)'; roundRect(c, W / 2 - 340, y, 680, h, 8); c.fill();
            c.strokeStyle = `rgba(255,215,140,${0.25 + flash * 0.6})`; c.lineWidth = 1 + flash * 2; c.stroke();
            c.save(); c.translate(W / 2 - 318, y + h / 2); c.rotate(Math.PI / 4);
            c.fillStyle = VERMILION; c.fillRect(-5, -5, 10, 10); c.restore();
            c.fillStyle = WASHI; c.textAlign = 'left';
            lines.forEach((ln, i) => c.fillText(ln, W / 2 - 298, y + 24 + i * 22));
        }

        // subtitles
        const sub = g.subtitle;
        if (sub && sub.timer > 0) {
            const age = sub.max - sub.timer;
            const alpha = Math.max(0, Math.min(1, age / 15, sub.timer / 15));
            const ren = sub.who === 'ren';
            c.save(); c.globalAlpha = alpha;
            c.font = `${ren ? '600' : 'italic 600'} 21px ${FONT_DISPLAY}`;
            const lines = wrapText(c, sub.text, 820);
            const lineH = 26;
            let baseY;
            if (lb > 0.5) {
                baseY = H - barH / 2 - ((lines.length - 1) * lineH) / 2 + 7;
            } else {
                const boxH = lines.length * lineH + (ren ? 30 : 14);
                c.fillStyle = 'rgba(10,8,14,0.78)'; roundRect(c, W / 2 - 440, H - boxH - 18, 880, boxH, 8); c.fill();
                baseY = H - 18 - boxH + (ren ? 26 : 8) + 19;
            }
            if (ren) {
                c.font = `600 12px ${FONT_UI}`; c.fillStyle = 'rgba(191,244,255,0.75)'; c.textAlign = 'center';
                c.fillText('Sensei Ren, remembered', W / 2, baseY - 24);
                c.font = `600 21px ${FONT_DISPLAY}`;
            }
            c.textAlign = 'center';
            c.fillStyle = ren ? MOONLIGHT : WASHI;
            lines.forEach((ln, i) => c.fillText(ln, W / 2, baseY + i * lineH));
            c.restore();
        }
        if (this.g.script && this.g.script.cutscene && lb > 0.5) {
            c.font = `500 12px ${FONT_UI}`; c.fillStyle = 'rgba(239,230,210,0.4)'; c.textAlign = 'right';
            c.fillText(this.g.isTouch() ? 'Tap to fast-forward' : 'Space to fast-forward, Esc for menu', W - 18, 22);
        }

        // closing title card
        const tc = g.titleCard;
        if (tc) {
            const age = tc.max - tc.timer;
            const a = Math.max(0, Math.min(1, age / 40, tc.timer / 30));
            c.save(); c.globalAlpha = a;
            c.fillStyle = 'rgba(6,5,10,0.6)'; c.fillRect(0, barH, W, H - barH * 2);
            c.font = `800 82px ${FONT_DISPLAY}`; c.textAlign = 'center';
            const tw = c.measureText('Last Dojo').width;
            c.fillStyle = WASHI; c.fillText('Last Dojo', W / 2 + 34, H / 2 + 22);
            const hx = W / 2 + 34 - tw / 2 - 86, hy = H / 2 - 42;
            c.save(); c.translate(hx + 34, hy + 34); c.rotate(-0.09);
            c.fillStyle = VERMILION; roundRect(c, -34, -34, 68, 68, 6); c.fill();
            c.strokeStyle = WASHI; c.lineWidth = 2.5; roundRect(c, -28, -28, 56, 56, 4); c.stroke();
            c.fillStyle = WASHI; c.font = `800 22px ${FONT_DISPLAY}`; c.textAlign = 'center';
            c.fillText('道', 0, -3); c.fillText('場', 0, 21);
            c.restore();
            c.textAlign = 'center';
            c.font = `500 17px ${FONT_UI}`; c.fillStyle = 'rgba(239,230,210,0.75)';
            c.fillText('Fifteen nights.', W / 2, H / 2 + 70);
            c.restore();
        }
    }

    drawEffects() {
        const g = this.g, c = this.c;
        for (const e of g.effects) e.draw(c);
        for (const p of g.particles) p.draw(c);
        for (const t of g.texts) t.draw(c);
    }

    // ---------- lighting ----------
    drawLighting(info, camX, sy) {
        const g = this.g, c = this.c, l = this.lc;
        const pitch = g.ec && g.ec.pitchBlack;
        let dark = (1 - info.dl) * 0.7;
        if (pitch && g.state !== 'START') dark = Math.max(dark, 0.93);
        if (dark < 0.02) return;

        l.setTransform(0.5, 0, 0, 0.5, 0, 0);
        l.globalCompositeOperation = 'source-over';
        l.clearRect(0, 0, W, H);
        l.fillStyle = info.blood ? `rgba(34,3,8,${dark})` : `rgba(6,10,32,${dark})`;
        l.fillRect(0, 0, W, H);
        l.globalCompositeOperation = 'destination-out';

        const lights = [];
        const z = g.zoom || 1;
        const add = (x, y, r, a, warm = null) => {
            const sx = (x - camX - W / 2) * z + W / 2, syy = (y + sy - H / 2) * z + H / 2;
            r *= z;
            if (sx < -r || sx > W + r) return;
            lights.push({ x: sx, y: syy, r, a, warm });
        };
        const p = g.player;
        if (g.showPlayer()) add(p.x + 20, p.y + 24, pitch ? 140 : 175, pitch ? 1 : 0.8, p.rushTimer > 0 ? '255,40,40' : null);
        if (pitch && g.state !== 'START') {
            // pitch black: only your own light and the things that glow on their own
            for (const pr of g.projectiles) add(pr.x, pr.y, 40, 0.6, '190,230,60');
            for (const e of g.enemies) if (e.burning && !e.dead) add(e.x + e.w / 2, e.y + e.h / 2, 60, 0.7, '255,140,40');
        } else {
        add(DOJO.x + 8, DOJO.y + DOJO.h - 82, 110, 0.85, '255,140,70');
        add(DOJO.x + DOJO.w - 8, DOJO.y + DOJO.h - 82, 110, 0.85, '255,140,70');
        add(DOJO_DOOR.x, DOJO_DOOR.y - 40, 150, 0.55, '255,190,110');
        for (const s of STONE_LANTERNS) add(s.x, s.y - 36, 95, 0.75, '255,190,100');
        if (!g.isDay || g.state === 'START') add(SHRINE.x, SHRINE.y - 66, 210 + (g.shrineGlow || 0), 0.9, '150,235,255');
        for (const a of this.ambient) if (a.k === 'fly') add(a.x, a.y, 20, 0.5, '200,255,120');
        for (const pr of g.projectiles) add(pr.x, pr.y, 55, 0.6, pr.reflected ? '120,240,255' : '190,230,60');
        for (const lt of g.loot) if (lt.type === 'essence' || lt.type === 'core') add(lt.x, lt.y - 14, 45, 0.6, lt.type === 'core' ? '200,240,255' : '160,80,220');
        for (const e of g.enemies) if (e.burning && !e.dead) add(e.x + e.w / 2, e.y + e.h / 2, 70, 0.75, '255,140,40');
        for (const pl of g.pools) if (pl.active && pl.kind !== 'acid') add(pl.x, pl.y, 70, 0.6, '255,90,30');
        if (g.dojo.hp / g.dojo.maxHp < 0.3) add(DOJO.x + DOJO.w / 2, DOJO.y - 70, 120, 0.6, '255,120,40');
        const st = g.sealStone;
        if (st.pulse > 0 || (st.crack > 0 && !st.broken && g.state !== 'START')) add(SEAL.x, SEAL.y - 26, 70 + st.crack * 60, 0.5, '170,80,230');
        if (st.broken) add(SEAL.x, SEAL.y - 10, 45, 0.35, '150,70,210');
        if (g.sliver) add(g.sliver.x, g.sliver.y, 60, 0.5, '255,40,60');
        add(POT.x, POT.y - 8, 70, 0.6, '255,150,60');
        }

        for (const L of lights) {
            const gr = l.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
            gr.addColorStop(0, `rgba(0,0,0,${L.a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
            l.fillStyle = gr; l.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
        }
        c.drawImage(this.light, 0, 0, W, H);

        // coloured glow on top
        c.globalCompositeOperation = 'lighter';
        for (const L of lights) {
            if (!L.warm) continue;
            const r = L.r * 0.7;
            const gr = c.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
            gr.addColorStop(0, `rgba(${L.warm},${0.22 * dark})`); gr.addColorStop(1, `rgba(${L.warm},0)`);
            c.fillStyle = gr; c.fillRect(L.x - r, L.y - r, r * 2, r * 2);
        }
        c.globalCompositeOperation = 'source-over';
    }

    // ---------- full-screen feedback ----------
    drawScreenFx(info) {
        const g = this.g, c = this.c, p = g.player;
        const inRun = ['PLAYING', 'SUNRISE', 'CHOICE', 'DYING'].includes(g.state);
        if (!inRun) return;
        const edge = (col, a) => {
            const gr = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
            gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(1, `rgba(${col},${a})`);
            c.fillStyle = gr; c.fillRect(0, 0, W, H);
        };
        if (g.dmgFlash > 0) edge('220,0,0', g.dmgFlash / 26 * 0.6);
        const frac = p.infection % 1;
        if (p.surgeWarn > 0) edge('120,30,170', 0.35 + Math.sin(g.frames * 0.4) * 0.25);
        else if (frac > 0.8 && p.infection < 3) edge('120,30,170', (frac - 0.8) / 0.2 * 0.35);
        if (p.rushTimer > 0) edge('255,30,30', 0.22 + Math.sin(g.frames * 0.3) * 0.08);
        if (g.cureFlash > 0) { c.fillStyle = `rgba(190,245,255,${g.cureFlash / 40 * 0.5})`; c.fillRect(0, 0, W, H); }
        if (g.surgeFlash > 0) { c.fillStyle = `rgba(110,20,160,${g.surgeFlash / 30 * 0.45})`; c.fillRect(0, 0, W, H); }
        if (g.sleepFade > 0) {
            const a = g.sleepFade > 40 ? (80 - g.sleepFade) / 40 : g.sleepFade / 40;
            c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(0, 0, W, H);
        }
    }

    // ---------- world-anchored UI (prompts, sanctuary timer) ----------
    drawWorldUI(camX, sy) {
        const g = this.g, c = this.c, p = g.player;
        const z = g.zoom || 1;
        const px = (p.x + 20 - camX - W / 2) * z + W / 2, py = (p.y + sy - H / 2) * z + H / 2;
        // sacred-ground timer ring
        if (g.sanctFrac > 0 && g.state === 'PLAYING') {
            const f = Math.min(1, g.sanctFrac);
            c.lineWidth = 3;
            c.strokeStyle = 'rgba(0,0,0,0.5)';
            c.beginPath(); c.ellipse(px, py + 40, 22, 9, 0, 0, Math.PI * 2); c.stroke();
            c.strokeStyle = f >= 1 ? `rgba(255,80,40,${0.6 + Math.sin(g.frames * 0.4) * 0.3})` : '#ffd77a';
            c.beginPath(); c.ellipse(px, py + 40, 22, 9, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - f) + (f >= 1 ? Math.PI * 2 : 0)); c.stroke();
        }
        // interaction prompt
        if (g.prompt && p.staggerTimer <= 0 && g.state === 'PLAYING') {
            const key = g.prompt.action ? g.keyLabel('interact') : null;
            c.font = `700 14px ${FONT_UI}`;
            const tw = c.measureText(g.prompt.text).width;
            const kw = key ? c.measureText(key).width + 14 : 0;
            const w = tw + kw + (key ? 26 : 18), x = px - w / 2, y = py - 50;
            c.fillStyle = 'rgba(16,12,18,0.82)'; roundRect(c, x, y, w, 24, 6); c.fill();
            c.strokeStyle = g.prompt.action ? 'rgba(255,215,140,0.7)' : 'rgba(239,230,210,0.25)'; c.lineWidth = 1; c.stroke();
            let tx = x + 9;
            if (key) {
                c.fillStyle = WASHI; roundRect(c, tx, y + 4, kw, 16, 3); c.fill();
                c.fillStyle = INK; c.textAlign = 'center'; c.fillText(key, tx + kw / 2, y + 17);
                tx += kw + 8;
            }
            c.textAlign = 'left'; c.fillStyle = g.prompt.action ? '#ffe2a8' : '#cfc6b4';
            c.fillText(g.prompt.text, tx, y + 17);
        }
    }

    // ---------- HUD ----------
    drawHUD(info) {
        const g = this.g, c = this.c, p = g.player;
        c.textBaseline = 'alphabetic';

        // ---- player panel ----
        c.fillStyle = 'rgba(16,12,18,0.74)'; roundRect(c, 10, 8, 300, 78, 8); c.fill();
        c.strokeStyle = 'rgba(239,230,210,0.18)'; c.lineWidth = 1; c.stroke();

        // HP
        const bx = 22, bw = 196;
        c.fillStyle = '#2a1d20'; roundRect(c, bx, 18, bw, 13, 3); c.fill();
        c.fillStyle = 'rgba(239,230,210,0.55)'; c.fillRect(bx, 18, bw * Math.max(0, p.ghostHp / p.maxHp), 13);
        const hpg = c.createLinearGradient(0, 18, 0, 31);
        hpg.addColorStop(0, '#e05545'); hpg.addColorStop(1, '#a52a1f');
        c.fillStyle = hpg; c.fillRect(bx, 18, bw * Math.max(0, p.hp / p.maxHp), 13);
        c.font = `700 11px ${FONT_UI}`; c.fillStyle = WASHI; c.textAlign = 'left';
        c.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, bx + 5, 28.5);
        // tonight's meal (or what's in the pot by day)
        let meal = null;
        if (p.mealTier) meal = { t: MEAL.names[p.mealTier], col: '#ffd77a' };
        else if (g.isDay && g.pot > 0) meal = { t: `Meal ${g.pot}/${MEAL.maxPot}`, col: 'rgba(255,215,122,0.75)' };
        if (meal) { c.textAlign = 'right'; c.fillStyle = meal.col; c.fillText(meal.t, bx + bw - 5, 28.5); c.textAlign = 'left'; }

        // stamina
        const free = g.freeStamina();
        c.fillStyle = '#1c2230'; roundRect(c, bx, 36, bw, 7, 2); c.fill();
        c.fillStyle = free ? `rgb(255,${200 + Math.sin(g.frames * 0.2) * 30},80)` : '#4fa3d9';
        c.fillRect(bx, 36, bw * (free ? 1 : p.stamina / p.maxStamina), 7);

        // kegare skulls (hidden in the prologue until the curse strikes)
        if (!g.hideKegare) for (let i = 0; i < 3; i++) {
            const fill = Math.max(0, Math.min(1, p.infection - i));
            this.drawSkull(bx + 10 + i * 26, 63, fill, p.surgeWarn > 0 && Math.floor(p.infection) === i + 1);
        }
        c.font = `700 12px ${FONT_UI}`; c.textAlign = 'left';
        if (g.hideKegare) {
            // nothing yet: the master is still whole
        } else if (p.surgeWarn > 0) {
            c.fillStyle = `rgba(214,140,255,${0.6 + Math.sin(g.frames * 0.4) * 0.4})`;
            c.fillText('Surge!', bx + 86, 68);
        } else {
            c.fillStyle = 'rgba(214,180,240,0.85)';
            c.fillText(`Kegare${g.ec && g.ec.noKegare ? ' (off)' : ''}`, bx + 86, 68);
        }
        // dash readiness pip
        c.fillStyle = p.dashCd > 0 ? '#3a3f4a' : '#9fd8ff';
        c.beginPath(); c.arc(bx + 186, 63, 5, 0, Math.PI * 2); c.fill();
        c.font = `600 10px ${FONT_UI}`; c.fillStyle = 'rgba(239,230,210,0.6)'; c.textAlign = 'right';
        c.fillText('dash', bx + 178, 67);

        // inventory
        c.drawImage(sprMeat, 230, 12, 24, 24);
        c.drawImage(sprEssence, 230, 46, 24, 24);
        c.font = `700 17px ${FONT_UI}`; c.fillStyle = WASHI; c.textAlign = 'left';
        c.fillText(`${p.food}`, 260, 31);
        c.fillStyle = '#d6b4f0'; c.fillText(`${p.essence}`, 260, 65);
        if (p.rushTimer > 0) {
            c.fillStyle = '#ff5a4a'; c.font = `700 11px ${FONT_UI}`;
            c.fillText(`Unleashed ${Math.ceil(p.rushTimer / 60)}s`, 22, 100);
        }

        // ---- day track ----
        const tx = W / 2 - 150, tw = 300;
        c.fillStyle = 'rgba(16,12,18,0.6)'; roundRect(c, tx - 12, 8, tw + 24, 50, 8); c.fill();
        let title;
        if (g.state === 'SUNRISE') title = 'Sunrise';
        else if (g.isSiege && !g.peaceful) title = `Blood moon, night ${g.dayCount}`;
        else title = `${g.isDay ? 'Day' : 'Night'} ${g.dayCount}`;
        let suffix = g.mode === 'ENDLESS' ? '  Endless' : `  of ${SURVIVAL_DAYS}`;
        if (g.titleOverride) { title = g.titleOverride; suffix = ''; }
        c.textAlign = 'center';
        c.font = `700 19px ${FONT_DISPLAY}`;
        c.fillStyle = g.isSiege && !g.peaceful ? '#ff6b5e' : WASHI;
        const tW = c.measureText(title).width;
        c.font = `500 12px ${FONT_UI}`;
        const sW = c.measureText(suffix).width;
        c.font = `700 19px ${FONT_DISPLAY}`;
        c.fillText(title, W / 2 - sW / 2, 30);
        c.font = `500 12px ${FONT_UI}`; c.fillStyle = 'rgba(239,230,210,0.55)'; c.textAlign = 'left';
        c.fillText(suffix, W / 2 + tW / 2 - sW / 2, 30);
        const prog = g.state === 'SUNRISE' ? 1 : 1 - g.timeTimer / g.phaseLen;
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(tx, 42, tw, 4);
        c.fillStyle = g.isDay ? '#ffd77a' : (g.isSiege && !g.peaceful ? '#e53935' : '#9fb8ff');
        c.fillRect(tx, 42, tw * prog, 4);
        c.fillStyle = g.isDay ? '#fff1c4' : '#e8eeff';
        c.beginPath(); c.arc(tx + tw * prog, 44, 5, 0, Math.PI * 2); c.fill();

        // ---- minimap ----
        this.drawMinimap();

        // ---- boss bar ----
        const bosses = g.enemies.filter(e => e.isBoss && !e.dead && e.spawnTimer <= 0);
        if (bosses.length) {
            const b = bosses[0];
            const bw2 = 460, bx2 = W / 2 - bw2 / 2, by2 = H - 34;
            c.fillStyle = 'rgba(16,12,18,0.8)'; roundRect(c, bx2 - 10, by2 - 26, bw2 + 20, 44, 8); c.fill();
            c.font = `700 16px ${FONT_DISPLAY}`; c.fillStyle = '#ffb3a8'; c.textAlign = 'center';
            c.fillText(BOSS_NAMES[b.type] + (bosses.length > 1 ? `  x${bosses.length}` : ''), W / 2, by2 - 8);
            c.fillStyle = '#2a1d20'; c.fillRect(bx2, by2, bw2, 10);
            c.fillStyle = '#c0392b'; c.fillRect(bx2, by2, bw2 * (b.hp / b.maxHp), 10);
            if (b.type === 'warlord') { c.fillStyle = WASHI; c.fillRect(bx2 + bw2 / 2 - 1, by2 - 2, 2, 14); }
        }

        // ---- combo ----
        if (g.combo > 1 && g.state === 'PLAYING') {
            c.save();
            let size = 26 + Math.min(18, g.combo * 0.6), col = WASHI;
            if (g.combo >= 25) { col = '#ff4d4d'; size += Math.sin(g.frames * 0.5) * 3; }
            else if (g.combo >= 10) col = '#ffd54f';
            c.globalAlpha = g.comboTimer < 60 ? g.comboTimer / 60 : 1;
            c.translate(34, H / 2); c.rotate(-0.08);
            c.font = `900 ${size}px ${FONT_DISPLAY}`; c.textAlign = 'left';
            c.lineWidth = 5; c.strokeStyle = INK; c.strokeText(`${g.combo}`, 0, 0);
            c.fillStyle = col; c.fillText(`${g.combo}`, 0, 0);
            c.font = `700 13px ${FONT_UI}`; c.strokeText('hit combo', 2, 18); c.fillText('hit combo', 2, 18);
            if (g.combo >= 10) {
                c.font = `700 11px ${FONT_UI}`; c.fillStyle = col;
                c.strokeText(g.combo >= 25 ? '+50% damage' : '+20% damage', 2, 33);
                c.fillText(g.combo >= 25 ? '+50% damage' : '+20% damage', 2, 33);
            }
            c.restore();
        }

        // ---- announcement ----
        if (g.announce.timer > 0) {
            const a = g.announce;
            const alpha = Math.min(1, a.timer / 40, (a.max - a.timer) / 15);
            c.save(); c.globalAlpha = Math.max(0, alpha);
            const y = H * 0.3;
            // ink brush stroke behind the title
            c.fillStyle = a.blood ? 'rgba(120,10,14,0.85)' : 'rgba(16,12,18,0.75)';
            c.beginPath();
            c.moveTo(W / 2 - 260, y - 40); c.quadraticCurveTo(W / 2, y - 52, W / 2 + 270, y - 36);
            c.lineTo(W / 2 + 250, y + 18); c.quadraticCurveTo(W / 2, y + 26, W / 2 - 272, y + 14); c.closePath(); c.fill();
            c.font = `800 48px ${FONT_DISPLAY}`; c.textAlign = 'center';
            c.fillStyle = a.blood ? '#ffd0c8' : WASHI;
            c.fillText(a.text, W / 2, y + 2);
            if (a.sub) {
                c.font = `600 18px ${FONT_UI}`;
                c.lineWidth = 4; c.strokeStyle = 'rgba(10,8,10,0.8)'; c.strokeText(a.sub, W / 2, y + 48);
                c.fillStyle = a.blood ? '#ff8a7a' : '#e8dcc4'; c.fillText(a.sub, W / 2, y + 48);
            }
            c.restore();
        }

        // ---- hint banner ----
        if (g.hintText && g.hintTimer > 0 && g.state === 'PLAYING' && !g.objective) {
            const alpha = Math.min(1, g.hintTimer / 30, (420 - g.hintTimer) / 15);
            c.save(); c.globalAlpha = Math.max(0, alpha);
            c.font = `500 16px ${FONT_UI}`;
            const lines = wrapText(c, g.hintText, 640);
            const h = 20 + lines.length * 22;
            const y = 100;
            c.fillStyle = 'rgba(16,12,18,0.85)'; roundRect(c, W / 2 - 340, y, 680, h, 8); c.fill();
            c.fillStyle = VERMILION; c.fillRect(W / 2 - 340, y + 8, 3, h - 16);
            c.fillStyle = WASHI; c.textAlign = 'left';
            lines.forEach((ln, i) => c.fillText(ln, W / 2 - 320, y + 26 + i * 22));
            c.restore();
        }

        // dim during technique choice
        if (g.state === 'CHOICE') { c.fillStyle = 'rgba(8,6,12,0.55)'; c.fillRect(0, 0, W, H); }
    }

    drawSkull(x, y, fill, pulse) {
        const c = this.c;
        const draw = (col) => {
            c.fillStyle = col;
            c.beginPath(); c.arc(x, y - 3, 8, Math.PI, 0); c.lineTo(x + 8, y + 2); c.lineTo(x + 5, y + 2); c.lineTo(x + 5, y + 7);
            c.lineTo(x - 5, y + 7); c.lineTo(x - 5, y + 2); c.lineTo(x - 8, y + 2); c.closePath(); c.fill();
        };
        draw(pulse ? '#5a2a70' : '#2b2433');
        if (fill > 0) {
            c.save(); c.beginPath(); c.rect(x - 9, y + 8 - 19 * fill, 18, 19 * fill); c.clip();
            draw(fill >= 1 ? '#b05ce0' : '#7b3fa0'); c.restore();
        }
        c.fillStyle = INK;
        c.fillRect(x - 5, y - 3, 3.5, 3.5); c.fillRect(x + 1.5, y - 3, 3.5, 3.5);
        c.fillRect(x - 1, y + 3, 2, 2);
    }

    drawMinimap() {
        const g = this.g, c = this.c;
        const mw = 250, mh = 30, mx = W - mw - 18, my = 14;
        const sc = mw / WORLD_W;
        c.fillStyle = 'rgba(16,12,18,0.74)'; roundRect(c, mx - 8, 8, mw + 16, 50, 8); c.fill();
        c.fillStyle = '#25381f'; c.fillRect(mx, my, FOREST_END * sc, mh);
        c.fillStyle = '#4b6538'; c.fillRect(mx + FOREST_END * sc, my, (SANCT_START - FOREST_END) * sc, mh);
        c.fillStyle = '#5f8f46'; c.fillRect(mx + SANCT_START * sc, my, (WORLD_W - SANCT_START) * sc, mh);
        const yMap = y => my + Math.max(0, Math.min(mh, ((y - FEET_MIN + 40) / (H - FEET_MIN + 40)) * mh));
        // view window
        c.strokeStyle = 'rgba(239,230,210,0.5)'; c.lineWidth = 1;
        c.strokeRect(mx + g.camera.x * sc, my, W * sc, mh);
        // dojo + shrine
        c.fillStyle = VERMILION; c.fillRect(mx + DOJO.x * sc, yMap(DOJO.y + DOJO.h) - 4, DOJO.w * sc, 5);
        c.fillStyle = !g.isDay ? MOONLIGHT : '#cfd8c8'; c.beginPath(); c.arc(mx + SHRINE.x * sc, yMap(SHRINE.y), 3, 0, Math.PI * 2); c.fill();
        for (const k of g.caches) if (!k.dead) { c.fillStyle = '#e0b060'; c.fillRect(mx + k.x * sc - 1.5, yMap(k.y + k.h) - 1.5, 3, 3); }
        for (const e of g.enemies) {
            if (e.dead) continue;
            if (e.isBoss) { c.fillStyle = '#ff2a2a'; c.fillRect(mx + (e.x + e.w / 2) * sc - 3, yMap(e.y + e.h) - 3, 6, 6); }
            else { c.fillStyle = e.type === 'boar' ? '#c8946a' : '#ff6b5e'; c.fillRect(mx + (e.x + e.w / 2) * sc - 1, yMap(e.y + e.h) - 1, 2, 2); }
        }
        const p = g.player;
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(mx + (p.x + 20) * sc, yMap(p.y + 40), 2.8, 0, Math.PI * 2); c.fill();
        c.font = `600 9px ${FONT_UI}`; c.fillStyle = 'rgba(239,230,210,0.6)'; c.textAlign = 'left';
        c.fillText('Forest', mx + 3, my + mh + 11);
        c.textAlign = 'center'; c.fillText('Dojo', mx + (DOJO.x + DOJO.w / 2) * sc, my + mh + 11);
        c.textAlign = 'right'; c.fillText('Sanctuary', mx + mw - 2, my + mh + 11);
        // dojo health during sieges
        if ((g.isSiege && !g.peaceful) || g.dojo.hp < g.dojo.maxHp) {
            const dw = 120, dx = W - dw - 26, dy = 64;
            c.fillStyle = 'rgba(16,12,18,0.74)'; roundRect(c, dx - 52, dy - 4, dw + 60, 18, 6); c.fill();
            c.font = `700 11px ${FONT_UI}`; c.fillStyle = WASHI; c.textAlign = 'right'; c.fillText('Dojo', dx - 6, dy + 9);
            c.fillStyle = '#2a1d20'; c.fillRect(dx, dy + 2, dw, 7);
            c.fillStyle = '#ffcc33'; c.fillRect(dx, dy + 2, dw * (g.dojo.hp / g.dojo.maxHp), 7);
        }
    }

    // ---------- story cards ----------
    drawStory(lines, idx, timer, max) {
        const c = this.c;
        c.fillStyle = 'rgba(6,5,10,0.92)'; c.fillRect(0, 0, W, H);
        if (idx >= lines.length) return;
        const alpha = Math.min(1, (max - timer) / 30, timer / 25);
        c.save(); c.globalAlpha = Math.max(0, alpha);
        c.font = `600 26px ${FONT_DISPLAY}`; c.textAlign = 'center'; c.fillStyle = WASHI;
        const wl = wrapText(c, lines[idx], 720);
        wl.forEach((ln, i) => c.fillText(ln, W / 2, H / 2 - (wl.length - 1) * 18 + i * 36));
        c.restore();
        c.font = `500 13px ${FONT_UI}`; c.fillStyle = 'rgba(239,230,210,0.45)'; c.textAlign = 'center';
        c.fillText(this.g.isTouch() ? 'Tap to continue' : 'Space to continue, Esc to skip', W / 2, H - 30);
    }
}
