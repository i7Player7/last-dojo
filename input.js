/* =========================================
   LAST DOJO V3 - INPUT CONTROLLER (input.js)
========================================= */

export const ACTIONS = ['up', 'left', 'down', 'right', 'punch', 'spin', 'dash', 'interact', 'eat', 'unleash', 'pause'];

export const ACTION_LABELS = {
    up: 'Move up', left: 'Move left', down: 'Move down', right: 'Move right',
    punch: 'Punch', spin: 'Spin kick', dash: 'Dash', interact: 'Interact (rest, offer)',
    eat: 'Eat meat', unleash: 'Unleash essence', pause: 'Pause'
};

const ARROWS = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };

export class InputController {
    constructor() {
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isEditingHUD = false;

        this.defaultKeys = {
            up: 'w', left: 'a', down: 's', right: 'd',
            punch: ' ', spin: 'shift', dash: 'f', interact: 'e', eat: 'r', unleash: 'q', pause: 'p'
        };
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem('lastDojoKeys')); } catch (e) {}
        this.userKeys = { ...this.defaultKeys, ...(stored || {}) };
        // migrate V2 bindings: the old "sleep" key becomes "interact"
        if (stored && stored.sleep && !stored.interact) this.userKeys.interact = stored.sleep;
        delete this.userKeys.sleep;
        this.bindingAction = null;

        this.keys = {};
        ACTIONS.forEach(a => this.keys[a] = false);
        this.pressedAt = {};
        this.mouse = { left: false, right: false };

        this.initKeyboard();
        this.initMouse();
        if (this.isTouchDevice) this.initTouch();
    }

    // ---- buffered presses: a press counts if consumed within a short window ----
    press(a) {
        if (!this.keys[a]) this.pressedAt[a] = performance.now();
        this.keys[a] = true;
    }
    release(a) { this.keys[a] = false; }
    consume(a, windowMs = 160) {
        const t = this.pressedAt[a];
        if (t && performance.now() - t <= windowMs) { this.pressedAt[a] = 0; return true; }
        return false;
    }
    clearPresses() { this.pressedAt = {}; }

    actionsFor(key) {
        const out = ACTIONS.filter(a => this.userKeys[a] === key);
        if (ARROWS[key] && !out.includes(ARROWS[key])) out.push(ARROWS[key]);
        return out;
    }

    saveKeys() { localStorage.setItem('lastDojoKeys', JSON.stringify(this.userKeys)); }

    // --- KEYBOARD ---
    initKeyboard() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.bindingAction) {
                e.preventDefault();
                if (key === 'escape') { this.bindingAction = null; document.dispatchEvent(new Event('keysUpdated')); return; }
                // swap if another action already uses this key
                const prev = this.userKeys[this.bindingAction];
                for (const a of ACTIONS) if (a !== this.bindingAction && this.userKeys[a] === key) this.userKeys[a] = prev;
                this.userKeys[this.bindingAction] = key;
                this.saveKeys();
                this.bindingAction = null;
                document.dispatchEvent(new Event('keysUpdated'));
                return;
            }
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT') return;

            const acts = this.actionsFor(key);
            if (acts.length || [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault();
            for (const a of acts) this.press(a);

            if (e.repeat) return;
            if (acts.includes('pause') || key === 'escape') document.dispatchEvent(new Event('togglePause'));
            if (key === ' ' || key === 'enter') document.dispatchEvent(new Event('gameConfirm'));
            if (key === 'q') document.dispatchEvent(new Event('quitToMenu'));
            if (['1', '2', '3', '4'].includes(key)) document.dispatchEvent(new CustomEvent('choicePick', { detail: { index: Number(key) - 1 } }));
        });

        window.addEventListener('keyup', (e) => {
            if (this.bindingAction) return;
            for (const a of this.actionsFor(e.key.toLowerCase())) this.release(a);
        });
    }

    // --- MOUSE ---
    initMouse() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        canvas.addEventListener('mousedown', (e) => {
            document.dispatchEvent(new CustomEvent('canvasClick', { detail: { button: e.button } }));
            if (e.button === 0) this.mouse.left = true;
            if (e.button === 2) this.mouse.right = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.left = false;
            if (e.button === 2) this.mouse.right = false;
        });
        window.addEventListener('blur', () => this.resetMovement());
    }

    // --- TOUCH ---
    initTouch() {
        const joyZone = document.getElementById('joystickZone');
        const joyBase = document.getElementById('joystickBase');
        const joyStick = document.getElementById('joystickStick');
        if (!joyZone || !joyBase || !joyStick) return;

        let active = false, origin = { x: 0, y: 0 }, touchId = null;
        const max = 40;

        joyZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (active || this.isEditingHUD) return;
            const t = e.changedTouches[0];
            touchId = t.identifier; active = true;
            origin = { x: t.clientX, y: t.clientY };
            const rect = document.getElementById('gameContainer').getBoundingClientRect();
            // position the base in container space (handles the rotated portrait layout)
            let lx = t.clientX - rect.left, ly = t.clientY - rect.top;
            if (window.innerHeight > window.innerWidth) { lx = t.clientY - rect.top; ly = rect.right - t.clientX; }
            joyBase.style.left = lx + 'px'; joyBase.style.top = ly + 'px';
            joyBase.style.display = 'flex';
            this.updateJoy(t, origin, max, joyStick);
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!active || this.isEditingHUD) return;
            for (const t of e.changedTouches) {
                if (t.identifier === touchId) { e.preventDefault(); this.updateJoy(t, origin, max, joyStick); break; }
            }
        }, { passive: false });

        const stop = (e) => {
            if (!active) return;
            for (const t of e.changedTouches) {
                if (t.identifier === touchId) {
                    active = false; touchId = null;
                    joyStick.style.transform = 'translate(0px, 0px)';
                    joyBase.style.display = 'none';
                    ['up', 'down', 'left', 'right'].forEach(a => this.release(a));
                    break;
                }
            }
        };
        document.addEventListener('touchend', stop);
        document.addEventListener('touchcancel', stop);

        const map = { btnPunch: 'punch', btnSpin: 'spin', btnDash: 'dash', btnAct: 'interact', btnEat: 'eat', btnRush: 'unleash' };
        for (const id in map) this.bindTouchBtn(id, map[id]);
        this.bindTouchBtn('btnPause', null);

        // tapping the canvas confirms on story screens and game over
        document.getElementById('gameCanvas').addEventListener('touchstart', () => {
            document.dispatchEvent(new CustomEvent('canvasClick', { detail: { button: 0 } }));
        }, { passive: true });
    }

    updateJoy(t, origin, max, stick) {
        let dx = t.clientX - origin.x, dy = t.clientY - origin.y;
        if (window.innerHeight > window.innerWidth) { const tmp = dx; dx = dy; dy = -tmp; }
        const d = Math.hypot(dx, dy);
        if (d > max) { dx = dx / d * max; dy = dy / d * max; }
        stick.style.transform = `translate(${dx}px, ${dy}px)`;
        const dz = 10;
        const set = (a, on) => on ? this.press(a) : this.release(a);
        set('up', dy < -dz); set('down', dy > dz); set('left', dx < -dz); set('right', dx > dz);
    }

    bindTouchBtn(id, action) {
        const btn = document.getElementById(id);
        if (!btn) return;
        let dragging = false;
        btn.addEventListener('touchstart', (e) => {
            if (this.isEditingHUD) { dragging = true; return; }
            e.preventDefault();
            if (action) this.press(action);
            else document.dispatchEvent(new Event('togglePause'));
        }, { passive: false });
        btn.addEventListener('touchmove', (e) => {
            if (!(this.isEditingHUD && dragging)) return;
            e.preventDefault();
            const t = e.touches[0];
            let px, py;
            if (window.innerHeight > window.innerWidth) {
                px = (t.clientY / window.innerHeight) * 100;
                py = ((window.innerWidth - t.clientX) / window.innerWidth) * 100;
            } else {
                px = (t.clientX / window.innerWidth) * 100;
                py = (t.clientY / window.innerHeight) * 100;
            }
            btn.style.left = Math.max(5, Math.min(95, px)) + '%';
            btn.style.top = Math.max(5, Math.min(95, py)) + '%';
        }, { passive: false });
        btn.addEventListener('touchend', (e) => {
            if (this.isEditingHUD) { dragging = false; return; }
            e.preventDefault();
            if (action) this.release(action);
        });
    }

    resetMovement() {
        for (const k in this.keys) this.keys[k] = false;
        this.mouse.left = false; this.mouse.right = false;
    }

    getDisplayKey(k) {
        if (k === undefined || k === null) return '?';
        if (k === ' ') return 'Space';
        if (k === 'escape') return 'Esc';
        if (k === 'shift') return 'Shift';
        if (k.startsWith('arrow')) return k.replace('arrow', '').replace(/^./, c => c.toUpperCase());
        return k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1);
    }

    startBinding(action) {
        if (this.bindingAction) {
            const old = document.getElementById('bind_' + this.bindingAction);
            if (old) old.classList.remove('waiting');
        }
        this.bindingAction = action;
        const btn = document.getElementById('bind_' + action);
        if (btn) { btn.innerText = 'Press a key'; btn.classList.add('waiting'); }
    }
}

export const Input = new InputController();
