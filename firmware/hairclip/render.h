// Zeichnet die Bildschirme, die der Clip selbst erzeugt: Tarot, Mischen, Uhr, Lauftext, Startbild.
// Gleiche Regeln wie web/scene.js (die Vorschau auf der Webseite). Änderungen immer an beiden Stellen.
//
// Gezeichnet wird in Streifen von BAND_ROWS Zeilen: Jede Szene wird für jeden Streifen neu berechnet
// und der Streifen dann ans Display geschickt. So reichen 22 KB Speicher statt 109 KB für ein ganzes Bild.
#pragma once
#include <Arduino.h>

struct TarotCard {
  uint8_t id;
  bool reversed;
};

struct ClockTime {
  int h, m, s, wd, d, mo, y;
};

namespace render {

void tarot(const TarotCard *cards, int count, int index);
void shuffle(int step);
void clock(const ClockTime &t, uint16_t color, int style);
// Lauftext: Streifen (Spalte für Spalte, ceil(h/8) Bytes pro Spalte, Bit 0 oben), Versatz wie im Protokoll
void textStrip(const uint8_t *bits, int w, int h, uint16_t color, int offset);
void splash();

}  // namespace render

constexpr int SHUFFLE_STEPS = 8;
constexpr int SHUFFLE_MS = 150;
constexpr int SPREAD_MS = 6000;
