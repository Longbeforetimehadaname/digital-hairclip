// Firmware für den digitalen Haarclip: ESP32-DevKit + Display 1,9" ST7789 (320 × 170 quer).
// Protokoll: docs/PROTOCOL.md (Version 2). Einstellungen und Pins: config.h.
//
// Was der Clip kann:
//  - Bilder, Animationen, Lauftext, Fotos, Uhr von der Webseite anzeigen (Bluetooth)
//  - Tarot ohne Handy: Knopf kurz = eine Karte, lange = drei Karten (Vergangenheit, Gegenwart, Zukunft),
//    Schütteln = eine Karte (nur mit Erschütterungsschalter, siehe config.h)
//  - Gezogene Karten an die Webseite melden, damit sie dort die Deutung zeigt
#include <Arduino.h>
#include <math.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <esp_random.h>
#include <freertos/FreeRTOS.h>
#include <freertos/stream_buffer.h>
#include <time.h>

#include "config.h"
#include "render.h"
#include "st7789.h"
#include "tarot_data.h"

// ---------- Protokoll (gleich wie web/protocol.js) ----------
static const char *SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
static const char *RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
static const char *TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

constexpr uint8_t MAGIC = 0xA5;
enum : uint8_t { T_FRAME = 1, T_TEXT = 2, T_PHOTO = 3, T_BRIGHTNESS = 4, T_OFF = 5, T_TAROT = 6, T_CLOCK = 7, T_DVD = 8 };
constexpr size_t MAX_PAYLOAD = 40000;
constexpr size_t MAX_ANIM_BYTES = 64000;
constexpr int MAX_ANIM_FRAMES = 16;
constexpr uint32_t PIXELS = (uint32_t)tft::W * tft::H;

// ---------- Speicher ----------
// Die grossen Puffer werden beim Start geholt (malloc): Als feste Variablen passen sie nicht in den
// Speicherbereich, den der ESP32 dafür hat.
static uint8_t *packetBuf = nullptr;  // 4 + MAX_PAYLOAD Bytes
static size_t packetFill = 0;
static uint32_t packetLastByte = 0;

static uint8_t *content = nullptr;  // MAX_ANIM_BYTES: Animation ODER Textstreifen (nie beides gleichzeitig)
static uint32_t frameOff[MAX_ANIM_FRAMES], frameLen[MAX_ANIM_FRAMES];
static int animCount = 0, animExpected = 0, animFps = 1, animIndex = 0;
static uint32_t animUsed = 0, animNext = 0;

static int textW = 0, textH = 0, textSpeed = 4, textOffset = -1;
static uint16_t textColor = 0xFFFF;
static uint32_t textStart = 0;

static TarotCard tarotCards[3];
static int tarotCount = 0, tarotShown = -1;
static uint32_t tarotStart = 0;

// DVD-Logo, gleiche Regeln wie createDvd() in web/presets.js. Der Clip würfelt selbst (esp_random).
static const uint8_t DVD_GLYPH[][7] = {
    {0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110},  // D
    {0b10001, 0b10001, 0b10001, 0b01010, 0b01010, 0b00100, 0b00100},  // V
    {0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111},  // I
    {0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111},  // E
    {0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110},  // O
};
static const int DVD_W = 80, DVD_H = 42;
static float dvdX = 0, dvdY = 0, dvdVx = 40, dvdVy = 30;
static int dvdColorI = 0;
static uint32_t dvdNext = 0, dvdLast = 0;

static uint32_t clockBase = 0, clockMillis = 0;
static int clockStyle = 0, clockLastSecond = -1;
static uint16_t clockColor = 0xFFFF;

enum Mode { M_SPLASH, M_WAIT, M_ANIM, M_TEXT, M_STATIC, M_TAROT, M_CLOCK, M_DVD, M_OFF };
static Mode mode = M_SPLASH;
static uint8_t brightness = 200;
static uint32_t lastActivity = 0;

// ---------- Bluetooth ----------
static StreamBufferHandle_t rxStream;
static BLECharacteristic *txChar = nullptr;
static volatile bool connected = false;

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    // Läuft im Bluetooth-Task: Daten nur in den Puffer legen, verarbeitet wird in loop().
    // Ist der Puffer voll, wartet die Antwort an die Webseite. So bremst der Clip das Senden selbst.
    xStreamBufferSend(rxStream, c->getData(), c->getLength(), pdMS_TO_TICKS(2000));
  }
};

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override { connected = true; }
  void onDisconnect(BLEServer *) override {
    connected = false;
    BLEDevice::startAdvertising();  // wieder auffindbar sein
  }
};

static void bleBegin() {
  rxStream = xStreamBufferCreate(16384, 1);
  BLEDevice::init(DEVICE_NAME);
  BLEDevice::setMTU(247);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService *service = server->createService(SERVICE_UUID);
  BLECharacteristic *rx = service->createCharacteristic(
      RX_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new RxCallbacks());
  txChar = service->createCharacteristic(TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());
  service->start();
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
}

static void notifyTarot() {
  if (!connected || !txChar) return;
  uint8_t p[4 + 7];
  const int n = tarotCount;
  p[0] = MAGIC;
  p[1] = T_TAROT;
  p[2] = 1 + n * 2;
  p[3] = 0;
  p[4] = n;
  for (int i = 0; i < n; i++) {
    p[5 + i * 2] = tarotCards[i].id;
    p[6 + i * 2] = tarotCards[i].reversed ? 1 : 0;
  }
  txChar->setValue(p, 5 + n * 2);
  txChar->notify();
}

// ---------- Anzeige ein/aus ----------
static bool sleeping = false;

static void wake() {
  lastActivity = millis();
  if (!sleeping) return;
  sleeping = false;
  tft::sleep(false);
  tft::backlight(brightness);
}

static void goToSleep() {
  mode = M_OFF;
  sleeping = true;
  tft::backlight(0);
  tft::fillScreen(0);
  tft::sleep(true);
}

// ---------- Tarot ----------
static void startTarot(int count, bool fromClip) {
  wake();
  tarotCount = count;
  if (fromClip) {
    uint8_t ids[TAROT_COUNT];
    for (int i = 0; i < TAROT_COUNT; i++) ids[i] = i;
    for (int i = 0; i < count; i++) {  // Fisher-Yates mit echtem Zufall aus dem Funkteil
      const int j = i + esp_random() % (TAROT_COUNT - i);
      const uint8_t t = ids[i];
      ids[i] = ids[j];
      ids[j] = t;
      tarotCards[i] = {ids[i], (esp_random() % 100) < TAROT_REVERSED_PERCENT};
    }
    notifyTarot();
  }
  mode = M_TAROT;
  tarotStart = millis();
  tarotShown = -1;
}

static void updateTarot() {
  const uint32_t t = millis() - tarotStart;
  const uint32_t shuffleEnd = SHUFFLE_STEPS * SHUFFLE_MS;
  int show;
  if (t < shuffleEnd) {
    show = 100 + t / SHUFFLE_MS;  // 100+ = Mischen, Schritt
  } else {
    show = tarotCount == 3 ? ((t - shuffleEnd) / SPREAD_MS) % 3 : 0;
  }
  if (show == tarotShown) return;
  tarotShown = show;
  if (show >= 100) render::shuffle(show - 100);
  else render::tarot(tarotCards, tarotCount, show);
}

// ---------- DVD: prallt wie ein Bildschirmschoner ab, nur die Farbe wechselt ----------
static const uint8_t DVD_COLS[][3] = {{255, 40, 40}, {40, 90, 255}, {40, 210, 70}, {255, 220, 40}};

static void dvdStamp(uint8_t *buf, int glyph, int x, int y, int scale, uint16_t color) {
  const uint8_t hi = color >> 8, lo = color & 0xFF;
  for (int row = 0; row < 7; row++) {
    for (int col = 0; col < 5; col++) {
      if ((DVD_GLYPH[glyph][row] & (0x10 >> col)) == 0) continue;
      for (int yy = 0; yy < scale; yy++) {
        uint8_t *p = buf + ((y + row * scale + yy) * DVD_W + (x + col * scale)) * 2;
        for (int xx = 0; xx < scale; xx++) {
          p[0] = hi;
          p[1] = lo;
          p += 2;
        }
      }
    }
  }
}

static void dvdDraw() {
  static uint8_t buf[DVD_W * DVD_H * 2];
  const uint16_t dvdColor = tft::rgb(DVD_COLS[dvdColorI][0], DVD_COLS[dvdColorI][1], DVD_COLS[dvdColorI][2]);
  memset(buf, 0, sizeof buf);
  dvdStamp(buf, 0, 0, 0, 4, dvdColor);
  dvdStamp(buf, 1, 30, 0, 4, dvdColor);
  dvdStamp(buf, 2, 60, 0, 4, dvdColor);
  const int vidX = 11;  // VIDEO ist schmaler und sitzt in der Mitte
  const int letters[] = {1, 3, 0, 2, 4};  // V E D I O
  for (int i = 0; i < 5; i++) dvdStamp(buf, letters[i], vidX + i * 12, 28, 2, dvdColor);
  tft::fillScreen(0);
  tft::window((int)(dvdX + 0.5f), (int)(dvdY + 0.5f), DVD_W, DVD_H);
  tft::pixels(buf, sizeof buf);
  tft::end();
}

static void dvdStart() {
  wake();
  const float spanX = tft::W - DVD_W, spanY = tft::H - DVD_H;
  const float speed = 80.0f + (esp_random() % 50);
  const float ang = (esp_random() % 6283) / 1000.0f;
  dvdX = (esp_random() % 1000) / 1000.0f * spanX;
  dvdY = (esp_random() % 1000) / 1000.0f * spanY;
  dvdVx = cosf(ang) * speed;
  dvdVy = sinf(ang) * speed;
  if (fabsf(dvdVx) < 28) dvdVx = copysignf(28, dvdVx == 0 ? 1 : dvdVx);
  if (fabsf(dvdVy) < 22) dvdVy = copysignf(22, dvdVy == 0 ? 1 : dvdVy);
  dvdColorI = esp_random() % 4;
  dvdLast = 0;
  dvdNext = 0;
  mode = M_DVD;
}

static void dvdStep(float dt) {
  const float spanX = tft::W - DVD_W, spanY = tft::H - DVD_H;
  float nx = dvdX + dvdVx * dt;
  float ny = dvdY + dvdVy * dt;
  bool hit = false;
  if (nx < 0) { nx = 0; dvdVx = fabsf(dvdVx); hit = true; }
  else if (nx > spanX) { nx = spanX; dvdVx = -fabsf(dvdVx); hit = true; }
  if (ny < 0) { ny = 0; dvdVy = fabsf(dvdVy); hit = true; }
  else if (ny > spanY) { ny = spanY; dvdVy = -fabsf(dvdVy); hit = true; }
  dvdX = nx;
  dvdY = ny;
  if (!hit) return;
  int i = esp_random() % 3;
  if (i >= dvdColorI) i += 1;
  dvdColorI = i;
}

// ---------- Pakete verarbeiten ----------
static bool runsCoverScreen(const uint8_t *runs, size_t len) {
  if (len % 3) return false;
  uint32_t n = 0;
  for (size_t i = 0; i < len; i += 3) n += runs[i];
  return n == PIXELS;
}

static void drawFrame(int i) {
  const uint8_t *r = content + frameOff[i];
  tft::window(0, 0, tft::W, tft::H);
  for (uint32_t k = 0; k < frameLen[i]; k += 3) tft::fill((r[k + 1] << 8) | r[k + 2], r[k]);
  tft::end();
}

static void handlePacket(uint8_t type, const uint8_t *p, size_t len) {
  lastActivity = millis();
  switch (type) {
    case T_FRAME: {
      if (len < 3) return;
      const int idx = p[0], count = p[1], fps = p[2];
      const uint8_t *runs = p + 3;
      const size_t n = len - 3;
      if (count < 1 || count > MAX_ANIM_FRAMES || !runsCoverScreen(runs, n)) return;
      if (idx == 0) {
        animCount = 0;
        animUsed = 0;
        animExpected = count;
        mode = M_WAIT;  // altes Bild bleibt stehen, bis alles da ist
      }
      if (idx != animCount || count != animExpected || animUsed + n > MAX_ANIM_BYTES) {
        animCount = 0;  // Reihenfolge kaputt: verwerfen
        return;
      }
      memcpy(content + animUsed, runs, n);
      frameOff[idx] = animUsed;
      frameLen[idx] = n;
      animUsed += n;
      animCount++;
      if (animCount == count) {
        wake();
        animFps = fps < 1 ? 1 : fps;
        animIndex = 0;
        animNext = 0;
        mode = M_ANIM;
      }
      break;
    }
    case T_TEXT: {
      if (len < 7) return;
      const int h = p[4], w = p[5] | (p[6] << 8);
      const size_t bytes = (size_t)w * ((h + 7) / 8);
      if (h < 1 || h > tft::H || w < 1 || len != 7 + bytes || bytes > MAX_ANIM_BYTES) return;
      wake();
      textColor = tft::rgb(p[0], p[1], p[2]);
      textSpeed = p[3] < 1 ? 1 : (p[3] > 10 ? 10 : p[3]);
      textH = h;
      textW = w;
      memcpy(content, p + 7, bytes);
      animCount = 0;
      textStart = millis();
      textOffset = -1;
      mode = M_TEXT;
      break;
    }
    case T_PHOTO: {
      if (len < 3) return;
      const int y = p[0] | (p[1] << 8), rows = p[2];
      if (rows < 1 || y + rows > tft::H || len != 3 + (size_t)rows * tft::W * 2) return;
      wake();
      mode = M_STATIC;
      tft::window(0, y, tft::W, rows);
      tft::pixels(p + 3, len - 3);
      tft::end();
      break;
    }
    case T_BRIGHTNESS:
      if (len < 1) return;
      brightness = p[0];
      if (!sleeping) tft::backlight(brightness);
      break;
    case T_OFF:
      goToSleep();
      break;
    case T_TAROT: {
      const int n = len ? p[0] : 0;
      if ((n != 1 && n != 3) || len != (size_t)(1 + n * 2)) return;
      for (int i = 0; i < n; i++) {
        if (p[1 + i * 2] >= TAROT_COUNT) return;
        tarotCards[i] = {p[1 + i * 2], p[2 + i * 2] == 1};
      }
      startTarot(n, false);
      break;
    }
    case T_DVD:
      if (len != 0) return;
      dvdStart();
      break;
    case T_CLOCK: {
      if (len < 8) return;
      wake();
      clockBase = (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
      clockMillis = millis();
      clockStyle = p[4] ? 1 : 0;
      clockColor = tft::rgb(p[5], p[6], p[7]);
      clockLastSecond = -1;
      mode = M_CLOCK;
      break;
    }
    default:
      break;  // unbekannt: ignorieren (neuere Webseite)
  }
}

// Bytes sammeln, bis ein ganzes Paket da ist. Müll vor 0xA5 überspringen, zu lange Pakete verwerfen.
static void feed(const uint8_t *data, size_t n) {
  packetLastByte = millis();
  for (size_t i = 0; i < n; i++) {
    const uint8_t b = data[i];
    if (packetFill == 0 && b != MAGIC) continue;
    packetBuf[packetFill++] = b;
    if (packetFill < 4) continue;
    const size_t len = packetBuf[2] | (packetBuf[3] << 8);
    if (len > MAX_PAYLOAD) {
      // ab dem nächsten 0xA5 im Puffer neu anfangen
      size_t k = 1;
      while (k < packetFill && packetBuf[k] != MAGIC) k++;
      memmove(packetBuf, packetBuf + k, packetFill - k);
      packetFill -= k;
      continue;
    }
    if (packetFill == 4 + len) {
      handlePacket(packetBuf[1], packetBuf + 4, len);
      packetFill = 0;
    }
  }
}

// ---------- Knopf und Schütteln ----------
static bool buttonDown = false, longFired = false;
static uint32_t buttonSince = 0;

static volatile uint32_t shakeEdges = 0, shakeWindowStart = 0;
static uint32_t lastShake = 0;

static void IRAM_ATTR onShakeEdge() {
  const uint32_t now = millis();
  if (now - shakeWindowStart > SHAKE_WINDOW_MS) {
    shakeWindowStart = now;
    shakeEdges = 0;
  }
  shakeEdges = shakeEdges + 1;
}

static void pollInputs() {
  const uint32_t now = millis();
  const bool down = digitalRead(PIN_BUTTON) == LOW;
  if (down && !buttonDown) {
    buttonDown = true;
    longFired = false;
    buttonSince = now;
  } else if (down && !longFired && now - buttonSince >= LONG_PRESS_MS) {
    longFired = true;
    startTarot(3, true);
  } else if (!down && buttonDown) {
    buttonDown = false;
    if (!longFired && now - buttonSince >= 30) startTarot(1, true);  // 30 ms gegen Prellen
  }

  if (PIN_SHAKE >= 0 && shakeEdges >= SHAKE_EDGES && now - lastShake > SHAKE_COOLDOWN_MS) {
    shakeEdges = 0;
    lastShake = now;
    startTarot(1, true);
  }
}

// ---------- Start und Hauptschleife ----------
void setup() {
  Serial.begin(115200);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  if (PIN_SHAKE >= 0) {
    pinMode(PIN_SHAKE, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_SHAKE), onShakeEdge, CHANGE);
  }
  packetBuf = (uint8_t *)malloc(4 + MAX_PAYLOAD);
  content = (uint8_t *)malloc(MAX_ANIM_BYTES);
  tft::begin();
  if (!packetBuf || !content) {
    // Sollte nicht passieren. Falls doch: MAX_ANIM_BYTES / MAX_PAYLOAD verkleinern (auch in web/protocol.js).
    Serial.println("Zu wenig Speicher fuer die Puffer");
    tft::backlight(brightness);
    tft::fillScreen(tft::rgb(255, 0, 0));
    for (;;) delay(1000);
  }
  render::splash();
  tft::backlight(brightness);
  bleBegin();
  Serial.printf("Freier Speicher nach dem Start: %u Bytes\n", (unsigned)ESP.getFreeHeap());
  lastActivity = millis();
  Serial.println("Hairclip bereit");
}

void loop() {
  static uint8_t chunk[512];
  size_t n;
  while ((n = xStreamBufferReceive(rxStream, chunk, sizeof chunk, 0)) > 0) feed(chunk, n);
  if (packetFill && millis() - packetLastByte > 2000) packetFill = 0;  // halbes Paket verwerfen

  pollInputs();

  const uint32_t now = millis();
  switch (mode) {
    case M_ANIM:
      if (animCount && (int32_t)(now - animNext) >= 0) {
        drawFrame(animIndex);
        animIndex = (animIndex + 1) % animCount;
        animNext = now + 1000 / animFps;
        if (animCount == 1) mode = M_STATIC;  // Standbild nur einmal zeichnen
      }
      break;
    case M_TEXT: {
      const int offset = (int)(((uint64_t)(now - textStart) * textSpeed * 30 / 1000) % (uint32_t)(textW + tft::W));
      if (offset != textOffset) {
        textOffset = offset;
        render::textStrip(content, textW, textH, textColor, offset);
      }
      break;
    }
    case M_TAROT:
      updateTarot();
      break;
    case M_DVD:
      if ((int32_t)(now - dvdNext) >= 0) {
        float dt = dvdLast ? (now - dvdLast) / 1000.0f : 0.033f;
        if (dt > 0.05f) dt = 0.05f;
        dvdLast = now;
        dvdStep(dt);
        dvdDraw();
        dvdNext = now + 33;
      }
      break;
    case M_CLOCK: {
      const time_t t = (time_t)clockBase + (now - clockMillis) / 1000;
      struct tm tm;
      gmtime_r(&t, &tm);  // clockBase ist schon Ortszeit
      if (tm.tm_sec != clockLastSecond) {
        clockLastSecond = tm.tm_sec;
        const ClockTime ct = {tm.tm_hour, tm.tm_min, tm.tm_sec, tm.tm_wday, tm.tm_mday, tm.tm_mon + 1, tm.tm_year + 1900};
        render::clock(ct, clockColor, clockStyle);
      }
      break;
    }
    default:
      break;
  }

  if (AUTO_OFF_MINUTES > 0 && mode != M_OFF && now - lastActivity > AUTO_OFF_MINUTES * 60000UL) goToSleep();
  delay(1);
}
