"""ESPHome external component for the Cashino EP-261C and EP-382C printers."""

from __future__ import annotations

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import uart
from esphome.const import CONF_ID

CODEOWNERS = ["@anaegeli"]
DEPENDENCIES = ["uart"]

thermal_printer_ns = cg.esphome_ns.namespace("thermal_printer")
ThermalPrinterComponent = thermal_printer_ns.class_(
    "ThermalPrinterComponent", cg.Component, uart.UARTDevice
)

CONFIG_SCHEMA = (
    cv.Schema({
        cv.GenerateID(): cv.declare_id(ThermalPrinterComponent),
        cv.Optional("model", default="EP-261C"): cv.one_of("EP-261C", "EP-382C", upper=True),
    })
    .extend(cv.COMPONENT_SCHEMA)
    .extend(uart.UART_DEVICE_SCHEMA)
)


async def to_code(config):
    """Register the printer component and its UART parent."""
    var = cg.new_Pvariable(config[CONF_ID])
    cg.add(var.set_ep_382c(config["model"] == "EP-382C"))
    await cg.register_component(var, config)
    await uart.register_uart_device(var, config)
