// Solmaris Heat — combat: pistol and scattergun fire, punches, Ledger gang
// enemies (shooters who keep their distance, rushers who close in swinging),
// damage, pickups and hidden packages.
import { WEAPONS } from './config.js';
import { hurtPed } from './pedestrians.js';
import { damageCar } from './vehicles.js';
import { rngRange } from './random.js';
import { muzzleFlash, bloodPuff } from './effects.js';

export function createCombat() {
  return {
    bullets: [],   // tracers for rendering
    enemies: [],   // hostile gang members (mission-spawned)
    pickups: [],   // {x,y,kind:'health'|'armor'|'cash'|'package'}

    // One raycast shot; returns the distance the tracer travels.
    fireRay(G, angle, range, damage) {
      const p = G.player;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      let hitDist = range;
      // Buildings block shots.
      for (let d = 14; d < range; d += 10) {
        const x = p.x + dx * d, y = p.y + dy * d;
        if (G.pointInBuilding(x, y)) { hitDist = d; break; }
      }
      const hitTest = (o, r) => {
        const ox = o.x - p.x, oy = o.y - p.y;
        const along = ox * dx + oy * dy;
        if (along < 0 || along > hitDist) return false;
        const perp = Math.abs(ox * -dy + oy * dx);
        return perp < r;
      };
      for (const e of this.enemies) {
        if (e.state !== 'down' && hitTest(e, 13)) { this.hurtEnemy(G, e, damage); return Math.hypot(e.x - p.x, e.y - p.y); }
      }
      for (const ped of G.peds) {
        if (ped.state !== 'down' && !ped.hidden && hitTest(ped, 11)) { hurtPed(G, ped, damage, null); return Math.hypot(ped.x - p.x, ped.y - p.y); }
      }
      for (const car of G.cars) {
        if (hitTest(car, 24)) {
          damageCar(G, car, 7);
          if (car.isPolice) G.police.addCrime(G, 'hitCop');
          return Math.hypot(car.x - p.x, car.y - p.y);
        }
      }
      return hitDist;
    },

    shoot(G) {
      const p = G.player;
      const w = WEAPONS[p.weapon];
      if (!w || p.weapon === 'fists' || p.ammo <= 0 || p.shootCd > 0 || p.mode !== 'foot') return;
      p.shootCd = w.rate;
      p.ammo--;
      G.stats.shotsFired++;
      G.fx.lastShotAt = G.time;
      G.audio.shot(false, p.weapon === 'scattergun');
      G.fx.shake = Math.min(6, G.fx.shake + (p.weapon === 'scattergun' ? 2.4 : 1.2));
      const pellets = w.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const spread = p.weapon === 'scattergun'
          ? rngRange(Math.random, -0.11, 0.11)
          : rngRange(Math.random, -0.035, 0.035);
        const a = p.angle + spread;
        const dist = this.fireRay(G, a, w.range, w.damage);
        this.bullets.push({
          x1: p.x + Math.cos(a) * 16, y1: p.y + Math.sin(a) * 16,
          x2: p.x + Math.cos(a) * dist, y2: p.y + Math.sin(a) * dist, t: 0,
        });
      }
      muzzleFlash(G, p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18, p.angle);
      G.police.addCrime(G, 'shoot');
    },

    punch(G) {
      const p = G.player;
      if (p.mode !== 'foot' || p.punchCd > 0) return;
      p.punchCd = 0.38;
      G.audio.punch();
      const fx = p.x + Math.cos(p.angle) * 20, fy = p.y + Math.sin(p.angle) * 20;
      for (const e of this.enemies) {
        if (e.state !== 'down' && Math.hypot(e.x - fx, e.y - fy) < 24) { this.hurtEnemy(G, e, 16); return; }
      }
      for (const ped of G.peds) {
        if (ped.state !== 'down' && !ped.hidden && Math.hypot(ped.x - fx, ped.y - fy) < 22) {
          hurtPed(G, ped, 16, null);
          G.police.addCrime(G, 'assault');
          return;
        }
      }
    },

    hurtEnemy(G, e, amount) {
      e.health -= amount;
      e.aggro = true;
      bloodPuff(G, e.x, e.y);
      if (e.health <= 0 && e.state !== 'down') {
        e.state = 'down';
        e.downAt = G.time;
        G.stats.enemiesDown++;
        this.pickups.push({ x: e.x, y: e.y, kind: 'cash', amount: 40 + Math.floor(Math.random() * 60) });
        G.missions.onEnemyDown(e);
      }
    },

    damagePlayer(G, amount, cause) {
      const p = G.player;
      if (p.dead || G.state !== 'play') return;
      let left = amount;
      if (p.armor > 0) {
        const absorbed = Math.min(p.armor, left * 0.7);
        p.armor -= absorbed;
        left -= absorbed;
      }
      p.health -= left;
      G.fx.hurtFlash = 0.35;
      G.audio.hurt();
      if (p.health <= 0) {
        p.health = 0;
        G.onWasted(cause);
      }
    },

    spawnEnemy(G, x, y, kind = 'shooter') {
      const e = {
        x, y, angle: 0, kind,
        health: kind === 'rusher' ? 80 : 60,
        state: 'idle', aggro: false,
        shootCd: rngRange(Math.random, 0.5, 1.5),
        swingCd: 0,
        walkPhase: 0,
        speed: kind === 'rusher' ? 150 : 105,
      };
      this.enemies.push(e);
      return e;
    },

    update(G, dt) {
      const p = G.player;
      // Tracers fade.
      this.bullets = this.bullets.filter((b) => (b.t += dt) < 0.07);
      // Enemies: shooters keep range and fire; rushers close in and swing.
      for (const e of this.enemies) {
        if (e.state === 'down') continue;
        e.walkPhase += dt * 10;
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < 300) e.aggro = true;
        if (!e.aggro) continue;
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        if (e.kind === 'rusher') {
          if (d > 26) {
            e.x += Math.cos(e.angle) * e.speed * dt;
            e.y += Math.sin(e.angle) * e.speed * dt;
            G.collide(e, 9);
          } else {
            e.swingCd -= dt;
            if (e.swingCd <= 0) {
              e.swingCd = 0.7;
              G.audio.punch();
              this.damagePlayer(G, 11, 'beaten down');
            }
          }
        } else {
          if (d > 130) {
            e.x += Math.cos(e.angle) * e.speed * dt;
            e.y += Math.sin(e.angle) * e.speed * dt;
            G.collide(e, 9);
          }
          e.shootCd -= dt;
          if (e.shootCd <= 0 && d < 320) {
            e.shootCd = rngRange(Math.random, 0.7, 1.4);
            G.audio.shot(true);
            G.fx.lastShotAt = G.time;
            const a = e.angle + rngRange(Math.random, -0.09, 0.09);
            this.bullets.push({ x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * d, y2: e.y + Math.sin(a) * d, t: 0 });
            muzzleFlash(G, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, a);
            if (Math.random() < 0.42) this.damagePlayer(G, p.mode === 'car' ? 4 : 9, 'shot');
          }
        }
      }
      this.enemies = this.enemies.filter((e) => e.state !== 'down' || G.time - (e.downAt || 0) < 20);

      // Pickups.
      for (const pk of this.pickups) {
        if (Math.hypot(pk.x - p.x, pk.y - p.y) < 26) {
          pk.taken = true;
          if (pk.kind === 'health') { p.health = Math.min(100, p.health + 50); G.hud.feed('Health restored'); }
          if (pk.kind === 'armor') { p.armor = Math.min(100, p.armor + 60); G.hud.feed('Armor up'); }
          if (pk.kind === 'cash') { p.cash += pk.amount; G.hud.feed(`+$${pk.amount}`); }
          if (pk.kind === 'package') {
            G.stats.packages++;
            p.cash += 100;
            G.hud.feed(`Hidden package ${G.stats.packages}/10 — +$100`);
          }
          G.audio.pickup();
        }
      }
      this.pickups = this.pickups.filter((pk) => !pk.taken);
    },

    scatterPackages(G) {
      const spots = [
        [3, 3], [21, 2], [7, 18], [17, 8], [12, 22], [2, 12], [22, 16], [9, 2], [18, 21], [5, 9],
      ];
      for (const [tx, ty] of spots) {
        this.pickups.push({ x: tx * 48 + 24, y: ty * 48 + 24, kind: 'package' });
      }
    },
  };
}
