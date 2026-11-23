// Solmaris weather and light: a 24-hour clock (one game minute per real
// second), sun tint that swings from dawn gold to bay-night blue, and rain
// that rolls in off the water and slicks the roads.

import { clamp, lerp, range } from './rng.js';

export function stepWeather(game, dt) {
  game.clockMin = (game.clockMin + dt) % (24 * 60);
  const w = game.weather;
  w.nextChange -= dt;
  if (w.nextChange <= 0) {
    w.target = game.rng() < 0.34 ? range(game.rng, 0.5, 1) : 0;
    w.nextChange = range(game.rng, 150, 420);
  }
  w.rain += clamp(w.target - w.rain, -dt * 0.08, dt * 0.08);
  w.rain = clamp(w.rain, 0, 1);
}

/** 0 at deep night, 1 at midday — the master daylight dial. */
export function daylight(game) {
  const h = game.clockMin / 60;
  if (h < 5.5 || h > 20.5) return 0;
  if (h < 7.5) return (h - 5.5) / 2;
  if (h > 18.5) return 1 - (h - 18.5) / 2;
  return 1;
}

/** How golden the light is (dawn and dusk peaks). */
export function goldenHour(game) {
  const h = game.clockMin / 60;
  const dawn = Math.exp(-Math.pow(h - 6.8, 2) / 0.7);
  const dusk = Math.exp(-Math.pow(h - 19.1, 2) / 0.7);
  return clamp(Math.max(dawn, dusk), 0, 1);
}

/** Sun direction for building shadows: an angle that sweeps east to west. */
export function sunAngle(game) {
  const h = game.clockMin / 60;
  return lerp(-2.4, -0.7, clamp((h - 6) / 13, 0, 1));
}

export function clockText(game) {
  const h = Math.floor(game.clockMin / 60);
  const m = Math.floor(game.clockMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function weatherText(game) {
  if (game.weather.rain > 0.55) return 'Bay rain';
  if (game.weather.rain > 0.15) return 'Drizzle';
  const h = game.clockMin / 60;
  if (h < 6 || h > 20) return 'Clear night';
  if (goldenHour(game) > 0.5) return 'Golden hour';
  return 'Sunny';
}

/** Road grip multiplier: rain and night dew both take the shine off. */
export function gripMultiplier(game) {
  return 1 - game.weather.rain * 0.38;
}

/** The rgba overlay that tints the whole frame for the hour. */
export function skyTint(game) {
  const day = daylight(game);
  const gold = goldenHour(game);
  const night = 1 - day;
  const r = Math.round(lerp(10, 255, gold * 0.9) * (1 - night * 0.4));
  const g = Math.round(lerp(16, 170, gold * 0.8));
  const b = Math.round(lerp(48, 90, gold * 0.5));
  const alpha = clamp(night * 0.52 + gold * 0.16 + game.weather.rain * 0.14, 0, 0.62);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

/** Force a weather/time state — used by the screenshot scenes. */
export function setSceneWeather(game, clockMin, rain) {
  game.clockMin = clockMin;
  game.weather.rain = rain;
  game.weather.target = rain;
  game.weather.nextChange = 1e9;
}

/** Streetlights and lit windows come on below this daylight level. */
export function lightsOn(game) {
  return daylight(game) < 0.45;
}
