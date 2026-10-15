import { ITEM_DEFS } from '../gameplay/Inventory.js';
import { t } from '../i18n/index.js';
import * as THREE from 'three';
import { CELL, DECK_Y } from '../raft/Raft.js';
import { RECIPES, RESEARCH_COSTS } from '../gameplay/Recipes.js';
import { STATIONS, createStationState } from '../sim/stations.js';
import { createCropState } from '../sim/crops.js';

export class BuildSystem {
  constructor(game) {
    this.g = game;
  }

  deckHit() {
    const g = this.g;
    g._ray.setFromCamera(g._ndc, g.camera);
    const inv = g._m4.copy(g.raft.group.matrixWorld).invert();
    const r = g._ray.ray.clone().applyMatrix4(inv);
    g._plane.set(g._up, -DECK_Y);
    return r.intersectPlane(g._plane, g._hit) ? g._hit : null;
  }

  playerLocalOnRaft() {
    const local = this.g.player.position.clone();
    this.g.raft.group.worldToLocal(local);
    return local;
  }

  findPlaceCell() {
    const g = this.g;
    const hit = this.deckHit();
    const pl = this.playerLocalOnRaft();
    const hx = hit ? hit.x : pl.x;
    const hz = hit ? hit.z : pl.z;
    const candidates = [];
    for (const key of g.raft.cells) {
      const [ci, cj] = key.split(',').map(Number);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = ci + di, j = cj + dj;
        if (!g.raft.canPlace(i, j)) continue;
        const d = Math.hypot(i * CELL - hx, j * CELL - hz);
        candidates.push({ i, j, d });
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    return candidates[0] || null;
  }

  findEdge() {
    const g = this.g;
    const hit = this.deckHit();
    if (!hit) return null;
    const ci = Math.round(hit.x / CELL);
    const cj = Math.round(hit.z / CELL);
    let best = null, bd = 1e9;
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        if (!g.raft.cells.has(g.raft.cellKey(i, j))) continue;
        for (const d of [0, 1, 2, 3]) {
          let mx = i * CELL, mz = j * CELL;
          if (d === 0) mz -= CELL * 0.5;
          if (d === 2) mz += CELL * 0.5;
          if (d === 3) mx -= CELL * 0.5;
          if (d === 1) mx += CELL * 0.5;
          const dist = Math.hypot(mx - hit.x, mz - hit.z);
          if (dist < bd && dist < CELL * 0.75) {
            bd = dist;
            best = { i, j, d };
          }
        }
      }
    }
    return best;
  }

  placeStructure(recipeId) {
    const g = this.g;
    const tryAt = (i, j) => {
      if (!g.raft.placeProp(i, j, recipeId, g.buildRot || 0)) return false;
      const k = g.raft.cellKey(i, j);
      if (STATIONS[recipeId]) {
        if (!g.stationStates) g.stationStates = new Map();
        g.stationStates.set(k, createStationState(recipeId));
      }
      if (recipeId === 'crop_plot') {
        if (!g.cropStates) g.cropStates = new Map();
        g.cropStates.set(k, createCropState());
      }
      return true;
    };
    const local = this.playerLocalOnRaft();
    let i = Math.round(local.x / CELL);
    let j = Math.round(local.z / CELL);
    if (g.raft.cells.has(g.raft.cellKey(i, j)) && !g.raft.props.has(g.raft.cellKey(i, j))) {
      if (tryAt(i, j)) {
        this._lastPlace = { piece: recipeId, i, j, rot: g.buildRot || 0 };
        return true;
      }
    }
    const hit = this.deckHit();
    if (hit) {
      i = Math.round(hit.x / CELL);
      j = Math.round(hit.z / CELL);
      if (tryAt(i, j)) {
        this._lastPlace = { piece: recipeId, i, j, rot: g.buildRot || 0 };
        return true;
      }
    }
    for (const k of g.raft.cells) {
      if (g.raft.props.has(k)) continue;
      const [ci, cj] = k.split(',').map(Number);
      if (tryAt(ci, cj)) {
        this._lastPlace = { piece: recipeId, i: ci, j: cj, rot: g.buildRot || 0 };
        return true;
      }
    }
    g._toast('⚠ Tidak ada sel kosong untuk bangunan');
    return false;
  }

  tryBuildFloor() {
    return this.tryBuildPiece('raft_cell');
  }

  tryBuildPiece(pieceId) {
    const g = this.g;
    const recipe = RECIPES[pieceId];
    if (!recipe) return false;
    const inv = g.player.inventory;
    for (const [id, n] of Object.entries(recipe.requires || {})) {
      if (!inv.has(id, n)) {
        g._toast(t('toast.needMats'));
        return false;
      }
    }
    let ok = false;
    this._lastPlace = null;
    if (pieceId === 'raft_cell') {
      const cell = this.findPlaceCell();
      if (!cell) { g._toast(t('toast.noSpace')); return false; }
      ok = g.raft.addCell(cell.i, cell.j);
      if (ok) this._lastPlace = { piece: 'raft_cell', i: cell.i, j: cell.j };
    } else if (pieceId === 'wall' || pieceId === 'window' || pieceId === 'door') {
      const e = this.findEdge();
      if (!e) { g._toast('⚠ Arahkan ke tepi lantai'); return false; }
      if (g.raft.hasEdge(e.i, e.j, e.d)) { g._toast('⚠ Tepi sudah terisi'); return false; }
      ok = g.raft.placeEdge(e.i, e.j, e.d, pieceId);
      if (ok) this._lastPlace = { piece: pieceId, i: e.i, j: e.j, d: e.d, edge: true };
    } else if (pieceId === 'roof') {
      const local = this.playerLocalOnRaft();
      const ri = Math.round(local.x / CELL), rj = Math.round(local.z / CELL);
      ok = g.raft.placeRoof(ri, rj);
      if (ok) this._lastPlace = { piece: 'roof', i: ri, j: rj };
    } else {
      ok = this.placeStructure(pieceId);
    }
    if (!ok) { g._toast('⚠ Tidak bisa dipasang'); return false; }
    for (const [id, n] of Object.entries(recipe.requires)) inv.remove(id, n);
    g._renderHotbar();
    g._toast('✓ ' + recipe.name);
    this._netBuild(pieceId, ok);
    return true;
  }

  /** Multiplayer: host broadcasts result; client sends intent */
  _netBuild(pieceId, placedMeta) {
    const g = this.g;
    if (!g._mpMode || !g.net?.code) return;
    const data = this._lastPlace;
    if (!data) return;
    if (g.net.isHost) {
      g.net.sendEvent('build_result', data);
      g._pushRaftLayout?.();
    } else {
      // Optimistic local; host confirms via build_result or build_reject
      g.net.sendEvent('build_intent', data);
    }
  }

  useStation() {
    const g = this.g;
    const local = this.playerLocalOnRaft();
    const i = Math.round(local.x / CELL);
    const j = Math.round(local.z / CELL);
    const k = g.raft.cellKey(i, j);
    const prop = g.raft.props.get(k) || (() => {
      for (const [dk, pr] of g.raft.props) {
        const [si, sj] = dk.split(',').map(Number);
        if (Math.abs(si - i) + Math.abs(sj - j) <= 1) return pr;
      }
      return null;
    })();
    if (!prop) return false;
    const inv = g.player.inventory;

    if (prop.id === 'simple_bed') {
      g.hour = (g.hour + 8) % 24;
      g.player.health = Math.min(100, g.player.health + 40);
      g.player.stamina = 100;
      g._toast(t('toast.sleep'));
      return true;
    }
    if (prop.id === 'sail') {
      g.raft.sailRaised = !g.raft.sailRaised;
      g._toast(g.raft.sailRaised ? '⛵ Layar dinaikkan' : '⛵ Layar diturunkan');
      return true;
    }
    if (prop.id === 'helm') {
      const look = new THREE.Vector3();
      g.camera.getWorldDirection(look);
      g.helmYaw = Math.atan2(look.x, look.z);
      g._toast('🧭 Arah kemudi diatur');
      return true;
    }
    if (prop.id === 'control_panel') {
      const props = [...g.raft.props.values()];
      const anyOn = props.some(pr => (pr.id === 'engine_bio' || pr.id === 'engine_elec') && pr.on);
      for (const pr of props) {
        if (pr.id === 'engine_bio' || pr.id === 'engine_elec') pr.on = !anyOn;
      }
      g._toast(anyOn ? '⚙ Mesin dimatikan' : '⚙ Mesin dinyalakan');
      return true;
    }
    if (prop.id === 'engine_bio' || prop.id === 'engine_elec') {
      if (prop.id === 'engine_bio' && inv.count('biofuel') > 0) {
        inv.remove('biofuel', 1);
        prop.fuel = (prop.fuel || 0) + 40;
        g._toast('🛢️ Biofuel +40s');
        g._renderHotbar();
        return true;
      }
      prop.on = !prop.on;
      if (prop.id === 'engine_bio' && !(prop.fuel > 0)) {
        prop.on = false;
        g._toast('Butuh biofuel');
        return true;
      }
      g._toast(prop.on ? '⚙ Mesin ON' : '⚙ Mesin OFF');
      return true;
    }
    if (prop.id === 'radio_receiver') {
      const r = g._radio;
      if (!r) g._toast('📻 Tidak ada sinyal');
      else if (r.signal <= 0) g._toast('📻 Di luar jangkauan — pasang antena');
      else g._toast(`📻 Sinyal ${Math.round(r.signal * 100)}% · ${r.dist} m`);
      return true;
    }
    if (prop.id === 'research_table') {
      const pts = inv.count('research') + inv.count('scrap');
      if (pts < 1) { g._toast('Butuh scrap atau catatan research'); return true; }
      for (const [id, cost] of Object.entries(RESEARCH_COSTS)) {
        if (g.researched.has(id)) continue;
        if (pts >= cost) {
          inv.remove('research', Math.min(inv.count('research'), cost));
          const left = cost - Math.min(inv.count('research') + cost, cost);
          // spend scrap for remainder
          const need = cost;
          let spent = 0;
          while (spent < need && inv.count('research') > 0) { inv.remove('research', 1); spent++; }
          while (spent < need && inv.count('scrap') > 0) { inv.remove('scrap', 1); spent++; }
          g.researched.add(id);
          g.knownRecipes?.add(id);
          g._toast(t('toast.unlocked', { name: id }));
          g._renderHotbar();
          return true;
        }
      }
      g._toast('Research selesai atau butuh lebih banyak scrap');
      return true;
    }
    if (prop.id === 'crop_plot') {
      if (!g.cropStates) g.cropStates = new Map();
      let c = g.cropStates.get(k);
      if (!c) { c = createCropState(); g.cropStates.set(k, c); }
      if (c.ready) {
        inv.add('food', 2);
        c.planted = false; c.ready = false; c.progress = 0;
        g._toast(t('toast.harvest'));
        g._renderHotbar();
        return true;
      }
      if (!c.planted && inv.count('seed') > 0) {
        inv.remove('seed', 1);
        c.planted = true; c.progress = 0;
        g._toast(t('toast.planted'));
        g._renderHotbar();
        return true;
      }
      if (c.planted) g._toast(`Tumbuh… ${Math.floor(c.progress / 45 * 100)}%`);
      else g._toast(t('toast.needSeed'));
      return true;
    }
    // Chest deposit / withdraw (selected hotbar item)
    if (prop.id === 'small_storage' || prop.id === 'large_storage') {
      if (!Array.isArray(prop.inv)) {
        prop.inv = Array(prop.id === 'large_storage' ? 16 : 8).fill(null);
      }
      const held = inv.selectedSlot;
      if (held && held.id && held.count > 0) {
        // deposit 1 into first empty slot
        let slot = prop.inv.findIndex(s => !s);
        if (slot < 0) slot = prop.inv.findIndex(s => s && s.id === held.id);
        if (slot < 0) { g._toast(t('toast.chestFull')); return true; }
        if (!prop.inv[slot]) prop.inv[slot] = { id: held.id, count: 0 };
        if (prop.inv[slot].id !== held.id && prop.inv[slot].count > 0) {
          g._toast('📦 Slot terisi item lain'); return true;
        }
        prop.inv[slot] = { id: held.id, count: (prop.inv[slot].count || 0) + 1 };
        inv.remove(held.id, 1);
        g._toast(t('toast.chestStore', { item: ITEM_DEFS[held.id]?.name || held.id }));
        g._renderHotbar();
        g._syncChest?.(prop, k);
        return true;
      }
      // withdraw first non-empty
      const wi = prop.inv.findIndex(s => s && s.count > 0);
      if (wi >= 0) {
        const it = prop.inv[wi];
        inv.add(it.id, 1);
        it.count -= 1;
        if (it.count <= 0) prop.inv[wi] = null;
        g._toast(t('toast.chestTake', { item: ITEM_DEFS[it.id]?.name || it.id }));
        g._renderHotbar();
        g._syncChest?.(prop, k);
        return true;
      }
      g._toast(t('toast.chestEmpty'));
      return true;
    }
    // Generic station tick interaction (grill / purifier / storage)
    if (STATIONS[prop.id]) {
      if (!g.stationStates) g.stationStates = new Map();
      let s = g.stationStates.get(k);
      if (!s) { s = createStationState(prop.id); g.stationStates.set(k, s); }
      const def = STATIONS[prop.id];
      if (s.output > 0 && def.out) {
        inv.add(def.out, s.output);
        s.output = 0;
        g._toast(t('toast.takeOutput'));
        g._renderHotbar();
        return true;
      }
      if (def.in && inv.count(def.in) > 0) {
        const n = Math.min(inv.count(def.in), 3);
        inv.remove(def.in, n);
        s.input = (s.input || 0) + n;
        g._toast(t('toast.insert'));
        g._renderHotbar();
        return true;
      }
      if (def.fuel && inv.count('plank') > 0) {
        inv.remove('plank', 1);
        s.fuel = (s.fuel || 0) + 1;
        g._toast(t('toast.fuel'));
        g._renderHotbar();
        return true;
      }
      g._toast(def.name || prop.id);
      return true;
    }
    return false;
  }

  hasNet() {
    for (const pr of this.g.raft.props.values()) {
      if (pr.id === 'collection_net' || pr.id === 'net') return true;
    }
    return false;
  }

  tryDoor() {
    const g = this.g;
    const local = this.playerLocalOnRaft();
    const door = g.raft.nearestDoor?.(local.x, local.z, 2.2);
    if (!door) return false;
    door.open = !door.open;
    g._toast(door.open ? 'Pintu terbuka' : 'Pintu tertutup');
    return true;
  }

  /** Ghost mesh preview — call from render */
  updateGhost() {
    const g = this.g;
    const held = g.player.inventory?.selectedSlot?.id;
    if (!g.ghostMesh || !g.running || g.invOpen || held !== 'hammer') {
      if (g.ghostMesh) {
        g.ghostMesh.visible = false;
        g.ghostMesh.scale.set(1, 1, 1);
      }
      return;
    }
    const piece = g.buildPiece || 'raft_cell';
    const recipe = RECIPES[piece];
    let can = false, hasMats = true;
    if (recipe) {
      for (const [id, n] of Object.entries(recipe.requires || {})) {
        if (!g.player.inventory.has(id, n)) hasMats = false;
      }
    }
    if (piece === 'raft_cell') {
      const cell = this.findPlaceCell();
      if (cell) {
        g.ghostMesh.position.set(cell.i * CELL, DECK_Y, cell.j * CELL);
        g.ghostMesh.rotation.set(0, 0, 0);
        g.ghostMesh.scale.set(1, 1, 1);
        can = true;
      }
    } else if (piece === 'wall' || piece === 'window' || piece === 'door') {
      const e = this.findEdge();
      if (e && !g.raft.hasEdge(e.i, e.j, e.d)) {
        let x = e.i * CELL, z = e.j * CELL, ry = 0;
        if (e.d === 0) { z -= CELL * 0.5; ry = 0; }
        if (e.d === 2) { z += CELL * 0.5; ry = 0; }
        if (e.d === 1) { x += CELL * 0.5; ry = Math.PI / 2; }
        if (e.d === 3) { x -= CELL * 0.5; ry = Math.PI / 2; }
        g.ghostMesh.position.set(x, DECK_Y + 0.8, z);
        g.ghostMesh.rotation.set(0, ry, 0);
        g.ghostMesh.scale.set(1, 12, 0.2);
        can = true;
      }
    } else {
      const local = this.playerLocalOnRaft();
      const i = Math.round(local.x / CELL), j = Math.round(local.z / CELL);
      if (g.raft.cells.has(g.raft.cellKey(i, j))) {
        g.ghostMesh.position.set(i * CELL, DECK_Y + 0.3, j * CELL);
        g.ghostMesh.rotation.set(0, g.buildRot || 0, 0);
        g.ghostMesh.scale.set(0.5, 4, 0.5);
        can = !g.raft.props.has(g.raft.cellKey(i, j));
      }
    }
    if (can) {
      g.ghostMesh.material.color.setHex(hasMats ? 0x44ff66 : 0xffcc33);
      g.ghostMesh.visible = true;
    } else {
      g.ghostMesh.material.color.setHex(0xff4444);
      g.ghostMesh.visible = !!this.deckHit();
    }
  }
}
