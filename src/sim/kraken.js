/** Event boss — brief tentacle slap during superstorm (one hit per spawn) */
export class KrakenTentacle {
  constructor() {
    this.active = false;
    this.t = 0;
    this.x = 0;
    this.z = 0;
    this.y = -2;
    this.hit = false;
    this.phase = 'rise'; // rise → slam → sink
  }

  trySpawn(storm, raft) {
    if (this.active || storm < 0.7) return false;
    if (Math.random() > 0.002) return false;
    this.active = true;
    this.t = 8;
    this.hit = false;
    this.phase = 'rise';
    this.x = raft.position.x + (Math.random() - 0.5) * 10;
    this.z = raft.position.z + (Math.random() - 0.5) * 10;
    this.y = -1;
    return true;
  }

  step(dt, raft, waveHeightFn, time) {
    if (!this.active) return 0;
    this.t -= dt;
    const wave = waveHeightFn(this.x, this.z, time);
    let dmg = 0;

    // Timeline: 8→5 rise, ~5 slam window (one hit), then sink
    if (this.t > 5) {
      this.phase = 'rise';
      const u = (8 - this.t) / 3; // 0..1
      this.y = wave - 3 + u * 6;
    } else if (this.t > 4.2) {
      this.phase = 'slam';
      this.y = wave + 1.2 + Math.sin((5 - this.t) * 12) * 0.4;
      // Single hit only
      if (!this.hit) {
        const dist = Math.hypot(raft.position.x - this.x, raft.position.z - this.z);
        if (dist < 8) {
          this.hit = true;
          raft.velocity.x += (raft.position.x - this.x) * 0.8;
          raft.velocity.z += (raft.position.z - this.z) * 0.8;
          dmg = 15;
        }
      }
    } else {
      this.phase = 'sink';
      const u = Math.max(0, this.t / 4.2);
      this.y = wave - 1 + u * 2;
    }

    if (this.t <= 0) this.active = false;
    return dmg;
  }
}
