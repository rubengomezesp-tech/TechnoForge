/*
 * app.js — TechnoForge (Fase 1)
 * Generador de ideas + arreglo automático (track completo) + síntesis (Tone.js).
 * Todo ocurre en el navegador. Sin servidor, sin cuentas, sin costes.
 */

// ----------------------------------------------------------------------------
// Estado y constantes musicales
// ----------------------------------------------------------------------------
const STEPS = 16;
const SCALES = {
  minor:    [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian:   [0, 2, 3, 5, 7, 9, 10],
  ionian:   [0, 2, 4, 5, 7, 9, 11], // mayor — luminosa
  lydian:   [0, 2, 4, 6, 7, 9, 11], // asombro / grandeza
};

const TRACKS = [
  { id: "kick", name: "Kick",  type: "drum" },
  { id: "clap", name: "Clap",  type: "drum" },
  { id: "chat", name: "Hats",  type: "drum" },
  { id: "ohat", name: "Open",  type: "drum" },
  { id: "bass", name: "Bass",  type: "pitch" },
  { id: "stab", name: "Stab",  type: "pitch" },
];

// Cada estilo sesga la generación del patrón (carácter rítmico/percusivo)
const STYLE_PARAMS = {
  peaktime:   { hat: 0.50, stab: 2, bass: 0.70, seventh: false },
  hypnotic:   { hat: 0.42, stab: 1, bass: 0.85, seventh: false },
  melodic:    { hat: 0.40, stab: 3, bass: 0.60, seventh: true  },
  industrial: { hat: 0.70, stab: 1, bass: 0.72, seventh: false },
};

// Motor de Armonía Emocional: cada emoción fija una escala y una PROGRESIÓN
// (grados de la escala, un acorde por tiempo) + sesgos. Aquí vive la traducción
// "sentimiento → armonía" (ver docs/VISION.md). prog = grados 0-índice del acorde.
const EMOTIONS = {
  melancolia: { scale: "minor",    prog: [0, 5, 3, 4], seventh: true,  energy: 40, label: "Melancolía" }, // i–VI–iv–v
  esperanza:  { scale: "ionian",   prog: [0, 4, 5, 3], seventh: false, energy: 55, label: "Esperanza"  }, // I–V–vi–IV
  epica:      { scale: "minor",    prog: [0, 5, 6, 4], seventh: false, energy: 80, label: "Épica"      }, // i–VI–VII–v
  oscuridad:  { scale: "phrygian", prog: [0, 1, 0, 5], seventh: false, energy: 55, label: "Oscuridad"  }, // i–bII–i–VI
  nostalgia:  { scale: "dorian",   prog: [0, 3, 5, 4], seventh: true,  energy: 45, label: "Nostalgia"  }, // i–IV–VI–v
  grandeza:   { scale: "lydian",   prog: [0, 4, 5, 1], seventh: true,  energy: 72, label: "Grandeza"   },
  tension:    { scale: "phrygian", prog: [0, 4, 1, 4], seventh: false, energy: 88, label: "Tensión"    },
  liberacion: { scale: "ionian",   prog: [0, 3, 4, 0], seventh: false, energy: 70, label: "Liberación" }, // I–IV–V–I
};

// Estructura del track (modo Track). keep = pistas activas; variant = qué
// versión del bucle usa (A = original, B = mutación, para que no sea idéntico).
const ARRANGEMENT = [
  { name: "Intro",  bars: 4, keep: ["kick", "chat", "ohat"] },
  { name: "Build",  bars: 4, keep: ["kick", "chat", "ohat", "bass"], fillLast: true, riserLast: true },
  { name: "Drop",   bars: 8, keep: "all", impactFirst: true, downlifterLast: true, variant: "A" },
  { name: "Break",  bars: 4, keep: ["chat", "bass", "stab"], riserLast: true, variant: "B" },
  { name: "Drop 2", bars: 8, keep: "all", impactFirst: true, variant: "B" },
  { name: "Outro",  bars: 4, keep: ["kick", "chat"] },
];

let pattern;                  // el bucle base (el "drop") — inicializado abajo,
                              // tras definir arr16/blankPattern (evita TDZ al cargar)
let mutes = new Set();
let mode = "loop";            // "loop" | "song"
let built = null;             // { song, sections, fx } cuando hay track montado
let currentStep = -1;
let seq = null;
let live = null;

const $ = (id) => document.getElementById(id);
const rnd = Math.random;
const arr16 = (v) => Array.from({ length: STEPS }, () => v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function blankPattern() {
  return { kick: arr16(false), clap: arr16(false), chat: arr16(false),
           ohat: arr16(false), bass: arr16(null), stab: arr16(null) };
}

pattern = blankPattern(); // ya con arr16 inicializado

function rootPc()  { return parseInt($("root").value, 10); }
function scaleId() { return $("scale").value; }
function styleId() { return $("style").value; }
function bpm()     { return parseInt($("bpm").value, 10); }
function energy()  { return parseInt($("energy").value, 10) / 100; }
function swingAmt(){ return parseInt($("swing").value, 10) / 100; }

function emotionId()     { return $("emotion").value; }
function currentEmotion(){ return EMOTIONS[emotionId()] || EMOTIONS.melancolia; }
function wantSeventh()   { return STYLE_PARAMS[styleId()].seventh || currentEmotion().seventh; }

// Grado de la progresión que toca en el paso s (un acorde por tiempo = 4 pasos)
function progAt(s) {
  const pr = currentEmotion().prog;
  return pr[Math.floor(s / 4) % pr.length];
}

// Semitono diatónico del grado d (admite grados >6: sube de octava)
function scaleSemitone(d, sc) {
  const i = ((d % 7) + 7) % 7;
  return sc[i] + 12 * Math.floor(d / 7);
}

// Acorde (tríada / séptima) construido sobre el grado, en la octava base dada
function chordAt(degree, octaveBase, seventh) {
  const sc = SCALES[scaleId()];
  const tones = [degree, degree + 2, degree + 4];
  if (seventh) tones.push(degree + 6);
  return tones.map((d) => octaveBase + rootPc() + scaleSemitone(d, sc));
}

// Nota de bajo: la fundamental del acorde que toca en ese paso
function bassNoteAt(s) {
  return 24 + rootPc() + scaleSemitone(progAt(s), SCALES[scaleId()]);
}

// ----------------------------------------------------------------------------
// Generación de la idea (las "reglas" del techno + estilo)
// ----------------------------------------------------------------------------
function generate() {
  const e = energy();
  const sp = STYLE_PARAMS[styleId()];
  const sc = SCALES[scaleId()];
  const em = currentEmotion();
  const p = blankPattern();

  // Bombo 4x4
  [0, 4, 8, 12].forEach((s) => (p.kick[s] = true));
  if (e > 0.7 && rnd() < 0.4) p.kick[14] = true;

  // Clap en 2 y 4
  p.clap[4] = true;
  p.clap[12] = true;

  // Open hats al contratiempo
  [2, 6, 10, 14].forEach((s) => (p.ohat[s] = true));
  if (e < 0.3) { p.ohat[2] = false; p.ohat[10] = false; }

  // Closed hats con acentos
  for (let s = 0; s < STEPS; s++) {
    if (p.ohat[s]) continue;
    const dens = (s % 2 === 0 ? sp.hat + 0.15 : sp.hat) + e * 0.3;
    if (rnd() < dens) p.chat[s] = true;
  }

  // Bajo rodante — la fundamental sigue el acorde de cada tiempo (la armonía se mueve)
  [2, 3, 6, 7, 10, 11, 14, 15].forEach((s) => {
    if (rnd() < clamp(sp.bass + e * 0.2, 0, 0.95)) {
      const base = bassNoteAt(s);
      const fifth = base + (scaleSemitone(progAt(s) + 4, sc) - scaleSemitone(progAt(s), sc));
      const r = rnd();
      p.bass[s] = r > 0.85 ? base + 12 : r > 0.7 ? fifth : base;
    }
  });
  if (p.bass[2] == null) p.bass[2] = bassNoteAt(2);

  // Acordes: progresión emocional en los cuatro tiempos (columna armónica)…
  const seventh = wantSeventh();
  const prog = em.prog;
  [0, 4, 8, 12].forEach((s, i) => (p.stab[s] = chordAt(prog[i % prog.length], 48, seventh)));
  // …más stabs sincopados extra para groove (toman el acorde de su tiempo)
  const cand = shuffle([3, 7, 10, 11, 14]);
  const count = clamp(sp.stab - 1 + Math.round(e), 0, cand.length);
  cand.slice(0, count).forEach((s) => { if (p.stab[s] == null) p.stab[s] = chordAt(progAt(s), 48, seventh); });

  pattern = p;
  built = null;
  // Si no está sonando, fuerza recrear las voces (para que el cambio de estilo
  // — p.ej. el bajo reese — se aplique en la siguiente reproducción).
  if (Tone.Transport.state !== "started") live = null;
  refreshSong();
  renderGrid();
  setStatus(mode === "song"
    ? "Track montado. Pulsa <b>Play</b> para escucharlo entero."
    : "Idea generada. <b>Play</b> para escuchar; toca las celdas para editar.");
}

function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function regenTrack(id) {
  const before = pattern;
  generate();
  const fresh = pattern[id];
  pattern = before;
  pattern[id] = fresh;
  built = null;
  refreshSong();
  renderGrid();
}

// Copia y mutación del patrón (para variar los drops)
function deepCopy(p) {
  return { kick: [...p.kick], clap: [...p.clap], chat: [...p.chat], ohat: [...p.ohat],
           bass: [...p.bass], stab: p.stab.map((c) => (c ? [...c] : null)) };
}

function mutate(p) {
  const m = deepCopy(p);
  // Cambia algunas notas del bajo, siempre dentro del acorde de ese tiempo
  for (let s = 0; s < STEPS; s++)
    if (m.bass[s] != null && rnd() < 0.3) {
      const base = bassNoteAt(s);
      const r = rnd();
      m.bass[s] = r > 0.6 ? base + 12 : r > 0.3 ? base + 7 : base;
    }
  // Re-rolea un par de closed hats
  for (let i = 0; i < 3; i++) {
    const s = Math.floor(rnd() * STEPS);
    if (!m.ohat[s]) m.chat[s] = !m.chat[s];
  }
  // Mueve un stab de sitio
  const idxs = [];
  m.stab.forEach((c, s) => { if (c) idxs.push(s); });
  if (idxs.length) {
    const from = idxs[Math.floor(rnd() * idxs.length)];
    const to = [3, 7, 10, 11, 14][Math.floor(rnd() * 5)];
    if (m.stab[to] == null) { m.stab[to] = m.stab[from]; m.stab[from] = null; }
  }
  // Ghost de bombo
  if (rnd() < 0.5) m.kick[14] = !m.kick[14];
  return m;
}

// ----------------------------------------------------------------------------
// Arreglo automático: convierte el bucle base en un track completo
// ----------------------------------------------------------------------------
function buildSong() {
  const song = { kick: [], clap: [], chat: [], ohat: [], bass: [], stab: [] };
  const sections = [];
  const fx = [];
  const variants = { A: pattern, B: mutate(pattern) };
  let barCursor = 0;

  for (const sec of ARRANGEMENT) {
    const keepAll = sec.keep === "all";
    const keep = (id) => keepAll || sec.keep.includes(id);
    const src = variants[sec.variant || "A"];
    const startStep = barCursor * STEPS;

    for (let b = 0; b < sec.bars; b++) {
      const lastBar = b === sec.bars - 1;
      for (let s = 0; s < STEPS; s++) {
        const roll = sec.fillLast && lastBar; // fill de hats en el último compás
        song.kick.push(keep("kick") ? src.kick[s] : false);
        song.clap.push(keep("clap") ? src.clap[s] : false);
        song.chat.push(roll ? true : (keep("chat") ? src.chat[s] : false));
        song.ohat.push(keep("ohat") ? src.ohat[s] : false);
        song.bass.push(keep("bass") ? src.bass[s] : null);
        song.stab.push(keep("stab") ? src.stab[s] : null);
      }
    }

    sections.push({ name: sec.name, startBar: barCursor, bars: sec.bars });
    if (sec.impactFirst)    fx.push({ step: startStep, type: "impact" });
    if (sec.riserLast)      fx.push({ step: (barCursor + sec.bars - 1) * STEPS, type: "riser" });
    if (sec.downlifterLast) fx.push({ step: (barCursor + sec.bars - 1) * STEPS, type: "downlifter" });
    barCursor += sec.bars;
  }
  return { song, sections, fx };
}

function refreshSong() {
  if (mode === "song") built = buildSong();
  renderTimeline();
}

// ----------------------------------------------------------------------------
// Síntesis (idéntica para reproducción en vivo y exportación WAV)
// ----------------------------------------------------------------------------
function buildVoices(opts = {}) {
  const dest = Tone.getDestination();
  // Para exportar STEMS queremos el sonido "en crudo" (sin la cadena de máster),
  // para que sumen bien y los mezcles/masterices en tu DAW. bypassMaster lo omite.
  let master;
  if (opts.bypassMaster) {
    master = new Tone.Gain(0.85).connect(dest);
  } else {
    // --- Cadena de mastering: EQ → glue comp → saturación suave → makeup → limitador ---
    const limiter = new Tone.Limiter(-0.5).connect(dest);
    const makeup = new Tone.Gain(1.4).connect(limiter);        // empuje de volumen
    const sat = new Tone.Distortion({ distortion: 0.08, oversample: "2x" }).connect(makeup);
    sat.wet.value = 0.12;                                       // calidez sutil
    const glue = new Tone.Compressor({ threshold: -18, ratio: 2.5, attack: 0.02, release: 0.18 }).connect(sat);
    const eq = new Tone.EQ3({ low: -1, mid: 0, high: 1.5 }).connect(glue); // limpia graves, da aire
    master = new Tone.Gain(0.85).connect(eq);
  }

  const drumBus = new Tone.Gain(1).connect(master);
  const musicalBus = new Tone.Gain(1).connect(master); // recibe el "pump"

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 6, oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.02 },
  }).connect(drumBus);

  const clapFilter = new Tone.Filter(1400, "bandpass").connect(drumBus);
  const clap = new Tone.NoiseSynth({
    noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.18, sustain: 0 },
  }).connect(clapFilter);

  const chatFilter = new Tone.Filter(8000, "highpass").connect(drumBus);
  const chat = new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -8, envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  }).connect(chatFilter);

  const ohatFilter = new Tone.Filter(7000, "highpass").connect(drumBus);
  const ohat = new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -10, envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
  }).connect(ohatFilter);

  // Bajo: "reese" (sierras detunadas) en estilos oscuros, sierra simple en el resto
  const reese = styleId() === "hypnotic" || styleId() === "industrial";
  const bass = new Tone.MonoSynth({
    oscillator: reese ? { type: "fatsawtooth", count: 3, spread: 40 } : { type: "sawtooth" },
    volume: -6, filter: { type: "lowpass", Q: 2 },
    filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.1, baseFrequency: 90, octaves: 2.6 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.45, release: 0.12 },
  }).connect(musicalBus);

  // Acordes con reverb (Freeverb es algorítmico: válido también en render offline)
  // para ese aire cinematográfico de melodic/progressive.
  const stabVerb = new Tone.Freeverb({ roomSize: 0.62, dampening: 3000 }).connect(musicalBus);
  stabVerb.wet.value = 0.28;
  const stabFilter = new Tone.Filter(2200, "lowpass").connect(stabVerb);
  const stab = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" }, volume: -14,
    envelope: { attack: 0.006, decay: 0.22, sustain: 0.05, release: 0.18 },
  }).connect(stabFilter);

  // FX (no pasan por el pump): riser e impacto
  const riserFilter = new Tone.Filter(300, "highpass").connect(master);
  const riserNoise = new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -14, envelope: { attack: 0.01, decay: 0.01, sustain: 1, release: 0.06 },
  }).connect(riserFilter);

  const impactFilter = new Tone.Filter(2500, "highpass").connect(master);
  const impact = new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -6, envelope: { attack: 0.001, decay: 1.1, sustain: 0, release: 0.1 },
  }).connect(impactFilter);

  // Downlifter: barrido descendente para soltar tensión al salir de un drop
  const downFilter = new Tone.Filter(9000, "lowpass").connect(master);
  const downNoise = new Tone.NoiseSynth({
    noise: { type: "pink" }, volume: -16, envelope: { attack: 0.01, decay: 0.01, sustain: 1, release: 0.06 },
  }).connect(downFilter);

  const midi = (m) => Tone.Frequency(m, "midi").toFrequency();

  return {
    kick: (t) => kick.triggerAttackRelease("C1", "8n", t),
    clap: (t) => { // dos golpes muy juntos = clap con más cuerpo
      clap.triggerAttackRelease("16n", t, 0.9);
      clap.triggerAttackRelease("32n", t + 0.012, 0.6);
    },
    chat: (t, v = 1) => chat.triggerAttackRelease("32n", t, v),
    ohat: (t) => ohat.triggerAttackRelease("16n", t, 0.9),
    bass: (t, m) => bass.triggerAttackRelease(midi(m), "16n", t),
    stab: (t, arr) => stab.triggerAttackRelease(arr.map(midi), "8n", t),
    pump: (t) => {
      musicalBus.gain.cancelScheduledValues(t);
      musicalBus.gain.setValueAtTime(0.25, t);
      musicalBus.gain.linearRampToValueAtTime(1, t + 0.18);
    },
    riser: (t, dur) => {
      riserFilter.frequency.cancelScheduledValues(t);
      riserFilter.frequency.setValueAtTime(300, t);
      riserFilter.frequency.exponentialRampToValueAtTime(9000, t + dur);
      riserNoise.triggerAttackRelease(dur, t, 0.5);
    },
    impact: (t) => impact.triggerAttackRelease(1.1, t, 0.8),
    downlifter: (t, dur) => {
      downFilter.frequency.cancelScheduledValues(t);
      downFilter.frequency.setValueAtTime(9000, t);
      downFilter.frequency.exponentialRampToValueAtTime(300, t + dur);
      downNoise.triggerAttackRelease(dur, t, 0.4);
    },
  };
}

// inc(trackId) decide si una pista suena (para aislar stems). Por defecto, todas.
// El "pump" (sidechain) se dispara siempre con el bombo, aunque el bombo esté
// excluido, para que el stem de bajo/acordes conserve su respiración.
function triggerStep(v, p, s, time, inc = () => true) {
  if (p.kick[s] && inc("kick") && !mutes.has("kick")) v.kick(time);
  if (p.kick[s]) v.pump(time);
  if (p.clap[s] && inc("clap") && !mutes.has("clap")) v.clap(time);
  if (p.chat[s] && inc("chat") && !mutes.has("chat")) {
    const vel = (s % 4 === 0 ? 0.95 : 0.6) + rnd() * 0.1; // humanización
    v.chat(time, clamp(vel, 0, 1));
  }
  if (p.ohat[s] && inc("ohat") && !mutes.has("ohat")) v.ohat(time);
  if (p.bass[s] != null && inc("bass") && !mutes.has("bass")) v.bass(time, p.bass[s]);
  if (p.stab[s] != null && inc("stab") && !mutes.has("stab")) v.stab(time, p.stab[s]);
}

// ----------------------------------------------------------------------------
// Reproducción en vivo
// ----------------------------------------------------------------------------
async function play() {
  await Tone.start();
  Tone.Transport.bpm.value = bpm();
  Tone.Transport.swing = swingAmt();
  Tone.Transport.swingSubdivision = "16n";
  if (!live) live = buildVoices();
  if (seq) seq.dispose();

  const p = mode === "song" && built ? built.song : pattern;
  const fxMap = {};
  if (mode === "song" && built) built.fx.forEach((e) => (fxMap[e.step] = e.type));
  const len = p.kick.length;
  const barSec = (60 / bpm()) * 4;

  seq = new Tone.Sequence((time, g) => {
    triggerStep(live, p, g, time);
    if (fxMap[g] === "riser") live.riser(time, barSec);
    if (fxMap[g] === "downlifter") live.downlifter(time, barSec);
    if (fxMap[g] === "impact") live.impact(time);
    Tone.Draw.schedule(() => { highlight(g % STEPS); highlightSection(g); }, time);
  }, [...Array(len).keys()], "16n").start(0);

  Tone.Transport.start();
  $("playBtn").classList.add("playing");
  $("playBtn").textContent = "⏸ Stop";
}

function stop() {
  Tone.Transport.stop();
  if (seq) { seq.dispose(); seq = null; }
  $("playBtn").classList.remove("playing");
  $("playBtn").textContent = "▶ Play";
  highlight(-1);
}

function togglePlay() {
  if (Tone.Transport.state === "started") stop(); else play();
}

function toggleMode() {
  const wasPlaying = Tone.Transport.state === "started";
  if (wasPlaying) stop();
  mode = mode === "loop" ? "song" : "loop";
  if (mode === "song") built = buildSong();
  $("modeBtn").textContent = mode === "song" ? "🎚️ Track" : "🔁 Bucle";
  renderTimeline();
  setStatus(mode === "song"
    ? "Modo <b>Track completo</b>: Intro · Build · Drop · Break · Drop 2 · Outro."
    : "Modo <b>Bucle</b>: un compás que se repite.");
  if (wasPlaying) play();
}

// ----------------------------------------------------------------------------
// Exportación
// ----------------------------------------------------------------------------
function repeatPattern(p, n) {
  const out = { kick: [], clap: [], chat: [], ohat: [], bass: [], stab: [] };
  for (let i = 0; i < n; i++)
    for (const k of Object.keys(out)) out[k] = out[k].concat(p[k]);
  return out;
}

function activeSong() {
  if (mode === "song") { if (!built) built = buildSong(); return built; }
  return null;
}

// Renderiza el patrón/track a un AudioBuffer offline (mismo motor que en vivo).
// inc(trackId) limita qué pistas suenan; opts.bypassMaster da el sonido en crudo.
async function renderOffline(p, fx, inc, opts) {
  const totalSteps = p.kick.length;
  const stepDur = (60 / bpm()) / 4;
  const barSec = (60 / bpm()) * 4;
  const sw = swingAmt();
  const seconds = totalSteps * stepDur + 1.5;

  return Tone.Offline(() => {
    const v = buildVoices(opts);
    for (let g = 0; g < totalSteps; g++) {
      let t = g * stepDur;
      if (sw && g % 2 === 1) t += stepDur * sw * 0.66;
      triggerStep(v, p, g, t, inc);
    }
    if (fx) fx.forEach((e) => {
      const t = e.step * stepDur;
      if (e.type === "riser") v.riser(t, barSec);
      else if (e.type === "downlifter") v.downlifter(t, barSec);
      else v.impact(t);
    });
  }, seconds);
}

async function exportWav() {
  setStatus("Renderizando WAV…");
  const songData = activeSong();
  const p = songData ? songData.song : repeatPattern(pattern, 4);
  const fx = songData ? songData.fx : null;
  const buffer = await renderOffline(p, fx, () => true, {});
  TechnoMidi.download(encodeWav(buffer.get()), `technoforge-${mode}-${bpm()}bpm.wav`, "audio/wav");
  setStatus("WAV exportado ✔");
}

// Exporta cada instrumento como su propio WAV (en crudo, sin máster) dentro de
// un único .zip — listo para arrastrar a Ableton/FL/Bitwig y rematar la mezcla.
async function exportStems() {
  setStatus("Renderizando stems… (puede tardar unos segundos)");
  const songData = activeSong();
  const p = songData ? songData.song : repeatPattern(pattern, 4);
  const fx = songData ? songData.fx : null;
  const files = [];
  const n = () => String(files.length + 1).padStart(2, "0");

  for (const t of TRACKS) {
    const buf = await renderOffline(p, null, (id) => id === t.id, { bypassMaster: true });
    files.push({ name: `${n()}-${t.id}.wav`, data: encodeWav(buf.get()) });
    setStatus(`Stem ${t.name} listo ✔`);
  }
  // Stem aparte con los FX del arreglo (risers/impactos), solo en modo Track.
  if (fx && fx.length) {
    const buf = await renderOffline(p, fx, () => false, { bypassMaster: true });
    files.push({ name: `${n()}-fx.wav`, data: encodeWav(buf.get()) });
  }

  const zip = TechnoZip.create(files);
  TechnoMidi.download(zip, `technoforge-stems-${mode}-${bpm()}bpm.zip`, "application/zip");
  setStatus(`Stems exportados ✔ (${files.length} pistas) — descomprime y arrástralas a tu DAW.`);
}

function exportMidiFile() {
  const songData = activeSong();
  const p = songData ? songData.song : pattern;
  TechnoMidi.download(TechnoMidi.exportMidi(p, bpm()), `technoforge-${mode}-${bpm()}bpm.mid`);
  setStatus("MIDI exportado ✔ — ábrelo en tu DAW (Ableton, FL, Bitwig…).");
}

function encodeWav(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;
  const rate = audioBuffer.sampleRate;
  const blockAlign = numCh * 2;
  const dataSize = len * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const wstr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  wstr(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); wstr(8, "WAVE");
  wstr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * blockAlign, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); wstr(36, "data"); view.setUint32(40, dataSize, true);

  const chans = [];
  for (let c = 0; c < numCh; c++) chans.push(audioBuffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++)
    for (let c = 0; c < numCh; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  return new Uint8Array(buffer);
}

// ----------------------------------------------------------------------------
// Interfaz
// ----------------------------------------------------------------------------
function renderGrid() {
  const grid = $("grid");
  grid.innerHTML = "";
  for (const t of TRACKS) {
    const row = document.createElement("div");
    row.className = "track";

    const head = document.createElement("div");
    head.className = "track-head";
    head.innerHTML = `<span class="name">${t.name}</span>`;
    const m = document.createElement("button");
    m.className = "mini" + (mutes.has(t.id) ? " muted" : "");
    m.textContent = "M"; m.title = "Silenciar";
    m.onclick = () => { mutes.has(t.id) ? mutes.delete(t.id) : mutes.add(t.id); renderGrid(); };
    const r = document.createElement("button");
    r.className = "mini"; r.textContent = "🎲"; r.title = "Regenerar esta pista";
    r.onclick = () => regenTrack(t.id);
    head.append(m, r);

    const steps = document.createElement("div");
    steps.className = "steps";
    for (let s = 0; s < STEPS; s++) {
      const cell = document.createElement("div");
      const on = t.type === "drum" ? pattern[t.id][s] : pattern[t.id][s] != null;
      cell.className = "step" + (s % 4 === 0 ? " beat" : "") + (on ? " on" : "")
                       + (on && t.type === "pitch" ? " note" : "");
      cell.dataset.track = t.id; cell.dataset.step = s;
      cell.onclick = () => toggleCell(t, s);
      steps.appendChild(cell);
    }
    row.append(head, steps);
    grid.appendChild(row);
  }
}

function toggleCell(t, s) {
  if (t.type === "drum") pattern[t.id][s] = !pattern[t.id][s];
  else if (t.id === "bass") pattern.bass[s] = pattern.bass[s] == null ? bassNoteAt(s) : null;
  else pattern.stab[s] = pattern.stab[s] == null ? chordAt(progAt(s), 48, wantSeventh()) : null;
  built = null;
  refreshSong();
  renderGrid();
}

function renderTimeline() {
  const tl = $("timeline");
  tl.innerHTML = "";
  if (!(mode === "song" && built)) return;
  built.sections.forEach((s, i) => {
    const d = document.createElement("div");
    d.className = "sec"; d.dataset.idx = i; d.style.flexGrow = s.bars;
    d.innerHTML = `${s.name}<span class="bars">${s.bars} comp.</span>`;
    tl.appendChild(d);
  });
}

function highlightSection(g) {
  if (!(mode === "song" && built)) return;
  const bar = Math.floor(g / STEPS);
  const idx = built.sections.findIndex((s) => bar >= s.startBar && bar < s.startBar + s.bars);
  document.querySelectorAll(".timeline .sec").forEach((el) =>
    el.classList.toggle("active", +el.dataset.idx === idx));
}

function highlight(s) {
  if (currentStep === s) return;
  document.querySelectorAll(".step.playhead").forEach((el) => el.classList.remove("playhead"));
  if (s >= 0) document.querySelectorAll(`.step[data-step="${s}"]`).forEach((el) => el.classList.add("playhead"));
  currentStep = s;
}

function setStatus(html) { $("status").innerHTML = html; }

// ----------------------------------------------------------------------------
// Arranque
// ----------------------------------------------------------------------------
function init() {
  $("playBtn").onclick = togglePlay;
  $("genBtn").onclick = generate;
  $("modeBtn").onclick = toggleMode;
  $("midiBtn").onclick = exportMidiFile;
  $("wavBtn").onclick = exportWav;
  $("stemsBtn").onclick = exportStems;

  // La emoción fija escala + energía sugeridas y regenera (Motor de Armonía Emocional)
  $("emotion").onchange = () => {
    const em = currentEmotion();
    $("scale").value = em.scale;
    $("energy").value = em.energy;
    $("energyOut").textContent = em.energy;
    generate();
  };
  // Cambiar tonalidad / escala / estilo regenera la idea para aplicarlos
  ["root", "scale", "style"].forEach((id) => ($(id).onchange = generate));

  // Aplica la escala de la emoción por defecto antes del primer generate()
  $("scale").value = currentEmotion().scale;

  const bindRange = (id) => {
    const el = $(id), out = $(id + "Out");
    el.oninput = () => {
      if (out) out.textContent = el.value;
      if (id === "bpm") Tone.Transport.bpm.value = bpm();
      if (id === "swing") Tone.Transport.swing = swingAmt();
    };
  };
  ["bpm", "energy", "swing"].forEach(bindRange);

  generate();
}

window.addEventListener("DOMContentLoaded", init);
