// Bluetooth-Protokoll zwischen Webseite und Clip (Version 2, Display 320 × 170 im Querformat).
// Die Spezifikation steht in docs/PROTOCOL.md. Diese Datei und die Firmware müssen übereinstimmen.

export const W = 320;
export const H = 170;
export const FRAME_BYTES = W * H * 4; // Bilder im Browser: RGBA, Zeile für Zeile, oben links zuerst

// Nordic UART Service: Standard-UUIDs, funktionieren auch mit Test-Apps wie nRF Connect.
export const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Webseite schreibt hierhin
export const DEVICE_NAME_PREFIX = 'Hairclip';

export const MAGIC = 0xa5;
export const TYPE = { FRAME: 1, TEXT: 2, PHOTO: 3, BRIGHTNESS: 4, OFF: 5 };
export const MAX_PAYLOAD = 40000; // grösste erlaubte Nutzdaten pro Paket (Puffer in der Firmware)
export const MAX_ANIM_FRAMES = 16;
export const MAX_ANIM_BYTES = 64000; // alle Bilder einer Animation zusammen, komprimiert (Speicher im Clip)
export const TEXT_H = 112; // Höhe des Textstreifens in Pixeln
export const PHOTO_ROWS = 34; // Foto-Zeilen pro Paket: 5 Pakete à 21 760 Bytes
export const CHUNK = 180; // Bytes pro Bluetooth-Schreibzugriff

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

export function packet(type, payload = new Uint8Array(0)) {
  if (payload.length > MAX_PAYLOAD) throw new RangeError('Paket zu gross');
  const out = new Uint8Array(4 + payload.length);
  out[0] = MAGIC;
  out[1] = type;
  out[2] = payload.length & 0xff;
  out[3] = payload.length >> 8;
  out.set(payload, 4);
  return out;
}

export const rgb565 = (r, g, b) => ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);

// Lauflängen-Kodierung eines ganzen Bildes (RGBA, W × H): Folge von [Anzahl (1–255), Farbe RGB565 big endian].
// Flächen in einer Farbe (schwarzer Hintergrund, Striche, Herz) werden dadurch sehr klein.
export function rle565(rgba) {
  if (rgba.length !== FRAME_BYTES) throw new RangeError('Bild hat falsche Grösse');
  const out = [];
  let run = 0;
  let cur = -1;
  for (let i = 0; i < W * H; i++) {
    const c = rgb565(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    if (c === cur && run < 255) {
      run += 1;
    } else {
      if (run) out.push(run, cur >> 8, cur & 0xff);
      cur = c;
      run = 1;
    }
  }
  out.push(run, cur >> 8, cur & 0xff);
  return Uint8Array.from(out);
}

// Gegenstück zu rle565, so wie es die Firmware macht. Ergebnis: W × H Farben im RGB565-Format.
export function unrle565(bytes) {
  const out = new Uint16Array(W * H);
  let p = 0;
  for (let i = 0; i + 2 < bytes.length; i += 3) {
    const n = bytes[i];
    const c = (bytes[i + 1] << 8) | bytes[i + 2];
    if (p + n > out.length) throw new RangeError('Zu viele Pixel');
    out.fill(c, p, p + n);
    p += n;
  }
  if (p !== out.length) throw new RangeError('Zu wenige Pixel');
  return out;
}

// Eine Animation (oder ein Standbild) als Folge von FRAME-Paketen, ein Paket pro Bild.
export function animPackets(frames, fps) {
  if (!frames.length || frames.length > MAX_ANIM_FRAMES) {
    throw new RangeError(`Animation braucht 1 bis ${MAX_ANIM_FRAMES} Bilder`);
  }
  const f = clamp(fps, 1, 30);
  let total = 0;
  return frames.map((frame, i) => {
    const runs = rle565(frame);
    total += runs.length;
    if (total > MAX_ANIM_BYTES || 3 + runs.length > MAX_PAYLOAD) {
      throw new RangeError('Die Animation ist zu aufwendig für den Clip. Nimm weniger Bilder oder weniger Farbwechsel.');
    }
    const p = new Uint8Array(3 + runs.length);
    p[0] = i;
    p[1] = frames.length;
    p[2] = f;
    p.set(runs, 3);
    return packet(TYPE.FRAME, p);
  });
}

// bits: Textstreifen, Spalte für Spalte, je ceil(h/8) Bytes pro Spalte, Bit 0 = oberste Zeile.
export function textPacket(bits, w, h, rgb, speed) {
  const per = Math.ceil(h / 8);
  if (w < 1 || h < 1 || h > H || w > 0xffff) throw new RangeError('Text ist leer');
  if (bits.length !== w * per) throw new RangeError('Textstreifen hat falsche Grösse');
  if (7 + bits.length > MAX_PAYLOAD) throw new RangeError('Der Text ist zu lang.');
  const p = new Uint8Array(7 + bits.length);
  p[0] = clamp(rgb[0], 0, 255);
  p[1] = clamp(rgb[1], 0, 255);
  p[2] = clamp(rgb[2], 0, 255);
  p[3] = clamp(speed, 1, 10);
  p[4] = h;
  p[5] = w & 0xff;
  p[6] = w >> 8;
  p.set(bits, 7);
  return packet(TYPE.TEXT, p);
}

// Foto (RGBA, W × H) als Folge von PHOTO-Paketen mit je PHOTO_ROWS Zeilen RGB565 big endian.
export function photoPackets(rgba) {
  if (rgba.length !== FRAME_BYTES) throw new RangeError('Foto hat falsche Grösse');
  const out = [];
  for (let y = 0; y < H; y += PHOTO_ROWS) {
    const rows = Math.min(PHOTO_ROWS, H - y);
    const p = new Uint8Array(3 + rows * W * 2);
    p[0] = y & 0xff;
    p[1] = y >> 8;
    p[2] = rows;
    for (let i = 0; i < rows * W; i++) {
      const s = (y * W + i) * 4;
      const c = rgb565(rgba[s], rgba[s + 1], rgba[s + 2]);
      p[3 + i * 2] = c >> 8;
      p[4 + i * 2] = c & 0xff;
    }
    out.push(packet(TYPE.PHOTO, p));
  }
  return out;
}

export const brightnessPacket = (v) => packet(TYPE.BRIGHTNESS, Uint8Array.of(clamp(v, 0, 255)));
export const offPacket = () => packet(TYPE.OFF);

// Mehrere Pakete zu einem Byte-Strom zusammenhängen (sie werden direkt nacheinander gesendet).
export function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function* chunks(bytes, size = CHUNK) {
  for (let i = 0; i < bytes.length; i += size) yield bytes.subarray(i, i + size);
}
