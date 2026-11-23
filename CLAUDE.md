# CLAUDE.md

Hinweise für Claude Code in diesem Repo. Der Benutzer spricht Deutsch und hat wenig Hardware-Erfahrung (etwas Programmierkenntnisse). Antworte auf Deutsch, einfach und ohne Fachjargon, und frage nach, wenn etwas unklar ist.

## Projekt

Digitaler Haarclip als Weihnachtsgeschenk (24.12.2026). Board: LilyGO T-QT Pro (ESP32-S3, 0,85" 128×128). Die Webseite in `web/` steuert den Clip per Web Bluetooth und zeigt oben eine Vorschau. Gesamtplan: `PLAN.md`. **Schritt-für-Schritt-Anleitung mit Phasen: `docs/ANLEITUNG_CLAUDE_CODE.md`.** Protokoll: `docs/PROTOCOL.md`. Teile und Prüfpunkte: `hardware/PARTS.md`.

## Stand

- Fertig und getestet (`npm test`, 21 Tests): Protokoll (`web/protocol.js`), Animationen (`web/presets.js`), Oberfläche (`web/app.js`, `web/index.html`, `web/style.css`), Bluetooth-Hülle (`web/ble.js`).
- **Nicht** in einem echten Browser angesehen und **nicht** mit echter Hardware getestet. Das Aussehen und die Pixelschrift („Silkscreen“, Text → 8 Zeilen, siehe `buildColumns` in `web/app.js`) müssen im Browser geprüft werden. Falls der Text schlecht aussieht oder nicht mittig sitzt, dort ansetzen.
- Offen: Firmware (`firmware/`), Gehäuse (`hardware/`), echte Verbindung Webseite ↔ Clip.

## Nächste Schritte

1. Seite lokal starten (`npm run serve`) und im Browser durchklicken: Text, Zeichnen, Animationen, Foto. Fehler beheben.
2. Wenn die Teile da sind: Firmware nach `firmware/README.md` schreiben. Zuerst das Display-Beispiel aus dem LilyGO-Repo `Xinyuan-LilyGO/T-QT` zum Laufen bringen, dann BLE.
3. Verbindung testen: Android mit Chrome, iPhone mit der App Bluefy.
4. Gehäuse in OpenSCAD (parametrisch) nach den echten Massen, dann drucken lassen.

## Regeln

- **Nichts bestellen, nichts bezahlen.** Käufe macht der Benutzer selbst.
- Protokoll nur gleichzeitig in `web/protocol.js`, `docs/PROTOCOL.md`, Firmware und `test/protocol.test.js` ändern.
- Keine Build-Werkzeuge einführen: `web/` bleibt reines HTML/CSS/JS (ES-Module), damit GitHub Pages es direkt ausliefert.
- Vor dem Commit `npm test` laufen lassen.
- Akku-Sicherheit ernst nehmen (Polung prüfen, nur Akkus mit Schutzschaltung). Bei Hardware-Anweisungen immer die Prüfpunkte aus `hardware/PARTS.md` erwähnen.
- Das Geschenk ist eine Überraschung: Repo-Sichtbarkeit und GitHub Pages nur nach Rücksprache mit dem Benutzer öffentlich machen.
