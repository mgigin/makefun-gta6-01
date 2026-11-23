// Pedestrians: Solmaris's foot traffic. They stroll the sidewalks, cross at
// corners, scatter when a car mounts the curb or shots ring out, and — for the
// Ledger crew the story sends you against — they shoot back.

import { PED_SHIRTS, PED_SKINS } from './data.js';
import { randomSidewalkPoint, collideCircle } from './city.js';
import { pick, range, dist2, clamp } from './rng.js';

export function makePed(game, x, y, opts = {}) {
  const ped = {
    id: game.nextPedId++,
    x, y,
    angle: game.rng() * Math.PI * 2,
    speed: 0,
    walkSpeed: range(game.rng, 26, 44),
    hp: opts.hostile ? 60 : 30,
    shirt: opts.hostile ? '#4a235a' : pick(game.rng, PED_SHIRTS),
    skin: pick(game.rng, PED_SKINS),
    hostile: !!opts.hostile,
    missionTag: opts.missionTag || null,
    state: 'walk', // walk | flee | down | fight
    down: false,
    downTimer: 0,
    target: null,
    retarget: 0,
    fireCd: range(game.rng, 0.4, 1.2),
    panic: 0,
    phase: game.rng() * 6,
  };
  game.peds.push(ped);
  return ped;
}

function newTarget(game, ped) {
  ped.target = randomSidewalkPoint(game.rng, game.city);
  ped.retarget = range(game.rng, 6, 14);
}

/** Nearest danger a pedestrian can see: fast cars, gunfire, a wanted chase. */
function dangerNear(game, ped) {
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const playerFast = p.inCar && Math.abs(p.inCar.speed) > 120;
  if (playerFast && dist2(ped.x, ped.y, px, py) < 130 * 130) return { x: px, y: py };
  if (game.time - game.lastShotAt < 1.2 && dist2(ped.x, ped.y, px, py) < 220 * 220) return { x: px, y: py };
  for (const car of game.cars) {
    if (Math.abs(car.speed) > 170 && dist2(ped.x, ped.y, car.x, car.y) < 90 * 90) return { x: car.x, y: car.y };
  }
  return null;
}

export function stepPed(game, ped, dt) {
  if (ped.down) {
    ped.downTimer -= dt;
    return;
  }
  ped.phase += dt * (ped.state === 'flee' ? 14 : 8);
  ped.retarget -= dt;

  if (ped.hostile) {
    stepHostile(game, ped, dt);
    return;
  }

  const danger = dangerNear(game, ped);
  if (danger) {
    ped.state = 'flee';
    ped.panic = 1.6;
    const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    ped.angle = away;
    ped.speed = ped.walkSpeed * 2.6;
  } else if (ped.panic > 0) {
    ped.panic -= dt;
    ped.speed = ped.walkSpeed * 2.2;
  } else {
    ped.state = 'walk';
    ped.speed = ped.walkSpeed;
    if (!ped.target || ped.retarget <= 0 || dist2(ped.x, ped.y, ped.target.x, ped.target.y) < 24 * 24) {
      newTarget(game, ped);
    }
    const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    let d = want - ped.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    ped.angle += clamp(d, -2.4 * dt, 2.4 * dt);
  }

  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  collideCircle(game.city, ped, 8);
}

/** Ledger gunmen: keep a fighting distance, strafe, and shoot at the player. */
function stepHostile(game, ped, dt) {
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const d = Math.hypot(px - ped.x, py - ped.y);
  ped.angle = Math.atan2(py - ped.y, px - ped.x);
  let move = 0;
  if (d > 190) move = 1;
  else if (d < 110) move = -1;
  const strafe = Math.sin(game.time * 1.7 + ped.id) * 0.6;
  const mx = Math.cos(ped.angle) * move - Math.sin(ped.angle) * strafe;
  const my = Math.sin(ped.angle) * move + Math.cos(ped.angle) * strafe;
  ped.x += mx * 62 * dt;
  ped.y += my * 62 * dt;
  collideCircle(game.city, ped, 8);
  ped.fireCd -= dt;
  if (ped.fireCd <= 0 && d < 320) {
    ped.fireCd = range(game.rng, 0.7, 1.5);
    game.pendingShots.push({ x: ped.x, y: ped.y, angle: ped.angle, from: 'gang', damage: 7, spread: 0.09 });
  }
}

/** A pedestrian goes down (run over, shot, punched). Returns true if it killed. */
export function hurtPed(game, ped, amount) {
  if (ped.down) return false;
  ped.hp -= amount;
  if (ped.hp <= 0) {
    ped.down = true;
    ped.state = 'down';
    ped.downTimer = 14;
    return true;
  }
  ped.state = 'flee';
  ped.panic = 2;
  return false;
}

/** Keep roughly `want` pedestrians alive near the player. */
export function maintainPeds(game, px, py, want = 34) {
  let count = 0;
  for (let i = game.peds.length - 1; i >= 0; i -= 1) {
    const ped = game.peds[i];
    if (ped.missionTag) continue;
    if (dist2(ped.x, ped.y, px, py) > 1150 * 1150) game.peds.splice(i, 1);
    else if (!ped.down) count += 1;
  }
  let guard = 0;
  while (count < want && guard < 60) {
    guard += 1;
    const spot = randomSidewalkPoint(game.rng, game.city);
    const d2 = dist2(spot.x, spot.y, px, py);
    if (d2 < 260 * 260 || d2 > 1000 * 1000) continue;
    makePed(game, spot.x, spot.y);
    count += 1;
  }
}
