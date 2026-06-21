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

## ✅ Fase 1 — Arreglo y sonido (hecho)

- **Arreglo automático**: estructura de track (intro · build · drop · break ·
  drop 2 · outro) generando ~32 compases, no solo un bucle. Modo Bucle/Track.
- **FX**: *risers* antes de los drops e *impactos* al entrar.
- **Fills** de hats al final de las secciones de tensión.
- **Hats humanizados** (velocidad/acento por paso).
- **Presets de estilo**: peak-time, hipnótico, melódico, industrial.
- **Línea de tiempo** visual de la estructura + export MIDI/WAV del track entero.

### 🔜 Pendiente de pulir en Fase 1
- Variaciones/mutaciones del patrón entre drops (que el Drop 2 no sea idéntico).
- Más motores de síntesis (808/909, bass reese, plucks) y FX (downlifters, sweeps).
- Estructura de arreglo configurable por el usuario.

### 💜 Motor de Armonía Emocional (primer paso hacia la VISIÓN)
- ✅ Selector de **Emoción** (8 emociones) que fija escala + **progresión de
  acordes** + sesgos; el bajo sigue las fundamentales; reverb en los acordes.
- ✅ Escalas nuevas: mayor (ionian) y lidia para emociones luminosas.
- 🔜 Progresiones multi-compás (que el track avance armónicamente entre secciones).
- 🔜 Capa de **pad/cuerdas** sostenida bajo los acordes (alma cinematográfica).
- 🔜 Editor de **Arco Emocional** (curva de tensión que gobierna el arreglo).
- Plan completo en [`VISION.md`](VISION.md).

## 🏗️ Núcleo de estudio — la plataforma (DIRECCIÓN ACTUAL)

> Objetivo corregido (2026-06-21): **plataforma completa de producción** que
> reemplaza el stack de pago profesional. Ver `VISION.md`. Esto es la base sobre
> la que enchufan sampler, sintes, FX y mastering.

- ✅ **Modelo de proyecto** (`.tfp` JSON, fuente de verdad) + **guardar/cargar** +
  **autoguardado** en el navegador (deja de perderse al recargar).
- ✅ **Mezclador por pista**: volumen (dB), paneo, mute y **solo** (tiras de canal
  Tone.Channel), con ajuste en tiempo real; respetado en export WAV.
- ✅ **UI con lógica de estudio**: zonas (Secuenciador · Mezclador), channel strips
  con fader vertical + lectura en dB + **medidores de nivel** (Tone.Meter) + strip
  de Máster; estado de transporte actualizado al reproducir.
- 🔜 Timeline de **clips** multipista (varios patrones encadenados, no 1 compás).
- 🔜 EQ/compresor por canal y envíos a FX (reverb/delay) compartidos.

## 🎚️ Fase 2 — Mezcla y mastering (en marcha)

- ✅ **Cadena de máster básica**: EQ (limpia graves / da aire) → glue compressor
  → saturación suave → makeup gain → limitador. El track sale con pegada y
  volumen competitivo.
- 🔜 Análisis de **loudness real (LUFS)** y normalización automática a un objetivo.
- 🔜 Mezcla automática por pista: ganancias/paneo, EQ de limpieza por instrumento.
- ✅ Exportar **stems** por instrumento (cada pista en su WAV, en crudo, dentro
  de un `.zip`) — listo para mezclar/masterizar en el DAW.

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
