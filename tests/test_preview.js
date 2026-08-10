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

card._draft = {
  title: "Hey DU!!!",
  markdown: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
  alignment: "left",
  size: "normal",
};
const drawnText = [];
const fakeContext = {
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  fillText: (value) => { drawnText.push(value); },
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

card._draft = {
  title: "",
  markdown: "Wort ".repeat(3200),
  alignment: "left",
  size: "double_size",
};
const chunks = card._previewChunks();
assert.ok(chunks.length > 1, "long double-size previews are split into canvases");
assert.ok(chunks.every((chunk) => chunk.height <= 8000), "canvas chunks stay below browser limits");

const yamlSource = fs.readFileSync("esphome/thermal-printer.yaml", "utf8");
const driverSource = fs.readFileSync("esphome/thermal_printer.h", "utf8");
assert.match(yamlSource, /size == "small" \? 3/, "ESPHome maps small to driver mode 3");
assert.match(driverSource, /options\.size == 3 \? 1 : 0/, "driver mode 3 selects Font B");
assert.match(driverSource, /options\.size == 3\) return TP_SMALL_COLUMNS/, "driver mode 3 wraps at 42 columns");

console.log("EP-261C preview model checks passed");
