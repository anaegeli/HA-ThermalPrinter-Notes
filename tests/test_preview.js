const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const filename = "custom_components/thermal_printer_notes/frontend/thermal-printer-notes-card.js";
const translationsFilename = "custom_components/thermal_printer_notes/frontend/translations.js";
const translationsSource = fs.readFileSync(translationsFilename, "utf8").replaceAll("export ", "");
const cardSource = fs.readFileSync(filename, "utf8").replace(
  'import { detectLanguage, translate } from "./translations.js";',
  ""
);
const source = `${translationsSource}\n${cardSource}`;
const sandbox = {
  TextEncoder,
  Intl,
  Date,
  console,
  clearTimeout,
  setTimeout,
  confirm: () => false,
  customElements: {
    get: () => undefined,
    define: (_name, constructor) => { sandbox.Card = constructor; },
  },
};
sandbox.window = {
  LitElement: class { requestUpdate() {} },
  html: (strings, ...values) => ({ strings, values }),
  css: (strings, ...values) => ({ strings, values }),
  customCards: [],
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename });

assert.equal(
  vm.runInContext(
    "Object.keys(TRANSLATIONS.de).sort().join('|') === Object.keys(TRANSLATIONS.en).sort().join('|')",
    sandbox
  ),
  true,
  "German and English catalogs expose the same keys"
);
assert.equal(sandbox.translate("de", "size.small"), "Klein");
assert.equal(sandbox.translate("en", "size.small"), "Small");
assert.equal(sandbox.translate("de", "history.maximum", { count: 20 }), "Max. 20 Einträge");

const card = new sandbox.Card();
card._userName = "Adrian";
card._draft = {
  title: "Hey DU!!!",
  markdown: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since 1966.",
  alignment: "left",
  size: "normal",
};

const rows = card._previewRows();
const text = (row) => row.chars.map((char) => char.value).join("");

assert.equal(rows[0].columns, 42, "header uses printer Font B");
assert.match(text(rows[0]), /^Adrian\s+\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
assert.equal(text(rows[1]), "Hey DU!!!");
assert.equal(rows[1].columns, 16, "H1 wraps at 16 double-size columns");
assert.equal(rows[1].glyph, 48, "H1 uses a 48-dot glyph");
assert.equal(rows[1].line, 54, "H1 uses the driver's 54-dot line height");
for (const row of rows.slice(2)) {
  assert.ok(row.chars.length <= 32, "body line does not exceed 32 characters");
  assert.equal(row.cell, 12, "normal body uses 12-dot character cells");
  assert.equal(row.line, 30, "normal body uses the driver's 30-dot line height");
}

card._draft = {
  title: "",
  markdown: "Kleine Schrift mit deutlich mehr Zeichen pro Zeile als Font A.",
  alignment: "left",
  size: "small",
};
const smallRows = card._previewRows().slice(1);
assert.ok(smallRows.length > 0);
assert.ok(smallRows.every((row) => row.columns === 42), "small body uses 42 Font B columns");
assert.ok(smallRows.every((row) => row.cell === 9), "small body uses 9-dot cells");
assert.ok(smallRows.every((row) => row.glyph === 17), "small body uses 17-dot glyphs");
assert.ok(smallRows.every((row) => row.line === 23), "small body uses 23-dot lines");

const styled = card._printerChars("**fett** und *unterstrichen*");
assert.ok(styled.slice(0, 4).every((char) => char.bold));
assert.ok(styled.slice(-13).every((char) => char.underline));
assert.equal(card._printerChars("Emoji 😀").map((char) => char.value).join(""), "Emoji ?");
const mixedWidth = card._printerChars("Normal ==BREIT== Ende");
assert.equal(mixedWidth.map((char) => char.value).join(""), "Normal BREIT Ende");
assert.ok(mixedWidth.slice(7, 12).every((char) => char.wide), "paired == markers enable inline double width");
assert.ok(mixedWidth.slice(0, 7).every((char) => !char.wide), "normal text stays single width");
assert.equal(card._printerChars("1 == 2").map((char) => char.value).join(""), "1 == 2", "unpaired equality signs stay printable");
const combinedStyle = card._printerChars("**==BREIT==**");
assert.ok(combinedStyle.every((char) => char.bold && char.wide), "wide text combines with bold");
assert.equal(card._wideLine("Eine ganze Zeile"), "==Eine ganze Zeile==");
assert.equal(card._wideLine("- Listentext"), "- ==Listentext==", "line formatting preserves Markdown list prefixes");
assert.equal(card._wideLine("### Überschrift"), "### ==Überschrift==", "line formatting preserves heading prefixes");
assert.equal(card._wideLine("QR: https://example.org"), "QR: https://example.org", "line formatting leaves QR directives intact");
assert.equal(card._wideLine("==Bereits breit=="), "Bereits breit", "line formatting toggles an existing full-line marker");

const mixedWrap = card._wrapChars(card._printerChars(`${"N".repeat(28)} ==AB==`), 32, true);
assert.equal(mixedWrap.length, 2, "wide characters participate in line wrapping");
for (const row of mixedWrap) {
  const occupied = row.reduce((total, char) => total + card._charColumns(char, true), 0);
  assert.ok(occupied <= 32, "mixed-width rows never exceed 32 printer columns");
}
assert.equal(card._wrapChars(card._printerChars(`==${"W".repeat(16)}==`), 32, true).length, 1, "16 wide Font A characters fit exactly");
assert.equal(card._wrapChars(card._printerChars(`==${"W".repeat(17)}==`), 32, true).length, 2, "17 wide Font A characters wrap");
assert.equal(card._wrapChars(card._printerChars(`==${"W".repeat(21)}==`), 42, true).length, 1, "21 wide Font B characters fit exactly");
assert.equal(card._wrapChars(card._printerChars(`==${"W".repeat(22)}==`), 42, true).length, 2, "22 wide Font B characters wrap");

card._draft = {
  title: "Hey DU!!!",
  markdown: "Normal ==BREIT== Ende",
  alignment: "left",
  size: "normal",
};
const drawnText = [];
const canvasScales = [];
const fakeContext = {
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  fillText: (value) => { drawnText.push(value); },
  save: () => {},
  restore: () => {},
  translate: () => {},
  scale: (x, y) => { canvasScales.push([x, y]); },
};
const fakeCanvas = {
  width: 0,
  height: 0,
  getContext: () => fakeContext,
};
card.renderRoot = { querySelectorAll: () => [fakeCanvas] };
card._drawPreview();
assert.equal(fakeCanvas.width, 384, "canvas uses the 384-dot print width");
assert.ok(fakeCanvas.height > 80, "canvas height follows the rendered receipt");
assert.ok(drawnText.join("").includes("Adrian"), "canvas draws the print header");
assert.ok(drawnText.join("").includes("HeyDU!!!"), "canvas draws the title");
assert.ok(canvasScales.some(([x, y]) => x === 2 && y === 1), "preview stretches inline-wide glyphs horizontally");

card._draft = {
  title: "",
  markdown: "Wort ".repeat(3200),
  alignment: "left",
  size: "double_size",
};
const chunks = card._previewChunks();
assert.ok(chunks.length > 1, "long double-size previews are split into canvases");
assert.ok(chunks.every((chunk) => chunk.height <= 8000), "canvas chunks stay below browser limits");

const deviceTemplateSource = fs.readFileSync("esphome/thermal-printer.yaml", "utf8");
const boardPackageSource = fs.readFileSync("esphome/packages/olimex-esp32-poe-iso.yaml", "utf8");
const defaultsSource = fs.readFileSync("esphome/packages/defaults.yaml", "utf8");
const printerPackageSource = fs.readFileSync("esphome/packages/cashino-ep-261c.yaml", "utf8");
const componentSource = fs.readFileSync("esphome/components/thermal_printer/__init__.py", "utf8");
const driverSource = fs.readFileSync("esphome/components/thermal_printer/thermal_printer.h", "utf8");
assert.match(deviceTemplateSource, /github:\/\/anaegeli\/HA-ThermalPrinter-Notes\/esphome\/packages\/olimex-esp32-poe-iso\.yaml@main/, "device template loads the board package from main");
assert.match(deviceTemplateSource, /github:\/\/anaegeli\/HA-ThermalPrinter-Notes\/esphome\/packages\/cashino-ep-261c\.yaml@main/, "device template loads the printer package from main");
assert.match(deviceTemplateSource, /api_encryption_key: !secret esphome_api_encryption_key/, "API secret stays local in the device template");
assert.match(deviceTemplateSource, /printer_tx_pin: GPIO4/, "printer TX is an overridable substitution");
assert.match(deviceTemplateSource, /printer_rx_pin: GPIO5/, "printer RX is an overridable substitution");
assert.match(boardPackageSource, /key: \$\{api_encryption_key\}/, "board package consumes the API substitution");
assert.match(boardPackageSource, /password: \$\{ota_password\}/, "board package consumes the OTA substitution");
assert.match(defaultsSource, /network_type: ethernet/, "legacy imports default to Ethernet");
assert.match(printerPackageSource, /path: esphome\/components/, "printer package loads the external component path");
assert.match(printerPackageSource, /ref: \$\{thermal_printer_ref\}/, "external component follows the configured Git ref");
assert.match(printerPackageSource, /size == "small" \? 3/, "ESPHome maps small to driver mode 3");
assert.match(printerPackageSource, /id\(printer_driver\)->enqueue_markdown/, "print action uses the registered external component");
assert.match(componentSource, /uart\.register_uart_device/, "external component registers its UART parent");
assert.match(driverSource, /public Component, public uart::UARTDevice/, "driver is a native ESPHome component");
assert.match(driverSource, /void setup\(\) override \{ begin\(\); \}/, "ESPHome initializes the driver automatically");
assert.match(driverSource, /options\.size == 3 \? 1 : 0/, "driver mode 3 selects Font B");
assert.match(driverSource, /options\.size == 3\) return TP_SMALL_COLUMNS/, "driver mode 3 wraps at 42 columns");
assert.match(driverSource, /character\.wide && base_size == 0 \? 2 : 1/, "driver counts inline-wide characters as two columns");
assert.match(driverSource, /chars\[i\]\.wide && base_size == 0 \? 1 : base_size/, "driver toggles ESC/POS double width per marked run");
assert.match(driverSource, /if \(size == 1\) return 0x10/, "driver maps inline width to GS ! double-width");
assert.match(driverSource, /if \(size == 2\) return 0x11/, "driver maps double size to GS ! width and height");
assert.match(driverSource, /append_\(out, \{TP_GS, '!', character_size_\(style\.size\)\}\)/, "driver emits the EP-261C dedicated size command");
assert.doesNotMatch(cardSource, /<option value="double_width">\$\{this\._t\("size\.double_width"\)\}/, "new drafts do not offer global double width");

console.log("EP-261C preview model checks passed");
module.exports = sandbox.Card;
