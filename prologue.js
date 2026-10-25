/* =========================================
   LAST DOJO V3 - PROLOGUE (prologue.js)

   The night Magatsuhi escaped, played as a tutorial.
   Each chapter is a generator: `yield` waits one frame,
   so a beat reads top to bottom like a screenplay.

   1. The blood moon     - fight at full power, learn the basics
   2. The escape         - the seal breaks; the curse takes your techniques
   3. The Gekka Bijin    - flee to the sanctuary, purge the taint, dawn
   4. The first morning  - hunt a boar, eat, raid a cache
========================================= */

import { W, FEET_MIN, FEET_MAX, FOREST_END, SANCT_START, DOJO_DOOR, SHRINE, SEAL, KEGARE, TECHNIQUES, PROLOGUE_TECHS } from './config.js';
import { sfx } from './assets.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Cache, Ring } from './entities.js';

const fx = e => e.x + e.w / 2;
const fy = e => e.y + e.h;
const smooth = t => t * t * (3 - 2 * t);

export class Prologue {
    constructor(game, thenRun) {
        this.g = game;
        this.thenRun = thenRun;   // true: flow straight into Day 1 afterwards
        this.cutscene = false;
        this.skipping = false;    // fast-forwards the current cutscene
        this.done = false;
        this.gen = this.main();
    }

    update() {
        if (this.done) return;
        const r = this.gen.next();
        if (r.done && !this.done) { this.done = true; this.g.endPrologue(this.thenRun, false); }
    }

    skip() { if (this.cutscene) this.skipping = true; }

    // =========================================
    // HELPERS
    // =========================================
    *wait(n) { for (let i = 0; i < n; i++) yield; }
    *until(fn) { while (!fn()) yield; }

    // subtitles: 'self' is the master's inner voice, 'ren' is his teacher, remembered
    *say(text, who = 'self', frames) {
        const f = frames || Math.max(120, Math.round(text.length * 3.6));
        this.g.subtitle = { text, who, timer: f, max: f };
        yield* this.wait(f);
    }
    sayAsync(text, who = 'self', frames) {
        const f = frames || Math.max(150, Math.round(text.length * 4));
        this.g.subtitle = { text, who, timer: f, max: f };
    }

    startCut() {
        const g = this.g, p = g.player;
        this.cutscene = true;
        g.inputLocked = true;
        g.letterboxTarget = 1;
        g.objective = null;
        p.attackType = null; p.attackTimer = 0; p.dashTimer = 0;
        Input.resetMovement();
        UI.hideTouchUI();
    }
    endCut() {
        const g = this.g;
        this.cutscene = false; this.skipping = false;
        g.inputLocked = false;
        g.letterboxTarget = 0;
        g.camTarget = null;
        g.subtitle = null;
        Input.clearPresses();
        UI.showTouchUI();
    }
    objective(text) {
        const g = this.g;
        if (g.objective === text) return;
        g.objective = text; g.objectiveFlash = 40;
        if (text) sfx.sfxLore();
    }
    cam(worldX, zoom) { this.g.camTarget = { x: worldX - W / 2, zoom }; }
    k(action) { return Input.isTouchDevice ? `the ${this.g.keyLabel(action)} button` : this.g.keyLabel(action); }
    moveKeys() {
        if (Input.isTouchDevice) return 'the left side of the screen';
        return ['up', 'left', 'down', 'right'].map(a => this.k(a)).join(' ');
    }

    spawn(type, x, y, o = {}) {
        const g = this.g;
        const e = g.makeEnemy(type, x, y);
        if (o.rise) { e.spawnTimer = e.spawnMax = o.rise === true ? 50 : o.rise; g.burst(fx(e), fy(e), '#3a2a1c', 8, { speed: 3 }); }
        if (o.aggro) e.aggroTimer = 1e9;
        e.facingRight = fx(e) < fx(g.player);
        return e;
    }
    ring(type, n, r, o) {
        const p = this.g.player, out = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
            out.push(this.spawn(type, fx(p) + Math.cos(a) * r - 20, fy(p) + Math.sin(a) * r * 0.55 - 40, o));
        }
        return out;
    }
    alive(list) { return list.filter(e => !e.dead).length; }

    // =========================================
    // SCRIPT
    // =========================================
    *main() {
        yield* this.bloodMoon();
        yield* this.escape();
        yield* this.flight();
        yield* this.flower();
        yield* this.morning();
        yield* this.ending();
    }

    // ---------- 1. The blood moon ----------
    *bloodMoon() {
        const g = this.g, p = g.player;
        g.titleOverride = 'Prologue';
        g.isDay = false; g.phaseLen = g.nightLen; g.timeTimer = Math.round(g.phaseLen * 0.5);
        g.clockFrozen = true; g.hideKegare = true; g.kegareLocked = true; g.noSiegeBoost = true;
        g.sealStone = { crack: 0, broken: false, pulse: 0 };
        p.tech = {}; for (const id of PROLOGUE_TECHS) p.tech[id] = 1;
        p.x = SEAL.x + 30; p.y = SEAL.y - 26; p.facingRight = false; p.pose = 'meditate';
        g.camera.x = SEAL.x + 40 - W / 2; g.zoom = 1.35; g.letterbox = 1;

        // cold open
        this.startCut();
        this.cam(SEAL.x + 40, 1.35);
        yield* this.wait(60);
        sfx.sfxBell();
        yield* this.say('Forty years I have kept watch over this stone.');
        g.forceBlood = true; g.shake = 8; sfx.sfxWarlordRoar();
        yield* this.say('Tonight, the moon bleeds.', 'self', 110);
        g.sealStone.pulse = 260;
        yield* this.say('And the thing sealed beneath it is stirring.');
        const first = [
            this.spawn('walker', SEAL.x - 270, SEAL.y - 30, { rise: 70, aggro: true }),
            this.spawn('walker', SEAL.x + 250, SEAL.y + 80, { rise: 70, aggro: true }),
            this.spawn('walker', SEAL.x - 130, SEAL.y + 170, { rise: 70, aggro: true })
        ];
        this.cam(SEAL.x + 40, 1.1);
        yield* this.wait(50);
        p.pose = null;
        yield* this.say('Then let them come.', 'self', 90);
        this.endCut();

        // move and punch
        const sx = p.x, sy = p.y;
        this.objective(`Move with ${this.moveKeys()}.`);
        yield* this.until(() => Math.hypot(p.x - sx, p.y - sy) > 70 ||
            first.some(e => !e.dead && e.spawnTimer <= 0 && Math.hypot(fx(e) - fx(p), fy(e) - fy(p)) < 110));
        this.objective(`Punch with ${this.k('punch')}. Every third punch in a row is a heavy finisher.`);
        yield* this.until(() => this.alive(first) === 0);

        // spin kick
        yield* this.wait(45);
        const ring = this.ring('walker', 5, 175, { rise: 45, aggro: true });
        this.objective(`Surrounded? Spin kick with ${this.k('spin')} to strike everything around you.`);
        yield* this.until(() => this.alive(ring) === 0);

        // spitter and reflecting acid
        yield* this.wait(45);
        const side = fx(p) < SEAL.x + 100 ? 1 : -1;
        const sp = this.spawn('spitter', fx(p) + side * 300, fy(p) - 60, { rise: 40, aggro: true });
        const guards = [this.spawn('walker', fx(p) + side * 220, fy(p) + 30, { rise: 40, aggro: true })];
        this.objective(`A spitter. Spin kick (${this.k('spin')}) just as its acid reaches you to throw it back.`);
        yield* this.until(() => sp.dead && this.alive(guards) === 0);

        // brute and dash
        yield* this.wait(45);
        const br = this.spawn('brute', fx(p) - side * 260, fy(p) - 52, { rise: 55, aggro: true });
        this.objective(`Brutes hit hard. When one rears back, dash with ${this.k('dash')}. Nothing can hurt you mid-dash.`);
        yield* this.until(() => br.dead);

        // essence
        this.objective('Black essence seeps from the fallen. Gather it.');
        yield* this.gatherEssence(2);
        this.objective(null);

        // the horde turns on the Dojo
        yield* this.wait(30);
        this.startCut();
        this.cam(DOJO_DOOR.x - 80, 1.05);
        g.isSiege = true;
        for (let i = 0; i < 5; i++) this.spawn('walker', Math.max(0, g.camera.x - 60 - i * 25), FEET_MIN + 40 + i * 70);
        yield* this.say('They are not coming for me...', 'self', 110);
        yield* this.say('They want the Dojo. They want the seal.', 'self', 130);
        this.endCut();
        this.objective('The dead march on the Dojo. Strike them to draw them to you.');
        const k0 = g.kills;
        let spawned = 5;
        while (g.kills - k0 < 10) {
            const live = g.enemies.filter(e => !e.dead && e.type !== 'boar').length;
            if (spawned < 13 && live < 6 && g.frames % 35 === 0) {
                this.spawn('walker', Math.max(0, g.camera.x - 50), FEET_MIN + 30 + Math.random() * (FEET_MAX - FEET_MIN - 80));
                spawned++;
            }
            if (live === 0 && spawned >= 13) break;
            yield;
        }
    }

    *gatherEssence(n) {
        const g = this.g, p = g.player;
        let t = 0;
        while (p.essence < n) {
            t++;
            const lying = g.loot.filter(l => l.type === 'essence').length;
            if (p.essence + lying < n && t % 30 === 0) {
                g.dropLoot(fx(p) + (Math.random() < 0.5 ? -100 : 100), fy(p) - 8, 'essence');
            }
            yield;
        }
    }

    // ---------- 2. The escape ----------
    *escape() {
        const g = this.g, p = g.player;
        this.objective(null);
        this.startCut();
        this.cam((SEAL.x + fx(p)) / 2, 1.15);
        for (const e of g.enemies) if (!e.dead) e.stunTimer = 900;
        g.shake = 22; sfx.sfxWarlordRoar();
        yield* this.say('The ground...!', 'self', 80);

        // the seal cracks
        for (let i = 0; i < 100; i++) {
            g.sealStone.crack = i / 100;
            if (i % 6 === 0) g.shake = Math.max(g.shake, 7);
            if (i % 4 === 0) g.burst(SEAL.x + (Math.random() - 0.5) * 44, SEAL.y - 26, '#8e44ad', 2, { speed: 2, grav: -0.06 });
            yield;
        }
        // the dead drop where they stand
        for (const e of g.enemies) if (!e.dead) {
            e.dead = true;
            g.burst(fx(e), e.y + e.h / 2, '#3a3030', 10, { speed: 2, shape: 'smoke', grav: -0.06, size: 6 });
        }
        g.sealStone.broken = true;
        g.shake = 32; g.surgeFlash = 22; sfx.sfxExplode();
        g.burst(SEAL.x, SEAL.y - 28, '#1e0b26', 60, { speed: 8 });
        g.burst(SEAL.x, SEAL.y - 28, '#b05ce0', 30, { speed: 6 });

        // the sliver of Magatsuhi rises, circles, and dives
        const s = g.sliver = { x: SEAL.x, y: SEAL.y - 30, trail: [] };
        const glide = function* (tx, ty, n) {
            const x0 = s.x, y0 = s.y;
            for (let i = 1; i <= n; i++) { const t = smooth(i / n); s.x = x0 + (tx - x0) * t; s.y = y0 + (ty - y0) * t; yield; }
        };
        yield* glide(SEAL.x + 30, 150, 45);
        sfx.sfxWarlordRoar();
        const cx = SEAL.x + 90, cy = 210, a0 = Math.atan2(s.y - cy, s.x - cx), r0 = Math.hypot(s.x - cx, (s.y - cy) * 2);
        this.sayAsync('No...', 'self', 90);
        for (let i = 0; i < 100; i++) {
            const a = a0 + (i / 100) * Math.PI * 2.2, r = r0 + (140 - r0) * Math.min(1, i / 25);
            s.x = cx + Math.cos(a) * r; s.y = cy + Math.sin(a) * r * 0.5;
            p.facingRight = s.x > fx(p);
            yield;
        }
        yield* glide(fx(p), p.y + 18, 14);
        g.sliver = null;

        // it takes him
        p.pose = 'clutch';
        this.cam(fx(p), 1.5);
        g.surgeFlash = 30; g.shake = 28; g.hitStop = 10;
        sfx.sfxSurge();
        g.effects.push(new Ring(fx(p), fy(p) - 4, 10, 170, 32, '#b05ce0', 7));
        g.burst(fx(p), p.y + 20, '#7b3fa0', 50, { speed: 7 });
        g.hideKegare = false;
        for (let i = 0; i < 70; i++) { p.infection = 1.6 * (i / 69); yield; }

        // his techniques shatter, one seal at a time
        g.seals = PROLOGUE_TECHS.map((id, i) => ({ id, name: TECHNIQUES.find(t => t.id === id).name, a: i * Math.PI / 2, broken: false }));
        yield* this.wait(60);
        for (let i = 0; i < g.seals.length; i++) {
            const sl = g.seals[i];
            const a = sl.a + g.frames * 0.04;
            const x = fx(p) + Math.cos(a) * 46, y = p.y + 18 + Math.sin(a) * 20;
            sl.broken = true;
            delete p.tech[sl.id];
            g.burst(x, y, '#efe6d2', 14, { speed: 4 });
            // stack the labels so they don't overlap as they float up
            g.text(fx(p), p.y - 30 - i * 20, `${sl.name} lost`, '#d69cff', 15);
            sfx.sfxCrate();
            yield* this.wait(30);
        }
        g.seals = [];
        p.tech = {};
        yield* this.say('My training... the curse is tearing it apart.', 'self', 150);
        p.pose = null;
        this.endCut();
    }

    // ---------- 3a. The flight east ----------
    *flight() {
        const g = this.g, p = g.player;
        g.titleOverride = 'Prologue';
        this.ring('walker', 6, 230, { rise: 50, aggro: true });
        yield* this.wait(30);
        p.surgeWarn = KEGARE.surgeWarnFrames;
        this.objective('Something is rising inside you...');
        yield* this.until(() => p.staggerTimer > 0);
        yield* this.until(() => p.staggerTimer <= 0);
        this.objective(null);

        // the blood moon now feeds him, because he is part of the dead's curse
        g.noSiegeBoost = false;
        yield* this.say('The blood moon feeds the curse in me. I feel no tiredness, and my blows land like hammers.', 'self', 220);
        this.sayAsync('The moon flower devours what is impure, child. Never forget where it grows.', 'ren', 280);
        yield* this.wait(140);
        this.objective('Reach the Gekka Bijin in the sanctuary, far to the east. The dead are following.');
        let t = 0;
        while (fx(p) < SANCT_START + 30) {
            t++;
            if (t % 70 === 0 && g.enemies.filter(e => !e.dead).length < 10) {
                this.spawn('walker', Math.max(0, g.camera.x - 50), FEET_MIN + 20 + Math.random() * (FEET_MAX - FEET_MIN - 60), { aggro: true });
            }
            yield;
        }
        p.sanctTime = 0;
        this.objective("The dead can't set foot on sacred ground. But it burns the Kegare in you, so don't linger.");
        yield* this.wait(90);
    }

    // ---------- 3b. The Gekka Bijin and dawn ----------
    *flower() {
        const g = this.g, p = g.player;
        yield* this.until(() => Math.hypot(fx(p) - SHRINE.x, fy(p) - (SHRINE.y + 20)) < 90);
        this.objective(`Offer the essence to the flower with ${this.k('interact')}.`);
        const inf0 = p.infection;
        yield* this.until(() => p.infection < inf0 - 0.2);
        this.objective(null);

        this.startCut();
        this.cam(SHRINE.x, 1.3);
        g.shrineGlow = 120;
        yield* this.say('It is drinking the taint out of me...', 'self', 130);
        const start = p.infection;
        for (let i = 0; i < 60; i++) { p.infection = start * (1 - i / 59); g.shrineGlow = Math.max(g.shrineGlow, 60); yield; }
        g.cureFlash = 40; sfx.sfxOffer();
        yield* this.say('But it is still there, coiled somewhere deep. It will come back.', 'self', 180);

        // sunrise burns the dead waiting at the boundary
        g.isDay = true; g.isSiege = false; g.forceBlood = false; g.peaceful = false;
        g.phaseLen = g.dayLen; g.timeTimer = Math.round(g.phaseLen * 0.995);
        for (const e of g.enemies) if (!e.dead && e.type !== 'boar') e.burning = true;
        sfx.sfxBell();
        this.cam(SANCT_START - 60, 1.1);
        // essence burns at sunrise like the dead it came from
        if (p.essence > 0) g.burnEssence();
        this.sayAsync('Dawn. The dead burn in the sun, and the essence I carried burns with them.', 'self', 210);
        const step = (g.phaseLen * 0.06) / 210;
        let tt = g.timeTimer;
        for (let i = 0; i < 210; i++) { tt -= step; g.timeTimer = Math.round(tt); yield; }
        p.pose = 'kneel';
        this.cam(fx(p), 1.25);
        yield* this.say('Each morning I will meditate, and win back what the curse tore from me.', 'self', 190);
        this.endCut();

        // the first dawn choice offers three of the four lost techniques
        const pool = [...PROLOGUE_TECHS].sort(() => Math.random() - 0.5).slice(0, 3);
        g.openChoice(pool.map(id => TECHNIQUES.find(t => t.id === id)));
        yield; // resumes only after the player picks
        p.pose = null;
    }

    // ---------- 4. The first morning ----------
    *morning() {
        const g = this.g, p = g.player;
        p.hp = Math.min(p.hp, Math.round(p.maxHp * 0.35));
        p.ghostHp = p.hp;
        p.food = 0;
        yield* this.wait(30);
        this.sayAsync('I am bleeding, and I have not eaten since yesterday.', 'self', 200);
        this.objective('Hunt for food in the forest, far to the west.');

        let boar = this.spawnBoar(false);
        while (p.food < 1) {
            const meat = g.loot.some(l => l.type === 'meat');
            if (meat) this.objective('Take the meat.');
            else if (!boar || boar.dead) {
                this.objective('It bolted. Another boar is coming.');
                if (g.frames % 20 === 0) boar = this.spawnBoar(true); // may need a few tries to find a safe spot
            } else {
                const d = Math.hypot(fx(boar) - fx(p), fy(boar) - fy(p));
                if (boar.state === 'stunned' && boar.stateTimer > 12) this.objective('It is dazed. Strike now!');
                else if (d < 400) this.objective(`Boars shrug off punches. Wait for it to charge, then dash (${this.k('dash')}) aside.`);
            }
            yield;
        }
        this.objective(`Eat with ${this.k('eat')} to heal.`);
        const e0 = g.stats.eats;
        yield* this.until(() => g.stats.eats > e0);

        // a guarded supply cache
        const spot = this.cacheSpot();
        const k = new Cache(spot.x, spot.y);
        g.caches.push(k);
        const guard = g.makeEnemy('walker', spot.x - 60, spot.y - 8, { hpMult: 0.8 });
        guard.shade = true; guard.anchorX = spot.x + 22; guard.anchorY = spot.y + 34;
        this.objective('A supply cache, guarded by a shade-dweller that hides from the sun under the trees. Lure it into the light, or fight it.');
        yield* this.until(() => k.dead);
        this.objective('Gather the supplies.');
        let t = 0;
        yield* this.until(() => !g.loot.some(l => l.type === 'meat') || ++t > 600);
        this.objective(null);
    }

    spawnBoar(fromEdge) {
        const g = this.g;
        // replacements use the game's safe spawn (far away, calm); the first boar waits on the clear path
        const b = fromEdge ? g.spawnBoar(true) : g.makeEnemy('boar', 640, 352 - 52);
        if (!b) return null;
        if (!fromEdge) { b.anchorX = 650; b.anchorY = 300; }
        b.missStun = 120; // a missed charge leaves it dazed long enough to punish
        b.facingRight = true;
        return b;
    }

    cacheSpot() {
        const g = this.g;
        for (let i = 0; i < 60; i++) {
            const x = 680 + Math.random() * 120, feet = 420 + Math.random() * 90;
            if (g.trees.every(t => Math.hypot(t.x - (x + 22), t.y - feet) > 70)) return { x, y: feet - 34 };
        }
        return { x: 720, y: 430 };
    }

    // ---------- ending ----------
    *ending() {
        const g = this.g;
        yield* this.wait(40);
        this.startCut();
        this.cam(DOJO_DOOR.x, 1.1);
        yield* this.say('The stone is broken. Only the Dojo itself holds it down now.', 'self', 170);
        yield* this.say('Every fifth night the moon will bleed, and the thing beneath will come again.', 'self', 210);
        yield* this.say('Fifteen nights. Then it comes for the Dojo itself.', 'self', 170);
        g.titleCard = { timer: 210, max: 210 };
        yield* this.wait(210);
        this.endCut();
    }
}
