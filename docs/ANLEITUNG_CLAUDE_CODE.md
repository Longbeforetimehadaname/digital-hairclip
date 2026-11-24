# Anleitung für Claude Code

Diese Anleitung führt dich Phase für Phase durch das Projekt. Lies zuerst `CLAUDE.md`, `PLAN.md` und `docs/PROTOCOL.md`. Arbeite **eine Phase nach der anderen** und hör am Ende jeder Phase auf, um dem Benutzer zu berichten.

## So arbeitest du mit dem Benutzer

- Er spricht Deutsch, kann etwas programmieren, hat aber kaum Hardware-Erfahrung. Erkläre einfach, ohne Fachjargon, und sag bei jedem Hardware-Schritt, **warum** er nötig ist.
- Stell Rückfragen, wenn etwas unklar ist (höchstens eine pro Antwort). Rate nicht bei Pinbelegungen, Massen oder Teilen.
- Sag ehrlich, was du **nicht prüfen konntest** (zum Beispiel: „im Browser angesehen“ oder „am echten Board getestet“ ist etwas anderes als „Tests laufen“).
- Kleine Schritte, kleine Commits mit verständlichen Meldungen. Vor jedem Commit `npm test`.
- **Nichts bestellen, nichts bezahlen, keine Konten anlegen.** Repo auf GitHub anlegen oder pushen nur nach ausdrücklichem Ja des Benutzers (Name und Sichtbarkeit vorher klären). Das Geschenk ist eine Überraschung.

## Phase 0: Einstieg (ca. 10 Minuten)

1. `CLAUDE.md`, `PLAN.md`, `docs/PROTOCOL.md`, `hardware/PARTS.md` lesen.
2. `npm install` und `npm test`. Erwartet: alle Tests grün.
3. Dem Benutzer in 5 Sätzen sagen, was du verstanden hast und was als Nächstes ansteht.

**Fertig, wenn:** Tests grün und der Benutzer das Verständnis bestätigt hat.

## Phase 1: Webseite im echten Browser prüfen und verbessern

Die Seite wurde bisher nur mit jsdom getestet, **nie in einem echten Browser angesehen**. Das holst du nach.

1. `npm run serve` starten, Seite auf `http://localhost:8080` öffnen.
2. Wenn möglich selbst Screenshots machen (z. B. `npx playwright install chromium`, dann Seite bei 375 px Breite fotografieren). Wenn das nicht geht, bitte den Benutzer um Screenshots oder eine Beschreibung.
3. Prüfliste:
   - Vorschau-Clip oben: Punkte leuchten, Raster ist sichtbar, nichts abgeschnitten.
   - **Text:** Die Pixelschrift „Silkscreen“ lädt, Text ist **senkrecht mittig** in den 8 Zeilen, Buchstaben sind lesbar, Umlaute funktionieren. Wenn die Schrift nicht lädt oder schief sitzt, `buildColumns` in `web/app.js` verbessern (im Zweifel eine kleine feste 5×7-Schrift einbauen).
   - **Zeichnen:** Malen mit Maus und mit Finger (Touch), Radierer, Farben, Bilder kopieren/löschen, Abspielen.
   - **Animation:** alle vier Presets laufen schön und ohne Flackern.
   - **Foto:** füllt das ganze Display (320 × 170), Ränder werden abgeschnitten.
   - Hell- und Dunkelmodus, Tastatur-Bedienung der Tabs, Lesbarkeit der Texte.
4. Gefundene Fehler beheben, dazu wo sinnvoll einen Test ergänzen.

**Fertig, wenn:** der Benutzer die Seite angesehen hat und zufrieden ist. Alle Tests grün.

## Phase 2: Firmware (erst, wenn die Teile da sind)

Frag den Benutzer zuerst, ob das Board und der Akku angekommen sind. **Ohne Hardware nicht weitermachen** (nur vorbereiten, z. B. Projektgerüst).

### 2a. Vor dem ersten Einschalten: Sicherheits-Check (mit dem Benutzer durchgehen)

- Ist es der richtige Akku (102542, 1150 mAh) und **nicht** der 250-mAh-Akku?
- Hat der Akku einen **2-poligen JST-PH-2.0-Stecker** und eine Schutzschaltung?
- **Polung mit Multimeter geprüft** und mit der Beschriftung **B+ / B−** am Lademodul verglichen? Ohne Ja **kein Akku anschliessen**.
- Ausgangsspannung des Lademoduls **ohne Board** gemessen (ca. 5 V)?
- Erst nur per USB ans ESP32-Board, **ohne Akku und ohne Lademodul**.

### 2b. Aufgaben

Die Firmware ist schon geschrieben und übersetzt (`firmware/hairclip/`, Anleitung in `firmware/README.md`), aber nie auf Hardware gelaufen. Darum jetzt:

1. Verkabelung mit dem Benutzer Schritt für Schritt durchgehen (Tabelle in `firmware/README.md`). Pin-Beschriftung am echten Display ablesen lassen.
2. Aufspielen (Board „ESP32 Dev Module“, Partition „Huge APP“). Erwartet: Startbild „Hairclip“.
3. Display-Einstellungen in `config.h` anpassen, bis das Bild stimmt (Versatz, Drehung, Farben).
4. Knopf BOOT kurz und lang drücken: Mischen, dann eine bzw. drei Tarot-Karten.
5. Mit nRF Connect testen (Pakete in `firmware/README.md`), dann mit der Webseite.
6. Laufzeit mit Akku messen, bei Bedarf `AUTO_OFF_MINUTES` setzen.
**Fertig, wenn:** alle sieben Befehle und der Knopf funktionieren. Ablage in `firmware/`, Doku aktualisiert.

## Phase 3: Verbindung Webseite ↔ Clip

1. Seite über `https://` (GitHub Pages) oder `localhost` auf einem **Android-Handy mit Chrome** öffnen und mit dem Clip verbinden.
2. Alle vier Bereiche echt senden und das Ergebnis mit der Vorschau vergleichen.
3. Geschwindigkeit messen: Das Foto sind ca. 109 KB, in 180-Byte-Stücken rund 600 Schreibzugriffe mit Antwort. Text und Animationen sind meist 2–25 KB. Wenn es zu langsam ist oder abbricht, `CHUNK` in `web/protocol.js` anpassen und `docs/PROTOCOL.md` aktualisieren.
4. iPhone-Test mit der App **Bluefy** (Safari kann kein Web Bluetooth).
5. Verbindungsabbruch, Neuverbinden und zu schnelles Senden provozieren. Es darf nichts hängen bleiben.

**Fertig, wenn:** Text, Zeichnung, Animation und Foto kommen auf dem Clip so an wie in der Vorschau.

## Phase 4: Gehäuse (OpenSCAD)

1. Den Benutzer bitten, **Board, Akku und Display mit der Schieblehre zu messen**. Bekannt ist nur der Akku (ca. 42 × 25 × 10 mm laut Händler). ESP32-Board, Display und Lademodul müssen gemessen werden.
2. Parametrisches Modell in `hardware/case.scad`: Boden-/Deckelschale, Fenster fürs Display, Öffnung für USB-C, Fach für den Akku, Platz für Kabel, flache Rückseite zum Aufkleben auf die Spange. Spiel von etwa 0,3 mm einplanen.
3. Rosa Optik wie im Video. Ein Schiebeschalter-Ausschnitt nur, wenn der Benutzer einen Schalter einbaut.
4. STL exportieren und dem Benutzer Druckhinweise geben (PLA, Schichthöhe 0,2 mm, ohne Stützen wenn möglich). Erst einen Testdruck vorschlagen, bevor das schöne Teil gedruckt wird.
5. Beim Einbau: **kein Akku quetschen oder knicken**, Kabel nicht blank nebeneinander, Gehäuse darf nicht auf den Akku drücken.

**Fertig, wenn:** alles ohne Druck auf den Akku ins Gehäuse passt und der Deckel schliesst.

## Phase 5: Feinschliff und Übergabe

- Laufzeit mit voll geladenem Akku testen (mit Helligkeit, wie sie im Alltag gebraucht wird).
- Nochmals alles auf dem Handy der Freundin (Android, Chrome) ausprobieren, wenn möglich ohne dass sie es merkt, sonst mit einem eigenen Android.
- GitHub Pages erst kurz vor der Übergabe einschalten (Repo-Sichtbarkeit mit dem Benutzer besprechen). Dann den Link als Lesezeichen/Startbildschirm-Verknüpfung auf ihrem Handy anlegen.
- `README.md` und `PLAN.md` auf den Endstand bringen.

## Wenn etwas nicht klappt

- **Board wird nicht erkannt:** anderes USB-C-Kabel (Datenkabel!), Boot-Modus (Taste halten beim Einstecken), anderer Port.
- **Display bleibt schwarz:** Verkabelung und Pins in der Firmware prüfen, Hintergrundbeleuchtung (BLK) an? Bei verschobenem Bild den Versatz (Offset) für 170×320 in der Bibliothek einstellen.
- **Webseite findet den Clip nicht:** Clip an? Name beginnt mit `Hairclip`? Android: Standort/Bluetooth für Chrome erlaubt? Seite über `https://` oder `localhost` geöffnet?
- **Senden bricht ab:** Stückgrösse verkleinern, kurze Pausen zwischen Schreibzugriffen erhöhen.
- **Etwas riecht, wird heiss oder der Akku bläht sich auf:** sofort trennen, nicht weiter laden, dem Benutzer sagen, dass der Akku ersetzt werden muss.

## Offene Punkte, bei denen du den Benutzer fragen musst

- Land/Händler und ob die Teile schon da sind
- Wer druckt das Gehäuse, mit welchem Material
- Repo-Name und Sichtbarkeit
- Soll der Clip nach einiger Zeit von selbst ausgehen?
