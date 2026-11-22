// Solmaris Heat — pedestrians: sidewalk wanderers, beachgoers and joggers who
// flee danger, cower from gunfire, phone the police — plus foot officers who
// chase the player when the wanted level is up and the player is on foot.
import { TILE } from './config.js';
import { collideCircle, tileKindAt, TILE_KIND } from './city.js';
import { rngPick, rngRange } from './random.js';
import { bloodPuff } from './effects.js';

const SHIRTS = ['#d85c4a', '#4a7ad8', '#e0c04a', '#5cb85c', '#b05cc8', '#e8e8e8', '#4ac8b8', '#d88a4a', '#8a6d4a', '#4a4a6d'];
const SKINS = ['#f2c9a0', '#d9a06b', '#a06a42', '#6b4630', '#f7dcbc'];

export function makePed(rng, x, y) {
  const beach = y > 21 * TILE;
  return {
    x, y,
    angle: rngRange(rng, 0, Math.PI * 2),
    speed: rngRange(rng, 34, 55),
    shirt: rngPick(rng, SHIRTS),
    skin: rngPick(rng, SKINS),
    state: 'walk', // walk | flee | cower | down | taxi | riding | cop
    timer: rngRange(rng, 1, 4),
    health: 30,
    walkPhase: rngRange(rng, 0, 6),
    targetX: x, targetY: y,
    beachgoer: beach && rng() < 0.6,
    jogger: rng() < 0.12,
  };
}

export function updatePed(G, ped, dt) {
  if (ped.state === 'down') return;
  ped.timer -= dt;
  ped.walkPhase += dt * (ped.state === 'flee' || ped.state === 'cop' ? 14 : ped.jogger ? 12 : 8);

  // Foot officers chase the player and feed the bust meter via police.js.
  if (ped.state === 'cop') {
    const p = G.player;
    ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (collideCircle(G.city, ped, 8)) ped.angle += 0.6;
    return;
  }

  // React to danger: fast cars, gunfire, the player aiming.
  let fleeX = 0, fleeY = 0, danger = false;
  for (const car of G.cars) {
    const d = Math.hypot(car.x - ped.x, car.y - ped.y);
    const sp = Math.hypot(car.vx, car.vy);
    if (d < 70 && sp > 120) { danger = true; fleeX = ped.x - car.x; fleeY = ped.y - car.y; }
  }
  if (G.fx.lastShotAt && G.time - G.fx.lastShotAt < 1.2) {
    const d = Math.hypot(G.player.x - ped.x, G.player.y - ped.y);
    if (d < 240) { danger = true; fleeX = ped.x - G.player.x; fleeY = ped.y - G.player.y; }
  }

  if (danger && ped.state !== 'taxi') {
    // Some freeze and cower instead of running.
    if (ped.state !== 'flee' && ped.state !== 'cower' && Math.random() < 0.25) {
      ped.state = 'cower';
      ped.timer = 1.8;
    } else if (ped.state !== 'cower') {
      ped.state = 'flee';
      ped.timer = Math.max(ped.timer, 1.6);
      ped.angle = Math.atan2(fleeY, fleeX) + rngRange(Math.random, -0.4, 0.4);
    }
  } else if ((ped.state === 'flee' || ped.state === 'cower') && ped.timer <= 0) {
    ped.state = 'walk';
    // Witnesses sometimes phone it in: a small chance of fresh heat.
    if (G.police.stars === 0 && G.stats.pedsDown > 0 && Math.random() < 0.05) {
      G.hud.feed('A witness is calling the police…');
    }
  }

  if (ped.state === 'walk' && ped.timer <= 0) {
    ped.timer = rngRange(Math.random, 1.5, 4);
    ped.angle = rngRange(Math.random, 0, Math.PI * 2);
    // Bias toward sidewalks: pick a nearby non-road point when possible.
    for (let i = 0; i < 6; i++) {
      const tx = ped.x + Math.cos(ped.angle) * 90;
      const ty = ped.y + Math.sin(ped.angle) * 90;
      if (tileKindAt(G.city, tx, ty) !== TILE_KIND.ROAD) break;
      ped.angle += Math.PI / 3;
    }
  }

  if (ped.state === 'taxi') {
    // Walk to the player's taxi and get in (handled by missions when close).
    const car = G.player.car;
    if (car) {
      ped.angle = Math.atan2(car.y - ped.y, car.x - ped.x);
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 34) {
        ped.state = 'riding';
        ped.hidden = true;
        G.missions.onTaxiPickup(ped);
        return;
      }
    }
  }
  if (ped.state === 'riding' || ped.state === 'cower') return;

  const sp = ped.state === 'flee' ? 122 : ped.jogger ? 88 : ped.speed;
  ped.x += Math.cos(ped.angle) * sp * dt;
  ped.y += Math.sin(ped.angle) * sp * dt;
  if (collideCircle(G.city, ped, 8)) {
    ped.angle += Math.PI * rngRange(Math.random, 0.6, 1.4);
  }

  // Run over by a car?
  for (const car of G.cars) {
    const sp2 = Math.hypot(car.vx, car.vy);
    if (sp2 > 90 && Math.hypot(car.x - ped.x, car.y - ped.y) < 26) {
      hurtPed(G, ped, 40, car);
      break;
    }
  }
}

export function hurtPed(G, ped, amount, byCar) {
  if (ped.state === 'down') return;
  ped.health -= amount;
  bloodPuff(G, ped.x, ped.y);
  if (ped.health <= 0) {
    const wasCop = ped.state === 'cop';
    ped.state = 'down';
    ped.downAt = G.time;
    G.stats.pedsDown++;
    if (wasCop) G.police.addCrime(G, 'killCop');
    else if (byCar && byCar.driver === 'player') G.police.addCrime(G, 'hitPed');
    else if (!byCar) G.police.addCrime(G, 'assault');
    G.audio.thud();
  } else if (ped.state !== 'cop') {
    ped.state = 'flee';
    ped.timer = 2;
    ped.angle = Math.atan2(ped.y - G.player.y, ped.x - G.player.x);
  }
}

export function spawnPeds(G, count) {
  const rng = G.rng;
  for (let i = 0; i < count; i++) {
    const x = rngRange(rng, 60, 1200), y = rngRange(rng, 60, 1150);
    if (tileKindAt(G.city, x, y) === TILE_KIND.ROAD) continue;
    G.peds.push(makePed(rng, x, y));
  }
}

export function maintainPeds(G) {
  // Keep the streets populated near the player; recycle far-away peds.
  const p = G.player;
  G.peds = G.peds.filter((ped) => {
    if (ped.state === 'down' && G.time - (ped.downAt || 0) > 25) return false;
    if (ped.state === 'taxi' || ped.state === 'riding' || ped.state === 'cop') return true;
    return Math.hypot(ped.x - p.x, ped.y - p.y) < 900;
  });
  let guard = 0;
  while (G.peds.filter((ped) => ped.state !== 'cop').length < 28 && guard++ < 40) {
    const a = rngRange(G.rng, 0, Math.PI * 2);
    const d = rngRange(G.rng, 380, 620);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (x < 30 || y < 30 || x > 1220 || y > 1180) continue;
    if (tileKindAt(G.city, x, y) === TILE_KIND.ROAD) continue;
    G.peds.push(makePed(G.rng, x, y));
  }
}
