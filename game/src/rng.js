// Deterministic random numbers and small math helpers for Solmaris Heat.
// Every system that can change the simulation draws from one seeded generator,
// so a given seed always builds the same city and the same traffic — that is
// what makes the screenshot scenes reproducible frame for frame.

/** A mulberry32 generator: tiny, fast, and good enough for a city. */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max], both ends included. */
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of `list`, chosen by the generator. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

/** True with probability `p`. */
export function chance(rng, p) {
  return rng() < p;
}

export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Move `value` toward `target` by at most `step`. */
export function approach(value, target, step) {
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/** The signed smallest turn from angle `a` to angle `b`, in [-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Turn angle `a` toward `b` by at most `maxStep` radians. */
export function turnToward(a, b, maxStep) {
  return a + clamp(angleDiff(a, b), -maxStep, maxStep);
}

/** A shuffled copy of `list` (Fisher–Yates), leaving the original alone. */
export function shuffled(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
