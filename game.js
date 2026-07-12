/* =========================================
   LAST DOJO V2 - CORE ENGINE (game.js)
========================================= */
import { sfx, sprDojo, sprDummy, sprSun, sprMoon, sprBloodMoon, sprMeat } from './assets.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Player, Zombie, Corpse, Loot, Projectile, Particle, FloatText, Decal, DamagePool, DirtMound } from './entities.js';

(function injectFavicon() {
    try {
        let link = document.createElement('link');
        link.type = 'image/png';
        link.rel = 'icon';
        
        let tempCanvas = document.createElement('canvas');
        tempCanvas.width = 32; tempCanvas.height = 32;
        tempCanvas.getContext('2d').drawImage(sprDojo, 0, 0, 32, 32);
        
        link.href = tempCanvas.toDataURL();
        document.head.appendChild(link);
    } catch(e) { console.log("Favicon injection bypassed."); }
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

class Game {
    constructor() {
        this.state = 'START'; 
        this.gameMode = 'SURVIVAL'; 
        this.paused = false; 
        this.hitStop = 0; 
        this.frames = 0;
        this.worldWidth = 2500; 
        this.camera = { x: 738, deadzoneW: 200 };
        this.currentRoom = 'HUB'; 
        
        this.dojo = { x: 798, y: 260, w: 60, h: 40, hp: 300, maxHp: 300 };
        this.dummy = { x: 918, y: 260, hits: 0, hitsNeeded: 15, level: 1 };
        
        this.timeTimer = 5400; this.phaseDur = 5400;
        this.isDay = true; this.dayCount = 1; this.food = 0; this.sleepFade = 0;
        this.isSiege = false; this.peacefulNight = false; this.shake = 0; this.damageFlash = 0;
        this.announceTimer = 0; this.announceText = ""; this.subAnnounceText = "";
        this.sunriseTimer = 0;
        this.spinCooldown = 0;
        this.tutPhase = 0; this.tutText = ""; this.tutTimer = 0;
        this.epiPhase = 0; this.epiTimer = 0;
        this.scenery = []; 
        this.forestTrees = [];
        this.sanctuaryFlora = [];
        this.decals = []; this.damagePools = [];
        this.mounds = []; 
        
        this.activePrompt = { text: '', action: null, target: null };
        this.epiLines = [
            "The Warlord's physical vessel is shattered.",
            "The seal holds.",
            "Sunlight turns its empty shell to ash...",
            "...forcing its essence back underground.",
            "It is not dead. The plague is eternal...",
            "...and it will build a new body.",
            "But as long as you draw breath...",
            "...the Last Dojo stands ready.",
            "ENDLESS MODE UNLOCKED."
        ];
        this.setupEventListeners();
        this.generateScenery(); 
        this.resetEntities(); 
        
        UI.init();
    }
    setupEventListeners() {
        document.addEventListener('startGame', (e) => this.startRun(e.detail.mode));
        document.addEventListener('startTutorial', () => this.startTutorial());
        document.addEventListener('startEpilogue', () => this.startEpilogue());
        document.addEventListener('restartGame', () => this.restartGame());
        
        document.addEventListener('quitToMenu', () => { 
            if (this.paused) { 
                this.paused = false; 
                UI.showMainMenu(); 
                this.state = 'START'; 
            }
        });
        
        document.addEventListener('togglePause', () => this.togglePause());
        
        document.addEventListener('requestCloseSettings', () => {
            if (this.paused) UI.showPause(); else UI.showMainMenu();
        });
        document.addEventListener('gameConfirm', () => {
            if (this.state === 'GAMEOVER' || this.state === 'VICTORY') this.restartGame();
        });
        document.addEventListener('canvasClick', () => {
            if (this.state === 'GAMEOVER' || this.state === 'VICTORY') { this.restartGame(); }
        });
    }
    saveScore() { 
        if (['SURVIVAL', 'ENDLESS'].includes(this.gameMode)) {
            let hs = parseInt(localStorage.getItem('lastDojoHighScore') || '0');
            if (this.dayCount > hs) localStorage.setItem('lastDojoHighScore', this.dayCount.toString()); 
        }
    }
    togglePause() {
        if (!['PLAYING', 'TUTORIAL', 'SUNRISE'].includes(this.state)) return;
        this.paused = !this.paused;
        if (this.paused) {
            Input.resetMovement();
            if (this.player) { this.player.isMoving = false; this.player.isAttacking = false; this.player.isSpinning = false; }
            UI.showPause();
        } else {
            UI.hideAllMenus();
            UI.showTouchUI();
        }
    }
    hasLineOfSight(x1, y1, x2, y2) {
        if (this.currentRoom !== 'FOREST') return true;
        let dist = Math.hypot(x2 - x1, y2 - y1);
        let steps = Math.max(10, Math.floor(dist / 10)); 
        
        for (let t of this.forestTrees) {
            let tx1 = t.x - 20 * t.s; let tx2 = t.x + 20 * t.s;
            let ty1 = t.y - 50 * t.s; let ty2 = t.y + 5 * t.s; 
            for(let i=1; i<steps; i++) {
                let px = x1 + ((x2 - x1) * (i/steps)); let py = y1 + ((y2 - y1) * (i/steps));
                if (px > tx1 && px < tx2 && py > ty1 && py < ty2) return false; 
            }
        }
        return true; 
    }
    generateScenery() {
        this.scenery = []; 
        for (let i = 0; i < 400; i++) {
            this.scenery.push({ 
                x: Math.random() * this.worldWidth, 
                y: 80 + Math.random() * (canvas.height - 120), 
                type: Math.random() > 0.85 ? 'rock' : 'grass', 
                r: Math.random() * 3 + 2, variant: Math.random() > 0.5 ? 1 : 2 
            });
        }
        this.forestTrees = [];
        for(let x = 0; x < this.worldWidth; x += 45) {
            this.forestTrees.push({ x: x, y: 75 + Math.random() * 15, s: 1.0 + Math.random() * 0.4 });
        }
        for(let y = 80; y < canvas.height; y += 45) {
            this.forestTrees.push({ x: 10 + Math.random() * 30, y: y, s: 1.0 + Math.random() * 0.4 });
            this.forestTrees.push({ x: this.worldWidth - 40 + Math.random() * 30, y: y, s: 1.0 + Math.random() * 0.4 });
        }
        for(let i = 0; i < 25; i++) {
            this.forestTrees.push({
                x: 100 + Math.random() * (this.worldWidth - 200),
                y: 100 + Math.random() * (canvas.height - 120),
                s: 0.8 + Math.random() * 0.4
            });
        }
        this.forestTrees.sort((a, b) => a.y - b.y);
        this.sanctuaryFlora = [];
        let fTypes = ['rose', 'sunflower', 'bluebell', 'lily', 'bush'];
        for(let i=0; i<180; i++) {
            this.sanctuaryFlora.push({
                x: 1800 + Math.random() * (this.worldWidth - 1800),
                y: 60 + Math.random() * (canvas.height - 60),
                type: fTypes[Math.floor(Math.random() * fTypes.length)],
                s: 0.5 + Math.random() * 0.8
            });
        }
        this.mounds = [
            new DirtMound(2000, 150),
            new DirtMound(2150, 150),
            new DirtMound(2300, 150)
        ];
    }
    createParticle(x, y, color, room) {
        let p = new Particle(x, y, color); p.room = room; this.particles.push(p);
    }
    createFloatText(x, y, text, color, room) {
        let f = new FloatText(x, y, text, color); f.room = room; this.floatTexts.push(f);
    }

    dropLoot(x, y, type, room) {
        let safeX = Math.max(20, Math.min(this.worldWidth - 40, x));
        let safeY = Math.max(65, Math.min(canvas.height - 40, y));
        let l = new Loot(safeX, safeY, type);
        l.room = room;
        this.loot.push(l);
    }

    resetEntities() {
        this.player = new Player(1250, 260);
        this.player.sanctuaryBurn = 0;
        this.player.demonRushTimer = 0;
        this.player.hasMomentum = false;
        this.player.hasVampirism = false;
        
        this.currentRoom = 'HUB';
        this.spinCooldown = 0; this.damageFlash = 0;
        this.combo = 0; this.comboTimer = 0;

        this.enemies = []; this.loot = []; this.particles = []; 
        this.floatTexts = []; this.projectiles = []; this.corpses = []; this.damagePools = [];
        this.camera.x = 738;
    }
    
    spawnFish() {
        let leftEdge = this.camera.x - 100;
        let rightEdge = this.camera.x + canvas.width + 100;
        let spawnX;
        
        if (leftEdge < 0) spawnX = rightEdge;
        else if (rightEdge > this.worldWidth) spawnX = leftEdge;
        else spawnX = Math.random() > 0.5 ? leftEdge : rightEdge;
        
        spawnX = Math.max(10, Math.min(this.worldWidth - 40, spawnX));

        let spawnY = 220 + Math.random() * (canvas.height - 260);
        let ax = 50 + Math.random() * (this.worldWidth - 100);
        let ay = 220 + Math.random() * (canvas.height - 260);
        
        let f = new Zombie(spawnX, spawnY, 1, 3.8, 'fish', ax, ay, 30, true);
        f.room = 'RIVER';
        this.enemies.push(f);
    }

    spawnBoars() {
        this.enemies = this.enemies.filter(z => z.type !== 'boar'); 
        if (this.state === 'PLAYING') {
            for(let i=0; i<3; i++) {
                let bx = 100 + Math.random() * (this.worldWidth - 200);
                let by = 80 + Math.random() * (canvas.height - 150);
                let boar = new Zombie(bx, by, 70, 2.5, 'boar', bx, by, 50, true);
                boar.room = 'FOREST';
                this.enemies.push(boar);
            }
        }
    }

    rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) { return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2; }
    
    hasInfiniteStamina() {
        if (this.gameMode === 'ENDLESS') { 
            return this.isSiege ? UI.endlessConfig.infStamBM : UI.endlessConfig.infStamReg; 
        }
        return false; 
    }
    
    changeRoom(newRoom) {
        this.currentRoom = newRoom;
        this.player.room = newRoom;
        this.shake = 5; 
    }

    // PHASE 3: SLANTED SCALING LOGIC
    spawnZombie(x = null, y = null, type = 'night', anchorX = 0, anchorY = 0) {
        let isAlpha = type === 'alpha';
        let isBrood = type === 'brood';
        let actualType = type;
        
        let tier = Math.floor((this.dayCount - 1) / 7);
        let intraWeekDay = Math.min((this.dayCount - 1) % 7, 3); // Ramps up on days 1-4, plateaus on days 5-7
        
        if (type === 'night' && this.state === 'PLAYING') {
            let activeBrutes = this.enemies.filter(z => z.type === 'brute' && z.hp > 0).length;
            let activeSpitters = this.enemies.filter(z => z.type === 'spitter' && z.hp > 0).length;
            
            if (tier >= 1 && Math.random() < 0.15 && activeBrutes < 1 + tier) actualType = 'brute';
            else if (tier >= 2 && Math.random() < 0.15 && activeSpitters < tier) actualType = 'spitter';
        }
        
        if (isAlpha) actualType = 'brute';
        if (isBrood) actualType = 'spitter';
        if (type === 'warlord') actualType = 'warlord';
        
        let size = (actualType === 'brute') ? 50 : (actualType === 'warlord' ? 80 : 40); 
        let baseSpeed = (actualType === 'brute') ? 0.7 : (actualType === 'warlord' ? 1.2 : 1.2 + (Math.random() * 0.5));
        
        let spdMult = tier === 0 ? 1.0 : (tier === 1 ? 1.2 : 1.4);
        let hpMult = tier === 0 ? 1.0 : (tier === 1 ? 1.5 : 2.5);

        let moveSpeed = Math.min((baseSpeed * spdMult) + (intraWeekDay * 0.05), 4.0); 
        if (this.isSiege && actualType !== 'brute' && actualType !== 'spitter' && actualType !== 'warlord') moveSpeed = Math.min(moveSpeed + 0.2, 4.0); 
        
        let hpPool = (actualType === 'brute') ? 120 : (actualType === 'spitter' ? 30 : 60);
        
        if (actualType === 'warlord') {
            hpPool = (this.dayCount >= 21 && this.gameMode === 'SURVIVAL') ? 4000 : 2000;
        } else if (isAlpha) {
            hpPool = 1200;
        } else if (isBrood) {
            hpPool = 800;
        } else if (this.gameMode === 'SURVIVAL') {
            hpPool = Math.floor((hpPool * hpMult) + (intraWeekDay * (actualType === 'brute' ? 15 : 5)));
        }

        if (this.gameMode === 'ENDLESS') {
            if (actualType === 'warlord' || isAlpha || isBrood) { 
                hpPool = Math.floor(hpPool * UI.endlessConfig.bHealth); 
                moveSpeed *= UI.endlessConfig.bSpeed; 
                size *= UI.endlessConfig.bossSize;
            }
            else { 
                hpPool = Math.floor(hpPool * UI.endlessConfig.zHealth); 
                moveSpeed *= UI.endlessConfig.zSpeed; 
            }
        }

        let spawnX, spawnY;
        let maxRight = this.currentRoom === 'HUB' ? 1650 : this.worldWidth; 

        if (x !== null && y !== null) {
            spawnX = Math.max(0, Math.min(maxRight, x));
            spawnY = y;
        } else {
            let validSpawn = false;
            let attempts = 0;
            
            while (!validSpawn && attempts < 10) {
                let edge = Math.floor(Math.random() * 3); 
                let leftEdge = this.camera.x - 80; 

                if (edge === 0 && leftEdge >= -100) { 
                    spawnX = leftEdge;
                    spawnY = 80 + Math.random() * (canvas.height - 150);
                } else if (edge === 1) { 
                    spawnX = Math.max(0, Math.random() * maxRight);
                    spawnY = 65; 
                } else { 
                    spawnX = Math.max(0, Math.random() * maxRight);
                    spawnY = canvas.height - size - 5; 
                }
                
                spawnX = Math.min(maxRight, spawnX); 

                if (Math.hypot(spawnX - this.player.x, spawnY - this.player.y) > 250) {
                    validSpawn = true;
                }
                attempts++;
            }
            if (!validSpawn) {
                spawnX = this.camera.x - 80; 
                spawnY = 80 + Math.random() * (canvas.height - 150);
            }
        }

        if ((actualType === 'warlord' || isAlpha || isBrood) && x === null) {
            spawnX = this.camera.x + canvas.width - 150;
            spawnY = Math.max(100, Math.min(canvas.height - 120, this.player.y - 40));
            let d = new Decal(spawnX + size/2, spawnY + size, '#111', 2.0);
            d.room = this.currentRoom;
            this.decals.push(d); 
        }

        let initialFacingRight = spawnX < this.player.x;
        let ax = anchorX === 0 ? (50 + Math.random() * Math.min(1500, this.worldWidth - 100)) : anchorX;
        let ay = anchorY === 0 ? (80 + Math.random() * (canvas.height - 150)) : anchorY;

        let z = new Zombie(spawnX, spawnY, hpPool, moveSpeed, actualType, ax, ay, size, initialFacingRight);
        
        if (isAlpha) {
            z.isAlpha = true;
            z.w = 60; z.h = 60; 
        }
        if (isBrood) {
            z.isBrood = true;
            z.w = 50; z.h = 50;
            z.speed = 1.8; 
        }

        z.room = this.currentRoom;
        this.enemies.push(z);
    }
    
    doAttack(isSpin) {
        let stamCost = isSpin ? this.player.specialCost : this.player.attackCost;
        if (this.gameMode === 'ENDLESS') stamCost *= UI.endlessConfig.stamDrain;
        
        let hasInf = this.hasInfiniteStamina() || (this.player.demonRushTimer > 0);
        if (this.player.stamina < stamCost && !hasInf) return;
        
        if (isSpin) this.spinCooldown = this.gameMode === 'ENDLESS' ? Math.floor(60 * UI.endlessConfig.spinCd) : 60; 
        this.player.isAttacking = true; this.player.isSpinning = isSpin; this.player.attackTimer = isSpin ? 20 : 15; sfx.sfxSwing();
        if (!hasInf) this.player.stamina -= stamCost;
        if (this.state === 'TUTORIAL') { if (this.tutPhase === 9 && isSpin) { this.tutPhase = 10; this.tutTimer = 60; sfx.sfxLore(); } }

        let bmMult = this.isSiege ? 2 : 1; 
        let hitbox = isSpin ? { x: this.player.x - (40*bmMult), y: this.player.y - (20*bmMult), w: 120*bmMult, h: 80*bmMult } 
                            : { x: this.player.facingRight ? this.player.x + 30 : this.player.x - 30, y: this.player.y - 10, w: 40, h: 60 };
        
        if (isSpin) { 
            for(let i=0; i<20; i++) this.createParticle(this.player.x+20, this.player.y+20, '#fff', this.currentRoom); 
            this.shake = 8; 
        }
        
        let pDmg = (isSpin ? 30 : this.player.dmg) * (this.isSiege ? 3 : 1);
        let pKb = (isSpin ? 60 : 20) * (this.isSiege ? 3 : 1);
        
        this.processHits(hitbox, pDmg, pKb, isSpin); 
    }

    processHits(hitbox, damage, knockbackDist, isSpin = false) {
        let originX = this.player.x;

        if (['PLAYING', 'TUTORIAL', 'SUNRISE'].includes(this.state) || (this.state === 'TUTORIAL' && this.tutPhase >= 7)) {
            if (this.currentRoom === 'HUB' && this.rectIntersect(hitbox.x, hitbox.y, hitbox.w, hitbox.h, this.dummy.x, this.dummy.y, 40, 40)) {
                this.dummy.hits++; 
                
                for(let i=0; i<5; i++) this.createParticle(this.dummy.x+20, this.dummy.y+20, '#d2b48c', 'HUB'); 
                this.shake = Math.max(this.shake, 2); sfx.sfxHit();
                
                if (this.dummy.hits >= this.dummy.hitsNeeded) {
                    this.dummy.hits = 0; this.dummy.level++; this.dummy.hitsNeeded = Math.floor(this.dummy.hitsNeeded * 1.5); 
                    this.player.maxStamina += 15; this.player.stamina = this.player.maxStamina;
                    this.player.dmg += 2;
                    for(let i=0; i<30; i++) this.createParticle(originX+20, this.player.y+20, '#ffcc00', 'HUB'); 
                    this.createFloatText(originX+20, this.player.y-20, "STAMINA & DMG UP!", "#ffcc00", 'HUB'); 
                    this.shake = 10; sfx.sfxLevelUp();
                    if (this.state === 'TUTORIAL' && this.tutPhase === 8) { this.tutPhase = 9; this.tutTimer = 60; sfx.sfxLore(); }
                }
            }
        }

        this.enemies.forEach(z => {
            if (z.room !== this.currentRoom || z.spawnTimer > 0 || z.isCasting > 0) return; 
            if (this.rectIntersect(hitbox.x, hitbox.y, hitbox.w, hitbox.h, z.x, z.y, z.w, z.h)) {
                
                this.combo++; 
                this.comboTimer = 180;
                
                let isBoar = z.type === 'boar';
                let comboMult = this.combo >= 25 ? 1.5 : (this.combo >= 10 ? 1.2 : 1.0);
                let actualDamage = Math.ceil(damage * comboMult);

                if (isBoar && z.state !== 'stunned' && z.state !== 'flee') {
                    actualDamage = Math.ceil(actualDamage * 0.15); 
                    z.hp -= actualDamage;
                } else {
                    z.hp -= actualDamage;
                    if (isBoar && z.state === 'stunned') z.playerDamagedDuringStun = true; 
                }
                
                // PHASE 3 VAMPIRISM PERK 
                if (this.player.hasVampirism && this.combo >= 15 && actualDamage > 0) {
                    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
                    if (Math.random() < 0.2) this.createParticle(originX+20, this.player.y+20, '#ff1744', this.currentRoom);
                }
                
                z.hitTimer = 4; sfx.sfxHit();
                
                if (!isBoar && z.type !== 'fish') z.aggroTarget = this.player; 
                
                // No more generic siege aggro during peaceful night
                if (this.isSiege && !this.peacefulNight && z.type !== 'spitter' && z.type !== 'warlord' && !z.isBrood && z.type !== 'fish') { z.aggroTimer = 480; }
                
                if (this.gameMode === 'ENDLESS' && UI.endlessConfig.lifesteal > 0 && z.hp > 0 && z.type !== 'fish') {
                    this.player.hp = Math.min(this.player.maxHp, this.player.hp + UI.endlessConfig.lifesteal);
                }

                let direction = (z.x + (z.w/2)) > (originX + 20) ? 1 : -1;
                let actualKnockback = z.type === 'brute' ? knockbackDist / 4 : (this.isSiege ? knockbackDist * 2 : knockbackDist);
                if (z.type === 'warlord') actualKnockback = knockbackDist / 6; 
                if (z.isAlpha) actualKnockback = isSpin ? knockbackDist / 6 : 0; // Alpha Brute Immunity
                
                if (this.gameMode === 'ENDLESS') actualKnockback *= UI.endlessConfig.knockback;

                if (isBoar && (z.state === 'windup' || z.state === 'charge' || z.state === 'flee' || z.state !== 'stunned')) {
                    actualKnockback = 0; 
                }

                z.x += direction * actualKnockback; 
                
                let yMax = (this.currentRoom === 'RIVER' && z.type !== 'fish') ? 160 : canvas.height - z.h - 5;
                let yMin = (z.type === 'fish') ? 200 : 65;
                z.y = Math.max(yMin, Math.min(yMax, z.y));
                
                let isFleeingBoar = (isBoar && z.state === 'flee');
                if (!isFleeingBoar) {
                    z.x = Math.max(0, Math.min(this.worldWidth - z.w, z.x));
                }

                let pColor = z.type === 'spitter' ? '#cddc39' : (isBoar ? '#795548' : (z.type === 'fish' ? '#00e5ff' : '#d32f2f'));
                for(let i=0; i<8; i++) this.createParticle(z.x+20, z.y+20, pColor, this.currentRoom); 
                
                let dmgColor = comboMult >= 1.5 ? "#ff1744" : (comboMult >= 1.2 ? "#ffea00" : "#fff");
                this.createFloatText(z.x+20, z.y, `-${actualDamage}`, dmgColor, this.currentRoom); 
                
                this.shake = Math.max(this.shake, z.type === 'brute' ? 8 : (z.type === 'warlord' ? 12 : 4)); 
                
                if (z.hp <= 0 && !z.handledDeath) {
                    z.handledDeath = true; 
                    
                    if (z.type === 'fish') {
                        this.dropLoot(z.x, z.y, 'food', this.currentRoom);
                        this.createFloatText(z.x+10, z.y, "CATCH!", "#00e5ff", this.currentRoom);
                    }
                    else if (isBoar) {
                        for(let i=0; i<2; i++) {
                            this.dropLoot(z.x + (Math.random()*20-10), z.y + (Math.random()*20-10), 'food', this.currentRoom);
                        }
                        this.createFloatText(Math.max(10, Math.min(this.worldWidth-40, z.x))+20, z.y, "HUNTED!", "#ffcc00", this.currentRoom);
                    }
                    else if (z.isAlpha) {
                        this.dropLoot(z.x, z.y, 'orb_momentum', this.currentRoom);
                        this.createFloatText(z.x+20, z.y, "ALPHA SLAIN!", "#00e5ff", this.currentRoom);
                        this.shake = 20; sfx.sfxExplode();
                        this.peacefulNight = true; this.isSiege = false;
                        this.createFloatText(this.player.x+20, this.player.y-60, "THE HORDE SCATTERS...", "#ffeb3b", this.currentRoom);
                        this.enemies.forEach(ez => { 
                            if (ez !== z && ez.type !== 'boar' && ez.type !== 'fish') { 
                                ez.hp = 0; 
                                for(let i=0; i<10; i++) this.createParticle(ez.x+20, ez.y+20, '#555', this.currentRoom);
                            } 
                        });
                    }
                    else if (z.isBrood) {
                        this.dropLoot(z.x, z.y, 'orb_vampirism', this.currentRoom);
                        this.createFloatText(z.x+20, z.y, "BROODMOTHER SLAIN!", "#ff1744", this.currentRoom);
                        this.shake = 20; sfx.sfxExplode();
                        this.peacefulNight = true; this.isSiege = false;
                        this.createFloatText(this.player.x+20, this.player.y-60, "THE HORDE SCATTERS...", "#ffeb3b", this.currentRoom);
                        this.enemies.forEach(ez => { 
                            if (ez !== z && ez.type !== 'boar' && ez.type !== 'fish') { 
                                ez.hp = 0; 
                                for(let i=0; i<10; i++) this.createParticle(ez.x+20, ez.y+20, '#555', this.currentRoom);
                            } 
                        });
                    }
                    else if (z.type === 'warlord') { 
                        this.shake = 30; sfx.sfxExplode(); 
                        for(let i=0; i<100; i++) this.createParticle(z.x+40, z.y+40, '#d32f2f', this.currentRoom); 
                        
                        if (this.gameMode === 'SURVIVAL' && this.dayCount === 21 && this.isSiege && this.state === 'PLAYING') {
                            this.triggerSunrise();
                        } else if (this.gameMode === 'ENDLESS') {
                            for(let i=0; i<5; i++) {
                                this.dropLoot(z.x + (Math.random()*60-30), z.y + (Math.random()*60-30), 'food', this.currentRoom);
                                this.dropLoot(z.x + (Math.random()*60-30), z.y + (Math.random()*60-30), 'bandage', this.currentRoom);
                            }
                            this.createFloatText(z.x+40, z.y, "BOSS DEFEATED!", "#ffcc00", this.currentRoom);
                            this.peacefulNight = true; this.isSiege = false;
                            this.createFloatText(this.player.x+20, this.player.y-60, "THE HORDE SCATTERS...", "#ffeb3b", this.currentRoom);
                            this.enemies.forEach(ez => { 
                                if (ez !== z && ez.type !== 'boar' && ez.type !== 'fish') { 
                                    ez.hp = 0; 
                                    for(let i=0; i<10; i++) this.createParticle(ez.x+20, ez.y+20, '#555', this.currentRoom);
                                } 
                            });
                        }
                    } else {
                        let c = new Corpse(z, direction);
                        c.room = this.currentRoom;
                        this.corpses.push(c); 
                        
                        let dCol = z.type === 'spitter' ? 'rgba(150, 200, 0, 0.4)' : 'rgba(120, 0, 0, 0.5)';
                        let d = new Decal(z.x + z.w/2, z.y + z.h, dCol, z.type === 'brute' ? 1.5 : 1.0);
                        d.room = this.currentRoom;
                        this.decals.push(d);
                        
                        if (this.gameMode === 'ENDLESS' && UI.endlessConfig.explodeZ) {
                            let dp = new DamagePool(z.x, z.y, 240); dp.room = this.currentRoom;
                            this.damagePools.push(dp);
                            for(let i=0; i<20; i++) this.createParticle(z.x+20, z.y+20, '#cddc39', this.currentRoom); 
                            sfx.sfxExplode();
                        }
                        
                        if (this.state === 'PLAYING' && Math.random() < 0.25) {
                            this.dropLoot(z.x, z.y, 'blood', this.currentRoom);
                        }
                    }

                    if (z.burning && actualDamage >= 30 && !isBoar && z.type !== 'fish') {
                        for(let i=0; i<40; i++) this.createParticle(z.x+20, z.y+20, '#ff9900', this.currentRoom); 
                        this.createFloatText(z.x+20, z.y-10, "COMBUSTION!", "#ff9900", this.currentRoom); 
                        this.shake = Math.max(this.shake, 15); sfx.sfxExplode();
                        let d2 = new Decal(z.x + z.w/2, z.y + z.h, 'rgba(20, 20, 20, 0.6)', 2.0);
                        d2.room = this.currentRoom;
                        this.decals.push(d2); 
                        
                        this.enemies.forEach(ez => { 
                            if (ez.room === this.currentRoom && ez !== z && Math.hypot(ez.x - z.x, ez.y - z.y) < 120) { 
                                ez.hp -= 50; ez.burning = true; this.createFloatText(ez.x+20, ez.y, "-50", "#ff9900", this.currentRoom); 
                            } 
                        });
                    }
                    
                    if (!isBoar && z.type !== 'fish') {
                        let dropChance = this.gameMode === 'ENDLESS' ? UI.endlessConfig.bandageDrop : 0.10;
                        if (this.player.hp < this.player.maxHp * 0.3 && this.gameMode !== 'ENDLESS') dropChance = 0.25; 
                        
                        if (this.combo >= 25) dropChance *= 1.5;

                        if (Math.random() < dropChance) {
                            this.dropLoot(z.x, z.y, 'bandage', this.currentRoom);
                        }
                    }
                }
            }
        });
    }

    triggerSunrise() {
        this.state = 'SUNRISE'; this.sunriseTimer = 300; this.announceTimer = 300;
        this.announceText = "SUNRISE"; this.subAnnounceText = "The Warlord burns!";
        this.enemies.forEach(z => { if(z.type !== 'boar' && z.type !== 'fish') z.burning = true; });
        localStorage.setItem('lastDojoEndlessUnlocked', 'true'); localStorage.setItem('lastDojoEpilogueUnlocked', 'true');
    }

    startEpilogue() { sfx.sfxVictory(); this.state = 'EPILOGUE'; this.epiPhase = 0; this.epiTimer = 150; }

    startRun(mode) {
        sfx.init(); 
        this.gameMode = mode; 
        
        UI.hideAllMenus();
        UI.showTouchUI();
        localStorage.setItem('lastDojoPlayed', 'true'); 
        
        this.timeTimer = 5400; this.isDay = true; this.dayCount = 1; this.food = 0; this.sleepFade = 0;
        this.isSiege = false; this.peacefulNight = false; this.shake = 0; this.paused = false; this.announceTimer = 0; this.hitStop = 0;
        this.subAnnounceText = ""; this.spinCooldown = 0; this.damageFlash = 0;
        this.dojo.hp = this.gameMode === 'ENDLESS' ? UI.endlessConfig.dojoHp : 300; 
        this.dojo.maxHp = this.dojo.hp; this.dummy.hits = 0; this.dummy.level = 1; this.dummy.hitsNeeded = 15;
        this.frames = 0; 
        
        this.combo = 0; this.comboTimer = 0;

        this.generateScenery(); 
        this.resetEntities();
        
        this.phaseDur = this.gameMode === 'ENDLESS' ? 5400 * UI.endlessConfig.phaseLen : 5400;
        this.timeTimer = this.phaseDur;

        this.state = 'PLAYING'; 
        this.spawnBoars();
    }

    startTutorial() {
        sfx.init(); 
        this.gameMode = 'TUTORIAL';
        UI.hideAllMenus(); UI.showTouchUI();
        localStorage.setItem('lastDojoPlayed', 'true'); 
        
        this.isDay = true; this.food = 0; this.sleepFade = 0; this.isSiege = false; this.peacefulNight = false; this.shake = 0; this.paused = false; this.hitStop = 0;
        this.subAnnounceText = ""; this.spinCooldown = 0; this.damageFlash = 0;
        this.dojo.hp = 300; this.dojo.maxHp = 300; this.dummy.hits = 0;
        this.frames = 0; 
        
        this.combo = 0; this.comboTimer = 0;

        this.generateScenery(); this.resetEntities();
        this.state = 'TUTORIAL'; this.tutPhase = 0; this.tutTimer = 180;
        this.player.hp = 1000; this.player.maxHp = 1000; this.player.stamina = 100; this.player.fatigue = 0;
        this.dummy.hitsNeeded = 5; 
    }

    restartGame() { 
        if (this.state === 'VICTORY') this.startRun('SURVIVAL'); 
        else if (this.gameMode === 'TUTORIAL') this.startTutorial(); 
        else this.startRun(this.gameMode); 
    }

    updateTutorialLogic() {
        if (this.tutTimer > 0) this.tutTimer--;
        let kU = Input.getDisplayKey(Input.userKeys.up); let kL = Input.getDisplayKey(Input.userKeys.left); let kD = Input.getDisplayKey(Input.userKeys.down); let kR = Input.getDisplayKey(Input.userKeys.right);
        let kP = Input.getDisplayKey(Input.userKeys.punch); let kS = Input.getDisplayKey(Input.userKeys.spin); let kE = Input.getDisplayKey(Input.userKeys.sleep); let kEat = Input.getDisplayKey(Input.userKeys.eat);

        switch(this.tutPhase) {
            case 0: this.tutText = "For centuries, our bloodline guarded the seal beneath this Dojo."; if (this.tutTimer <= 0) { this.tutPhase = 1; this.tutTimer = 180; } break;
            case 1: this.tutText = "But time weakened the earth. The plague seeped out, raising the dead..."; if (this.tutTimer <= 0) { this.tutPhase = 2; this.tutTimer = 180; } break;
            case 2: 
                if (this.tutTimer === 179) { sfx.sfxWarlordRoar(); this.shake = 30; }
                this.tutText = "*KRRR-GAAAHH!* A massive tremor shakes the Dojo..."; 
                if (this.tutTimer <= 0) { this.tutPhase = 3; this.tutTimer = 240; } 
                break;
            case 3: this.tutText = "The Warlord. An avatar of the plague building its body deep below."; if (this.tutTimer <= 0) { this.tutPhase = 4; this.tutTimer = 180; } break;
            case 4: this.tutText = "It requires immense lunar energy to manifest. For now, we prepare."; if (this.tutTimer <= 0) { this.tutPhase = 5; this.tutTimer = 180; } break;
            case 5: this.tutText = "You are the last Master. You alone keep the Dojo standing."; if (this.tutTimer <= 0) { this.tutPhase = 6; this.tutTimer = 180; } break;
            case 6: this.tutText = "The dead burn in the sunlight. But the nights are long."; if (this.tutTimer <= 0) { this.tutPhase = 7; this.tutTimer = 30; } break;
            case 7: this.tutText = Input.isTouchDevice ? "Use the Virtual Joystick to move." : `Use ${kU}, ${kL}, ${kD}, ${kR} to move.`; if (this.tutTimer <= 0 && this.player.isMoving) { this.tutPhase = 8; this.tutTimer = 30; sfx.sfxLore(); } break;
            case 8: this.tutText = Input.isTouchDevice ? "Punch the training dummy to increase Max Stamina! (Tap PUNCH)" : `Punch the training dummy to increase Max Stamina! (${kP} to Punch)`; break;
            case 9: this.tutText = Input.isTouchDevice ? "When surrounded, the Hurricane creates space. (Tap SPIN)" : `When surrounded, the Hurricane creates space. (${kS} to Spin)`; break;
            case 10: this.tutText = "Attacks drain Stamina (Blue). Without it, you are defenseless. Exhaust it."; if (this.player.stamina <= 30) { this.tutPhase = 11; this.tutTimer = 120; sfx.sfxLore(); this.player.fatigue = 90; } break;
            case 11: this.tutText = "Notice how slow Stamina recovers? It depends on your Fatigue (Red)."; 
                if (this.tutTimer <= 0) { 
                    this.tutPhase = 12; this.tutTimer = 60; sfx.sfxLore(); 
                    let bx = this.player.x + 200; let by = this.player.y;
                    let boar = new Zombie(bx, by, 70, 2.5, 'boar', bx, by, 50, false);
                    boar.room = 'HUB'; this.enemies.push(boar);
                } break;
            case 12: this.tutText = "You are exhausted. Hunt the Boar for meat."; if (this.food > 0) { this.tutPhase = 13; this.tutTimer = 60; sfx.sfxLore(); } break;
            case 13: 
                this.tutText = Input.isTouchDevice ? "Eat the meat to reduce your Fatigue. (Tap EAT)" : `Eat the meat to reduce your Fatigue. (Press ${kEat} to Eat)`; 
                if (Input.keys.eat && Input.rReady) { 
                    this.food--; this.player.fatigue = 0; 
                    this.createFloatText(this.player.x+20, this.player.y, "+FOOD", "#44aa44", 'HUB');
                    Input.rReady = false; this.tutPhase = 14; this.tutTimer = 60; sfx.sfxLore(); this.player.hp = 500; 
                    this.food++; 
                    this.createFloatText(this.player.x+20, this.player.y-20, "+1 BONUS MEAT", "#ffcc00", 'HUB');
                } 
                break;
            case 14: this.tutText = Input.isTouchDevice ? "Rest near the Dojo to heal HP. Costs 1 Meat. (Tap REST)" : `Rest near the Dojo to heal HP. Costs 1 Meat. (Press ${kE} near Dojo)`; if (keys.sleep && Input.eReady && Math.abs(this.player.x - this.dojo.x) < 60 && Math.abs(this.player.y - this.dojo.y) < 60 && this.food > 0) { this.food--; this.player.hp = 1000; this.sleepFade = 60; Input.eReady = false; this.tutPhase = 15; this.tutTimer = 120; sfx.sfxLore(); } break;
            case 15: 
                this.tutText = "Night falls. The dead hunt the living! Survive!"; 
                this.isDay = false; this.isSiege = false; 
                if (this.tutTimer === 60) { this.spawnZombie(null, null, 'night'); this.spawnZombie(null, null, 'night'); } 
                if (this.tutTimer <= 0 && this.enemies.length === 0) { this.tutPhase = 16; this.tutTimer = 180; sfx.sfxLore(); } 
                break;
            case 16: this.tutText = "But every 7th night, a Blood Moon rises!"; if (this.tutTimer <= 0) { this.tutPhase = 17; this.tutTimer = 180; sfx.sfxLore(); } break;
            case 17: 
                this.tutText = "They ignore you! Attack them to draw their aggro!"; 
                this.isSiege = true;
                if (this.tutTimer === 120) { this.spawnZombie(null, null, 'night'); this.spawnZombie(null, null, 'night'); } 
                if (this.tutTimer <= 0 && this.enemies.length === 0) { 
                    this.tutPhase = 18; this.tutTimer = 180; sfx.sfxLore(); 
                    this.player.mutationGlow = 180; this.player.maxHp += 50; this.player.hp = this.player.maxHp; 
                    sfx.sfxLevelUp(); this.createFloatText(this.player.x+20, this.player.y-40, "MUTATION: MAX HP UP!", "#d32f2f", 'HUB'); 
                    this.isSiege = false; this.isDay = true;
                } 
                break;
            case 18: this.tutText = "...surviving its radiation mutates your blood, making you stronger."; if (this.tutTimer <= 0) { this.tutPhase = 19; this.tutTimer = 180; sfx.sfxLore(); } break;
            case 19: this.tutText = "Your awakening is complete. Now, survive the true nightmare."; if (this.tutTimer <= 0) { localStorage.setItem('lastDojoPrologueDone', 'true'); this.state = 'START'; UI.showMainMenu(); } break;
        }
    }

    updateEpilogueLogic() {
        if (this.epiTimer > 0) this.epiTimer--;
        if (this.epiTimer <= 0) {
            if (this.epiPhase < this.epiLines.length - 1) { this.epiPhase++; this.epiTimer = 150; } 
            else { this.state = 'START'; UI.showMainMenu(); }
        }
    }

    update() {
        if (this.state === 'EPILOGUE') { this.updateEpilogueLogic(); return; }
        if (!['PLAYING', 'TUTORIAL', 'SUNRISE'].includes(this.state)) return;
        
        if (this.sleepFade > 0) { 
            this.sleepFade--; 
            if (this.sleepFade === 30 && this.state === 'PLAYING') {
                this.timeTimer = 0; 
                this.mounds.forEach(m => {
                    if (m.state === 'planted_day') m.state = 'bloomed';
                    else if (m.state === 'planted_night') m.state = 'planted_day';
                });
            }
            return; 
        }

        if (this.hitStop > 0) { this.hitStop--; return; } 
        if (this.damageFlash > 0) this.damageFlash--;

        const keys = Input.keys;
        
        this.activePrompt = { text: '', action: null, target: null };

        if (this.state === 'PLAYING') {
            if (this.player.stunTimer > 0) {
                this.player.stunTimer--;
                this.player.isMoving = false;
                this.player.isAttacking = false;
            } else {
                let prevSkull = Math.floor(this.player.infection);
                this.player.infection += 0.00006; 
                
                if (Math.floor(this.player.infection) > prevSkull && prevSkull < 3) {
                    this.player.stunTimer = 90; 
                    sfx.sfxFrustratedGroan();
                    this.shake = 15;
                    this.damageFlash = 30;
                    this.createFloatText(this.player.x+20, this.player.y-20, "SHATTERED BLOOD!", "#d32f2f", this.currentRoom);
                }
                if (this.player.infection >= 3.0) {
                    this.player.hp = 0; 
                }
            }

            let inSanctuary = (this.currentRoom === 'HUB' && this.player.x > 1750);
            if (inSanctuary) {
                this.player.sanctuaryBurn = Math.min(1200, (this.player.sanctuaryBurn || 0) + 1);
                if (this.player.sanctuaryBurn >= 420 && this.frames % 10 === 0) {
                    let overstayFrames = this.player.sanctuaryBurn - 420;
                    let burnDmg = 1 + Math.floor(overstayFrames / 60); 
                    
                    this.player.hp = Math.max(0, this.player.hp - burnDmg);
                    this.shake = Math.max(this.shake, 2);
                    this.createParticle(this.player.x + 20 + (Math.random()*20-10), this.player.y + 20, '#55ff55', this.currentRoom);
                    this.createFloatText(this.player.x + 20, this.player.y, `-${burnDmg} (Poison)`, "#55ff55", this.currentRoom);
                }
            } else {
                this.player.sanctuaryBurn = Math.max(0, (this.player.sanctuaryBurn || 0) - 0.25);
            }
        }

        this.frames++;
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer <= 0) this.combo = 0;
        }

        if (this.player.demonRushTimer > 0) this.player.demonRushTimer--;
        if (this.spinCooldown > 0) this.spinCooldown--; 
        if (this.player.iFrames > 0) this.player.iFrames--;
        if (this.player.mutationGlow > 0) this.player.mutationGlow--; 

        this.decals.forEach(d => { if (d.room === this.currentRoom) d.update(); }); 
        this.decals = this.decals.filter(d => d.life > 0);
        
        let oldHp = this.player.hp;
        let pFeetX = this.player.x + 20; let pFeetY = this.player.y + 35;
        
        this.damagePools.forEach(dp => {
            if (dp.room !== this.currentRoom) return;
            dp.update();
            if (this.player.iFrames <= 0) {
                let dx = pFeetX - dp.x; let dy = pFeetY - dp.y;
                if (((dx*dx)/(25*25) + (dy*dy)/(12*12)) <= 1) {
                    let pDmg = 10;
                    if (this.gameMode === 'ENDLESS' && UI.endlessConfig.ohk) pDmg = 9999;
                    this.player.hp = Math.max(0, this.player.hp - pDmg); 
                    this.combo = 0; 
                    this.shake = Math.max(this.shake, 2); this.player.iFrames = 15; sfx.sfxHit();
                }
            }
        });
        this.damagePools = this.damagePools.filter(dp => dp.life > 0);
        if (this.player.hp < oldHp) this.damageFlash = 30;

        if (this.hasInfiniteStamina()) this.player.stamina = this.player.maxStamina;

        if (this.state === 'SUNRISE') {
            this.sunriseTimer--;
            this.enemies.forEach(z => { 
                if (z.room !== this.currentRoom) return;
                if (z.type !== 'boar' && z.type !== 'fish') z.burning = true; 
                if (z.type === 'warlord') {
                    if (this.sunriseTimer > 50) {
                        if (this.sunriseTimer % 15 === 0) { 
                            this.shake = 8; sfx.sfxExplode(); 
                            for(let i=0; i<40; i++) this.createParticle(z.x + Math.random() * z.w, z.y + Math.random() * z.h, '#ff9900', this.currentRoom);
                        }
                    } else if (this.sunriseTimer === 50) { z.hp = 0; }
                } else { if(z.type !== 'boar' && z.type !== 'fish') z.hp -= 5; }
            }); 
            if (this.sunriseTimer <= 0) UI.showVictory();
        } else if (this.state === 'TUTORIAL') {
            this.updateTutorialLogic();
        } else {
            this.timeTimer--; 
            
            if (!this.isSiege && this.player.stunTimer <= 0) {
                if (this.player.isMoving || this.player.isAttacking) {
                    this.player.fatigue = Math.min(100, this.player.fatigue + 0.03);
                }
            }
            
            if (this.isDay && this.state === 'PLAYING') {
                if (this.currentRoom === 'FOREST') {
                    let activeBoars = this.enemies.filter(z => z.type === 'boar' && z.hp > 0).length;
                    if (activeBoars < 3 && Math.random() < 0.005) {
                        let bx = this.camera.x + (Math.random() > 0.5 ? canvas.width + 100 : -100);
                        bx = Math.max(0, Math.min(this.worldWidth, bx));
                        let by = 80 + Math.random() * (canvas.height - 150);
                        let boar = new Zombie(bx, by, 70, 2.5, 'boar', bx, by, 50, true);
                        boar.room = 'FOREST';
                        this.enemies.push(boar);
                    }
                } else if (this.currentRoom === 'RIVER') {
                    let activeFish = this.enemies.filter(z => z.type === 'fish' && z.hp > 0).length;
                    if (activeFish < 4 && Math.random() < 0.01) {
                        this.spawnFish();
                    }
                }
            }

            if (this.timeTimer <= 0) { 
                this.mounds.forEach(m => {
                    if (m.state === 'planted_day') m.state = 'bloomed';
                    else if (m.state === 'planted_night') m.state = 'planted_day';
                });

                if (this.gameMode === 'SURVIVAL' && this.dayCount === 21 && !this.isDay) { this.triggerSunrise(); return; }

                this.timeTimer = this.phaseDur; 
                this.isDay = !this.isDay; 
                this.announceTimer = 180; 
                this.subAnnounceText = "";

                if (this.isDay) {
                    this.dayCount++; this.isSiege = false; this.announceText = "DAY " + this.dayCount;
                    this.peacefulNight = false;

                    if (this.gameMode === 'ENDLESS' && UI.endlessConfig.lavaMode) {
                        let dp = new DamagePool(Math.random()*this.worldWidth, 70 + Math.random()*(canvas.height - 90), 999999);
                        dp.room = this.currentRoom;
                        this.damagePools.push(dp);
                        let lavaCount = this.damagePools.filter(d => d.life > 100000).length;
                        if (lavaCount > 30) { let oldestLavaIdx = this.damagePools.findIndex(d => d.life > 100000); if (oldestLavaIdx > -1) this.damagePools.splice(oldestLavaIdx, 1); }
                    }

                    this.spawnBoars();

                    this.enemies.forEach(z => { if (z.type !== 'straggler' && z.type !== 'boar' && z.type !== 'fish') z.burning = true; });
                    this.projectiles = []; this.corpses = []; 
                    this.damagePools = this.damagePools.filter(dp => dp.life > 100000); 
                    
                    // KEEP ORBS AT SUNRISE, PURGE OLD SURVIVAL LOOT
                    this.loot = this.loot.filter(l => l.type.startsWith('orb_')); 
                    
                    if (this.gameMode === 'ENDLESS' && UI.endlessConfig.dojoRegen) { 
                        this.dojo.hp = Math.min(this.dojo.maxHp, this.dojo.hp + (this.dojo.maxHp * 0.25)); 
                        for(let i=0; i<20; i++) this.createParticle(this.dojo.x+30, this.dojo.y+20, '#4caf50', 'HUB'); 
                    }

                } else {
                    
                    let forcedOut = false;
                    let conditionLoss = 0;
                    let staminaLoss = 0;
                    
                    this.enemies = this.enemies.filter(z => z.type !== 'fish');
                    
                    if (this.currentRoom === 'FOREST' || this.currentRoom === 'RIVER') {

                        let pSpeed = this.player.speed * (this.gameMode === 'ENDLESS' ? UI.endlessConfig.pSpeed : 1);
                        let distToDojo = Math.hypot((this.dojo.x + 30) - (this.player.x + 20), (this.dojo.y + 20) - (this.player.y + 20));
                        let framesToReturn = Math.floor(distToDojo / pSpeed);
                        
                        conditionLoss = (framesToReturn / 60) * 1.5; 
                        staminaLoss = (framesToReturn / 60) * 5; 
                        
                        this.player.fatigue = Math.min(100, this.player.fatigue + conditionLoss);
                        this.player.stamina = Math.max(0, this.player.stamina - staminaLoss);
                        
                        forcedOut = this.currentRoom;
                        this.changeRoom('HUB');
                        this.player.x = this.dojo.x;
                        this.player.y = this.dojo.y + 40;
                        this.camera.x = Math.max(0, Math.min(this.worldWidth - canvas.width, this.player.x - (canvas.width / 2)));
                    }

                    // BUG FIX: Ensure Orbs are not deleted when forced out of the Forest at night!
                    this.loot = this.loot.filter(l => l.room === 'HUB' || l.type.startsWith('orb_'));

                    this.enemies.forEach(z => { if (z.type === 'straggler') z.type = 'night'; });
                    
                    let bmTrigger = this.dayCount % 7 === 0;
                    if (this.gameMode === 'ENDLESS') bmTrigger = this.dayCount % UI.endlessConfig.bmFreq === 0;

                    if (bmTrigger) { 
                        this.isSiege = true; this.dojo.hp = this.dojo.maxHp; this.announceText = "BLOOD MOON SIEGE"; 
                        if (this.dayCount === 21 && this.gameMode === 'SURVIVAL') { 
                            this.subAnnounceText = "FINE. I WILL TEAR IT DOWN MYSELF."; this.spawnZombie(null, null, 'warlord'); 
                        } 
                        else if (this.gameMode === 'ENDLESS' && this.dayCount % UI.endlessConfig.bossFreq === 0) {
                            this.subAnnounceText = "THE HORDE RETURNS."; let warlordCount = Math.min(UI.endlessConfig.bossCap, 1 + Math.floor((this.dayCount - UI.endlessConfig.bossFreq) / 14));
                            for(let w=0; w<warlordCount; w++) this.spawnZombie(null, null, 'warlord');
                        } else {
                            sfx.sfxWarlordRoar(); this.shake = 15;
                            // Alternating Alpha / Broodmother for Endless Mode
                            if (this.dayCount % 14 === 7) {
                                this.subAnnounceText = "THE ALPHA AWAKENS."; 
                                this.spawnZombie(null, null, 'alpha'); 
                            } else {
                                this.subAnnounceText = "THE BROODMOTHER RISES.";
                                this.spawnZombie(null, null, 'brood'); 
                            }
                        }
                    } else { this.announceText = "NIGHT " + this.dayCount; }

                    if (forcedOut) {
                        this.shake = 15; sfx.sfxYeet();
                        let msg = forcedOut === 'FOREST' ? "THE BEASTS AWOKE!" : "THE DROWNED ROSE!";
                        this.createFloatText(this.player.x + 20, this.player.y - 40, msg, "#ff0000", 'HUB');
                        this.createFloatText(this.player.x + 20, this.player.y - 20, "Retreated to the safety of the Dojo.", "#ffcc00", 'HUB');
                        if (conditionLoss > 0) {
                            this.createFloatText(this.player.x + 20, this.player.y, `+${Math.floor(conditionLoss)} FATIGUE`, "#ff0000", 'HUB');
                        }
                    }
                }
            }
            if (this.announceTimer > 0) this.announceTimer--;

            let maxEndlessZ = this.gameMode === 'ENDLESS' ? UI.endlessConfig.maxZ : 25;
            let activeZombies = this.enemies.filter(z => (z.room === this.currentRoom && z.type !== 'straggler' && z.type !== 'warlord') && z.hp > 0).length;
            let maxZombies = this.isSiege ? 15 : Math.min(maxEndlessZ, 8 + (this.dayCount * 2)); 
            let baseSpawn = this.gameMode === 'ENDLESS' ? 0.02 * UI.endlessConfig.spawnRate : 0.02;
            let spawnRate = this.isSiege ? 0.05 : baseSpawn + (this.dayCount * 0.005);
            
            if (!this.isDay && !this.peacefulNight && this.announceTimer <= 0 && activeZombies < maxZombies && Math.random() < spawnRate) {
                this.spawnZombie(null, null, 'night');
            }
        }

        let currentAttackCost = this.isSiege ? 0 : this.player.attackCost; let currentSpecialCost = this.isSiege ? 0 : this.player.specialCost;
        let hasInf = this.hasInfiniteStamina() || (this.player.demonRushTimer > 0);

        if ((keys.punch || Input.mouse.left) && !this.player.isAttacking && this.player.stunTimer <= 0 && (this.player.stamina >= currentAttackCost || hasInf)) this.doAttack(false);
        if ((keys.spin || Input.mouse.right) && !this.player.isAttacking && this.player.stunTimer <= 0 && (this.player.stamina >= currentSpecialCost || hasInf) && this.spinCooldown <= 0) { this.doAttack(true); Input.shiftReady = false; }
        
        if (keys.eat && Input.rReady && this.state !== 'TUTORIAL' && !this.isSiege && this.player.stunTimer <= 0) { 
            if (this.food > 0) {
                this.food--; 
                let fatHeal = 50 + Math.floor(Math.random() * 26);
                this.player.fatigue = Math.max(0, this.player.fatigue - fatHeal); 
                let healAmount = Math.floor(this.player.maxHp * 0.15); 
                let actualHeal = Math.min(this.player.maxHp - this.player.hp, healAmount);
                this.player.hp += actualHeal;
                this.createFloatText(this.player.x+20, this.player.y, `+${actualHeal} HP / -${fatHeal} FATIGUE`, "#44aa44", this.currentRoom); 
            }
            Input.rReady = false; 
        }

        let pSpeed = this.player.speed;
        if (this.gameMode === 'ENDLESS') pSpeed *= UI.endlessConfig.pSpeed;
        if (this.player.demonRushTimer > 0) pSpeed *= 1.5;
        
        if (this.currentRoom === 'RIVER' && this.player.y > 180) {
            pSpeed *= 0.6; 
        }

        if (this.player.stunTimer <= 0) {
            this.player.isMoving = (keys.left || keys.right || keys.up || keys.down);
            
            if (keys.left && !keys.right) { this.player.x -= pSpeed; this.player.facingRight = false; }
            if (keys.right && !keys.left) { this.player.x += pSpeed; this.player.facingRight = true; }
            if (keys.up && !keys.down) this.player.y -= pSpeed;
            if (keys.down && !keys.up) this.player.y += pSpeed;
        } else {
            this.player.isMoving = false;
        }
        
        let pMaxY = canvas.height - this.player.size - 5;
        let pMinY = 65;

        if (this.currentRoom === 'HUB' && this.player.x > 1750) {
            pMinY = 100;
            pMaxY = canvas.height - this.player.size - 40;
        } 

        this.player.x = Math.max(0, Math.min(this.worldWidth - this.player.size, this.player.x)); 
        this.player.y = Math.max(pMinY, Math.min(pMaxY, this.player.y)); 

        if (this.state === 'PLAYING') {
            if (this.currentRoom === 'HUB') {
                if (this.isDay) {
                    if (this.player.y <= 70 && keys.up && this.player.x < 1700) {
                        this.changeRoom('FOREST');
                        this.player.x = this.dojo.x;
                        this.player.y = canvas.height - this.player.size - 15;
                    }
                    else if (this.player.y >= canvas.height - this.player.size - 10 && keys.down && this.player.x < 1700) {
                        this.changeRoom('RIVER');
                        this.player.x = this.dojo.x;
                        this.player.y = 75;
                    }
                }
            } else if (this.currentRoom === 'FOREST') {
                if (this.player.y >= canvas.height - this.player.size - 10 && keys.down) {
                    this.changeRoom('HUB');
                    this.player.x = this.dojo.x; 
                    this.player.y = this.dojo.y - 50; 
                }
            } else if (this.currentRoom === 'RIVER') {
                if (this.player.y <= 70 && keys.up) {
                    this.changeRoom('HUB');
                    this.player.x = this.dojo.x; 
                    this.player.y = this.dojo.y + 50; 
                }
            }
        }

        let screenCenterX = this.player.x - this.camera.x;
        let dzLeft = (canvas.width / 2) - (this.camera.deadzoneW / 2);
        let dzRight = (canvas.width / 2) + (this.camera.deadzoneW / 2);
        if (screenCenterX > dzRight) this.camera.x = this.player.x - dzRight;
        else if (screenCenterX < dzLeft) this.camera.x = this.player.x - dzLeft;
        this.camera.x = Math.max(0, Math.min(this.worldWidth - canvas.width, this.camera.x));

        let regenRate = 0.1 + ((100 - this.player.fatigue) / 100) * 1.5; 
        if ((!this.player.isAttacking || this.player.hasMomentum) && this.player.stamina < this.player.maxStamina && !this.hasInfiniteStamina() && this.player.stunTimer <= 0) {
            this.player.stamina += regenRate;
        }

        let pK = Input.isTouchDevice ? "REST" : Input.getDisplayKey(Input.userKeys.sleep);

        if (this.currentRoom === 'HUB' && this.player.x > 1800) {
            for (let m of this.mounds) {
                if (Math.hypot((this.player.x+20) - (m.x+25), (this.player.y+20) - (m.y+15)) < 60) {
                    if (m.state === 'empty' && this.player.demonBlood > 0) {
                        this.activePrompt = { text: `Press [${pK}] to Plant Blood`, action: 'plant', target: m };
                    } else if (m.state === 'bloomed') {
                        this.activePrompt = { text: `Press [${pK}] to Harvest Cure`, action: 'harvest', target: m };
                    }
                    break;
                }
            }
        } else if (this.currentRoom === 'HUB' && this.isDay && Math.abs(this.player.x - this.dojo.x) < 60 && Math.abs(this.player.y - this.dojo.y) < 60 && this.state !== 'TUTORIAL') {
            this.activePrompt = { text: `Press [${pK}] to Sleep (1 Meat)`, action: 'sleep' };
        } 
        
        if (this.player.demonBlood > 0 && !this.activePrompt.action) {
            if (this.player.infection >= 2.0) {
                this.activePrompt = { text: `Infection too high!`, action: null };
            } else {
                this.activePrompt = { text: `Press [${pK}] to Drink Blood`, action: 'drink' };
            }
        }

        if (keys.sleep && Input.eReady) {
            if (this.activePrompt.action) {
                Input.eReady = false;
                
                if (this.activePrompt.action === 'sleep') {
                    if (this.food > 0) {
                        this.food--;
                        let timeRemainingPct = this.timeTimer / this.phaseDur; 
                        let healAmount = Math.floor(this.player.maxHp * (0.1 + (timeRemainingPct * 0.4))); 
                        this.player.fatigue = 0; 
                        this.player.sanctuaryBurn = 0;
                        this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
                        for(let i=0; i<15; i++) this.createParticle(this.player.x+15, this.player.y+15, '#44aa44', 'HUB'); 
                        this.createFloatText(this.player.x+20, this.player.y, `+${healAmount} HP`, "#44aa44", 'HUB');
                        this.createFloatText(this.player.x+20, this.player.y-20, "-1 MEAT", "#ffcc00", 'HUB');
                        this.sleepFade = 60; 
                    } else { this.createFloatText(this.player.x+20, this.player.y, "NEED MEAT!", "#d32f2f", 'HUB'); }
                } 
                else if (this.activePrompt.action === 'plant') {
                    this.player.demonBlood--;
                    this.activePrompt.target.state = this.isDay ? 'planted_day' : 'planted_night';
                    sfx.sfxLevelUp();
                    for(let i=0; i<10; i++) this.createParticle(this.activePrompt.target.x+25, this.activePrompt.target.y+15, '#d32f2f', 'HUB'); 
                }
                else if (this.activePrompt.action === 'harvest') {
                    this.activePrompt.target.state = 'empty';
                    this.player.infection = 0;
                    sfx.sfxVictory();
                    this.damageFlash = 30; 
                    this.createFloatText(this.player.x+20, this.player.y-20, "INFECTION CURED!", "#00e5ff", 'HUB');
                    for(let i=0; i<30; i++) this.createParticle(this.activePrompt.target.x+25, this.activePrompt.target.y+15, '#00e5ff', 'HUB'); 
                }
                else if (this.activePrompt.action === 'drink') {
                    let prevSkull = Math.floor(this.player.infection);
                    this.player.demonBlood--;
                    this.player.demonRushTimer = 360;
                    
                    let newInf = this.player.infection + 0.15;
                    if (newInf >= 3.0) {
                        this.player.infection = 2.99; 
                        this.player.stunTimer = 90; 
                        sfx.sfxFrustratedGroan();
                        this.shake = Math.max(this.shake, 15);
                        this.damageFlash = 30;
                        this.createFloatText(this.player.x+20, this.player.y-40, "SHATTERED BLOOD!", "#d32f2f", this.currentRoom);
                    } else {
                        this.player.infection = newInf;
                        if (Math.floor(this.player.infection) > prevSkull) {
                            this.player.stunTimer = 90; 
                            sfx.sfxFrustratedGroan();
                            this.shake = Math.max(this.shake, 15);
                            this.damageFlash = 30;
                            this.createFloatText(this.player.x+20, this.player.y-40, "SHATTERED BLOOD!", "#d32f2f", this.currentRoom);
                        } else {
                            sfx.sfxLore(); 
                            this.shake = Math.max(this.shake, 8);
                            for(let i=0; i<15; i++) this.createParticle(this.player.x+20, this.player.y+20, '#ff0000', this.currentRoom);
                            this.createFloatText(this.player.x+20, this.player.y-20, "DEMON RUSH!", "#ff0000", this.currentRoom);
                        }
                    }
                }
            } else if (this.player.demonBlood > 0 && this.player.infection < 2.0) {
                Input.eReady = false;
                let prevSkull = Math.floor(this.player.infection);
                this.player.demonBlood--;
                this.player.demonRushTimer = 360;
                
                let newInf = this.player.infection + 0.15;
                if (newInf >= 3.0) {
                    this.player.infection = 2.99; 
                    this.player.stunTimer = 90; 
                    sfx.sfxFrustratedGroan();
                    this.shake = Math.max(this.shake, 15);
                    this.damageFlash = 30;
                    this.createFloatText(this.player.x+20, this.player.y-40, "SHATTERED BLOOD!", "#d32f2f", this.currentRoom);
                } else {
                    this.player.infection = newInf;
                    if (Math.floor(this.player.infection) > prevSkull) {
                        this.player.stunTimer = 90; 
                        sfx.sfxFrustratedGroan();
                        this.shake = Math.max(this.shake, 15);
                        this.damageFlash = 30;
                        this.createFloatText(this.player.x+20, this.player.y-40, "SHATTERED BLOOD!", "#d32f2f", this.currentRoom);
                    } else {
                        sfx.sfxLore(); 
                        this.shake = Math.max(this.shake, 8);
                        for(let i=0; i<15; i++) this.createParticle(this.player.x+20, this.player.y+20, '#ff0000', this.currentRoom);
                        this.createFloatText(this.player.x+20, this.player.y-20, "DEMON RUSH!", "#ff0000", this.currentRoom);
                    }
                }
            } else if (this.player.demonBlood > 0 && this.player.infection >= 2.0) {
                Input.eReady = false;
                sfx.sfxFrustratedGroan();
                this.createFloatText(this.player.x+20, this.player.y-20, "INFECTION TOO HIGH!", "#d32f2f", this.currentRoom);
            }
        }

        this.loot.forEach((item, index) => {
            if (item.room !== this.currentRoom) return;
            if (this.rectIntersect(this.player.x, this.player.y, 40, 40, item.x, item.y, 30, 30)) {
                
                if (item.type === 'orb_momentum') {
                    this.player.hasMomentum = true;
                    this.player.maxHp += 50; this.player.hp = this.player.maxHp;
                    sfx.sfxLevelUp(); this.damageFlash = 20;
                    this.createFloatText(this.player.x+20, this.player.y-40, "AWAKENING: MOMENTUM!", "#00e5ff", this.currentRoom);
                    this.createFloatText(this.player.x+20, this.player.y-20, "+50 MAX HP", "#44aa44", this.currentRoom);
                } 
                else if (item.type === 'orb_vampirism') {
                    this.player.hasVampirism = true;
                    this.player.maxHp += 50; this.player.hp = this.player.maxHp;
                    sfx.sfxLevelUp(); this.damageFlash = 20;
                    this.createFloatText(this.player.x+20, this.player.y-40, "AWAKENING: VAMPIRISM!", "#ff1744", this.currentRoom);
                    this.createFloatText(this.player.x+20, this.player.y-20, "+50 MAX HP", "#44aa44", this.currentRoom);
                }
                else if (item.type === 'bandage') { 
                    let healAmount = Math.floor(this.player.maxHp * 0.25);
                    let heal = Math.min(this.player.maxHp - this.player.hp, healAmount); 
                    this.player.hp += heal; 
                    for(let i=0; i<15; i++) this.createParticle(this.player.x+15, this.player.y+15, '#44aa44', this.currentRoom); 
                    if (heal > 0) this.createFloatText(this.player.x+20, this.player.y, `+${heal}`, "#44aa44", this.currentRoom);
                } 
                else if (item.type === 'food') { 
                    this.food++; 
                } 
                else if (item.type === 'blood') {
                    this.player.demonBlood++;
                    sfx.sfxLore();
                    this.createFloatText(this.player.x+20, this.player.y-10, "+1 BLOOD", "#d32f2f", this.currentRoom);
                }
                this.loot.splice(index, 1); 
            }
        });

        this.projectiles.forEach((p, index) => {
            if (p.room !== this.currentRoom || p.markedForDeletion) return;
            
            p.update(); 
            let exploded = false;
            
            if (this.player.isAttacking && this.player.isSpinning && !p.reflected) {
                if (Math.hypot((this.player.x + 20) - p.x, (this.player.y + 20) - p.y) < 70) {
                    p.vx *= -1.5; p.vy *= -1.5; p.reflected = true; p.life = 250;
                    for(let i=0; i<10; i++) this.createParticle(p.x, p.y, '#00ffff', this.currentRoom); 
                    this.createFloatText(p.x, p.y-10, "PARRY!", "#00ffff", this.currentRoom); 
                    this.shake = Math.max(this.shake, 5); if (this.hitStop <= 0) { this.hitStop = 3; sfx.sfxParry(); }
                }
            }
            
            let pHurtbox = { x: this.player.x + 10, y: this.player.y + 5, w: 20, h: 30 };
            if (!p.reflected && this.player.iFrames <= 0 && this.rectIntersect(p.x - 5, p.y - 5, 10, 10, pHurtbox.x, pHurtbox.y, pHurtbox.w, pHurtbox.h)) exploded = true;
            
            if (!exploded) { 
                this.enemies.forEach(z => { 
                    if (z.hp > 0 && z.room === this.currentRoom && z !== p.owner && this.rectIntersect(p.x - 5, p.y - 5, 10, 10, z.x, z.y, z.w, z.h)) {
                        exploded = true; 
                    }
                }); 
            }
            
            if (p.life <= 0) exploded = true; 

            if (exploded && !p.markedForDeletion) {
                p.markedForDeletion = true; 
                
                for(let i=0; i<20; i++) this.createParticle(p.x, p.y, p.reflected ? '#00ffff' : '#cddc39', this.currentRoom); 
                sfx.sfxExplode();
                let d = new Decal(p.x, p.y, p.reflected ? 'rgba(0, 255, 255, 0.3)' : 'rgba(150, 200, 0, 0.4)', 1.5);
                d.room = this.currentRoom;
                this.decals.push(d);
                
                if (!p.reflected) { 
                    let dp = new DamagePool(p.x, p.y, 240); dp.room = this.currentRoom;
                    this.damagePools.push(dp); 
                }

                if (Math.hypot((this.player.x + 20) - p.x, (this.player.y + 20) - p.y) < 50 && this.player.iFrames <= 0) {
                    let pDmg = 10;
                    if (this.gameMode === 'ENDLESS') { if (UI.endlessConfig.ohk) pDmg = 9999; else pDmg = Math.floor(10 * UI.endlessConfig.zDamage); }
                    this.player.hp = Math.max(0, this.player.hp - pDmg); 
                    this.combo = 0; 
                    this.player.fatigue = Math.min(100, this.player.fatigue + 5); 
                    this.createFloatText(this.player.x+20, this.player.y, `-${pDmg} (Toxic)`, "#cddc39", this.currentRoom); 
                    this.shake = Math.max(this.shake, 5); this.player.iFrames = 45;
                }
                
                this.enemies.forEach(z => {
                    if (z.hp > 0 && z.room === this.currentRoom && Math.hypot((z.x + z.w/2) - p.x, (z.y + z.h/2) - p.y) < 60) {
                        let dmg = p.reflected ? 60 : 20; 
                        
                        let isBoar = z.type === 'boar';
                        let actualDamage = dmg;

                        if (isBoar && z.state !== 'stunned' && z.state !== 'flee') {
                            actualDamage = Math.ceil(dmg * 0.15); 
                            z.hp -= actualDamage;
                        } else {
                            z.hp -= actualDamage;
                            if (isBoar && z.state === 'stunned') z.playerDamagedDuringStun = true; 
                        }

                        this.createFloatText(z.x + (z.w/2), z.y, `-${actualDamage}`, p.reflected ? "#00ffff" : "#cddc39", this.currentRoom);
                        if (!p.reflected && p.owner && p.owner !== z && p.owner.hp > 0 && z.type !== 'boar' && z.type !== 'fish') { z.aggroTarget = p.owner; z.aggroTimer = 480; }
                        
                        if(z.hp <= 0 && !z.handledDeath) { 
                            z.handledDeath = true; 
                            
                            if (z.type === 'fish') {
                                this.dropLoot(z.x, z.y, 'food', this.currentRoom);
                                this.createFloatText(z.x+10, z.y, "CATCH!", "#00e5ff", this.currentRoom);
                            }
                            else if (z.type === 'boar') {
                                for(let i=0; i<2; i++) {
                                    this.dropLoot(z.x + (Math.random()*20-10), z.y + (Math.random()*20-10), 'food', this.currentRoom);
                                }
                                this.createFloatText(Math.max(10, Math.min(this.worldWidth-40, z.x))+20, z.y, "HUNTED!", "#ffcc00", this.currentRoom);
                            }
                            else if (z.isAlpha) {
                                this.dropLoot(z.x, z.y, 'orb_momentum', this.currentRoom);
                                this.createFloatText(z.x+20, z.y, "ALPHA SLAIN!", "#00e5ff", this.currentRoom);
                                this.shake = 20; sfx.sfxExplode();
                                this.peacefulNight = true; this.isSiege = false;
                                this.createFloatText(this.player.x+20, this.player.y-60, "THE HORDE SCATTERS...", "#ffeb3b", this.currentRoom);
                                this.enemies.forEach(ez => { 
                                    if (ez !== z && ez.type !== 'boar' && ez.type !== 'fish') { 
                                        ez.hp = 0; 
                                        for(let i=0; i<10; i++) this.createParticle(ez.x+20, ez.y+20, '#555', this.currentRoom);
                                    } 
                                });
                            }
                            else if (z.isBrood) {
                                this.dropLoot(z.x, z.y, 'orb_vampirism', this.currentRoom);
                                this.createFloatText(z.x+20, z.y, "BROODMOTHER SLAIN!", "#ff1744", this.currentRoom);
                                this.shake = 20; sfx.sfxExplode();
                                this.peacefulNight = true; this.isSiege = false;
                                this.createFloatText(this.player.x+20, this.player.y-60, "THE HORDE SCATTERS...", "#ffeb3b", this.currentRoom);
                                this.enemies.forEach(ez => { 
                                    if (ez !== z && ez.type !== 'boar' && ez.type !== 'fish') { 
                                        ez.hp = 0; 
                                        for(let i=0; i<10; i++) this.createParticle(ez.x+20, ez.y+20, '#555', this.currentRoom);
                                    } 
                                });
                            }
                            else if (z.type === 'warlord') { 
                                this.shake = 30; sfx.sfxExplode(); 
                                for(let i=0; i<100; i++) this.createParticle(z.x+40, z.y+40, '#d32f2f', this.currentRoom); 
                                
                                if (this.gameMode === 'SURVIVAL' && this.dayCount === 21 && this.isSiege && this.state === 'PLAYING') {
                                    this.triggerSunrise();
                                } else if (this.gameMode === 'ENDLESS') {
                                    for(let i=0; i<5; i++) {
                                        this.dropLoot(z.x + (Math.random()*60-30), z.y + (Math.random()*60-30), 'food', this.currentRoom);
                                        this.dropLoot(z.x + (Math.random()*60-30), z.y + (Math.random()*60-30), 'bandage', this.currentRoom);
                                    }
                                    this.createFloatText(z.x+40, z.y, "BOSS DEFEATED!", "#ffcc00", this.currentRoom);
                                    this.peacefulNight = true; this.isSiege = false;
                                    this.createFloatText(this.player.x+20, this.player.y-60, "THE HORDE SCATTERS...", "#ffeb3b", this.currentRoom);
                                    this.enemies.forEach(ez => { 
                                        if (ez !== z && ez.type !== 'boar' && ez.type !== 'fish') { 
                                            ez.hp = 0; 
                                            for(let i=0; i<10; i++) this.createParticle(ez.x+20, ez.y+20, '#555', this.currentRoom);
                                        } 
                                    });
                                }
                            } else {
                                let c = new Corpse(z, p.vx > 0 ? 1 : -1); c.room = this.currentRoom;
                                this.corpses.push(c); 
                                
                                let dc = new Decal(z.x + z.w/2, z.y + z.h, z.type === 'spitter' ? 'rgba(150, 200, 0, 0.4)' : 'rgba(120, 0, 0, 0.5)', z.type === 'brute' ? 1.5 : 1.0);
                                dc.room = this.currentRoom;
                                this.decals.push(dc);
                                
                                if (this.gameMode === 'ENDLESS' && UI.endlessConfig.explodeZ) {
                                    let dp = new DamagePool(z.x, z.y, 240); dp.room = this.currentRoom;
                                    this.damagePools.push(dp);
                                    for(let i=0; i<20; i++) this.createParticle(z.x+20, z.y+20, '#cddc39', this.currentRoom); 
                                    sfx.sfxExplode();
                                }
                                
                                if (this.state === 'PLAYING' && Math.random() < 0.25) {
                                    this.dropLoot(z.x, z.y, 'blood', this.currentRoom);
                                }
                            }
                        }
                    }
                });
            }
        });
        
        this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);

        this.enemies.forEach(z => {
            if (z.room !== this.currentRoom) return;

            let isStunnedBoar = (z.type === 'boar' && z.state === 'stunned');
            let isFleeingBoar = (z.type === 'boar' && z.state === 'flee');

            let enemyMaxY = (this.currentRoom === 'RIVER' && z.type !== 'fish') ? 160 : canvas.height - z.h - 5;
            let enemyMinY = (z.type === 'fish') ? 200 : 65;
            z.y = Math.max(enemyMinY, Math.min(enemyMaxY, z.y));
            
            if (!isFleeingBoar) {
                z.x = Math.max(0, Math.min(this.worldWidth - z.w, z.x));
            }

            if (this.currentRoom === 'HUB' && z.x + z.w > 1800) {
                z.x = 1800 - z.w; 
                z.patrolDir = -1; 
            }

            let playerInSanctuary = (this.currentRoom === 'HUB' && this.player.x > 1750);
            let repelled = (playerInSanctuary && z.type !== 'boar' && z.type !== 'fish');
            let repelForced = (repelled && z.x > 1650);

            if (repelled) {
                z.aggroTarget = null;
                z.aggroTimer = 0;
                z.isChasing = false;
            }

            if (z.isCasting > 0) {
                z.isCasting--;
                if (z.isCasting === 1 && z.type === 'warlord') {
                    this.shake = 20; sfx.sfxExplode();
                    for(let i=0; i<3; i++) { 
                        let dp = new DamagePool(this.player.x + (Math.random()*100 - 50), this.player.y + (Math.random()*100 - 50), 300);
                        dp.room = this.currentRoom;
                        this.damagePools.push(dp); 
                    }
                    for(let i=0; i<40; i++) this.createParticle(z.x+z.w/2, z.y+z.h, '#d32f2f', this.currentRoom); 
                    this.createFloatText(z.x+z.w/2, z.y-10, "ERUPTION!", "#d32f2f", this.currentRoom);
                }
                return; 
            }

            if (z.type === 'warlord' && z.specialTimer > 0 && this.state === 'PLAYING') { z.specialTimer--; if (z.specialTimer <= 0) { z.isCasting = 60; z.specialTimer = 300; } }

            if (z.spawnTimer > 0) { 
                z.spawnTimer--; 
                if (z.spawnTimer % 5 === 0) {
                    for(let i=0; i<5; i++) this.createParticle(z.x + z.w/2 + (Math.random()*40-20), z.y + z.h, Math.random() > 0.5 ? '#5d4037' : '#333333', this.currentRoom);
                    if (z.type === 'warlord' && z.spawnTimer % 20 === 0) this.shake = Math.max(this.shake, 5); 
                }
                return; 
            } 
            
            if (z.burning) { 
                if (z.type === 'warlord' && this.state === 'SUNRISE') { return; } 
                else { z.hp -= (z.type === 'warlord' ? 0 : 3); if (Math.random() < 0.2) this.createParticle(z.x+20, z.y+20, '#ff9900', this.currentRoom); }
                
                if (z.hp <= 0 && !z.handledDeath) { 
                    z.handledDeath = true;
                    
                    if (z.isAlpha) {
                        this.dropLoot(z.x, z.y, 'orb_momentum', this.currentRoom);
                        this.createFloatText(z.x+20, z.y, "ALPHA BURNED!", "#00e5ff", this.currentRoom);
                        this.shake = 20; sfx.sfxExplode();
                    } 
                    else if (z.isBrood) {
                        this.dropLoot(z.x, z.y, 'orb_vampirism', this.currentRoom);
                        this.createFloatText(z.x+20, z.y, "BROODMOTHER BURNED!", "#ff1744", this.currentRoom);
                        this.shake = 20; sfx.sfxExplode();
                    }
                    else if (z.type === 'warlord') { 
                        this.shake = 30; sfx.sfxExplode(); 
                        for(let i=0; i<200; i++) this.createParticle(z.x+40, z.y+40, '#ff9900', this.currentRoom); 
                        
                        // ENDLESS MODE: Warlord dropping loot on Burn Death
                        if (this.gameMode === 'ENDLESS') {
                            for(let i=0; i<5; i++) {
                                this.dropLoot(z.x + (Math.random()*60-30), z.y + (Math.random()*60-30), 'food', this.currentRoom);
                                this.dropLoot(z.x + (Math.random()*60-30), z.y + (Math.random()*60-30), 'bandage', this.currentRoom);
                            }
                            this.createFloatText(z.x+40, z.y, "BOSS BURNED!", "#ffcc00", this.currentRoom);
                            this.peacefulNight = true; this.isSiege = false;
                            this.createFloatText(this.player.x+20, this.player.y-60, "THE HORDE SCATTERS...", "#ffeb3b", this.currentRoom);
                            this.enemies.forEach(ez => { 
                                if (ez !== z && ez.type !== 'boar' && ez.type !== 'fish') { 
                                    ez.hp = 0; 
                                    for(let i=0; i<10; i++) this.createParticle(ez.x+20, ez.y+20, '#555', this.currentRoom);
                                } 
                            });
                        }
                    } 
                    else { 
                        for(let i=0; i<30; i++) this.createParticle(z.x+20, z.y+20, '#444444', this.currentRoom); sfx.sfxHit(); 
                    }
                    let d = new Decal(z.x + z.w/2, z.y + z.h, 'rgba(20, 20, 20, 0.6)', z.type === 'warlord' ? 3.0 : 1.5);
                    d.room = this.currentRoom;
                    this.decals.push(d);
                } 
                return;
            }
            if (z.hp <= 0) return;

            if (z.biteTimer > 0) z.biteTimer--; if (z.hitTimer > 0) z.hitTimer--;
            else {
                let isBloodMoonDrone = (this.isSiege && !this.peacefulNight && z.type !== 'spitter' && z.type !== 'warlord' && !z.isBrood && z.type !== 'boar' && z.type !== 'fish');
                if (z.aggroTimer > 0 && !repelled) { z.aggroTimer--; isBloodMoonDrone = false; }

                let targetX = isBloodMoonDrone ? this.dojo.x + 30 + z.dojoOffsetX : this.player.x; 
                let targetY = isBloodMoonDrone ? this.dojo.y + 20 + z.dojoOffsetY : this.player.y;
                
                if (z.aggroTarget && !repelled) { if (z.aggroTarget.hp <= 0) z.aggroTarget = null; else { targetX = z.aggroTarget.x + z.aggroTarget.w/2; targetY = z.aggroTarget.y + z.aggroTarget.h/2; } }
                let distToTarget = Math.hypot(targetX - z.x, targetY - z.y); 
                let isOnScreen = (z.x > this.camera.x && z.x + z.w < this.camera.x + canvas.width && z.y > 0 && z.y + z.h < canvas.height); 
                let oldX = z.x, oldY = z.y;

                if (z.type === 'fish') {
                    if (z.panicBlind === undefined) z.panicBlind = 0;
                    if (!z.fishState) { z.fishState = 'wander'; z.fishTimer = 0; z.fAngle = 0; }
                    
                    let distToPlayer = Math.hypot((this.player.x + 20) - (z.x + 15), (this.player.y + 20) - (z.y + 10));
                    
                    if (distToPlayer < 120 && z.fishState !== 'flee') {
                        z.fishState = 'flee';
                        z.fishTimer = 60; 
                        z.fAngle = Math.atan2((z.y + 10) - (this.player.y + 20), (z.x + 15) - (this.player.x + 20));
                    }

                    if (z.fishState === 'flee') {
                        z.fishTimer--;
                        if (z.panicBlind > 0) z.panicBlind--;
                        
                        if (distToPlayer < 120 && z.fishTimer % 10 === 0 && z.panicBlind <= 0) {
                            z.fAngle = Math.atan2((z.y + 10) - (this.player.y + 20), (z.x + 15) - (this.player.x + 20));
                        }

                        let nextX = z.x + Math.cos(z.fAngle) * (z.speed * 1.5);
                        let nextY = z.y + Math.sin(z.fAngle) * (z.speed * 1.5);

                        let bounced = false;
                        if (nextX <= 10 || nextX >= this.worldWidth - z.w - 10) { z.fAngle = Math.PI - z.fAngle; bounced = true; }
                        if (nextY <= 210 || nextY >= canvas.height - z.h - 10) { z.fAngle = -z.fAngle; bounced = true; }
                        
                        if (bounced) {
                            z.fishTimer = 45; 
                            z.panicBlind = 30; 
                        }

                        z.x += Math.cos(z.fAngle) * (z.speed * 1.5);
                        z.y += Math.sin(z.fAngle) * (z.speed * 1.5);
                        
                        if (Math.abs(Math.cos(z.fAngle)) > 0.1) {
                            z.facingRight = Math.cos(z.fAngle) > 0;
                        }

                        if (this.frames % 5 === 0) this.createParticle(z.x + 15, z.y + 10, '#00ffff', this.currentRoom);

                        if (z.fishTimer <= 0 && distToPlayer > 150) {
                            z.fishState = 'wander';
                            z.anchorX = 50 + Math.random() * (this.worldWidth - 100);
                            z.anchorY = 220 + Math.random() * (canvas.height - 260);
                        }
                    } else {
                        let distToAnchor = Math.hypot(z.anchorX - z.x, z.anchorY - z.y);
                        if (distToAnchor < 20) {
                            z.anchorX = 50 + Math.random() * (this.worldWidth - 100);
                            z.anchorY = 220 + Math.random() * (canvas.height - 260);
                        }
                        let aAngle = Math.atan2(z.anchorY - z.y, z.anchorX - z.x);
                        z.x += Math.cos(aAngle) * (z.speed * 0.6);
                        z.y += Math.sin(aAngle) * (z.speed * 0.6);
                        z.facingRight = Math.cos(aAngle) > 0;
                    }
                }
                else if (z.type === 'boar') {
                    if (!z.state) z.state = 'idle';
                    if (!z.stateTimer) z.stateTimer = 0;

                    if (z.state === 'flee') {
                        z.x += z.fleeDir * z.speed * 2.0;
                        z.isMoving = true;
                        z.facingRight = z.fleeDir > 0;
                        if (this.frames % 5 === 0) this.createParticle(z.x+20, z.y+20, '#e6c280', this.currentRoom);
                        
                        if (z.x < -100 || z.x > this.worldWidth + 100) {
                            z.hp = 0; 
                            z.handledDeath = true; 
                        }
                    }
                    else if (z.state === 'charge') {
                        for (let other of this.enemies) {
                            if (other !== z && other.type === 'boar' && other.hp > 0 && !other.burning) {
                                if (this.rectIntersect(z.x, z.y, z.w, z.h, other.x, other.y, other.w, other.h)) {
                                    z.state = 'stunned'; z.stateTimer = 120; z.hp -= 25; z.playerDamagedDuringStun = false;
                                    other.state = 'stunned'; other.stateTimer = 120; other.hp -= 25; other.playerDamagedDuringStun = false;
                                    
                                    this.shake = Math.max(this.shake, 10); sfx.sfxHit();
                                    this.createFloatText(z.x+20, z.y-10, "-25", "#fff", this.currentRoom);
                                    this.createFloatText(other.x+20, other.y-10, "-25", "#fff", this.currentRoom);
                                    
                                    for(let i=0; i<10; i++) {
                                        this.createParticle(z.x+20, z.y+20, '#5d4037', this.currentRoom);
                                        this.createParticle(other.x+20, other.y+20, '#5d4037', this.currentRoom);
                                    }

                                    [z, other].forEach(b => {
                                        if (b.hp <= 0 && !b.handledDeath) {
                                            b.handledDeath = true;
                                            for(let k=0; k<2; k++) {
                                                this.dropLoot(b.x + (Math.random()*20-10), b.y + (Math.random()*20-10), 'food', this.currentRoom);
                                            }
                                            this.createFloatText(Math.max(10, Math.min(this.worldWidth-40, b.x))+20, b.y, "HUNTED!", "#ffcc00", this.currentRoom);
                                        }
                                    });
                                }
                            }
                        }

                        z.x += z.chargeVx;
                        z.y += z.chargeVy;
                        z.isMoving = true;
                        
                        let stepDist = Math.hypot(z.chargeVx, z.chargeVy);
                        z.distanceTravelled += stepDist;

                        this.createParticle(z.x + z.w/2, z.y + z.h, '#e6c280', this.currentRoom); 
                        
                        let hitWall = (z.x <= 10 || z.x >= this.worldWidth - z.w - 10 || z.y <= 65 || z.y >= canvas.height - z.h - 5);
                        let hitTree = false;

                        if (this.currentRoom === 'FOREST') {
                            for (let t of this.forestTrees) {
                                if (Math.abs((z.x + z.w/2) - t.x) < 25 && Math.abs((z.y + z.h) - t.y) < 20) {
                                    hitTree = true;
                                    break;
                                }
                            }
                        }

                        if (hitTree || hitWall) {
                            z.state = 'stunned';
                            z.stateTimer = 120; 
                            z.playerDamagedDuringStun = false; 
                            z.hp -= 20; 
                            
                            this.shake = Math.max(this.shake, 12);
                            sfx.sfxExplode();
                            
                            this.createFloatText(z.x+20, z.y-10, "CRASH!", "#ff1100", this.currentRoom);

                            if (z.hp <= 0 && !z.handledDeath) {
                                z.handledDeath = true;
                                for(let i=0; i<2; i++) this.dropLoot(z.x + (Math.random()*20-10), z.y + (Math.random()*20-10), 'food', this.currentRoom);
                                this.createFloatText(Math.max(10, Math.min(this.worldWidth-40, z.x))+20, z.y, "HUNTED!", "#ffcc00", this.currentRoom);
                                
                                let d = new Decal(z.x + z.w/2, z.y + z.h, 'rgba(93, 64, 55, 0.6)', 1.2);
                                d.room = this.currentRoom;
                                this.decals.push(d);
                            }
                        } else if (z.distanceTravelled >= z.targetDistance) {
                            z.state = 'stunned';
                            z.stateTimer = 60; 
                            z.playerDamagedDuringStun = false; 
                            this.createFloatText(z.x+20, z.y-10, "?", "#fff", this.currentRoom);
                        }
                    } else if (z.state === 'stunned') {
                        z.stateTimer--;
                        z.isMoving = false;
                        if (this.frames % 10 === 0) this.createParticle(z.x + z.w/2, z.y, '#fff', this.currentRoom);
                        
                        if (z.stateTimer <= 0) {
                            if (z.playerDamagedDuringStun) {
                                z.state = 'flee';
                                z.fleeDir = (z.x < this.player.x) ? -1 : 1;
                                this.createFloatText(z.x+20, z.y-25, "FLEE!", "#ffcc00", this.currentRoom);
                            } else {
                                z.state = 'idle';
                            }
                        }
                    } else if (z.state === 'windup') {
                        z.stateTimer--;
                        z.isMoving = false;
                        z.x += (Math.random() - 0.5) * 4; 
                        
                        if (z.stateTimer <= 0) {
                            let los = this.hasLineOfSight(z.x+z.w/2, z.y+z.h/2, targetX, targetY);
                            if (los) {
                                z.state = 'charge';
                                
                                let initialDist = Math.hypot((this.player.x + 20) - (z.x + z.w/2), (this.player.y + 20) - (z.y + z.h/2));
                                z.targetDistance = initialDist + 60; 
                                z.distanceTravelled = 0;

                                let angle = Math.atan2((this.player.y+20) - (z.y+z.h/2), (this.player.x+20) - (z.x+z.w/2));
                                z.chargeVx = Math.cos(angle) * 16; 
                                z.chargeVy = Math.sin(angle) * 16;
                                z.facingRight = z.chargeVx > 0;
                            } else {
                                z.state = 'idle';
                                z.stateTimer = 20; 
                            }
                        }
                    } else {
                        if (distToTarget < 250 && Math.abs(z.y - targetY) < 100) { 
                            let los = this.hasLineOfSight(z.x+z.w/2, z.y+z.h/2, targetX, targetY);
                            if (los) {
                                z.state = 'windup';
                                z.stateTimer = 45; 
                                z.facingRight = targetX > z.x;
                                sfx.sfxFrustratedGroan(); 
                            } else {
                                let angle = Math.atan2(targetY - z.y, targetX - z.x);
                                z.x += Math.cos(angle) * z.speed * 0.8;
                                z.y += Math.sin(angle) * z.speed * 0.8;
                                z.facingRight = Math.cos(angle) > 0;
                                z.isMoving = true;
                            }
                        } else {
                            z.x += (z.speed * 0.5) * z.patrolDir;
                            if (z.x > z.anchorX + 150) z.patrolDir = -1; 
                            if (z.x < z.anchorX - 150) z.patrolDir = 1;
                            z.facingRight = z.patrolDir > 0;
                            z.isMoving = true;
                        }
                    }
                }
                else if (z.type === 'spitter') {
                    if (z.isBrood && distToTarget < 300 && !repelled) {
                        z.isChasing = false;
                        let fleeAngle = Math.atan2(z.y - targetY, z.x - targetX);
                        z.x += Math.cos(fleeAngle) * z.speed;
                        z.y += Math.sin(fleeAngle) * z.speed;
                        z.facingRight = targetX > z.x; 
                    }
                    else if (!z.aggroTarget && !repelled) {
                        if (distToTarget > 180) z.isChasing = false; else z.isChasing = true;
                    } else if (!repelled) { z.isChasing = true; }
                    else { z.isChasing = false; } 

                    if (z.shootTimer > 0) z.shootTimer--;
                    if ((distToTarget > 180 && !z.isBrood) || !isOnScreen || (!z.isChasing && !z.isBrood) || repelled) { 
                        if (!z.isChasing || repelled) {
                            if (repelForced) {
                                z.x -= z.speed;
                                z.facingRight = false;
                                z.isMoving = true;
                            } else {
                                let distToAnchor = Math.hypot(z.anchorX - z.x, z.anchorY - z.y);
                                if (distToAnchor < 20) {
                                    z.anchorX = 50 + Math.random() * 1550; 
                                    let zMaxYA = canvas.height - 70;
                                    z.anchorY = 70 + Math.random() * (zMaxYA - 70);
                                }
                                let aAngle = Math.atan2(z.anchorY - z.y, z.anchorX - z.x);
                                z.x += Math.cos(aAngle) * z.speed;
                                z.y += Math.sin(aAngle) * z.speed;
                                z.facingRight = Math.cos(aAngle) > 0;
                                z.isMoving = true;
                            }
                        } else {
                            if (z.x < targetX) z.x += z.speed; if (z.x > targetX) z.x -= z.speed; if (z.y < targetY) z.y += z.speed; if (z.y > targetY) z.y -= z.speed;
                        }
                    } else {
                        if (z.shootTimer <= 0) {
                            let aimY = isBloodMoonDrone ? targetY + 20 : targetY; 
                            let angle = Math.atan2(aimY - (z.y + 20), targetX - (z.x + 20));
                            
                            let p1 = new Projectile(z.x + 20, z.y + 20, Math.cos(angle) * 4, Math.sin(angle) * 4, z);
                            p1.room = this.currentRoom;
                            this.projectiles.push(p1);
                            
                            if (z.isBrood) {
                                let p2 = new Projectile(z.x + 20, z.y + 20, Math.cos(angle - 0.3) * 4, Math.sin(angle - 0.3) * 4, z);
                                let p3 = new Projectile(z.x + 20, z.y + 20, Math.cos(angle + 0.3) * 4, Math.sin(angle + 0.3) * 4, z);
                                p2.room = this.currentRoom; p3.room = this.currentRoom;
                                this.projectiles.push(p2, p3);
                            }
                            
                            z.shootTimer = z.isBrood ? 90 : 120; 
                            sfx.sfxSpit();
                        }
                    }
                    if(z.isChasing && !repelled) z.facingRight = targetX > z.x;
                } 
                else {
                    if (!isBloodMoonDrone && !z.aggroTarget && z.type !== 'warlord' && !repelled) {
                        if (distToTarget > 180) z.isChasing = false; else z.isChasing = true;
                    } else if (!repelled) { z.isChasing = true; }
                    else { z.isChasing = false; }

                    if (z.type === 'brute' && z.aggroTarget && z.aggroTarget.type === 'spitter') {
                        if (distToTarget < 60 && z.biteTimer <= 0) {
                            z.biteTimer = 60; z.aggroTarget.hp = 0; z.aggroTarget.handledDeath = true; this.hitStop = 4; sfx.sfxYeet();
                            let c = new Corpse(z.aggroTarget, z.facingRight ? 1 : -1, true); c.room = this.currentRoom;
                            this.corpses.push(c); 
                            this.createFloatText(z.x + 25, z.y - 20, "YEET!", "#ffcc00", this.currentRoom); this.shake = Math.max(this.shake, 15); z.aggroTarget = null;
                        }
                    } else if (z.aggroTarget && z.aggroTarget.type === 'spitter' && z.type !== 'warlord') {
                        if (distToTarget < 40 && z.biteTimer <= 0) {
                            z.biteTimer = 60; z.aggroTarget.hp -= 10;
                            for(let i=0; i<8; i++) this.createParticle(z.aggroTarget.x + 20, z.aggroTarget.y + 20, '#cddc39', this.currentRoom); 
                            this.createFloatText(z.aggroTarget.x + 20, z.aggroTarget.y, "-10", "#fff", this.currentRoom); sfx.sfxHit();
                            if (z.aggroTarget.hp <= 0 && !z.aggroTarget.handledDeath) {
                                z.handledDeath = true; 
                                let c = new Corpse(z.aggroTarget, z.facingRight ? 1 : -1); c.room = this.currentRoom;
                                this.corpses.push(c); 
                                let d = new Decal(z.aggroTarget.x + z.aggroTarget.w/2, z.aggroTarget.y + z.aggroTarget.h, 'rgba(150, 200, 0, 0.4)', 1.0);
                                d.room = this.currentRoom;
                                this.decals.push(d); z.aggroTarget = null;
                            }
                        }
                    }

                    if (!z.isChasing || repelled) {
                        if (repelForced) {
                            z.x -= z.speed;
                            z.facingRight = false;
                            z.isMoving = true;
                        } else {
                            let distToAnchor = Math.hypot(z.anchorX - z.x, z.anchorY - z.y);
                            if (distToAnchor < 20) {
                                z.anchorX = 50 + Math.random() * 1550; 
                                let zMaxYA = canvas.height - 70;
                                z.anchorY = 70 + Math.random() * (zMaxYA - 70);
                            }
                            let aAngle = Math.atan2(z.anchorY - z.y, z.anchorX - z.x);
                            z.x += Math.cos(aAngle) * z.speed;
                            z.y += Math.sin(aAngle) * z.speed;
                            z.facingRight = Math.cos(aAngle) > 0;
                            z.isMoving = true;
                        }
                    } else {
                        if (z.x < targetX) z.x += z.speed; 
                        if (z.x > targetX) z.x -= z.speed; 
                        if (z.y < targetY) z.y += z.speed; 
                        if (z.y > targetY) z.y -= z.speed;
                        z.facingRight = targetX > z.x;
                    }
                }

                if (z.type !== 'boar' && z.type !== 'fish') z.isMoving = (z.x !== oldX || z.y !== oldY);
                
                let enemyMaxY = (this.currentRoom === 'RIVER' && z.type !== 'fish') ? 160 : canvas.height - z.h - 5;
                let enemyMinY = (z.type === 'fish') ? 200 : 65;
                z.y = Math.max(enemyMinY, Math.min(enemyMaxY, z.y));
                
                let isStunnedBoar = (z.type === 'boar' && z.state === 'stunned');
                let isFleeingBoar = (z.type === 'boar' && z.state === 'flee');
                
                if (!isFleeingBoar) {
                    z.x = Math.max(0, Math.min(this.worldWidth - z.w, z.x));
                }

                let zBox = { x: z.x + 10, y: z.y + 10, w: z.w - 20, h: z.h - 20 }; 
                let pHurtbox = { x: this.player.x + 10, y: this.player.y + 5, w: 20, h: 30 };
                
                if (!z.burning && !isBloodMoonDrone && z.biteTimer <= 0 && this.player.iFrames <= 0 && this.rectIntersect(zBox.x, zBox.y, zBox.w, zBox.h, pHurtbox.x, pHurtbox.y, pHurtbox.w, pHurtbox.h) && z.type !== 'fish' && !isStunnedBoar && !isFleeingBoar) {
                    
                    if (z.type === 'boar' && z.state === 'charge' && this.player.isAttacking && this.player.isSpinning) {
                        z.state = 'stunned';
                        z.stateTimer = 150; 
                        z.playerDamagedDuringStun = false; 
                        z.hp -= 40;
                        z.biteTimer = 60;
                        this.shake = Math.max(this.shake, 15);
                        if (this.hitStop <= 0) this.hitStop = 5;
                        sfx.sfxParry();
                        this.createFloatText(z.x+20, z.y-10, "CLASH!", "#00ffff", this.currentRoom);
                        for(let i=0; i<20; i++) this.createParticle(z.x+20, z.y+20, '#00ffff', this.currentRoom);
                        
                        z.x += (z.x > this.player.x ? 40 : -40);
                        
                        if (z.hp <= 0 && !z.handledDeath) {
                            z.handledDeath = true;
                            for(let i=0; i<2; i++) this.dropLoot(z.x + (Math.random()*20-10), z.y + (Math.random()*20-10), 'food', this.currentRoom);
                            this.createFloatText(Math.max(10, Math.min(this.worldWidth-40, z.x))+20, z.y, "HUNTED!", "#ffcc00", this.currentRoom);
                            let d = new Decal(z.x + z.w/2, z.y + z.h, 'rgba(93, 64, 55, 0.6)', 1.2);
                            d.room = this.currentRoom;
                            this.decals.push(d);
                        }
                    } else if (this.player.iFrames <= 0) {
                        let dmg = z.type === 'brute' || z.isAlpha ? 20 : (z.type === 'warlord' ? 40 : (z.type === 'boar' ? 25 : 10)); 
                        if (this.gameMode === 'ENDLESS' && z.type !== 'warlord' && !z.isAlpha && !z.isBrood) dmg = Math.floor(dmg * UI.endlessConfig.zDamage);
                        if (this.gameMode === 'ENDLESS' && UI.endlessConfig.ohk) dmg = 9999;

                        this.player.hp = Math.max(0, this.player.hp - dmg); 
                        z.biteTimer = 60; this.player.iFrames = 45; 
                        this.combo = 0; 
                        
                        if (z.type === 'boar' && z.state === 'charge') {
                            z.state = 'stunned';
                            z.stateTimer = 60; 
                        }

                        for(let i=0; i<10; i++) this.createParticle(this.player.x+20, this.player.y+20, '#d32f2f', this.currentRoom); 
                        this.createFloatText(this.player.x+20, this.player.y, `-${dmg}`, "#d32f2f", this.currentRoom); this.shake = z.type === 'brute' ? 12 : (z.type === 'warlord' ? 20 : 6); sfx.sfxHit();
                        
                        if (z.type !== 'brute' && z.type !== 'warlord' && !z.isAlpha) { this.player.x = Math.max(0, Math.min(this.worldWidth - this.player.size, this.player.x + ((this.player.x < z.x) ? -15 : 15))); }
                    }
                }

                if (!z.burning && isBloodMoonDrone && z.biteTimer <= 0 && this.rectIntersect(zBox.x, zBox.y, zBox.w, zBox.h, this.dojo.x - 20, this.dojo.y - 20, this.dojo.w + 40, this.dojo.h + 40) && ['PLAYING', 'TUTORIAL'].includes(this.state)) {
                    let dDmg = 5;
                    if (this.gameMode === 'ENDLESS') { if (UI.endlessConfig.ohk) dDmg = 9999; else dDmg = Math.floor(5 * UI.endlessConfig.zDamage); }
                    this.dojo.hp = Math.max(0, this.dojo.hp - dDmg); 
                    z.biteTimer = 60; 
                    this.combo = 0; 
                    for(let i=0; i<5; i++) this.createParticle(this.dojo.x+30, this.dojo.y+20, '#1b5e20', this.currentRoom); 
                    this.createFloatText(this.dojo.x+30, this.dojo.y, `-${dDmg}`, "#ffcc00", this.currentRoom); this.shake = 3; sfx.sfxHit();
                }
            }
        });

        this.enemies = this.enemies.filter(z => z.hp > 0 || (z.type === 'warlord' && this.state === 'SUNRISE'));

        if (this.player.isAttacking) { this.player.attackTimer--; if (this.player.attackTimer <= 0) { this.player.isAttacking = false; this.player.isSpinning = false; } }

        if (this.player.hp < oldHp) this.damageFlash = 30;

        this.corpses.forEach(c => { if(c.room === this.currentRoom) c.update(canvas.height); });
        if (this.shake > 0) this.shake *= 0.9; if (this.shake < 0.5) this.shake = 0;
        this.particles.forEach(p => { if(p.room === this.currentRoom) p.update(canvas.height); });
        this.floatTexts.forEach(t => { if(t.room === this.currentRoom) t.update(); });

        this.projectiles = this.projectiles.filter(p => p.life > 0); 
        this.corpses = this.corpses.filter(c => c.life > 0);
        this.particles = this.particles.filter(p => p.life > 0); this.floatTexts = this.floatTexts.filter(t => t.life > 0);

        if ((this.player.hp <= 0 || this.dojo.hp <= 0 || this.player.infection >= 3.0) && ['PLAYING', 'SUNRISE', 'TUTORIAL'].includes(this.state)) {
            let wasTutorial = (this.state === 'TUTORIAL');
            this.saveScore(); 
            this.state = 'GAMEOVER'; 
            UI.showGameOver(this.dojo.hp <= 0, wasTutorial, this.dayCount);
        }
    }

    drawShadow(x, y, w, h = w) { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.ellipse(x + w/2, y + h - 5, w/2, 6, 0, 0, Math.PI*2); ctx.fill(); }

    drawTree(ctx, x, y, scale) {
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = "#3e2723"; 
        ctx.fillRect(x - 8*scale, y - 30*scale, 16*scale, 30*scale);
        
        ctx.fillStyle = "#1b5e20"; 
        ctx.beginPath();
        ctx.arc(x, y - 40*scale, 35*scale, 0, Math.PI*2); 
        ctx.fill();
        
        ctx.fillStyle = "#2e7d32"; 
        ctx.beginPath();
        ctx.arc(x - 15*scale, y - 50*scale, 25*scale, 0, Math.PI*2); 
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x + 15*scale, y - 45*scale, 20*scale, 0, Math.PI*2); 
        ctx.fill();
        
        ctx.fillStyle = "#4caf50"; 
        ctx.beginPath();
        ctx.arc(x - 5*scale, y - 60*scale, 15*scale, 0, Math.PI*2); 
        ctx.fill();
        ctx.restore();
    }

    drawSkullIcon(ctx, x, y, filled) {
        ctx.fillStyle = filled ? "#d32f2f" : "#444";
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI, true); ctx.fill();
        ctx.fillRect(x - 6, y, 12, 4); 
        ctx.fillRect(x - 4, y + 4, 8, 3); 
        ctx.fillStyle = "#111"; 
        ctx.fillRect(x - 4, y - 1, 3, 3);
        ctx.fillRect(x + 1, y - 1, 3, 3);
        ctx.fillRect(x - 1, y + 2, 2, 2); 
    }

    drawLighting() {
        let r=0, g=0, b=0, a=0;
        if (this.state === 'TUTORIAL') {
            if (this.isDay) { r=255; g=120; b=0; a=0.2; } else if (this.isSiege && !this.peacefulNight) { r=180; g=0; b=0; a=0.5; } else { r=0; g=0; b=40; a=0.6; }
        } else if (this.state === 'SUNRISE') {
            let pct = 1 - (this.sunriseTimer / 300); r = 180 + (75 * pct); g = 180 * pct; b = 0; a = 0.5 - (0.3 * pct);
        } else {
            let pct = this.timeTimer / this.phaseDur; 
            if (this.isDay) {
                if (pct > 0.75) { let f = (pct - 0.75) / 0.25; r=255; g=120; b=0; a = f * 0.4; } 
                else if (pct < 0.25) { let f = (0.25 - pct) / 0.25; r=255; g=60; b=0; a = f * 0.5; } 
            } else {
                if (this.isSiege && !this.peacefulNight) { r=180; g=0; b=0; a=0.5; } 
                else {
                    if (pct > 0.75) { let f = (pct - 0.75) / 0.25; r = 255 * f; g = 60 * f; b = 40 + (f * -40); a = 0.6 - (f * 0.1); } 
                    else if (pct < 0.25) { let f = (0.25 - pct) / 0.25; r = 255 * f; g = 120 * f; b = 40 + (f * -40); a = 0.6 - (f * 0.2); } 
                    else { r=0; g=0; b=40; a=0.6; }
                }
            }
        }
        let grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 200, canvas.width/2, canvas.height/2, canvas.width);
        grad.addColorStop(0, `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${a * 0.2})`);
        grad.addColorStop(1, `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${a})`);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (this.gameMode === 'ENDLESS' && UI.endlessConfig.pitchBlack) {
            ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(0,0,canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'destination-out';
            let pbX = this.player.x + 20 - this.camera.x;
            let pbGrad = ctx.createRadialGradient(pbX, this.player.y+20, 10, pbX, this.player.y+20, 130);
            pbGrad.addColorStop(0, 'rgba(255,255,255,1)'); pbGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = pbGrad; ctx.beginPath(); ctx.arc(pbX, this.player.y+20, 130, 0, Math.PI*2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save();
        if (this.shake > 0 && !this.paused) { let dx = (Math.random() - 0.5) * this.shake; let dy = (Math.random() - 0.5) * this.shake; ctx.translate(dx, dy); }
        ctx.translate(-this.camera.x, 0);
        if (this.currentRoom === 'HUB') {
            
            let sGrad = ctx.createLinearGradient(0, canvas.height - 80, 0, canvas.height - 40);
            sGrad.addColorStop(0, "rgba(230, 194, 128, 0)"); 
            sGrad.addColorStop(1, "rgba(230, 194, 128, 1)"); 
            ctx.fillStyle = sGrad;
            ctx.fillRect(0, canvas.height - 80, 1700, 40);

            ctx.fillStyle = "#e6c280"; 
            ctx.fillRect(0, canvas.height - 40, 1600, 40);
            let sandBlend = ctx.createLinearGradient(1600, 0, 1700, 0);
            sandBlend.addColorStop(0, "rgba(230, 194, 128, 1)");
            sandBlend.addColorStop(1, "rgba(230, 194, 128, 0)");
            ctx.fillStyle = sandBlend;
            ctx.fillRect(1600, canvas.height - 40, 100, 40);
            let blend = ctx.createLinearGradient(1700, 60, 1850, 60);
            blend.addColorStop(0, "rgba(139, 195, 74, 0)"); 
            blend.addColorStop(1, "rgba(139, 195, 74, 1)"); 
            ctx.fillStyle = blend;
            ctx.fillRect(1700, 60, 150, canvas.height - 60);
            ctx.fillStyle = "#8bc34a"; 
            ctx.fillRect(1850, 60, this.worldWidth - 1850, canvas.height - 60);
            this.sanctuaryFlora.forEach(f => {
                let sway = Math.sin(this.frames * 0.05 + f.x) * 2;
                ctx.save();
                ctx.translate(f.x + sway, f.y);
                if (f.type === 'rose') {
                    ctx.fillStyle = '#e91e63'; ctx.beginPath(); ctx.arc(0, 0, 4*f.s, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#fce4ec'; ctx.beginPath(); ctx.arc(0, 0, 1.5*f.s, 0, Math.PI*2); ctx.fill();
                } else if (f.type === 'sunflower') {
                    ctx.fillStyle = '#ffeb3b'; 
                    for(let i=0; i<5; i++){
                        ctx.beginPath(); ctx.ellipse(Math.cos(i)*4*f.s, Math.sin(i)*4*f.s, 3*f.s, 2*f.s, i, 0, Math.PI*2); ctx.fill();
                    }
                    ctx.fillStyle = '#3e2723'; ctx.beginPath(); ctx.arc(0, 0, 3*f.s, 0, Math.PI*2); ctx.fill();
                } else if (f.type === 'bluebell') {
                    ctx.fillStyle = '#42a5f5'; ctx.beginPath(); ctx.arc(0, 0, 3*f.s, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#1e88e5'; ctx.beginPath(); ctx.arc(0, 2*f.s, 3*f.s, 0, Math.PI*2); ctx.fill();
                } else if (f.type === 'lily') {
                    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 4*f.s, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(0, 0, 1.5*f.s, 0, Math.PI*2); ctx.fill();
                } else {
                    ctx.fillStyle = '#33691e'; ctx.beginPath(); ctx.ellipse(0, 0, 10*f.s, 6*f.s, 0, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#9ccc65'; ctx.beginPath(); ctx.ellipse(-2*f.s, -2*f.s, 6*f.s, 4*f.s, 0, 0, Math.PI*2); ctx.fill();
                }
                ctx.restore();
            });
            this.mounds.forEach(m => m.draw(ctx, this.frames));
            ctx.fillStyle = "#1b5e20"; 
            ctx.fillRect(0, 60, 1700, 15);
            ctx.fillStyle = "#2e7d32"; 
            for(let i=0; i<1700; i+=40) {
                ctx.beginPath(); ctx.ellipse(i, 70, 30, 20, 0, 0, Math.PI*2); ctx.fill();
            }
            
            for(let i=0; i<1700; i+=35) this.drawTree(ctx, i, 95, 1.2);
            for(let i=1750; i<=this.worldWidth; i+=40) {
                this.drawTree(ctx, i, 95, 1.2); 
            }
            this.scenery.forEach(s => {
                if (s.x > 1700) return;
                if(s.type === 'grass') { ctx.fillStyle = s.variant === 1 ? '#4caf50' : '#8bc34a'; ctx.globalAlpha = 0.3; ctx.fillRect(s.x, s.y, 4, 4); ctx.fillRect(s.x + 4, s.y - 4, 4, 4); ctx.globalAlpha = 1.0; } 
                else if (s.type === 'rock') { ctx.fillStyle = s.variant === 1 ? '#555' : '#777'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.5, s.r, 0, 0, Math.PI*2); ctx.fill(); }
            });
            ctx.fillStyle = "rgba(0, 0, 0, 0.15)"; ctx.beginPath(); ctx.ellipse(this.dojo.x + 30, this.dojo.y + 25, 80, 40, 0, 0, Math.PI*2); ctx.fill(); 
            if (this.isSiege && this.dojo.hp > 0 && ['PLAYING', 'TUTORIAL'].includes(this.state)) {
                ctx.save(); ctx.globalAlpha = 0.15 + Math.sin(this.frames * 0.1) * 0.05; ctx.fillStyle = '#ffcc00';
                ctx.beginPath(); ctx.ellipse(this.dojo.x + 30, this.dojo.y + 20, 150, 75, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
            }
            ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(this.dojo.x + 8, this.dojo.y + this.dojo.h - 5, 44, 10);
            ctx.drawImage(sprDojo, this.dojo.x, this.dojo.y);
            
            if (this.dojo.hp < this.dojo.maxHp * 0.5) {
                ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.dojo.x+20, this.dojo.y+15); ctx.lineTo(this.dojo.x+25, this.dojo.y+25); ctx.lineTo(this.dojo.x+15, this.dojo.y+35); ctx.stroke();
                if (this.dojo.hp < this.dojo.maxHp * 0.25) { ctx.beginPath(); ctx.moveTo(this.dojo.x+40, this.dojo.y+10); ctx.lineTo(this.dojo.x+35, this.dojo.y+20); ctx.lineTo(this.dojo.x+45, this.dojo.y+30); ctx.stroke(); if(Math.random()<0.1) this.particles.push(new Particle(this.dojo.x+30, this.dojo.y+20, '#ff5500')); }
            }
            if (this.isSiege && !this.peacefulNight && this.dojo.hp > 0 && this.state !== 'TUTORIAL') {
                ctx.fillStyle = "#222"; ctx.fillRect(this.dojo.x, this.dojo.y - 15, 60, 6); ctx.fillStyle = "#ffcc00"; ctx.fillRect(this.dojo.x, this.dojo.y - 15, (this.dojo.hp/this.dojo.maxHp)*60, 6); ctx.strokeStyle = "#000"; ctx.strokeRect(this.dojo.x, this.dojo.y - 15, 60, 6);
            }
        } 
        else if (this.currentRoom === 'FOREST') {
            ctx.fillStyle = "#1b330c"; 
            ctx.fillRect(0, 60, this.worldWidth, canvas.height - 60);
            
            ctx.save();
            ctx.beginPath();
            this.scenery.forEach(s => {
                if(s.type === 'grass') { ctx.fillStyle = s.variant === 1 ? '#4caf50' : '#8bc34a'; ctx.globalAlpha = 0.3; ctx.fillRect(s.x, s.y, 4, 4); ctx.fillRect(s.x + 4, s.y - 4, 4, 4); ctx.globalAlpha = 1.0; } 
                else if (s.type === 'rock') { ctx.fillStyle = s.variant === 1 ? '#555' : '#777'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.5, s.r, 0, 0, Math.PI*2); ctx.fill(); }
            });
            ctx.restore();

            this.forestTrees.forEach(t => { if(t.y <= this.player.y + 35) this.drawTree(ctx, t.x, t.y, t.s); });
            
            ctx.fillStyle = "rgba(0, 0, 0, 0.15)"; 
            ctx.fillRect(0, 60, this.worldWidth, canvas.height); 
        }
        else if (this.currentRoom === 'RIVER') {
            ctx.fillStyle = "#e6c280"; 
            ctx.fillRect(0, 60, this.worldWidth, 140);
            ctx.fillStyle = "#1e88e5"; 
            ctx.fillRect(0, 200, this.worldWidth, canvas.height - 200);
            
            ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2;
            for(let y=220; y<canvas.height; y+=40) {
                for(let x=0; x<this.worldWidth; x+=100) {
                    let offset = Math.sin((this.frames * 0.05 + x + y)*0.02)*15;
                    ctx.beginPath(); ctx.moveTo(x + offset, y); ctx.lineTo(x + 40 + offset, y); ctx.stroke();
                }
            }
            if (this.player.y > 180) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                ctx.beginPath(); 
                ctx.ellipse(this.player.x + 20, this.player.y + 35, 15 + Math.sin(this.frames*0.1)*5, 6, 0, 0, Math.PI*2); 
                ctx.fill();
            }
        }
        this.decals.forEach(d => { if(d.room === this.currentRoom) d.draw(ctx); });
        this.damagePools.forEach(dp => { if(dp.room === this.currentRoom) dp.draw(ctx, this.frames); });
        this.drawShadow(this.player.x, this.player.y, 40);
        if(this.currentRoom === 'HUB') {
            this.drawShadow(this.dummy.x, this.dummy.y, 40); 
        }
        
        // BOSS AURAS
        this.enemies.forEach(z => { 
            if(z.room === this.currentRoom && !z.burning && z.type !== 'fish') {
                this.drawShadow(z.x, z.y, z.w, z.h); 
                if (z.isAlpha || z.isBrood) {
                    ctx.save();
                    ctx.shadowBlur = 20; ctx.shadowColor = z.isAlpha ? '#ff1744' : '#aa00ff';
                    z.draw(ctx, this.frames, this.gameMode, UI.endlessConfig.bossSize);
                    ctx.restore();
                } else {
                    z.draw(ctx, this.frames, this.gameMode, UI.endlessConfig.bossSize);
                }
            }
        });

        if(this.currentRoom === 'HUB') {
            ctx.drawImage(sprDummy, this.dummy.x, this.dummy.y);
        }
        
        // DRAW ORBS AND LOOT
        this.loot.forEach(item => { 
            if(item.room === this.currentRoom) {
                if (item.type.startsWith('orb_')) {
                    let oColor = item.type === 'orb_momentum' ? '#00e5ff' : '#ff1744';
                    ctx.save();
                    ctx.shadowBlur = 15; ctx.shadowColor = oColor;
                    ctx.fillStyle = oColor;
                    let floatY = Math.sin(this.frames * 0.1) * 5;
                    ctx.beginPath(); ctx.arc(item.x + 15, item.y + 15 + floatY, 12, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.arc(item.x + 11, item.y + 11 + floatY, 4, 0, Math.PI*2); ctx.fill();
                    ctx.restore();
                } else {
                    item.draw(ctx);
                }
            } 
        });

        this.corpses.forEach(c => { if(c.room === this.currentRoom) c.draw(ctx, this.frames, this.gameMode, UI.endlessConfig.bossSize); });
        this.projectiles.forEach(p => { if(p.room === this.currentRoom) p.draw(ctx); });
        
        if (['PLAYING', 'TUTORIAL', 'SUNRISE'].includes(this.state)) {
            if (this.player.mutationGlow > 0) {
                ctx.save(); ctx.shadowBlur = 20 + Math.sin(this.frames * 0.2) * 10; ctx.shadowColor = '#d32f2f';
                ctx.globalAlpha = (this.player.mutationGlow / 180) * (0.5 + Math.sin(this.frames * 0.2) * 0.3);
                ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(this.player.x + 20, this.player.y + 20, 30, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
            this.player.draw(ctx, this.frames, this.gameMode);
            
            if (this.player.demonRushTimer > 0) {
                ctx.save();
                ctx.fillStyle = '#ff0000';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ff0000';
                let pX = this.player.x;
                let pY = this.player.y;
                if (this.player.facingRight) {
                    ctx.fillRect(pX + 24, pY + 8, 3, 2); 
                    ctx.fillRect(pX + 30, pY + 8, 3, 2); 
                } else {
                    ctx.fillRect(pX + 7, pY + 8, 3, 2);  
                    ctx.fillRect(pX + 13, pY + 8, 3, 2); 
                }
                ctx.restore();
            }
        }
        
        if (this.currentRoom === 'FOREST') {
            ctx.save();
            ctx.beginPath();
            this.forestTrees.forEach(t => { if(t.y > this.player.y + 35) this.drawTree(ctx, t.x, t.y, t.s); });
            ctx.fillStyle = "rgba(10, 30, 10, 0.4)";
            ctx.fillRect(0, 60, this.worldWidth, canvas.height - 60);
            ctx.restore();
        }
        
        if (this.currentRoom === 'HUB') {
            for(let i=1750; i<=this.worldWidth; i+=40) {
                this.drawTree(ctx, i, canvas.height + 30, 1.2); 
            }
        }
        this.particles.forEach(p => { if(p.room === this.currentRoom) p.draw(ctx); });
        
        if (['PLAYING', 'TUTORIAL', 'SUNRISE'].includes(this.state)) {
            let burnRatio = Math.min(1, (this.player.sanctuaryBurn || 0) / 420);
            let hpR = Math.floor(239 + (85 - 239) * burnRatio);
            let hpG = Math.floor(83 + (255 - 83) * burnRatio);
            let hpB = Math.floor(80 + (85 - 80) * burnRatio);
            let hpColor = `rgb(${hpR}, ${hpG}, ${hpB})`;

            let drawFloatingBar = (yOff, val, max, color, glow = 0) => { 
                ctx.save();
                ctx.beginPath();
                ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(this.player.x, this.player.y - yOff, 40, 6); 
                
                if (glow > 0) {
                    ctx.shadowBlur = 10 * glow;
                    ctx.shadowColor = color;
                }

                ctx.fillStyle = color; ctx.fillRect(this.player.x, this.player.y - yOff, Math.max(0, (val/max)*40), 6); 
                
                ctx.shadowBlur = 0;
                ctx.strokeStyle = "#000"; ctx.strokeRect(this.player.x, this.player.y - yOff, 40, 6); 
                ctx.restore();
            }
            drawFloatingBar(10, this.player.fatigue, this.player.maxFatigue, "#ff5500"); 
            drawFloatingBar(18, this.player.stamina, this.player.maxStamina, "#3399ff"); 
            drawFloatingBar(26, this.player.hp, this.player.maxHp, hpColor, burnRatio);
            if (this.activePrompt.text && this.player.stunTimer <= 0) {
                ctx.fillStyle = this.activePrompt.text === 'Infection too high!' ? '#ff1744' : '#fff';
                ctx.font = "bold 14px Courier"; ctx.textAlign = "center";
                ctx.fillText(this.activePrompt.text, this.player.x + 20, this.player.y - 45);
            }
        }
        
        this.floatTexts.forEach(t => { if(t.room === this.currentRoom) t.draw(ctx); });
        
        ctx.restore(); 
        this.drawLighting();
        let infProgress = this.player.infection % 1;
        let vigAlpha = 0;
        if (this.state === 'PLAYING') {
            if (this.player.stunTimer > 0) {
                vigAlpha = (this.player.stunTimer / 90) * 0.8; 
            } else if (this.player.infection < 3 && infProgress > 0.6) {
                vigAlpha = ((infProgress - 0.6) / 0.4) * 0.8; 
            }
        }
        if (vigAlpha > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = `rgba(106, 27, 154, ${vigAlpha})`;
            ctx.lineWidth = 15;
            ctx.shadowColor = `rgba(106, 27, 154, ${vigAlpha})`;
            ctx.shadowBlur = 10;
            ctx.strokeRect(7.5, 7.5, canvas.width - 15, canvas.height - 15);
            ctx.restore();
        }

        if (this.damageFlash > 0) {
            let flashGrad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.height/3, canvas.width/2, canvas.height/2, canvas.width/1.2);
            flashGrad.addColorStop(0, 'rgba(255, 0, 0, 0)'); flashGrad.addColorStop(1, `rgba(255, 0, 0, ${this.damageFlash / 30})`);
            ctx.fillStyle = flashGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        if (this.player.stunTimer > 0) {
            ctx.fillStyle = `rgba(106, 27, 154, ${Math.sin(this.frames * 0.2) * 0.4})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        if (this.paused && ['PLAYING', 'TUTORIAL', 'SUNRISE'].includes(this.state)) { ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        if (this.state === 'TUTORIAL') {
            if (this.tutPhase <= 4) {
                ctx.fillStyle = "rgba(0,0,0,1)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#ffb300"; ctx.font = "bold 20px Courier"; ctx.textAlign = "center";
                if (this.tutPhase !== 2) ctx.fillText(this.tutText, canvas.width/2, canvas.height/2);
                else if (this.tutPhase === 2 && this.tutTimer < 179) ctx.fillText(this.tutText, canvas.width/2, canvas.height/2);
            } else {
                ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
                ctx.fillStyle = "#ffcc00"; ctx.font = "bold 22px Courier"; ctx.textAlign = "center";
                ctx.fillText(this.tutText, canvas.width/2, canvas.height - 35);
            }
        }
        
        if (this.state === 'EPILOGUE') {
            ctx.fillStyle = "rgba(0,0,0,0.95)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#ffb300"; ctx.font = "bold 24px Courier"; ctx.textAlign = "center";
            ctx.fillText(this.epiLines[this.epiPhase], canvas.width/2, canvas.height/2);
        }
        if (this.announceTimer > 0 && this.state !== 'TUTORIAL') { 
            let alpha = this.announceTimer > 60 ? 1 : this.announceTimer / 60; 
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`; ctx.font = "bold 60px Courier"; ctx.textAlign = "center"; 
            ctx.fillText(this.announceText, canvas.width/2, canvas.height/4); 
            
            if (this.subAnnounceText) {
                ctx.fillStyle = `rgba(211, 47, 47, ${alpha})`; ctx.font = "bold 24px Courier"; ctx.fillText(this.subAnnounceText, canvas.width/2, canvas.height/4 + 50); 
            }
        }
        if (this.sleepFade > 0) { let alpha = this.sleepFade > 30 ? (60 - this.sleepFade)/30 : this.sleepFade/30; ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fillRect(0,0,canvas.width,canvas.height); }
        if (['PLAYING', 'SUNRISE'].includes(this.state) || (this.state === 'TUTORIAL' && this.tutPhase > 4)) {
            ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, 60); 
            ctx.drawImage(sprMeat, 20, 15); ctx.fillStyle = "#fff"; ctx.font = "bold 20px Courier"; ctx.textAlign = "left"; ctx.fillText(`MEAT: ${this.food}`, 55, 35); 
            
            ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(180, 28, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(177, 25, 3, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.fillText(`x${this.player.demonBlood}`, 195, 35);
            if (this.state !== 'TUTORIAL') { 
                ctx.textAlign = "right"; 
                ctx.fillText(`TRAIN: ${this.dummy.hits}/${this.dummy.hitsNeeded}`, canvas.width - 20, 35); 
                for(let i=0; i<3; i++) {
                    this.drawSkullIcon(ctx, canvas.width - 240 + (i*25), 20, this.player.infection >= i+1);
                }
            }
            
            let trackW = 400; let trackX = canvas.width/2 - trackW/2; let trackY = 40;
            ctx.fillStyle = "#333"; ctx.fillRect(trackX, trackY - 2, trackW, 4);
            let pct = 1 - (this.timeTimer / this.phaseDur);
            if (this.state === 'SUNRISE') pct = 1;
            ctx.fillStyle = this.isDay || this.state === 'SUNRISE' ? "#ffeb3b" : "#90caf9"; ctx.fillRect(trackX, trackY - 2, trackW * pct, 4);
            
            let icon = this.isDay || this.state === 'SUNRISE' ? sprSun : (this.isSiege && !this.peacefulNight ? sprBloodMoon : sprMoon); 
            ctx.drawImage(icon, trackX + (trackW * pct) - 12, trackY - 12);
            
            ctx.font = "bold 20px Courier"; ctx.fillStyle = this.isSiege && !this.peacefulNight ? "#ef5350" : "#fff"; ctx.textAlign = "center";
            let phaseText = (this.isSiege && !this.peacefulNight ? "🩸 SIEGE " : (this.isDay || this.state === 'SUNRISE' ? "DAY " : "NIGHT ")) + this.dayCount;
            if (this.state === 'TUTORIAL') phaseText = "PROLOGUE";
            if (this.gameMode === 'ENDLESS') phaseText += " (ENDLESS)";
            ctx.fillText(phaseText, canvas.width/2, 22);

            if (this.combo > 1 && ['PLAYING', 'TUTORIAL'].includes(this.state)) {
                ctx.save();
                let cX = 40; 
                let cY = canvas.height / 2;
                let cSize = 24 + Math.min(20, this.combo); 
                let cColor = "#fff";
                let shakeX = 0, shakeY = 0;
                
                if (this.combo >= 25) {
                    cColor = "#ff1744"; 
                    cSize += Math.sin(this.frames * 0.5) * 5; 
                    shakeX = (Math.random() - 0.5) * 6;
                    shakeY = (Math.random() - 0.5) * 6;
                } else if (this.combo >= 10) {
                    cColor = "#ffea00"; 
                    cSize += Math.sin(this.frames * 0.2) * 2;
                    shakeX = (Math.random() - 0.5) * 2;
                    shakeY = (Math.random() - 0.5) * 2;
                }

                let cAlpha = this.comboTimer < 60 ? this.comboTimer / 60 : 1.0;
                ctx.globalAlpha = cAlpha;

                ctx.translate(cX + shakeX, cY + shakeY);
                ctx.rotate(-0.1); 

                ctx.fillStyle = cColor;
                ctx.font = `900 italic ${cSize}px Courier`;
                ctx.textAlign = "left";
                
                ctx.lineWidth = 4;
                ctx.strokeStyle = "#000";
                ctx.strokeText(`${this.combo}x`, 0, 0);
                ctx.fillText(`${this.combo}x`, 0, 0);
                
                ctx.font = `bold ${Math.max(14, cSize/3)}px Courier`;
                ctx.strokeText("HITS", 0, cSize/2);
                ctx.fillText("HITS", 0, cSize/2);

                ctx.restore();
            }
        }
    }
}

const gameEngine = new Game();
const FPS = 60; const frameDelay = 1000 / FPS; let lastFrameTime = performance.now();
function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop); 
    const deltaTime = currentTime - lastFrameTime;
    if (deltaTime >= frameDelay) { 
        lastFrameTime = currentTime - (deltaTime % frameDelay); 
        if (!gameEngine.paused) gameEngine.update(); 
        gameEngine.draw(); 
    }
}
requestAnimationFrame(gameLoop);