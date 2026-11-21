// Solmaris Heat — main: game state, input, loop, camera, shops, screens, boot.
// An original open-world crime game: the bay city of Solmaris, fixer Dario Quint,
// courier-turned-wheelman Mara Voss, and the Ledger crew who want the docks.
import { TILE, GRID, WORLD, VIEW_W, VIEW_H, DAY_LENGTH, TRAFFIC } from './config.js';
import { makeRng } from './random.js';
import { buildCity, collideCircle, randomRoadPoint, tileKindAt, TILE_KIND } from './city.js';
import { makeCar, updateTrafficCar, carSpeed } from './vehicles.js';
import { makePlayer, updatePlayer, nearestCar, enterCar, exitCar } from './player.js';
import { spawnPeds, updatePed, maintainPeds } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import { createSave, loadSettings, storeSettings } from './save.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = createRenderer(canvas);
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '7', 10) || 7;

const G = {
  rng: makeRng(seed),
  city: null,
  player: null,
  cars: [],
  peds: [],
  particles: [],
  skids: [],
  police: createPolice(),
  combat: createCombat(),
  missions: createMissions(),
  audio: createAudio(),
  save: createSave(),
  hud: createHud(),
  settings: loadSettings(),
  state: 'title',
  time: 0,
  dayTime: 0.35,
  camera: { x: 0, y: 0 },
  fx: { shake: 0, hurtFlash: 0, lastShotAt: -10 },
  input: { up: false, down: false, left: false, right: false, sprint: false, handbrake: false, aiming: false, mouseX: VIEW_W / 2, mouseY: VIEW_H / 2, mouseDown: false },
  stats: { carsStolen: 0, missionsDone: 0, taxiFares: 0, pedsDown: 0, enemiesDown: 0, shotsFired: 0, packages: 0, busted: 0, wasted: 0 },
  downTimer: 0,
};

G.city = buildCity(G.rng);
G.player = makePlayer(G.city.places.spawn.x, G.city.places.spawn.y);
G.camera.x = G.player.x - VIEW_W / 2;
G.camera.y = G.player.y - VIEW_H / 2;
G.save.bind(G);

// Helpers other modules expect on G.
G.collide = (e, r) => collideCircle(G.city, e, r);
G.pointInBuilding = (x, y) => G.city.buildings.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
G.screenToWorld = (sx, sy) => ({ x: sx + G.camera.x, y: sy + G.camera.y });
G.onPlayerCarHit = (other) => {
  if (other.isPolice) G.police.addCrime(G, 'hitCop');
};
G.renderFrame = () => { renderer.render(G); G.hud.update(G, 0); };
G.onBusted = () => goDown('BUSTED', 'The Solmaris PD got you. Bail and fines paid.');
G.onWasted = (cause) => goDown('WASTED', cause ? `Taken out: ${cause}. The clinic patched you up.` : 'The clinic patched you up.');

function goDown(word, sub) {
  if (G.state === 'down') return;
  G.state = 'down';
  G.downTimer = 2.6;
  const p = G.player;
  if (word === 'BUSTED') { G.stats.busted++; p.cash = Math.max(0, p.cash - 150); }
  else { G.stats.wasted++; p.cash = Math.max(0, p.cash - 100); }
  if (G.missions.active) G.missions.fail(G, word === 'BUSTED' ? 'You were busted' : 'You were wasted');
  document.getElementById('down-word').textContent = word;
  document.getElementById('down-sub').textContent = sub;
  document.getElementById('screen-down').classList.remove('hidden');
  G.audio.busted();
  G.audio.engineStop();
  G.audio.sirenStop();
}

function respawn() {
  const p = G.player;
  const word = document.getElementById('down-word').textContent;
  const spot = word === 'BUSTED' ? G.city.places.precinct : G.city.places.clinic;
  if (p.car) { p.car.driver = 'none'; p.car = null; }
  p.mode = 'foot';
  p.x = spot.x; p.y = spot.y; p.vx = 0; p.vy = 0;
  p.health = 100; p.dead = false;
  G.police.clear(G, true);
  G.camera.x = p.x - VIEW_W / 2;
  G.camera.y = p.y - VIEW_H / 2;
  document.getElementById('screen-down').classList.add('hidden');
  G.state = 'play';
  G.hud.message(word === 'BUSTED' ? 'Released from the precinct. Stay clean… or don\'t.' : 'Back on your feet.', 3.5);
}

// ---------- World population ----------
function spawnTraffic() {
  const p = G.player;
  for (let i = 0; i < TRAFFIC.count; i++) {
    const spot = randomRoadPoint(G.city, G.rng, p.x, p.y, 200);
    const from = G.city.nodes[spot.from], to = G.city.nodes[spot.to];
    const car = makeCar(G.rng, spot.x, spot.y, Math.atan2(to.y - from.y, to.x - from.x), {
      driver: 'traffic', nodeFrom: spot.from, nodeTo: spot.to,
    });
    G.cars.push(car);
  }
  // Parked cars along avenues.
  for (let i = 0; i < 14; i++) {
    const spot = randomRoadPoint(G.city, G.rng, p.x, p.y, 120);
    const car = makeCar(G.rng, spot.x + 16, spot.y, (i % 4) * Math.PI / 2, {});
    G.cars.push(car);
  }
}

function maintainTraffic() {
  const p = G.player;
  let traffic = G.cars.filter((c) => c.driver === 'traffic');
  for (const car of traffic) {
    if (Math.hypot(car.x - p.x, car.y - p.y) > 1050) {
      const spot = randomRoadPoint(G.city, G.rng, p.x, p.y, 520);
      const from = G.city.nodes[spot.from], to = G.city.nodes[spot.to];
      car.x = spot.x; car.y = spot.y; car.vx = 0; car.vy = 0;
      car.angle = Math.atan2(to.y - from.y, to.x - from.x);
      car.nodeFrom = spot.from; car.nodeTo = spot.to;
      car.health = 100; car.dead = false;
    }
  }
}

// ---------- Shops & prompts ----------
function updateShopsAndPrompts(dt) {
  const p = G.player;
  const P = G.city.places;
  let prompt = null;

  if (p.mode === 'foot') {
    const car = nearestCar(G, 46);
    if (car) prompt = `<b>E</b> — ${car.driver === 'traffic' ? 'steal' : 'drive'} ${car.model.name}`;
    if (Math.hypot(p.x - P.gunshop.x, p.y - P.gunshop.y) < 52) {
      prompt = p.weapon === 'pistol'
        ? '<b>E</b> — Iron & Oak: ammo + armor ($120)'
        : '<b>E</b> — Iron & Oak: buy pistol ($250)';
    } else if (Math.hypot(p.x - P.clinic.x, p.y - P.clinic.y) < 52) {
      prompt = '<b>E</b> — Clinic: full heal ($50)';
    } else if (Math.hypot(p.x - P.safehouse.x, p.y - P.safehouse.y) < 52) {
      prompt = '<b>E</b> — Safehouse: save game';
    } else if (Math.hypot(p.x - P.fixer.x, p.y - P.fixer.y) < 52 && !G.missions.active && !G.missions.storyDone()) {
      prompt = `<b>E</b> — Talk to Dario: ${G.missions.nextTitle()}`;
    }
  } else if (p.mode === 'car') {
    prompt = '<b>E</b> — get out';
    if (Math.hypot(p.x - P.respray.x, p.y - P.respray.y) < 64) {
      prompt = G.police.stars > 0 ? '<b>E</b> — Chop & Shine respray ($100, clears heat)' : '<b>E</b> — Chop & Shine: repair ($60)';
    }
  }
  G.hud.prompt(prompt);
}

function interact() {
  const p = G.player;
  const P = G.city.places;
  if (G.state !== 'play') return;
  if (p.mode === 'car') {
    if (Math.hypot(p.x - P.respray.x, p.y - P.respray.y) < 64) {
      if (G.police.stars > 0 && p.cash >= 100) {
        p.cash -= 100;
        p.car.color = ['#3c6dc8', '#e0a83c', '#4fae62', '#d8d8dc'][Math.floor(Math.random() * 4)];
        p.car.health = 100;
        G.police.clear(G);
        G.hud.message('Resprayed. New colour, no heat.', 3);
        G.audio.pickup();
      } else if (p.cash >= 60) {
        p.cash -= 60;
        p.car.health = 100;
        G.hud.message('Repaired and polished.', 3);
        G.audio.pickup();
      } else G.hud.message('Not enough cash.', 2);
      return;
    }
    exitCar(G);
    G.audio.engineStop();
    return;
  }
  // On foot interactions, nearest first.
  if (Math.hypot(p.x - P.gunshop.x, p.y - P.gunshop.y) < 52) {
    if (p.weapon !== 'pistol') {
      if (p.cash >= 250) { p.cash -= 250; p.weapon = 'pistol'; p.ammo = 60; G.hud.message('Pistol acquired. Click to shoot.', 3.5); G.audio.pickup(); }
      else G.hud.message('Pistol costs $250.', 2);
    } else if (p.cash >= 120) {
      p.cash -= 120; p.ammo += 60; p.armor = Math.min(100, p.armor + 60);
      G.hud.message('Ammo + armor restocked.', 3); G.audio.pickup();
    } else G.hud.message('Ammo + armor costs $120.', 2);
    return;
  }
  if (Math.hypot(p.x - P.clinic.x, p.y - P.clinic.y) < 52) {
    if (p.cash >= 50) { p.cash -= 50; p.health = 100; G.hud.message('Patched up.', 2.5); G.audio.pickup(); }
    else G.hud.message('Treatment costs $50.', 2);
    return;
  }
  if (Math.hypot(p.x - P.safehouse.x, p.y - P.safehouse.y) < 52) {
    G.hud.message(G.save.save(G) ? 'Game saved.' : 'Save failed.', 2.5);
    G.audio.pickup();
    return;
  }
  if (Math.hypot(p.x - P.fixer.x, p.y - P.fixer.y) < 52 && !G.missions.active && !G.missions.storyDone()) {
    G.missions.startStory(G);
    return;
  }
  const car = nearestCar(G, 46);
  if (car) {
    enterCar(G, car);
    G.audio.engineStart();
  }
}

// ---------- Simulation step (shared by the live loop and screenshot scenes) ----------
G.step = function step(dt, scripted = {}) {
  G.time += dt;
  G.dayTime = (G.dayTime + dt / DAY_LENGTH) % 1;
  const input = { ...G.input, ...scripted };
  if (scripted.steerBias !== undefined) {
    input.left = scripted.steerBias < -0.05;
    input.right = scripted.steerBias > 0.05;
  }

  if (G.state === 'down') {
    G.downTimer -= dt;
    if (G.downTimer <= 0) respawn();
    return;
  }
  if (G.state !== 'play') return;

  updatePlayer(G, input, dt);
  if (scripted.shoot || (G.input.mouseDown && G.player.mode === 'foot')) G.combat.shoot(G);
  for (const car of G.cars) {
    if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
  }
  maintainTraffic();
  for (const ped of G.peds) updatePed(G, ped, dt);
  maintainPeds(G);
  G.police.update(G, dt);
  G.combat.update(G, dt);
  G.missions.update(G, dt);
  updateShopsAndPrompts(dt);

  // Engine sound follows the player's car.
  if (G.player.mode === 'car') G.audio.engineSet(Math.abs(G.player.car.speed) / G.player.car.model.top);

  // Skid marks while drifting.
  const p = G.player;
  if (p.mode === 'car' && Math.abs(p.car.speed) > 150) {
    const f = { x: Math.cos(p.car.angle), y: Math.sin(p.car.angle) };
    const lat = Math.abs(p.car.vx * -f.y + p.car.vy * f.x);
    if (lat > 55 || input.handbrake) {
      G.skids.push({ x1: p.car.x - f.x * 14, y1: p.car.y - f.y * 14, x2: p.car.x - f.x * 20, y2: p.car.y - f.y * 20 });
      if (G.skids.length > 400) G.skids.splice(0, 40);
    }
  }

  // Particles
  for (const pt of G.particles) {
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.kind === 'smoke') pt.vy -= 12 * dt;
  }
  G.particles = G.particles.filter((pt) => pt.t < pt.life);
  G.fx.hurtFlash = Math.max(0, G.fx.hurtFlash - dt);

  // Camera: smooth follow with velocity lookahead + shake.
  const look = p.mode === 'car' ? 0.55 : 0.25;
  const tx = p.x + p.vx * look - VIEW_W / 2;
  const ty = p.y + p.vy * look - VIEW_H / 2;
  const k = 1 - Math.pow(0.0015, dt);
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
  G.camera.x = Math.max(0, Math.min(WORLD - VIEW_W, G.camera.x));
  G.camera.y = Math.max(0, Math.min(WORLD - VIEW_H, G.camera.y));
  if (G.settings.shake && G.fx.shake > 0.1) {
    G.camera.x += (Math.random() - 0.5) * G.fx.shake;
    G.camera.y += (Math.random() - 0.5) * G.fx.shake;
    G.fx.shake *= Math.pow(0.001, dt);
  } else G.fx.shake = 0;
};

// ---------- Input ----------
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'handbrake',
};
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { G.input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === 'KeyE' && !e.repeat) interact();
  if (e.code === 'KeyF' && !e.repeat) G.combat.punch(G);
  if (e.code === 'KeyM' && !e.repeat) toggleMap();
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) togglePause();
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code]) G.input[KEYMAP[e.code]] = false;
});
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  G.input.mouseX = (e.clientX - r.left) * (VIEW_W / r.width);
  G.input.mouseY = (e.clientY - r.top) * (VIEW_H / r.height);
  G.input.aiming = true;
});
canvas.addEventListener('mousedown', () => { G.input.mouseDown = true; G.audio.unlock(); });
window.addEventListener('mouseup', () => { G.input.mouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Screens ----------
const screens = {
  start: document.getElementById('screen-start'),
  howto: document.getElementById('screen-howto'),
  settings: document.getElementById('screen-settings'),
  pause: document.getElementById('screen-pause'),
  map: document.getElementById('screen-map'),
};
let settingsReturn = 'start';

function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
  if (!name) for (const el of Object.values(screens)) el.classList.add('hidden');
}

function startPlay(fresh) {
  if (fresh) {
    const p = G.player;
    p.x = G.city.places.spawn.x; p.y = G.city.places.spawn.y;
    p.health = 100; p.armor = 0; p.cash = 120; p.weapon = 'fists'; p.ammo = 0;
    p.mode = 'foot'; p.car = null; p.dead = false;
    G.missions.storyIndex = 0;
    G.missions.active = null;
    G.missions.objective = '';
    G.stats = { carsStolen: 0, missionsDone: 0, taxiFares: 0, pedsDown: 0, enemiesDown: 0, shotsFired: 0, packages: 0, busted: 0, wasted: 0 };
    G.police.clear(G, true);
    G.camera.x = p.x - VIEW_W / 2; G.camera.y = p.y - VIEW_H / 2;
  }
  G.state = 'play';
  showScreen(null);
  G.hud.show();
  G.audio.unlock();
  G.audio.musicStart();
  G.hud.message('Welcome to Solmaris, Mara.\nSee Dario Quint (yellow marker) for work.', 5);
}

function togglePause() {
  if (G.state === 'play') {
    G.state = 'pause';
    const p = G.player;
    document.getElementById('pause-stats').innerHTML =
      `Cash $${Math.floor(p.cash)} · Jobs done ${G.stats.missionsDone}/6 · Cars stolen ${G.stats.carsStolen}<br>` +
      `Taxi fares ${G.stats.taxiFares} · Hidden packages ${G.stats.packages}/10 · Busted ${G.stats.busted} · Wasted ${G.stats.wasted}`;
    showScreen('pause');
  } else if (G.state === 'pause') {
    G.state = 'play';
    showScreen(null);
  }
}

function toggleMap() {
  if (G.state === 'play') {
    G.state = 'map';
    G.hud.drawBigMap(G);
    showScreen('map');
  } else if (G.state === 'map') {
    G.state = 'play';
    showScreen(null);
  }
}

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    G.audio.unlock();
    G.audio.click();
    const a = btn.dataset.action;
    if (a === 'new') startPlay(true);
    else if (a === 'continue') { if (G.save.load(G)) startPlay(false); }
    else if (a === 'howto') showScreen('howto');
    else if (a === 'settings') { settingsReturn = G.state === 'pause' ? 'pause' : 'start'; showScreen('settings'); }
    else if (a === 'back') showScreen(settingsReturn);
    else if (a === 'resume') togglePause();
    else if (a === 'save') { G.hud.message(G.save.save(G) ? 'Game saved.' : 'Save failed.', 2.5); togglePause(); }
    else if (a === 'load') { if (G.save.load(G)) { G.state = 'play'; showScreen(null); G.hud.message('Game loaded.', 2.5); } }
    else if (a === 'quit') { G.state = 'title'; G.hud.hide(); showScreen('start'); refreshContinue(); }
    else if (a === 'closemap') toggleMap();
  });
});

function refreshContinue() {
  document.getElementById('btn-continue').disabled = !G.save.hasSave();
}

// Settings wiring
const setMusic = document.getElementById('set-music');
const setSfx = document.getElementById('set-sfx');
const setMinimap = document.getElementById('set-minimap');
const setShake = document.getElementById('set-shake');
setMusic.value = Math.round(G.settings.music * 100);
setSfx.value = Math.round(G.settings.sfx * 100);
setMinimap.checked = G.settings.minimap;
setShake.checked = G.settings.shake;
function applySettings() {
  G.settings.music = setMusic.value / 100;
  G.settings.sfx = setSfx.value / 100;
  G.settings.minimap = setMinimap.checked;
  G.settings.shake = setShake.checked;
  G.audio.setVolumes(G.settings.music, G.settings.sfx);
  storeSettings(G.settings);
}
for (const el of [setMusic, setSfx, setMinimap, setShake]) el.addEventListener('input', applySettings);

// ---------- Boot ----------
spawnTraffic();
spawnPeds(G, 22);
G.combat.scatterPackages(G);
refreshContinue();

const shot = params.get('shot');
if (shot) {
  setupShot(G, shot);
} else {
  // Title backdrop: slow pan over downtown.
  G.state = 'title';
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.state === 'title') {
      G.time += dt;
      G.dayTime = (G.dayTime + dt / DAY_LENGTH) % 1;
      G.camera.x = 8 * TILE + Math.sin(G.time * 0.05) * 3 * TILE;
      G.camera.y = 8 * TILE + Math.cos(G.time * 0.04) * 3 * TILE;
      for (const car of G.cars) if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
      for (const ped of G.peds) updatePed(G, ped, dt);
      renderer.render(G);
    } else if (G.state === 'play' || G.state === 'down') {
      G.step(dt);
      renderer.render(G);
      G.hud.update(G, dt);
    } else {
      renderer.render(G);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
