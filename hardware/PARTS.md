# Teileliste und Prüfpunkte

Stand der Recherche: 23.11.2026. Preise und Lieferzeiten vor dem Kauf prüfen, sie ändern sich.

## Pflicht

| Teil | Worauf achten |
|---|---|
| **LilyGO T-QT Pro** (ESP32-S3, 0,85" 128×128) | Muss die Version **„Pro“** sein (nur die hat die Akku-Ladeschaltung). 4-MB-Flash/2-MB-PSRAM oder 8-MB-Flash geht beides. Masse laut Händlerangabe 33 × 17,8 × 8 mm, 13,5 g. |
| **LiPo-Akku 3,7 V, ca. 200–300 mAh** | **2-poliger JST-PH-2.0-Stecker** (nicht 3-polig, nicht JST-SH 1,0 mm, nicht XH 2,54). Mit Schutzschaltung. Etwa 30 × 20 × 6 mm (Typ 602030), damit er ins Gehäuse passt. |
| **Haarspange / Barrette**, flach | Fürs Aufkleben des Gehäuses, ca. 6–8 cm. |
| **USB-C-Datenkabel** | Nicht nur Ladekabel. |

## Bei Bedarf

- Lötkolben und Lötzinn (Anfängerset). Die Akku-Anschlüsse am Board sind laut Beschreibung Lötpads (2 Pads). Im Lieferumfang liegt laut Händler ein JST-Kabel, das man anlöten kann.
- Starkes doppelseitiges Klebeband oder Epoxid zum Befestigen.
- Multimeter (ca. 10 €) zum Prüfen der Akku-Polung.
- Optional: kleiner Schiebeschalter, dünne Kabel, Ersatzakku, **Ersatzboard** (ca. 12 €, falls beim Löten etwas schiefgeht).

## Wo es das Board gibt (Fundstellen der Recherche)

- Offizieller LILYGO-Shop (Versand per DHL/FedEx, laut Seite 7–10 Werktage)
- tinytronics.nl (Niederlande), Preis um 12 €
- Galaxus/Digitec (Schweiz), Lieferumfang mit JST-Kabeln
- AliExpress und eBay: günstig, aber oft lange Lieferzeit. Weihnachten ist knapp, deshalb vorher die Lieferschätzung lesen.

Vorsicht: Ein Angebot „LILYGO T-QT Pro … Nur Shell“ für wenige Euro ist **nur das Plastikgehäuse**, nicht das Board.

## Vor dem ersten Anstecken des Akkus (Pflicht)

1. **Polung prüfen.** Beim JST-PH-Stecker gibt es keinen verlässlichen Standard. Manche Akkus aus dem Internet haben + und − vertauscht. Mit dem Multimeter messen (rotes Kabel soll + sein) und mit der Beschriftung (+/−) am Board vergleichen. Ein falsch angeschlossener Akku kann das Board zerstören.
2. Nur Akkus **mit Schutzschaltung** verwenden.
3. Nicht löten, solange der Akku angeschlossen ist. Kabel nie blank nebeneinanderliegen lassen.
4. Aufgeblähte oder beschädigte Akkus sofort aussortieren.

## Abmessungen fürs Gehäuse

| | Mass |
|---|---|
| Board | 33 × 17,8 × 8 mm (Herstellerangabe, am echten Board nachmessen) |
| Akku 602030 | ca. 30 × 20 × 6 mm |
| Display | 0,85" Diagonale, quadratisch |

Gehäuse erst konstruieren, wenn die echten Teile da sind und mit der Schieblehre vermessen wurden.
