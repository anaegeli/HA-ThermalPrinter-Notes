"""Serve and register the bundled Lovelace card."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace.const import LOVELACE_DATA, MODE_STORAGE
from homeassistant.core import HomeAssistant

from .const import FRONTEND_FILE, FRONTEND_URL, VERSION

_LOGGER = logging.getLogger(__name__)


async def async_register_frontend(hass: HomeAssistant) -> None:
    """Expose the card and add it to storage-mode Lovelace when possible."""
    frontend_dir = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(FRONTEND_URL, str(frontend_dir), False)]
    )

    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None or lovelace.resource_mode != MODE_STORAGE:
        return
    resources = getattr(lovelace, "resources", None)
    if resources is None:
        return

    try:
        if not resources.loaded:
            await resources.async_get_info()
        url = f"{FRONTEND_URL}/{FRONTEND_FILE}?v={VERSION}"
        prefix = f"{FRONTEND_URL}/{FRONTEND_FILE}"
        existing = next(
            (
                item
                for item in resources.async_items()
                if str(item.get("url", "")).startswith(prefix)
            ),
            None,
        )
        if existing is None:
            await resources.async_create_item({"res_type": "module", "url": url})
        elif existing.get("url") != url:
            await resources.async_update_item(
                existing["id"], {"res_type": "module", "url": url}
            )
    except Exception:  # noqa: BLE001 - resource registration must not block setup
        _LOGGER.exception("Could not register the Lovelace card resource")
