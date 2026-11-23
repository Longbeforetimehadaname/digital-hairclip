# Teileliste und Prüfpunkte

Stand: 23.11.2026. Der Benutzer hat sich für eine **grössere Bauweise** entschieden (statt LilyGO T-QT Pro). Die Teile unten sind bestellt, aber noch nicht da. Alle Angaben stammen von den Händlerseiten und müssen am echten Teil geprüft werden.

## Bestellt

| Teil | Händlerangaben | Worauf achten |
|---|---|---|
| **ESP32-Entwicklungsboard** (ESP32-WROOM-32, USB-Chip CH340C), AliExpress 1005004685935016 | Dual Core, WLAN, Bluetooth (auch Bluetooth LE) | Kein Display, keine Akku-Ladeschaltung. Welche Variante (Micro-USB oder USB-C, 30 oder 38 Pins) geliefert wurde, am Board ansehen. Ein zweites ESP32-Board (CP2102, AliExpress 1005006220389074) dient, falls bestellt, als **Ersatzboard**. |
| **Display 1,9" IPS**, AliExpress 1005007239120587 | 170 × 320 Pixel, Farbe, Treiber **ST7789**, Anschluss SPI | Hochformat, nicht quadratisch. Pin-Beschriftung am echten Modul ablesen, nicht raten. |
| **Lade- und Spannungsmodul TP4056 mit Step-up**, AliExpress 1005007402717866 (Realpoy) | Lädt den Akku über USB, macht aus 3,7 V eine Ausgangsspannung (5 V oder einstellbar) | Ladestrom bei solchen Modulen meist ca. 1 A (bestimmt durch einen kleinen Widerstand), am Modul prüfen. Ausgangsspannung vor dem Anschliessen ans Board mit dem Multimeter messen: muss ca. 5 V sein. |
| **Akku 102542**, 3,7 V, 1150 mAh, Li-Polymer, akku-king.ch | **JST-PH-2.0-Stecker**, **mit Schutzschaltung** (Kurzschluss, Überladung über 4,25 V, Tiefentladung unter 3 V, Überlast über 2C). Dauerhaft 600 mA, kurzzeitig 1150 mA. Ca. 42 × 25 × 10 mm | Ersetzt den zuerst bestellten 502030 mit 250 mAh. |

**Den 250-mAh-Akku (502030) nicht verwenden.** Er verträgt laut Händler dauerhaft nur 125 mA. Board, Display und Spannungswandler brauchen geschätzt 200–350 mA, und das Lademodul lädt mit etwa 1 A. Beides ist für ihn zu viel.

## Schon vorhanden (laut Benutzer)

- Lötkolben (Zugang)
- Kabel
- Jemand, der das Gehäuse in 3D druckt

## Noch zu besorgen

- **Multimeter** (ca. 10 €), falls keins da ist. Pflicht für die Prüfungen unten.
- **Haarspange / Barrette**, flach, zum Aufkleben des Gehäuses. Grösse erst wählen, wenn das Gehäuse feststeht.
- **USB-Datenkabel** passend zum Board (Micro-USB oder USB-C), nicht nur ein Ladekabel.
- Starkes doppelseitiges Klebeband oder Epoxid.
- Optional: kleiner Schiebeschalter zum Ausschalten, JST-PH-2.0-Buchse oder -Kabel für das Lademodul (der Akku hat einen Stecker, das Modul hat meist nur Lötpunkte B+ und B−).

## Grobe Verkabelung (am echten Teil bestätigen!)

```
Akku (JST-PH) ── B+ / B− ── Lademodul ── OUT+ / OUT− (ca. 5 V) ── 5V / GND am ESP32-Board
                                                                  3V3 / GND ── Display
                                                         SPI-Pins des ESP32 ── Display
```

- Welche ESP32-Pins für das Display genommen werden, legt die Firmware fest. Erst die Beschriftung von Board und Display ablesen.
- Offene Frage zum Prüfen: Was passiert, wenn das Board gleichzeitig per USB am PC hängt und vom Lademodul 5 V bekommt? Bis das geklärt ist, beim Programmieren das Lademodul vom Board trennen.

## Vor dem ersten Anstecken des Akkus (Pflicht)

1. **Polung prüfen.** Beim JST-PH-Stecker gibt es keinen verlässlichen Standard. Mit dem Multimeter messen (rotes Kabel soll + sein) und mit der Beschriftung **B+ / B−** am Lademodul vergleichen. Ein falsch angeschlossener Akku kann Modul und Board zerstören.
2. Nur Akkus **mit Schutzschaltung** verwenden.
3. Nicht löten, solange der Akku angeschlossen ist. Kabel nie blank nebeneinanderliegen lassen.
4. Aufgeblähte, beschädigte oder heiss werdende Akkus sofort trennen und aussortieren.
5. Ausgangsspannung des Lademoduls **ohne angeschlossenes Board** messen, bevor es ans ESP32 kommt.

## Abmessungen fürs Gehäuse

| | Mass |
|---|---|
| ESP32-Board | am echten Board messen (Pins stehen nach unten ab und machen es höher) |
| Display 1,9" | am echten Modul messen, inklusive Flachkabel und Stiftleiste |
| Lademodul | am echten Modul messen, USB-Buchse muss von aussen erreichbar sein |
| Akku 102542 | ca. 42 × 25 × 10 mm (Händlerangabe) |

Gehäuse erst konstruieren, wenn die echten Teile da sind und mit der Schieblehre vermessen wurden.
