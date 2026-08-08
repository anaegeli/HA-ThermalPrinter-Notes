# Thermal Printer Notes for Home Assistant

Eine HACS-Custom-Integration mit einer Lovelace-Karte für private Markdown-Notizen und einen persönlichen Druckverlauf. Jeder angemeldete Home-Assistant-Benutzer sieht ausschliesslich den eigenen Entwurf, die eigene Vorschau und den eigenen Verlauf.

Die Integration ist auf den ESPHome-Druckdienst aus dem Projekt `thermal-printer.yaml` abgestimmt. Bestehende Helfer wie `var.thermal_printer_markdown` und bestehende Dashboards werden weder verändert noch gelöscht.

## Funktionen

- Benutzerabhängige Eingabe und Live-Markdown-Vorschau
- Keine Benutzer-ID aus dem Browser: Die Zuordnung erfolgt über die authentifizierte Home-Assistant-Sitzung
- Persönlicher Entwurf mit automatischem Speichern
- Änderungen werden standardmässig 500 ms nach der letzten Eingabe zwischengespeichert
- Persönlicher Verlauf; Standardlimit 20, zentral einstellbar von 1 bis 200
- Der Knopf **Speichern** legt die aktuelle Notiz im persönlichen Verlauf ab, ohne sie zu drucken
- Der Verlaufseintrag wird **vor** dem Druckaufruf gespeichert
- Fehlgeschlagene Druckversuche bleiben mit Fehlerstatus erhalten
- Ausrichtung und Schriftgrösse werden pro Benutzer gespeichert
- Exemplare, Vorschub, Vorwärts-/Rückwärtsdruck und Schneiden werden zentral in der Integration festgelegt
- Laden, erneut drucken und löschen einzelner eigener Verlaufseinträge
- Optionale Druckerstatus-Anzeigen aus bestehenden Home-Assistant-Entitäten
- Zweispaltiges Dashboard-Panel mit Eingabe links sowie Vorschau und Verlauf rechts

## Voraussetzungen

- Home Assistant 2026.7 oder neuer
- HACS
- Der ESPHome-API-Dienst `esphome.thermal_printer_print_markdown` aus diesem Thermal-Printer-Projekt

## Installation über HACS

1. HACS öffnen.
2. Unter **Integrationen** das Drei-Punkte-Menü öffnen und **Benutzerdefinierte Repositories** wählen.
3. `https://github.com/anaegeli/HA-ThermalPrinter-Notes` als Typ **Integration** hinzufügen.
4. **Thermal Printer Notes** installieren.
5. Home Assistant neu starten.
6. Unter **Einstellungen → Geräte & Dienste → Integration hinzufügen** nach **Thermal Printer Notes** suchen.

Bei der Einrichtung werden die zentralen Werte festgelegt:

- Druckaktion, standardmässig `esphome.thermal_printer_print_markdown`
- Verlaufslimit, standardmässig 20
- Anzahl Exemplare
- Vorschubzeilen
- Vorwärts- oder Rückwärtsdruck
- Schneiden ein/aus

Diese Werte lassen sich später über **Konfigurieren** ändern.

## Dashboard-Karte

Bei Dashboards im Speichermodus registriert die Integration die Karte automatisch. Anschliessend eine manuelle Karte mit folgendem Inhalt anlegen:

```yaml
type: custom:thermal-printer-notes-card
title: Thermodrucker
min_lines: 12
autosave_delay_ms: 500
status_entity: sensor.thermal_printer_status
ready_entity: binary_sensor.thermal_printer_ready
queue_entity: sensor.thermal_printer_queue
```

Die drei Status-Entitäten sind optional. Nicht benötigte oder bei dir anders benannte Zeilen können entfernt beziehungsweise angepasst werden.

`autosave_delay_ms` kann in der Kartenkonfiguration zwischen 150 und 5000 ms eingestellt werden. Ohne Angabe verwendet die Karte 500 ms. Die ältere Option `autosave_delay` aus Version 0.1.0 wird nicht mehr benötigt.

Bei einem Dashboard im YAML-Modus muss zusätzlich diese Ressource eingetragen werden:

```yaml
lovelace:
  resources:
    - url: /thermal_printer_notes/thermal-printer-notes-card.js
      type: module
```

## Datenschutzmodell

Entwürfe und Verläufe werden in Home Assistants internem `.storage`-Bereich gespeichert und nicht als Entitäten veröffentlicht. Alle Kartenaufrufe laufen über eine authentifizierte WebSocket-Verbindung. Das Backend verwendet ausschliesslich die Benutzer-ID der Sitzung; die Karte kann keine fremde Benutzer-ID übermitteln.

Damit können auch Administratoren über diese Integration nur ihre eigenen Notizen und Verlaufseinträge abrufen. Wie bei allen Home-Assistant-Daten gilt: Personen mit direktem Zugriff auf das Dateisystem des Home-Assistant-Hosts beziehungsweise auf vollständige Backups können die Rohdaten administrativ einsehen.

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

Dieses Projekt steht unter der MIT-Lizenz. Die Bedienideen für Mehrzeileneingabe, automatisches Speichern, Einfügen und Leeren wurden von `faeibson/lovelace-multiline-text-input-card` inspiriert. Strukturideen für eine Home-Assistant-/HACS-Drucker-Integration wurden anhand von `cognitivegears/ha-escpos-thermal-printer` geprüft. Details stehen in [NOTICE](NOTICE).
