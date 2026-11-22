// Solmaris Heat — police air support: at high wanted levels a Solmaris PD
// helicopter shadows the player with a searchlight. While the light holds you,
// the escape cooldown cannot run; break line of sight under cover to lose it.
import { HELI, POLICE } from './config.js';

export function createAirSupport() {
  return {
    heli: null,          // {x, y, angle, rotor, spotX, spotY, holding}
    announced: false,

    active() { return !!this.heli; },

    // True while the searchlight is on the player (blocks wanted decay).
    holdingPlayer(G) {
      if (!this.heli) return false;
      const p = G.player;
      const d = Math.hypot(this.heli.spotX - p.x, this.heli.spotY - p.y);
      return d < HELI.hoverRadius && !G.pointInBuilding(p.x, p.y);
    },

    update(G, dt) {
      const p = G.player;
      const wanted = G.police.stars >= POLICE.heliStars;

      if (wanted && !this.heli) {
        // Arrive from off-screen over the bay.
        this.heli = {
          x: p.x - 700, y: p.y - 500, angle: 0.8, rotor: 0,
          spotX: p.x, spotY: p.y, holding: false,
        };
        if (!this.announced) {
          G.hud.feed('Police helicopter inbound — stay out of the light');
          this.announced = true;
        }
        G.audio.heliStart();
      }
      if (!wanted && this.heli) {
        // Peel away and leave once the heat drops.
        const h = this.heli;
        h.x += Math.cos(h.angle) * HELI.cruiseSpeed * dt;
        h.y += Math.sin(h.angle) * HELI.cruiseSpeed * dt;
        h.rotor += dt * 28;
        if (Math.hypot(h.x - p.x, h.y - p.y) > 1300) {
          this.heli = null;
          this.announced = false;
          G.audio.heliStop();
        }
        return;
      }
      if (!this.heli) return;

      const h = this.heli;
      h.rotor += dt * 28;
      // Hover point: offset from the player so the light rakes in at an angle.
      const tx = p.x - 120, ty = p.y - 160;
      const dx = tx - h.x, dy = ty - h.y;
      const d = Math.hypot(dx, dy);
      const sp = Math.min(HELI.cruiseSpeed, 60 + d * 0.9);
      if (d > 4) {
        h.x += (dx / d) * sp * dt;
        h.y += (dy / d) * sp * dt;
        h.angle = Math.atan2(dy, dx);
      }
      // The spotlight tracks the player with a little lag, so hard turns shake it.
      const lag = 1 - Math.pow(0.02, dt);
      h.spotX += (p.x - h.spotX) * lag;
      h.spotY += (p.y - h.spotY) * lag;
      h.holding = this.holdingPlayer(G);
    },

    clear(G) {
      this.heli = null;
      this.announced = false;
      G.audio.heliStop();
    },
  };
}
