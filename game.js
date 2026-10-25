/* =========================================
   LAST DOJO V3 - CORE ENGINE (game.js)
========================================= */
import { sfx } from './assets.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import {
    W, H, WORLD_W, FEET_MIN, FEET_MAX, FOREST_END, SANCT_START,
    DOJO, DOJO_DOOR, DOJO_HP, DOJO_HIT_EVERY, SHRINE, SEAL, SURVIVAL_DAYS, BLOOD_MOON_EVERY, DAY_LEN, NIGHT_LEN,
    PLAYER, KEGARE, ENEMY, BOSS_NAMES, TECHNIQUES, HINTS, EPILOGUE,
    POT, MEAT, MEAL, MEDITATE, TECH_GROUPS
} from './config.js';
import { Prologue } from './prologue.js';
import { Player, Enemy, Corpse, Loot, Projectile, Particle, FloatText, Decal, Pool, Cache, Slash, Ring } from './entities.js';
import { Renderer } from './render.js';

const canvas = document.getElementById('gameCanvas');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const rectHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const fx = e => e.x + e.w / 2;
const fy = e => e.y + e.h;

// Things nothing can walk through
const POND = { x: 2370, y: 512, w: 200, h: 70 };
const SHRINE_BASE = { x: SHRINE.x - 34, y: SHRINE.y - 14, w: 68, h: 16 };
const SEAL_BASE = { x: SEAL.x - 30, y: SEAL.y - 12, w: 60, h: 14 };
const POT_BASE = { x: POT.x - 22, y: POT.y - 10, w: 44, h: 12 };
// The Dojo backs onto the estate wall, so nothing can slip behind it (its roof would hide them).
// It reaches the top of the screen so anything caught inside is pushed sideways or forward, never up.
const DOJO_BLOCK = { x: DOJO.x, y: 0, w: DOJO.w, h: DOJO.y + DOJO.h };
const OBSTACLES = [DOJO_BLOCK, POND, SHRINE_BASE, SEAL_BASE, POT_BASE];
// The horde can only break the Dojo from in front of its doors.
const DOOR_ZONE = { x: DOJO.x - 12, y: DOJO.y + DOJO.h - 4, w: DOJO.w + 24, h: 40 };

class Game {
    constructor() {
        this.state = 'START';
        this.mode = 'SURVIVAL';
        this.paused = false;
        this.frames = 0;
        this.camera = { x: DOJO_DOOR.x - W / 2 };
        this.dojo = { hp: DOJO_HP, maxHp: DOJO_HP };
        this.ParticleClass = Particle;
        this.script = null;
        this.hintsSeen = new Set(JSON.parse(localStorage.getItem('lastDojoHints') || '[]'));

        this.renderer = new Renderer(canvas, this);
        this.generateTrees();
        this.renderer.buildBackground(this.trees);
        this.resetWorld();
        this.setupMenuScene();
        this.setupEvents();
        UI.init();
    }

    // =========================================
    // SETUP
    // =========================================
    get ec() { return this.mode === 'ENDLESS' ? UI.endlessConfig : null; }
    cfg(key, def) { return this.ec ? this.ec[key] : def; }
    get dayLen() { return Math.round(DAY_LEN * this.cfg('phaseLen', 1)); }
    get nightLen() { return Math.round(NIGHT_LEN * this.cfg('phaseLen', 1)); }
    get bmFreq() { return this.ec ? Math.max(1, Math.round(this.ec.bmFreq)) : BLOOD_MOON_EVERY; }
    isTouch() { return Input.isTouchDevice; }
    showPlayer() { return ['PLAYING', 'SUNRISE', 'CHOICE', 'DYING'].includes(this.state); }

    generateTrees() {
        let s = 99;
        const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        this.trees = [];
        const ok = (x, y, d) => this.trees.every(t => Math.hypot(t.x - x, (t.y - y) * 1.6) > d);
        // a back row along the top edge frames the forest without hiding the fight
        for (let x = 24; x < FOREST_END - 10; x += 62 + R() * 34) {
            this.trees.push({ x, y: FEET_MIN + 2 + R() * 12, s: 0.8 + R() * 0.25, kind: R() < 0.35 ? 'cedar' : 'oak', v: (R() * 3) | 0, solid: true });
        }
        // a handful of scattered trunks for boars to crash into
        let tries = 0, placed = 0;
        while (placed < 11 && tries++ < 3000) {
            const x = 60 + R() * (FOREST_END - 120), y = FEET_MIN + 90 + R() * (FEET_MAX - FEET_MIN - 100);
            if (x > 560 && Math.abs(y - 352) < 60) continue; // keep the path to the courtyard open
            if (!ok(x, y, 165)) continue;
            this.trees.push({ x, y, s: 0.7 + R() * 0.18, kind: R() < 0.3 ? 'cedar' : 'oak', v: (R() * 3) | 0, solid: true });
            placed++;
        }
        // estate and sanctuary trees
        const deco = [
            { x: 1060, y: 160, kind: 'maple' }, { x: 1580, y: 158, kind: 'oak' }, { x: 1800, y: 165, kind: 'maple' },
            { x: 960, y: 560, kind: 'oak' }, { x: 1750, y: 560, kind: 'maple' },
            { x: 1985, y: 168, kind: 'sakura' }, { x: 2140, y: 160, kind: 'sakura' }, { x: 2400, y: 165, kind: 'sakura' },
            { x: 2560, y: 230, kind: 'sakura' }, { x: 2010, y: 560, kind: 'sakura' }, { x: 2230, y: 566, kind: 'sakura' }
        ];
        deco.forEach((d, i) => this.trees.push({ ...d, s: 1.05, v: i, solid: false }));
        this.trees.sort((a, b) => a.y - b.y);
    }

    resetWorld() {
        this.player = new Player(DOJO_DOOR.x - 20, DOJO_DOOR.y + 10);
        this.enemies = []; this.loot = []; this.projectiles = []; this.corpses = [];
        this.particles = []; this.texts = []; this.decals = []; this.pools = []; this.effects = []; this.caches = [];
        this.combo = 0; this.comboTimer = 0; this.kills = 0;
        this.shake = 0; this.hitStop = 0; this.dmgFlash = 0; this.cureFlash = 0; this.surgeFlash = 0; this.shrineGlow = 0;
        this.sleepFade = 0; this.pendingChoice = 0; this.sanctFrac = 0;
        this.announce = { text: '', sub: '', timer: 0, max: 1, blood: false };
        this.hintQueue = []; this.hintText = ''; this.hintTimer = 0;
        this.prompt = null;
        this.isDay = true; this.isSiege = false; this.peaceful = false;
        this.dayCount = 1; this.timeTimer = DAY_LEN; this.phaseLen = DAY_LEN;
        this.stats = { eats: 0 };
        this.lastVesselDay = 0;
        this.pot = 0;              // meat in tonight's meal
        this.extraTaken = 0;       // extra techniques bought in meditation this run (raises the price)
        this.dawn = null;          // the open dawn meditation, if any
        this.sleepTarget = 'dusk';
        // cinematic and prologue controls (all off during normal play)
        this.inputLocked = false; this.clockFrozen = false; this.kegareLocked = false;
        this.noSiegeBoost = false; this.forceBlood = false; this.hideKegare = false;
        this.camTarget = null; this.zoom = 1;
        this.letterbox = 0; this.letterboxTarget = 0;
        this.subtitle = null; this.objective = null; this.objectiveFlash = 0;
        this.titleOverride = null; this.titleCard = null;
        this.sliver = null; this.seals = [];
        this.sealStone = { crack: 1, broken: true, pulse: 0 }; // broken ever since the prologue night
    }

    setupMenuScene() {
        this.resetWorld();
        this.isDay = false;
        this.phaseLen = NIGHT_LEN; this.timeTimer = NIGHT_LEN * 0.5;
        this.dojo.hp = this.dojo.maxHp = DOJO_HP;
        this.camera.x = DOJO_DOOR.x - W / 2 + 120;
    }

    setupEvents() {
        document.addEventListener('startGame', e => this.startRun(e.detail.mode));
        document.addEventListener('startEpilogue', () => this.startEpilogue());
        document.addEventListener('startPrologue', () => this.startPrologue(false));
        document.addEventListener('skipPrologue', () => this.skipPrologue());
        document.addEventListener('restartGame', () => this.startRun(this.mode));
        document.addEventListener('quitToMenu', () => {
            if (this.paused || ['GAMEOVER', 'VICTORY'].includes(this.state)) this.toMenu();
        });
        document.addEventListener('togglePause', () => this.togglePause());
        document.addEventListener('requestCloseSettings', () => {
            if (this.paused) UI.showPause(this.player, !!this.script); else UI.showMainMenu();
        });
        const confirm = () => {
            if (this.script && this.script.cutscene && !this.paused) this.script.skip();
            else if (this.state === 'EPILOGUE') this.advanceEpilogue();
            else if (this.state === 'GAMEOVER' && performance.now() > this.readyAt) this.startRun(this.mode);
        };
        document.addEventListener('gameConfirm', confirm);
        document.addEventListener('canvasClick', confirm);
    }

    // =========================================
    // RUN FLOW
    // =========================================
    startRun(mode, carry = null) {
        sfx.init();
        if (mode === 'SURVIVAL' && !localStorage.getItem('lastDojoPrologueDone')) { this.startPrologue(true); return; }
        this.mode = mode;
        this.paused = false;
        this.script = null;
        this.resetWorld();
        UI.hideAllMenus();
        UI.showTouchUI();
        Input.resetMovement(); Input.clearPresses();
        localStorage.setItem('lastDojoPlayed', 'true');

        this.dojo.maxHp = this.dojo.hp = this.ec ? this.ec.dojoHp : DOJO_HP;
        this.phaseLen = this.timeTimer = this.dayLen;
        this.camera.x = clamp(fx(this.player) - W / 2, 0, WORLD_W - W);
        this.spawnDayContent();
        if (carry) {
            // the first run continues straight from the prologue
            this.player.food = carry.food; this.player.essence = Math.min(2, carry.essence);
            this.player.tech = { ...carry.tech };
            // the prologue's hunt already used up the early morning
            this.timeTimer = Math.round(this.dayLen * 0.75);
        }
        this.beginPlay();
    }

    // ---------- prologue ----------
    startPrologue(thenRun) {
        sfx.init();
        this.mode = 'SURVIVAL';
        this.paused = false;
        this.resetWorld();
        UI.hideAllMenus();
        Input.resetMovement(); Input.clearPresses();
        localStorage.setItem('lastDojoPlayed', 'true');
        this.dojo.maxHp = this.dojo.hp = DOJO_HP;
        this.state = 'PLAYING';
        this.script = new Prologue(this, thenRun);
    }

    endPrologue(thenRun, skipped) {
        localStorage.setItem('lastDojoPrologueDone', 'true');
        // these lessons were taught by doing, so skip their text tips
        for (const k of ['boar', 'cache', 'surge', 'sanct']) this.hintsSeen.add(k);
        localStorage.setItem('lastDojoHints', JSON.stringify([...this.hintsSeen]));
        const p = this.player;
        const carry = skipped ? null : { food: p.food, essence: p.essence, tech: { ...p.tech } };
        this.script = null;
        if (thenRun) this.startRun('SURVIVAL', carry);
        else this.toMenu();
    }

    skipPrologue() {
        if (!this.script) return;
        const thenRun = this.script.thenRun;
        this.paused = false;
        UI.hideAllMenus();
        this.endPrologue(thenRun, true);
    }

    beginPlay() {
        this.state = 'PLAYING';
        UI.showTouchUI();
        this.setAnnounce(`Day ${this.dayCount}`, 'Hunt by day. Fight by night.');
        this.hint('start');
        sfx.sfxBell();
    }

    startEpilogue() {
        sfx.init(); sfx.sfxVictory();
        UI.hideAllMenus();
        this.setupMenuScene();
        this.state = 'EPILOGUE'; this.epiIdx = 0; this.epiTimer = 220;
    }
    advanceEpilogue() {
        this.epiIdx++; this.epiTimer = 220;
        if (this.epiIdx >= EPILOGUE.length) this.toMenu();
    }

    toMenu() {
        this.paused = false;
        this.script = null;
        this.state = 'START';
        this.setupMenuScene();
        UI.showMainMenu();
    }

    togglePause() {
        if (this.state === 'EPILOGUE') { this.toMenu(); return; }
        if (!['PLAYING', 'SUNRISE'].includes(this.state)) return;
        this.paused = !this.paused;
        if (this.paused) {
            Input.resetMovement();
            UI.showPause(this.player, !!this.script);
        } else {
            UI.hideAllMenus();
            if (!this.inputLocked) UI.showTouchUI();
            Input.clearPresses();
        }
    }

    saveScore() {
        const hs = parseInt(localStorage.getItem('lastDojoHighScore') || '0');
        if (this.dayCount > hs) localStorage.setItem('lastDojoHighScore', String(this.dayCount));
    }

    // =========================================
    // HELPERS: text, effects, hints
    // =========================================
    text(x, y, t, col, size = 16) { this.texts.push(new FloatText(x, y, t, col, size)); }
    burst(x, y, col, n, o = {}) { for (let i = 0; i < n; i++) this.particles.push(new Particle(x, y, col, o)); }
    setAnnounce(text, sub = '', blood = false, dur = 200) { this.announce = { text, sub, timer: dur, max: dur, blood }; }

    keyLabel(action) {
        if (Input.isTouchDevice) return { dash: 'DASH', unleash: 'RUSH', eat: 'EAT', interact: 'ACT', punch: 'PUNCH', spin: 'SPIN' }[action] || action;
        return Input.getDisplayKey(Input.userKeys[action]);
    }
    hint(key) {
        if (this.script) return;
        if (this.hintsSeen.has(key) || this.hintQueue.includes(key) || this.hintText === HINTS[key]) return;
        this.hintQueue.push(key);
        if (this.hintQueue.length > 2) this.hintQueue.shift(); // newest tips are the relevant ones
    }
    updateHints() {
        if (this.hintTimer > 0) { this.hintTimer--; return; }
        // drop hints that no longer fit the moment (e.g. a forest tip queued just before nightfall)
        const dayOnly = ['start', 'boar', 'cache', 'rest'], nightOnly = ['dusk', 'bloodmoon', 'essence'];
        this.hintQueue = this.hintQueue.filter(k => !(dayOnly.includes(k) && !this.isDay) && !(nightOnly.includes(k) && this.isDay && k !== 'essence'));
        if (this.hintQueue.includes('bloodmoon')) this.hintQueue = this.hintQueue.filter(k => k !== 'dusk');
        if (this.hintQueue.length && this.state === 'PLAYING' && this.announce.timer <= 0) {
            const key = this.hintQueue.shift();
            this.hintsSeen.add(key);
            localStorage.setItem('lastDojoHints', JSON.stringify([...this.hintsSeen]));
            this.hintText = HINTS[key].replace(/\[(\w+)\]/g, (_, a) => `[${this.keyLabel(a.toLowerCase())}]`);
            this.hintTimer = 420;
        }
    }

    // =========================================
    // MAIN UPDATE
    // =========================================
    update() {
        this.frames++;
        this.renderer.updateAmbient();

        if (this.state === 'EPILOGUE') { if (--this.epiTimer <= 0) this.advanceEpilogue(); return; }
        if (this.state === 'START') { this.camera.x = DOJO_DOOR.x - W / 2 + 120 + Math.sin(this.frames * 0.002) * 260; this.updateEffects(); return; }
        if (this.state === 'DYING') {
            this.updateEffects();
            if (--this.deathTimer <= 0) this.finishGameOver();
            return;
        }
        if (!['PLAYING', 'SUNRISE'].includes(this.state)) return;

        if (this.sleepFade > 0) {
            this.sleepFade--;
            if (this.sleepFade === 40) { if (this.sleepTarget === 'dawn') this.endNight(); else this.startNight(); }
            return;
        }
        if (this.hitStop > 0) { this.hitStop--; this.updateCinema(); return; }

        if (this.script) {
            this.script.update();
            if (!this.script || this.state !== 'PLAYING') return; // the prologue may have just ended
        }
        this.updateTimers();
        this.updateCinema();
        this.updatePhase();
        if (this.state === 'CHOICE') return;
        this.updatePlayer();
        this.updateProjectiles();
        this.updateEnemies();
        this.updateLoot();
        this.updatePools();
        this.updateEffects();
        this.updateCamera();
        this.updateHints();
        this.checkEnd();
    }

    updateTimers() {
        if (this.comboTimer > 0 && --this.comboTimer <= 0) this.combo = 0;
        if (this.shake > 0) { this.shake *= 0.88; if (this.shake < 0.4) this.shake = 0; }
        for (const k of ['dmgFlash', 'cureFlash', 'surgeFlash', 'shrineGlow']) if (this[k] > 0) this[k]--;
        if (this.announce.timer > 0) this.announce.timer--;
        for (const k of this.caches) if (k.hitTimer > 0) k.hitTimer--;
    }

    updateCamera() {
        const p = this.player;
        if (this.camTarget) {
            this.camera.x += (this.camTarget.x - this.camera.x) * 0.06;
            this.zoom += (this.camTarget.zoom - this.zoom) * 0.05;
        } else {
            const target = fx(p) - W / 2 + (p.facingRight ? 60 : -60);
            this.camera.x += (target - this.camera.x) * 0.09;
            this.zoom += (1 - this.zoom) * 0.08;
        }
        this.camera.x = clamp(this.camera.x, 0, WORLD_W - W);
    }

    updateCinema() {
        this.letterbox += (this.letterboxTarget - this.letterbox) * 0.12;
        if (this.subtitle && --this.subtitle.timer <= 0) this.subtitle = null;
        if (this.objectiveFlash > 0) this.objectiveFlash--;
        if (this.titleCard && --this.titleCard.timer <= 0) this.titleCard = null;
        if (this.sealStone.pulse > 0) this.sealStone.pulse--;
        if (this.sliver) {
            this.sliver.trail.push({ x: this.sliver.x, y: this.sliver.y });
            if (this.sliver.trail.length > 20) this.sliver.trail.shift();
            if (this.frames % 2 === 0) this.burst(this.sliver.x, this.sliver.y, '#1e0b26', 1, { speed: 1, shape: 'smoke', grav: -0.03, size: 7, life: 30 });
        }
    }

    // =========================================
    // DAY / NIGHT
    // =========================================
    updatePhase() {
        if (this.state === 'SUNRISE') { this.updateSunrise(); return; }

        if (this.clockFrozen) return; // the prologue drives time itself
        if (this.pendingChoice > 0 && --this.pendingChoice === 0) { this.openChoice(); return; }

        this.timeTimer--;
        if (this.isDay) {
            const boars = this.enemies.filter(e => e.type === 'boar' && !e.dead).length;
            if (boars < 2 && Math.random() < 0.003) this.spawnBoar(true);
            if (this.timeTimer === 600) this.text(fx(this.player), this.player.y - 30, 'Dusk is coming', '#ffb36b', 15);
            if (this.timeTimer <= 0) this.startNight();
        } else {
            this.updateNightSpawns();
            if (this.timeTimer === 600 && this.player.essence > 0 && this.state === 'PLAYING') {
                this.text(fx(this.player), this.player.y - 30, 'Dawn is near. Your essence will burn.', '#d6b4f0', 15);
                this.hint('dawnburn');
            }
            if (this.timeTimer <= 0) this.endNight();
        }

        // Kegare creeps on its own; a blood moon makes it stir faster
        const rate = KEGARE.passivePerFrame * Math.pow(0.6, this.player.t('calm')) * (this.isSiege && !this.peaceful ? 2 : 1);
        this.addInfection(rate, 'passive');
    }

    startNight() {
        this.isDay = false;
        this.phaseLen = this.timeTimer = this.nightLen;
        this.eatMeal();
        for (const e of this.enemies) {
            if (e.type === 'boar') e.state = 'flee';
            if (e.shade) e.shade = false;
        }
        const bloodMoon = this.dayCount % this.bmFreq === 0;
        if (bloodMoon) {
            this.isSiege = true;
            this.dojo.hp = this.dojo.maxHp;
            const bosses = this.pickBosses();
            const subs = { alpha: 'The Alpha awakens.', brood: 'The Broodmother rises.', warlord: 'Magatsuhi takes a body.' };
            let sub = subs[bosses[0]];
            if (!this.ec && this.dayCount >= SURVIVAL_DAYS) sub = '"Fine. I will tear it down myself."';
            this.setAnnounce('Blood Moon', sub, true, 260);
            bosses.forEach((b, i) => this.spawnBoss(b, i));
            sfx.sfxWarlordRoar(); this.shake = 18;
            this.hint('bloodmoon');
        } else {
            this.setAnnounce(`Night ${this.dayCount}`, 'The dead are rising.');
            sfx.sfxBell();
            this.hint('dusk');
        }
    }

    endNight() {
        if (!this.ec && this.dayCount >= SURVIVAL_DAYS) { this.triggerSunrise(); return; }
        this.dayCount++;
        this.isDay = true; this.isSiege = false; this.peaceful = false;
        this.phaseLen = this.timeTimer = this.dayLen;
        this.setAnnounce(`Day ${this.dayCount}`, 'The dead burn in the sunlight.');
        sfx.sfxBell();
        this.endMeal();
        // the dead caught in the forest hide under the canopy; the rest burn
        let shades = this.enemies.filter(e => e.shade && !e.dead).length, hid = 0;
        for (const e of this.enemies) {
            if (e.type === 'boar' || e.dead) continue;
            const canHide = !e.isBoss && ['walker', 'runner', 'brute'].includes(e.type) && e.spawnTimer <= 0;
            if (canHide && fx(e) < FOREST_END - 30 && shades < 8) {
                e.shade = true; e.anchorX = fx(e); e.anchorY = fy(e);
                e.aggroTimer = 0; e.grudge = null; e.attackWind = 0;
                shades++; hid++;
            } else e.burning = true;
        }
        if (hid) this.hint('forestdawn');
        this.projectiles = [];
        this.pools = this.pools.filter(p => p.kind === 'lava');
        if (this.ec && this.ec.lavaMode) {
            let x, y, n = 0;
            do { x = 60 + Math.random() * (WORLD_W - 120); y = FEET_MIN + 20 + Math.random() * (FEET_MAX - FEET_MIN - 40); }
            while (dist(x, y, DOJO_DOOR.x, DOJO_DOOR.y) < 160 && ++n < 20);
            this.pools.push(new Pool(x, y, 'lava', 1));
            const lava = this.pools.filter(p => p.kind === 'lava');
            if (lava.length > 30) this.pools.splice(this.pools.indexOf(lava[0]), 1);
        }
        if (this.ec && this.ec.dojoRegen) this.dojo.hp = Math.min(this.dojo.maxHp, this.dojo.hp + this.dojo.maxHp * 0.25);
        this.spawnDayContent();
        this.pendingChoice = 100;
    }

    triggerSunrise() {
        this.state = 'SUNRISE';
        this.sunriseTimer = 300;
        this.isDay = true;
        this.setAnnounce('Sunrise', "Magatsuhi's vessel burns.", false, 280);
        for (const e of this.enemies) if (e.type !== 'boar') e.burning = true;
        localStorage.setItem('lastDojoEndlessUnlocked', 'true');
        localStorage.setItem('lastDojoEpilogueUnlocked', 'true');
        sfx.sfxBell();
    }

    updateSunrise() {
        this.sunriseTimer--;
        for (const e of this.enemies) {
            if (e.type !== 'warlord' || e.dead) continue;
            e.burning = true;
            if (this.sunriseTimer > 50 && this.sunriseTimer % 15 === 0) {
                this.shake = 8; sfx.sfxExplode();
                this.burst(e.x + Math.random() * e.w, e.y + Math.random() * e.h, '#ff9900', 30, { speed: 6 });
            } else if (this.sunriseTimer === 50) {
                e.dead = true;
                this.burst(fx(e), e.y + e.h / 2, '#ff9900', 120, { speed: 9 });
                this.burst(fx(e), e.y + e.h / 2, '#2a2a2a', 60, { speed: 4, shape: 'smoke', grav: -0.05, size: 8 });
                this.shake = 30; sfx.sfxExplode();
            }
        }
        if (this.sunriseTimer <= 0) {
            this.state = 'VICTORY';
            this.saveScore();
            sfx.sfxVictory();
            UI.showVictory(this.kills, Object.values(this.player.tech).reduce((a, b) => a + b, 0));
        }
    }

    // ---------- dawn technique choice ----------
    // One card from each group (attack, survival, utility); extra cards come from anywhere.
    rollTechniques(n, exclude = []) {
        const p = this.player;
        const avail = TECHNIQUES.filter(t => p.t(t.id) < t.max && !exclude.includes(t.id));
        const pick = list => list[Math.floor(Math.random() * list.length)];
        const out = [];
        for (const g of TECH_GROUPS) {
            if (out.length >= n) break;
            const pool = avail.filter(t => t.group === g);
            if (pool.length) out.push(pick(pool));
        }
        while (out.length < n) {
            const pool = avail.filter(t => !out.includes(t));
            if (!pool.length) break;
            out.push(pick(pool));
        }
        return out;
    }
    meditateCosts() {
        return { reroll: MEDITATE.reroll, fourth: MEDITATE.fourth, extra: MEDITATE.extraBase + MEDITATE.extraStep * this.extraTaken };
    }
    openChoice(custom = null) {
        const opts = custom || this.rollTechniques(3);
        if (!opts.length) { this.burnEssence(); return; }
        // the prologue's first dawn is a fixed choice with no meditation
        this.dawn = { options: opts, picksLeft: 1, fourthUsed: false, shop: !custom && !this.script, picked: 0 };
        this.announce.timer = 0; // don't let the "Day N" banner show through the meditation screen
        this.state = 'CHOICE';
        Input.resetMovement();
        UI.hideTouchUI();
        this.showDawn();
    }
    showDawn() {
        UI.showChoice(this.dayCount, this.dawn, this.player, this.meditateCosts(), {
            pick: id => this.pickTechnique(id),
            act: a => this.meditate(a)
        });
    }
    meditate(action) {
        const p = this.player, d = this.dawn;
        if (!d || !d.shop) return;
        const c = this.meditateCosts();
        if (action === 'reroll' && p.essence >= c.reroll) {
            // a reroll shows new cards whenever enough techniques remain
            let fresh = this.rollTechniques(d.options.length, d.options.map(t => t.id));
            if (fresh.length < d.options.length) fresh = this.rollTechniques(d.options.length);
            if (!fresh.length) return;
            p.essence -= c.reroll; d.options = fresh;
        } else if (action === 'fourth' && !d.fourthUsed && p.essence >= c.fourth) {
            const extra = this.rollTechniques(1, d.options.map(t => t.id));
            if (!extra.length) return;
            p.essence -= c.fourth; d.options = [...d.options, ...extra]; d.fourthUsed = true;
        } else if (action === 'extra' && p.essence >= c.extra) {
            p.essence -= c.extra; d.picksLeft++; this.extraTaken++;
        } else { sfx.sfxDenied(); return; }
        sfx.sfxEssence();
        this.showDawn();
    }
    pickTechnique(id) {
        const p = this.player, d = this.dawn;
        p.tech[id] = p.t(id) + 1;
        if (id === 'wind') { p.maxStamina += 25; p.stamina = p.maxStamina; }
        if (id === 'skin') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); }
        const tdef = TECHNIQUES.find(t => t.id === id);
        sfx.sfxLevelUp();
        this.text(fx(p), p.y - 30 - (d ? d.picked * 20 : 0), tdef.name, '#ffd77a', 18);
        this.burst(fx(p), p.y + 20, '#ffd77a', 24, { speed: 5 });
        if (d) {
            d.picked++; d.picksLeft--;
            if (d.picksLeft > 0) {
                const next = this.rollTechniques(d.fourthUsed ? 4 : 3);
                if (next.length) { d.options = next; this.showDawn(); return; }
            }
        }
        this.dawn = null;
        this.burnEssence();
        this.state = 'PLAYING';
        UI.hideAllMenus(); UI.showTouchUI();
        Input.clearPresses();
    }
    burnEssence() {
        const p = this.player;
        if (p.essence <= 0) return;
        this.text(fx(p), p.y - 50, `${p.essence} essence burned away`, '#b89acb', 15);
        for (let i = 0; i < Math.min(30, 6 + p.essence * 2); i++) {
            this.particles.push(new Particle(fx(p) + (Math.random() - 0.5) * 30, p.y + 10, 'rgba(60,30,80,0.7)', { speed: 1, angle: -Math.PI / 2, spread: 1.2, grav: -0.05, shape: 'smoke', size: 6, life: 50 }));
        }
        p.essence = 0;
    }

    // ---------- the meal ----------
    eatMeal() {
        const p = this.player;
        if (this.pot <= 0) return;
        const tier = Math.min(MEAL.maxPot, this.pot);
        this.pot = 0;
        p.mealTier = tier;
        p.mealBonus = MEAL.hp[tier];
        p.maxHp += p.mealBonus; p.hp += p.mealBonus;
        this.text(fx(p), p.y - 44, `${MEAL.names[tier]}: +${p.mealBonus} max HP tonight`, '#ffd77a', 16);
        sfx.sfxEat();
    }
    endMeal() {
        const p = this.player;
        if (!p.mealTier) return;
        p.maxHp -= p.mealBonus;
        p.hp = Math.min(p.hp, p.maxHp);
        p.ghostHp = Math.min(p.ghostHp, p.maxHp);
        p.mealTier = 0; p.mealBonus = 0;
    }

    // =========================================
    // SPAWNING
    // =========================================
    makeEnemy(type, x, y, opts = {}) {
        const base = ENEMY[type];
        const st = { ...base };
        const d = this.dayCount, ec = this.ec;
        if (!base.boss && type !== 'boar') {
            st.hp = Math.round(base.hp * (1 + 0.1 * (d - 1)));
            st.spd = base.spd + Math.min(0.6, 0.035 * (d - 1)) * (type === 'runner' ? 0.5 : 1);
            if (this.isSiege) st.spd += 0.25;
        }
        if (ec) {
            if (base.boss) { st.hp = Math.round(st.hp * ec.bHealth); st.spd *= ec.bSpeed; st.size = Math.round(st.size * ec.bossSize); }
            else if (type !== 'boar') { st.hp = Math.max(1, Math.round(st.hp * ec.zHealth)); st.spd *= ec.zSpeed; st.dmg = Math.max(1, Math.round(st.dmg * ec.zDamage)); }
        }
        if (opts.hpMult) st.hp = Math.max(1, Math.round(st.hp * opts.hpMult));
        const e = new Enemy(type, x, y, st);
        if (type === 'alpha') e.isAlpha = true;
        if (type === 'brood') e.isBrood = true;
        e.state = type === 'boar' ? 'idle' : 'chase';
        this.clampEnemy(e);
        this.enemies.push(e);
        return e;
    }

    spawnDayContent() {
        const n = this.ec ? Math.round(this.ec.crates) : 3;
        const live = this.caches.filter(k => !k.dead).length;
        for (let i = 0; i < n && live + i < 6; i++) {
            let x, y, tries = 0;
            do {
                x = 90 + Math.random() * (FOREST_END - 220);
                y = FEET_MIN + 20 + Math.random() * (FEET_MAX - FEET_MIN - 60) - 34;
            } while (tries++ < 40 && (this.trees.some(t => Math.abs(t.x - (x + 22)) < 50 && Math.abs(t.y - (y + 34)) < 40) ||
                     dist(x + 22, y + 34, fx(this.player), fy(this.player)) < 320));
            const k = new Cache(x, y);
            this.caches.push(k);
            const guards = 2 + Math.floor((this.dayCount - 1) / 4);
            for (let g = 0; g < guards; g++) {
                const a = (g / guards) * Math.PI * 2;
                const e = this.makeEnemy('walker', x + 2 + Math.cos(a) * 60, y - 6 + Math.sin(a) * 35, { hpMult: 0.8 });
                e.shade = true; e.anchorX = x + 22; e.anchorY = y + 34;
                e.facingRight = Math.random() < 0.5;
            }
        }
        for (let i = 0; i < 2 && this.enemies.filter(e => e.type === 'boar' && !e.dead).length < 2; i++) this.spawnBoar(false);
    }

    // Boars only appear well away from the master (and off-screen when asked),
    // and need a moment to notice him, so one can never charge out of nowhere.
    spawnBoar(offscreen) {
        const p = this.player;
        for (let i = 0; i < 40; i++) {
            const x = 60 + Math.random() * (FOREST_END - 160);
            const y = FEET_MIN + 20 + Math.random() * (FEET_MAX - FEET_MIN - 40) - 52;
            if (dist(x + 26, y + 52, fx(p), fy(p)) < 450) continue;
            // prefer off-screen; if the whole forest is in view, allow a distant on-screen spot
            if (offscreen && i < 25 && x + 60 > this.camera.x && x - 10 < this.camera.x + W) continue;
            if (this.trees.some(t => t.solid && Math.abs(t.x - (x + 26)) < 30 && Math.abs(t.y - (y + 52)) < 20)) continue;
            const b = this.makeEnemy('boar', x, y);
            b.anchorX = clamp(x, 120, FOREST_END - 120); b.anchorY = y;
            b.facingRight = Math.random() < 0.5;
            b.calm = 90;
            return b;
        }
        return null; // no safe spot right now; try again later
    }

    pickNightType() {
        const d = this.dayCount;
        const n = t => this.enemies.filter(e => e.type === t && !e.dead).length;
        if (d >= 7 && Math.random() < 0.07 && n('bloater') < 2) return 'bloater';
        if (d >= 3 && Math.random() < Math.min(0.2, 0.06 + 0.01 * d) && n('brute') < 1 + Math.floor(d / 5)) return 'brute';
        if (d >= 4 && Math.random() < 0.12 && n('spitter') < 1 + Math.floor(d / 6)) return 'spitter';
        if (d >= 6 && Math.random() < 0.18) return 'runner';
        return 'walker';
    }

    updateNightSpawns() {
        if (this.peaceful || this.announce.timer > 150 || this.state !== 'PLAYING') return;
        const d = this.dayCount;
        const cap = this.ec ? this.ec.maxZ : (this.isSiege ? 18 : Math.min(6 + Math.floor(d * 1.5), 26));
        const active = this.enemies.filter(e => !e.dead && e.type !== 'boar' && !e.isBoss && !e.burning).length;
        let rate = this.isSiege ? 0.05 : 0.02 + d * 0.003;
        if (this.ec) rate *= this.ec.spawnRate;
        if (active < cap && Math.random() < rate) this.spawnNightZombie();
    }

    spawnNightZombie() {
        const type = this.pickNightType();
        const size = ENEMY[type].size;
        const p = this.player;
        const maxX = SANCT_START - size - 20;
        const randY = () => FEET_MIN + Math.random() * (FEET_MAX - FEET_MIN) - size;
        let x = 0, y = 0, rise = false, ok = false;
        for (let i = 0; i < 14; i++) {
            const r = Math.random();
            rise = false;
            if (r < 0.35) { x = this.camera.x + 40 + Math.random() * (W - 80); y = randY(); rise = true; }
            else if (r < 0.65) { x = this.camera.x - size - 10; y = randY(); }
            else if (r < 0.8) { x = this.camera.x + W + 10; y = randY(); }
            else { x = this.camera.x + Math.random() * W; y = FEET_MIN - size; rise = true; }
            x = clamp(x, 0, maxX);
            const feet = { x: x + size * 0.28, y: y + size - 10, w: size * 0.44, h: 10 };
            if (OBSTACLES.some(o => rectHit(feet, o))) continue;
            if (dist(x + size / 2, y + size, fx(p), fy(p)) > 240) { ok = true; break; }
        }
        if (!ok) {
            // no safe spot found: walk in from whichever screen edge is farther from the master
            rise = false;
            const leftGap = fx(p) - this.camera.x;
            x = clamp(leftGap > W / 2 ? this.camera.x - size - 10 : this.camera.x + W + 10, 0, maxX);
            y = randY();
            if (dist(x + size / 2, y + size, fx(p), fy(p)) < 240) return; // cornered against the sanctuary: skip this spawn
        }
        const e = this.makeEnemy(type, x, y);
        e.facingRight = x < p.x;
        if (rise) { e.spawnTimer = e.spawnMax = 50; this.burst(fx(e), fy(e), '#3a2a1c', 8, { speed: 3 }); }
    }

    pickBosses() {
        const d = this.dayCount;
        if (!this.ec) return [d >= SURVIVAL_DAYS ? 'warlord' : (Math.floor(d / this.bmFreq) % 2 === 1 ? 'alpha' : 'brood')];
        if (d - (this.lastVesselDay || 0) >= Math.max(1, Math.round(this.ec.bossFreq))) {
            this.lastVesselDay = d;
            const count = Math.min(this.ec.bossCap, 1 + Math.floor((d - this.ec.bossFreq) / 14));
            return Array(Math.max(1, count)).fill('warlord');
        }
        return [Math.floor(d / this.bmFreq) % 2 === 1 ? 'alpha' : 'brood'];
    }

    spawnBoss(type, i = 0) {
        const p = this.player;
        const size = ENEMY[type].size;
        let x = fx(p) - 340 - size / 2 - i * 90;
        if (x < 40) x = fx(p) + 300 + i * 90;
        x = clamp(x, 20, SANCT_START - size - 40);
        const y = clamp(fy(p) - size + (i % 2 ? 60 : -30), FEET_MIN - size + 10, FEET_MAX - size);
        const e = this.makeEnemy(type, x, y);
        e.spawnTimer = e.spawnMax = 120;
        e.specialTimer = 200; e.summonTimer = 420;
        e.facingRight = x < p.x;
        this.decals.push(new Decal(fx(e), fy(e), 'rgba(20,10,10,0.6)', 2.4));
    }

    // =========================================
    // KEGARE
    // =========================================
    kegareMult() { return 1 + KEGARE.dmgPerSkull * Math.floor(this.player.infection); }

    addInfection(amount, source) {
        if (this.ec && this.ec.noKegare) return;
        if (this.state !== 'PLAYING' || this.kegareLocked) return;
        const p = this.player;
        if (source === 'bite') amount *= 1 - 0.3 * p.t('ward');
        const prev = Math.floor(p.infection);
        p.infection = Math.min(3, p.infection + amount);
        if (Math.floor(p.infection) > prev && p.infection < 3) {
            p.surgeWarn = KEGARE.surgeWarnFrames;
            this.text(fx(p), p.y - 34, 'The Kegare rises...', '#d69cff', 16);
            this.hint('surge');
        }
    }

    doSurge() {
        const p = this.player;
        p.staggerTimer = KEGARE.surgeStaggerFrames;
        p.attackType = null; p.attackTimer = 0; p.eatTimer = 0;
        this.surgeFlash = 30; this.shake = 14;
        sfx.sfxSurge();
        this.text(fx(p), p.y - 30, 'Kegare surge', '#d69cff', 20);
        this.effects.push(new Ring(fx(p), fy(p) - 6, 10, 140, 26, '#b05ce0', 6));
        this.burst(fx(p), p.y + 20, '#7b3fa0', 40, { speed: 7 });
        // the curse lashes out at everything nearby too
        for (const e of this.enemies) {
            if (e.dead || e.spawnTimer > 0) continue;
            const d = dist(fx(e), fy(e), fx(p), fy(p));
            if (d < 140) {
                const dir = fx(e) > fx(p) ? 1 : -1;
                this.applyHit(e, 15, dir, 18, { noCombo: true, source: 'surge' });
            }
        }
    }

    // =========================================
    // PLAYER
    // =========================================
    freeStamina() {
        const p = this.player;
        if (p.rushTimer > 0) return true;
        if (this.isSiege && !this.peaceful && !this.isDay && !this.noSiegeBoost) return this.ec ? this.ec.infStamBM : true;
        if (this.ec && this.ec.infStamReg) return true;
        return false;
    }
    siegeBoost() { return this.isSiege && !this.peaceful && !this.isDay && !this.noSiegeBoost; }
    spend(cost) {
        const p = this.player;
        if (this.freeStamina()) return true;
        cost *= this.cfg('stamDrain', 1);
        if (p.stamina < cost) return false;
        p.stamina -= cost; p.staminaDelay = PLAYER.staminaDelay;
        return true;
    }

    updatePlayer() {
        const p = this.player, keys = Input.keys;
        for (const k of ['iFrames', 'hurtTimer', 'hitTimer', 'dashCd', 'spinCd', 'chainTimer', 'rushTimer', 'staminaDelay']) if (p[k] > 0) p[k]--;
        if (p.attackTimer > 0 && --p.attackTimer <= 0) p.attackType = null;
        if (p.eatTimer > 0 && --p.eatTimer === 0) this.finishEating();
        if (p.surgeWarn > 0) {
            if (p.surgeWarn % 30 === 0) sfx.sfxHeartbeat();
            if (--p.surgeWarn === 0) this.doSurge();
        }

        if (p.staggerTimer > 0) {
            p.staggerTimer--; p.isMoving = false;
        } else if (this.inputLocked) {
            p.isMoving = false;
        } else {
            let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
            let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
            const ml = Math.hypot(mx, my);
            if (ml > 0) { mx /= ml; my /= ml; }

            if (Input.consume('dash')) this.tryDash(mx, my);

            if (p.dashTimer > 0) {
                p.dashTimer--;
                p.x += p.dashVx; p.y += p.dashVy;
                p.isMoving = true;
                if (this.frames % 2 === 0) this.burst(fx(p), fy(p), 'rgba(200,190,170,0.6)', 1, { speed: 1, shape: 'smoke', grav: -0.02, size: 5, life: 20 });
                if (p.t('riposte')) {
                    for (const e of this.enemies) {
                        if (e.dead || p.dashHit.has(e) || e.spawnTimer > 0) continue;
                        if (rectHit({ x: p.x + 4, y: p.y, w: 32, h: 40 }, { x: e.x + 6, y: e.y + 4, w: e.w - 12, h: e.h - 4 })) {
                            p.dashHit.add(e);
                            this.applyHit(e, 25 * this.kegareMult(), Math.sign(p.dashVx) || 1, 8, { source: 'dash' });
                        }
                    }
                }
            } else {
                let spd = p.speed * this.cfg('pSpeed', 1);
                if (p.rushTimer > 0) spd *= 1.35;
                if (p.eatTimer > 0) spd *= 0.45;
                if (p.attackType === 'punch') spd *= 0.5;
                else if (p.attackType === 'spin') spd *= 0.7;
                p.x += mx * spd; p.y += my * spd;
                p.isMoving = ml > 0;
                if (p.isMoving) p.walkPhase += 0.28;
                if (mx !== 0 && p.attackType !== 'punch') p.facingRight = mx > 0;
            }

            const canAct = p.attackTimer <= 0 && p.dashTimer <= 0 && p.eatTimer <= 0;
            if (canAct && (keys.spin || Input.mouse.right) && p.spinCd <= 0) this.doSpin();
            else if (canAct && (keys.punch || Input.mouse.left)) this.doPunch();
            if (Input.consume('eat')) this.tryEat();
            if (Input.consume('unleash')) this.tryUnleash();
            if (Input.consume('interact')) this.tryInteract();
        }

        // afterimages while dashing or unleashed
        if ((p.dashTimer > 0 || (p.rushTimer > 0 && p.isMoving)) && this.frames % 3 === 0) p.trail.push({ x: p.x, y: p.y });
        else if (this.frames % 3 === 0 && p.trail.length) p.trail.shift();
        if (p.trail.length > 5) p.trail.shift();

        // knockback
        p.x += p.kvx; p.y += p.kvy; p.kvx *= 0.8; p.kvy *= 0.8;
        p.x = clamp(p.x, 0, WORLD_W - p.w);
        p.y = clamp(p.y, FEET_MIN - p.h, FEET_MAX - p.h);
        for (const o of OBSTACLES) this.pushOut(p, o);

        // stamina
        if (p.staminaDelay <= 0 && (p.attackTimer <= 0 || p.t('flow'))) {
            p.stamina = Math.min(p.maxStamina, p.stamina + PLAYER.staminaRegen * (1 + 0.2 * p.t('wind') + MEAL.regen[p.mealTier || 0]));
        }
        p.ghostHp += (p.hp - p.ghostHp) * 0.05;
        if (p.ghostHp < p.hp) p.ghostHp = p.hp;

        this.updateSanctuary();
        this.updatePrompt();
        if (p.hp < p.maxHp * 0.35 && this.state === 'PLAYING') this.hint('hurt');

        // first-sight hints
        if (this.isDay && p.food > 0 && this.state === 'PLAYING') this.hint('meal');
        if (this.isDay) {
            for (const e of this.enemies) if (e.type === 'boar' && !e.dead && dist(fx(e), fy(e), fx(p), fy(p)) < 320) { this.hint('boar'); break; }
            for (const k of this.caches) if (!k.dead && dist(k.x, k.y, fx(p), fy(p)) < 300) { this.hint('cache'); break; }
        }
    }

    tryDash(mx, my) {
        const p = this.player;
        if (p.dashCd > 0 || p.attackType === 'spin' || p.eatTimer > 0) return;
        if (!this.spend(PLAYER.dashCost)) { this.text(fx(p), p.y - 10, 'No stamina', '#8fb8d9', 13); return; }
        if (mx === 0 && my === 0) mx = p.facingRight ? 1 : -1;
        p.dashVx = mx * PLAYER.dashSpeed; p.dashVy = my * PLAYER.dashSpeed * 0.8;
        p.dashTimer = PLAYER.dashFrames;
        p.iFrames = Math.max(p.iFrames, PLAYER.dashFrames + 4);
        p.dashCd = Math.round(PLAYER.dashCd * Math.pow(0.65, p.t('swift')));
        p.attackType = null; p.attackTimer = 0;
        p.dashHit.clear();
        if (mx !== 0) p.facingRight = mx > 0;
        sfx.sfxDash();
    }

    doPunch() {
        const p = this.player;
        if (!this.spend(PLAYER.punchCost)) return;
        p.chain = p.chainTimer > 0 ? (p.chain + 1) % 3 : 0;
        p.chainTimer = 34;
        p.finisher = p.chain === 2;
        p.attackType = 'punch';
        p.attackMax = p.attackTimer = p.finisher ? 18 : 13;
        const dir = p.facingRight ? 1 : -1;
        const boost = this.siegeBoost();
        const dmg = p.dmg * (1 + 0.2 * p.t('iron')) * this.kegareMult() * (boost ? 2.5 : 1) * (p.finisher ? 1.6 : 1);
        const heavy = p.finisher && p.t('palm');
        const kb = (p.finisher ? 15 : 6) * (heavy ? 1.7 : 1) * (boost ? 1.8 : 1) * this.cfg('knockback', 1);
        const hb = { x: dir > 0 ? p.x + 22 : p.x - 30, y: p.y - 8, w: 48, h: 54 };
        let hits = 0;
        for (const e of this.enemies) {
            if (e.dead || e.spawnTimer > 0) continue;
            if (rectHit(hb, { x: e.x + 6, y: e.y + 4, w: e.w - 12, h: e.h - 4 })) {
                if (this.applyHit(e, dmg, dir, kb, { finisher: p.finisher, stun: heavy ? 70 : 0, source: 'punch' })) hits++;
            }
        }
        for (const k of this.caches) if (!k.dead && rectHit(hb, k)) { this.hitCache(k, 1); hits++; }
        this.effects.push(new Slash(fx(p) + dir * 30, p.y + 13, dir, p.finisher));
        sfx.sfxSwing();
        if (hits > 0) this.hitStop = Math.max(this.hitStop, p.finisher ? 5 : 2);
    }

    doSpin() {
        const p = this.player;
        if (!this.spend(PLAYER.spinCost)) { this.text(fx(p), p.y - 10, 'No stamina', '#8fb8d9', 13); return; }
        p.attackType = 'spin';
        p.attackMax = p.attackTimer = 22;
        p.spinCd = Math.round(PLAYER.spinCd * Math.pow(0.65, p.t('cyclone')) * this.cfg('spinCd', 1));
        const boost = this.siegeBoost();
        const R = PLAYER.spinRadius * (1 + 0.25 * p.t('reach')) * (boost ? 1.5 : 1);
        const dmg = 26 * (1 + 0.1 * p.t('iron')) * this.kegareMult() * (boost ? 2.5 : 1);
        const kb = 16 * (boost ? 1.8 : 1) * this.cfg('knockback', 1);
        const cx = fx(p), cy = p.y + 26;
        let hits = 0;
        for (const e of this.enemies) {
            if (e.dead || e.spawnTimer > 0) continue;
            const dx = fx(e) - cx, dy = (e.y + e.h * 0.6 - cy) / 0.6;
            if (Math.hypot(dx, dy) < R + e.w * 0.35) {
                if (this.applyHit(e, dmg, dx >= 0 ? 1 : -1, kb, { source: 'spin', dirY: Math.sign(dy) * 0.4 })) hits++;
            }
        }
        for (const k of this.caches) {
            if (!k.dead && Math.hypot(k.x + 22 - cx, (k.y + 20 - cy) / 0.6) < R + 20) { this.hitCache(k, 2); hits++; }
        }
        for (const pr of this.projectiles) {
            if (!pr.reflected && Math.hypot(pr.x - cx, (pr.y - cy) / 0.7) < R + 10) {
                pr.vx *= -1.6; pr.vy *= -1.6; pr.reflected = true; pr.life = 200;
                this.text(pr.x, pr.y - 10, 'Parry!', '#7ff3ff', 15);
                sfx.sfxParry(); this.hitStop = Math.max(this.hitStop, 3);
            }
        }
        this.effects.push(new Ring(cx, fy(p) - 4, 12, R, 16, '#ffffff', 5));
        this.burst(cx, cy, '#ffffff', 14, { speed: 6, grav: 0 });
        this.shake = Math.max(this.shake, 6);
        sfx.sfxSpin();
        if (hits > 0) this.hitStop = Math.max(this.hitStop, 3);
    }

    tryEat() {
        const p = this.player;
        if (p.food <= 0) { this.text(fx(p), p.y - 10, 'No meat', '#cfc6b4', 14); sfx.sfxDenied(); return; }
        if (p.hp >= p.maxHp) { this.text(fx(p), p.y - 10, 'Already at full health', '#cfc6b4', 14); return; }
        if (p.eatTimer > 0 || p.attackTimer > 0) return;
        p.eatTimer = 36;
        sfx.sfxEat();
    }
    finishEating() {
        const p = this.player;
        if (p.food <= 0) return;
        p.food--;
        this.stats.eats++;
        const heal = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * 0.3));
        p.hp += heal;
        this.text(fx(p), p.y - 10, `+${heal}`, '#7ddf64', 18);
        this.burst(fx(p), p.y + 10, '#7ddf64', 10, { speed: 2, grav: -0.05 });
    }

    tryUnleash() {
        const p = this.player;
        if (p.essence <= 0) { this.text(fx(p), p.y - 10, 'No essence', '#d6b4f0', 14); sfx.sfxDenied(); return; }
        if (p.infection >= KEGARE.unleashBlockAt && !(this.ec && this.ec.noKegare)) {
            this.text(fx(p), p.y - 10, 'The Kegare would consume you', '#d69cff', 14); sfx.sfxDenied(); return;
        }
        p.essence--;
        p.rushTimer = Math.round(360 * (p.t('frenzy') ? 1.5 : 1));
        p.stamina = p.maxStamina;
        this.addInfection(KEGARE.unleashCost, 'unleash');
        sfx.sfxUnleash();
        this.shake = Math.max(this.shake, 10);
        this.text(fx(p), p.y - 30, 'Unleashed', '#ff4d4d', 22);
        this.effects.push(new Ring(fx(p), fy(p) - 4, 10, 90, 18, '#ff3b3b', 5));
        this.burst(fx(p), p.y + 20, '#ff2a2a', 26, { speed: 6 });
    }

    tryInteract() {
        const p = this.player;
        if (!this.prompt && !this.isDay && !this.script && dist(fx(p), fy(p), DOJO_DOOR.x, DOJO_DOOR.y) < 70) {
            this.text(fx(p), p.y - 10, 'No rest while the dead walk', '#cfc6b4', 14);
            return;
        }
        if (!this.prompt || !this.prompt.action) return;
        if (this.prompt.action === 'cook') {
            p.food--; this.pot++;
            sfx.sfxPickup();
            this.text(POT.x, POT.y - 40, `${this.pot} of ${MEAL.maxPot}: ${MEAL.names[this.pot]}`, '#ffd77a', 15);
            this.burst(POT.x, POT.y - 24, 'rgba(240,240,240,0.6)', 6, { speed: 1, angle: -Math.PI / 2, grav: -0.05, shape: 'smoke', size: 5, life: 40 });
        } else if (this.prompt.action === 'rest' || this.prompt.action === 'restNight') {
            this.sleepTarget = this.prompt.action === 'rest' ? 'dusk' : 'dawn';
            const frac = this.timeTimer / this.phaseLen;
            const heal = Math.round(p.maxHp * (0.25 + 0.5 * frac));
            p.hp = Math.min(p.maxHp, p.hp + heal);
            p.stamina = p.maxStamina;
            p.sanctTime = 0;
            this.text(fx(p), p.y - 10, `Rested +${heal}`, '#7ddf64', 18);
            this.sleepFade = 80;
            this.hint('rest');
        } else if (this.prompt.action === 'offer') {
            const n = Math.min(p.essence, Math.ceil(p.infection / KEGARE.perEssenceCure - 1e-6));
            p.essence -= n;
            p.infection = Math.max(0, p.infection - n * KEGARE.perEssenceCure);
            p.surgeWarn = 0;
            this.cureFlash = 40; this.shrineGlow = 60;
            sfx.sfxOffer();
            this.text(SHRINE.x, SHRINE.y - 100, `${n} essence purified`, '#bff4ff', 18);
            this.effects.push(new Ring(SHRINE.x, SHRINE.y - 4, 20, 160, 40, '#bff4ff', 5));
            for (let i = 0; i < 30; i++) this.particles.push(new Particle(fx(p), p.y + 20, '#bff4ff', { speed: 3, angle: -Math.PI / 2, spread: 2, grav: -0.08, life: 50 }));
        }
    }

    updateSanctuary() {
        const p = this.player;
        const inS = fx(p) > SANCT_START && this.state === 'PLAYING' && !this.inputLocked;
        const grace = KEGARE.sanctGrace[Math.min(2, Math.floor(p.infection))];
        if (inS) {
            this.hint('sanct');
            p.sanctTime++;
            if (p.sanctTime > grace && this.frames % 30 === 0) {
                const d = 3 + 3 * Math.floor(p.infection);
                p.hp = Math.max(0, p.hp - d);
                this.text(fx(p), p.y - 4, `-${d}`, '#ffd77a', 15);
                this.burst(fx(p), p.y + 20, '#ffd77a', 6, { speed: 2, grav: -0.1 });
                this.dmgFlash = Math.max(this.dmgFlash, 10);
            }
        } else {
            p.sanctTime = Math.max(0, p.sanctTime - 3);
        }
        this.sanctFrac = p.sanctTime > 0 ? p.sanctTime / grace : 0;
    }

    updatePrompt() {
        const p = this.player;
        this.prompt = null;
        if (this.state !== 'PLAYING') return;
        const px = fx(p), py = fy(p);
        if (dist(px, py, DOJO_DOOR.x, DOJO_DOOR.y) < 70) {
            if (this.script) return;
            if (this.isDay) this.prompt = { action: 'rest', text: 'Rest until dusk' };
            else if (this.quietNight()) this.prompt = { action: 'restNight', text: 'Rest until dawn' };
            // otherwise no prompt: the doors are where you fight, so keep that space clear
        } else if (dist(px, py, POT.x, POT.y) < 60 && !this.script) {
            if (!this.isDay) this.prompt = p.mealTier ? { action: null, text: `${MEAL.names[p.mealTier]} tonight` } : { action: null, text: 'Cook during the day; you eat at dusk' };
            else if (this.pot >= MEAL.maxPot) this.prompt = { action: null, text: 'The feast is ready for tonight' };
            else if (p.food <= 0) this.prompt = { action: null, text: 'No meat to cook' };
            else this.prompt = { action: 'cook', text: `Add meat to tonight's meal (${this.pot} of ${MEAL.maxPot})` };
        } else if (dist(px, py, SHRINE.x, SHRINE.y + 20) < 90) {
            if (this.isDay) this.prompt = { action: null, text: 'The Gekka Bijin opens only under the moon' };
            else if (p.infection <= 0.001) this.prompt = { action: null, text: 'Your blood is clean' };
            else if (p.essence <= 0) this.prompt = { action: null, text: 'The flower needs Kegare essence' };
            else this.prompt = { action: 'offer', text: `Offer essence (${p.essence})` };
        }
    }

    // You can only sleep through a night once its champion has fallen and the horde has scattered.
    quietNight() {
        return !this.isDay && this.peaceful;
    }

    damagePlayer(dmg, src, keg = 0) {
        const p = this.player;
        if (p.iFrames > 0 || this.inputLocked || !['PLAYING', 'SUNRISE'].includes(this.state)) return false;
        let d = dmg;
        if (p.rushTimer > 0) d *= 0.5;
        if (this.ec && this.ec.ohk) d = 9999;
        d = Math.round(d);
        p.hp = Math.max(0, p.hp - d);
        p.iFrames = 40; p.hurtTimer = 14; p.hitTimer = 4; p.eatTimer = 0;
        if (src) { const dir = fx(p) >= (src.x + (src.w || 0) / 2) ? 1 : -1; p.kvx = dir * 5; }
        this.combo = 0;
        this.dmgFlash = 26;
        this.shake = Math.max(this.shake, d >= 20 ? 12 : 6);
        sfx.sfxHurt();
        this.burst(fx(p), p.y + 18, '#b3261e', 10, { speed: 4 });
        this.text(fx(p), p.y - 4, `-${d}`, '#ff5a4a', 18);
        if (keg > 0) this.addInfection(keg, 'bite');
        return true;
    }

    // =========================================
    // HITS & KILLS
    // =========================================
    applyHit(e, dmg, dirX, kb, o = {}) {
        if (e.dead || e.spawnTimer > 0) return false;
        const p = this.player;
        let d = dmg;
        let note = null;
        if (e.type === 'boar') {
            if (o.source === 'spin' && e.state === 'charge') {
                e.state = 'stunned'; e.stateTimer = 150; e.damagedWhileStunned = false;
                d = 40; note = 'Clash!';
                sfx.sfxParry(); this.hitStop = Math.max(this.hitStop, 6);
                e.x += dirX * 30;
            } else if (e.state !== 'stunned' && e.state !== 'flee') {
                d = dmg * 0.25;
            } else if (e.state === 'stunned') {
                e.damagedWhileStunned = true;
            }
        }
        if (!o.noCombo) { this.combo++; this.comboTimer = 180; }
        const comboMult = this.combo >= 25 ? 1.5 : (this.combo >= 10 ? 1.2 : 1);
        d = Math.max(1, Math.ceil(d * comboMult));
        e.hp -= d; e.hitTimer = 5;

        if (e.type !== 'boar' && !e.isBoss) {
            e.attackWind = 0;
            e.stunTimer = Math.max(e.stunTimer, o.stun || (o.finisher ? 18 : 10));
            if (e.fuse > 0) e.fuse = Math.max(0, e.fuse - 10);
        }
        if (o.stun && !e.isBoss && e.type !== 'boar') note = 'Stunned';
        if (e.type === 'boar' && e.state !== 'stunned' && e.state !== 'flee') kb = 0;
        e.vx += dirX * kb * 0.9 * e.kbRes;
        e.vy += (o.dirY || 0) * kb * 0.9 * e.kbRes;

        if (e.type !== 'boar') { e.aggroTimer = 480; if (e.shade) this.alertGuards(e.anchorX, e.anchorY); }

        const heal = p.t('vamp') + (p.rushTimer > 0 ? 2 : 0) + this.cfg('lifesteal', 0);
        if (heal > 0 && o.source !== 'surge') p.hp = Math.min(p.maxHp, p.hp + heal);

        const bloodCol = { spitter: '#b5c934', brood: '#9c5cc4', bloater: '#9aa64a', boar: '#8b1a1a', warlord: '#ffb74d' }[e.type] || '#7a1010';
        const hx = fx(e), hy = e.y + e.h * 0.4;
        this.burst(hx, hy, bloodCol, o.finisher ? 12 : 7, { speed: 5, angle: dirX > 0 ? 0 : Math.PI, spread: 1.6 });
        this.burst(hx, hy, '#ffffff', 4, { speed: 7, shape: 'spark', grav: 0, life: 8 });
        const col = comboMult >= 1.5 ? '#ff4d4d' : (comboMult >= 1.2 ? '#ffd54f' : '#ffffff');
        this.text(hx, e.y - 4, `${d}`, col, o.finisher ? 20 : 16);
        if (note) this.text(hx, e.y - 24, note, '#7ff3ff', 14);
        this.shake = Math.max(this.shake, o.finisher ? 7 : (e.isBoss ? 5 : 3));
        if (o.finisher) sfx.sfxHeavyHit(); else sfx.sfxHit();

        if (e.hp <= 0) this.killEnemy(e, dirX, o.finisher ? 'yeet' : 'hit');
        return true;
    }

    alertGuards(ax, ay) {
        for (const g of this.enemies) if (g.shade && !g.dead && dist(g.anchorX, g.anchorY, ax, ay) < 10) g.aggroTimer = 600;
    }

    hitCache(k, amount) {
        k.hp -= amount; k.hitTimer = 6;
        sfx.sfxCrate();
        this.burst(k.x + 22, k.y + 16, '#8d6037', 6, { speed: 4 });
        this.alertGuards(k.x + 22, k.y + 34);
        if (k.hp <= 0) {
            k.dead = true;
            const meat = MEAT.cache + this.player.t('butcher');
            for (let i = 0; i < meat; i++) this.dropLoot(k.x + 22, k.y + 34, 'meat');
            if (Math.random() < 0.3) this.dropLoot(k.x + 22, k.y + 34, 'bandage');
            this.burst(k.x + 22, k.y + 16, '#6e4627', 20, { speed: 6 });
            this.text(k.x + 22, k.y - 6, 'Supplies!', '#ffd77a', 16);
            this.shake = Math.max(this.shake, 5);
        }
    }

    dropLoot(x, y, type) {
        const l = new Loot(clamp(x, 20, WORLD_W - 20), clamp(y, FEET_MIN + 4, FEET_MAX - 2), type);
        this.loot.push(l);
        if (this.loot.length > 70) this.loot.shift();
    }

    killEnemy(e, dirX, cause) {
        if (e.dead) return;
        e.dead = true; e.hp = 0;
        const p = this.player;
        const burned = cause === 'burn';

        if (e.type === 'boar') {
            for (let i = 0; i < MEAT.boar + p.t('butcher'); i++) this.dropLoot(fx(e) + (Math.random() - 0.5) * 30, fy(e), 'meat');
            this.text(fx(e), e.y - 10, 'Hunted!', '#ffd77a', 18);
            this.corpses.push(new Corpse(e, dirX || 1));
            this.decals.push(new Decal(fx(e), fy(e), 'rgba(90,10,10,0.55)', 1.3));
            return;
        }
        if (e.isBoss) { this.onBossDeath(e, cause); return; }
        if (!burned) this.kills++;

        if (burned) {
            this.burst(fx(e), e.y + e.h / 2, '#3a3030', 14, { speed: 2, shape: 'smoke', grav: -0.06, size: 6 });
            this.decals.push(new Decal(fx(e), fy(e), 'rgba(20,16,14,0.45)', 1.1, 400));
            return;
        }
        this.corpses.push(new Corpse(e, dirX || 1, cause === 'yeet'));
        const decalCol = e.type === 'spitter' ? 'rgba(150,190,20,0.45)' : (e.type === 'bloater' ? 'rgba(130,140,40,0.5)' : 'rgba(110,0,0,0.5)');
        this.decals.push(new Decal(fx(e), fy(e), decalCol, e.type === 'brute' ? 1.5 : 1));
        if (this.decals.length > 140) this.decals.shift();

        if (e.type === 'bloater') this.explodeBloater(e);

        const ess = Math.min(1, ENEMY[e.type].essence + 0.1 * p.t('scav'));
        if (Math.random() < ess) this.dropLoot(fx(e), fy(e), 'essence');
        let band = this.ec ? this.ec.bandageDrop : 0.07;
        band += 0.04 * p.t('scav');
        if (!this.ec && p.hp < p.maxHp * 0.3) band = Math.max(band, 0.2);
        if (this.combo >= 25) band *= 1.5;
        if (Math.random() < band) this.dropLoot(fx(e) + 10, fy(e), 'bandage');

        if (this.ec && this.ec.explodeZ && e.type !== 'bloater') {
            this.pools.push(new Pool(fx(e), fy(e) - 4, 'acid', 240));
            sfx.sfxExplode();
        }
    }

    explodeBloater(e) {
        const x = fx(e), y = fy(e) - 10;
        sfx.sfxPop(); this.shake = Math.max(this.shake, 12);
        this.effects.push(new Ring(x, y + 6, 10, 100, 22, '#d4e157', 6));
        this.burst(x, y - 10, '#9aa64a', 40, { speed: 8 });
        this.pools.push(new Pool(x, y + 6, 'acid', 300));
        for (const o of this.enemies) {
            if (o === e || o.dead || o.spawnTimer > 0) continue;
            if (dist(fx(o), fy(o), x, y) < 110) this.applyHit(o, 60, fx(o) > x ? 1 : -1, 14, { noCombo: true, source: 'blast' });
        }
        if (dist(fx(this.player), fy(this.player), x, y) < 90) this.damagePlayer(ENEMY.bloater.dmg, e, ENEMY.bloater.keg);
    }

    onBossDeath(e, cause) {
        this.shake = 26; this.hitStop = 14;
        sfx.sfxExplode(); sfx.sfxWarlordRoar();
        this.burst(fx(e), e.y + e.h / 2, '#d32f2f', 80, { speed: 9 });
        this.burst(fx(e), e.y + e.h / 2, '#222', 40, { speed: 4, shape: 'smoke', grav: -0.05, size: 9 });
        this.corpses.push(new Corpse(e, 1));
        this.text(fx(e), e.y - 20, `${BOSS_NAMES[e.type]} falls`, '#ffd77a', 22);

        if (e.type === 'warlord' && !this.ec && this.dayCount >= SURVIVAL_DAYS && this.state === 'PLAYING') {
            this.triggerSunrise();
            return;
        }
        this.dropLoot(fx(e), fy(e), 'core');
        if (this.ec && e.type === 'warlord') for (let i = 0; i < 3; i++) { this.dropLoot(fx(e) + i * 15, fy(e), 'meat'); this.dropLoot(fx(e) - i * 15, fy(e), 'bandage'); }

        const bossesLeft = this.enemies.some(o => o.isBoss && !o.dead);
        if (this.isSiege && !this.isDay && !bossesLeft) {
            this.peaceful = true; this.isSiege = false;
            this.setAnnounce('The horde scatters', 'The rest of the night is quiet.');
            for (const o of this.enemies) {
                if (o.dead || o.type === 'boar') continue;
                o.dead = true;
                this.burst(fx(o), o.y + o.h / 2, '#3a3030', 10, { speed: 2, shape: 'smoke', grav: -0.06, size: 6 });
            }
        }
    }

    // =========================================
    // ENEMIES
    // =========================================
    clampEnemy(e) {
        if (!(e.type === 'boar' && e.state === 'flee')) e.x = clamp(e.x, 0, WORLD_W - e.w);
        if (e.type === 'boar' && e.state !== 'flee') e.x = Math.min(e.x, FOREST_END + 240 - e.w / 2);
        if (e.type !== 'boar' && e.x + e.w > SANCT_START - 6) { e.x = SANCT_START - 6 - e.w; e.vx = Math.min(0, e.vx); }
        e.y = clamp(e.y, FEET_MIN - e.h, FEET_MAX - e.h);
        for (const o of OBSTACLES) this.pushOut(e, o);
    }

    pushOut(e, o) {
        const fb = { x: e.x + e.w * 0.28, y: e.y + e.h - 10, w: e.w * 0.44, h: 10 };
        if (!rectHit(fb, o)) return false;
        const left = fb.x + fb.w - o.x, right = o.x + o.w - fb.x, up = fb.y + fb.h - o.y, down = o.y + o.h - fb.y;
        const m = Math.min(left, right, up, down);
        if (m === left) e.x -= left; else if (m === right) e.x += right; else if (m === up) e.y -= up; else e.y += down;
        return true;
    }

    // standing in front of the doors, where the horde can actually break in
    atDojoDoors(e) {
        const fb = { x: e.x + e.w * 0.2, y: e.y + e.h - 10, w: e.w * 0.6, h: 10 };
        return rectHit(fb, DOOR_ZONE);
    }

    targetFor(e) {
        const p = this.player;
        const pfx = fx(p), pfy = fy(p);
        if (e.grudge && !e.grudge.dead && e.grudgeTimer > 0) return { x: fx(e.grudge), y: fy(e.grudge), grudge: e.grudge };
        if (e.shade && this.isDay) {
            const near = dist(fx(e), fy(e), pfx, pfy) < 170 || e.aggroTimer > 0;
            if (!near) return {
                x: e.anchorX + Math.sin(this.frames * 0.01 + e.seed) * 60,
                y: e.anchorY + Math.cos(this.frames * 0.013 + e.seed) * 30, wander: true
            };
        }
        const drone = this.isSiege && !this.peaceful && !e.isBoss && e.type !== 'spitter' && e.aggroTimer <= 0;
        // siege drones spread along the front of the Dojo, never around the back
        if (drone) return { x: DOJO.x + DOJO.w / 2 + e.dojoOffX * 1.1, y: DOJO.y + DOJO.h + 12 + Math.abs(e.dojoOffY) * 0.4, dojo: true };
        if (pfx > SANCT_START - 10) return { x: SANCT_START - e.w / 2 - 20 - (e.seed % 50), y: pfy + ((e.seed * 7) % 80) - 40, wait: true };
        return { x: pfx, y: pfy, player: true };
    }

    moveToward(e, tx, ty, spd) {
        const dx = tx - fx(e), dy = ty - fy(e), d = Math.hypot(dx, dy);
        if (d < 3) return d;
        e.x += dx / d * spd; e.y += dy / d * spd * 0.9;
        if (Math.abs(dx) > 2) e.facingRight = dx > 0;
        return d;
    }

    updateEnemies() {
        const p = this.player;
        for (const e of this.enemies) {
            if (e.dead) continue;
            if (e.hitTimer > 0) e.hitTimer--;

            if (e.spawnTimer > 0) {
                e.spawnTimer--;
                if (e.spawnTimer % 4 === 0) this.burst(fx(e) + (Math.random() - 0.5) * e.w, fy(e), Math.random() < 0.5 ? '#4a3626' : '#2a2018', 2, { speed: 3, lift: 2 });
                if (e.isBoss && e.spawnTimer % 20 === 0) this.shake = Math.max(this.shake, 6);
                continue;
            }

            if (e.burning) {
                if (!(this.state === 'SUNRISE' && e.type === 'warlord')) {
                    e.hp -= Math.max(1.2, e.maxHp / 90);
                    if (Math.random() < 0.3) this.particles.push(new Particle(fx(e) + (Math.random() - 0.5) * e.w * 0.6, e.y + e.h * 0.3, '#ff9a3c', { speed: 1, angle: -Math.PI / 2, grav: -0.05, life: 25 }));
                    if (e.hp <= 0) this.killEnemy(e, 0, 'burn');
                }
                e.isMoving = false;
                continue;
            }

            e.x += e.vx; e.y += e.vy; e.vx *= 0.82; e.vy *= 0.82;
            if (e.stunTimer > 0) { e.stunTimer--; e.isMoving = false; this.clampEnemy(e); continue; }
            if (e.biteTimer > 0) e.biteTimer--;
            if (e.aggroTimer > 0) e.aggroTimer--;
            if (e.grudgeTimer > 0) e.grudgeTimer--;

            const ox = e.x, oy = e.y;
            switch (e.type) {
                case 'boar': this.aiBoar(e); break;
                case 'spitter': this.aiSpitter(e, false); break;
                case 'brood': this.aiSpitter(e, true); break;
                case 'alpha': this.aiAlpha(e); break;
                case 'warlord': this.aiWarlord(e); break;
                default: this.aiMelee(e);
            }
            // daylight burns shade-dwellers who leave the canopy
            if (e.shade && this.isDay && fx(e) > FOREST_END + 30) e.burning = true;

            this.clampEnemy(e);
            if (e.type !== 'boar') {
                const moved = Math.hypot(e.x - ox, e.y - oy);
                e.isMoving = moved > 0.15;
                e.walkPhase += moved * 0.16;
            }
        }

        // keep crowds from stacking into one sprite
        const live = this.enemies.filter(e => !e.dead && e.spawnTimer <= 0 && !e.burning);
        for (let i = 0; i < live.length; i++) {
            for (let j = i + 1; j < live.length; j++) {
                const a = live[i], b = live[j];
                const dx = fx(b) - fx(a), dy = (fy(b) - fy(a)) * 1.5;
                const min = (a.w + b.w) * 0.3;
                const d = Math.hypot(dx, dy);
                if (d > 0 && d < min) {
                    const push = (min - d) / 2;
                    const wa = b.isBoss ? 1 : (a.isBoss ? 0 : 0.5);
                    a.x -= dx / d * push * wa * 2; b.x += dx / d * push * (1 - wa) * 2;
                    a.y -= dy / d * push * wa; b.y += dy / d * push * (1 - wa);
                }
            }
        }
        // separation can shove someone across a boundary, so re-apply the world rules
        for (const e of live) this.clampEnemy(e);

        this.enemies = this.enemies.filter(e => !e.dead);
    }

    // ---- generic melee zombie (walker, runner, brute, bloater, shade) ----
    aiMelee(e) {
        const p = this.player;
        const t = this.targetFor(e);
        const spd = e.speed;

        if (t.wander) { this.moveToward(e, t.x, t.y, spd * 0.35); return; }

        if (t.dojo) {
            if (this.atDojoDoors(e)) {
                e.facingRight = fx(e) < DOJO.x + DOJO.w / 2;
                if (e.biteTimer <= 0) {
                    e.biteTimer = DOJO_HIT_EVERY;
                    const dd = Math.max(1, Math.round(e.dojoDmg * this.cfg('zDamage', 1)));
                    this.dojo.hp = Math.max(0, this.dojo.hp - (this.ec && this.ec.ohk ? 9999 : dd));
                    this.burst(fx(e) + (e.facingRight ? 12 : -12), e.y + e.h * 0.4, '#8d6037', 5, { speed: 3 });
                    this.text(DOJO.x + DOJO.w / 2, DOJO.y - 120, `-${dd}`, '#ffcc33', 14);
                    this.shake = Math.max(this.shake, 2);
                    if (e.type === 'bloater') this.killEnemy(e, 0, 'fuse');
                }
            } else this.moveToward(e, t.x, t.y, spd);
            return;
        }

        if (t.wait) { this.moveToward(e, t.x, t.y, spd * 0.6); return; }

        const tx = t.x, ty = t.y;
        const reach = e.w * 0.5 + 14;
        const dx = tx - fx(e), dy = ty - fy(e);
        const inRange = Math.abs(dx) < reach && Math.abs(dy) < 18;

        if (e.type === 'bloater') {
            if (inRange && !t.grudge) {
                e.fuse++;
                if (e.fuse === 1) sfx.sfxFrustratedGroan();
                if (e.fuse >= 45) this.killEnemy(e, 0, 'fuse');
            } else {
                e.fuse = Math.max(0, e.fuse - 1);
                this.moveToward(e, tx, ty, spd);
            }
            return;
        }

        if (e.attackWind > 0) {
            if (--e.attackWind === 0) {
                e.biteTimer = 50;
                e.vx += (e.facingRight ? 1 : -1) * 3;
                if (Math.abs(tx - fx(e)) < reach + 10 && Math.abs(ty - fy(e)) < 24) {
                    if (t.grudge) this.grudgeStrike(e, t.grudge);
                    else this.damagePlayer(e.dmg, e, e.keg);
                }
            }
            return;
        }
        if (inRange && e.biteTimer <= 0) { e.attackWind = e.windupMax; e.facingRight = dx > 0; return; }
        // keep a little gap instead of standing inside the player
        if (Math.abs(dx) > reach * 0.6 || Math.abs(dy) > 10) this.moveToward(e, tx - Math.sign(dx) * reach * 0.5, ty, spd);
        else e.facingRight = dx > 0;
    }

    grudgeStrike(e, target) {
        if (e.type === 'brute') {
            target.dead = true;
            this.corpses.push(new Corpse(target, e.facingRight ? 1 : -1, true));
            this.text(fx(e), e.y - 20, 'Yeet!', '#ffd54f', 18);
            this.shake = Math.max(this.shake, 12); sfx.sfxHeavyHit();
        } else {
            target.hp -= 10; target.hitTimer = 5;
            this.text(fx(target), target.y, '-10', '#ffffff', 14);
            if (target.hp <= 0) this.killEnemy(target, e.facingRight ? 1 : -1, 'hit');
        }
        e.grudge = null;
    }

    // ---- spitter & broodmother ----
    aiSpitter(e, brood) {
        const p = this.player;
        const t = this.targetFor(e);
        if (t.wait || t.wander) { this.moveToward(e, t.x, t.y, e.speed * 0.6); return; }
        const pfx = fx(p), pfy = fy(p);
        const d = dist(fx(e), fy(e), pfx, pfy);
        const near = brood ? 230 : 170, far = brood ? 320 : 260;
        if (e.attackWind <= 0) {
            if (d < near) this.moveToward(e, fx(e) - (pfx - fx(e)), fy(e) - (pfy - fy(e)), e.speed);
            else if (d > far) this.moveToward(e, pfx, pfy, e.speed);
            else { e.y += Math.sin(this.frames * 0.03 + e.seed) * e.speed * 0.6; }
            e.facingRight = pfx > fx(e);
        }
        const onScreen = fx(e) > this.camera.x && fx(e) < this.camera.x + W;
        e.shootTimer--;
        if (e.shootTimer <= 0 && e.attackWind <= 0 && d < 460 && onScreen) e.attackWind = 20;
        if (e.attackWind > 0 && --e.attackWind === 0) {
            const sx = fx(e) + (e.facingRight ? 10 : -10), sy = e.y + e.h * 0.35;
            const ang = Math.atan2(p.y + 22 - sy, pfx - sx);
            const shots = brood ? [-0.3, 0, 0.3] : [0];
            for (const o of shots) this.projectiles.push(new Projectile(sx, sy, Math.cos(ang + o) * 4.2, Math.sin(ang + o) * 4.2, e));
            e.shootTimer = brood ? 85 : 120 + Math.random() * 40;
            sfx.sfxSpit();
        }
        if (brood) {
            e.summonTimer--;
            if (e.summonTimer <= 0) {
                e.summonTimer = 360;
                const kids = this.enemies.filter(o => o.hatchling && !o.dead).length;
                for (let i = 0; i < 2 && kids + i < 6; i++) {
                    const k = this.makeEnemy('runner', fx(e) - 18 + (i ? 30 : -30), fy(e) - 36, { hpMult: 0.6 });
                    k.hatchling = true; k.spawnTimer = k.spawnMax = 30; k.aggroTimer = 600;
                }
                this.text(fx(e), e.y - 10, 'Hatchlings!', '#e1bee7', 15);
            }
        }
    }

    // ---- the Alpha: ground slam ----
    aiAlpha(e) {
        const p = this.player;
        const d = dist(fx(e), fy(e), fx(p), fy(p));
        if (e.state === 'slamWind') {
            if (--e.stateTimer <= 0) {
                e.state = 'chase'; e.specialTimer = 230;
                sfx.sfxSlam(); this.shake = 18;
                this.effects.push(new Ring(fx(e), fy(e), 20, 150, 24, '#ff6b5e', 7));
                this.burst(fx(e), fy(e), '#5a4030', 30, { speed: 7, lift: 3 });
                if (d < 150) {
                    if (this.damagePlayer(22, e, e.keg)) { const dir = fx(p) > fx(e) ? 1 : -1; p.kvx = dir * 10; }
                }
            }
            return;
        }
        e.specialTimer--;
        if (e.specialTimer <= 0 && d < 320) { e.state = 'slamWind'; e.stateTimer = 45; sfx.sfxWarlordRoar(); return; }
        this.aiMelee(e);
    }

    // ---- Magatsuhi's Vessel ----
    aiWarlord(e) {
        const p = this.player;
        if (!e.phase2 && e.hp < e.maxHp * 0.5) {
            e.phase2 = true; e.speed *= 1.3; e.windupMax = 18;
            this.text(fx(e), e.y - 20, 'The armor cracks...', '#ff6b5e', 18);
            sfx.sfxWarlordRoar(); this.shake = 20;
        }
        const d = dist(fx(e), fy(e), fx(p), fy(p));

        if (e.castTimer > 0) {
            if (--e.castTimer === 0) {
                const n = e.phase2 ? 5 : 3;
                for (let i = 0; i < n; i++) {
                    const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 40 + Math.random() * 70;
                    this.pools.push(new Pool(fx(p) + Math.cos(a) * r, fy(p) - 6 + Math.sin(a) * r * 0.5, 'erupt', 220, 45));
                }
                sfx.sfxExplode(); this.shake = 10;
                this.text(fx(e), e.y - 20, 'Eruption', '#ff6b5e', 16);
            }
            return;
        }
        if (e.state === 'swordWind') {
            if (--e.stateTimer <= 0) {
                e.state = 'slash'; e.stateTimer = 14;
                const dir = e.facingRight ? 1 : -1;
                const hb = { x: dir > 0 ? fx(e) : fx(e) - 110, y: e.y + e.h * 0.2, w: 110, h: e.h * 0.85 };
                this.effects.push(new Slash(fx(e) + dir * 50, e.y + e.h * 0.45, dir, true));
                this.effects.push(new Slash(fx(e) + dir * 70, e.y + e.h * 0.5, dir, true));
                sfx.sfxHeavyHit();
                if (rectHit(hb, { x: p.x + 8, y: p.y + 4, w: 24, h: 34 })) {
                    if (this.damagePlayer(e.dmg, e, e.keg)) p.kvx = dir * 9;
                }
            }
            return;
        }
        if (e.state === 'slash') { if (--e.stateTimer <= 0) { e.state = 'chase'; e.biteTimer = 40; } return; }

        e.specialTimer--; e.summonTimer--;
        if (e.specialTimer <= 0) { e.castTimer = 60; e.specialTimer = e.phase2 ? 220 : 320; return; }
        if (e.summonTimer <= 0) {
            e.summonTimer = 480;
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2 + Math.random();
                const z = this.makeEnemy('walker', fx(p) + Math.cos(a) * 190 - 20, fy(p) + Math.sin(a) * 90 - 40);
                z.spawnTimer = z.spawnMax = 50; z.aggroTimer = 900;
            }
            this.text(fx(e), e.y - 20, 'Rise.', '#ff6b5e', 18);
        }

        const t = this.targetFor(e);
        if (t.wait) { this.moveToward(e, t.x, t.y, e.speed * 0.6); return; }
        if (d < 90 && e.biteTimer <= 0) {
            e.state = 'swordWind'; e.stateTimer = e.windupMax; e.facingRight = fx(p) > fx(e);
            return;
        }
        if (d > 60) this.moveToward(e, fx(p), fy(p), e.speed);
    }

    // ---- boar: charge, crash, punish ----
    aiBoar(e) {
        const p = this.player;
        const pfx = fx(p), pfy = fy(p);
        e.isMoving = false;
        if (e.state === 'flee') {
            // boars always bolt back into the forest, swerving around the master if he's in the way
            e.x -= e.speed * 2; e.isMoving = true; e.facingRight = false;
            if (Math.abs(fx(e) - pfx) < 170 && pfx < fx(e)) e.y += (fy(e) >= pfy ? 1 : -1) * e.speed * 1.4;
            if (this.frames % 5 === 0) this.burst(fx(e), fy(e), 'rgba(200,180,140,0.6)', 1, { speed: 1, shape: 'smoke', size: 5, grav: -0.02 });
            if (e.x < -90 || e.x > WORLD_W + 90) e.dead = true;
            return;
        }
        if (e.state === 'stunned') {
            if (--e.stateTimer <= 0) {
                if (e.damagedWhileStunned) {
                    e.state = 'flee';
                    this.text(fx(e), e.y - 16, 'It bolts!', '#ffd77a', 15);
                } else e.state = 'idle';
            }
            return;
        }
        if (e.state === 'windup') {
            e.facingRight = pfx > fx(e);
            if (--e.stateTimer <= 0) {
                e.state = 'charge';
                const ang = Math.atan2(pfy - fy(e), pfx - fx(e));
                e.chargeVx = Math.cos(ang) * 15; e.chargeVy = Math.sin(ang) * 15 * 0.8;
                e.targetDist = dist(fx(e), fy(e), pfx, pfy) + 90; e.travelled = 0;
                e.facingRight = e.chargeVx > 0;
            }
            return;
        }
        if (e.state === 'charge') {
            e.x += e.chargeVx; e.y += e.chargeVy; e.travelled += Math.hypot(e.chargeVx, e.chargeVy);
            e.isMoving = true;
            if (this.frames % 2 === 0) this.burst(fx(e), fy(e), 'rgba(200,180,140,0.6)', 1, { speed: 1, shape: 'smoke', size: 5, grav: -0.02 });
            const crash = (msg) => {
                e.state = 'stunned'; e.stateTimer = 130; e.damagedWhileStunned = false;
                e.hp -= 20;
                this.text(fx(e), e.y - 12, msg, '#ff7a50', 18);
                this.shake = Math.max(this.shake, 12); sfx.sfxExplode();
                this.burst(fx(e), e.y + 20, '#6e4627', 12, { speed: 5 });
                if (e.hp <= 0) this.killEnemy(e, -Math.sign(e.chargeVx), 'hit');
            };
            if (fx(e) > FOREST_END + 220) { e.state = 'stunned'; e.stateTimer = e.missStun || 50; e.damagedWhileStunned = false; e.x -= e.chargeVx; return; }
            const wall = e.x <= 4 || e.x >= WORLD_W - e.w - 4 || fy(e) <= FEET_MIN + 2 || fy(e) >= FEET_MAX - 2;
            const tree = this.trees.some(t => t.solid && Math.abs(fx(e) + Math.sign(e.chargeVx) * 18 - t.x) < 18 * t.s && Math.abs(fy(e) - t.y) < 16);
            const cache = this.caches.some(k => !k.dead && rectHit({ x: e.x + 10, y: fy(e) - 12, w: e.w - 20, h: 12 }, k));
            const dojo = OBSTACLES.some(o => rectHit({ x: e.x + 10, y: fy(e) - 12, w: e.w - 20, h: 12 }, o));
            const other = this.enemies.find(o => o !== e && !o.dead && o.type === 'boar' && rectHit(e, o));
            if (wall || tree || cache || dojo) { crash('Crash!'); return; }
            if (other) { crash('Crash!'); other.state = 'stunned'; other.stateTimer = 130; other.hp -= 20; if (other.hp <= 0) this.killEnemy(other, 1, 'hit'); return; }
            if (rectHit({ x: e.x + 8, y: e.y + 10, w: e.w - 16, h: e.h - 10 }, { x: p.x + 8, y: p.y + 4, w: 24, h: 34 }) && p.iFrames <= 0) {
                this.damagePlayer(e.dmg, e, 0);
                p.kvx = Math.sign(e.chargeVx) * 8;
                e.state = 'stunned'; e.stateTimer = 50; e.damagedWhileStunned = false;
                return;
            }
            if (e.travelled >= e.targetDist) { e.state = 'stunned'; e.stateTimer = e.missStun || 50; e.damagedWhileStunned = false; this.text(fx(e), e.y - 12, '?', '#ffffff', 16); }
            return;
        }
        // idle / patrol
        if (e.calm > 0) e.calm--;
        const onScreen = fx(e) > this.camera.x + 10 && fx(e) < this.camera.x + W - 10;
        const d = dist(fx(e), fy(e), pfx, pfy);
        if (this.isDay && e.calm <= 0 && onScreen && d < 270 && Math.abs(pfy - fy(e)) < 120 && pfx < SANCT_START && this.hasLineOfSight(fx(e), fy(e) - 10, pfx, pfy - 10)) {
            e.state = 'windup'; e.stateTimer = 42;
            sfx.sfxFrustratedGroan();
            return;
        }
        if (!e.patrolDir) e.patrolDir = e.facingRight ? 1 : -1;
        e.x += e.speed * 0.45 * e.patrolDir;
        if (e.x > e.anchorX + 140) e.patrolDir = -1;
        if (e.x < e.anchorX - 140) e.patrolDir = 1;
        e.facingRight = e.patrolDir > 0; e.isMoving = true;
    }

    hasLineOfSight(x1, y1, x2, y2) {
        if (x1 > FOREST_END + 60 && x2 > FOREST_END + 60) return true;
        const steps = Math.max(8, Math.floor(dist(x1, y1, x2, y2) / 14));
        for (const t of this.trees) {
            if (!t.solid) continue;
            for (let i = 1; i < steps; i++) {
                const px = x1 + (x2 - x1) * i / steps, py = y1 + (y2 - y1) * i / steps;
                if (Math.abs(px - t.x) < 14 * t.s && py < t.y + 4 && py > t.y - 30 * t.s) return false;
            }
        }
        return true;
    }

    // =========================================
    // PROJECTILES, POOLS, LOOT, EFFECTS
    // =========================================
    updateProjectiles() {
        const p = this.player;
        for (const pr of this.projectiles) {
            pr.update();
            let boom = pr.life <= 0;
            if (!pr.reflected && p.iFrames <= 0 && rectHit({ x: pr.x - 5, y: pr.y - 5, w: 10, h: 10 }, { x: p.x + 10, y: p.y + 6, w: 20, h: 32 })) boom = true;
            if (!boom) {
                for (const e of this.enemies) {
                    if (e.dead || e.spawnTimer > 0 || (!pr.reflected && e === pr.owner)) continue;
                    if (rectHit({ x: pr.x - 5, y: pr.y - 5, w: 10, h: 10 }, { x: e.x + 6, y: e.y + 4, w: e.w - 12, h: e.h - 4 })) { boom = true; break; }
                }
            }
            if (pr.y < FEET_MIN - 60 || pr.y > H + 20) boom = true;
            if (!boom) continue;
            pr.dead = true;
            this.burst(pr.x, pr.y, pr.reflected ? '#7ff3ff' : '#c6e03a', 14, { speed: 4 });
            sfx.sfxExplode();
            if (!pr.reflected) this.pools.push(new Pool(pr.x, clamp(pr.y + 24, FEET_MIN, FEET_MAX), 'acid', 200));
            if (!pr.reflected && dist(fx(p), p.y + 22, pr.x, pr.y) < 42) this.damagePlayer(ENEMY.spitter.dmg * this.cfg('zDamage', 1), { x: pr.x, w: 0 }, ENEMY.spitter.keg);
            for (const e of this.enemies) {
                if (e.dead || e.spawnTimer > 0) continue;
                if (dist(fx(e), e.y + e.h / 2, pr.x, pr.y) < 50) {
                    if (pr.reflected) this.applyHit(e, 60 * this.kegareMult(), pr.vx > 0 ? 1 : -1, 10, { source: 'reflect' });
                    else if (e !== pr.owner) {
                        e.hp -= 15; e.hitTimer = 5;
                        this.text(fx(e), e.y, '-15', '#c6e03a', 14);
                        if (pr.owner && !pr.owner.dead && e.type !== 'boar' && !e.isBoss) { e.grudge = pr.owner; e.grudgeTimer = 300; }
                        if (e.hp <= 0) this.killEnemy(e, pr.vx > 0 ? 1 : -1, 'hit');
                    }
                }
            }
        }
        this.projectiles = this.projectiles.filter(pr => !pr.dead);
    }

    updatePools() {
        const p = this.player;
        for (const pl of this.pools) {
            pl.update();
            if (pl.active && p.iFrames <= 0 && pl.contains(fx(p), fy(p) - 4)) {
                const dmg = pl.kind === 'erupt' ? 20 : 10;
                if (this.damagePlayer(dmg * (pl.kind === 'acid' ? this.cfg('zDamage', 1) : 1), null, pl.kind === 'lava' ? 0 : 0.02)) p.iFrames = 30;
            }
        }
        this.pools = this.pools.filter(pl => pl.life > 0);
    }

    updateLoot() {
        const p = this.player;
        const px = fx(p), py = p.y + 28;
        for (const l of this.loot) {
            l.update();
            if (l.age < 20) continue;
            const d = dist(px, py, l.x, l.y);
            if (d < 80) { l.x += (px - l.x) / d * 5; l.y += (py - l.y) / d * 5; }
            if (d < 20) {
                l.taken = true;
                if (l.type === 'meat') { p.food++; this.text(px, p.y - 6, '+1 meat', '#ffd77a', 14); sfx.sfxPickup(); }
                else if (l.type === 'bandage') {
                    const h = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * 0.25));
                    p.hp += h; this.text(px, p.y - 6, `+${h}`, '#7ddf64', 16); sfx.sfxPickup();
                } else if (l.type === 'essence') {
                    p.essence++; this.text(px, p.y - 6, '+1 essence', '#d6b4f0', 14); sfx.sfxEssence(); this.hint('essence');
                } else if (l.type === 'core') {
                    p.maxHp += 30; p.hp = p.maxHp; p.essence += 2;
                    this.text(px, p.y - 30, '+30 max HP, +2 essence', '#bff4ff', 18);
                    sfx.sfxLevelUp(); this.cureFlash = 25;
                }
            }
        }
        this.loot = this.loot.filter(l => !l.taken);
    }

    updateEffects() {
        for (const a of [this.particles, this.texts, this.decals, this.corpses, this.effects]) for (const o of a) o.update();
        this.particles = this.particles.filter(o => o.life > 0);
        if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
        this.texts = this.texts.filter(o => o.life > 0);
        this.decals = this.decals.filter(o => o.life > 0);
        this.corpses = this.corpses.filter(o => o.life > 0);
        this.effects = this.effects.filter(o => o.life > 0);
    }

    // =========================================
    // ENDING
    // =========================================
    checkEnd() {
        if (!['PLAYING', 'SUNRISE'].includes(this.state)) return;
        const p = this.player;
        if (this.script) {
            // nobody dies in the prologue
            p.hp = Math.max(1, p.hp);
            p.infection = Math.min(2.9, p.infection);
            this.dojo.hp = Math.max(this.dojo.maxHp * 0.3, this.dojo.hp);
            return;
        }
        let reason = null;
        if (p.infection >= 3) reason = 'turned';
        else if (p.hp <= 0) reason = 'died';
        else if (this.dojo.hp <= 0) reason = 'dojo';
        if (!reason) return;
        this.endReason = reason;
        this.state = 'DYING';
        this.deathTimer = 90;
        this.saveScore();
        UI.hideTouchUI();
        sfx.sfxFrustratedGroan();
        if (reason === 'turned') this.burst(fx(p), p.y + 20, '#7b3fa0', 60, { speed: 6 });
        if (reason === 'dojo') { this.burst(DOJO.x + DOJO.w / 2, DOJO.y - 40, '#ff8a3c', 80, { speed: 7 }); sfx.sfxExplode(); }
    }

    finishGameOver() {
        this.state = 'GAMEOVER';
        this.readyAt = performance.now() + 700;
        UI.showGameOver(this.endReason, this.mode, this.dayCount, this.kills, Object.values(this.player.tech).reduce((a, b) => a + b, 0));
    }
}

// =========================================
// LOOP (fixed 60 updates per second)
// =========================================
const game = new Game();
window.__lastDojo = game; // handy for debugging in the browser console
const STEP = 1000 / 60;
let last = performance.now(), acc = 0;
function loop(now) {
    requestAnimationFrame(loop);
    acc += Math.min(250, now - last);
    last = now;
    let stepped = false;
    while (acc >= STEP) {
        // skipping a cutscene fast-forwards it (silently) instead of jumping
        const reps = game.script && game.script.skipping ? 16 : 1;
        sfx.suppress = reps > 1;
        for (let r = 0; r < reps; r++) if (!game.paused) game.update();
        sfx.suppress = false;
        acc -= STEP; stepped = true;
    }
    // only redraw when the simulation advanced (avoids double work on 120Hz screens)
    if (stepped) game.renderer.draw();
}
requestAnimationFrame(loop);
