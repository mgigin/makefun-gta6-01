// Solmaris Heat — story missions for fixer Dario Quint, plus taxi fares and
// street races. Mara Voss, ex-courier, runs jobs against the Ledger crew
// across the bay city of Solmaris: deliveries, thefts, shootouts, races,
// a repossession against the clock, and a final run to the ferry.
import { makeCar } from './vehicles.js';
import { TILE } from './config.js';

const STORY = [
  {
    id: 'first-run', title: 'First Run', reward: 150,
    brief: 'Dario Quint: "Mara. Simple one. Take my package down to the Docks. Don\'t open it, don\'t lose it."',
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', reward: 300,
    brief: 'Dario: "A Sunrunner convertible, Palm Heights. The Ledger owes me. Take it to Chop & Shine and lose any heat on the way."',
  },
  {
    id: 'dockside', title: 'Dockside Diplomacy', reward: 450,
    brief: 'Dario: "The Ledger crew is muscling my dock contacts. Go down there and make it stop. Bring the pistol from Iron & Oak."',
  },
  {
    id: 'bay-run', title: 'Bay Run', reward: 400,
    brief: 'Dario: "Courier race, old routes. Hit every checkpoint before the clock dies and the bay remembers your name."',
  },
  {
    id: 'repo-job', title: 'Repo Job', reward: 550,
    brief: 'Dario: "A Palm GT with a tracker, Palm Heights. The repo crew is coming for it too — beat the clock to Chop & Shine."',
  },
  {
    id: 'ledger-van', title: "The Ledger's Ledger", reward: 650,
    brief: 'Dario: "Their bookkeeper van rolls at dusk. Take it, bring it to the safehouse. Expect company."',
  },
  {
    id: 'pier-pressure', title: 'Pier Pressure', reward: 800,
    brief: 'Dario: "The Ledger is shaking down the pier vendors. Clear them out, Mara. All of them."',
  },
  {
    id: 'last-ferry', title: 'Last Ferry', reward: 1000,
    brief: 'Dario: "One last run, Mara. Get me to the ferry alive and Solmaris is yours. The Ledger will come. Let them."',
  },
];

export function createMissions() {
  return {
    storyIndex: 0,          // next story mission to offer
    active: null,           // current mission runtime state
    marker: null,           // {x, y, kind}
    objective: '',
    timer: 0,
    taxi: null,             // {fare, destX, destY, stage, timer}
    race: null,             // {checkpoints:[], next, timeLeft} — story race
    streetRace: null,       // repeatable side race, same shape

    storyDone() { return this.storyIndex >= STORY.length; },
    nextTitle() { return this.storyDone() ? null : STORY[this.storyIndex].title; },

    offerPoint(G) {
      return this.storyDone() ? null : G.city.places.fixer;
    },

    startStory(G) {
      if (this.active || this.storyDone()) return;
      const def = STORY[this.storyIndex];
      const P = G.city.places;
      this.active = { def, stage: 0, data: {} };
      G.hud.message(`${def.title}\n${def.brief}`, 6);
      G.audio.missionStart();
      switch (def.id) {
        case 'first-run':
          this.objective = 'Deliver the package to the Docks';
          this.marker = { x: 2 * TILE + 24, y: 20 * TILE + 24, kind: 'job' };
          break;
        case 'hot-wheels': {
          const car = makeCar(G.rng, 20 * TILE + 24, 11 * TILE + 24, 0, {
            color: '#e06a2e', model: { name: 'Sunrunner Convertible', kind: 'convertible', top: 442, accel: 366, grip: 6.8 },
          });
          car.missionCar = true;
          G.cars.push(car);
          this.active.data.car = car;
          this.objective = 'Steal the orange Sunrunner in Palm Heights';
          this.marker = { x: car.x, y: car.y, kind: 'job' };
          break;
        }
        case 'dockside':
          this.objective = 'Meet the Ledger crew at the Docks';
          this.marker = { x: 3 * TILE + 24, y: 19 * TILE + 24, kind: 'job' };
          break;
        case 'bay-run': {
          const cps = [[15, 5], [20, 10], [15, 15], [20, 20], [10, 20], [5, 15], [5, 10], [10, 5]];
          this.race = { checkpoints: cps.map(([tx, ty]) => ({ x: tx * TILE + 24, y: ty * TILE + 24 })), next: 0, timeLeft: 110 };
          this.objective = 'Hit every checkpoint before time runs out';
          this.marker = { ...this.race.checkpoints[0], kind: 'race' };
          break;
        }
        case 'repo-job': {
          const car = makeCar(G.rng, 22 * TILE + 24, 7 * TILE + 24, Math.PI / 2, {
            color: '#c8433c', model: { name: 'Palm GT', kind: 'coupe', top: 478, accel: 410, grip: 7.3 },
          });
          car.missionCar = true;
          G.cars.push(car);
          this.active.data.car = car;
          this.active.data.timeLeft = 95;
          this.objective = 'Repossess the red Palm GT in Palm Heights';
          this.marker = { x: car.x, y: car.y, kind: 'job' };
          break;
        }
        case 'ledger-van': {
          const van = makeCar(G.rng, 16 * TILE + 24, 16 * TILE + 24, Math.PI, {
            color: '#2f2f36', model: { name: 'Dockside Van', kind: 'van', top: 332, accel: 272, grip: 5.2 },
          });
          van.missionCar = true;
          G.cars.push(van);
          this.active.data.car = van;
          this.objective = 'Steal the Ledger bookkeeper van';
          this.marker = { x: van.x, y: van.y, kind: 'job' };
          break;
        }
        case 'pier-pressure':
          this.objective = 'Clear the Ledger crew off the pier';
          this.marker = { x: P.ferry.x, y: P.ferry.y, kind: 'job' };
          break;
        case 'last-ferry': {
          const car = makeCar(G.rng, P.fixer.x + 60, P.fixer.y, 0, {
            color: '#3c6dc8', model: { name: 'Bayside Coupe', kind: 'coupe', top: 452, accel: 384, grip: 7.0 },
          });
          car.missionCar = true;
          G.cars.push(car);
          this.active.data.car = car;
          this.active.data.waves = 0;
          this.objective = 'Get in Dario\'s coupe';
          this.marker = { x: car.x, y: car.y, kind: 'job' };
          break;
        }
      }
    },

    complete(G, bonusText) {
      const def = this.active.def;
      G.player.cash += def.reward;
      G.stats.missionsDone++;
      G.hud.toast(`MISSION PASSED\n${def.title}  +$${def.reward}${bonusText ? '\n' + bonusText : ''}`);
      G.audio.missionPass();
      this.active = null;
      this.marker = null;
      this.objective = '';
      this.race = null;
      this.storyIndex++;
      if (this.storyDone()) {
        G.hud.message('Story complete — Solmaris is yours. Taxi fares and street races remain.', 7);
      } else {
        G.hud.feed(`Next job: ${this.nextTitle()} — see Dario (yellow marker)`);
      }
      G.save.autoSave();
    },

    fail(G, reason) {
      G.hud.toast(`MISSION FAILED\n${reason}`);
      G.audio.missionFail();
      this.active = null;
      this.marker = null;
      this.objective = '';
      this.race = null;
    },

    onEnterCar(car) {
      // Handled in update via active.data.car checks.
    },

    onEnemyDown() {
      // Counted in update via combat.enemies state.
    },

    onTaxiPickup() {
      if (this.taxi) this.taxi.stage = 'deliver';
    },

    update(G, dt) {
      const p = G.player;
      const P = G.city.places;

      // Offer the next story job at the fixer's corner.
      if (!this.active && !this.storyDone()) {
        const fp = P.fixer;
        this.marker = { x: fp.x, y: fp.y, kind: 'fixer' };
        if (Math.hypot(p.x - fp.x, p.y - fp.y) < 40 && p.mode === 'foot') this.startStory(G);
      }

      if (this.active) {
        const a = this.active;
        const near = (x, y, r = 46) => Math.hypot(p.x - x, p.y - y) < r;
        switch (a.def.id) {
          case 'first-run':
            if (near(this.marker.x, this.marker.y, 52)) this.complete(G);
            break;
          case 'hot-wheels': {
            const car = a.data.car;
            if (a.stage === 0 && p.car === car) {
              a.stage = 1;
              this.objective = 'Deliver the Sunrunner to Chop & Shine — lose the heat first';
              this.marker = { x: P.respray.x, y: P.respray.y, kind: 'job' };
            }
            if (a.stage === 1 && p.car === car && near(P.respray.x, P.respray.y, 56)) {
              if (G.police.stars > 0) { G.hud.message('Lose the police before the drop!', 2.5); }
              else this.complete(G);
            }
            if (car.dead) this.fail(G, 'The Sunrunner was destroyed');
            break;
          }
          case 'dockside': {
            if (a.stage === 0 && near(this.marker.x, this.marker.y, 60)) {
              a.stage = 1;
              G.combat.spawnEnemy(G, this.marker.x - 46, this.marker.y - 30, 'shooter');
              G.combat.spawnEnemy(G, this.marker.x + 46, this.marker.y - 30, 'shooter');
              G.combat.spawnEnemy(G, this.marker.x, this.marker.y - 70, 'rusher');
              this.objective = 'Take down the Ledger crew (3)';
              this.marker = null;
            }
            if (a.stage === 1) {
              const left = G.combat.enemies.filter((e) => e.state !== 'down').length;
              this.objective = `Take down the Ledger crew (${left} left)`;
              if (left === 0) this.complete(G);
            }
            break;
          }
          case 'bay-run': {
            if (this.race) {
              this.race.timeLeft -= dt;
              const cp = this.race.checkpoints[this.race.next];
              this.objective = `Checkpoint ${this.race.next + 1}/${this.race.checkpoints.length} — ${Math.max(0, this.race.timeLeft).toFixed(0)}s`;
              if (cp && near(cp.x, cp.y, 60)) {
                this.race.next++;
                this.race.timeLeft += 9;
                G.audio.checkpoint();
                if (this.race.next >= this.race.checkpoints.length) { this.complete(G); break; }
                this.marker = { ...this.race.checkpoints[this.race.next], kind: 'race' };
              }
              if (this.race.timeLeft <= 0) this.fail(G, 'Out of time');
            }
            break;
          }
          case 'repo-job': {
            const car = a.data.car;
            if (a.stage === 0 && p.car === car) {
              a.stage = 1;
              G.police.addCrime(G, 'stealCar');
              this.marker = { x: P.respray.x, y: P.respray.y, kind: 'job' };
            }
            if (a.stage === 1) {
              a.data.timeLeft -= dt;
              this.objective = `Deliver the Palm GT to Chop & Shine — tracker: ${Math.max(0, a.data.timeLeft).toFixed(0)}s`;
              if (p.car === car && near(P.respray.x, P.respray.y, 56)) {
                this.complete(G, `Tracker beaten with ${Math.max(0, a.data.timeLeft).toFixed(0)}s to spare`);
              } else if (a.data.timeLeft <= 0) {
                this.fail(G, 'The tracker pinged — the repo crew took it back');
              }
            }
            if (car.dead) this.fail(G, 'The Palm GT was destroyed');
            break;
          }
          case 'ledger-van': {
            const van = a.data.car;
            if (a.stage === 0 && p.car === van) {
              a.stage = 1;
              G.police.addCrime(G, 'missionHeat');
              G.police.addCrime(G, 'missionHeat');
              this.objective = 'Deliver the van to the safehouse';
              this.marker = { x: P.safehouse.x, y: P.safehouse.y, kind: 'job' };
            }
            if (a.stage === 1 && p.car === van && near(P.safehouse.x, P.safehouse.y, 56)) this.complete(G);
            if (van.dead) this.fail(G, 'The van was destroyed');
            break;
          }
          case 'pier-pressure': {
            if (a.stage === 0 && near(this.marker.x, this.marker.y, 70)) {
              a.stage = 1;
              const spots = [[-70, -40], [70, -40], [-40, 30], [40, 30], [0, -90]];
              spots.forEach(([dx, dy], i) => {
                G.combat.spawnEnemy(G, this.marker.x + dx, this.marker.y + dy, i % 2 ? 'rusher' : 'shooter');
              });
              this.objective = 'Take down the Ledger crew (5)';
              this.marker = null;
            }
            if (a.stage === 1) {
              const left = G.combat.enemies.filter((e) => e.state !== 'down').length;
              this.objective = `Take down the Ledger crew (${left} left)`;
              if (left === 0) this.complete(G, 'The pier vendors send their thanks');
            }
            break;
          }
          case 'last-ferry': {
            const car = a.data.car;
            if (a.stage === 0 && p.car === car) {
              a.stage = 1;
              this.objective = 'Drive Dario to the ferry at Solmaris Beach';
              this.marker = { x: P.ferry.x, y: P.ferry.y, kind: 'job' };
            }
            if (a.stage === 1) {
              a.data.waveTimer = (a.data.waveTimer || 0) - dt;
              if (a.data.waveTimer <= 0 && a.data.waves < 3) {
                a.data.waveTimer = 16;
                a.data.waves++;
                for (let i = 0; i < 2; i++) {
                  const ang = Math.random() * Math.PI * 2;
                  G.combat.spawnEnemy(G, p.x + Math.cos(ang) * 320, p.y + Math.sin(ang) * 320, i ? 'rusher' : 'shooter');
                }
                G.hud.feed('Ledger ambush!');
              }
              if (p.car === car && near(this.marker.x, this.marker.y, 60)) this.complete(G, 'Dario made the ferry. The bay is yours.');
            }
            if (car.dead) this.fail(G, 'Dario\'s coupe was destroyed');
            break;
          }
        }
      }

      this.updateTaxi(G, dt);
      this.updateStreetRace(G, dt);
    },

    // Street race side activity: drive to the meet in Palm Heights, then hit
    // six checkpoints against the clock for cash. Repeatable.
    updateStreetRace(G, dt) {
      const p = G.player;
      const P = G.city.places;
      if (this.active || this.taxi) return;
      if (!this.streetRace) {
        if (p.mode === 'car' && Math.hypot(p.x - P.raceStart.x, p.y - P.raceStart.y) < 60) {
          const cps = [[15, 20], [5, 20], [5, 10], [10, 5], [20, 5], [20, 15]];
          this.streetRace = { checkpoints: cps.map(([tx, ty]) => ({ x: tx * TILE + 24, y: ty * TILE + 24 })), next: 0, timeLeft: 100 };
          this.objective = 'Street race — hit every checkpoint!';
          this.marker = { ...this.streetRace.checkpoints[0], kind: 'race' };
          G.hud.feed('Street race started — $400 if you finish');
          G.audio.missionStart();
        }
        return;
      }
      const r = this.streetRace;
      r.timeLeft -= dt;
      const cp = r.checkpoints[r.next];
      this.objective = `Race checkpoint ${r.next + 1}/${r.checkpoints.length} — ${Math.max(0, r.timeLeft).toFixed(0)}s`;
      if (cp && Math.hypot(p.x - cp.x, p.y - cp.y) < 62) {
        r.next++;
        r.timeLeft += 8;
        G.audio.checkpoint();
        if (r.next >= r.checkpoints.length) {
          const pay = 400 + Math.floor(r.timeLeft) * 2;
          p.cash += pay;
          G.stats.racesWon = (G.stats.racesWon || 0) + 1;
          G.hud.toast(`RACE WON +$${pay}`);
          G.audio.missionPass();
          this.streetRace = null;
          this.objective = '';
          this.marker = null;
          return;
        }
        this.marker = { ...r.checkpoints[r.next], kind: 'race' };
      }
      if (r.timeLeft <= 0 || p.mode !== 'car') {
        G.hud.feed('Street race lost');
        G.audio.missionFail();
        this.streetRace = null;
        this.objective = '';
        this.marker = null;
      }
    },

    // Taxi side job: enter a Metro Taxi, pick up fares, deliver them for cash.
    updateTaxi(G, dt) {
      const p = G.player;
      if (!this.taxi && p.mode === 'car' && p.car && p.car.isTaxi && !this.active && !this.streetRace) {
        const fare = G.peds.find((ped) => ped.state === 'walk');
        if (fare) {
          fare.state = 'taxi';
          this.taxi = { fare, stage: 'pickup', destX: 0, destY: 0, timer: 45 };
          this.objective = 'Taxi: pick up the fare';
          this.marker = { x: fare.x, y: fare.y, kind: 'taxi' };
          G.hud.feed('Taxi job started');
        }
      }
      if (!this.taxi) return;
      const t = this.taxi;
      if (p.mode !== 'car' || !p.car || !p.car.isTaxi) {
        if (t.fare.state === 'taxi') t.fare.state = 'walk';
        if (t.fare.state === 'riding') { t.fare.state = 'walk'; t.fare.hidden = false; }
        this.taxi = null;
        if (!this.active) { this.objective = ''; this.marker = null; }
        return;
      }
      t.timer -= dt;
      if (t.stage === 'pickup') {
        this.marker = { x: t.fare.x, y: t.fare.y, kind: 'taxi' };
        if (t.fare.state === 'riding') {
          t.stage = 'deliver';
          t.destX = 80 + Math.random() * 1080;
          t.destY = 80 + Math.random() * 1000;
          t.timer = 55;
          this.objective = 'Taxi: drop the fare at the marker';
          this.marker = { x: t.destX, y: t.destY, kind: 'taxi' };
        }
      } else if (t.stage === 'deliver') {
        this.objective = `Taxi: drop the fare — ${Math.max(0, t.timer).toFixed(0)}s`;
        if (Math.hypot(p.x - t.destX, p.y - t.destY) < 52) {
          const pay = 60 + Math.floor(t.timer);
          p.cash += pay;
          G.stats.taxiFares++;
          G.hud.toast(`FARE DELIVERED +$${pay}`);
          G.audio.missionPass();
          t.fare.state = 'walk';
          t.fare.hidden = false;
          t.fare.x = p.x + 30; t.fare.y = p.y + 20;
          this.taxi = null;
          this.objective = '';
          this.marker = null;
          return;
        }
      }
      if (t.timer <= 0) {
        G.hud.feed('Fare lost — too slow');
        if (t.fare.state === 'taxi') t.fare.state = 'walk';
        if (t.fare.state === 'riding') { t.fare.state = 'walk'; t.fare.hidden = false; }
        this.taxi = null;
        this.objective = '';
        this.marker = null;
      }
    },
  };
}
