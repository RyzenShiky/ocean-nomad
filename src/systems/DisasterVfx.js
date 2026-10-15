import * as THREE from 'three';

/** Lightweight disaster visuals — reuses simple meshes, no new particle engine */
export class DisasterVfx {
  constructor(scene) {
    this.scene = scene;
    this.geyser = null;
    this.oil = null;
    this.tornado = null;
    this.wreck = null;
  }

  spawnGeyser(pos) {
    this.clearGeyser();
    const g = new THREE.Group();
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 1.2, 6, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4422, transparent: true, opacity: 0.55 })
    );
    col.position.y = 3;
    g.add(col);
    g.position.set(pos.x, 0, pos.z);
    this.scene.add(g);
    this.geyser = g;
    setTimeout(() => this.clearGeyser(), 4000);
  }
  clearGeyser() {
    if (this.geyser) { this.scene.remove(this.geyser); this.geyser = null; }
  }

  spawnOilSlick(pos, radius = 8) {
    if (this.oil) this.scene.remove(this.oil);
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24),
      new THREE.MeshBasicMaterial({
        color: 0x1a1208, transparent: true, opacity: 0.55,
        depthWrite: false, side: THREE.DoubleSide
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.05, pos.z);
    this.scene.add(mesh);
    this.oil = mesh;
  }

  spawnWreck(pos) {
    if (this.wreck) this.scene.remove(this.wreck);
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(6, 1.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 })
    );
    hull.rotation.z = 0.35;
    hull.position.y = 0.3;
    g.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 4, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18 })
    );
    mast.position.set(0.5, 2, 0);
    mast.rotation.z = 0.5;
    g.add(mast);
    g.position.set(pos.x, 0, pos.z);
    this.scene.add(g);
    this.wreck = g;
  }

  spawnTornado(pos) {
    this.clearTornado();
    const g = new THREE.Group();
    const funnel = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x8899aa, transparent: true, opacity: 0.35,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    funnel.position.y = 7;
    g.add(funnel);
    g.position.set(pos.x, 0, pos.z);
    this.scene.add(g);
    this.tornado = g;
  }
  updateTornado(pos) {
    if (this.tornado) {
      this.tornado.position.x = pos.x;
      this.tornado.position.z = pos.z;
      this.tornado.rotation.y += 0.08;
    }
  }
  clearTornado() {
    if (this.tornado) { this.scene.remove(this.tornado); this.tornado = null; }
  }
}
