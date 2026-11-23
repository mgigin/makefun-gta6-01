// The whole game state in one object: the city, the player, every car and
// pedestrian on the street, the wanted level, the story's progress and the
// weather. Systems receive this object and mutate their own corner of it.

import { buildCity } from './city.js';
import { makeRng } from './rng.js';

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  PAUSE: 'pause',
  MAP: 'map',
  DOWN: 'down',
  HOWTO: 'howto',
  SETTINGS: 'settings',
};

export function freshPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    angle: Math.PI / 2, // facing
    aim: Math.PI / 2,
    r: 10,
    hp: 100, maxHp: 100,
    armor: 0, maxArmor: 100,
    stamina: 1,
    inCar: null,
    weapon: 'fists',
    owned: { fists: true, pistol: false, smg: false, scattergun: false, rifle: false },
    ammo: { pistol: 0, smg: 0, scattergun: 0, rifle: 0 },
    fireCd: 0,
    punchCd: 0,
    hurtFlash: 0,
    dead: false,
    shirt: '#22303c',
    skin: '#e0ac69',
  };
}

export function createGame(seed) {
  const rng = makeRng(seed);
  const city = buildCity(rng);
  const start = city.pois.safehouse;
  const game = {
    seed,
    rng,
    city,
    time: 0,
    clockMin: 8 * 60 + 5, // 08:05
    screen: SCREEN.TITLE,
    screenFrom: SCREEN.TITLE,
    frozen: false, // screenshot scenes set this once staged
    player: freshPlayer(start.x, start.y + 30),
    cars: [],
    peds: [],
    bullets: [],
    pendingShots: [],
    lastShotAt: -99,
    particles: [],
    skids: [],
    pickups: [],
    spikes: [],
    heli: null,
    cash: 250,
    wanted: { heat: 0, stars: 0, seen: false, cool: 0, bust: 0, lastCrimeAt: -99 },
    story: { index: 0, active: null, completed: [] },
    side: { taxi: null, race: null, packages: [] },
    weather: { rain: 0, target: 0, nextChange: 240 },
    camera: { x: start.x, y: start.y, shake: 0 },
    stats: { stolen: 0, fares: 0, racesWon: 0, packages: 0, busted: 0, wasted: 0, missions: 0 },
    settings: { music: 0.6, sfx: 0.8, minimap: true, shake: true },
    message: null,
    feed: [],
    toast: null,
    downInfo: null,
    nextCarId: 1,
    nextPedId: 1,
  };
  return game;
}

/** Put a short line in the message feed (bottom-left, fades on its own). */
export function feed(game, text) {
  game.feed.push({ text, at: game.time });
  if (game.feed.length > 5) game.feed.shift();
}

/** The big centre-screen banner (mission names, "BUSTED" warnings, …). */
export function showMessage(game, text, sub = '', seconds = 3.2) {
  game.message = { text, sub, until: game.time + seconds };
}

/** A small reward toast ("+$150 — First Wheels complete"). */
export function showToast(game, text) {
  game.toast = { text, until: game.time + 3.6 };
}

export function addCash(game, amount, why) {
  game.cash = Math.max(0, game.cash + amount);
  if (why) showToast(game, `${amount >= 0 ? '+' : '−'}$${Math.abs(amount)} — ${why}`);
}

/** Where the player currently is, in a car or on foot. */
export function playerPos(game) {
  const p = game.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

export function playerSpeed(game) {
  const p = game.player;
  if (p.inCar) return Math.abs(p.inCar.speed);
  return Math.hypot(p.vx, p.vy);
}
