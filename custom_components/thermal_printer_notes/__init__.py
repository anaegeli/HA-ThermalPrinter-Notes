"""Thermal Printer Notes integration."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_HISTORY_LIMIT,
    CONF_PRINT_ACTION,
    CONF_SOURCE_DEVICE_ID,
    DOMAIN,
    STORAGE_KEY,
    entry_settings,
)
from .devices import (
    discover_printer_entities,
    find_source_device_from_action,
    register_printer_device,
    source_device_name,
)
from .frontend import async_register_frontend
from .storage import UserDataStore
from .websocket import async_register_websocket_commands

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register the private API and bundled dashboard card."""
    runtime_root = hass.data.setdefault(DOMAIN, {})
    runtime_root.setdefault("entries", {})
    runtime_root.setdefault("devices", {})
    async_register_websocket_commands(hass)
    await async_register_frontend(hass)
    return True


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Preserve v0.1 storage and discover its ESPHome device."""
    if entry.version >= 2:
        return True
    data = dict(entry.data)
    action = str(
        entry.options.get(
            CONF_PRINT_ACTION,
            data.get(CONF_PRINT_ACTION, ""),
        )
    )
    device_id = find_source_device_from_action(hass, action)
    if device_id:
        data[CONF_SOURCE_DEVICE_ID] = device_id
    data["legacy_storage"] = True
    update: dict = {"data": data, "version": 2}
    if device_id:
        update["unique_id"] = device_id
        update["title"] = source_device_name(hass, device_id)
    hass.config_entries.async_update_entry(entry, **update)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Load one independently selectable printer profile."""
    runtime_root = hass.data.setdefault(DOMAIN, {})
    runtime_root.setdefault("entries", {})
    runtime_root.setdefault("devices", {})
    storage_key = (
        STORAGE_KEY
        if entry.data.get("legacy_storage")
        else f"{STORAGE_KEY}.{entry.entry_id}"
    )
    store = UserDataStore(hass, storage_key)
    await store.async_load()
    settings = entry_settings(entry)
    await store.async_prune_all(int(settings[CONF_HISTORY_LIMIT]))
    device = register_printer_device(hass, entry)
    runtime_root["entries"][entry.entry_id] = {
        "entry": entry,
        "store": store,
        "device_id": device.id,
        "entities": discover_printer_entities(
            hass,
            str(
                entry.options.get(
                    CONF_SOURCE_DEVICE_ID,
                    entry.data.get(CONF_SOURCE_DEVICE_ID, ""),
                )
                or ""
            ),
        ),
    }
    runtime_root["devices"][device.id] = entry.entry_id
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload one runtime while leaving its private data intact."""
    runtime_root = hass.data.get(DOMAIN, {})
    runtime = runtime_root.get("entries", {}).pop(entry.entry_id, None)
    if runtime is not None:
        runtime_root.get("devices", {}).pop(runtime.get("device_id"), None)
    return True
