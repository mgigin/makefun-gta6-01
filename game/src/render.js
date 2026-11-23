// Rendering Solmaris: a top-down canvas city with pseudo-3D buildings whose
// roofs lean with their height, sun shadows that swing with the clock, and a
// night pass that drops darkness over the streets and picks out the lights.
// Everything is drawn from code — there are no image assets.

import { WORLD, VIEW } from './data.js';
import { daylight, goldenHour, sunAngle, lightsOn, skyTint } from './weather.js';
import { clamp } from './rng.js';

function hash(n) {
  let x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function worldToScreen(game, x, y) {
  const cam = game.camera;
  return {
    x: x - cam.x + VIEW.width / 2,
    y: y - cam.y + VIEW.height / 2,
  };
}

function visible(game, x, y, w, h) {
  const cam = game.camera;
  return x + w > cam.x - VIEW.width / 2 - 80 && x < cam.x + VIEW.width / 2 + 80
    && y + h > cam.y - VIEW.height / 2 - 80 && y < cam.y + VIEW.height / 2 + 80;
}

function drawGround(ctx, game) {
  const city = game.city;
  const cam = game.camera;
  const x0 = cam.x - VIEW.width / 2;
  const y0 = cam.y - VIEW.height / 2;

  // Base: warm concrete everywhere the city isn't.
  ctx.fillStyle = '#b7ab90';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // The bay: sand then water along the south edge.
  const beach = worldToScreen(game, 0, city.beachY);
  if (beach.y < VIEW.height + 200) {
    ctx.fillStyle = '#e8d5a3';
    ctx.fillRect(0, beach.y, VIEW.width, 74);
    const grad = ctx.createLinearGradient(0, beach.y + 74, 0, VIEW.height);
    grad.addColorStop(0, '#3d8fa8');
    grad.addColorStop(1, '#1d5f7a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, beach.y + 74, VIEW.width, VIEW.height - beach.y - 74);
    // Foam line breathing at the shore.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const foam = Math.sin(game.time * 0.8) * 3;
    ctx.fillRect(0, beach.y + 70 + foam, VIEW.width, 4);
  }

  // Blocks: sidewalk slab, then district ground.
  for (const r of city.blockRects) {
    if (!visible(game, r.x, r.y, r.w, r.h)) continue;
    const s = worldToScreen(game, r.x, r.y);
    ctx.fillStyle = '#c9bda0';
    ctx.fillRect(s.x, s.y, r.w, r.h);
    ctx.fillStyle = '#bfb193';
    ctx.fillRect(s.x + WORLD.sidewalk, s.y + WORLD.sidewalk, r.w - WORLD.sidewalk * 2, r.h - WORLD.sidewalk * 2);
  }

  // Parks: lawn, path cross, trees.
  for (const park of city.parks) {
    if (!visible(game, park.x, park.y, park.w, park.h)) continue;
    const s = worldToScreen(game, park.x, park.y);
    ctx.fillStyle = '#6fae5e';
    ctx.fillRect(s.x + 8, s.y + 8, park.w - 16, park.h - 16);
    ctx.fillStyle = '#d8c9a3';
    ctx.fillRect(s.x + park.w / 2 - 7, s.y + 8, 14, park.h - 16);
    ctx.fillRect(s.x + 8, s.y + park.h / 2 - 7, park.w - 16, 14);
    for (const tree of park.trees) {
      const t = worldToScreen(game, tree.x, tree.y);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(t.x + 5, t.y + 6, tree.r, tree.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f7d34';
      ctx.beginPath();
      ctx.arc(t.x, t.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#55a047';
      ctx.beginPath();
      ctx.arc(t.x - tree.r * 0.25, t.y - tree.r * 0.25, tree.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Parking lots.
  for (const lot of city.lots) {
    if (!visible(game, lot.x, lot.y, lot.w, lot.h)) continue;
    const s = worldToScreen(game, lot.x, lot.y);
    ctx.fillStyle = '#8b8d90';
    ctx.fillRect(s.x, s.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.strokeRect(s.x + 12 + i * 52, s.y + 12, 42, 60);
      ctx.strokeRect(s.x + 12 + i * 52, s.y + lot.h - 72, 42, 60);
    }
  }

  // Roads: asphalt strips with centre dashes and crosswalks.
  ctx.fillStyle = '#4c4f55';
  for (const rx of city.roadX) {
    const s = worldToScreen(game, rx - WORLD.road / 2, city.oy);
    if (s.x < -WORLD.road || s.x > VIEW.width) continue;
    ctx.fillRect(s.x, Math.max(0, s.y), WORLD.road, Math.min(VIEW.height, city.beachY - city.oy));
  }
  for (const ry of city.roadY) {
    const s = worldToScreen(game, city.ox, ry - WORLD.road / 2);
    if (s.y < -WORLD.road || s.y > VIEW.height) continue;
    ctx.fillRect(Math.max(0, s.x), s.y, VIEW.width, WORLD.road);
  }
  ctx.fillStyle = 'rgba(245,220,120,0.75)';
  for (const rx of city.roadX) {
    const s = worldToScreen(game, rx, 0);
    if (s.x < -10 || s.x > VIEW.width + 10) continue;
    for (let y = city.oy; y < city.beachY; y += 34) {
      const p = worldToScreen(game, rx, y);
      if (p.y > -20 && p.y < VIEW.height + 20) ctx.fillRect(p.x - 2, p.y, 4, 18);
    }
  }
  for (const ry of city.roadY) {
    const s = worldToScreen(game, 0, ry);
    if (s.y < -10 || s.y > VIEW.height + 10) continue;
    for (let x = city.ox; x < WORLD.width - city.ox; x += 34) {
      const p = worldToScreen(game, x, ry);
      if (p.x > -20 && p.x < VIEW.width + 20) ctx.fillRect(p.x, p.y - 2, 18, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (const rx of city.roadX) {
    for (const ry of city.roadY) {
      const s = worldToScreen(game, rx, ry);
      if (s.x < -70 || s.x > VIEW.width + 70 || s.y < -70 || s.y > VIEW.height + 70) continue;
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(s.x - WORLD.road / 2 - 12, s.y + i * 11 - 3, 9, 6);
        ctx.fillRect(s.x + WORLD.road / 2 + 3, s.y + i * 11 - 3, 9, 6);
        ctx.fillRect(s.x + i * 11 - 3, s.y - WORLD.road / 2 - 12, 6, 9);
        ctx.fillRect(s.x + i * 11 - 3, s.y + WORLD.road / 2 + 3, 6, 9);
      }
    }
  }
  void x0; void y0;
}

function drawBuildings(ctx, game) {
  const city = game.city;
  const sun = sunAngle(game);
  const shX = Math.cos(sun) * 0.55;
  const shY = Math.sin(sun) * 0.55;
  const night = lightsOn(game);
  // Sort south-to-north so nearer roofs overlap correctly.
  const sorted = city.buildings
    .filter((b) => visible(game, b.x - 60, b.y - 60, b.w + 120, b.h + 120))
    .sort((a, b) => a.y - b.y);
  for (const b of sorted) {
    const s = worldToScreen(game, b.x, b.y);
    const lift = b.height * 0.32;
    const rx = s.x - lift * 0.55;
    const ry = s.y - lift;
    // Ground shadow.
    ctx.fillStyle = 'rgba(30,30,40,0.28)';
    ctx.fillRect(s.x + b.height * shX * 0.5, s.y + b.height * shY * 0.5, b.w, b.h);
    // South and east walls between footprint and roof.
    ctx.fillStyle = shade(b.face, -28);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + b.h);
    ctx.lineTo(s.x + b.w, s.y + b.h);
    ctx.lineTo(rx + b.w, ry + b.h);
    ctx.lineTo(rx, ry + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(b.face, -12);
    ctx.beginPath();
    ctx.moveTo(s.x + b.w, s.y);
    ctx.lineTo(s.x + b.w, s.y + b.h);
    ctx.lineTo(rx + b.w, ry + b.h);
    ctx.lineTo(rx + b.w, ry);
    ctx.closePath();
    ctx.fill();
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(rx, ry, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx + 3, ry + 3, b.w - 6, b.h - 6);
    // Rooftop clutter: AC units and a stairwell box.
    for (let i = 0; i < b.acUnits; i += 1) {
      const ax = rx + 12 + hash(b.windows + i * 7) * (b.w - 40);
      const ay = ry + 12 + hash(b.windows + i * 13) * (b.h - 40);
      ctx.fillStyle = '#9aa5ad';
      ctx.fillRect(ax, ay, 16, 12);
    }
    // Windows on the south wall; some lit after dark.
    const rows = Math.max(1, Math.floor(b.height / 22));
    const cols = Math.max(2, Math.floor(b.w / 26));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const t = (c + 0.5) / cols;
        const wx = s.x + t * b.w - lift * 0.55 * (1 - (r + 0.5) / rows) - 4;
        const wy = s.y + b.h - (r + 0.8) * (lift / Math.max(1, rows)) - 5;
        const lit = night && hash(b.windows + r * 31 + c * 7) > 0.45;
        ctx.fillStyle = lit ? '#ffd97a' : 'rgba(20,30,45,0.55)';
        ctx.fillRect(wx, wy, 8, 6);
      }
    }
    if (b.awning) {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(s.x + 6, s.y + b.h - 8, b.w - 12, 8);
    }
    if (b.sign) {
      ctx.fillStyle = 'rgba(10,14,20,0.85)';
      ctx.fillRect(rx + 6, ry + 6, Math.min(b.w - 12, b.sign.length * 9 + 14), 20);
      ctx.fillStyle = '#ffd97a';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(b.sign.toUpperCase(), rx + 12, ry + 20);
    }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 0xff) + amt, 0, 255);
  const b = clamp((n & 0xff) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function drawCar(ctx, game, car) {
  const s = worldToScreen(game, car.x, car.y);
  if (s.x < -90 || s.x > VIEW.width + 90 || s.y < -90 || s.y > VIEW.height + 90) return;
  const m = car.model;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-m.len / 2 + 3, -m.wid / 2 + 4, m.len, m.wid);
  // Body.
  const body = car.dead ? '#3a3a3a' : car.color;
  ctx.fillStyle = body;
  roundRect(ctx, -m.len / 2, -m.wid / 2, m.len, m.wid, 6);
  ctx.fill();
  // Cabin and glass.
  ctx.fillStyle = 'rgba(15,25,40,0.85)';
  roundRect(ctx, -m.len * 0.22, -m.wid / 2 + 3, m.len * 0.42, m.wid - 6, 4);
  ctx.fill();
  ctx.fillStyle = shade(car.police ? '#1b2a4a' : car.color, 18);
  roundRect(ctx, -m.len * 0.16, -m.wid / 2 + 4, m.len * 0.3, m.wid - 8, 3);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#151515';
  const wx = m.len * 0.32;
  const wy = m.wid / 2 - 1;
  for (const [dx, dy] of [[-wx, -wy], [wx, -wy], [-wx, wy], [wx, wy]]) {
    ctx.fillRect(dx - 5, dy - 3, 10, 6);
  }
  // Lights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(m.len / 2 - 3, -m.wid / 2 + 2, 3, 5);
  ctx.fillRect(m.len / 2 - 3, m.wid / 2 - 7, 3, 5);
  ctx.fillStyle = car.brakeLights ? '#ff3b30' : '#8e2323';
  ctx.fillRect(-m.len / 2, -m.wid / 2 + 2, 3, 5);
  ctx.fillRect(-m.len / 2, m.wid / 2 - 7, 3, 5);
  if (car.police) {
    // Livery stripe and flashing lightbar.
    ctx.fillStyle = '#e8eef4';
    ctx.fillRect(-m.len / 2, -3, m.len, 6);
    const phase = Math.floor(game.time * 6 + car.sirenPhase) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2d2d' : '#7a1010';
    ctx.fillRect(-6, -m.wid / 2 + 2, 6, 5);
    ctx.fillStyle = phase ? '#10307a' : '#2d6bff';
    ctx.fillRect(1, -m.wid / 2 + 2, 6, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.fillText('POLICE', -m.len * 0.32, 2.5);
  }
  if (m.id === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 6px system-ui, sans-serif';
    ctx.fillText('TAXI', -5, 2);
  }
  ctx.restore();
  // Mission target ring.
  if (car.missionTag && !car.dead) {
    ctx.strokeStyle = 'rgba(255,214,64,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, m.len * 0.75 + Math.sin(game.time * 4) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Damage smoke is particles; fire draws here for burning wrecks.
  if (car.dead && car.burning > 0) {
    ctx.fillStyle = 'rgba(255,120,30,0.75)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 12 + Math.sin(game.time * 18) * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPed(ctx, game, ped) {
  const s = worldToScreen(game, ped.x, ped.y);
  if (s.x < -40 || s.x > VIEW.width + 40 || s.y < -40 || s.y > VIEW.height + 40) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(s.x + 2, s.y + 3, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.down) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-9, -4, 18, 8);
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(11, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.phase) * 1.2;
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(s.x, s.y + bob * 0.3, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(s.x + Math.cos(ped.angle) * 3, s.y + Math.sin(ped.angle) * 3 + bob * 0.3, 4.6, 0, Math.PI * 2);
  ctx.fill();
  if (ped.hostile) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(ped.angle) * 15, s.y + Math.sin(ped.angle) * 15);
    ctx.stroke();
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.inCar) return; // drawn as part of the car
  const s = worldToScreen(game, p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(s.x + 2, s.y + 4, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Mara: teal jacket, dark hair.
  ctx.fillStyle = '#0f766e';
  ctx.beginPath();
  ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(s.x + Math.cos(p.angle) * 3, s.y + Math.sin(p.angle) * 3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.arc(s.x - Math.cos(p.angle) * 2, s.y - Math.sin(p.angle) * 2, 4.4, 0, Math.PI * 2);
  ctx.fill();
  // Weapon in hand.
  if (p.weapon !== 'fists') {
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = p.weapon === 'scattergun' || p.weapon === 'rifle' ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(p.aim) * 17, s.y + Math.sin(p.aim) * 17);
    ctx.stroke();
  }
  // Muzzle flash.
  if (game.muzzle && game.time - game.muzzle.at < 0.06) {
    const ms = worldToScreen(game, game.muzzle.x, game.muzzle.y);
    ctx.fillStyle = 'rgba(255,220,120,0.95)';
    ctx.beginPath();
    ctx.arc(ms.x + Math.cos(game.muzzle.angle) * 8, ms.y + Math.sin(game.muzzle.angle) * 8, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(220,40,40,${(p.hurtFlash * 0.5).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHeli(ctx, game) {
  const h = game.heli;
  if (!h) return;
  const s = worldToScreen(game, h.x, h.y);
  // Searchlight cone down to the player.
  const pos = game.player.inCar
    ? worldToScreen(game, game.player.inCar.x, game.player.inCar.y)
    : worldToScreen(game, game.player.x, game.player.y);
  const grad = ctx.createRadialGradient(pos.x, pos.y, 6, pos.x, pos.y, 130);
  grad.addColorStop(0, 'rgba(255,250,200,0.5)');
  grad.addColorStop(1, 'rgba(255,250,200,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,250,200,0.10)';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(pos.x - 60, pos.y + 40);
  ctx.lineTo(pos.x + 60, pos.y + 40);
  ctx.closePath();
  ctx.fill();
  // Body and rotor.
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(h.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(26, 30, 34, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22303c';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-52, -3, 30, 6);
  ctx.fillStyle = '#ffd97a';
  ctx.fillRect(-56, -7, 5, 14);
  ctx.fillStyle = 'rgba(180,220,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(10, 0, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(20,20,20,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i += 1) {
    const a = h.rotor + i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(a) * 44, s.y - Math.sin(a) * 44);
    ctx.lineTo(s.x + Math.cos(a) * 44, s.y + Math.sin(a) * 44);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200,200,200,0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 44, 0, Math.PI * 2);
  ctx.stroke();
}

function drawEffects(ctx, game) {
  // Skid marks.
  ctx.fillStyle = 'rgba(20,20,20,0.35)';
  for (const sk of game.skids) {
    const s = worldToScreen(game, sk.x, sk.y);
    if (s.x < -20 || s.x > VIEW.width + 20 || s.y < -20 || s.y > VIEW.height + 20) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(sk.angle);
    ctx.fillRect(-8, -9, 16, 3);
    ctx.fillRect(-8, 6, 16, 3);
    ctx.restore();
  }
  // Particles.
  for (const pt of game.particles) {
    const s = worldToScreen(game, pt.x, pt.y);
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.kind === 'fire'
      ? `rgba(255,${120 + Math.floor(a * 100)},40,${(a * 0.8).toFixed(2)})`
      : `rgba(90,90,95,${(a * 0.5).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, pt.size * (1.6 - a * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  // Bullets as tracers.
  ctx.strokeStyle = 'rgba(255,240,170,0.95)';
  ctx.lineWidth = 2;
  for (const b of game.bullets) {
    const s = worldToScreen(game, b.x, b.y);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - b.vx * 0.012, s.y - b.vy * 0.012);
    ctx.stroke();
  }
  // Spike strips.
  for (const sp of game.spikes) {
    const s = worldToScreen(game, sp.x, sp.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(sp.angle + Math.PI / 2);
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(-34, -3, 68, 6);
    ctx.fillStyle = '#cfd4d8';
    for (let i = -3; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 9 - 3, -3);
      ctx.lineTo(i * 9, -9);
      ctx.lineTo(i * 9 + 3, -3);
      ctx.fill();
    }
    ctx.restore();
  }
  // Hidden packages: a glinting briefcase.
  for (const pkg of game.side.packages) {
    if (pkg.taken) continue;
    const s = worldToScreen(game, pkg.x, pkg.y);
    if (s.x < -30 || s.x > VIEW.width + 30 || s.y < -30 || s.y > VIEW.height + 30) continue;
    const pulse = 0.6 + Math.sin(game.time * 3 + pkg.x) * 0.25;
    ctx.fillStyle = `rgba(255,214,64,${pulse.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5b12';
    ctx.fillRect(s.x - 7, s.y - 5, 14, 10);
    ctx.fillStyle = '#ffd640';
    ctx.fillRect(s.x - 7, s.y - 1, 14, 2);
  }
}

function drawMarker(ctx, game, marker, color, big = false) {
  if (!marker) return;
  const s = worldToScreen(game, marker.x, marker.y);
  const r = big ? 46 : 30;
  const bob = Math.sin(game.time * 3) * 4;
  // Beam of light so the objective reads from across the street.
  const grad = ctx.createLinearGradient(s.x, s.y - 160, s.x, s.y);
  grad.addColorStop(0, 'rgba(255,214,64,0)');
  grad.addColorStop(1, 'rgba(255,214,64,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(s.x - r * 0.5, s.y - 160, r, 160);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r + bob * 0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(s.x - 9, s.y - r - 16 + bob);
  ctx.lineTo(s.x + 9, s.y - r - 16 + bob);
  ctx.lineTo(s.x, s.y - r - 2 + bob);
  ctx.closePath();
  ctx.fill();
}

function drawLighting(ctx, game) {
  ctx.fillStyle = skyTint(game);
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  if (!lightsOn(game)) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Streetlights at intersections.
  for (const rx of game.city.roadX) {
    for (const ry of game.city.roadY) {
      const s = worldToScreen(game, rx - WORLD.road / 2 - 6, ry - WORLD.road / 2 - 6);
      if (s.x < -120 || s.x > VIEW.width + 120 || s.y < -120 || s.y > VIEW.height + 120) continue;
      const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 85);
      g.addColorStop(0, 'rgba(255,190,90,0.35)');
      g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 85, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Headlight cones.
  for (const car of game.cars) {
    if (car.dead) continue;
    const s = worldToScreen(game, car.x, car.y);
    if (s.x < -160 || s.x > VIEW.width + 160 || s.y < -160 || s.y > VIEW.height + 160) continue;
    const hx = s.x + Math.cos(car.angle) * 90;
    const hy = s.y + Math.sin(car.angle) * 90;
    const g = ctx.createRadialGradient(hx, hy, 4, hx, hy, 95);
    g.addColorStop(0, 'rgba(255,246,200,0.30)');
    g.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hx, hy, 95, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRain(ctx, game) {
  const rain = game.weather.rain;
  if (rain <= 0.03) return;
  ctx.strokeStyle = `rgba(190,215,240,${(0.35 * rain).toFixed(2)})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const n = Math.floor(140 * rain);
  for (let i = 0; i < n; i += 1) {
    const seed = i * 97.3;
    const x = (hash(seed) * VIEW.width + game.time * 160) % VIEW.width;
    const y = (hash(seed + 1) * VIEW.height + game.time * 640) % VIEW.height;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 13);
  }
  ctx.stroke();
}

/** Draw one full frame of the world (HUD lives in the DOM, drawn by hud.js). */
export function renderWorld(ctx, game, markers) {
  const cam = game.camera;
  // Camera shake decays here so every screen gets it.
  const shake = game.settings.shake ? cam.shake : 0;
  const shX = shake > 0 ? (hash(game.time * 60) - 0.5) * shake : 0;
  const shY = shake > 0 ? (hash(game.time * 60 + 9) - 0.5) * shake : 0;
  ctx.save();
  ctx.translate(shX, shY);

  drawGround(ctx, game);
  drawEffects(ctx, game);
  for (const ped of game.peds) drawPed(ctx, game, ped);
  for (const car of game.cars) drawCar(ctx, game, car);
  drawPlayer(ctx, game);
  drawBuildings(ctx, game);
  drawHeli(ctx, game);
  if (markers) {
    drawMarker(ctx, game, markers.mission, '#ffd640', true);
    drawMarker(ctx, game, markers.taxi, '#7be382');
    drawMarker(ctx, game, markers.service, '#6ec3ff');
  }
  drawLighting(ctx, game);
  ctx.restore();
  drawRain(ctx, game);

  // Vignette for a finished, photographic feel.
  const vg = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.55, VIEW.width / 2, VIEW.height / 2, VIEW.height * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  void daylight; void goldenHour;
}
