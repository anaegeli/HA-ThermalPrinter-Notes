# Thermal Printer Notes for Home Assistant

Eine HACS-Custom-Integration mit einer eigenen Lovelace-Karte für private Markdown-Notizen auf einem ESPHome-/Cashino-Thermodrucker (EP-261C oder EP-382C). Jeder angemeldete Home-Assistant-Benutzer sieht ausschliesslich den eigenen Entwurf, die eigene Vorschau und den eigenen Verlauf. Mehrere Drucker werden als getrennte Integrationseinträge verwaltet.

## Funktionen

- Druckerauswahl direkt in der Karte; pro ESPHome-Gerät ein Druckerprofil
- Ethernet oder WLAN über `network_type` oben in der Gerätekonfiguration
- Persönlicher Entwurf mit automatischem Speichern 500 ms nach der letzten Änderung
- Persönlicher Verlauf pro Benutzer **und pro Drucker**; Standardlimit 20, zentral einstellbar von 1 bis 200
- **Speichern** legt eine Notiz ohne Druck im Verlauf ab; beim Drucken wird der Verlaufseintrag zuerst angelegt
- Markdown-Werkzeugleiste für Überschriften, Fett, Unterstreichen, Inline-Breite, Listen, Checklisten, Links, Trennlinien und QR-Codes
- Modellabhängige Vorschau: EP-261C mit 384 Punkten und 32/42 Zeichen; EP-382C mit 576 Punkten und 48/64 Zeichen
- Drei globale Schriftgrössen: klein (Font B, 42 bzw. 64 Zeichen), normal und doppelte Grösse
- Doppelte Breite gezielt für markierte Wörter oder Zeilen mit `==breit==`; gemischter Umbruch nach echten Druckspalten
- Zuverlässige Breitenwechsel innerhalb einer Zeile über den im EP-261C-Handbuch dokumentierten Grössenbefehl `GS !`
- Deutsch/Englisch lokalisierte Dashboard-Karte mit zentral gepflegten Übersetzungstexten
- Kartenlayout im Dashboard-Editor als 1, 2 oder 3 Spalten wählbar; auf schmalen Bildschirmen automatisch gestapelt
- Ausrichtung und Schriftgrösse pro persönlichem Entwurf
- Exemplare, Vorschub, Vorwärts-/Rückwärtsdruck und Schneiden zentral pro Drucker
- Automatische Erkennung von Status, Bereit und Warteschlange am gewählten ESPHome-Gerät
- Bis zu 16.384 UTF-8-Bytes pro Druckauftrag
- Bestehende Daten aus Version 0.1.x bleiben beim Update erhalten

## Voraussetzungen

- Home Assistant 2026.7 oder neuer
- ESPHome 2026.7 oder neuer für neue Firmware-Builds
- HACS
- Ein ESPHome-Gerät mit der Remote-Konfiguration aus `esphome/thermal-printer.yaml`
- Internetzugriff des ESPHome Device Builders beim Einlesen und Kompilieren, damit Packages und C++-Komponente aus GitHub geladen werden können

## Installation über HACS

1. HACS öffnen.
2. Unter **Integrationen** das Drei-Punkte-Menü öffnen und **Benutzerdefinierte Repositories** wählen.
3. `https://github.com/anaegeli/HA-ThermalPrinter-Notes` als Typ **Integration** hinzufügen.
4. **Thermal Printer Notes** installieren beziehungsweise aktualisieren.
5. Home Assistant neu starten.
6. Unter **Einstellungen → Geräte & Dienste → Integration hinzufügen** nach **Thermal Printer Notes** suchen.
7. Das ESPHome-Druckergerät und das passende Druckermodell auswählen, dann die zentralen Vorgaben bestätigen.

Für jeden weiteren physischen Drucker wird Thermal Printer Notes ein weiteres Mal hinzugefügt. Die Integration erzeugt je Eintrag ein eigenes auswählbares Druckergerät für den Dashboard-Editor. Die ESPHome-Druckaktion wird anhand des ausgewählten Geräts vorgeschlagen; bei abweichender Benennung kann sie manuell angepasst werden.

## Dashboard-Karte

Bei Dashboards im Speichermodus registriert die Integration die Karte automatisch. Im visuellen Dashboard-Editor muss nur Folgendes gewählt werden:

1. **Startdrucker (optional)** – einer der mit Thermal Printer Notes eingerichteten Drucker
2. **Dashboard-Layout** – 1, 2 oder 3 Spalten

Die Karte übernimmt Druckername, Status-Entitäten, Verlaufslimit und Druckvorgaben automatisch. Die entsprechende YAML-Konfiguration ist bewusst kurz:

```yaml
type: custom:thermal-printer-notes-card
device_id: 0123456789abcdef0123456789abcdef
columns: 2
```

Über **Drucker** oben in der Karte lässt sich jederzeit ein anderes eingerichtetes Druckerprofil auswählen. Ein ESP mit einem Drucker entspricht einem Profil. Jeder ESP benötigt einen eigenen `device_name` und einen eigenen Thermal-Printer-Notes-Integrationseintrag in Home Assistant. Beide erscheinen dann im Dropdown.

Beim Wechsel speichert die Karte zuerst den aktuellen Entwurf am bisherigen Drucker und lädt danach Entwurf, Verlauf, Status und Vorgaben des gewählten Druckers. Schlägt das Speichern fehl, bleibt die Auswahl beim bisherigen Drucker. Während laufender Aktionen ist die Auswahl gesperrt. Verspätete Antworten aus dem vorherigen Drucker- oder Benutzerkontext werden verworfen.

`device_id` bleibt die Vorauswahl beim Öffnen der Karte. Bestehende Karten funktionieren unverändert; ohne `device_id` wird der erste verfügbare Drucker ausgewählt. Die Auswahl wird nur für die geöffnete Karte gehalten und ändert nicht deren Dashboard-Konfiguration. Ist ein ausdrücklich gewählter Drucker nicht verfügbar, wird kein anderer automatisch als Druckziel verwendet.

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

Die Vorschau simuliert die vom mitgelieferten ESPHome-Treiber erzeugten Zeilen und nicht das HTML-Aussehen eines Browsers. Sie berücksichtigt den kleinen Benutzer-/Zeitkopf, die effektive Druckbreite von 384 beziehungsweise 576 Punkten, Font A/B, Überschriften, globale Schriftgrösse, Ausrichtung, Listen, Inline-Stile sowie gemischte normale und doppelt breite Zeichen beim Zeilenumbruch.

Die Form einzelner Buchstaben kann leicht vom Druck abweichen, da der Drucker seine interne Bitmap-Schrift verwendet und der Browser eine Monospace-Schrift zeichnet. Zeilenlänge, Position und Grössenverhältnis sind jedoch am Druckerraster ausgerichtet. QR-Codes erscheinen als grössenrichtiger Platzhalter.

## Markdown-Werkzeuge

Text im Eingabefeld markieren und einen Knopf drücken. Die Karte setzt die zum Treiber passende Syntax ein:

- `#`, `##`, `###` für Überschriften
- `**fett**`
- `*unterstrichen*` – der EP-261C-Treiber verwendet einen Stern als Unterstreichung, weil ESC/POS keine portable Kursivdarstellung bietet
- `==breit==` für einzelne Wörter, Bereiche oder vollständig markierte Zeilen; mehrere markierte Zeilen werden einzeln formatiert
- `- `, `1. ` und `- [ ] ` für Listen
- `[Text](https://example.org)` für Links
- `---` für eine Trennlinie
- `QR: https://example.org` für einen QR-Code

## Unterstützte Druckermodelle

| Modell | Papierbreite | Druckpunkte | Normal / klein | ESPHome-Template |
|---|---|---|---|---|
| Cashino EP-261C | 58 mm | 384 | 32 / 42 Zeichen | [thermal-printer.yaml](esphome/thermal-printer.yaml) |
| Cashino EP-382C | 80 mm | 576 | 48 / 64 Zeichen | [thermal-printer.yaml](esphome/thermal-printer.yaml), `printer_model: ep-382c` |

Die Auswahl **Druckermodell** in Home Assistant muss zum ESPHome-Package des Geräts passen. Sie lässt sich später über die Integrationsoptionen ändern. Bestehende Einträge ohne Modellangabe verwenden weiterhin EP-261C. Entwürfe und Verläufe bleiben erhalten.

Für den neuen 80-mm-Drucker gibt es eine [deutsche EP-382C-Anleitung](docs/ep-382c.md) mit Stromversorgung, Pinbelegung, Selbsttest und vollständiger Konfiguration. Beide Modelle verwenden dieselbe Basisdatei; `printer_model` wählt das passende Package. Beide Modelle unterstützen Ethernet und WLAN. Die Unterstützung basiert auf dem Handbuch und Softwareprüfungen; der physische EP-382C-Drucktest steht noch aus.

## ESPHome-Installation

Ab v0.8.0 gibt es eine gemeinsame [thermal-printer.yaml](esphome/thermal-printer.yaml). Alle Geräteeinstellungen stehen in einem gegliederten `substitutions`-Block ganz am Anfang. Der Dashboard-Import übernimmt die vollständige Datei. Für den Wechsel des Druckermodells müssen keine Imports bearbeitet werden.

| Bereich | Einstellungen |
|---|---|
| Gerät | Name, Anzeigename, `printer_model: ep-261c` oder `ep-382c` |
| Netzwerk | `network_type: ethernet` oder `wifi` |
| Adressen | `ip_mode: dhcp` oder `static`, IP, Gateway, Netzmaske und DNS |
| WLAN-Fallback | Hotspot aktivieren, SSID, Passwort; Captive Portal wird mitgeladen |
| Zugang | API-Verschlüsselung und OTA-Passwort als lokale Secrets |
| Oberfläche | Webserver aktivieren, Port, Version, lokale Ressourcen, interne Entitäten |
| Hardware | ESP32-Board, Variante, Framework, Ethernet-Hardware und UART-Pins |
| Software | Ein gemeinsamer `thermal_printer_ref` für Packages und Treiber |

Die [Einrichtungsanleitung](docs/configuration.md) erklärt jeden Bereich, DHCP/feste IP und die Umstellung bestehender Dateien. WLAN verwendet weiterhin `wifi_ssid` und `wifi_password` aus `secrets.yaml`; diese werden nur bei ausgewähltem WLAN geladen. Ethernet braucht keine WLAN-Secrets. Alle übrigen Geräteeinstellungen lassen sich oben in der Basisdatei ändern.

Das allgemeine Template verwendet Ethernet, DHCP und GPIO4/5. Tatsächliche Verdrahtung und vorhandene Einstellungen übernehmen: Bei einer Installation mit GPIO14/13 müssen diese Pins auch in der neuen Datei stehen. Der Board-Standard ist Olimex ESP32-POE-ISO WROOM; andere Boards benötigen passende Board- und Pin-Einstellungen.

### Aufbau der Packages

- `olimex-esp32-poe-iso.yaml`: ESP32, API, OTA, Logger sowie Auswahl von Netzwerk, Adressen und Weboberfläche.
- `network-ethernet.yaml` / `network-wifi.yaml`: nur die gewählte Netzwerkschnittstelle; WLAN enthält bei Bedarf Hotspot und Captive Portal.
- `cashino-ep-261c.yaml` / `cashino-ep-382c.yaml`: Auswahl des Druckermodells.
- `cashino-common.yaml`: gemeinsamer UART, Druckaktionen, Tasten und Status-Entitäten.
- `defaults.yaml`: kompatible Ersatzwerte für ältere Minimal-Konfigurationen. Die Angaben in der lokalen Basisdatei haben Vorrang.

Die bisherige `thermal-printer-ep-382c.yaml` ist nur noch ein kleiner Kompatibilitätsverweis auf die gemeinsame Basis. Neue Installationen verwenden `thermal-printer.yaml`. Bestehende Package-URLs bleiben gültig; die lokale Header-Datei `thermal_printer.h` wird nicht mehr benötigt.

### Update und Prüfung

Integrationseinträge nicht löschen: Sie verknüpfen die privaten Entwürfe und Verläufe. Das HACS-Update ändert keine laufende ESP-Firmware. Die bestehende Druckaktion und ihre Parameter bleiben gleich. Firmware wird separat kompiliert und bei vorhandenem Gerät übertragen.

`node tests/test_printers.js`, `node tests/test_models.js` und `python tests/test_upgrade.py` prüfen Vorschau, Druckerauswahl und Datenkompatibilität. `python tests/test_driver.py` testet den echten Treiber mit einer simulierten UART-Schnittstelle (g++ erforderlich). `python tests/test_esphome.py` validiert alle acht Modell-/Netzwerk-/Adresskombinationen, Hotspot/Webserver, ältere Konfigurationen und ungültige Einstellungen. Die CI prüft ESPHome 2026.7.3 und 2026.8.2 und kompiliert alle acht Varianten mit 2026.8.2. Dies ersetzt keinen Test an realer Hardware.

## Textgrenze

Seit Version 0.2.0 beträgt die zulässige Quelle **16.384 UTF-8-Bytes** statt 4.096. Das ist eine bewusst konservative Obergrenze für den ESP32-POE-ISO ohne PSRAM. Der Treiber rendert einen Auftrag nur einmal; mehrere Exemplare teilen denselben Druckpuffer. Zusätzlich begrenzen ein 96-KiB-Limit für den gerenderten Auftrag und ein 128-KiB-Limit für die Warteschlange den Heap-Verbrauch.

Die HACS-Installation und das ESPHome-Package sind getrennte Aktualisierungswege. Nach einer C++-Änderung muss die ESP32-Firmware weiterhin neu kompiliert und übertragen werden; der passende Quellcode wird dabei jedoch automatisch aus GitHub geladen.

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

`alignment` kann `left`, `center` oder `right` sein. Für neue Entwürfe kann `size` `small`, `normal` oder `double_size` sein. `small` verwendet den nativen Font B mit 9 × 17 Druckpunkten und 42 Zeichen (EP-261C) beziehungsweise 64 Zeichen (EP-382C) pro Zeile. Der frühere Wert `double_width` bleibt ausschliesslich für bestehende Entwürfe und Verlaufseinträge kompatibel; neue Inhalte verwenden stattdessen `==breit==` gezielt im Markdown.

## Lizenz und Danksagung

Dieses Projekt steht unter der MIT-Lizenz. Die Bedienideen für Mehrzeileneingabe und automatisches Speichern wurden von `faeibson/lovelace-multiline-text-input-card` inspiriert. Strukturideen für eine Home-Assistant-/HACS-Drucker-Integration wurden anhand von `cognitivegears/ha-escpos-thermal-printer` geprüft. Details stehen in [NOTICE](NOTICE).
