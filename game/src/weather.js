// Solmaris Heat — weather: sun-soaked clear spells broken by warm bay rain.
// Rain wets the roads (less grip), dims the light and adds streaks + splashes.
import { WEATHER } from './config.js';

export function createWeather() {
  return {
    kind: 'clear',        // 'clear' | 'rain'
    wetness: 0,           // 0 dry .. 1 soaked; eases in and out
    timer: WEATHER.changeEvery,
    drops: [],            // screen-space rain streaks, recycled by render.js

    // Force a kind (screenshot scenes, mission beats).
    set(kind) {
      this.kind = kind;
      this.wetness = kind === 'rain' ? 1 : 0;
      this.timer = WEATHER.changeEvery;
    },

    gripFactor() {
      return 1 - this.wetness * (1 - WEATHER.wetGrip);
    },

    isRaining() { return this.kind === 'rain'; },

    update(G, dt) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = WEATHER.changeEvery * (0.7 + Math.random() * 0.7);
        const next = Math.random() < WEATHER.rainChance ? 'rain' : 'clear';
        if (next !== this.kind) {
          this.kind = next;
          G.hud.feed(next === 'rain' ? 'Rain rolls in off the bay' : 'The rain eases off');
          if (next === 'rain') G.audio.rainStart(); else G.audio.rainStop();
        }
      }
      const target = this.kind === 'rain' ? 1 : 0;
      const rate = target > this.wetness ? 0.25 : 0.08; // soaks fast, dries slowly
      this.wetness += Math.sign(target - this.wetness) * Math.min(Math.abs(target - this.wetness), rate * dt);
    },
  };
}
