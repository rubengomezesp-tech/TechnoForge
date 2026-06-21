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

let pattern;                  // el bucle del tramo activo === patterns[current]
let patterns = [];            // lista de tramos (secciones); cada uno es un patrón
let current = 0;              // índice del tramo que se edita
let barsPerTramo = 4;         // cuántos compases dura cada tramo en modo Track
let mode = "loop";            // "loop" | "song"
let built = null;             // { song, sections, fx } cuando hay track montado
let currentStep = -1;
let seq = null;
let live = null;
let mix = defaultMix();       // mezclador por pista: { vol(dB), pan(-1..1), mute, solo }
let fxGlobal = { rumble: 0 }; // FX globales (techno rumble)
let synth = defaultSynths();  // sintes editables (bajo y acordes): onda/filtro/ADSR
let projectName = "Mi track";
let samples = {};             // sampler: { trackId: {name, url(dataURL)} } persistente
let sampleBuffers = {};       // { trackId: Tone.ToneAudioBuffer } en memoria (decodificado)
let sampleTarget = null;      // pista destino del próximo archivo cargado
let editMode = "notes";       // "notes" | "prob" | "ratchet" — qué edita el clic en celda
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

// Mantiene pattern === patterns[current] tras reasignar pattern
function syncTramo() { patterns[current] = pattern; }

// ----------------------------------------------------------------------------
// Núcleo de estudio: mezclador por pista + proyecto (guardar/cargar/autosave)
// ----------------------------------------------------------------------------
function defaultMix() {
  const m = {};
  for (const t of TRACKS) {
    const c = { vol: 0, pan: 0, mute: false, solo: false, drive: 0, sidechain: 0, rev: 0, delay: 0 };
    // Sonido techno "de fábrica": bombeo en bajo/acordes, pegada en kick, aire en stab
    if (t.id === "bass" || t.id === "stab") c.sidechain = 0.35;
    if (t.id === "stab") c.rev = 0.22;
    if (t.id === "kick") c.drive = 0.18;
    m[t.id] = c;
  }
  return m;
}
function mixOf(id) { return mix[id] || { vol: 0, pan: 0, mute: false, solo: false, drive: 0, sidechain: 0, rev: 0, delay: 0 }; }

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

// Aplica el rack de FX de un canal a las voces en vivo
function applyFx(id) {
  if (live && live.fx && live.fx[id]) {
    const m = mixOf(id), f = live.fx[id];
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

// Sintetizadores editables (subtractivo) para las pistas con tono
function defaultSynths() {
  return {
    bass: { wave: "sawtooth", cutoff: 90,   res: 2, attack: 0.005, decay: 0.20, sustain: 0.45, release: 0.12 },
    stab: { wave: "sawtooth", cutoff: 2200, res: 1, attack: 0.006, decay: 0.22, sustain: 0.05, release: 0.18 },
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
    mix,
    fxGlobal,
    synth,
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
  mix = normalizeMix(p.mix);
  fxGlobal = { rumble: (p.fxGlobal && p.fxGlobal.rumble) || 0 };
  if ($("rumble")) { $("rumble").value = Math.round(fxGlobal.rumble * 100); $("rumbleOut").textContent = $("rumble").value; }
  synth = normalizeSynths(p.synth);
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
  refreshSong(); renderGrid(); renderTimeline(); renderInstruments();
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
  patterns = [blankPattern()]; current = 0; pattern = patterns[0];
  fxGlobal = { rumble: 0 };
  if ($("rumble")) { $("rumble").value = 0; $("rumbleOut").textContent = "0"; }
  synth = defaultSynths(); renderInstruments();
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

// --- Tramos (secciones): crea y encadena partes para montar el track ---
function selectTramo(i) {
  if (i < 0 || i >= patterns.length) return;
  current = i; pattern = patterns[current];
  built = null; refreshSong(); renderGrid(); markDirty();
  setStatus(`Editando <b>Tramo ${i + 1}</b> de ${patterns.length}.`);
}
function addTramo() { // copia el actual para seguir creando rápido una variación
  patterns.splice(current + 1, 0, deepCopy(pattern));
  current += 1; pattern = patterns[current];
  built = null; refreshSong(); renderGrid(); resync(); markDirty();
  setStatus(`<b>Tramo ${current + 1}</b> creado (copia). Edítalo y pulsa ➕ para el siguiente.`);
}
function newIdeaTramo() { // tramo nuevo con una idea generada desde cero
  patterns.splice(current + 1, 0, blankPattern());
  current += 1; pattern = patterns[current];
  generate(); // genera la idea en el tramo nuevo (sincroniza y redibuja)
  setStatus(`<b>Tramo ${current + 1}</b> con idea nueva. Sigue creando.`);
}
function deleteTramo(i) {
  if (patterns.length <= 1) { setStatus("Necesitas al menos un tramo."); return; }
  patterns.splice(i, 1);
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
}

function rootPc()  { return parseInt($("root").value, 10); }
function scaleId() { return $("scale").value; }
function styleId() { return $("style").value; }
function bpm()     { return parseInt($("bpm").value, 10); }
function energy()  { return parseInt($("energy").value, 10) / 100; }
function swingAmt(){ return parseInt($("swing").value, 10) / 100; }
function humanizeAmt(){ const el = $("humanize"); return el ? parseInt(el.value, 10) / 100 : 0; }

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
  syncTramo();
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

// ----------------------------------------------------------------------------
// Arreglo automático: convierte el bucle base en un track completo
// ----------------------------------------------------------------------------
// Monta el track encadenando TUS tramos en orden (cada uno dura barsPerTramo).
function buildSong() {
  const song = { kick: [], clap: [], chat: [], ohat: [], bass: [], stab: [] };
  const songMods = {}; for (const k of NOTE_KEYS) songMods[k] = [];
  const sections = [];
  let barCursor = 0;

  patterns.forEach((pat, i) => {
    for (let b = 0; b < barsPerTramo; b++)
      for (let s = 0; s < STEPS; s++)
        for (const k of NOTE_KEYS) {
          song[k].push(pat[k][s]);
          songMods[k].push(pat.mods && pat.mods[k] ? pat.mods[k][s] : null);
        }
    sections.push({ name: "Tramo " + (i + 1), startBar: barCursor, bars: barsPerTramo });
    barCursor += barsPerTramo;
  });
  song.mods = songMods;
  return { song, sections, fx: [] };
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

  // Returns globales de FX: reverb espacial + delay ping-pong (algorítmicos =
  // válidos también en el render offline de export).
  const reverb = new Tone.Freeverb({ roomSize: 0.9, dampening: 2500 });
  reverb.wet.value = 1; reverb.connect(master);
  const delay = new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.32, wet: 1 }).connect(master);

  // Tira de canal por pista con RACK DE FX: canal(vol/pan/mute) → drive
  // (saturación WaveShaper) → scGain (sidechain) → máster, + envíos a reverb/delay.
  // En stems (flatMix) no se aplica mute/solo.
  const solo = anySolo();
  const ch = {};
  const fx = {};
  const meters = {};
  for (const t of TRACKS) {
    const m = mixOf(t.id);
    const c = new Tone.Channel({ volume: m.vol, pan: m.pan });
    c.mute = opts.flatMix ? false : (m.mute || (solo && !m.solo));
    const drive = new Tone.WaveShaper(makeDriveCurve(m.drive || 0));
    const scGain = new Tone.Gain(1); // sidechain: baja por cada golpe de kick
    c.connect(drive); drive.connect(scGain); scGain.connect(master);
    const sendRev = new Tone.Gain(m.rev || 0);   scGain.connect(sendRev);   sendRev.connect(reverb);
    const sendDly = new Tone.Gain(m.delay || 0); scGain.connect(sendDly);   sendDly.connect(delay);
    meters[t.id] = new Tone.Meter(); scGain.connect(meters[t.id]);
    ch[t.id] = c;
    fx[t.id] = { drive, scGain, sendRev, sendDly };
  }
  const masterMeter = new Tone.Meter();
  master.connect(masterMeter);

  // Techno Rumble: el kick alimenta un sub sostenido (paso-bajo → reverb larga)
  // = el retumbe grave del techno oscuro. Un solo control (fxGlobal.rumble).
  const rumbleSend = new Tone.Gain(fxGlobal.rumble || 0);
  const rumbleFilter = new Tone.Filter(120, "lowpass");
  const rumbleVerb = new Tone.Freeverb({ roomSize: 0.92, dampening: 1200 }); rumbleVerb.wet.value = 1;
  rumbleSend.connect(rumbleFilter); rumbleFilter.connect(rumbleVerb); rumbleVerb.connect(master);
  fx.kick.scGain.connect(rumbleSend);

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

  // Bajo: sinte sustractivo editable (onda/filtro/ADSR desde synth.bass)
  const bs = synth.bass;
  const bass = new Tone.MonoSynth({
    oscillator: bs.wave === "fatsawtooth" ? { type: "fatsawtooth", count: 3, spread: 40 } : { type: bs.wave },
    volume: -6, filter: { type: "lowpass", Q: bs.res },
    filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.1, baseFrequency: bs.cutoff, octaves: 2.6 },
    envelope: { attack: bs.attack, decay: bs.decay, sustain: bs.sustain, release: bs.release },
  }).connect(ch.bass);

  // Acordes: sinte editable (synth.stab) + reverb (Freeverb, válido en render offline)
  const st = synth.stab;
  const stabVerb = new Tone.Freeverb({ roomSize: 0.62, dampening: 3000 }).connect(ch.stab);
  stabVerb.wet.value = 0.28;
  const stabFilter = new Tone.Filter(st.cutoff, "lowpass").connect(stabVerb);
  stabFilter.Q.value = st.res;
  const stab = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: st.wave === "fatsawtooth" ? "fatsawtooth" : st.wave }, volume: -14,
    envelope: { attack: st.attack, decay: st.decay, sustain: st.sustain, release: st.release },
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
    fx,          // rack de FX por canal (drive/sidechain/envíos)
    rumbleSend,  // envío al sub-rumble (techno)
    meters,      // medidores de nivel por pista
    masterMeter, // medidor del máster
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
  if (seq) { seq.dispose(); seq = null; }
  const songMode = mode === "song";
  if (songMode && !built) built = buildSong();
  const len = (songMode ? built.song : pattern).kick.length;
  const fxMap = {};
  if (songMode && built) built.fx.forEach((e) => (fxMap[e.step] = e.type));
  const barSec = (60 / bpm()) * 4;

  seq = new Tone.Sequence((time, g) => {
    const src = (mode === "song") ? (built ? built.song : pattern) : pattern;
    if (g < src.kick.length) triggerStep(live, src, g, time);
    if (fxMap[g] === "riser") live.riser(time, barSec);
    if (fxMap[g] === "downlifter") live.downlifter(time, barSec);
    if (fxMap[g] === "impact") live.impact(time);
    Tone.Draw.schedule(() => { highlight(g % STEPS); highlightSection(g); }, time);
  }, [...Array(len).keys()], "16n").start(0);
}

// Rehace la secuencia en vivo si cambia su longitud (añadir/borrar tramo, modo)
function resync() { if (Tone.Transport.state === "started") buildSequence(); }

async function play() {
  await Tone.start();
  Tone.Transport.bpm.value = bpm();
  Tone.Transport.swing = swingAmt();
  Tone.Transport.swingSubdivision = "16n";
  if (!live) live = buildVoices();
  buildSequence();
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
  document.querySelectorAll("#tramos .tramo.playing").forEach((el) => el.classList.remove("playing"));
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
    ? `Modo <b>Track</b>: suenan tus ${patterns.length} tramo(s) en orden (${barsPerTramo} comp. c/u).`
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

  // Rack de FX por canal: Drive (saturación), SC (sidechain), Rev y Dly (envíos)
  const rack = document.createElement("div"); rack.className = "strip-fx";
  const fxRow = (key, label, title) => {
    const row = document.createElement("label"); row.className = "fx-ctl";
    const sp = document.createElement("span"); sp.textContent = label; sp.title = title;
    const inp = document.createElement("input");
    inp.type = "range"; inp.min = "0"; inp.max = "1"; inp.step = "0.05"; inp.value = m[key]; inp.title = title;
    inp.oninput = () => { m[key] = parseFloat(inp.value); applyFx(id); };
    row.append(sp, inp); return row;
  };
  rack.append(
    fxRow("drive", "DRV", "Saturación / distorsión"),
    fxRow("sidechain", "SC", "Sidechain: baja con el kick"),
    fxRow("rev", "REV", "Envío a reverb espacial"),
    fxRow("delay", "DLY", "Envío a delay ping-pong"),
  );

  strip.append(nm, body, dbOut, pan, panLbl, btns, rack);
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
    }
    if (id === "stab" && live.stabSynth) {
      const s = synth.stab;
      live.stabSynth.set({
        oscillator: { type: s.wave === "fatsawtooth" ? "fatsawtooth" : s.wave },
        envelope: { attack: s.attack, decay: s.decay, sustain: s.sustain, release: s.release },
      });
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

  const waveCtl = document.createElement("label"); waveCtl.className = "instr-ctl wave";
  const wsp = document.createElement("span"); wsp.textContent = "Onda";
  const sel = document.createElement("select");
  Object.keys(WAVE_LABELS).forEach((w) => {
    const o = document.createElement("option"); o.value = w; o.textContent = WAVE_LABELS[w];
    if (w === p.wave) o.selected = true; sel.appendChild(o);
  });
  sel.onchange = () => { p.wave = sel.value; applySynth(id); };
  waveCtl.append(wsp, sel); panel.appendChild(waveCtl);

  for (const key of ["cutoff", "res", "attack", "decay", "sustain", "release"]) {
    const [mn, mx, st] = SYNTH_RANGES[id][key];
    const ctl = document.createElement("label"); ctl.className = "instr-ctl";
    const sp = document.createElement("span"); sp.textContent = PARAM_LABELS[key];
    const inp = document.createElement("input");
    inp.type = "range"; inp.min = mn; inp.max = mx; inp.step = st; inp.value = p[key];
    inp.oninput = () => { p[key] = parseFloat(inp.value); applySynth(id); };
    ctl.append(sp, inp); panel.appendChild(ctl);
  }
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
  // Resalta también el chip del tramo que suena (sin cambiar el que editas)
  document.querySelectorAll("#tramos .tramo").forEach((el, i) =>
    el.classList.toggle("playing", i === idx));
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
  ["bpm", "energy", "swing", "humanize"].forEach(bindRange);

  // Modo de edición de celdas: Notas / Prob / Ratchet
  document.querySelectorAll("#editmode .seg").forEach((b) => { b.onclick = () => setEditMode(b.dataset.mode); });

  // Rumble (FX global): un solo control
  $("rumble").oninput = () => { $("rumbleOut").textContent = $("rumble").value; applyRumble(parseInt($("rumble").value, 10) / 100); };

  // Zonas plegables (UX simple y rápida): clic en el título despliega/oculta
  document.querySelectorAll(".zone-title[data-collapsible]").forEach((h) => {
    const sec = h.nextElementSibling;
    const set = (open) => { sec.style.display = open ? "" : "none"; h.classList.toggle("open", open); };
    h.onclick = () => set(sec.style.display === "none");
    set(h.dataset.open === "true");
  });

  meterLoop(); // medidores del mezclador (se mueven al reproducir)
  renderInstruments();

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
