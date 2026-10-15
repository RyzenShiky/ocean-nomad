/** Web Audio procedural SFX — no asset files. Master + category gains. */
export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.ambGain = null;
    this.waveGain = null;
    this.enabled = false;
    this.muted = false;
    this.volumes = { master: 0.7, sfx: 1, ambient: 0.45 };
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.volumes.sfx;
    this.sfxGain.connect(this.master);

    this.ambGain = this.ctx.createGain();
    this.ambGain.gain.value = this.volumes.ambient;
    this.ambGain.connect(this.master);

    this.waveGain = this.ctx.createGain();
    this.waveGain.gain.value = 0.35;
    this.waveGain.connect(this.ambGain);
    this._startOcean();
    this.enabled = true;
  }

  resume() {
    this.ensure();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  setMaster(v) {
    this.volumes.master = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.volumes.master, this.ctx.currentTime, 0.05);
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volumes.master, this.ctx.currentTime, 0.05);
    }
  }

  setStorm(s) {
    if (!this.waveGain || !this.ctx) return;
    this.waveGain.gain.setTargetAtTime(0.28 + s * 0.55, this.ctx.currentTime, 0.5);
  }

  _startOcean() {
    const bufSize = 2 * this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    src.connect(filter);
    filter.connect(this.waveGain);
    src.start();
  }

  _out() { return this.sfxGain || this.master; }

  splash(vol = 0.4) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.25));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 800;
    src.connect(f); f.connect(g); g.connect(this._out());
    src.start(t);
  }

  creak() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(80 + Math.random() * 40, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(this._out());
    o.start(t); o.stop(t + 0.35);
  }

  swing() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(this._out());
    o.start(t); o.stop(t + 0.15);
  }

  uiClick() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 880;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g); g.connect(this._out());
    o.start(t); o.stop(t + 0.07);
  }

  hit() {
    if (!this.ctx || this.muted) return;
    this.splash(0.35);
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(this._out());
    o.start(t); o.stop(t + 0.18);
  }

  notify() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(523, t);
    o.frequency.setValueAtTime(659, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(this._out());
    o.start(t); o.stop(t + 0.22);
  }
}
