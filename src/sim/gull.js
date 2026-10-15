/** Gull swarm — steals food from open deck / hotbar if idle too long */
const R = (a, b) => a + Math.random() * (b - a);

export class GullSwarm {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0; this.y = 8; this.z = 0;
    this.state = 'circle';
    this.t = R(40, 70);
    this.stole = false;
  }

  step(dt, raft, player, invOpen) {
    const c = raft.position;
    this.t -= dt;
    if (this.state === 'circle') {
      this.x = c.x + Math.cos(this.t * 0.4) * 12;
      this.z = c.z + Math.sin(this.t * 0.4) * 12;
      this.y = 7 + Math.sin(this.t) * 0.5;
      if (this.t <= 0 && player?.onGround) {
        this.state = 'dive';
        this.t = 3;
      }
    } else if (this.state === 'dive') {
      const tx = player.position.x, tz = player.position.z;
      this.x += (tx - this.x) * Math.min(1, 3 * dt);
      this.z += (tz - this.z) * Math.min(1, 3 * dt);
      this.y += (3 - this.y) * Math.min(1, 2 * dt);
      if ((this.t -= dt) <= 0) {
        // Steal food-like item from hotbar
        let stolen = null;
        if (player.inventory) {
          for (let i = 0; i < player.inventory.slots.length; i++) {
            const s = player.inventory.slots[i];
            if (s && ['food', 'cooked_fish', 'raw_fish', 'potato', 'stew', 'fish_soup'].includes(s.id)) {
              stolen = s.id;
              player.inventory.remove(s.id, 1);
              break;
            }
          }
        }
        this.stole = !!stolen;
        this.state = 'flee';
        this.t = 20;
        return stolen;
      }
    } else if (this.state === 'flee') {
      this.y += 4 * dt;
      this.x += 3 * dt;
      if ((this.t -= dt) <= 0) {
        this.state = 'circle';
        this.t = R(50, 90);
        this.stole = false;
      }
    }
    return null;
  }
}
