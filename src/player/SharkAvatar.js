import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Skinned reef shark. Nose faces +Z in the GLB — matches shark.yaw
 * (0 = +Z) from sim/shark.js. Do NOT add Math.PI to body.rotation.y.
 */
export class SharkAvatar {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    this.mixer = null;
    this.actions = {};
    this.current = null;
    this.ready = false;
    this._finishedHook = null;
    this._load();
  }

  async _load() {
    try {
      const gltf = await new GLTFLoader().loadAsync('./assets/shark.glb');
      const body = gltf.scene;
      // Nose is already +Z — same convention as shark.yaw (no π flip).
      // If GLB is the longer ~4.6 m export, shrink to ~2.3 m to match old cone.
      const box = new THREE.Box3().setFromObject(body);
      const len = box.max.z - box.min.z;
      if (len > 3.2) {
        body.scale.setScalar(0.5);
      }
      body.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.root.add(body);
      this.mixer = new THREE.AnimationMixer(body);
      for (const clip of gltf.animations) {
        this.actions[clip.name] = this.mixer.clipAction(clip);
      }
      if (this.actions.Swim) {
        this.actions.Swim.play();
        this.current = 'Swim';
      } else if (this.actions.Idle) {
        this.actions.Idle.play();
        this.current = 'Idle';
      }
      this.ready = true;
      this.root.visible = true;
    } catch (e) {
      console.warn('SharkAvatar load failed', e);
    }
  }

  play(name, { loop = true } = {}) {
    if (!this.ready || !this.actions[name]) return;
    if (this.current === name && loop) return;
    const next = this.actions[name];
    const prev = this.current ? this.actions[this.current] : null;
    if (this._finishedHook) {
      this.mixer.removeEventListener('finished', this._finishedHook);
      this._finishedHook = null;
    }
    next.reset();
    if (!loop) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      this._finishedHook = () => {
        this.play('Swim');
      };
      this.mixer.addEventListener('finished', this._finishedHook);
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }
    next.setEffectiveWeight(1).fadeIn(0.15).play();
    if (prev && prev !== next) prev.fadeOut(0.15);
    this.current = name;
  }

  attack() {
    this.play('Attack', { loop: false });
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} yaw  shark.yaw: 0 = +Z (sim/shark.js) — matches model nose
   * @param {string} state circle|attack|bite|flee
   * @param {number} dt
   */
  update(x, y, z, yaw, state, dt) {
    if (!this.ready) return;
    this.root.position.set(x, y, z);
    // shark.yaw: 0 = +Z — matches model nose direction directly
    this.root.rotation.y = yaw;

    if (state === 'attack' || state === 'bite') {
      if (this.current !== 'Attack') this.play('Attack', { loop: false });
    } else if (state === 'flee') {
      if (this.current !== 'Flee') {
        if (this.actions.Flee) this.play('Flee', { loop: false });
        else this.play('Swim');
      }
    } else {
      if (this.current !== 'Swim' && this.current !== 'Idle') this.play('Swim');
    }
    this.mixer?.update(dt);
  }
}
