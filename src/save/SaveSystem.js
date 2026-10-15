const PREFIX = 'driftbound:slot:';
const LAST = 'driftbound:lastSlot';
const LEGACY = ['driftbound:1', 'driftbound:slot1'];
const CURRENT_V = 3;

export function listSlots() {
  const out = [];
  for (let i = 1; i <= 5; i++) {
    let raw = null;
    try { raw = localStorage.getItem(PREFIX + i); } catch (_) {}
    if (!raw) {
      out.push({ slot: i, empty: true });
      continue;
    }
    try {
      const d = JSON.parse(raw);
      out.push({
        slot: i, empty: false, t: d.t, day: d.days ?? d.day ?? 1,
        playTime: d.playTime ?? 0, cells: d.cells?.length ?? 0, v: d.v ?? 1
      });
    } catch {
      out.push({ slot: i, empty: true });
    }
  }
  return out;
}

export function migrateLegacy() {
  for (const k of LEGACY) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      if (!localStorage.getItem(PREFIX + '1')) {
        localStorage.setItem(PREFIX + '1', raw);
        localStorage.setItem(LAST, '1');
      }
      localStorage.removeItem(k);
    } catch (_) {}
  }
}

export function getLastSlot() {
  try {
    const s = parseInt(localStorage.getItem(LAST) || '1', 10);
    return s >= 1 && s <= 5 ? s : 1;
  } catch { return 1; }
}

export function setLastSlot(n) {
  try { localStorage.setItem(LAST, String(n)); } catch (_) {}
}

/** Migrate older saves toward CURRENT_V */
export function migrateSave(data) {
  if (!data || typeof data !== 'object') return data;
  let v = data.v || 1;
  if (v < 2) {
    data.days = data.days ?? data.day ?? 1;
    data.story = data.story || { step: 0, notes: [], opened: [] };
    v = 2;
  }
  if (v < 3) {
    data.playTime = data.playTime ?? 0;
    data.quality = data.quality || null;
    v = 3;
  }
  data.v = v;
  return data;
}

export function saveSlot(n, data) {
  data.v = CURRENT_V;
  data.t = Date.now();
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(PREFIX + n, json);
    setLastSlot(n);
    return { ok: true };
  } catch (e) {
    // Quota — try drop emergency key then retry once
    try {
      localStorage.removeItem('driftbound:emergency');
      localStorage.setItem(PREFIX + n, json);
      setLastSlot(n);
      return { ok: true, warned: 'cleared_emergency' };
    } catch (e2) {
      return { ok: false, error: e2?.name || 'QuotaExceeded' };
    }
  }
}

export function loadSlot(n) {
  try {
    const raw = localStorage.getItem(PREFIX + n);
    if (!raw) return null;
    setLastSlot(n);
    return migrateSave(JSON.parse(raw));
  } catch { return null; }
}

export function deleteSlot(n) {
  try { localStorage.removeItem(PREFIX + n); } catch (_) {}
}

export function hasAnySave() {
  return listSlots().some(s => !s.empty);
}

export function loadEmergency() {
  try {
    const raw = localStorage.getItem('driftbound:emergency');
    if (!raw) return null;
    return migrateSave(JSON.parse(raw));
  } catch { return null; }
}
