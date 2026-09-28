"""ESPHome external component for the Cashino EP-261C and EP-382C printers."""

from __future__ import annotations

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome import pins
from esphome.components import uart
from esphome.const import CONF_ID

CODEOWNERS = ["@anaegeli"]
DEPENDENCIES = ["uart"]

thermal_printer_ns = cg.esphome_ns.namespace("thermal_printer")
ThermalPrinterComponent = thermal_printer_ns.class_(
    "ThermalPrinterComponent", cg.Component, uart.UARTDevice
)

CONF_DTR_ENABLED = "dtr_enabled"
CONF_DTR_PIN = "dtr_pin"
CONF_DTR_INVERTED = "dtr_inverted"
CONF_BAUD_RATE = "baud_rate"


def _validate_dtr(config):
    if config[CONF_DTR_ENABLED] and CONF_DTR_PIN not in config:
        raise cv.Invalid("dtr_pin is required when dtr_enabled is true")
    return config

CONFIG_SCHEMA = cv.All(
    cv.Schema({
        cv.GenerateID(): cv.declare_id(ThermalPrinterComponent),
        cv.Optional("model", default="EP-261C"): cv.one_of("EP-261C", "EP-382C", upper=True),
        cv.Optional(CONF_BAUD_RATE, default=9600): cv.positive_int,
        cv.Optional(CONF_DTR_ENABLED, default=False): cv.boolean,
        cv.Optional(CONF_DTR_PIN): pins.gpio_input_pin_schema,
        cv.Optional(CONF_DTR_INVERTED, default=False): cv.boolean,
    })
    .extend(cv.COMPONENT_SCHEMA)
    .extend(uart.UART_DEVICE_SCHEMA),
    _validate_dtr,
)


async def to_code(config):
    """Register the printer component and its UART parent."""
    var = cg.new_Pvariable(config[CONF_ID])
    cg.add(var.set_ep_382c(config["model"] == "EP-382C"))
    cg.add(var.set_tx_baud_rate(config[CONF_BAUD_RATE]))
    cg.add(var.set_dtr_enabled(config[CONF_DTR_ENABLED]))
    cg.add(var.set_dtr_inverted(config[CONF_DTR_INVERTED]))
    if CONF_DTR_PIN in config:
        pin = await cg.gpio_pin_expression(config[CONF_DTR_PIN])
        cg.add(var.set_dtr_pin(pin))
    await cg.register_component(var, config)
    await uart.register_uart_device(var, config)
