"""Exercise upgrade/storage behavior with an in-memory Home Assistant adapter.

Runs the integration's real setup, migration and storage code. The adapter is
not a substitute for a live Home Assistant restart/upgrade test.
"""
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def module(name, **attributes):
    result = ModuleType(name)
    result.__dict__.update(attributes)
    sys.modules[name] = result
    return result


class Store:
    records = {}

    def __class_getitem__(cls, _):
        return cls

    def __init__(self, hass, version, key, private):
        assert version == 1 and private
        self.key = key

    async def async_load(self):
        return deepcopy(self.records.get(self.key))

    async def async_save(self, data):
        self.records[self.key] = deepcopy(data)


module("homeassistant")
module("homeassistant.config_entries", ConfigEntry=object)
module("homeassistant.core", HomeAssistant=object)
cv = module("homeassistant.helpers.config_validation", config_entry_only_config_schema=lambda domain: {})
storage = module("homeassistant.helpers.storage", Store=Store)
module("homeassistant.helpers", config_validation=cv, storage=storage)
dt = module("homeassistant.util.dt", utcnow=lambda: datetime.now(timezone.utc))
module("homeassistant.util", dt=dt)

domain = "custom_components.thermal_printer_notes"
module(f"{domain}.devices",
       discover_printer_entities=lambda *args: SimpleNamespace(as_dict=lambda: {}),
       find_source_device_from_action=lambda *args: "esp-A",
       register_printer_device=lambda hass, entry: SimpleNamespace(id=f"printer-{entry.entry_id}"),
       source_device_name=lambda *args: "Office")
module(f"{domain}.frontend", async_register_frontend=None)
module(f"{domain}.websocket", async_register_websocket_commands=None)
integration = importlib.import_module(domain)
UserDataStore = importlib.import_module(f"{domain}.storage").UserDataStore
const = importlib.import_module(f"{domain}.const")


async def run():
    legacy = {"users": {
        "alice": {"draft": {"title": "Old title", "markdown": "Private A", "alignment": "left", "size": "double_width"},
                  "history": [{"id": "old-id", "title": "Receipt", "markdown": "Old receipt", "alignment": "right", "size": "double_width", "status": "submitted"}]},
        "bob": {"draft": {"markdown": "Private B"}, "history": []},
    }}
    Store.records["thermal_printer_notes"] = deepcopy(legacy)
    entry = SimpleNamespace(entry_id="legacy-entry", version=1,
                            data={"print_action": "esphome.office_print_markdown"}, options={})

    def update_entry(target, **changes):
        for name, value in changes.items():
            setattr(target, name, value)

    hass = SimpleNamespace(data={}, config_entries=SimpleNamespace(async_update_entry=update_entry))
    assert await integration.async_migrate_entry(hass, entry)
    assert entry.version == 2 and entry.data["legacy_storage"]
    assert entry.unique_id == "esp-A"
    await integration.async_setup_entry(hass, entry)
    assert const.printer_model(entry) == "EP-261C"
    assert const.preview_profile(entry)["dots"] == 384
    runtime = hass.data["thermal_printer_notes"]["entries"][entry.entry_id]
    assert (await runtime["store"].async_get_draft("alice"))["size"] == "double_width"
    assert (await runtime["store"].async_get_history("alice", "old-id"))["markdown"] == "Old receipt"
    assert await runtime["store"].async_get_history("bob", "old-id") is None
    assert Store.records["thermal_printer_notes"] == legacy, "upgrade must not rewrite existing private data"
    await integration.async_unload_entry(hass, entry)
    await integration.async_setup_entry(hass, entry)
    store = hass.data["thermal_printer_notes"]["entries"][entry.entry_id]["store"]
    assert (await store.async_get_draft("alice"))["markdown"] == "Private A"

    modern = SimpleNamespace(entry_id="existing-v05", version=2,
                             data={"source_device_id": "esp-B"}, options={})
    Store.records["thermal_printer_notes.existing-v05"] = deepcopy(legacy)
    assert await integration.async_migrate_entry(hass, modern)
    await integration.async_setup_entry(hass, modern)
    modern_store = hass.data["thermal_printer_notes"]["entries"][modern.entry_id]["store"]
    modern.options["printer_model"] = "EP-382C"
    assert const.entry_settings(modern)["printer_model"] == "EP-382C"
    assert const.preview_profile(modern)["dots"] == 576
    assert const.preview_profile(modern)["normal_columns"] == 48
    assert const.preview_profile(modern)["small_columns"] == 64
    assert const.preview_profile(entry)["dots"] == 384
    modern.options.clear()
    modern.data["printer_model"] = "EP-382C"
    assert const.printer_model(modern) == "EP-382C", "model falls back to entry data"
    modern.options["printer_model"] = "EP-261C"
    assert const.printer_model(modern) == "EP-261C", "options override original setup"
    await modern_store.async_save_draft("alice", {"markdown": "Updated B"})
    assert (await store.async_get_draft("alice"))["markdown"] == "Private A"
    assert (await modern_store.async_get_draft("bob"))["markdown"] == "Private B"
    assert Store.records["thermal_printer_notes.existing-v05"]["users"]["alice"]["history"] == legacy["users"]["alice"]["history"]
    print("Legacy and v0.5 storage/reload compatibility checks passed")


if __name__ == "__main__":
    asyncio.run(run())
