const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const filename = "custom_components/thermal_printer_notes/frontend/thermal-printer-notes-card.js";
const source = fs.readFileSync(filename, "utf8");
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

const styled = card._printerChars("**fett** und *unterstrichen*");
assert.ok(styled.slice(0, 4).every((char) => char.bold));
assert.ok(styled.slice(-13).every((char) => char.underline));
assert.equal(card._printerChars("Emoji 😀").map((char) => char.value).join(""), "Emoji ?");

console.log("EP-261C preview model checks passed");
