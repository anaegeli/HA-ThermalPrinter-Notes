# Changelog

## 0.8.0

- Use one complete `thermal-printer.yaml` with a grouped settings block for both printer models, board hardware, network, addresses, UART, API/OTA, hotspot and web interface.
- Select the model via `printer_model`; select Ethernet/Wi-Fi and DHCP/static IP independently. Include DNS and a temporary upload address for IP changes.
- Use one Git reference for packages and driver. Dashboard import retains the complete settings block.
- Add optional Wi-Fi fallback AP/captive portal and local web server, preserving the features used by existing standalone configurations.
- Keep old package entry points and legacy Ethernet static-IP settings compatible. The old EP-382C template becomes a redirect to the shared template.
- Validate all eight model/network/address combinations, optional features and invalid inputs; compile all eight variants in CI.

Existing devices are not flashed by HACS. Preserve the real UART pins, device name and local secrets when replacing an older standalone YAML. The new external component replaces manual header inclusion, driver construction and interval servicing. No physical device was available for commissioning.

## 0.7.0

- Add Cashino EP-382C support: 80 mm paper, 72 mm / 576 dots printable, 48 Font A and 64 Font B columns.
- Select the model during Home Assistant setup or in integration options. Device metadata and preview follow the selected printer; existing entries default to EP-261C without storage migration.
- Add `esphome/thermal-printer-ep-382c.yaml` and the `cashino-ep-382c.yaml` package. Both models share transport/actions while firmware uses the selected model for headers, wrapping, headings and separators.
- Adapt preview canvas width, text alignment and QR placeholder centering for both models, including printer switches and stale response handling.
- Interpret EP-382C offline paper-out and uncollected-receipt status according to its manual.
- Add a German installation guide with power variants, serial pinout, self-test, configuration and physical commissioning steps.
- Test both model previews, emitted ESC/POS bytes, status replies, upgrade compatibility and Ethernet/Wi-Fi firmware configurations.

Update HACS, restart Home Assistant and reload the dashboard. For a new EP-382C, compile/upload the new ESPHome template and select EP-382C in its separate integration entry. Both model settings must match. Existing EP-261C firmware continues to work. No physical EP-382C print test was performed for this release; follow `docs/ep-382c.md` for commissioning.

## 0.6.0

- Select a configured printer directly from the card. Each ESPHome device remains a separate printer profile with its own private drafts, history and settings.
- Save the current draft before switching. A failed save keeps the current printer selected; stale responses cannot overwrite the next printer's data.
- Existing card `device_id` settings remain valid as the initial selection. No new ESP firmware is required for the dropdown.
- Choose `network_type: ethernet` or `network_type: wifi` at the top of the device YAML. Ethernet remains the default for existing configurations.
- Consolidate hardware and driver defaults in one package; retain existing package paths, pin overrides and static Ethernet IP substitutions.
- Preserve storage keys, config-entry version and print action parameters. No deletion or recreation of integration entries is required.
- Remove the unsafe fallback to another device's sole available print action.
- Add selection/isolation tests and ESPHome validation/code-generation checks for both network types and older Ethernet configurations.

Update the integration through HACS, restart Home Assistant and reload the dashboard. The existing ESP firmware continues to work. Compile and upload firmware separately only when needed, such as changing network type. A firmware upload restarts the ESP; uninterrupted operation during application/device restarts is not guaranteed.
