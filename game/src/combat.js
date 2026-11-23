// Combat: the player's weapons (fists to rifle, the scattergun in between),
// projectiles, and what happens when they land — on pedestrians, on cars, and
// on Mara herself. Gunfire is loud: it panics the street and feeds the heat.

import { WEAPONS } from './data.js';
import { hurtPed } from './peds.js';
import { damageCar, carCircles } from './vehicles.js';
import { pointInBuilding } from './city.js';
import { dist2 } from './rng.js';
import { feed } from './state.js';

export function spawnBullet(game, x, y, angle, opts) {
  game.bullets.push({
    x, y,
    vx: Math.cos(angle) * opts.speed,
    vy: Math.sin(angle) * opts.speed,
    life: opts.range / opts.speed,
    damage: opts.damage,
    from: opts.from,
  });
}

/** The player pulls the trigger (or swings). Returns true if a shot went out. */
export function playerFire(game) {
  const p = game.player;
  const w = WEAPONS[p.weapon];
  if (p.fireCd > 0 || p.dead) return false;
  if (p.weapon === 'fists') {
    p.fireCd = w.rate;
    // A punch lands on whoever is right in front.
    const fx = p.x + Math.cos(p.aim) * 22;
    const fy = p.y + Math.sin(p.aim) * 22;
    for (const ped of game.peds) {
      if (!ped.down && dist2(fx, fy, ped.x, ped.y) < 20 * 20) {
        hurtPed(game, ped, w.damage);
        game.onCrime?.('assault');
        break;
      }
    }
    return true;
  }
  if ((p.ammo[p.weapon] || 0) <= 0) {
    p.fireCd = 0.3;
    feed(game, `${w.name} is empty — buy ammo at Iron & Oak`);
    return false;
  }
  p.ammo[p.weapon] -= 1;
  p.fireCd = w.rate;
  game.lastShotAt = game.time;
  const mx = p.x + Math.cos(p.aim) * 16;
  const my = p.y + Math.sin(p.aim) * 16;
  for (let i = 0; i < w.pellets; i += 1) {
    const spread = (game.rng() * 2 - 1) * w.spread;
    spawnBullet(game, mx, my, p.aim + spread, { speed: w.speed, range: w.range, damage: w.damage, from: 'player' });
  }
  game.muzzle = { x: mx, y: my, angle: p.aim, at: game.time };
  game.onCrime?.('shoot');
  game.audio?.shot(p.weapon);
  return true;
}

/** Damage Mara; armor soaks first. Returns true when she goes down. */
export function hurtPlayer(game, amount) {
  const p = game.player;
  if (p.dead) return false;
  let left = amount;
  if (p.armor > 0) {
    const soaked = Math.min(p.armor, left * 0.7);
    p.armor -= soaked;
    left -= soaked;
  }
  p.hp -= left;
  p.hurtFlash = 0.35;
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    return true;
  }
  return false;
}

/** Step every bullet; walls stop them, bodies and cars take the hit. */
export function stepBullets(game, dt) {
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const b = game.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0 || pointInBuilding(game.city, b.x, b.y);
    if (!dead && b.from !== 'player') {
      // Shots at Mara (or her car).
      const targetR = p.inCar ? 24 : 11;
      if (dist2(b.x, b.y, px, py) < targetR * targetR) {
        if (p.inCar) damageCar(game, p.inCar, b.damage * 0.8, game.time);
        else hurtPlayer(game, b.damage);
        dead = true;
      }
    }
    if (!dead) {
      for (const ped of game.peds) {
        if (ped.down) continue;
        if (b.from === 'gang' && ped.hostile) continue;
        if (dist2(b.x, b.y, ped.x, ped.y) < 10 * 10) {
          const killed = hurtPed(game, ped, b.damage);
          if (b.from === 'player') game.onCrime?.(killed ? 'kill' : 'shoot-person');
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of game.cars) {
        if (car.dead) continue;
        for (const c of carCircles(car)) {
          if (dist2(b.x, b.y, c.x, c.y) < c.r * c.r) {
            damageCar(game, car, b.damage * 0.9, game.time);
            if (b.from === 'player' && car.police) game.onCrime?.('shoot-police');
            dead = true;
            break;
          }
        }
        if (dead) break;
      }
    }
    if (dead) game.bullets.splice(i, 1);
  }
  // Shots queued by gang members and police.
  for (const s of game.pendingShots) {
    const spread = (game.rng() * 2 - 1) * (s.spread || 0.05);
    spawnBullet(game, s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14, s.angle + spread, {
      speed: 780, range: 340, damage: s.damage, from: s.from,
    });
    game.lastShotAt = game.time;
  }
  game.pendingShots.length = 0;
}

/** A car fireball: damages everything close, shakes the camera, makes noise. */
export function explodeCar(game, car) {
  const R = 95;
  for (const ped of game.peds) {
    if (!ped.down && dist2(ped.x, ped.y, car.x, car.y) < R * R) hurtPed(game, ped, 90);
  }
  for (const other of game.cars) {
    if (other !== car && !other.dead && dist2(other.x, other.y, car.x, car.y) < R * R) {
      damageCar(game, other, 55, game.time);
    }
  }
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (dist2(px, py, car.x, car.y) < R * R) {
    if (p.inCar) damageCar(game, p.inCar, 60, game.time);
    else hurtPlayer(game, 55);
  }
  game.camera.shake = Math.max(game.camera.shake, 14);
  game.audio?.explosion();
  for (let i = 0; i < 26; i += 1) {
    game.particles.push({
      x: car.x, y: car.y,
      vx: (game.rng() - 0.5) * 260, vy: (game.rng() - 0.5) * 260,
      life: 0.5 + game.rng() * 0.8, maxLife: 1.3,
      size: 5 + game.rng() * 10, kind: 'fire',
    });
  }
}
