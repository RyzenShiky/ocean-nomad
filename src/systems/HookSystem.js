import { waveHeight } from '../world/Ocean.js';

export class HookSystem {
  constructor(game) {
    this.g = game;
  }

  throw() {
    const g = this.g;
    const h = g.hook;
    g.camera.getWorldDirection(h.vel);
    h.pos.copy(g.camera.position);
    h.vel.multiplyScalar(8 + 20 * h.power);
    h.vel.y += 3;
    h.state = 'flying';
    h.t = 0;
    h.target = null;
  }

  step(dt) {
    const g = this.g;
    const h = g.hook;
    const p = g.player.position;
    switch (h.state) {
      case 'charging':
        h.power = Math.min(1, h.power + dt / 1.2);
        break;
      case 'flying': {
        h.vel.y -= 14 * dt;
        h.pos.addScaledVector(h.vel, dt);
        const w = waveHeight(h.pos.x, h.pos.z, g.time);
        if (h.pos.y <= w) {
          h.pos.y = w;
          h.state = 'floating';
          h.t = 0;
          g.audio?.splash(0.45);
        }
        break;
      }
      case 'floating':
        h.target = g.debris.nearest(h.pos, 1.6);
        if (h.target) {
          h.target.d.hooked = true;
          h.state = 'dragging';
        } else if ((h.t += dt) > 6 || h.pos.distanceTo(p) > 45) {
          h.state = 'idle';
        } else {
          h.pos.y = waveHeight(h.pos.x, h.pos.z, g.time);
        }
        break;
      case 'dragging': {
        const d = h.target.d;
        const dx = p.x - d.x, dz = p.z - d.z;
        const L = Math.hypot(dx, dz);
        if (L < 1.8) {
          g.combat.giveLoot(h.target.type);
          d.hooked = false;
          const listName = h.target.type;
          const idx = g.debris.kinds?.[listName]?.list?.indexOf(d) ?? -1;
          g.debris._respawnUpstream(d, g.raft.position);
          if (g._mpMode && g.net?.code && idx >= 0) {
            g.net.sendEvent('debris_take', { list: listName, index: idx });
          }
          h.state = 'idle';
        } else {
          d.x += (dx / L) * 6 * dt;
          d.z += (dz / L) * 6 * dt;
          h.pos.set(d.x, d.y ?? waveHeight(d.x, d.z, g.time), d.z);
        }
        break;
      }
    }
  }
}
