# Thermal Printer Notes for Home Assistant

Eine HACS-Custom-Integration mit einer eigenen Lovelace-Karte für private Markdown-Notizen auf einem ESPHome-/Cashino-EP-261C-Thermodrucker. Jeder angemeldete Home-Assistant-Benutzer sieht ausschliesslich den eigenen Entwurf, die eigene Vorschau und den eigenen Verlauf. Mehrere Drucker werden als getrennte Integrationseinträge verwaltet.

## Funktionen

- Druckerauswahl direkt in der Karte; pro ESPHome-Gerät ein Druckerprofil
- Ethernet oder WLAN über `network_type` oben in der Gerätekonfiguration
- Persönlicher Entwurf mit automatischem Speichern 500 ms nach der letzten Änderung
- Persönlicher Verlauf pro Benutzer **und pro Drucker**; Standardlimit 20, zentral einstellbar von 1 bis 200
- **Speichern** legt eine Notiz ohne Druck im Verlauf ab; beim Drucken wird der Verlaufseintrag zuerst angelegt
- Markdown-Werkzeugleiste für Überschriften, Fett, Unterstreichen, Inline-Breite, Listen, Checklisten, Links, Trennlinien und QR-Codes
- EP-261C-Vorschau mit 384 Druckpunkten, 32 Zeichen in Font A, 42 Zeichen im kleinen Kopf sowie den Umbruch- und Zeilenabstandsregeln des Treibers
- Drei globale Schriftgrössen: klein (Font B, 42 Zeichen), normal und doppelte Grösse
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
7. Das ESPHome-Druckergerät auswählen und die zentralen Vorgaben bestätigen.

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

Die Vorschau simuliert die vom mitgelieferten ESPHome-Treiber erzeugten Zeilen und nicht das HTML-Aussehen eines Browsers. Sie berücksichtigt den kleinen Benutzer-/Zeitkopf, die effektive Druckbreite von 384 Punkten, Font A/B, Überschriften, globale Schriftgrösse, Ausrichtung, Listen, Inline-Stile sowie gemischte normale und doppelt breite Zeichen beim Zeilenumbruch.

Die Form einzelner Buchstaben kann leicht vom Druck abweichen, da der EP-261C seine interne Bitmap-Schrift verwendet und der Browser eine Monospace-Schrift zeichnet. Zeilenlänge, Position und Grössenverhältnis sind jedoch am Druckerraster ausgerichtet. QR-Codes erscheinen als grössenrichtiger Platzhalter.

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

## ESPHome-Installation

Seit Version 0.6.0 sind Geräteeinstellungen, gemeinsame Vorgaben und Netzwerkkonfiguration klar getrennt:

```text
esphome/
├── thermal-printer.yaml
├── packages/
│   ├── olimex-esp32-poe-iso.yaml
│   ├── defaults.yaml
│   ├── network-ethernet.yaml
│   ├── network-wifi.yaml
│   └── cashino-ep-261c.yaml
└── components/
    └── thermal_printer/
        ├── __init__.py
        └── thermal_printer.h
```

Nur `esphome/thermal-printer.yaml` wird als lokale Gerätekonfiguration benötigt. Es lädt die beiden Packages über die ESPHome-Kurzform direkt aus `main`. Das Drucker-Package lädt den C++-Treiber als Git-basiertes `external_component`. Das manuelle Kopieren von `thermal_printer.h` entfällt. Für reproduzierbare Builds müssen Packages und Treiber auf denselben Release-Tag gesetzt werden; `main` ist ein veränderlicher Entwicklungskanal.

Das lokale Template enthält nur Netzwerkart, Gerätename, API-/OTA-Secrets und die konkrete UART-Verdrahtung. Alle gemeinsamen Standardwerte stehen einmal in `packages/defaults.yaml`. Die beiden bestehenden Package-Einstiegspunkte laden diese Vorgaben, damit auch ältere Minimal-Konfigurationen erhalten bleiben. Board-, Netzwerk- und Drucker-Packages verwenden die Substitutionen, ohne ihre Werte erneut zu definieren. Bewusste lokale Überschreibungen haben Vorrang.

Die Vorgaben entsprechen dem Olimex ESP32-POE-ISO WROOM und dem EP-261C an GPIO4/GPIO5 mit 9600 Baud. Eine bestehende abweichende Verdrahtung muss in der lokalen Datei erhalten bleiben. Andere ESP32-Boards benötigen passende lokale `esp32_board`-/`esp32_variant`- und Pin-Überschreibungen; `network_type` allein ändert keine Hardwarebelegung.

Minimaler Inhalt nach dem ESPHome-Dashboard-Import:

```yaml
substitutions:
  network_type: ethernet  # ethernet oder wifi
  device_name: thermal-printer
  friendly_name: Thermal Printer
  api_encryption_key: !secret esphome_api_encryption_key
  ota_password: !secret esphome_ota

packages:
  olimex_esp32_poe_iso: github://anaegeli/HA-ThermalPrinter-Notes/esphome/packages/olimex-esp32-poe-iso.yaml@main
  cashino_ep_261c: github://anaegeli/HA-ThermalPrinter-Notes/esphome/packages/cashino-ep-261c.yaml@main
```

`main` ist bewusst der Standardkanal. ESPHome aktualisiert die externe C++-Komponente gemäss `thermal_printer_refresh` standardmässig stündlich; Remote-Packages werden von ESPHome ebenfalls zwischengespeichert und regelmässig aktualisiert. Wer eine unveränderliche Installation benötigt, kann die beiden `@main`-Angaben und `thermal_printer_ref` auf denselben Release-Tag setzen.

### WLAN oder Ethernet

`network_type: ethernet` lädt ausschliesslich das Ethernet-Package. `network_type: wifi` lädt ausschliesslich das WLAN-Package. Dies verwendet ESPHomes [dynamische Package-Dateinamen](https://esphome.io/components/packages/#including-packages-with-dynamic-filenames). Die Wahl erfolgt beim Erstellen der Firmware, nicht während des Betriebs.

Bei WLAN werden zusätzlich diese Einträge im lokalen `secrets.yaml` benötigt:

```yaml
wifi_ssid: "Mein WLAN"
wifi_password: "Mein WLAN-Passwort"
```

Die Secrets werden erst im gewählten WLAN-Package gelesen; Ethernet benötigt keine WLAN-Secrets. API-Verschlüsselung, OTA-Zugang und Druckaktionen bleiben in beiden Varianten gleich. Ohne manuelle IP-Konfiguration wird DHCP verwendet.

Vorhandene Ethernet-Substitutionen `ethernet_ip`, `ethernet_gw` und `ethernet_mask` werden weiterhin ausgewertet. Wird `ethernet_ip` gesetzt, müssen auch Gateway und Netzmaske angegeben werden. Alternativ lässt sich `ethernet.manual_ip` beziehungsweise `wifi.manual_ip` direkt in der lokalen Gerätekonfiguration setzen.

### Update von einer älteren Version

1. Die Integration über HACS aktualisieren und Home Assistant neu starten. Die Integrationseinträge nicht löschen oder neu anlegen: ihre IDs verknüpfen den bestehenden privaten Speicher.
2. Die Dashboard-Seite neu laden. Bestehende `device_id`-Karten erhalten das Dropdown automatisch; Entwürfe und Verläufe bleiben unter den bestehenden Speicherkennungen erhalten.
3. Die neue Karte funktioniert mit der bisherigen Firmware: Die Druckaction und ihre Parameter bleiben unverändert. Für die Druckerauswahl ist kein ESP-Firmware-Update nötig.
4. Ein Firmware-Update erst bei Bedarf durchführen, etwa zum Wechsel auf WLAN. Vorher die lokale YAML-Datei und Secrets sichern, eigene Pins und feste IP-Adressen übernehmen, die Konfiguration validieren und erst danach übertragen. Ohne `network_type` bleibt Ethernet die Vorgabe.

HACS-Update und Firmware-Update sind getrennte Schritte. Die laufende ESP-Firmware wird durch das HACS-Update nicht verändert. Home Assistant und gegebenenfalls der ESP benötigen beim Update einen Neustart; eine vollständig unterbrechungsfreie Aktualisierung wird nicht zugesichert. Bei einer Rückkehr zu v0.5.0 bleiben die Speicherformate kompatibel. Die neuen WLAN-Packages sind erst ab v0.6.0 vorhanden.

### Prüfungen

`node tests/test_printers.js` prüft Vorschau, Druckerauswahl, getrennte Entwürfe und verspätete Antworten. `python tests/test_esphome.py` validiert beide Netzwerkvarianten mit Dummy-Secrets und erzeugt deren C++-Quellen, einschliesslich älterer Ethernet-Konfigurationen und fester IP-Adressen. Die CI prüft ESPHome 2026.7.3 und 2026.8.2. Diese Prüfungen ersetzen keinen Drucktest an realer Hardware.

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

`alignment` kann `left`, `center` oder `right` sein. Für neue Entwürfe kann `size` `small`, `normal` oder `double_size` sein. `small` verwendet den nativen EP-261C-Font B mit 9 × 17 Druckpunkten und 42 Zeichen pro Zeile. Der frühere Wert `double_width` bleibt ausschliesslich für bestehende Entwürfe und Verlaufseinträge kompatibel; neue Inhalte verwenden stattdessen `==breit==` gezielt im Markdown.

## Lizenz und Danksagung

Dieses Projekt steht unter der MIT-Lizenz. Die Bedienideen für Mehrzeileneingabe und automatisches Speichern wurden von `faeibson/lovelace-multiline-text-input-card` inspiriert. Strukturideen für eine Home-Assistant-/HACS-Drucker-Integration wurden anhand von `cognitivegears/ha-escpos-thermal-printer` geprüft. Details stehen in [NOTICE](NOTICE).
