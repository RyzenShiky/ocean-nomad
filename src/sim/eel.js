/** Electric eel — hides near debris/wreck, strikes when raft is slow */
const R = (a, b) => a + Math.random() * (b - a);

export class EelSim {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 20; this.y = -0.5; this.z = 8;
    this.state = 'hide';
    this.t = R(20, 40);
    this.hp = 3;
    this.playerDamage = 0;
    this.yaw = 0;
  }

  step(dt, time, raft, waveHeightFn, playerPos) {
    this.playerDamage = 0;
    const c = raft.position;
    const speed = Math.hypot(raft.velocity?.x || 0, raft.velocity?.z || 0);

    if (this.state === 'hide') {
      this.t -= dt;
      // Stay near raft offset
      this.x += ((c.x + 14) - this.x) * 0.02;
      this.z += ((c.z + 10) - this.z) * 0.02;
      this.y = waveHeightFn(this.x, this.z, time) - 0.6;
      if (this.t <= 0 && speed < 0.8) {
        this.state = 'strike';
        this.t = 4;
      }
    } else if (this.state === 'strike') {
      const tx = playerPos?.x ?? c.x;
      const tz = playerPos?.z ?? c.z;
      let dx = tx - this.x, dz = tz - this.z;
      const L = Math.hypot(dx, dz) || 1;
      this.x += (dx / L) * 5.5 * dt;
      this.z += (dz / L) * 5.5 * dt;
      this.y = waveHeightFn(this.x, this.z, time) - 0.3;
      this.yaw = Math.atan2(dx, dz);
      if (L < 2.2) {
        this.playerDamage = 8;
        this.state = 'hide';
        this.t = R(25, 45);
      } else if ((this.t -= dt) <= 0) {
        this.state = 'hide';
        this.t = R(20, 35);
      }
    } else if (this.state === 'flee') {
      this.x += Math.cos(this.yaw) * 6 * dt;
      this.z += Math.sin(this.yaw) * 6 * dt;
      this.y = waveHeightFn(this.x, this.z, time) - 0.4;
      if ((this.t -= dt) <= 0) {
        this.state = 'hide';
        this.t = R(30, 50);
        this.hp = 3;
      }
    }
  }

  hit() {
    this.hp = (this.hp || 3) - 1;
    this.state = 'flee';
    this.t = 6;
    this.yaw = Math.random() * Math.PI * 2;
    return this.hp <= 0;
  }
}
