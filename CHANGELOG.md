# Changelog

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
