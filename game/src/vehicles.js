// Solmaris Heat — cars: factory, arcade driving physics with drifting and tyre
// smoke, car-on-car collisions, and traffic AI that follows the road graph.
import { CAR, CAR_COLORS, CAR_MODELS, TRAFFIC } from './config.js';
import { collideCircle } from './city.js';
import { rngPick, rngRange } from './random.js';
import { tyreSmoke, engineSmoke, sparks, explosion } from './effects.js';

let nextCarId = 1;

export function makeCar(rng, x, y, angle, opts = {}) {
  const model = opts.model || rngPick(rng, CAR_MODELS);
  return {
    id: nextCarId++,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    steer: 0,
    health: 100,
    model,
    color: opts.color || rngPick(rng, CAR_COLORS),
    driver: opts.driver || 'none', // none | traffic | police | player
    nodeFrom: opts.nodeFrom ?? -1,
    nodeTo: opts.nodeTo ?? -1,
    laneOffset: 13,
    honkCd: 0,
    stuckTime: 0,
    smokeCd: 0,
    isPolice: !!opts.isPolice,
    isTaxi: model.name === 'Metro Taxi',
    stolen: false,
    dead: false,
    missionCar: false,
    spiked: false,   // tyres shredded by a spike strip: grip and top speed gone
  };
}

export function carForward(car) {
  return { x: Math.cos(car.angle), y: Math.sin(car.angle) };
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

// Arcade car physics shared by the player, traffic and police drivers.
// input: {throttle -1..1, steer -1..1, handbrake bool}
export function driveCarPhysics(G, car, input, dt) {
  const f = carForward(car);
  const r = { x: -f.y, y: f.x };
  let vf = car.vx * f.x + car.vy * f.y;   // forward speed
  let vr = car.vx * r.x + car.vy * r.y;   // lateral (slide) speed

  const top = car.spiked ? car.model.top * 0.42 : car.model.top;
  if (input.throttle > 0) vf += car.model.accel * input.throttle * dt * (vf < 0 ? 2.2 : 1);
  else if (input.throttle < 0) {
    if (vf > 12) vf -= CAR.brake * dt;
    else vf = Math.max(vf + car.model.accel * 0.55 * input.throttle * dt, -CAR.reverseMax);
  }
  vf -= vf * CAR.drag * dt * 0.35;
  if (Math.abs(vf) < 2 && input.throttle === 0) vf = 0;
  vf = Math.max(-CAR.reverseMax, Math.min(top, vf));

  // Grip: handbrake loosens the rear, rain loosens everything, spikes ruin it.
  let grip = input.handbrake ? CAR.driftGrip : car.model.grip;
  grip *= G.weather.gripFactor();
  if (car.spiked) grip *= 0.45;
  vr -= vr * Math.min(1, grip * dt);

  const steerAuthority = Math.min(1, Math.abs(vf) / 90) * (input.handbrake ? 1.5 : 1);
  car.angle += input.steer * CAR.turnRate * steerAuthority * dt * (vf < 0 ? -1 : 1);
  car.steer = input.steer;

  const nf = carForward(car);
  const nr = { x: -nf.y, y: nf.x };
  car.vx = nf.x * vf + nr.x * vr;
  car.vy = nf.y * vf + nr.y * vr;
  car.speed = vf;

  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Tyre smoke while sliding or doing a burnout.
  car.smokeCd -= dt;
  const sliding = Math.abs(vr) > CAR.smokeSpeed * 0.55;
  const burnout = input.throttle > 0 && Math.abs(vf) < 40 && input.handbrake;
  if ((sliding || burnout) && car.smokeCd <= 0) {
    car.smokeCd = 0.03;
    const back = { x: car.x - nf.x * 15, y: car.y - nf.y * 15 };
    tyreSmoke(G, back.x + nr.x * 8, back.y + nr.y * 8, Math.min(2, Math.abs(vr) / 90 + 0.6));
    tyreSmoke(G, back.x - nr.x * 8, back.y - nr.y * 8, Math.min(2, Math.abs(vr) / 90 + 0.6));
  }

  // Collide as two circles (front + rear) against buildings.
  for (const off of [CAR.length * 0.32, -CAR.length * 0.32]) {
    const probe = { x: car.x + nf.x * off, y: car.y + nf.y * off };
    if (collideCircle(G.city, probe, CAR.width * 0.55)) {
      const impact = Math.abs(vf);
      car.x = probe.x - nf.x * off;
      car.y = probe.y - nf.y * off;
      if (impact > 140) {
        damageCar(G, car, (impact - 120) / 9);
        G.fx.shake = Math.min(10, G.fx.shake + impact / 60);
        G.audio.crash(Math.min(1, impact / 400));
        sparks(G, probe.x, probe.y, 8);
      }
      car.vx *= 0.35; car.vy *= 0.35;
    }
  }
  carCarCollisions(G, car);
  if (car.health < 45 && !car.dead && Math.random() < 0.35) {
    engineSmoke(G, car.x + nf.x * 14, car.y + nf.y * 14);
  }
}

export function carCarCollisions(G, car) {
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    const min = CAR.length * 0.82;
    if (d > 0 && d < min) {
      const push = (min - d) / 2;
      const nx = dx / d, ny = dy / d;
      car.x -= nx * push; car.y -= ny * push;
      other.x += nx * push; other.y += ny * push;
      const rel = Math.abs((car.vx - other.vx) * nx + (car.vy - other.vy) * ny);
      if (rel > 90) {
        damageCar(G, car, rel / 16);
        damageCar(G, other, rel / 16);
        sparks(G, car.x + nx * 18, car.y + ny * 18, 6);
        G.audio.crash(Math.min(1, rel / 380));
        if (car.driver === 'player' || other.driver === 'player') {
          G.fx.shake = Math.min(10, G.fx.shake + rel / 70);
          G.onPlayerCarHit(car.driver === 'player' ? other : car);
        }
      }
      const swap = 0.55;
      const cvx = car.vx, cvy = car.vy;
      car.vx = cvx * (1 - swap) + other.vx * swap;
      car.vy = cvy * (1 - swap) + other.vy * swap;
      other.vx = other.vx * (1 - swap) + cvx * swap;
      other.vy = other.vy * (1 - swap) + cvy * swap;
    }
  }
}

export function damageCar(G, car, amount) {
  car.health = Math.max(0, car.health - amount);
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    car.vx = 0; car.vy = 0;
    explosion(G, car.x, car.y);
    G.audio.explosion();
    G.fx.shake = Math.min(12, G.fx.shake + 5);
  }
}

// Traffic driver: follow the road graph on the right-hand lane, brake for
// obstacles, honk when blocked, and panic a little when the chase rolls past.
export function updateTrafficCar(G, car, dt) {
  if (car.dead) return;
  const city = G.city;
  if (car.nodeTo < 0 || !city.nodes[car.nodeTo]) {
    const n = city.nodes[Math.floor(Math.random() * city.nodes.length)];
    car.nodeFrom = n.id;
    car.nodeTo = n.next.length ? n.next[0] : n.id;
  }
  const targetNode = city.nodes[car.nodeTo];
  const fromNode = city.nodes[car.nodeFrom] || targetNode;
  // Lane point: along from->to, offset to the right of travel.
  const dx = targetNode.x - fromNode.x, dy = targetNode.y - fromNode.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const laneX = targetNode.x + (-uy) * car.laneOffset;
  const laneY = targetNode.y + (ux) * car.laneOffset;

  const toX = laneX - car.x, toY = laneY - car.y;
  const dist = Math.hypot(toX, toY);
  if (dist < 30) {
    car.nodeFrom = car.nodeTo;
    const opts = targetNode.next.filter((id) => id !== car.nodeFrom);
    car.nodeTo = opts.length ? opts[Math.floor(Math.random() * opts.length)] : car.nodeFrom;
    return;
  }

  const desired = Math.atan2(toY, toX);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  // Obstacle check: anything slow directly ahead?
  let throttle = 1;
  const f = carForward(car);
  const aheadX = car.x + f.x * 54, aheadY = car.y + f.y * 54;
  const obstacles = [...G.cars.filter((c) => c !== car), ...G.peds];
  if (G.player.mode === 'foot') obstacles.push(G.player);
  for (const o of obstacles) {
    if (Math.hypot(o.x - aheadX, o.y - aheadY) < 30) { throttle = -0.4; break; }
  }
  if (throttle < 0 && car.honkCd <= 0 && Math.random() < 0.02) { G.audio.honk(); car.honkCd = 2; }
  car.honkCd -= dt;

  // Panic: if a police chase screams past, pull over and stop for a moment.
  let cruise = TRAFFIC.cruiseSpeed * (0.85 + (car.id % 5) * 0.07);
  if (G.police.stars > 0 && Math.hypot(G.player.x - car.x, G.player.y - car.y) < 150) {
    cruise *= 0.35;
    if (car.honkCd <= 0 && Math.random() < 0.01) { G.audio.honk(); car.honkCd = 3; }
  }

  const input = {
    throttle: carSpeed(car) > cruise ? 0 : throttle,
    steer: Math.max(-1, Math.min(1, diff * 2.2)),
    handbrake: false,
  };
  driveCarPhysics(G, car, input, dt);

  // Unstick: if barely moving for a while, nudge forward.
  if (carSpeed(car) < 8) car.stuckTime += dt; else car.stuckTime = 0;
  if (car.stuckTime > 2.5) { car.vx += f.x * 60; car.vy += f.y * 60; car.stuckTime = 0; }
}
