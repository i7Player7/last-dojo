/* =========================================
   LAST DOJO V2 - ASSETS & AUDIO (assets.js)
========================================= */

// =========================================
// 1. AUDIO ENGINE
// =========================================
export class AudioEngine {
    constructor() { 
        this.ctx = null; 
        this.muted = false; 
    }
    
    init() { 
        try { 
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); 
        } catch(e) {} 
    }
    
    playTone(freq, type, duration, vol=0.1, slideFreq=null) {
        if (!this.ctx || this.muted) return;
        try {
            let osc = this.ctx.createOscillator(); 
            let gain = this.ctx.createGain();
            osc.type = type; 
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime); 
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            osc.connect(gain); 
            gain.connect(this.ctx.destination); 
            osc.start(); 
            osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    }
    
    playNoise(duration, vol=0.1) {
        if (!this.ctx || this.muted) return;
        try {
            let bufferSize = this.ctx.sampleRate * duration; 
            let buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            let data = buffer.getChannelData(0); 
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            let noise = this.ctx.createBufferSource(); 
            noise.buffer = buffer; 
            let gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol, this.ctx.currentTime); 
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            noise.connect(gain); 
            gain.connect(this.ctx.destination); 
            noise.start();
        } catch(e) {}
    }

    // --- Sound Effects ---
    sfxSwing() { this.playTone(150, 'sine', 0.2, 0.05, 50); }
    sfxHit() { this.playTone(100, 'square', 0.1, 0.1, 40); }
    sfxParry() { this.playTone(800, 'triangle', 0.3, 0.1); }
    sfxSpit() { this.playTone(400, 'sawtooth', 0.3, 0.05, 100); }
    sfxYeet() { this.playNoise(0.5, 0.3); this.playTone(50, 'square', 0.5, 0.2, 20); }
    sfxExplode() { this.playNoise(0.3, 0.2); }
    sfxLevelUp() { this.playTone(400, 'sine', 0.1, 0.1, 600); setTimeout(() => this.playTone(600, 'sine', 0.3, 0.1, 800), 100); }
    sfxLore() { this.playTone(200, 'sine', 0.5, 0.05); }
    sfxWarlordRoar() { this.playNoise(1.5, 0.5); this.playTone(40, 'sawtooth', 1.5, 0.3, 10); } 
    sfxFrustratedGroan() { this.playNoise(1.0, 0.2); this.playTone(30, 'sawtooth', 1.0, 0.2, 5); }
    sfxVictory() { this.playTone(400, 'sine', 0.2, 0.1, 600); setTimeout(() => this.playTone(600, 'sine', 0.2, 0.1, 800), 200); setTimeout(() => this.playTone(800, 'sine', 0.6, 0.1, 1200), 400); }
}

// Export a single, global instance of the audio engine
export const sfx = new AudioEngine();


// =========================================
// 2. PROCEDURAL PIXEL ART GENERATOR
// =========================================
export const pal = { 
    '.': null, 'X': '#111111', 'S': '#ffcc99', 'W': '#eeeeee', 'R': '#d32f2f', 
    'G': '#4caf50', 'M': '#6a1b9a', 'D': '#333333', 'B': '#5d4037', 'L': '#8d6e63', 
    'T': '#1b5e20', 'F': '#ef5350', 'P': '#ffffff', 'Y': '#cddc39', 'C': '#9e9e9e', 
    'U': '#ffeb3b', 'O': '#f57c00', 'E': '#e0e0e0', 'N': '#757575' 
};

export function buildSprite(art, scale = 4) {
    let c = document.createElement('canvas'); 
    c.width = art[0].length * scale; 
    c.height = art.length * scale; 
    let cx = c.getContext('2d');
    
    for (let y = 0; y < art.length; y++) {
        for (let x = 0; x < art[y].length; x++) {
            if (pal[art[y][x]]) { 
                cx.fillStyle = pal[art[y][x]]; 
                cx.fillRect(x * scale, y * scale, scale, scale); 
            }
        }
    }
    return c;
}

// =========================================
// 3. STATIC SPRITES
// =========================================
export const sprDummy = buildSprite(["...XXXX...","..XLLLLX..","..XLLLLX..","..XLLLLX..","..XLLLLX..","..XLLLLX...","...XXXX...","....XX....","...XXXX...","..XXXXXX.."]);
export const sprBox = buildSprite(["..........","..........","..XXXXXX..",".XLLLLLLX.",".XLBBLBBX.",".XLLLLLLX.",".XLBBLBBX.",".XLLLLLLX.","..XXXXXX..",".........."]);
export const sprMeat = buildSprite(["..........","..........","..........","...XXXX...","..XFFFFX..",".XWFFFFWX.",".XWFFFFWX.","..XFFFFX...","...XXXX...",".........."], 3); 
export const sprBandage = buildSprite(["..........","..XXXXXX..",".XPPPPPPX.",".XPPRRPPX.",".XPRRRRPX.",".XPPRRPPX.",".XPPPPPPX.","..XXXXXX..","..........",".........."], 3);
export const sprDojo = buildSprite(["......XXX......","....XXXXXXX....","..XXRRRRRRRXX..",".XRRRRRRRRRRRX.","XRRRRRRRRRRRRRX","..XWWXXXXXWWX..","..XWWXXXXXWWX..","..XBBXXXXXBBX..","..XBBXXXXXBBX..","XXXXBXXXXXBXXXX"]);
export const sprSun = buildSprite(["..OOOO..",".OUUUUO.","OUUUUUUO","OUUUUUUO","OUUUUUUO","OUUUUUUO",".OUUUUO.","..OOOO.."], 3);
export const sprMoon = buildSprite(["...EEEE.","..EEENNN",".EEEN...",".EEN....",".EEN....",".EEEN...","..EEENNN","...EEEE."], 3);
export const sprBloodMoon = buildSprite(["...FFFF.","..FFFRRR",".FFFR...","..FFR....","..FFR....",".FFFR...","..FFFRRR","...FFFF."], 3);