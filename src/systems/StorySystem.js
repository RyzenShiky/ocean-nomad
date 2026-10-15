import * as THREE from 'three';
import { CHAIN, NOTES } from '../story/chain.js';
import { CUR } from '../world/Current.js';

export class StorySystem {
  constructor(game) {
    this.game = game;
  }

  get story() { return this.game.story; }
  get islands() { return this.game.storyIslands; }

  reset() {
    const g = this.game;
    g.story = { step: 0, notes: [], opened: [] };
    for (const s of g.storyIslands || []) g.scene.remove(s.group);
    g.storyIslands = [];
  }

  spawnAt(chainIndex, x, z, collected = false) {
    const g = this.game;
    const group = new THREE.Group();
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(5 + chainIndex, 7 + chainIndex, 1.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xc2b280 })
    );
    sand.position.y = -0.2;
    group.add(sand);
    const noteM = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.5, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xe8d5a3 })
    );
    noteM.position.set(0, 1.2, 0);
    noteM.visible = !collected;
    group.add(noteM);
    group.position.set(x, 0, z);
    g.scene.add(group);
    if (!g.storyIslands) g.storyIslands = [];
    g.storyIslands.push({ group, chainIndex, collected: !!collected, noteMesh: noteM, radius: 5.5 });
    // Host broadcasts so clients share the same island position
    if (g._mpMode && g.net?.isHost && g.net.code) {
      g.net.sendEvent('story_spawn', { chainIndex, x, z, collected: !!collected });
    }
  }

  spawnNext() {
    const g = this.game;
    if (!CHAIN) return;
    // Clients wait for host story_spawn
    if (g._mpMode && g.net && !g.net.isHost) return;
    const idx = g.story?.step || 0;
    if (idx >= CHAIN.length) return;
    if ((g.storyIslands || []).some(s => s.chainIndex === idx && !s.collected)) return;
    const node = CHAIN[idx];
    const R = () => (g.rng ? g.rng() : Math.random());
    const side = (R() - 0.5) * 40;
    const len = Math.hypot(CUR.x, CUR.z) || 1;
    const fx = CUR.x / len, fz = CUR.z / len;
    const placeDist = Math.min(node.dist, 500);
    const x = g.raft.position.x + fx * placeDist + (-fz) * side;
    const z = g.raft.position.z + fz * placeDist + fx * side;
    this.spawnAt(idx, x, z, false);
  }

  tryCollectNote() {
    const g = this.game;
    const p = g.player.position;
    for (const si of g.storyIslands || []) {
      if (si.collected) continue;
      const d = Math.hypot(si.group.position.x - p.x, si.group.position.z - p.z);
      if (d > 8) continue;
      const node = CHAIN[si.chainIndex];
      if (!node) continue;
      // Per-player claim: track on local story.notes, keep mesh for other crew
      if (!g.story) g.story = { step: 0, notes: [], opened: [] };
      if (g.story.notes.includes(node.note)) return false;
      if (g._mpMode && g.net?.code) {
        g.net.sendEvent('story_note', { chainIndex: si.chainIndex });
        // In MP don't hide global note mesh (others still need it)
      } else {
        si.collected = true;
        if (si.noteMesh) si.noteMesh.visible = false;
      }
      if (!g.story) g.story = { step: 0, notes: [], opened: [] };
      g.story.notes.push(node.note);
      g.story.opened.push(node.id);
      g.story.step = Math.max(g.story.step, si.chainIndex + 1);
      g._toast('📜 ' + (NOTES[node.note]?.title || node.id || 'Catatan'));
      if (node.reward?.seed) g.player.inventory.add('seed', node.reward.seed);
      if (node.reward?.unlock) {
        g.researched.add(node.reward.unlock);
        g._toast('🔓 Terbuka: ' + node.reward.unlock);
      }
      if (node.reward?.ending) {
         g._toast('⚓ Pelabuhan tercapai!');
         g._showEnding?.();
       }
       if (node.reward?.rope) g.player.inventory.add('rope', node.reward.rope);
       if (node.reward?.plastic) g.player.inventory.add('plastic', node.reward.plastic);
       if (node.reward?.metal_ingot) g.player.inventory.add('metal_ingot', node.reward.metal_ingot);
       if (node.reward?.scrap) g.player.inventory.add('scrap', node.reward.scrap);
      g._renderHotbar();
      this.spawnNext();
      return true;
    }
    return false;
  }

  updateCompass() {
    const g = this.game;
    const el = document.getElementById('compass-arrow');
    if (!el) return;
    const next = (g.storyIslands || []).find(s => !s.collected);
    if (!next) { el.style.transform = 'rotate(0deg)'; return; }
    const dx = next.group.position.x - g.camera.position.x;
    const dz = next.group.position.z - g.camera.position.z;
    const bearing = Math.atan2(dx, -dz);
    const euler = new THREE.Euler().setFromQuaternion(g.camera.quaternion, 'YXZ');
    el.style.transform = `rotate(${bearing - euler.y}rad)`;
  }

  toggleJournal() {
    const g = this.game;
    const panel = document.getElementById('journal');
    if (!panel) return;
    const open = panel.classList.contains('hidden');
    if (open) {
      const body = document.getElementById('journal-body');
      if (body) {
        const notes = g.story?.notes || [];
        body.innerHTML = notes.length
          ? notes.map(id => {
              const n = NOTES[id];
              return `<div style="margin-bottom:12px"><strong>${n?.title || id}</strong><p>${n?.text || ''}</p></div>`;
            }).join('')
          : '<p class="muted">Belum ada catatan. Jelajahi pulau.</p>';
      }
      panel.classList.remove('hidden');
      g.paused = true;
    } else {
      panel.classList.add('hidden');
      g.paused = false;
    }
  }
}
