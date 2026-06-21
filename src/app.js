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
let mode = "loop";            // "loop" | "song"
let built = null;             // { song, sections, fx } cuando hay track montado
let currentStep = -1;
let seq = null;
let live = null;
let mix = defaultMix();       // mezclador por pista: { vol(dB), pan(-1..1), mute, solo }
let projectName = "Mi track";
let samples = {};             // sampler: { trackId: {name, url(dataURL)} } persistente
let sampleBuffers = {};       // { trackId: Tone.ToneAudioBuffer } en memoria (decodificado)
let sampleTarget = null;      // pista destino del próximo archivo cargado
const SAMPLEABLE = ["kick", "clap", "chat", "ohat"]; // pistas de batería (one-shots)

const $ = (id) => document.getElementById(id);
const rnd = Math.random;
const arr16 = (v) => Array.from({ length: STEPS }, () => v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function blankPattern() {
  return { kick: arr16(false), clap: arr16(false), chat: arr16(false),
           ohat: arr16(false), bass: arr16(null), stab: arr16(null) };
}

pattern = blankPattern(); // ya con arr16 inicializado

// ----------------------------------------------------------------------------
// Núcleo de estudio: mezclador por pista + proyecto (guardar/cargar/autosave)
// ----------------------------------------------------------------------------
function defaultMix() {
  const m = {};
  for (const t of TRACKS) m[t.id] = { vol: 0, pan: 0, mute: false, solo: false };
  return m;
}
function mixOf(id) { return mix[id] || { vol: 0, pan: 0, mute: false, solo: false }; }
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
      energy: $("energy").value, swing: $("swing").value,
    },
    pattern,
    mix,
    samples,
  };
}

function normalizePattern(src) {
  const p = blankPattern();
  if (!src) return p;
  for (const k of ["kick", "clap", "chat", "ohat"])
    if (Array.isArray(src[k])) for (let i = 0; i < STEPS; i++) p[k][i] = !!src[k][i];
  if (Array.isArray(src.bass)) for (let i = 0; i < STEPS; i++) p.bass[i] = src.bass[i] == null ? null : src.bass[i];
  if (Array.isArray(src.stab)) for (let i = 0; i < STEPS; i++) p.stab[i] = Array.isArray(src.stab[i]) ? src.stab[i].slice() : null;
  return p;
}

function loadProject(p) {
  if (!p || !p.ui) return false;
  projectName = p.name || "Mi track";
  const set = (id, v) => {
    const el = $(id); if (el == null || v == null) return;
    el.value = v; const out = $(id + "Out"); if (out) out.textContent = v;
  };
  ["bpm", "root", "scale", "style", "emotion", "energy", "swing"].forEach((id) => set(id, p.ui[id]));
  pattern = normalizePattern(p.pattern);
  mix = normalizeMix(p.mix);
  // Sampler: re-decodifica los samples guardados en buffers de audio
  samples = {}; sampleBuffers = {};
  if (p.samples && window.Tone) {
    for (const id of Object.keys(p.samples)) {
      const s = p.samples[id];
      if (s && s.url) {
        samples[id] = s;
        const tb = new Tone.ToneAudioBuffer(s.url, () => { sampleBuffers[id] = tb; live = null; renderGrid(); });
      }
    }
  }
  mode = p.mode === "song" ? "song" : "loop";
  $("modeBtn").textContent = mode === "song" ? "🎚️ Track" : "🔁 Bucle";
  if ($("projName")) $("projName").value = projectName;
  built = null; live = null; // reconstruir voces con la mezcla nueva
  if (window.Tone && Tone.Transport) Tone.Transport.bpm.value = bpm();
  refreshSong(); renderGrid(); renderTimeline();
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
      try { const p = getProject(); p.samples = {}; localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(p)); } catch (e2) {}
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
        live = null; // reconstruir voces para usar el sample
        renderGrid(); markDirty();
        setStatus(`🎵 «${file.name}» cargado en <b>${id}</b>. Pulsa Play.`);
      },
      () => setStatus("No se pudo decodificar ese audio (prueba .wav o .mp3).")
    );
  };
  reader.readAsDataURL(file);
}

function clearSample(id) {
  delete samples[id]; delete sampleBuffers[id];
  live = null;
  renderGrid(); markDirty();
  setStatus(`Pista <b>${id}</b> vuelve a la síntesis.`);
}

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

  // Tira de canal por pista (mezclador): volumen/pan/mute/solo. En stems (flatMix)
  // no se aplica mute/solo, para que cada pista aislada se renderice siempre.
  const solo = anySolo();
  const ch = {};
  const meters = {};
  for (const t of TRACKS) {
    const m = mixOf(t.id);
    const c = new Tone.Channel({ volume: m.vol, pan: m.pan });
    c.mute = opts.flatMix ? false : (m.mute || (solo && !m.solo));
    c.connect(t.type === "drum" ? drumBus : musicalBus);
    meters[t.id] = new Tone.Meter();
    c.connect(meters[t.id]);
    ch[t.id] = c;
  }
  const masterMeter = new Tone.Meter();
  master.connect(masterMeter);

  // Sampler: si una pista de batería tiene sample cargado, su reproductor
  // sustituye a la síntesis (suena el audio real en vez del sintetizado).
  const players = {};
  for (const id of SAMPLEABLE) {
    if (sampleBuffers[id] && sampleBuffers[id].loaded) {
      players[id] = new Tone.Player(sampleBuffers[id]).connect(ch[id]);
    }
  }

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 6, oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.02 },
  }).connect(ch.kick);

  const clapFilter = new Tone.Filter(1400, "bandpass").connect(ch.clap);
  const clap = new Tone.NoiseSynth({
    noise: { type: "white" }, envelope: { attack: 0.002, decay: 0.18, sustain: 0 },
  }).connect(clapFilter);

  const chatFilter = new Tone.Filter(8000, "highpass").connect(ch.chat);
  const chat = new Tone.NoiseSynth({
    noise: { type: "white" }, volume: -8, envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  }).connect(chatFilter);

  const ohatFilter = new Tone.Filter(7000, "highpass").connect(ch.ohat);
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
  }).connect(ch.bass);

  // Acordes con reverb (Freeverb es algorítmico: válido también en render offline)
  // para ese aire cinematográfico de melodic/progressive.
  const stabVerb = new Tone.Freeverb({ roomSize: 0.62, dampening: 3000 }).connect(ch.stab);
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
    ch,          // tiras de canal del mezclador (para ajustes en vivo)
    meters,      // medidores de nivel por pista
    masterMeter, // medidor del máster
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
  if (p.kick[s] && inc("kick")) v.kick(time);
  if (p.kick[s]) v.pump(time);
  if (p.clap[s] && inc("clap")) v.clap(time);
  if (p.chat[s] && inc("chat")) {
    const vel = (s % 4 === 0 ? 0.95 : 0.6) + rnd() * 0.1; // humanización
    v.chat(time, clamp(vel, 0, 1));
  }
  if (p.ohat[s] && inc("ohat")) v.ohat(time);
  if (p.bass[s] != null && inc("bass")) v.bass(time, p.bass[s]);
  if (p.stab[s] != null && inc("stab")) v.stab(time, p.stab[s]);
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
  setStatus(mode === "song" ? "Reproduciendo el track completo 🔊" : "Reproduciendo el bucle 🔊");
}

function stop() {
  Tone.Transport.stop();
  if (seq) { seq.dispose(); seq = null; }
  $("playBtn").classList.remove("playing");
  $("playBtn").textContent = "▶ Play";
  highlight(-1);
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
  setStatus(mode === "song"
    ? "Modo <b>Track completo</b>: Intro · Build · Drop · Break · Drop 2 · Outro."
    : "Modo <b>Bucle</b>: un compás que se repite.");
  if (wasPlaying) play();
  markDirty();
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
    const buf = await renderOffline(p, null, (id) => id === t.id, { bypassMaster: true, flatMix: true });
    files.push({ name: `${n()}-${t.id}.wav`, data: encodeWav(buf.get()) });
    setStatus(`Stem ${t.name} listo ✔`);
  }
  // Stem aparte con los FX del arreglo (risers/impactos), solo en modo Track.
  if (fx && fx.length) {
    const buf = await renderOffline(p, fx, () => false, { bypassMaster: true, flatMix: true });
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
    const r = document.createElement("button");
    r.className = "mini"; r.textContent = "🎲"; r.title = "Regenerar esta pista";
    r.onclick = () => regenTrack(t.id);
    head.append(r);

    // Sampler: cargar/quitar un audio real (solo pistas de batería)
    if (SAMPLEABLE.includes(t.id)) {
      const samp = document.createElement("button");
      const loaded = samples[t.id];
      samp.className = "mini sample-btn" + (loaded ? " loaded" : "");
      samp.textContent = loaded ? "🎵" : "＋🎵";
      samp.title = loaded ? `Sample: ${loaded.name} (clic para cambiar)` : "Cargar un sample (.wav/.mp3) — reemplaza la síntesis";
      samp.onclick = () => { sampleTarget = t.id; $("sampleInput").click(); };
      head.append(samp);
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
      cell.className = "step" + (s % 4 === 0 ? " beat" : "") + (on ? " on" : "")
                       + (on && t.type === "pitch" ? " note" : "");
      cell.dataset.track = t.id; cell.dataset.step = s;
      cell.onclick = () => toggleCell(t, s);
      steps.appendChild(cell);
    }
    row.append(head, steps);
    grid.appendChild(row);
  }
  renderMixer();
}

// --- Mezclador (zona propia, con channel strips estilo estudio) ---
function fmtDb(v) { return (v > 0 ? "+" : "") + v + " dB"; }

function channelStrip(id, name, m, solo) {
  const strip = document.createElement("div");
  strip.className = "strip";

  const nm = document.createElement("div"); nm.className = "strip-name"; nm.textContent = name;

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

function renderMixer() {
  const mx = $("mixer"); if (!mx) return;
  mx.innerHTML = "";
  const solo = anySolo();
  for (const t of TRACKS) mx.appendChild(channelStrip(t.id, t.name, mixOf(t.id), solo));
  // Strip de máster (solo medidor por ahora)
  const master = document.createElement("div");
  master.className = "strip strip-master";
  const nm = document.createElement("div"); nm.className = "strip-name"; nm.textContent = "MÁSTER";
  const body = document.createElement("div"); body.className = "strip-body";
  const meter = document.createElement("div"); meter.className = "meter meter-wide";
  const fill = document.createElement("div"); fill.className = "meter-fill"; fill.id = "meter-master";
  meter.appendChild(fill); body.appendChild(meter);
  const sub = document.createElement("div"); sub.className = "strip-lbl"; sub.textContent = "salida";
  master.append(nm, body, sub);
  mx.appendChild(master);
}

// Medidores: animación continua; solo se mueven con audio sonando
function setMeterBar(elId, db) {
  const el = document.getElementById(elId); if (!el) return;
  let v = typeof db === "number" ? db : (Array.isArray(db) ? db[0] : -Infinity);
  if (!isFinite(v)) v = -60;
  el.style.height = Math.max(0, Math.min(1, (v + 60) / 60)) * 100 + "%";
}
function meterLoop() {
  requestAnimationFrame(meterLoop);
  if (!live || !live.meters) return;
  const playing = window.Tone && Tone.Transport && Tone.Transport.state === "started";
  for (const t of TRACKS) setMeterBar("meter-" + t.id, playing ? live.meters[t.id].getValue() : -Infinity);
  setMeterBar("meter-master", playing && live.masterMeter ? live.masterMeter.getValue() : -Infinity);
}

function toggleCell(t, s) {
  if (t.type === "drum") pattern[t.id][s] = !pattern[t.id][s];
  else if (t.id === "bass") pattern.bass[s] = pattern.bass[s] == null ? bassNoteAt(s) : null;
  else pattern.stab[s] = pattern.stab[s] == null ? chordAt(progAt(s), 48, wantSeventh()) : null;
  built = null;
  refreshSong();
  renderGrid();
  markDirty();
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

  // Proyecto: nombre, guardar (.tfp), cargar, nuevo
  $("projName").oninput = () => { projectName = $("projName").value || "Mi track"; markDirty(); };
  $("saveBtn").onclick = saveProjectFile;
  $("newBtn").onclick = newProject;
  $("loadBtn").onclick = () => $("loadInput").click();
  $("loadInput").onchange = (e) => { if (e.target.files[0]) loadProjectFile(e.target.files[0]); e.target.value = ""; };
  $("sampleInput").onchange = (e) => { if (e.target.files[0] && sampleTarget) loadSampleFile(e.target.files[0], sampleTarget); e.target.value = ""; };

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
  ["bpm", "energy", "swing"].forEach(bindRange);

  meterLoop(); // medidores del mezclador (se mueven al reproducir)

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
