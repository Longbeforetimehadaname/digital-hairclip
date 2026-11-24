# Firmware

Das Programm für den Clip liegt in [`hairclip/`](hairclip/) (ein Arduino-Sketch). Es setzt das Protokoll aus [`../docs/PROTOCOL.md`](../docs/PROTOCOL.md) um und braucht **keine zusätzlichen Bibliotheken**, nur das ESP32-Paket von Espressif (auf dem PC schon installiert, Version 3.3.10).

**Stand 24.11.2026:** Am PC fehlerfrei übersetzt, aber **noch nie auf echter Hardware gelaufen**. Display-Einstellungen (Versatz, Farben, Drehung) müssen am echten Display wahrscheinlich noch angepasst werden, siehe unten.

## Was der Clip kann

- **Tarot ohne Handy:** Knopf `BOOT` kurz drücken = eine Karte. Lange drücken (0,7 s) = drei Karten (Vergangenheit, Gegenwart, Zukunft), die sich alle 6 Sekunden abwechseln. Vorher mischt er die Karten (kurze Animation). Zufall aus dem Funkteil des ESP32 (echter Zufall). Etwa 30 % der Karten liegen umgekehrt, dann steht die Karte auf dem Kopf und die umgekehrte Deutung wird gezeigt.
- **Schütteln** zieht auch eine Karte, aber nur mit einem zusätzlichen Erschütterungsschalter (siehe unten).
- Ist die Webseite verbunden, meldet der Clip die gezogenen Karten, und die Webseite zeigt die Deutung.
- Von der Webseite: Lauftext, Zeichnungen, Animationen, Fotos, Tarot, Uhr, Helligkeit, Aus.

## Dateien

| Datei | Inhalt |
|---|---|
| `hairclip.ino` | Hauptprogramm: Bluetooth, Pakete, Knopf, Schütteln, Ablauf |
| `config.h` | **Pins und Einstellungen** – hier wird angepasst |
| `st7789.cpp/.h` | Kleiner Display-Treiber (SPI) |
| `render.cpp/.h` | Zeichnet Tarot, Uhr, Lauftext, Startbild (gleiche Regeln wie `web/scene.js`) |
| `font_data.h`, `tarot_data.h` | **Erzeugt**, nicht von Hand ändern: `node tools/gen-firmware-data.mjs` |

## Verkabelung (Vorschlag, steht auch in `config.h`)

**Vor allem anderen die Prüfpunkte aus [`../hardware/PARTS.md`](../hardware/PARTS.md) durchgehen** (Polung des Akkus mit dem Multimeter, Ausgangsspannung des Lademoduls messen, nie mit angeschlossenem Akku löten). Zum ersten Test das Board nur per USB versorgen, ohne Akku und ohne Lademodul.

| Display-Pin | ESP32-Pin |
|---|---|
| GND | GND |
| VCC | **3V3** (nicht 5 V!) |
| SCL | GPIO 18 |
| SDA | GPIO 23 |
| RES | GPIO 17 |
| DC | GPIO 16 |
| CS | GPIO 5 |
| BLK | GPIO 4 |

Die Beschriftung am Display kann anders heissen (SCK/CLK statt SCL, MOSI/DIN statt SDA, RST statt RES, BL/LED statt BLK). Am echten Modul nachlesen.

## Aufspielen mit der Arduino IDE

1. Ordner `firmware/hairclip` öffnen (Datei `hairclip.ino`).
2. **Werkzeuge → Board → esp32 → ESP32 Dev Module**.
3. **Werkzeuge → Partition Scheme → Huge APP (3MB No OTA/1MB SPIFFS)**. Mit dem Standard passt es auch noch (88 % belegt), mit „Huge APP“ ist Platz für Erweiterungen.
4. Board per USB anstecken, **Werkzeuge → Port** wählen (z. B. COM5). Wenn kein Port erscheint: anderes Kabel (Datenkabel) oder Treiber für den USB-Chip CH340 installieren.
5. **Hochladen**. Bleibt es bei „Connecting…“ hängen: Knopf `BOOT` gedrückt halten, bis das Hochladen beginnt.
6. Nach dem Neustart zeigt das Display „Hairclip“. Im **Seriellen Monitor** (115200 Baud) steht „Hairclip bereit“.

Ohne Arduino IDE, mit dem Kommandozeilenwerkzeug: `arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=huge_app firmware/hairclip`.

## Wenn das Bild nicht stimmt (in `config.h` ändern)

| Was man sieht | Einstellung |
|---|---|
| Display bleibt schwarz, aber Licht an | Verkabelung prüfen, `TFT_SPI_HZ` auf 20000000 senken |
| Display bleibt dunkel | BLK-Kabel prüfen |
| Bild verschoben, Streifen mit Müll am Rand | `TFT_Y_OFFSET` (0 oder 35) bzw. `TFT_X_OFFSET` |
| Bild steht auf dem Kopf | `TFT_ROTATE_180` auf 1 |
| Farben wie ein Negativ | `TFT_INVERT` auf 0 |
| Rot und Blau vertauscht | `TFT_BGR` auf 1 |

## Schütteln (optional)

Ein Beschleunigungssensor ist nicht in der Teileliste. Am einfachsten ist ein **Erschütterungsschalter** (z. B. Federschalter SW-18010P oder Kugel-Neigungsschalter SW-520D, Stückpreis wenige Rappen). Er hat zwei Beine: eines an einen freien Pin (Vorschlag GPIO 27), das andere an GND. Dann in `config.h` `#define PIN_SHAKE 27` setzen. `SHAKE_EDGES` regelt, wie stark man schütteln muss. Nichts kaufen, ohne es vorher mit Claude Code zu prüfen.

## Testen ohne Webseite

Mit der App **nRF Connect** verbinden und an die Schreib-Characteristic (`6e400002-…`) senden:

- Helligkeit 100: `A5 04 01 00 64`
- Eine bestimmte Tarot-Karte (Der Stern, aufrecht): `A5 06 03 00 01 11 00`
- Aus: `A5 05 00 00`
