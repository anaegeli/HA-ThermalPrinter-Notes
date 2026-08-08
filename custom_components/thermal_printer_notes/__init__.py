"""Thermal Printer Notes integration."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import CONF_HISTORY_LIMIT, DOMAIN, entry_settings
from .frontend import async_register_frontend
from .storage import UserDataStore
from .websocket import async_register_websocket_commands

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register the private API and bundled dashboard card."""
    hass.data.setdefault(DOMAIN, {})
    async_register_websocket_commands(hass)
    await async_register_frontend(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Load the single integration entry and its private storage."""
    store = UserDataStore(hass)
    await store.async_load()
    settings = entry_settings(entry)
    await store.async_prune_all(int(settings[CONF_HISTORY_LIMIT]))
    hass.data.setdefault(DOMAIN, {}).update({"entry": entry, "store": store})
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the runtime while leaving persisted private data intact."""
    runtime = hass.data.get(DOMAIN, {})
    if runtime.get("entry") is entry:
        runtime.pop("entry", None)
        runtime.pop("store", None)
    return True
