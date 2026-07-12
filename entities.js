/* =========================================
   LAST DOJO V2 - ENTITY CLASSES (entities.js)
========================================= */

import { sprMeat, sprBandage } from './assets.js';

export function drawCharacter(c, ent, frames, gameMode, bossSize = 1.0) {
    let isP = ent.type === 'player'; 
    let t = ent.type; 
    let s = (t === 'brute') ? 1.4 : (t === 'warlord' ? 2.2 : (t === 'boar' ? 0.9 : (t === 'fish' ? 1.2 : 1.0))); 
    
    // ENSURES BROODMOTHER AND ALPHA SCALE UP PROPERLY IN ENDLESS MODE
    if (gameMode === 'ENDLESS' && (t === 'warlord' || ent.isAlpha || ent.isBrood)) s *= bossSize;

    let walkFreq = isP ? 0.4 : (ent.speed * 0.12); 
    let walk = ent.dead || ent.spawnTimer > 0 || ent.isCasting > 0 || ent.isFishing || (isP && ent.stunTimer > 0) ? 0 : (ent.isMoving ? Math.sin(frames * walkFreq) * 1.5 : 0);
    if (t === 'boar' && ent.state === 'charge') walk = Math.sin(frames * 0.8) * 1.5; 

    c.save(); 
    let yOffset = 0;
    
    if (ent.spawnTimer > 0) {
        let progress = 1 - (ent.spawnTimer / 120); 
        yOffset = (1 - progress) * (30 * s); 
        c.beginPath(); 
        c.rect(-100, -200, 200, 200 + ent.h/2); 
        c.clip(); 
    }

    let stunDrop = (isP && ent.stunTimer > 0) ? 8 * s : 0;
    c.translate(ent.x + ent.w/2, ent.y + ent.h/2 + yOffset + stunDrop); 
    
    if (ent.spawnTimer > 0 || ent.isCasting > 0 || (isP && ent.stunTimer > 0 && frames % 4 === 0)) {
        c.translate((Math.random()-0.5) * 4 * s, (Math.random()-0.5) * 4 * s);
    }
    
    if (ent.isCasting > 0 && t === 'warlord') { 
        c.fillStyle = 'rgba(211, 47, 47, 0.4)'; 
        c.beginPath(); 
        c.arc(0, 0, 30*s + Math.sin(frames)*5, 0, Math.PI*2); 
        c.fill(); 
    }

    if (ent.dead) c.rotate(ent.rot); 
    else if (ent.isSpinning) c.rotate(frames * 0.5); 
    else if (!ent.facingRight) c.scale(-1, 1);

    if (t === 'fish') {
        let swimWobble = Math.sin(frames * 0.4) * 4 * s;
        c.fillStyle = '#00e5ff';
        c.beginPath(); c.ellipse(0, 0, 12*s, 7*s, 0, 0, Math.PI*2); c.fill();
        c.beginPath(); c.moveTo(-10*s, 0); c.lineTo(-18*s, -6*s + swimWobble); c.lineTo(-18*s, 6*s + swimWobble); c.fill();
        
        c.fillStyle = '#fff'; c.beginPath(); c.arc(6*s, -2*s, 2.5*s, 0, Math.PI*2); c.fill();
        c.fillStyle = '#000'; c.beginPath(); c.arc(7*s, -2*s, 1.2*s, 0, Math.PI*2); c.fill();
        c.restore(); return;
    }

    if (t === 'boar') {
        let legWalk = walk * 8 * s;

        c.fillStyle = '#2e1a15'; 
        c.fillRect(-14*s + legWalk, 5*s, 6*s, 12*s); 
        c.fillRect(-4*s - legWalk, 5*s, 6*s, 12*s);  
        c.fillRect(8*s + legWalk, 5*s, 6*s, 12*s);   
        c.fillRect(16*s - legWalk, 5*s, 6*s, 12*s);  

        c.fillStyle = ent.hitTimer > 0 ? '#fff' : '#4e342e'; 
        c.beginPath(); c.ellipse(0, -5*s, 24*s, 16*s, 0, 0, Math.PI*2); c.fill();

        c.fillStyle = ent.hitTimer > 0 ? '#fff' : '#3e2723'; 
        c.beginPath(); c.ellipse(20*s, -2*s, 14*s, 11*s, 0, 0, Math.PI*2); c.fill();
        c.fillStyle = '#e8a598'; c.fillRect(28*s, -6*s, 6*s, 8*s);

        c.fillStyle = ent.state === 'windup' ? '#ff0000' : '#000';
        c.fillRect(18*s, -8*s, 4*s, 4*s);

        c.fillStyle = '#fff';
        c.beginPath(); c.moveTo(24*s, 4*s); c.lineTo(34*s, -6*s); c.lineTo(28*s, 6*s); c.fill();

        c.fillStyle = '#2e1a15';
        c.beginPath(); c.moveTo(12*s, -10*s); c.lineTo(6*s, -20*s); c.lineTo(16*s, -12*s); c.fill();
        c.strokeStyle = '#2e1a15'; c.lineWidth = 3*s;
        c.beginPath(); c.moveTo(-22*s, -10*s); c.lineTo(-30*s, -15*s); c.stroke();

        if (ent.state === 'stunned' && !ent.dead) {
            c.fillStyle = '#ffcc00';
            let star1 = Math.sin(frames * 0.2) * 8; let star2 = Math.cos(frames * 0.2) * 8;
            c.fillRect(0 + star1, -25*s + star2, 4*s, 4*s);
            c.fillRect(10*s - star1, -20*s - star2, 4*s, 4*s);
            c.fillRect(-10*s - star2, -20*s + star1, 4*s, 4*s);
        }
        c.restore(); return; 
    }

    let hc, bc, lc, lg;
    if (ent.hitTimer > 0) { hc = '#fff'; bc = '#fff'; lc = '#fff'; lg = '#fff'; } 
    else {
        if (isP) { hc = '#ffcc99'; bc = '#fff'; lc = '#ffcc99'; lg = '#eeeeee'; } 
        else if (t === 'brute') { hc = '#6a1b9a'; bc = '#444'; lc = '#6a1b9a'; lg = '#212f3d'; } 
        else if (t === 'warlord') { hc = '#111'; bc = '#d32f2f'; lc = '#111'; lg = '#111'; } 
        else if (t === 'spitter') { hc = '#cddc39'; bc = '#555'; lc = '#4caf50'; lg = '#4a2311'; } 
        else { hc = '#4caf50'; bc = '#666'; lc = '#4caf50'; lg = '#2c3e50'; } 
    }

    c.lineWidth = 6 * s; c.lineCap = "round";

    let punchProgress = ent.dead || ent.spawnTimer > 0 ? 0 : (ent.isAttacking && !ent.isSpinning ? (15 - ent.attackTimer)/15 : 0); 
    let ext = 0; 
    
    if (punchProgress > 0) {
        ext = punchProgress < 0.2 ? (punchProgress / 0.2) * 16*s : (1 - (punchProgress - 0.2)/0.8) * 16*s;
    }
    
    let isBiting = (!isP && ent.biteTimer > 45 && !ent.dead && !ent.spawnTimer); 
    let biteLunge = isBiting ? 6*s : 0;
    
    c.strokeStyle = lg; 
    c.beginPath(); c.moveTo(0, 5*s); c.lineTo(walk * 10*s, 18*s); c.stroke(); 
    c.beginPath(); c.moveTo(0, 5*s); c.lineTo(-walk * 10*s, 18*s); c.stroke(); 
    
    c.strokeStyle = lc; 
    c.beginPath(); c.moveTo(0, -6*s); 
    if (ent.isSpinning || ent.dead) c.lineTo(20*s, -6*s); 
    else if (!isP) c.lineTo(14*s, -8*s); 
    else c.lineTo(-walk * 8*s, 4*s); 
    c.stroke();
    
    c.fillStyle = bc; 
    c.fillRect(-7*s, -10*s, 14*s, 16*s);
    if (isP) { c.fillStyle = ent.hitTimer > 0 ? '#fff' : '#000'; c.fillRect(-7*s, 2*s, 14*s, 4*s); } 
    if (t === 'brute' || t === 'warlord') { c.fillStyle = ent.hitTimer > 0 ? '#fff' : '#666'; c.fillRect(-5*s, -8*s, 10*s, 10*s); } 
    
    c.fillStyle = hc; 
    c.fillRect(-6*s + biteLunge, -22*s, 12*s, 12*s);
    
    if (ent.hitTimer > 0) {
        c.fillStyle = '#fff';
    } else if (isP && ent.demonRushTimer > 0) {
        c.fillStyle = '#ff0000';
        c.shadowBlur = 10;
        c.shadowColor = '#ff0000';
    } else {
        c.fillStyle = (t === 'spitter') ? '#fff' : (t === 'warlord' ? '#ff0000' : '#000'); 
    }
    c.fillRect(2*s + biteLunge, -20*s, 3*s, 3*s); 
    c.shadowBlur = 0; 
    
    c.strokeStyle = lc; 
    c.beginPath(); c.moveTo(0, -6*s);
    if (ent.isSpinning || ent.dead) { c.lineTo(-20*s, -6*s); } 
    else if (ent.isAttacking) { c.lineTo(10*s + ext, -6*s); } 
    else if (isBiting) { c.lineTo(12*s, -15*s); } 
    else if (ent.isFishing) { c.lineTo(20*s, -5*s); } 
    else if (!isP) { c.lineTo(16*s, -6*s); } 
    else { c.lineTo(walk * 8*s, 4*s); }
    c.stroke(); 

    if (ent.isAttacking && !ent.isSpinning && !ent.dead) { 
        c.fillStyle = lc; c.fillRect(10*s + ext - 3*s, -9*s, 6*s, 6*s); 
    }
    
    c.restore();
}

export class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.w = 40; this.h = 40; this.size = 40;
        this.hp = 100; this.maxHp = 100;
        this.stamina = 100; this.maxStamina = 100;
        this.fatigue = 0; this.maxFatigue = 100; 
        
        this.infection = 0.0;
        this.demonBlood = 0;
        this.stunTimer = 0;

        this.speed = 4; this.facingRight = true; this.dmg = 20;
        this.isAttacking = false; this.isSpinning = false; this.isMoving = false;
        this.attackTimer = 0; this.attackCost = 20; this.specialCost = 50;
        this.type = 'player'; this.iFrames = 0; this.mutationGlow = 0;
        this.room = 'HUB';
        
        this.isFishing = false;
        this.fishTimer = 0;
    }

    draw(ctx, frames, gameMode) {
        ctx.save(); 
        if (this.iFrames > 0 && Math.floor(frames / 4) % 2 === 0) ctx.globalAlpha = 0.3; 
        drawCharacter(ctx, this, frames, gameMode); 
        ctx.restore();
    }
}

export class Zombie {
    constructor(x, y, hpPool, moveSpeed, type, anchorX, anchorY, size, initialFacingRight) {
        this.x = x; this.y = y; 
        this.hp = hpPool; this.maxHp = hpPool; this.speed = moveSpeed; 
        this.hitTimer = 0; this.biteTimer = 0; this.shootTimer = 60; 
        this.type = type; this.burning = false; this.isMoving = true; 
        this.facingRight = initialFacingRight; 
        this.anchorX = anchorX; this.anchorY = anchorY; this.patrolDir = 1; 
        this.w = size; this.h = size; 
        this.aggroTarget = null; this.aggroTimer = 0; this.isChasing = false;
        this.dojoOffsetX = (Math.random() - 0.5) * 60; 
        this.dojoOffsetY = (Math.random() - 0.5) * 30;
        this.spawnTimer = (type === 'warlord' ? 120 : 0); 
        this.specialTimer = (type === 'warlord' ? 180 : 0); 
        this.isCasting = 0;
        this.handledDeath = false;
        this.room = 'HUB';
        
        this.state = 'idle'; 
        this.stateTimer = 0;
        
        this.chargeVx = 0;
        this.chargeVy = 0;
        this.targetDistance = 0;
        this.distanceTravelled = 0;
    }

    draw(ctx, frames, gameMode, bossSize = 1.0) {
        if (this.burning && this.type !== 'warlord') ctx.globalAlpha = Math.max(0, this.hp / this.maxHp); 
        drawCharacter(ctx, this, frames, gameMode, bossSize); 
        
        if (this.aggroTimer > 0 && this.hp > 0 && !this.burning && this.type !== 'boar' && this.type !== 'fish') {
            ctx.fillStyle = '#ff0000'; ctx.font = "bold 12px Courier"; ctx.fillText("!", this.x + this.w/2, this.y - 5);
        }

        if (this.type === 'warlord' && this.hp > 0 && this.spawnTimer <= 0) {
            ctx.fillStyle = "#222"; ctx.fillRect(this.x, this.y - 10, this.w, 6); 
            ctx.fillStyle = "#d32f2f"; ctx.fillRect(this.x, this.y - 10, (this.hp/this.maxHp)*this.w, 6); 
            ctx.strokeStyle = "#000"; ctx.strokeRect(this.x, this.y - 10, this.w, 6);
        }
        ctx.globalAlpha = 1.0; 
    }
}

export class Corpse {
    constructor(z, impactDirX, extremeYeet = false) {
        this.x = z.x; this.y = z.y; this.w = z.w; this.h = z.h; 
        this.type = z.type; this.facingRight = z.facingRight; 
        
        let vxBase = Math.random() * 10 + (extremeYeet ? 15 : 5); 
        let vyBase = Math.random() * 8 + (extremeYeet ? 25 : 5);
        this.vx = impactDirX * vxBase; 
        this.vy = -vyBase; 
        this.rot = 0; 
        this.spin = (Math.random() - 0.5) * (extremeYeet ? 1.5 : 0.5); 
        this.life = 150; 
        this.dead = true;
        this.room = z.room;
        this.state = z.state;
    }

    update(floorY) {
        this.x += this.vx; this.y += this.vy; this.vy += 0.5; this.rot += this.spin; 
        if (this.y > floorY - 40) { this.y = floorY - 40; this.vy *= -0.4; this.vx *= 0.5; this.spin *= 0.5; } 
        this.life--;
    }

    draw(ctx, frames, gameMode, bossSize = 1.0) {
        ctx.globalAlpha = this.life / 100; 
        drawCharacter(ctx, this, frames, gameMode, bossSize); 
        ctx.globalAlpha = 1.0;
    }
}

export class Loot {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type; this.room = 'HUB';
    }
    draw(ctx) { 
        if (this.type === 'food') ctx.drawImage(sprMeat, this.x, this.y);
        else if (this.type === 'bandage') ctx.drawImage(sprBandage, this.x, this.y);
        else if (this.type === 'blood') {
            ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(this.x + 10, this.y + 10, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ff5252'; ctx.beginPath(); ctx.arc(this.x + 8, this.y + 8, 3, 0, Math.PI*2); ctx.fill();
        }
    }
}

export class DirtMound {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 50; this.h = 30;
        this.state = 'empty'; 
        this.room = 'HUB';
    }
    draw(ctx, frames) {
        ctx.fillStyle = "#8d6e63"; 
        ctx.beginPath(); ctx.ellipse(this.x + 25, this.y + 15, 20, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#e0e0e0"; ctx.lineWidth = 2; 
        ctx.beginPath(); ctx.ellipse(this.x + 25, this.y + 15, 22, 10, 0, 0, Math.PI*2); ctx.stroke();
        
        if (this.state === 'planted_day' || this.state === 'planted_night') {
            ctx.strokeStyle = "#4caf50"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(this.x + 25, this.y + 15); ctx.lineTo(this.x + 25, this.y - 5); ctx.stroke();
        } else if (this.state === 'bloomed') {
            ctx.strokeStyle = "#4caf50"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(this.x + 25, this.y + 15); ctx.lineTo(this.x + 25, this.y - 10); ctx.stroke();
            
            ctx.save();
            ctx.shadowBlur = 15; ctx.shadowColor = '#00e5ff';
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath(); 
            ctx.arc(this.x + 25, this.y - 15 + Math.sin(frames*0.1)*3, 8, 0, Math.PI*2); 
            ctx.fill();
            ctx.restore();
        }
    }
}

export class Projectile {
    constructor(x, y, vx, vy, owner) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; 
        this.life = 250; this.owner = owner; this.reflected = false;
        this.room = owner.room;
        this.markedForDeletion = false; 
    }
    update() { this.x += this.vx; this.y += this.vy; this.life--; }
    draw(ctx) {
        ctx.fillStyle = this.reflected ? '#00ffff' : '#cddc39'; 
        ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, Math.PI*2); ctx.fill(); 
        ctx.shadowBlur = 10; ctx.shadowColor = this.reflected ? '#00ffff' : '#cddc39'; 
        ctx.fill(); ctx.shadowBlur = 0; 
    }
}

export class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; 
        this.vx = (Math.random() - 0.5) * 10; 
        this.vy = (Math.random() - 1) * 10; 
        this.life = 15 + Math.random() * 15; 
        this.color = color;
        this.room = 'HUB'; 
    }
    update(canvasHeight) {
        this.x += this.vx; this.y += this.vy; this.vy += 0.5; 
        if(this.y > canvasHeight) this.vy *= -0.5; 
        this.life--;
    }
    draw(ctx) { ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, 4, 4); }
}

export class FloatText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y; this.text = text; this.color = color; this.life = 60;
        this.room = 'HUB';
    }
    update() { this.y -= 1; this.life--; }
    draw(ctx) {
        ctx.globalAlpha = this.life / 60; ctx.fillStyle = this.color; 
        ctx.font = "bold 16px Courier"; ctx.textAlign = "center"; 
        ctx.fillText(this.text, this.x, this.y); ctx.globalAlpha = 1.0; 
    }
}

export class Decal {
    constructor(x, y, color, scaleRange = 1) {
        this.x = x + (Math.random() * 20 - 10); this.y = y + (Math.random() * 10 - 5); 
        this.s = (Math.random() * 15 + 10) * scaleRange; this.col = color; this.life = 300;
        this.room = 'HUB';
    }
    update() { this.life--; }
    draw(ctx) {
        ctx.globalAlpha = this.life / 300; ctx.fillStyle = this.col; 
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.s, this.s * 0.5, 0, 0, Math.PI*2); ctx.fill(); 
        ctx.globalAlpha = 1.0; 
    }
}

export class DamagePool {
    constructor(x, y, life = 240) {
        this.x = x; this.y = y; this.life = life; this.room = 'HUB';
    }
    update() { this.life--; }
    draw(ctx, frames) {
        ctx.globalAlpha = Math.min(1, this.life / 240); ctx.fillStyle = "#cddc39"; 
        let rx = 25; let ry = 12;
        if (this.life > 100000) { 
            ctx.fillStyle = "#ff5500"; ctx.globalAlpha = 0.7 + Math.sin(frames*0.1)*0.2; rx = 40; ry = 20; 
        } 
        ctx.beginPath(); ctx.ellipse(this.x, this.y, rx, ry, 0, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0; 
    }
}