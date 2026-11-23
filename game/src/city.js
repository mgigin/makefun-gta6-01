// The city of Solmaris, generated from a seed: a grid of blocks and roads in
// six districts, with buildings, parks, a beach on the bay, and the named
// places the story sends you to. Generation is deterministic — the same seed
// always raises the same streets.

import { WORLD, BUILDING_FACES, ROOF_COLORS } from './data.js';
import { range, intRange, pick, chance } from './rng.js';

const PITCH = WORLD.block + WORLD.road;

function districtOf(col, row, cols, rows) {
  if (row >= rows - 2 && col >= 4) return 'marina';
  if (row >= rows - 2 && col <= 3) return 'docks';
  if (col >= 5 && row >= 4) return 'industrial';
  if (col >= 3 && col <= 5 && row <= 3) return 'downtown';
  if (col >= 6 && row <= 3) return 'market';
  if (col <= 2 && row <= 3) return 'residential';
  return 'market';
}

const DISTRICT_NAMES = {
  residential: 'Palm Heights',
  downtown: 'Downtown',
  market: 'Old Market',
  docks: 'The Docks',
  industrial: 'Foundry Flats',
  marina: 'Marina Row',
};

const HEIGHTS = {
  downtown: [55, 130],
  residential: [16, 34],
  market: [22, 48],
  docks: [18, 40],
  industrial: [20, 44],
  marina: [18, 38],
};

function makeBuilding(rng, x, y, w, h, district) {
  const faces = BUILDING_FACES[district] || BUILDING_FACES.market;
  const [lo, hi] = HEIGHTS[district] || HEIGHTS.market;
  return {
    x, y, w, h,
    height: range(rng, lo, hi),
    face: pick(rng, faces),
    roof: pick(rng, ROOF_COLORS),
    windows: intRange(rng, 1000, 99999),
    acUnits: intRange(rng, 0, 3),
    awning: district === 'market' && chance(rng, 0.6),
    district,
  };
}

function fillBlock(rng, city, bx, by, district) {
  const B = WORLD.block;
  const inset = WORLD.sidewalk + 6;
  const inner = B - inset * 2;
  const roll = rng();
  if (roll < 0.1) {
    // A park: grass, a path cross, and a handful of trees.
    const trees = [];
    const n = intRange(rng, 5, 9);
    for (let i = 0; i < n; i += 1) {
      trees.push({ x: bx + range(rng, 30, B - 30), y: by + range(rng, 30, B - 30), r: range(rng, 9, 15) });
    }
    city.parks.push({ x: bx, y: by, w: B, h: B, trees, district });
    return;
  }
  if (roll < 0.18) {
    // A parking lot: open asphalt where cars sit waiting to be borrowed.
    city.lots.push({ x: bx + inset, y: by + inset, w: inner, h: inner, district });
    return;
  }
  if (roll < 0.55) {
    // One big building on the block.
    city.buildings.push(makeBuilding(rng, bx + inset, by + inset, inner, inner, district));
    return;
  }
  // Four smaller buildings with an alley cross between them.
  const half = (inner - 16) / 2;
  for (let ix = 0; ix < 2; ix += 1) {
    for (let iy = 0; iy < 2; iy += 1) {
      city.buildings.push(makeBuilding(
        rng,
        bx + inset + ix * (half + 16),
        by + inset + iy * (half + 16),
        half, half, district,
      ));
    }
  }
}

// The named places. Each sits on a chosen block; the marker is the spot on the
// street in front of it where the player interacts.
const POI_DEFS = [
  { id: 'garage', name: "Dario's Garage", kind: 'giver', col: 6, row: 2 },
  { id: 'gunshop', name: 'Iron & Oak', kind: 'shop', col: 4, row: 1 },
  { id: 'respray', name: 'Chop & Shine', kind: 'respray', col: 6, row: 5 },
  { id: 'hospital', name: 'St. Aurelia Hospital', kind: 'hospital', col: 1, row: 1 },
  { id: 'police', name: 'Solmaris Police HQ', kind: 'police', col: 3, row: 3 },
  { id: 'racemeet', name: 'Marina Race Meet', kind: 'race', col: 6, row: 7 },
  { id: 'safehouse', name: 'Mara’s Flat', kind: 'safehouse', col: 2, row: 2 },
  { id: 'warehouse', name: 'Ledger Warehouse', kind: 'warehouse', col: 1, row: 7 },
  { id: 'marina', name: 'Marina Pier', kind: 'pier', col: 5, row: 7 },
];

export function buildCity(rng) {
  const cols = Math.floor((WORLD.width - WORLD.road) / PITCH);
  const rows = Math.floor((WORLD.height - WORLD.road) / PITCH);
  const usedW = WORLD.road + cols * PITCH;
  const usedH = WORLD.road + rows * PITCH;
  const ox = Math.round((WORLD.width - usedW) / 2);
  const oy = 36;

  const city = {
    cols, rows, ox, oy,
    buildings: [],
    parks: [],
    lots: [],
    pois: {},
    // The bay: water along the south edge, sand above it.
    waterY: oy + usedH + 74,
    beachY: oy + usedH,
    roadX: [], // centre line of each vertical road
    roadY: [], // centre line of each horizontal road
    blockRects: [],
  };
  for (let i = 0; i <= cols; i += 1) city.roadX.push(ox + i * PITCH + WORLD.road / 2);
  for (let j = 0; j <= rows; j += 1) city.roadY.push(oy + j * PITCH + WORLD.road / 2);

  const poiBlocks = new Set(POI_DEFS.map((p) => `${p.col},${p.row}`));
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const bx = ox + WORLD.road + col * PITCH;
      const by = oy + WORLD.road + row * PITCH;
      const district = districtOf(col, row, cols, rows);
      city.blockRects.push({ x: bx, y: by, w: WORLD.block, h: WORLD.block, district, col, row });
      if (poiBlocks.has(`${col},${row}`)) continue; // POI lots are placed below
      fillBlock(rng, city, bx, by, district);
    }
  }

  // POI lots: a signature building plus a street marker in front of it.
  for (const def of POI_DEFS) {
    const bx = ox + WORLD.road + def.col * PITCH;
    const by = oy + WORLD.road + def.row * PITCH;
    const district = districtOf(def.col, def.row, cols, rows);
    const inset = WORLD.sidewalk + 6;
    const b = makeBuilding(rng, bx + inset, by + inset, WORLD.block - inset * 2, WORLD.block - inset * 2, district);
    b.poi = def.id;
    b.sign = def.name;
    city.buildings.push(b);
    city.pois[def.id] = {
      id: def.id, name: def.name, kind: def.kind,
      x: bx + WORLD.block / 2,
      y: by - WORLD.road / 2 + 6, // on the road north of the block
      bx: bx + WORLD.block / 2, by: by + WORLD.block / 2,
    };
  }

  return city;
}

/** The district name at a world point (for the HUD zone readout). */
export function zoneNameAt(city, x, y) {
  if (y > city.beachY) return 'Solmaris Bay';
  for (const r of city.blockRects) {
    if (x >= r.x - WORLD.road && x < r.x + r.w && y >= r.y - WORLD.road && y < r.y + r.h) {
      return DISTRICT_NAMES[r.district] || 'Solmaris';
    }
  }
  return 'Solmaris';
}

/** A random point on a driving lane, with the heading of that lane. */
export function randomLanePoint(rng, city) {
  const laneOff = WORLD.road / 4;
  if (chance(rng, 0.5)) {
    const i = intRange(rng, 0, city.cols);
    const north = chance(rng, 0.5);
    return {
      x: city.roadX[i] + (north ? laneOff : -laneOff),
      y: range(rng, city.roadY[0], city.roadY[city.rows]),
      angle: north ? -Math.PI / 2 : Math.PI / 2,
      axis: 'v', road: i, dir: north ? -1 : 1,
    };
  }
  const j = intRange(rng, 0, city.rows);
  const east = chance(rng, 0.5);
  return {
    x: range(rng, city.roadX[0], city.roadX[city.cols]),
    y: city.roadY[j] + (east ? laneOff : -laneOff),
    angle: east ? 0 : Math.PI,
    axis: 'h', road: j, dir: east ? 1 : -1,
  };
}

/** A random sidewalk point beside some block, for pedestrians. */
export function randomSidewalkPoint(rng, city) {
  const r = pick(rng, city.blockRects);
  const side = intRange(rng, 0, 3);
  const t = rng();
  const sw = WORLD.sidewalk / 2 + 2;
  if (side === 0) return { x: r.x + t * r.w, y: r.y - sw };
  if (side === 1) return { x: r.x + t * r.w, y: r.y + r.h + sw };
  if (side === 2) return { x: r.x - sw, y: r.y + t * r.h };
  return { x: r.x + r.w + sw, y: r.y + t * r.h };
}

/** Push a circle out of buildings, trees, water and the world edge. Returns true if it hit. */
export function collideCircle(city, ent, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(ent.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(ent.y, b.y + b.h));
    const dx = ent.x - nx;
    const dy = ent.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        ent.x = nx + (dx / d) * radius;
        ent.y = ny + (dy / d) * radius;
      } else {
        ent.y = b.y - radius;
      }
    }
  }
  for (const park of city.parks) {
    for (const tree of park.trees) {
      const dx = ent.x - tree.x;
      const dy = ent.y - tree.y;
      const rr = radius + 4;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        ent.x = tree.x + (dx / d) * rr;
        ent.y = tree.y + (dy / d) * rr;
        hit = true;
      }
    }
  }
  const m = 10;
  if (ent.x < m + radius) { ent.x = m + radius; hit = true; }
  if (ent.x > WORLD.width - m - radius) { ent.x = WORLD.width - m - radius; hit = true; }
  if (ent.y < m + radius) { ent.y = m + radius; hit = true; }
  if (ent.y > city.waterY - radius) { ent.y = city.waterY - radius; hit = true; }
  return hit;
}

/** True if the point is inside any building (for line-of-sight checks). */
export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** Sampled line of sight: true when nothing solid blocks the segment. */
export function lineOfSight(city, ax, ay, bx, by) {
  const steps = 14;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointInBuilding(city, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}
