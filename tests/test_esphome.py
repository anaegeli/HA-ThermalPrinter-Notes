"""Validate both network choices with real ESPHome and dummy local secrets."""
from pathlib import Path
import argparse
import shutil
import subprocess
import sys
import tempfile

from esphome.config import read_config
from esphome.core import CORE
from esphome.__main__ import write_cpp

ROOT = Path(__file__).resolve().parents[1]


def validate(network, wifi_secrets=True, legacy=False, static=False, build=False):
    with tempfile.TemporaryDirectory(prefix="thermal-printer-") as directory:
        work = Path(directory)
        shutil.copytree(ROOT / "esphome/packages", work / "packages")
        printer = work / "packages/cashino-ep-261c.yaml"
        source = printer.read_text(encoding="utf-8")
        start = source.index("external_components:")
        end = source.index("uart:", start)
        component = (ROOT / "esphome/components").as_posix()
        source = source[:start] + f"external_components:\n  - source:\n      type: local\n      path: {component}\n    components: [thermal_printer]\n\n" + source[end:]
        printer.write_text(source, encoding="utf-8")
        secrets = 'esphome_api_encryption_key: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="\nesphome_ota: "test-password"\n'
        if wifi_secrets:
            secrets += 'wifi_ssid: "Test-WLAN"\nwifi_password: "test-wifi-password"\n'
        (work / "secrets.yaml").write_text(secrets, encoding="utf-8")
        template = ROOT / ("tests/fixtures/v0.5.0-device.yaml" if legacy else "esphome/thermal-printer.yaml")
        source = template.read_text(encoding="utf-8")
        source = source.replace("network_type: ethernet", f"network_type: {network}")
        source = source.replace("printer_tx_pin: GPIO4", "printer_tx_pin: GPIO14").replace("printer_rx_pin: GPIO5", "printer_rx_pin: GPIO13")
        if legacy:
            source = source.replace(f"  network_type: {network}\n", "")
        if static:
            source = source.replace("substitutions:\n", 'substitutions:\n  ethernet_ip: 192.0.2.10\n  ethernet_gw: 192.0.2.1\n  ethernet_mask: 255.255.255.0\n')
        for name in ("olimex-esp32-poe-iso", "cashino-ep-261c"):
            source = source.replace(f"github://anaegeli/HA-ThermalPrinter-Notes/esphome/packages/{name}.yaml@main", f"!include packages/{name}.yaml")
        config_file = work / "device.yaml"
        config_file.write_text(source, encoding="utf-8")
        CORE.reset()
        CORE.config_path = config_file
        config = read_config({})
        assert config is not None, f"Invalid {network} config"
        CORE.config = config
        assert network in config
        assert ("wifi" if network == "ethernet" else "ethernet") not in config
        assert config["uart"][0]["tx_pin"]["number"] == 14
        assert config["uart"][0]["rx_pin"]["number"] == 13
        assert "thermal_printer" in config
        if static:
            assert str(config["ethernet"]["manual_ip"]["static_ip"]) == "192.0.2.10"
        else:
            assert "manual_ip" not in config[network]
        assert write_cpp(config) == 0, f"Code generation failed for {network}"
        if build:
            subprocess.run([sys.executable, "-m", "esphome", "compile", str(config_file)], check=True)
        print(f"Validated {network}; legacy={legacy}; wifi secrets={wifi_secrets}; static={static}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--compile", action="store_true", help="Also build both network firmwares; never upload")
    args = parser.parse_args()
    validate("ethernet", wifi_secrets=False, build=args.compile)
    validate("wifi", build=args.compile)
    validate("ethernet", wifi_secrets=False, legacy=True)
    validate("ethernet", wifi_secrets=False, legacy=True, static=True)
