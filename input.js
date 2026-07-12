/* =========================================
   LAST DOJO V2 - INPUT CONTROLLER (input.js)
========================================= */

export class InputController {
    constructor() {
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isEditingHUD = false;
        
        // Define default key mappings
        this.defaultKeys = { 
            up: 'w', left: 'a', down: 's', right: 'd', 
            punch: ' ', spin: 'shift', sleep: 'e', eat: 'r', pause: 'p' 
        };
        
        // Load user keys from local storage or fallback to defaults
        this.userKeys = JSON.parse(localStorage.getItem('lastDojoKeys')) || { ...this.defaultKeys };
        this.bindingAction = null;

        // The live state of all inputs that the Game Loop will read
        this.keys = { 
            up: false, down: false, left: false, right: false, 
            punch: false, spin: false, eat: false, sleep: false, pause: false 
        };
        this.mouse = { left: false, right: false }; 

        // Action-Ready flags (prevents holding a key to spam an action)
        this.eReady = true; 
        this.rReady = true; 
        this.shiftReady = true;

        this.initKeyboard();
        this.initMouse();
        if (this.isTouchDevice) {
            this.initTouch();
        }
    }

    // --- KEYBOARD LOGIC ---
    initKeyboard() {
        window.addEventListener('keydown', (e) => { 
            if(this.bindingAction) {
                e.preventDefault();
                let k = e.key.toLowerCase(); 
                if (k === 'escape') return; 
                this.userKeys[this.bindingAction] = k;
                localStorage.setItem('lastDojoKeys', JSON.stringify(this.userKeys));
                this.bindingAction = null;
                // Note: The UI update function will need to be called externally
                document.dispatchEvent(new Event('keysUpdated'));
                return;
            }

            let key = e.key.toLowerCase(); 
            // Prevent default browser scrolling for game keys
            if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault(); 
            
            if (key === this.userKeys.up) this.keys.up = true;
            if (key === this.userKeys.down) this.keys.down = true;
            if (key === this.userKeys.left) this.keys.left = true;
            if (key === this.userKeys.right) this.keys.right = true;
            if (key === this.userKeys.sleep) this.keys.sleep = true;
            if (key === this.userKeys.eat) this.keys.eat = true;
            if (key === this.userKeys.punch) this.keys.punch = true;
            if (key === this.userKeys.spin) this.keys.spin = true;
            if (key === this.userKeys.pause || key === 'escape') {
                this.keys.pause = true;
                document.dispatchEvent(new Event('togglePause'));
            }

            // Global generic confirms
            if (key === ' ' || key === 'enter') { 
                document.dispatchEvent(new Event('gameConfirm')); 
            }
            if (key === 'q') { 
                document.dispatchEvent(new Event('quitToMenu')); 
            }
            if (key === 'o') { 
                document.dispatchEvent(new Event('openSettings')); 
            }
        });
        
        window.addEventListener('keyup', (e) => { 
            if(this.bindingAction) return; 
            let key = e.key.toLowerCase(); 
            
            if (key === this.userKeys.up) this.keys.up = false;
            if (key === this.userKeys.down) this.keys.down = false;
            if (key === this.userKeys.left) this.keys.left = false;
            if (key === this.userKeys.right) this.keys.right = false;
            if (key === this.userKeys.punch) this.keys.punch = false;
            if (key === this.userKeys.pause || key === 'escape') this.keys.pause = false;
            if (key === this.userKeys.sleep) { this.keys.sleep = false; this.eReady = true; }
            if (key === this.userKeys.eat) { this.keys.eat = false; this.rReady = true; }
            if (key === this.userKeys.spin) { this.keys.spin = false; this.shiftReady = true; }
        });
    }

    // --- MOUSE LOGIC ---
    initMouse() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return; // Safeguard if DOM isn't fully loaded

        canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        canvas.addEventListener('mousedown', (e) => {
            // Trigger a custom event to let the game handle clicks in specific states
            document.dispatchEvent(new CustomEvent('canvasClick', { detail: { button: e.button } }));
            
            if (e.button === 0) this.mouse.left = true; 
            if (e.button === 2) this.mouse.right = true;
        });
        
        window.addEventListener('mouseup', (e) => { 
            if (e.button === 0) this.mouse.left = false; 
            if (e.button === 2) this.mouse.right = false; 
        });

        // Clear inputs if user clicks outside the canvas or tabs out
        document.addEventListener('mousedown', (e) => {
            if (e.target !== canvas) {
                this.resetMovement();
            }
        });

        window.addEventListener('blur', () => {
            this.resetMovement();
        });
    }

    // --- MOBILE TOUCH LOGIC ---
    initTouch() {
        let joyZone = document.getElementById('joystickZone'); 
        let joyBase = document.getElementById('joystickBase'); 
        let joyStick = document.getElementById('joystickStick');
        
        if(!joyZone || !joyBase || !joyStick) return;

        let joyActive = false; 
        let joyOrigin = {x:0, y:0}; 
        let joyMax = 40; 
        let joyTouchId = null;

        // Joystick Start
        joyZone.addEventListener('touchstart', (e) => {
            e.preventDefault(); 
            if (joyActive || this.isEditingHUD) return; 
            
            let touch = e.changedTouches[0]; 
            joyTouchId = touch.identifier; 
            joyActive = true;
            joyOrigin = { x: touch.clientX, y: touch.clientY };
            
            joyBase.style.left = (joyOrigin.x) + 'px'; 
            joyBase.style.top = (joyOrigin.y) + 'px'; 
            joyBase.style.bottom = 'auto'; 
            joyBase.style.display = 'flex';
            
            this.updateJoy(touch, joyOrigin, joyMax, joyStick);
        }, {passive: false});

        // Joystick Move
        document.addEventListener('touchmove', (e) => {
            if (!joyActive || this.isEditingHUD) return;
            for(let i=0; i<e.changedTouches.length; i++) { 
                if(e.changedTouches[i].identifier === joyTouchId) { 
                    e.preventDefault(); 
                    this.updateJoy(e.changedTouches[i], joyOrigin, joyMax, joyStick); 
                    break; 
                } 
            }
        }, {passive: false});

        // Joystick End
        const stopJoy = (e) => {
            if (!joyActive || this.isEditingHUD) return;
            for(let i=0; i<e.changedTouches.length; i++) {
                if(e.changedTouches[i].identifier === joyTouchId) {
                    joyActive = false; 
                    joyTouchId = null; 
                    joyStick.style.transform = `translate(0px, 0px)`; 
                    joyBase.style.display = 'none';
                    this.keys.up = false; 
                    this.keys.down = false; 
                    this.keys.left = false; 
                    this.keys.right = false; 
                    break;
                }
            }
        };
        document.addEventListener('touchend', stopJoy); 
        document.addEventListener('touchcancel', stopJoy);

        // Bind HUD Buttons
        this.bindTouchBtn('btnPunch', 'punch'); 
        this.bindTouchBtn('btnSpin', 'spin'); 
        this.bindTouchBtn('btnEat', 'eat'); 
        this.bindTouchBtn('btnSleep', 'sleep');
    }

    updateJoy(touch, joyOrigin, joyMax, joyStick) {
        let dx = touch.clientX - joyOrigin.x; 
        let dy = touch.clientY - joyOrigin.y;
        
        // Handle CSS Portrait Hack math adjustment
        if (window.innerHeight > window.innerWidth) { 
            let tmp = dx; dx = dy; dy = -tmp; 
        }
        
        let dist = Math.hypot(dx, dy); 
        if (dist > joyMax) { 
            dx = (dx/dist)*joyMax; 
            dy = (dy/dist)*joyMax; 
        }
        joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
        
        let deadzone = 10;
        this.keys.up = dy < -deadzone; 
        this.keys.down = dy > deadzone; 
        this.keys.left = dx < -deadzone; 
        this.keys.right = dx > deadzone;
    }

    bindTouchBtn(id, keyName) {
        let btn = document.getElementById(id); 
        if(!btn) return; 
        let isDragging = false;
        
        btn.addEventListener('touchstart', (e) => { 
            if(this.isEditingHUD) { 
                isDragging = true; 
            } else { 
                e.preventDefault(); 
                this.keys[keyName] = true; 
            }
        }, {passive:false});
        
        btn.addEventListener('touchmove', (e) => {
            if (this.isEditingHUD && isDragging) {
                e.preventDefault(); 
                let touch = e.touches[0]; 
                let percentX, percentY;
                if (window.innerHeight > window.innerWidth) {
                    percentX = (touch.clientY / window.innerHeight) * 100; 
                    percentY = ((window.innerWidth - touch.clientX) / window.innerWidth) * 100;
                } else {
                    percentX = (touch.clientX / window.innerWidth) * 100; 
                    percentY = (touch.clientY / window.innerHeight) * 100;
                }
                percentX = Math.max(5, Math.min(95, percentX)); 
                percentY = Math.max(5, Math.min(95, percentY));
                btn.style.left = percentX + '%'; 
                btn.style.top = percentY + '%'; 
                btn.style.right = 'auto'; 
                btn.style.bottom = 'auto';
            }
        }, {passive:false});
        
        btn.addEventListener('touchend', (e) => { 
            if (this.isEditingHUD) { 
                isDragging = false; 
            } else {
                e.preventDefault(); 
                this.keys[keyName] = false; 
                if(keyName === 'sleep') this.eReady = true; 
                if(keyName === 'eat') this.rReady = true; 
                if(keyName === 'spin') this.shiftReady = true; 
            }
        });
    }

    // --- HELPER METHODS ---
    resetMovement() {
        for (let k in this.keys) this.keys[k] = false; 
        this.mouse.left = false; 
        this.mouse.right = false;
    }

    getDisplayKey(k) { 
        if (k === ' ') return 'SPACE';
        if (k === 'escape') return 'ESC';
        return k.toUpperCase(); 
    }

    startBinding(action) {
        if(this.bindingAction) {
            let oldBtn = document.getElementById('bind_' + this.bindingAction);
            if(oldBtn) oldBtn.classList.remove('waiting');
        }
        this.bindingAction = action;
        let btn = document.getElementById('bind_' + action);
        if(btn) {
            btn.innerText = 'PRESS KEY...';
            btn.classList.add('waiting');
        }
    }
}

// Export a single, global instance
export const Input = new InputController();