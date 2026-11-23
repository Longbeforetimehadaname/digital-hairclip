# Digital Hairclip

Ein selbstgebauter Haarclip mit kleinem Display, den man per Handy mit Nachrichten, Zeichnungen, Animationen und Fotos füttert. Geschenkprojekt für Weihnachten 2026.

- **Hardware:** ESP32-DevKit (Bluetooth LE) + Farbdisplay 1,9" 170×320 (ST7789) + Lademodul TP4056 + LiPo-Akku 1150 mAh + 3D-gedrucktes Gehäuse
- **Look:** Das Display zeigt ein 16×8-Raster mit leuchtenden „LED-Punkten“. Fotos können den ganzen Bildschirm nutzen.
- **Steuerung:** Webseite mit Web Bluetooth (Chrome auf Android, App „Bluefy“ auf dem iPhone). Keine App-Installation.

Stand: Webseite mit Vorschau ist fertig. Firmware und Gehäuse folgen, sobald die Teile da sind. Den ganzen Plan findest du in [PLAN.md](PLAN.md).

## Webseite lokal ausprobieren

```bash
npm install        # einmalig, nur für die Tests
npm run serve      # öffnet einen lokalen Server auf http://localhost:8080
```

Dann `http://localhost:8080` im Browser öffnen. Die Vorschau (der Clip oben) funktioniert ohne Hardware. Web Bluetooth läuft nur über `https://` oder `localhost`, nicht über `file://`.

## Tests

```bash
npm test
```

Prüft das Bluetooth-Protokoll, die Animationen und die Verdrahtung der Oberfläche (ohne echten Browser, siehe `test/`).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `web/` | Steuerungsseite (HTML, CSS, JavaScript ohne Build-Schritt) |
| `docs/PROTOCOL.md` | Bluetooth-Protokoll zwischen Webseite und Clip |
| `docs/ANLEITUNG_CLAUDE_CODE.md` | Phasenplan und Arbeitsregeln für Claude Code |
| `firmware/` | Firmware für den ESP32-S3 (noch zu schreiben) |
| `hardware/` | Teileliste, Prüfpunkte, später Gehäuse (OpenSCAD) |
| `test/` | Automatische Tests |

## Veröffentlichen mit GitHub Pages

Der Workflow `.github/workflows/pages.yml` testet und veröffentlicht `web/`, sobald auf `main` gepusht wird. In den Repo-Einstellungen unter **Pages → Source** muss **GitHub Actions** gewählt sein.

Achtung Geschenk: Bei einem kostenlosen GitHub-Konto braucht Pages (soweit ich weiss, bitte prüfen) ein öffentliches Repo. Wer das Geschenk nicht verraten will, testet lokal und schaltet Pages erst kurz vor der Übergabe ein.

## Bedienung auf dem Handy

1. Android: Seite in **Chrome** öffnen. iPhone: App **Bluefy** installieren und dort öffnen (Safari kann kein Web Bluetooth).
2. „Mit Clip verbinden“ tippen und den Clip auswählen (Name beginnt mit `Hairclip`).
3. Etwas auswählen oder zeichnen und „An den Clip senden“ tippen.
