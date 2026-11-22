// Solmaris Heat — wanted level and police response: cruisers that chase with
// intercept steering, roadblocks, spike strips, foot officers, a bust meter,
// and a "searching" cooldown where the stars blink before they drop.
import { POLICE, POLICE_MODEL } from './config.js';
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
    searching: false,      // true while unseen: HUD blinks the stars
    spawnTimer: 0,
    roadblockTimer: 0,
    spikeTimer: 0,
    spikes: [],            // {x, y, angle} deployed spike strips

    addCrime(G, kind) {
      const add = CRIME_STARS[kind] || 1;
      const before = this.stars;
      this.stars = Math.min(5, this.stars + add);
      this.unseenTime = 0;
      this.searching = false;
      if (this.stars > before) {
        G.hud.feed(`Wanted level ${this.stars} — police responding`);
        if (before === 0) G.audio.sirenStart();
      }
    },

    clear(G, silent) {
      this.stars = 0;
      this.bust = 0;
      this.unseenTime = 0;
      this.searching = false;
      this.spikes = [];
      for (const car of G.cars) if (car.isPolice) car.driver = 'none';
      G.cars = G.cars.filter((c) => !c.isPolice || c === G.player.car);
      G.peds = G.peds.filter((ped) => ped.state !== 'cop');
      G.air.clear(G);
      G.audio.sirenStop();
      if (!silent) G.hud.feed('You lost the police');
    },

    copCars(G) {
      return G.cars.filter((c) => c.isPolice && c.driver === 'police');
    },

    spawnCruiser(G, x, y, angle) {
      const cop = makeCar(G.rng, x, y, angle, {
        driver: 'police', isPolice: true, color: '#e8ecf2', model: POLICE_MODEL,
      });
      G.cars.push(cop);
      return cop;
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
        this.spawnCruiser(G, spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x));
      }

      // Foot officers join when the player is on foot at 2+ stars.
      if (p.mode === 'foot' && this.stars >= 2) {
        const officers = G.peds.filter((ped) => ped.state === 'cop');
        if (officers.length < Math.min(3, this.stars) && this.spawnTimer <= 0) {
          this.spawnTimer = 2;
          const a = Math.random() * Math.PI * 2;
          G.peds.push({
            x: p.x + Math.cos(a) * 260, y: p.y + Math.sin(a) * 260,
            angle: 0, speed: 128, shirt: '#1d3f7d', skin: '#d9a06b',
            state: 'cop', timer: 0, health: 50, walkPhase: 0, targetX: 0, targetY: 0,
          });
        }
      }

      // Roadblocks at 3+ stars: two cruisers nose-to-nose across the road ahead.
      this.roadblockTimer -= dt;
      if (this.stars >= POLICE.roadblockStars && this.roadblockTimer <= 0 && p.mode === 'car') {
        this.roadblockTimer = 16;
        const car = p.car;
        const bx = car.x + Math.cos(car.angle) * 430;
        const by = car.y + Math.sin(car.angle) * 430;
        if (bx > 40 && by > 40 && bx < 1210 && by < 1160) {
          for (const side of [-1, 1]) {
            const block = makeCar(G.rng, bx + Math.cos(car.angle + Math.PI / 2) * side * 22, by + Math.sin(car.angle + Math.PI / 2) * side * 22, car.angle + Math.PI / 2, {
              driver: 'none', isPolice: true, color: '#e8ecf2', model: POLICE_MODEL,
            });
            G.cars.push(block);
          }
          G.hud.feed('Roadblock ahead!');
        }
      }

      // Spike strips at 5 stars, dropped on the road in front of the player.
      this.spikeTimer -= dt;
      if (this.stars >= POLICE.spikeStars && this.spikeTimer <= 0 && p.mode === 'car' && carSpeed(p.car) > 120) {
        this.spikeTimer = 18;
        const car = p.car;
        this.spikes.push({
          x: car.x + Math.cos(car.angle) * 360,
          y: car.y + Math.sin(car.angle) * 360,
          angle: car.angle + Math.PI / 2,
        });
        if (this.spikes.length > 3) this.spikes.shift();
        G.hud.feed('Spike strip deployed ahead!');
      }
      // Crossing a strip shreds the tyres of any car (police included).
      for (const car of G.cars) {
        if (car.dead || car.spiked) continue;
        for (const s of this.spikes) {
          if (Math.hypot(car.x - s.x, car.y - s.y) < 26 && carSpeed(car) > 60) {
            car.spiked = true;
            G.audio.crash(0.4);
            if (car.driver === 'player') G.hud.message('Tyres shredded! Find Chop & Shine.', 3);
          }
        }
      }

      // Chase AI + bust/escape logic.
      let nearestCop = Infinity;
      for (const cop of this.copCars(G)) {
        const d = Math.hypot(cop.x - p.x, cop.y - p.y);
        nearestCop = Math.min(nearestCop, d);
        // Aim at where the player will be shortly (intercept course).
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
      for (const ped of G.peds) {
        if (ped.state === 'cop') nearestCop = Math.min(nearestCop, Math.hypot(ped.x - p.x, ped.y - p.y));
      }

      const playerSpeed = p.mode === 'car' ? carSpeed(p.car) : Math.hypot(p.vx, p.vy);
      if (nearestCop < POLICE.bustRadius && playerSpeed < 60) {
        this.bust += POLICE.bustRate * dt * (1 + this.stars * 0.12);
        if (this.bust >= 1) { G.onBusted(); return; }
      } else {
        this.bust = Math.max(0, this.bust - dt * 0.5);
      }

      // Escape: unseen time cools the heat one star at a time. The helicopter's
      // searchlight counts as being seen.
      const seen = nearestCop <= 380 || G.air.holdingPlayer(G);
      if (!seen) {
        this.unseenTime += dt;
        this.searching = this.unseenTime > 1.5;
        if (this.unseenTime > POLICE.loseSightTime) {
          this.unseenTime = 0;
          this.stars -= 1;
          if (this.stars <= 0) this.clear(G);
          else G.hud.feed(`Heat cooling… ${this.stars} star${this.stars > 1 ? 's' : ''} left`);
        }
      } else {
        this.unseenTime = 0;
        this.searching = false;
      }
    },
  };
}
