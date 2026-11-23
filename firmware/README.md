# Firmware (noch zu schreiben)

Ziel: Firmware für das **LilyGO T-QT Pro**, die das Protokoll aus [`../docs/PROTOCOL.md`](../docs/PROTOCOL.md) umsetzt.

## Was bekannt ist

- Chip: ESP32-S3 mit WLAN und Bluetooth LE, USB-C zum Programmieren (Arduino oder MicroPython).
- Display: 0,85" IPS, 128 × 128 Pixel, Treiber GC9107. Es gibt auch Varianten mit anderem Treiber (GC9A01), nach der echten Platine richten.
- Zwei Tasten: IO0 und IO47.
- Akkuspannung lesbar über IO4 (laut Händlerangabe), Ladeschaltung eingebaut.
- Pinbelegung und Beispiele: Repo `Xinyuan-LilyGO/T-QT` auf GitHub. **Dort zuerst nachsehen**, statt Pins zu raten.

## Aufgaben

1. Arduino-/PlatformIO-Projekt für das Board aufsetzen und das Display-Beispiel aus dem LilyGO-Repo zum Laufen bringen.
2. BLE-Peripheral mit Nordic UART Service, Gerätename `Hairclip` (z. B. mit NimBLE-Arduino).
3. Paket-Parser mit Puffer, Neusynchronisierung auf `0xA5` und 2-Sekunden-Timeout.
4. Darstellung: LED-Raster 16 × 8 (Zellen à 8 × 8 Pixel, Raster 128 × 64 senkrecht zentriert), Text-Scrolling, Animationen, Foto 64 × 64 verdoppelt, Helligkeit, Aus.
5. Stromsparen: Display dimmen oder ausschalten nach einiger Zeit ohne Verbindung. Ziel: ein Abend Laufzeit.
6. Akkustand über die TX-Characteristic melden (optional, später).

## Testen

Ohne die Webseite lässt sich ein Paket mit einer BLE-Test-App wie nRF Connect von Hand an die Schreib-Characteristic senden. Beispiel Helligkeit auf 100 setzen: `A5 04 01 00 64`.
