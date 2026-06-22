# TechnoForge Live UX Blueprint

Referencia de producto para convertir TechnoForge en un estudio de techno serio
en el navegador. Este documento usa el manual de Ableton Live 12 como mapa de
UX, no como plantilla visual literal: copiamos la logica de trabajo profesional,
no el producto.

## Objetivo

TechnoForge debe dejar de sentirse como un secuenciador web y pasar a sentirse
como una mini-DAW enfocada en techno:

- crear ideas rapido con IA y generadores locales;
- lanzar clips por escenas;
- editar el clip activo abajo;
- mezclar por pistas y retornos;
- exportar MIDI, WAV y stems;
- mantener siempre el control humano sobre lo que propone la IA.

## Lectura aplicada del manual de Live 12

Capitulos consultados del PDF `live12-manual-en.pdf`:

- Live Concepts: Control Bar, Status Bar, Browser, Tracks, Mixer.
- Working with the Browser: busqueda, categorias, resultados, preescucha y
  contenido arrastrable al set.
- Arrangement View: linea temporal para estructurar canciones completas.
- Session View: clips en columnas de pista y escenas por filas, pensadas para
  construir ideas en directo.
- Clip View: editor inferior del clip seleccionado, con notas, propiedades,
  loop, groove, escala y herramientas generativas.
- MIDI Tools: transformaciones y generadores como Rhythm, Seed, Shape, Stacks y
  Euclidean.
- Launching Clips / Follow Actions: variacion automatica y no repetitiva.

## Arquitectura UX objetivo

### 1. Control Bar

La parte superior debe concentrar transporte, tempo, posicion, exportacion y
acciones globales. No debe competir con la composicion.

En TechnoForge:

- transporte Play/Stop;
- posicion musical compas:tiempo:paso;
- analizador de espectro compacto;
- botones de generar idea, track duro, modo Track, MIDI, WAV y Stems.

### 2. Browser

El lateral izquierdo debe ser una libreria de produccion, no un menu decorativo.
Debe servir para encontrar presets, generadores, transformaciones y salidas.

En TechnoForge:

- busqueda;
- filtros Todo / Presets / Generadores / Transformar / Salida;
- resultados accionables;
- AI Producer, Rhythm Seed, Section Seed, Mutar Tramo y Arreglo Club.

Siguiente nivel:

- preview de presets;
- tags por energia, estilo, groove y oscuridad;
- carpeta de samples propia;
- arrastrar un preset o generador sobre una pista.

### 3. Session View

El centro debe funcionar como Live Session View: columnas = pistas, filas =
escenas, celdas = clips. Esto elimina la sensacion de juguete y da una lectura
de DAW.

En TechnoForge:

- columnas Kick, Clap, Hats, Open, Bass y Stab;
- retornos A Reverb, B Delay y Main;
- escenas por tramo;
- clips llenos/vacios con densidad musical;
- seleccion de clip para editarlo abajo.

Siguiente nivel:

- lanzar escenas completas;
- Follow Actions por clip;
- quantization configurable;
- duplicar/mutar clips desde el propio slot.

### 4. Clip View

El panel inferior debe mostrar el clip activo, igual que un productor espera:
propiedades, notas, probabilidades, ratchets y edicion precisa.

En TechnoForge:

- nombre del clip y pista;
- Start, Length, Grid y Scale;
- tabs Notes / Prob / Ratchet;
- 16 pasos editables;
- seleccion sincronizada con la matriz central.

Siguiente nivel:

- piano roll completo por clip;
- editor de envolventes;
- groove por clip;
- generadores MIDI dentro del clip.

### 5. Mixer y Returns

La mezcla no puede ser un añadido. Una DAW profesional deja ver pista, retorno y
master como parte de la composicion.

En TechnoForge:

- mini-mixer bajo cada columna;
- mute/solo por pista;
- medidores de nivel;
- retornos A/B y Main visibles en la Session View;
- rack de efectos y mezcla en el panel inferior.

Siguiente nivel:

- sends por clip/pista;
- faders mas compactos tipo mixer real;
- snapshots de mezcla por escena;
- medidor LUFS visible en master.

### 6. IA real, no boton decorativo

La IA debe modificar el proyecto simbolico, no devolver texto bonito. Su salida
debe ser aplicable, editable y exportable.

Contrato de IA:

- entrada: brief, estilo, bpm, tono, escala, energia, swing, rumble,
  humanizacion, estado actual del proyecto;
- salida: JSON estructurado con secciones, patrones, bajo, stabs, mezcla,
  macros y notas de produccion;
- validacion: si la respuesta falla, se usa fallback local sin romper la UI;
- no repeticion: cada generacion debe variar estructura, densidad, ritmica,
  alturas, transicion y mezcla.

Estado actual:

- endpoint `/api/ai-producer` conectado a OpenAI;
- fallback local cuando la API falla;
- mensajes de fallo preservados para diagnostico;
- variable `OPENAI_API_KEY` en Vercel.

Nota operativa:

- si OpenAI devuelve `billing_not_active`, la integracion esta bien pero la
  cuenta necesita billing activo. La app sigue usable con fallback local.

## Checklist de calidad profesional

Antes de produccion, TechnoForge debe cumplir:

- no bloquear Chrome al generar, reproducir o exportar;
- no recalcular layout en bucles de audio;
- Play/Stop debe responder siempre;
- la UI debe seguir usable con pantalla estrecha;
- consola sin errores;
- export MIDI/WAV/Stems no debe congelar el hilo principal mas de lo necesario;
- la IA nunca debe dejar el proyecto en estado vacio o corrupto;
- todo cambio importante debe poder guardarse en `.tfp`.

## Fases de reconstruccion

### Fase 1 - Shell DAW y Session View

Estado: implementado.

- Browser izquierdo.
- Session View central.
- Inspector/pro desk derecho.
- Clip View inferior.
- Piano roll Bajo/Stab conservado.
- Mixer y racks conservados.

### Fase 2 - Clip View profundo

- piano roll por clip;
- propiedades de loop y launch;
- probabilidad y ratchet visuales;
- herramientas Rhythm, Seed, Shape y Euclidean dentro del clip.

### Fase 3 - IA productora

- generacion de arreglo completo por brief;
- variaciones no repetitivas;
- acciones conversacionales: "mas Adrian Mills", "mas rumble", "drop mas seco";
- memoria de proyecto para respetar ediciones manuales.

### Fase 4 - Browser de libreria

- presets versionados;
- samples propios;
- tags;
- preview;
- drag and drop a pistas y clips.

### Fase 5 - Produccion y colaboracion

- guardado en nube opcional;
- historial/undo robusto;
- compartir proyectos;
- plantillas de artistas/estilos;
- analitica de errores y rendimiento.

## Regla de producto

La pantalla principal no debe explicar la app: debe ser la app. Si un productor
de techno abre TechnoForge, debe poder construir un loop, convertirlo en escena,
variarlo con IA, editar el clip, mezclarlo y exportarlo sin salir del primer
viewport.
