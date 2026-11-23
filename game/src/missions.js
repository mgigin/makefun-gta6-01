// The story of Solmaris Heat: eight jobs for the fixer Dario Quint against
// the Ledger crew who run the docks, plus taxi fares, street races and hidden
// packages on the side. A mission is a list of stages; each stage knows its
// marker, its objective line and how it completes or fails.

import { makeCar, driveCar, collideCarWithCity } from './vehicles.js';
import { makePed } from './peds.js';
import { PRICES } from './data.js';
import { clamp, dist, dist2, angleDiff, range } from './rng.js';
import { feed, showMessage, showToast, addCash, playerPos } from './state.js';

function poi(game, id) {
  return game.city.pois[id];
}

// Stage targets are resolved against the generated city when a mission starts,
// so the same script works for every seed.
export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', reward: 150,
    brief: 'Dario needs a clean car. Take the marked sedan and bring it to his garage.',
    stages: [
      { type: 'goto', at: 'garage', text: 'Meet Dario at the garage', radius: 60 },
      { type: 'steal', at: 'police', model: 1, text: 'Steal the marked Marlin Sedan', tag: 'jobCar' },
      { type: 'deliver', at: 'garage', text: 'Deliver the sedan to Dario’s garage', radius: 70, tag: 'jobCar' },
    ],
  },
  {
    id: 'hot-delivery', title: 'Hot Delivery', reward: 300,
    brief: 'A package at the Old Market has to reach the docks before the tide turns.',
    stages: [
      { type: 'goto', at: 'garage', text: 'Pick up the job at the garage', radius: 60 },
      { type: 'pickup', at: 'gunshop', text: 'Collect the package in the Old Market', radius: 46 },
      { type: 'deliver', at: 'warehouse', text: 'Deliver it to the Ledger Warehouse', radius: 70, timer: 150 },
    ],
  },
  {
    id: 'tail-job', title: 'The Tail Job', reward: 400,
    brief: 'A Ledger courier is moving money. Follow him, don’t spook him.',
    stages: [
      { type: 'goto', at: 'garage', text: 'Get the courier’s description from Dario', radius: 60 },
      { type: 'follow', at: 'hospital', text: 'Tail the courier — stay in the pocket', seconds: 55 },
    ],
  },
  {
    id: 'dockside', title: 'Dockside Trouble', reward: 550,
    brief: 'The Ledger crew is muscling Dario’s dock. Send them home.',
    stages: [
      { type: 'goto', at: 'warehouse', text: 'Head to the Ledger Warehouse', radius: 80 },
      { type: 'kill', at: 'warehouse', count: 5, text: 'Clear the dock of Ledger gunmen' },
      { type: 'escape', at: 'safehouse', text: 'Lose the heat and get home', radius: 80 },
    ],
  },
  {
    id: 'getaway', title: 'Getaway Driver', reward: 700,
    brief: 'Dario’s crew just hit the Bay Trust. Be their wheelman.',
    stages: [
      { type: 'goto', at: 'police', text: 'Park outside the Bay Trust and wait for the crew', radius: 70 },
      { type: 'pickup', at: 'police', text: 'Pick up the crew — go!', radius: 60 },
      { type: 'escape', at: 'safehouse', text: 'Shake the police and reach the flat', radius: 80, heat: 3 },
    ],
  },
  {
    id: 'street-heat', title: 'Street Heat', reward: 800,
    brief: 'The Marina meet is where reputations are made. Win it for Dario.',
    stages: [
      { type: 'goto', at: 'racemeet', text: 'Get to the Marina Race Meet', radius: 70 },
      { type: 'race', text: 'Win the street race', laps: 1 },
    ],
  },
  {
    id: 'ledger-van', title: 'The Ledger Van', reward: 1000,
    brief: 'Tonight the Ledger moves its takings in an armored van. Stop it. Take it.',
    stages: [
      { type: 'intercept', at: 'respray', text: 'Stop the armored van', tag: 'van' },
      { type: 'pickup', followTag: 'van', text: 'Grab the takings', radius: 40 },
      { type: 'escape', at: 'marina', text: 'Escape to the Marina Pier', radius: 80, heat: 2 },
    ],
  },
  {
    id: 'final-score', title: 'The Final Score', reward: 1500,
    brief: 'Silas Ledger himself is moving the last of the money. End this.',
    stages: [
      { type: 'chase', at: 'warehouse', text: 'Run down Silas Ledger’s car', tag: 'boss' },
      { type: 'kill', at: 'warehouse', count: 4, text: 'Finish the crew at the warehouse' },
      { type: 'escape', at: 'marina', text: 'Get to the pier — the boat is waiting', radius: 80, heat: 3 },
    ],
  },
];

export function nextMissionDef(game) {
  return MISSIONS[game.story.index] || null;
}

export function startMission(game) {
  const def = nextMissionDef(game);
  if (!def || game.story.active) return false;
  game.story.active = {
    def, stage: 0, timer: 0, stageTime: 0,
    entities: {}, data: {},
  };
  showMessage(game, def.title, def.brief, 4.2);
  beginStage(game);
  return true;
}

function stageDef(game) {
  const a = game.story.active;
  return a ? a.def.stages[a.stage] : null;
}

function stagePoint(game, st) {
  if (st.followTag) {
    const car = game.story.active.entities[st.followTag];
    return car ? { x: car.x, y: car.y } : null;
  }
  if (st.at) {
    const p = poi(game, st.at);
    return { x: p.x, y: p.y };
  }
  return null;
}

export function missionMarker(game) {
  const a = game.story.active;
  if (!a) {
    const def = nextMissionDef(game);
    if (!def) return null;
    const g = poi(game, 'garage');
    return { x: g.x, y: g.y, label: def.title, giver: true };
  }
  const st = stageDef(game);
  if (st.type === 'race' && game.side.race) {
    const cp = game.side.race.checkpoints[game.side.race.next];
    return cp ? { x: cp.x, y: cp.y, label: 'Checkpoint' } : null;
  }
  const pt = stagePoint(game, st);
  return pt ? { x: pt.x, y: pt.y, label: st.text } : null;
}

export function missionObjective(game) {
  const a = game.story.active;
  if (!a) {
    const def = nextMissionDef(game);
    return def ? `New job: ${def.title} — see Dario at the garage` : '';
  }
  const st = stageDef(game);
  let text = st.text;
  if (a.timer > 0) text += ` · ${Math.ceil(a.timer)}s`;
  if (st.type === 'kill') {
    const left = game.peds.filter((p) => p.missionTag === 'killTarget' && !p.down).length;
    text += ` · ${left} left`;
  }
  if (st.type === 'follow' && a.data.progress !== undefined) {
    text += ` · ${Math.round(a.data.progress * 100)}%`;
  }
  return text;
}

function beginStage(game) {
  const a = game.story.active;
  const st = stageDef(game);
  a.stageTime = 0;
  a.timer = st.timer || 0;
  a.data = {};
  const pt = stagePoint(game, st);
  if (st.type === 'steal') {
    const car = makeCar(game, st.model ?? 1, pt.x + 30, pt.y + 20, 0, { kind: 'parked', missionTag: st.tag });
    a.entities[st.tag] = car;
  }
  if (st.type === 'kill') {
    for (let i = 0; i < (st.count || 4); i += 1) {
      const ang = (i / (st.count || 4)) * Math.PI * 2;
      makePed(game, pt.x + Math.cos(ang) * 90, pt.y + Math.sin(ang) * 90, { hostile: true, missionTag: 'killTarget' });
    }
  }
  if (st.type === 'follow') {
    const car = makeCar(game, 1, pt.x, pt.y, 0, { kind: 'mission', missionTag: 'courier' });
    car.ai = { axis: 'h', road: nearestRoadY(game, pt.y), dir: 1, cruise: 120, lastCross: '', honk: 0 };
    a.entities.courier = car;
    a.data.progress = 0;
    a.data.lost = 0;
    a.data.close = 0;
  }
  if (st.type === 'intercept') {
    const car = makeCar(game, 4, pt.x, pt.y, 0, { kind: 'mission', missionTag: st.tag, color: '#2e4053' });
    car.hp = car.maxHp = 220;
    car.ai = { axis: 'h', road: nearestRoadY(game, pt.y), dir: 1, cruise: 150, lastCross: '', honk: 0 };
    a.entities[st.tag] = car;
    a.data.stoppedFor = 0;
  }
  if (st.type === 'chase') {
    const car = makeCar(game, 7, pt.x, pt.y, 0, { kind: 'mission', missionTag: st.tag, color: '#111111' });
    car.ai = { flee: true, stuck: 0, reverse: 0 };
    a.entities[st.tag] = car;
  }
  if (st.type === 'escape' && st.heat) {
    game.wanted.heat = Math.max(game.wanted.heat, st.heat);
    game.wanted.lastCrimeAt = game.time;
  }
  if (st.type === 'race') {
    startRace(game, { story: true });
  }
}

function nearestRoadY(game, y) {
  let best = 0;
  let bd = Infinity;
  game.city.roadY.forEach((ry, j) => {
    const d = Math.abs(ry - y);
    if (d < bd) { bd = d; best = j; }
  });
  return best;
}

function completeStage(game) {
  const a = game.story.active;
  a.stage += 1;
  if (a.stage >= a.def.stages.length) {
    completeMission(game);
  } else {
    feed(game, 'Objective complete');
    beginStage(game);
  }
}

function completeMission(game) {
  const a = game.story.active;
  addCash(game, a.def.reward, `${a.def.title} complete`);
  showMessage(game, 'MISSION PASSED', `${a.def.title} · +$${a.def.reward}`, 4);
  game.story.completed.push(a.def.id);
  game.story.index += 1;
  game.stats.missions += 1;
  game.story.active = null;
  game.audio?.missionPass();
}

export function failMission(game, why) {
  if (!game.story.active) return;
  showMessage(game, 'MISSION FAILED', why, 3.6);
  game.story.active = null;
  if (game.side.race?.story) endRace(game, false);
  game.audio?.missionFail();
}

/** Drive a mission car along the lane network (courier, van). */
function driveLaneCar(game, car, dt, gripMul) {
  const ai = car.ai;
  const city = game.city;
  // Turn at crossings, like traffic but with a fixed cruise.
  const laneOff = 15;
  if (ai.axis === 'v') {
    for (let j = 0; j <= city.rows; j += 1) {
      if (Math.abs(car.y - city.roadY[j]) < 14 && ai.lastCross !== `h${j}`) {
        ai.lastCross = `h${j}`;
        if (game.rng() < 0.5) { ai.axis = 'h'; ai.road = j; ai.dir = game.rng() < 0.5 ? 1 : -1; }
        break;
      }
    }
  } else {
    for (let i = 0; i <= city.cols; i += 1) {
      if (Math.abs(car.x - city.roadX[i]) < 14 && ai.lastCross !== `v${i}`) {
        ai.lastCross = `v${i}`;
        if (game.rng() < 0.5) { ai.axis = 'v'; ai.road = i; ai.dir = game.rng() < 0.5 ? 1 : -1; }
        break;
      }
    }
  }
  const t = ai.axis === 'v'
    ? { x: city.roadX[ai.road] + (ai.dir < 0 ? laneOff : -laneOff), y: car.y + ai.dir * 120 }
    : { x: car.x + ai.dir * 120, y: city.roadY[ai.road] + (ai.dir > 0 ? laneOff : -laneOff) };
  const want = Math.atan2(t.y - car.y, t.x - car.x);
  const steer = clamp(angleDiff(car.angle, want) * 2.2, -1, 1);
  driveCar(game, car, dt, { throttle: car.speed < ai.cruise ? 0.85 : 0, steer, handbrake: false }, gripMul);
  collideCarWithCity(game, car, dt);
}

/** The boss car: flees the player at speed, slows when wrecked. */
function driveFleeCar(game, car, dt, gripMul) {
  const pos = playerPos(game);
  const away = Math.atan2(car.y - pos.y, car.x - pos.x);
  // Bias the escape toward the nearest road so it stays drivable.
  const city = game.city;
  let rx = city.roadX[0];
  for (const x of city.roadX) if (Math.abs(x - car.x) < Math.abs(rx - car.x)) rx = x;
  let ry = city.roadY[0];
  for (const y of city.roadY) if (Math.abs(y - car.y) < Math.abs(ry - car.y)) ry = y;
  const roadPull = Math.atan2(ry - car.y, rx - car.x);
  const want = away + angleDiff(away, roadPull) * 0.35;
  const steer = clamp(angleDiff(car.angle, want) * 2.4, -1, 1);
  const ai = car.ai;
  if (ai.reverse > 0) {
    ai.reverse -= dt;
    driveCar(game, car, dt, { throttle: -1, steer: -steer, handbrake: false }, gripMul);
  } else {
    driveCar(game, car, dt, { throttle: 1, steer, handbrake: false }, gripMul);
  }
  collideCarWithCity(game, car, dt);
  if (Math.abs(car.speed) < 10) ai.stuck += dt; else ai.stuck = 0;
  if (ai.stuck > 0.6) { ai.reverse = 0.7; ai.stuck = 0; }
}

export function stepMission(game, dt, gripMul) {
  const a = game.story.active;
  // Mission cars keep driving even between stage checks.
  if (a) {
    const courier = a.entities.courier;
    if (courier && !courier.dead) driveLaneCar(game, courier, dt, gripMul);
    const van = a.entities.van;
    if (van && !van.dead && a.data.stoppedFor === undefined) driveLaneCar(game, van, dt, gripMul);
    else if (van && !van.dead && stageDef(game).type === 'intercept') driveLaneCar(game, van, dt, gripMul);
    const boss = a.entities.boss;
    if (boss && !boss.dead) driveFleeCar(game, boss, dt, gripMul);
  }
  if (!a) return;
  const st = stageDef(game);
  const pos = playerPos(game);
  a.stageTime += dt;
  if (a.timer > 0) {
    a.timer -= dt;
    if (a.timer <= 0) { failMission(game, 'Out of time'); return; }
  }
  const pt = stagePoint(game, st);
  const near = pt ? dist(pos.x, pos.y, pt.x, pt.y) : Infinity;

  switch (st.type) {
    case 'goto':
      if (near < (st.radius || 60)) completeStage(game);
      break;
    case 'pickup':
      if (near < (st.radius || 46)) completeStage(game);
      break;
    case 'steal': {
      const car = a.entities[st.tag];
      if (car && game.player.inCar === car) completeStage(game);
      if (car && car.dead) failMission(game, 'The car was wrecked');
      break;
    }
    case 'deliver': {
      const car = st.tag ? a.entities[st.tag] : null;
      if (car && car.dead) { failMission(game, 'The car was wrecked'); break; }
      const okCar = !car || game.player.inCar === car;
      if (near < (st.radius || 70) && okCar) completeStage(game);
      break;
    }
    case 'follow': {
      const car = a.entities.courier;
      if (!car || car.dead) { failMission(game, 'You lost the courier'); break; }
      const d = dist(pos.x, pos.y, car.x, car.y);
      if (d > 300) a.data.lost += dt; else a.data.lost = 0;
      if (d < 70) a.data.close += dt; else a.data.close = 0;
      if (a.data.lost > 7) { failMission(game, 'The courier got away'); break; }
      if (a.data.close > 4) { failMission(game, 'He spotted you'); break; }
      if (d >= 70 && d <= 300) a.data.progress += dt / (st.seconds || 55);
      if (a.data.progress >= 1) completeStage(game);
      break;
    }
    case 'kill': {
      const left = game.peds.filter((p) => p.missionTag === 'killTarget' && !p.down).length;
      if (left === 0) completeStage(game);
      break;
    }
    case 'escape':
      if (near < (st.radius || 80) && game.wanted.stars === 0) completeStage(game);
      break;
    case 'intercept': {
      const car = a.entities[st.tag];
      if (!car) break;
      const stopped = Math.abs(car.speed) < 14 || car.hp < car.maxHp * 0.35;
      if (stopped && dist(pos.x, pos.y, car.x, car.y) < 120) a.data.stoppedFor += dt;
      else a.data.stoppedFor = Math.max(0, a.data.stoppedFor - dt);
      if (a.data.stoppedFor > 2.5) {
        car.ai.cruise = 0;
        completeStage(game);
      }
      break;
    }
    case 'chase': {
      const car = a.entities[st.tag];
      if (!car) break;
      if (car.dead || car.hp < car.maxHp * 0.25) completeStage(game);
      break;
    }
    case 'race':
      if (!game.side.race) {
        // The race ended: story races must be won.
        if (game.side.lastRaceResult === 'won') completeStage(game);
        else if (game.side.lastRaceResult === 'lost') failMission(game, 'You lost the race');
      }
      break;
    default:
      break;
  }
}

// ---- Side work ------------------------------------------------------------

export function startTaxiFare(game) {
  if (game.side.taxi) return false;
  const city = game.city;
  const pickup = { x: city.roadX[1 + Math.floor(game.rng() * city.cols)], y: city.roadY[1 + Math.floor(game.rng() * city.rows)] };
  const drop = { x: city.roadX[1 + Math.floor(game.rng() * city.cols)], y: city.roadY[1 + Math.floor(game.rng() * city.rows)] };
  game.side.taxi = { stage: 'pickup', pickup, drop, timer: 0 };
  feed(game, 'Fare waiting — follow the marker');
  return true;
}

export function stepTaxi(game, dt) {
  const fare = game.side.taxi;
  if (!fare) return;
  const p = game.player;
  if (!p.inCar || p.inCar.model.id !== 'taxi') {
    game.side.taxi = null;
    feed(game, 'Fare lost — you left the cab');
    return;
  }
  fare.timer += dt;
  const target = fare.stage === 'pickup' ? fare.pickup : fare.drop;
  if (dist(p.inCar.x, p.inCar.y, target.x, target.y) < 40) {
    if (fare.stage === 'pickup') {
      fare.stage = 'drop';
      fare.timer = 0;
      feed(game, 'Passenger aboard — take them to the marker');
    } else {
      const trip = dist(fare.pickup.x, fare.pickup.y, fare.drop.x, fare.drop.y);
      const pay = Math.round(30 + trip * 0.09 + Math.max(0, 40 - fare.timer));
      addCash(game, pay, 'Taxi fare');
      game.stats.fares += 1;
      game.side.taxi = null;
      game.audio?.cash();
    }
  }
}

export function taxiMarker(game) {
  const fare = game.side.taxi;
  if (!fare) return null;
  const t = fare.stage === 'pickup' ? fare.pickup : fare.drop;
  return { x: t.x, y: t.y, label: fare.stage === 'pickup' ? 'Passenger' : 'Drop-off' };
}

function raceRoute(game) {
  const city = game.city;
  const pts = [];
  const corners = [
    [1, 1], [city.cols, 1], [city.cols, city.rows], [1, city.rows], [1, 1],
  ];
  for (const [i, j] of corners) pts.push({ x: city.roadX[i], y: city.roadY[j] });
  return pts;
}

export function startRace(game, opts = {}) {
  if (game.side.race) return false;
  if (!opts.story) {
    if (game.cash < PRICES.raceEntry) {
      feed(game, `The meet wants $${PRICES.raceEntry} entry`);
      return false;
    }
    game.cash -= PRICES.raceEntry;
  }
  const meet = poi(game, 'racemeet');
  const checkpoints = raceRoute(game);
  const rivals = [];
  for (let i = 0; i < 3; i += 1) {
    const car = makeCar(game, [6, 7, 5][i], meet.x - 40 + i * 40, meet.y + 30, -Math.PI / 2, {
      kind: 'racer', missionTag: 'racer',
    });
    car.ai = { cp: 0, stuck: 0, reverse: 0, skill: range(game.rng, 0.82, 0.98) };
    rivals.push(car);
  }
  game.side.race = {
    story: !!opts.story,
    checkpoints, rivals,
    next: 0, playerCp: 0,
    startedAt: game.time,
    position: 4,
  };
  game.side.lastRaceResult = null;
  showMessage(game, 'STREET RACE', 'First through every checkpoint wins', 3);
  return true;
}

function stepRacer(game, car, dt, gripMul) {
  const race = game.side.race;
  const cp = race.checkpoints[car.ai.cp];
  if (!cp) { driveCar(game, car, dt, { throttle: 0, steer: 0, handbrake: false }, gripMul); return; }
  if (dist(car.x, car.y, cp.x, cp.y) < 55) {
    car.ai.cp += 1;
    if (car.ai.cp >= race.checkpoints.length) car.ai.finished = true;
  }
  const t = roadTargetToward(game, car.x, car.y, cp.x, cp.y);
  const want = Math.atan2(t.y - car.y, t.x - car.x);
  const steer = clamp(angleDiff(car.angle, want) * 2.3, -1, 1);
  const ai = car.ai;
  if (ai.reverse > 0) {
    ai.reverse -= dt;
    driveCar(game, car, dt, { throttle: -1, steer: -steer, handbrake: false }, gripMul);
  } else {
    const cap = car.model.top * ai.skill;
    driveCar(game, car, dt, { throttle: car.speed < cap ? 1 : 0, steer, handbrake: false }, gripMul);
  }
  collideCarWithCity(game, car, dt);
  if (Math.abs(car.speed) < 10) ai.stuck += dt; else ai.stuck = 0;
  if (ai.stuck > 0.6) { ai.reverse = 0.7; ai.stuck = 0; }
}

/**
 * An L-shaped driving target that stays on the streets: first run along the
 * current road to the target's cross street, then turn onto it. Checkpoints
 * sit on intersections, so this path never crosses a block.
 */
export function roadTargetToward(game, x, y, tx, ty) {
  const city = game.city;
  let ry = city.roadY[0];
  for (const v of city.roadY) if (Math.abs(v - y) < Math.abs(ry - y)) ry = v;
  let rx = city.roadX[0];
  for (const v of city.roadX) if (Math.abs(v - x) < Math.abs(rx - x)) rx = v;
  if (Math.abs(x - tx) > 34 && Math.abs(y - ty) > 34) {
    // Prefer the leg that keeps us on the road we are already on.
    if (Math.abs(y - ry) <= Math.abs(x - rx)) return { x: tx, y: ry };
    return { x: rx, y: ty };
  }
  return { x: tx, y: ty };
}

export function stepRace(game, dt, gripMul) {
  const race = game.side.race;
  if (!race) return;
  for (const car of race.rivals) {
    if (!car.dead) stepRacer(game, car, dt, gripMul);
  }
  const p = game.player;
  const pos = playerPos(game);
  const cp = race.checkpoints[race.next];
  if (cp && dist(pos.x, pos.y, cp.x, cp.y) < 55) {
    race.next += 1;
    race.playerCp += 1;
    game.audio?.checkpoint();
    if (race.next >= race.checkpoints.length) {
      endRace(game, race.position === 1);
      return;
    }
  }
  // Live position: checkpoints cleared, then distance to the next one.
  const score = (cps, x, y) => {
    const next = race.checkpoints[Math.min(cps, race.checkpoints.length - 1)];
    return cps * 100000 - (next ? dist(x, y, next.x, next.y) : 0);
  };
  const mine = score(race.playerCp, pos.x, pos.y);
  let ahead = 0;
  for (const car of race.rivals) {
    if (score(car.ai.cp, car.x, car.y) > mine) ahead += 1;
  }
  race.position = ahead + 1;
  if (race.rivals.every((c) => c.ai.finished)) endRace(game, false);
  if (!p.inCar && game.time - race.startedAt > 20) endRace(game, false);
}

export function endRace(game, won) {
  const race = game.side.race;
  if (!race) return;
  for (const car of race.rivals) {
    const idx = game.cars.indexOf(car);
    if (idx >= 0) game.cars.splice(idx, 1);
  }
  game.side.race = null;
  game.side.lastRaceResult = won ? 'won' : 'lost';
  if (won) {
    game.stats.racesWon += 1;
    if (!race.story) addCash(game, PRICES.racePrize, 'Street race won');
    showMessage(game, 'RACE WON', race.story ? 'Dario will hear about this' : `+$${PRICES.racePrize}`, 3.4);
    game.audio?.missionPass();
  } else {
    showMessage(game, 'RACE LOST', 'The meet will be here tomorrow', 3);
  }
}

/** Twelve hidden packages tucked around the city, fixed for a given seed. */
export function seedPackages(game) {
  const rng = game.rng;
  const spots = [];
  for (const park of game.city.parks) spots.push({ x: park.x + park.w / 2, y: park.y + park.h / 2 });
  for (const lot of game.city.lots) spots.push({ x: lot.x + lot.w - 20, y: lot.y + 20 });
  const beach = game.city.beachY + 30;
  spots.push({ x: 300, y: beach }, { x: 1500, y: beach }, { x: 2300, y: beach });
  game.side.packages = spots.slice(0, 12).map((s) => ({ ...s, taken: false }));
  void rng;
}

export function stepPackages(game) {
  const pos = playerPos(game);
  for (const pkg of game.side.packages) {
    if (pkg.taken) continue;
    if (dist2(pos.x, pos.y, pkg.x, pkg.y) < 26 * 26) {
      pkg.taken = true;
      game.stats.packages += 1;
      addCash(game, 100, `Hidden package ${game.stats.packages}/12`);
      game.audio?.cash();
    }
  }
}
