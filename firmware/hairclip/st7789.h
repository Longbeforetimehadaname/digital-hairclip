// Kleiner Treiber für das ST7789-Display über SPI, ohne zusätzliche Bibliothek.
#pragma once
#include <Arduino.h>

namespace tft {

constexpr int W = 320;  // Querformat
constexpr int H = 170;

void begin();
void backlight(uint8_t level);  // 0–255
void window(int x, int y, int w, int h);  // danach pixels() oder fill()
void pixels(const uint8_t *data, size_t bytes);  // RGB565, big endian
void fill(uint16_t color, uint32_t count);       // gleiche Farbe count-mal
void end();  // nach dem Zeichnen aufrufen (gibt den SPI-Bus frei)
void fillScreen(uint16_t color);
void sleep(bool on);

inline uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) {
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}

}  // namespace tft
