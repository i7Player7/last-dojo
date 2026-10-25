/* =========================================
   LAST DOJO V3 - ASSETS & AUDIO (assets.js)
========================================= */

// =========================================
// 1. AUDIO ENGINE (procedural, no files)
// =========================================
export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.master = null;
    }

    init() {
        try {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.master = this.ctx.createGain();
                this.master.gain.value = 0.8;
                this.master.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
        } catch (e) {}
    }

    playTone(freq, type, duration, vol = 0.1, slideFreq = null, delay = 0) {
        if (!this.ctx || this.muted || this.suppress) return;
        try {
            const t = this.ctx.currentTime + delay;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, t + duration);
            gain.gain.setValueAtTime(vol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
            osc.connect(gain);
            gain.connect(this.master);
            osc.start(t);
            osc.stop(t + duration);
        } catch (e) {}
    }

    playNoise(duration, vol = 0.1, filterFreq = null, delay = 0) {
        if (!this.ctx || this.muted || this.suppress) return;
        try {
            const t = this.ctx.currentTime + delay;
            const size = Math.floor(this.ctx.sampleRate * duration);
            const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
            const src = this.ctx.createBufferSource();
            src.buffer = buffer;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
            let node = src;
            if (filterFreq) {
                const f = this.ctx.createBiquadFilter();
                f.type = 'lowpass';
                f.frequency.value = filterFreq;
                src.connect(f);
                node = f;
            }
            node.connect(gain);
            gain.connect(this.master);
            src.start(t);
        } catch (e) {}
    }

    // --- Combat ---
    sfxSwing()     { this.playNoise(0.08, 0.05, 3000); this.playTone(220, 'sine', 0.1, 0.03, 90); }
    sfxHit()       { this.playTone(120, 'square', 0.09, 0.08, 45); this.playNoise(0.06, 0.08, 1800); }
    sfxHeavyHit()  { this.playTone(90, 'square', 0.16, 0.12, 30); this.playNoise(0.12, 0.14, 1200); }
    sfxSpin()      { this.playNoise(0.25, 0.08, 2500); this.playTone(300, 'triangle', 0.25, 0.04, 120); }
    sfxDash()      { this.playNoise(0.14, 0.07, 4000); }
    sfxParry()     { this.playTone(900, 'triangle', 0.3, 0.1); this.playTone(1350, 'sine', 0.2, 0.05); }
    sfxHurt()      { this.playTone(160, 'sawtooth', 0.18, 0.08, 70); }
    sfxSpit()      { this.playTone(420, 'sawtooth', 0.25, 0.04, 110); }
    sfxExplode()   { this.playNoise(0.35, 0.22, 900); this.playTone(70, 'square', 0.3, 0.12, 30); }
    sfxPop()       { this.playNoise(0.4, 0.25, 700); this.playTone(55, 'sawtooth', 0.4, 0.15, 25); }
    sfxSlam()      { this.playNoise(0.6, 0.3, 400); this.playTone(45, 'square', 0.6, 0.2, 20); }
    sfxCrate()     { this.playNoise(0.18, 0.15, 2200); this.playTone(180, 'square', 0.08, 0.06, 90); }

    // --- Pickups & actions ---
    sfxPickup()    { this.playTone(660, 'sine', 0.08, 0.05, 990); }
    sfxEssence()   { this.playTone(220, 'sine', 0.4, 0.06, 110); this.playTone(330, 'triangle', 0.3, 0.03, 160, 0.05); }
    sfxEat()       { this.playNoise(0.07, 0.08, 1500); this.playNoise(0.07, 0.08, 1500, 0.12); }
    sfxOffer()     { [523, 659, 784, 1046].forEach((f, i) => this.playTone(f, 'sine', 0.6, 0.06, null, i * 0.09)); }
    sfxUnleash()   { this.playTone(80, 'sawtooth', 0.7, 0.15, 220); this.playNoise(0.5, 0.15, 1200); }
    sfxLevelUp()   { this.playTone(400, 'sine', 0.12, 0.08, 600); this.playTone(600, 'sine', 0.3, 0.08, 900, 0.1); }
    sfxLore()      { this.playTone(200, 'sine', 0.5, 0.05); }
    sfxHeartbeat() { this.playTone(60, 'sine', 0.14, 0.25, 40); this.playTone(55, 'sine', 0.14, 0.2, 35, 0.18); }
    sfxSurge()     { this.playNoise(0.8, 0.25, 600); this.playTone(40, 'sawtooth', 0.8, 0.25, 15); }
    sfxDenied()    { this.playTone(140, 'square', 0.15, 0.05, 100); }

    // --- World ---
    sfxWarlordRoar()     { this.playNoise(1.5, 0.4, 500); this.playTone(40, 'sawtooth', 1.5, 0.3, 10); }
    sfxFrustratedGroan() { this.playNoise(0.6, 0.12, 600); this.playTone(70, 'sawtooth', 0.6, 0.12, 40); }
    sfxBell()            { this.playTone(196, 'sine', 2.2, 0.12); this.playTone(392, 'sine', 1.8, 0.04); }
    sfxVictory()         { [400, 600, 800, 1200].forEach((f, i) => this.playTone(f, 'sine', 0.6, 0.08, f * 1.3, i * 0.2)); }
}

export const sfx = new AudioEngine();


// =========================================
// 2. PIXEL ICON BUILDER
// =========================================
export const pal = {
    '.': null, 'X': '#1a1412', 'S': '#ffcc99', 'W': '#efe6d2', 'R': '#c0392b',
    'F': '#e5735f', 'P': '#ffffff', 'K': '#3b1a52', 'V': '#8e44ad', 'L': '#c39bd3',
    'B': '#8d5a3b', 'N': '#5d3a24'
};

export function buildSprite(art, scale = 3) {
    const c = document.createElement('canvas');
    c.width = art[0].length * scale;
    c.height = art.length * scale;
    const cx = c.getContext('2d');
    for (let y = 0; y < art.length; y++) {
        for (let x = 0; x < art[y].length; x++) {
            const col = pal[art[y][x]];
            if (col) { cx.fillStyle = col; cx.fillRect(x * scale, y * scale, scale, scale); }
        }
    }
    return c;
}

export const sprMeat = buildSprite([
    "..........",
    "...XXXX...",
    "..XFFFFX..",
    ".XFRFFFFX.",
    ".XFFFRFFX.",
    ".XFFFFFFX.",
    "..XFFFFXX.",
    "...XXXXWX.",
    "......XWWX",
    ".......XX."
]);

export const sprBandage = buildSprite([
    "..........",
    "..XXXXXX..",
    ".XWWWWWWX.",
    ".XWWRRWWX.",
    ".XWRRRRWX.",
    ".XWWRRWWX.",
    ".XWWWWWWX.",
    "..XXXXXX..",
    "..........",
    ".........."
]);

export const sprEssence = buildSprite([
    "....XX....",
    "...XKKX...",
    "..XKVVKX..",
    ".XKVLVVKX.",
    ".XKVVLVKX.",
    "XKVVVVVVKX",
    "XKVVVVVVKX",
    ".XKVVVVKX.",
    "..XKKKKX..",
    "...XXXX..."
]);
