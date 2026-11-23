// Aufbau der Schriftdaten (siehe font_data.h, erzeugt aus tools/fonts.json)
#pragma once
#include <stdint.h>
#ifndef PROGMEM
#define PROGMEM
#endif

struct Glyph {
  uint16_t code;  // Unicode-Zeichen
  uint8_t adv;    // Vorschub in Pixeln
  uint8_t w, h;   // Grösse der Bitmap
  int8_t dx, dy;  // Lage der Bitmap relativ zum Stift (dy relativ zur Grundlinie)
  uint32_t off;   // Start in den Bitmap-Daten
};

struct Font {
  const Glyph *glyphs;
  uint16_t count;
  const uint8_t *bits;  // 2 Bit pro Pixel, Zeile für Zeile, niedrigste Bits zuerst
  uint8_t ascent, descent;
};
