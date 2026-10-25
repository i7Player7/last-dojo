/* =========================================
   LAST DOJO V3 - UI & MENUS (ui.js)
========================================= */

import { sfx } from './assets.js';
import { Input, ACTIONS, ACTION_LABELS } from './input.js';
import { TECHNIQUES, SURVIVAL_DAYS, BLOOD_MOON_EVERY, GROUP_LABELS, MEAL } from './config.js';

const MENUS = ['mainMenu', 'settingsMenu', 'pauseMenu', 'gameOverMenu', 'victoryMenu', 'controlsMenu', 'endlessSettingsMenu', 'choiceMenu', 'howMenu'];
const HUD_BUTTONS = ['btnPunch', 'btnSpin', 'btnDash', 'btnAct', 'btnEat', 'btnRush', 'btnPause'];

export class UIController {
    constructor() {
        this.defaultEndless = {
            maxZ: 25, zSpeed: 1.0, zHealth: 1.0, zDamage: 1.0, bHealth: 1.0, bSpeed: 1.0, pSpeed: 1.0,
            infStamReg: false, infStamBM: true, knockback: 1.0, spinCd: 1.0, lifesteal: 0, stamDrain: 1.0,
            spawnRate: 1.0, explodeZ: false, bossFreq: 15, bossSize: 1.0, bossCap: 3, bmFreq: BLOOD_MOON_EVERY,
            phaseLen: 1.0, dojoRegen: false, dojoHp: 400, crates: 3, bandageDrop: 0.07,
            ohk: false, pitchBlack: false, lavaMode: false, noKegare: false
        };
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem('lastDojoEndlessConfig')); } catch (e) {}
        this.endlessConfig = { ...this.defaultEndless, ...(saved || {}) };

        this.defaultHUD = {
            btnPunch: { left: '88%', top: '78%' },
            btnSpin:  { left: '77%', top: '64%' },
            btnDash:  { left: '75%', top: '89%' },
            btnAct:   { left: '90%', top: '55%' },
            btnEat:   { left: '63%', top: '89%' },
            btnRush:  { left: '80%', top: '45%' },
            btnPause: { left: '5%',  top: '10%' }
        };

        this.choice = null;
        document.addEventListener('keysUpdated', () => this.updateControlsUI());
        document.addEventListener('choicePick', (e) => this.pickChoice(e.detail.index));
        this.exposeToWindow();
    }

    init() {
        this.buildControlsList();
        this.applyHUDPositions();
        this.renderMenuButtons();
    }

    $(id) { return document.getElementById(id); }

    exposeToWindow() {
        window.toggleAudio = () => {
            sfx.muted = !sfx.muted;
            this.$('audioBtn').innerText = sfx.muted ? 'Sound: off' : 'Sound: on';
        };
        window.openSettings = () => { this.hideAllMenus(); this.$('settingsMenu').classList.remove('hidden'); };
        window.closeSettings = () => { this.hideAllMenus(); document.dispatchEvent(new Event('requestCloseSettings')); };
        window.openHowToPlay = (back) => {
            this.howBack = back || 'main';
            this.hideAllMenus();
            this.fillHowToPlay();
            this.$('howMenu').classList.remove('hidden');
        };
        window.closeHowToPlay = () => {
            this.hideAllMenus();
            if (this.howBack === 'pause') this.$('pauseMenu').classList.remove('hidden');
            else this.showMainMenu();
        };
        window.resetHints = () => {
            localStorage.removeItem('lastDojoHints');
            localStorage.removeItem('lastDojoPrologueDone');
            this.$('resetHintsBtn').innerText = 'Tips and prologue will show again';
        };

        window.openControlsMenu = () => {
            this.hideAllMenus();
            if (Input.isTouchDevice) {
                Input.isEditingHUD = true;
                this.$('touchUI').classList.remove('hidden');
                this.$('hudEditOverlay').classList.remove('hidden');
                document.querySelectorAll('.touch-btn').forEach(b => b.classList.add('editing'));
            } else {
                this.$('controlsMenu').classList.remove('hidden');
                this.updateControlsUI();
            }
        };
        window.closeControlsMenu = () => {
            this.hideAllMenus();
            this.$('settingsMenu').classList.remove('hidden');
            Input.bindingAction = null;
        };
        window.resetKeys = () => {
            Input.userKeys = { ...Input.defaultKeys };
            Input.saveKeys();
            this.updateControlsUI();
        };
        window.startBind = (action) => Input.startBinding(action);

        window.openEndlessSettings = () => {
            this.hideAllMenus();
            this.loadEndlessUI();
            this.$('endlessSettingsMenu').classList.remove('hidden');
        };
        window.saveEndlessSettings = () => {
            for (const k in this.endlessConfig) {
                const el = this.$('eo_' + k);
                if (!el) continue;
                if (el.type === 'checkbox') this.endlessConfig[k] = el.checked;
                else {
                    const v = parseFloat(this.$('num_' + k).value);
                    if (!isNaN(v)) this.endlessConfig[k] = v;
                }
            }
            localStorage.setItem('lastDojoEndlessConfig', JSON.stringify(this.endlessConfig));
            this.showMainMenu();
        };
        window.resetEndlessSettings = () => {
            this.endlessConfig = { ...this.defaultEndless };
            this.loadEndlessUI();
        };
        window.updateEO = (key, value) => {
            const r = this.$('eo_' + key), n = this.$('num_' + key);
            if (!r || !n) return;
            r.value = value; n.value = value;
        };

        window.saveMobileHUD = () => {
            const hud = {};
            HUD_BUTTONS.forEach(id => { const el = this.$(id); hud[id] = { left: el.style.left, top: el.style.top }; });
            localStorage.setItem('lastDojoMobileHUD', JSON.stringify(hud));
            this.exitHUDMode();
        };
        window.resetMobileHUD = () => {
            localStorage.setItem('lastDojoMobileHUD', JSON.stringify(this.defaultHUD));
            this.applyHUDPositions();
            this.exitHUDMode();
        };

        window.startGame = (mode) => document.dispatchEvent(new CustomEvent('startGame', { detail: { mode } }));
        window.startEpilogueMenu = () => document.dispatchEvent(new Event('startEpilogue'));
        window.startPrologueMenu = () => document.dispatchEvent(new Event('startPrologue'));
        window.skipPrologue = () => document.dispatchEvent(new Event('skipPrologue'));
        window.restartGame = () => document.dispatchEvent(new Event('restartGame'));
        window.quitToMenu = () => document.dispatchEvent(new Event('quitToMenu'));
        window.resumeGame = () => document.dispatchEvent(new Event('togglePause'));
    }

    hideAllMenus() {
        MENUS.forEach(id => { const el = this.$(id); if (el) el.classList.add('hidden'); });
        Input.bindingAction = null;
    }

    hideTouchUI() { const t = this.$('touchUI'); if (t) t.classList.add('hidden'); }
    showTouchUI() { if (Input.isTouchDevice) { const t = this.$('touchUI'); if (t) t.classList.remove('hidden'); } }

    // ---------- main menu ----------
    renderMenuButtons() {
        const box = this.$('dynamicMenuButtons');
        if (!box) return;
        box.innerHTML = '';
        const hs = parseInt(localStorage.getItem('lastDojoHighScore') || '0');
        const hsEl = this.$('highScoreDisplay');
        if (hsEl) hsEl.innerText = hs > 1 ? `Best run: reached day ${hs}` : 'Survive fifteen nights.';

        const btn = (label, fn, cls = '') => {
            const b = document.createElement('button');
            b.className = 'arcade-btn ' + cls; b.innerText = label; b.onclick = fn;
            return b;
        };
        const surv = btn('Survival', () => window.startGame('SURVIVAL'), localStorage.getItem('lastDojoPlayed') ? '' : 'primary');
        box.appendChild(surv);
        // the prologue plays automatically the first time; afterwards it can be replayed from here
        if (localStorage.getItem('lastDojoPrologueDone')) box.appendChild(btn('Prologue', window.startPrologueMenu));

        if (localStorage.getItem('lastDojoEndlessUnlocked')) {
            const row = document.createElement('div'); row.className = 'btn-row';
            const end = btn('Endless', () => window.startGame('ENDLESS'));
            const gear = btn('Options', window.openEndlessSettings, 'small');
            gear.setAttribute('aria-label', 'Endless options');
            row.appendChild(end); row.appendChild(gear);
            box.appendChild(row);
        }
        if (localStorage.getItem('lastDojoEpilogueUnlocked')) box.appendChild(btn('Epilogue', window.startEpilogueMenu));
        box.appendChild(btn('How to play', () => window.openHowToPlay('main'), 'quiet'));
        box.appendChild(btn('Settings', window.openSettings, 'quiet'));
    }

    // ---------- how to play ----------
    fillHowToPlay() {
        const k = a => Input.isTouchDevice ? { punch: 'PUNCH', spin: 'SPIN', dash: 'DASH', interact: 'ACT', eat: 'EAT', unleash: 'RUSH' }[a] : Input.getDisplayKey(Input.userKeys[a]);
        const move = Input.isTouchDevice ? 'the left half of the screen' : `${k('up')} ${k('left')} ${k('down')} ${k('right')}`;
        this.$('howBody').innerHTML = `
            <section><h3>Day</h3><p>The sun keeps the horde away. Walk west into the forest to break supply caches and hunt boars for meat. Eat meat (<kbd>${k('eat')}</kbd>) to heal, or put up to ${MEAL.maxPot} pieces in the pot beside the Dojo (<kbd>${k('interact')}</kbd>): you eat that meal at dusk and fight stronger all night. Rest at the Dojo door to heal and skip to dusk.</p></section>
            <section><h3>Night</h3><p>The dead come for you. They can drop Kegare essence and bandages. A hit combo of 10 or more makes you hit harder. Once a blood moon's champion falls, you can rest at the Dojo door until dawn. Dead still in the forest at sunrise hide under the trees and guard it the next day.</p></section>
            <section><h3>Kegare</h3><p>Bites and time spread the taint. Each skull makes you hit 15% harder, but at three skulls you turn. At night, offer essence at the Gekka Bijin in the sanctuary (far east) to purge it, or press <kbd>${k('unleash')}</kbd> to burn one for six seconds of tireless power. Sacred ground burns you if you stay too long.</p></section>
            <section><h3>Blood moon</h3><p>Every ${BLOOD_MOON_EVERY}th night the horde tries to break through the Dojo doors and a champion rises. You get free stamina and hit far harder. Strike the horde to pull it toward you, and kill the champion to scatter the rest.</p></section>
            <section><h3>Dawn</h3><p>Each morning you survive, choose one new technique: one attack, one survival and one movement card. Essence you carry burns away at sunrise, so spend it in meditation first: reroll the cards, see a fourth, or learn an extra technique.</p></section>
            <section><h3>Controls</h3><p>Move with ${move}. Punch <kbd>${k('punch')}</kbd> (every third punch is a heavy finisher), spin kick <kbd>${k('spin')}</kbd> (reflects acid), dash <kbd>${k('dash')}</kbd>.</p></section>`;
    }

    // ---------- keybinds ----------
    buildControlsList() {
        const list = this.$('controlsList');
        if (!list) return;
        list.innerHTML = '';
        for (const a of ACTIONS) {
            const row = document.createElement('div'); row.className = 'settings-row';
            const lab = document.createElement('label'); lab.innerText = ACTION_LABELS[a];
            const b = document.createElement('button'); b.className = 'bind-btn'; b.id = 'bind_' + a;
            b.onclick = () => window.startBind(a);
            row.appendChild(lab); row.appendChild(b); list.appendChild(row);
        }
    }
    updateControlsUI() {
        for (const a of ACTIONS) {
            const b = this.$('bind_' + a);
            if (b) { b.innerText = Input.getDisplayKey(Input.userKeys[a]); b.classList.remove('waiting'); }
        }
    }

    // ---------- endless ----------
    loadEndlessUI() {
        for (const k in this.endlessConfig) {
            const el = this.$('eo_' + k);
            if (!el) continue;
            if (el.type === 'checkbox') el.checked = this.endlessConfig[k];
            else window.updateEO(k, this.endlessConfig[k]);
        }
    }

    // ---------- mobile HUD ----------
    applyHUDPositions() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem('lastDojoMobileHUD')); } catch (e) {}
        const hud = { ...this.defaultHUD, ...(saved || {}) };
        for (const id in hud) {
            const el = this.$(id);
            if (el && hud[id].left) { el.style.left = hud[id].left; el.style.top = hud[id].top; }
        }
    }
    exitHUDMode() {
        Input.isEditingHUD = false;
        this.$('hudEditOverlay').classList.add('hidden');
        this.hideTouchUI();
        document.querySelectorAll('.touch-btn').forEach(b => b.classList.remove('editing'));
        this.$('settingsMenu').classList.remove('hidden');
    }

    // ---------- dawn technique choice + meditation ----------
    showChoice(day, dawn, player, costs, handlers) {
        this.hideAllMenus();
        this.choice = { options: dawn.options, onPick: handlers.pick };
        this.$('choiceTitle').innerText = `Dawn of day ${day}`;
        const sub = this.$('choiceSub');
        if (!dawn.shop) sub.innerText = 'The sun burns the dead away. Choose a technique.';
        else if (player.essence > 0) sub.innerHTML = `The sun burns the dead away, and the essence you carried with them. <b class="ess">${player.essence} essence</b> is burning. Spend it before it's gone.`;
        else sub.innerText = 'The sun burns the dead away. You meditate on the night\'s fighting.';
        if (dawn.picksLeft > 1) sub.innerHTML += ` <b>Choose ${dawn.picksLeft} techniques.</b>`;

        const wrap = this.$('choiceCards');
        wrap.innerHTML = '';
        dawn.options.forEach((t, i) => {
            const b = document.createElement('button');
            b.className = 'tech-card';
            const rank = player.t(t.id);
            b.innerHTML = `
                <span class="seal">${i + 1}</span>
                <span class="tech-group">${GROUP_LABELS[t.group] || ''}</span>
                <span class="tech-name">${t.name}</span>
                <span class="tech-desc">${t.desc}</span>
                <span class="tech-rank">${t.max > 1 ? `Rank ${rank + 1} of ${t.max}` : 'Single rank'}</span>`;
            b.onclick = () => this.pickChoice(i);
            wrap.appendChild(b);
        });

        // meditation: spend burning essence for more control over the choice
        const shop = this.$('choiceShop');
        shop.innerHTML = '';
        shop.classList.toggle('hidden', !dawn.shop);
        if (dawn.shop) {
            const add = (label, cost, enabled, action, note) => {
                const b = document.createElement('button');
                b.className = 'arcade-btn compact shop-btn';
                b.innerHTML = `${label} <span class="cost">${cost} essence</span>`;
                b.disabled = !enabled;
                if (note) b.title = note;
                b.onclick = () => handlers.act(action);
                shop.appendChild(b);
            };
            add('Reroll the cards', costs.reroll, player.essence >= costs.reroll, 'reroll');
            add('See a fourth card', costs.fourth, !dawn.fourthUsed && player.essence >= costs.fourth, 'fourth');
            add('Learn one more technique', costs.extra, player.essence >= costs.extra, 'extra', 'The price rises each time you do this in a run.');
        }
        this.$('choiceHint').innerText = `Press 1 to ${dawn.options.length}, or click a card.${dawn.shop && player.essence > 0 ? ' Unspent essence burns away when you finish.' : ''}`;
        this.$('choiceMenu').classList.remove('hidden');
        const first = wrap.querySelector('button');
        if (first) first.focus({ preventScroll: true });
    }
    pickChoice(i) {
        if (!this.choice || !this.choice.options[i]) return;
        const { options, onPick } = this.choice;
        this.choice = null;
        this.$('choiceMenu').classList.add('hidden');
        onPick(options[i].id);
    }

    // ---------- run screens ----------
    techniqueSummary(player) {
        const owned = TECHNIQUES.filter(t => player.t(t.id) > 0);
        if (!owned.length) return '<p class="muted">No techniques yet. Survive a night to learn one.</p>';
        return '<ul class="tech-list">' + owned.map(t => `<li><b>${t.name}</b>${player.t(t.id) > 1 ? ` (rank ${player.t(t.id)})` : ''}: ${t.desc}</li>`).join('') + '</ul>';
    }

    showGameOver(reason, mode, day, kills, techCount) {
        this.hideAllMenus(); this.hideTouchUI();
        const titles = { died: 'You died', dojo: 'The Dojo fell', turned: 'You turned' };
        const lines = {
            died: 'The master falls. The dead feast tonight.',
            dojo: 'The seal breaks. Magatsuhi walks free.',
            turned: 'The Kegare took you. You join the horde.'
        };
        this.$('goTitle').innerText = titles[reason] || 'You died';
        this.$('goLine').innerText = lines[reason] || '';
        const target = mode === 'ENDLESS' ? '' : ` of ${SURVIVAL_DAYS}`;
        this.$('goDesc').innerText = `Reached day ${day}${target}. ${kills} dead put to rest. ${techCount} technique${techCount === 1 ? '' : 's'} learned.`;
        this.$('gameOverMenu').classList.remove('hidden');
    }

    showVictory(kills, techCount) {
        this.hideAllMenus(); this.hideTouchUI();
        this.$('vicDesc').innerText = `${kills} dead put to rest. ${techCount} technique${techCount === 1 ? '' : 's'} learned.`;
        this.$('victoryMenu').classList.remove('hidden');
    }

    showPause(player, inPrologue = false) {
        this.hideAllMenus(); this.hideTouchUI();
        this.$('pauseTech').innerHTML = player && !inPrologue ? this.techniqueSummary(player) : '';
        this.$('skipPrologueBtn').classList.toggle('hidden', !inPrologue);
        this.$('pauseMenu').classList.remove('hidden');
    }

    showMainMenu() {
        this.hideAllMenus(); this.hideTouchUI();
        this.$('mainMenu').classList.remove('hidden');
        this.renderMenuButtons();
    }
}

export const UI = new UIController();
