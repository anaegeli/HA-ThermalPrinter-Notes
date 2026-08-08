# Thermal Printer Notes for Home Assistant

Eine HACS-Custom-Integration mit einer eigenen Lovelace-Karte für private Markdown-Notizen auf einem ESPHome-/Cashino-EP-261C-Thermodrucker. Jeder angemeldete Home-Assistant-Benutzer sieht ausschliesslich den eigenen Entwurf, die eigene Vorschau und den eigenen Verlauf. Mehrere Drucker werden als getrennte Integrationseinträge verwaltet.

## Funktionen

- Persönlicher Entwurf mit automatischem Speichern 500 ms nach der letzten Änderung
- Persönlicher Verlauf pro Benutzer **und pro Drucker**; Standardlimit 20, zentral einstellbar von 1 bis 200
- **Speichern** legt eine Notiz ohne Druck im Verlauf ab; beim Drucken wird der Verlaufseintrag zuerst angelegt
- Markdown-Werkzeugleiste für Überschriften, Fett, Unterstreichen, Listen, Checklisten, Links, Trennlinien und QR-Codes
- EP-261C-Vorschau mit 384 Druckpunkten, 32 Zeichen in Font A, 42 Zeichen im kleinen Kopf sowie den Umbruch- und Zeilenabstandsregeln des Treibers
- Kartenlayout im Dashboard-Editor als 1, 2 oder 3 Spalten wählbar; auf schmalen Bildschirmen automatisch gestapelt
- Ausrichtung und Schriftgrösse pro persönlichem Entwurf
- Exemplare, Vorschub, Vorwärts-/Rückwärtsdruck und Schneiden zentral pro Drucker
- Automatische Erkennung von Status, Bereit und Warteschlange am gewählten ESPHome-Gerät
- Bis zu 16.384 UTF-8-Bytes pro Druckauftrag
- Bestehende Daten aus Version 0.1.x bleiben beim Update erhalten

## Voraussetzungen

- Home Assistant 2026.7 oder neuer
- HACS
- Ein ESPHome-Gerät mit dem Dienst `*_print_markdown`, wie in `esphome/thermal-printer.yaml`
- Für die erhöhte Textgrenze der aktualisierte Treiber `esphome/thermal_printer.h`

## Installation über HACS

1. HACS öffnen.
2. Unter **Integrationen** das Drei-Punkte-Menü öffnen und **Benutzerdefinierte Repositories** wählen.
3. `https://github.com/anaegeli/HA-ThermalPrinter-Notes` als Typ **Integration** hinzufügen.
4. **Thermal Printer Notes** installieren beziehungsweise aktualisieren.
5. Home Assistant neu starten.
6. Unter **Einstellungen → Geräte & Dienste → Integration hinzufügen** nach **Thermal Printer Notes** suchen.
7. Das ESPHome-Druckergerät auswählen und die zentralen Vorgaben bestätigen.

Für jeden weiteren physischen Drucker wird Thermal Printer Notes ein weiteres Mal hinzugefügt. Die Integration erzeugt je Eintrag ein eigenes auswählbares Druckergerät für den Dashboard-Editor. Die ESPHome-Druckaktion wird anhand des ausgewählten Geräts vorgeschlagen; bei abweichender Benennung kann sie manuell angepasst werden.

## Dashboard-Karte

Bei Dashboards im Speichermodus registriert die Integration die Karte automatisch. Im visuellen Dashboard-Editor muss nur Folgendes gewählt werden:

1. **Drucker** – einer der mit Thermal Printer Notes eingerichteten Drucker
2. **Dashboard-Layout** – 1, 2 oder 3 Spalten

Die Karte übernimmt Druckername, Status-Entitäten, Verlaufslimit und Druckvorgaben automatisch. Die entsprechende YAML-Konfiguration ist bewusst kurz:

```yaml
type: custom:thermal-printer-notes-card
device_id: 0123456789abcdef0123456789abcdef
columns: 2
```

Bei einem Dashboard im YAML-Modus muss zusätzlich diese Ressource eingetragen werden:

```yaml
lovelace:
  resources:
    - url: /thermal_printer_notes/thermal-printer-notes-card.js
      type: module
```

## Layouts

- **1 Spalte:** Eingabe, Vorschau und Verlauf untereinander
- **2 Spalten:** Eingabe links; Vorschau und Verlauf rechts
- **3 Spalten:** Eingabe, Vorschau und Verlauf nebeneinander

Status/Bereit/Warteschlange stehen kompakt über dem Arbeitsbereich. Die zentralen Druckvorgaben stehen über die ganze Breite darunter.

## Druckvorschau

Die Vorschau simuliert die vom mitgelieferten ESPHome-Treiber erzeugten Zeilen und nicht das HTML-Aussehen eines Browsers. Sie berücksichtigt den kleinen Benutzer-/Zeitkopf, die effektive Druckbreite von 384 Punkten, Font A/B, Überschriften, globale Schriftgrösse, Ausrichtung, Listen, Inline-Stile und Zeilenumbrüche.

Die Form einzelner Buchstaben kann leicht vom Druck abweichen, da der EP-261C seine interne Bitmap-Schrift verwendet und der Browser eine Monospace-Schrift zeichnet. Zeilenlänge, Position und Grössenverhältnis sind jedoch am Druckerraster ausgerichtet. QR-Codes erscheinen als grössenrichtiger Platzhalter.

## Markdown-Werkzeuge

Text im Eingabefeld markieren und einen Knopf drücken. Die Karte setzt die zum Treiber passende Syntax ein:

- `#`, `##`, `###` für Überschriften
- `**fett**`
- `*unterstrichen*` – der EP-261C-Treiber verwendet einen Stern als Unterstreichung, weil ESC/POS keine portable Kursivdarstellung bietet
- `- `, `1. ` und `- [ ] ` für Listen
- `[Text](https://example.org)` für Links
- `---` für eine Trennlinie
- `QR: https://example.org` für einen QR-Code

## Textgrenze und ESPHome-Dateien

Version 0.2.0 erhöht die zulässige Quelle von 4.096 auf **16.384 UTF-8-Bytes**. Das ist eine bewusst konservative Obergrenze für den ESP32-POE-ISO ohne PSRAM. Der Treiber rendert einen Auftrag nur einmal; mehrere Exemplare teilen denselben Druckpuffer. Zusätzlich begrenzen ein 96-KiB-Limit für den gerenderten Auftrag und ein 128-KiB-Limit für die Warteschlange den Heap-Verbrauch.

Die Referenzdateien liegen unter `esphome/`. `thermal_printer.h` muss zur ESPHome-Konfiguration kopiert und die Firmware anschliessend vom Benutzer kompiliert/übertragen werden. Die HACS-Installation aktualisiert ESPHome-Dateien nicht automatisch.

## Datenschutzmodell

Entwürfe und Verläufe werden in Home Assistants internem `.storage`-Bereich gespeichert und nicht als Entitäten veröffentlicht. Alle Kartenaufrufe laufen über die authentifizierte WebSocket-Verbindung. Das Backend verwendet ausschliesslich die Benutzer-ID der Sitzung; die Karte kann keine fremde Benutzer-ID übermitteln.

Bei mehreren Druckern erhält jeder Integrationseintrag einen eigenen privaten Speicher. Auch ein Benutzer sieht deshalb an Drucker B nicht den eigenen Entwurf oder Verlauf von Drucker A. Personen mit direktem Zugriff auf das Dateisystem des Home-Assistant-Hosts oder auf vollständige Backups können die Rohdaten administrativ einsehen.

## Druckparameter

Die Integration ruft den konfigurierten ESPHome-Dienst mit diesen Feldern auf:

```yaml
markdown_content: "# Optionaler Titel\nMarkdown-Inhalt"
print_user: "Name des angemeldeten HA-Benutzers"
print_timestamp: "31.12.2026 23:59"
alignment: left
size: normal
copies: 1
feed_lines: 4
reverse_print: false
cut: true
```

`alignment` kann `left`, `center` oder `right` sein. `size` kann `normal`, `double_width` oder `double_size` sein.

## Lizenz und Danksagung

Dieses Projekt steht unter der MIT-Lizenz. Die Bedienideen für Mehrzeileneingabe und automatisches Speichern wurden von `faeibson/lovelace-multiline-text-input-card` inspiriert. Strukturideen für eine Home-Assistant-/HACS-Drucker-Integration wurden anhand von `cognitivegears/ha-escpos-thermal-printer` geprüft. Details stehen in [NOTICE](NOTICE).
