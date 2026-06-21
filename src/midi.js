/*
 * midi.js — Escritor mínimo de archivos MIDI (Standard MIDI File, formato 1).
 * Genera un .mid multipista a partir del patrón para que puedas abrirlo
 * y terminarlo en cualquier DAW (Ableton, FL Studio, Bitwig, etc.).
 *
 * No usa ninguna librería externa: escribe los bytes a mano.
 */
(function (global) {
  const PPQ = 96;                 // pulsos por negra
  const TICKS_PER_STEP = PPQ / 4; // un paso = una semicorchea (16 pasos por compás)

  // --- utilidades de bytes ---
  function vlq(value) {
    // Variable Length Quantity, como exige el formato MIDI
    const bytes = [value & 0x7f];
    value >>= 7;
    while (value > 0) {
      bytes.unshift((value & 0x7f) | 0x80);
      value >>= 7;
    }
    return bytes;
  }

  function strBytes(s) { return Array.from(s).map(c => c.charCodeAt(0)); }
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function u16(n) { return [(n >>> 8) & 255, n & 255]; }

  function chunk(id, dataBytes) {
    return [...strBytes(id), ...u32(dataBytes.length), ...dataBytes];
  }

  // Convierte una lista de eventos {tick, data:[...]} en bytes con delta-times
  function eventsToTrack(events) {
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    let last = 0;
    const out = [];
    for (const ev of events) {
      out.push(...vlq(ev.tick - last), ...ev.data);
      last = ev.tick;
    }
    // End of Track meta
    out.push(...vlq(0), 0xff, 0x2f, 0x00);
    return out;
  }

  // notes: [{step, pitch, velocity, durSteps, channel}]
  function buildNoteTrack(name, notes) {
    const events = [];
    events.push({ tick: 0, order: 0, data: [0xff, 0x03, name.length, ...strBytes(name)] });
    let order = 1;
    for (const n of notes) {
      const onTick = n.step * TICKS_PER_STEP;
      const offTick = onTick + Math.max(1, n.durSteps) * TICKS_PER_STEP - 1;
      const ch = n.channel & 0x0f;
      events.push({ tick: onTick, order: order++, data: [0x90 | ch, n.pitch, n.velocity] });
      events.push({ tick: offTick, order: order++, data: [0x80 | ch, n.pitch, 0] });
    }
    return chunk("MTrk", eventsToTrack(events));
  }

  /*
   * export(pattern, bpm) -> Uint8Array con el contenido del .mid
   * pattern = { kick, clap, chat, ohat (arrays de bool),
   *             bass (array de midi|null),
   *             stab (array de [midi,...]|null) }
   */
  function exportMidi(pattern, bpm) {
    // GM drum map (canal 10 => índice 9)
    const DRUM = { kick: 36, clap: 39, chat: 42, ohat: 46 };

    // Pista 0: tempo
    const microsPerBeat = Math.round(60000000 / bpm);
    const tempoTrack = chunk("MTrk", eventsToTrack([
      { tick: 0, order: 0, data: [0xff, 0x51, 0x03, (microsPerBeat >> 16) & 255, (microsPerBeat >> 8) & 255, microsPerBeat & 255] },
      { tick: 0, order: 1, data: [0xff, 0x03, 9, ...strBytes("TechnoForge")] },
    ]));

    // Batería (un solo MTrk en canal 9)
    const drumNotes = [];
    ["kick", "clap", "chat", "ohat"].forEach((k) => {
      pattern[k].forEach((on, step) => {
        if (on) drumNotes.push({ step, pitch: DRUM[k], velocity: 100, durSteps: 1, channel: 9 });
      });
    });
    const drumTrack = buildNoteTrack("Drums", drumNotes);

    // Bajo (canal 0)
    const bassNotes = [];
    pattern.bass.forEach((midi, step) => {
      if (midi != null) bassNotes.push({ step, pitch: midi, velocity: 110, durSteps: 1, channel: 0 });
    });
    const bassTrack = buildNoteTrack("Bass", bassNotes);

    // Stab / acordes (canal 1)
    const stabNotes = [];
    pattern.stab.forEach((chordArr, step) => {
      if (chordArr) chordArr.forEach((midi) =>
        stabNotes.push({ step, pitch: midi, velocity: 90, durSteps: 2, channel: 1 }));
    });
    const stabTrack = buildNoteTrack("Stab", stabNotes);

    const tracks = [tempoTrack, drumTrack, bassTrack, stabTrack];
    const header = chunk("MThd", [...u16(1), ...u16(tracks.length), ...u16(PPQ)]);

    const all = [...header];
    tracks.forEach(t => all.push(...t));
    return new Uint8Array(all);
  }

  function download(bytes, filename) {
    const blob = new Blob([bytes], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  global.TechnoMidi = { exportMidi, download };
})(window);
