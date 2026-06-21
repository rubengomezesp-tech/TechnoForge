/*
 * app.js — TechnoForge
 * Generador de ideas/patrones de techno + secuenciador + síntesis (Tone.js).
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

let pattern = blankPattern();
let mutes = new Set();
let currentStep = -1;
let seq = null;
let live = null; // voces de reproducción en vivo

const $ = (id) => document.getElementById(id);
const rnd = Math.random;
const arr16 = (v) => Array.from({ length: STEPS }, () => v);

function blankPattern() {
  return { kick: arr16(false), clap: arr16(false), chat: arr16(false),
           ohat: arr16(false), bass: arr16(null), stab: arr16(null) };
}

function rootPc()  { return parseInt($("root").value, 10); }
function scaleId() { return $("scale").value; }
function bpm()     { return parseInt($("bpm").value, 10); }
function energy()  { return parseInt($("energy").value, 10) / 100; }

function bassChord() {
  // Nota raíz grave del bajo en función de la tonalidad elegida
  return 24 + rootPc();
}
function stabChord() {
  const base = 48 + rootPc();
  const sc = SCALES[scaleId()];
  return [base, base + sc[2], base + sc[4]]; // tríada (menor) de la tonalidad
}

// ----------------------------------------------------------------------------
// Generación de la idea (las "reglas" del techno)
// ----------------------------------------------------------------------------
function generate() {
  const e = energy();
  const sc = SCALES[scaleId()];
  const p = blankPattern();

  // Bombo: 4x4 clásico
  [0, 4, 8, 12].forEach((s) => (p.kick[s] = true));
  if (e > 0.7 && rnd() < 0.4) p.kick[14] = true; // empuje a alta energía

  // Clap en los tiempos 2 y 4
  p.clap[4] = true;
  p.clap[12] = true;

  // Open hats en el contratiempo (el sonido "tss" del techno)
  [2, 6, 10, 14].forEach((s) => (p.ohat[s] = true));
  if (e < 0.3) { p.ohat[2] = false; p.ohat[10] = false; }

  // Closed hats: relleno con acentos en las corcheas
  for (let s = 0; s < STEPS; s++) {
    if (p.ohat[s]) continue;
    const dens = (s % 2 === 0 ? 0.4 : 0.25) + e * 0.45;
    if (rnd() < dens) p.chat[s] = true;
  }

  // Bajo rodante en las semicorcheas que no caen con el bombo
  const root = bassChord();
  const fifth = root + sc[4];
  [2, 3, 6, 7, 10, 11, 14, 15].forEach((s) => {
    if (rnd() < 0.55 + e * 0.4) {
      const r = rnd();
      p.bass[s] = r > 0.85 ? root + 12 : r > 0.7 ? fifth : root;
    }
  });
  if (p.bass[2] == null) p.bass[2] = root; // garantiza groove

  // Stabs / acordes en posiciones sincopadas
  const cand = shuffle([3, 7, 10, 11, 14]);
  const count = 1 + Math.round(e * 2);
  cand.slice(0, count).forEach((s) => (p.stab[s] = stabChord()));

  pattern = p;
  renderGrid();
  setStatus("Idea generada. Pulsa <b>Play</b> para escucharla. Toca las celdas para editar.");
}

function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

// Regenera SOLO una pista, manteniendo el resto
function regenTrack(id) {
  const before = pattern;
  generate();
  const fresh = pattern[id];
  pattern = before;
  pattern[id] = fresh;
  renderGrid();
}

// ----------------------------------------------------------------------------
// Síntesis (se construye igual para reproducción en vivo y para exportar WAV)
// ----------------------------------------------------------------------------
function buildVoices() {
  const dest = Tone.getDestination();
  const limiter = new Tone.Limiter(-1).connect(dest);
  const comp = new Tone.Compressor(-14, 3).connect(limiter);
  const master = new Tone.Gain(0.9).connect(comp);

  const drumBus = new Tone.Gain(1).connect(master);
  const musicalBus = new Tone.Gain(1).connect(master); // bajo + stabs (recibe el "pump")

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 6,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.02 },
  }).connect(drumBus);

  const clapFilter = new Tone.Filter(1400, "bandpass").connect(drumBus);
  const clap = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.002, decay: 0.18, sustain: 0 },
  }).connect(clapFilter);

  const chatFilter = new Tone.Filter(8000, "highpass").connect(drumBus);
  const chat = new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -8,
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  }).connect(chatFilter);

  const ohatFilter = new Tone.Filter(7000, "highpass").connect(drumBus);
  const ohat = new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -10,
    envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
  }).connect(ohatFilter);

  const bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" }, volume: -6,
    filter: { type: "lowpass", Q: 2 },
    filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.1,
                      baseFrequency: 90, octaves: 2.6 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.45, release: 0.12 },
  }).connect(musicalBus);

  const stabFilter = new Tone.Filter(2200, "lowpass").connect(musicalBus);
  const stab = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" }, volume: -14,
    envelope: { attack: 0.004, decay: 0.18, sustain: 0, release: 0.1 },
  }).connect(stabFilter);

  const midi = (m) => Tone.Frequency(m, "midi").toFrequency();

  return {
    kick: (t) => kick.triggerAttackRelease("C1", "8n", t),
    clap: (t) => clap.triggerAttackRelease("16n", t),
    chat: (t) => chat.triggerAttackRelease("32n", t),
    ohat: (t) => ohat.triggerAttackRelease("16n", t),
    bass: (t, m) => bass.triggerAttackRelease(midi(m), "16n", t),
    stab: (t, arr) => stab.triggerAttackRelease(arr.map(midi), "8n", t),
    pump: (t) => {
      musicalBus.gain.cancelScheduledValues(t);
      musicalBus.gain.setValueAtTime(0.25, t);
      musicalBus.gain.linearRampToValueAtTime(1, t + 0.18);
    },
  };
}

function triggerStep(v, s, time) {
  if (pattern.kick[s] && !mutes.has("kick")) v.kick(time);
  if (pattern.kick[s]) v.pump(time); // sidechain aunque el bombo esté muteado al exportar
  if (pattern.clap[s] && !mutes.has("clap")) v.clap(time);
  if (pattern.chat[s] && !mutes.has("chat")) v.chat(time);
  if (pattern.ohat[s] && !mutes.has("ohat")) v.ohat(time);
  if (pattern.bass[s] != null && !mutes.has("bass")) v.bass(time, pattern.bass[s]);
  if (pattern.stab[s] != null && !mutes.has("stab")) v.stab(time, pattern.stab[s]);
}

// ----------------------------------------------------------------------------
// Reproducción en vivo
// ----------------------------------------------------------------------------
async function play() {
  await Tone.start();
  Tone.Transport.bpm.value = bpm();
  Tone.Transport.swing = parseInt($("swing").value, 10) / 100;
  Tone.Transport.swingSubdivision = "16n";

  if (!live) live = buildVoices();

  if (seq) seq.dispose();
  seq = new Tone.Sequence((time, s) => {
    triggerStep(live, s, time);
    Tone.Draw.schedule(() => highlight(s), time);
  }, [...Array(STEPS).keys()], "16n").start(0);

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

// ----------------------------------------------------------------------------
// Exportar WAV (renderizado offline de varios compases)
// ----------------------------------------------------------------------------
async function exportWav(bars = 4) {
  setStatus("Renderizando WAV…");
  const beats = 4 * bars;
  const seconds = (60 / bpm()) * beats + 0.5;
  const stepDur = (60 / bpm()) / 4;
  const swing = parseInt($("swing").value, 10) / 100;

  const buffer = await Tone.Offline(() => {
    const v = buildVoices();
    for (let bar = 0; bar < bars; bar++) {
      for (let s = 0; s < STEPS; s++) {
        let t = (bar * STEPS + s) * stepDur;
        if (swing && s % 2 === 1) t += stepDur * swing * 0.66; // swing aproximado
        triggerStep(v, s, t);
      }
    }
  }, seconds);

  const wav = encodeWav(buffer.get());
  TechnoMidi.download(wav, `technoforge-${bpm()}bpm.wav`);
  setStatus("WAV exportado ✔");
}

function encodeWav(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;
  const rate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
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
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let v = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  }
  return new Uint8Array(buffer);
}

// ----------------------------------------------------------------------------
// Interfaz (dibujo de la rejilla y eventos)
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
    m.textContent = "M";
    m.title = "Silenciar";
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
  if (t.type === "drum") {
    pattern[t.id][s] = !pattern[t.id][s];
  } else if (t.id === "bass") {
    pattern.bass[s] = pattern.bass[s] == null ? bassChord() : null;
  } else {
    pattern.stab[s] = pattern.stab[s] == null ? stabChord() : null;
  }
  renderGrid();
}

function highlight(s) {
  if (currentStep === s) return;
  document.querySelectorAll(".step.playhead").forEach((el) => el.classList.remove("playhead"));
  if (s >= 0) {
    document.querySelectorAll(`.step[data-step="${s}"]`).forEach((el) => el.classList.add("playhead"));
  }
  currentStep = s;
}

function setStatus(html) { $("status").innerHTML = html; }

// ----------------------------------------------------------------------------
// Arranque
// ----------------------------------------------------------------------------
function init() {
  $("playBtn").onclick = togglePlay;
  $("genBtn").onclick = generate;
  $("midiBtn").onclick = () => {
    TechnoMidi.download(TechnoMidi.exportMidi(pattern, bpm()), `technoforge-${bpm()}bpm.mid`);
    setStatus("MIDI exportado ✔ — ábrelo en tu DAW (Ableton, FL, Bitwig…).");
  };
  $("wavBtn").onclick = () => exportWav(4);

  const bind = (id) => {
    const el = $(id), out = $(id + "Out");
    el.oninput = () => {
      if (out) out.textContent = el.value;
      if (id === "bpm") Tone.Transport.bpm.value = bpm();
      if (id === "swing") Tone.Transport.swing = parseInt(el.value, 10) / 100;
    };
  };
  ["bpm", "energy", "swing"].forEach(bind);

  generate(); // arranca con una idea ya hecha
}

window.addEventListener("DOMContentLoaded", init);
