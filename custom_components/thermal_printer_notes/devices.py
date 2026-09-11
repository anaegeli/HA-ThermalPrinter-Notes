"""Device and entity discovery for configured thermal printers."""

from __future__ import annotations

from dataclasses import dataclass

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.util import slugify

from .const import DOMAIN, VERSION, source_device_id


@dataclass(frozen=True, slots=True)
class PrinterEntities:
    """Automatically discovered ESPHome status entities."""

    status: str = ""
    ready: str = ""
    queue: str = ""

    def as_dict(self) -> dict[str, str]:
        """Return frontend field names."""
        return {
            "status_entity": self.status,
            "ready_entity": self.ready,
            "queue_entity": self.queue,
        }


def _entry_text(entry: er.RegistryEntry) -> str:
    """Return stable searchable metadata for one entity registry entry."""
    return " ".join(
        str(value or "").casefold()
        for value in (
            entry.entity_id,
            entry.original_name,
            getattr(entry, "original_name_unprefixed", None),
            entry.unique_id,
        )
    )


def discover_printer_entities(
    hass: HomeAssistant, device_id: str
) -> PrinterEntities:
    """Resolve status entities from the selected ESPHome device."""
    if not device_id:
        return PrinterEntities()
    registry = er.async_get(hass)
    entries = er.async_entries_for_device(
        registry, device_id, include_disabled_entities=True
    )

    def find(domain: str, words: tuple[str, ...]) -> str:
        candidates = [
            entry
            for entry in entries
            if entry.entity_id.partition(".")[0] == domain
            and any(word in _entry_text(entry) for word in words)
        ]
        if not candidates:
            return ""
        candidates.sort(
            key=lambda entry: (
                not any(entry.entity_id.endswith(f"_{word}") for word in words),
                entry.entity_id,
            )
        )
        return candidates[0].entity_id

    return PrinterEntities(
        status=find("sensor", ("status",)),
        ready=find("binary_sensor", ("ready", "bereit")),
        queue=find("sensor", ("queue", "warteschlange")),
    )


def source_device_name(hass: HomeAssistant, device_id: str) -> str:
    """Return the selected source device's user-facing name."""
    device = dr.async_get(hass).async_get(device_id) if device_id else None
    if device is None:
        return "Thermal Printer"
    return device.name_by_user or device.name or "Thermal Printer"


def suggested_print_action(hass: HomeAssistant, device_id: str) -> str:
    """Derive the ESPHome API action from the selected printer device."""
    entities = discover_printer_entities(hass, device_id)
    if entities.status:
        object_id = entities.status.partition(".")[2]
        base = object_id.removesuffix("_status")
        candidate = f"esphome.{base}_print_markdown"
        if hass.services.has_service("esphome", f"{base}_print_markdown"):
            return candidate

    name_base = slugify(source_device_name(hass, device_id)).replace("-", "_")
    candidate_service = f"{name_base}_print_markdown"
    if hass.services.has_service("esphome", candidate_service):
        return f"esphome.{candidate_service}"

    # Another device's only remaining action is not a safe fallback.
    return ""


def find_source_device_from_action(hass: HomeAssistant, action: str) -> str:
    """Best-effort migration of a legacy single-printer entry."""
    if not action.startswith("esphome.") or not action.endswith("_print_markdown"):
        return ""
    base = action.removeprefix("esphome.").removesuffix("_print_markdown")
    registry = er.async_get(hass)
    for entity_id in (
        f"sensor.{base}_status",
        f"binary_sensor.{base}_ready",
        f"sensor.{base}_queue",
    ):
        entity = registry.async_get(entity_id)
        if entity is not None and entity.device_id:
            return entity.device_id
    return ""


def register_printer_device(hass: HomeAssistant, entry: ConfigEntry):
    """Create the selectable Home Assistant device for one printer profile."""
    source_id = source_device_id(entry)
    name = source_device_name(hass, source_id) if source_id else entry.title
    return dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(DOMAIN, entry.entry_id)},
        manufacturer="Cashino",
        model="EP-261C",
        name=name,
        sw_version=VERSION,
    )
