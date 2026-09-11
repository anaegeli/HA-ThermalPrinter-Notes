"""Constants for Thermal Printer Notes."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "thermal_printer_notes"
NAME: Final = "Thermal Printer Notes"
VERSION: Final = "0.8.0"

CONF_SOURCE_DEVICE_ID: Final = "source_device_id"
CONF_PRINTER_MODEL: Final = "printer_model"
DEFAULT_PRINTER_MODEL: Final = "EP-261C"
PRINTER_MODELS: Final = ("EP-261C", "EP-382C")

CONF_PRINT_ACTION: Final = "print_action"
CONF_HISTORY_LIMIT: Final = "history_limit"
CONF_COPIES: Final = "copies"
CONF_FEED_LINES: Final = "feed_lines"
CONF_REVERSE_PRINT: Final = "reverse_print"
CONF_CUT: Final = "cut"

DEFAULT_PRINT_ACTION: Final = "esphome.thermal_printer_print_markdown"
DEFAULT_HISTORY_LIMIT: Final = 20
DEFAULT_COPIES: Final = 1
DEFAULT_FEED_LINES: Final = 4
DEFAULT_REVERSE_PRINT: Final = False
DEFAULT_CUT: Final = True

MIN_HISTORY_LIMIT: Final = 1
MAX_HISTORY_LIMIT: Final = 200
MAX_MARKDOWN_LENGTH: Final = 16384
MAX_TITLE_LENGTH: Final = 80

ALIGNMENTS: Final = ("left", "center", "right")
SIZES: Final = ("small", "normal", "double_width", "double_size")

STORAGE_KEY: Final = DOMAIN
STORAGE_VERSION: Final = 1

FRONTEND_URL: Final = f"/{DOMAIN}"
FRONTEND_FILE: Final = "thermal-printer-notes-card.js"


def source_device_id(entry) -> str:
    """Return the selected ESPHome device ID for a config entry."""
    value = entry.options.get(
        CONF_SOURCE_DEVICE_ID,
        entry.data.get(CONF_SOURCE_DEVICE_ID, ""),
    )
    return str(value or "")


def printer_model(entry) -> str:
    """Keep existing entries on the 58 mm profile without rewriting storage."""
    model = entry.options.get(CONF_PRINTER_MODEL, entry.data.get(CONF_PRINTER_MODEL))
    return model if model in PRINTER_MODELS else DEFAULT_PRINTER_MODEL


def preview_profile(entry) -> dict[str, object]:
    """Geometry from the Cashino manuals; paper width differs from print width."""
    model = printer_model(entry)
    wide = model == "EP-382C"
    return {
        "model": model,
        "paper_width_mm": 80 if wide else 58,
        "dots": 576 if wide else 384,
        "normal_columns": 48 if wide else 32,
        "small_columns": 64 if wide else 42,
        "normal_glyph_height": 24,
        "small_glyph_height": 17,
        "normal_line_height": 30,
        "small_line_height": 23,
        "double_line_height": 54,
    }


def entry_settings(entry) -> dict[str, object]:
    """Return normalized central settings for a config entry."""
    return {
        CONF_PRINTER_MODEL: printer_model(entry),
        CONF_PRINT_ACTION: entry.options.get(
            CONF_PRINT_ACTION,
            entry.data.get(CONF_PRINT_ACTION, DEFAULT_PRINT_ACTION),
        ),
        CONF_HISTORY_LIMIT: int(
            entry.options.get(CONF_HISTORY_LIMIT, DEFAULT_HISTORY_LIMIT)
        ),
        CONF_COPIES: int(entry.options.get(CONF_COPIES, DEFAULT_COPIES)),
        CONF_FEED_LINES: int(
            entry.options.get(CONF_FEED_LINES, DEFAULT_FEED_LINES)
        ),
        CONF_REVERSE_PRINT: bool(
            entry.options.get(CONF_REVERSE_PRINT, DEFAULT_REVERSE_PRINT)
        ),
        CONF_CUT: bool(entry.options.get(CONF_CUT, DEFAULT_CUT)),
    }
