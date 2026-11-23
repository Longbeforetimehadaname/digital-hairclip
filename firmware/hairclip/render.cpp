#include "render.h"

#include <math.h>
#include <stdio.h>
#include <string.h>

#include "font_data.h"
#include "st7789.h"
#include "tarot_data.h"

namespace render {

using tft::H;
using tft::W;

constexpr uint16_t c565(uint8_t r, uint8_t g, uint8_t b) {
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}

// Farben wie COLORS in web/scene.js
constexpr uint16_t BG = c565(14, 10, 18);
constexpr uint16_t PAPER = c565(244, 234, 216);
constexpr uint16_t INK = c565(42, 23, 48);
constexpr uint16_t GOLD = c565(217, 164, 65);
constexpr uint16_t TEXT = c565(244, 234, 216);
constexpr uint16_t DIM = c565(190, 178, 200);
constexpr uint16_t ROSE = c565(229, 138, 168);
constexpr uint16_t BACK = c565(46, 26, 62);

constexpr int CARD_X = 14, CARD_Y = 10, CARD_W = 96, CARD_H = 150;
constexpr int TEXT_X = 124;
constexpr int TEXT_W = W - TEXT_X - 8;

/* ---------- Streifen-Zeichenfläche ---------- */

constexpr int BAND_ROWS = 34;  // 170 = 5 × 34
static uint16_t band[W * BAND_ROWS];  // Farben schon in Display-Reihenfolge (big endian)
static int bandY0 = 0;

struct Flip {
  bool on;
  int x, y, w, h;
};
static Flip flip = {false, 0, 0, 0, 0};

static inline uint16_t swap16(uint16_t c) { return (uint16_t)((c >> 8) | (c << 8)); }

static inline bool mapXY(int &x, int &y) {
  if (flip.on) {
    x = 2 * flip.x + flip.w - 1 - x;
    y = 2 * flip.y + flip.h - 1 - y;
  }
  return x >= 0 && x < W && y >= bandY0 && y < bandY0 + BAND_ROWS && y < H;
}

static inline void setPx(int x, int y, uint16_t c) {
  if (mapXY(x, y)) band[(y - bandY0) * W + x] = swap16(c);
}

static void blendPx(int x, int y, uint16_t c, int q) {
  if (q >= 3) {
    setPx(x, y, c);
    return;
  }
  if (q <= 0 || !mapXY(x, y)) return;
  uint16_t &p = band[(y - bandY0) * W + x];
  const uint16_t d = swap16(p);
  int dr = (d >> 11) & 31, dg = (d >> 5) & 63, db = d & 31;
  const int cr = (c >> 11) & 31, cg = (c >> 5) & 63, cb = c & 31;
  dr += ((cr - dr) * q + (cr > dr ? 1 : -1)) / 3;
  dg += ((cg - dg) * q + (cg > dg ? 1 : -1)) / 3;
  db += ((cb - db) * q + (cb > db ? 1 : -1)) / 3;
  p = swap16((uint16_t)((dr << 11) | (dg << 5) | db));
}

static void rect(int x, int y, int w, int h, uint16_t c) {
  if (flip.on) {
    x = 2 * flip.x + flip.w - 1 - (x + w - 1);
    y = 2 * flip.y + flip.h - 1 - (y + h - 1);
  }
  int x0 = x < 0 ? 0 : x, x1 = x + w > W ? W : x + w;
  int y0 = y < bandY0 ? bandY0 : y, y1 = y + h;
  if (y1 > bandY0 + BAND_ROWS) y1 = bandY0 + BAND_ROWS;
  if (y1 > H) y1 = H;
  const uint16_t s = swap16(c);
  for (int yy = y0; yy < y1; yy++) {
    uint16_t *row = band + (yy - bandY0) * W;
    for (int xx = x0; xx < x1; xx++) row[xx] = s;
  }
}

static void frame(int x, int y, int w, int h, uint16_t c) {
  rect(x, y, w, 1, c);
  rect(x, y + h - 1, w, 1, c);
  rect(x, y, 1, h, c);
  rect(x + w - 1, y, 1, h, c);
}

// Zeichnet die Szene f Streifen für Streifen und schickt jeden Streifen ans Display.
template <class F>
static void draw(F f) {
  for (bandY0 = 0; bandY0 < H; bandY0 += BAND_ROWS) {
    const int rows = (H - bandY0) < BAND_ROWS ? (H - bandY0) : BAND_ROWS;
    flip.on = false;
    f();
    tft::window(0, bandY0, W, rows);
    tft::pixels((const uint8_t *)band, (size_t)W * rows * 2);
  }
  tft::end();
  bandY0 = 0;
}

/* ---------- Schrift ---------- */

static uint32_t nextCodepoint(const char *&s) {
  const uint8_t c = (uint8_t)*s++;
  if (c < 0x80) return c;
  if ((c & 0xE0) == 0xC0 && *s) return ((uint32_t)(c & 0x1F) << 6) | ((uint8_t)*s++ & 0x3F);
  if ((c & 0xF0) == 0xE0 && s[0] && s[1]) {
    uint32_t cp = ((uint32_t)(c & 0x0F) << 12) | (((uint8_t)*s++ & 0x3F) << 6);
    return cp | ((uint8_t)*s++ & 0x3F);
  }
  return '?';
}

static const Glyph *glyphOf(const Font &f, uint32_t code) {
  for (uint16_t i = 0; i < f.count; i++) {
    if (f.glyphs[i].code == code) return &f.glyphs[i];
  }
  if (code != '?') return glyphOf(f, '?');
  return &f.glyphs[0];
}

static int textWidth(const Font &f, const char *s) {
  int w = 0;
  while (*s) w += glyphOf(f, nextCodepoint(s))->adv;
  return w;
}

static void drawGlyph(const Font &f, const Glyph *g, int x, int baseline, uint16_t c) {
  for (int yy = 0; yy < g->h; yy++) {
    const int py = baseline + g->dy + yy;
    if (!flip.on && (py < bandY0 || py >= bandY0 + BAND_ROWS)) continue;
    for (int xx = 0; xx < g->w; xx++) {
      const uint32_t i = (uint32_t)yy * g->w + xx;
      const int q = (pgm_read_byte(f.bits + g->off + (i >> 2)) >> ((i & 3) * 2)) & 3;
      if (q) blendPx(x + g->dx + xx, py, c, q);
    }
  }
}

static void text(const Font &f, const char *s, int x, int baseline, uint16_t c) {
  while (*s) {
    const Glyph *g = glyphOf(f, nextCodepoint(s));
    drawGlyph(f, g, x, baseline, c);
    x += g->adv;
  }
}

static void textCentered(const Font &f, const char *s, int cx2, int baseline, uint16_t c) {
  // cx2 = doppelte Mitte, damit halbe Pixel wie Math.round in JavaScript gerundet werden
  const int w = textWidth(f, s);
  text(f, s, (int)floorf((cx2 - w) / 2.0f + 0.5f), baseline, c);
}

// Bricht nach Wörtern um (gleich wie wrap() in web/scene.js), höchstens maxLines Zeilen.
static int wrap(const Font &f, const char *s, int maxW, char lines[][64], int maxLines) {
  int n = 0;
  char line[64] = "";
  char word[64];
  while (*s && n < maxLines) {
    const char *e = strchr(s, ' ');
    const size_t len = e ? (size_t)(e - s) : strlen(s);
    snprintf(word, sizeof word, "%.*s", (int)len, s);
    s += len;
    if (*s == ' ') s++;
    char next[64];
    snprintf(next, sizeof next, "%s%s%s", line, line[0] ? " " : "", word);
    if (line[0] && textWidth(f, next) > maxW) {
      strcpy(lines[n++], line);
      strcpy(line, word);
    } else {
      strcpy(line, next);
    }
  }
  if (line[0] && n < maxLines) strcpy(lines[n++], line);
  return n;
}

/* ---------- Symbole (gleiche Formeln wie inShape in web/scene.js) ---------- */

static bool inShape(int kind, float u, float v) {
  const float au = fabsf(u);
  switch (kind) {
    case 0:
      return (au <= 0.18f && v >= -0.55f && v <= 1) || au + fabsf(v + 0.72f) <= 0.3f;
    case 1: {
      const float a = u / 0.8f, b = (v + 0.85f) / 0.75f;
      return (v >= -0.85f && v <= -0.1f && a * a + b * b <= 1) || (au <= 0.12f && v >= -0.15f && v <= 0.62f) ||
             (au <= 0.55f && v >= 0.6f && v <= 0.85f);
    }
    case 2:
      return (au <= 0.16f && v >= -0.6f && v <= 0.45f) || (v >= -1 && v < -0.6f && au <= (0.16f * (v + 1)) / 0.4f) ||
             (au <= 0.55f && v >= 0.45f && v <= 0.6f) || (au <= 0.1f && v >= 0.6f && v <= 0.85f) ||
             u * u + (v - 0.92f) * (v - 0.92f) <= 0.0225f;
    case 3: {
      const float r = sqrtf(u * u + v * v);
      return (r >= 0.62f && r <= 0.95f) || r <= 0.28f;
    }
    default: {
      const float av = fabsf(v);
      return (au + av <= 1 || (au > av ? au : av) <= 0.68f) && u * u + v * v > 0.04f;
    }
  }
}

static void shape(int kind, int cx, int cy, int half, uint16_t c) {
  for (int y = -half; y <= half; y++) {
    if (!flip.on && (cy + y < bandY0 || cy + y >= bandY0 + BAND_ROWS)) continue;
    for (int x = -half; x <= half; x++) {
      if (inShape(kind, (x + 0.5f) / half, (y + 0.5f) / half)) setPx(cx + x, cy + y, c);
    }
  }
}

// Lage der Zeichen auf Zahlenkarten: Spalte, Zeile × 100 (wie PIP_LAYOUT in web/scene.js)
static const int16_t PIPS[11][10][2] = {
    {}, {},
    {{1, 0}, {1, 400}},
    {{1, 0}, {1, 200}, {1, 400}},
    {{0, 0}, {2, 0}, {0, 400}, {2, 400}},
    {{0, 0}, {2, 0}, {1, 200}, {0, 400}, {2, 400}},
    {{0, 0}, {2, 0}, {0, 200}, {2, 200}, {0, 400}, {2, 400}},
    {{0, 0}, {2, 0}, {1, 100}, {0, 200}, {2, 200}, {0, 400}, {2, 400}},
    {{0, 0}, {2, 0}, {1, 100}, {0, 200}, {2, 200}, {1, 300}, {0, 400}, {2, 400}},
    {{0, 0}, {2, 0}, {0, 133}, {2, 133}, {1, 200}, {0, 267}, {2, 267}, {0, 400}, {2, 400}},
    {{0, 0}, {2, 0}, {1, 67}, {0, 133}, {2, 133}, {0, 267}, {2, 267}, {1, 333}, {0, 400}, {2, 400}},
};

/* ---------- Karten ---------- */

static void cardFace(int id, bool reversed, int x, int y) {
  if (reversed) flip = {true, x, y, CARD_W, CARD_H};
  rect(x, y, CARD_W, CARD_H, GOLD);
  rect(x + 2, y + 2, CARD_W - 4, CARD_H - 4, PAPER);
  frame(x + 5, y + 5, CARD_W - 10, CARD_H - 10, INK);
  textCentered(FONT_M, TAROT_MARK[id], 2 * x + CARD_W, y + 28, INK);
  const int suit = TAROT_SUIT[id];
  const int count = suit >= 0 ? TAROT_RANK[id] + 1 : 0;
  if (count >= 2 && count <= 10) {
    for (int i = 0; i < count; i++) {
      const int col = PIPS[count][i][0], row100 = PIPS[count][i][1];
      // Math.round(row * 15) in JavaScript, row = row100 / 100
      shape(suit, x + 22 + col * 26, y + 45 + (row100 * 15 + 50) / 100, 7, INK);
    }
  } else {
    shape(suit >= 0 ? suit : 4, x + CARD_W / 2, y + 75, 24, INK);
  }
  // unten nochmals die Zahl, wie bei Spielkarten
  textCentered(FONT_M, TAROT_MARK[id], 2 * x + CARD_W, y + CARD_H - 14, INK);
  flip.on = false;
}

static void cardBack(int x, int y) {
  rect(x, y, CARD_W, CARD_H, GOLD);
  for (int yy = 2; yy < CARD_H - 2; yy++) {
    if (y + yy < bandY0 || y + yy >= bandY0 + BAND_ROWS) continue;
    for (int xx = 2; xx < CARD_W - 2; xx++) {
      const bool lattice = (xx + yy) % 12 == 0 || (xx - yy + 1200) % 12 == 0;
      setPx(x + xx, y + yy, lattice ? GOLD : BACK);
    }
  }
  frame(x + 5, y + 5, CARD_W - 10, CARD_H - 10, GOLD);
}

void shuffle(int step) {
  draw([&] {
    rect(0, 0, W, H, BG);
    for (int k = 0; k < 3; k++) {
      const int slot = (k + step) % 3;
      cardBack(CARD_X + slot * 22, CARD_Y + (slot == 1 ? 0 : 4) - (k == step % 3 ? 4 : 0));
    }
    text(FONT_L, "Die Karten", TEXT_X + 10, 74, TEXT);
    text(FONT_L, "werden gemischt", TEXT_X + 10, 100, TEXT);
    const char *dots[3] = {".", "..", "..."};
    text(FONT_M, dots[step % 3], TEXT_X + 10, 124, GOLD);
  });
}

void tarot(const TarotCard *cards, int count, int index) {
  const TarotCard &card = cards[index];
  draw([&] {
    rect(0, 0, W, H, BG);
    cardFace(card.id, card.reversed, CARD_X, CARD_Y);
    int y = 30;
    char label[48];
    if (count == 3) {
      snprintf(label, sizeof label, "%d \302\267 %s", index + 1, SPREAD_LABEL[index]);
    } else {
      snprintf(label, sizeof label, "Deine Karte");
    }
    text(FONT_S, label, TEXT_X, y, GOLD);
    if (count == 3) {
      for (int k = 0; k < 3; k++) rect(W - 36 + k * 10, y - 8, 6, 6, k == index ? GOLD : BACK);
    }
    y += 26;
    char lines[2][64];
    const int n = wrap(FONT_L, TAROT_NAME[card.id], TEXT_W, lines, 2);
    for (int i = 0; i < n; i++) {
      text(FONT_L, lines[i], TEXT_X, y, TEXT);
      y += 25;
    }
    y -= 3;
    if (card.reversed) {
      text(FONT_S, "umgekehrt", TEXT_X, y, ROSE);
      y += 19;
    }
    for (int i = 0; i < 3; i++) {
      text(FONT_S, card.reversed ? TAROT_DOWN[card.id][i] : TAROT_UP[card.id][i], TEXT_X, y, DIM);
      y += 18;
    }
  });
}

/* ---------- Uhr ---------- */

static const char *const WEEKDAY[7] = {"So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"};

void clock(const ClockTime &t, uint16_t color, int style) {
  draw([&] {
    rect(0, 0, W, H, BG);
    const Glyph *zero = glyphOf(FONT_XL, '0');
    const float center = style == 1 ? 72 : 85;
    const int base = (int)floorf(center - (zero->dy + zero->h / 2.0f) + 0.5f);
    char str[6];
    snprintf(str, sizeof str, "%02d:%02d", t.h, t.m);
    int x = (int)floorf(W / 2.0f - textWidth(FONT_XL, str) / 2.0f + 0.5f);
    for (const char *p = str; *p; p++) {
      const Glyph *g = glyphOf(FONT_XL, (uint8_t)*p);
      const bool blink = *p == ':' && (t.s % 2) == 1;
      drawGlyph(FONT_XL, g, x, base, blink ? BG : color);
      x += g->adv;
    }
    if (style == 1) {
      char date[32];
      snprintf(date, sizeof date, "%s, %d.%d.%d", WEEKDAY[t.wd % 7], t.d, t.mo, t.y);
      textCentered(FONT_M, date, W, 142, DIM);
    }
  });
}

/* ---------- Lauftext und Startbild ---------- */

void textStrip(const uint8_t *bits, int w, int h, uint16_t color, int offset) {
  const int per = (h + 7) / 8;
  const int top = (H - h) / 2;
  const int left = W - offset;  // linke Kante des Streifens auf dem Display
  draw([&] {
    rect(0, 0, W, H, 0);
    const uint16_t s = swap16(color);
    for (int y = bandY0; y < bandY0 + BAND_ROWS && y < H; y++) {
      const int sy = y - top;
      if (sy < 0 || sy >= h) continue;
      uint16_t *row = band + (y - bandY0) * W;
      for (int x = 0; x < W; x++) {
        const int sx = x - left;
        if (sx < 0 || sx >= w) continue;
        if ((bits[sx * per + (sy >> 3)] >> (sy & 7)) & 1) row[x] = s;
      }
    }
  });
}

void splash() {
  draw([&] {
    rect(0, 0, W, H, BG);
    textCentered(FONT_L, "Hairclip", W, 64, GOLD);
    textCentered(FONT_S, "Knopf: eine Tarot-Karte", W, 100, DIM);
    textCentered(FONT_S, "lange dr\303\274cken: drei Karten", W, 122, DIM);
  });
}

}  // namespace render
