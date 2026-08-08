"""Constants for Thermal Printer Notes."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "thermal_printer_notes"
NAME: Final = "Thermal Printer Notes"
VERSION: Final = "0.1.0"

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
MAX_MARKDOWN_LENGTH: Final = 4096
MAX_TITLE_LENGTH: Final = 80

ALIGNMENTS: Final = ("left", "center", "right")
SIZES: Final = ("normal", "double_width", "double_size")

STORAGE_KEY: Final = DOMAIN
STORAGE_VERSION: Final = 1

FRONTEND_URL: Final = f"/{DOMAIN}"
FRONTEND_FILE: Final = "thermal-printer-notes-card.js"


def entry_settings(entry) -> dict[str, object]:
    """Return normalized central settings for a config entry."""
    return {
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
