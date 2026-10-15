import { t } from '../i18n/index.js';
import { RECIPES, CATEGORIES } from '../gameplay/Recipes.js';
import { ITEM_DEFS } from '../gameplay/Inventory.js';
import { craft, craftCheck } from '../sim/crafting.js';
import { pooled } from '../sim/pooledInventory.js';

/**
 * Raft-style crafting / inventory panel (DOM only).
 * Game passes callbacks for world actions (build floor, place structure).
 */
export class CraftUI {
  /**
   * @param {object} opts
   * @param {() => object} opts.getInventory
   * @param {() => void} opts.onHotbarChange
   * @param {(recipeId: string) => boolean} opts.onBuildFloor
   * @param {(recipeId: string) => boolean} opts.onPlaceStructure
   * @param {() => void} opts.onOpen
   * @param {() => void} opts.onClose
   */
  constructor(opts) {
    this.getInventory = opts.getInventory;
    this.getGame = opts.getGame || (() => null);
    this.getKnown = opts.getKnown || (() => null);
    this.onHotbarChange = opts.onHotbarChange;
    this.onBuildFloor = opts.onBuildFloor;
    this.onPlaceStructure = opts.onPlaceStructure;
    this.onOpen = opts.onOpen;
    this.onClose = opts.onClose;
    this.getResearched = opts.getResearched || (() => new Set());

    this.open = false;
    this.selectedCategory = 'resources';
    this.selectedRecipe = 'plank';

    this.el = {
      panel: document.getElementById('inv-panel'),
      grid: document.getElementById('inv-grid'),
      catRail: document.getElementById('cat-rail'),
      catTitle: document.getElementById('cat-title'),
      recipeList: document.getElementById('recipe-list'),
      detailIcon: document.getElementById('detail-icon'),
      detailName: document.getElementById('detail-name'),
      detailDesc: document.getElementById('detail-desc'),
      requiresList: document.getElementById('requires-list'),
      btnCraft: document.getElementById('btn-craft')
    };

    this.el.btnCraft?.addEventListener('click', () => this.doCraft());
  }

  isOpen() {
    return this.open;
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    this.open = true;
    this.el.panel?.classList.remove('hidden');
    this.refresh();
    this.onOpen?.();
  }

  close() {
    this.open = false;
    this.el.panel?.classList.add('hidden');
    this.onClose?.();
  }

  hide() {
    this.open = false;
    this.el.panel?.classList.add('hidden');
  }

  _craftSrc() {
    const inv = this.getInventory();
    if (!inv) return null;
    const g = this.getGame?.();
    const chests = typeof g?.nearbyChests === 'function' ? g.nearbyChests() : [];
    return pooled(inv, chests);
  }

  refresh() {
    this._renderCategories();
    this._renderRecipes();
    this._renderDetail();
    this._renderGrid();
  }

  _renderCategories() {
    const rail = this.el.catRail;
    if (!rail) return;
    rail.innerHTML = '';
    for (const c of CATEGORIES) {
      const has = Object.values(RECIPES).some(r => r.category === c.id && r.type === 'craft');
      if (!has) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-btn' + (c.id === this.selectedCategory ? ' active' : '');
      btn.textContent = c.icon;
      btn.title = c.name;
      btn.addEventListener('click', () => {
        this.selectedCategory = c.id;
        const first = Object.values(RECIPES).find(r => r.category === c.id && r.type === 'craft');
        if (first) this.selectedRecipe = first.id;
        this.refresh();
      });
      rail.appendChild(btn);
    }
    const cat = CATEGORIES.find(c => c.id === this.selectedCategory);
    if (this.el.catTitle) this.el.catTitle.textContent = cat?.name || '';
  }

  _renderRecipes() {
    const list = this.el.recipeList;
    if (!list) return;
    list.innerHTML = '';
    const researched = this.getResearched();
    for (const r of Object.values(RECIPES)) {
      const cat = r.type === 'build' ? 'structure' : r.category;
      if (cat !== this.selectedCategory) continue;
      const locked = r.locked && !researched.has(r.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recipe-item' + (r.id === this.selectedRecipe ? ' active' : '') + (locked ? ' locked' : '');
      btn.innerHTML = `<span class="ri">${r.icon}</span><span>${locked ? '🔒 ' : ''}${r.name}</span>`;
      if (locked) { btn.disabled = true; btn.title = 'Research required'; list.appendChild(btn); continue; }
      btn.addEventListener('click', () => {
        this.selectedRecipe = r.id;
        this.refresh();
      });
      list.appendChild(btn);
    }
  }

  _renderDetail() {
    const recipe = RECIPES[this.selectedRecipe];
    const inv = this._craftSrc() || this.getInventory();
    if (!recipe || !inv) return;

    if (this.el.detailIcon) this.el.detailIcon.textContent = recipe.icon;
    if (this.el.detailName) this.el.detailName.textContent = recipe.name;
    if (this.el.detailDesc) this.el.detailDesc.textContent = recipe.desc;

    if (this.el.requiresList) {
      this.el.requiresList.innerHTML = '';
      let can = true;
      for (const [id, need] of Object.entries(recipe.requires)) {
        const have = inv.count(id);
        const def = ITEM_DEFS[id];
        const ok = have >= need;
        if (!ok) can = false;
        const row = document.createElement('div');
        row.className = 'req-row ' + (ok ? 'ok' : 'bad');
        row.innerHTML = `<span>${def?.icon || '?'} ${def?.name || id}</span>
          <span class="req-num">${have}/${need}</span>`;
        this.el.requiresList.appendChild(row);
      }
      if (this.el.btnCraft) {
        if (recipe.type === 'build') {
          this.el.btnCraft.disabled = false;
          this.el.btnCraft.textContent = t('craft.action.build');
        } else {
          const st = craftCheck(inv, recipe);
          this.el.btnCraft.disabled = st !== 'ok';
          this.el.btnCraft.textContent = t('craft.action.craft');
        }
      }
      let msg = document.getElementById('craft-msg');
      if (!msg && this.el.btnCraft?.parentElement) {
        msg = document.createElement('div');
        msg.id = 'craft-msg';
        msg.className = 'craft-msg';
        this.el.btnCraft.parentElement.appendChild(msg);
      }
      if (msg) {
        const st = recipe.type !== 'build' ? craftCheck(inv, recipe) : 'ok';
        msg.textContent = st === 'full' ? t('craft.invFull') : '';
      }
    }
  }

  _renderGrid() {
    const grid = this.el.grid;
    const inv = this.getInventory();
    if (!grid || !inv) return;
    grid.innerHTML = '';
    const size = inv.slots?.length || 30;
    for (let i = 0; i < size; i++) {
      const s = inv.slots[i];
      const cell = document.createElement('div');
      cell.className = 'inv-cell' + (s ? '' : ' empty')
        + (i === inv.selected ? ' selected' : '')
        + (i >= 10 ? ' bag' : '');
      if (s) {
        const def = ITEM_DEFS[s.id];
        cell.innerHTML = `<span>${def ? def.icon : '?'}</span><span class="c">${s.count}</span>`;
        cell.title = def ? def.name : s.id;
      }
      cell.addEventListener('click', () => {
        if (i < 10) inv.select(i);
        else inv.swap(i, inv.selected);
        this.onHotbarChange?.();
        this.refresh();
      });
      grid.appendChild(cell);
    }
  }

  doCraft() {
    const recipe = RECIPES[this.selectedRecipe];
    if (!recipe) return;
    const inv = this._craftSrc() || this.getInventory();
    if (!inv) return;

    if (recipe.type === 'craft') {
      if (craftCheck(inv, recipe) !== 'ok') return;
      if (craft(inv, recipe)) {
        this.onHotbarChange?.();
        this.getGame?.()?._onCraftChestsChanged?.();
        this.onHotbarChange?.();
        this.refresh();
      }
      return;
    }

    // Building is radial RMB only
    if (recipe.type === 'build') {
      this.onBuildFloor?.(); // legacy no-op path
    }
  }
}
