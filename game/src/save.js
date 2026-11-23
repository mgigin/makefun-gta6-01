// Saving Mara's progress in the browser: cash, story progress, weapons,
// packages found and settings, under one localStorage key.

const KEY = 'solmaris-heat-save-v1';

export function saveGame(game) {
  try {
    const p = game.player;
    const data = {
      seed: game.seed,
      cash: game.cash,
      storyIndex: game.story.index,
      completed: game.story.completed,
      owned: p.owned,
      ammo: p.ammo,
      weapon: p.weapon,
      armor: p.armor,
      packages: game.side.packages.map((pkg) => pkg.taken),
      stats: game.stats,
      settings: game.settings,
      clockMin: game.clockMin,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

/** Fold a loaded save back into a fresh game state. */
export function applySave(game, data) {
  if (!data) return false;
  game.cash = data.cash ?? game.cash;
  game.story.index = data.storyIndex ?? 0;
  game.story.completed = data.completed ?? [];
  const p = game.player;
  if (data.owned) p.owned = { ...p.owned, ...data.owned };
  if (data.ammo) p.ammo = { ...p.ammo, ...data.ammo };
  if (data.weapon && p.owned[data.weapon]) p.weapon = data.weapon;
  p.armor = data.armor ?? 0;
  if (Array.isArray(data.packages)) {
    data.packages.forEach((taken, i) => {
      if (game.side.packages[i]) game.side.packages[i].taken = !!taken;
    });
  }
  if (data.stats) game.stats = { ...game.stats, ...data.stats };
  if (data.settings) game.settings = { ...game.settings, ...data.settings };
  if (typeof data.clockMin === 'number') game.clockMin = data.clockMin;
  return true;
}

export function wipeSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage unavailable — nothing to wipe
  }
}
