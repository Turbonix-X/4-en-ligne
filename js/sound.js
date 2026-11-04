// ===== Sons (générés en direct, aucun fichier audio) et vibrations =====

const Sound = (() => {
  let ctx = null;
  let noise = null;
  let enabled = true;

  function audio() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function noiseBuffer(c) {
    if (!noise) {
      noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noise;
  }

  function envelope(c, peak, attack, decay, when = 0) {
    const g = c.createGain();
    const t = c.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(c.destination);
    return g;
  }

  // Choc d'un dé sur la table
  function clack(strength = 1) {
    const c = audio();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1500 + Math.random() * 2500;
    bp.Q.value = 5;
    src.connect(bp).connect(envelope(c, 0.5 * strength, 0.002, 0.09));
    src.start(c.currentTime, Math.random() * 0.5, 0.12);

    const thump = c.createOscillator();
    thump.frequency.setValueAtTime(190, c.currentTime);
    thump.frequency.exponentialRampToValueAtTime(70, c.currentTime + 0.12);
    thump.connect(envelope(c, 0.35 * strength, 0.003, 0.13));
    thump.start();
    thump.stop(c.currentTime + 0.2);
  }

  // Tintement métallique de la pièce
  function ting(strength = 1) {
    const c = audio();
    if (!c) return;
    const base = 1500 + Math.random() * 300;
    [1, 2.76, 5.4, 8.93].forEach((ratio, k) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = base * ratio;
      o.connect(envelope(c, (0.16 * strength) / (k + 1), 0.002, 0.9 / (k * 0.6 + 1)));
      o.start();
      o.stop(c.currentTime + 1.2);
    });
  }

  // Souffle pendant que l'objet est en l'air
  function whoosh(duration = 1) {
    const c = audio();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = "bandpass";
    lp.Q.value = 1.2;
    const t = c.currentTime;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(1800, t + duration * 0.35);
    lp.frequency.exponentialRampToValueAtTime(400, t + duration * 0.85);
    src.connect(lp).connect(envelope(c, 0.09, duration * 0.25, duration * 0.6));
    src.start();
    src.stop(t + duration);
  }

  // Petite mélodie quand le résultat apparaît
  function chime() {
    const c = audio();
    if (!c) return;
    [1046.5, 1318.5, 1568].forEach((f, k) => {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.connect(envelope(c, 0.12, 0.01, 0.45, k * 0.07));
      o.start(c.currentTime + k * 0.07);
      o.stop(c.currentTime + k * 0.07 + 0.6);
    });
  }

  // Fanfare pour la pièce tombée sur la tranche
  function fanfare() {
    const c = audio();
    if (!c) return;
    const notes = [523.3, 659.3, 784, 1046.5, 784, 1046.5, 1318.5];
    const times = [0, 0.1, 0.2, 0.32, 0.5, 0.6, 0.72];
    notes.forEach((f, k) => {
      ["triangle", "square"].forEach((type, j) => {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = f * (j ? 0.5 : 1);
        const last = k === notes.length - 1;
        o.connect(envelope(c, j ? 0.03 : 0.13, 0.01, last ? 1.1 : 0.22, times[k]));
        o.start(c.currentTime + times[k]);
        o.stop(c.currentTime + times[k] + (last ? 1.3 : 0.3));
      });
    });
    setTimeout(() => ting(1), 700);
  }

  function click() {
    const c = audio();
    if (!c) return;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(900, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(500, c.currentTime + 0.05);
    o.connect(envelope(c, 0.08, 0.002, 0.05));
    o.start();
    o.stop(c.currentTime + 0.08);
  }

  // Le stylo qui gratte le papier : quelques petits coups de bruit filtré
  function scribble(duration = 0.35, strokes = 2) {
    const c = audio();
    if (!c) return;
    for (let k = 0; k < strokes; k++) {
      const when = (k * duration) / strokes;
      const len = (duration / strokes) * 0.9;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c);
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 3200 + Math.random() * 1600;
      bp.Q.value = 1.4;
      src.connect(bp).connect(envelope(c, 0.07, len * 0.25, len * 0.75, when));
      src.start(c.currentTime + when, Math.random() * 0.5, len + 0.05);
    }
  }

  // La gomme qui efface
  function erase() {
    const c = audio();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    src.connect(lp).connect(envelope(c, 0.1, 0.03, 0.2));
    src.start(c.currentTime, Math.random() * 0.5, 0.26);
  }

  // Petite descente de notes quand on perd
  function lose() {
    const c = audio();
    if (!c) return;
    [392, 311.1, 246.9].forEach((f, k) => {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.connect(envelope(c, 0.12, 0.01, 0.4, k * 0.14));
      o.start(c.currentTime + k * 0.14);
      o.stop(c.currentTime + k * 0.14 + 0.55);
    });
  }

  // Égalité : un choc sourd qui accompagne la secousse
  function thud() {
    const c = audio();
    if (!c) return;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(130, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(55, c.currentTime + 0.3);
    o.connect(envelope(c, 0.4, 0.005, 0.32));
    o.start();
    o.stop(c.currentTime + 0.4);
  }

  // La bombe : souffle grave et craquement
  function boom() {
    const c = audio();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3200, c.currentTime);
    lp.frequency.exponentialRampToValueAtTime(120, c.currentTime + 0.7);
    src.connect(lp).connect(envelope(c, 0.8, 0.004, 0.75));
    src.start(c.currentTime, 0, 0.85);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(110, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.6);
    o.connect(envelope(c, 0.6, 0.005, 0.6));
    o.start();
    o.stop(c.currentTime + 0.7);
  }

  // Les dernières secondes du mode éclair
  function tick(high = false) {
    const c = audio();
    if (!c) return;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = high ? 1320 : 880;
    o.connect(envelope(c, 0.05, 0.002, 0.07));
    o.start();
    o.stop(c.currentTime + 0.1);
  }

  // La grille qui tourne : un grondement qui monte
  function rumble(duration = 0.7) {
    const c = audio();
    if (!c) return;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(50, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(150, c.currentTime + duration);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    o.connect(lp).connect(envelope(c, 0.16, duration * 0.3, duration * 0.7));
    o.start();
    o.stop(c.currentTime + duration + 0.05);
    whoosh(duration);
  }

  return {
    clack, ting, whoosh, chime, click, fanfare, scribble, erase, lose, thud, boom, tick, rumble,
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
  };
})();

const Haptics = (() => {
  let enabled = true;
  return {
    buzz(pattern) {
      // Le navigateur refuse de vibrer tant qu'on n'a pas touché la page
      const touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
      if (enabled && touched && navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch (e) { /* non supporté */ }
      }
    },
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
  };
})();
