import { setStormFactor } from '../world/Ocean.js';

export class WeatherSystem {
  constructor(game) {
    this.game = game;
  }

  tick(dt) {
    const g = this.game;
    const prev = g.storm || 0;
    const stormWave = Math.sin(g.time * 0.008);
    g.storm = Math.max(0, stormWave * 1.2 - 0.4);
    if (prev < 0.35 && g.storm >= 0.35) {
      g._toast('⛈️ Badai mendekat! Ombak membesar.', 3500);
      g.audio?.notify?.();
    }
    setStormFactor(g.storm);
    if (g.ocean?.material?.uniforms?.uStorm) {
      g.ocean.material.uniforms.uStorm.value = g.storm;
    }
    // Fog density scales with quality base + storm
    const base = g._fogBase || 0.014;
    const dens = base * (1 + Math.max(0, g.storm) * 0.5);
    if (g.scene?.fog) g.scene.fog.density = dens;
    g.ocean?.setFog?.(g.scene?.fog?.color, dens);
    g.audio?.setStorm(g.storm);
    if (g.rain) {
      g.rain.visible = g.storm > 0.25;
      if (g.rain.visible) {
        g.rain.position.copy(g.camera.position);
        g.rain.position.y += 8;
        const pos = g.rain.geometry.attributes.position.array;
        for (let i = 0; i < pos.length; i += 3) {
          pos[i + 1] -= (8 + g.storm * 12) * dt;
          if (pos[i + 1] < 0) pos[i + 1] = 20 + Math.random() * 5;
        }
        g.rain.geometry.attributes.position.needsUpdate = true;
      }
    }
  }
}
