const assert = require("node:assert/strict");
const Card = require("./test_preview.js");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const state = (id) => ({ printer: { device_id: id, name: id }, draft: { markdown: `draft-${id}` },
  preview_profile: { model: id === "B" ? "EP-382C" : "EP-261C" },
  history: [{ id: `history-${id}` }], settings: { copies: id === "A" ? 1 : 2 } });
const printers = [{ device_id: "A", name: "Office" }, { device_id: "B", name: "Kitchen" }];
function cardWith(send, configured = "A") {
  const card = new Card();
  card.setConfig({ device_id: configured });
  card._hass = { connection: { sendMessagePromise: send } };
  return card;
}
async function run() {
  const calls = [];
  let failSave = false;
  const card = cardWith(async (msg) => {
    calls.push(msg);
    if (msg.type.endsWith("list_printers")) {
      assert.equal(msg.device_id, undefined, "list schema does not accept a device ID");
      return { printers };
    }
    if (msg.type.endsWith("save_draft")) {
      if (failSave) throw new Error("Offline");
      return { draft: { updated_at: "now" } };
    }
    return state(msg.device_id);
  });
  await card._loadState();
  assert.equal(card._draft.markdown, "draft-A");
  card._draft.markdown = "unsaved-A";
  await card._selectPrinter({ target: { value: "B" } });
  assert.ok(calls.some((msg) => msg.type.endsWith("save_draft") && msg.device_id === "A" && msg.markdown === "unsaved-A"));
  assert.equal(card._selectedDeviceId, "B");
  assert.equal(card._draft.markdown, "draft-B");
  assert.equal(card._history[0].id, "history-B");
  assert.equal(card._settings.copies, 2);
  assert.equal(card._profile().dots, 576, "switching to the 80 mm printer changes preview geometry");
  assert.equal(card._config.device_id, "A", "runtime choice does not rewrite dashboard default");
  await card._print();
  assert.ok(calls.some((msg) => msg.type === "thermal_printer_notes/print" && msg.device_id === "B"));

  failSave = true;
  card._draft.markdown = "keep this";
  await card._selectPrinter({ target: { value: "A" } });
  assert.equal(card._selectedDeviceId, "B", "failed save prevents switching");
  assert.equal(card._draft.markdown, "keep this");

  const slow = deferred();
  const stale = cardWith((msg) => msg.type.endsWith("list_printers")
    ? Promise.resolve({ printers }) : msg.device_id === "A" ? slow.promise : Promise.resolve(state("B")));
  const firstLoad = stale._loadState();
  await Promise.resolve(); await Promise.resolve();
  stale.setConfig({ device_id: "B" });
  await stale._loadState();
  slow.resolve(state("A"));
  await firstLoad;
  assert.equal(stale._draft.markdown, "draft-B", "late response cannot replace new printer's draft");
  assert.equal(stale._profile().dots, 576, "late 58 mm state cannot replace the 80 mm geometry");

  const blocked = deferred();
  const queuedCalls = [];
  const queued = cardWith(async (msg) => { queuedCalls.push(msg); return { draft: {} }; });
  queued._savePromise = blocked.promise;
  queued._draft.markdown = "original";
  const saving = queued._saveDraft(false);
  queued._draft.markdown = "newer";
  blocked.resolve();
  await saving;
  assert.equal(queuedCalls[0].markdown, "original", "queued save captures document when scheduled");
  assert.equal(queuedCalls[0].device_id, "A");

  const auto = cardWith(async (msg) => msg.type.endsWith("list_printers") ? { printers } : state(msg.device_id), "");
  await auto._loadState();
  assert.equal(auto._selectedDeviceId, "A", "optional default selects first printer");
  console.log("Printer selection and asynchronous isolation checks passed");
}
run().catch((err) => { console.error(err); process.exitCode = 1; });
