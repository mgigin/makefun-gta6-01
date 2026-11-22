// Solmaris Heat — the player: on-foot movement with sprint stamina, driving,
// entering and stealing cars, and getting shoved around by traffic.
import { PLAYER } from './config.js';
import { collideCircle } from './city.js';
import { driveCarPhysics, carSpeed } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    angle: -Math.PI / 2,
    mode: 'foot',
    car: null,
    health: PLAYER.maxHealth,
    armor: 0,
    cash: 120,
    weapon: 'fists',
    ammo: 0,
    stamina: 1,
    walkPhase: 0,
    shootCd: 0,
    punchCd: 0,
    dead: false,
  };
}

export function updatePlayer(G, input, dt) {
  const p = G.player;
  if (p.dead) return;
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);

  if (p.mode === 'car' && p.car) {
    const car = p.car;
    driveCarPhysics(G, car, {
      throttle: input.up ? 1 : input.down ? -1 : 0,
      steer: (input.right ? 1 : 0) - (input.left ? 1 : 0),
      handbrake: input.handbrake,
    }, dt);
    p.x = car.x; p.y = car.y;
    p.angle = car.angle;
    p.vx = car.vx; p.vy = car.vy;
    p.stamina = Math.min(1, p.stamina + PLAYER.staminaRegen * dt);
    if (car.dead) exitCar(G);
    return;
  }

  // On foot: screen-aligned movement, aim follows the mouse.
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  const sprinting = input.sprint && p.stamina > 0.02 && len > 0;
  const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (sprinting) p.stamina = Math.max(0, p.stamina - PLAYER.staminaDrain * dt);
  else p.stamina = Math.min(1, p.stamina + PLAYER.staminaRegen * dt);
  if (len > 0) {
    mx /= len; my /= len;
    p.vx = mx * speed; p.vy = my * speed;
    p.walkPhase += dt * (sprinting ? 13 : 9);
    if (!input.aiming) p.angle = Math.atan2(my, mx);
  } else {
    p.vx = 0; p.vy = 0;
  }
  if (input.aiming) {
    const w = G.screenToWorld(input.mouseX, input.mouseY);
    p.angle = Math.atan2(w.y - p.y, w.x - p.x);
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  collideCircle(G.city, p, PLAYER.radius);

  // Cars shove the player if they roll into them slowly; fast ones hurt.
  for (const car of G.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 30) {
      const sp = carSpeed(car);
      if (sp > 170) G.combat.damagePlayer(G, 22, 'run over');
      const push = (30 - d) || 1;
      const nx = (p.x - car.x) / (d || 1), ny = (p.y - car.y) / (d || 1);
      p.x += nx * push; p.y += ny * push;
    }
  }
}

export function nearestCar(G, maxDist) {
  const p = G.player;
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  const wasTraffic = car.driver === 'traffic';
  const wasPolice = car.isPolice;
  car.driver = 'player';
  p.mode = 'car';
  p.car = car;
  p.x = car.x; p.y = car.y;
  G.audio.door();
  if (wasTraffic || car.stolen) {
    G.stats.carsStolen++;
    G.police.addCrime(G, 'stealCar');
    G.hud.feed(`Stole a ${car.model.name}`);
    if (wasTraffic) {
      // The driver bails out and runs.
      G.peds.push({
        x: car.x + 16, y: car.y + 10, angle: 0, speed: 50, shirt: '#888', skin: '#d9a06b',
        state: 'flee', timer: 2, health: 30, walkPhase: 0, targetX: 0, targetY: 0,
      });
    }
  } else if (wasPolice) {
    G.police.addCrime(G, 'stealCar');
    G.hud.feed('You took a police cruiser!');
  }
  car.stolen = true;
  G.missions.onEnterCar(car);
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = 'none';
  car.vx *= 0.4; car.vy *= 0.4;
  p.mode = 'foot';
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
  p.vx = 0; p.vy = 0;
  G.audio.door();
}
