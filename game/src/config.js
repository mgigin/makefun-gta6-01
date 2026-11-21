// Solmaris Heat — shared constants: world size, speeds, colours, tuning.
export const TILE = 48;              // world units per city tile
export const GRID = 26;              // tiles per side (26x26 city)
export const WORLD = TILE * GRID;    // 1248 world units square
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PLAYER = {
  walkSpeed: 150,
  sprintSpeed: 235,
  radius: 11,
  maxHealth: 100,
  maxArmor: 100,
};

export const CAR = {
  length: 44,
  width: 20,
  accel: 340,
  brake: 520,
  reverseMax: 110,
  maxSpeed: 430,
  turnRate: 2.6,
  grip: 6.5,
  driftGrip: 2.2,
  drag: 0.55,
};

export const TRAFFIC = {
  cruiseSpeed: 165,
  count: 16,
};

export const POLICE = {
  maxCars: 7,
  chaseSpeed: 405,
  bustRadius: 130,
  bustRate: 0.55,       // bust meter per second while slow near a cop
  loseSightTime: 9,     // seconds unseen per star cooldown tick
};

export const DAY_LENGTH = 300; // seconds per full day cycle

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
];

export const CAR_MODELS = [
  { name: 'Comet Sedan', top: 400, accel: 330, grip: 6.5 },
  { name: 'Bayside Coupe', top: 450, accel: 380, grip: 7.0 },
  { name: 'Harbor Pickup', top: 360, accel: 300, grip: 5.6 },
  { name: 'Metro Taxi', top: 385, accel: 320, grip: 6.4 },
  { name: 'Sunrunner Convertible', top: 440, accel: 365, grip: 6.8 },
  { name: 'Dockside Van', top: 330, accel: 270, grip: 5.2 },
];

export const SAVE_KEY = 'solmaris-heat-save-v1';
export const SETTINGS_KEY = 'solmaris-heat-settings-v1';
