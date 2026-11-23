// Static data for Solmaris Heat: the nine car models and their handling, the
// weapon rack, the city's colour palette, and the prices the shops charge.
// Nothing in here changes at runtime; every other module reads from it.

export const WORLD = {
  width: 2600,
  height: 2600,
  block: 232, // one city block, wall to wall
  road: 60, // road width between blocks
  sidewalk: 14,
};

export const VIEW = { width: 1280, height: 720 };

// Handling numbers are in world units per second. `grip` scales how fast the
// car can change direction; `tough` is body health; `value` is what a chop
// shop would pay, used for mission rewards and respray pricing.
export const CAR_MODELS = [
  { id: 'pico', name: 'Pico', len: 34, wid: 17, top: 205, accel: 150, grip: 2.6, tough: 60, value: 400 },
  { id: 'sedan', name: 'Marlin Sedan', len: 42, wid: 19, top: 250, accel: 165, grip: 2.4, tough: 85, value: 700 },
  { id: 'taxi', name: 'Bay Taxi', len: 42, wid: 19, top: 245, accel: 160, grip: 2.4, tough: 85, value: 750 },
  { id: 'pickup', name: 'Rancher Pickup', len: 46, wid: 20, top: 240, accel: 155, grip: 2.1, tough: 110, value: 800 },
  { id: 'van', name: 'Cargo Van', len: 48, wid: 21, top: 225, accel: 140, grip: 1.9, tough: 120, value: 850 },
  { id: 'suv', name: 'Trailhead SUV', len: 46, wid: 21, top: 265, accel: 175, grip: 2.2, tough: 115, value: 1100 },
  { id: 'muscle', name: 'Vandal Muscle', len: 45, wid: 20, top: 320, accel: 230, grip: 1.8, tough: 95, value: 1600 },
  { id: 'sports', name: 'Sirocco GT', len: 43, wid: 19, top: 380, accel: 300, grip: 2.9, tough: 70, value: 2600 },
  { id: 'truck', name: 'Hauler Truck', len: 58, wid: 23, top: 205, accel: 115, grip: 1.5, tough: 180, value: 1400 },
];

export const POLICE_MODEL = { id: 'cruiser', name: 'Solmaris Cruiser', len: 44, wid: 20, top: 330, accel: 265, grip: 2.7, tough: 130, value: 0 };

export const CAR_COLORS = [
  '#c0392b', '#2471a3', '#1e8449', '#b7950b', '#7d3c98', '#ca6f1e',
  '#117a65', '#616a6b', '#aeb6bf', '#2e4053', '#922b21', '#f5b041',
  '#48c9b0', '#ec7063', '#5dade2', '#f8f9f9',
];

// `spread` is the cone half-angle in radians; `pellets` is how many projectiles
// one trigger pull makes; `range` is how far a shot stays dangerous.
export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.35, spread: 0, pellets: 0, range: 26, speed: 0, price: 0, ammoPrice: 0, auto: false },
  pistol: { name: 'Pistol', damage: 16, rate: 0.28, spread: 0.02, pellets: 1, range: 420, speed: 900, price: 250, ammoPrice: 40, auto: false },
  smg: { name: 'SMG', damage: 11, rate: 0.085, spread: 0.055, pellets: 1, range: 380, speed: 950, price: 650, ammoPrice: 90, auto: true },
  scattergun: { name: 'Scattergun', damage: 9, rate: 0.85, spread: 0.16, pellets: 7, range: 240, speed: 820, price: 900, ammoPrice: 120, auto: false },
  rifle: { name: 'Rifle', damage: 34, rate: 0.55, spread: 0.006, pellets: 1, range: 700, speed: 1400, price: 1400, ammoPrice: 150, auto: false },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'scattergun', 'rifle'];

export const PRICES = {
  armor: 300,
  respray: 200,
  hospitalFee: 150,
  bustFine: 250,
  raceEntry: 100,
  racePrize: 600,
};

export const DISTRICTS = [
  { name: 'Palm Heights', tint: '#e8d8a8' },
  { name: 'Downtown', tint: '#b8c4ce' },
  { name: 'Old Market', tint: '#e6b88a' },
  { name: 'The Docks', tint: '#9db3a8' },
  { name: 'Foundry Flats', tint: '#c2a49a' },
  { name: 'Marina Row', tint: '#a8d0d8' },
];

export const PED_SHIRTS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22',
  '#1abc9c', '#ecf0f1', '#fd79a8', '#74b9ff', '#55efc4', '#ffeaa7',
];

export const PED_SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export const BUILDING_FACES = {
  downtown: ['#8fa6b8', '#7d94a8', '#a7bccb', '#6f8aa3', '#93a8bd'],
  residential: ['#e8d5b5', '#dfc7a0', '#d9b48f', '#efe3c8', '#e2cfae'],
  market: ['#e0a878', '#d98e5f', '#e8b98a', '#cf8358', '#e5c39a'],
  docks: ['#7f9c8f', '#6f8f81', '#8fae9f', '#75917f', '#86a294'],
  industrial: ['#b09a8e', '#a38a7d', '#bda79b', '#9c8578', '#ac9484'],
};

export const ROOF_COLORS = ['#5d6d7e', '#4a5a6a', '#6e7f8f', '#556270', '#61707e'];
