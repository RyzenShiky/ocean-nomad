/** Tracks DOM/window listeners so they can be removed on menu/quit. */
export class InputBinder {
  constructor() {
    this._disposers = [];
  }

  on(target, type, handler, options) {
    if (!target || !type || !handler) return () => {};
    target.addEventListener(type, handler, options);
    const off = () => {
      try { target.removeEventListener(type, handler, options); } catch (_) {}
    };
    this._disposers.push(off);
    return off;
  }

  dispose() {
    for (const off of this._disposers) {
      try { off(); } catch (_) {}
    }
    this._disposers = [];
  }
}
