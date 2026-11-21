// Solmaris Heat — HUD: bars, stars, cash, objective, minimap, full city map, toasts.
import { TILE, GRID, WORLD } from './config.js';
import { TILE_KIND, zoneName } from './city.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud');
  const starsEl = el('hud-stars');
  const cashEl = el('hud-cash');
  const weaponEl = el('hud-weapon');
  const healthFill = el('hud-health-fill');
  const armorFill = el('hud-armor-fill');
  const clockEl = el('hud-clock');
  const objectiveEl = el('hud-objective');
  const messageEl = el('hud-message');
  const feedEl = el('hud-feed');
  const zoneEl = el('hud-zone');
  const speedoEl = el('hud-speedo');
  const speedEl = el('hud-speed');
  const bustEl = el('hud-bust');
  const bustFill = el('hud-bust-fill');
  const promptEl = el('hud-prompt');
  const toastEl = el('toast');
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');

  let messageTimer = 0;
  let toastTimer = 0;
  const feedItems = [];

  return {
    show() { hud.classList.remove('hidden'); },
    hide() { hud.classList.add('hidden'); },

    feed(text) {
      feedItems.unshift({ text, t: 0 });
      if (feedItems.length > 5) feedItems.pop();
    },

    clearFeed() {
      feedItems.length = 0;
      feedEl.innerHTML = '';
    },

    message(text, seconds = 4) {
      messageEl.textContent = text;
      messageEl.classList.remove('hidden');
      messageTimer = seconds;
    },

    toast(text) {
      toastEl.textContent = text;
      toastEl.classList.remove('hidden');
      toastTimer = 3.2;
    },

    prompt(html) {
      if (!html) { promptEl.classList.add('hidden'); return; }
      promptEl.innerHTML = html;
      promptEl.classList.remove('hidden');
    },

    update(G, dt) {
      const p = G.player;
      // Stars
      let s = '';
      for (let i = 0; i < 5; i++) s += i < G.police.stars ? '★' : '<span class="off">★</span>';
      starsEl.innerHTML = s;
      cashEl.textContent = '$' + Math.floor(p.cash).toLocaleString('en-US');
      weaponEl.textContent = p.weapon === 'pistol' ? `Pistol · ${p.ammo}` : 'Fists';
      healthFill.style.width = Math.max(0, p.health) + '%';
      armorFill.style.width = Math.max(0, p.armor) + '%';

      const hours = Math.floor(G.dayTime * 24);
      const mins = Math.floor((G.dayTime * 24 - hours) * 60);
      clockEl.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

      const obj = G.missions.objective;
      if (obj) { objectiveEl.textContent = obj; objectiveEl.classList.remove('hidden'); }
      else objectiveEl.classList.add('hidden');

      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) messageEl.classList.add('hidden');
      }
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastEl.classList.add('hidden');
      }

      // Feed aging
      for (const f of feedItems) f.t += dt;
      while (feedItems.length && feedItems[feedItems.length - 1].t > 6) feedItems.pop();
      feedEl.innerHTML = feedItems.map((f) => `<div>${f.text}</div>`).join('');

      zoneEl.textContent = zoneName(p.x, p.y);

      if (p.mode === 'car') {
        speedoEl.classList.remove('hidden');
        speedEl.textContent = Math.round(Math.abs(p.car.speed) * 0.36);
      } else speedoEl.classList.add('hidden');

      if (G.police.bust > 0.02) {
        bustEl.classList.remove('hidden');
        bustFill.style.width = Math.min(100, G.police.bust * 100) + '%';
      } else bustEl.classList.add('hidden');

      if (G.settings.minimap) {
        minimap.style.display = '';
        this.drawMinimap(G);
      } else minimap.style.display = 'none';
    },

    drawMinimap(G) {
      const p = G.player;
      const R = 110, range = 520; // world units visible from center
      const scale = R / range;
      mctx.save();
      mctx.beginPath();
      mctx.arc(R, R, R, 0, Math.PI * 2);
      mctx.clip();
      mctx.fillStyle = '#24303c';
      mctx.fillRect(0, 0, R * 2, R * 2);
      // Tiles
      const city = G.city;
      const t0x = Math.floor((p.x - range) / TILE), t1x = Math.floor((p.x + range) / TILE);
      const t0y = Math.floor((p.y - range) / TILE), t1y = Math.floor((p.y + range) / TILE);
      for (let ty = t0y; ty <= t1y; ty++) {
        for (let tx = t0x; tx <= t1x; tx++) {
          if (tx < 0 || ty < 0 || tx >= GRID || ty >= GRID) continue;
          const k = city.tiles[ty][tx];
          mctx.fillStyle = k === TILE_KIND.ROAD ? '#5a6470' : k === TILE_KIND.WATER ? '#2e7fb8' : k === TILE_KIND.SAND ? '#e3cd96' : k === TILE_KIND.PARK ? '#3f7d3a' : '#39434e';
          mctx.fillRect(R + (tx * TILE - p.x) * scale, R + (ty * TILE - p.y) * scale, TILE * scale + 1, TILE * scale + 1);
        }
      }
      // Blips
      const blip = (x, y, color, size = 4) => {
        const dx = (x - p.x) * scale, dy = (y - p.y) * scale;
        const d = Math.hypot(dx, dy);
        const cl = d > R - 8 ? (R - 8) / d : 1;
        mctx.fillStyle = color;
        mctx.beginPath();
        mctx.arc(R + dx * cl, R + dy * cl, size, 0, Math.PI * 2);
        mctx.fill();
      };
      const P = city.places;
      blip(P.respray.x, P.respray.y, '#5ce08a', 4);
      blip(P.gunshop.x, P.gunshop.y, '#ffb43f', 4);
      blip(P.safehouse.x, P.safehouse.y, '#c8a2ff', 4);
      for (const car of G.cars) if (car.isPolice && car.driver === 'police') blip(car.x, car.y, '#5c9dff', 4);
      for (const e of G.combat.enemies) if (e.state !== 'down') blip(e.x, e.y, '#ff5c5c', 3.5);
      const m = G.missions.marker;
      if (m) blip(m.x, m.y, '#ffd93f', 6);
      // Player arrow
      mctx.translate(R, R);
      mctx.rotate(p.angle + Math.PI / 2);
      mctx.fillStyle = '#ffffff';
      mctx.beginPath();
      mctx.moveTo(0, -8); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath();
      mctx.fill();
      mctx.restore();
      // North marker
      mctx.fillStyle = '#ffd98a';
      mctx.font = 'bold 11px sans-serif';
      mctx.textAlign = 'center';
      mctx.fillText('N', R, 14);
    },

    drawBigMap(G) {
      const canvas = el('bigmap');
      const c = canvas.getContext('2d');
      const sx = canvas.width / WORLD, sy = canvas.height / WORLD;
      c.fillStyle = '#1c2733';
      c.fillRect(0, 0, canvas.width, canvas.height);
      const city = G.city;
      for (let ty = 0; ty < GRID; ty++) {
        for (let tx = 0; tx < GRID; tx++) {
          const k = city.tiles[ty][tx];
          c.fillStyle = k === TILE_KIND.ROAD ? '#5a6470' : k === TILE_KIND.WATER ? '#2e7fb8' : k === TILE_KIND.SAND ? '#e3cd96' : k === TILE_KIND.PARK ? '#3f7d3a' : '#39434e';
          c.fillRect(tx * TILE * sx, ty * TILE * sy, TILE * sx + 1, TILE * sy + 1);
        }
      }
      const dot = (x, y, color, r = 5, label = '') => {
        c.fillStyle = color;
        c.beginPath(); c.arc(x * sx, y * sy, r, 0, Math.PI * 2); c.fill();
        if (label) { c.fillStyle = '#f4ead8'; c.font = '11px sans-serif'; c.fillText(label, x * sx + 8, y * sy + 4); }
      };
      const P = city.places;
      dot(P.fixer.x, P.fixer.y, '#ffd93f', 5, 'Dario (jobs)');
      dot(P.respray.x, P.respray.y, '#5ce08a', 5, 'Chop & Shine');
      dot(P.gunshop.x, P.gunshop.y, '#ffb43f', 5, 'Iron & Oak');
      dot(P.safehouse.x, P.safehouse.y, '#c8a2ff', 5, 'Safehouse');
      dot(P.clinic.x, P.clinic.y, '#ff8ab0', 5, 'Clinic');
      if (G.missions.marker) dot(G.missions.marker.x, G.missions.marker.y, '#ffd93f', 7);
      dot(G.player.x, G.player.y, '#ffffff', 6, 'You');
    },
  };
}
