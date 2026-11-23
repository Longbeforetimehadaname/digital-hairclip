# CLAUDE.md

Hinweise für Claude Code in diesem Repo. Der Benutzer spricht Deutsch und hat wenig Hardware-Erfahrung (etwas Programmierkenntnisse). Antworte auf Deutsch, einfach und ohne Fachjargon, und frage nach, wenn etwas unklar ist.

## Projekt

Digitaler Haarclip als Weihnachtsgeschenk (24.12.2026). Hardware (grössere Bauweise, seit 23.11.2026, ersetzt das T-QT Pro): ESP32-DevKit (ESP32-WROOM-32), Display 1,9" 170×320 ST7789 (SPI), Lade-/Step-up-Modul TP4056, Akku 102542 1150 mAh mit JST-PH und Schutzschaltung. Details: `hardware/PARTS.md`. Die Webseite in `web/` steuert den Clip per Web Bluetooth und zeigt oben eine Vorschau. Gesamtplan: `PLAN.md`. **Schritt-für-Schritt-Anleitung mit Phasen: `docs/ANLEITUNG_CLAUDE_CODE.md`.** Protokoll: `docs/PROTOCOL.md`. Teile und Prüfpunkte: `hardware/PARTS.md`.

## Stand

- Fertig und getestet (`npm test`, 29 Tests): Protokoll (`web/protocol.js`), Animationen (`web/presets.js`), Pixel-Hilfen (`web/pixels.js`: Textstreifen, Linien, Pinsel), Oberfläche (`web/app.js`, `web/index.html`, `web/style.css`), Bluetooth-Hülle (`web/ble.js`).
- Repo: `Longbeforetimehadaname/digital-hairclip`, **seit 23.11.2026 privat** (Entscheid des Benutzers, wegen der Überraschung). Darum ist GitHub Pages aus und die Seite offline; der Workflow testet nur noch und überspringt das Veröffentlichen. Zum Testen die Seite lokal starten. Kurz vor Weihnachten stellt der Benutzer das Repo wieder öffentlich, dann ist die Seite unter https://longbeforetimehadaname.github.io/digital-hairclip/ erreichbar (eventuell unter Settings → Pages wieder „GitHub Actions“ wählen). Commits mit der noreply-Adresse dieses Kontos (lokal im Repo eingestellt).
- Am 23.11.2026 in Chromium geprüft (375 px, hell/dunkel): Schrift scharf und mittig, Umlaute ok, Zeichnen mit Maus und Touch, Animationen, Foto. **Nicht** mit echter Hardware und **nicht** auf einem echten Handy getestet. Die Pixelschrift kommt von Google Fonts, ohne Internet fällt der Text auf eine Ersatzschrift zurück.
- Offen: Firmware (`firmware/`), Gehäuse (`hardware/`), echte Verbindung Webseite ↔ Clip.
- Darstellung (Entscheid des Benutzers): **echte Pixel**, Display im Querformat 320 × 170. Protokoll Version 2 (`docs/PROTOCOL.md`): Animationen als Lauflängen-Bilder (RGB565), Text als 1-Bit-Streifen (Höhe 112, Schrift Nunito fett), Foto in Zeilenblöcken. Webseite und Tests sind umgestellt und am 23.11.2026 in Chromium (375 px) geprüft. Die Übertragungsgeschwindigkeit (180-Byte-Stücke mit Antwort) ist noch nicht mit echter Hardware gemessen.
- Teile bestellt am 23.11.2026, noch nicht geliefert (Lademodul laut AliExpress ca. 30.11.–5.12.).

## Nächste Schritte

1. Seite lokal starten (`npm run serve`) und im Browser durchklicken: Text, Zeichnen, Animationen, Foto. Fehler beheben.
2. Wenn die Teile da sind: Firmware nach `firmware/README.md` schreiben. Zuerst ein einfaches ST7789-Beispiel (z. B. Bibliothek TFT_eSPI oder Adafruit ST7789) mit der echten Pin-Beschriftung zum Laufen bringen, dann BLE.
3. Verbindung testen: Android mit Chrome, iPhone mit der App Bluefy.
4. Gehäuse in OpenSCAD (parametrisch) nach den echten Massen, dann drucken lassen.

## Regeln

- **Nichts bestellen, nichts bezahlen.** Käufe macht der Benutzer selbst.
- Protokoll nur gleichzeitig in `web/protocol.js`, `docs/PROTOCOL.md`, Firmware und `test/protocol.test.js` ändern.
- Keine Build-Werkzeuge einführen: `web/` bleibt reines HTML/CSS/JS (ES-Module), damit GitHub Pages es direkt ausliefert.
- Vor dem Commit `npm test` laufen lassen.
- Akku-Sicherheit ernst nehmen (Polung prüfen, nur Akkus mit Schutzschaltung). Bei Hardware-Anweisungen immer die Prüfpunkte aus `hardware/PARTS.md` erwähnen.
- Das Geschenk ist eine Überraschung: Repo-Sichtbarkeit und GitHub Pages nur nach Rücksprache mit dem Benutzer öffentlich machen.
