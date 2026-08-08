"""Authenticated WebSocket API for Thermal Printer Notes."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Context, HomeAssistant
from homeassistant.util import dt as dt_util
import voluptuous as vol

from .const import (
    DOMAIN,
    MAX_MARKDOWN_LENGTH,
    entry_settings,
    source_device_id,
)
from .devices import suggested_print_action
from .storage import UserDataStore, ValidationError, validate_document

_LOGGER = logging.getLogger(__name__)

WS_LIST_PRINTERS = f"{DOMAIN}/list_printers"
WS_GET_STATE = f"{DOMAIN}/get_state"
WS_SAVE_DRAFT = f"{DOMAIN}/save_draft"
WS_SAVE_HISTORY = f"{DOMAIN}/save_history"
WS_PRINT = f"{DOMAIN}/print"
WS_HISTORY_GET = f"{DOMAIN}/history/get"
WS_HISTORY_DELETE = f"{DOMAIN}/history/delete"
WS_HISTORY_CLEAR = f"{DOMAIN}/history/clear"
WS_HISTORY_PRINT = f"{DOMAIN}/history/print"

DEVICE_SCHEMA = {vol.Optional("device_id", default=""): str}
DOCUMENT_SCHEMA = {
    **DEVICE_SCHEMA,
    vol.Optional("title", default=""): str,
    vol.Optional("markdown", default=""): str,
    vol.Optional("alignment", default="left"): str,
    vol.Optional("size", default="normal"): str,
}


def _runtime(hass: HomeAssistant, msg: dict[str, Any]) -> dict[str, Any]:
    """Resolve the selected virtual printer device to its runtime."""
    root = hass.data.get(DOMAIN, {})
    entries = root.get("entries", {})
    device_id = str(msg.get("device_id", ""))
    if device_id:
        entry_id = root.get("devices", {}).get(device_id)
        runtime = entries.get(entry_id)
        if runtime is None:
            raise RuntimeError("Der ausgewählte Drucker ist nicht verfügbar")
        return runtime
    if len(entries) == 1:
        return next(iter(entries.values()))
    if not entries:
        raise RuntimeError("Thermal Printer Notes ist nicht konfiguriert")
    raise RuntimeError("Bitte einen Drucker in der Kartenkonfiguration auswählen")


def _user(connection: websocket_api.ActiveConnection) -> tuple[str, str]:
    """Get identity only from the authenticated Home Assistant connection."""
    user = connection.user
    if user is None:
        raise RuntimeError("Angemeldeter Benutzer ist nicht verfügbar")
    return user.id, user.name or "Home Assistant"


def _document_from_message(msg: dict[str, Any]) -> dict[str, str]:
    """Extract and validate document fields from a WebSocket message."""
    return validate_document(
        {
            "title": msg.get("title", ""),
            "markdown": msg.get("markdown", ""),
            "alignment": msg.get("alignment", "left"),
            "size": msg.get("size", "normal"),
        }
    )


def _action_parts(action: object) -> tuple[str, str]:
    """Split a validated domain.service action."""
    domain, service = str(action).split(".", 1)
    return domain, service


def _resolved_print_action(hass: HomeAssistant, entry: ConfigEntry) -> str:
    """Return an available configured or automatically discovered action."""
    configured = str(entry_settings(entry)["print_action"])
    automatic = suggested_print_action(hass, source_device_id(entry))
    for action in dict.fromkeys((configured, automatic)):
        if not action or action.count(".") != 1:
            continue
        domain, service = _action_parts(action)
        if hass.services.has_service(domain, service):
            if action != configured:
                _LOGGER.warning(
                    "Configured print action %s is unavailable; using %s",
                    configured,
                    action,
                )
            return action
    raise RuntimeError(
        f"Druckaktion '{configured}' ist in Home Assistant nicht verfügbar. "
        "Bitte den ESPHome-Drucker unter Geräte & Dienste konfigurieren."
    )


def _public_print_error(err: Exception) -> str:
    """Return a useful bounded error for the authenticated card user."""
    detail = " ".join(str(err).split())[:400]
    return (
        f"Die Druckaktion ist fehlgeschlagen: {detail}"
        if detail
        else "Die Druckaktion ist ohne Fehlermeldung fehlgeschlagen"
    )


def _adapt_service_data(
    hass: HomeAssistant,
    domain: str,
    service: str,
    service_data: dict[str, Any],
) -> dict[str, Any]:
    """Adapt fields to the ESPHome action schema currently registered in HA."""
    registered = hass.services.async_services().get(domain, {}).get(service)
    schema = getattr(getattr(registered, "schema", None), "schema", None)
    if not isinstance(schema, dict):
        return service_data
    allowed = {
        str(getattr(marker, "schema", marker))
        for marker in schema
        if isinstance(getattr(marker, "schema", marker), str)
    }
    if not allowed:
        return service_data

    adapted = dict(service_data)
    if "markdown_content" not in allowed:
        for alias in ("text", "markdown"):
            if alias in allowed:
                adapted[alias] = adapted["markdown_content"]
                break
    dropped = sorted(set(adapted) - allowed)
    if dropped:
        _LOGGER.debug(
            "Omitting unsupported fields for %s.%s: %s",
            domain,
            service,
            ", ".join(dropped),
        )
    return {key: value for key, value in adapted.items() if key in allowed}


def _print_markdown(document: dict[str, Any]) -> str:
    """Build the printer Markdown while keeping the title optional."""
    title = str(document.get("title", "")).strip()
    markdown = str(document.get("markdown", ""))
    return f"# {title}\n{markdown}" if title else markdown


async def _submit_print(
    hass: HomeAssistant,
    entry: ConfigEntry,
    store: UserDataStore,
    user_id: str,
    user_name: str,
    document: dict[str, Any],
) -> dict[str, Any]:
    """Save history first, then submit one print to the configured action."""
    settings = entry_settings(entry)
    history = await store.async_add_history(
        user_id, document, int(settings["history_limit"])
    )
    domain, service = _action_parts(_resolved_print_action(hass, entry))
    service_data = {
        "markdown_content": _print_markdown(document),
        "print_user": user_name,
        "print_timestamp": dt_util.now().strftime("%d.%m.%Y %H:%M"),
        "alignment": document["alignment"],
        "size": document["size"],
        "copies": settings["copies"],
        "feed_lines": settings["feed_lines"],
        "reverse_print": settings["reverse_print"],
        "cut": settings["cut"],
    }
    try:
        compatible_service_data = _adapt_service_data(
            hass, domain, service, service_data
        )
        await hass.services.async_call(
            domain,
            service,
            compatible_service_data,
            blocking=True,
            context=Context(user_id=user_id),
        )
    except Exception as err:
        await store.async_update_history_status(
            user_id, history["id"], "failed", str(err)
        )
        raise
    await store.async_update_history_status(user_id, history["id"], "submitted")
    history["status"] = "submitted"
    return history


def _send_validation_error(
    connection: websocket_api.ActiveConnection, msg_id: int, err: Exception
) -> None:
    """Return a stable validation error without internal details."""
    connection.send_error(msg_id, "invalid_document", str(err))


def _printer_payload(runtime: dict[str, Any]) -> dict[str, Any]:
    """Return card-safe metadata for a configured printer."""
    entry: ConfigEntry = runtime["entry"]
    return {
        "device_id": runtime["device_id"],
        "name": entry.title,
        **runtime["entities"].as_dict(),
    }


@websocket_api.websocket_command({vol.Required("type"): WS_LIST_PRINTERS})
@websocket_api.async_response
async def websocket_list_printers(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """List selectable integration-owned printer devices."""
    runtimes = hass.data.get(DOMAIN, {}).get("entries", {}).values()
    printers = sorted(
        (_printer_payload(item) for item in runtimes),
        key=lambda item: item["name"].casefold(),
    )
    connection.send_result(msg["id"], {"printers": printers})


@websocket_api.websocket_command(
    {vol.Required("type"): WS_GET_STATE, **DEVICE_SCHEMA}
)
@websocket_api.async_response
async def websocket_get_state(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return only the current user's data for one printer."""
    try:
        runtime = _runtime(hass, msg)
        entry: ConfigEntry = runtime["entry"]
        store: UserDataStore = runtime["store"]
        user_id, user_name = _user(connection)
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    settings = entry_settings(entry)
    connection.send_result(
        msg["id"],
        {
            "user_name": user_name,
            "printer": _printer_payload(runtime),
            "draft": await store.async_get_draft(user_id),
            "history": await store.async_list_history(
                user_id, int(settings["history_limit"])
            ),
            "settings": settings,
            "max_markdown_bytes": MAX_MARKDOWN_LENGTH,
            "preview_profile": {
                "dots": 384,
                "normal_columns": 32,
                "small_columns": 42,
                "normal_glyph_height": 24,
                "small_glyph_height": 17,
                "normal_line_height": 30,
                "small_line_height": 23,
                "double_line_height": 54,
            },
        },
    )


@websocket_api.websocket_command(
    {vol.Required("type"): WS_SAVE_DRAFT, **DOCUMENT_SCHEMA}
)
@websocket_api.async_response
async def websocket_save_draft(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save a private per-printer draft."""
    try:
        store: UserDataStore = _runtime(hass, msg)["store"]
        user_id, _ = _user(connection)
        saved = await store.async_save_draft(user_id, _document_from_message(msg))
    except ValidationError as err:
        _send_validation_error(connection, msg["id"], err)
        return
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    connection.send_result(msg["id"], {"draft": saved})


@websocket_api.websocket_command(
    {vol.Required("type"): WS_SAVE_HISTORY, **DOCUMENT_SCHEMA}
)
@websocket_api.async_response
async def websocket_save_history(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save a private history snapshot without printing."""
    try:
        runtime = _runtime(hass, msg)
        entry, store = runtime["entry"], runtime["store"]
        user_id, _ = _user(connection)
        document = _document_from_message(msg)
        saved = await store.async_save_draft(user_id, document)
        history = await store.async_add_history(
            user_id,
            document,
            int(entry_settings(entry)["history_limit"]),
            status="saved",
        )
    except ValidationError as err:
        _send_validation_error(connection, msg["id"], err)
        return
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    connection.send_result(msg["id"], {"draft": saved, "history": history})


@websocket_api.websocket_command({vol.Required("type"): WS_PRINT, **DOCUMENT_SCHEMA})
@websocket_api.async_response
async def websocket_print(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save draft/history before submitting the print action."""
    try:
        runtime = _runtime(hass, msg)
        entry, store = runtime["entry"], runtime["store"]
        user_id, user_name = _user(connection)
        document = _document_from_message(msg)
        await store.async_save_draft(user_id, document)
        history = await _submit_print(
            hass, entry, store, user_id, user_name, document
        )
    except ValidationError as err:
        _send_validation_error(connection, msg["id"], err)
        return
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    except Exception as err:
        _LOGGER.exception("Thermal printer action failed")
        connection.send_error(
            msg["id"],
            "print_failed",
            _public_print_error(err),
        )
        return
    connection.send_result(msg["id"], {"history": history})


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_HISTORY_GET,
        **DEVICE_SCHEMA,
        vol.Required("history_id"): str,
    }
)
@websocket_api.async_response
async def websocket_history_get(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return one own history item."""
    try:
        store: UserDataStore = _runtime(hass, msg)["store"]
        user_id, _ = _user(connection)
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    item = await store.async_get_history(user_id, msg["history_id"])
    if item is None:
        connection.send_error(
            msg["id"], "not_found", "Verlaufseintrag nicht gefunden"
        )
        return
    connection.send_result(msg["id"], {"history": item})


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_HISTORY_DELETE,
        **DEVICE_SCHEMA,
        vol.Required("history_id"): str,
    }
)
@websocket_api.async_response
async def websocket_history_delete(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete one own history item."""
    try:
        store: UserDataStore = _runtime(hass, msg)["store"]
        user_id, _ = _user(connection)
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    if not await store.async_delete_history(user_id, msg["history_id"]):
        connection.send_error(
            msg["id"], "not_found", "Verlaufseintrag nicht gefunden"
        )
        return
    connection.send_result(msg["id"], {"deleted": True})


@websocket_api.websocket_command(
    {vol.Required("type"): WS_HISTORY_CLEAR, **DEVICE_SCHEMA}
)
@websocket_api.async_response
async def websocket_history_clear(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Clear only the current user's history for one printer."""
    try:
        store: UserDataStore = _runtime(hass, msg)["store"]
        user_id, _ = _user(connection)
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    await store.async_clear_history(user_id)
    connection.send_result(msg["id"], {"cleared": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_HISTORY_PRINT,
        **DEVICE_SCHEMA,
        vol.Required("history_id"): str,
    }
)
@websocket_api.async_response
async def websocket_history_print(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Reprint one own item and create a fresh history snapshot first."""
    try:
        runtime = _runtime(hass, msg)
        entry, store = runtime["entry"], runtime["store"]
        user_id, user_name = _user(connection)
        previous = await store.async_get_history(user_id, msg["history_id"])
        if previous is None:
            connection.send_error(
                msg["id"], "not_found", "Verlaufseintrag nicht gefunden"
            )
            return
        history = await _submit_print(
            hass, entry, store, user_id, user_name, validate_document(previous)
        )
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    except Exception as err:
        _LOGGER.exception("Thermal printer history action failed")
        connection.send_error(
            msg["id"],
            "print_failed",
            _public_print_error(err),
        )
        return
    connection.send_result(msg["id"], {"history": history})


def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register the authenticated frontend API once."""
    websocket_api.async_register_command(hass, websocket_list_printers)
    websocket_api.async_register_command(hass, websocket_get_state)
    websocket_api.async_register_command(hass, websocket_save_draft)
    websocket_api.async_register_command(hass, websocket_save_history)
    websocket_api.async_register_command(hass, websocket_print)
    websocket_api.async_register_command(hass, websocket_history_get)
    websocket_api.async_register_command(hass, websocket_history_delete)
    websocket_api.async_register_command(hass, websocket_history_clear)
    websocket_api.async_register_command(hass, websocket_history_print)
