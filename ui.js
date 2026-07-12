/* =========================================
   LAST DOJO V2 - UI & MENUS (ui.js)
========================================= */

import { sfx } from './assets.js';
import { Input } from './input.js';

export class UIController {
    constructor() {
        this.highScore = parseInt(localStorage.getItem('lastDojoHighScore') || '0');

        this.defaultEndless = { 
            maxZ: 25, zSpeed: 1.0, zHealth: 1.0, zDamage: 1.0, bHealth: 1.0, bSpeed: 1.0, pSpeed: 1.0, 
            infStamReg: false, infStamBM: true, knockback: 1.0, spinCd: 1.0, lifesteal: 0, stamDrain: 1.0, 
            spawnRate: 1.0, explodeZ: false, bossFreq: 21, bossSize: 1.0, bossCap: 3, bmFreq: 7, 
            phaseLen: 1.0, dojoRegen: false, dojoHp: 300, crates: 3, bandageDrop: 0.1, 
            ohk: false, pitchBlack: false, lavaMode: false 
        };
        
        this.endlessConfig = JSON.parse(localStorage.getItem('lastDojoEndlessConfig'));
        if (!this.endlessConfig) { 
            this.endlessConfig = { ...this.defaultEndless }; 
        } else { 
            this.endlessConfig = { ...this.defaultEndless, ...this.endlessConfig }; 
        }

        this.defaultHUD = {
            btnPunch: { left: '88%', top: '80%' },
            btnSpin:  { left: '75%', top: '65%' },
            btnEat:   { left: '88%', top: '50%' },
            btnSleep: { left: '70%', top: '82%' },
            btnPause: { left: '5%',  top: '10%' }
        };

        document.addEventListener('keysUpdated', () => this.updateControlsUI());
        this.exposeToWindow();
    }

    init() {
        this.applyHUDPositions();
        this.renderMenuButtons();
    }

    exposeToWindow() {
        window.toggleAudio = () => { 
            sfx.muted = !sfx.muted; 
            document.getElementById('audioBtn').innerText = sfx.muted ? "AUDIO: OFF" : "AUDIO: ON"; 
        };

        window.openSettings = () => { 
            this.hideAllMenus(); 
            document.getElementById('settingsMenu').classList.remove('hidden'); 
        };
        
        window.closeSettings = () => { 
            this.hideAllMenus();
            document.dispatchEvent(new Event('requestCloseSettings'));
        };

        window.openControlsMenu = () => { 
            this.hideAllMenus(); 
            if (Input.isTouchDevice) {
                Input.isEditingHUD = true;
                document.getElementById('touchUI').classList.remove('hidden');
                document.getElementById('hudEditOverlay').classList.remove('hidden');
                document.querySelectorAll('.touch-btn').forEach(btn => btn.classList.add('editing'));
            } else {
                document.getElementById('controlsMenu').classList.remove('hidden'); 
                this.updateControlsUI(); 
            }
        };

        window.closeControlsMenu = () => { 
            this.hideAllMenus(); 
            document.getElementById('settingsMenu').classList.remove('hidden'); 
            Input.bindingAction = null; 
        };

        window.startBind = (action) => { Input.startBinding(action); };

        window.openEndlessSettings = () => { 
            this.hideAllMenus(); 
            this.loadEndlessUI(); 
            document.getElementById('endlessSettingsMenu').classList.remove('hidden'); 
        };

        window.saveEndlessSettings = () => {
            for (let k in this.endlessConfig) {
                let el = document.getElementById('eo_' + k);
                if (el) {
                    if (el.type === 'checkbox') this.endlessConfig[k] = el.checked;
                    else this.endlessConfig[k] = parseFloat(document.getElementById('num_' + k).value);
                }
            }
            localStorage.setItem('lastDojoEndlessConfig', JSON.stringify(this.endlessConfig));
            this.hideAllMenus(); 
            document.getElementById('mainMenu').classList.remove('hidden');
        };

        window.updateEO = (key, value) => {
            let rangeEl = document.getElementById('eo_' + key);
            let numEl = document.getElementById('num_' + key);
            if (!rangeEl || !numEl) return;
            if (value !== undefined) {
                rangeEl.value = value;
                numEl.value = value;
            } else {
                numEl.value = rangeEl.value;
            }
        };

        window.saveMobileHUD = () => {
            let newHUD = {};
            ['btnPunch', 'btnSpin', 'btnEat', 'btnSleep', 'btnPause'].forEach(id => {
                let el = document.getElementById(id);
                newHUD[id] = { left: el.style.left, top: el.style.top };
            });
            localStorage.setItem('lastDojoMobileHUD', JSON.stringify(newHUD));
            this.exitHUDMode();
        };

        window.resetMobileHUD = () => { 
            localStorage.setItem('lastDojoMobileHUD', JSON.stringify(this.defaultHUD)); 
            this.applyHUDPositions(); 
            this.exitHUDMode(); 
        };

        window.startGame = (mode) => { document.dispatchEvent(new CustomEvent('startGame', { detail: { mode: mode } })); };
        window.startTutorialMenu = () => { document.dispatchEvent(new Event('startTutorial')); };
        window.startEpilogueMenu = () => { document.dispatchEvent(new Event('startEpilogue')); };
        window.restartGame = () => { document.dispatchEvent(new Event('restartGame')); };
        window.quitToMenu = () => { document.dispatchEvent(new Event('quitToMenu')); };
    }

    hideAllMenus() {
        ['mainMenu', 'settingsMenu', 'pauseMenu', 'gameOverMenu', 'victoryMenu', 'controlsMenu', 'endlessSettingsMenu'].forEach(id => {
            let el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });
        Input.bindingAction = null; 
    }

    renderMenuButtons() {
        const container = document.getElementById('dynamicMenuButtons'); 
        if(!container) return;
        container.innerHTML = ''; 
        
        let hs = parseInt(localStorage.getItem('lastDojoHighScore') || '0');
        let hsDisplay = document.getElementById('highScoreDisplay');
        if(hsDisplay) hsDisplay.innerText = hs > 1 ? `HIGHEST SURVIVAL: DAY ${hs}` : "";
        
        const surBtn = document.createElement('button'); surBtn.className = 'arcade-btn'; surBtn.onclick = () => window.startGame('SURVIVAL'); surBtn.innerText = 'SURVIVAL';
        const epiBtn = document.createElement('button'); epiBtn.className = 'arcade-btn'; epiBtn.onclick = window.startEpilogueMenu; epiBtn.innerText = 'EPILOGUE';

        const endWrap = document.createElement('div'); endWrap.style.display = 'flex'; endWrap.style.margin = '6px'; endWrap.style.width = '85%'; endWrap.style.maxWidth = '340px'; endWrap.style.justifyContent = 'center';
        const endBtn = document.createElement('button'); endBtn.className = 'arcade-btn'; endBtn.onclick = () => window.startGame('ENDLESS'); endBtn.innerText = 'ENDLESS MODE'; endBtn.style.margin = '0'; endBtn.style.flex = '1';
        const gearBtn = document.createElement('button'); gearBtn.className = 'arcade-btn'; gearBtn.onclick = window.openEndlessSettings; gearBtn.innerText = '⚙'; gearBtn.style.margin = '0 0 0 6px'; gearBtn.style.width = '60px'; gearBtn.style.padding = '0';
        endWrap.appendChild(endBtn); endWrap.appendChild(gearBtn);

        container.appendChild(document.createElement('button')).className='hidden'; 
        
        // PROLOGUE REMOVED - Default directly to SURVIVAL
        if (!localStorage.getItem('lastDojoPlayed')) {
            surBtn.classList.add('pulse'); container.appendChild(surBtn);
        } else {
            container.appendChild(surBtn);
            if (localStorage.getItem('lastDojoEndlessUnlocked')) container.appendChild(endWrap);
        }

        if (localStorage.getItem('lastDojoEpilogueUnlocked')) container.appendChild(epiBtn);

        let spacer = document.createElement('div'); spacer.style.height = "20px"; container.appendChild(spacer);
        const settingsBtn = document.createElement('button'); settingsBtn.className = 'arcade-btn'; settingsBtn.onclick = window.openSettings; settingsBtn.innerText = 'SETTINGS';
        container.appendChild(settingsBtn);
        this.updateControlsUI();
    }

    updateControlsUI() {
        ['up','left','down','right','punch','spin','sleep','eat','pause'].forEach(act => {
            let btn = document.getElementById('bind_' + act);
            if(btn) { 
                btn.innerText = Input.getDisplayKey(Input.userKeys[act]); 
                btn.classList.remove('waiting'); 
            }
        });
    }

    loadEndlessUI() {
        for (let k in this.endlessConfig) {
            let el = document.getElementById('eo_' + k);
            if (el) {
                if (el.type === 'checkbox') el.checked = this.endlessConfig[k];
                else { 
                    el.value = this.endlessConfig[k]; 
                    window.updateEO(k, this.endlessConfig[k]); 
                }
            }
        }
    }

    applyHUDPositions() {
        let savedHUD = JSON.parse(localStorage.getItem('lastDojoMobileHUD')) || this.defaultHUD;
        for (let id in savedHUD) {
            let el = document.getElementById(id);
            if (el) { el.style.left = savedHUD[id].left; el.style.top = savedHUD[id].top; el.style.right = 'auto'; el.style.bottom = 'auto'; }
        }
    }

    exitHUDMode() {
        Input.isEditingHUD = false;
        document.getElementById('hudEditOverlay').classList.add('hidden');
        document.getElementById('touchUI').classList.add('hidden');
        document.querySelectorAll('.touch-btn').forEach(btn => btn.classList.remove('editing'));
        document.getElementById('settingsMenu').classList.remove('hidden');
    }

    showGameOver(dojoFell, wasTutorial, dayCount) {
        this.hideAllMenus();
        document.getElementById('goTitle').innerText = dojoFell ? "THE DOJO FELL" : "YOU DIED";
        document.getElementById('goDesc').innerText = wasTutorial ? "Tutorial Failed" : `Survived to Day ${dayCount}`;
        document.getElementById('gameOverMenu').classList.remove('hidden');
        if (Input.isTouchDevice) document.getElementById('touchUI').classList.add('hidden');
    }

    showVictory() {
        this.hideAllMenus();
        document.getElementById('victoryMenu').classList.remove('hidden');
        if (Input.isTouchDevice) document.getElementById('touchUI').classList.add('hidden');
    }

    showPause() {
        this.hideAllMenus();
        document.getElementById('pauseMenu').classList.remove('hidden');
        if (Input.isTouchDevice) document.getElementById('touchUI').classList.add('hidden');
    }

    showMainMenu() {
        this.hideAllMenus();
        document.getElementById('mainMenu').classList.remove('hidden');
        this.renderMenuButtons();
        if (Input.isTouchDevice) document.getElementById('touchUI').classList.add('hidden');
    }

    showTouchUI() {
        if (Input.isTouchDevice) {
            let touchUI = document.getElementById('touchUI');
            if(touchUI) touchUI.classList.remove('hidden');
        }
    }
}

export const UI = new UIController();