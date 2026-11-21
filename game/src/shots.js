// Solmaris Heat — deterministic screenshot scenes (?shot=chase|onfoot|mission|start&seed=1).
// Each scene stages the world, simulates a few seconds with scripted input, renders one
// frame, then sets window.__shotReady for the headless capture.
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { TILE } from './config.js';

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
    // Cover shot: player fleeing in a stolen coupe, 3 stars, police on the tail,
    // traffic around, mission objective on the HUD, minimap live.
    G.dayTime = 0.45;
    const car = makeCar(G.rng, 10 * TILE + 24, 18 * TILE + 24, -Math.PI / 2, {
      driver: 'player', color: '#c8433c',
      model: { name: 'Bayside Coupe', top: 450, accel: 380, grip: 7.0 },
    });
    car.stolen = true;
    car.vy = -330;
    G.cars.push(car);
    p.mode = 'car'; p.car = car; p.x = car.x; p.y = car.y;
    p.cash = 1240; p.weapon = 'pistol'; p.ammo = 48; p.armor = 60;
    G.police.stars = 3;
    G.missions.objective = 'Deliver the Sunrunner to Chop & Shine — lose the heat first';
    G.missions.marker = { x: P.respray.x, y: P.respray.y, kind: 'job' };
    // Two cruisers already on the tail.
    for (let i = 0; i < 2; i++) {
      const cop = makeCar(G.rng, car.x + (i ? 30 : -30), car.y + 170 + i * 80, -Math.PI / 2, {
        driver: 'police', isPolice: true, color: '#e8ecf2',
        model: { name: 'Solmaris PD Interceptor', top: 455, accel: 400, grip: 7.2 },
      });
      cop.vy = -300;
      G.cars.push(cop);
    }
    // Clear the lane so the scripted drive stays at speed.
    G.cars = G.cars.filter((c) => c === car || c.isPolice || Math.abs(c.x - car.x) > 130 || c.y > car.y + 40);
    // Scripted drive north up the avenue for ~1.3 simulated seconds.
    for (let i = 0; i < 80; i++) {
      G.step(1 / 60, { up: true });
    }
    G.police.stars = 3;
    G.hud.clearFeed();
    G.hud.feed('Stole a Bayside Coupe');
    G.hud.feed('Wanted level 3 — police responding');
    G.renderFrame();
    window.__shotReady = true;
    return;
  }

  if (name === 'onfoot') {
    // On foot downtown: peds on the sidewalk, the fixer marker, morning light.
    G.dayTime = 0.38;
    p.x = P.fixer.x - 90; p.y = P.fixer.y + 40;
    p.angle = -0.6;
    p.cash = 340;
    G.missions.marker = { x: P.fixer.x, y: P.fixer.y, kind: 'fixer' };
    G.missions.objective = 'See Dario Quint for work';
    for (let i = 0; i < 10; i++) {
      const ped = makePed(G.rng, p.x + (G.rng() - 0.5) * 420, p.y + (G.rng() - 0.5) * 300);
      G.peds.push(ped);
    }
    const parked = makeCar(G.rng, p.x + 120, p.y - 60, Math.PI / 2, { color: '#3ca8a0' });
    G.cars.push(parked);
    for (let i = 0; i < 60; i++) G.step(1 / 60, {});
    G.renderFrame();
    window.__shotReady = true;
    return;
  }

  if (name === 'mission') {
    // Dockside Diplomacy mid-fight: Ledger crew shooting, player returning fire at dusk.
    G.dayTime = 0.7;
    p.x = 3 * TILE + 24; p.y = 19 * TILE + 24;
    p.weapon = 'pistol'; p.ammo = 36; p.armor = 40; p.health = 82; p.cash = 860;
    p.angle = -Math.PI / 2;
    G.missions.objective = 'Take down the Ledger crew (3 left)';
    for (let i = 0; i < 3; i++) {
      const e = G.combat.spawnEnemy(G, p.x + (i - 1) * 62, p.y - 105 - i * 18);
      e.aggro = true;
    }
    const van = makeCar(G.rng, p.x + 170, p.y - 40, 0.4, { color: '#2f2f36', model: { name: 'Dockside Van', top: 330, accel: 270, grip: 5.2 } });
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
