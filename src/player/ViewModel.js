import * as THREE from 'three';

function mat(color, opts = {}) {
  const c = new THREE.Color(color);
  const ei = opts.emissiveIntensity ?? 0.22;
  return new THREE.MeshStandardMaterial({
    color: c,
    emissive: c.clone(),
    emissiveIntensity: ei,
    metalness: opts.metalness ?? 0,
    roughness: opts.roughness ?? 0.55,
    ...opts,
    emissiveIntensity: ei
  });
}

const WOOD = () => mat(0x6b4423, { roughness: 0.85, emissiveIntensity: 0.2 });
const IRON = () => mat(0x888888, { metalness: 0.65, roughness: 0.4, emissiveIntensity: 0.2 });

const GEOS = {
  hammer: () => {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.36, 0.04), WOOD());
    handle.position.y = -0.08;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.15), IRON());
    head.position.y = 0.12;
    g.add(handle, head);
    return g;
  },
  hook: () => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.55, 8), WOOD());
    pole.position.y = -0.05;
    const crook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI * 1.3), IRON());
    crook.position.set(0.06, 0.225, 0);
    crook.rotation.z = -0.3 * Math.PI;
    g.add(pole, crook);
    return g;
  },
  axe: () => {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.4, 0.035), WOOD());
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.13), IRON());
    blade.position.set(0, 0.14, -0.07);
    const poll = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.035), IRON());
    poll.position.set(0, 0.14, 0.03);
    g.add(handle, blade, poll);
    return g;
  },
  rod: () => {
    const g = new THREE.Group();
    const cane = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.016, 0.7, 8),
      mat(0x8a6a3a, { roughness: 0.8, emissiveIntensity: 0.2 })
    );
    cane.position.y = 0.1;
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8),
      mat(0x2b2118, { roughness: 0.9, emissiveIntensity: 0.15 })
    );
    grip.position.y = -0.2;
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10), IRON());
    reel.rotation.z = Math.PI / 2;
    reel.position.set(0.03, -0.1, 0);
    g.add(cane, grip, reel);
    return g;
  },
  spear: () => {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.62, 8), WOOD());
    shaft.position.y = 0.05;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), IRON());
    tip.position.y = 0.41;
    tip.scale.z = 0.35;
    g.add(shaft, tip);
    return g;
  }
};

const POSES = {
  axe:    { pos: [0.26, -0.18, -0.50], rot: [-0.45, -0.35, -0.15], swing: 'chop' },
  hammer: { pos: [0.26, -0.18, -0.50], rot: [-0.40, -0.35, -0.15], swing: 'chop' },
  hook:   { pos: [0.30, -0.15, -0.50], rot: [-0.70, -0.25, -0.10], swing: 'cast' },
  rod:    { pos: [0.30, -0.18, -0.50], rot: [-0.95, -0.20, -0.10], swing: 'cast' },
  spear:  { pos: [0.28, -0.15, -0.50], rot: [-1.15, -0.25, -0.10], swing: 'thrust' }
};

export class ViewModel {
  constructor(camera) {
    this.root = new THREE.Group();
    this.root.scale.setScalar(0.9);
    camera.add(this.root);
    this.meshes = {};
    for (const [id, fn] of Object.entries(GEOS)) {
      const m = fn();
      m.visible = false;
      this.root.add(m);
      this.meshes[id] = m;
    }
    this.current = null;
    this.pose = POSES.axe;
    this.base = new THREE.Vector3(...POSES.axe.pos);
    this.root.position.copy(this.base);
    this.root.rotation.set(...POSES.axe.rot);
    this.swingT = 0;
    this.bob = 0;
    this._light = new THREE.PointLight(0xfff0dd, 0.35, 2.5, 2);
    this._light.position.set(0.1, 0.05, 0.2);
    this.root.add(this._light);
  }

  setVisible(v) {
    this.root.visible = !!v;
  }

  setItem(id) {
    const visual = id === 'axe_iron' ? 'axe' : id;
    if (this.current === visual) return;
    for (const m of Object.values(this.meshes)) m.visible = false;
    this.current = visual;
    if (visual && this.meshes[visual]) this.meshes[visual].visible = true;
    this.pose = POSES[visual] ?? POSES.axe;
    this.base.set(...this.pose.pos);
  }

  swing() {
    this.swingT = 0.2;
  }

  update(dt, moving) {
    const k = 1 - Math.exp(-dt * 14);
    let dx = 0, dz = 0;
    if (this.swingT > 0) {
      this.swingT = Math.max(0, this.swingT - dt);
      const s = Math.sin((1 - this.swingT / 0.2) * Math.PI);
      if (this.pose.swing === 'chop') dx = -s * 0.9;
      if (this.pose.swing === 'cast') dx = -s * 0.5;
      if (this.pose.swing === 'thrust') dz = -s * 0.18;
    }
    const [rx, ry, rz] = this.pose.rot;
    const r = this.root.rotation;
    const p = this.root.position;
    r.x += (rx + dx - r.x) * k;
    r.y += (ry - r.y) * k;
    r.z += (rz - r.z) * k;

    if (moving) this.bob += dt * 10;
    const ty = this.base.y + (moving ? Math.sin(this.bob) * 0.02 : 0);
    const tx = this.base.x + (moving ? Math.cos(this.bob * 0.5) * 0.01 : 0);
    p.x += (tx - p.x) * k;
    p.y += (ty - p.y) * k;
    p.z += (this.base.z + dz - p.z) * k;
  }
}
