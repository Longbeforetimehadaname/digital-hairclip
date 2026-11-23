# Bluetooth-Protokoll (Version 2)

Die Webseite (`web/protocol.js`) und die Firmware müssen dieses Protokoll gleich umsetzen. Bei Änderungen beides und `test/protocol.test.js` anpassen.

Version 2 (23.11.2026): für das Display 1,9" mit **320 × 170 Pixeln im Querformat** (ST7789, physisch 170 × 320, in der Firmware um 90° gedreht). Version 1 war für das LED-Raster 16 × 8 auf dem T-QT Pro und gilt nicht mehr.

## Verbindung

- Bluetooth Low Energy (BLE), Clip ist Peripheral.
- Gerätename: beginnt mit `Hairclip` (die Webseite filtert danach).
- Dienst: **Nordic UART Service** `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- Schreib-Characteristic (Webseite → Clip): `6e400002-b5a3-f393-e0a9-e50e24dcca9e` (Write mit Antwort). Muss Schreibzugriffe bis **180 Bytes** annehmen (bei kleiner MTU als „Long Write“).
- Der Clip sendet vorerst nichts zurück. Die TX-Characteristic (`...0003...`) ist für später reserviert, z. B. Akkustand.

## Paketformat

Alle Befehle haben denselben Kopf. Zahlen sind **little endian**, Farben im Format **RGB565 big endian** (erstes Byte = oberes Byte, so wie das Display sie erwartet).

```
Byte 0      0xA5          Startbyte
Byte 1      Typ           siehe Tabelle
Byte 2..3   Länge         Länge der Nutzdaten in Bytes (u16)
Byte 4..    Nutzdaten
```

Die Webseite schreibt in Stücken zu **180 Bytes**. Ein Paket kommt also in mehreren Schreibzugriffen an, und mehrere Pakete können direkt hintereinander kommen. Die Firmware muss:

- die Bytes in einem Puffer sammeln, bis `4 + Länge` Bytes da sind,
- bei Müll vor dem Startbyte `0xA5` bis zum nächsten `0xA5` überspringen,
- den Puffer verwerfen, wenn 2 Sekunden lang nichts kommt,
- Pakete mit Länge über **40 000 Bytes** verwerfen.

## Befehle

| Typ | Name | Nutzdaten |
|---|---|---|
| 0x01 | FRAME | `index` (u8), `count` (u8, 1–16), `fps` (u8, 1–30), danach Lauflängen-Daten eines ganzen Bildes |
| 0x02 | TEXT | `r`, `g`, `b` (je u8), `speed` (u8, 1–10), `h` (u8, Höhe), `w` (u16, Breite), danach `w × ceil(h/8)` Bytes |
| 0x03 | PHOTO | `y` (u16, erste Zeile), `rows` (u8), danach `rows × 320 × 2` Bytes RGB565 |
| 0x04 | BRIGHTNESS | 1 Byte, 0–255 |
| 0x05 | OFF | keine |

### FRAME (Animationen, Zeichnungen, Standbilder)

Eine Animation besteht aus `count` FRAME-Paketen mit `index` 0, 1, …, `count − 1`, in dieser Reihenfolge.

- Bei `index = 0` verwirft der Clip die alte Animation.
- Jedes Bild wird gespeichert, so wie es kommt (komprimiert).
- Nach dem Bild mit `index = count − 1` spielt der Clip alle Bilder in Endlosschleife mit `fps` Bildern pro Sekunde. Ein Standbild ist `count = 1`.
- Alle Bilder einer Animation zusammen sind höchstens **64 000 Bytes** (die Webseite prüft das).

**Lauflängen-Daten:** Folge von Dreiergruppen `[n, hi, lo]`: `n` (1–255) Pixel hintereinander in der Farbe `hi lo` (RGB565 big endian). Die Pixel laufen Zeile für Zeile von oben links nach unten rechts und decken zusammen genau 320 × 170 = 54 400 Pixel ab. Ein Lauf kann über das Zeilenende hinausgehen. Tipp für die Firmware: Adressfenster auf das ganze Display setzen und jede Gruppe mit `pushBlock(farbe, n)` (TFT_eSPI) schreiben.

### TEXT

Ein Textstreifen, `w` Pixel breit und `h` Pixel hoch (die Webseite nimmt `h = 112`). Gespeichert Spalte für Spalte von links nach rechts. Jede Spalte hat `ceil(h/8)` Bytes: im ersten Byte **Bit 0 = oberste Zeile**, Bit 7 = Zeile 8, im zweiten Byte Zeilen 9–16 usw.

Der Clip zeigt den Streifen **senkrecht mittig** (`(170 − h) / 2` Pixel Abstand oben) und scrollt ihn von rechts nach links mit `speed × 30` Pixeln pro Sekunde. Bei Zeit `t` (Sekunden) ist der Versatz `o = floor(t × speed × 30) mod (w + 320)`, und die linke Kante des Streifens liegt bei `x = 320 − o`. Der Text kommt also rechts herein, verlässt links das Display, dann beginnt es von vorn. Gesetzte Bits leuchten in der Farbe `r g b`, alles andere ist schwarz.

### PHOTO

Ein Foto über das ganze Display in mehreren Paketen, je `rows` Zeilen ab Zeile `y` (die Webseite schickt 34 Zeilen pro Paket, also 5 Pakete). Pixel Zeile für Zeile, je 2 Bytes RGB565 big endian. Der Clip stoppt Animation und Text und schreibt die Zeilen direkt auf das Display.

### BRIGHTNESS

Globale Helligkeit, 0–255, am einfachsten über die Hintergrundbeleuchtung (Pin `BLK`, PWM). Die Webseite sendet sie nach jedem Verbinden.

### OFF

Bildschirm schwarz und Hintergrundbeleuchtung aus, Animation und Text stoppen. Der nächste FRAME-, TEXT- oder PHOTO-Befehl schaltet wieder ein.

## Darstellung

Die Vorschau auf der Webseite zeigt genau die Pixel, die der Clip zeigen soll. Sie rechnet mit denselben Daten (Textstreifen, Bilder) wie das Protokoll. Kleine Unterschiede: Die Vorschau zeigt Farben mit voller Genauigkeit, das Display nur mit RGB565.
