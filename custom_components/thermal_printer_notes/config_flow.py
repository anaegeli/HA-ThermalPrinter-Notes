"""Config flow for Thermal Printer Notes."""

from __future__ import annotations

from typing import Any

from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    BooleanSelector,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    TextSelector,
    TextSelectorConfig,
)
import voluptuous as vol

from .const import (
    CONF_COPIES,
    CONF_CUT,
    CONF_FEED_LINES,
    CONF_HISTORY_LIMIT,
    CONF_PRINT_ACTION,
    CONF_REVERSE_PRINT,
    DEFAULT_COPIES,
    DEFAULT_CUT,
    DEFAULT_FEED_LINES,
    DEFAULT_HISTORY_LIMIT,
    DEFAULT_PRINT_ACTION,
    DEFAULT_REVERSE_PRINT,
    DOMAIN,
    MAX_HISTORY_LIMIT,
    MIN_HISTORY_LIMIT,
    entry_settings,
)


def _schema(defaults: dict[str, Any]) -> vol.Schema:
    """Build the shared setup/options schema."""
    return vol.Schema(
        {
            vol.Required(
                CONF_PRINT_ACTION,
                default=defaults.get(CONF_PRINT_ACTION, DEFAULT_PRINT_ACTION),
            ): TextSelector(TextSelectorConfig(type="text")),
            vol.Required(
                CONF_HISTORY_LIMIT,
                default=defaults.get(CONF_HISTORY_LIMIT, DEFAULT_HISTORY_LIMIT),
            ): NumberSelector(
                NumberSelectorConfig(
                    min=MIN_HISTORY_LIMIT,
                    max=MAX_HISTORY_LIMIT,
                    step=1,
                    mode=NumberSelectorMode.BOX,
                )
            ),
            vol.Required(
                CONF_COPIES,
                default=defaults.get(CONF_COPIES, DEFAULT_COPIES),
            ): NumberSelector(
                NumberSelectorConfig(
                    min=1, max=5, step=1, mode=NumberSelectorMode.BOX
                )
            ),
            vol.Required(
                CONF_FEED_LINES,
                default=defaults.get(CONF_FEED_LINES, DEFAULT_FEED_LINES),
            ): NumberSelector(
                NumberSelectorConfig(
                    min=0, max=20, step=1, mode=NumberSelectorMode.BOX
                )
            ),
            vol.Required(
                CONF_REVERSE_PRINT,
                default=defaults.get(CONF_REVERSE_PRINT, DEFAULT_REVERSE_PRINT),
            ): BooleanSelector(),
            vol.Required(
                CONF_CUT,
                default=defaults.get(CONF_CUT, DEFAULT_CUT),
            ): BooleanSelector(),
        }
    )


def _normalize(user_input: dict[str, Any]) -> dict[str, Any]:
    """Normalize selector values before storing them."""
    return {
        CONF_PRINT_ACTION: str(user_input[CONF_PRINT_ACTION]).strip(),
        CONF_HISTORY_LIMIT: int(user_input[CONF_HISTORY_LIMIT]),
        CONF_COPIES: int(user_input[CONF_COPIES]),
        CONF_FEED_LINES: int(user_input[CONF_FEED_LINES]),
        CONF_REVERSE_PRINT: bool(user_input[CONF_REVERSE_PRINT]),
        CONF_CUT: bool(user_input[CONF_CUT]),
    }


def _valid_action(value: str) -> bool:
    """Validate a Home Assistant action in domain.name form."""
    if value.count(".") != 1:
        return False
    domain, service = value.split(".", 1)
    return bool(
        domain
        and service
        and domain.replace("_", "").isalnum()
        and service.replace("_", "").isalnum()
        and value == value.lower()
    )


class ThermalPrinterNotesConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the Thermal Printer Notes config flow."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Configure the single integration instance."""
        errors: dict[str, str] = {}
        if user_input is not None:
            data = _normalize(user_input)
            if not _valid_action(data[CONF_PRINT_ACTION]):
                errors[CONF_PRINT_ACTION] = "invalid_action"
            else:
                return self.async_create_entry(
                    title="Thermal Printer Notes",
                    data={CONF_PRINT_ACTION: data[CONF_PRINT_ACTION]},
                    options=data,
                )

        return self.async_show_form(
            step_id="user",
            data_schema=_schema(user_input or {}),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        """Create the options flow."""
        _ = config_entry
        return ThermalPrinterNotesOptionsFlow()


class ThermalPrinterNotesOptionsFlow(config_entries.OptionsFlowWithReload):
    """Edit central printer and history settings."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle options changes."""
        errors: dict[str, str] = {}
        if user_input is not None:
            data = _normalize(user_input)
            if not _valid_action(data[CONF_PRINT_ACTION]):
                errors[CONF_PRINT_ACTION] = "invalid_action"
            else:
                return self.async_create_entry(title="", data=data)

        return self.async_show_form(
            step_id="init",
            data_schema=_schema(user_input or entry_settings(self.config_entry)),
            errors=errors,
        )
