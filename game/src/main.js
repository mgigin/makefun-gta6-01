// Solmaris Heat — boot and main loop. Wires the simulation modules together:
// input in, one fixed-step tick of city life, DOM HUD and canvas out. Also
// handles the ?shot= screenshot scenes and the title screen's living backdrop.

import { createGame, SCREEN, feed, showMessage, playerPos, addCash } from './state.js';
import { createInput, clearTransient, wasPressed, scriptedInput } from './input.js';
import { stepPlayerOnFoot, stepPlayerDriving, nearestEnterableCar, enterCar, exitCar, nearbyService, stepCarEffects } from './player.js';
import { stepTrafficCar, maintainTraffic, seedParkedCars, collideCars } from './vehicles.js';
import { stepPed, maintainPeds } from './peds.js';
import { stepWanted, reportCrime, clearWanted } from './police.js';
import { playerFire, stepBullets, explodeCar } from './combat.js';
import { stepMission, startMission, failMission, startTaxiFare, stepTaxi, taxiMarker, startRace, stepRace, seedPackages, stepPackages, missionMarker } from './missions.js';
import { stepWeather, gripMultiplier } from './weather.js';
import { renderWorld } from './render.js';
import { grabHud, showScreen, updateHud, drawBigMap, pauseStatsHtml } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadSave, hasSave, applySave } from './save.js';
import { stageShot, shotInput, shotSeconds } from './shots.js';
import { WEAPONS, WEAPON_ORDER, PRICES, VIEW } from './data.js';
import { clamp } from './rng.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 20261123;
const shotName = params.get('shot');

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const game = createGame(seed);
game.audio = createAudio(game);
game.onCrime = (kind) => reportCrime(game, kind);
game.onExplode = (car) => explodeCar(game, car);
game.onSpikes = () => feed(game, 'Spike strip! Your tires are shredded');

seedParkedCars(game);
seedPackages(game);

const hud = grabHud();
const input = createInput(canvas);
let downTimer = 0;
let downKind = null;

function currentPrompt() {
  const p = game.player;
  if (game.screen !== SCREEN.PLAY) return '';
  const service = nearbyService(game);
  if (!p.inCar) {
    const car = nearestEnterableCar(game);
    if (car) return `E — ${car.kind === 'parked' ? 'Take' : 'Steal'} the ${car.model.name}`;
    if (service) {
      if (service.kind === 'giver') return game.story.active ? '' : 'E — Take Dario’s job';
      if (service.kind === 'shop') return 'E — Buy at Iron & Oak';
      if (service.kind === 'hospital') return `E — Patch up ($${PRICES.hospitalFee})`;
      if (service.kind === 'safehouse') return 'E — Rest & save';
      if (service.kind === 'race') return `E — Enter the street race ($${PRICES.raceEntry})`;
    }
    return '';
  }
  if (service && service.kind === 'respray') return `E — Respray & lose the heat ($${PRICES.respray})`;
  if (p.inCar.model.id === 'taxi' && !game.side.taxi) return 'T — Start a fare · E — Get out';
  return 'E — Get out';
}

function buyAtGunshop() {
  const p = game.player;
  for (const id of ['pistol', 'smg', 'scattergun', 'rifle']) {
    if (!p.owned[id]) {
      const w = WEAPONS[id];
      if (game.cash >= w.price) {
        game.cash -= w.price;
        p.owned[id] = true;
        p.ammo[id] = 40;
        p.weapon = id;
        feed(game, `Bought the ${w.name}`);
        game.audio.cash();
      } else {
        feed(game, `The ${w.name} costs $${w.price}`);
      }
      return;
    }
  }
  const w = WEAPONS[p.weapon];
  if (p.weapon !== 'fists' && game.cash >= w.ammoPrice) {
    game.cash -= w.ammoPrice;
    p.ammo[p.weapon] += 60;
    feed(game, `${w.name} ammo +60`);
    game.audio.cash();
  } else if (p.armor < p.maxArmor && game.cash >= PRICES.armor) {
    game.cash -= PRICES.armor;
    p.armor = p.maxArmor;
    feed(game, 'Armor fitted');
    game.audio.cash();
  } else {
    feed(game, 'Nothing you need right now');
  }
}

function handleInteract() {
  const p = game.player;
  if (wasPressed(input, 'KeyE')) {
    if (p.inCar) {
      const service = nearbyService(game);
      if (service && service.kind === 'respray') {
        if (game.cash >= PRICES.respray) {
          game.cash -= PRICES.respray;
          clearWanted(game);
          p.inCar.hp = p.inCar.maxHp;
          p.inCar.tires = 4;
          feed(game, 'Fresh paint, clean record');
          game.audio.cash();
        } else {
          feed(game, `A respray costs $${PRICES.respray}`);
        }
      } else {
        exitCar(game);
      }
    } else {
      const car = nearestEnterableCar(game);
      if (car) {
        enterCar(game, car);
        return;
      }
      const service = nearbyService(game);
      if (service) {
        if (service.kind === 'giver') startMission(game);
        else if (service.kind === 'shop') buyAtGunshop();
        else if (service.kind === 'hospital') {
          if (game.cash >= PRICES.hospitalFee) {
            game.cash -= PRICES.hospitalFee;
            p.hp = p.maxHp;
            feed(game, 'Patched up at St. Aurelia');
          } else feed(game, `Treatment costs $${PRICES.hospitalFee}`);
        } else if (service.kind === 'safehouse') {
          p.hp = p.maxHp;
          saveGame(game);
          feed(game, 'Rested. Game saved.');
        } else if (service.kind === 'race') startRace(game);
      }
    }
  }
  if (wasPressed(input, 'KeyT') && p.inCar && p.inCar.model.id === 'taxi') {
    startTaxiFare(game);
  }
  if (wasPressed(input, 'KeyQ')) {
    const owned = WEAPON_ORDER.filter((id) => p.owned[id]);
    const idx = owned.indexOf(p.weapon);
    p.weapon = owned[(idx + 1) % owned.length];
    feed(game, WEAPONS[p.weapon].name);
  }
}

function goDown(kind) {
  if (game.screen === SCREEN.DOWN) return;
  downKind = kind;
  downTimer = 3.4;
  game.screen = SCREEN.DOWN;
  failMission(game, kind === 'busted' ? 'You were busted' : 'You were wasted');
  if (game.side.race) game.side.race = null;
  if (kind === 'busted') {
    game.stats.busted += 1;
    addCash(game, -PRICES.bustFine, 'Fine paid');
  } else {
    game.stats.wasted += 1;
    addCash(game, -PRICES.hospitalFee, 'Hospital bill');
  }
  hud.downWord.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  hud.downSub.textContent = kind === 'busted'
    ? 'The Solmaris PD took your cash and your guns. Dario is not impressed.'
    : 'You wake up at St. Aurelia with a bill and a headache.';
  showScreen(hud, 'down');
  game.audio.missionFail();
}

function respawn() {
  const p = game.player;
  const spot = downKind === 'busted' ? game.city.pois.police : game.city.pois.hospital;
  if (p.inCar) exitCar(game);
  p.x = spot.x;
  p.y = spot.y + 24;
  p.hp = p.maxHp;
  p.armor = 0;
  p.dead = false;
  p.weapon = 'fists';
  for (const id of Object.keys(p.owned)) p.owned[id] = id === 'fists';
  for (const id of Object.keys(p.ammo)) p.ammo[id] = 0;
  clearWanted(game);
  game.camera.x = p.x;
  game.camera.y = p.y;
  game.screen = SCREEN.PLAY;
  showScreen(hud, 'play');
}

/** One simulation tick. `inp` is the real input or the shot autopilot's. */
function step(dt, inp, attract = false) {
  game.time += dt;
  stepWeather(game, dt);
  const grip = gripMultiplier(game);
  const pos = playerPos(game);
  maintainTraffic(game, pos.x, pos.y);
  maintainPeds(game, pos.x, pos.y);

  const p = game.player;
  if (!attract) {
    // Aim follows the mouse in world space.
    const mx = game.camera.x + (inp.mouseX - VIEW.width / 2);
    const my = game.camera.y + (inp.mouseY - VIEW.height / 2);
    p.aim = Math.atan2(my - p.y, mx - p.x);
    if (p.inCar) stepPlayerDriving(game, dt, inp, grip);
    else stepPlayerOnFoot(game, dt, inp);
    if (!p.inCar && p.weapon !== 'fists' && !p.dead) {
      const auto = WEAPONS[p.weapon].auto;
      if ((auto && inp.mouseDown) || inp.mouseClicked) playerFire(game);
    }
    if (!p.inCar && wasPressed(inp, 'KeyF')) {
      const prev = p.weapon;
      p.weapon = 'fists';
      playerFire(game);
      p.weapon = prev;
    }
  }

  for (const car of game.cars) {
    if (car.kind === 'traffic' && !car.dead) stepTrafficCar(game, car, dt, grip);
  }
  stepWanted(game, dt, grip);
  for (const ped of game.peds) stepPed(game, ped, dt);
  collideCars(game);
  stepBullets(game, dt);
  stepCarEffects(game, dt);
  if (!attract) {
    stepMission(game, dt, grip);
    stepTaxi(game, dt);
    stepRace(game, dt, grip);
    stepPackages(game);
  }

  // Camera: follow with a little velocity lead; shake decays.
  const lead = 0.35;
  const tx = pos.x + (p.inCar ? p.inCar.vx * lead : p.vx * lead);
  const ty = pos.y + (p.inCar ? p.inCar.vy * lead : p.vy * lead);
  const k = Math.min(1, dt * 5);
  game.camera.x += (tx - game.camera.x) * k;
  game.camera.y += (ty - game.camera.y) * k;
  game.camera.shake = Math.max(0, game.camera.shake - dt * 26);

  game.audio.update(dt);

  if (!attract && game.screen === SCREEN.PLAY) {
    if (p.dead) goDown('wasted');
    else if (game.wanted.bust >= 2) goDown('busted');
  }
}

function frameMarkers() {
  return {
    mission: missionMarker(game),
    taxi: taxiMarker(game),
    service: null,
  };
}

// ---- Screen flow ----------------------------------------------------------

function setScreen(name) {
  game.screen = name;
  showScreen(hud, name === SCREEN.PLAY ? 'play' : name);
  if (name === SCREEN.PAUSE) hud.pauseStats.innerHTML = pauseStatsHtml(game);
  if (name === SCREEN.MAP) drawBigMap(hud.bigmap, game);
  if (name === SCREEN.TITLE) hud.continueBtn.disabled = !hasSave();
}

function newGame() {
  const fresh = createGame(seed);
  fresh.audio = game.audio;
  fresh.onCrime = game.onCrime;
  fresh.onExplode = game.onExplode;
  fresh.onSpikes = game.onSpikes;
  Object.assign(game, fresh);
  seedParkedCars(game);
  seedPackages(game);
  setScreen(SCREEN.PLAY);
  showMessage(game, 'SOLMARIS HEAT', 'Dario has work for you — follow the yellow marker', 4);
}

function continueGame() {
  const data = loadSave();
  if (!data) return;
  newGame();
  applySave(game, data);
  showMessage(game, 'WELCOME BACK', 'Solmaris kept your seat warm', 3);
}

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    game.audio.unlock();
    game.audio.click();
    const action = btn.dataset.action;
    if (action === 'new') newGame();
    else if (action === 'continue') continueGame();
    else if (action === 'howto') { game.screenFrom = game.screen; setScreen(SCREEN.HOWTO); }
    else if (action === 'settings') { game.screenFrom = game.screen; setScreen(SCREEN.SETTINGS); }
    else if (action === 'back') setScreen(game.screenFrom === SCREEN.PAUSE ? SCREEN.PAUSE : SCREEN.TITLE);
    else if (action === 'resume') setScreen(SCREEN.PLAY);
    else if (action === 'save') { saveGame(game); feed(game, 'Game saved'); }
    else if (action === 'load') continueGame();
    else if (action === 'quit') setScreen(SCREEN.TITLE);
    else if (action === 'closemap') setScreen(SCREEN.PLAY);
  });
});

function bindSettings() {
  const music = document.getElementById('set-music');
  const sfx = document.getElementById('set-sfx');
  const minimap = document.getElementById('set-minimap');
  const shake = document.getElementById('set-shake');
  music.addEventListener('input', () => { game.settings.music = music.value / 100; game.audio.setVolumes(); });
  sfx.addEventListener('input', () => { game.settings.sfx = sfx.value / 100; game.audio.setVolumes(); });
  minimap.addEventListener('change', () => { game.settings.minimap = minimap.checked; });
  shake.addEventListener('change', () => { game.settings.shake = shake.checked; });
}
bindSettings();

// ---- Main loop ------------------------------------------------------------

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (shotName && game.frozen) {
    renderWorld(ctx, game, frameMarkers());
    updateHud(hud, game, '');
    return;
  }

  if (game.screen === SCREEN.PLAY) {
    game.audio.unlock();
    if (wasPressed(input, 'Escape') || wasPressed(input, 'KeyP')) setScreen(SCREEN.PAUSE);
    else if (wasPressed(input, 'KeyM')) setScreen(SCREEN.MAP);
    handleInteract();
    acc += frameDt;
    while (acc >= STEP) {
      step(STEP, input);
      acc -= STEP;
    }
  } else if (game.screen === SCREEN.TITLE) {
    // Attract mode: the city lives behind the title.
    acc += frameDt;
    while (acc >= STEP) {
      step(STEP, input, true);
      acc -= STEP;
    }
    const t = game.time * 0.05;
    game.camera.x = game.city.pois.gunshop.x + Math.cos(t) * 320;
    game.camera.y = game.city.pois.gunshop.y + Math.sin(t * 0.7) * 220;
  } else if (game.screen === SCREEN.DOWN) {
    downTimer -= frameDt;
    if (downTimer <= 0) respawn();
  } else if (game.screen === SCREEN.PAUSE) {
    if (wasPressed(input, 'Escape') || wasPressed(input, 'KeyP')) setScreen(SCREEN.PLAY);
  } else if (game.screen === SCREEN.MAP) {
    if (wasPressed(input, 'KeyM') || wasPressed(input, 'Escape')) setScreen(SCREEN.PLAY);
    drawBigMap(hud.bigmap, game);
  }

  renderWorld(ctx, game, frameMarkers());
  updateHud(hud, game, currentPrompt());
  clearTransient(input);
}

// ---- Boot -----------------------------------------------------------------

if (shotName) {
  const screen = stageShot(game, shotName);
  setScreen(screen === SCREEN.TITLE ? SCREEN.TITLE : SCREEN.PLAY);
  const inp = scriptedInput();
  const steps = Math.floor(shotSeconds(shotName) / STEP);
  for (let i = 0; i < steps; i += 1) {
    inp.pressedUp = false;
    inp.up = inp.down = inp.left = inp.right = false;
    shotInput(game, shotName, inp);
    step(STEP, inp, shotName === 'start');
  }
  game.frozen = true;
  window.__shotReady = true;
  window.__game = game;
} else {
  setScreen(SCREEN.TITLE);
  window.__game = game;
}
requestAnimationFrame(loop);
