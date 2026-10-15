/**
 * Mobile touch overlay — pretends to be keyboard + mouse look.
 * Desktop: constructor no-ops (no listeners).
 */
export class TouchControls {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this._lookId = null;
    this._stickId = null;
    this._lastLook = { x: 0, y: 0 };
    this.sens = 0.0028;

    const touch = game.caps?.isTouch ??
      (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    if (!touch) return;

    this.root = document.getElementById('touch-controls');
    if (!this.root) return;

    this.enabled = true;
    this.root.classList.remove('hidden');
    this.base = this.root.querySelector('.stick-base');
    this.knob = this.root.querySelector('.stick-knob');
    this._bindJoystick();
    this._bindLookSwipe();
    this._bindButtons();
    game.player.touchActive = true;
  }

  setVisible(running) {
    if (!this.enabled || !this.root) return;
    this.root.classList.toggle('hidden', !running);
    if (!running) this._clearKeys();
  }

  _clearKeys() {
    const k = this.game.player.keys;
    for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']) k[c] = false;
  }

  _onStickMove(dx, dy) {
    const p = this.game.player;
    p.keys['KeyW'] = dy < -0.3;
    p.keys['KeyS'] = dy > 0.3;
    p.keys['KeyA'] = dx < -0.3;
    p.keys['KeyD'] = dx > 0.3;
  }

  _bindJoystick() {
    const base = this.base;
    const knob = this.knob;
    if (!base || !knob) return;
    const R = 52;

    const move = (cx, cy) => {
      const rect = base.getBoundingClientRect();
      const ox = rect.left + rect.width / 2;
      const oy = rect.top + rect.height / 2;
      let dx = cx - ox;
      let dy = cy - oy;
      const m = Math.hypot(dx, dy) || 1;
      if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this._onStickMove(dx / R, dy / R);
    };

    const end = () => {
      this._stickId = null;
      knob.style.transform = 'translate(0,0)';
      this._onStickMove(0, 0);
    };

    base.addEventListener('touchstart', e => {
      if (!this.game.running || this.game.paused) return;
      const t = e.changedTouches[0];
      this._stickId = t.identifier;
      move(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', e => {
      if (this._stickId == null) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this._stickId) {
          move(t.clientX, t.clientY);
          e.preventDefault();
          break;
        }
      }
    }, { passive: false });

    const endStick = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._stickId) end();
      }
    };
    window.addEventListener('touchend', endStick);
    window.addEventListener('touchcancel', endStick);
  }

  _bindLookSwipe() {
    const canvas = this.game.canvas;
    const cam = this.game.camera;
    const euler = { x: 0, y: 0 };

    const applyLook = (dx, dy) => {
      euler.y -= dx * this.sens;
      euler.x -= dy * this.sens;
      const lim = Math.PI / 2 - 0.05;
      euler.x = Math.max(-lim, Math.min(lim, euler.x));
      cam.rotation.order = 'YXZ';
      cam.rotation.y = euler.y;
      cam.rotation.x = euler.x;
      cam.rotation.z = 0;
    };

    const syncEuler = () => {
      cam.rotation.order = 'YXZ';
      euler.x = cam.rotation.x;
      euler.y = cam.rotation.y;
    };

    canvas.addEventListener('touchstart', e => {
      if (!this.game.running || this.game.paused || this.game.invOpen) return;
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth * 0.42) {
          this._lookId = t.identifier;
          this._lastLook.x = t.clientX;
          this._lastLook.y = t.clientY;
          syncEuler();
          e.preventDefault();
          break;
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', e => {
      if (this._lookId == null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this._lookId) continue;
        const dx = t.clientX - this._lastLook.x;
        const dy = t.clientY - this._lastLook.y;
        this._lastLook.x = t.clientX;
        this._lastLook.y = t.clientY;
        applyLook(dx, dy);
        e.preventDefault();
        break;
      }
    }, { passive: false });

    const endLook = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._lookId) this._lookId = null;
      }
    };
    window.addEventListener('touchend', endLook);
    window.addEventListener('touchcancel', endLook);
  }

  _bindButtons() {
    const g = this.game;
    const tap = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      const fire = e => { e.preventDefault(); if (g.running && !g.paused) fn(); };
      el.addEventListener('touchstart', fire, { passive: false });
      el.addEventListener('click', fire);
    };

    tap('touch-jump', () => {
      g.player.keys['Space'] = true;
      setTimeout(() => { g.player.keys['Space'] = false; }, 120);
    });
    tap('touch-sprint', () => {
      const k = g.player.keys;
      k['ShiftLeft'] = !k['ShiftLeft'];
      document.getElementById('touch-sprint')?.classList.toggle('active', !!k['ShiftLeft']);
    });
    tap('touch-interact', () => {
      if (g.build?.tryDoor()) return;
      if (g.storySys?.tryCollectNote()) return;
      if (!g.build?.useStation()) g.combat?.tryCollect();
    });
    tap('touch-craft', () => {
      g.invOpen = !g.invOpen;
      if (g.invOpen) g.craftUI?.show?.();
      else g.craftUI?.hide?.();
    });
    tap('touch-attack', () => {
      const id = g.player.inventory?.selectedSlot?.id;
      if (id === 'hammer') { g.viewModel?.swing(); g.audio?.swing(); g.build?.tryBuildFloor(); }
      else if (id === 'axe') { g.viewModel?.swing(); g.audio?.swing(); g.combat?.tryAxe(); }
      else if (id === 'spear') { g.viewModel?.swing(); g.audio?.swing(); g.combat?.trySpear(); }
      else if (id === 'hook') {
        if (g.hook.state === 'idle') { g.hook.state = 'charging'; g.hook.power = 0; }
        else if (g.hook.state === 'charging') g.hooks?.throw();
      }
    });

    for (let i = 0; i < 5; i++) {
      tap('touch-slot-' + i, () => {
        g.player.inventory.select(i);
        g._renderHotbar();
      });
    }
  }
}
