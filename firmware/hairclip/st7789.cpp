#include "st7789.h"

#include <SPI.h>

#include "config.h"

namespace tft {

static SPIClass *spi = nullptr;
static const SPISettings SETTINGS(TFT_SPI_HZ, MSBFIRST, SPI_MODE0);

static void cmd(uint8_t c) {
  digitalWrite(PIN_TFT_DC, LOW);
  spi->write(c);
  digitalWrite(PIN_TFT_DC, HIGH);
}

static void command(uint8_t c, const uint8_t *data = nullptr, size_t n = 0) {
  spi->beginTransaction(SETTINGS);
  digitalWrite(PIN_TFT_CS, LOW);
  cmd(c);
  if (n) spi->writeBytes(data, n);
  digitalWrite(PIN_TFT_CS, HIGH);
  spi->endTransaction();
}

void begin() {
  pinMode(PIN_TFT_CS, OUTPUT);
  pinMode(PIN_TFT_DC, OUTPUT);
  pinMode(PIN_TFT_RST, OUTPUT);
  digitalWrite(PIN_TFT_CS, HIGH);
  digitalWrite(PIN_TFT_DC, HIGH);

#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PIN_TFT_BLK, 5000, 8);
#else
  ledcSetup(0, 5000, 8);
  ledcAttachPin(PIN_TFT_BLK, 0);
#endif
  backlight(0);

  spi = new SPIClass(VSPI);
  spi->begin(PIN_TFT_SCLK, -1, PIN_TFT_MOSI, -1);

  digitalWrite(PIN_TFT_RST, HIGH);
  delay(10);
  digitalWrite(PIN_TFT_RST, LOW);
  delay(20);
  digitalWrite(PIN_TFT_RST, HIGH);
  delay(150);

  command(0x01);  // Software-Reset
  delay(150);
  command(0x11);  // aus dem Schlaf
  delay(120);
  const uint8_t colmod = 0x55;  // 16 Bit pro Pixel
  command(0x3A, &colmod, 1);
  // MADCTL: MV (Zeilen/Spalten tauschen = Querformat) + Spiegelung je nach Einbaulage
  uint8_t madctl = TFT_ROTATE_180 ? 0xA0 : 0x60;
  if (TFT_BGR) madctl |= 0x08;
  command(0x36, &madctl, 1);
  command(TFT_INVERT ? 0x21 : 0x20);
  command(0x13);  // normale Anzeige
  fillScreen(0);
  command(0x29);  // Display an
  delay(20);
}

void backlight(uint8_t level) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(PIN_TFT_BLK, level);
#else
  ledcWrite(0, level);
#endif
}

static bool open = false;

void window(int x, int y, int w, int h) {
  if (open) {
    digitalWrite(PIN_TFT_CS, HIGH);
    spi->endTransaction();
  }
  const uint16_t x0 = x + TFT_X_OFFSET, x1 = x + w - 1 + TFT_X_OFFSET;
  const uint16_t y0 = y + TFT_Y_OFFSET, y1 = y + h - 1 + TFT_Y_OFFSET;
  spi->beginTransaction(SETTINGS);
  digitalWrite(PIN_TFT_CS, LOW);
  cmd(0x2A);
  spi->write16(x0);
  spi->write16(x1);
  cmd(0x2B);
  spi->write16(y0);
  spi->write16(y1);
  cmd(0x2C);
  open = true;
}

static void close() {
  if (!open) return;
  digitalWrite(PIN_TFT_CS, HIGH);
  spi->endTransaction();
  open = false;
}

void end() { close(); }

void pixels(const uint8_t *data, size_t bytes) {
  spi->writeBytes(data, bytes);
}

void fill(uint16_t color, uint32_t count) {
  static uint8_t buf[128];
  for (int i = 0; i < 64; i++) {
    buf[i * 2] = color >> 8;
    buf[i * 2 + 1] = color & 0xFF;
  }
  while (count) {
    const uint32_t n = count > 64 ? 64 : count;
    spi->writeBytes(buf, n * 2);
    count -= n;
  }
}

void fillScreen(uint16_t color) {
  window(0, 0, W, H);
  fill(color, (uint32_t)W * H);
  close();
}

void sleep(bool on) {
  close();
  command(on ? 0x28 : 0x29);  // Display aus / an
}

}  // namespace tft
