#include "thermal_printer.h"
#include <cassert>
#include <iostream>

std::string print(ThermalPrinterComponent &printer, const std::string &text, PrintOptions options = {}) {
  printer.output.clear();
  assert(printer.enqueue_markdown(text, options));
  while (printer.queue_depth()) { test_clock += 20; printer.loop(); }
  return {printer.output.begin(), printer.output.end()};
}

void status(ThermalPrinterComponent &printer, uint8_t general, uint8_t offline,
            uint8_t error, uint8_t paper) {
  test_clock += 6000;
  printer.loop();
  for (auto value : {general, offline, error, paper}) {
    printer.input.push_back(value);
    test_clock += 20;
    printer.loop();
  }
}

int main() {
  for (bool wide : {false, true}) {
    const size_t normal = wide ? 48 : 32;
    const size_t small = wide ? 64 : 42;
    ThermalPrinterComponent printer;
    printer.set_ep_382c(wide);
    printer.setup();
    assert(printer.columns() == normal && printer.small_columns() == small);
    for (uint8_t size : {0, 1, 2, 3}) {
      PrintOptions options;
      options.size = size;
      const size_t width = size == 3 ? small : size == 0 ? normal : normal / 2;
      auto bytes = print(printer, std::string(width + 1, 'A'), options);
      assert(bytes.find(std::string(width, 'A') + "\nA\n") != std::string::npos);
      assert(bytes.find(std::string(width + 1, 'A')) == std::string::npos);
    }
    for (const auto &prefix : {"# ", "## "}) {
      auto bytes = print(printer, std::string(prefix) + std::string(normal / 2 + 1, 'H'));
      assert(bytes.find(std::string(normal / 2, 'H') + "\nH\n") != std::string::npos);
    }
    assert(print(printer, "---").find(std::string(normal, '-') + "\n") != std::string::npos);
    assert(print(printer, "==" + std::string(normal / 2 + 1, 'W') + "==")
           .find(std::string(normal / 2, 'W')) != std::string::npos);
    PrintOptions options;
    options.header_left = "User";
    options.header_right = "Time";
    auto bytes = print(printer, "Body", options);
    assert(bytes.find("User" + std::string(small - 8, ' ') + "Time\n") != std::string::npos);
    assert(bytes.find(std::string("\x1b\x74\x10", 3)) != std::string::npos);
    assert(bytes.find(std::string("\x1d\x56\x00", 3)) != std::string::npos);
    options.cut = false;
    options.reverse_print = true;
    bytes = print(printer, "First\nLast", options);
    assert(bytes.find("Last") < bytes.find("First"));
    assert(bytes.find(std::string("\x1b\x7b\x01", 3)) != std::string::npos);
    assert(bytes.find(std::string("\x1d\x56\x00", 3)) == std::string::npos);
    bytes = print(printer, "QR: ABC");
    assert(bytes.find(std::string("\x1d(k\x06\x00\x31\x50\x30" "ABC", 11)) != std::string::npos);

    // Use a fresh driver for every status sequence so all four replies are correlated.
    ThermalPrinterComponent sensor;
    sensor.set_ep_382c(wide);
    sensor.setup();
    status(sensor, 0x92, 0x12, 0x12, 0x12);
    assert(sensor.ready());  // bit 7 is not a communication error
    assert(sensor.status_text() == (wide ? "Bereit (Ausdruck noch nicht entnommen)" : "Bereit"));
    status(sensor, 0x12, 0x32, 0x12, 0x12);
    assert(sensor.ready() == !wide);
    assert(sensor.status_text() == (wide ? "Fehler: Papier leer" : "Warnung: Papier fast leer"));
    if (wide) assert(!sensor.enqueue_markdown("Blocked", {}));
    status(sensor, 0x12, 0x12, 0x12, 0x72);
    assert(!sensor.ready());
    status(sensor, 0x12, 0x12, 0x12, 0x1e);
    assert(sensor.ready());
    test_clock += 16000;
    assert(!sensor.ready());
  }
  std::cout << "Both drivers: emitted bytes, layout, commands and status passed\n";
}
