"""Compile the real driver with a recording UART; no printer is contacted."""
from pathlib import Path
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="thermal-driver-") as directory:
    work = Path(directory)
    files = {
        "esphome/core/component.h": '''#pragma once
namespace esphome {
namespace setup_priority { constexpr float DATA = 0; }
class Component { public: virtual void setup() {} virtual void loop() {}
virtual void dump_config() {} virtual float get_setup_priority() const { return 0; } };
}
''',
        "esphome/core/hal.h": '''#pragma once
#include <cstdint>
inline uint32_t test_clock = 10000;
inline uint32_t millis() { return test_clock; }
''',
        "esphome/core/log.h": '''#pragma once
#define ESP_LOGCONFIG(...) ((void)0)
#define ESP_LOGI(...) ((void)0)
#define ESP_LOGW(...) ((void)0)
''',
        "esphome/components/uart/uart.h": '''#pragma once
#include <vector>
#include <deque>
#include <cstdint>
#include <cstddef>
namespace esphome::uart {
class UARTComponent {};
class UARTDevice {
 public:
  UARTDevice() = default;
  explicit UARTDevice(UARTComponent *) {}
  std::vector<uint8_t> output;
  std::deque<uint8_t> input;
  void write_array(const uint8_t *bytes, size_t count) { output.insert(output.end(), bytes, bytes + count); }
  void write_byte(uint8_t value) { output.push_back(value); }
  size_t available() { return input.size(); }
  bool read_byte(uint8_t *value) { if (input.empty()) return false; *value = input.front(); input.pop_front(); return true; }
};
}
''',
    }
    for name, content in files.items():
        path = work / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    executable = work / ("test-driver.exe" if os.name == "nt" else "test-driver")
    subprocess.run([os.environ.get("CXX", "g++"), "-std=c++17", "-Wall", "-Wextra", "-Werror",
                    "-I", str(work), "-I", str(ROOT / "esphome/components/thermal_printer"),
                    str(ROOT / "tests/driver_test.cpp"), "-o", str(executable)], check=True)
    subprocess.run([str(executable)], check=True)
