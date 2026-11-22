// Solmaris Heat — save games and settings in localStorage.
import { SAVE_KEY, SETTINGS_KEY } from './config.js';

export function createSave() {
  return {
    hasSave() {
      try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
    },
    save(G) {
      const p = G.player;
      const data = {
        v: 2,
        x: p.x, y: p.y,
        health: p.health, armor: p.armor, cash: p.cash,
        weapon: p.weapon, ammo: p.ammo,
        storyIndex: G.missions.storyIndex,
        stats: G.stats,
        dayTime: G.dayTime,
        weather: G.weather.kind,
        savedAt: Date.now(),
      };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
    },
    load(G) {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const d = JSON.parse(raw);
        const p = G.player;
        p.x = d.x; p.y = d.y; p.vx = 0; p.vy = 0;
        p.health = d.health; p.armor = d.armor; p.cash = d.cash;
        p.weapon = d.weapon; p.ammo = d.ammo;
        p.mode = 'foot'; p.car = null; p.dead = false;
        G.missions.storyIndex = d.storyIndex || 0;
        G.missions.active = null;
        G.missions.objective = '';
        G.stats = { ...G.stats, ...(d.stats || {}) };
        G.dayTime = d.dayTime || 0.35;
        if (d.weather) G.weather.set(d.weather);
        G.police.clear(G, true);
        G.camera.x = p.x; G.camera.y = p.y;
        return true;
      } catch { return false; }
    },
    autoSave() {
      // Called by missions after completion; main wires G in.
      if (this._G) this.save(this._G);
    },
    bind(G) { this._G = G; },
  };
}

export function loadSettings() {
  const def = { music: 0.6, sfx: 0.8, minimap: true, shake: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...def, ...JSON.parse(raw) } : def;
  } catch { return def; }
}

export function storeSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}
