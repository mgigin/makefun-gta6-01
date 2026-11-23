// Vehicles: the nine street models plus the police cruiser, an arcade driving
// model with drift, and the traffic that fills Solmaris's roads. Cars carry a
// velocity vector; grip bleeds off the sideways part of it, so the handbrake
// (which cuts grip) is what makes a car slide.

import { CAR_MODELS, POLICE_MODEL, CAR_COLORS, WORLD } from './data.js';
import { collideCircle, randomLanePoint } from './city.js';
import { clamp, pick, range, angleDiff, dist2 } from './rng.js';

export function makeCar(game, modelIndex, x, y, angle, opts = {}) {
  const model = opts.police ? POLICE_MODEL : CAR_MODELS[modelIndex % CAR_MODELS.length];
  const car = {
    id: game.nextCarId++,
    model,
    modelIndex,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    steerVis: 0,
    hp: model.tough,
    maxHp: model.tough,
    color: opts.police ? '#1b2a4a' : (opts.color || pick(game.rng, CAR_COLORS)),
    kind: opts.kind || 'traffic',
    police: !!opts.police,
    ai: opts.ai || null,
    tires: 4,
    burning: 0,
    dead: false,
    sirenPhase: game.rng() * 6,
    missionTag: opts.missionTag || null,
    brakeLights: 0,
    lastHitAt: -9,
  };
  game.cars.push(car);
  return car;
}

/** The two collision circles (front and rear) that stand in for a car's body. */
export function carCircles(car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const off = car.model.len / 4;
  const r = car.model.wid / 2 + 2;
  return [
    { x: car.x + fx * off, y: car.y + fy * off, r },
    { x: car.x - fx * off, y: car.y - fy * off, r },
  ];
}

/**
 * Drive one car for `dt` seconds. `input` is {throttle -1..1, steer -1..1,
 * handbrake bool}; `gripMul` folds in rain and popped tires.
 */
export function driveCar(game, car, dt, input, gripMul = 1) {
  if (car.dead) { car.vx = 0; car.vy = 0; car.speed = 0; return; }
  const m = car.model;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let fwd = car.vx * fx + car.vy * fy;
  let lat = -car.vx * fy + car.vy * fx;

  const throttle = clamp(input.throttle || 0, -1, 1);
  if (throttle > 0) fwd += m.accel * throttle * dt * (1 - Math.max(0, fwd) / (m.top * 1.15));
  else if (throttle < 0) fwd += (fwd > 8 ? -320 : -m.accel * 0.55) * -throttle * dt;
  car.brakeLights = throttle < 0 && fwd > 8 ? 1 : 0;

  // Rolling drag and a soft top speed.
  fwd -= fwd * 0.35 * dt;
  const tireCap = car.tires < 4 ? 0.55 : 1;
  fwd = clamp(fwd, -m.top * 0.32, m.top * tireCap);

  const steer = clamp(input.steer || 0, -1, 1);
  car.steerVis = steer;
  const grip = m.grip * gripMul * (input.handbrake ? 0.32 : 1) * (car.tires < 4 ? 0.6 : 1);
  const speedFactor = clamp(Math.abs(fwd) / 90, 0, 1);
  car.angle += steer * grip * speedFactor * dt * (fwd < 0 ? -1 : 1) * 1.15;

  // Sideways velocity bleeds away at the grip rate — low grip means drift.
  lat -= lat * Math.min(1, grip * 3.2 * dt);
  if (input.handbrake) fwd -= fwd * 1.1 * dt;

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * fwd - nfy * lat;
  car.vy = nfy * fwd + nfx * lat;
  car.speed = fwd;

  car.x += car.vx * dt;
  car.y += car.vy * dt;
}

/** Damage a car; returns true when this hit killed it. */
export function damageCar(game, car, amount, now) {
  if (car.dead) return false;
  car.hp -= amount;
  car.lastHitAt = now;
  if (car.hp <= 0) {
    car.hp = 0;
    car.dead = true;
    car.burning = 2.4;
    return true;
  }
  return false;
}

/** Resolve a car against buildings and the world edge; scrape damage on hard hits. */
export function collideCarWithCity(game, car, dt) {
  for (const c of carCircles(car)) {
    const probe = { x: c.x, y: c.y };
    if (collideCircle(game.city, probe, c.r)) {
      const dx = probe.x - c.x;
      const dy = probe.y - c.y;
      car.x += dx;
      car.y += dy;
      const impact = Math.abs(car.speed);
      if (impact > 90) damageCar(game, car, (impact - 80) * 0.12, game.time);
      // Kill the velocity component into the wall, keep the slide.
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      const vn = car.vx * nx + car.vy * ny;
      if (vn < 0) {
        car.vx -= vn * nx * 1.4;
        car.vy -= vn * ny * 1.4;
      }
      car.speed *= 0.55;
    }
  }
}

/** Car-to-car bumps: push apart, trade a little speed, dent both. */
export function collideCars(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead && a.kind === 'parked') continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = (a.model.len + b.model.len) / 2;
      if (dx * dx + dy * dy > rr * rr) continue;
      // Circle-pair test on the body circles.
      let pushed = false;
      for (const ca of carCircles(a)) {
        for (const cb of carCircles(b)) {
          const ddx = cb.x - ca.x;
          const ddy = cb.y - ca.y;
          const min = ca.r + cb.r;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < min * min && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const push = (min - d) / 2;
            const ux = ddx / d;
            const uy = ddy / d;
            a.x -= ux * push; a.y -= uy * push;
            b.x += ux * push; b.y += uy * push;
            pushed = true;
          }
        }
      }
      if (!pushed) continue;
      const rel = Math.abs(a.speed - b.speed);
      if (rel > 70) {
        damageCar(game, a, (rel - 60) * 0.1, game.time);
        damageCar(game, b, (rel - 60) * 0.1, game.time);
      }
      const swap = (a.speed + b.speed) / 2;
      a.speed = swap * 0.8;
      b.speed = swap * 0.8;
      a.vx *= 0.7; a.vy *= 0.7;
      b.vx *= 0.7; b.vy *= 0.7;
      if (a.kind === 'traffic') a.ai.honk = 0.6;
      if (b.kind === 'traffic') b.ai.honk = 0.6;
    }
  }
}

// ---- Traffic AI -----------------------------------------------------------
// A traffic car follows its lane: a target point rides ahead of it on the
// lane, and at each crossing it may keep straight or turn onto the cross
// street. It brakes for whatever is in its lane ahead.

const LANE_OFF = WORLD.road / 4;

function laneTarget(city, ai, car) {
  if (ai.axis === 'v') {
    return { x: city.roadX[ai.road] + (ai.dir < 0 ? LANE_OFF : -LANE_OFF), y: car.y + ai.dir * 120 };
  }
  return { x: car.x + ai.dir * 120, y: city.roadY[ai.road] + (ai.dir > 0 ? LANE_OFF : -LANE_OFF) };
}

function maybeTurn(game, car) {
  const ai = car.ai;
  const city = game.city;
  const rng = game.rng;
  if (ai.axis === 'v') {
    // Crossing a horizontal road?
    for (let j = 0; j <= city.rows; j += 1) {
      if (Math.abs(car.y - city.roadY[j]) < 14 && ai.lastCross !== `h${j}`) {
        ai.lastCross = `h${j}`;
        const r = rng();
        if (r < 0.32) { ai.axis = 'h'; ai.road = j; ai.dir = 1; }
        else if (r < 0.6) { ai.axis = 'h'; ai.road = j; ai.dir = -1; }
        return;
      }
    }
  } else {
    for (let i = 0; i <= city.cols; i += 1) {
      if (Math.abs(car.x - city.roadX[i]) < 14 && ai.lastCross !== `v${i}`) {
        ai.lastCross = `v${i}`;
        const r = rng();
        if (r < 0.32) { ai.axis = 'v'; ai.road = i; ai.dir = 1; }
        else if (r < 0.6) { ai.axis = 'v'; ai.road = i; ai.dir = -1; }
        return;
      }
    }
  }
}

function obstacleAhead(game, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const look = 46 + Math.abs(car.speed) * 0.5;
  for (const other of game.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    if (ahead < 0 || ahead > look) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 16) return true;
  }
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const dx = px - car.x;
  const dy = py - car.y;
  const ahead = dx * fx + dy * fy;
  if (ahead > 0 && ahead < look && Math.abs(-dx * fy + dy * fx) < 15) return true;
  for (const ped of game.peds) {
    if (ped.down) continue;
    const ddx = ped.x - car.x;
    const ddy = ped.y - car.y;
    const a2 = ddx * fx + ddy * fy;
    if (a2 > 0 && a2 < look && Math.abs(-ddx * fy + ddy * fx) < 13) return true;
  }
  return false;
}

export function stepTrafficCar(game, car, dt, gripMul) {
  const ai = car.ai;
  if (!ai) return;
  maybeTurn(game, car);
  const t = laneTarget(game.city, ai, car);
  const want = Math.atan2(t.y - car.y, t.x - car.x);
  const steer = clamp(angleDiff(car.angle, want) * 2.2, -1, 1);
  let throttle = car.speed < ai.cruise ? 0.8 : 0;
  if (obstacleAhead(game, car)) throttle = car.speed > 4 ? -1 : 0;
  if (ai.honk > 0) ai.honk -= dt;
  driveCar(game, car, dt, { throttle, steer, handbrake: false }, gripMul);
}

/** Keep the streets around the player populated; recycle what falls behind. */
export function maintainTraffic(game, px, py) {
  const rng = game.rng;
  const city = game.city;
  let count = 0;
  for (let i = game.cars.length - 1; i >= 0; i -= 1) {
    const car = game.cars[i];
    if (car.kind !== 'traffic') continue;
    if (dist2(car.x, car.y, px, py) > 1250 * 1250 || car.dead) {
      game.cars.splice(i, 1);
    } else count += 1;
  }
  while (count < 22) {
    const spot = randomLanePoint(rng, city);
    const d2 = dist2(spot.x, spot.y, px, py);
    if (d2 < 420 * 420 || d2 > 1100 * 1100) continue;
    const modelIndex = Math.floor(rng() * CAR_MODELS.length);
    const car = makeCar(game, modelIndex, spot.x, spot.y, spot.angle, {
      kind: 'traffic',
      ai: { axis: spot.axis, road: spot.road, dir: spot.dir, cruise: range(rng, 90, 150), lastCross: '', honk: 0 },
    });
    car.speed = car.ai.cruise * 0.8;
    count += 1;
  }
}

/** Parked cars in the lots and along a few curbs — the city's spare wheels. */
export function seedParkedCars(game) {
  const rng = game.rng;
  for (const lot of game.city.lots) {
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i += 1) {
      const x = lot.x + 26 + (i % 3) * 56;
      const y = lot.y + 30 + Math.floor(i / 3) * 60;
      makeCar(game, Math.floor(rng() * CAR_MODELS.length), x, y, Math.PI / 2, { kind: 'parked' });
    }
  }
  // A taxi waiting by the market and a sports car down at the marina.
  const market = game.city.pois.garage;
  makeCar(game, 2, market.x - 60, market.y + 8, 0, { kind: 'parked', color: '#f1c40f' });
  const marina = game.city.pois.marina;
  makeCar(game, 7, marina.x + 40, marina.y + 10, 0, { kind: 'parked' });
}
