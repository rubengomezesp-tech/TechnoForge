# 🌌 Visión — "Construimos mundos, no canciones"

> Entre máquinas y sueños nacen los ecos del mañana.
> No componemos canciones. Construimos mundos.
> No diseñamos sonidos. Diseñamos emociones.

Este documento es la **estrella polar** del proyecto. TechnoForge (el generador
actual) es la semilla; esto es el árbol. Enfoque: **techno melódico, cinematic
techno, progressive y electrónica emocional**.

La tesis es una sola frase:

> **La emoción es la interfaz. La música es el resultado. El humano es el autor.**

Todas las herramientas de hoy (Ableton, FL, Logic) parten del *sonido* hacia
arriba: pones notas, las mezclas, sale una emoción por accidente. Nosotros
invertimos la pirámide: partes de la **intención emocional** y bajamos hacia la
armonía, la melodía, el timbre y la mezcla. Eso es lo que no existe.

---

## 1. La plataforma (nombre de trabajo: **AURA** / *Emotive Studio*)

Una capa de tres niveles, donde puedes empezar arriba y bajar, o entrar por
cualquier nivel:

```
  ┌─────────────────────────────────────────────────┐
  │  CAPA SENTIMIENTO   poema · emoción · arco narrativo │  ← entras aquí
  ├─────────────────────────────────────────────────┤
  │  CAPA MÚSICA        armonía · melodía · arreglo      │  ← editable a mano
  ├─────────────────────────────────────────────────┤
  │  CAPA SONIDO        timbre · mezcla · máster · stems │  ← export al DAW
  └─────────────────────────────────────────────────┘
```

No es una DAW con IA pegada. Es un **co-compositor** que traduce intención en
música y te deja el control de cada nota. Y mantiene sagrado el ADN actual:
**todo se exporta** (MIDI + stems + proyecto portable) para rematar donde quieras.

---

## 2. Funcionalidades que no existen hoy

1. **Editor de Arco Emocional** — la interfaz central. En vez de un piano roll,
   dibujas la *curva emocional* del track en el tiempo (tensión↔liberación,
   melancolía→esperanza, oscuridad→épica). El motor arregla armonía, dinámica,
   densidad y orquestación para *seguir esa curva*. Es la "columna vertebral
   narrativa" de la canción, hecha tangible.

2. **Scoring semántico (poema/frase → música)** — un texto se analiza por
   sentimiento, imágenes y prosodia. Su *trayectoria emocional* se convierte en
   estructura de track; sus imágenes ("violín que llora", "bajo que hace temblar
   la tierra") sugieren instrumentación y motivos. El poema literalmente *se
   compone*.

3. **Motor de Armonía Emocional** — un vocabulario armónico mapeado a emociones
   con intensidad regulable: el "lift" épico (menor→relativo mayor), oscuridad
   frigia, asombro lidio, cadencias rotas para la nostalgia, *voice-leading* que
   eleva el alma. Dices "más melancólico" y la progresión cambia con criterio.

4. **Perilla de Tensión inteligente** — una sola perilla, automatizable a lo
   largo del arco, que controla disonancia, registro, densidad rítmica, filtro y
   el arte de *retener el bombo*. Tensión musical de verdad, no un low-pass.

5. **Orquesta ⇄ Sintetizador (morphing de timbre)** — un instrumento que se
   transforma de sección de cuerdas sampleada a pad analógico de forma continua.
   "El timbre como dial emocional": cruzas orquesta y síntesis moderna.

6. **Co-compositor conversacional** — "haz el break más desgarrador, mete las
   cuerdas dos compases antes, bajo más oscuro". Editas el *arreglo* hablando, no
   solo generas. La IA respeta lo que ya tocaste a mano.

7. **ADN de referencia (no copia)** — sueltas un track que amas y extraemos su
   *ADN emocional y estructural* (arco de energía, paleta armónica, forma del
   arreglo), nunca su audio. Compones algo **original** con ese espíritu.

8. **Tracks vivos** — la composición puede renderizar variaciones infinitas y no
   idénticas (para sets en directo, streams). "El track respira."

---

## 3. La experiencia de usuario

- **Un lienzo cinematográfico, no un mezclador.** Oscuro, espacioso, el arco
  emocional visualizado como un paisaje que evoluciona. El "estudio del futuro".
- **Top-down o por cualquier capa.** Puedes escribir un poema y obtener un mundo,
  o entrar directo a refinar una progresión, o solo masterizar y sacar stems.
- **La IA siempre propone, nunca encierra.** Cada sugerencia es editable nota a
  nota y exportable. Colaborador, no máquina de vending.
- **Bucle de diálogo constante:** intención → la IA compone → tú ajustas → la IA
  se adapta a tus ajustes. Repetir hasta que *sientas* que es tuyo.

---

## 4. Arquitectura técnica

**Principio:** proyecto portable y ligero (JSON), audio renderizado bajo demanda.
Edge primero por privacidad e inmediatez; nube para lo pesado.

```
  CLIENTE (navegador)
   ├─ Lienzo emocional        WebGL/Canvas
   ├─ Motor de audio          Web Audio / Tone.js (realtime + render offline)
   ├─ DSP y modelos ligeros   WASM (síntesis, generación simbólica en local)
   └─ Proyecto portable       JSON = arco emocional + música simbólica + sonido

  SERVICIOS (nube, opcional / progresivo)
   ├─ "Cerebro compositor"    modelo simbólico (MIDI: armonía/melodía/arreglo)
   ├─ Capa emoción→música     embeddings + reglas de teoría como barandillas
   ├─ Lenguaje                LLM para scoring de poema y edición conversacional
   └─ Audio neuronal          timbre/orquesta, separación de stems (más pesado)
```

- **Formato de proyecto** como fuente de verdad: el audio es derivado. Esto hace
  los proyectos eternos, versionables y exportables (MIDI/stems/interchange).
- **El puente al DAW es intocable** (es el ADN de TechnoForge): MIDI multipista +
  stems WAV + a futuro un compañero VST/AU.
- **Generación con barandillas:** la teoría musical actúa como restricciones del
  modelo, para que la salida sea *usable*, no aleatoria.

---

## 5. Cómo participa la IA en la composición

Una **pila por capas**, no una caja negra mágica (el moat es la *traducción*
emoción→música + la UX + el puente de export, no un único modelo):

1. **Vector de emoción** — espacio (curado primero, aprendido después) donde las
   palabras mapean a rasgos musicales: modo, tensión armónica, tempo, registro,
   peso orquestal, densidad rítmica. Con sliders de intensidad.
2. **Cerebro compositor (simbólico)** — genera notas/acordes/secciones
   *condicionado* al vector de emoción y a la estructura. Trabaja a nivel MIDI,
   con la teoría como guardarraíl.
3. **Lenguaje (LLM)** — entiende el poema (sentimiento, imágenes, prosodia) y la
   edición hablada; traduce intención a parámetros y respeta tus ediciones.
4. **Audio neuronal (más adelante)** — timbre, instrumentos neuronales,
   separación de stems. Lo pesado, en la nube/WASM.

Regla de oro: **humano en el centro**. La IA acelera y propone; tú decides.

---

## 6. Roadmap: de MVP a líder mundial

- **Fase A — Semilla (hecha): TechnoForge.** Generación por reglas + arreglo +
  export MIDI/stems. Ya valida el puente al DAW. *(estamos aquí)*

- **Fase 1 — MVP emoción-primero (cliente puro).** Editor de Arco Emocional +
  motor de Armonía Emocional (reglas) gobernando el sintetizador/arreglador
  actual. Paleta melódica/cinematic (cuerdas, pads, plucks, sub). Poema→mood
  básico. Sin costes, sin backend.

- **Fase 2 — El cerebro compositor.** Modelo simbólico real (melodía/armonía
  condicionada a emoción), edición conversacional (LLM), samples orquestales,
  mezcla/máster + stems pro. Aquí entra la nube.

- **Fase 3 — Orquesta híbrida y audio neuronal.** Morphing de timbre,
  instrumentos neuronales, ADN de referencia, separación de stems, render en
  nube para piezas orquestales grandes.

- **Fase 4 — Plataforma.** Colaboración, marketplace de "presets emocionales" y
  partituras, modo generativo en directo, compañero VST/AU, móvil.

- **Fase 5 — Horizonte 20 años.** Música **adaptativa** (partituras que responden
  al oyente, contexto o biometría), un compositor-IA *personal* que aprende tu
  estilo, la canción como **software vivo**.

---

## 7. Pensando a 20 años

La canción dejará de ser un archivo fijo y será un **sistema vivo**: generativo,
adaptativo y personal. El rol del compositor se desplaza de "colocar notas" a
**dirigir emoción e intención**. Ganará la plataforma que convierta la *intención
emocional* en la interfaz principal y mantenga al humano como autor — no la que
escupa pistas, sino la que **amplifique el sentir humano**.

Empezamos pequeño y honesto (Fase 1, en el navegador, sin humo), y cada fase
entrega algo usable. Construimos el futuro un compás a la vez.

---

## 📊 Stack de referencia (qué reemplazamos)

> Dirección real (2026-06-21): **plataforma completa de producción** que sustituye
> el stack de pago. Referencia: productores de techno reconocidos (p. ej. Adrián
> Mills, techno hispano-alemán makina/trance/latino) y el toolset estándar de
> techno melódico/progressive documentado en la industria.

| Categoría | Lo que usan (pago) | Módulo TechnoForge | Estado |
|---|---|---|---|
| DAW | Ableton Live, FL, Bitwig, Logic | Estudio (timeline multipista, clips) | 🔜 (núcleo iniciado) |
| Proyecto/guardado | (en la DAW) | Proyecto `.tfp` + autosave | ✅ |
| Mezclador | canales de la DAW | Mezclador por pista (vol/pan/mute/solo) | ✅ |
| Sinte wavetable | Serum / Serum 2, Vital, Pigments | Sinte wavetable editable + presets | 🔜 |
| Sinte analógico | u-he Diva, Sylenth | Sinte sustractivo (filtros tipo analógico) | 🔜 (base en MonoSynth) |
| Sampler/drums | Kontakt, packs, Splice | Sampler + drum machine + librería | 🔜 |
| EQ/Comp | FabFilter Pro-Q 3 / Pro-C | EQ + comp por canal | 🔜 |
| Saturación | Decapitator, Saturn 2, Trash 2 | Saturador/distorsión por canal | 🔜 (base en máster) |
| Reverb/Delay | Valhalla (Shimmer/Room), FabFilter | FX de envío (reverb/delay) | parcial (reverb en acordes) |
| Sidechain/shaping | LFO Tool, ShaperBox | Sidechain/automatización de volumen | parcial (pump) |
| Mastering | iZotope Ozone, LANDR | Cadena de máster + LUFS | parcial (cadena ✅, LUFS 🔜) |
| Stems / separación | RX, lalal.ai | Export stems ✅ / separación IA 🔜 | parcial |

Cadena típica de referencia (melodic techno): *synth → EQ (Pro-Q) → saturación
(Saturn) → reverb (Valhalla) → sidechain (LFO Tool)*. Es el patrón que el
mezclador + FX por canal de la plataforma debe reproducir nativamente.

Fuentes: [Output – Best VST plugins for techno](https://output.com/blog/best-vst-plugins-for-techno),
[Transition Studio – Top plugins progressive/melodic 2025](https://www.transition.studio/blog/the-top-10-synth-sound-design-plugins-for-progressive-house-melodic-techno-in-2025),
[We Make Dance Music – Essential plugin types](https://www.wemakedancemusic.com/en/news/essential-plugin-types-melodic-techno-production),
[Insomniac – Adrián Mills](https://www.insomniac.com/music/artists/adrian-mills/).
