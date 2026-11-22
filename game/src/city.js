// Solmaris Heat — the city of Solmaris: grid layout, buildings with varied roofs
// and shopfronts, street props, zones, and the road graph traffic and police use.
import { TILE, GRID, WORLD } from './config.js';
import { rngRange, rngInt, rngPick } from './random.js';

export const TILE_KIND = { ROAD: 0, BLOCK: 1, PARK: 2, SAND: 3, WATER: 4, PLAZA: 5, LOT: 6 };

const BUILDING_PALETTES = [
  ['#d9b48f', '#c49a6b'], ['#b8c4cc', '#93a5b1'], ['#e0cfa8', '#c2ab7e'],
  ['#a8b8d8', '#8496bd'], ['#d8a8a0', '#bd8578'], ['#c8d0b8', '#a3b18d'],
  ['#e6e2d8', '#c9c2b2'], ['#9fb4c7', '#7d97ad'], ['#d8c8a8', '#b3a078'],
  ['#c4b8d8', '#a08fb8'],
];

// Original shop names painted on downtown awnings.
const SHOP_SIGNS = [
  'CAFÉ SOL', 'BAY BOOKS', 'TACOS', 'SURF SHOP', 'NOODLES', 'PIZZA',
  'FLORIST', 'BIKES', 'VINYL', 'BAKERY', 'GYM', 'PHARMACY',
];
const AWNING_COLORS = ['#c8433c', '#3c8a6d', '#e0a83c', '#3c6dc8', '#c86a9e', '#e06a2e'];

export function isRoadTile(tx, ty) {
  if (ty >= GRID - 2) return false; // beach + water rows
  return tx % 5 === 0 || ty % 5 === 0;
}

export function buildCity(rng) {
  const tiles = [];
  for (let y = 0; y < GRID; y++) {
    const row = [];
    for (let x = 0; x < GRID; x++) {
      if (y === GRID - 1) row.push(TILE_KIND.WATER);
      else if (y === GRID - 2) row.push(TILE_KIND.SAND);
      else if (isRoadTile(x, y)) row.push(TILE_KIND.ROAD);
      else row.push(TILE_KIND.BLOCK);
    }
    tiles.push(row);
  }
  // A park, a plaza and two parking lots for variety.
  for (let y = 6; y <= 8; y++) for (let x = 16; x <= 18; x++) tiles[y][x] = TILE_KIND.PARK;
  for (let y = 11; y <= 13; y++) for (let x = 11; x <= 13; x++) tiles[y][x] = TILE_KIND.PLAZA;
  for (let y = 16; y <= 18; y++) for (let x = 2; x <= 3; x++) tiles[y][x] = TILE_KIND.LOT;
  for (let y = 2; y <= 3; y++) for (let x = 21; x <= 23; x++) tiles[y][x] = TILE_KIND.LOT;

  const buildings = [];
  const props = [];
  for (let ty = 0; ty < GRID - 2; ty++) {
    for (let tx = 0; tx < GRID; tx++) {
      const kind = tiles[ty][tx];
      const x0 = tx * TILE, y0 = ty * TILE;
      if (kind === TILE_KIND.BLOCK) {
        // One building per block tile with a sidewalk margin; some tiles stay open.
        if (rng() < 0.14) {
          if (rng() < 0.5) props.push({ kind: 'palm', x: x0 + TILE / 2, y: y0 + TILE / 2, s: rngRange(rng, 0.8, 1.2) });
          else if (rng() < 0.4) props.push({ kind: 'dumpster', x: x0 + TILE / 2, y: y0 + TILE / 2, s: 1, angle: rngRange(rng, 0, Math.PI) });
          continue;
        }
        const m = 7;
        const downtown = Math.abs(tx - 12) < 5 && Math.abs(ty - 12) < 5;
        const pal = rngPick(rng, BUILDING_PALETTES);
        const tall = downtown ? rngRange(rng, 48, 96) : rngRange(rng, 16, 46);
        buildings.push({
          x: x0 + m, y: y0 + m, w: TILE - m * 2, h: TILE - m * 2,
          height: tall,
          wall: pal[0], roof: pal[1],
          windows: rngInt(rng, 2, 4),
          seed: rng(),
          roofKind: rngPick(rng, ['flat', 'flat', 'gable', 'terrace', 'waterTower']),
          sign: downtown && rng() < 0.55 ? rngPick(rng, SHOP_SIGNS) : null,
          awning: downtown && rng() < 0.6 ? rngPick(rng, AWNING_COLORS) : null,
          setback: tall > 70 ? rngRange(rng, 0.55, 0.75) : 0, // stepped crown on towers
        });
      } else if (kind === TILE_KIND.PARK) {
        if (rng() < 0.55) props.push({ kind: 'tree', x: x0 + rngRange(rng, 8, TILE - 8), y: y0 + rngRange(rng, 8, TILE - 8), s: rngRange(rng, 0.8, 1.3) });
        if (rng() < 0.3) props.push({ kind: 'bench', x: x0 + TILE / 2, y: y0 + TILE / 2, s: 1 });
        if (rng() < 0.18) props.push({ kind: 'fountain', x: x0 + TILE / 2, y: y0 + TILE / 2, s: 1 });
      } else if (kind === TILE_KIND.SAND) {
        if (rng() < 0.5) props.push({ kind: 'palm', x: x0 + rngRange(rng, 6, TILE - 6), y: y0 + rngRange(rng, 10, TILE - 10), s: rngRange(rng, 0.9, 1.3) });
        if (rng() < 0.25) props.push({ kind: 'umbrella', x: x0 + rngRange(rng, 8, TILE - 8), y: y0 + rngRange(rng, 8, TILE - 8), s: 1, hue: rngInt(rng, 0, 5) });
        if (rng() < 0.2) props.push({ kind: 'towel', x: x0 + rngRange(rng, 10, TILE - 10), y: y0 + rngRange(rng, 10, TILE - 10), s: 1, hue: rngInt(rng, 0, 5) });
      } else if (kind === TILE_KIND.LOT) {
        // Parking bay stripes are drawn from the tile kind; a few props for life.
        if (rng() < 0.25) props.push({ kind: 'dumpster', x: x0 + TILE / 2, y: y0 + 10, s: 1, angle: 0 });
      }
    }
  }
  // Street furniture along avenues: lamps, hydrants, bus stops, newsstands.
  for (let ty = 0; ty < GRID - 2; ty++) {
    for (let tx = 0; tx < GRID; tx++) {
      if (tiles[ty][tx] !== TILE_KIND.ROAD) continue;
      if ((tx + ty) % 3 === 0) props.push({ kind: 'lamp', x: tx * TILE + 5, y: ty * TILE + 5, s: 1 });
      if ((tx * 7 + ty * 3) % 11 === 0) props.push({ kind: 'hydrant', x: tx * TILE + TILE - 6, y: ty * TILE + TILE - 6, s: 1 });
      if ((tx * 5 + ty * 13) % 17 === 0) props.push({ kind: 'busstop', x: tx * TILE + TILE - 8, y: ty * TILE + 8, s: 1 });
      if ((tx * 11 + ty * 7) % 23 === 0) props.push({ kind: 'newsstand', x: tx * TILE + 8, y: ty * TILE + TILE - 8, s: 1 });
    }
  }
  // The pier: a wooden walkway into the water at the beach, drawn by render.js.
  const pier = { x: 12 * TILE + 8, y: (GRID - 2) * TILE + 6, w: TILE - 16, len: TILE * 1.6 };

  // Road graph: nodes at intersections, used by traffic + police pathing.
  const nodes = [];
  const nodeId = new Map();
  for (let ty = 0; ty < GRID - 2; ty++) {
    for (let tx = 0; tx < GRID; tx++) {
      if (tx % 5 === 0 && ty % 5 === 0) {
        const id = nodes.length;
        nodes.push({ id, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, tx, ty, next: [] });
        nodeId.set(tx + ',' + ty, id);
      }
    }
  }
  for (const n of nodes) {
    for (const [dx, dy] of [[5, 0], [-5, 0], [0, 5], [0, -5]]) {
      const other = nodeId.get((n.tx + dx) + ',' + (n.ty + dy));
      if (other !== undefined) n.next.push(other);
    }
  }

  const city = {
    tiles, buildings, props, nodes, pier,
    // Key places (world coords).
    places: {
      spawn: { x: 12 * TILE + 24, y: 14 * TILE + 24 },
      fixer: { x: 10 * TILE + 24, y: 10 * TILE + 24 },       // Dario Quint's office corner
      respray: { x: 20 * TILE + 24, y: 5 * TILE + 24 },      // Chop & Shine
      gunshop: { x: 5 * TILE + 24, y: 15 * TILE + 24 },      // Iron & Oak
      clinic: { x: 15 * TILE + 24, y: 20 * TILE + 24 },
      precinct: { x: 15 * TILE + 24, y: 5 * TILE + 24 },
      safehouse: { x: 6 * TILE + 24, y: 6 * TILE + 24 },
      raceStart: { x: 20 * TILE + 24, y: 15 * TILE + 24 },   // street-race meet
      ferry: { x: 12 * TILE + 24, y: 23 * TILE + 24 },       // the pier ferry dock
    },
  };
  return city;
}

export function tileKindAt(city, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= GRID || ty >= GRID) return TILE_KIND.WATER;
  return city.tiles[ty][tx];
}

export function zoneName(x, y) {
  const tx = x / TILE, ty = y / TILE;
  if (ty > GRID - 4) return 'Solmaris Beach';
  if (tx < 6 && ty > 14) return 'The Docks';
  if (tx < 6) return 'Harbor West';
  if (tx > 19) return 'Palm Heights';
  if (ty < 6) return 'Old Town';
  if (Math.abs(tx - 12) < 5 && Math.abs(ty - 12) < 5) return 'Downtown';
  if (ty > 17) return 'Southside';
  return 'Midtown';
}

// Push a circle out of every building rect; returns true if it hit something.
export function collideCircle(city, e, radius) {
  let hit = false;
  const minTx = Math.floor((e.x - radius) / TILE), maxTx = Math.floor((e.x + radius) / TILE);
  const minTy = Math.floor((e.y - radius) / TILE), maxTy = Math.floor((e.y + radius) / TILE);
  for (const b of city.buildings) {
    if (b.x + b.w < minTx * TILE || b.x > (maxTx + 1) * TILE) continue;
    if (b.y + b.h < minTy * TILE || b.y > (maxTy + 1) * TILE) continue;
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx, dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 === 0) { e.x = b.x - radius; continue; }
      const d = Math.sqrt(d2);
      e.x = cx + (dx / d) * radius;
      e.y = cy + (dy / d) * radius;
    }
  }
  // World bounds + water edge.
  e.x = Math.max(radius, Math.min(WORLD - radius, e.x));
  e.y = Math.max(radius, Math.min((GRID - 1) * TILE - radius, e.y));
  return hit;
}

export function nearestNode(city, x, y) {
  let best = null, bestD = Infinity;
  for (const n of city.nodes) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

// A random point on a road, for spawning traffic away from the player.
export function randomRoadPoint(city, rng, avoidX, avoidY, minDist) {
  for (let i = 0; i < 40; i++) {
    const n = city.nodes[Math.floor(rng() * city.nodes.length)];
    const m = n.next.length ? city.nodes[n.next[Math.floor(rng() * n.next.length)]] : n;
    const t = rng();
    const x = n.x + (m.x - n.x) * t, y = n.y + (m.y - n.y) * t;
    if (Math.hypot(x - avoidX, y - avoidY) > minDist) return { x, y, from: n.id, to: m.id };
  }
  const n = city.nodes[0];
  return { x: n.x, y: n.y, from: n.id, to: n.id };
}
