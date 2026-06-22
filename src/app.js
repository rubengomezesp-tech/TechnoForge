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
};

// hue = color con significado: cálidos = percusión (rítmico), fríos = tonal.
// role = qué aporta cada pista; help = explicación honesta para el novato.
const TRACKS = [
  { id: "kick", name: "Kick", role: "pulso · 4×4",         type: "drum",  hue: 4,
    help: "Bombo: el pulso 4×4, la base de todo. Dispara el sidechain (pump) sobre bajo y acordes." },
  { id: "clap", name: "Clap", role: "backbeat · 2 y 4",    type: "drum",  hue: 26,
    help: "Clap/palmada en los tiempos 2 y 4: marca el backbeat y abre el groove." },
  { id: "chat", name: "Hats", role: "subdivisión · groove",type: "drum",  hue: 45,
    help: "Charles cerrado: subdivide el compás. Su densidad y acentos dan el groove." },
  { id: "ohat", name: "Open", role: "contratiempo · aire", type: "drum",  hue: 54,
    help: "Charles abierto al contratiempo (offbeat): aire, oscuridad y empuje." },
  { id: "bass", name: "Bass", role: "sub-grave · raíz",    type: "pitch", hue: 168,
    help: "Bajo: ocupa el sub-grave, define la raíz y el movimiento armónico. Recibe el pump." },
  { id: "stab", name: "Stab", role: "tensión armónica",    type: "pitch", hue: 205,
    help: "Stab/acorde sincopado: aporta tensión y color armónico sobre el groove." },
];
const trackColor = (t) => `hsl(${t.hue} 85% 60%)`;

// Cada estilo sesga la generación del patrón
const STYLE_PARAMS = {
  peaktime:   { hat: 0.50, stab: 2, bass: 0.70, seventh: false },
  hypnotic:   { hat: 0.42, stab: 1, bass: 0.85, seventh: false },
  melodic:    { hat: 0.40, stab: 3, bass: 0.60, seventh: true  },
  industrial: { hat: 0.70, stab: 1, bass: 0.72, seventh: false },
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

// Helpers (declarados antes de cualquier uso para evitar TDZ al inicializar estado).
const $ = (id) => document.getElementById(id);
const rnd = Math.random;
const arr16 = (v) => Array.from({ length: STEPS }, () => v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let pattern = blankPattern(); // el bucle base (el "drop")
let mutes = new Set();
let solos = new Set();        // Fase 5: aislar capas para aprender el tema
let mode = "loop";            // "loop" | "song"
let built = null;             // { song, sections, fx } cuando hay track montado
let currentStep = -1;
let seq = null;
let live = null;

// Estado de mezcla por pista (se aplica en vivo y en la exportación WAV).
const mix = {};
TRACKS.forEach((t) => (mix[t.id] = { vol: 1, pan: 0 }));

// Una pista suena si no está muteada y, si hay algún solo activo, está soleada.
const isAudible = (id) => !mutes.has(id) && (solos.size === 0 || solos.has(id));

const reduceMotion =
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

function blankPattern() {
  return { kick: arr16(false), clap: arr16(false), chat: arr16(false),
           ohat: arr16(false), bass: arr16(null), stab: arr16(null) };
}

function rootPc()  { return parseInt($("root").value, 10); }
function scaleId() { return $("scale").value; }
function styleId() { return $("style").value; }
function bpm()     { return parseInt($("bpm").value, 10); }
function energy()  { return parseInt($("energy").value, 10) / 100; }
function swingAmt(){ return parseInt($("swing").value, 10) / 100; }

function bassRoot() { return 24 + rootPc(); }
function stabChord(seventh) {
  const base = 48 + rootPc();
  const sc = SCALES[scaleId()];
  const chord = [base, base + sc[2], base + sc[4]]; // tríada de la tonalidad
  if (seventh) chord.push(base + sc[6]);
  return chord;
}

// ----------------------------------------------------------------------------
// Generación de la idea (las "reglas" del techno + estilo)
// ----------------------------------------------------------------------------
function generate() {
  const e = energy();
  const sp = STYLE_PARAMS[styleId()];
  const sc = SCALES[scaleId()];
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

  // Bajo rodante
  const root = bassRoot();
  const fifth = root + sc[4];
  [2, 3, 6, 7, 10, 11, 14, 15].forEach((s) => {
    if (rnd() < clamp(sp.bass + e * 0.2, 0, 0.95)) {
      const r = rnd();
      p.bass[s] = r > 0.85 ? root + 12 : r > 0.7 ? fifth : root;
    }
  });
  if (p.bass[2] == null) p.bass[2] = root;

  // Stabs / acordes sincopados
  const cand = shuffle([3, 7, 10, 11, 14]);
  const count = clamp(sp.stab + Math.round(e), 1, cand.length);
  cand.slice(0, count).forEach((s) => (p.stab[s] = stabChord(sp.seventh)));

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
  const sc = SCALES[scaleId()];
  const root = bassRoot(), fifth = root + sc[4];
  // Cambia algunas notas del bajo
  for (let s = 0; s < STEPS; s++)
    if (m.bass[s] != null && rnd() < 0.3) {
      const r = rnd();
      m.bass[s] = r > 0.6 ? root + 12 : r > 0.3 ? fifth : root;
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
function buildVoices() {
  const dest = Tone.getDestination();
  // --- Cadena de mastering: EQ → glue comp → saturación suave → makeup → limitador ---
  const limiter = new Tone.Limiter(-0.5).connect(dest);
  const makeup = new Tone.Gain(1.4).connect(limiter);        // empuje de volumen
  const sat = new Tone.Distortion({ distortion: 0.08, oversample: "2x" }).connect(makeup);
  sat.wet.value = 0.12;                                       // calidez sutil
  const glue = new Tone.Compressor({ threshold: -18, ratio: 2.5, attack: 0.02, release: 0.18 }).connect(sat);
  const eq = new Tone.EQ3({ low: -1, mid: 0, high: 1.5 }).connect(glue); // limpia graves, da aire
  const master = new Tone.Gain(0.85).connect(eq);

  const drumBus = new Tone.Gain(1).connect(master);
  const musicalBus = new Tone.Gain(1).connect(master); // recibe el "pump"

  // --- Medición del máster: taps en paralelo (no consumen ni alteran la señal) ---
  const masterMeter = new Tone.Meter({ normalRange: true, smoothing: 0.78 });
  const fft = new Tone.Analyser("fft", 1024);
  const wave = new Tone.Analyser("waveform", 1024);
  limiter.connect(masterMeter);
  limiter.connect(fft);
  limiter.connect(wave);

  // --- Channel strips por pista: gain (fader) → pan → meter → bus ---
  // El meter es un paso-a-través: lee nivel sin alterar el audio (Fase 2).
  const channels = {};
  TRACKS.forEach((t) => {
    const bus = t.type === "pitch" ? musicalBus : drumBus;
    const meter = new Tone.Meter({ normalRange: true, smoothing: 0.7 });
    const panner = new Tone.Panner(mix[t.id].pan).connect(meter);
    const gain = new Tone.Gain(mix[t.id].vol).connect(panner);
    meter.connect(bus);
    channels[t.id] = { gain, panner, meter };
  });

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 6, oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.02 },
  }).connect(channels.kick.gain);

  const clapFilter = new Tone.Filter(1400, "bandpass").connect(channels.clap.gain);
  const clap = new Tone.NoiseSynth({
    noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.18, sustain: 0 },
  }).connect(clapFilter);

  const chatFilter = new Tone.Filter(8000, "highpass").connect(channels.chat.gain);
  const chat = new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -8, envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  }).connect(chatFilter);

  const ohatFilter = new Tone.Filter(7000, "highpass").connect(channels.ohat.gain);
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
  }).connect(channels.bass.gain);

  const stabFilter = new Tone.Filter(2200, "lowpass").connect(channels.stab.gain);
  const stab = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" }, volume: -14,
    envelope: { attack: 0.004, decay: 0.18, sustain: 0, release: 0.1 },
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
    channels,                                   // { id: { gain, panner, meter } }
    meters: { master: masterMeter, fft, wave }, // medición del máster
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

function triggerStep(v, p, s, time) {
  if (p.kick[s] && isAudible("kick")) v.kick(time);
  if (p.kick[s]) v.pump(time);
  if (p.clap[s] && isAudible("clap")) v.clap(time);
  if (p.chat[s] && isAudible("chat")) {
    const vel = (s % 4 === 0 ? 0.95 : 0.6) + rnd() * 0.1; // humanización
    v.chat(time, clamp(vel, 0, 1));
  }
  if (p.ohat[s] && isAudible("ohat")) v.ohat(time);
  if (p.bass[s] != null && isAudible("bass")) v.bass(time, p.bass[s]);
  if (p.stab[s] != null && isAudible("stab")) v.stab(time, p.stab[s]);
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
    // El dibujado se agenda en el INSTANTE en que suena (no al agendar):
    // así el flash de cada celda coincide a oído con el golpe.
    Tone.Draw.schedule(() => {
      highlight(g % STEPS);
      highlightSection(g);
      flashHits(p, g);
    }, time);
  }, [...Array(len).keys()], "16n").start(0);

  Tone.Transport.start();
  startMeterLoop();
  $("playBtn").classList.add("playing");
  $("playBtn").textContent = "⏸ Stop";
}

// Flash de las celdas cuya pista acaba de sonar en este step (Fase 1).
function flashHits(p, g) {
  const col = g % STEPS;
  for (const t of TRACKS) {
    const fired = t.type === "drum" ? p[t.id][g] : p[t.id][g] != null;
    if (!fired || !isAudible(t.id)) continue;
    const cell = document.querySelector(
      `.step[data-track="${t.id}"][data-step="${col}"]`
    );
    if (cell) { cell.classList.remove("hit"); void cell.offsetWidth; cell.classList.add("hit"); }
  }
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

async function exportWav() {
  setStatus("Renderizando WAV…");
  const songData = activeSong();
  const p = songData ? songData.song : repeatPattern(pattern, 4);
  const fx = songData ? songData.fx : null;

  const totalSteps = p.kick.length;
  const stepDur = (60 / bpm()) / 4;
  const barSec = (60 / bpm()) * 4;
  const sw = swingAmt();
  const seconds = totalSteps * stepDur + 1.5;

  const buffer = await Tone.Offline(() => {
    const v = buildVoices();
    for (let g = 0; g < totalSteps; g++) {
      let t = g * stepDur;
      if (sw && g % 2 === 1) t += stepDur * sw * 0.66;
      triggerStep(v, p, g, t);
    }
    if (fx) fx.forEach((e) => {
      const t = e.step * stepDur;
      if (e.type === "riser") v.riser(t, barSec);
      else if (e.type === "downlifter") v.downlifter(t, barSec);
      else v.impact(t);
    });
  }, seconds);

  const wav = encodeWav(buffer.get());
  TechnoMidi.download(wav, `technoforge-${mode}-${bpm()}bpm.wav`);
  setStatus("WAV exportado ✔");
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
  const soloing = solos.size > 0;

  for (const t of TRACKS) {
    const row = document.createElement("div");
    row.className = "track"
      + (mutes.has(t.id) || (soloing && !solos.has(t.id)) ? " dim" : "")
      + (solos.has(t.id) ? " soloed" : "");
    row.style.setProperty("--trk", trackColor(t));
    row.dataset.help = t.help;

    // --- cabecera / channel strip ---
    const head = document.createElement("div");
    head.className = "track-head";

    const top = document.createElement("div");
    top.className = "head-top";
    top.innerHTML =
      `<span class="chip"></span><span class="name">${t.name}</span><span class="role">${t.role}</span>`;

    const ctrls = document.createElement("div");
    ctrls.className = "head-ctrls";

    const m = document.createElement("button");
    m.className = "mini" + (mutes.has(t.id) ? " muted" : "");
    m.textContent = "M"; m.dataset.help = `Silencia ${t.name}. Útil para oír el tema sin esta capa.`;
    m.onclick = () => { mutes.has(t.id) ? mutes.delete(t.id) : mutes.add(t.id); renderGrid(); };

    const so = document.createElement("button");
    so.className = "mini" + (solos.has(t.id) ? " solo-on" : "");
    so.textContent = "S"; so.dataset.help = `Solo: aísla ${t.name} para aprender qué aporta. Varios solos sumables.`;
    so.onclick = () => { solos.has(t.id) ? solos.delete(t.id) : solos.add(t.id); renderGrid(); };

    const r = document.createElement("button");
    r.className = "mini"; r.textContent = "🎲";
    r.dataset.help = `Regenera solo la pista ${t.name}, manteniendo el resto.`;
    r.onclick = () => regenTrack(t.id);

    ctrls.append(m, so, r);

    const faders = document.createElement("div");
    faders.className = "faders";
    const vol = document.createElement("label");
    vol.className = "fader vol";
    vol.dataset.help = `Volumen de ${t.name} en la mezcla. Se aplica también al exportar WAV.`;
    vol.innerHTML = `<span>Vol</span>`;
    const volIn = document.createElement("input");
    volIn.type = "range"; volIn.min = 0; volIn.max = 140; volIn.value = Math.round(mix[t.id].vol * 100);
    volIn.oninput = () => setVol(t.id, volIn.value / 100);
    vol.appendChild(volIn);

    const pan = document.createElement("label");
    pan.className = "fader pan";
    pan.dataset.help = `Panorama de ${t.name}: izquierda ↔ derecha en el campo estéreo.`;
    pan.innerHTML = `<span>Pan</span>`;
    const panIn = document.createElement("input");
    panIn.type = "range"; panIn.min = -100; panIn.max = 100; panIn.value = Math.round(mix[t.id].pan * 100);
    panIn.oninput = () => setPan(t.id, panIn.value / 100);
    pan.appendChild(panIn);

    faders.append(vol, pan);
    head.append(top, ctrls, faders);

    // --- steps ---
    const steps = document.createElement("div");
    steps.className = "steps";
    for (let s = 0; s < STEPS; s++) {
      const cell = document.createElement("div");
      const on = t.type === "drum" ? pattern[t.id][s] : pattern[t.id][s] != null;
      cell.className = "step" + (s % 4 === 0 ? " beat" : "") + (on ? " on" : "");
      cell.dataset.track = t.id; cell.dataset.step = s;
      cell.onclick = () => toggleCell(t, s);
      steps.appendChild(cell);
    }

    // --- medidor VU por canal (Fase 2) ---
    const vu = document.createElement("div");
    vu.className = "vu";
    vu.dataset.help = `Nivel de ${t.name} en tiempo real. La marca blanca es el pico (peak-hold).`;
    vu.innerHTML = `<i data-vu="${t.id}"></i><b data-peak="${t.id}"></b>`;

    row.append(head, steps, vu);
    grid.appendChild(row);
  }
}

// --- Mezcla en vivo: actualiza los nodos sin recrear el grafo ---
function setVol(id, v) {
  mix[id].vol = v;
  if (live && live.channels[id]) live.channels[id].gain.gain.rampTo(v, 0.02);
}
function setPan(id, p) {
  mix[id].pan = p;
  if (live && live.channels[id]) live.channels[id].panner.pan.rampTo(p, 0.02);
}

function toggleCell(t, s) {
  if (t.type === "drum") pattern[t.id][s] = !pattern[t.id][s];
  else if (t.id === "bass") pattern.bass[s] = pattern.bass[s] == null ? bassRoot() : null;
  else pattern.stab[s] = pattern.stab[s] == null ? stabChord(STYLE_PARAMS[styleId()].seventh) : null;
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
// Visualización en tiempo real (todo en requestAnimationFrame; lee, no agenda)
// ----------------------------------------------------------------------------
let rafId = null;
let scopeMode = "spectrum"; // "spectrum" | "scope"
let scopeCtx = null, scopeW = 0, scopeH = 0;
const peakHold = {};   // pico por pista (cae suave)
TRACKS.forEach((t) => (peakHold[t.id] = 0));
let masterPeak = 0;

function setupScope() {
  const cv = $("scope");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = cv.getBoundingClientRect();
  scopeW = Math.max(1, Math.round(rect.width));
  scopeH = Math.max(1, Math.round(rect.height));
  cv.width = scopeW * dpr;
  cv.height = scopeH * dpr;
  scopeCtx = cv.getContext("2d");
  scopeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startMeterLoop() {
  if (rafId != null) return;
  const loop = () => {
    rafId = requestAnimationFrame(loop);
    drawMeters();
    drawScope();
  };
  loop();
}

function drawMeters() {
  const decay = 0.025;
  for (const t of TRACKS) {
    let lvl = 0;
    if (live && live.channels[t.id]) {
      const v = live.channels[t.id].meter.getValue();
      lvl = clamp(typeof v === "number" ? v : 0, 0, 1);
    }
    peakHold[t.id] = Math.max(lvl, peakHold[t.id] - decay);
    const fill = document.querySelector(`[data-vu="${t.id}"]`);
    const peak = document.querySelector(`[data-peak="${t.id}"]`);
    if (fill) fill.style.height = (lvl * 100).toFixed(1) + "%";
    if (peak) peak.style.bottom = (peakHold[t.id] * 100).toFixed(1) + "%";
  }

  // máster
  let m = 0;
  if (live && live.meters) {
    const v = live.meters.master.getValue();
    m = clamp(typeof v === "number" ? v : 0, 0, 1.5);
  }
  masterPeak = Math.max(m, masterPeak - 0.02);
  const mFill = $("mMeterFill");
  if (mFill) mFill.style.height = (clamp(m, 0, 1) * 100).toFixed(1) + "%";
  const clipEl = $("clip");
  if (clipEl) {
    if (m >= 0.99) clipEl.classList.add("on");
    else if (masterPeak < 0.7) clipEl.classList.remove("on");
  }
}

function drawScope() {
  if (!scopeCtx) return;
  const ctx = scopeCtx;
  ctx.clearRect(0, 0, scopeW, scopeH);
  if (!live || !live.meters) return;

  if (scopeMode === "spectrum") {
    const data = live.meters.fft.getValue(); // dB, ~ -100..0
    const bins = data.length;
    const bars = 72;
    const minDb = -90, maxDb = -12;
    const barW = scopeW / bars;
    for (let i = 0; i < bars; i++) {
      // agrupación logarítmica: más resolución en graves
      const lo = Math.floor(Math.pow(i / bars, 2) * bins);
      const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / bars, 2) * bins));
      let max = -Infinity;
      for (let j = lo; j < hi && j < bins; j++) max = Math.max(max, data[j]);
      const norm = clamp((max - minDb) / (maxDb - minDb), 0, 1);
      const h = norm * scopeH;
      const hue = 168 - (i / bars) * 168; // teal (graves) → rojo (agudos)
      ctx.fillStyle = `hsl(${hue} 80% ${30 + norm * 30}%)`;
      ctx.fillRect(i * barW, scopeH - h, Math.max(1, barW - 1), h);
    }
  } else {
    const data = live.meters.wave.getValue(); // -1..1
    const n = data.length;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#18d3a7";
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * scopeW;
      const y = (0.5 - data[i] * 0.48) * scopeH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function toggleScope() {
  scopeMode = scopeMode === "spectrum" ? "scope" : "spectrum";
  $("scopeName").textContent = scopeMode === "spectrum" ? "Espectro" : "Osciloscopio";
  $("scopeToggle").textContent = scopeMode === "spectrum" ? "Onda" : "Espectro";
}

// ----------------------------------------------------------------------------
// Ayuda contextual (barra inferior estilo DAW)
// ----------------------------------------------------------------------------
const helpDefault = "Pasa el ratón por cualquier control para entender qué hace.";
function bindHelp() {
  const bar = $("helpbar").firstElementChild;
  const show = (e) => {
    const el = e.target.closest("[data-help]");
    if (el) bar.innerHTML = el.dataset.help;
  };
  document.body.addEventListener("mouseover", show);
  document.body.addEventListener("focusin", show);
  document.body.addEventListener("mouseout", (e) => {
    if (e.target.closest("[data-help]")) bar.innerHTML = helpDefault;
  });
}

// ----------------------------------------------------------------------------
// Arranque
// ----------------------------------------------------------------------------
function init() {
  $("playBtn").onclick = togglePlay;
  $("genBtn").onclick = generate;
  $("modeBtn").onclick = toggleMode;
  $("midiBtn").onclick = exportMidiFile;
  $("wavBtn").onclick = exportWav;

  // Cambiar tonalidad / escala / estilo regenera la idea para aplicarlos
  ["root", "scale", "style"].forEach((id) => ($(id).onchange = generate));

  const bindRange = (id) => {
    const el = $(id), out = $(id + "Out");
    el.oninput = () => {
      if (out) out.textContent = el.value;
      if (id === "bpm") Tone.Transport.bpm.value = bpm();
      if (id === "swing") Tone.Transport.swing = swingAmt();
    };
  };
  ["bpm", "energy", "swing"].forEach(bindRange);

  $("scopeToggle").onclick = toggleScope;
  setupScope();
  window.addEventListener("resize", setupScope);
  bindHelp();
  startMeterLoop(); // medidores/espectro vivos incluso en silencio

  generate();
}

window.addEventListener("DOMContentLoaded", init);
