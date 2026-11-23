// The heads-up display and menus, in the DOM over the canvas: clock, cash,
// wanted stars, health bars, the objective line, the minimap with its blips,
// the full city map, and the title/pause/busted screens.

import { WORLD, WEAPONS } from './data.js';
import { clockText, weatherText } from './weather.js';
import { zoneNameAt } from './city.js';
import { missionMarker, missionObjective, taxiMarker } from './missions.js';
import { playerPos, playerSpeed } from './state.js';

export function grabHud() {
  const $ = (id) => document.getElementById(id);
  return {
    root: $('hud'),
    clock: $('hud-clock'),
    weather: $('hud-weather'),
    stars: $('hud-stars'),
    cash: $('hud-cash'),
    weapon: $('hud-weapon'),
    health: $('hud-health-fill'),
    armor: $('hud-armor-fill'),
    stamina: $('hud-stamina-fill'),
    objective: $('hud-objective'),
    message: $('hud-message'),
    feed: $('hud-feed'),
    minimap: $('minimap'),
    zone: $('hud-zone'),
    speedo: $('hud-speedo'),
    speed: $('hud-speed'),
    bust: $('hud-bust'),
    bustFill: $('hud-bust-fill'),
    prompt: $('hud-prompt'),
    toast: $('toast'),
    screens: {
      start: $('screen-start'),
      howto: $('screen-howto'),
      settings: $('screen-settings'),
      pause: $('screen-pause'),
      map: $('screen-map'),
      down: $('screen-down'),
    },
    downWord: $('down-word'),
    downSub: $('down-sub'),
    pauseStats: $('pause-stats'),
    bigmap: $('bigmap'),
    continueBtn: $('btn-continue'),
  };
}

export function showScreen(hud, name) {
  const wanted = name === 'title' ? 'start' : name;
  for (const [key, el] of Object.entries(hud.screens)) {
    if (el) el.classList.toggle('hidden', key !== wanted);
  }
  hud.root.classList.toggle('hidden', name !== null && name !== 'play');
}

export function updateHud(hud, game, promptText) {
  const p = game.player;
  hud.clock.textContent = clockText(game);
  hud.weather.textContent = weatherText(game);
  const stars = game.wanted.stars;
  hud.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  hud.stars.style.opacity = stars > 0 ? '1' : '0.35';
  hud.cash.textContent = `$${game.cash.toLocaleString('en-US')}`;
  const w = WEAPONS[p.weapon];
  hud.weapon.textContent = p.weapon === 'fists' ? 'Fists' : `${w.name} · ${p.ammo[p.weapon] || 0}`;
  hud.health.style.width = `${Math.max(0, p.hp)}%`;
  hud.armor.style.width = `${Math.max(0, p.armor)}%`;
  hud.stamina.style.width = `${Math.round(p.stamina * 100)}%`;

  const objective = missionObjective(game);
  hud.objective.textContent = objective;
  hud.objective.classList.toggle('hidden', !objective);

  if (game.message && game.time < game.message.until) {
    hud.message.innerHTML = `<div class="msg-title">${game.message.text}</div>`
      + (game.message.sub ? `<div class="msg-sub">${game.message.sub}</div>` : '');
    hud.message.classList.remove('hidden');
  } else {
    hud.message.classList.add('hidden');
  }

  hud.feed.innerHTML = game.feed
    .filter((f) => game.time - f.at < 6)
    .map((f) => `<div class="feed-line">${f.text}</div>`)
    .join('');

  const pos = playerPos(game);
  hud.zone.textContent = zoneNameAt(game.city, pos.x, pos.y);

  if (p.inCar) {
    hud.speedo.classList.remove('hidden');
    hud.speed.textContent = String(Math.round(Math.abs(p.inCar.speed) * 0.36));
  } else {
    hud.speedo.classList.add('hidden');
  }

  if (game.wanted.bust > 0.05) {
    hud.bust.classList.remove('hidden');
    hud.bustFill.style.width = `${Math.min(100, game.wanted.bust * 50)}%`;
  } else {
    hud.bust.classList.add('hidden');
  }

  if (promptText) {
    hud.prompt.textContent = promptText;
    hud.prompt.classList.remove('hidden');
  } else {
    hud.prompt.classList.add('hidden');
  }

  if (game.toast && game.time < game.toast.until) {
    hud.toast.textContent = game.toast.text;
    hud.toast.classList.remove('hidden');
  } else {
    hud.toast.classList.add('hidden');
  }

  if (game.settings.minimap) drawMinimap(hud.minimap, game);
}

const POI_COLORS = {
  giver: '#ffd640', shop: '#ff9f43', respray: '#2ed573',
  hospital: '#ff6b81', police: '#54a0ff', race: '#1dd1a1',
  safehouse: '#c8d6e5', warehouse: '#a55eea', pier: '#48dbfb',
};

/** The circular minimap: streets, water, blips, and Mara's arrow. */
export function drawMinimap(canvas, game) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const scale = S / 900; // shows a 900-unit window around the player
  const pos = playerPos(game);
  const ox = S / 2 - pos.x * scale;
  const oy = S / 2 - pos.y * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#2f3b33';
  ctx.fillRect(0, 0, S, S);
  // Water.
  ctx.fillStyle = '#1d5f7a';
  ctx.fillRect(0, oy + game.city.waterY * scale, S, S);
  ctx.fillStyle = '#e8d5a3';
  ctx.fillRect(0, oy + game.city.beachY * scale, S, (game.city.waterY - game.city.beachY) * scale);
  // Blocks.
  ctx.fillStyle = '#4a5a4e';
  for (const r of game.city.blockRects) {
    ctx.fillRect(ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale);
  }
  // Roads.
  ctx.fillStyle = '#20262b';
  for (const rx of game.city.roadX) {
    ctx.fillRect(ox + (rx - WORLD.road / 2) * scale, oy + game.city.oy * scale, WORLD.road * scale, (game.city.beachY - game.city.oy) * scale);
  }
  for (const ry of game.city.roadY) {
    ctx.fillRect(ox + game.city.ox * scale, oy + (ry - WORLD.road / 2) * scale, (WORLD.width - game.city.ox * 2) * scale, WORLD.road * scale);
  }
  // POIs.
  for (const poi of Object.values(game.city.pois)) {
    ctx.fillStyle = POI_COLORS[poi.kind] || '#fff';
    ctx.beginPath();
    ctx.arc(ox + poi.x * scale, oy + poi.y * scale, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#ff4757';
  for (const car of game.cars) {
    if (!car.police || car.dead) continue;
    ctx.beginPath();
    ctx.arc(ox + car.x * scale, oy + car.y * scale, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (game.heli) {
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.arc(ox + game.heli.x * scale, oy + game.heli.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker.
  const marker = missionMarker(game);
  if (marker) {
    ctx.fillStyle = '#ffd640';
    ctx.beginPath();
    ctx.arc(ox + marker.x * scale, oy + marker.y * scale, 5 + Math.sin(game.time * 4) * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const taxi = taxiMarker(game);
  if (taxi) {
    ctx.fillStyle = '#7be382';
    ctx.beginPath();
    ctx.arc(ox + taxi.x * scale, oy + taxi.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = game.player;
  const ang = p.inCar ? p.inCar.angle : p.angle;
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
}

/** The full-city map behind the M key. */
export function drawBigMap(canvas, game) {
  const ctx = canvas.getContext('2d');
  const sx = canvas.width / WORLD.width;
  const sy = canvas.height / WORLD.height;
  ctx.fillStyle = '#22302a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1d5f7a';
  ctx.fillRect(0, game.city.waterY * sy, canvas.width, canvas.height);
  ctx.fillStyle = '#e8d5a3';
  ctx.fillRect(0, game.city.beachY * sy, canvas.width, (game.city.waterY - game.city.beachY) * sy);
  const districtFill = {
    residential: '#5a6e52', downtown: '#4e5d6b', market: '#6b5a48',
    docks: '#4c6058', industrial: '#5f524c', marina: '#4a6266',
  };
  for (const r of game.city.blockRects) {
    ctx.fillStyle = districtFill[r.district] || '#4a5a4e';
    ctx.fillRect(r.x * sx, r.y * sy, r.w * sx, r.h * sy);
  }
  ctx.fillStyle = '#20262b';
  for (const rx of game.city.roadX) ctx.fillRect((rx - WORLD.road / 2) * sx, game.city.oy * sy, WORLD.road * sx, (game.city.beachY - game.city.oy) * sy);
  for (const ry of game.city.roadY) ctx.fillRect(game.city.ox * sx, (ry - WORLD.road / 2) * sy, (WORLD.width - game.city.ox * 2) * sx, WORLD.road * sy);
  ctx.font = 'bold 11px system-ui, sans-serif';
  for (const poi of Object.values(game.city.pois)) {
    ctx.fillStyle = POI_COLORS[poi.kind] || '#fff';
    ctx.beginPath();
    ctx.arc(poi.x * sx, poi.y * sy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(poi.name, poi.x * sx + 7, poi.y * sy + 4);
  }
  const marker = missionMarker(game);
  if (marker) {
    ctx.fillStyle = '#ffd640';
    ctx.beginPath();
    ctx.arc(marker.x * sx, marker.y * sy, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  const pos = playerPos(game);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(pos.x * sx, pos.y * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd640';
  ctx.lineWidth = 2;
  ctx.stroke();
  void playerSpeed;
}

export function pauseStatsHtml(game) {
  const s = game.stats;
  return `<table class="keys">
    <tr><td>Cash</td><td>$${game.cash.toLocaleString('en-US')}</td></tr>
    <tr><td>Missions done</td><td>${s.missions} / 8</td></tr>
    <tr><td>Cars stolen</td><td>${s.stolen}</td></tr>
    <tr><td>Taxi fares</td><td>${s.fares}</td></tr>
    <tr><td>Races won</td><td>${s.racesWon}</td></tr>
    <tr><td>Hidden packages</td><td>${s.packages} / 12</td></tr>
    <tr><td>Times busted</td><td>${s.busted}</td></tr>
    <tr><td>Times wasted</td><td>${s.wasted}</td></tr>
  </table>`;
}
