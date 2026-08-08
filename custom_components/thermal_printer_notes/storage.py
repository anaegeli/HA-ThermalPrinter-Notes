"""Private per-user storage for Thermal Printer Notes."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from typing import Any
from uuid import uuid4

from homeassistant.core import HomeAssistant
from homeassistant.helpers import storage
from homeassistant.util import dt as dt_util

from .const import (
    ALIGNMENTS,
    DEFAULT_HISTORY_LIMIT,
    MAX_MARKDOWN_LENGTH,
    MAX_TITLE_LENGTH,
    SIZES,
    STORAGE_KEY,
    STORAGE_VERSION,
)

EMPTY_DRAFT: dict[str, str] = {
    "title": "",
    "markdown": "",
    "alignment": "left",
    "size": "normal",
    "updated_at": "",
}


class ValidationError(ValueError):
    """Raised when draft or history input is invalid."""


def validate_document(document: dict[str, Any]) -> dict[str, str]:
    """Validate and normalize a user document."""
    title = str(document.get("title", ""))
    markdown = str(document.get("markdown", ""))
    alignment = str(document.get("alignment", "left"))
    size = str(document.get("size", "normal"))

    if len(title) > MAX_TITLE_LENGTH:
        raise ValidationError(f"Title exceeds {MAX_TITLE_LENGTH} characters")
    print_source = f"# {title.strip()}\n{markdown}" if title.strip() else markdown
    if len(print_source.encode("utf-8")) > MAX_MARKDOWN_LENGTH:
        raise ValidationError(
            f"Printable Markdown exceeds {MAX_MARKDOWN_LENGTH} UTF-8 bytes"
        )
    if alignment not in ALIGNMENTS:
        raise ValidationError("Invalid alignment")
    if size not in SIZES:
        raise ValidationError("Invalid size")

    return {
        "title": title,
        "markdown": markdown,
        "alignment": alignment,
        "size": size,
    }


class UserDataStore:
    """Store drafts and history without exposing them as HA entities."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the store wrapper."""
        self._store = storage.Store[dict[str, Any]](
            hass, STORAGE_VERSION, STORAGE_KEY, private=True
        )
        self._data: dict[str, Any] = {"users": {}}
        self._lock = asyncio.Lock()
        self._loaded = False

    async def async_load(self) -> None:
        """Load storage exactly once."""
        async with self._lock:
            if self._loaded:
                return
            loaded = await self._store.async_load()
            if isinstance(loaded, dict) and isinstance(loaded.get("users"), dict):
                self._data = loaded
            self._loaded = True

    def _user(self, user_id: str) -> dict[str, Any]:
        """Return one private user bucket, creating it when necessary."""
        users = self._data.setdefault("users", {})
        return users.setdefault(
            user_id,
            {"draft": deepcopy(EMPTY_DRAFT), "history": []},
        )

    async def async_get_draft(self, user_id: str) -> dict[str, str]:
        """Return a copy of the authenticated user's draft."""
        await self.async_load()
        async with self._lock:
            draft = self._user(user_id).get("draft", EMPTY_DRAFT)
            return deepcopy({**EMPTY_DRAFT, **draft})

    async def async_save_draft(
        self, user_id: str, document: dict[str, Any]
    ) -> dict[str, str]:
        """Persist a draft for exactly one authenticated user."""
        normalized = validate_document(document)
        normalized["updated_at"] = dt_util.utcnow().isoformat()
        await self.async_load()
        async with self._lock:
            self._user(user_id)["draft"] = normalized
            await self._store.async_save(self._data)
            return deepcopy(normalized)

    async def async_add_history(
        self,
        user_id: str,
        document: dict[str, Any],
        history_limit: int = DEFAULT_HISTORY_LIMIT,
    ) -> dict[str, Any]:
        """Add a private history snapshot before submitting a print."""
        normalized = validate_document(document)
        entry: dict[str, Any] = {
            "id": uuid4().hex,
            "created_at": dt_util.utcnow().isoformat(),
            "status": "pending",
            "error": "",
            **normalized,
        }
        await self.async_load()
        async with self._lock:
            history = self._user(user_id).setdefault("history", [])
            history.insert(0, entry)
            del history[max(1, int(history_limit)) :]
            await self._store.async_save(self._data)
            return deepcopy(entry)

    async def async_update_history_status(
        self, user_id: str, history_id: str, status: str, error: str = ""
    ) -> None:
        """Update the result of one of the user's own print submissions."""
        await self.async_load()
        async with self._lock:
            for item in self._user(user_id).setdefault("history", []):
                if item.get("id") == history_id:
                    item["status"] = status
                    item["error"] = str(error)[:500]
                    await self._store.async_save(self._data)
                    return

    async def async_list_history(
        self, user_id: str, history_limit: int = DEFAULT_HISTORY_LIMIT
    ) -> list[dict[str, Any]]:
        """List summaries for the authenticated user only."""
        await self.async_load()
        async with self._lock:
            result: list[dict[str, Any]] = []
            for item in self._user(user_id).get("history", [])[
                : max(1, int(history_limit))
            ]:
                markdown = str(item.get("markdown", ""))
                result.append(
                    {
                        "id": item.get("id", ""),
                        "created_at": item.get("created_at", ""),
                        "status": item.get("status", ""),
                        "error": item.get("error", ""),
                        "title": item.get("title", ""),
                        "alignment": item.get("alignment", "left"),
                        "size": item.get("size", "normal"),
                        "preview": markdown.replace("\n", " ")[:120],
                        "length": len(markdown),
                    }
                )
            return result

    async def async_get_history(
        self, user_id: str, history_id: str
    ) -> dict[str, Any] | None:
        """Return one full history entry belonging to the user."""
        await self.async_load()
        async with self._lock:
            for item in self._user(user_id).get("history", []):
                if item.get("id") == history_id:
                    return deepcopy(item)
            return None

    async def async_delete_history(self, user_id: str, history_id: str) -> bool:
        """Delete one history entry belonging to the user."""
        await self.async_load()
        async with self._lock:
            history = self._user(user_id).setdefault("history", [])
            for index, item in enumerate(history):
                if item.get("id") == history_id:
                    del history[index]
                    await self._store.async_save(self._data)
                    return True
            return False

    async def async_clear_history(self, user_id: str) -> None:
        """Clear only the authenticated user's history."""
        await self.async_load()
        async with self._lock:
            self._user(user_id)["history"] = []
            await self._store.async_save(self._data)

    async def async_prune_all(self, history_limit: int) -> None:
        """Apply a changed central history limit to all opaque user buckets."""
        await self.async_load()
        async with self._lock:
            changed = False
            limit = max(1, int(history_limit))
            for user_data in self._data.get("users", {}).values():
                history = user_data.get("history", [])
                if len(history) > limit:
                    del history[limit:]
                    changed = True
            if changed:
                await self._store.async_save(self._data)
