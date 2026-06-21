# 🗺️ Hoja de ruta — TechnoForge

Objetivo: una herramienta propia que haga **lo que hoy hace un setup profesional
de producción de techno** (con costes altos en plugins, servicios y
suscripciones), enfocada y gratuita, que te lleve de **idea → track arreglado →
stems/MIDI exportables** para rematar en cualquier DAW.

No buscamos clonar Ableton. Buscamos el "cerebro": generar, arreglar, mezclar y
masterizar con asistencia, y dejar el toque final al productor.

---

## ✅ Fase 0 — MVP (hecho)

- Secuenciador de 16 pasos con síntesis en el navegador (Tone.js).
- Generador de patrones de techno por reglas (bombo, bajo, hats, clap, stabs).
- Tonalidad / escala / energía / swing / BPM.
- Edición manual por celda, mute y regeneración por pista.
- Sidechain (pump) bajo+acordes con el bombo.
- Exportación **MIDI multipista** y **WAV**.

## 🔜 Fase 1 — Arreglo y sonido

- **Arreglo automático**: estructura de track (intro · build · drop · break ·
  outro) generando varios compases, no solo un bucle.
- **Variaciones**: fills cada 4/8 compases, mutaciones controladas del patrón.
- **Más motores**: 808/909 emuladas, bajo reese, plucks, FX risers/impactos.
- **Mejores hats** y velocidad/acentos por paso (humanización).
- **Presets de estilo**: peak-time, hypnotic, melodic, industrial.

## 🎚️ Fase 2 — Mezcla y mastering (lo que más € ahorra)

- Mezcla automática: ganancias, paneo, EQ de limpieza, sidechain por envío.
- **Mastering automático**: análisis de loudness (LUFS), EQ de tono, compresión
  multibanda y limitador para dejar el track a nivel de club.
- Exportar **stems** por instrumento (no solo la mezcla).

## 🤖 Fase 3 — IA de verdad y stems

- Generación con modelos (melodías/grooves aprendidos de un corpus de techno).
- Asistente por texto: "hazme un bajo más hipnótico y oscuro".
- **Separación de stems** de canciones existentes (estilo demucs) para
  resamplear y aprender de referencias.

---

## 🧩 Decisiones de arquitectura

- **Web primero**: cero instalación, fácil de compartir y de iterar.
- **Sin backend mientras se pueda**: todo en el cliente (privacidad + coste 0).
  La IA pesada (Fase 3) podría necesitar un servicio aparte.
- **El MIDI es el puente**: lo importante es exportar la idea para terminarla
  en el DAW del usuario con sus plugins favoritos.

## 💸 Por qué esto tiene sentido (el "coste desorbitado")

| Lo que hoy pagas | Lo que cubre TechnoForge |
|---|---|
| Suscripciones de IA generativa | Generación de ideas/patrones (Fase 0 → 3) |
| Servicios de mastering por track | Mastering automático (Fase 2) |
| Packs de samples / presets | Síntesis y presets propios (Fase 1) |
| Plugins de separación de stems | Stems (Fase 3) |

La DAW base (Ableton, etc.) sigue siendo barata; el gasto real está en lo de
arriba, y es justo lo que esta app ataca.
