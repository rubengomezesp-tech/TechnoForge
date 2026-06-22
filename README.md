# 🎛️ TechnoForge

Tu **asistente de producción de techno** que funciona en el navegador. Genera
ideas y patrones (bombo, bajo, hats, claps, stabs), los reproduce, los puedes
editar a mano y exportarlos a **MIDI** (para terminarlos en cualquier DAW) o a
**WAV** (para escucharlos o compartirlos).

Sin instalar nada, sin cuentas y sin costes.

---

## 🖥️ Abrirlo en localhost (servidor local)

Si prefieres servirlo en `http://localhost` en lugar de abrir el archivo
directamente, levanta un mini-servidor con **Python** (no requiere instalar
dependencias del proyecto):

1. Abre una terminal **en la carpeta del proyecto**:
   - **Windows**: en el Explorador, haz clic en la barra de la ruta, escribe
     `powershell` y pulsa Enter.
   - **Mac**: clic derecho en la carpeta → *Servicios* → *Nuevo terminal en la carpeta*.
2. Arranca el servidor:
   - **Windows**: `py -m http.server 8000`
   - **Mac/Linux**: `python3 -m http.server 8000`
3. Abre el navegador en 👉 **http://localhost:8000**
4. Para pararlo: vuelve a la terminal y pulsa `Ctrl + C`.

> Alternativa con **VS Code**: instala la extensión *Live Server*, abre la
> carpeta, clic derecho en `index.html` → *Open with Live Server*.

---

## ▶️ Cómo usarlo (no hace falta saber programar)

1. Descarga este proyecto y haz **doble clic en `index.html`**. Se abre en tu
   navegador (Chrome, Edge o Firefox). Necesitas conexión a internet la primera
   vez, porque el motor de audio (Tone.js) se carga desde la web.
2. Pulsa **🎲 Generar idea**: aparece un patrón de techno completo.
3. Pulsa **▶ Play** para escucharlo en bucle.
4. Juega con los controles:
   - **Emoción** 💜: lo más importante. Elige el *sentimiento* (Melancolía,
     Esperanza, Épica, Oscuridad, Nostalgia, Grandeza, Tensión, Liberación) y la
     app genera una **progresión de acordes** acorde a esa emoción, con el bajo
     siguiendo la armonía. Es el *Motor de Armonía Emocional* (ver `docs/VISION.md`).
   - **BPM**: velocidad (el techno suele ir a 125–132).
   - **Tonalidad** y **Escala**: el "color" del bajo y los acordes (menor =
     oscuro, frigia = aún más oscuro, dórica = groovy, mayor = luminosa, lidia =
     asombro). La emoción ya elige una escala; aquí puedes afinarla a mano.
   - **Energía**: cuánto relleno y densidad tiene el patrón.
   - **Swing**: ese "balanceo" que hace que no suene tan recto.
5. **Estilo**: elige Peak-time, Hipnótico, Melódico o Industrial para cambiar el
   carácter del patrón.
6. **Modo Track** 🎚️: pulsa **🔁 Bucle / 🎚️ Track** para alternar entre escuchar
   solo el bucle de un compás o el **track completo arreglado automáticamente**
   (Intro · Build · Drop · Break · Drop 2 · Outro), con *risers*, *impactos* y
   *fills*. La línea de tiempo de arriba muestra la sección que suena.
7. **Edita y mezcla a mano**: pulsa cualquier celda para activar/desactivar un
   golpe. Cada pista tiene **S** (solo), **M** (silenciar), un **fader de volumen**,
   un **paneo** (izquierda/derecha) y **🎲** (regenerar solo esa pista).
8. **Guarda tu trabajo** (barra *Proyecto*): se **autoguarda** en el navegador (al
   recargar sigue ahí), y con **💾 Guardar** te bajas un archivo `.tfp` para
   guardarlo aparte o pasarlo a otro equipo; **📂 Cargar** lo recupera y **✨ Nuevo**
   empieza de cero.
8. Exporta:
   - **⬇ MIDI**: te baja un `.mid` con cada instrumento en su propia pista.
     Lo abres en Ableton / FL Studio / Bitwig y lo terminas con tus sonidos.
   - **⬇ WAV**: te baja el audio (4 compases en modo Bucle, o el **track entero**
     en modo Track) para escuchar o compartir.
   - **⬇ Stems**: te baja un `.zip` con **cada instrumento en su propio WAV** (en
     crudo, sin máster), listo para arrastrar a tu DAW y mezclar/masterizar con
     tus plugins. En modo Track incluye un stem aparte con los FX del arreglo.

> El MIDI es lo más potente: te da la **idea musical** lista para que la
> conviertas en un temazo en tu DAW con tus propios plugins.

### IA real

El botón **Crear con IA** llama a un endpoint seguro en Vercel (`/api/ai-producer`)
que usa `OPENAI_API_KEY` como variable de entorno. La key no se expone en el
navegador. La IA devuelve controles, macros, arreglo y patrones editables; la app
guarda firmas recientes para pedir variaciones nuevas y evitar repetir estructuras.

---

## 🧠 Qué hace por dentro (las "reglas" del techno)

- **Bombo**: 4x4 (los cuatro tiempos), el corazón del techno.
- **Open hats**: en el contratiempo, ese "tss-tss" característico.
- **Closed hats**: relleno con acentos, según la energía.
- **Clap**: en los tiempos 2 y 4.
- **Bajo**: rodante en las semicorcheas que no chocan con el bombo, en la
  tonalidad elegida, con saltos a la quinta y la octava.
- **Stabs**: la **progresión de acordes** de la emoción (un acorde por tiempo, con
  reverb cinematográfica), más stabs sincopados para el groove.
- **Sidechain / "pump"**: el bajo y los acordes "respiran" con cada bombo,
  como en una producción real.

---

## 🗺️ Hoja de ruta

Esto es la **Fase 0 (MVP)**. El plan completo está en
[`docs/ROADMAP.md`](docs/ROADMAP.md). En resumen:

- **Fase 1** — Arreglo automático (intro / break / drop / outro), variaciones,
  más motores de síntesis y mejores hats.
- **Fase 2** — Mezcla y **mastering automático** (lo que más dinero ahorra).
- **Fase 3** — Generación con IA de verdad (melodías/patrones aprendidos) y
  separación de stems de canciones existentes.

---

## 🛠️ Detalles técnicos

- 100% web, sin backend: `index.html` + `src/app.js` + `src/midi.js` + `src/styles.css`.
- Audio y secuenciador: [Tone.js](https://tonejs.github.io/).
- Exportación MIDI: escritor propio en `src/midi.js` (sin dependencias).
- Exportación WAV: renderizado offline + codificador PCM 16 bits propio.
- Exportación Stems: render por pista aislada + empaquetador ZIP propio (`src/zip.js`).

Para publicarlo gratis en internet se puede activar **GitHub Pages** sobre este
repositorio y tendrás una URL para abrirlo desde cualquier sitio.
