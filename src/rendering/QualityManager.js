/** Graphics quality presets + auto scaler based on FPS EMA */

export const PRESETS = {
  low: {
    id: 'low',
    resolutionScale: 0.7,
    pixelRatioMax: 1.0,
    shadowMap: 512,
    shadows: 'simplified',
    ocean: 'low',
    rain: 400,
    debris: 0.5,
    post: false,
    viewDistance: 80,
    fpsLimit: 30
  },
  medium: {
    id: 'medium',
    resolutionScale: 0.85,
    pixelRatioMax: 1.5,
    shadowMap: 1024,
    shadows: 'medium',
    ocean: 'medium',
    rain: 900,
    debris: 0.75,
    post: false,
    viewDistance: 140,
    fpsLimit: 60
  },
  high: {
    id: 'high',
    resolutionScale: 1.0,
    pixelRatioMax: 2.0,
    shadowMap: 2048,
    shadows: 'high',
    ocean: 'high',
    rain: 1200,
    debris: 1.0,
    post: true,
    viewDistance: 220,
    fpsLimit: 0
  }
};

const ORDER = ['low', 'medium', 'high'];

export class QualityManager {
  constructor(initial = 'medium') {
    this.level = PRESETS[initial] ? initial : 'medium';
    this.auto = true;
    this.overrides = {};
    this._fpsEma = 60;
    this._lowSince = 0;
    this._highSince = 0;
    this._listeners = new Set();
  }

  get settings() {
    const base = { ...PRESETS[this.level] };
    return { ...base, ...this.overrides, level: this.level, auto: this.auto };
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    const s = this.settings;
    for (const fn of this._listeners) {
      try { fn(s); } catch (e) { console.warn(e); }
    }
  }

  setLevel(level, { fromAuto = false } = {}) {
    if (!PRESETS[level]) return;
    if (this.level === level) {
      if (!fromAuto) this.auto = false;
      this._emit();
      return;
    }
    this.level = level;
    if (!fromAuto) this.auto = false;
    this._emit();
  }

  setAuto(on) {
    this.auto = !!on;
    this._lowSince = 0;
    this._highSince = 0;
    this._emit();
  }

  setOverride(key, value) {
    if (value === undefined || value === null) delete this.overrides[key];
    else this.overrides[key] = value;
    this._emit();
  }

  tickAuto(fps, dt = 1) {
    this._fpsEma += (fps - this._fpsEma) * 0.15;
    if (!this.auto) return;

    const f = this._fpsEma;
    const idx = ORDER.indexOf(this.level);

    if (f < 30) {
      this._lowSince += dt;
      this._highSince = 0;
      if (this._lowSince >= 1 && idx > 0) {
        this.setLevel(ORDER[Math.max(0, idx - 2)], { fromAuto: true });
        this._lowSince = 0;
      }
    } else if (f < 45) {
      this._lowSince += dt;
      this._highSince = 0;
      if (this._lowSince >= 3 && idx > 0) {
        this.setLevel(ORDER[idx - 1], { fromAuto: true });
        this._lowSince = 0;
      }
    } else if (f > 58) {
      this._highSince += dt;
      this._lowSince = 0;
      if (this._highSince >= 10 && idx < ORDER.length - 1) {
        this.setLevel(ORDER[idx + 1], { fromAuto: true });
        this._highSince = 0;
      }
    } else {
      this._lowSince = 0;
      this._highSince = 0;
    }
  }

  effectivePixelRatio(devicePR = 1) {
    const s = this.settings;
    const scale = s.resolutionScale ?? 1;
    return Math.min(devicePR, s.pixelRatioMax || devicePR) * scale;
  }
}
