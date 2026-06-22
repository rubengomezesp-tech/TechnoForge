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
  { id: "kick", name: "Kick",  type: "drum",  role: "el pulso 4x4" },
  { id: "clap", name: "Clap",  type: "drum",  role: "backbeat (2 y 4)" },
  { id: "chat", name: "Hats",  type: "drum",  role: "groove / relleno" },
  { id: "ohat", name: "Open",  type: "drum",  role: "contratiempo / aire" },
  { id: "bass", name: "Bass",  type: "pitch", role: "sub-grave" },
  { id: "stab", name: "Stab",  type: "pitch", role: "tensión armónica" },
];

// Cada estilo sesga la generación del patrón (carácter rítmico/percusivo)
const STYLE_PARAMS = {
  hardgroove: { hat: 0.78, stab: 1, bass: 0.92, seventh: false },
  schranz:    { hat: 0.92, stab: 0, bass: 0.88, seventh: false },
  acid:       { hat: 0.66, stab: 1, bass: 0.96, seventh: false },
  raw:        { hat: 0.82, stab: 1, bass: 0.82, seventh: false },
  afro:       { hat: 0.58, stab: 2, bass: 0.84, seventh: false },
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

let pattern;                  // el bucle del tramo activo === patterns[current]
let patterns = [];            // lista de tramos (secciones); cada uno es un patrón
let current = 0;              // índice del tramo que se edita
let barsPerTramo = 4;         // duración por defecto de un tramo nuevo (compases)
let tramoBars = [4];          // duración (compases) de cada tramo, en paralelo a patterns
let tramoFx = ["none"];       // transición por tramo: none|riser|impact|drop
let tramoVocal = [true];      // si la vocal suena en cada tramo (clips por sección)
let mode = "loop";            // "loop" | "song"
let built = null;             // { song, sections, fx } cuando hay track montado
let currentStep = -1;
let playbackStep = -1;        // último paso disparado por el secuenciador de audio
let seq = null;
let live = null;
let mix = defaultMix();       // mezclador por pista: { vol(dB), pan(-1..1), mute, solo }
let fxGlobal = { rumble: 0, masterGain: 0, lufsTarget: -9, lfo: { on: false, bars: 2, depth: 0.5 } }; // FX globales + mastering + LFO
let synth = defaultSynths();  // sintes editables (bajo y acordes): onda/filtro/ADSR
let proMacros = defaultProMacros(); // macros de producción: tensión/groove/dirt/space
let proBrief = "";            // briefing/reference textual local (sin backend)
let referenceDna = null;       // análisis local de referencia: energía/pico/duración
let aiHistory = [];            // firmas de generaciones IA recientes para evitar repetición
let projectName = "Mi track";
let samples = {};             // sampler: { trackId: {name, url(dataURL)} } persistente
let sampleBuffers = {};       // { trackId: Tone.ToneAudioBuffer } en memoria (decodificado)
let sampleTarget = null;      // pista destino del próximo archivo cargado
let editMode = "notes";       // "notes" | "prob" | "ratchet" — qué edita el clic en celda
let selectedChannel = "kick"; // canal cuyo rack de FX se edita en el panel
let vocal = { name: null, url: null, bars: 4, vol: 0, mute: false }; // pista de vocal/loop
let vocalBuffer = null;       // Tone.ToneAudioBuffer de la vocal (en memoria)
const SAMPLEABLE = ["kick", "clap", "chat", "ohat"]; // pistas de batería (one-shots)

const $ = (id) => document.getElementById(id);
const rnd = Math.random;
const arr16 = (v) => Array.from({ length: STEPS }, () => v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Claves de nota que se aplanan al montar el track (no incluir 'mods' aquí)
const NOTE_KEYS = ["kick", "clap", "chat", "ohat", "bass", "stab"];

// mods: modificadores por paso y pista — { p: probabilidad 0..1, r: ratchet 1..4 }
function blankMods() {
  const m = {};
  for (const k of NOTE_KEYS) m[k] = arr16(null);
  return m;
}

function blankPattern() {
  return { kick: arr16(false), clap: arr16(false), chat: arr16(false),
           ohat: arr16(false), bass: arr16(null), stab: arr16(null), mods: blankMods() };
}

patterns = [blankPattern()]; // ya con arr16 inicializado
current = 0;
pattern = patterns[0];
tramoBars = [4];
tramoFx = ["none"];
tramoVocal = [true];

// Mantiene pattern === patterns[current] tras reasignar pattern
function syncTramo() { patterns[current] = pattern; }

// ----------------------------------------------------------------------------
// Núcleo de estudio: mezclador por pista + proyecto (guardar/cargar/autosave)
// ----------------------------------------------------------------------------
function defaultMix() {
  const m = {};
  for (const t of TRACKS) {
    const c = { vol: 0, pan: 0, mute: false, solo: false, low: 0, mid: 0, high: 0, comp: 0, drive: 0, crush: 0, width: 0.5, sidechain: 0, rev: 0, delay: 0 };
    // Sonido techno "de fábrica": bombeo en bajo/acordes, pegada en kick, aire en stab
    if (t.id === "bass" || t.id === "stab") c.sidechain = 0.35;
    if (t.id === "stab") c.rev = 0.22;
    if (t.id === "kick") c.drive = 0.18;
    m[t.id] = c;
  }
  return m;
}
function defaultProMacros() {
  return { tension: 0.72, groove: 0.58, dirt: 0.46, space: 0.28 };
}
function normalizeProMacros(src) {
  const d = defaultProMacros();
  if (src) for (const k of Object.keys(d)) if (src[k] != null) d[k] = clamp(+src[k], 0, 1);
  return d;
}
function mixOf(id) { return mix[id] || { vol: 0, pan: 0, mute: false, solo: false, low: 0, mid: 0, high: 0, comp: 0, drive: 0, crush: 0, width: 0.5, sidechain: 0, rev: 0, delay: 0 }; }

// Curva de saturación (soft-clip) para el WaveShaper del drive por canal.
// amount 0 = identidad (sin distorsión); sube = más saturación analógica.
function makeDriveCurve(amount) {
  const n = 1024, curve = new Float32Array(n), k = (amount || 0) * 60;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = amount > 0 ? ((1 + k) * x) / (1 + k * Math.abs(x)) : x;
  }
  return curve;
}

// Mapeos de los nuevos FX: compresión (umbral) y bitcrusher (bits)
function compThreshold(amount) { return -(amount || 0) * 30; }        // 0 = sin comp, 1 = -30 dB
function crushBits(amount) { return Math.max(4, Math.round(16 - (amount || 0) * 12)); } // 16 limpio → 4 roto

// Aplica el rack de FX de un canal a las voces en vivo
function applyFx(id) {
  if (live && live.fx && live.fx[id]) {
    const m = mixOf(id), f = live.fx[id];
    if (f.eq) { f.eq.low.value = m.low || 0; f.eq.mid.value = m.mid || 0; f.eq.high.value = m.high || 0; }
    if (f.comp) f.comp.threshold.value = compThreshold(m.comp || 0);
    if (f.crush) f.crush.bits.value = crushBits(m.crush || 0);
    if (f.widener) f.widener.width.value = m.width != null ? m.width : 0.5;
    f.drive.curve = makeDriveCurve(m.drive || 0);
    f.sendRev.gain.value = m.rev || 0;
    f.sendDly.gain.value = m.delay || 0;
    // el sidechain se aplica en cada golpe de kick (en v.sidechain)
  }
  markDirty();
}

function applyRumble(v) {
  fxGlobal.rumble = v;
  if (live && live.rumbleSend) live.rumbleSend.gain.value = v;
  markDirty();
}

// --- Web MIDI: tocar el bajo con un teclado y la rueda de modulación al LFO ---
let midiOn = false;
async function enableMIDI() {
  if (!navigator.requestMIDIAccess) { setStatus("Tu navegador no soporta Web MIDI (usa Chrome)."); return; }
  try {
    await Tone.start();
    if (!live) live = buildVoices();
    const midi = await navigator.requestMIDIAccess();
    const names = [];
    midi.inputs.forEach((inp) => { inp.onmidimessage = handleMIDI; names.push(inp.name); });
    midi.onstatechange = () => { midi.inputs.forEach((inp) => { inp.onmidimessage = handleMIDI; }); };
    midiOn = true;
    const btn = $("midiCtrl"); if (btn) { btn.classList.add("solo"); btn.textContent = "🎹 MIDI ✓"; }
    setStatus(names.length ? `MIDI conectado: <b>${names.join(", ")}</b>. Toca el teclado (suena el bajo).` : "MIDI activo, esperando un dispositivo…");
  } catch (e) { setStatus("No se pudo acceder a MIDI."); }
}
function handleMIDI(msg) {
  const [status, d1, d2] = msg.data;
  const cmd = status & 0xf0;
  if (!live) return;
  if (cmd === 0x90 && d2 > 0) {                 // note on → toca el bajo
    if (live.bassSynth) live.bassSynth.triggerAttackRelease(Tone.Frequency(d1, "midi").toFrequency(), "8n");
  } else if (cmd === 0xb0 && d1 === 1) {        // CC1 (rueda mod) → profundidad del LFO
    fxGlobal.lfo.on = true; fxGlobal.lfo.depth = d2 / 127; lfoSettings(live.masterLfo); renderModulation();
  }
}

// LFO del auto-filtro de máster: aplica fxGlobal.lfo a un LFO de Tone
function lfoSettings(lfo) {
  if (!lfo) return;
  const l = fxGlobal.lfo || { on: false, bars: 2, depth: 0.5 };
  if (l.on) {
    const barSec = (60 / bpm()) * 4;
    const depth = l.depth != null ? l.depth : 0.5;
    lfo.min = 300 + (1 - depth) * 5000; // más profundidad = barre más grave
    lfo.max = 15000;
    lfo.frequency.value = 1 / ((l.bars || 2) * barSec);
  } else {
    lfo.min = 18000; lfo.max = 18000; // abierto, sin efecto
  }
}
function applyLfo() {
  if (live && live.masterLfo) lfoSettings(live.masterLfo);
  markDirty();
}

// --- Mastering: ganancia de máster + medición de loudness (LUFS aprox.) ---
function applyMasterGain() {
  if (live && live.masterGainNode) live.masterGainNode.gain.value = 1.4 * Math.pow(10, (fxGlobal.masterGain || 0) / 20);
  markDirty();
}

// Loudness integrada (gated) sobre un AudioBuffer ya masterizado. Fórmula
// BS.1770 (mean-square) con gating absoluto; aprox. sin K-weighting completo.
function measureLUFS(buf) {
  const chs = buf.numberOfChannels, len = buf.length, rate = buf.sampleRate;
  const data = []; for (let c = 0; c < chs; c++) data.push(buf.getChannelData(c));
  const block = Math.max(1, Math.floor(rate * 0.4)), hop = Math.max(1, Math.floor(block / 4));
  let sum = 0, n = 0;
  for (let start = 0; start + block <= len; start += hop) {
    let ms = 0;
    for (let i = 0; i < block; i++) {
      let s = 0; for (let c = 0; c < chs; c++) s += data[c][start + i];
      s /= chs; ms += s * s;
    }
    ms /= block;
    const lb = -0.691 + 10 * Math.log10(ms + 1e-12);
    if (lb > -50) { sum += ms; n++; } // gating absoluto a -50 LUFS
  }
  if (!n) return -70;
  return -0.691 + 10 * Math.log10(sum / n + 1e-12);
}
function measurePeakDb(buf) {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  }
  return 20 * Math.log10(Math.max(peak, 1e-9));
}

let lastLufs = null; // último loudness integrado medido (para la lectura del máster)
let lastPeakDb = null;
function setLufsRead() { const el = $("lufs-read"); if (el) el.textContent = lastLufs != null ? lastLufs.toFixed(1) + " LUFS" : "– LUFS"; }

function showProgress(txt) { const p = $("progress"); if (p) { const t = $("progressTxt"); if (t) t.textContent = txt || "Renderizando…"; p.hidden = false; } }
function hideProgress() { const p = $("progress"); if (p) p.hidden = true; }

// Mide sobre un fragmento corto (el tramo activo ×4 compases) = rápido y
// representativo: la ganancia de máster es global, así basta medir un trozo loud.
async function measureLoudness() {
  const buffer = await renderOffline(repeatPattern(pattern, 4), null, () => true, {});
  return measureLUFS(buffer.get());
}
async function measureMasterStats() {
  const buffer = await renderOffline(repeatPattern(pattern, 4), null, () => true, {});
  const audio = buffer.get();
  return { lufs: measureLUFS(audio), peakDb: measurePeakDb(audio) };
}

async function measureNow() {
  setStatus("Midiendo loudness del tramo activo…");
  const stats = await measureMasterStats();
  lastLufs = stats.lufs;
  lastPeakDb = stats.peakDb;
  setLufsRead();
  renderMixer();
  setStatus(`Master: <b>${lastLufs.toFixed(1)} LUFS</b>, pico <b>${lastPeakDb.toFixed(1)} dBFS</b> (objetivo ${fxGlobal.lufsTarget}).`);
}

async function normalizeLoudness() {
  setStatus("Midiendo y normalizando…");
  const stats = await measureMasterStats();
  const lufs = stats.lufs;
  const target = fxGlobal.lufsTarget;
  fxGlobal.masterGain = clamp(Math.round((fxGlobal.masterGain + (target - lufs)) * 10) / 10, -24, 24);
  applyMasterGain();       // la ganancia se aplica en vivo (sin reconstruir el grafo)
  lastLufs = target;       // tras ajustar, el loudness queda ≈ objetivo
  lastPeakDb = stats.peakDb + (target - lufs);
  renderMixer();           // refresca lectura/slider del máster
  setStatus(`Normalizado: <b>${lufs.toFixed(1)}</b> → ${target} LUFS, pico aprox. ${lastPeakDb.toFixed(1)} dBFS (gain ${fxGlobal.masterGain >= 0 ? "+" : ""}${fxGlobal.masterGain} dB).`);
}

// Presets de sonido de 1 clic: moldean controles + síntesis + mezcla + FX + rumble
const GENRE_PRESETS = {
  hardgroove: {
    bpm: 145, swing: 5, style: "hardgroove", emotion: "tension", energy: 88, rumble: 0.68,
    lufsTarget: -7, masterGain: -1.5, lfo: { on: true, bars: 4, depth: 0.35 },
    macros: { tension: 0.82, groove: 0.72, dirt: 0.62, space: 0.24 },
    synth: {
      bass: { wave: "sawtooth", cutoff: 155, res: 5.5, decay: 0.16, sustain: 0.34, release: 0.09, slide: 0.018 },
      stab: { engine: "fm", fm: 13, cutoff: 3200, res: 2.2, decay: 0.15, sustain: 0, release: 0.12 },
    },
    fx: {
      kick: { vol: 4, drive: 0.5, comp: 0.55, low: 3 },
      clap: { vol: 0, pan: -0.15, comp: 0.35, drive: 0.15, rev: 0.08 },
      chat: { vol: -5, pan: 0.1, high: 4, comp: 0.25, width: 0.75 },
      ohat: { vol: -2, pan: 0.2, high: 4, width: 0.85, rev: 0.08 },
      bass: { vol: 1, low: -2, mid: 1, drive: 0.45, comp: 0.45, sidechain: 0.72 },
      stab: { vol: -4, mid: -1, high: 2, drive: 0.32, crush: 0.18, sidechain: 0.62, rev: 0.28, delay: 0.12 },
    },
  },
  schranz: {
    bpm: 155, swing: 2, style: "schranz", emotion: "tension", energy: 96, rumble: 0.78,
    lufsTarget: -7, masterGain: -2, lfo: { on: true, bars: 2, depth: 0.25 },
    macros: { tension: 0.94, groove: 0.48, dirt: 0.88, space: 0.14 },
    synth: {
      bass: { wave: "square", cutoff: 115, res: 6, decay: 0.11, sustain: 0.26, release: 0.06, slide: 0.006 },
      stab: { engine: "fm", fm: 18, cutoff: 1900, res: 4, decay: 0.09, sustain: 0, release: 0.08 },
    },
    fx: {
      kick: { vol: 5, low: 4, mid: -1, drive: 0.72, comp: 0.7 },
      clap: { vol: -2, crush: 0.28, comp: 0.45, rev: 0.04 },
      chat: { vol: -4, high: 5, comp: 0.45, drive: 0.28, crush: 0.2, width: 0.55 },
      ohat: { vol: -4, high: 4, drive: 0.22, crush: 0.16, width: 0.58 },
      bass: { vol: 2, low: -4, mid: 2, drive: 0.72, comp: 0.62, crush: 0.22, sidechain: 0.78 },
      stab: { vol: -8, mid: 2, high: -1, drive: 0.55, crush: 0.34, sidechain: 0.66, rev: 0.1, delay: 0.04 },
    },
  },
  acid: {
    bpm: 142, swing: 9, style: "acid", emotion: "oscuridad", energy: 84, rumble: 0.52,
    lufsTarget: -8, masterGain: -1, lfo: { on: true, bars: 4, depth: 0.45 },
    macros: { tension: 0.74, groove: 0.82, dirt: 0.55, space: 0.34 },
    synth: {
      bass: { wave: "sawtooth", cutoff: 240, res: 9.5, decay: 0.12, sustain: 0.2, release: 0.08, slide: 0.095 },
      stab: { engine: "pluck", cutoff: 4200, res: 1.2, decay: 0.12, sustain: 0, release: 0.08 },
    },
    fx: {
      kick: { vol: 3, low: 2, drive: 0.38, comp: 0.5 },
      clap: { vol: -1, comp: 0.32, rev: 0.12 },
      chat: { vol: -6, pan: -0.15, high: 4, width: 0.78 },
      ohat: { vol: -3, pan: 0.2, high: 4, width: 0.86, delay: 0.05 },
      bass: { vol: 2, low: -3, mid: 3, high: -2, drive: 0.48, comp: 0.38, sidechain: 0.64, delay: 0.06 },
      stab: { vol: -6, high: 2, drive: 0.18, sidechain: 0.58, rev: 0.26, delay: 0.18 },
    },
  },
  raw: {
    bpm: 148, swing: 3, style: "raw", emotion: "oscuridad", energy: 92, rumble: 0.72,
    lufsTarget: -7, masterGain: -2, lfo: { on: true, bars: 8, depth: 0.22 },
    macros: { tension: 0.88, groove: 0.54, dirt: 0.92, space: 0.18 },
    synth: {
      bass: { wave: "square", cutoff: 135, res: 5.5, decay: 0.13, sustain: 0.28, release: 0.07, slide: 0.012 },
      stab: { engine: "fm", fm: 16, cutoff: 2400, res: 3.5, decay: 0.11, sustain: 0, release: 0.09 },
    },
    fx: {
      kick: { vol: 5, low: 3, drive: 0.66, comp: 0.66, crush: 0.08 },
      clap: { vol: -2, drive: 0.32, crush: 0.3, comp: 0.44 },
      chat: { vol: -5, high: 4, drive: 0.36, crush: 0.32, width: 0.52 },
      ohat: { vol: -4, high: 4, drive: 0.28, crush: 0.2, width: 0.64 },
      bass: { vol: 1, low: -3, mid: 2, drive: 0.68, comp: 0.55, crush: 0.28, sidechain: 0.74 },
      stab: { vol: -7, mid: 1, drive: 0.48, crush: 0.32, sidechain: 0.62, rev: 0.16, delay: 0.08 },
    },
  },
  afro: {
    bpm: 126, swing: 16, style: "afro", emotion: "oscuridad", energy: 74, rumble: 0.34,
    lufsTarget: -8, masterGain: -1, lfo: { on: true, bars: 8, depth: 0.32 },
    macros: { tension: 0.58, groove: 0.9, dirt: 0.36, space: 0.46 },
    synth: {
      bass: { wave: "sawtooth", cutoff: 118, res: 3.8, decay: 0.19, sustain: 0.38, release: 0.1, slide: 0.028 },
      stab: { engine: "pluck", cutoff: 5200, res: 1.4, decay: 0.18, sustain: 0, release: 0.12 },
    },
    fx: {
      kick: { vol: 3, low: 2, drive: 0.28, comp: 0.44 },
      clap: { vol: -2, pan: -0.08, comp: 0.28, drive: 0.08, rev: 0.12 },
      chat: { vol: -5, pan: -0.16, high: 3, comp: 0.18, width: 0.7, delay: 0.06 },
      ohat: { vol: -4, pan: 0.22, high: 4, width: 0.82, rev: 0.16, delay: 0.08 },
      bass: { vol: 1, low: -2, mid: 1, drive: 0.28, comp: 0.34, sidechain: 0.54 },
      stab: { vol: -5, high: 2, drive: 0.12, sidechain: 0.46, rev: 0.34, delay: 0.18 },
    },
  },
  hard: {
    bpm: 140, swing: 6, style: "industrial", emotion: "oscuridad", rumble: 0.5,
    synth: { bass: { wave: "sawtooth", cutoff: 130, res: 4, slide: 0 }, stab: { engine: "saw", cutoff: 1800, res: 2 } },
    fx: { kick: { drive: 0.35, comp: 0.45, low: 2 }, clap: { comp: 0.3 }, chat: { high: 3 }, ohat: { high: 3 }, bass: { sidechain: 0.6, drive: 0.3, low: -3, crush: 0.15 }, stab: { drive: 0.2, rev: 0.25 } },
  },
  melodic: {
    bpm: 124, swing: 14, style: "melodic", emotion: "melancolia", rumble: 0.25,
    synth: { bass: { wave: "fatsawtooth", cutoff: 90, res: 2, slide: 0.04 }, stab: { engine: "saw", cutoff: 3000, res: 1 } },
    fx: { kick: { drive: 0.15 }, bass: { sidechain: 0.45, low: -2 }, stab: { rev: 0.45, delay: 0.2, high: 2 } },
  },
  hypnotic: {
    bpm: 132, swing: 10, style: "hypnotic", emotion: "nostalgia", rumble: 0.35,
    synth: { bass: { wave: "fatsawtooth", cutoff: 80, res: 3, slide: 0.06 }, stab: { engine: "saw", cutoff: 2200, res: 2 } },
    fx: { bass: { sidechain: 0.5, drive: 0.2 }, stab: { rev: 0.35, delay: 0.3 }, chat: { high: 2 } },
  },
  industrial: {
    bpm: 138, swing: 4, style: "industrial", emotion: "tension", rumble: 0.6,
    synth: { bass: { wave: "sawtooth", cutoff: 140, res: 5, slide: 0 }, stab: { engine: "fm", fm: 12, cutoff: 2500, res: 2 } },
    fx: { kick: { drive: 0.5, comp: 0.5 }, clap: { crush: 0.2 }, bass: { drive: 0.5, crush: 0.3, sidechain: 0.6 }, stab: { drive: 0.3, crush: 0.2, rev: 0.2 } },
  },
};

function setControlValue(id, v) {
  const el = $(id); if (!el || v == null) return;
  el.value = v;
  const out = $(id + "Out"); if (out) out.textContent = v;
}

function applyGenrePreset(name) {
  const g = GENRE_PRESETS[name]; if (!g) return;
  if (g.bpm) { setControlValue("bpm", g.bpm); if (window.Tone) Tone.Transport.bpm.value = g.bpm; }
  if (g.swing != null) setControlValue("swing", g.swing);
  if (g.style) $("style").value = g.style;
  if (g.emotion) { $("emotion").value = g.emotion; $("scale").value = currentEmotion().scale; }
  if (g.energy != null) setControlValue("energy", g.energy);
  if (g.rumble != null) { fxGlobal.rumble = g.rumble; setControlValue("rumble", Math.round(g.rumble * 100)); }
  if (g.masterGain != null) fxGlobal.masterGain = g.masterGain;
  if (g.lufsTarget != null) fxGlobal.lufsTarget = g.lufsTarget;
  if (g.lfo) fxGlobal.lfo = { ...fxGlobal.lfo, ...g.lfo };
  if (g.macros) proMacros = normalizeProMacros(g.macros);
  synth = defaultSynths();
  if (g.synth) for (const k of ["bass", "stab"]) if (g.synth[k]) Object.assign(synth[k], g.synth[k]);
  mix = defaultMix();
  if (g.fx) for (const id of Object.keys(g.fx)) if (mix[id]) Object.assign(mix[id], g.fx[id]);
  invalidateVoices();
  renderInstruments(); renderModulation(); renderMixer(); renderProDesk(); renderAutomation();
  markDirty();
  setStatus(`Preset <b>${name}</b> aplicado. Pulsa <b>🎲 Generar idea</b> para un patrón del estilo, o <b>Play</b>.`);
}

function setMacro(key, value) {
  proMacros[key] = clamp(value, 0, 1);
  applyProMacros(false);
  renderAutomation();
  markDirty();
}

function applyProMacros(regenerate = true) {
  const t = proMacros.tension, g = proMacros.groove, d = proMacros.dirt, s = proMacros.space;
  setControlValue("energy", Math.round(44 + t * 54));
  setControlValue("swing", Math.round(g * 14));
  setControlValue("humanize", Math.round(g * 18));
  const rumble = clamp(0.22 + t * 0.34 + d * 0.28, 0, 0.94);
  fxGlobal.rumble = rumble;
  setControlValue("rumble", Math.round(rumble * 100));
  fxGlobal.lfo = { ...fxGlobal.lfo, on: t > 0.58, bars: t > 0.82 ? 2 : 4, depth: clamp(0.16 + t * 0.36, 0, 0.65) };

  const kick = mixOf("kick"), bass = mixOf("bass"), stab = mixOf("stab"), chat = mixOf("chat"), ohat = mixOf("ohat"), clap = mixOf("clap");
  kick.drive = clamp(0.18 + d * 0.55, 0, 0.9); kick.comp = clamp(0.28 + t * 0.4, 0, 0.85); kick.low = Math.round(1 + t * 3);
  bass.drive = clamp(0.16 + d * 0.55, 0, 0.9); bass.comp = clamp(0.24 + t * 0.42, 0, 0.85); bass.sidechain = clamp(0.38 + t * 0.42, 0, 0.92); bass.low = Math.round(-1 - d * 4);
  stab.rev = clamp(0.08 + s * 0.58, 0, 0.85); stab.delay = clamp(s * 0.34, 0, 0.7); stab.drive = clamp(0.08 + d * 0.38, 0, 0.75); stab.sidechain = clamp(0.32 + t * 0.34, 0, 0.82);
  chat.high = Math.round(1 + t * 4); chat.crush = clamp(d * 0.28, 0, 0.5); chat.width = clamp(0.42 + s * 0.5, 0, 1);
  ohat.high = Math.round(1 + t * 4); ohat.rev = clamp(s * 0.16, 0, 0.35); ohat.width = clamp(0.5 + s * 0.46, 0, 1);
  clap.rev = clamp(s * 0.18, 0, 0.4); clap.drive = clamp(d * 0.22, 0, 0.5);

  synth.bass.cutoff = clamp(80 + t * 140 + (1 - d) * 50, 50, 420);
  synth.bass.res = clamp(2 + t * 4 + d * 2, 0, 12);
  synth.bass.slide = clamp(synth.bass.slide + (g > 0.72 ? 0.015 : 0), 0, 0.13);
  synth.stab.cutoff = clamp(1400 + s * 5200 - d * 900, 500, 9000);
  synth.stab.fm = clamp(6 + d * 12, 0, 20);

  applyRumble(rumble);
  applyAllChannels();
  for (const tr of TRACKS) applyFx(tr.id);
  applySynth("bass"); applySynth("stab"); applyLfo();
  renderMixer(); renderInstruments(); renderModulation();
  if (regenerate) generate();
}

function inferPresetFromBrief(text) {
  const b = (text || "").toLowerCase();
  if (/afro|tribal|percus|organic|org[aá]nico|afro\s*tec|afro\s*tech/.test(b)) return "afro";
  if (/\bschranz\b|155|brutal|martillo/.test(b)) return "schranz";
  if (/\bacid\b|303|warehouse/.test(b)) return "acid";
  if (/\braw\b|industrial|distors|sucio|roto/.test(b)) return "raw";
  if (/mel[oó]dic|emocional|cinematic|progressive/.test(b)) return "melodic";
  if (/hipn[oó]tico|hypnotic|loop/.test(b)) return "hypnotic";
  if (/adrian|mills|hard groove|groove|groovy|latin/.test(b)) return "hardgroove";
  return "hardgroove";
}

function audioStats(buf) {
  let sum = 0, n = 0, peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const data = buf.getChannelData(c);
    const stride = Math.max(1, Math.floor(data.length / 50000));
    for (let i = 0; i < data.length; i += stride) {
      const v = data[i];
      sum += v * v; n++;
      peak = Math.max(peak, Math.abs(v));
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  return { rms, peak, rmsDb: 20 * Math.log10(Math.max(rms, 1e-9)), peakDb: 20 * Math.log10(Math.max(peak, 1e-9)) };
}

function loadReferenceFile(file) {
  if (!file || !window.Tone) return;
  setStatus(`Analizando referencia «${file.name}»…`);
  const reader = new FileReader();
  reader.onload = () => {
    const tb = new Tone.ToneAudioBuffer(reader.result, () => {
      const buf = tb.get();
      const stats = audioStats(buf);
      referenceDna = {
        name: file.name,
        duration: Math.round(buf.duration * 10) / 10,
        rmsDb: Math.round(stats.rmsDb * 10) / 10,
        peakDb: Math.round(stats.peakDb * 10) / 10,
      };
      const energyScore = clamp((referenceDna.rmsDb + 24) / 18, 0, 1);
      const peakScore = clamp((referenceDna.peakDb + 9) / 9, 0, 1);
      proMacros.tension = Math.max(proMacros.tension, 0.55 + energyScore * 0.35);
      proMacros.dirt = Math.max(proMacros.dirt, 0.35 + peakScore * 0.38);
      proMacros.space = Math.min(proMacros.space, 0.48);
      applyProMacros(false);
      renderProDesk(); renderAutomation(); markDirty();
      setStatus(`Referencia analizada: <b>${referenceDna.name}</b> · ${referenceDna.duration}s · ${referenceDna.rmsDb} dB RMS · pico ${referenceDna.peakDb} dBFS.`);
    }, () => setStatus("No pude decodificar esa referencia (prueba WAV/MP3)."));
  };
  reader.readAsDataURL(file);
}

function applyBrief(makeTrack = false) {
  const wasPlaying = window.Tone && Tone.Transport && Tone.Transport.state === "started";
  if (wasPlaying) stop();
  const input = $("proBrief");
  proBrief = input ? input.value : proBrief;
  const text = proBrief.toLowerCase();
  const preset = inferPresetFromBrief(text);
  if ($("preset")) $("preset").value = preset;
  applyGenrePreset(preset);

  if (/oscuro|dark|maligno|tension|tensi[oó]n/.test(text)) { $("emotion").value = "tension"; $("scale").value = "phrygian"; proMacros.tension = Math.max(proMacros.tension, 0.86); }
  if (/epic|[ée]pico|grande/.test(text)) { $("emotion").value = "epica"; $("scale").value = currentEmotion().scale; proMacros.tension = Math.max(proMacros.tension, 0.78); }
  if (/limpio|clean|menos sucio/.test(text)) proMacros.dirt = Math.min(proMacros.dirt, 0.28);
  if (/sucio|dirty|distors|raw|roto/.test(text)) proMacros.dirt = Math.max(proMacros.dirt, 0.82);
  if (/espacial|reverb|abierto|atmos/.test(text)) proMacros.space = Math.max(proMacros.space, 0.62);
  if (/seco|dry|directo/.test(text)) proMacros.space = Math.min(proMacros.space, 0.18);
  if (/groove|swing|baila/.test(text)) proMacros.groove = Math.max(proMacros.groove, 0.74);
  if (/recto|duro|militar/.test(text)) proMacros.groove = Math.min(proMacros.groove, 0.38);
  const bpmMatch = text.match(/\b(12[0-9]|13[0-9]|14[0-9]|15[0-9]|160)\b/);
  if (bpmMatch) { setControlValue("bpm", bpmMatch[1]); if (window.Tone) Tone.Transport.bpm.value = parseInt(bpmMatch[1], 10); }

  applyProMacros(!makeTrack);
  if (makeTrack) createProArrangement({ resume: wasPlaying });
  renderProDesk(); renderAutomation(); markDirty();
  if (!makeTrack && wasPlaying) setTimeout(() => play(), 80);
}

function patternFingerprint(p) {
  if (!p) return "empty";
  const bits = NOTE_KEYS.map((k) => {
    const arr = p[k] || [];
    return `${k}:${arr.map((v, i) => v == null || v === false ? "" : i).filter((v) => v !== "").join(".")}`;
  }).join("|");
  let h = 2166136261;
  for (let i = 0; i < bits.length; i++) {
    h ^= bits.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function projectFingerprint() {
  return patterns.map((p, i) => `${i}:${tramoBarsOf(i)}:${tramoFxOf(i)}:${patternFingerprint(p)}`).join("/");
}

function rememberAISignature(sig) {
  const clean = String(sig || projectFingerprint()).slice(0, 96);
  aiHistory = [clean, ...aiHistory.filter((x) => x !== clean)].slice(0, 12);
}

function compactProjectForAI() {
  return {
    mode,
    bpm: bpm(),
    root: rootPc(),
    preset: $("preset") ? $("preset").value : "",
    style: styleId(),
    emotion: $("emotion") ? $("emotion").value : "",
    scale: scaleId(),
    macros: proMacros,
    currentFingerprint: projectFingerprint(),
    recentSignatures: aiHistory.slice(0, 8)
  };
}

function uniqueSteps(list) {
  return Array.from(new Set((Array.isArray(list) ? list : [])
    .map((v) => Math.max(0, Math.min(15, Math.round(+v))))
    .filter((v) => Number.isFinite(v)))).sort((a, b) => a - b);
}

function patternFromAIHits(hits) {
  const p = blankPattern();
  for (const id of ["kick", "clap", "chat", "ohat"]) {
    uniqueSteps(hits && hits[id]).forEach((s) => { p[id][s] = true; });
  }
  if (hits && Array.isArray(hits.bass)) hits.bass.forEach((n) => {
    const s = Math.max(0, Math.min(15, Math.round(+n.step)));
    const midi = Math.max(24, Math.min(72, Math.round(+n.midi)));
    if (Number.isFinite(s) && Number.isFinite(midi)) p.bass[s] = midi;
  });
  if (hits && Array.isArray(hits.stab)) hits.stab.forEach((ch) => {
    const s = Math.max(0, Math.min(15, Math.round(+ch.step)));
    const notes = Array.isArray(ch.notes)
      ? ch.notes.map((n) => Math.max(36, Math.min(84, Math.round(+n)))).filter(Number.isFinite).slice(0, 4)
      : [];
    if (Number.isFinite(s) && notes.length >= 2) p.stab[s] = notes;
  });
  if (hits && Array.isArray(hits.mods)) hits.mods.forEach((m) => {
    if (!NOTE_KEYS.includes(m.track)) return;
    const s = Math.max(0, Math.min(15, Math.round(+m.step)));
    p.mods[m.track][s] = { p: clamp(+m.p || 1, 0.05, 1), r: Math.max(1, Math.min(4, Math.round(+m.r || 1))) };
  });
  return normalizePattern(p);
}

function applyAIPlan(plan, opts = {}) {
  if (!plan || !plan.controls || !Array.isArray(plan.sections)) throw new Error("Respuesta IA incompleta");
  const wasPlaying = window.Tone && Tone.Transport && Tone.Transport.state === "started";
  const resumeAfter = opts.resume || wasPlaying;
  if (wasPlaying) stop();

  const c = plan.controls;
  if ($("preset")) $("preset").value = c.preset || "hardgroove";
  applyGenrePreset($("preset") ? $("preset").value : "hardgroove");
  if ($("style")) $("style").value = c.style || styleId();
  if ($("emotion")) $("emotion").value = c.emotion || "tension";
  if ($("scale")) $("scale").value = c.scale || currentEmotion().scale;
  setControlValue("bpm", c.bpm || 145);
  setControlValue("root", c.root != null ? c.root : rootPc());
  setControlValue("energy", c.energy != null ? c.energy : 80);
  setControlValue("swing", c.swing != null ? c.swing : 10);
  setControlValue("rumble", c.rumble != null ? c.rumble : 50);
  setControlValue("humanize", c.humanize != null ? c.humanize : 10);
  if (window.Tone) Tone.Transport.bpm.value = bpm();

  proMacros = normalizeProMacros(plan.macros);
  applyProMacros(false);

  const sections = plan.sections.slice(0, 7);
  patterns = sections.map((s) => patternFromAIHits(s.hits || {}));
  tramoBars = sections.map((s) => Math.max(2, Math.min(16, Math.round(+s.bars || 4))));
  tramoFx = sections.map((s) => ["none", "riser", "impact", "drop"].includes(s.transition) ? s.transition : "none");
  tramoVocal = sections.map((s) => s.vocal !== false);
  barsPerTramo = tramoBars[0] || 4;
  current = Math.min(2, patterns.length - 1);
  pattern = patterns[current];
  mode = "song";
  built = buildSong();
  $("modeBtn").textContent = "🎚️ Track";
  rememberAISignature(`${plan.signature}:${projectFingerprint()}`);
  resetLive();
  refreshSong();
  renderGrid();
  renderTimeline();
  renderAutomation();
  renderInstruments();
  renderModulation();
  renderMixer();
  renderProDesk();
  markDirty();
  setStatus(`IA real: <b>${plan.title}</b>. ${plan.intent}`);
  if (resumeAfter) setTimeout(() => play(), 100);
}

async function createWithAI() {
  const wasPlaying = window.Tone && Tone.Transport && Tone.Transport.state === "started";
  if (wasPlaying) stop();
  const input = $("proBrief");
  proBrief = input ? input.value : proBrief;
  setStatus("IA produciendo un track nuevo…");
  const payload = {
    brief: proBrief || "hard groove techno track original",
    nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    avoid: [projectFingerprint(), ...aiHistory].slice(0, 12),
    current: compactProjectForAI()
  };
  try {
    const res = await fetch("/api/ai-producer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.plan) throw new Error(data.message || data.error || "IA no disponible");
    applyAIPlan(data.plan, { resume: wasPlaying });
  } catch (err) {
    setStatus(`IA no disponible ahora (${err.message}). Uso motor local para no romper la sesión.`);
    applyBrief(true);
    if (wasPlaying) setTimeout(() => play(), 100);
  }
}

function renderProDesk() {
  const el = $("prodesk"); if (!el) return;
  el.innerHTML = "";

  const brief = document.createElement("div"); brief.className = "pro-brief";
  const briefTitle = document.createElement("div"); briefTitle.className = "pro-title";
  briefTitle.append(Object.assign(document.createElement("span"), { textContent: "Brief / referencia" }), Object.assign(document.createElement("span"), { className: "pro-badge", textContent: "local" }));
  const ta = document.createElement("textarea"); ta.id = "proBrief";
  ta.placeholder = "Ej: hard groove tipo Adrian Mills, 145 BPM, oscuro, rumble agresivo, drop seco y hats con swing";
  ta.value = proBrief;
  ta.oninput = () => { proBrief = ta.value; markDirty(); };
  const actions = document.createElement("div"); actions.className = "pro-actions";
  const ai = document.createElement("button"); ai.className = "accent"; ai.textContent = "Crear con IA"; ai.title = "Usa OpenAI en backend para generar un track nuevo y no repetido";
  ai.onclick = () => createWithAI();
  const apply = document.createElement("button"); apply.textContent = "Aplicar brief"; apply.title = "Traduce el briefing a preset, emoción, macros y patrón";
  apply.onclick = () => applyBrief(false);
  const trackBtn = document.createElement("button"); trackBtn.textContent = "Crear local"; trackBtn.title = "Crea un arreglo local si la IA no está disponible";
  trackBtn.onclick = () => applyBrief(true);
  const arrange = document.createElement("button"); arrange.textContent = "Arreglo pro"; arrange.title = "Convierte el patrón actual en un track con intro/build/drop/break/drop/outro";
  arrange.onclick = () => createProArrangement();
  const master = document.createElement("button"); master.textContent = "Auto master"; master.title = "Mide loudness y ajusta el máster al objetivo";
  master.onclick = () => normalizeLoudness();
  const ref = document.createElement("button"); ref.textContent = "Referencia"; ref.title = "Analiza un WAV/MP3 local y ajusta macros sin copiar audio";
  const refInput = document.createElement("input"); refInput.type = "file"; refInput.accept = "audio/*"; refInput.hidden = true;
  ref.onclick = () => refInput.click();
  refInput.onchange = (e) => { if (e.target.files[0]) loadReferenceFile(e.target.files[0]); e.target.value = ""; };
  actions.append(ai, apply, trackBtn, arrange, master, ref, refInput);
  brief.append(briefTitle, ta, actions);
  if (referenceDna) {
    const refMeta = document.createElement("div"); refMeta.className = "auto-meta";
    refMeta.textContent = `Referencia: ${referenceDna.name} · ${referenceDna.duration}s · ${referenceDna.rmsDb} dB RMS`;
    brief.appendChild(refMeta);
  }

  const macros = document.createElement("div"); macros.className = "pro-macros";
  const macroTitle = document.createElement("div"); macroTitle.className = "pro-title";
  macroTitle.append(Object.assign(document.createElement("span"), { textContent: "Macros de producción" }), Object.assign(document.createElement("span"), { className: "pro-badge", textContent: "tensión/groove/suciedad/espacio" }));
  const grid = document.createElement("div"); grid.className = "macro-grid";
  [
    ["tension", "Tensión"],
    ["groove", "Groove"],
    ["dirt", "Dirt"],
    ["space", "Space"],
  ].forEach(([key, label]) => {
    const box = document.createElement("div"); box.className = "macro";
    const lab = document.createElement("label");
    const val = Object.assign(document.createElement("b"), { textContent: Math.round(proMacros[key] * 100) });
    lab.append(Object.assign(document.createElement("span"), { textContent: label }), val);
    const input = document.createElement("input"); input.type = "range"; input.min = "0"; input.max = "1"; input.step = "0.01"; input.value = proMacros[key];
    input.oninput = () => { val.textContent = Math.round(parseFloat(input.value) * 100); setMacro(key, parseFloat(input.value)); };
    box.append(lab, input); grid.appendChild(box);
  });
  macros.append(macroTitle, grid);
  el.append(brief, macros);
}

const DEFERRED_DISPOSE_MS = 2600;
function disposeNodeSafely(node, immediate = false) {
  if (!node) return;
  try { if (node.unsync) node.unsync(); } catch (e) {}
  try { if (node.stop) node.stop(); } catch (e) {}
  try { if (node.disconnect) node.disconnect(); } catch (e) {}
  const dispose = () => { try { if (node.dispose) node.dispose(); } catch (e) {} };
  if (immediate) dispose();
  else setTimeout(dispose, DEFERRED_DISPOSE_MS);
}

// Desconecta el grafo anterior al instante y difiere dispose: Tone puede tener
// releases/lookahead aún pendientes, y destruir el synth en caliente bloquea Chrome.
function disposeLive() {
  if (!live) return;
  const nodes = live.nodes || [];
  for (let i = nodes.length - 1; i >= 0; i--) {
    disposeNodeSafely(nodes[i]);
  }
  try { if (live.out) live.out.disconnect(); } catch (e) {}
}
function resetLive() { disposeLive(); live = null; }

// Invalida las voces tras un cambio de grafo (motor FM, samples). Si está
// sonando, las reconstruye y rehace la secuencia para oír el cambio al instante.
function invalidateVoices() {
  resetLive();
  if (window.Tone && Tone.Transport && Tone.Transport.state === "started") {
    live = buildVoices();
    buildSequence();
  }
}

function clearSequence() {
  if (seq == null || !window.Tone || !Tone.Transport) return;
  try {
    if (seq && seq.dispose) seq.dispose();
    else Tone.Transport.clear(seq);
  } catch (e) {}
  seq = null;
}

let playbackWatchdogT = null;
function stopPlaybackWatchdog() {
  clearTimeout(playbackWatchdogT);
  playbackWatchdogT = null;
}
function startPlaybackWatchdog() {
  stopPlaybackWatchdog();
  playbackWatchdogT = setTimeout(() => {
    if (!window.Tone || !Tone.Transport || Tone.Transport.state !== "started") return;
    if (playbackStep > 0) return;
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    clearSequence();
    playbackStep = 0;
    buildSequence();
    Tone.Transport.start("+0.03");
    setStatus("Motor de audio reiniciado automáticamente. Si Chrome iba pesado, ya debería avanzar.");
  }, 1100);
}

// Sintetizadores editables (subtractivo) para las pistas con tono
function defaultSynths() {
  return {
    bass: { wave: "sawtooth", cutoff: 90,   res: 2, attack: 0.005, decay: 0.20, sustain: 0.45, release: 0.12, slide: 0 },
    stab: { wave: "sawtooth", cutoff: 2200, res: 1, attack: 0.006, decay: 0.22, sustain: 0.05, release: 0.18, engine: "saw", fm: 8 },
  };
}
function normalizeSynths(src) {
  const d = defaultSynths();
  if (src) for (const id of ["bass", "stab"]) if (src[id]) Object.assign(d[id], src[id]);
  return d;
}
function anySolo() { return TRACKS.some((t) => mixOf(t.id).solo); }
function normalizeMix(src) {
  const m = defaultMix();
  if (src) for (const t of TRACKS) if (src[t.id]) Object.assign(m[t.id], src[t.id]);
  return m;
}

// Aplica la mezcla a las voces en vivo sin reconstruirlas (mezcla en tiempo real)
function applyChannel(id) {
  if (!live || !live.ch || !live.ch[id]) return;
  const m = mixOf(id), c = live.ch[id];
  c.volume.value = m.vol;
  c.pan.value = m.pan;
  c.mute = m.mute || (anySolo() && !m.solo);
}
function applyAllChannels() { if (live && live.ch) for (const t of TRACKS) applyChannel(t.id); }

function setVol(id, v)   { mixOf(id).vol = v; applyChannel(id); markDirty(); }
function setPan(id, v)   { mixOf(id).pan = v; applyChannel(id); markDirty(); }
function toggleMute(id)  { const m = mixOf(id); m.mute = !m.mute; applyChannel(id); renderGrid(); markDirty(); }
function toggleSolo(id)  { const m = mixOf(id); m.solo = !m.solo; applyAllChannels(); renderGrid(); markDirty(); }

// Aislar capa (Fase 5): mantén pulsado para oír solo una pista; suelta = vuelve.
// Solo audio (sin re-render, para que el botón sobreviva al pointerup).
let isolateSaved = null;
function isolateStart(id) {
  if (isolateSaved) return;
  isolateSaved = TRACKS.map((t) => mixOf(t.id).solo);
  TRACKS.forEach((t) => { mixOf(t.id).solo = (t.id === id); });
  applyAllChannels();
  document.querySelectorAll(".track").forEach((row, i) => row.classList.toggle("isolated-dim", TRACKS[i] && TRACKS[i].id !== id));
  setStatus(`🎧 Aislando <b>${id}</b> — suelta para volver.`);
}
function isolateEnd() {
  if (!isolateSaved) return;
  TRACKS.forEach((t, i) => { mixOf(t.id).solo = isolateSaved[i]; });
  isolateSaved = null;
  applyAllChannels();
  document.querySelectorAll(".track.isolated-dim").forEach((r) => r.classList.remove("isolated-dim"));
}

// --- Proyecto (.tfp = JSON): el proyecto es la fuente de verdad ---
const PROJECT_VERSION = 1;
const AUTOSAVE_KEY = "technoforge.autosave";

function getProject() {
  return {
    v: PROJECT_VERSION,
    name: projectName,
    mode,
    ui: {
      bpm: $("bpm").value, root: $("root").value, scale: $("scale").value,
      style: $("style").value, emotion: $("emotion").value,
      energy: $("energy").value, swing: $("swing").value, humanize: $("humanize").value,
    },
    patterns,
    current,
    barsPerTramo,
    tramoBars,
    tramoFx,
    tramoVocal,
    mix,
    fxGlobal,
    synth,
    proMacros,
    proBrief,
    referenceDna,
    aiHistory,
    samples,
    vocal,
  };
}

function normalizePattern(src) {
  const p = blankPattern();
  if (!src) return p;
  for (const k of ["kick", "clap", "chat", "ohat"])
    if (Array.isArray(src[k])) for (let i = 0; i < STEPS; i++) p[k][i] = !!src[k][i];
  if (Array.isArray(src.bass)) for (let i = 0; i < STEPS; i++) p.bass[i] = src.bass[i] == null ? null : src.bass[i];
  if (Array.isArray(src.stab)) for (let i = 0; i < STEPS; i++) p.stab[i] = Array.isArray(src.stab[i]) ? src.stab[i].slice() : null;
  if (src.mods) for (const k of NOTE_KEYS)
    if (Array.isArray(src.mods[k])) for (let i = 0; i < STEPS; i++) {
      const m = src.mods[k][i];
      p.mods[k][i] = m ? { p: m.p != null ? m.p : 1, r: m.r != null ? m.r : 1 } : null;
    }
  return p;
}

function loadProject(p) {
  if (!p || !p.ui) return false;
  projectName = p.name || "Mi track";
  const set = (id, v) => {
    const el = $(id); if (el == null || v == null) return;
    el.value = v; const out = $(id + "Out"); if (out) out.textContent = v;
  };
  ["bpm", "root", "scale", "style", "emotion", "energy", "swing", "humanize"].forEach((id) => set(id, p.ui[id]));
  if (Array.isArray(p.patterns) && p.patterns.length) {
    patterns = p.patterns.map(normalizePattern);
  } else {
    patterns = [normalizePattern(p.pattern)]; // compat: proyectos de una sola sección
  }
  current = Math.max(0, Math.min(p.current || 0, patterns.length - 1));
  pattern = patterns[current];
  barsPerTramo = p.barsPerTramo || 4;
  tramoBars = patterns.map((_, i) => (p.tramoBars && p.tramoBars[i]) || barsPerTramo);
  tramoFx = patterns.map((_, i) => (p.tramoFx && p.tramoFx[i]) || "none");
  tramoVocal = patterns.map((_, i) => (p.tramoVocal ? p.tramoVocal[i] !== false : true));
  mix = normalizeMix(p.mix);
  const g = p.fxGlobal || {};
  fxGlobal = { rumble: g.rumble || 0, masterGain: g.masterGain || 0, lufsTarget: g.lufsTarget || -9,
    lfo: g.lfo ? { on: !!g.lfo.on, bars: g.lfo.bars || 2, depth: g.lfo.depth != null ? g.lfo.depth : 0.5 } : { on: false, bars: 2, depth: 0.5 } };
  if ($("rumble")) { $("rumble").value = Math.round(fxGlobal.rumble * 100); $("rumbleOut").textContent = $("rumble").value; }
  synth = normalizeSynths(p.synth);
  proMacros = normalizeProMacros(p.proMacros);
  proBrief = p.proBrief || "";
  referenceDna = p.referenceDna || null;
  aiHistory = Array.isArray(p.aiHistory) ? p.aiHistory.slice(0, 12).map(String) : [];
  // Sampler: re-decodifica los samples guardados en buffers de audio
  samples = {}; sampleBuffers = {};
  if (p.samples && window.Tone) {
    for (const id of Object.keys(p.samples)) {
      const s = p.samples[id];
      if (s && s.url) {
        samples[id] = s;
        const tb = new Tone.ToneAudioBuffer(s.url, () => { sampleBuffers[id] = tb; resetLive(); renderGrid(); });
      }
    }
  }
  // Vocal/Sample: restaura ajustes y re-decodifica el audio
  vocal = { name: null, url: null, bars: 4, vol: 0, mute: false };
  vocalBuffer = null;
  if (p.vocal) {
    vocal = { name: p.vocal.name || null, url: p.vocal.url || null, bars: p.vocal.bars || 4, vol: p.vocal.vol || 0, mute: !!p.vocal.mute };
    if (vocal.url && window.Tone) {
      const tb = new Tone.ToneAudioBuffer(vocal.url, () => { vocalBuffer = tb; resetLive(); renderVocal(); });
    }
  }
  mode = p.mode === "song" ? "song" : "loop";
  $("modeBtn").textContent = mode === "song" ? "🎚️ Track" : "🔁 Bucle";
  if ($("projName")) $("projName").value = projectName;
  built = null; resetLive(); // reconstruir voces con la mezcla nueva
  if (window.Tone && Tone.Transport) Tone.Transport.bpm.value = bpm();
  refreshSong(); renderGrid(); renderTimeline(); renderAutomation(); renderInstruments(); renderModulation(); renderVocal(); renderProDesk();
  return true;
}

let autosaveT = null;
function markDirty() {
  clearTimeout(autosaveT);
  autosaveT = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(getProject()));
    } catch (e) {
      // Si los samples exceden la cuota, guarda al menos el resto (samples van en el .tfp)
      try { const p = getProject(); p.samples = {}; if (p.vocal) p.vocal = { ...p.vocal, url: null }; localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(p)); } catch (e2) {}
    }
  }, 400);
}

function saveProjectFile() {
  const name = (projectName || "track").replace(/[^\w\- ]+/g, "").trim() || "track";
  const data = new TextEncoder().encode(JSON.stringify(getProject(), null, 2));
  TechnoMidi.download(data, `${name}.tfp`, "application/json");
  setStatus("Proyecto guardado (.tfp) ✔");
}

function loadProjectFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (loadProject(JSON.parse(reader.result))) {
        markDirty();
        setStatus(`Proyecto «${projectName}» cargado ✔`);
      } else setStatus("Ese archivo no parece un proyecto válido.");
    } catch (e) { setStatus("No se pudo leer el proyecto (¿archivo dañado?)."); }
  };
  reader.readAsText(file);
}

function newProject() {
  projectName = "Mi track";
  mix = defaultMix();
  samples = {}; sampleBuffers = {};
  patterns = [blankPattern()]; current = 0; pattern = patterns[0]; tramoBars = [4]; tramoFx = ["none"]; tramoVocal = [true];
  fxGlobal = { rumble: 0, masterGain: 0, lufsTarget: -9, lfo: { on: false, bars: 2, depth: 0.5 } };
  proMacros = defaultProMacros();
  proBrief = "";
  referenceDna = null;
  if ($("rumble")) { $("rumble").value = 0; $("rumbleOut").textContent = "0"; }
  renderModulation();
  renderProDesk(); renderAutomation();
  synth = defaultSynths(); renderInstruments();
  vocal = { name: null, url: null, bars: 4, vol: 0, mute: false }; vocalBuffer = null; renderVocal();
  if ($("projName")) $("projName").value = projectName;
  generate(); // patrón nuevo
  markDirty();
  setStatus("Proyecto nuevo. <b>Generar idea</b> y <b>Play</b>.");
}

// --- Sampler: cargar un audio real que reemplaza la síntesis de una pista ---
function shortName(n) { return n.length > 12 ? n.slice(0, 11) + "…" : n; }

function loadSampleFile(file, id) {
  setStatus(`Cargando «${file.name}»…`);
  const reader = new FileReader();
  reader.onload = () => {
    const url = reader.result; // dataURL (viaja con el proyecto .tfp)
    const tbuf = new Tone.ToneAudioBuffer(
      url,
      () => {
        sampleBuffers[id] = tbuf;
        samples[id] = { name: file.name, url };
        invalidateVoices(); // usar el sample (en vivo si está sonando)
        renderGrid(); markDirty();
        setStatus(`🎵 «${file.name}» cargado en <b>${id}</b>.`);
      },
      () => setStatus("No se pudo decodificar ese audio (prueba .wav o .mp3).")
    );
  };
  reader.readAsDataURL(file);
}

function clearSample(id) {
  delete samples[id]; delete sampleBuffers[id];
  invalidateVoices();
  renderGrid(); markDirty();
  setStatus(`Pista <b>${id}</b> vuelve a la síntesis.`);
}

// --- Kit de fábrica: one-shots generados por síntesis (en memoria) ---
let factoryKit = null, kitIndex = {};
async function ensureKit() {
  if (factoryKit) return factoryKit;
  const mk = (fn, dur) => Tone.Offline(fn, dur);
  factoryKit = [
    { name: "Kick 909", buffer: await mk(() => { new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 8, envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.02 } }).toDestination().triggerAttackRelease("C1", "8n", 0); }, 0.6) },
    { name: "Kick 808", buffer: await mk(() => { new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 6, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.05 } }).toDestination().triggerAttackRelease("A0", "2n", 0); }, 1.1) },
    { name: "Clap", buffer: await mk(() => { new Tone.NoiseSynth({ envelope: { attack: 0.002, decay: 0.25, sustain: 0 } }).connect(new Tone.Filter(1500, "bandpass").toDestination()).triggerAttackRelease("8n", 0); }, 0.5) },
    { name: "Hat", buffer: await mk(() => { new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(new Tone.Filter(9000, "highpass").toDestination()).triggerAttackRelease("16n", 0); }, 0.2) },
    { name: "Perc", buffer: await mk(() => { new Tone.MetalSynth({ frequency: 300, envelope: { attack: 0.001, decay: 0.2, release: 0.05 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination().triggerAttackRelease("16n", 0); }, 0.4) },
  ];
  return factoryKit;
}
async function loadFactory(id) {
  setStatus("Cargando kit de fábrica…");
  const kit = await ensureKit();
  kitIndex[id] = ((kitIndex[id] == null ? -1 : kitIndex[id]) + 1) % kit.length;
  const item = kit[kitIndex[id]];
  sampleBuffers[id] = item.buffer;
  samples[id] = { name: item.name, url: null }; // generado: en memoria (no persiste)
  invalidateVoices(); renderGrid(); markDirty();
  setStatus(`🥁 «${item.name}» (fábrica) en <b>${id}</b>. Pulsa 📚 para el siguiente sonido.`);
}

// --- Pista de Vocal/Sample: un audio (acapella/loop) sincronizado al tempo ---
function loadVocalFile(file) {
  setStatus(`Cargando vocal «${file.name}»…`);
  const reader = new FileReader();
  reader.onload = () => {
    const url = reader.result;
    const tbuf = new Tone.ToneAudioBuffer(url, () => {
      vocalBuffer = tbuf;
      vocal.name = file.name; vocal.url = url;
      invalidateVoices(); renderVocal(); markDirty();
      setStatus(`🎤 Vocal «${file.name}» cargada (${vocal.bars} comp.). Pulsa Play.`);
    }, () => setStatus("No se pudo decodificar esa vocal (prueba .wav o .mp3)."));
  };
  reader.readAsDataURL(file);
}
// Grabación de audio (micrófono) → pista de vocal
let mediaRecorder = null, recChunks = [];
async function toggleRecord() {
  if (mediaRecorder && mediaRecorder.state === "recording") { mediaRecorder.stop(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setStatus("Tu navegador no permite grabar audio."); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(recChunks, { type: recChunks[0] ? recChunks[0].type : "audio/webm" });
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result;
        const tb = new Tone.ToneAudioBuffer(url, () => {
          vocalBuffer = tb; vocal.name = "grabación"; vocal.url = url;
          invalidateVoices(); renderVocal(); markDirty();
          setStatus("🎙️ Grabación lista en la pista de Vocal/Sample. Ajusta los compases y Play.");
        }, () => setStatus("No se pudo decodificar la grabación."));
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorder.start();
    renderVocal();
    setStatus("🔴 Grabando… pulsa <b>■ Parar</b> para terminar.");
  } catch (e) { setStatus("No se pudo acceder al micrófono (permiso denegado)."); }
}

function clearVocal() {
  vocal = { name: null, url: null, bars: vocal.bars, vol: vocal.vol, mute: vocal.mute };
  vocalBuffer = null;
  invalidateVoices(); renderVocal(); markDirty();
  setStatus("Vocal quitada.");
}
function setVocal(key, v) { vocal[key] = v; invalidateVoices(); renderVocal(); markDirty(); }

function renderModulation() {
  const el = $("modulation"); if (!el) return;
  el.innerHTML = "";
  const l = fxGlobal.lfo || (fxGlobal.lfo = { on: false, bars: 2, depth: 0.5 });
  const lab = document.createElement("span"); lab.className = "em-label"; lab.textContent = "〜 Auto-filtro (LFO)";
  el.appendChild(lab);
  const on = document.createElement("button"); on.className = "mini" + (l.on ? " solo" : "");
  on.textContent = l.on ? "ON" : "OFF"; on.title = "Filtro de máster que respira (sube/baja el brillo cíclicamente)";
  on.onclick = () => { l.on = !l.on; applyLfo(); renderModulation(); setStatus(l.on ? "Auto-filtro <b>ON</b> — el track respira." : "Auto-filtro OFF."); };
  el.appendChild(on);
  const rate = document.createElement("label"); rate.className = "vocal-ctl";
  rate.append(Object.assign(document.createElement("span"), { textContent: "Velocidad" }));
  const rsel = document.createElement("select"); rsel.title = "Cada cuántos compases completa un ciclo";
  [[1, "1 comp."], [2, "2 comp."], [4, "4 comp."], [8, "8 comp."]].forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; if (v === l.bars) o.selected = true; rsel.appendChild(o); });
  rsel.onchange = () => { l.bars = parseInt(rsel.value, 10); applyLfo(); };
  rate.appendChild(rsel); el.appendChild(rate);
  const dep = document.createElement("label"); dep.className = "vocal-ctl";
  dep.append(Object.assign(document.createElement("span"), { textContent: "Profundidad" }));
  const dinp = document.createElement("input"); dinp.type = "range"; dinp.min = "0"; dinp.max = "1"; dinp.step = "0.05"; dinp.value = l.depth; dinp.title = "Cuánto barre el filtro";
  dinp.oninput = () => { l.depth = parseFloat(dinp.value); applyLfo(); };
  dep.appendChild(dinp); el.appendChild(dep);
}

// Dibuja la forma de onda (picos por columna) de un AudioBuffer en un canvas
function drawWaveform(cv, buf) {
  const ctx = cv.getContext("2d"); const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const data = buf.getChannelData(0), step = Math.max(1, Math.floor(data.length / W));
  ctx.fillStyle = "#1ad4a8";
  for (let x = 0; x < W; x++) {
    let min = 1, max = -1;
    for (let i = 0; i < step; i++) { const v = data[x * step + i] || 0; if (v < min) min = v; if (v > max) max = v; }
    const y1 = (1 - max) * H / 2, y2 = (1 - min) * H / 2;
    ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
}

function renderVocal() {
  const el = $("vocal"); if (!el) return;
  el.innerHTML = "";
  const lab = document.createElement("span"); lab.className = "em-label"; lab.textContent = "🎤 Vocal/Sample";
  el.appendChild(lab);
  // Grabar desde el micrófono (en cualquier estado)
  const recording = mediaRecorder && mediaRecorder.state === "recording";
  const rec = document.createElement("button"); rec.className = "mini" + (recording ? " muted" : "");
  rec.textContent = recording ? "■ Parar" : "🔴 Grabar"; rec.title = "Graba desde el micrófono a la pista de vocal";
  rec.onclick = () => toggleRecord();
  el.appendChild(rec);
  if (!vocal.name) {
    const btn = document.createElement("button"); btn.className = "tramo-add"; btn.textContent = "＋ Cargar vocal/loop";
    btn.title = "Carga una acapella, vocal o loop (.wav/.mp3) sincronizado al tempo";
    btn.onclick = () => $("vocalInput").click();
    el.appendChild(btn);
    return;
  }
  const name = document.createElement("span"); name.className = "vocal-name"; name.textContent = vocal.name;
  el.appendChild(name);
  // Forma de onda del audio cargado
  const cv = document.createElement("canvas"); cv.className = "wave"; cv.width = 260; cv.height = 36;
  el.appendChild(cv);
  if (vocalBuffer && vocalBuffer.loaded) drawWaveform(cv, vocalBuffer.get());
  // compases (longitud del loop)
  const barsWrap = document.createElement("label"); barsWrap.className = "vocal-ctl";
  barsWrap.append(Object.assign(document.createElement("span"), { textContent: "Compases" }));
  const barsSel = document.createElement("select");
  [1, 2, 4, 8, 16].forEach((n) => { const o = document.createElement("option"); o.value = n; o.textContent = n; if (n === vocal.bars) o.selected = true; barsSel.appendChild(o); });
  barsSel.onchange = () => setVocal("bars", parseInt(barsSel.value, 10));
  barsWrap.appendChild(barsSel); el.appendChild(barsWrap);
  // volumen
  const volWrap = document.createElement("label"); volWrap.className = "vocal-ctl";
  volWrap.append(Object.assign(document.createElement("span"), { textContent: "Vol" }));
  const vol = document.createElement("input"); vol.type = "range"; vol.min = "-36"; vol.max = "6"; vol.step = "1"; vol.value = vocal.vol;
  vol.oninput = () => setVocal("vol", parseFloat(vol.value));
  volWrap.appendChild(vol); el.appendChild(volWrap);
  // mute
  const mute = document.createElement("button"); mute.className = "mini" + (vocal.mute ? " muted" : ""); mute.textContent = "M"; mute.title = "Silenciar vocal";
  mute.onclick = () => setVocal("mute", !vocal.mute);
  el.appendChild(mute);
  // quitar
  const x = document.createElement("button"); x.className = "mini"; x.textContent = "✕"; x.title = "Quitar vocal";
  x.onclick = () => clearVocal();
  el.appendChild(x);
}

// --- Tramos (secciones): crea y encadena partes para montar el track ---
function selectTramo(i) {
  if (i < 0 || i >= patterns.length) return;
  current = i; pattern = patterns[current];
  built = null; refreshSong(); renderGrid(); markDirty();
  setStatus(`Editando <b>Tramo ${i + 1}</b> de ${patterns.length}.`);
}
function tramoBarsOf(i) { return tramoBars[i] || barsPerTramo; }
function tramoFxOf(i) { return tramoFx[i] || "none"; }
function tramoVocalOf(i) { return tramoVocal[i] !== false; }
function setTramoVocal(v) {
  tramoVocal[current] = v;
  renderTramos(); markDirty();
  setStatus(`Tramo ${current + 1}: vocal <b>${v ? "ON" : "OFF"}</b>.`);
}
function setTramoBars(n) {
  tramoBars[current] = n;
  built = null; refreshSong(); renderTramos(); resync(); markDirty();
  setStatus(`Tramo ${current + 1}: <b>${n}</b> compases.`);
}
function setTramoFx(v) {
  tramoFx[current] = v;
  built = null; refreshSong(); renderTramos(); resync(); markDirty();
  const lbl = { none: "sin transición", riser: "subida (riser) al final", impact: "impacto al entrar", drop: "drop (impacto + subida)" };
  setStatus(`Tramo ${current + 1}: <b>${lbl[v]}</b>.`);
}
function addTramo() { // copia el actual para seguir creando rápido una variación
  patterns.splice(current + 1, 0, deepCopy(pattern));
  tramoBars.splice(current + 1, 0, tramoBarsOf(current));
  tramoFx.splice(current + 1, 0, "none");
  tramoVocal.splice(current + 1, 0, tramoVocalOf(current));
  current += 1; pattern = patterns[current];
  built = null; refreshSong(); renderGrid(); resync(); markDirty();
  setStatus(`<b>Tramo ${current + 1}</b> creado (copia). Edítalo y pulsa ➕ para el siguiente.`);
}
function duplicateTramo() { addTramo(); }
function mutateTramo() {
  pattern = tightenForHardGroove(mutate(pattern));
  syncTramo();
  built = null; refreshSong(); renderGrid(); resync(); markDirty();
  setStatus(`<b>Tramo ${current + 1}</b> mutado: variación lista para otro drop o break.`);
}
function moveTramo(dir) {
  const j = current + dir;
  if (j < 0 || j >= patterns.length) return;
  [patterns[current], patterns[j]] = [patterns[j], patterns[current]];
  [tramoBars[current], tramoBars[j]] = [tramoBars[j], tramoBars[current]];
  [tramoFx[current], tramoFx[j]] = [tramoFx[j], tramoFx[current]];
  [tramoVocal[current], tramoVocal[j]] = [tramoVocal[j], tramoVocal[current]];
  current = j; pattern = patterns[current];
  built = null; refreshSong(); renderGrid(); resync(); markDirty();
  setStatus(`Tramo movido a la posición <b>${current + 1}</b>.`);
}
function newIdeaTramo() { // tramo nuevo con una idea generada desde cero
  patterns.splice(current + 1, 0, blankPattern());
  tramoBars.splice(current + 1, 0, barsPerTramo);
  tramoFx.splice(current + 1, 0, "none");
  tramoVocal.splice(current + 1, 0, true);
  current += 1; pattern = patterns[current];
  generate(); // genera la idea en el tramo nuevo (sincroniza y redibuja)
  setStatus(`<b>Tramo ${current + 1}</b> con idea nueva. Sigue creando.`);
}
function deleteTramo(i) {
  if (patterns.length <= 1) { setStatus("Necesitas al menos un tramo."); return; }
  patterns.splice(i, 1); tramoBars.splice(i, 1); tramoFx.splice(i, 1); tramoVocal.splice(i, 1);
  current = Math.max(0, Math.min(current, patterns.length - 1));
  pattern = patterns[current];
  built = null; refreshSong(); renderGrid(); resync(); markDirty();
}

function renderTramos() {
  const bar = $("tramos"); if (!bar) return;
  bar.innerHTML = "";
  patterns.forEach((_, i) => {
    const chip = document.createElement("button");
    chip.className = "tramo" + (i === current ? " active" : "");
    chip.textContent = "Tramo " + (i + 1);
    chip.onclick = () => selectTramo(i);
    bar.appendChild(chip);
  });
  if (patterns.length > 1) {
    const del = document.createElement("button");
    del.className = "tramo-del"; del.textContent = "🗑"; del.title = "Borrar el tramo activo";
    del.onclick = () => deleteTramo(current);
    bar.appendChild(del);
  }
  const add = document.createElement("button");
  add.className = "tramo-add"; add.textContent = "➕ Nuevo tramo";
  add.title = "Crea el siguiente tramo (copia del actual) para seguir";
  add.onclick = addTramo;
  bar.appendChild(add);
  const fresh = document.createElement("button");
  fresh.className = "tramo-add fresh"; fresh.textContent = "🎲 Idea nueva";
  fresh.title = "Crea un tramo con una idea generada desde cero";
  fresh.onclick = newIdeaTramo;
  bar.appendChild(fresh);
  const dup = document.createElement("button");
  dup.className = "tramo-add"; dup.textContent = "⧉ Duplicar"; dup.title = "Duplica el tramo activo";
  dup.onclick = duplicateTramo;
  bar.appendChild(dup);
  const mut = document.createElement("button");
  mut.className = "tramo-add"; mut.textContent = "↯ Mutar"; mut.title = "Crea una variación musical del tramo activo";
  mut.onclick = mutateTramo;
  bar.appendChild(mut);
  const prev = document.createElement("button");
  prev.className = "tramo-del"; prev.textContent = "←"; prev.title = "Mover tramo a la izquierda";
  prev.onclick = () => moveTramo(-1);
  bar.appendChild(prev);
  const next = document.createElement("button");
  next.className = "tramo-del"; next.textContent = "→"; next.title = "Mover tramo a la derecha";
  next.onclick = () => moveTramo(1);
  bar.appendChild(next);

  // Duración (compases) del tramo activo
  const barsWrap = document.createElement("label"); barsWrap.className = "tramo-len";
  barsWrap.append(Object.assign(document.createElement("span"), { textContent: "Compases" }));
  const sel = document.createElement("select"); sel.title = "Duración del tramo activo";
  [1, 2, 4, 8, 16].forEach((n) => { const o = document.createElement("option"); o.value = n; o.textContent = n; if (n === tramoBarsOf(current)) o.selected = true; sel.appendChild(o); });
  sel.onchange = () => setTramoBars(parseInt(sel.value, 10));
  barsWrap.appendChild(sel); bar.appendChild(barsWrap);

  // Transición/Drop del tramo activo
  const fxWrap = document.createElement("label"); fxWrap.className = "tramo-len";
  fxWrap.append(Object.assign(document.createElement("span"), { textContent: "Transición" }));
  const fxSel = document.createElement("select"); fxSel.title = "FX de transición (drop) del tramo activo";
  [["none", "—"], ["riser", "↑ Subida"], ["impact", "💥 Impacto"], ["drop", "🔥 Drop"]].forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; if (v === tramoFxOf(current)) o.selected = true; fxSel.appendChild(o); });
  fxSel.onchange = () => setTramoFx(fxSel.value);
  fxWrap.appendChild(fxSel); bar.appendChild(fxWrap);

  // Vocal por tramo (solo si hay vocal cargada)
  if (vocal && vocal.name) {
    const vbtn = document.createElement("button");
    vbtn.className = "mini" + (tramoVocalOf(current) ? " solo" : " muted");
    vbtn.textContent = "🎤"; vbtn.title = "Vocal en este tramo (on/off)";
    vbtn.onclick = () => setTramoVocal(!tramoVocalOf(current));
    bar.appendChild(vbtn);
  }
}

function rootPc()  { return parseInt($("root").value, 10); }
function scaleId() { return $("scale").value; }
function styleId() { return $("style").value; }
function styleParams() { return STYLE_PARAMS[styleId()] || STYLE_PARAMS.peaktime; }
function bpm()     { return parseInt($("bpm").value, 10); }
function energy()  { return parseInt($("energy").value, 10) / 100; }
function swingAmt(){ return parseInt($("swing").value, 10) / 100; }
function humanizeAmt(){ const el = $("humanize"); return el ? parseInt(el.value, 10) / 100 : 0; }

function emotionId()     { return $("emotion").value; }
function currentEmotion(){ return EMOTIONS[emotionId()] || EMOTIONS.melancolia; }
function wantSeventh()   { return styleParams().seventh || currentEmotion().seventh; }

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

function applyAfroGroove(p) {
  p.kick = arr16(false);
  [0, 4, 8, 12].forEach((s) => (p.kick[s] = true));
  [7, 15].forEach((s) => { p.kick[s] = true; p.mods.kick[s] = { p: 0.42, r: 1 }; });

  p.clap = arr16(false);
  [4, 12].forEach((s) => (p.clap[s] = true));
  p.clap[14] = true; p.mods.clap[14] = { p: 0.48, r: 1 };

  p.chat = arr16(false);
  [1, 3, 5, 7, 9, 11, 13, 15].forEach((s) => (p.chat[s] = true));
  [6, 10, 14].forEach((s) => { p.chat[s] = true; p.mods.chat[s] = { p: 0.72, r: 2 }; });

  p.ohat = arr16(false);
  [2, 6, 10, 14].forEach((s) => (p.ohat[s] = true));
  p.mods.ohat[10] = { p: 0.76, r: 1 };

  p.bass = arr16(null);
  [0, 3, 6, 8, 10, 13, 15].forEach((s, i) => {
    const base = bassNoteAt(s);
    p.bass[s] = i % 3 === 1 ? base + 7 : base;
  });

  p.stab = arr16(null);
  [0, 6, 10, 14].forEach((s) => {
    p.stab[s] = chordAt(progAt(s), 48, false);
  });
  return p;
}

// ----------------------------------------------------------------------------
// Generación de la idea (las "reglas" del techno + estilo)
// ----------------------------------------------------------------------------
function generate() {
  const e = energy();
  const sp = styleParams();
  const sc = SCALES[scaleId()];
  const em = currentEmotion();
  const p = blankPattern();
  const sid = styleId();

  // Bombo 4x4
  [0, 4, 8, 12].forEach((s) => (p.kick[s] = true));
  if (e > 0.7 && rnd() < 0.4) p.kick[14] = true;
  if (["hardgroove", "schranz", "raw"].includes(sid)) {
    p.kick[15] = true;
    p.mods.kick[15] = { p: 0.55, r: 1 };
  }
  if (sid === "schranz") {
    p.kick[3] = true; p.mods.kick[3] = { p: 0.42, r: 1 };
    p.kick[11] = true; p.mods.kick[11] = { p: 0.38, r: 1 };
  }

  // Clap en 2 y 4
  p.clap[4] = true;
  p.clap[12] = true;
  if (["hardgroove", "raw"].includes(sid) && e > 0.65) {
    p.clap[15] = true;
    p.mods.clap[15] = { p: 0.45, r: 1 };
  }

  // Open hats al contratiempo
  [2, 6, 10, 14].forEach((s) => (p.ohat[s] = true));
  if (e < 0.3) { p.ohat[2] = false; p.ohat[10] = false; }

  // Closed hats con acentos
  for (let s = 0; s < STEPS; s++) {
    if (p.ohat[s]) continue;
    const dens = (s % 2 === 0 ? sp.hat + 0.15 : sp.hat) + e * 0.3;
    if (rnd() < dens) p.chat[s] = true;
  }
  if (["hardgroove", "schranz", "raw"].includes(sid)) {
    [1, 3, 5, 7, 9, 11, 13, 15].forEach((s) => (p.chat[s] = true));
    [3, 7, 11, 15].forEach((s) => (p.mods.chat[s] = { p: sid === "schranz" ? 0.92 : 0.8, r: sid === "schranz" ? 3 : 2 }));
    p.mods.ohat[14] = { p: 1, r: 2 };
  }
  if (sid === "acid") {
    [3, 7, 11, 15].forEach((s) => { p.chat[s] = true; p.mods.chat[s] = { p: 0.7, r: 2 }; });
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
  if (["hardgroove", "schranz", "raw"].includes(sid)) {
    [1, 2, 3, 6, 7, 9, 10, 11, 14, 15].forEach((s) => {
      if (p.bass[s] == null && rnd() < 0.9) p.bass[s] = bassNoteAt(s);
    });
  }
  if (sid === "acid") {
    [1, 2, 3, 5, 6, 7, 10, 11, 13, 14, 15].forEach((s) => {
      const base = bassNoteAt(s);
      p.bass[s] = rnd() > 0.72 ? base + 12 : base;
      if (rnd() > 0.58) p.mods.bass[s] = { p: 1, r: 2 };
    });
  }

  // Acordes: progresión emocional en los cuatro tiempos (columna armónica)…
  const seventh = wantSeventh();
  const prog = em.prog;
  [0, 4, 8, 12].forEach((s, i) => (p.stab[s] = chordAt(prog[i % prog.length], 48, seventh)));
  // …más stabs sincopados extra para groove (toman el acorde de su tiempo)
  const cand = shuffle([3, 7, 10, 11, 14]);
  const count = clamp(sp.stab - 1 + Math.round(e), 0, cand.length);
  cand.slice(0, count).forEach((s) => { if (p.stab[s] == null) p.stab[s] = chordAt(progAt(s), 48, seventh); });
  if (sid === "afro") applyAfroGroove(p);

  pattern = p;
  syncTramo();
  built = null;
  // Si no está sonando, fuerza recrear las voces (para que el cambio de estilo
  // — p.ej. el bajo reese — se aplique en la siguiente reproducción).
  if (Tone.Transport.state !== "started") resetLive();
  refreshSong();
  renderGrid();
  setStatus(mode === "song"
    ? "Track montado. Pulsa <b>Play</b> para escucharlo entero."
    : "Idea generada. <b>Play</b> para escuchar; toca las celdas para editar.");
  markDirty();
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
  syncTramo();
  built = null;
  refreshSong();
  renderGrid();
}

// Copia y mutación del patrón (para variar los drops)
function deepCopy(p) {
  const mods = blankMods();
  if (p.mods) for (const k of NOTE_KEYS)
    if (p.mods[k]) for (let i = 0; i < STEPS; i++) mods[k][i] = p.mods[k][i] ? { ...p.mods[k][i] } : null;
  return { kick: [...p.kick], clap: [...p.clap], chat: [...p.chat], ohat: [...p.ohat],
           bass: [...p.bass], stab: p.stab.map((c) => (c ? [...c] : null)), mods };
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

function silenceTrack(p, id) {
  p[id] = (id === "bass" || id === "stab") ? arr16(null) : arr16(false);
  if (p.mods && p.mods[id]) p.mods[id] = arr16(null);
}

function keepOnly(p, ids) {
  const out = deepCopy(p);
  const keep = new Set(ids);
  for (const id of NOTE_KEYS) if (!keep.has(id)) silenceTrack(out, id);
  return out;
}

function tightenForHardGroove(p) {
  [0, 4, 8, 12].forEach((s) => (p.kick[s] = true));
  p.kick[15] = true; p.mods.kick[15] = { p: 0.55, r: 1 };
  p.clap[4] = true; p.clap[12] = true;
  [2, 6, 10, 14].forEach((s) => (p.ohat[s] = true));
  [1, 3, 5, 7, 9, 11, 13, 15].forEach((s) => (p.chat[s] = true));
  [3, 7, 11, 15].forEach((s) => (p.mods.chat[s] = { p: 0.82, r: 2 }));
  p.mods.ohat[14] = { p: 1, r: 2 };
  [1, 2, 3, 6, 7, 9, 10, 11, 14, 15].forEach((s) => {
    if (p.bass[s] == null) p.bass[s] = bassNoteAt(s);
  });
  [0, 8].forEach((s) => { if (p.stab[s] == null) p.stab[s] = chordAt(progAt(s), 48, wantSeventh()); });
  return p;
}

function tightenForAfro(p) {
  applyAfroGroove(p);
  p.mods.kick[15] = { p: 0.52, r: 1 };
  p.mods.chat[6] = { p: 0.78, r: 2 };
  p.mods.chat[14] = { p: 0.82, r: 2 };
  return p;
}

function tightenForPreset(p, preset) {
  if (preset === "afro") return tightenForAfro(p);
  return tightenForHardGroove(p);
}

function makeBreakPattern(src) {
  const out = keepOnly(src, ["chat", "ohat", "stab"]);
  [0, 4, 8, 12].forEach((s) => {
    if (out.stab[s] == null) out.stab[s] = chordAt(progAt(s), 48, wantSeventh());
  });
  [1, 5, 9, 13].forEach((s) => (out.chat[s] = false));
  return out;
}

function createProArrangement(opts = {}) {
  const wasPlaying = window.Tone && Tone.Transport && Tone.Transport.state === "started";
  const resumeAfter = opts.resume || wasPlaying;
  if (wasPlaying) stop();
  const preset = $("preset") && $("preset").value ? $("preset").value : "hardgroove";
  if ($("preset")) $("preset").value = preset;
  applyGenrePreset(preset);
  applyProMacros(false);
  generate();

  const dropA = tightenForPreset(deepCopy(pattern), preset);
  const dropB = tightenForPreset(mutate(dropA), preset);
  const intro = keepOnly(dropA, ["kick", "chat", "ohat"]);
  [1, 5, 9, 13].forEach((s) => (intro.chat[s] = false));
  const build = keepOnly(dropA, ["kick", "chat", "ohat", "bass"]);
  const breakP = makeBreakPattern(dropA);
  const outro = keepOnly(dropA, ["kick", "chat"]);
  [3, 7, 11, 15].forEach((s) => { outro.chat[s] = false; outro.mods.chat[s] = null; });

  patterns = [intro, build, dropA, breakP, dropB, outro];
  const longDrops = proMacros.tension > 0.82 || preset === "schranz" || preset === "raw";
  tramoBars = longDrops ? [4, 8, 16, 8, 16, 4] : [4, 8, 8, 8, 12, 4];
  tramoFx = ["none", "riser", "drop", "riser", "drop", "none"];
  tramoVocal = patterns.map(() => true);
  barsPerTramo = 8;
  current = 2;
  pattern = patterns[current];
  mode = "song";
  built = buildSong();
  $("modeBtn").textContent = "🎚️ Track";
  refreshSong();
  renderGrid();
  renderTimeline();
  renderAutomation();
  renderInstruments();
  renderModulation();
  renderMixer();
  renderProDesk();
  resync();
  markDirty();
  setStatus(`Track pro <b>${preset}</b> listo: Intro · Build · Drop · Break · Drop 2 · Outro.`);
  if (resumeAfter) setTimeout(() => play(), 80);
}

function createHardTechnoTrack() {
  if ($("preset")) $("preset").value = "hardgroove";
  createProArrangement();
}

// ----------------------------------------------------------------------------
// Arreglo automático: convierte el bucle base en un track completo
// ----------------------------------------------------------------------------
// Monta el track encadenando TUS tramos en orden (cada uno dura barsPerTramo).
function buildSong() {
  const song = { kick: [], clap: [], chat: [], ohat: [], bass: [], stab: [] };
  const songMods = {}; for (const k of NOTE_KEYS) songMods[k] = [];
  const sections = [];
  const fx = [];
  let barCursor = 0;

  patterns.forEach((pat, i) => {
    const bars = tramoBarsOf(i);
    for (let b = 0; b < bars; b++)
      for (let s = 0; s < STEPS; s++)
        for (const k of NOTE_KEYS) {
          song[k].push(pat[k][s]);
          songMods[k].push(pat.mods && pat.mods[k] ? pat.mods[k][s] : null);
        }
    sections.push({ name: "Tramo " + (i + 1), startBar: barCursor, bars });
    // Transiciones (drops): impacto al entrar y/o subida (riser) en el último compás
    const f = tramoFxOf(i);
    if (f === "impact" || f === "drop") fx.push({ step: barCursor * STEPS, type: "impact" });
    if (f === "riser" || f === "drop") fx.push({ step: (barCursor + bars - 1) * STEPS, type: "riser" });
    barCursor += bars;
  });
  song.mods = songMods;
  return { song, sections, fx };
}

function refreshSong() {
  if (mode === "song") built = buildSong();
  renderTimeline();
  renderAutomation();
}

// ----------------------------------------------------------------------------
// Síntesis (idéntica para reproducción en vivo y exportación WAV)
// ----------------------------------------------------------------------------
function buildVoices(opts = {}) {
  const dest = Tone.getDestination();
  const nodes = [];
  const own = (node) => { nodes.push(node); return node; };
  const liveMode = !opts.offline && !opts.bypassMaster && !opts.flatMix;
  // Para exportar STEMS queremos el sonido "en crudo" (sin la cadena de máster),
  // para que sumen bien y los mezcles/masterices en tu DAW. bypassMaster lo omite.
  let master, out, masterGainNode = null, autoFilter = null, masterLfo = null;
  if (opts.bypassMaster) {
    master = own(new Tone.Gain(0.85)).connect(dest); out = master;
  } else {
    // --- Cadena de mastering: EQ → glue comp → saturación → makeup(ganancia) → limitador ---
    const limiter = own(new Tone.Limiter(-0.5)).connect(dest); out = limiter;
    const makeupGain = 1.4 * Math.pow(10, (fxGlobal.masterGain || 0) / 20); // ganancia de máster ajustable
    const makeup = own(new Tone.Gain(makeupGain)).connect(limiter); masterGainNode = makeup;
    const sat = own(new Tone.Distortion({ distortion: 0.08, oversample: liveMode ? "none" : "2x" })).connect(makeup);
    sat.wet.value = 0.12;                                       // calidez sutil
    const glue = own(new Tone.Compressor({ threshold: -18, ratio: 2.5, attack: 0.02, release: 0.18 })).connect(sat);
    const eq = own(new Tone.EQ3({ low: -1, mid: 0, high: 1.5 })).connect(glue); // limpia graves, da aire
    // Auto-filtro de máster modulado por LFO ("el track respira"). Siempre en la
    // cadena; cuando el LFO está OFF queda abierto (sin efecto).
    autoFilter = own(new Tone.Filter(18000, "lowpass")).connect(eq);
    masterLfo = own(new Tone.LFO({ frequency: 0.25, min: 18000, max: 18000, type: "sine" }));
    masterLfo.connect(autoFilter.frequency); masterLfo.start();
    lfoSettings(masterLfo); // aplica fxGlobal.lfo
    master = own(new Tone.Gain(0.85)).connect(autoFilter);
  }

  // Returns globales de FX. En vivo usamos previos baratos para evitar cuelgues
  // de Chrome; el render offline conserva reverb/delay completos.
  const reverb = liveMode
    ? own(new Tone.Gain(0.22)).connect(master)
    : own(new Tone.Freeverb({ roomSize: 0.9, dampening: 2500 })).connect(master);
  if (!liveMode) reverb.wet.value = 1;
  const delay = liveMode
    ? own(new Tone.Gain(0.12)).connect(master)
    : own(new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.32, wet: 1 })).connect(master);

  // Tira de canal por pista con RACK DE FX: canal(vol/pan/mute) → drive
  // (saturación WaveShaper) → scGain (sidechain) → máster, + envíos a reverb/delay.
  // En stems (flatMix) no se aplica mute/solo.
  const solo = anySolo();
  const ch = {};
  const fx = {};
  const meters = {};
  for (const t of TRACKS) {
    const m = mixOf(t.id);
    const c = own(new Tone.Channel({ volume: m.vol, pan: m.pan }));
    c.mute = opts.flatMix ? false : (m.mute || (solo && !m.solo));
    const eq = own(new Tone.EQ3({ low: m.low || 0, mid: m.mid || 0, high: m.high || 0 }));
    const comp = own(new Tone.Compressor({ threshold: compThreshold(m.comp || 0), ratio: 4, attack: 0.01, release: 0.12 }));
    const drive = own(new Tone.WaveShaper(makeDriveCurve(m.drive || 0)));
    drive.oversample = liveMode ? "none" : "2x"; // en vivo prioriza fluidez; export usa oversampling
    const crush = liveMode ? null : own(new Tone.BitCrusher(crushBits(m.crush || 0)));
    const widener = liveMode ? null : own(new Tone.StereoWidener(m.width != null ? m.width : 0.5));
    const scGain = own(new Tone.Gain(1)); // sidechain: baja por cada golpe de kick
    // cadena de canal pro: EQ → comp → saturación → bitcrush → width → sidechain → máster
    c.connect(eq); eq.connect(comp); comp.connect(drive);
    if (crush && widener) { drive.connect(crush); crush.connect(widener); widener.connect(scGain); }
    else drive.connect(scGain);
    scGain.connect(master);
    const sendRev = own(new Tone.Gain(m.rev || 0));   scGain.connect(sendRev);   sendRev.connect(reverb);
    const sendDly = own(new Tone.Gain(m.delay || 0)); scGain.connect(sendDly);   sendDly.connect(delay);
    meters[t.id] = own(new Tone.Meter()); scGain.connect(meters[t.id]);
    ch[t.id] = c;
    fx[t.id] = { eq, comp, drive, crush, widener, scGain, sendRev, sendDly };
  }
  const masterMeter = own(new Tone.Meter());
  out.connect(masterMeter); // medir la SALIDA real (post-cadena de máster)
  const analyser = liveMode ? null : own(new Tone.Analyser("fft", 64)); // FFT solo en render/diagnóstico pesado
  if (analyser) out.connect(analyser);

  // Techno Rumble: el kick alimenta un sub sostenido (paso-bajo → reverb larga)
  // = el retumbe grave del techno oscuro. Un solo control (fxGlobal.rumble).
  const rumbleSend = own(new Tone.Gain(fxGlobal.rumble || 0));
  const rumbleFilter = own(new Tone.Filter(120, "lowpass"));
  const rumbleOut = liveMode
    ? own(new Tone.Gain(0.45)).connect(master)
    : own(new Tone.Freeverb({ roomSize: 0.92, dampening: 1200 })).connect(master);
  if (!liveMode) rumbleOut.wet.value = 1;
  rumbleSend.connect(rumbleFilter); rumbleFilter.connect(rumbleOut);
  fx.kick.scGain.connect(rumbleSend);

  // Pista de Vocal/Sample: loop sincronizado (playbackRate ajusta a N compases)
  let vocalPlayer = null, vocalChannel = null;
  if (vocalBuffer && vocalBuffer.loaded) {
    const barSec = (60 / bpm()) * 4;
    vocalChannel = own(new Tone.Channel({ volume: vocal.vol || 0 }));
    vocalChannel.mute = opts.flatMix ? false : !!vocal.mute;
    vocalChannel.connect(master);
    vocalPlayer = own(new Tone.Player({ url: vocalBuffer, loop: true }));
    vocalPlayer.playbackRate = Math.max(0.05, vocalBuffer.duration / ((vocal.bars || 4) * barSec));
    vocalPlayer.connect(vocalChannel);
  }

  // Sampler: si una pista de batería tiene sample cargado, su reproductor
  // sustituye a la síntesis (suena el audio real en vez del sintetizado).
  const players = {};
  for (const id of SAMPLEABLE) {
    if (sampleBuffers[id] && sampleBuffers[id].loaded) {
      players[id] = own(new Tone.Player(sampleBuffers[id])).connect(ch[id]);
    }
  }

  const kick = own(new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 6, oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.02 },
  })).connect(ch.kick);

  const clapFilter = own(new Tone.Filter(1400, "bandpass")).connect(ch.clap);
  const clap = own(new Tone.NoiseSynth({
    noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.18, sustain: 0 },
  })).connect(clapFilter);

  const chatFilter = own(new Tone.Filter(8000, "highpass")).connect(ch.chat);
  const chat = own(new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -8, envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  })).connect(chatFilter);

  const ohatFilter = own(new Tone.Filter(7000, "highpass")).connect(ch.ohat);
  const ohat = own(new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -10, envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
  })).connect(ohatFilter);

  // Bajo: sinte sustractivo editable + SLIDE (portamento) = carácter Acid 303
  const bs = synth.bass;
  const bass = own(new Tone.MonoSynth({
    oscillator: bs.wave === "fatsawtooth" ? { type: "fatsawtooth", count: 3, spread: 40 } : { type: bs.wave },
    volume: -6, filter: { type: "lowpass", Q: bs.res },
    filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.1, baseFrequency: bs.cutoff, octaves: 2.6 },
    envelope: { attack: bs.attack, decay: bs.decay, sustain: bs.sustain, release: bs.release },
  })).connect(ch.bass);
  bass.portamento = bs.slide || 0; // glide entre notas (acid)
  bass.detune.value = (Math.random() * 6) - 3; // ligero drift analógico (±3 cents)

  // Acordes: sinte editable (synth.stab) + reverb. Motor Saw o FM (stabs metálicos)
  const st = synth.stab;
  const stabVerb = liveMode
    ? own(new Tone.Gain(1)).connect(ch.stab)
    : own(new Tone.Freeverb({ roomSize: 0.62, dampening: 3000 })).connect(ch.stab);
  if (!liveMode) stabVerb.wet.value = 0.28;
  const stabFilter = own(new Tone.Filter(st.cutoff, "lowpass")).connect(stabVerb);
  stabFilter.Q.value = st.res;
  let stab;
  if (st.engine === "fm") {
    stab = own(new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2, modulationIndex: st.fm != null ? st.fm : 8, volume: -16,
      oscillator: { type: "sine" }, modulation: { type: "square" },
      envelope: { attack: st.attack, decay: st.decay, sustain: st.sustain, release: st.release },
      modulationEnvelope: { attack: 0.005, decay: 0.18, sustain: 0.2, release: 0.2 },
    })).connect(stabFilter);
  } else if (st.engine === "pad") {
    stab = own(new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 3, spread: 25 }, volume: -16,
      envelope: { attack: 0.4, decay: 0.4, sustain: 0.7, release: 1.2 }, // pad sostenido
    })).connect(stabFilter);
  } else if (st.engine === "pluck") {
    stab = own(new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" }, volume: -12,
      envelope: { attack: 0.002, decay: 0.16, sustain: 0, release: 0.1 }, // plucky
    })).connect(stabFilter);
  } else {
    stab = own(new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: st.wave === "fatsawtooth" ? "fatsawtooth" : st.wave }, volume: -14,
      envelope: { attack: st.attack, decay: st.decay, sustain: st.sustain, release: st.release },
    })).connect(stabFilter);
  }

  // FX (no pasan por el pump): riser e impacto
  const riserFilter = own(new Tone.Filter(300, "highpass")).connect(master);
  const riserNoise = own(new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -14, envelope: { attack: 0.01, decay: 0.01, sustain: 1, release: 0.06 },
  })).connect(riserFilter);

  const impactFilter = own(new Tone.Filter(2500, "highpass")).connect(master);
  const impact = own(new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -6, envelope: { attack: 0.001, decay: 1.1, sustain: 0, release: 0.1 },
  })).connect(impactFilter);

  // Downlifter: barrido descendente para soltar tensión al salir de un drop
  const downFilter = own(new Tone.Filter(9000, "lowpass")).connect(master);
  const downNoise = own(new Tone.NoiseSynth({
    noise: { type: "pink" }, volume: -16, envelope: { attack: 0.01, decay: 0.01, sustain: 1, release: 0.06 },
  })).connect(downFilter);

  const midi = (m) => Tone.Frequency(m, "midi").toFrequency();

  return {
    ch,          // tiras de canal del mezclador (para ajustes en vivo)
    fx,          // rack de FX por canal (drive/sidechain/envíos)
    rumbleSend,  // envío al sub-rumble (techno)
    vocalPlayer, // reproductor de la pista de vocal/loop
    vocalChannel, // canal de la vocal (mute por tramo)
    masterGainNode, // ganancia de máster (mastering/LUFS)
    masterLfo,   // LFO del auto-filtro de máster
    analyser,    // analizador de espectro (FFT) de la salida
    meters,      // medidores de nivel por pista
    masterMeter, // medidor de la salida (post-máster)
    nodes,       // nodos creados en este grafo para liberarlos al reconstruir
    out,         // nodo final (para desconectar al destruir el grafo)
    bassSynth: bass, stabSynth: stab, stabFilter, // sintes (para ajuste en vivo)
    kick: (t) => players.kick ? players.kick.start(t) : kick.triggerAttackRelease("C1", "8n", t),
    clap: (t) => {
      if (players.clap) return players.clap.start(t);
      clap.triggerAttackRelease("16n", t, 0.9);        // dos golpes = clap con cuerpo
      clap.triggerAttackRelease("32n", t + 0.012, 0.6);
    },
    chat: (t, v = 1) => players.chat ? players.chat.start(t) : chat.triggerAttackRelease("32n", t, v),
    ohat: (t) => players.ohat ? players.ohat.start(t) : ohat.triggerAttackRelease("16n", t, 0.9),
    bass: (t, m) => bass.triggerAttackRelease(midi(m), "16n", t),
    stab: (t, arr) => stab.triggerAttackRelease(arr.map(midi), "8n", t),
    // Sidechain: en cada kick, baja el volumen de los canales con SC>0 y lo
    // recupera en ~0.18s (el "bombeo" clásico del techno).
    sidechain: (t) => {
      for (const tr of TRACKS) {
        const amt = mixOf(tr.id).sidechain || 0;
        if (amt <= 0) continue;
        const g = fx[tr.id].scGain.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(1 - amt, t);
        g.linearRampToValueAtTime(1, t + 0.18);
      }
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
  if (!v) return; // seguridad: voces aún no reconstruidas
  const stepDur = (60 / bpm()) / 4;
  const jAmt = humanizeAmt();                       // 0..1
  const jit = () => jAmt ? (rnd() - 0.5) * jAmt * 0.02 : 0; // ±10ms máx
  // Aplica probabilidad (saltar) y ratchet (multi-disparo) del paso a una voz
  const play = (id, fn) => {
    const m = p.mods && p.mods[id] ? p.mods[id][s] : null;
    if (m && m.p != null && m.p < 1 && rnd() > m.p) return; // probabilidad
    const r = m && m.r > 1 ? m.r : 1;
    if (r === 1) { fn(time + jit()); return; }
    const sub = stepDur / r;
    for (let i = 0; i < r; i++) fn(time + i * sub + jit());  // ratchet
  };

  if (p.kick[s] && inc("kick")) play("kick", (t) => v.kick(t));
  if (p.kick[s]) v.sidechain(time);
  if (p.clap[s] && inc("clap")) play("clap", (t) => v.clap(t));
  if (p.chat[s] && inc("chat")) play("chat", (t) => v.chat(t, clamp((s % 4 === 0 ? 0.95 : 0.6) + rnd() * 0.1, 0, 1)));
  if (p.ohat[s] && inc("ohat")) play("ohat", (t) => v.ohat(t));
  if (p.bass[s] != null && inc("bass")) play("bass", (t) => v.bass(t, p.bass[s]));
  if (p.stab[s] != null && inc("stab")) play("stab", (t) => v.stab(t, p.stab[s]));
}

// ----------------------------------------------------------------------------
// Reproducción en vivo
// ----------------------------------------------------------------------------
// Crea la secuencia. La fuente se lee DINÁMICAMENTE en cada paso, así que editar,
// cambiar de tramo o de modo se oye al instante sin reiniciar.
function buildSequence() {
  clearSequence();
  const songMode = mode === "song";
  if (songMode && !built) built = buildSong();
  const initialSrc = (songMode ? built.song : pattern);
  const len = Math.max(1, initialSrc.kick.length);
  const fxMap = {};
  if (songMode && built) built.fx.forEach((e) => (fxMap[e.step] = e.type));
  const barSec = (60 / bpm()) * 4;
  let step = 0;

  seq = Tone.Transport.scheduleRepeat((time) => {
    const src = (mode === "song") ? (built ? built.song : pattern) : pattern;
    const total = Math.max(1, src.kick.length || len);
    const g = step % total;
    playbackStep = g;
    if (g < src.kick.length) triggerStep(live, src, g, time);
    if (fxMap[g] === "riser") live.riser(time, barSec);
    if (fxMap[g] === "downlifter") live.downlifter(time, barSec);
    if (fxMap[g] === "impact") live.impact(time);
    step = (g + 1) % total;
  }, "16n", 0);
}

// Rehace la secuencia en vivo si cambia su longitud (añadir/borrar tramo, modo)
function resync() { if (Tone.Transport.state === "started") buildSequence(); }

async function play() {
  await Tone.start();
  if (Tone.context && Tone.context.resume && Tone.context.state !== "running") await Tone.context.resume();
  Tone.Transport.stop();
  Tone.Transport.position = 0;
  Tone.Transport.bpm.value = bpm();
  Tone.Transport.swing = swingAmt();
  Tone.Transport.swingSubdivision = "16n";
  if (!live) live = buildVoices();
  buildSequence();
  playbackStep = 0;
  if (live.vocalPlayer && !live._vocalSynced) { live.vocalPlayer.sync().start(0); live._vocalSynced = true; }
  Tone.Transport.start("+0.03");
  startPlaybackWatchdog();
  $("playBtn").classList.add("playing");
  $("playBtn").textContent = "⏸ Stop";
  setStatus(mode === "song" ? "Reproduciendo el track completo 🔊" : "Reproduciendo el bucle 🔊");
}

function stop() {
  Tone.Transport.stop();
  stopPlaybackWatchdog();
  clearSequence();
  playbackStep = -1;
  $("playBtn").classList.remove("playing");
  $("playBtn").textContent = "▶ Play";
  highlight(-1);
  currentSectionIdx = -1;
  document.querySelectorAll("#tramos .tramo.playing").forEach((el) => el.classList.remove("playing"));
  const pos = $("position"); if (pos) pos.textContent = "1:1:1";
  setStatus("Parado. Pulsa <b>Play</b> para seguir.");
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
  const totalBars = tramoBars.reduce((a, b) => a + b, 0);
  setStatus(mode === "song"
    ? `Modo <b>Track</b>: ${patterns.length} tramo(s), ${totalBars} compases en total.`
    : "Modo <b>Bucle</b>: se repite el tramo activo.");
  if (wasPlaying) play();
  markDirty();
}

// ----------------------------------------------------------------------------
// Exportación
// ----------------------------------------------------------------------------
function repeatPattern(p, n) {
  const out = { kick: [], clap: [], chat: [], ohat: [], bass: [], stab: [] };
  const outMods = {}; for (const k of NOTE_KEYS) outMods[k] = [];
  for (let i = 0; i < n; i++)
    for (const k of NOTE_KEYS) {
      out[k] = out[k].concat(p[k]);
      outMods[k] = outMods[k].concat(p.mods && p.mods[k] ? p.mods[k] : arr16(null));
    }
  out.mods = outMods;
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
    const v = buildVoices({ ...(opts || {}), offline: true });
    if (v.vocalPlayer && !opts.flatMix) v.vocalPlayer.start(0); // vocal en el export
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
  const totalBars = mode === "song" ? tramoBars.reduce((a, b) => a + b, 0) : 4;
  showProgress(`Renderizando WAV (${totalBars} comp.)…`);
  setStatus(`Renderizando WAV (${totalBars} compases)…`);
  await new Promise((r) => setTimeout(r, 40)); // deja pintar el overlay antes del render
  try {
    const songData = activeSong();
    const p = songData ? songData.song : repeatPattern(pattern, 4);
    const fx = songData ? songData.fx : null;
    const buffer = await renderOffline(p, fx, () => true, {});
    TechnoMidi.download(encodeWav(buffer.get()), `technoforge-${mode}-${bpm()}bpm.wav`, "audio/wav");
    setStatus("WAV exportado ✔");
  } finally { hideProgress(); }
}

// Exporta cada instrumento como su propio WAV (en crudo, sin máster) dentro de
// un único .zip — listo para arrastrar a Ableton/FL/Bitwig y rematar la mezcla.
async function exportStems() {
  showProgress("Renderizando stems…");
  await new Promise((r) => setTimeout(r, 40));
  try {
    const songData = activeSong();
    const p = songData ? songData.song : repeatPattern(pattern, 4);
    const fx = songData ? songData.fx : null;
    const files = [];
    const n = () => String(files.length + 1).padStart(2, "0");

    for (const t of TRACKS) {
      showProgress(`Stem ${t.name}… (${files.length + 1}/${TRACKS.length})`);
      const buf = await renderOffline(p, null, (id) => id === t.id, { bypassMaster: true, flatMix: true });
      files.push({ name: `${n()}-${t.id}.wav`, data: encodeWav(buf.get()) });
      await new Promise((r) => setTimeout(r, 10));
    }
    if (fx && fx.length) {
      const buf = await renderOffline(p, fx, () => false, { bypassMaster: true, flatMix: true });
      files.push({ name: `${n()}-fx.wav`, data: encodeWav(buf.get()) });
    }
    const manifest = {
      app: "TechnoForge",
      version: PROJECT_VERSION,
      name: projectName,
      bpm: bpm(),
      preset: $("preset") ? $("preset").value : "",
      style: styleId(),
      emotion: emotionId(),
      scale: scaleId(),
      mode,
      proMacros,
      referenceDna,
      sections: patterns.map((_, i) => ({ name: `Tramo ${i + 1}`, bars: tramoBarsOf(i), transition: tramoFxOf(i) })),
      mix,
      note: "Stems crudos sin cadena de master para mezclar/masterizar en DAW.",
    };
    files.push({ name: `${n()}-manifest.json`, data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
    const zip = TechnoZip.create(files);
    TechnoMidi.download(zip, `technoforge-stems-${mode}-${bpm()}bpm.zip`, "application/zip");
    setStatus(`Stems exportados ✔ (${files.length} pistas) — descomprime y arrástralas a tu DAW.`);
  } finally { hideProgress(); }
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
    head.innerHTML = `<span class="track-id" title="${t.name} — ${t.role}"><span class="name">${t.name}</span><span class="role">${t.role}</span></span>`;
    const r = document.createElement("button");
    r.className = "mini"; r.textContent = "🎲"; r.title = "Regenerar esta pista";
    r.onclick = () => regenTrack(t.id);
    const iso = document.createElement("button");
    iso.className = "mini"; iso.textContent = "🎧"; iso.title = "Mantén pulsado para escuchar SOLO esta pista (aislar capa)";
    iso.onpointerdown = (e) => { e.preventDefault(); isolateStart(t.id); };
    iso.onpointerup = isolateEnd; iso.onpointerleave = isolateEnd; iso.onpointercancel = isolateEnd;
    head.append(r, iso);

    // Sampler: cargar/quitar un audio real (solo pistas de batería)
    if (SAMPLEABLE.includes(t.id)) {
      const samp = document.createElement("button");
      const loaded = samples[t.id];
      samp.className = "mini sample-btn" + (loaded ? " loaded" : "");
      samp.textContent = loaded ? "🎵" : "＋🎵";
      samp.title = loaded ? `Sample: ${loaded.name} (clic para cambiar)` : "Cargar un sample (.wav/.mp3) — reemplaza la síntesis";
      samp.onclick = () => { sampleTarget = t.id; $("sampleInput").click(); };
      head.append(samp);
      const lib = document.createElement("button");
      lib.className = "mini"; lib.textContent = "📚"; lib.title = "Cargar un sonido del kit de fábrica (clic para cambiar)";
      lib.onclick = () => loadFactory(t.id);
      head.append(lib);
      if (loaded) {
        const x = document.createElement("button");
        x.className = "mini"; x.textContent = "✕"; x.title = "Quitar sample (volver a síntesis)";
        x.onclick = () => clearSample(t.id);
        head.append(x);
      }
    }

    const steps = document.createElement("div");
    steps.className = "steps";
    for (let s = 0; s < STEPS; s++) {
      const cell = document.createElement("div");
      const on = t.type === "drum" ? pattern[t.id][s] : pattern[t.id][s] != null;
      const mod = on && pattern.mods[t.id] ? pattern.mods[t.id][s] : null;
      cell.className = "step" + (s % 4 === 0 ? " beat" : "") + (on ? " on" : "")
                       + (on && t.type === "pitch" ? " note" : "");
      cell.dataset.track = t.id; cell.dataset.step = s;
      // Indicadores de probabilidad (opacidad + %) y ratchet (nº de golpes)
      if (mod && mod.p != null && mod.p < 1) {
        cell.style.opacity = (0.4 + mod.p * 0.6).toFixed(2);
        const b = document.createElement("span"); b.className = "cell-prob"; b.textContent = Math.round(mod.p * 100); cell.appendChild(b);
      }
      if (mod && mod.r > 1) {
        const b = document.createElement("span"); b.className = "cell-ratchet"; b.textContent = "×" + mod.r; cell.appendChild(b);
      }
      cell.onclick = () => toggleCell(t, s);
      steps.appendChild(cell);
    }
    row.append(head, steps);
    grid.appendChild(row);
  }
  renderMixer();
  renderTramos();
  renderPiano();
}

// --- Mezclador (zona propia, con channel strips estilo estudio) ---
function fmtDb(v) { return (v > 0 ? "+" : "") + v + " dB"; }


// Slider con etiqueta y VALOR numérico (preciso y fácil en desktop)
function ctlSlider(label, value, min, max, step, onChange, fmt) {
  fmt = fmt || ((v) => v);
  const row = document.createElement("div"); row.className = "ctl";
  const top = document.createElement("div"); top.className = "ctl-top";
  const lab = document.createElement("span"); lab.className = "ctl-lab"; lab.textContent = label;
  const val = document.createElement("span"); val.className = "ctl-val"; val.textContent = fmt(value);
  top.append(lab, val);
  const inp = document.createElement("input"); inp.type = "range"; inp.min = min; inp.max = max; inp.step = step; inp.value = value;
  inp.oninput = () => { const v = parseFloat(inp.value); val.textContent = fmt(v); onChange(v); };
  row.append(top, inp);
  return row;
}
const fmtPct = (v) => Math.round(v * 100) + "%";
const fmtDb2 = (v) => (v > 0 ? "+" : "") + v + " dB";

// Tira de canal COMPACTA (fader/meter/pan/S/M). Clic en el nombre = seleccionar
// para editar sus efectos en el panel "Efectos del canal" (menos saturación).
function channelStrip(id, name, m, solo) {
  const strip = document.createElement("div");
  strip.className = "strip" + (id === selectedChannel ? " selected" : "");

  const nm = document.createElement("div"); nm.className = "strip-name"; nm.textContent = name;
  nm.title = "Clic para editar sus efectos abajo"; nm.style.cursor = "pointer";
  nm.onclick = () => selectChannel(id);

  const body = document.createElement("div"); body.className = "strip-body";
  const meter = document.createElement("div"); meter.className = "meter";
  const fill = document.createElement("div"); fill.className = "meter-fill"; fill.id = "meter-" + id;
  meter.appendChild(fill);
  const vol = document.createElement("input");
  vol.type = "range"; vol.className = "strip-vol";
  vol.min = "-36"; vol.max = "6"; vol.step = "1"; vol.value = m.vol; vol.title = "Volumen";
  const dbOut = document.createElement("div"); dbOut.className = "strip-db"; dbOut.id = "vol-" + id; dbOut.textContent = fmtDb(m.vol);
  vol.oninput = () => { setVol(id, parseFloat(vol.value)); dbOut.textContent = fmtDb(parseFloat(vol.value)); };
  body.append(meter, vol);

  const pan = document.createElement("input");
  pan.type = "range"; pan.className = "strip-pan";
  pan.min = "-1"; pan.max = "1"; pan.step = "0.1"; pan.value = m.pan; pan.title = "Paneo (L/R)";
  pan.oninput = () => setPan(id, parseFloat(pan.value));
  const panLbl = document.createElement("div"); panLbl.className = "strip-lbl"; panLbl.textContent = "PAN";

  const btns = document.createElement("div"); btns.className = "strip-btns";
  const s = document.createElement("button"); s.className = "mini" + (m.solo ? " solo" : ""); s.textContent = "S"; s.title = "Solo"; s.onclick = () => toggleSolo(id);
  const mu = document.createElement("button"); mu.className = "mini" + ((m.mute || (solo && !m.solo)) ? " muted" : ""); mu.textContent = "M"; mu.title = "Silenciar"; mu.onclick = () => toggleMute(id);
  btns.append(s, mu);

  strip.append(nm, body, dbOut, pan, panLbl, btns);
  return strip;
}

function selectChannel(id) { selectedChannel = id; renderMixer(); }

// Panel de efectos del canal seleccionado: sliders precisos con su valor
function renderChannelFx() {
  const el = $("chanfx"); if (!el) return;
  el.innerHTML = "";
  const id = selectedChannel, t = TRACKS.find((x) => x.id === id), m = mixOf(id);
  const head = document.createElement("div"); head.className = "chanfx-head"; head.innerHTML = `Efectos · <b>${t ? t.name : id}</b>`;
  const grid = document.createElement("div"); grid.className = "chanfx-grid";
  const add = (key, label, mn, mx, st, fmt) => grid.appendChild(ctlSlider(label, m[key], mn, mx, st, (v) => { m[key] = v; applyFx(id); }, fmt));
  add("low", "EQ Graves", -12, 12, 1, fmtDb2); add("mid", "EQ Medios", -12, 12, 1, fmtDb2); add("high", "EQ Agudos", -12, 12, 1, fmtDb2);
  add("comp", "Compresor", 0, 1, 0.05, fmtPct); add("drive", "Saturación", 0, 1, 0.05, fmtPct); add("crush", "Bitcrush", 0, 1, 0.05, fmtPct);
  add("width", "Ancho estéreo", 0, 1, 0.05, fmtPct); add("sidechain", "Sidechain", 0, 1, 0.05, fmtPct);
  add("rev", "Reverb (envío)", 0, 1, 0.05, fmtPct); add("delay", "Delay (envío)", 0, 1, 0.05, fmtPct);
  el.append(head, grid);
}

function renderMixer() {
  const mx = $("mixer"); if (!mx) return;
  mx.innerHTML = "";
  const solo = anySolo();
  for (const t of TRACKS) mx.appendChild(channelStrip(t.id, t.name, mixOf(t.id), solo));
  // Strip de máster: medidor de salida + lectura LUFS + ganancia + normalizar
  const master = document.createElement("div");
  master.className = "strip strip-master";
  const nm = document.createElement("div"); nm.className = "strip-name"; nm.textContent = "MÁSTER";
  const body = document.createElement("div"); body.className = "strip-body";
  const meter = document.createElement("div"); meter.className = "meter meter-wide";
  const fill = document.createElement("div"); fill.className = "meter-fill"; fill.id = "meter-master";
  meter.appendChild(fill); body.appendChild(meter);

  const lufs = document.createElement("div"); lufs.className = "strip-db"; lufs.id = "lufs-read";
  lufs.textContent = lastLufs != null
    ? `${lastLufs.toFixed(1)} LUFS${lastPeakDb != null ? " / " + lastPeakDb.toFixed(1) + " dB" : ""}`
    : "– LUFS";

  const gain = document.createElement("input");
  gain.type = "range"; gain.className = "strip-pan"; gain.min = "-24"; gain.max = "24"; gain.step = "0.5";
  gain.value = fxGlobal.masterGain; gain.title = "Ganancia de máster (dB)";
  gain.oninput = () => { fxGlobal.masterGain = parseFloat(gain.value); applyMasterGain(); };
  const gainLbl = document.createElement("div"); gainLbl.className = "strip-lbl"; gainLbl.textContent = "GAIN";

  const tgt = document.createElement("select"); tgt.className = "master-target";
  [["-7", "-7 club fuerte"], ["-9", "-9 club"], ["-14", "-14 streaming"]].forEach(([v, t]) => {
    const o = document.createElement("option"); o.value = v; o.textContent = t; if (+v === fxGlobal.lufsTarget) o.selected = true; tgt.appendChild(o);
  });
  tgt.title = "Objetivo de loudness";
  tgt.onchange = () => { fxGlobal.lufsTarget = parseInt(tgt.value, 10); markDirty(); };

  const btns = document.createElement("div"); btns.className = "strip-btns";
  const meas = document.createElement("button"); meas.className = "mini"; meas.textContent = "Medir";
  meas.title = "Mide el loudness integrado (LUFS) sin cambiar nada"; meas.onclick = () => measureNow();
  const norm = document.createElement("button"); norm.className = "mini"; norm.textContent = "Normaliz.";
  norm.title = "Mide el loudness y ajusta la ganancia al objetivo"; norm.onclick = () => normalizeLoudness();
  btns.append(meas, norm);

  master.append(nm, body, lufs, gain, gainLbl, tgt, btns);
  mx.appendChild(master);
  renderChannelFx(); // panel de FX del canal seleccionado
}

// Medidores: animación continua; solo se mueven con audio sonando
function setMeterBar(elId, db) {
  const el = document.getElementById(elId); if (!el) return;
  let v = typeof db === "number" ? db : (Array.isArray(db) ? db[0] : -Infinity);
  if (!isFinite(v)) v = -60;
  el.style.height = Math.max(0, Math.min(1, (v + 60) / 60)) * 100 + "%";
}
// Analizador de espectro (FFT) — dibuja barras de frecuencia de la salida
let lastSpectrumDraw = 0;
function drawSpectrum(now = 0) {
  requestAnimationFrame(drawSpectrum);
  if (now - lastSpectrumDraw < 300) return; // visual auxiliar, no debe competir con audio
  lastSpectrumDraw = now;
  const cv = document.getElementById("spectrum"); if (!cv) return;
  const ctx = cv.getContext("2d"); const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const playing = window.Tone && Tone.Transport && Tone.Transport.state === "started";
  if (!playing || !live || !live.analyser) return;
  const data = live.analyser.getValue(); // dB, normalmente -100..0
  const n = data.length, bw = W / n;
  for (let i = 0; i < n; i++) {
    const db = typeof data[i] === "number" ? data[i] : -100;
    const h = Math.max(0, Math.min(1, (db + 90) / 90)) * H;
    const hue = 350 - (i / n) * 200; // rojo (graves) → verde-azul (agudos)
    ctx.fillStyle = `hsl(${hue} 80% 58%)`;
    ctx.fillRect(i * bw, H - h, Math.max(1, bw - 1), h);
  }
}

let lastMeterDraw = 0;
function meterLoop(now = 0) {
  requestAnimationFrame(meterLoop);
  if (now - lastMeterDraw < 250) return; // medidores a 4 fps: estable en sesiones largas
  lastMeterDraw = now;
  if (!live || !live.meters) return;
  const playing = window.Tone && Tone.Transport && Tone.Transport.state === "started";
  for (const t of TRACKS) setMeterBar("meter-" + t.id, playing ? live.meters[t.id].getValue() : -Infinity);
  setMeterBar("meter-master", playing && live.masterMeter ? live.masterMeter.getValue() : -Infinity);
}

let lastLiveUiDraw = 0;
function liveUiLoop(now = 0) {
  requestAnimationFrame(liveUiLoop);
  if (!window.Tone || !Tone.Transport || Tone.Transport.state !== "started" || playbackStep < 0) return;
  if (now - lastLiveUiDraw < 180) return;
  lastLiveUiDraw = now;
  const g = playbackStep;
  highlight(g % STEPS);
  highlightSection(g);
  updatePosition(g);
}

// --- Sintetizadores editables (zona Instrumentos): onda + filtro + ADSR ---
function applySynth(id) {
  if (live) {
    if (id === "bass" && live.bassSynth) {
      const b = synth.bass;
      live.bassSynth.set({
        oscillator: { type: b.wave === "fatsawtooth" ? "fatsawtooth" : b.wave },
        filterEnvelope: { baseFrequency: b.cutoff },
        envelope: { attack: b.attack, decay: b.decay, sustain: b.sustain, release: b.release },
      });
      if (live.bassSynth.filter) live.bassSynth.filter.Q.value = b.res;
      live.bassSynth.portamento = b.slide || 0; // slide acid
    }
    if (id === "stab" && live.stabSynth) {
      const s = synth.stab;
      live.stabSynth.set({ envelope: { attack: s.attack, decay: s.decay, sustain: s.sustain, release: s.release } });
      if (s.engine === "fm") live.stabSynth.set({ modulationIndex: s.fm });
      else live.stabSynth.set({ oscillator: { type: s.wave === "fatsawtooth" ? "fatsawtooth" : s.wave } });
      if (live.stabFilter) { live.stabFilter.frequency.value = s.cutoff; live.stabFilter.Q.value = s.res; }
    }
  }
  markDirty();
}

const WAVE_LABELS = { sawtooth: "Sierra", square: "Cuadrada", triangle: "Triángulo", sine: "Seno", fatsawtooth: "Súper-sierra" };
const SYNTH_RANGES = {
  bass: { cutoff: [40, 1000, 10], res: [0, 12, 0.5], attack: [0, 0.5, 0.005], decay: [0, 1, 0.01], sustain: [0, 1, 0.05], release: [0, 1, 0.01] },
  stab: { cutoff: [200, 12000, 100], res: [0, 12, 0.5], attack: [0, 0.5, 0.005], decay: [0, 1, 0.01], sustain: [0, 1, 0.05], release: [0, 1, 0.01] },
};
const PARAM_LABELS = { cutoff: "Filtro", res: "Reso", attack: "Atq", decay: "Dec", sustain: "Sus", release: "Rel" };

function instrumentPanel(id, label) {
  const p = synth[id];
  const panel = document.createElement("div"); panel.className = "instr";
  const h = document.createElement("div"); h.className = "instr-name"; h.textContent = label;
  panel.appendChild(h);

  const mkSelect = (labelTxt, options, value, onpick) => {
    const ctl = document.createElement("label"); ctl.className = "instr-ctl";
    const sp = document.createElement("span"); sp.textContent = labelTxt;
    const sel = document.createElement("select");
    options.forEach(([val, txt]) => { const o = document.createElement("option"); o.value = val; o.textContent = txt; if (val === value) o.selected = true; sel.appendChild(o); });
    sel.onchange = () => onpick(sel.value);
    ctl.append(sp, sel); panel.appendChild(ctl);
  };
  const knobs = document.createElement("div"); knobs.className = "instr-knobs";
  const fmtFor = (key) => key === "cutoff" ? (v) => Math.round(v) + " Hz" : key === "res" ? (v) => v : key === "fm" ? (v) => v : (v) => v + " s";
  const mkSlider = (key, labelTxt, mn, mx, st) => {
    knobs.appendChild(ctlSlider(labelTxt, p[key], mn, mx, st, (v) => { p[key] = v; applySynth(id); }, fmtFor(key)));
  };

  // Motor del stab: Saw o FM (cambia el tipo de voz → reconstruye al reproducir)
  if (id === "stab") {
    mkSelect("Motor", [["saw", "Saw"], ["fm", "FM"], ["pad", "Pad"], ["pluck", "Pluck"]], p.engine, (v) => {
      p.engine = v; renderInstruments(); invalidateVoices();
      const n = { saw: "Saw", fm: "FM (metálico)", pad: "Pad (sostenido)", pluck: "Pluck" };
      setStatus(`Acordes en <b>${n[v]}</b>.`);
    });
  }
  // Onda: solo donde aplica (en acordes solo el motor Saw la usa)
  if (!(id === "stab" && p.engine !== "saw")) {
    mkSelect("Onda", Object.keys(WAVE_LABELS).map((w) => [w, WAVE_LABELS[w]]), p.wave, (v) => { p.wave = v; applySynth(id); });
  }

  for (const key of ["cutoff", "res", "attack", "decay", "sustain", "release"]) {
    const [mn, mx, st] = SYNTH_RANGES[id][key];
    mkSlider(key, PARAM_LABELS[key], mn, mx, st);
  }

  if (id === "bass") mkSlider("slide", "Slide", 0, 0.15, 0.005);          // glide acid 303
  if (id === "stab" && p.engine === "fm") mkSlider("fm", "FM", 0, 20, 0.5); // brillo FM

  panel.appendChild(knobs);
  return panel;
}

function renderInstruments() {
  const el = $("instruments"); if (!el) return;
  el.innerHTML = "";
  el.appendChild(instrumentPanel("bass", "Bajo"));
  el.appendChild(instrumentPanel("stab", "Acordes"));
}

function stepIsOn(t, s) {
  return t.type === "drum" ? pattern[t.id][s] : pattern[t.id][s] != null;
}

function toggleCell(t, s) {
  if (editMode === "prob" || editMode === "ratchet") {
    if (!stepIsOn(t, s)) return; // los modificadores solo aplican a pasos activos
    const cur = pattern.mods[t.id][s] || { p: 1, r: 1 };
    if (editMode === "prob") {
      const next = { 1: 0.75, 0.75: 0.5, 0.5: 0.25, 0.25: 1 };
      cur.p = next[cur.p] != null ? next[cur.p] : 0.75;
    } else {
      cur.r = cur.r >= 4 ? 1 : cur.r + 1;
    }
    pattern.mods[t.id][s] = (cur.p === 1 && cur.r === 1) ? null : cur;
  } else {
    if (t.type === "drum") pattern[t.id][s] = !pattern[t.id][s];
    else if (t.id === "bass") pattern.bass[s] = pattern.bass[s] == null ? bassNoteAt(s) : null;
    else pattern.stab[s] = pattern.stab[s] == null ? chordAt(progAt(s), 48, wantSeventh()) : null;
    if (!stepIsOn(t, s)) pattern.mods[t.id][s] = null; // al apagar, limpia su mod
  }
  syncTramo();
  built = null;
  refreshSong();
  renderGrid();
  markDirty();
}

function setEditMode(m) {
  editMode = m;
  document.querySelectorAll("#editmode .seg").forEach((el) => el.classList.toggle("active", el.dataset.mode === m));
  renderGrid();
  setStatus(m === "notes" ? "Modo <b>Notas</b>: toca celdas para activar/desactivar."
    : m === "prob" ? "Modo <b>Probabilidad</b>: toca un paso activo para variar su % (100→75→50→25)."
    : "Modo <b>Ratchet</b>: toca un paso activo para multiplicar el golpe (x1→x2→x3→x4).");
}

// --- Piano roll del Bajo: melodías libres (cualquier nota por paso) ---
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function noteName(m) { return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
function renderPiano() {
  const el = $("piano"); if (!el || el.style.display === "none") return; // solo si la zona está abierta
  el.innerHTML = "";
  const sc = SCALES[scaleId()];
  const root = 24 + rootPc();          // ~C1
  const lo = root, hi = root + 19;     // ~1.5 octavas
  for (let midi = hi; midi >= lo; midi--) {
    const inScale = sc.includes((((midi - root) % 12) + 12) % 12);
    const row = document.createElement("div"); row.className = "pr-row" + (inScale ? "" : " pr-off");
    const key = document.createElement("div"); key.className = "pr-key"; key.textContent = noteName(midi);
    const steps = document.createElement("div"); steps.className = "pr-steps";
    for (let s = 0; s < STEPS; s++) {
      const cell = document.createElement("div");
      const on = pattern.bass[s] === midi;
      cell.className = "pr-cell" + (s % 4 === 0 ? " beat" : "") + (on ? " on" : "");
      cell.onclick = () => {
        pattern.bass[s] = (pattern.bass[s] === midi) ? null : midi;
        syncTramo(); built = null; refreshSong(); renderPiano(); renderGrid(); markDirty();
      };
      steps.appendChild(cell);
    }
    row.append(key, steps); el.appendChild(row);
  }
}

function renderTimeline() {
  const tl = $("timeline");
  tl.innerHTML = "";
  if (!(mode === "song" && built)) return;
  currentSectionIdx = -1;
  built.sections.forEach((s, i) => {
    const d = document.createElement("div");
    d.className = "sec"; d.dataset.idx = i; d.style.flexGrow = s.bars;
    d.innerHTML = `${s.name}<span class="bars">${s.bars} comp.</span>`;
    tl.appendChild(d);
  });
  const ph = document.createElement("div"); ph.className = "tl-playhead"; ph.id = "tl-playhead"; ph.style.left = "0%";
  tl.appendChild(ph);
}

function renderAutomation() {
  const lane = $("automation"); if (!lane) return;
  lane.innerHTML = "";
  if (!(mode === "song" && built && built.sections && built.sections.length)) return;
  lane.style.setProperty("--auto-count", built.sections.length);
  const total = built.sections.length - 1 || 1;
  built.sections.forEach((s, i) => {
    const tension = clamp((proMacros.tension * 0.55) + (i === 1 || i === 3 ? 0.22 : 0) + (i === 2 || i === 4 ? 0.34 : 0) - (i === 5 ? 0.18 : 0), 0.05, 1);
    const groove = clamp(proMacros.groove + (i === 2 || i === 4 ? 0.08 : 0) - (i === 3 ? 0.12 : 0), 0, 1);
    const seg = document.createElement("div");
    seg.className = "auto-seg";
    seg.style.flexGrow = s.bars;
    seg.style.setProperty("--tension", tension.toFixed(2));
    const nm = document.createElement("span"); nm.className = "auto-name"; nm.textContent = s.name;
    const meta = document.createElement("span"); meta.className = "auto-meta";
    const fx = tramoFxOf(i);
    meta.textContent = `T ${Math.round(tension * 100)} · G ${Math.round(groove * 100)} · ${fx === "none" ? "dry" : fx}`;
    seg.append(nm, meta);
    lane.appendChild(seg);
  });
}

let currentSectionIdx = -1;
function highlightSection(g) {
  if (!(mode === "song" && built)) return;
  const bar = Math.floor(g / STEPS);
  const idx = built.sections.findIndex((s) => bar >= s.startBar && bar < s.startBar + s.bars);
  if (idx !== currentSectionIdx) {
    currentSectionIdx = idx;
    document.querySelectorAll(".timeline .sec").forEach((el) =>
      el.classList.toggle("active", +el.dataset.idx === idx));
    // Resalta también el chip del tramo que suena (sin cambiar el que editas)
    document.querySelectorAll("#tramos .tramo").forEach((el, i) =>
      el.classList.toggle("playing", i === idx));
    // Vocal por tramo: suena solo en los tramos con vocal activa
    if (live && live.vocalChannel) live.vocalChannel.mute = vocal.mute || !tramoVocalOf(idx);
  }
  // Playhead recorriendo toda la canción sin forzar medidas de layout.
  const tl = $("timeline"), ph = document.getElementById("tl-playhead");
  if (ph && tl) {
    const total = Math.max(1, built.song.kick.length - 1);
    ph.style.left = (clamp(g / total, 0, 1) * 100).toFixed(2) + "%";
  }
}

function highlight(s) {
  if (currentStep === s) return;
  document.querySelectorAll(".step.playhead").forEach((el) => el.classList.remove("playhead"));
  if (s >= 0) document.querySelectorAll(`.step[data-step="${s}"]`).forEach((el) => el.classList.add("playhead"));
  currentStep = s;
}

function updatePosition(g) {
  const el = $("position"); if (!el) return;
  el.textContent = `${Math.floor(g / STEPS) + 1}:${Math.floor((g % STEPS) / 4) + 1}:${(g % 4) + 1}`;
}

function setStatus(html) { $("status").innerHTML = html; }

// ----------------------------------------------------------------------------
// Arranque
// ----------------------------------------------------------------------------
function init() {
  $("playBtn").onclick = togglePlay;
  $("genBtn").onclick = generate;
  if ($("hardTrackBtn")) $("hardTrackBtn").onclick = createHardTechnoTrack;
  $("modeBtn").onclick = toggleMode;
  $("midiBtn").onclick = exportMidiFile;
  $("wavBtn").onclick = exportWav;
  $("stemsBtn").onclick = exportStems;

  // Proyecto: nombre, guardar (.tfp), cargar, nuevo
  $("projName").oninput = () => { projectName = $("projName").value || "Mi track"; markDirty(); };
  $("saveBtn").onclick = saveProjectFile;
  $("newBtn").onclick = newProject;
  $("loadBtn").onclick = () => $("loadInput").click();
  $("midiCtrl").onclick = enableMIDI;

  // Guía rápida: primera vez automática, reabrible con ?
  const showGuide = () => { $("guide").hidden = false; };
  const hideGuide = () => { $("guide").hidden = true; try { localStorage.setItem("technoforge.seenGuide", "1"); } catch (e) {} };
  $("guideBtn").onclick = showGuide;
  $("guideClose").onclick = hideGuide;
  $("guideStart").onclick = hideGuide;
  $("guide").onclick = (e) => { if (e.target.id === "guide") hideGuide(); };
  $("loadInput").onchange = (e) => { if (e.target.files[0]) loadProjectFile(e.target.files[0]); e.target.value = ""; };
  $("sampleInput").onchange = (e) => { if (e.target.files[0] && sampleTarget) loadSampleFile(e.target.files[0], sampleTarget); e.target.value = ""; };
  $("vocalInput").onchange = (e) => { if (e.target.files[0]) loadVocalFile(e.target.files[0]); e.target.value = ""; };

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
      markDirty();
    };
  };
  ["bpm", "energy", "swing", "humanize"].forEach(bindRange);

  // Modo de edición de celdas: Notas / Prob / Ratchet
  document.querySelectorAll("#editmode .seg").forEach((b) => { b.onclick = () => setEditMode(b.dataset.mode); });

  // Preset de sonido de 1 clic
  $("preset").onchange = () => { if ($("preset").value) applyGenrePreset($("preset").value); };

  // Rumble (FX global): un solo control
  $("rumble").oninput = () => { $("rumbleOut").textContent = $("rumble").value; applyRumble(parseInt($("rumble").value, 10) / 100); };

  // Zonas plegables (UX simple y rápida): clic en el título despliega/oculta
  document.querySelectorAll(".zone-title[data-collapsible]").forEach((h) => {
    const sec = h.nextElementSibling;
    const set = (open) => { sec.style.display = open ? "" : "none"; h.classList.toggle("open", open); if (open && sec.id === "piano") renderPiano(); };
    h.onclick = () => set(sec.style.display === "none");
    set(h.dataset.open === "true");
  });

  // Barra de ayuda contextual (estilo DAW): muestra el title del control bajo el cursor
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[title]");
    const help = $("help"); if (help) help.textContent = el ? el.getAttribute("title") : "";
  });

  meterLoop(); // medidores del mezclador (se mueven al reproducir)
  drawSpectrum(); // analizador de espectro
  liveUiLoop(); // contador/playhead desacoplados del callback musical
  renderProDesk();
  renderAutomation();
  renderInstruments();
  renderModulation();
  renderVocal();

  // Restaura el último proyecto (autoguardado) o genera uno nuevo
  let restored = false;
  try {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) restored = loadProject(JSON.parse(saved));
  } catch (e) {}
  if (restored) {
    $("projName").value = projectName;
    setStatus(`Proyecto «${projectName}» restaurado. <b>Play</b> para escuchar.`);
  } else {
    $("scale").value = currentEmotion().scale;
    generate();
  }
}

window.addEventListener("DOMContentLoaded", init);
