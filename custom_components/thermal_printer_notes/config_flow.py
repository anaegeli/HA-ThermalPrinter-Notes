"""Config flow for Thermal Printer Notes."""

from __future__ import annotations

from typing import Any

from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlowResult
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    BooleanSelector,
    DeviceFilterSelectorConfig,
    DeviceSelector,
    DeviceSelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
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
    CONF_PRINTER_MODEL,
    CONF_REVERSE_PRINT,
    CONF_SOURCE_DEVICE_ID,
    DEFAULT_COPIES,
    DEFAULT_CUT,
    DEFAULT_FEED_LINES,
    DEFAULT_HISTORY_LIMIT,
    DEFAULT_PRINT_ACTION,
    DEFAULT_PRINTER_MODEL,
    DEFAULT_REVERSE_PRINT,
    DOMAIN,
    MAX_HISTORY_LIMIT,
    MIN_HISTORY_LIMIT,
    PRINTER_MODELS,
    entry_settings,
    source_device_id,
)
from .devices import source_device_name, suggested_print_action


def _schema(defaults: dict[str, Any]) -> vol.Schema:
    """Build the shared setup/options schema."""
    device_key = (
        vol.Required(
            CONF_SOURCE_DEVICE_ID,
            default=defaults[CONF_SOURCE_DEVICE_ID],
        )
        if defaults.get(CONF_SOURCE_DEVICE_ID)
        else vol.Required(CONF_SOURCE_DEVICE_ID)
    )
    return vol.Schema(
        {
            device_key: DeviceSelector(
                DeviceSelectorConfig(
                    filter=DeviceFilterSelectorConfig(integration="esphome")
                )
            ),
            vol.Required(
                CONF_PRINTER_MODEL,
                default=defaults.get(CONF_PRINTER_MODEL, DEFAULT_PRINTER_MODEL),
            ): SelectSelector(SelectSelectorConfig(options=list(PRINTER_MODELS))),
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
        CONF_SOURCE_DEVICE_ID: str(user_input[CONF_SOURCE_DEVICE_ID]),
        CONF_PRINTER_MODEL: vol.In(PRINTER_MODELS)(
            user_input.get(CONF_PRINTER_MODEL, DEFAULT_PRINTER_MODEL)
        ),
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
    """Handle one config entry per physical printer."""

    VERSION = 2

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Configure a printer profile."""
        errors: dict[str, str] = {}
        defaults = dict(user_input or {})
        if user_input is not None:
            data = _normalize(user_input)
            automatic_action = suggested_print_action(
                self.hass, data[CONF_SOURCE_DEVICE_ID]
            )
            if automatic_action and data[CONF_PRINT_ACTION] in (
                "",
                DEFAULT_PRINT_ACTION,
            ):
                data[CONF_PRINT_ACTION] = automatic_action
            await self.async_set_unique_id(data[CONF_SOURCE_DEVICE_ID])
            self._abort_if_unique_id_configured()
            if not _valid_action(data[CONF_PRINT_ACTION]):
                errors[CONF_PRINT_ACTION] = "invalid_action"
            else:
                return self.async_create_entry(
                    title=source_device_name(
                        self.hass, data[CONF_SOURCE_DEVICE_ID]
                    ),
                    data=data,
                    options=data,
                )

        if defaults.get(CONF_SOURCE_DEVICE_ID) and not defaults.get(
            CONF_PRINT_ACTION
        ):
            defaults[CONF_PRINT_ACTION] = suggested_print_action(
                self.hass, str(defaults[CONF_SOURCE_DEVICE_ID])
            ) or DEFAULT_PRINT_ACTION
        return self.async_show_form(
            step_id="user",
            data_schema=_schema(defaults),
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
            automatic_action = suggested_print_action(
                self.hass, data[CONF_SOURCE_DEVICE_ID]
            )
            if automatic_action and data[CONF_PRINT_ACTION] in (
                "",
                DEFAULT_PRINT_ACTION,
            ):
                data[CONF_PRINT_ACTION] = automatic_action
            duplicate = any(
                existing.entry_id != self.config_entry.entry_id
                and source_device_id(existing) == data[CONF_SOURCE_DEVICE_ID]
                for existing in self.hass.config_entries.async_entries(DOMAIN)
            )
            if duplicate:
                errors[CONF_SOURCE_DEVICE_ID] = "already_configured"
            elif not _valid_action(data[CONF_PRINT_ACTION]):
                errors[CONF_PRINT_ACTION] = "invalid_action"
            else:
                self.hass.config_entries.async_update_entry(
                    self.config_entry,
                    unique_id=data[CONF_SOURCE_DEVICE_ID],
                    title=source_device_name(
                        self.hass, data[CONF_SOURCE_DEVICE_ID]
                    ),
                )
                return self.async_create_entry(title="", data=data)

        defaults = {
            **entry_settings(self.config_entry),
            CONF_SOURCE_DEVICE_ID: source_device_id(self.config_entry),
        }
        return self.async_show_form(
            step_id="init",
            data_schema=_schema(user_input or defaults),
            errors=errors,
        )
