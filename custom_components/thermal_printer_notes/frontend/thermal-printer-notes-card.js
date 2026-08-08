/* Thermal Printer Notes card - no build step required. */

const panel = customElements.get("ha-panel-lovelace");
const fallback = customElements.get("hui-masonry-view") || customElements.get("hui-view");
const LitElement = window.LitElement || Object.getPrototypeOf(panel || fallback);
const html = window.html || LitElement.prototype.html;
const css = window.css || LitElement.prototype.css;

class ThermalPrinterNotesCard extends LitElement {
  static get properties() {
    return {
      _hass: { attribute: false },
      _config: { attribute: false },
      _loaded: { type: Boolean },
      _busy: { type: Boolean },
      _saving: { type: Boolean },
      _message: { type: String },
      _messageType: { type: String },
      _userName: { type: String },
      _printer: { attribute: false },
      _draft: { attribute: false },
      _history: { attribute: false },
      _settings: { attribute: false },
      _historyOpen: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      :host { display: block; }
      ha-card { overflow: hidden; }
      .content { padding: 14px; }
      .head, .history-head, .print-row, .history-meta, .history-tools {
        align-items: center; display: flex; justify-content: space-between; gap: 10px;
      }
      .head { margin-bottom: 10px; }
      .title { font-size: 20px; font-weight: 500; }
      .user, .muted, .save-state, .history-date, .history-options, .count {
        color: var(--secondary-text-color); font-size: 11px;
      }
      .user { align-items: center; display: flex; gap: 5px; white-space: nowrap; }
      .status-grid {
        display: grid; grid-template-columns: repeat(3, minmax(0, 145px)); gap: 5px;
        margin-bottom: 12px;
      }
      .status-chip {
        align-items: center; background: var(--secondary-background-color); border-radius: 6px;
        display: flex; gap: 6px; justify-content: space-between; min-width: 0; padding: 4px 7px;
      }
      .status-label { color: var(--secondary-text-color); font-size: 9px; }
      .status-value { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .workspace { align-items: start; display: grid; gap: 16px; }
      .workspace[data-columns="1"] {
        grid-template-areas: "editor" "preview" "history"; grid-template-columns: minmax(0, 1fr);
      }
      .workspace[data-columns="2"] {
        grid-template-areas: "editor preview" "editor history";
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .workspace[data-columns="3"] {
        grid-template-areas: "editor preview history";
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .editor { grid-area: editor; min-width: 0; }
      .preview { grid-area: preview; min-width: 0; }
      .history-panel { grid-area: history; min-width: 0; }
      .field { margin-bottom: 11px; }
      label { color: var(--secondary-text-color); display: block; font-size: 11px; margin: 0 0 4px 2px; }
      input, textarea, select {
        background: var(--card-background-color); border: 1px solid var(--divider-color);
        border-radius: 8px; box-sizing: border-box; color: var(--primary-text-color);
        font: inherit; padding: 9px 10px; width: 100%;
      }
      input:focus, textarea:focus, select:focus {
        border-color: var(--primary-color); outline: 2px solid color-mix(in srgb, var(--primary-color) 25%, transparent);
      }
      textarea { min-height: 245px; resize: vertical; tab-size: 2; white-space: pre-wrap; }
      .markdown-tools {
        align-items: center; background: var(--secondary-background-color); border-radius: 8px;
        display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 5px; padding: 4px;
      }
      button {
        align-items: center; background: var(--secondary-background-color); border: 0; border-radius: 8px;
        color: var(--primary-text-color); cursor: pointer; display: inline-flex; font: inherit;
        gap: 5px; justify-content: center; min-height: 36px; padding: 7px 10px;
      }
      button:hover { filter: brightness(0.96); }
      button:disabled { cursor: default; opacity: 0.5; }
      button.primary { background: var(--primary-color); color: var(--text-primary-color); font-weight: 500; }
      button.danger { color: var(--error-color); }
      button.icon-only { min-width: 34px; padding: 5px; }
      .markdown-tools button { background: transparent; border-radius: 5px; min-height: 30px; min-width: 30px; padding: 4px 6px; }
      .markdown-tools .divider { border-left: 1px solid var(--divider-color); height: 22px; margin: 0 2px; }
      .count { margin-top: 3px; text-align: right; }
      .count.invalid { color: var(--error-color); font-weight: 600; }
      .editor-controls {
        align-items: end; display: grid; gap: 6px; grid-template-columns: repeat(5, minmax(0, 1fr));
      }
      .editor-controls button { font-size: 11px; line-height: 1.2; padding: 6px; width: 100%; }
      .compact-field { margin: 0; min-width: 0; }
      .compact-field select { font-size: 11px; min-height: 36px; padding: 6px; }
      .print-row { margin-top: 12px; }
      .message { border-radius: 7px; margin: 9px 0; padding: 8px 10px; }
      .message.success { background: color-mix(in srgb, var(--success-color, #2e7d32) 12%, transparent); color: var(--success-color, #2e7d32); }
      .message.error { background: color-mix(in srgb, var(--error-color) 12%, transparent); color: var(--error-color); }
      .section-title { align-items: center; display: flex; font-size: 14px; font-weight: 500; gap: 7px; margin-bottom: 8px; }
      .paper-shell {
        background: #c7c7c7; border-radius: 7px; box-sizing: border-box; max-height: 650px;
        overflow: auto; padding: 8px;
      }
      .paper {
        background: #fff; box-shadow: 0 1px 4px rgb(0 0 0 / 25%); box-sizing: border-box;
        color: #000; margin: 0 auto; max-width: 420px; padding: 12px 10px 18px;
      }
      .paper svg { display: block; height: auto; overflow: visible; width: 100%; }
      .paper-note { color: #4d4d4d; font-size: 10px; margin-top: 7px; text-align: center; }
      .history-head { cursor: pointer; margin-bottom: 7px; }
      .history-list { display: grid; gap: 8px; }
      .history-tools { margin-bottom: 2px; }
      .history-item { background: var(--secondary-background-color); border-radius: 8px; padding: 9px; }
      .history-title { font-size: 13px; font-weight: 500; }
      .history-preview { font-size: 12px; margin: 6px 0; overflow-wrap: anywhere; }
      .history-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
      .history-actions button, .history-tools button { font-size: 11px; min-height: 32px; padding: 5px 7px; }
      .badge { border-radius: 999px; font-size: 9px; padding: 3px 6px; }
      .badge.saved { background: color-mix(in srgb, var(--info-color, #1976d2) 15%, transparent); }
      .badge.submitted { background: color-mix(in srgb, var(--success-color, #2e7d32) 15%, transparent); }
      .badge.failed { background: color-mix(in srgb, var(--error-color) 15%, transparent); color: var(--error-color); }
      .empty, .loading, .not-configured { color: var(--secondary-text-color); padding: 28px; text-align: center; }
      .settings { border-top: 1px solid var(--divider-color); margin-top: 16px; padding-top: 12px; }
      .settings-text { color: var(--secondary-text-color); font-size: 12px; }
      @media (max-width: 1050px) {
        .workspace[data-columns="3"] {
          grid-template-areas: "editor preview" "editor history";
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 760px) {
        .workspace, .workspace[data-columns="2"], .workspace[data-columns="3"] {
          grid-template-areas: "editor" "preview" "history"; grid-template-columns: minmax(0, 1fr);
        }
        .editor-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .status-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .head { align-items: flex-start; }
      }
    `;
  }

  constructor() {
    super();
    this._loaded = false;
    this._busy = false;
    this._saving = false;
    this._message = "";
    this._messageType = "success";
    this._userName = "";
    this._printer = {};
    this._draft = this._emptyDraft();
    this._history = [];
    this._settings = {};
    this._historyOpen = true;
    this._maxBytes = 16384;
    this._selection = { start: 0, end: 0 };
    this._savePromise = Promise.resolve();
  }

  setConfig(config) {
    if (!config) throw new Error("Karteneinstellungen fehlen");
    const previousDevice = this._config?.device_id || "";
    const columns = Math.min(3, Math.max(1, Number(config.columns || 2)));
    this._config = { ...config, device_id: config.device_id || "", columns };
    if (previousDevice !== this._config.device_id) this._resetForPrinter();
  }

  set hass(hass) {
    const sessionUserId = hass?.user?.id || "";
    if (this._sessionUserId && sessionUserId !== this._sessionUserId) this._resetForPrinter();
    this._sessionUserId = sessionUserId;
    this._hass = hass;
    if (!this._loaded && !this._loading) this._loadState();
    this.requestUpdate();
  }

  getCardSize() { return 12; }

  static getStubConfig() { return { device_id: "", columns: 2 }; }

  static getConfigForm() {
    return {
      schema: [
        { name: "device_id", required: true, selector: { device: { filter: { integration: "thermal_printer_notes" } } } },
        {
          name: "columns",
          required: true,
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "1", label: "1 Spalte" },
                { value: "2", label: "2 Spalten" },
                { value: "3", label: "3 Spalten" },
              ],
            },
          },
        },
      ],
      computeLabel: (schema) => ({ device_id: "Drucker", columns: "Dashboard-Layout" })[schema.name],
      computeHelper: (schema) => schema.name === "device_id"
        ? "Drucker, Status und zentrale Vorgaben werden automatisch übernommen."
        : "Auf schmalen Bildschirmen wird automatisch gestapelt.",
    };
  }

  _emptyDraft() { return { title: "", markdown: "", alignment: "left", size: "normal" }; }

  _resetForPrinter() {
    clearTimeout(this._saveTimer);
    this._loaded = false;
    this._loading = false;
    this._draft = this._emptyDraft();
    this._history = [];
    this._settings = {};
    this._printer = {};
    this._userName = "";
  }

  async _request(type, extra = {}) {
    if (!this._hass?.connection) throw new Error("Home Assistant ist nicht verbunden");
    return this._hass.connection.sendMessagePromise({
      type,
      device_id: this._config?.device_id || "",
      ...extra,
    });
  }

  async _loadState() {
    if (!this._hass?.connection || this._loading) return;
    this._loading = true;
    try {
      const state = await this._request("thermal_printer_notes/get_state");
      this._applyState(state);
      this._loaded = true;
    } catch (err) {
      this._showError(err, "Druckerdaten konnten nicht geladen werden");
    } finally {
      this._loading = false;
      this.requestUpdate();
    }
  }

  _applyState(state) {
    this._userName = state.user_name || "";
    this._printer = state.printer || {};
    this._draft = { ...this._emptyDraft(), ...(state.draft || {}) };
    this._history = state.history || [];
    this._settings = state.settings || {};
    this._maxBytes = Number(state.max_markdown_bytes || 16384);
  }

  _updateDraft(field, value) {
    this._draft = { ...this._draft, [field]: value };
    this._message = "";
    this._scheduleSave();
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveDraft(false), 500);
  }

  _documentPayload() {
    return {
      title: this._draft.title || "",
      markdown: this._draft.markdown || "",
      alignment: this._draft.alignment || "left",
      size: this._draft.size || "normal",
    };
  }

  async _saveDraft(notify = true) {
    clearTimeout(this._saveTimer);
    if (this._printableBytes() > this._maxBytes) return false;
    this._saving = true;
    this.requestUpdate();
    this._savePromise = this._savePromise.then(async () => {
      const result = await this._request("thermal_printer_notes/save_draft", this._documentPayload());
      if (result?.draft?.updated_at) this._draft = { ...this._draft, updated_at: result.draft.updated_at };
    });
    try {
      await this._savePromise;
      if (notify) this._showMessage("Entwurf gespeichert");
      return true;
    } catch (err) {
      this._savePromise = Promise.resolve();
      this._showError(err, "Entwurf konnte nicht gespeichert werden");
      return false;
    } finally {
      this._saving = false;
      this.requestUpdate();
    }
  }

  async _saveToHistory() {
    if (!this._checkLength()) return;
    clearTimeout(this._saveTimer);
    this._saving = true;
    this._message = "";
    try {
      await this._savePromise.catch(() => { this._savePromise = Promise.resolve(); });
      const result = await this._request("thermal_printer_notes/save_history", this._documentPayload());
      if (result?.draft?.updated_at) this._draft = { ...this._draft, updated_at: result.draft.updated_at };
      await this._refreshHistory();
      this._showMessage("Notiz gespeichert und dem persönlichen Verlauf hinzugefügt");
    } catch (err) {
      this._savePromise = Promise.resolve();
      this._showError(err, "Notiz konnte nicht im Verlauf gespeichert werden");
    } finally {
      this._saving = false;
      this.requestUpdate();
    }
  }

  async _print() {
    if (!this._checkLength()) return;
    clearTimeout(this._saveTimer);
    this._busy = true;
    this._message = "";
    try {
      await this._request("thermal_printer_notes/print", this._documentPayload());
      this._showMessage("Druck übermittelt und zuvor im persönlichen Verlauf gespeichert");
    } catch (err) {
      this._showError(err, "Drucken fehlgeschlagen; der Versuch bleibt im Verlauf");
    }
    try { await this._refreshHistory(); } catch (err) { this._showError(err, "Verlauf konnte nicht aktualisiert werden"); }
    this._busy = false;
    this.requestUpdate();
  }

  async _refreshHistory() {
    const state = await this._request("thermal_printer_notes/get_state");
    this._history = state.history || [];
    this._settings = state.settings || this._settings;
    this._printer = state.printer || this._printer;
  }

  async _paste() {
    try {
      const text = await navigator.clipboard.readText();
      this._insertAtSelection(text, "");
    } catch (err) { this._showError(err, "Zwischenablage konnte nicht gelesen werden"); }
  }

  _clearEditor() { this._draft = this._emptyDraft(); this._selection = { start: 0, end: 0 }; this._scheduleSave(); }

  _captureSelection(event) {
    this._selection = { start: event.target.selectionStart || 0, end: event.target.selectionEnd || 0 };
  }

  _insertAtSelection(prefix, suffix = prefix, placeholder = "Text") {
    const value = this._draft.markdown || "";
    const textarea = this.renderRoot?.querySelector("#note-markdown");
    const start = textarea?.selectionStart ?? this._selection.start ?? value.length;
    const end = textarea?.selectionEnd ?? this._selection.end ?? start;
    const selected = value.slice(start, end) || placeholder;
    const replacement = `${prefix}${selected}${suffix}`;
    this._updateDraft("markdown", `${value.slice(0, start)}${replacement}${value.slice(end)}`);
    const selectStart = start + prefix.length;
    const selectEnd = selectStart + selected.length;
    this.updateComplete.then(() => {
      const target = this.renderRoot?.querySelector("#note-markdown");
      target?.focus();
      target?.setSelectionRange(selectStart, selectEnd);
      this._selection = { start: selectStart, end: selectEnd };
    });
  }

  _prefixLines(prefix, placeholder = "Text") {
    const value = this._draft.markdown || "";
    const textarea = this.renderRoot?.querySelector("#note-markdown");
    let start = textarea?.selectionStart ?? this._selection.start ?? value.length;
    let end = textarea?.selectionEnd ?? this._selection.end ?? start;
    start = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = value.indexOf("\n", end);
    end = nextBreak === -1 ? value.length : nextBreak;
    const selected = value.slice(start, end) || placeholder;
    const replacement = selected.split("\n").map((line) => `${prefix}${line}`).join("\n");
    this._updateDraft("markdown", `${value.slice(0, start)}${replacement}${value.slice(end)}`);
    this.updateComplete.then(() => {
      const target = this.renderRoot?.querySelector("#note-markdown");
      target?.focus(); target?.setSelectionRange(start, start + replacement.length);
    });
  }

  async _loadHistory(historyId) {
    try {
      const result = await this._request("thermal_printer_notes/history/get", { history_id: historyId });
      const item = result.history;
      this._draft = { title: item.title || "", markdown: item.markdown || "", alignment: item.alignment || "left", size: item.size || "normal" };
      if (await this._saveDraft(false)) {
        this._showMessage("Verlaufseintrag in die Eingabe geladen");
        this.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (err) { this._showError(err, "Verlaufseintrag konnte nicht geladen werden"); }
  }

  async _reprintHistory(historyId) {
    this._busy = true;
    try {
      await this._request("thermal_printer_notes/history/print", { history_id: historyId });
      this._showMessage("Erneuter Druck wurde übermittelt");
    } catch (err) { this._showError(err, "Erneuter Druck fehlgeschlagen"); }
    try { await this._refreshHistory(); } catch (err) { this._showError(err, "Verlauf konnte nicht aktualisiert werden"); }
    this._busy = false; this.requestUpdate();
  }

  async _deleteHistory(historyId) {
    if (!confirm("Diesen persönlichen Verlaufseintrag löschen?")) return;
    try {
      await this._request("thermal_printer_notes/history/delete", { history_id: historyId });
      await this._refreshHistory();
    } catch (err) { this._showError(err, "Verlaufseintrag konnte nicht gelöscht werden"); }
  }

  async _clearHistory() {
    if (!confirm("Deinen gesamten persönlichen Verlauf unwiderruflich löschen?")) return;
    try {
      await this._request("thermal_printer_notes/history/clear");
      this._history = []; this._showMessage("Dein persönlicher Verlauf wurde gelöscht");
    } catch (err) { this._showError(err, "Verlauf konnte nicht gelöscht werden"); }
  }

  _showMessage(message) { this._message = message; this._messageType = "success"; this.requestUpdate(); }
  _showError(err, fallback) { this._message = err?.message ? `${fallback}: ${err.message}` : fallback; this._messageType = "error"; this.requestUpdate(); }
  _utf8Length(value) { return new TextEncoder().encode(value || "").length; }
  _printableSource() { const title = (this._draft.title || "").trim(); return title ? `# ${title}\n${this._draft.markdown || ""}` : this._draft.markdown || ""; }
  _printableBytes() { return this._utf8Length(this._printableSource()); }
  _checkLength() { if (this._printableBytes() <= this._maxBytes) return true; this._showError(null, `Der Text überschreitet ${this._maxBytes} UTF-8-Bytes`); return false; }

  _statusEntities() {
    return [
      ["Status", this._printer.status_entity],
      ["Bereit", this._printer.ready_entity],
      ["Warteschlange", this._printer.queue_entity],
    ];
  }

  _renderStatus() {
    return html`<div class="status-grid">${this._statusEntities().map(([label, entityId]) => {
      const state = entityId ? this._hass?.states?.[entityId] : undefined;
      const value = state ? this._hass.formatEntityState?.(state) || state.state : "–";
      return html`<div class="status-chip" title=${entityId || "Nicht automatisch gefunden"}><span class="status-label">${label}</span><span class="status-value">${value}</span></div>`;
    })}</div>`;
  }

  _formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }

  _printTime() {
    const parts = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
  }

  _printerChars(source, baseBold = false, baseUnderline = false) {
    const linked = String(source).replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 ($2)");
    const chars = []; let bold = false; let underline = false;
    const input = Array.from(linked);
    const extra = "€‚ƒ„…†‡‰Š‹ŒŽ‘’“”•–—™š›œžŸ";
    for (let index = 0; index < input.length;) {
      if (input[index] === "*" && input[index + 1] === "*") { bold = !bold; index += 2; continue; }
      if (input[index] === "*") { underline = !underline; index += 1; continue; }
      const point = input[index].codePointAt(0);
      const supported = (point >= 0x20 && point <= 0x7e) || (point >= 0xa0 && point <= 0xff) || extra.includes(input[index]);
      const value = input[index] === "\t" ? " " : supported ? input[index] : "?";
      chars.push({ value, bold: baseBold || bold, underline: baseUnderline || underline });
      index += 1;
    }
    return chars;
  }

  _wrapChars(chars, columns) {
    if (!chars.length) return [[]];
    const ranges = []; let begin = 0;
    while (begin < chars.length) {
      let end = Math.min(begin + columns, chars.length);
      if (end < chars.length) {
        let breakAt = end;
        while (breakAt > begin && chars[breakAt]?.value !== " ") breakAt -= 1;
        if (breakAt > begin) end = breakAt;
      }
      ranges.push(chars.slice(begin, end)); begin = end;
      while (begin < chars.length && chars[begin].value === " ") begin += 1;
    }
    return ranges;
  }

  _previewRows() {
    const rows = [];
    const headerRight = this._printTime().slice(0, 42);
    const rightStart = 42 - headerRight.length;
    const leftLimit = headerRight ? Math.max(0, rightStart - 1) : 42;
    let headerLeft = (this._userName || "Home Assistant").slice(0, leftLimit);
    if (headerLeft.length < rightStart) headerLeft += " ".repeat(rightStart - headerLeft.length);
    rows.push({ chars: this._printerChars(headerLeft + headerRight), columns: 42, cell: 9, glyph: 17, line: 23, align: "left", font: "small" });

    for (const raw of this._printableSource().split("\n")) {
      if (/^[ \t]*$/.test(raw)) { rows.push({ chars: [], columns: 32, cell: 12, glyph: 24, line: this._draft.size === "double_size" ? 54 : 30, align: this._draft.alignment }); continue; }
      const qr = raw.match(/^(?:QR: |\[QR]\()(.+?)(?:\))?$/);
      if (qr) { rows.push({ qr: qr[1], line: 178 }); continue; }
      let text = raw; let columns = this._draft.size === "normal" ? 32 : 16;
      let cell = columns === 32 ? 12 : 24;
      let glyph = this._draft.size === "double_size" ? 48 : 24;
      let line = this._draft.size === "double_size" ? 54 : 30;
      let align = this._draft.alignment; let bold = false; let underline = false;
      if (raw.startsWith("### ")) { text = raw.slice(4); columns = 32; cell = 12; glyph = 24; line = 30; align = "left"; bold = true; underline = true; }
      else if (raw.startsWith("## ")) { text = raw.slice(3); columns = 16; cell = 24; glyph = 24; line = 30; align = "center"; bold = true; }
      else if (raw.startsWith("# ")) { text = raw.slice(2); columns = 16; cell = 24; glyph = 48; line = 54; align = "center"; bold = true; }
      else if (["---", "___", "***"].includes(raw)) { text = "-".repeat(32); columns = 32; cell = 12; glyph = 24; line = 30; align = "left"; }
      else if (/^- \[[ xX]]/.test(raw)) { text = `${/[xX]/.test(raw[3]) ? "[x]" : "[ ]"} ${raw.slice(6)}`; }
      else if (/^[-*] /.test(raw)) { text = `• ${raw.slice(2)}`; }
      for (const chars of this._wrapChars(this._printerChars(text, bold, underline), columns)) rows.push({ chars, columns, cell, glyph, line, align });
    }
    return rows;
  }

  _segments(chars) {
    const result = [];
    chars.forEach((char, index) => {
      const previous = result[result.length - 1];
      if (previous && previous.bold === char.bold && previous.underline === char.underline) previous.text += char.value;
      else result.push({ start: index, text: char.value, bold: char.bold, underline: char.underline });
    });
    return result;
  }

  _renderPreview() {
    const rows = this._previewRows(); let cursor = 4;
    const positioned = rows.map((row) => { const item = { ...row, top: cursor }; cursor += row.line; return item; });
    const height = Math.max(80, cursor + 8);
    return html`
      <div class="paper-shell"><div class="paper">
        <svg viewBox=${`0 0 384 ${height}`} role="img" aria-label="Rastergenaue Druckvorschau">
          ${positioned.map((row) => {
            if (row.qr) return html`<g transform=${`translate(112 ${row.top + 5})`}><rect width="160" height="160" fill="none" stroke="#000" stroke-width="4"/><text x="80" y="76" text-anchor="middle" font-family="monospace" font-size="18" font-weight="700">QR</text><text x="80" y="102" text-anchor="middle" font-family="monospace" font-size="11">${row.qr.slice(0, 18)}</text></g>`;
            const width = row.chars.length * row.cell;
            const x = row.align === "center" ? (384 - width) / 2 : row.align === "right" ? 384 - width : 0;
            const baseline = row.top + row.glyph * 0.88;
            return this._segments(row.chars).map((segment) => html`
              <text
                x=${x + segment.start * row.cell}
                y=${baseline}
                font-family="'Courier New', 'Liberation Mono', monospace"
                font-size=${row.glyph}
                font-weight=${segment.bold ? "700" : "400"}
                text-decoration=${segment.underline ? "underline" : "none"}
                textLength=${Math.max(0.1, segment.text.length * row.cell)}
                lengthAdjust="spacingAndGlyphs"
              >${segment.text}</text>`);
          })}
        </svg>
        <div class="paper-note">EP-261C · 384 Punkte · 32/42 Zeichen</div>
      </div></div>`;
  }

  _statusLabel(status) { return ({ saved: "Gespeichert", submitted: "Übermittelt", failed: "Fehlgeschlagen" })[status] || "Wartet"; }
  _alignmentLabel(value) { return ({ left: "Links", center: "Zentriert", right: "Rechts" })[value] || value; }
  _sizeLabel(value) { return ({ normal: "Normal", double_width: "Doppelte Breite", double_size: "Doppelte Grösse" })[value] || value; }

  _renderHistory() {
    if (!this._historyOpen) return "";
    return html`<div class="history-list">
      <div class="history-tools"><span class="history-date">Max. ${this._settings.history_limit ?? 20} Einträge</span><button class="danger" @click=${this._clearHistory} ?disabled=${!this._history.length}><ha-icon icon="mdi:delete-sweep-outline"></ha-icon> Alle löschen</button></div>
      ${this._history.length ? this._history.map((item) => html`
        <div class="history-item">
          <div class="history-meta"><div><div class="history-title">${item.title || "Ohne Titel"}</div><div class="history-date">${this._formatDate(item.created_at)}</div></div><span class="badge ${item.status}" title=${item.error || ""}>${this._statusLabel(item.status)}</span></div>
          <div class="history-preview">${item.preview || "(leer)"}</div>
          <div class="history-options">${this._alignmentLabel(item.alignment)} · ${this._sizeLabel(item.size)}</div>
          <div class="history-actions"><button @click=${() => this._loadHistory(item.id)}><ha-icon icon="mdi:file-restore-outline"></ha-icon> Laden</button><button @click=${() => this._reprintHistory(item.id)} ?disabled=${this._busy}><ha-icon icon="mdi:printer-outline"></ha-icon> Erneut</button><button class="icon-only danger" title="Löschen" @click=${() => this._deleteHistory(item.id)}><ha-icon icon="mdi:delete-outline"></ha-icon></button></div>
        </div>`) : html`<div class="empty">Noch keine persönlichen Einträge vorhanden.</div>`}
    </div>`;
  }

  _toolButton(icon, title, action, text = "") {
    return html`<button title=${title} aria-label=${title} @mousedown=${(event) => event.preventDefault()} @click=${action}><ha-icon icon=${icon}></ha-icon>${text}</button>`;
  }

  _renderMarkdownTools() {
    return html`<div class="markdown-tools" aria-label="Markdown-Formatierung">
      ${this._toolButton("mdi:format-header-1", "Überschrift 1", () => this._prefixLines("# "))}
      ${this._toolButton("mdi:format-header-2", "Überschrift 2", () => this._prefixLines("## "))}
      ${this._toolButton("mdi:format-header-3", "Überschrift 3", () => this._prefixLines("### "))}
      <span class="divider"></span>
      ${this._toolButton("mdi:format-bold", "Fett", () => this._insertAtSelection("**", "**"))}
      ${this._toolButton("mdi:format-underline", "Unterstrichen (ein Stern im Drucker-Markdown)", () => this._insertAtSelection("*", "*"))}
      <span class="divider"></span>
      ${this._toolButton("mdi:format-list-bulleted", "Aufzählung", () => this._prefixLines("- "))}
      ${this._toolButton("mdi:format-list-numbered", "Nummerierte Liste", () => this._prefixLines("1. "))}
      ${this._toolButton("mdi:checkbox-marked-outline", "Checkliste", () => this._prefixLines("- [ ] "))}
      ${this._toolButton("mdi:link-variant", "Link", () => this._insertAtSelection("[", "](https://)", "Linktext"))}
      ${this._toolButton("mdi:minus", "Trennlinie", () => this._insertAtSelection("\n---\n", "", ""))}
      ${this._toolButton("mdi:qrcode", "QR-Code", () => this._insertAtSelection("QR: ", "", "https://"))}
    </div>`;
  }

  render() {
    if (!this._config) return html``;
    if (!this._loaded) return html`<ha-card><div class="loading">${this._message || "Persönliche Druckdaten werden geladen …"}</div></ha-card>`;
    const bytes = this._printableBytes();
    return html`<ha-card><div class="content">
      <div class="head"><div><div class="title">${this._printer.name || "Thermodrucker"}</div><div class="muted">Persönliche Notizen und Druckverlauf</div></div><div class="user"><ha-icon icon="mdi:account-outline"></ha-icon>${this._userName}</div></div>
      ${this._renderStatus()}
      ${this._message ? html`<div class="message ${this._messageType}">${this._message}</div>` : ""}
      <div class="workspace" data-columns=${String(this._config.columns)}>
        <section class="editor">
          <div class="field"><label for="note-title">Titel (optional)</label><input id="note-title" maxlength="80" autocomplete="off" .value=${this._draft.title || ""} @input=${(event) => this._updateDraft("title", event.target.value)} placeholder="Titel des Ausdrucks" /></div>
          <div class="field"><label for="note-markdown">Markdown-Text</label>${this._renderMarkdownTools()}<textarea id="note-markdown" autocomplete="off" .value=${this._draft.markdown || ""} @input=${(event) => { this._captureSelection(event); this._updateDraft("markdown", event.target.value); }} @select=${this._captureSelection} @click=${this._captureSelection} @keyup=${this._captureSelection} placeholder="# Überschrift\nDein Text …"></textarea><div class="count ${bytes > this._maxBytes ? "invalid" : ""}">${bytes.toLocaleString("de-CH")} / ${this._maxBytes.toLocaleString("de-CH")} UTF-8-Bytes</div></div>
          <div class="editor-controls">
            <button @click=${this._paste}><ha-icon icon="mdi:content-paste"></ha-icon>Einfügen</button>
            <button @click=${this._saveToHistory} ?disabled=${this._saving || this._busy || bytes > this._maxBytes}><ha-icon icon="mdi:content-save-outline"></ha-icon>Speichern</button>
            <button class="danger" @click=${this._clearEditor}><ha-icon icon="mdi:eraser"></ha-icon>Leeren</button>
            <div class="compact-field"><label for="note-alignment">Ausrichtung</label><select id="note-alignment" .value=${this._draft.alignment} @change=${(event) => this._updateDraft("alignment", event.target.value)}><option value="left">Links</option><option value="center">Zentriert</option><option value="right">Rechts</option></select></div>
            <div class="compact-field"><label for="note-size">Schriftgrösse</label><select id="note-size" .value=${this._draft.size} @change=${(event) => this._updateDraft("size", event.target.value)}><option value="normal">Normal</option><option value="double_width">Doppelte Breite</option><option value="double_size">Doppelte Grösse</option></select></div>
          </div>
          <div class="print-row"><span class="save-state">${this._saving ? "Wird gespeichert …" : "Automatisch nach 500 ms gespeichert"}</span><button class="primary" @click=${this._print} ?disabled=${this._busy || bytes > this._maxBytes}><ha-icon icon="mdi:printer"></ha-icon>${this._busy ? "Wird gedruckt …" : "Drucken"}</button></div>
        </section>
        <section class="preview"><div class="section-title"><ha-icon icon="mdi:eye-outline"></ha-icon>Druckvorschau</div>${this._renderPreview()}</section>
        <section class="history-panel"><div class="history-head" @click=${() => { this._historyOpen = !this._historyOpen; }}><div class="section-title" style="margin:0"><ha-icon icon="mdi:history"></ha-icon>Mein Verlauf (${this._history.length})</div><ha-icon icon=${this._historyOpen ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon></div>${this._renderHistory()}</section>
      </div>
      <div class="settings"><div class="section-title"><ha-icon icon="mdi:tune-variant"></ha-icon>Zentrale Druckvorgaben</div><div class="settings-text">${this._settings.reverse_print ? "Rückwärtsdruck" : "Vorwärtsdruck"} · ${this._settings.copies ?? 1} Exemplar(e) · ${this._settings.feed_lines ?? 4} Vorschubzeilen · Schneiden ${this._settings.cut ? "ein" : "aus"}</div></div>
    </div></ha-card>`;
  }
}

if (!customElements.get("thermal-printer-notes-card")) customElements.define("thermal-printer-notes-card", ThermalPrinterNotesCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "thermal-printer-notes-card")) {
  window.customCards.push({ type: "thermal-printer-notes-card", name: "Thermal Printer Notes", description: "Private Markdown-Notizen mit EP-261C-Druckvorschau und Verlauf", preview: true });
}
