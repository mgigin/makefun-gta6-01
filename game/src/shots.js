// Solmaris Heat — deterministic screenshot scenes (?shot=chase|onfoot|mission|start&seed=1).
// Each scene stages the world, simulates a few seconds with scripted input, renders one
// frame, then sets window.__shotReady for the headless capture.
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { TILE, POLICE_MODEL } from './config.js';

export function setupShot(G, name) {
  const P = G.city.places;
  const p = G.player;
  G.state = 'play';
  G.hud.show();
  document.getElementById('screen-start').classList.add('hidden');

  if (name === 'start') {
    G.state = 'title';
    G.hud.hide();
    document.getElementById('screen-start').classList.remove('hidden');
    G.camera.x = 0;
    G.camera.y = 6 * TILE;
    G.dayTime = 0.62; // golden hour behind the title
    G.renderFrame();
    window.__shotReady = true;
    return;
  }

  if (name === 'chase') {
    // Cover shot: 4-star dusk chase — stolen coupe at speed, two cruisers on the
    // tail, the police helicopter's searchlight raking in, a roadblock ahead,
    // mission objective + minimap + stars all on the HUD.
    G.dayTime = 0.74; // dusk, streetlights coming on
    const car = makeCar(G.rng, 10 * TILE + 24, 18 * TILE + 24, -Math.PI / 2, {
      driver: 'player', color: '#c8433c',
      model: { name: 'Bayside Coupe', kind: 'coupe', top: 452, accel: 384, grip: 7.0 },
    });
    car.stolen = true;
    car.vy = -330;
    G.cars.push(car);
    p.mode = 'car'; p.car = car; p.x = car.x; p.y = car.y;
    p.cash = 2140; p.weapon = 'pistol'; p.ammo = 48; p.armor = 60;
    G.police.stars = 4;
    G.missions.objective = 'Deliver the Sunrunner to Chop & Shine — lose the heat first';
    G.missions.marker = { x: P.respray.x, y: P.respray.y, kind: 'job' };
    // Two cruisers already on the tail.
    for (let i = 0; i < 2; i++) {
      const cop = makeCar(G.rng, car.x + (i ? 30 : -30), car.y + 170 + i * 80, -Math.PI / 2, {
        driver: 'police', isPolice: true, color: '#e8ecf2', model: POLICE_MODEL,
      });
      cop.vy = -300;
      G.cars.push(cop);
    }
    // Roadblock across the avenue ahead.
    for (const side of [-1, 1]) {
      const block = makeCar(G.rng, car.x + side * 22, car.y - 430, 0, {
        driver: 'none', isPolice: true, color: '#e8ecf2', model: POLICE_MODEL,
      });
      G.cars.push(block);
    }
    // Helicopter overhead with the light on the player.
    G.air.heli = {
      x: car.x - 120, y: car.y - 180, angle: 0.6, rotor: 1.2,
      spotX: car.x, spotY: car.y, holding: true,
    };
    // Clear the lane so the scripted drive stays at speed.
    G.cars = G.cars.filter((c) => c === car || c.isPolice || Math.abs(c.x - car.x) > 130 || c.y > car.y + 40);
    // Scripted drive north up the avenue for ~1.3 simulated seconds.
    for (let i = 0; i < 80; i++) {
      G.step(1 / 60, { up: true });
    }
    G.police.stars = 4;
    G.hud.clearFeed();
    G.hud.feed('Roadblock ahead!');
    G.hud.feed('Police helicopter inbound — stay out of the light');
    G.renderFrame();
    window.__shotReady = true;
    return;
  }

  if (name === 'onfoot') {
    // On foot downtown at golden hour: peds on the sidewalk, shopfronts,
    // the fixer marker, a parked convertible, morning traffic rolling past.
    G.dayTime = 0.3; // early morning gold
    p.x = P.fixer.x - 90; p.y = P.fixer.y + 40;
    p.angle = -0.6;
    p.cash = 340;
    G.missions.marker = { x: P.fixer.x, y: P.fixer.y, kind: 'fixer' };
    G.missions.objective = 'See Dario Quint for work';
    for (let i = 0; i < 12; i++) {
      const ped = makePed(G.rng, p.x + (G.rng() - 0.5) * 460, p.y + (G.rng() - 0.5) * 320);
      G.peds.push(ped);
    }
    const parked = makeCar(G.rng, p.x + 120, p.y - 60, Math.PI / 2, {
      color: '#3ca8a0', model: { name: 'Sunrunner Convertible', kind: 'convertible', top: 442, accel: 366, grip: 6.8 },
    });
    G.cars.push(parked);
    for (let i = 0; i < 60; i++) G.step(1 / 60, {});
    G.renderFrame();
    window.__shotReady = true;
    return;
  }

  if (name === 'mission') {
    // Dockside Diplomacy mid-fight in the rain at night: Ledger shooters and a
    // rusher, muzzle flashes, wet streets, the bookkeeper van parked nearby.
    G.dayTime = 0.86; // night
    G.weather.set('rain');
    p.x = 3 * TILE + 24; p.y = 19 * TILE + 24;
    p.weapon = 'scattergun'; p.ammo = 24; p.armor = 40; p.health = 82; p.cash = 1860;
    p.angle = -Math.PI / 2;
    G.missions.objective = 'Take down the Ledger crew (4 left)';
    G.combat.spawnEnemy(G, p.x - 62, p.y - 105, 'shooter').aggro = true;
    G.combat.spawnEnemy(G, p.x + 62, p.y - 120, 'shooter').aggro = true;
    G.combat.spawnEnemy(G, p.x + 20, p.y - 80, 'rusher').aggro = true;
    G.combat.spawnEnemy(G, p.x - 30, p.y - 150, 'shooter').aggro = true;
    const van = makeCar(G.rng, p.x + 170, p.y - 40, 0.4, { color: '#2f2f36', model: { name: 'Dockside Van', kind: 'van', top: 332, accel: 272, grip: 5.2 } });
    G.cars.push(van);
    for (let i = 0; i < 40; i++) {
      G.step(1 / 60, { aiming: true, mouseX: 640, mouseY: 200, shoot: i >= 38 });
    }
    G.hud.clearFeed();
    G.hud.feed('Ledger crew spotted — weapons free');
    G.renderFrame();
    window.__shotReady = true;
    return;
  }

  // Unknown scene: just render the title.
  G.state = 'title';
  G.renderFrame();
  window.__shotReady = true;
}
