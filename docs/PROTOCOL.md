# Bluetooth-Protokoll

Die Webseite (`web/protocol.js`) und die Firmware müssen dieses Protokoll gleich umsetzen. Bei Änderungen beides und `test/protocol.test.js` anpassen.

## Verbindung

- Bluetooth Low Energy (BLE), Clip ist Peripheral.
- Gerätename: beginnt mit `Hairclip` (die Webseite filtert danach).
- Dienst: **Nordic UART Service** `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- Schreib-Characteristic (Webseite → Clip): `6e400002-b5a3-f393-e0a9-e50e24dcca9e` (Write und Write Without Response)
- Der Clip sendet vorerst nichts zurück. Die TX-Characteristic (`...0003...`) ist für später reserviert, z. B. Akkustand.

## Paketformat

Alle Befehle haben denselben Kopf. Zahlen sind **little endian**.

```
Byte 0      0xA5          Startbyte
Byte 1      Typ           siehe Tabelle
Byte 2..3   Länge         Länge der Nutzdaten in Bytes (u16)
Byte 4..    Nutzdaten
```

Die Webseite schreibt in Stücken zu **20 Bytes** (kleinste BLE-Schreibgrösse). Ein Paket kommt also in mehreren Schreibzugriffen an. Die Firmware muss:

- die Bytes in einem Puffer sammeln, bis `4 + Länge` Bytes da sind,
- bei Müll vor dem Startbyte `0xA5` bis zum nächsten `0xA5` überspringen,
- den Puffer verwerfen, wenn 2 Sekunden lang nichts kommt,
- Pakete mit Länge über 10 000 Bytes verwerfen.

## Befehle

| Typ | Name | Nutzdaten |
|---|---|---|
| 0x01 | ANIM | `fps` (u8, 1–30), `frames` (u8, 1–24), danach `frames × 384` Bytes |
| 0x02 | TEXT | `r`, `g`, `b` (je u8), `speed` (u8, 1–10), `width` (u16), danach `width` Bytes |
| 0x03 | PHOTO | `w` (u8, immer 64), `h` (u8, immer 64), danach `w × h × 2` Bytes |
| 0x04 | BRIGHTNESS | 1 Byte, 0–255 |
| 0x05 | OFF | keine |

### ANIM

Ein Bild ist 16 × 8 Pixel, RGB888, Zeile für Zeile, oben links zuerst: `384 = 16 × 8 × 3` Bytes. Der Clip spielt die Bilder in Endlosschleife mit `fps` Bildern pro Sekunde. Ein Standbild ist eine ANIM mit `frames = 1`.

### TEXT

`width` Spalten, ein Byte pro Spalte. **Bit 0 ist die oberste Zeile**, Bit 7 die unterste. Der Clip scrollt den Streifen von rechts nach links in `speed × 3` Spalten pro Sekunde. Ein Durchlauf dauert `width + 16` Spalten (der Text kommt rechts rein und verlässt links das Raster), dann beginnt er von vorn. Farbe `r g b` gilt für alle leuchtenden Pixel.

### PHOTO

`64 × 64` Pixel, RGB565, **big endian** (erstes Byte = oberes Byte), Zeile für Zeile. Der Clip zeigt das Bild doppelt vergrössert auf dem ganzen 128×128-Bildschirm.

### BRIGHTNESS

Globale Helligkeit, 0–255. Die Webseite sendet sie nach jedem Verbinden.

### OFF

Bildschirm schwarz, Animation und Text stoppen.

## Darstellung auf dem Display

Die Webseite zeigt in der Vorschau, wie es aussehen soll. Die Firmware darf von den Details abweichen, soll aber nah dran bleiben:

- LED-Raster: 16 × 8 Zellen mit je 8 × 8 Pixeln, also 128 × 64 Pixel, **senkrecht zentriert** auf dem 128 × 128-Bildschirm (oben und unten je 32 Pixel schwarz).
- Jede Zelle ein runder Punkt (Radius ca. 3 Pixel). Ausgeschaltete Zellen sehr dunkelgrau, damit das Raster zu sehen bleibt.
- Helligkeit multipliziert die Farbwerte (und/oder die Hintergrundbeleuchtung).
