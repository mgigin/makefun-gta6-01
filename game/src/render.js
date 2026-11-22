// Solmaris Heat — rendering: pseudo-3D sun-soaked city with building shadows,
// shopfront signs, crosswalks, a beach pier, day/night cycle, bay rain,
// police searchlight, and every entity drawn from code (no image assets).
import { TILE, GRID, WORLD, VIEW_W, VIEW_H, COLORS } from './config.js';
import { TILE_KIND } from './city.js';
import { rainSplash } from './effects.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawGround(G, cam) {
    const city = G.city;
    const wet = G.weather.wetness;
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
          : k === TILE_KIND.LOT ? '#4a4a52'
          : COLORS.sidewalk;
        ctx.fillRect(x, y, TILE + 1, TILE + 1);
        if (k === TILE_KIND.ROAD) {
          // Wet sheen while it rains.
          if (wet > 0.05) {
            ctx.fillStyle = `rgba(140,170,220,${0.10 * wet})`;
            ctx.fillRect(x, y, TILE + 1, TILE + 1);
          }
          const horiz = tx % 5 !== 0;
          const vert = ty % 5 !== 0;
          if (horiz && !vert) {
            ctx.fillStyle = COLORS.roadLine;
            ctx.fillRect(x + 8, y + TILE / 2 - 1.5, TILE - 16, 3);
          } else if (vert && !horiz) {
            ctx.fillStyle = COLORS.roadLine;
            ctx.fillRect(x + TILE / 2 - 1.5, y + 8, 3, TILE - 16);
          } else {
            // Intersection: crosswalk stripes on all four arms.
            ctx.fillStyle = 'rgba(240,240,235,0.55)';
            for (let i = 0; i < 4; i++) {
              ctx.fillRect(x + 4 + i * 11, y + 2, 6, 7);
              ctx.fillRect(x + 4 + i * 11, y + TILE - 9, 6, 7);
              ctx.fillRect(x + 2, y + 4 + i * 11, 7, 6);
              ctx.fillRect(x + TILE - 9, y + 4 + i * 11, 7, 6);
            }
          }
        }
        if (k === TILE_KIND.LOT) {
          // Parking bay stripes.
          ctx.fillStyle = 'rgba(240,240,235,0.35)';
          ctx.fillRect(x + 4, y + 4, 2, TILE - 8);
          ctx.fillRect(x + TILE - 6, y + 4, 2, TILE - 8);
          ctx.fillRect(x + 4, y + 4, TILE - 8, 2);
        }
        if (k === TILE_KIND.WATER) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          const wob = Math.sin(G.time * 1.4 + tx * 1.7 + ty) * 4;
          ctx.fillRect(x + 6 + wob, y + 10, 18, 2);
          ctx.fillRect(x + 20 - wob, y + 30, 14, 2);
          // Foam line where the water meets the sand.
          if (ty === GRID - 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(x, y + Math.sin(G.time * 1.1 + tx) * 2, TILE + 1, 3);
          }
        }
        if (k === TILE_KIND.PARK) {
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.fillRect(x, y + TILE / 2 - 2, TILE + 1, 4); // footpath
        }
      }
    }
    // The pier: planks over the water.
    const pier = city.pier;
    if (pier) {
      const px = pier.x - cam.x, py = pier.y - cam.y;
      ctx.fillStyle = '#8a6a44';
      ctx.fillRect(px, py, pier.w, pier.len);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let i = 0; i < 9; i++) ctx.fillRect(px, py + i * (pier.len / 9), pier.w, 2);
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(px - 3, py + pier.len - 10, 5, 12);
      ctx.fillRect(px + pier.w - 2, py + pier.len - 10, 5, 12);
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
    // Spike strips
    for (const s of G.police.spikes) {
      const x = s.x - cam.x, y = s.y - cam.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.angle);
      ctx.fillStyle = '#22252c';
      ctx.fillRect(-20, -3, 40, 6);
      ctx.fillStyle = '#cfd6de';
      for (let i = -18; i <= 18; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, -3); ctx.lineTo(i + 3, -8); ctx.lineTo(i + 6, -3);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawBuildings(G, cam) {
    // Sun shadow direction swings with the time of day.
    const sunA = (G.dayTime - 0.25) * Math.PI; // east at dawn, west at dusk
    const shX = Math.cos(sunA) * 0.55, shY = 0.34;
    const shadowLen = isNight(G) ? 0.12 : 0.3 + Math.abs(Math.cos(sunA)) * 0.35;
    for (const b of G.city.buildings) {
      const x = b.x - cam.x, y = b.y - cam.y;
      if (x + b.w < -120 || y + b.h < -160 || x > VIEW_W + 120 || y > VIEW_H + 120) continue;
      const lift = b.height * 0.38;
      // Ground shadow cast away from the sun.
      ctx.fillStyle = 'rgba(20,26,34,0.28)';
      ctx.beginPath();
      ctx.moveTo(x, y + b.h);
      ctx.lineTo(x + b.w, y + b.h);
      ctx.lineTo(x + b.w + shX * b.height * shadowLen, y + b.h + shY * b.height * shadowLen);
      ctx.lineTo(x + shX * b.height * shadowLen, y + b.h + shY * b.height * shadowLen);
      ctx.closePath();
      ctx.fill();
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
      // Roof by kind.
      ctx.fillStyle = b.roof;
      if (b.roofKind === 'gable') {
        ctx.beginPath();
        ctx.moveTo(x, y - lift + b.h / 2);
        ctx.lineTo(x + b.w / 2, y - lift);
        ctx.lineTo(x + b.w, y - lift + b.h / 2);
        ctx.lineTo(x + b.w, y - lift + b.h);
        ctx.lineTo(x, y - lift + b.h);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(b.roof, -26);
        ctx.beginPath();
        ctx.moveTo(x + b.w / 2, y - lift);
        ctx.lineTo(x + b.w, y - lift + b.h / 2);
        ctx.lineTo(x + b.w, y - lift + b.h);
        ctx.lineTo(x + b.w / 2, y - lift + b.h);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillRect(x, y - lift, b.w, b.h);
        if (b.roofKind === 'terrace') {
          ctx.strokeStyle = shade(b.roof, -30);
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4, y - lift + 4, b.w - 8, b.h - 8);
          ctx.fillStyle = '#3f8f4f';
          ctx.beginPath(); ctx.arc(x + 9, y - lift + 9, 4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + b.w - 9, y - lift + b.h - 9, 4, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y - lift, b.w, b.h);
      // Stepped crown on tall towers.
      if (b.setback) {
        const cw = b.w * b.setback, ch = b.h * b.setback;
        const cx = x + (b.w - cw) / 2, cy = y - lift + (b.h - ch) / 2;
        ctx.fillStyle = shade(b.roof, 14);
        ctx.fillRect(cx, cy - lift * 0.35, cw, ch);
        ctx.strokeRect(cx, cy - lift * 0.35, cw, ch);
      }
      // Roof details: AC units / water tower.
      ctx.fillStyle = shade(b.roof, -22);
      if (b.seed > 0.5) ctx.fillRect(x + 6, y - lift + 6, 9, 7);
      if (b.roofKind === 'waterTower') {
        ctx.fillStyle = '#7a5a38';
        ctx.beginPath(); ctx.arc(x + b.w - 10, y - lift + 10, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5d4429';
        ctx.beginPath(); ctx.arc(x + b.w - 10, y - lift + 10, 3, 0, Math.PI * 2); ctx.fill();
      } else if (b.seed > 0.75) {
        ctx.beginPath(); ctx.arc(x + b.w - 9, y - lift + 9, 4.5, 0, Math.PI * 2); ctx.fill();
      }
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
      // Shopfront awning + sign at street level.
      if (b.awning) {
        ctx.fillStyle = b.awning;
        ctx.fillRect(x + 2, y + b.h - 7, b.w - 4, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 5; i++) ctx.fillRect(x + 4 + i * ((b.w - 8) / 5), y + b.h - 7, 3, 6);
      }
      if (b.sign) {
        ctx.fillStyle = 'rgba(16,20,30,0.85)';
        ctx.fillRect(x + 3, y + b.h - 16, b.w - 6, 8);
        ctx.fillStyle = '#ffd98a';
        ctx.font = 'bold 6.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.sign, x + b.w / 2, y + b.h - 9.6);
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
      } else if (p.kind === 'towel') {
        const cols = ['#e85c5c', '#5c9de8', '#e8c85c', '#5ce08a', '#c85ce8', '#e88a5c'];
        ctx.fillStyle = cols[p.hue % cols.length];
        ctx.fillRect(x - 7, y - 4, 14, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(x - 7, y - 1, 14, 2);
      } else if (p.kind === 'dumpster') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle || 0);
        ctx.fillStyle = '#2e5d46';
        ctx.fillRect(-11, -6, 22, 12);
        ctx.fillStyle = '#24493a';
        ctx.fillRect(-11, -6, 22, 4);
        ctx.restore();
      } else if (p.kind === 'hydrant') {
        ctx.fillStyle = '#c8433c';
        ctx.fillRect(x - 2.5, y - 5, 5, 7);
        ctx.beginPath(); ctx.arc(x, y - 5, 2.6, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'busstop') {
        ctx.fillStyle = '#3a3f47';
        ctx.fillRect(x - 1, y - 12, 2, 13);
        ctx.fillStyle = '#ffd93f';
        ctx.fillRect(x - 5, y - 16, 10, 5);
        ctx.fillStyle = '#222';
        ctx.font = 'bold 4px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BUS', x, y - 12.4);
      } else if (p.kind === 'newsstand') {
        ctx.fillStyle = '#5d6d7d';
        ctx.fillRect(x - 7, y - 5, 14, 10);
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(x - 5, y - 3, 4, 6);
        ctx.fillRect(x + 1, y - 3, 4, 6);
      } else if (p.kind === 'fountain') {
        ctx.fillStyle = '#b8c4cc';
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2e7fb8';
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const sp = Math.sin(G.time * 6 + p.x) * 1.5;
        ctx.beginPath(); ctx.arc(x, y - 3 + sp * 0.3, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawCar(G, car, cam) {
    const x = car.x - cam.x, y = car.y - cam.y;
    if (x < -80 || y < -80 || x > VIEW_W + 80 || y > VIEW_H + 80) return;
    const kind = car.model.kind || 'sedan';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(-22, -9, 46, 20, 6); ctx.fill();
    // Body by kind
    ctx.fillStyle = car.color;
    if (kind === 'van' || kind === 'suv') roundRect(-22, -10.5, 44, 21, 5);
    else if (kind === 'pickup') roundRect(-22, -10, 44, 20, 5);
    else roundRect(-22, -10, 44, 20, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();
    // Cabin + windows per kind
    ctx.fillStyle = shade(car.color, -14);
    if (kind === 'van') {
      roundRect(-20, -8.5, 38, 17, 3); ctx.fill();
      ctx.fillStyle = 'rgba(30,45,60,0.85)';
      roundRect(12, -7.5, 6, 15, 2); ctx.fill();
    } else if (kind === 'pickup') {
      roundRect(2, -8, 14, 16, 3); ctx.fill();
      ctx.fillStyle = shade(car.color, -30);
      ctx.fillRect(-20, -8, 18, 16); // open bed
      ctx.fillStyle = 'rgba(30,45,60,0.85)';
      roundRect(12, -7.5, 5, 15, 2); ctx.fill();
    } else if (kind === 'convertible') {
      roundRect(-8, -8, 16, 16, 4); ctx.fill();
      ctx.fillStyle = '#2a2a30';
      roundRect(-6, -6.5, 11, 13, 3); ctx.fill(); // open top
      ctx.fillStyle = 'rgba(30,45,60,0.85)';
      roundRect(6, -7.5, 4, 15, 2); ctx.fill();
    } else if (kind === 'suv') {
      roundRect(-14, -8.5, 26, 17, 3); ctx.fill();
      ctx.fillStyle = 'rgba(30,45,60,0.85)';
      roundRect(8, -7.5, 5, 15, 2); ctx.fill();
      roundRect(-16, -7.5, 4, 15, 2); ctx.fill();
    } else if (kind === 'hatch') {
      roundRect(-12, -8, 22, 16, 4); ctx.fill();
      ctx.fillStyle = 'rgba(30,45,60,0.85)';
      roundRect(6, -7.5, 5, 15, 2); ctx.fill();
      roundRect(-14, -7.5, 4, 15, 2); ctx.fill();
    } else {
      roundRect(-9, -8, 18, 16, 4); ctx.fill();
      ctx.fillStyle = 'rgba(30,45,60,0.85)';
      roundRect(5, -7.5, 6, 15, 2); ctx.fill();
      roundRect(-13, -7.5, 4, 15, 2); ctx.fill();
    }
    // Racing stripe on coupes
    if (kind === 'coupe') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-21, -2, 42, 4);
    }
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
    if (car.spiked) {
      ctx.fillStyle = 'rgba(20,20,20,0.5)';
      for (const [wx, wy] of [[13, -11], [13, 8], [-14, -11], [-14, 8]]) ctx.fillRect(wx - 1, wy - 0.5, 9, 4.4);
    }
    if (car.dead) {
      ctx.fillStyle = 'rgba(20,20,20,0.55)';
      roundRect(-22, -10, 44, 20, 6); ctx.fill();
    }
    ctx.restore();
    // Siren glow washing the street at dusk/night.
    if (car.isPolice && car.driver === 'police' && nightAlpha(G) > 0.05) {
      const phase = Math.floor(G.time * 6 + car.id) % 2 === 0;
      const g = ctx.createRadialGradient(x, y, 6, x, y, 95);
      g.addColorStop(0, phase ? 'rgba(255,70,60,0.30)' : 'rgba(70,130,255,0.30)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 95, 0, Math.PI * 2); ctx.fill();
    }
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
    const cowering = e.state === 'cower';
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
    const squash = cowering ? 0.72 : 1;
    // Legs
    ctx.fillStyle = '#2e3440';
    ctx.fillRect(-3 + step * 0.4, -6.5, 5, 4);
    ctx.fillRect(-3 - step * 0.4, 2.5, 5, 4);
    // Body (cowering peds hunch down)
    ctx.fillStyle = opts.shirt || '#888';
    roundRect(-6 * squash, -6 * squash, 12 * squash, 12 * squash, 5); ctx.fill();
    // Head
    ctx.fillStyle = opts.skin || '#d9a06b';
    ctx.beginPath(); ctx.arc(1 * squash, 0, 4.6 * squash, 0, Math.PI * 2); ctx.fill();
    if (opts.cap) {
      ctx.fillStyle = '#1d3f7d';
      ctx.beginPath(); ctx.arc(1, 0, 4.8, -1.2, 1.2); ctx.fill();
      ctx.fillRect(3, -2, 4, 4);
    }
    if (opts.gun) {
      ctx.fillStyle = '#14161a';
      ctx.fillRect(6, -1.4, 10, 2.8);
    }
    if (opts.bat) {
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(5, 3); ctx.lineTo(13, -4); ctx.stroke();
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
        ctx.fillStyle = `rgba(210,210,215,${0.38 * k})`;
        ctx.beginPath(); ctx.arc(x, y, pt.size, 0, Math.PI * 2); ctx.fill();
      } else if (pt.kind === 'darksmoke') {
        ctx.fillStyle = `rgba(50,50,56,${0.42 * k})`;
        ctx.beginPath(); ctx.arc(x, y, pt.size, 0, Math.PI * 2); ctx.fill();
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
      } else if (pt.kind === 'splash') {
        ctx.strokeStyle = `rgba(200,225,255,${0.6 * k})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(x, y, pt.size * (1.6 - k), pt.size * 0.5 * (1.6 - k), 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  // Police helicopter: body, spinning rotor, and the searchlight cone.
  function drawHelicopter(G, cam) {
    const h = G.air.heli;
    if (!h) return;
    const x = h.x - cam.x, y = h.y - cam.y;
    const sx = h.spotX - cam.x, sy = h.spotY - cam.y;
    // Searchlight cone + lit pool on the ground.
    const g = ctx.createLinearGradient(x, y, sx, sy);
    g.addColorStop(0, 'rgba(255,246,200,0.34)');
    g.addColorStop(1, 'rgba(255,246,200,0.05)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(sx - 85, sy);
    ctx.lineTo(sx + 85, sy);
    ctx.closePath(); ctx.fill();
    const pool = ctx.createRadialGradient(sx, sy, 6, sx, sy, 88);
    pool.addColorStop(0, 'rgba(255,246,200,0.30)');
    pool.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.arc(sx, sy, 88, 0, Math.PI * 2); ctx.fill();
    // Airframe shadow on the ground.
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.ellipse(x + 26, y + 34, 34, 13, h.angle, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(h.angle);
    // Tail boom + fin
    ctx.fillStyle = '#243447';
    ctx.fillRect(-44, -2.5, 30, 5);
    ctx.fillRect(-48, -8, 5, 16);
    // Fuselage
    ctx.fillStyle = '#e8ecf2';
    roundRect(-16, -9, 34, 18, 8); ctx.fill();
    ctx.fillStyle = '#1d3f7d';
    ctx.fillRect(-16, -9, 34, 4.5);
    ctx.fillRect(-16, 4.5, 34, 4.5);
    ctx.fillStyle = 'rgba(30,45,60,0.9)';
    roundRect(8, -7, 9, 14, 3); ctx.fill();
    ctx.fillStyle = '#1d3f7d';
    ctx.font = 'bold 5.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', -2, 2);
    // Skids
    ctx.strokeStyle = '#3a3f47';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(14, 12); ctx.stroke();
    // Main rotor (two blurred blades)
    ctx.strokeStyle = 'rgba(30,34,40,0.75)';
    ctx.lineWidth = 3;
    const ra = h.rotor;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ra) * -42, Math.sin(ra) * -42);
    ctx.lineTo(Math.cos(ra) * 42, Math.sin(ra) * 42);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,34,40,0.35)';
    ctx.beginPath();
    ctx.moveTo(Math.cos(ra + 0.5) * -42, Math.sin(ra + 0.5) * -42);
    ctx.lineTo(Math.cos(ra + 0.5) * 42, Math.sin(ra + 0.5) * 42);
    ctx.stroke();
    // Tail rotor
    ctx.strokeStyle = 'rgba(30,34,40,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-46, Math.sin(h.rotor * 2) * -7);
    ctx.lineTo(-46, Math.sin(h.rotor * 2) * 7);
    ctx.stroke();
    ctx.restore();
  }

  // Rain: slanted streaks across the screen plus splashes on the ground.
  function drawRain(G, cam) {
    const w = G.weather;
    if (w.wetness <= 0.02) return;
    ctx.strokeStyle = `rgba(190,215,245,${0.4 * w.wetness})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const slant = 7;
    for (let i = 0; i < 90 * w.wetness; i++) {
      const rx = ((i * 173 + G.time * 640) % (VIEW_W + 60)) - 30;
      const ry = ((i * 269 + G.time * 980) % (VIEW_H + 40)) - 20;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - slant, ry + 15);
    }
    ctx.stroke();
    // Occasional splash rings near the camera.
    if (Math.random() < 0.5) {
      rainSplash(G, cam.x + Math.random() * VIEW_W, cam.y + Math.random() * VIEW_H);
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

  // Warm tint at dawn and dusk, the golden hours over the bay.
  function duskAlpha(G) {
    const t = G.dayTime;
    const dawn = Math.max(0, 1 - Math.abs(t - 0.28) / 0.06);
    const dusk = Math.max(0, 1 - Math.abs(t - 0.75) / 0.06);
    return Math.max(dawn, dusk) * 0.16;
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
      for (const ped of G.peds) {
        if (ped.hidden) continue;
        drawables.push({ y: ped.y, fn: () => drawPerson(G, ped, cam, { shirt: ped.shirt, skin: ped.skin, cap: ped.state === 'cop' }) });
      }
      for (const e of G.combat.enemies) {
        drawables.push({ y: e.y, fn: () => drawPerson(G, e, cam, { shirt: '#3a3a44', skin: '#d9a06b', gun: e.kind === 'shooter' && e.state !== 'down', bat: e.kind === 'rusher' && e.state !== 'down' }) });
      }
      const p = G.player;
      if (p.mode === 'foot' && !p.dead) {
        drawables.push({ y: p.y + 1, fn: () => drawPerson(G, p, cam, { shirt: '#e8b13c', skin: '#d9a06b', gun: p.weapon !== 'fists' }) });
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
      drawHelicopter(G, cam);

      // Day/night tint + golden hour + hurt flash + vignette
      const na = nightAlpha(G);
      if (na > 0) {
        ctx.fillStyle = `rgba(10,16,48,${na})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      const da = duskAlpha(G);
      if (da > 0) {
        ctx.fillStyle = `rgba(255,140,60,${da})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      // Rain darkens the light a little.
      if (G.weather.wetness > 0.05) {
        ctx.fillStyle = `rgba(40,55,80,${0.14 * G.weather.wetness})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      if (G.fx.hurtFlash > 0) {
        ctx.fillStyle = `rgba(200,30,40,${G.fx.hurtFlash * 0.5})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      drawRain(G, cam);
      const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.55, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // Aim crosshair
      if (G.state === 'play' && p.mode === 'foot' && p.weapon !== 'fists') {
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
