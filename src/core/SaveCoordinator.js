/** Thin coordinator around SaveSystem — keeps Game free of storage details. */
import * as SaveSys from '../save/SaveSystem.js';

export class SaveCoordinator {
  constructor(game) {
    this.g = game;
  }

  hasAny() {
    return SaveSys.hasAnySave();
  }

  saveSlot(slot, data) {
    return SaveSys.saveSlot(slot, data);
  }

  loadSlot(slot) {
    return SaveSys.loadSlot(slot);
  }

  listSlots() {
    return SaveSys.listSlots();
  }

  /** Crash recovery only — never overwrite a normal slot */
  emergencySave(data) {
    try {
      const payload = { ...data, _emergency: true, _crashAt: Date.now() };
      localStorage.setItem('driftbound:emergency', JSON.stringify(payload));
      return true;
    } catch (_) {
      return false;
    }
  }

  loadEmergency() {
    return typeof SaveSys.loadEmergency === 'function' ? SaveSys.loadEmergency() : null;
  }
}
