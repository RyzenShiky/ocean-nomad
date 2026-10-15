const CELL = 2.0;
const R = (a, b) => a + Math.random() * (b - a);

export class SharkSim {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 12;
    this.y = -0.3;
    this.z = 0;
    this.vx = 0;
    this.vz = 0;
    this.state = 'circle';
    this.t = R(30, 60);
    this.ang = 0;
    this.target = null;
    this.biteT = 0;
    this.hp = new Map();
    this.playerDamage = 0; // accumulated this step for Game to apply
  }

  pick(raft) {
    let best = null, bd = 1e9;
    const cx = raft.position.x, cz = raft.position.z;
    for (const k of raft.cells) {
      const [i, j] = k.split(',').map(Number);
      if (!raft.canRemove(i, j)) continue;
      const wx = cx + (i * CELL - (raft.com?.x || 0));
      const wz = cz + (j * CELL - (raft.com?.z || 0));
      const d = Math.hypot(wx - this.x, wz - this.z);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  step(dt, time, raft, waveHeightFn, playerPos) {
    this.playerDamage = 0;
    const c = raft.position;
    const prevX = this.x, prevZ = this.z;

    if (this.state === 'circle') {
      this.ang += 0.3 * dt;
      this.x = c.x + Math.cos(this.ang) * 10;
      this.z = c.z + Math.sin(this.ang) * 10;
      this.y = waveHeightFn(this.x, this.z, time) - 0.35;
      if ((this.t -= dt) <= 0) {
        this.target = this.pick(raft);
        if (this.target) this.state = 'attack';
        else this.t = 5;
      }
    } else if (this.state === 'attack') {
      const [i, j] = this.target.split(',').map(Number);
      const tx = c.x + (i * CELL - (raft.com?.x || 0));
      const tz = c.z + (j * CELL - (raft.com?.z || 0));
      let dx = tx - this.x, dz = tz - this.z;
      const L = Math.hypot(dx, dz) || 1;
      if (L < 1.6) {
        this.state = 'bite';
        this.biteT = 0;
      } else {
        this.x += dx * Math.min(1, 4 * dt / L);
        this.z += dz * Math.min(1, 4 * dt / L);
        this.y = waveHeightFn(this.x, this.z, time) - 0.35;
      }
    } else if (this.state === 'bite') {
      this.y = waveHeightFn(this.x, this.z, time) - 0.35;
      if ((this.biteT -= dt) <= 0) {
        this.biteT = 1.5;
        const h = (this.hp.get(this.target) ?? 6) - 1;
        this.hp.set(this.target, h);
        // Bite player if nearby in water
        if (playerPos) {
          const pd = Math.hypot(playerPos.x - this.x, playerPos.z - this.z);
          if (pd < 3.2) this.playerDamage = 12;
        }
        if (h <= 0) {
          const [i, j] = this.target.split(',').map(Number);
          raft.removeCell(i, j);
          this.hp.delete(this.target);
          this.state = 'circle';
          this.t = R(45, 90);
          this.ang = Math.atan2(this.z - c.z, this.x - c.x);
        }
      }
    } else if (this.state === 'flee') {
      let dx = this.x - c.x, dz = this.z - c.z;
      const L = Math.hypot(dx, dz) || 1;
      this.x += (dx / L) * 6 * dt;
      this.z += (dz / L) * 6 * dt;
      this.y = waveHeightFn(this.x, this.z, time) - 0.35;
      if ((this.t -= dt) <= 0) {
        this.state = 'circle';
        this.t = R(20, 30);
        this.ang = Math.atan2(this.z - c.z, this.x - c.x);
      }
    }

    this.vx = this.x - prevX;
    this.vz = this.z - prevZ;
  }

  hit() {
    if (this.state === 'attack' || this.state === 'bite') {
      this.state = 'flee';
      this.t = 8;
    }
  }

  /** Yaw in radians for mesh orientation */
  get yaw() {
    if (Math.hypot(this.vx, this.vz) < 1e-4) return this.ang + Math.PI;
    return Math.atan2(this.vx, this.vz);
  }
}
