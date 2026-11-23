// Every sound in Solmaris Heat is synthesized live with WebAudio — engines,
// sirens, rain, gunfire, the helicopter's rotor and a slow bay-side pad for
// music. There are no audio files. The context starts on the first input, as
// browsers require, and every method is a no-op until then.

export function createAudio(game) {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let rainGain = null;
  let padTimer = 0;
  let padStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = game.settings.music * 0.5;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = game.settings.sfx;
    sfxGain.connect(master);

    // Engine: a sawtooth through a lowpass, pitch follows the revs.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(lp).connect(engineGain).connect(sfxGain);
    engineOsc.start();

    // Siren: a square wave wobbling between two notes.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'square';
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(sfxGain);
    sirenOsc.start();

    // Rain: looped filtered noise.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    src.connect(bp).connect(rainGain).connect(sfxGain);
    src.start();
    return true;
  }

  function noiseBurst(dur, freq, gainVal, type = 'lowpass') {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f).connect(g).connect(sfxGain);
    src.start();
  }

  function tone(freq, dur, gainVal, type = 'sine', when = 0, dest = null) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainVal, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(dest || sfxGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  const CHORDS = [
    [220, 261.6, 329.6], // Am
    [174.6, 220, 261.6], // F
    [196, 246.9, 293.7], // G
    [164.8, 196, 246.9], // Em
  ];

  return {
    unlock() { ensure(); },
    setVolumes() {
      if (!ctx) return;
      musicGain.gain.value = game.settings.music * 0.5;
      sfxGain.gain.value = game.settings.sfx;
    },
    shot(weapon) {
      if (!ctx) return;
      if (weapon === 'scattergun') noiseBurst(0.28, 900, 0.7);
      else if (weapon === 'rifle') noiseBurst(0.2, 1600, 0.55);
      else if (weapon === 'smg') noiseBurst(0.09, 2000, 0.35);
      else noiseBurst(0.14, 1800, 0.45);
    },
    explosion() {
      if (!ctx) return;
      noiseBurst(0.9, 300, 0.9);
      tone(55, 0.8, 0.6, 'sine');
    },
    cash() { tone(1318, 0.12, 0.18, 'triangle'); tone(1760, 0.18, 0.15, 'triangle', 0.07); },
    checkpoint() { tone(880, 0.1, 0.2, 'square'); tone(1174, 0.14, 0.18, 'square', 0.08); },
    missionPass() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.32, 0.2, 'triangle', i * 0.11));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => tone(f, 0.34, 0.18, 'triangle', i * 0.13));
    },
    click() { tone(660, 0.06, 0.12, 'square'); },
    bump() { noiseBurst(0.12, 500, 0.3); },
    skid(on) {
      if (!ctx) return;
      if (on && game.rng() < 0.3) noiseBurst(0.08, 2400, 0.08, 'bandpass');
    },
    /** Per-frame: engine pitch, siren loudness, rain, and the music pad. */
    update(dt) {
      if (!ctx) return;
      const p = game.player;
      if (p.inCar) {
        const rev = Math.abs(p.inCar.speed) / p.inCar.model.top;
        engineOsc.frequency.value = 55 + rev * 165;
        engineGain.gain.value = 0.05 + rev * 0.06;
      } else {
        engineGain.gain.value = 0;
      }
      let siren = 0;
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      for (const car of game.cars) {
        if (!car.police || car.dead) continue;
        const d = Math.hypot(car.x - px, car.y - py);
        siren = Math.max(siren, Math.max(0, 1 - d / 700));
      }
      if (game.heli) siren = Math.max(siren, 0.35);
      sirenGain.gain.value = siren * 0.05;
      sirenOsc.frequency.value = (Math.floor(game.time * 1.6) % 2 === 0) ? 720 : 960;
      rainGain.gain.value = game.weather.rain * 0.11;

      padTimer -= dt;
      if (padTimer <= 0 && game.screen === 'play') {
        padTimer = 4.2;
        const chord = CHORDS[padStep % CHORDS.length];
        padStep += 1;
        for (const f of chord) tone(f, 4.4, 0.05, 'sine', 0, musicGain);
        tone(chord[0] / 2, 4.4, 0.07, 'triangle', 0, musicGain);
      }
    },
  };
}
