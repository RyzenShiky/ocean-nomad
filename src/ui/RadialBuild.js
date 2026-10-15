import { RECIPES } from '../gameplay/Recipes.js';

export const BUILD_IDS = [
  'raft_cell', 'wall', 'window', 'door', 'pillar', 'roof', 'stairs', 'smelter',
  'simple_grill', 'purifier', 'crop_plot', 'small_storage', 'large_storage',
  'research_table', 'simple_bed', 'net', 'sail',
  'engine_bio', 'helm', 'biofuel_refiner', 'antenna', 'control_panel',
  'engine_elec', 'radio_receiver'
];

export class RadialBuild {
  constructor({ onSelect }) {
    this.onSelect = onSelect;
    this._open = false; // must not shadow open() method
    this.index = 0;
    this.vx = 0;
    this.vy = -40;
    this.el = document.getElementById('radial-build');
    this.center = document.getElementById('radial-center');
    this.itemsEl = document.getElementById('radial-items');
    this._items = BUILD_IDS.map(id => RECIPES[id]).filter(Boolean);
    this._renderItems();
  }

  _renderItems() {
    if (!this.itemsEl) return;
    this.itemsEl.innerHTML = '';
    const n = this._items.length;
    const R = 168;
    this._items.forEach((r, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const d = document.createElement('div');
      d.className = 'radial-item';
      d.style.left = `calc(50% + ${Math.cos(a) * R}px)`;
      d.style.top = `calc(50% + ${Math.sin(a) * R}px)`;
      const label = (r.name || r.id || '').split(' ')[0];
      d.innerHTML = `<span class="ri">${r.icon || '?'}</span><span>${label}</span>`;
      this.itemsEl.appendChild(d);
    });
  }

  open(selId) {
    this._open = true;
    this.vx = 0;
    this.vy = -40;
    if (selId) {
      const i = this._items.findIndex(r => r.id === selId);
      if (i >= 0) this.index = i;
    }
    this.el?.classList.remove('hidden');
    this._highlight();
  }

  show(selId) { this.open(selId); }

  close(commit) {
    if (!this._open) return null;
    this._open = false;
    this.el?.classList.add('hidden');
    if (commit) {
      const r = this._items[this.index];
      if (r) this.onSelect?.(r.id);
      return r?.id || null;
    }
    return null;
  }

  hide() { this.close(false); }
  isOpen() { return this._open; }

  move(dx, dy) {
    if (!this._open) return;
    this.vx += dx;
    this.vy += dy;
    const m = Math.hypot(this.vx, this.vy);
    if (m > 120) {
      this.vx *= 120 / m;
      this.vy *= 120 / m;
    }
    if (m > 34 && this._items.length) {
      const step = 2 * Math.PI / this._items.length;
      let a = Math.atan2(this.vy, this.vx) + Math.PI / 2;
      a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      this.index = Math.round(a / step) % this._items.length;
    }
    this._highlight();
  }

  onMove(dx, dy) { this.move(dx, dy); }

  scroll(dir) {
    if (!this._open) return;
    const n = this._items.length;
    if (!n) return;
    this.index = (this.index + dir + n) % n;
    this._highlight();
  }

  pickNumber(n) {
    if (!this._open) return;
    if (n >= 1 && n <= this._items.length) {
      this.index = n - 1;
      this._highlight();
    }
  }

  confirm() { return this.close(true); }

  currentId() {
    return this._items[this.index]?.id || null;
  }

  _highlight() {
    const nodes = this.itemsEl?.querySelectorAll('.radial-item') || [];
    nodes.forEach((el, i) => el.classList.toggle('active', i === this.index));
    const r = this._items[this.index];
    if (this.center && r) this.center.textContent = r.name || r.id;
  }
}
