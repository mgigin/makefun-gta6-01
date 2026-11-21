// Solmaris Heat — wanted level, police response, chase AI, bust meter, escape cooldown.
import { POLICE } from './config.js';
import { makeCar, driveCarPhysics, carSpeed } from './vehicles.js';
import { randomRoadPoint } from './city.js';

const CRIME_STARS = {
  stealCar: 1,
  hitPed: 2,
  assault: 1,
  shoot: 1,
  hitCop: 2,
  killCop: 3,
  missionHeat: 2,
};

export function createPolice() {
  return {
    stars: 0,
    bust: 0,
    unseenTime: 0,
    spawnTimer: 0,
    roadblockTimer: 0,

    addCrime(G, kind) {
      const add = CRIME_STARS[kind] || 1;
      const before = this.stars;
      this.stars = Math.min(5, this.stars + add);
      this.unseenTime = 0;
      if (this.stars > before) {
        G.hud.feed(`Wanted level ${this.stars} — police responding`);
        if (before === 0) G.audio.sirenStart();
      }
    },

    clear(G, silent) {
      this.stars = 0;
      this.bust = 0;
      this.unseenTime = 0;
      for (const car of G.cars) if (car.isPolice) car.driver = 'none';
      G.cars = G.cars.filter((c) => !c.isPolice || c === G.player.car);
      G.audio.sirenStop();
      if (!silent) G.hud.feed('You lost the police');
    },

    copCars(G) {
      return G.cars.filter((c) => c.isPolice && c.driver === 'police');
    },

    update(G, dt) {
      const p = G.player;
      if (this.stars === 0) { this.bust = Math.max(0, this.bust - dt); return; }

      // Keep a response force proportional to the stars.
      const wanted = Math.min(POLICE.maxCars, this.stars + 1);
      this.spawnTimer -= dt;
      if (this.copCars(G).length < wanted && this.spawnTimer <= 0) {
        this.spawnTimer = 1.2;
        const spot = randomRoadPoint(G.city, G.rng, p.x, p.y, 420);
        const cop = makeCar(G.rng, spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x), {
          driver: 'police', isPolice: true, color: '#e8ecf2',
          model: { name: 'Solmaris PD Interceptor', top: 455, accel: 400, grip: 7.2 },
        });
        G.cars.push(cop);
      }

      // Roadblocks at high heat: a parked cruiser across the road ahead.
      this.roadblockTimer -= dt;
      if (this.stars >= 4 && this.roadblockTimer <= 0 && p.mode === 'car') {
        this.roadblockTimer = 14;
        const car = p.car;
        const bx = car.x + Math.cos(car.angle) * 420;
        const by = car.y + Math.sin(car.angle) * 420;
        if (bx > 40 && by > 40 && bx < 1210 && by < 1160) {
          const block = makeCar(G.rng, bx, by, car.angle + Math.PI / 2, {
            driver: 'none', isPolice: true, color: '#e8ecf2',
            model: { name: 'Solmaris PD Interceptor', top: 455, accel: 400, grip: 7.2 },
          });
          G.cars.push(block);
          G.hud.feed('Roadblock ahead!');
        }
      }

      // Chase AI + bust/escape logic.
      let nearestCop = Infinity;
      for (const cop of this.copCars(G)) {
        const d = Math.hypot(cop.x - p.x, cop.y - p.y);
        nearestCop = Math.min(nearestCop, d);
        // Aim at where the player will be shortly.
        const pvx = p.mode === 'car' ? p.car.vx : p.vx;
        const pvy = p.mode === 'car' ? p.car.vy : p.vy;
        const lead = Math.min(0.6, d / 500);
        const tx = p.x + pvx * lead, ty = p.y + pvy * lead;
        const desired = Math.atan2(ty - cop.y, tx - cop.x);
        let diff = desired - cop.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const input = {
          throttle: d < 60 && carSpeed(cop) > 160 ? 0.2 : 1,
          steer: Math.max(-1, Math.min(1, diff * 2.4)),
          handbrake: Math.abs(diff) > 1.6 && carSpeed(cop) > 200,
        };
        driveCarPhysics(G, cop, input, dt);
        // Recycle cops that fall hopelessly behind.
        if (d > 1100) {
          const spot = randomRoadPoint(G.city, G.rng, p.x, p.y, 460);
          cop.x = spot.x; cop.y = spot.y; cop.vx = 0; cop.vy = 0;
        }
      }

      const playerSpeed = p.mode === 'car' ? carSpeed(p.car) : Math.hypot(p.vx, p.vy);
      if (nearestCop < POLICE.bustRadius && playerSpeed < 60) {
        this.bust += POLICE.bustRate * dt * (1 + this.stars * 0.12);
        if (this.bust >= 1) { G.onBusted(); return; }
      } else {
        this.bust = Math.max(0, this.bust - dt * 0.5);
      }

      if (nearestCop > 380) {
        this.unseenTime += dt;
        if (this.unseenTime > POLICE.loseSightTime) {
          this.unseenTime = 0;
          this.stars -= 1;
          if (this.stars <= 0) this.clear(G);
          else G.hud.feed(`Heat cooling… ${this.stars} star${this.stars > 1 ? 's' : ''} left`);
        }
      } else {
        this.unseenTime = 0;
      }
    },
  };
}
