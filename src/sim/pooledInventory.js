/** Combine player inventory + nearby chest slot arrays for crafting. */
export function pooled(inv, chests = []) {
  const lists = [inv.slots, ...chests.filter(Boolean)];
  const count = (id) =>
    lists.reduce(
      (n, l) => n + l.reduce((m, s) => m + (s?.id === id ? s.count : 0), 0),
      0
    );
  return {
    get slots() {
      return inv.slots;
    },
    set slots(v) {
      inv.slots = v;
    },
    count,
    has: (id, n = 1) => count(id) >= n,
    remove(id, n) {
      let left = n;
      for (const l of lists) {
        for (let i = 0; i < l.length && left > 0; i++) {
          const s = l[i];
          if (!s || s.id !== id) continue;
          const take = Math.min(s.count, left);
          s.count -= take;
          left -= take;
          if (s.count <= 0) l[i] = null;
        }
      }
      return left === 0;
    },
    add: (id, n) => inv.add(id, n),
    canAdd: (id, n) => (inv.canAdd ? inv.canAdd(id, n) : true),
    snapshot: () => structuredClone(lists),
    restore: (snap) => {
      snap.forEach((s, k) => {
        if (!lists[k]) return;
        lists[k].splice(0, lists[k].length, ...s);
      });
    }
  };
}
