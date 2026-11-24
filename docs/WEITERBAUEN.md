# Weiterbauen ohne Hilfe

Stand 24.11.2026. Diese Anleitung ist für dich, wenn du das Projekt allein weiterbauen willst. Sie sagt, **welche Datei du für welche Änderung öffnest**. Die Phasen für die Hardware stehen in `docs/ANLEITUNG_CLAUDE_CODE.md`, die elektrischen Prüfpunkte in `hardware/PARTS.md`, das Bluetooth-Format in `docs/PROTOCOL.md`.

Die Seite ist reines HTML, CSS und JavaScript. Es gibt keinen Build-Schritt. Speichern, Browser neu laden, fertig.

## Seite starten und prüfen

Auf diesem Windows-Rechner:

```powershell
py -3 -m http.server 8080 -d web
```

Dann http://localhost:8080 öffnen. `npm run serve` ruft `python3` auf, den Befehl gibt es hier nicht.

Einmalig, nur für die Tests: `npm install`. Danach vor jedem Commit `npm test`. Die Tests prüfen das Protokoll, die Karten, die Animationen und die Verdrahtung der Knöpfe. Sie ersetzen keinen Blick in den Browser.

Die veröffentlichte Seite ist https://longbeforetimehadaname.github.io/digital-hairclip/. Ein Push auf `main` startet den Workflow in `.github/workflows/pages.yml`: erst Tests, dann wird der Ordner `web/` veröffentlicht. Die Firmware geht dabei nicht mit online.

## Zwei Hälften, ein Bild

| Hälfte | Wo | Was sie tut |
|---|---|---|
| Webseite | `web/` | Fernbedienung und Vorschau. Läuft im Browser, auch ohne Clip. |
| Firmware | `firmware/hairclip/` | Dasselbe Bild auf dem echten Display, plus Knopf und Bluetooth. |

Die Vorschau ist kein Foto vom Clip. Sie rechnet dieselben Pixel aus, die der Clip später zeichnet: **320 breit, 170 hoch**. Das Display aus der Teileliste ist hochkant 170 × 320. Die Firmware dreht es quer.

Was der Clip **selbst** zeichnet (Tarot, Uhr, Startbild, Lauftext), steht doppelt: in `web/scene.js` und in `firmware/hairclip/render.cpp`. Änderst du die eine Stelle, ändere die andere im selben Zug. Sonst zeigt die Vorschau etwas anderes als der Clip.

## Vom Tippen bis aufs Display

1. `web/index.html` ist das Gerüst: Felder, Knöpfe, Bereiche.
2. `web/app.js` hängt die Knöpfe an und hält den Zustand (Text, Zeichnung, Foto, Tarot, Uhr).
3. `web/protocol.js` packt den Zustand in ein Paket. Jedes Paket beginnt mit dem Byte `0xA5`, dann Typ, Länge, Inhalt.
4. `web/ble.js` schickt die Pakete in Stücken von 180 Bytes an den Clip.
5. `firmware/hairclip/hairclip.ino`, Funktion `handlePacket`, packt sie aus und schaltet den Modus.
6. `render.cpp` oder der Display-Treiber `st7789.cpp` malt die Pixel.

Solange kein Clip da ist, endet der Weg bei Schritt 2: die Vorschau in `app.js`.

## Wo du was änderst

### Nur die Webseite (Aussehen der Fernbedienung)

| Du willst | Datei |
|---|---|
| Texte, Knöpfe, neuen Bereich | `web/index.html`. Ein Bereich ist ein `<section class="panel">` plus ein Tab-Knopf darüber. Die `id` des Tabs ist `tab-…`, die des Bereichs `panel-…`. |
| Farben, Abstände, Schrift der Seite | `web/style.css`, oben die Variablen `--body`, `--accent` und so weiter. Hell und dunkel sind zwei Blöcke. Akzentfarbe ist das Pink der Senden-Taste. |
| Starttext im Nachrichtenfeld | `value="…"` am Feld `#text-input` in `index.html`. Beim Laden kopiert `app.js` diesen Text in die Vorschau (`state.text.value = textInput.value`). Den alten Eintrag `'Hallo Schatz'` im `state`-Objekt kannst du stehen lassen, er wird sofort überschrieben. |
| Farbfelder (Pink, Rosa, Gelb, …) | Liste `COLORS` ganz oben in `web/app.js`. Gilt für Text, Zeichnen und Uhr. |
| Schrift und Grösse des Lauftexts | `FONT` in `app.js` (jetzt Nunito, 80px, fett). Höhe des Streifens ist `TEXT_H` in `protocol.js` (112). Die muss zur Firmware passen, also nicht allein ändern. |
| Tempo des Lauftexts | Schieber in `index.html` (`#text-speed`, 1–10). Der Clip rechnet `Geschwindigkeit × 30` Pixel pro Sekunde. Dieselbe Formel steht in `paintText` in `app.js` und in der Firmware. |
| Pinsel, maximale Bilder beim Zeichnen | `MAX_DRAW_FRAMES` und der Schieber `#brush` / `#draw-fps` in `index.html`. Die Zeichenlogik (Stift, Füllen, Radierer) ist in `app.js` unter „Zeichnen“, die Pixel-Rechnungen in `web/pixels.js`. |

Die Seite soll wie eine Fernbedienung aussehen: hellgrau, schwarze Tasten, ein Pink, keine Verläufe, kaum Rundungen. Schrift der Seite: Archivo und IBM Plex Mono, geladen von Google Fonts in `index.html`. Ohne Internet fällt der Browser auf eine Ersatzschrift zurück.

### Bild auf dem Clip (Vorschau und später das echte Display)

| Du willst | Datei |
|---|---|
| Neue fertige Animation | `web/presets.js`. Ein Eintrag in `PRESETS` mit `id`, `name`, `fps` und einer Funktion, die Bilder zurückgibt. Jedes Bild ist 320 × 170 Pixel, vier Bytes pro Pixel (Rot, Grün, Blau, Deckkraft). Wenige flache Farben, sonst wird die Datei für den Clip zu gross (`MAX_ANIM_BYTES` in `protocol.js`, 64 KB für alle Bilder zusammen). Danach einen Test in `test/presets.test.js` ergänzen. Die Knöpfe auf der Seite entstehen von selbst aus `PRESETS`. |
| Tarot-Texte, Namen, Stichworte | `web/tarot.js`. Grosse Arkana in `MAJOR`, kleine in `MINOR`. Danach `node tools/gen-firmware-data.mjs` ausführen. Das schreibt `firmware/hairclip/tarot_data.h`. Diese Datei nicht von Hand ändern. `REVERSED_CHANCE` (0,3) ist die Chance, dass eine Karte umgekehrt liegt. Derselbe Wert muss in der Firmware gelten, der Generator übernimmt ihn. |
| Wie eine Karte oder die Uhr aussieht | `web/scene.js` und `firmware/hairclip/render.cpp`. Farben der Karte: `COLORS` in `scene.js`. Kartenposition: `CARD`. Wie lange eine von drei Karten stehen bleibt: `SPREAD_MS` (6000). Misch-Animation: `SHUFFLE_STEPS` und `SHUFFLE_MS`. In `render.cpp` die gleichen Zahlen suchen und mitziehen. Tests: `test/scene.test.js` und `test/tarot.test.js`. |
| Startbild „Hairclip“ auf dem Clip | Funktion `splash` in `render.cpp`. Die Vorschau zeigt dieses Bild nicht, nur der echte Clip nach dem Einschalten. |
| Uhr-Wochentage | `WEEKDAYS` in `scene.js` und `WEEKDAY` in `render.cpp`. |

### Bluetooth und neue Befehle

Ein neuer Befehl (zum Beispiel „Name anzeigen“) ist der aufwendigste Weg. Vier Stellen müssen zusammenpassen:

1. `web/protocol.js` (Konstante `TYPE`, Paket bauen)
2. `docs/PROTOCOL.md` (Tabelle der Befehle)
3. `firmware/hairclip/hairclip.ino` (`handlePacket`)
4. `test/protocol.test.js`

Die Typ-Nummern stehen fest: 1 Animation, 2 Text, 3 Foto, 4 Helligkeit, 5 Aus, 6 Tarot, 7 Uhr. Eine neue Nummer anhängen, keine bestehende umbiegen. Unbekannte Nummern ignoriert der Clip, damit eine neuere Webseite einen älteren Clip nicht abstürzen lässt.

Grenzen, die Webseite und Clip teilen, stehen oben in `protocol.js`: Bildgrösse `W` und `H`, Text-Höhe `TEXT_H`, Foto-Zeilen pro Paket `PHOTO_ROWS`, Stückgrösse `CHUNK` (180). In der Firmware heissen sie ähnlich, in `hairclip.ino` und `st7789.h` (`W`, `H`).

### Nur die Firmware (wenn das Board da ist)

Alles, was du am echten Teil anpassen musst, steht in `firmware/hairclip/config.h`:

| Was | Einstellung |
|---|---|
| Welcher Draht an welchem Pin | `PIN_TFT_…` und die Tabelle in `firmware/README.md` |
| Bild verschoben | `TFT_X_OFFSET`, `TFT_Y_OFFSET` (bei diesem 170er-Display meist 0 und 35) |
| Bild steht auf dem Kopf | `TFT_ROTATE_180` |
| Farben wie ein Negativ | `TFT_INVERT` |
| Rot und Blau vertauscht | `TFT_BGR` |
| Bluetooth-Name | `DEVICE_NAME` (die Seite sucht Geräte, deren Name mit `Hairclip` beginnt: `DEVICE_NAME_PREFIX` in `protocol.js`) |
| Display geht von allein aus | `AUTO_OFF_MINUTES` (0 = nie). Ein Knopfdruck weckt es. |
| Schütteln zieht eine Karte | `PIN_SHAKE` (jetzt −1, also aus). Braucht den optionalen Schalter aus der Teileliste. |

Aufspielen, Knopf und die Fälle „Bild stimmt nicht“ stehen in `firmware/README.md`. Die Firmware ist übersetzt, aber noch nie auf dem echten Board gelaufen. Erwarte, dass Versatz und Farben in `config.h` noch einmal gedreht werden müssen.

`font_data.h`, `tarot_data.h` und `web/clipfont.js` sind erzeugt. Nicht von Hand editieren. Nach einer Änderung an `web/tarot.js` oder `tools/fonts.json`:

```powershell
node tools/gen-firmware-data.mjs
```

`test/generated.test.js` schlägt fehl, wenn du das vergisst.

## Ordner

| Ordner | Anfassen, wenn |
|---|---|
| `web/` | die Fernbedienung oder die Vorschau |
| `firmware/hairclip/` | der Clip selbst |
| `test/` | du etwas geändert hast, das schon einen Test hat, oder ein neues Verhalten absichern willst |
| `tools/` | Schriften oder der Generator für die Firmware-Daten |
| `docs/` | das Protokoll oder diese Anleitung |
| `hardware/` | Teile, Polung, später das Gehäuse. Noch keine OpenSCAD-Datei. Erst messen, wenn die Teile da sind. |

## Was du besser nicht anfasst

- `node_modules/` (liegt nur lokal, steht in `.gitignore`)
- Die erzeugten Dateien oben
- Pin-Nummern raten. Die Beschriftung am gelieferten Display ablesen. Die Fotos des Angebots zeigen GND, VCC, SCL, SDA, RES, DC, CS, BLK. VCC an **3,3 V**, nicht an 5 V.
- Akku anschliessen, bevor die Prüfpunkte in `hardware/PARTS.md` durch sind: Polung mit dem Multimeter, nur der 1150-mAh-Akku mit Schutzschaltung, Ausgang des Lademoduls messen, beim ersten Test nur USB und kein Akku.

## Kleiner Ablauf für eine Änderung

1. Datei aus der Tabelle oben ändern. Wenn das Bild auf dem Clip betroffen ist, die zweite Stelle gleich mit.
2. `npm test`.
3. Seite neu laden und die betroffene Stelle durchklicken (Text, Zeichnen, Animation, Foto, Tarot, Uhr).
4. Commit, wenn du soweit bist. Push auf `main` aktualisiert die öffentliche Seite.

Die Firmware schiebst du nicht über die Webseite auf den Clip. Dafür brauchst du die Arduino IDE und ein USB-Datenkabel, siehe `firmware/README.md`.
