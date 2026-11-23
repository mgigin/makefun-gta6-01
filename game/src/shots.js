// The screenshot scenes behind ?shot=chase|onfoot|mission|start. Each one
// builds a real moment of play — a four-star chase with the helicopter up, a
// morning on foot in the Old Market, a street race in the rain, the title
// over the bay — then lets the ordinary simulation run it forward under a
// simple autopilot, so the frame is what the game really looks like and the
// same seed always gives the same frame.

import { makeCar } from './vehicles.js';
import { startMission, startRace, roadTargetToward } from './missions.js';
import { makePed } from './peds.js';
import { setSceneWeather } from './weather.js';
import { SCREEN } from './state.js';
import { clamp, angleDiff, range } from './rng.js';

export const SHOT_NAMES = ['chase', 'onfoot', 'mission', 'start'];

function placePlayerInCar(game, modelIndex, x, y, angle) {
  const car = makeCar(game, modelIndex, x, y, angle, { kind: 'player' });
  game.player.inCar = car;
  game.player.x = x;
  game.player.y = y;
  game.camera.x = x;
  game.camera.y = y;
  return car;
}

/** Set the world up for a named scene. Returns the screen to show. */
export function stageShot(game, name) {
  const city = game.city;
  game.screen = SCREEN.PLAY;
  game.player.owned.pistol = true;
  game.player.ammo.pistol = 60;
  game.player.owned.scattergun = true;
  game.player.ammo.scattergun = 24;
  game.player.weapon = 'scattergun';
  game.cash = 1240;

  // A little street life near the action, so the frame feels inhabited.
  const seedCrowd = (cx, cy, n) => {
    for (let i = 0; i < n; i += 1) {
      makePed(game, cx + range(game.rng, -260, 260), cy + range(game.rng, -180, 180));
    }
  };

  if (name === 'start') {
    setSceneWeather(game, 18 * 60 + 55, 0);
    const downtown = city.pois.gunshop;
    game.camera.x = downtown.x;
    game.camera.y = downtown.y + 120;
    game.player.x = downtown.x;
    game.player.y = downtown.y + 200;
    return SCREEN.TITLE;
  }

  if (name === 'onfoot') {
    setSceneWeather(game, 9 * 60 + 30, 0);
    const market = city.pois.garage;
    game.player.x = market.x - 46;
    game.player.y = market.y + 14;
    game.player.angle = 0.4;
    game.player.aim = 0.4;
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    seedCrowd(game.player.x, game.player.y, 10);
    return SCREEN.PLAY;
  }

  if (name === 'mission') {
    setSceneWeather(game, 16 * 60 + 40, 0.75);
    const meet = city.pois.racemeet;
    const car = placePlayerInCar(game, 6, meet.x - 10, meet.y + 40, -Math.PI / 2);
    car.speed = 200;
    startRace(game, { story: true });
    game.story.active = null; // the race alone carries the frame
    // Stagger the rivals up the road ahead so the pack reads at a glance.
    game.side.race.rivals.forEach((rival, i) => {
      rival.x = meet.x - 10 + (i - 1) * 26;
      rival.y = meet.y - 70 - i * 85;
      rival.angle = -Math.PI / 2;
      rival.speed = 190;
    });
    return SCREEN.PLAY;
  }

  // chase (default): four stars at dusk, cruisers closing, helicopter up.
  setSceneWeather(game, 19 * 60 + 5, 0);
  const downtown = city.pois.gunshop;
  const car = placePlayerInCar(game, 7, downtown.x - 160, downtown.y + 6, 0);
  car.speed = 300;
  game.wanted.heat = 4.2;
  game.wanted.lastCrimeAt = game.time;
  startMission(game); // objective line + marker on the HUD
  seedCrowd(downtown.x, downtown.y, 8);
  // Cruisers already on the player's tail, so the frame is a chase, not a queue.
  for (const [dx, dy] of [[-210, -26], [-290, 24], [-390, -4]]) {
    const cruiser = makeCar(game, 0, car.x + dx, car.y + dy, 0, {
      police: true, kind: 'police',
      ai: { stuck: 0, reverse: 0, roadblock: false },
    });
    cruiser.speed = 295;
  }
  return SCREEN.PLAY;
}

/** How long each scene simulates before the frame is frozen. */
export function shotSeconds(name) {
  if (name === 'chase') return 1.9;
  if (name === 'mission') return 4.5;
  if (name === 'onfoot') return 1.8;
  return 2.5;
}

function driveToward(game, input, tx, ty) {
  const car = game.player.inCar;
  if (!car) return;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  input.pressedUp = true;
  input.up = true;
  input.left = diff < -0.06;
  input.right = diff > 0.06;
  input.handbrake = Math.abs(diff) > 1.9;
}

/** Fill a scripted input for one tick of a staged scene. */
export function shotInput(game, name, input) {
  const p = game.player;
  if (name === 'onfoot') {
    // Stroll west into the market streets, scattergun in hand.
    input.left = true;
    input.sprint = false;
    p.aim = Math.PI + 0.3;
    return;
  }
  if (name === 'mission' && game.side.race) {
    const cp = game.side.race.checkpoints[game.side.race.next];
    if (cp && p.inCar) {
      const t = roadTargetToward(game, p.inCar.x, p.inCar.y, cp.x, cp.y);
      driveToward(game, input, t.x, t.y);
    }
    return;
  }
  if (name === 'chase' && p.inCar) {
    // Run for the pier along the streets, weaving gently so the cruisers
    // have to work for their ram.
    const car = p.inCar;
    const pier = game.city.pois.marina;
    const t = roadTargetToward(game, car.x, car.y, pier.x, pier.y);
    const weave = Math.sin(game.time * 0.9) * 10;
    driveToward(game, input, t.x + weave, t.y + weave);
    return;
  }
  void clamp;
}
