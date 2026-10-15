import * as THREE from 'three';
import { setSeaLevelOffset, seaLevelOffset } from '../world/Ocean.js';

function lerp(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return a + (b - a) * t;
}

function weightedPick(items, weights, rng = Math.random) {
  let sum = 0;
  for (const w of weights) sum += w;
  let r = rng() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Tsunami: drawback → surge → impact impulse → recede. Uses seaLevelOffset only. */
class TsunamiEvent {
  constructor({ epicenter, magnitude = 1 } = {}) {
    this.type = 'tsunami';
    this.state = 'WARNING';
    this.t = 0;
    this.phaseT = 0;
    this.magnitude = Math.max(0.25, Math.min(1.2, magnitude));
    this.epicenter = epicenter
      ? new THREE.Vector3(epicenter.x, 0, epicenter.z)
      : new THREE.Vector3(0, 0, 0);
    this._surgeDir = new THREE.Vector3(1, 0, 0);
    this.done = false;
  }

  _next(state, hold) {
    this.state = state;
    this.phaseT = 0;
    this._hold = hold;
  }

  start(game) {
    const raft = game.raft.position;
    this._surgeDir.set(raft.x - this.epicenter.x, 0, raft.z - this.epicenter.z);
    if (this._surgeDir.lengthSq() < 1e-4) this._surgeDir.set(1, 0, 0);
    else this._surgeDir.normalize();
    this._next('WARNING', 5);
    game._toast('🌊 Air laut terasa aneh...', 3500);
    game.audio?.notify?.();
  }

  tick(dt, game) {
    this.t += dt;
    this.phaseT += dt;
    const m = this.magnitude;
    const draw = -3.5 * m;
    const peak = 10 * m;

    switch (this.state) {
      case 'WARNING':
        game.overcast = 0.3;
        if (this.phaseT >= (this._hold || 5)) this._next('DRAWBACK', 7);
        break;
      case 'DRAWBACK': {
        game.overcast = 0.55;
        const u = this.phaseT / (this._hold || 7);
        setSeaLevelOffset(lerp(0, draw, u));
        if (u >= 1) {
          game._toast('⚠️ Air SURUT! Dasar laut terlihat — tsunami datang!', 4000);
          this._next('SURGE', 9);
        }
        break;
      }
      case 'SURGE': {
        game.overcast = 1.0;
        const u = this.phaseT / (this._hold || 9);
        setSeaLevelOffset(lerp(draw, peak, u));
        if (u >= 1) this._next('IMPACT', 1.2);
        break;
      }
      case 'IMPACT':
        game.overcast = 1.0;
        if (this.phaseT < dt * 1.5) {
          game._applyImpulseToRaft(this._surgeDir, 18 * m);
          game._shakeCamera(0.85 * m, 2.2);
          game.audio?.hit?.();
          game._toast('🌊 TSUNAMI!', 2500);
        }
        setSeaLevelOffset(peak);
        if (this.phaseT >= (this._hold || 1.2)) this._next('RECEDE', 16);
        break;
      case 'RECEDE': {
        const u = this.phaseT / (this._hold || 16);
        game.overcast = lerp(1.0, 0, u);
        setSeaLevelOffset(lerp(peak, 0, u));
        if (u >= 1) {
          setSeaLevelOffset(0);
          game.overcast = 0;
          this.done = true;
        }
        break;
      }
    }
    game.ocean?.setSeaOffset?.(seaLevelOffset);
  }
}

class SeaQuakeEvent {
  constructor({ pos } = {}) {
    this.type = 'seaquake';
    this.pos = pos || { x: 0, z: 0 };
    this.done = false;
    this.t = 0;
  }
  start(game) {
    game._shakeCamera(0.55, 2.4);
    game.audio?.creak?.();
    game.audio?.hit?.();
    game._toast('🌋 Gempa bawah laut!', 3000);
    this.t = 0;
  }
  tick(dt, game) {
    this.t += dt;
    if (this.t > 0.4 && !this._fired) {
      this._fired = true;
      if (Math.random() < 0.72) {
        game.disasters.start('tsunami', {
          epicenter: this.pos,
          magnitude: 0.75 + Math.random() * 0.35
        });
      }
    }
    if (this.t > 2.5) this.done = true;
  }
}

class SuperStormEvent {
  constructor() {
    this.type = 'superstorm';
    this.done = false;
    this.t = 0;
    this.windDir = new THREE.Vector3(1, 0, 0.3).normalize();
  }
  start(game) {
    game._toast('⛈️ Badai super mendekat!', 3500);
    game.audio?.notify?.();
    this.t = 0;
    this.windDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
  }
  tick(dt, game) {
    this.t += dt;
    game.storm = Math.min(1, Math.max(game.storm || 0, 0.9 + 0.08 * Math.sin(this.t)));
    game.overcast = Math.max(game.overcast || 0, 0.65 + 0.2 * Math.sin(this.t * 0.5));
    game._applyWindForce(this.windDir, game.storm * 9);
    if (this.t > 45) { game.overcast = 0; this.done = true; }
  }
}

class UnderwaterVolcanoEvent {
  constructor({ pos } = {}) {
    this.type = 'volcano';
    this.pos = pos || { x: 0, z: 0 };
    this.done = false;
    this.t = 0;
  }
  start(game) {
    const p = this.pos;
    // Place relative to raft if no pos
    if (!this._placed) {
      const r = game.raft.position;
      p.x = r.x + (Math.random() - 0.5) * 60;
      p.z = r.z + (Math.random() - 0.5) * 60;
      this._placed = true;
    }
    game._toast('🌋 Letusan bawah laut!', 3000);
    game.audio?.hit?.();
    game.vfx?.spawnGeyser?.(p);
    const dist = Math.hypot(game.raft.position.x - p.x, game.raft.position.z - p.z);
    if (dist < 14 && game.player) {
      game.player.health = Math.max(0, game.player.health - 12);
      game._toast('🔥 Semprotan panas!', 2000);
    }
    this.t = 0;
  }
  tick(dt, game) {
    this.t += dt;
    if (this.t > 0.8 && !this._tsunami) {
      this._tsunami = true;
      game.disasters.start('tsunami', { epicenter: this.pos, magnitude: 0.4 });
    }
    if (this.t > 3) this.done = true;
  }
}

class ShipwreckEvent {
  constructor() {
    this.type = 'shipwreck';
    this.done = false;
    this.t = 0;
  }
  start(game) {
    const r = game.raft.position;
    const ang = Math.random() * Math.PI * 2;
    const dist = 25 + Math.random() * 20;
    const pos = { x: r.x + Math.cos(ang) * dist, z: r.z + Math.sin(ang) * dist };
    game.vfx?.spawnWreck?.(pos);
    game.vfx?.spawnOilSlick?.(pos, 8);
    // Loot pile via debris nearby
    if (game.debris?._spawnAt) {
      for (let i = 0; i < 4; i++) {
        game.debris._spawnAt?.(
          pos.x + (Math.random() - 0.5) * 6,
          pos.z + (Math.random() - 0.5) * 6,
          Math.random() < 0.5 ? 'barrel' : 'wood'
        );
      }
    }
    game._toast('🚢 Bangkai kapal muncul di permukaan!', 3500);
    game.audio?.splash?.(0.5);
    this.t = 0;
  }
  tick(dt, game) {
    this.t += dt;
    if (this.t > 2) this.done = true;
  }
}

class TornadoEvent {
  constructor() {
    this.type = 'tornado';
    this.done = false;
    this.t = 0;
    this.pos = new THREE.Vector3();
    this.driftVel = new THREE.Vector3();
  }
  start(game) {
    const r = game.raft.position;
    const ang = Math.random() * Math.PI * 2;
    this.pos.set(r.x + Math.cos(ang) * 35, 0, r.z + Math.sin(ang) * 35);
    this.driftVel.set(Math.cos(ang + 1.2) * 2.5, 0, Math.sin(ang + 1.2) * 2.5);
    game.vfx?.spawnTornado?.(this.pos);
    game._toast('🌪️ Puting beliung di laut!', 3500);
    game.audio?.notify?.();
    this.t = 0;
  }
  tick(dt, game) {
    this.t += dt;
    this.pos.x += this.driftVel.x * dt;
    this.pos.z += this.driftVel.z * dt;
    game.vfx?.updateTornado?.(this.pos);
    const raft = game.raft.position;
    const dx = this.pos.x - raft.x;
    const dz = this.pos.z - raft.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 22 && dist > 0.1) {
      // Pull toward center + swirl
      const pull = (22 - dist) * 2.8;
      const fx = (dx / dist) * pull;
      const fz = (dz / dist) * pull;
      const sx = -dz / dist * pull * 0.7;
      const sz = dx / dist * pull * 0.7;
      game.raft.velocity.x += (fx + sx) * dt * 0.15;
      game.raft.velocity.z += (fz + sz) * dt * 0.15;
      game.raft.angularVelocity.y += 0.8 * dt;
    }
    if (this.t > 40) {
      game.vfx?.clearTornado?.();
      this.done = true;
    }
  }
}

/**
 * Single orchestrator for maritime disasters.
 * Water height effects → seaLevelOffset; storm amplitude stays on stormFactor.
 */
export class DisasterDirector {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.cooldown = 120 + Math.random() * 60; // first disaster after ~2–3 min
    this.seaRiseAcc = 0; // slow permanent rise (story pressure)
  }

  start(type, opts = {}) {
    // Don't stack two major water events
    if (this.active && !this.active.done) {
      if (type === 'tsunami' && this.active.type === 'tsunami') return;
      if (type !== 'tsunami' && this.active.type !== 'tsunami' && type !== 'seaquake') return;
    }
    let ev = null;
    switch (type) {
      case 'tsunami': ev = new TsunamiEvent(opts); break;
      case 'seaquake': ev = new SeaQuakeEvent(opts); break;
      case 'superstorm': ev = new SuperStormEvent(opts); break;
      case 'volcano': ev = new UnderwaterVolcanoEvent(opts); break;
      case 'shipwreck': ev = new ShipwreckEvent(opts); break;
      case 'tornado': ev = new TornadoEvent(opts); break;
      default: return;
    }
    // Tsunami can interrupt milder events
    if (this.active && !this.active.done && type === 'tsunami') {
      setSeaLevelOffset(0);
      this.game.ocean?.setSeaOffset?.(0);
    }
    this.active = ev;
    this.game.disasterCount = (this.game.disasterCount || 0) + 1;
    ev.start(this.game);
  }

  tick(dt) {
    const g = this.game;
    // Long-term sea rise (subtle endgame pressure) — not from random director
    if (g.running && !g.paused) {
      this.seaRiseAcc += 0.00015 * dt; // ~0.54 m per real hour
      // Only apply residual rise when no active water event
      if (!this.active || this.active.done ||
          !['tsunami'].includes(this.active.type)) {
        // don't fight tsunami offset; bake rise into baseline via small permanent add
        // stored separately and added when idle
      }
    }

    if (this.active) {
      this.active.tick(dt, g);
      if (this.active.done) {
        this.active = null;
        setSeaLevelOffset(this.seaRiseAcc);
        g.ocean?.setSeaOffset?.(this.seaRiseAcc);
        if ((g.overcast || 0) > 0.05 && !g.storm) g.overcast = 0;
        this.cooldown = 90 + Math.random() * 120;
      }
      return;
    }

    // Storm wind boost (WeatherSystem sets g.storm)
    if ((g.storm || 0) > 0.85) {
      const wind = this._windDir || (this._windDir = new THREE.Vector3(1, 0, 0.2).normalize());
      g._applyWindForce(wind, g.storm * 8);
    }

    this.cooldown -= dt;
    if (this.cooldown > 0 || !g.running || g.paused) return;

    const types = ['seaquake', 'superstorm', 'volcano', 'shipwreck', 'tornado'];
    // Weights: shipwreck common, tornado rare, seaquake medium
    const weights = [1.2, 1.0, 0.8, 1.5, 0.6];
    // Prefer less chaos early game
    const day = g.days || 1;
    if (day < 2) {
      weights[0] *= 0.5; // seaquake
      weights[1] *= 0.4;
      weights[4] *= 0.3;
    }
    const type = weightedPick(types, weights);
    this.start(type);
    this.cooldown = 100 + Math.random() * 140;
  }
}
