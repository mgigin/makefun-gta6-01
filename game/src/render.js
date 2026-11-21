// Solmaris Heat — rendering: pseudo-3D city, day cycle, entities, effects, markers.
import { TILE, GRID, WORLD, VIEW_W, VIEW_H, COLORS } from './config.js';
import { TILE_KIND } from './city.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawGround(G, cam) {
    const city = G.city;
    const t0x = Math.max(0, Math.floor(cam.x / TILE) - 1), t1x = Math.min(GRID - 1, Math.floor((cam.x + VIEW_W) / TILE) + 1);
    const t0y = Math.max(0, Math.floor(cam.y / TILE) - 1), t1y = Math.min(GRID - 1, Math.floor((cam.y + VIEW_H) / TILE) + 1);
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const k = city.tiles[ty][tx];
        const x = tx * TILE - cam.x, y = ty * TILE - cam.y;
        ctx.fillStyle = k === TILE_KIND.ROAD ? COLORS.road
          : k === TILE_KIND.WATER ? COLORS.water
          : k === TILE_KIND.SAND ? COLORS.sand
          : k === TILE_KIND.PARK ? COLORS.grass
          : k === TILE_KIND.PLAZA ? COLORS.plaza
          : COLORS.sidewalk;
        ctx.fillRect(x, y, TILE + 1, TILE + 1);
        if (k === TILE_KIND.ROAD) {
          // Center dashes on straight road tiles.
          ctx.fillStyle = COLORS.roadLine;
          const horiz = tx % 5 !== 0;
          const vert = ty % 5 !== 0;
          if (horiz && !vert) ctx.fillRect(x + 8, y + TILE / 2 - 1.5, TILE - 16, 3);
          if (vert && !horiz) ctx.fillRect(x + TILE / 2 - 1.5, y + 8, 3, TILE - 16);
        }
        if (k === TILE_KIND.WATER) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          const wob = Math.sin(G.time * 1.4 + tx * 1.7 + ty) * 4;
          ctx.fillRect(x + 6 + wob, y + 10, 18, 2);
          ctx.fillRect(x + 20 - wob, y + 30, 14, 2);
        }
      }
    }
    // Skid marks
    ctx.strokeStyle = 'rgba(20,20,20,0.5)';
    ctx.lineWidth = 3;
    for (const s of G.skids) {
      ctx.beginPath();
      ctx.moveTo(s.x1 - cam.x, s.y1 - cam.y);
      ctx.lineTo(s.x2 - cam.x, s.y2 - cam.y);
      ctx.stroke();
    }
  }

  function drawBuildings(G, cam) {
    for (const b of G.city.buildings) {
      const x = b.x - cam.x, y = b.y - cam.y;
      if (x + b.w < -80 || y + b.h < -120 || x > VIEW_W + 80 || y > VIEW_H + 80) continue;
      const lift = b.height * 0.38;
      // South wall (darker), east wall, roof.
      ctx.fillStyle = shade(b.wall, -38);
      ctx.fillRect(x, y + b.h - lift, b.w, lift);
      ctx.fillStyle = shade(b.wall, -18);
      ctx.beginPath();
      ctx.moveTo(x + b.w, y - lift);
      ctx.lineTo(x + b.w, y + b.h - lift);
      ctx.lineTo(x + b.w, y + b.h);
      ctx.lineTo(x + b.w, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = b.roof;
      ctx.fillRect(x, y - lift, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.strokeRect(x, y - lift, b.w, b.h);
      // Roof details: AC units / water tower on some.
      ctx.fillStyle = shade(b.roof, -22);
      if (b.seed > 0.5) ctx.fillRect(x + 6, y - lift + 6, 9, 7);
      if (b.seed > 0.75) { ctx.beginPath(); ctx.arc(x + b.w - 9, y - lift + 9, 4.5, 0, Math.PI * 2); ctx.fill(); }
      // Windows on the south wall.
      const lit = isNight(G);
      ctx.fillStyle = lit ? 'rgba(255,214,120,0.9)' : 'rgba(40,60,80,0.55)';
      const cols = b.windows + 1;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < Math.max(1, Math.floor(lift / 13)); j++) {
          if (((i * 7 + j * 3 + Math.floor(b.seed * 10)) % 3) === 0) continue;
          ctx.fillRect(x + 4 + i * ((b.w - 8) / cols), y + b.h - lift + 3 + j * 13, 5, 7);
        }
      }
    }
  }

  function drawProps(G, cam) {
    for (const p of G.city.props) {
      const x = p.x - cam.x, y = p.y - cam.y;
      if (x < -40 || y < -40 || x > VIEW_W + 40 || y > VIEW_H + 40) continue;
      if (p.kind === 'palm' || p.kind === 'tree') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(x + 4, y + 5, 10 * p.s, 5 * p.s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = p.kind === 'palm' ? '#3f8f4f' : '#2f7d3a';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + p.x * 0.01;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * 7 * p.s, y + Math.sin(a) * 5 * p.s - 6, 8 * p.s, 3.4 * p.s, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#6b4a2a';
        ctx.fillRect(x - 1.5, y - 6, 3, 8);
      } else if (p.kind === 'lamp') {
        ctx.fillStyle = '#3a3f47';
        ctx.fillRect(x - 1, y - 8, 2, 9);
        ctx.fillStyle = isNight(G) ? '#ffe9a0' : '#c8ccd0';
        ctx.beginPath(); ctx.arc(x, y - 9, 2.6, 0, Math.PI * 2); ctx.fill();
        if (isNight(G)) {
          const g = ctx.createRadialGradient(x, y - 9, 2, x, y - 9, 34);
          g.addColorStop(0, 'rgba(255,220,130,0.28)');
          g.addColorStop(1, 'rgba(255,220,130,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y - 9, 34, 0, Math.PI * 2); ctx.fill();
        }
      } else if (p.kind === 'bench') {
        ctx.fillStyle = '#7a5a38';
        ctx.fillRect(x - 9, y - 3, 18, 6);
      } else if (p.kind === 'umbrella') {
        const cols = ['#e85c5c', '#5c9de8', '#e8c85c', '#5ce08a', '#c85ce8', '#e88a5c'];
        ctx.fillStyle = cols[p.hue % cols.length];
        ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawCar(G, car, cam) {
    const x = car.x - cam.x, y = car.y - cam.y;
    if (x < -80 || y < -80 || x > VIEW_W + 80 || y > VIEW_H + 80) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(-22, -9, 46, 20, 6); ctx.fill();
    // Body
    ctx.fillStyle = car.color;
    roundRect(-22, -10, 44, 20, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();
    // Cabin + windows
    ctx.fillStyle = shade(car.color, -14);
    roundRect(-9, -8, 18, 16, 4); ctx.fill();
    ctx.fillStyle = 'rgba(30,45,60,0.85)';
    roundRect(5, -7.5, 6, 15, 2); ctx.fill();
    roundRect(-13, -7.5, 4, 15, 2); ctx.fill();
    // Wheels
    ctx.fillStyle = '#14161a';
    for (const [wx, wy] of [[13, -11], [13, 8], [-14, -11], [-14, 8]]) ctx.fillRect(wx, wy, 7, 3.4);
    // Lights
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(20, -8, 3, 4); ctx.fillRect(20, 4, 3, 4);
    ctx.fillStyle = '#e83c3c';
    ctx.fillRect(-23, -8, 2.4, 4); ctx.fillRect(-23, 4, 2.4, 4);
    if (car.isPolice) {
      ctx.fillStyle = '#1d3f7d';
      ctx.fillRect(-22, -10, 44, 5);
      ctx.fillRect(-22, 5, 44, 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 2.4);
      // Light bar flashing
      const phase = Math.floor(G.time * 6 + car.id) % 2 === 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#7d1d1d';
      ctx.fillRect(-3, -6, 6, 5);
      ctx.fillStyle = phase ? '#1d4d9e' : '#3b82ff';
      ctx.fillRect(-3, 1, 6, 5);
    }
    if (car.isTaxi) {
      ctx.fillStyle = '#222';
      ctx.fillRect(-3, -3.5, 6, 7);
      ctx.fillStyle = '#ffd93f';
      ctx.font = 'bold 4.6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 1.8);
    }
    if (car.dead) {
      ctx.fillStyle = 'rgba(20,20,20,0.55)';
      roundRect(-22, -10, 44, 20, 6); ctx.fill();
    }
    ctx.restore();
    // Headlight cone at night
    if (isNight(G) && !car.dead) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(car.angle);
      const g = ctx.createLinearGradient(20, 0, 120, 0);
      g.addColorStop(0, 'rgba(255,240,180,0.20)');
      g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(20, -7); ctx.lineTo(120, -26); ctx.lineTo(120, 26); ctx.lineTo(20, 7);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawPerson(G, e, cam, opts = {}) {
    const x = e.x - cam.x, y = e.y - cam.y;
    if (x < -40 || y < -40 || x > VIEW_W + 40 || y > VIEW_H + 40) return;
    const down = e.state === 'down';
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 4, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    if (down) {
      ctx.rotate(e.angle || 0);
      ctx.fillStyle = opts.shirt || '#888';
      roundRect(-11, -4.5, 20, 9, 4); ctx.fill();
      ctx.fillStyle = opts.skin || '#d9a06b';
      ctx.beginPath(); ctx.arc(12, 0, 4.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(e.angle || 0);
    const step = Math.sin(e.walkPhase || 0) * 3.4;
    // Legs
    ctx.fillStyle = '#2e3440';
    ctx.fillRect(-3 + step * 0.4, -6.5, 5, 4);
    ctx.fillRect(-3 - step * 0.4, 2.5, 5, 4);
    // Body
    ctx.fillStyle = opts.shirt || '#888';
    roundRect(-6, -6, 12, 12, 5); ctx.fill();
    // Head
    ctx.fillStyle = opts.skin || '#d9a06b';
    ctx.beginPath(); ctx.arc(1, 0, 4.6, 0, Math.PI * 2); ctx.fill();
    if (opts.gun) {
      ctx.fillStyle = '#14161a';
      ctx.fillRect(6, -1.4, 10, 2.8);
    }
    ctx.restore();
  }

  function drawMarker(G, cam) {
    const m = G.missions.marker;
    if (!m) return;
    const x = m.x - cam.x, y = m.y - cam.y;
    const pulse = 1 + Math.sin(G.time * 4) * 0.12;
    ctx.strokeStyle = m.kind === 'race' ? '#5ce08a' : m.kind === 'taxi' ? '#ffd93f' : '#ffe14d';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,225,77,0.16)';
    ctx.beginPath(); ctx.arc(x, y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    // Light pillar
    const g = ctx.createLinearGradient(x, y - 90, x, y);
    g.addColorStop(0, 'rgba(255,225,77,0)');
    g.addColorStop(1, 'rgba(255,225,77,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 7, y - 90, 14, 90);
    // Off-screen arrow
    if (x < -20 || y < -20 || x > VIEW_W + 20 || y > VIEW_H + 20) {
      const cx = Math.max(30, Math.min(VIEW_W - 30, x));
      const cy = Math.max(30, Math.min(VIEW_H - 30, y));
      const a = Math.atan2(y - VIEW_H / 2, x - VIEW_W / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawPickups(G, cam) {
    for (const pk of G.combat.pickups) {
      const x = pk.x - cam.x, y = pk.y - cam.y;
      if (x < -30 || y < -30 || x > VIEW_W + 30 || y > VIEW_H + 30) continue;
      const bob = Math.sin(G.time * 3 + pk.x) * 2;
      ctx.save();
      ctx.translate(x, y + bob);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#fff'; roundRect(-8, -8, 16, 16, 3); ctx.fill();
        ctx.fillStyle = '#e83c3c'; ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4);
      } else if (pk.kind === 'armor') {
        ctx.fillStyle = '#4f8fd8'; roundRect(-8, -8, 16, 16, 3); ctx.fill();
        ctx.fillStyle = '#dbeafe'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('A', 0, 4);
      } else if (pk.kind === 'cash') {
        ctx.fillStyle = '#3fae4f'; roundRect(-9, -6, 18, 12, 2); ctx.fill();
        ctx.fillStyle = '#d8ffd8'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', 0, 3.4);
      } else if (pk.kind === 'package') {
        ctx.fillStyle = '#c8952e'; roundRect(-7, -7, 14, 14, 2); ctx.fill();
        ctx.strokeStyle = '#7a5a14'; ctx.strokeRect(-7, -7, 14, 14);
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawParticles(G, cam) {
    for (const pt of G.particles) {
      const x = pt.x - cam.x, y = pt.y - cam.y;
      const k = 1 - pt.t / pt.life;
      if (pt.kind === 'smoke') {
        ctx.fillStyle = `rgba(60,60,66,${0.35 * k})`;
        ctx.beginPath(); ctx.arc(x, y, pt.size * (1.6 - k * 0.6), 0, Math.PI * 2); ctx.fill();
      } else if (pt.kind === 'fire') {
        ctx.fillStyle = `rgba(255,${120 + Math.floor(k * 100)},40,${0.8 * k})`;
        ctx.beginPath(); ctx.arc(x, y, pt.size * k, 0, Math.PI * 2); ctx.fill();
      } else if (pt.kind === 'spark') {
        ctx.fillStyle = `rgba(255,210,90,${k})`;
        ctx.fillRect(x - 1.4, y - 1.4, 2.8, 2.8);
      } else if (pt.kind === 'flash') {
        ctx.fillStyle = `rgba(255,230,150,${k})`;
        ctx.beginPath(); ctx.arc(x, y, pt.size, 0, Math.PI * 2); ctx.fill();
      } else if (pt.kind === 'blood') {
        ctx.fillStyle = `rgba(170,30,40,${0.5 * k})`;
        ctx.beginPath(); ctx.arc(x, y, pt.size, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function isNight(G) {
    const t = G.dayTime;
    return t < 0.26 || t > 0.78;
  }

  function nightAlpha(G) {
    const t = G.dayTime;
    if (t > 0.3 && t < 0.72) return 0;
    if (t >= 0.72 && t < 0.82) return (t - 0.72) / 0.1 * 0.42;
    if (t >= 0.82 || t < 0.18) return 0.42;
    return (0.3 - t) / 0.12 * 0.42;
  }

  return {
    isNight,
    render(G) {
      const cam = G.camera;
      ctx.fillStyle = '#101820';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawGround(G, cam);
      drawPickups(G, cam);
      drawProps(G, cam);
      drawBuildings(G, cam);
      drawMarker(G, cam);

      // Entities sorted by y for overlap sanity.
      const drawables = [];
      for (const car of G.cars) drawables.push({ y: car.y, fn: () => drawCar(G, car, cam) });
      for (const ped of G.peds) if (!ped.hidden) drawables.push({ y: ped.y, fn: () => drawPerson(G, ped, cam, { shirt: ped.shirt, skin: ped.skin }) });
      for (const e of G.combat.enemies) drawables.push({ y: e.y, fn: () => drawPerson(G, e, cam, { shirt: '#3a3a44', skin: '#d9a06b', gun: e.state !== 'down' }) });
      const p = G.player;
      if (p.mode === 'foot' && !p.dead) {
        drawables.push({ y: p.y + 1, fn: () => drawPerson(G, p, cam, { shirt: '#e8b13c', skin: '#d9a06b', gun: p.weapon === 'pistol' }) });
      }
      drawables.sort((a, b) => a.y - b.y);
      for (const d of drawables) d.fn();

      // Tracers
      ctx.strokeStyle = 'rgba(255,240,180,0.85)';
      ctx.lineWidth = 1.6;
      for (const b of G.combat.bullets) {
        ctx.beginPath();
        ctx.moveTo(b.x1 - cam.x, b.y1 - cam.y);
        ctx.lineTo(b.x2 - cam.x, b.y2 - cam.y);
        ctx.stroke();
      }

      drawParticles(G, cam);

      // Day/night tint + hurt flash + vignette
      const na = nightAlpha(G);
      if (na > 0) {
        ctx.fillStyle = `rgba(10,16,48,${na})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      if (G.fx.hurtFlash > 0) {
        ctx.fillStyle = `rgba(200,30,40,${G.fx.hurtFlash * 0.5})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.55, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // Aim crosshair
      if (G.state === 'play' && p.mode === 'foot' && p.weapon === 'pistol') {
        const mx = G.input.mouseX, my = G.input.mouseY;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my);
        ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
        ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5);
        ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13);
        ctx.stroke();
      }
    },
  };
}
