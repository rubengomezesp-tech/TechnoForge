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

const TRACKS = [
  { id: "kick", name: "Kick",  type: "drum" },
  { id: "clap", name: "Clap",  type: "drum" },
  { id: "chat", name: "Hats",  type: "drum" },
  { id: "ohat", name: "Open",  type: "drum" },
  { id: "bass", name: "Bass",  type: "pitch" },
  { id: "stab", name: "Stab",  type: "pitch" },
];

// Cada estilo sesga la generación del patrón
const STYLE_PARAMS = {
  peaktime:   { hat: 0.50, stab: 2, bass: 0.70, seventh: false },
  hypnotic:   { hat: 0.42, stab: 1, bass: 0.85, seventh: false },
  melodic:    { hat: 0.40, stab: 3, bass: 0.60, seventh: true  },
  industrial: { hat: 0.70, stab: 1, bass: 0.72, seventh: false },
};

// Estructura del track (modo Track). keep = pistas activas en esa sección.
const ARRANGEMENT = [
  { name: "Intro",  bars: 4, keep: ["kick", "chat", "ohat"] },
  { name: "Build",  bars: 4, keep: ["kick", "chat", "ohat", "bass"], fillLast: true, riserLast: true },
  { name: "Drop",   bars: 8, keep: "all", impactFirst: true },
  { name: "Break",  bars: 4, keep: ["chat", "bass", "stab"], riserLast: true },
  { name: "Drop 2", bars: 8, keep: "all", impactFirst: true },
  { name: "Outro",  bars: 4, keep: ["kick", "chat"] },
];

let pattern = blankPattern(); // el bucle base (el "drop")
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

// ----------------------------------------------------------------------------
// Arreglo automático: convierte el bucle base en un track completo
// ----------------------------------------------------------------------------
function buildSong() {
  const song = { kick: [], clap: [], chat: [], ohat: [], bass: [], stab: [] };
  const sections = [];
  const fx = [];
  let barCursor = 0;

  for (const sec of ARRANGEMENT) {
    const keepAll = sec.keep === "all";
    const keep = (id) => keepAll || sec.keep.includes(id);
    const startStep = barCursor * STEPS;

    for (let b = 0; b < sec.bars; b++) {
      const lastBar = b === sec.bars - 1;
      for (let s = 0; s < STEPS; s++) {
        const roll = sec.fillLast && lastBar; // fill de hats en el último compás
        song.kick.push(keep("kick") ? pattern.kick[s] : false);
        song.clap.push(keep("clap") ? pattern.clap[s] : false);
        song.chat.push(roll ? true : (keep("chat") ? pattern.chat[s] : false));
        song.ohat.push(keep("ohat") ? pattern.ohat[s] : false);
        song.bass.push(keep("bass") ? pattern.bass[s] : null);
        song.stab.push(keep("stab") ? pattern.stab[s] : null);
      }
    }

    sections.push({ name: sec.name, startBar: barCursor, bars: sec.bars });
    if (sec.impactFirst) fx.push({ step: startStep, type: "impact" });
    if (sec.riserLast)   fx.push({ step: (barCursor + sec.bars - 1) * STEPS, type: "riser" });
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
  const limiter = new Tone.Limiter(-1).connect(dest);
  const comp = new Tone.Compressor(-14, 3).connect(limiter);
  const master = new Tone.Gain(0.9).connect(comp);

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

  const bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" }, volume: -6, filter: { type: "lowpass", Q: 2 },
    filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.1, baseFrequency: 90, octaves: 2.6 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.45, release: 0.12 },
  }).connect(musicalBus);

  const stabFilter = new Tone.Filter(2200, "lowpass").connect(musicalBus);
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

  const midi = (m) => Tone.Frequency(m, "midi").toFrequency();

  return {
    kick: (t) => kick.triggerAttackRelease("C1", "8n", t),
    clap: (t) => clap.triggerAttackRelease("16n", t),
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
  };
}

function triggerStep(v, p, s, time) {
  if (p.kick[s] && !mutes.has("kick")) v.kick(time);
  if (p.kick[s]) v.pump(time);
  if (p.clap[s] && !mutes.has("clap")) v.clap(time);
  if (p.chat[s] && !mutes.has("chat")) {
    const vel = (s % 4 === 0 ? 0.95 : 0.6) + rnd() * 0.1; // humanización
    v.chat(time, clamp(vel, 0, 1));
  }
  if (p.ohat[s] && !mutes.has("ohat")) v.ohat(time);
  if (p.bass[s] != null && !mutes.has("bass")) v.bass(time, p.bass[s]);
  if (p.stab[s] != null && !mutes.has("stab")) v.stab(time, p.stab[s]);
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
      if (e.type === "riser") v.riser(t, barSec); else v.impact(t);
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

  generate();
}

window.addEventListener("DOMContentLoaded", init);
