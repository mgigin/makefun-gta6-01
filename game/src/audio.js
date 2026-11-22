// Solmaris Heat — all sound is synthesized with WebAudio: engine, sirens,
// shots, rain on the bay, a helicopter rotor, and a lazy synthwave loop.
export function createAudio() {
  let ctx = null;
  let master = null, musicGain = null, sfxGain = null;
  let engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = null;
  let rainSrc = null, rainGain = null;
  let heliOsc = null, heliGain = null, heliLfo = null;
  let musicTimer = null, musicStep = 0;
  let unlocked = false;

  function ensure() {
    // Browsers refuse to start an AudioContext before a user gesture (and warn
    // in the console), so the context is only created once unlock() has run.
    if (!unlocked) return false;
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
    return true;
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, dest = null, slideTo = null) {
    if (!ensure()) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol = 0.3, filterFreq = 1200) {
    if (!ensure()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start();
  }

  return {
    unlock() { unlocked = true; ensure(); },
    setVolumes(music, sfx) {
      if (!ensure()) return;
      musicGain.gain.value = music * 0.6;
      sfxGain.gain.value = sfx;
    },
    click() { tone(660, 0.06, 'square', 0.08); },
    door() { noise(0.12, 0.25, 500); tone(140, 0.1, 'sine', 0.15); },
    shot(distant, heavy) {
      if (heavy) { noise(0.3, distant ? 0.2 : 0.55, 1600); tone(110, 0.18, 'square', 0.16, null, 45); }
      else { noise(0.14, distant ? 0.12 : 0.4, 2600); tone(160, 0.08, 'square', 0.12, null, 60); }
    },
    punch() { noise(0.08, 0.2, 700); },
    thud() { noise(0.15, 0.3, 400); },
    hurt() { tone(220, 0.15, 'sawtooth', 0.12, null, 110); },
    crash(v) { noise(0.25, 0.25 + v * 0.4, 900); tone(70, 0.3, 'sine', 0.3, null, 40); },
    explosion() { noise(0.7, 0.6, 500); tone(55, 0.7, 'sine', 0.5, null, 30); },
    honk() { tone(370, 0.18, 'square', 0.1); tone(440, 0.18, 'square', 0.08); },
    pickup() { tone(880, 0.09, 'sine', 0.15); setTimeout(() => tone(1320, 0.12, 'sine', 0.15), 70); },
    checkpoint() { tone(740, 0.1, 'triangle', 0.2); setTimeout(() => tone(1108, 0.16, 'triangle', 0.2), 90); },
    missionStart() { [392, 494, 587].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.18), i * 110)); },
    missionPass() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 130)); },
    missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.18), i * 150)); },
    busted() { [262, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'square', 0.14), i * 200)); },

    engineStart() {
      if (!ensure() || engineOsc) return;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      engineGain = ctx.createGain(); engineGain.gain.value = 0.05;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(sfxGain);
      engineOsc.start();
    },
    engineSet(speedRatio) {
      if (engineOsc) engineOsc.frequency.value = 55 + speedRatio * 165;
    },
    engineStop() {
      if (engineOsc) { try { engineOsc.stop(); } catch {} engineOsc = null; engineGain = null; }
    },

    sirenStart() {
      if (!ensure() || sirenOsc) return;
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0.045;
      sirenOsc.connect(sirenGain); sirenGain.connect(sfxGain);
      sirenOsc.start();
      let hi = false;
      const tick = () => { if (sirenOsc) { sirenOsc.frequency.value = hi ? 960 : 720; hi = !hi; } };
      tick();
      sirenTimer = setInterval(tick, 380);
    },
    sirenStop() {
      if (sirenTimer) clearInterval(sirenTimer);
      sirenTimer = null;
      if (sirenOsc) { try { sirenOsc.stop(); } catch {} sirenOsc = null; sirenGain = null; }
    },

    // Looping filtered noise for rain.
    rainStart() {
      if (!ensure() || rainSrc) return;
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      rainSrc = ctx.createBufferSource(); rainSrc.buffer = buf; rainSrc.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.4;
      rainGain = ctx.createGain(); rainGain.gain.value = 0.0;
      rainGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.2);
      rainSrc.connect(f); f.connect(rainGain); rainGain.connect(sfxGain);
      rainSrc.start();
    },
    rainStop() {
      if (rainSrc) {
        try {
          rainGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
          const src = rainSrc;
          setTimeout(() => { try { src.stop(); } catch {} }, 900);
        } catch {}
        rainSrc = null; rainGain = null;
      }
    },

    // Helicopter rotor: a low pulse chopped by an LFO.
    heliStart() {
      if (!ensure() || heliOsc) return;
      heliOsc = ctx.createOscillator();
      heliOsc.type = 'sawtooth';
      heliOsc.frequency.value = 46;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
      heliGain = ctx.createGain(); heliGain.gain.value = 0.05;
      heliLfo = ctx.createOscillator(); heliLfo.frequency.value = 11;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.035;
      heliLfo.connect(lfoGain); lfoGain.connect(heliGain.gain);
      heliOsc.connect(f); f.connect(heliGain); heliGain.connect(sfxGain);
      heliOsc.start(); heliLfo.start();
    },
    heliStop() {
      if (heliOsc) { try { heliOsc.stop(); } catch {} heliOsc = null; }
      if (heliLfo) { try { heliLfo.stop(); } catch {} heliLfo = null; }
      heliGain = null;
    },

    // A lazy synthwave loop: bass pulse + pentatonic plucks, all generated.
    musicStart() {
      if (!ensure() || musicTimer) return;
      const bass = [55, 55, 65.4, 49];
      const arp = [220, 261.6, 329.6, 392, 329.6, 261.6, 293.7, 349.2];
      musicTimer = setInterval(() => {
        const bar = Math.floor(musicStep / 8) % 4;
        if (musicStep % 2 === 0) tone(bass[bar], 0.22, 'triangle', 0.16, musicGain);
        tone(arp[musicStep % 8], 0.18, 'sine', 0.07, musicGain);
        musicStep++;
      }, 240);
    },
    musicStop() {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
    },
  };
}
