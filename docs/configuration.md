# Eine Basisdatei für alle Drucker

Die Datei [thermal-printer.yaml](../esphome/thermal-printer.yaml) ist ab v0.8.0 der gemeinsame Einstieg. Nur die Einstellungen im oberen `substitutions`-Block bearbeiten. Die darunterstehenden Imports laden das passende Modell und Netzwerk automatisch. Auch ein ESPHome-Dashboard-Import übernimmt diesen vollständigen Einstellungsblock.

## Gerät und Drucker

`device_name` ist der technische ESPHome-Name. Bei einem bestehenden Gerät unverändert lassen, damit unter anderem die Druckaktion ihren Namen behält. Für einen zusätzlichen ESP einen eigenen Namen verwenden. `friendly_name` ist der Anzeigename.

`printer_model` ist `ep-261c` für 58-mm-Papier oder `ep-382c` für 80-mm-Papier. Im Home-Assistant-Integrationseintrag dasselbe Modell wählen. Die YAML-Auswahl steuert die Firmware, die Home-Assistant-Auswahl die Vorschau.

## WLAN oder Ethernet

`network_type` ist entweder `wifi` oder `ethernet`. Es wird nur die gewählte Schnittstelle geladen. Ein Wechsel erfordert neue Firmware.

Bei WLAN werden die bekannten Einträge `wifi_ssid` und `wifi_password` in der lokalen `secrets.yaml` benötigt. Die Namen sind im WLAN-Abschnitt der Basisdatei angegeben. Ethernet liest diese Secrets nicht ein. Passwörter gehören in `secrets.yaml`, nicht in ein öffentliches Repository.

## DHCP oder feste IP

Dieselben Einstellungen gelten für beide Netzwerktypen. Bei `ip_mode: dhcp` wird keine `manual_ip`-Konfiguration erzeugt. Die Felder `static_ip`, `gateway`, `subnet`, `dns1` und `dns2` werden dann nicht angewendet.

Für eine feste IP im vorhandenen Einstellungsblock folgende Werte setzen; die Adressen sind Beispiele und müssen zum eigenen Netz passen:

```yaml
  ip_mode: static
  static_ip: "192.168.1.50"
  gateway: "192.168.1.1"
  subnet: "255.255.255.0"
  dns1: "192.168.1.1"
  dns2: "0.0.0.0"
```

`0.0.0.0` bedeutet bei DNS keinen expliziten Server. Für Namensauflösung einen passenden DNS-Server eintragen. Leere Pflichtadressen bei `static` und unbekannte Modi werden bei der Konfigurationsprüfung abgelehnt.

Wenn beim Firmware-Update die Geräte-IP geändert wird, kann `network_use_address` vorübergehend die **bisherige** erreichbare IP beziehungsweise den Hostnamen enthalten. Dies ist nur die Zieladresse für Verbindung/Upload und setzt keine Geräte-IP. Nach erfolgreichem Wechsel wieder leeren. Vorhandene ältere `ethernet_ip`-/`ethernet_gw`-/`ethernet_mask`-Einträge bleiben unterstützt; beim Umstieg auf die neuen Felder entfernen und nicht mit `ip_mode` mischen. Ebenso vorhandene direkte `wifi.manual_ip`-/`ethernet.manual_ip`-Blöcke in die neuen Einstellungen übertragen und anschliessend entfernen, damit sie DHCP nicht übersteuern.

## Fallback-Hotspot und Weboberfläche

Für den Fallback bei nicht erreichbarem WLAN:

```yaml
  wifi_ap_enabled: "true"
  wifi_ap_ssid: "${device_name}_FH"
  wifi_ap_password: !secret wifi_hotspot_password
```

Das Hotspot-Passwort muss mindestens acht Zeichen lang sein. Ein fehlendes oder leeres Passwort wird bei aktiviertem AP abgelehnt; es entsteht nicht versehentlich ein offener Hotspot. Das Captive Portal wird zusammen mit dem AP aktiviert. Bei Ethernet werden weder AP noch Captive Portal geladen. Wenn ein Hotspot-Secret ausdrücklich oben als `!secret` eingetragen ist, muss es in `secrets.yaml` vorhanden sein; bei ungenutztem AP kann das Feld auf `""` bleiben.

`web_server_enabled: "true"` aktiviert die lokale Weboberfläche. Port, Version, lokale Ressourcen und Anzeige interner Entitäten stehen direkt darunter. `web_server_local: "true"` hält die Oberflächenressourcen auf dem Gerät. Der generelle Standard ist ausgeschaltet; eine bestehende Installation mit aktivem Webserver kann ihre Werte übernehmen. Diese Weboberfläche hat mit den hier gezeigten Einstellungen keine eigene Anmeldung; API-Verschlüsselung und OTA-Passwort schützen jeweils ihre eigenen Schnittstellen.

## Board und Verdrahtung

Standard ist Olimex ESP32-POE-ISO WROOM mit LAN8720. `esp32_board`, `esp32_variant` und `esp32_framework` legen den ESP fest. Die Ethernet-Pins und der Takt müssen zum tatsächlichen Board passen; der Boardname allein passt die Ethernet-Hardware nicht automatisch an.

`printer_tx_pin` ist der ESP-Ausgang zum Drucker-RX, `printer_rx_pin` der ESP-Eingang vom Drucker-TX. Die allgemeine Vorlage enthält GPIO4/5. Bei einer vorhandenen Verdrahtung mit GPIO14/13 diese Werte beibehalten. Die Baudrate muss zur Selbsttestseite des Druckers passen. Hinweise zu Spannungen und Schnittstellen stehen in der [EP-382C-Anleitung](ep-382c.md).

## Softwarestand und ältere Dateien

`thermal_printer_ref: main` lädt den aktuellen Entwicklungsstand. Für einen festen Stand genügt in der **neuen Basisdatei** `thermal_printer_ref: v0.8.0`: Packages und Treiber verwenden diesen Wert gemeinsam. `thermal_printer_refresh` steuert den Cache-Zeitraum. Ein abweichendes Repository muss kompatible Packages und die externe Komponente bereitstellen.

Eine ältere Konfiguration mit lokalem `thermal_printer.h`, manueller `new ThermalPrinterComponent(...)`-Initialisierung und einem 20-ms-Intervall wird durch die neue Basisdatei ersetzt. Die externe ESPHome-Komponente übernimmt Registrierung und Aufruf ihrer Schleife. Diese alten Blöcke nicht zusätzlich in die neue Konfiguration kopieren. Den alten Header für die neue Datei nicht mehr unter `includes` eintragen.

Vorhandenen Gerätenamen, API-/OTA-Secrets, Pins, Baudrate, Netzwerk, Hotspot und Weboberfläche übernehmen. Danach in ESPHome validieren und kompilieren; erst bei verfügbarem Gerät übertragen. Ohne ursprüngliche Fehlermeldung lässt sich ein früherer Kompilier- oder Verbindungsfehler nicht eindeutig erklären.

Die alten Drucker-Package-URLs bleiben nutzbar. `defaults.yaml` liefert Ersatzwerte für ältere Minimal-Konfigurationen. Der separate EP-382C-Template-Einstieg ist ab v0.8.1 entfernt. Falls eine ältere Datei noch diese Template-URL mit `@main` importiert, auf die gemeinsame `thermal-printer.yaml` umstellen und oben `printer_model: ep-382c` setzen. Die historischen Releases bleiben unverändert verfügbar.
