import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Third-person survivor body with Idle / Walk / Run clips.
 * Body mesh lives on BODY_LAYER so first-person camera can hide it
 * while the sun shadow camera still renders it (shadow without seeing head from inside).
 */
export class SurvivorAvatar {
  static BODY_LAYER = 10;

  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    this.mixer = null;
    this.actions = {};
    this.current = null;
    this.ready = false;
    this.thirdPerson = false;
    this._yaw = 0;
    this._load();
  }

  async _load() {
    try {
      const gltf = await new GLTFLoader().loadAsync('./assets/survivor.glb');
      const body = gltf.scene;
      body.scale.setScalar(1.7 / 1.75);
      body.rotation.y = Math.PI; // model faces +Z → after π faces -Z
      body.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.layers.set(SurvivorAvatar.BODY_LAYER);
        }
      });
      this.root.add(body);
      this.mixer = new THREE.AnimationMixer(body);
      for (const clip of gltf.animations) {
        this.actions[clip.name] = this.mixer.clipAction(clip);
      }
      if (this.actions.Idle) {
        this.actions.Idle.play();
        this.current = 'Idle';
      }
      this.ready = true;
      this.root.visible = true;
      // FP by default: body layer off on camera (set by Game)
    } catch (e) {
      console.warn('SurvivorAvatar load failed', e);
    }
  }

  setThirdPerson(on) {
    this.thirdPerson = !!on;
  }

  play(name) {
    if (!this.ready || this.current === name || !this.actions[name]) return;
    const next = this.actions[name];
    const prev = this.current ? this.actions[this.current] : null;
    next.reset().setEffectiveWeight(1).fadeIn(0.2).play();
    if (prev) prev.fadeOut(0.2);
    this.current = name;
  }

  /**
   * @param {THREE.Vector3} worldPos feet position
   * @param {THREE.Vector3} lookDir horizontal facing (unit, y≈0)
   * @param {number} speed xz speed
   * @param {boolean} sprinting
   * @param {number} dt
   */
  update(worldPos, lookDir, speed, sprinting, dt) {
    if (!this.ready) return;

    // Yaw so body faces look dir (child mesh already faces -Z after rotation.y = π)
    const yaw = (lookDir && (lookDir.x !== 0 || lookDir.z !== 0))
      ? Math.atan2(-lookDir.x, -lookDir.z)
      : (this._yaw ?? 0);
    this._yaw = yaw;

    // First person: push body back so camera sits in front of chest/head
    const back = this.thirdPerson ? 0 : 0.18;
    this.root.position.set(
      worldPos.x + Math.sin(yaw) * back,
      worldPos.y,
      worldPos.z + Math.cos(yaw) * back
    );
    this.root.rotation.y = yaw;

    if (speed > 5.5 && sprinting) this.play('Run');
    else if (speed > 0.4) this.play('Walk');
    else this.play('Idle');
    this.mixer?.update(dt);
  }
}
