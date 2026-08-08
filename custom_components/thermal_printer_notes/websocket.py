"""Authenticated WebSocket API for Thermal Printer Notes."""

from __future__ import annotations

from typing import Any

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Context, HomeAssistant
from homeassistant.util import dt as dt_util
import voluptuous as vol

from .const import DOMAIN, entry_settings
from .storage import UserDataStore, ValidationError, validate_document

WS_GET_STATE = f"{DOMAIN}/get_state"
WS_SAVE_DRAFT = f"{DOMAIN}/save_draft"
WS_PRINT = f"{DOMAIN}/print"
WS_HISTORY_GET = f"{DOMAIN}/history/get"
WS_HISTORY_DELETE = f"{DOMAIN}/history/delete"
WS_HISTORY_CLEAR = f"{DOMAIN}/history/clear"
WS_HISTORY_PRINT = f"{DOMAIN}/history/print"

DOCUMENT_SCHEMA = {
    vol.Optional("title", default=""): str,
    vol.Optional("markdown", default=""): str,
    vol.Optional("alignment", default="left"): str,
    vol.Optional("size", default="normal"): str,
}


def _runtime(hass: HomeAssistant) -> tuple[ConfigEntry, UserDataStore]:
    """Return the single configured runtime."""
    runtime = hass.data.get(DOMAIN, {})
    entry = runtime.get("entry")
    store = runtime.get("store")
    if entry is None or store is None:
        raise RuntimeError("Thermal Printer Notes is not configured")
    return entry, store


def _user(connection: websocket_api.ActiveConnection) -> tuple[str, str]:
    """Get identity only from the authenticated Home Assistant connection."""
    user = connection.user
    if user is None:
        raise RuntimeError("Authenticated user is unavailable")
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
    domain, service = _action_parts(settings["print_action"])
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
        await hass.services.async_call(
            domain,
            service,
            service_data,
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


@websocket_api.websocket_command({vol.Required("type"): WS_GET_STATE})
@websocket_api.async_response
async def websocket_get_state(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return only the current user's draft and history."""
    try:
        entry, store = _runtime(hass)
        user_id, user_name = _user(connection)
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    settings = entry_settings(entry)
    connection.send_result(
        msg["id"],
        {
            "user_name": user_name,
            "draft": await store.async_get_draft(user_id),
            "history": await store.async_list_history(
                user_id, int(settings["history_limit"])
            ),
            "settings": settings,
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
    """Save a draft in the authenticated user's private bucket."""
    try:
        _, store = _runtime(hass)
        user_id, _ = _user(connection)
        document = _document_from_message(msg)
        saved = await store.async_save_draft(user_id, document)
    except ValidationError as err:
        _send_validation_error(connection, msg["id"], err)
        return
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    connection.send_result(msg["id"], {"draft": saved})


@websocket_api.websocket_command({vol.Required("type"): WS_PRINT, **DOCUMENT_SCHEMA})
@websocket_api.async_response
async def websocket_print(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save the draft and history before submitting the print action."""
    try:
        entry, store = _runtime(hass)
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
    except Exception:
        connection.send_error(
            msg["id"], "print_failed", "The configured print action failed"
        )
        return
    connection.send_result(msg["id"], {"history": history})


@websocket_api.websocket_command(
    {vol.Required("type"): WS_HISTORY_GET, vol.Required("history_id"): str}
)
@websocket_api.async_response
async def websocket_history_get(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return one history item only if it belongs to the current user."""
    try:
        _, store = _runtime(hass)
        user_id, _ = _user(connection)
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    item = await store.async_get_history(user_id, msg["history_id"])
    if item is None:
        connection.send_error(msg["id"], "not_found", "History item not found")
        return
    connection.send_result(msg["id"], {"history": item})


@websocket_api.websocket_command(
    {vol.Required("type"): WS_HISTORY_DELETE, vol.Required("history_id"): str}
)
@websocket_api.async_response
async def websocket_history_delete(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete one of the current user's history items."""
    try:
        _, store = _runtime(hass)
        user_id, _ = _user(connection)
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    if not await store.async_delete_history(user_id, msg["history_id"]):
        connection.send_error(msg["id"], "not_found", "History item not found")
        return
    connection.send_result(msg["id"], {"deleted": True})


@websocket_api.websocket_command({vol.Required("type"): WS_HISTORY_CLEAR})
@websocket_api.async_response
async def websocket_history_clear(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Clear only the current user's history."""
    try:
        _, store = _runtime(hass)
        user_id, _ = _user(connection)
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    await store.async_clear_history(user_id)
    connection.send_result(msg["id"], {"cleared": True})


@websocket_api.websocket_command(
    {vol.Required("type"): WS_HISTORY_PRINT, vol.Required("history_id"): str}
)
@websocket_api.async_response
async def websocket_history_print(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Reprint one own item and create a fresh history snapshot first."""
    try:
        entry, store = _runtime(hass)
        user_id, user_name = _user(connection)
        previous = await store.async_get_history(user_id, msg["history_id"])
        if previous is None:
            connection.send_error(
                msg["id"], "not_found", "History item not found"
            )
            return
        document = validate_document(previous)
        history = await _submit_print(
            hass, entry, store, user_id, user_name, document
        )
    except RuntimeError as err:
        connection.send_error(msg["id"], "not_ready", str(err))
        return
    except Exception:
        connection.send_error(
            msg["id"], "print_failed", "The configured print action failed"
        )
        return
    connection.send_result(msg["id"], {"history": history})


def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register the authenticated frontend API once."""
    websocket_api.async_register_command(hass, websocket_get_state)
    websocket_api.async_register_command(hass, websocket_save_draft)
    websocket_api.async_register_command(hass, websocket_print)
    websocket_api.async_register_command(hass, websocket_history_get)
    websocket_api.async_register_command(hass, websocket_history_delete)
    websocket_api.async_register_command(hass, websocket_history_clear)
    websocket_api.async_register_command(hass, websocket_history_print)
