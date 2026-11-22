// Solmaris Heat — shared tuning: world geometry, speeds, colours, vehicle roster,
// police response, weather and effects constants. One place to balance the game.
export const TILE = 48;              // world units per city tile
export const GRID = 26;              // tiles per side (26x26 city)
export const WORLD = TILE * GRID;    // 1248 world units square
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PLAYER = {
  walkSpeed: 152,
  sprintSpeed: 238,
  radius: 11,
  maxHealth: 100,
  maxArmor: 100,
  staminaDrain: 0.22,   // sprint stamina per second
  staminaRegen: 0.3,
};

export const CAR = {
  length: 44,
  width: 20,
  accel: 340,
  brake: 540,
  reverseMax: 115,
  maxSpeed: 430,
  turnRate: 2.65,
  grip: 6.5,
  driftGrip: 2.1,
  drag: 0.55,
  smokeSpeed: 120,      // lateral slide speed that starts tyre smoke
};

export const TRAFFIC = {
  cruiseSpeed: 168,
  count: 18,
};

export const POLICE = {
  maxCars: 7,
  chaseSpeed: 405,
  bustRadius: 132,
  bustRate: 0.55,        // bust meter per second while slow near a cop
  loseSightTime: 8,      // seconds unseen per star cooldown tick
  searchTime: 14,        // seconds of "searching" (blinking stars) before a star drops
  heliStars: 4,          // helicopter joins at this wanted level
  spikeStars: 5,         // spike strips appear at this wanted level
  roadblockStars: 3,     // roadblocks appear at this wanted level
};

export const HELI = {
  cruiseSpeed: 300,
  hoverRadius: 90,       // spotlight cone radius on the ground
  spotRange: 520,        // how far the spotlight can hold the player
};

export const DAY_LENGTH = 300; // seconds per full day cycle

export const WEATHER = {
  changeEvery: 75,       // seconds between weather rolls
  rainChance: 0.3,
  wetGrip: 0.78,         // grip multiplier while it rains
};

export const COLORS = {
  road: '#3a3f47',
  roadLine: '#e8d98a',
  sidewalk: '#9aa0a3',
  grass: '#5d9b52',
  sand: '#e3cd96',
  water: '#2e7fb8',
  plaza: '#b8a888',
};

export const CAR_COLORS = [
  '#c8433c', '#3c6dc8', '#e0a83c', '#4fae62', '#8a5fc0',
  '#d8d8dc', '#2f2f36', '#c86a9e', '#3ca8a0', '#e06a2e',
  '#7d2e2e', '#2e5d7d', '#c8b88a', '#5d7d3c',
];

// The Solmaris vehicle roster. `kind` drives the body shape in render.js.
export const CAR_MODELS = [
  { name: 'Comet Sedan', kind: 'sedan', top: 402, accel: 332, grip: 6.5 },
  { name: 'Bayside Coupe', kind: 'coupe', top: 452, accel: 384, grip: 7.0 },
  { name: 'Harbor Pickup', kind: 'pickup', top: 362, accel: 302, grip: 5.6 },
  { name: 'Metro Taxi', kind: 'sedan', top: 386, accel: 322, grip: 6.4 },
  { name: 'Sunrunner Convertible', kind: 'convertible', top: 442, accel: 366, grip: 6.8 },
  { name: 'Dockside Van', kind: 'van', top: 332, accel: 272, grip: 5.2 },
  { name: 'Palm GT', kind: 'coupe', top: 478, accel: 410, grip: 7.3 },
  { name: 'Bayview SUV', kind: 'suv', top: 392, accel: 318, grip: 6.1 },
  { name: 'Marina Hatch', kind: 'hatch', top: 374, accel: 312, grip: 6.9 },
];

export const POLICE_MODEL = { name: 'Solmaris PD Interceptor', kind: 'sedan', top: 458, accel: 402, grip: 7.2 };

export const WEAPONS = {
  fists: { name: 'Fists', damage: 16, rate: 0.38, price: 0 },
  pistol: { name: 'Pistol', damage: 34, rate: 0.22, range: 460, price: 250 },
  scattergun: { name: 'Scattergun', damage: 13, pellets: 6, rate: 0.85, range: 300, price: 600 },
};

export const SAVE_KEY = 'solmaris-heat-save-v2';
export const SETTINGS_KEY = 'solmaris-heat-settings-v2';
