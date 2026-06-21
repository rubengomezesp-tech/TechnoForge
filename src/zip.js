/*
 * zip.js — Empaquetador ZIP mínimo (método "store", sin compresión).
 * Sin dependencias: escribe los bytes a mano, igual que midi.js y el codificador
 * WAV. Sirve para juntar varios archivos (p. ej. los stems WAV) en un solo .zip
 * que el usuario descomprime y arrastra a su DAW.
 */
(function (global) {
  // Tabla CRC-32 (la que exige el formato ZIP para cada archivo)
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // Fecha y hora empaquetadas en formato DOS (campos obligatorios del ZIP)
  function dosDateTime(d) {
    const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31);
    const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time: time & 0xffff, date: date & 0xffff };
  }

  function strBytes(s) {
    const out = [];
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
    return out;
  }

  /*
   * create(files) -> Uint8Array con un .zip
   * files = [{ name: "01-kick.wav", data: Uint8Array }]
   */
  function create(files) {
    const { time, date } = dosDateTime(new Date());
    const u16 = (n) => [n & 255, (n >>> 8) & 255];
    const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

    const chunks = [];
    let offset = 0;
    const push = (bytes) => {
      const u = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
      chunks.push(u);
      offset += u.length;
    };

    const metas = [];

    // --- Cabeceras y datos locales (un bloque por archivo) ---
    for (const f of files) {
      const nameBytes = strBytes(f.name);
      const crc = crc32(f.data);
      metas.push({ nameBytes, crc, size: f.data.length, localOffset: offset });
      push([
        ...u32(0x04034b50),                 // firma "local file header"
        ...u16(20),                         // versión necesaria
        ...u16(0),                          // flags
        ...u16(0),                          // método: 0 = store (sin compresión)
        ...u16(time), ...u16(date),
        ...u32(crc),
        ...u32(f.data.length),              // tamaño comprimido
        ...u32(f.data.length),              // tamaño sin comprimir
        ...u16(nameBytes.length),
        ...u16(0),                          // extra field
        ...nameBytes,
      ]);
      push(f.data);
    }

    // --- Directorio central (una entrada por archivo) ---
    const centralStart = offset;
    for (const m of metas) {
      push([
        ...u32(0x02014b50),                 // firma "central directory"
        ...u16(20), ...u16(20),
        ...u16(0), ...u16(0),
        ...u16(time), ...u16(date),
        ...u32(m.crc),
        ...u32(m.size), ...u32(m.size),
        ...u16(m.nameBytes.length),
        ...u16(0), ...u16(0),               // extra, comment
        ...u16(0),                          // nº de disco
        ...u16(0),                          // attrs internos
        ...u32(0),                          // attrs externos
        ...u32(m.localOffset),
        ...m.nameBytes,
      ]);
    }
    const centralSize = offset - centralStart;

    // --- Fin del directorio central ---
    push([
      ...u32(0x06054b50),
      ...u16(0), ...u16(0),
      ...u16(files.length), ...u16(files.length),
      ...u32(centralSize),
      ...u32(centralStart),
      ...u16(0),                            // comentario
    ]);

    // Concatenar todo en un único buffer
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    return out;
  }

  global.TechnoZip = { create };
})(window);
