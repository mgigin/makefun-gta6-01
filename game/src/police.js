// The law in Solmaris. Crimes feed a heat meter; heat becomes stars; stars
// bring cruisers that ram, roadblocks at three, a searchlight helicopter at
// four and spike strips at five. Stay out of sight and the heat cools — the
// helicopter makes that much harder.

import { makeCar, driveCar, collideCarWithCity } from './vehicles.js';
import { lineOfSight } from './city.js';
import { clamp, dist, dist2, angleDiff, range } from './rng.js';
import { playerPos, playerSpeed } from './state.js';

const CRIME_HEAT = {
  'steal-car': 0.7,
  'hit-ped': 0.8,
  'kill': 1.6,
  'shoot': 0.35,
  'shoot-person': 0.9,
  'shoot-police': 1.4,
  'assault': 0.4,
  'hit-police-car': 0.8,
  'reckless': 0.25,
};

export function reportCrime(game, kind) {
  const w = game.wanted;
  w.heat = clamp(w.heat + (CRIME_HEAT[kind] || 0.3), 0, 5);
  w.lastCrimeAt = game.time;
  w.cool = 0;
}

export function clearWanted(game) {
  game.wanted.heat = 0;
  game.wanted.stars = 0;
  game.wanted.bust = 0;
  for (let i = game.cars.length - 1; i >= 0; i -= 1) {
    if (game.cars[i].police) game.cars.splice(i, 1);
  }
  game.heli = null;
  game.spikes.length = 0;
}

function policeCount(game) {
  let n = 0;
  for (const car of game.cars) if (car.police && !car.dead) n += 1;
  return n;
}

function spawnCruiser(game, px, py) {
  const rng = game.rng;
  const city = game.city;
  // Spawn on a street corner a few blocks out — never inside a building.
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i <= city.cols; i += 1) {
    for (let j = 0; j <= city.rows; j += 1) {
      const x = city.roadX[i];
      const y = city.roadY[j];
      const d = Math.hypot(x - px, y - py);
      if (d < 460 || d > 780) continue;
      const score = Math.abs(d - 600) + rng() * 120;
      if (score < bestScore) { bestScore = score; best = { x, y }; }
    }
  }
  if (!best) best = { x: city.roadX[0], y: city.roadY[0] };
  const car = makeCar(game, 0, best.x, best.y, Math.atan2(py - best.y, px - best.x), {
    police: true, kind: 'police',
    ai: { stuck: 0, reverse: 0, roadblock: false },
  });
  return car;
}

/** A street corner to aim for when buildings block the direct line. */
function roadWaypoint(game, x, y, tx, ty) {
  const city = game.city;
  let rx = city.roadX[0];
  for (const v of city.roadX) if (Math.abs(v - x) < Math.abs(rx - x)) rx = v;
  let ry = city.roadY[0];
  for (const v of city.roadY) if (Math.abs(v - y) < Math.abs(ry - y)) ry = v;
  if (Math.abs(x - tx) > 40 && Math.abs(y - ty) > 40) {
    if (Math.abs(y - ry) <= Math.abs(x - rx)) return { x: tx, y: ry };
    return { x: rx, y: ty };
  }
  return { x: tx, y: ty };
}

/** One cruiser's brain: intercept the player, ram, recover when stuck. */
function stepCruiser(game, car, dt, gripMul) {
  const ai = car.ai;
  if (ai.roadblock) {
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
    return;
  }
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const pvx = p.inCar ? p.inCar.vx : p.vx;
  const pvy = p.inCar ? p.inCar.vy : p.vy;
  const d = dist(car.x, car.y, px, py);
  const lead = clamp(d / 320, 0, 0.8);
  let tx = px + pvx * lead;
  let ty = py + pvy * lead;
  // If a building blocks the direct line, run the streets instead.
  if (d > 90 && !lineOfSight(game.city, car.x, car.y, px, py)) {
    const wp = roadWaypoint(game, car.x, car.y, px, py);
    tx = wp.x;
    ty = wp.y;
  }
  const want = Math.atan2(ty - car.y, tx - car.x);
  const steer = clamp(angleDiff(car.angle, want) * 2.4, -1, 1);

  if (ai.reverse > 0) {
    ai.reverse -= dt;
    driveCar(game, car, dt, { throttle: -1, steer: -steer, handbrake: false }, gripMul);
  } else {
    // Full speed at range, easing off as the cruiser closes in so it boxes
    // the player in instead of sailing past.
    const desired = clamp(d * 1.7, 0, car.model.top);
    const throttle = car.speed < desired ? 1 : (car.speed > desired + 34 ? -0.7 : 0);
    driveCar(game, car, dt, { throttle, steer, handbrake: Math.abs(angleDiff(car.angle, want)) > 2.2 }, gripMul);
  }
  collideCarWithCity(game, car, dt);

  if (Math.abs(car.speed) < 12 && d > 60) ai.stuck += dt;
  else ai.stuck = 0;
  if (ai.stuck > 0.7) { ai.reverse = 0.8; ai.stuck = 0; }

  // Cops shoot when the player is on foot and close at high heat.
  if (!p.inCar && game.wanted.stars >= 3 && d < 230 && lineOfSight(game.city, car.x, car.y, px, py)) {
    ai.fireCd = (ai.fireCd || 0) - dt;
    if (ai.fireCd <= 0) {
      ai.fireCd = range(game.rng, 0.8, 1.6);
      game.pendingShots.push({ x: car.x, y: car.y, angle: want, from: 'police', damage: 6, spread: 0.1 });
    }
  }
}

function placeRoadblock(game, px, py) {
  // Two cruisers parked across the road ahead of the player's heading.
  const p = game.player;
  const heading = p.inCar ? p.inCar.angle : p.angle;
  const cx = px + Math.cos(heading) * 420;
  const cy = py + Math.sin(heading) * 420;
  for (const off of [-26, 26]) {
    const x = cx - Math.sin(heading) * off;
    const y = cy + Math.cos(heading) * off;
    const car = makeCar(game, 0, x, y, heading + Math.PI / 2, {
      police: true, kind: 'police',
      ai: { stuck: 0, reverse: 0, roadblock: true },
    });
    car.speed = 0;
  }
}

function placeSpikes(game, px, py) {
  const p = game.player;
  const heading = p.inCar ? p.inCar.angle : p.angle;
  game.spikes.push({
    x: px + Math.cos(heading) * 360,
    y: py + Math.sin(heading) * 360,
    angle: heading,
    until: game.time + 25,
  });
}

/** The whole wanted system, once per tick. */
export function stepWanted(game, dt, gripMul) {
  const w = game.wanted;
  const pos = playerPos(game);
  w.stars = Math.floor(w.heat + 0.0001);

  // Can the law see the player right now?
  let seen = false;
  for (const car of game.cars) {
    if (!car.police || car.dead) continue;
    if (dist2(car.x, car.y, pos.x, pos.y) < 420 * 420 && lineOfSight(game.city, car.x, car.y, pos.x, pos.y)) {
      seen = true;
      break;
    }
  }
  if (game.heli && dist2(game.heli.x, game.heli.y, pos.x, pos.y) < 380 * 380) seen = true;
  w.seen = seen;

  // Heat cools when unseen — much slower under the searchlight.
  if (w.heat > 0 && !seen && game.time - w.lastCrimeAt > 4) {
    const rate = game.heli ? 0.012 : 0.055;
    w.heat = Math.max(0, w.heat - rate * dt);
  }

  // Reinforcements scale with the stars.
  const want = [0, 1, 2, 3, 4, 5][w.stars] || 0;
  if (policeCount(game) < want) spawnCruiser(game, pos.x, pos.y);
  if (w.stars >= 3) {
    w.roadblockTimer = (w.roadblockTimer || 0) - dt;
    if (w.roadblockTimer <= 0) { placeRoadblock(game, pos.x, pos.y); w.roadblockTimer = 26; }
  }
  if (w.stars >= 5) {
    w.spikeTimer = (w.spikeTimer || 0) - dt;
    if (w.spikeTimer <= 0) { placeSpikes(game, pos.x, pos.y); w.spikeTimer = 18; }
  }
  if (w.stars >= 4 && !game.heli) {
    game.heli = { x: pos.x + 300, y: pos.y - 300, angle: 0, rotor: 0 };
  }
  if (w.stars < 4) game.heli = null;
  if (w.stars === 0) {
    for (let i = game.cars.length - 1; i >= 0; i -= 1) {
      if (game.cars[i].police) game.cars.splice(i, 1);
    }
    game.spikes.length = 0;
  }

  for (const car of game.cars) {
    if (car.police && !car.dead) stepCruiser(game, car, dt, gripMul);
  }
  for (let i = game.cars.length - 1; i >= 0; i -= 1) {
    const car = game.cars[i];
    if (car.police && (car.dead || dist2(car.x, car.y, pos.x, pos.y) > 1500 * 1500)) {
      game.cars.splice(i, 1);
    }
  }

  // The helicopter shadows the player with its searchlight.
  if (game.heli) {
    const h = game.heli;
    h.rotor += dt * 28;
    const tx = pos.x + Math.cos(game.time * 0.35) * 60;
    const ty = pos.y + Math.sin(game.time * 0.35) * 60;
    h.x += (tx - h.x) * Math.min(1, dt * 1.4);
    h.y += (ty - h.y) * Math.min(1, dt * 1.4);
    h.angle = Math.atan2(pos.y - h.y, pos.x - h.x);
  }

  // Spike strips pop tires.
  for (let i = game.spikes.length - 1; i >= 0; i -= 1) {
    const s = game.spikes[i];
    if (game.time > s.until) { game.spikes.splice(i, 1); continue; }
    const p = game.player;
    if (p.inCar && dist2(p.inCar.x, p.inCar.y, s.x, s.y) < 30 * 30 && p.inCar.tires === 4) {
      p.inCar.tires = 1;
      game.onSpikes?.();
    }
  }

  // Busted: slow or stopped with a cruiser right on top of you.
  const nearCop = game.cars.some(
    (c) => c.police && !c.dead && dist2(c.x, c.y, pos.x, pos.y) < 80 * 80,
  );
  if (w.stars > 0 && nearCop && playerSpeed(game) < 26) {
    w.bust += dt * (game.player.inCar ? 0.55 : 1);
  } else {
    w.bust = Math.max(0, w.bust - dt * 0.8);
  }
}
