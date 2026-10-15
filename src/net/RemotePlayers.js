import * as THREE from 'three';
import { SurvivorAvatar } from '../player/SurvivorAvatar.js';

export class RemotePlayers {
  constructor(scene, raft) {
    this.scene = scene;
    this.raft = raft;
    this.map = new Map();
  }

  update(peers, dt) {
    const seen = new Set();
    for (const [uid, p] of peers) {
      seen.add(uid);
      let r = this.map.get(uid);
      if (!r) {
        const av = new SurvivorAvatar(this.scene);
        av.setThirdPerson(true);
        r = {
          av,
          pos: new THREE.Vector3(p.x || 0, p.y || 1.3, p.z || 0),
          name: p.name || 'Crew'
        };
        this.map.set(uid, r);
      }
      r.name = p.name || r.name;
      const target = new THREE.Vector3(p.x || 0, p.y || 1.3, p.z || 0);
      r.pos.lerp(target, 1 - Math.exp(-12 * dt));
      const world = r.pos.clone();
      this.raft.group.localToWorld(world);
      const yaw = p.yaw || 0;
      const look = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      r.av.update(world, look, p.spd || 0, (p.spd || 0) > 5.5, dt);
      r.hp = p.hp ?? 100;
    }
    for (const [uid, r] of this.map) {
      if (!seen.has(uid)) {
        try { this.scene.remove(r.av.root); } catch (_) {}
        this.map.delete(uid);
      }
    }
  }

  /** For crew HUD */
  list() {
    return [...this.map.entries()].map(([uid, r]) => ({
      uid, name: r.name, hp: r.hp ?? 100
    }));
  }
}
