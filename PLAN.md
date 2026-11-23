# Projektplan: Digitaler Haarclip

Stand: 23.11.2026. Ziel: fertig zum Verschenken am **24.12.2026** (gut 4 Wochen).

## Idee

Ein Haarclip mit kleinem Display, auf den man per Handy Nachrichten, Zeichnungen, Animationen und Fotos schicken kann. Inspiriert vom Video „Digital Hairclip“ (rosa Gehäuse, Mini-Display, ESP32-Platine, Akku, Steuerung per Handy-App).

## Entscheidungen

| Thema | Entscheidung | Warum |
|---|---|---|
| Hardware | **LilyGO T-QT Pro** (ESP32-S3, 0,85" Farbdisplay 128×128, BLE, Akku-Ladeschaltung) | Ein Teil ersetzt Chip, Display und Ladeschaltung. Kaum Löten, schlanker Clip (33 × 18 mm), ca. 12 € |
| Look | 16×8-Raster aus „LED-Punkten“ in Software (Zellen à 8×8 Pixel) | Sieht aus wie das Video, ohne ein 8-cm-LED-Panel zu verbauen |
| Fotos | Zusätzlich als echtes Foto (64×64, doppelt vergrössert) | Farbdisplay kann das, LED-Matrix nicht |
| Steuerung | Webseite mit Web Bluetooth, keine App | Android: Chrome. iPhone zum Testen: App „Bluefy“. Läuft von GitHub Pages |
| Gehäuse | 3D-Druck bei Bekannten mit Drucker, rosa | Masse erst nach Eintreffen der Teile |
| Sprache der Oberfläche | Deutsch | |

Verworfen: DIY-Matrix aus LED-Streifen (ca. 8 × 4 cm, viel Löten, zu gross). Fertige AliExpress-LED-Panels (nach Händlerangabe 8/16/32 cm, zu gross).

## Funktionen

1. Scrolling-Text mit Farbe und Tempo
2. Selbst zeichnen im 16×8-Raster, mit mehreren Bildern als Animation
3. Fertige Animationen: Herz, Funkeln, Regenbogen, Regen
4. Foto anzeigen (als LED-Bild 16×8 oder als Foto auf dem ganzen Bildschirm)
5. Helligkeit und Display aus

## Aufbau

```
Handy (Chrome / Bluefy)  --BLE-->  Clip (ESP32-S3, T-QT Pro)
   web/ (Steuerseite)              firmware/ (noch zu schreiben)
   Protokoll: docs/PROTOCOL.md
```

## Zeitplan

| Woche | Zeitraum | Ziel |
|---|---|---|
| 1 | 23.–29.11. | Teile bestellen (Lieferzeit prüfen!), Webseite fertig testen, Software einrichten, Löten üben |
| 2 | 30.11.–6.12. | Teile treffen ein. Board mit Display-Beispiel testen, Akku-Polung prüfen, anschliessen |
| 3 | 7.–13.12. | Firmware (Bluetooth, Darstellung). Gehäuse nach echten Massen konstruieren, drucken lassen |
| 4 | 14.–20.12. | Einbauen, Laufzeit testen, Feinschliff, Android-Test mit echtem Handy |
| Reserve | 21.–24.12. | Puffer, Verpacken |

Wunsch: Teile spätestens am 5.12. da. Hartes Limit: ca. 15.12. Danach wird es eng.

## Einkaufsliste

Siehe [hardware/PARTS.md](hardware/PARTS.md). Kurz: T-QT Pro (Version „Pro“), LiPo 3,7 V 200–300 mAh mit 2-poligem JST-PH-2.0-Stecker und Schutzschaltung, Haarspange, USB-C-Datenkabel; bei Bedarf Lötzeug, Multimeter, Klebeband/Epoxid, Ersatzboard.

## Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Lieferzeit der Teile | Händler mit schneller Lieferung wählen, früh bestellen, Ersatz einplanen |
| Akku falsch gepolt | Mit Multimeter prüfen, bevor er ans Board kommt |
| Beim Löten etwas kaputt | Vorher an Schrott üben, Ersatzboard (ca. 12 €) |
| Web Bluetooth auf iPhone | Bluefy nutzen. Das Geschenk selbst ist für Android, dort geht Chrome |
| Akku hält nicht lange genug | Helligkeit begrenzen, Display nach Inaktivität ausschalten |
| Überraschung fliegt auf | Repo privat lassen oder lokal testen, Pages erst kurz vorher aktivieren |

## Testen ohne Geld zu verlieren

- Die Webseite hat eine eingebaute Vorschau, sie geht komplett ohne Hardware.
- Simulatoren wie Wokwi (kostenlos für private Nutzung) prüfen höchstens Code, nicht Bluetooth, Akku oder Polung. Das T-QT Pro ist dort kein fertiges Board.
- Echte Fehler passieren elektrisch (Polung, Kurzschluss, Löten). Dagegen helfen Multimeter, Löten üben und ein Ersatzboard.

## Offene Punkte

- [ ] In welchem Land wird bestellt? (entscheidet über den Händler)
- [ ] Wer druckt das Gehäuse und mit welchem Material?
- [ ] Repo-Name, privat oder öffentlich?
- [ ] Soll der Clip nach einiger Zeit von selbst ausgehen?
- [ ] Teile gefunden? (läuft über einen separaten Agenten, Ergebnis hier eintragen)

## Nächste Schritte

1. Seite lokal im Browser durchklicken (`npm run serve`), Fehler notieren oder von Claude Code beheben lassen.
2. Teile bestellen, Akku-Link vorher prüfen lassen.
3. Bis die Teile da sind: Bluefy auf dem iPhone installieren, Arduino IDE oder PlatformIO einrichten, Löten üben.
