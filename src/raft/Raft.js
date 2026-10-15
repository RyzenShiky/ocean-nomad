import * as THREE from 'three';
import { createPlankGeometry } from '../rendering/geometry/PlankGeometry.js';
import { Materials } from '../rendering/materials/Materials.js';
import { waveHeight } from '../world/Ocean.js';
import { CUR } from '../world/Current.js';

export const CELL = 2.0;
export const DECK_Y = 0.21;
export const FLOOR_H = 1.7;
const HULL_Y = -0.05;
const MAX_CELLS = 512;
const CELL_MASS = 120;
const DRIFT = 0.25;

const HULL_GEO = new THREE.BoxGeometry(CELL * 0.96, 0.42, CELL * 0.96);
const HULL_MAT = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 1 });
const CELL_GEO = createPlankGeometry({
  length: CELL * 0.96,
  width: CELL * 0.96,
  height: 0.10
});

const PROP_GEO = {
  simple_grill: new THREE.BoxGeometry(0.8, 0.55, 0.8),
  small_storage: new THREE.BoxGeometry(0.9, 0.7, 0.7),
  large_storage: new THREE.BoxGeometry(1.2, 0.9, 0.9),
  research_table: new THREE.BoxGeometry(1.0, 0.6, 0.7),
  engine_bio: new THREE.BoxGeometry(0.9, 0.55, 0.7),
  engine_elec: new THREE.BoxGeometry(0.85, 0.5, 0.65),
  helm: new THREE.CylinderGeometry(0.35, 0.4, 0.9, 8),
  control_panel: new THREE.BoxGeometry(0.7, 0.9, 0.35),
  biofuel_refiner: new THREE.BoxGeometry(0.9, 0.75, 0.7),
  antenna: new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6),
  radio_receiver: new THREE.BoxGeometry(0.55, 0.4, 0.4),
  simple_bed: new THREE.BoxGeometry(0.9, 0.35, 1.6),
  purifier: new THREE.BoxGeometry(0.7, 0.9, 0.7),
  crop_plot: new THREE.BoxGeometry(1.2, 0.2, 1.2),
  wall: new THREE.BoxGeometry(CELL + 0.12, 1.6, 0.14),
  window: new THREE.BoxGeometry(CELL + 0.12, 1.6, 0.14),
  door: new THREE.BoxGeometry(CELL + 0.12, 1.6, 0.14),
  roof: new THREE.BoxGeometry(CELL * 0.98, 0.08, CELL * 0.98),
  pillar: new THREE.BoxGeometry(0.25, 1.8, 0.25),
  sail: new THREE.BoxGeometry(0.15, 2.2, 1.4),
  net: new THREE.BoxGeometry(1.6, 0.8, 0.1),
  stairs: new THREE.BoxGeometry(CELL * 1.05, 0.12, CELL * 0.9),
  smelter: new THREE.BoxGeometry(0.9, 1.0, 0.9)
};
const PROP_MAT = {
  simple_grill: new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 }),
  small_storage: new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.85 }),
  large_storage: new THREE.MeshStandardMaterial({ color: 0x6B4423, roughness: 0.85 }),
  research_table: new THREE.MeshStandardMaterial({ color: 0x6B4423, roughness: 0.8 }),
  engine_bio: new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.5, roughness: 0.45 }),
  engine_elec: new THREE.MeshStandardMaterial({ color: 0x3a5a6a, metalness: 0.55, roughness: 0.4 }),
  helm: new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.7 }),
  control_panel: new THREE.MeshStandardMaterial({ color: 0x2a3a4a, metalness: 0.4, roughness: 0.5 }),
  biofuel_refiner: new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.75 }),
  antenna: new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.7, roughness: 0.35 }),
  radio_receiver: new THREE.MeshStandardMaterial({ color: 0x3d3d3d, metalness: 0.5, roughness: 0.4 }),
  simple_bed: new THREE.MeshStandardMaterial({ color: 0x4a6fa5, roughness: 0.9 }),
  purifier: new THREE.MeshStandardMaterial({ color: 0x6a8aaa, metalness: 0.3, roughness: 0.5 }),
  crop_plot: new THREE.MeshStandardMaterial({ color: 0x3d5c28, roughness: 1 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.9 }),
  window: new THREE.MeshStandardMaterial({ color: 0x7a9ab0, roughness: 0.5, metalness: 0.2, transparent: true, opacity: 0.85 }),
  door: new THREE.MeshStandardMaterial({ color: 0x5c4030, roughness: 0.9 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 }),
  pillar: new THREE.MeshStandardMaterial({ color: 0x7a5c38, roughness: 0.9 }),
  sail: new THREE.MeshStandardMaterial({ color: 0xe8e0d0, side: THREE.DoubleSide, roughness: 1 }),
  net: new THREE.MeshStandardMaterial({ color: 0x888878, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  stairs: new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.9 }),
  smelter: new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5, roughness: 0.4 })
};

export class Raft {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'Raft';
    scene.add(this.group);

    this.cells = new Set();
    this.cellKeys = [];
    this.props = new Map();
    this.edges = new Map(); // key "i,j,d" d=0N 1E 2S 3W
    this.buoyancyPoints = [];
    this.mass = 0;
    this.inertia = 1;
    this.loads = [];
    this.sailRaised = false;
    this.freezeFactor = 0; // 0 open water .. 1 locked in ice

    this.com = new THREE.Vector3();
    this.position = new THREE.Vector3(0, 0.35, 0);
    this.prevPos = this.position.clone();
    this.quaternion = new THREE.Quaternion();
    this.prevQuat = this.quaternion.clone();
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.delta = new THREE.Vector3();

    this._tmpR = new THREE.Vector3();
    this._tmpF = new THREE.Vector3();
    this._tmpT = new THREE.Vector3();
    this._tmpV = new THREE.Vector3();
    this._force = new THREE.Vector3();
    this._torque = new THREE.Vector3();
    this._dq = new THREE.Quaternion();
    this._m4 = new THREE.Matrix4();

    this.cellInst = new THREE.InstancedMesh(CELL_GEO, Materials.wood, MAX_CELLS);
    this.cellInst.count = 0;
    this.cellInst.frustumCulled = false;
    this.cellInst.castShadow = true;
    this.cellInst.receiveShadow = true;
    this.group.add(this.cellInst);

    this.hullInst = new THREE.InstancedMesh(HULL_GEO, HULL_MAT, MAX_CELLS);
    this.hullInst.count = 0;
    this.hullInst.frustumCulled = false;
    this.hullInst.castShadow = true;
    this.group.add(this.hullInst);

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) this.addCell(i, j, false);
    }
    this._rebuildBuoyancy();
    this.group.quaternion.copy(this.quaternion);
    this.group.position.copy(this.position).sub(this.com);
  }

  cellKey(i, j) { return `${i},${j}`; }

  hasCell(x, z) {
    return this.cells.has(this.cellKey(Math.round(x / CELL), Math.round(z / CELL)));
  }

  canPlace(i, j) {
    const k = this.cellKey(i, j);
    if (this.cells.has(k)) return false;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([a, b]) => this.cells.has(this.cellKey(i + a, j + b)));
  }

  canRemove(i, j) {
    const k = this.cellKey(i, j);
    if (!this.cells.has(k) || this.cells.size <= 1) return false;
    const rest = new Set(this.cells);
    rest.delete(k);
    const start = rest.values().next().value;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const [a, b] = stack.pop().split(',').map(Number);
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = this.cellKey(a + da, b + db);
        if (rest.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    return seen.size === rest.size;
  }

  addCell(i, j, rebuild = true) {
    const k = this.cellKey(i, j);
    if (this.cells.has(k) || this.cellInst.count >= MAX_CELLS) return false;
    this.cells.add(k);
    this.cellKeys.push(k);
    const idx = this.cellInst.count;
    this._m4.makeTranslation(i * CELL, DECK_Y - 0.05, j * CELL);
    this.cellInst.setMatrixAt(idx, this._m4);
    this.cellInst.count = idx + 1;
    this.cellInst.instanceMatrix.needsUpdate = true;
    this._m4.makeTranslation(i * CELL, DECK_Y - 0.05 - 0.21, j * CELL);
    this.hullInst.setMatrixAt(idx, this._m4);
    this.hullInst.count = this.cellInst.count;
    this.hullInst.instanceMatrix.needsUpdate = true;
    this.mass += CELL_MASS;
    if (rebuild) this._rebuildBuoyancy();
    return true;
  }

  removeCell(i, j, rebuild = true) {
    if (!this.canRemove(i, j)) return false;
    const k = this.cellKey(i, j);
    const idx = this.cellKeys.indexOf(k);
    const last = this.cellKeys.length - 1;
    if (idx !== last && idx >= 0) {
      this.cellInst.getMatrixAt(last, this._m4);
      this.cellInst.setMatrixAt(idx, this._m4);
      this.hullInst.getMatrixAt(last, this._m4);
      this.hullInst.setMatrixAt(idx, this._m4);
      this.cellKeys[idx] = this.cellKeys[last];
    }
    this.cellKeys.pop();
    this.cellInst.count--;
    this.hullInst.count = this.cellInst.count;
    this.cellInst.instanceMatrix.needsUpdate = true;
    this.hullInst.instanceMatrix.needsUpdate = true;
    this.cells.delete(k);
    this.mass -= CELL_MASS;
    // Remove prop on cell + its mass
    if (this.props.has(k)) {
      const p = this.props.get(k);
      this.group.remove(p.mesh);
      this.props.delete(k);
      this.mass -= 40;
    }
    if (rebuild) { this.pruneOrphanEdges(); this._rebuildBuoyancy(); }
    return true;
  }

  placeProp(i, j, recipeId, rotY = 0) {
    const k = this.cellKey(i, j);
    if (!this.cells.has(k) || this.props.has(k)) return false;
    const geo = PROP_GEO[recipeId];
    const mat = PROP_MAT[recipeId];
    if (!geo || !mat) return false;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    let yOff = recipeId === 'wall' || recipeId === 'pillar' || recipeId === 'sail' ? DECK_Y + 0.85
      : recipeId === 'crop_plot' ? DECK_Y + 0.12
      : recipeId === 'stairs' ? DECK_Y + FLOOR_H / 2
      : DECK_Y + 0.3;
    mesh.position.set(i * CELL, yOff, j * CELL);
    mesh.rotation.y = rotY;
    if (recipeId === 'stairs') {
      mesh.rotation.z = Math.atan2(FLOOR_H, CELL);
    }
    this.group.add(mesh);
    const data = { id: recipeId, mesh, rotY, inv: null };
    if (recipeId === 'small_storage') data.inv = Array(8).fill(null);
    if (recipeId === 'large_storage') data.inv = Array(16).fill(null);
    if (recipeId === 'engine_bio' || recipeId === 'engine_elec') {
      data.on = false;
      data.fuel = recipeId === 'engine_bio' ? 0 : undefined;
    }
    this.props.set(k, data);
    this.mass += 40;
    this._rebuildBuoyancy();
    return true;
  }

  removePropAt(i, j) {
    const k = this.cellKey(i, j);
    if (!this.props.has(k)) return null;
    const p = this.props.get(k);
    this.group.remove(p.mesh);
    this.props.delete(k);
    this.mass -= 40;
    return p;
  }

  _rebuildBuoyancy() {
    const oldOff = this.com.clone().applyQuaternion(this.quaternion);
    const com = new THREE.Vector3();
    for (const key of this.cells) {
      const [i, j] = key.split(',').map(Number);
      com.x += i * CELL;
      com.z += j * CELL;
    }
    com.divideScalar(Math.max(1, this.cells.size));
    this.com.copy(com);

    const shift = this.com.clone().applyQuaternion(this.quaternion).sub(oldOff);
    this.position.add(shift);
    this.prevPos.add(shift);

    let r2 = 0;
    for (const key of this.cells) {
      const [i, j] = key.split(',').map(Number);
      const dx = i * CELL - com.x, dz = j * CELL - com.z;
      r2 += (dx * dx + dz * dz) / 2 + (CELL * CELL) / 12;
    }
    this.inertia = Math.max(1, CELL_MASS * r2);

    this.buoyancyPoints.length = 0;
    const h = CELL * 0.35;
    for (const key of this.cells) {
      const [i, j] = key.split(',').map(Number);
      const cx = i * CELL - com.x, cz = j * CELL - com.z;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        this.buoyancyPoints.push(new THREE.Vector3(cx + sx * h, HULL_Y, cz + sz * h));
      }
    }
  }




  edgeCenter(e) {
    return e.d === 0
      ? { x: e.i * CELL, z: e.j * CELL - CELL / 2 }
      : { x: e.i * CELL - CELL / 2, z: e.j * CELL };
  }

  nearestDoor(lx, lz, maxD = 2.2) {
    let best = null, bd = maxD;
    for (const e of this.edges.values()) {
      if (e.type !== 'door') continue;
      const c = this.edgeCenter(e);
      const d = Math.hypot(c.x - lx, c.z - lz);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  floorHeights(lx, lz) {
    const i = Math.round(lx / CELL), j = Math.round(lz / CELL);
    const k = this.cellKey(i, j);
    if (!this.cells.has(k)) return [];
    const hs = [DECK_Y];
    if (this.props.has(k + ':roof')) hs.push(DECK_Y + FLOOR_H);
    const st = this.props.get(k);
    if (st && st.id === 'stairs') {
      const c = Math.cos(st.rotY || 0), s = Math.sin(st.rotY || 0);
      const t = Math.min(1, Math.max(0, ((lx - i * CELL) * c - (lz - j * CELL) * s) / CELL + 0.5));
      hs.push(DECK_Y + t * FLOOR_H);
    }
    return hs;
  }

  stepEdges(dt) {
    for (const e of this.edges.values()) {
      if (e.type !== 'door') continue;
      const target = e.open ? 1 : 0;
      e.t += (target - e.t) * Math.min(1, 8 * dt);
      if (e.mesh) e.mesh.rotation.y = (e.baseRot || 0) - e.t * Math.PI / 2 * 0.95;
    }
  }

  edgeKey(i, j, d) { return `${i},${j},${d}`; }

  /** Normalize edge so shared sides use one key (prefer lower i or j) */
  normalizeEdge(i, j, d) {
    if (d === 1) return { i: i + 1, j, d: 3 }; // E of cell -> W of neighbor
    if (d === 2) return { i, j: j + 1, d: 0 }; // S -> N of neighbor
    return { i, j, d };
  }

  hasEdge(i, j, d) {
    const n = this.normalizeEdge(i, j, d);
    return this.edges.has(this.edgeKey(n.i, n.j, n.d));
  }

  placeEdge(i, j, d, typeId) {
    const n = this.normalizeEdge(i, j, d);
    const k = this.edgeKey(n.i, n.j, n.d);
    if (this.edges.has(k)) return false;
    // Need floor on at least one side
    const hasA = this.cells.has(this.cellKey(n.i, n.j));
    const hasB = n.d === 0
      ? this.cells.has(this.cellKey(n.i, n.j - 1))
      : this.cells.has(this.cellKey(n.i - 1, n.j));
    if (!hasA && !hasB) return false;
    const geo = PROP_GEO[typeId] || PROP_GEO.wall;
    const mat = PROP_MAT[typeId] || PROP_MAT.wall;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    // Position on edge of cell n.i,n.j
    let x = n.i * CELL, z = n.j * CELL, rot = 0;
    if (n.d === 0) { z -= CELL * 0.5; rot = 0; }
    else { x -= CELL * 0.5; rot = Math.PI / 2; }
    mesh.position.set(x, DECK_Y + 0.85, z);
    mesh.rotation.y = rot;
    this.group.add(mesh);
    this.edges.set(k, { type: typeId, mesh, i: n.i, j: n.j, d: n.d });
    this.mass += 25;
    return true;
  }

  placeRoof(i, j) {
    const k = this.cellKey(i, j);
    if (!this.cells.has(k) || this.props.has(k + ':roof')) return false;
    const mesh = new THREE.Mesh(PROP_GEO.roof, PROP_MAT.roof);
    mesh.position.set(i * CELL, DECK_Y + 1.66, j * CELL);
    this.group.add(mesh);
    this.props.set(k + ':roof', { id: 'roof', mesh, rotY: 0, inv: null });
    this.mass += 20;
    return true;
  }

  removeEdge(i, j, d) {
    const n = this.normalizeEdge(i, j, d);
    const k = this.edgeKey(n.i, n.j, n.d);
    const e = this.edges.get(k);
    if (!e) return false;
    try { this.group.remove(e.mesh); } catch (_) {}
    this.edges.delete(k);
    this.mass = Math.max(1, this.mass - 25);
    return true;
  }

  removeRoof(i, j) {
    const k = this.cellKey(i, j) + ':roof';
    const p = this.props.get(k);
    if (!p) return false;
    try { this.group.remove(p.mesh); } catch (_) {}
    this.props.delete(k);
    this.mass = Math.max(1, this.mass - 20);
    return true;
  }

  /** Remove edges that no longer touch any floor */
  pruneOrphanEdges() {
    for (const [k, e] of [...this.edges]) {
      const hasA = this.cells.has(this.cellKey(e.i, e.j));
      const hasB = e.d === 0
        ? this.cells.has(this.cellKey(e.i, e.j - 1))
        : this.cells.has(this.cellKey(e.i - 1, e.j));
      if (!hasA && !hasB) {
        this.group.remove(e.mesh);
        this.edges.delete(k);
        this.mass -= 25;
      }
    }
  }

  /** Simple local-space wall collision for player (xz). Doors pass center. */
  resolveWallCollision(localPos, radius = 0.3) {
    for (const e of this.edges.values()) {
      if (e.type === 'door' && e.open) continue;
      // Wall segment AABB in local
      let minx, maxx, minz, maxz;
      if (e.d === 0) {
        minx = e.i * CELL - CELL * 0.5; maxx = e.i * CELL + CELL * 0.5;
        minz = e.j * CELL - CELL * 0.5 - 0.1; maxz = e.j * CELL - CELL * 0.5 + 0.1;
      } else {
        minx = e.i * CELL - CELL * 0.5 - 0.1; maxx = e.i * CELL - CELL * 0.5 + 0.1;
        minz = e.j * CELL - CELL * 0.5; maxz = e.j * CELL + CELL * 0.5;
      }
      const cx = Math.max(minx, Math.min(localPos.x, maxx));
      const cz = Math.max(minz, Math.min(localPos.z, maxz));
      const dx = localPos.x - cx, dz = localPos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        localPos.x = cx + (dx / d) * radius;
        localPos.z = cz + (dz / d) * radius;
      }
    }
    return localPos;
  }

  /** Full soft-reset to 2x2 starter (New Voyage) */
  resetToStarter() {
    // Clear props
    for (const [, p] of this.props) this.group.remove(p.mesh);
    this.props.clear();
    for (const e of this.edges.values()) this.group.remove(e.mesh);
    this.edges.clear();
    this.cells.clear();
    this.cellKeys = [];
    this.cellInst.count = 0;
    this.cellInst.instanceMatrix.needsUpdate = true;
    if (this.hullInst) {
      this.hullInst.count = 0;
      this.hullInst.instanceMatrix.needsUpdate = true;
    }
    this.mass = 0;
    this.loads = [];
    this.sailRaised = false;
    this.position.set(0, 0.35, 0);
    this.prevPos.copy(this.position);
    this.quaternion.identity();
    this.prevQuat.identity();
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.com.set(0, 0, 0);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) this.addCell(i, j, false);
    }
    this._rebuildBuoyancy();
    this.group.quaternion.copy(this.quaternion);
    this.group.position.copy(this.position).sub(this.com);
  }

  /** Rigid-body carry: map world point from previous pose to current */
  carry(p) {
    p.sub(this.prevPos)
      .applyQuaternion(this._dq.copy(this.prevQuat).invert())
      .applyQuaternion(this.quaternion)
      .add(this.position);
    return p;
  }

  step(dt, time) {
    this.prevPos.copy(this.position);
    this.prevQuat.copy(this.quaternion);

    const nPts = Math.max(1, this.buoyancyPoints.length);
    const K_BUOY = (this.mass * 9.8) / (nPts * 0.15);
    const K_DAMP = this.mass * 3.0 / nPts;

    this._force.set(0, 0, 0);
    this._torque.set(0, 0, 0);

    for (const p of this.buoyancyPoints) {
      this._tmpR.copy(p).applyQuaternion(this.quaternion);
      const x = this.position.x + this._tmpR.x;
      const y = this.position.y + this._tmpR.y;
      const z = this.position.z + this._tmpR.z;
      const sub = waveHeight(x, z, time) - y;
      if (sub <= 0) continue;
      this._tmpV.crossVectors(this.angularVelocity, this._tmpR).add(this.velocity);
      const fy = Math.min(sub, 0.65) * K_BUOY - this._tmpV.y * K_DAMP;
      this._tmpF.set(0, fy, 0);
      this._force.add(this._tmpF);
      this._torque.add(this._tmpT.copy(this._tmpR).cross(this._tmpF));
    }

    this._force.y -= this.mass * 9.8;

    // Player / cargo loads
    for (const L of this.loads) {
      this._tmpR.copy(L.pos).sub(this.position);
      this._tmpF.set(0, -L.mass * 9.8, 0);
      this._force.add(this._tmpF);
      this._torque.add(this._tmpT.copy(this._tmpR).cross(this._tmpF));
    }

    this.velocity.addScaledVector(this._force, dt / Math.max(1, this.mass));

    // Drift toward current + optional sail
    const k = Math.min(1, 1.8 * dt);
    let tx = CUR.x * DRIFT, tz = CUR.z * DRIFT;
    if (this.sailRaised) {
      tx += CUR.x * 0.9;
      tz += CUR.z * 0.9;
    }
    this.velocity.x += (tx - this.velocity.x) * k;
    this.velocity.z += (tz - this.velocity.z) * k;
    // Ice drag: nearly immobile when freezeFactor → 1
    if (this.freezeFactor > 0.01) {
      const iceDrag = 1 - 0.97 * this.freezeFactor;
      this.velocity.x *= iceDrag;
      this.velocity.z *= iceDrag;
      this.angularVelocity.y *= iceDrag;
    }

    this.angularVelocity.addScaledVector(this._torque, dt / Math.max(1, this.inertia));
    this.angularVelocity.multiplyScalar(Math.max(0, 1 - 1.5 * dt));

    this.position.addScaledVector(this.velocity, dt);

    const w = this.angularVelocity;
    const q = this.quaternion;
    this._dq.set(w.x, w.y, w.z, 0).multiply(q);
    q.x += this._dq.x * 0.5 * dt;
    q.y += this._dq.y * 0.5 * dt;
    q.z += this._dq.z * 0.5 * dt;
    q.w += this._dq.w * 0.5 * dt;
    q.normalize();

    const cy = waveHeight(this.position.x, this.position.z, time);
    if (this.position.y < cy - 0.5) {
      this.position.y = cy - 0.5;
      if (this.velocity.y < 0) this.velocity.y = 0;
    }

    this.delta.copy(this.position).sub(this.prevPos);
    this.group.quaternion.copy(this.quaternion);
    this.group.position.copy(this.position)
      .sub(this._tmpR.copy(this.com).applyQuaternion(this.quaternion));
  }

  applyRender(alpha) {
    this.group.quaternion.slerpQuaternions(this.prevQuat, this.quaternion, alpha);
    this.group.position.lerpVectors(this.prevPos, this.position, alpha)
      .sub(this._tmpR.copy(this.com).applyQuaternion(this.group.quaternion));
  }
}
