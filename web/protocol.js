// Bluetooth-Protokoll zwischen Webseite und Clip.
// Die Spezifikation steht in docs/PROTOCOL.md. Diese Datei und die Firmware müssen übereinstimmen.

export const W = 16;
export const H = 8;
export const FRAME_BYTES = W * H * 3; // RGB888, Zeile für Zeile, oben links zuerst

// Nordic UART Service: Standard-UUIDs, funktionieren auch mit Test-Apps wie nRF Connect.
export const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Webseite schreibt hierhin
export const DEVICE_NAME_PREFIX = 'Hairclip';

export const MAGIC = 0xa5;
export const TYPE = { ANIM: 1, TEXT: 2, PHOTO: 3, BRIGHTNESS: 4, OFF: 5 };
export const MAX_ANIM_FRAMES = 24;
export const MAX_TEXT_COLUMNS = 4000;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

export function packet(type, payload = new Uint8Array(0)) {
  if (payload.length > 0xffff) throw new RangeError('Payload zu gross');
  const out = new Uint8Array(4 + payload.length);
  out[0] = MAGIC;
  out[1] = type;
  out[2] = payload.length & 0xff;
  out[3] = payload.length >> 8;
  out.set(payload, 4);
  return out;
}

export function animPacket(frames, fps) {
  if (!frames.length || frames.length > MAX_ANIM_FRAMES) {
    throw new RangeError(`Animation braucht 1 bis ${MAX_ANIM_FRAMES} Bilder`);
  }
  const p = new Uint8Array(2 + frames.length * FRAME_BYTES);
  p[0] = clamp(fps, 1, 30);
  p[1] = frames.length;
  frames.forEach((f, i) => {
    if (f.length !== FRAME_BYTES) throw new RangeError('Bild hat falsche Grösse');
    p.set(f, 2 + i * FRAME_BYTES);
  });
  return packet(TYPE.ANIM, p);
}

// cols: ein Byte pro Pixelspalte, Bit 0 = oberste Zeile
export function textPacket(cols, rgb, speed) {
  const w = cols.length;
  if (w < 1 || w > MAX_TEXT_COLUMNS) throw new RangeError('Text ist leer oder zu lang');
  const p = new Uint8Array(6 + w);
  p[0] = clamp(rgb[0], 0, 255);
  p[1] = clamp(rgb[1], 0, 255);
  p[2] = clamp(rgb[2], 0, 255);
  p[3] = clamp(speed, 1, 10);
  p[4] = w & 0xff;
  p[5] = w >> 8;
  p.set(cols, 6);
  return packet(TYPE.TEXT, p);
}

export function rgb565Bytes(rgba, w, h) {
  const out = new Uint8Array(w * h * 2);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const v = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
    out[i * 2] = v >> 8; // big-endian
    out[i * 2 + 1] = v & 0xff;
  }
  return out;
}

export function photoPacket(rgba, w = 64, h = 64) {
  const px = rgb565Bytes(rgba, w, h);
  const p = new Uint8Array(2 + px.length);
  p[0] = w;
  p[1] = h;
  p.set(px, 2);
  return packet(TYPE.PHOTO, p);
}

export const brightnessPacket = (v) => packet(TYPE.BRIGHTNESS, Uint8Array.of(clamp(v, 0, 255)));
export const offPacket = () => packet(TYPE.OFF);

// Bluetooth-Schreibzugriffe sind klein (Standard: 20 Bytes pro Paket).
export function* chunks(bytes, size = 20) {
  for (let i = 0; i < bytes.length; i += size) yield bytes.subarray(i, i + size);
}
