// Einstellungen für den Haarclip. Alles, was man an der echten Hardware anpassen muss, steht hier.
#pragma once

// ---------- Display (1,9" ST7789, 170 × 320, im Querformat 320 × 170 benutzt) ----------
// Vorschlag für die Verkabelung (ESP32-DevKit → Display-Modul). Die Beschriftung am Display kann
// anders heissen: SCL = SCK = CLK, SDA = MOSI = DIN, RES = RST, DC = RS = A0, BLK = BL = LED.
#define PIN_TFT_SCLK 18  // SCL
#define PIN_TFT_MOSI 23  // SDA
#define PIN_TFT_CS 5     // CS
#define PIN_TFT_DC 16    // DC
#define PIN_TFT_RST 17   // RES
#define PIN_TFT_BLK 4    // BLK (Hintergrundbeleuchtung, Helligkeit per PWM)
// VCC → 3V3 am Board, GND → GND. Das Display NICHT an 5 V anschliessen.

#define TFT_SPI_HZ 40000000  // bei Bildfehlern auf 20000000 senken

// Bild verschoben, gespiegelt oder falsche Farben? Dann diese Werte ändern:
#define TFT_X_OFFSET 0
#define TFT_Y_OFFSET 35      // bei 170er-Displays meistens 35
#define TFT_ROTATE_180 0     // 1 = Bild steht auf dem Kopf → umdrehen
#define TFT_INVERT 1         // IPS-Displays brauchen meist 1. Falsche Farben (Negativ)? → 0
#define TFT_BGR 0            // Rot und Blau vertauscht? → 1

// ---------- Knopf ----------
// Der Knopf "BOOT" auf dem ESP32-DevKit hängt an GPIO 0. Er kann nach dem Start frei benutzt werden.
// Eigener Knopf: zwischen einen freien Pin und GND löten und die Nummer hier eintragen.
#define PIN_BUTTON 0
#define LONG_PRESS_MS 700    // länger drücken = drei Karten

// ---------- Schütteln (optional) ----------
// Braucht einen Erschütterungs- oder Neigungsschalter (z. B. Federschalter SW-18010P oder Kugelschalter SW-520D)
// zwischen diesem Pin und GND. -1 = kein Sensor eingebaut.
#define PIN_SHAKE -1
#define SHAKE_EDGES 6        // so viele Wackler ...
#define SHAKE_WINDOW_MS 700  // ... in dieser Zeit gelten als Schütteln
#define SHAKE_COOLDOWN_MS 3000

// ---------- Bluetooth ----------
#define DEVICE_NAME "Hairclip"

// ---------- Strom sparen ----------
// Nach so vielen Minuten ohne Knopf oder Bluetooth-Befehl geht das Display aus (0 = nie).
// Ein Knopfdruck weckt es wieder.
#define AUTO_OFF_MINUTES 0
