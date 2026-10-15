import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Materials } from '../rendering/materials/Materials.js';
import { DECK_Y } from '../raft/Raft.js';
import { Inventory } from '../gameplay/Inventory.js';
import { tickVitals } from '../sim/vitals.js';

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.position = new THREE.Vector3(0.5, 1.2, 0.5);
    this.prev = this.position.clone();
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.height = 1.7;
    this.oxygen = 100;
    this.health = 100;
    this.thirst = 100;
    this.hunger = 100;
    this.stamina = 100;
    this.dead = false;
    this.inventory = new Inventory();
    this.keys = {};
    this.touchActive = false; // mobile virtual controls
    this.mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 1.1, 4, 8),
      Materials.player
    );
    this.mesh.visible = false;
  }

  lock() { this.controls.lock(); }
  unlock() { this.controls.unlock(); }
  get isLocked() { return this.controls.isLocked || this.touchActive; }

  bindInput() {
    document.addEventListener('keydown', e => { this.keys[e.code] = true; });
    document.addEventListener('keyup', e => { this.keys[e.code] = false; });
  }

  drink(n) { this.thirst = Math.min(100, this.thirst + n); }
  eat(n) { this.hunger = Math.min(100, this.hunger + n); }
  heal(n) { this.health = Math.min(100, this.health + n); }

  step(dt, raft, time, waveHeightFn) {
    this.prev.copy(this.position);
    const active = this.controls.isLocked;
    const K = c => active && this.keys[c];

    // Rigid carry only when standing on deck
    if (this.onGround && raft) raft.carry(this.position);

    const sprint = (K('ShiftLeft') || K('ShiftRight')) && this.stamina > 10;
    const speed = sprint ? 7.2 : 4.6;

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    let mx = 0, mz = 0;
    if (K('KeyW')) { mx += forward.x; mz += forward.z; }
    if (K('KeyS')) { mx -= forward.x; mz -= forward.z; }
    if (K('KeyA')) { mx -= right.x; mz -= right.z; }
    if (K('KeyD')) { mx += right.x; mz += right.z; }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx = (mx / len) * speed; mz = (mz / len) * speed;
      this.stamina = Math.max(0, this.stamina - (sprint ? 12 : 3.5) * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 22 * dt);
    }

    this.velocity.x = mx;
    this.velocity.z = mz;
    this.velocity.y -= 18 * dt;
    if (K('Space') && this.onGround) {
      this.velocity.y = 7.2;
      this.onGround = false;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    this.onGround = false;
    if (raft) {
      const local = this.position.clone();
      raft.group.worldToLocal(local);
      if (raft.resolveWallCollision) {
        raft.resolveWallCollision(local, 0.32);
        const w = local.clone();
        raft.group.localToWorld(w);
        this.position.x = w.x;
        this.position.z = w.z;
      }
      const hs = raft.floorHeights ? raft.floorHeights(local.x, local.z) : (raft.hasCell(local.x, local.z) ? [DECK_Y] : []);
      if (hs.length) {
        const feet = local.y;
        const prev = this._prevLocalY ?? feet;
        let best = null;
        for (const h of hs) {
          const isDeck = Math.abs(h - DECK_Y) < 0.05;
          if (feet <= h + 0.08 && this.velocity.y <= 0.5 && (isDeck || prev >= h - 0.35)) {
            best = best === null ? h : Math.max(best, h);
          }
        }
        if (best !== null) {
          const deckLocal = new THREE.Vector3(local.x, best, local.z);
          raft.group.localToWorld(deckLocal);
          this.position.y = deckLocal.y;
          this.velocity.y = 0;
          this.onGround = true;
          this.oxygen = Math.min(100, this.oxygen + 40 * dt);
          this._prevLocalY = best;
        } else {
          this._prevLocalY = feet;
        }
      }
    }

    if (!this.onGround) {
      const waterY = waveHeightFn(this.position.x, this.position.z, time);
      if (this.position.y + this.height * 0.45 < waterY + 0.25) {
        const sub = (waterY + 0.35) - this.position.y;
        this.velocity.y += sub * 26 * dt;
        this.velocity.x *= Math.max(0, 1 - 2.2 * dt);
        this.velocity.z *= Math.max(0, 1 - 2.2 * dt);
        if (this.velocity.y > 3.8) this.velocity.y = 3.8;
        if (K('Space')) this.velocity.y += 11 * dt;
        if (this.position.y + this.height * 0.9 < waterY) {
          this.oxygen = Math.max(0, this.oxygen - 12 * dt);
          if (this.oxygen <= 0) this.health = Math.max(0, this.health - 15 * dt);
        } else {
          this.oxygen = Math.min(100, this.oxygen + 25 * dt);
        }
      }
    }

    tickVitals(this, dt);
  }
}
