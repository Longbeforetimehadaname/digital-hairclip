# Firmware (noch zu schreiben)

Ziel: Firmware für ein **ESP32-DevKit mit 1,9"-Display (ST7789)**, die das Protokoll aus [`../docs/PROTOCOL.md`](../docs/PROTOCOL.md) umsetzt. Teile und Verkabelung: [`../hardware/PARTS.md`](../hardware/PARTS.md).

## Was bekannt ist (Händlerangaben, am echten Teil prüfen)

- Chip: ESP32-WROOM-32 (klassischer ESP32, Dual Core) mit WLAN und Bluetooth LE. USB-Chip CH340C, je nach Variante Micro-USB oder USB-C. Programmieren mit Arduino IDE oder PlatformIO, Board „ESP32 Dev Module“.
- Display: 1,9" IPS, **170 × 320 Pixel** (Hochformat), Treiber **ST7789**, Anschluss SPI. Passende Bibliotheken: TFT_eSPI oder Adafruit ST7735/ST7789.
- Strom: Akku → Lademodul TP4056 mit Step-up → 5 V an den 5V-Pin des Boards. Das Board hat **keinen** Anschluss zum Messen der Akkuspannung. Wer den Akkustand anzeigen will, braucht einen Spannungsteiler an einem Analog-Pin (optional, später).
- **Pins nicht raten.** Die Display-Pins (z. B. SCL, SDA, RES, DC, CS, BLK) an der Beschriftung des echten Moduls ablesen und in der Firmware an einer Stelle festlegen.

## Aufgaben

1. Arduino-/PlatformIO-Projekt aufsetzen und ein einfaches ST7789-Beispiel (Farbe füllen, Text) mit 170 × 320 zum Laufen bringen. Das Board dabei nur per USB versorgen, ohne Akku.
2. BLE-Peripheral mit Nordic UART Service, Gerätename `Hairclip` (z. B. mit NimBLE-Arduino).
3. Paket-Parser mit Puffer, Neusynchronisierung auf `0xA5`, 2-Sekunden-Timeout und Längenlimit 10 000 Bytes.
4. Darstellung: **noch offen**, weil das Display jetzt Hochformat ist. Das Protokoll geht noch vom alten 128×128-Display aus (LED-Raster 16 × 8, Foto 64 × 64). Vor dem Umsetzen mit dem Benutzer klären und Protokoll, Webseite und Tests gleichzeitig anpassen.
5. Stromsparen: Hintergrundbeleuchtung (BLK) dimmen oder ausschalten nach einiger Zeit ohne Verbindung. Ziel: ein Abend Laufzeit.
6. Akkustand über die TX-Characteristic melden (optional, braucht den Spannungsteiler).

## Testen

Ohne die Webseite lässt sich ein Paket mit einer BLE-Test-App wie nRF Connect von Hand an die Schreib-Characteristic senden. Beispiel Helligkeit auf 100 setzen: `A5 04 01 00 64`.
