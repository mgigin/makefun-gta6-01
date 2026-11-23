// Mara Voss, the player: walking, sprinting, stealing cars, driving them,
// and using the city's services. Input arrives as a plain object from
// input.js so the screenshot autopilot can drive the same code paths.

import { driveCar, collideCarWithCity } from './vehicles.js';
import { collideCircle } from './city.js';
import { hurtPed } from './peds.js';
import { clamp, dist2 } from './rng.js';
import { feed } from './state.js';

const WALK = 118;
const SPRINT = 196;

export function stepPlayerOnFoot(game, dt, input) {
  const p = game.player;
  if (p.dead) return;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.pressedUp ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }

  const sprinting = input.sprint && p.stamina > 0.05 && len > 0;
  const speed = sprinting ? SPRINT : WALK;
  if (sprinting) p.stamina = Math.max(0, p.stamina - dt * 0.32);
  else p.stamina = Math.min(1, p.stamina + dt * 0.22);

  p.vx = mx * speed;
  p.vy = my * speed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (len > 0) p.angle = Math.atan2(my, mx);
  collideCircle(game.city, p, p.r);
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
}

/** The nearest car the player could get into, or null. */
export function nearestEnterableCar(game) {
  const p = game.player;
  let best = null;
  let bestD = 46 * 46;
  for (const car of game.cars) {
    if (car.dead || car.police) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(game, car) {
  const p = game.player;
  p.inCar = car;
  if (car.kind === 'traffic' || car.kind === 'parked') {
    game.stats.stolen += 1;
    game.onCrime?.('steal-car');
    feed(game, `You took the ${car.model.name}`);
  }
  car.kind = 'player';
  p.x = car.x;
  p.y = car.y;
}

export function exitCar(game) {
  const p = game.player;
  const car = p.inCar;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * (car.model.wid / 2 + 14);
  p.y = car.y + Math.sin(side) * (car.model.wid / 2 + 14);
  p.vx = 0;
  p.vy = 0;
  collideCircle(game.city, p, p.r);
  car.kind = 'parked';
  p.inCar = null;
}

export function stepPlayerDriving(game, dt, input, gripMul) {
  const p = game.player;
  const car = p.inCar;
  if (!car) return;
  const throttle = (input.pressedUp ? 1 : 0) - (input.down ? 1 : 0);
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  driveCar(game, car, dt, { throttle, steer, handbrake: !!input.handbrake }, gripMul);
  collideCarWithCity(game, car, dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);

  // Running people over is a crime, and the street notices.
  if (Math.abs(car.speed) > 60) {
    for (const ped of game.peds) {
      if (ped.down) continue;
      if (dist2(car.x, car.y, ped.x, ped.y) < 26 * 26) {
        const killed = hurtPed(game, ped, 45 + Math.abs(car.speed) * 0.25);
        game.onCrime?.(killed ? 'kill' : 'hit-ped');
        car.speed *= 0.86;
      }
    }
  }
  // Shunting a cruiser counts too.
  for (const other of game.cars) {
    if (!other.police || other.dead) continue;
    if (dist2(car.x, car.y, other.x, other.y) < 44 * 44 && Math.abs(car.speed) > 70 && game.time - (car.lastBumpAt || -9) > 2) {
      car.lastBumpAt = game.time;
      game.onCrime?.('hit-police-car');
    }
  }
}

/** The service the player is standing at (shop, respray, …), or null. */
export function nearbyService(game) {
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const poi of Object.values(game.city.pois)) {
    if (dist2(px, py, poi.x, poi.y) < 52 * 52) return poi;
  }
  return null;
}

/** Small per-tick upkeep: skid marks, smoke, fire from damaged cars. */
export function stepCarEffects(game, dt) {
  for (const car of game.cars) {
    const dmg = 1 - car.hp / car.maxHp;
    if (car.burning > 0) {
      car.burning -= dt;
      if (game.rng() < 0.7) {
        game.particles.push({
          x: car.x + (game.rng() - 0.5) * 20, y: car.y + (game.rng() - 0.5) * 20,
          vx: (game.rng() - 0.5) * 30, vy: -30 - game.rng() * 40,
          life: 0.6, maxLife: 0.6, size: 7 + game.rng() * 8, kind: 'fire',
        });
      }
      if (car.burning <= 0 && !car.exploded) {
        car.exploded = true;
        game.onExplode?.(car);
      }
    } else if (dmg > 0.55 && !car.dead && game.rng() < 0.3) {
      game.particles.push({
        x: car.x + Math.cos(car.angle) * car.model.len * 0.3,
        y: car.y + Math.sin(car.angle) * car.model.len * 0.3,
        vx: (game.rng() - 0.5) * 16, vy: -24 - game.rng() * 20,
        life: 0.9, maxLife: 0.9, size: 6 + game.rng() * 6, kind: 'smoke',
      });
    }
    // Skid marks while sliding.
    const lat = Math.abs(-car.vx * Math.sin(car.angle) + car.vy * Math.cos(car.angle));
    if (lat > 55 && Math.abs(car.speed) > 60) {
      game.skids.push({ x: car.x, y: car.y, angle: car.angle, at: game.time });
      if (game.skids.length > 900) game.skids.shift();
    }
  }
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const pt = game.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) game.particles.splice(i, 1);
  }
}

export function clampPlayerToWorld(game) {
  const p = game.player;
  p.hp = clamp(p.hp, 0, p.maxHp);
  p.armor = clamp(p.armor, 0, p.maxArmor);
}
