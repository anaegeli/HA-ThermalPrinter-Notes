const assert = require("node:assert/strict");
const Card = require("./test_preview.js");
const text = (row) => row.chars.map((c) => c.value).join("");
const card = new Card();
for (const [model, normal, small, dots] of [["EP-261C", 32, 42, 384], ["EP-382C", 48, 64, 576]]) {
  for (const size of ["normal", "small", "double_size", "double_width"]) {
    card._applyState({ preview_profile: { model }, user_name: "Adrian",
      draft: { markdown: "A".repeat(97), size } });
    const columns = size === "small" ? small : size === "normal" ? normal : normal / 2;
    const rows = card._previewRows();
    assert.equal(rows[0].columns, small);
    assert.equal(rows[0].chars.length, small);
    assert.equal(rows[1].chars.length, columns);
    assert.equal(rows.slice(1).map(text).join(""), "A".repeat(97));
    assert.ok(rows.slice(1).every(r => r.columns === columns));
  }
  card._draft = { title: "", markdown: "# " + "H".repeat(49) + "\n---\n==" + "W".repeat(49) + "==", size: "normal", alignment: "left" };
  const rows = card._previewRows();
  assert.equal(rows[1].chars.length, normal / 2);
  assert.ok(rows.some(r => text(r) === "-".repeat(normal)));
  assert.ok(rows.every(r => r.chars.reduce((n,c) => n + r.cell * card._charColumns(c, r.allowInlineWide),0) <= dots));
  const positions = [];
  const context = {clearRect(){}, fillText(c,x){positions.push([c,x]);}, strokeRect(x){positions.push(["box",x]);}};
  const canvas = {width: 0, height: 0, getContext: () => context};
  card.renderRoot = {querySelectorAll: () => [canvas]};
  card._draft = { title: "", markdown: "X\nQR: example", size: "normal", alignment: "right" };
  card._drawPreview();
  assert.equal(canvas.width, dots);
  assert.ok(positions.some(([c,x]) => c === "X" && x === dots - 12));
  assert.ok(positions.some(([c,x]) => c === "QR" && x === dots / 2));
  assert.ok(positions.some(([c,x]) => c === "box" && x === (dots - 160) / 2));
}
card._applyState({});
assert.equal(card._profile().dots, 384, "older backend responses retain 58 mm compatibility");
console.log("Both printer models: wrapping, headings, rules, alignment, QR and canvas passed");
