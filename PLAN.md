# Projektplan: Digitaler Haarclip

Stand: 23.11.2026. Ziel: fertig zum Verschenken am **24.12.2026** (gut 4 Wochen).

## Idee

Ein Haarclip mit kleinem Display, auf den man per Handy Nachrichten, Zeichnungen, Animationen und Fotos schicken kann. Inspiriert vom Video „Digital Hairclip“ (rosa Gehäuse, Mini-Display, ESP32-Platine, Akku, Steuerung per Handy-App).

## Entscheidungen

| Thema | Entscheidung | Warum |
|---|---|---|
| Hardware | **Grössere Bauweise** (Entscheid des Benutzers, 23.11.2026): ESP32-DevKit (ESP32-WROOM-32, BLE), Display 1,9" 170×320 ST7789, Lade-/Step-up-Modul TP4056, Akku 1150 mAh | Der Clip darf grösser sein. Mehr Löten und Verkabeln als mit dem zuerst geplanten LilyGO T-QT Pro, dafür grösseres Display und längere Laufzeit |
| Look | **Echte Pixel**, Display im Querformat 320 × 170 (Entscheid des Benutzers, 23.11.2026) | Scharfer Text, feine Zeichnungen und Fotos statt LED-Punkte |
| Fotos | Foto über das ganze Display, 320 × 170 | Farbdisplay kann das |
| Steuerung | Webseite mit Web Bluetooth, keine App | Android: Chrome. iPhone zum Testen: App „Bluefy“. Läuft von GitHub Pages |
| Gehäuse | 3D-Druck bei Bekannten mit Drucker, rosa | Masse erst nach Eintreffen der Teile |
| Sprache der Oberfläche | Deutsch | |

Verworfen: DIY-Matrix aus LED-Streifen (ca. 8 × 4 cm, viel Löten, zu gross). Fertige AliExpress-LED-Panels (nach Händlerangabe 8/16/32 cm, zu gross).

## Funktionen

1. Scrolling-Text mit Farbe und Tempo
2. Selbst zeichnen mit Pinsel (Grösse einstellbar), bis 8 Bilder als Animation
3. Fertige Animationen: Herz (rot), Seelen, Hamster, Junimo, Zatanna, Äpfel, DVD, Funkeln, Regenbogen, Regen
4. Foto auf dem ganzen Bildschirm, Ausschnitt verschiebbar
5. Helligkeit und Display aus
6. **Tarot** (Wunsch vom 24.11.2026, höchste Priorität): am Clip per Knopf (kurz eine, lang drei Karten) oder Schütteln (mit Zusatzschalter), auch ohne Handy. Auf der Webseite mit Deutung und Verlauf.
7. Uhr: Zeit vom Handy, der Clip zählt selbst weiter
8. Zeichnen mit Füllen und Zurück, Zeichen wie ♥ ★ im Text, Seite lässt sich als App auf den Startbildschirm legen

## Aufbau

```
Handy (Chrome / Bluefy)  --BLE-->  Clip (ESP32-DevKit + Display 1,9")
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

Siehe [hardware/PARTS.md](hardware/PARTS.md). Bestellt: ESP32-DevKit, Display 1,9" ST7789, Lademodul TP4056 mit Step-up, Akku 102542 (1150 mAh, JST-PH, Schutzschaltung). Noch nötig: Multimeter, Haarspange, USB-Datenkabel, Klebeband/Epoxid.

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
- Simulatoren wie Wokwi (kostenlos für private Nutzung) prüfen höchstens Code, nicht Bluetooth, Akku oder Polung. Ein normales ESP32-DevKit gibt es dort, das Display teilweise auch.
- Echte Fehler passieren elektrisch (Polung, Kurzschluss, Löten). Dagegen helfen Multimeter, Löten üben und ein Ersatzboard.

## Offene Punkte

- [ ] In welchem Land wird bestellt? (entscheidet über den Händler)
- [ ] Wer druckt das Gehäuse und mit welchem Material?
- [ ] Repo-Name, privat oder öffentlich?
- [ ] Soll der Clip nach einiger Zeit von selbst ausgehen?
- [x] Teile bestellt (23.11.2026), siehe `hardware/PARTS.md`
- [x] Darstellung: echte Pixel im Querformat 320 × 170 (Protokoll Version 2)

## Nächste Schritte

1. Seite lokal im Browser durchklicken (`npm run serve`), Fehler notieren oder von Claude Code beheben lassen.
2. Teile bestellen, Akku-Link vorher prüfen lassen.
3. Bis die Teile da sind: Bluefy auf dem iPhone installieren, Arduino IDE oder PlatformIO einrichten, Löten üben.
