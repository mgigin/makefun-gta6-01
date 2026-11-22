// Solmaris Heat — particle effects: tyre smoke, sparks, fire, muzzle flash,
// rain splashes and explosion debris. One emitter API for every system.
import { rngRange } from './random.js';

const R = Math.random;

export function emit(G, kind, x, y, opts = {}) {
  const n = opts.count || 1;
  for (let i = 0; i < n; i++) {
    G.particles.push({
      kind,
      x: x + rngRange(R, -2, 2),
      y: y + rngRange(R, -2, 2),
      vx: (opts.vx || 0) + rngRange(R, -(opts.spread || 20), opts.spread || 20),
      vy: (opts.vy || 0) + rngRange(R, -(opts.spread || 20), opts.spread || 20),
      life: opts.life || rngRange(R, 0.3, 0.8),
      t: 0,
      size: opts.size || 4,
      grow: opts.grow || 0,
    });
  }
  if (G.particles.length > 900) G.particles.splice(0, G.particles.length - 900);
}

// White-grey smoke off sliding tyres (drift, handbrake, burnouts).
export function tyreSmoke(G, x, y, intensity = 1) {
  emit(G, 'smoke', x, y, {
    count: Math.max(1, Math.round(intensity * 2)),
    vx: rngRange(R, -14, 14), vy: rngRange(R, -20, -6),
    spread: 10, life: rngRange(R, 0.5, 1.1), size: 4.5, grow: 7,
  });
}

// Dark engine smoke from a damaged car.
export function engineSmoke(G, x, y) {
  emit(G, 'darksmoke', x, y, {
    count: 1, vx: rngRange(R, -8, 8), vy: rngRange(R, -30, -14),
    spread: 6, life: rngRange(R, 0.7, 1.3), size: 5, grow: 9,
  });
}

export function sparks(G, x, y, n = 6) {
  emit(G, 'spark', x, y, { count: n, spread: 95, life: rngRange(R, 0.15, 0.4), size: 2 });
}

export function muzzleFlash(G, x, y, angle) {
  emit(G, 'flash', x, y, {
    count: 1, vx: Math.cos(angle) * 34, vy: Math.sin(angle) * 34,
    spread: 4, life: 0.08, size: 7.5,
  });
}

export function explosion(G, x, y) {
  emit(G, 'fire', x, y, { count: 16, spread: 70, life: rngRange(R, 0.4, 1), size: 7 });
  emit(G, 'darksmoke', x, y, { count: 8, spread: 30, vy: -24, life: rngRange(R, 0.8, 1.6), size: 8, grow: 12 });
  sparks(G, x, y, 10);
}

export function bloodPuff(G, x, y) {
  emit(G, 'blood', x, y, { count: 4, spread: 26, life: rngRange(R, 0.25, 0.5), size: 3.4 });
}

export function rainSplash(G, x, y) {
  emit(G, 'splash', x, y, { count: 1, spread: 3, life: 0.28, size: 3 });
}

export function updateParticles(G, dt) {
  for (const pt of G.particles) {
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.kind === 'smoke' || pt.kind === 'darksmoke') {
      pt.vy -= 12 * dt;
      pt.vx *= 1 - 1.4 * dt;
    }
    if (pt.grow) pt.size += pt.grow * dt;
  }
  G.particles = G.particles.filter((pt) => pt.t < pt.life);
}
