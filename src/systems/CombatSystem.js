import { t } from '../i18n/index.js';
import { DEBRIS } from '../world/debrisKinds.js';
import { ITEM_DEFS } from '../gameplay/Inventory.js';
import { CELL } from '../raft/Raft.js';

export class CombatSystem {
  constructor(game) {
    this.g = game;
  }

  trySpear() {
    const g = this.g;
    if ((g._spearCd || 0) > 0) return;
    // Prefer eel if closer
    if (g.eel) {
      const de = Math.hypot(g.player.position.x - g.eel.x, g.player.position.z - g.eel.z);
      if (de < 3.2) {
        g._spearCd = 0.45;
        const dead = g.eel.hit();
        g._toast(dead ? '⚡ Belut takluk!' : '⚡ Kena belut!');
        g.audio?.hit?.();
        if (dead) {
          g.player.inventory.add('raw_fish', 2);
          g.eel.reset();
          g._renderHotbar();
        }
        return;
      }
    }
    if (!g.shark) return;
    const d = Math.hypot(g.player.position.x - g.shark.x, g.player.position.z - g.shark.z);
    if (d >= 3.5) { g._toast(t('toast.tooFar')); return; }
    g._spearCd = 0.45;
    g.shark.hit();
    g.shark._hp = (g.shark._hp ?? 5) - 1;
    g._toast(t('toast.spearHit', { n: Math.max(0, g.shark._hp) }));
    g.audio?.hit?.();
    if (g.shark._hp <= 0) {
      g.player.inventory.add('raw_shark', 2);
      g._toast('🦈 Hiu takluk! +daging');
      g.shark.reset();
      g.shark._hp = 5;
      g.sharkAvatar?.play('Swim');
      g._renderHotbar();
    }
  }

  tryAxe(iron = false) {
    const g = this.g;
    // Winter: chop ice around raft to free movement
    if ((g._freeze || 0) > 0.25) {
      g._freeze = Math.max(0, g._freeze - (iron ? 0.28 : 0.18));
      g._toast('🪓 Es retak — rakit lebih bebas', 1800);
      g.audio?.swing?.();
      return;
    }
    const local = g.build.playerLocalOnRaft();
    const i = Math.round(local.x / CELL);
    const j = Math.round(local.z / CELL);
    // Remove prop or cell via raft helpers
    const k = g.raft.cellKey(i, j);
    if (g.raft.props.has(k)) {
      const pr = g.raft.props.get(k);
      g.raft.props.delete(k);
      if (pr.mesh) g.raft.group.remove(pr.mesh);
      g.stationStates?.delete(k);
      g.cropStates?.delete(k);
      g._toast('🪓 Dibongkar');
      return;
    }
    if (g.raft.canRemove?.(i, j) || (g.raft.cells.size > 1 && g.raft.cells.has(k))) {
      if (g.raft.removeCell) {
        g.raft.removeCell(i, j);
        g._toast('🪓 Lantai dibongkar');
      }
    } else {
      // trees on islands
      for (const isl of g.islands || []) {
        // leave as-is if no tree API
      }
      g._toast('⚠ Tidak bisa dibongkar');
    }
  }

  tryCollect() {
    const g = this.g;
    // palm / island resources handled elsewhere; net auto-collect in sim
    return false;
  }

  giveLoot(type) {
    const g = this.g;
    const inv = g.player.inventory;
    const got = [];
    const key = type === 'barrels' ? 'barrel' : type;
    const rows = DEBRIS[key]?.loot ?? [['plastic', 1, 1, 1]];
    for (const row of rows) {
      const [id, chance, min = 1, max = min] = row;
      if (Math.random() > chance) continue;
      const n = min + Math.floor(Math.random() * (max - min + 1));
      if (typeof g.giveItem === 'function') g.giveItem(id, n);
      else inv.add(id, n);
      const nm = ITEM_DEFS[id]?.name || id;
      got.push(`${nm} ×${n}`);
    }
    if (got.length) {
      g._toast(got.join(', '), 2200);
      g.audio?.splash?.(0.3);
      g._renderHotbar();
    }
  }
}

