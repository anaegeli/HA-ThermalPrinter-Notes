"""Exercise the shared template with real ESPHome and dummy secrets only."""
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


def local_template(source):
    """Replace only remote fetches; keep substitutions and selection intact."""
    start = source.index("packages:\n")
    end = source.index("dashboard_import:", start)
    return source[:start] + """packages:
  board: !include packages/olimex-esp32-poe-iso.yaml
  printer: !include packages/cashino-${printer_model}.yaml

""" + source[end:]


def validate(network="ethernet", model="EP-261C", static=False, build=False,
             legacy=False, features=False, invalid=None):
    with tempfile.TemporaryDirectory(prefix="thermal-printer-") as directory:
        work = Path(directory)
        shutil.copytree(ROOT / "esphome/packages", work / "packages")
        printer = work / "packages/cashino-common.yaml"
        source = printer.read_text(encoding="utf-8")
        start, end = source.index("external_components:"), source.index("uart:")
        component = (ROOT / "esphome/components").as_posix()
        source = source[:start] + f"external_components:\n  - source:\n      type: local\n      path: {component}\n    components: [thermal_printer]\n\n" + source[end:]
        printer.write_text(source, encoding="utf-8")
        secrets = 'esphome_api_encryption_key: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="\nesphome_ota: "test-password"\n'
        if network == "wifi":
            secrets += 'wifi_ssid: "Test-WLAN"\nwifi_password: "test-wifi-password"\n'
        if features:
            secrets += 'wifi_hotspot_password: "test-hotspot-password"\n'
        (work / "secrets.yaml").write_text(secrets, encoding="utf-8")
        if legacy:
            source = (ROOT / "tests/fixtures/v0.5.0-device.yaml").read_text(encoding="utf-8")
            for name in ("olimex-esp32-poe-iso", "cashino-ep-261c"):
                source = source.replace(f"github://anaegeli/HA-ThermalPrinter-Notes/esphome/packages/{name}.yaml@main", f"!include packages/{name}.yaml")
            if static:
                source = source.replace("substitutions:\n", 'substitutions:\n  ethernet_ip: 192.0.2.10\n  ethernet_gw: 192.0.2.1\n  ethernet_mask: 255.255.255.0\n')
        else:
            source = local_template((ROOT / "esphome/thermal-printer.yaml").read_text(encoding="utf-8"))
            source = source.replace("network_type: ethernet", f"network_type: {network}")
            source = source.replace("printer_model: ep-261c", f"printer_model: {model.lower()}")
            if static:
                source = source.replace("ip_mode: dhcp", "ip_mode: static").replace('static_ip: ""', 'static_ip: "192.0.2.10"').replace('gateway: ""', 'gateway: "192.0.2.1"').replace('dns1: "0.0.0.0"', 'dns1: "192.0.2.53"')
            if features:
                source = source.replace('wifi_ap_enabled: "false"', 'wifi_ap_enabled: "true"').replace('wifi_ap_password: ""', 'wifi_ap_password: !secret wifi_hotspot_password').replace('web_server_enabled: "false"', 'web_server_enabled: "true"').replace('network_use_address: ""', 'network_use_address: "192.0.2.99"')
        source = source.replace("printer_tx_pin: GPIO4", "printer_tx_pin: GPIO14").replace("printer_rx_pin: GPIO5", "printer_rx_pin: GPIO13")
        if invalid:
            source = source.replace(*invalid)
        config_file = work / "device.yaml"
        config_file.write_text(source, encoding="utf-8")
        CORE.reset()
        CORE.config_path = config_file
        config = read_config({})
        if invalid:
            assert config is None, f"Invalid option accepted: {invalid}"
            print(f"Rejected invalid setting: {invalid[1]}")
            return
        assert config is not None, f"Invalid {model}/{network}/{static} config"
        CORE.config = config
        assert network in config and ("wifi" if network == "ethernet" else "ethernet") not in config
        assert config["uart"][0]["tx_pin"]["number"] == 14
        assert config["uart"][0]["rx_pin"]["number"] == 13
        assert config["thermal_printer"]["model"] == model
        assert not config["esphome"].get("includes"), "local header must not be required"
        if static:
            assert str(config[network]["manual_ip"]["static_ip"]) == "192.0.2.10"
            assert str(config[network]["manual_ip"]["gateway"]) == "192.0.2.1"
            if not legacy:
                assert str(config[network]["manual_ip"]["dns1"]) == "192.0.2.53"
        else:
            assert "manual_ip" not in config[network]
        assert ("web_server" in config) == features
        assert ("captive_portal" in config) == (features and network == "wifi")
        if features:
            assert config[network]["use_address"] == "192.0.2.99"
            assert config["web_server"]["version"] == 3
            assert config["web_server"]["local"] is True
            assert config["web_server"]["include_internal"] is True
            if network == "wifi":
                assert config["wifi"]["ap"]["ssid"] == "thermal-printer_FH"
                assert config["wifi"]["ap"]["password"] == "test-hotspot-password"
        elif network == "wifi":
            assert "ap" not in config["wifi"]
        assert write_cpp(config) == 0
        generated = Path(CORE.relative_src_path("main.cpp")).read_text(encoding="utf-8")
        assert f"set_ep_382c({'true' if model == 'EP-382C' else 'false'})" in generated
        if build:
            subprocess.run([sys.executable, "-m", "esphome", "compile", str(config_file)], check=True)
        print(f"Validated {model}/{network}/{'static' if static else 'dhcp'}; legacy={legacy}; features={features}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--compile", action="store_true")
    parser.add_argument("--model", choices=["EP-261C", "EP-382C"])
    parser.add_argument("--network", choices=["ethernet", "wifi"])
    parser.add_argument("--ip-mode", choices=["dhcp", "static"])
    args = parser.parse_args()
    for model in [args.model] if args.model else ["EP-261C", "EP-382C"]:
        for network in [args.network] if args.network else ["ethernet", "wifi"]:
            for mode in [args.ip_mode] if args.ip_mode else ["dhcp", "static"]:
                validate(network, model, static=mode == "static", features=network == "wifi", build=args.compile)
    if not args.compile:
        validate("wifi")  # no hotspot secret required while AP is disabled
        validate("ethernet", features=True)  # web server works independently of Wi-Fi
        validate(legacy=True)
        validate(legacy=True, static=True)
        validate(invalid=("ip_mode: dhcp", "ip_mode: typo"))
        validate(invalid=("ip_mode: dhcp", "ip_mode: static"))
        validate(invalid=("network_type: ethernet", "network_type: typo"))
        validate(invalid=("printer_model: ep-261c", "printer_model: typo"))
        validate("wifi", invalid=('wifi_ap_enabled: "false"', 'wifi_ap_enabled: "true"'))
        validate("wifi", invalid=('wifi_ap_enabled: "false"', 'wifi_ap_enabled: "typo"'))
        validate(invalid=('web_server_enabled: "false"', 'web_server_enabled: "typo"'))
