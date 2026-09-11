/* Thermal Printer Notes card - no build step required. */

import { detectLanguage, translate } from "./translations.js";

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
      .paper canvas { display: block; height: auto; width: 100%; }
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
    this._previewProfile = null;
    this._draft = this._emptyDraft();
    this._history = [];
    this._settings = {};
    this._historyOpen = true;
    this._maxBytes = 16384;
    this._selection = { start: 0, end: 0 };
    this._savePromise = Promise.resolve();
    this._printers = [];
    this._selectedDeviceId = "";
    this._generation = 0;
    this._pendingRequests = 0;
    this._switching = false;
  }

  setConfig(config) {
    if (!config) throw new Error(translate(detectLanguage(), "card.config_missing"));
    const previousDevice = this._config?.device_id || "";
    const columns = Math.min(3, Math.max(1, Number(config.columns || 2)));
    this._config = { ...config, device_id: config.device_id || "", columns };
    if (previousDevice !== this._config.device_id) {
      this._selectedDeviceId = this._config.device_id;
      this._resetForPrinter();
    }
  }

  set hass(hass) {
    const sessionUserId = hass?.user?.id || "";
    if (this._sessionUserId && sessionUserId !== this._sessionUserId) {
      this._printers = [];
      this._selectedDeviceId = this._config?.device_id || "";
      this._resetForPrinter();
    }
    this._sessionUserId = sessionUserId;
    this._hass = hass;
    if (!this._loaded && !this._loading) this._loadState();
    this.requestUpdate();
  }

  getCardSize() { return 12; }

  updated() { this._drawPreview(); }

  static getStubConfig() { return { device_id: "", columns: 2 }; }

  static getConfigForm() {
    const t = (key) => translate(detectLanguage(), key);
    return {
      schema: [
        { name: "device_id", required: false, selector: { device: { filter: { integration: "thermal_printer_notes" } } } },
        {
          name: "columns",
          required: true,
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "1", label: t("config.columns_1") },
                { value: "2", label: t("config.columns_2") },
                { value: "3", label: t("config.columns_3") },
              ],
            },
          },
        },
      ],
      computeLabel: (schema) => ({ device_id: t("config.device"), columns: t("config.layout") })[schema.name],
      computeHelper: (schema) => schema.name === "device_id"
        ? t("config.device_helper")
        : t("config.layout_helper"),
    };
  }

  _emptyDraft() { return { title: "", markdown: "", alignment: "left", size: "normal" }; }

  _language() { return detectLanguage(this._hass); }

  _t(key, replacements = {}) { return translate(this._language(), key, replacements); }

  _resetForPrinter() {
    this._generation++;
    clearTimeout(this._saveTimer);
    this._savePromise = Promise.resolve();
    this._saving = false;
    this._busy = false;
    this._message = "";
    this._loaded = false;
    this._loading = false;
    this._draft = this._emptyDraft();
    this._history = [];
    this._settings = {};
    this._printer = {};
    this._previewProfile = null;
    this._userName = "";
  }

  async _request(type, extra = {}, context = this._requestContext()) {
    if (!this._hass?.connection) throw new Error(this._t("error.not_connected"));
    if (context.generation !== this._generation) throw { stale: true };
    this._pendingRequests++;
    this.requestUpdate();
    try {
      const result = await context.connection.sendMessagePromise({
        type,
        ...(type.endsWith("/list_printers") ? {} : { device_id: context.deviceId }),
        ...extra,
      });
      if (context.generation !== this._generation) throw { stale: true };
      return result;
    } catch (err) {
      if (context.generation !== this._generation) throw { stale: true };
      throw err;
    } finally {
      this._pendingRequests--;
      this.requestUpdate();
    }
  }

  _requestContext() {
    return { generation: this._generation, deviceId: this._selectedDeviceId,
      connection: this._hass?.connection };
  }

  async _selectPrinter(event) {
    const deviceId = event.target.value;
    event.target.value = this._selectedDeviceId;
    if (!deviceId || deviceId === this._selectedDeviceId || this._switching ||
        this._busy || this._saving || this._pendingRequests) return;
    this._switching = true;
    this.requestUpdate();
    try {
      // Keep the old printer selected if its draft cannot be saved.
      if (this._loaded && (!this._checkLength() || !await this._saveDraft(false))) return;
      this._selectedDeviceId = deviceId;
      this._resetForPrinter();
      await this._loadState();
    } finally {
      this._switching = false;
      this.requestUpdate();
    }
  }

  async _loadState() {
    if (!this._hass?.connection || this._loading) return;
    this._loading = true;
    const generation = this._generation;
    try {
      const { printers } = await this._request("thermal_printer_notes/list_printers");
      this._printers = printers || [];
      if (!this._selectedDeviceId) this._selectedDeviceId = this._printers[0]?.device_id || "";
      if (!this._selectedDeviceId) throw { code: "not_configured" };
      const state = await this._request("thermal_printer_notes/get_state");
      this._applyState(state);
      this._loaded = true;
    } catch (err) {
      this._showError(err, "error.load_state");
    } finally {
      if (generation === this._generation) this._loading = false;
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
    this._previewProfile = state.preview_profile || null;
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
    const context = this._requestContext();
    const document = this._documentPayload();
    this._savePromise = this._savePromise.catch(() => {}).then(async () => {
      const result = await this._request("thermal_printer_notes/save_draft", document, context);
      if (result?.draft?.updated_at) this._draft = { ...this._draft, updated_at: result.draft.updated_at };
    });
    try {
      await this._savePromise;
      if (notify) this._showMessage(this._t("success.draft_saved"));
      return true;
    } catch (err) {
      this._showError(err, "error.save_draft");
      return false;
    } finally {
      if (context.generation === this._generation) this._saving = false;
      this.requestUpdate();
    }
  }

  async _saveToHistory() {
    if (!this._checkLength()) return;
    const context = this._requestContext();
    const document = this._documentPayload();
    clearTimeout(this._saveTimer);
    this._saving = true;
    this._message = "";
    try {
      await this._savePromise.catch(() => { this._savePromise = Promise.resolve(); });
      const result = await this._request("thermal_printer_notes/save_history", document, context);
      if (result?.draft?.updated_at) this._draft = { ...this._draft, updated_at: result.draft.updated_at };
      await this._refreshHistory();
      this._showMessage(this._t("success.history_saved"));
    } catch (err) {
      this._savePromise = Promise.resolve();
      this._showError(err, "error.save_history");
    } finally {
      if (context.generation === this._generation) this._saving = false;
      this.requestUpdate();
    }
  }

  async _print() {
    if (!this._checkLength()) return;
    const context = this._requestContext();
    const document = this._documentPayload();
    clearTimeout(this._saveTimer);
    this._busy = true;
    this._message = "";
    try {
      await this._savePromise.catch(() => {});
      await this._request("thermal_printer_notes/print", document, context);
      this._showMessage(this._t("success.print_submitted"));
    } catch (err) {
      if (err?.stale) return;
      this._showError(err, "error.print");
    }
    try { await this._refreshHistory(); } catch (err) { this._showError(err, "error.refresh_history"); }
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
    } catch (err) { this._showError(err, "error.clipboard"); }
  }

  _clearEditor() { this._draft = this._emptyDraft(); this._selection = { start: 0, end: 0 }; this._scheduleSave(); }

  _captureSelection(event) {
    this._selection = { start: event.target.selectionStart || 0, end: event.target.selectionEnd || 0 };
  }

  _insertAtSelection(prefix, suffix = prefix, placeholder = undefined) {
    const value = this._draft.markdown || "";
    const textarea = this.renderRoot?.querySelector("#note-markdown");
    const start = textarea?.selectionStart ?? this._selection.start ?? value.length;
    const end = textarea?.selectionEnd ?? this._selection.end ?? start;
    const selected = value.slice(start, end) || placeholder || this._t("placeholder.text");
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

  _widenSelection() {
    const value = this._draft.markdown || "";
    const textarea = this.renderRoot?.querySelector("#note-markdown");
    const start = textarea?.selectionStart ?? this._selection.start ?? value.length;
    const end = textarea?.selectionEnd ?? this._selection.end ?? start;
    const selected = value.slice(start, end) || this._t("placeholder.text");
    if (!selected.includes("\n")) {
      this._insertAtSelection("==", "==", selected);
      return;
    }
    const replacement = selected
      .split("\n")
      .map((line) => this._wideLine(line))
      .join("\n");
    this._updateDraft("markdown", `${value.slice(0, start)}${replacement}${value.slice(end)}`);
    this.updateComplete.then(() => {
      const target = this.renderRoot?.querySelector("#note-markdown");
      target?.focus();
      target?.setSelectionRange(start, start + replacement.length);
      this._selection = { start, end: start + replacement.length };
    });
  }

  _wideLine(line) {
    if (!line || ["---", "___", "***"].includes(line.trim()) || /^(?:QR: |\[QR]\()/.test(line.trim())) return line;
    const parts = line.match(/^(\s*(?:#{1,3} |- \[[ xX]] |[-*] |\d+\. ))?(.*)$/);
    const prefix = parts?.[1] || "";
    const content = parts?.[2] || "";
    if (!content) return line;
    if (content.startsWith("==") && content.endsWith("==") && content.length >= 4) {
      return `${prefix}${content.slice(2, -2)}`;
    }
    return `${prefix}==${content}==`;
  }

  _prefixLines(prefix, placeholder = undefined) {
    const value = this._draft.markdown || "";
    const textarea = this.renderRoot?.querySelector("#note-markdown");
    let start = textarea?.selectionStart ?? this._selection.start ?? value.length;
    let end = textarea?.selectionEnd ?? this._selection.end ?? start;
    start = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = value.indexOf("\n", end);
    end = nextBreak === -1 ? value.length : nextBreak;
    const selected = value.slice(start, end) || placeholder || this._t("placeholder.text");
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
        this._showMessage(this._t("success.history_loaded"));
        this.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (err) { this._showError(err, "error.load_history"); }
  }

  async _reprintHistory(historyId) {
    this._busy = true;
    try {
      await this._request("thermal_printer_notes/history/print", { history_id: historyId });
      this._showMessage(this._t("success.reprint_submitted"));
    } catch (err) { this._showError(err, "error.reprint"); }
    try { await this._refreshHistory(); } catch (err) { this._showError(err, "error.refresh_history"); }
    this._busy = false; this.requestUpdate();
  }

  async _deleteHistory(historyId) {
    if (!confirm(this._t("confirm.delete_history"))) return;
    try {
      await this._request("thermal_printer_notes/history/delete", { history_id: historyId });
      await this._refreshHistory();
    } catch (err) { this._showError(err, "error.delete_history"); }
  }

  async _clearHistory() {
    if (!confirm(this._t("confirm.clear_history"))) return;
    try {
      await this._request("thermal_printer_notes/history/clear");
      this._history = []; this._showMessage(this._t("success.history_cleared"));
    } catch (err) { this._showError(err, "error.clear_history"); }
  }

  _showMessage(message) { this._message = message; this._messageType = "success"; this.requestUpdate(); }
  _showError(err, fallbackKey) {
    if (err?.stale) return;
    const fallback = this._t(fallbackKey);
    const localizedCode = err?.code ? this._t(`error.${err.code}`) : "";
    const hasLocalizedCode = localizedCode && localizedCode !== `error.${err?.code}`;
    const detail = hasLocalizedCode ? localizedCode : err?.message;
    this._message = detail && detail !== fallback ? `${fallback}: ${detail}` : fallback;
    this._messageType = "error";
    this.requestUpdate();
  }
  _utf8Length(value) { return new TextEncoder().encode(value || "").length; }
  _printableSource() { const title = (this._draft.title || "").trim(); return title ? `# ${title}\n${this._draft.markdown || ""}` : this._draft.markdown || ""; }
  _printableBytes() { return this._utf8Length(this._printableSource()); }
  _checkLength() {
    if (this._printableBytes() <= this._maxBytes) return true;
    this._showMessage(this._t("error.too_long", { bytes: this._maxBytes }));
    this._messageType = "error";
    return false;
  }

  _statusEntities() {
    return [
      [this._t("status.status"), this._printer.status_entity],
      [this._t("status.ready"), this._printer.ready_entity],
      [this._t("status.queue"), this._printer.queue_entity],
    ];
  }

  _renderStatus() {
    return html`<div class="status-grid">${this._statusEntities().map(([label, entityId]) => {
      const state = entityId ? this._hass?.states?.[entityId] : undefined;
      const value = state ? this._hass.formatEntityState?.(state) || state.state : "–";
      return html`<div class="status-chip" title=${entityId || this._t("status.not_found")}><span class="status-label">${label}</span><span class="status-value">${value}</span></div>`;
    })}</div>`;
  }

  _formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat(this._language() === "de" ? "de-CH" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }

  _printTime() {
    const parts = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
  }

  _printerChars(source, baseBold = false, baseUnderline = false) {
    const linked = String(source).replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 ($2)");
    const chars = []; let bold = false; let underline = false; let wide = false;
    const input = Array.from(linked);
    const extra = "€‚ƒ„…†‡‰Š‹ŒŽ‘’“”•–—™š›œžŸ";
    for (let index = 0; index < input.length;) {
      if (input[index] === "*" && input[index + 1] === "*") { bold = !bold; index += 2; continue; }
      if (input[index] === "=" && input[index + 1] === "=" && (wide || input.slice(index + 2).join("").includes("=="))) { wide = !wide; index += 2; continue; }
      if (input[index] === "*") { underline = !underline; index += 1; continue; }
      const point = input[index].codePointAt(0);
      const supported = (point >= 0x20 && point <= 0x7e) || (point >= 0xa0 && point <= 0xff) || extra.includes(input[index]);
      const value = input[index] === "\t" ? " " : supported ? input[index] : "?";
      chars.push({ value, bold: baseBold || bold, underline: baseUnderline || underline, wide });
      index += 1;
    }
    return chars;
  }

  _charColumns(char, allowInlineWide) { return allowInlineWide && char.wide ? 2 : 1; }

  _wrapChars(chars, columns, allowInlineWide = true) {
    if (!chars.length) return [[]];
    const ranges = []; let begin = 0;
    while (begin < chars.length) {
      let end = begin; let usedColumns = 0; let lastSpace = -1;
      while (end < chars.length) {
        const width = this._charColumns(chars[end], allowInlineWide);
        if (usedColumns + width > columns) break;
        usedColumns += width;
        if (chars[end].value === " ") lastSpace = end;
        end += 1;
      }
      if (end < chars.length && lastSpace > begin) end = lastSpace;
      if (end === begin) end += 1;
      ranges.push(chars.slice(begin, end)); begin = end;
      while (begin < chars.length && chars[begin].value === " ") begin += 1;
    }
    return ranges;
  }

  _profile() {
    const wide = this._previewProfile?.model === "EP-382C";
    return { model: wide ? "EP-382C" : "EP-261C", dots: wide ? 576 : 384,
      normal: wide ? 48 : 32, small: wide ? 64 : 42 };
  }

  _previewRows() {
    const { normal, small: smallColumns } = this._profile();
    const rows = [];
    const headerRight = this._printTime().slice(0, smallColumns);
    const rightStart = smallColumns - headerRight.length;
    const leftLimit = headerRight ? Math.max(0, rightStart - 1) : smallColumns;
    let headerLeft = (this._userName || "Home Assistant").slice(0, leftLimit);
    if (headerLeft.length < rightStart) headerLeft += " ".repeat(rightStart - headerLeft.length);
    rows.push({ chars: this._printerChars(headerLeft + headerRight), columns: smallColumns, cell: 9, glyph: 17, line: 23, align: "left", font: "small" });

    for (const raw of this._printableSource().split("\n")) {
      const small = this._draft.size === "small";
      if (/^[ \t]*$/.test(raw)) {
        rows.push({
          chars: [],
          columns: small ? smallColumns : normal,
          cell: small ? 9 : 12,
          glyph: small ? 17 : 24,
          line: this._draft.size === "double_size" ? 54 : small ? 23 : 30,
          align: this._draft.alignment,
          font: small ? "small" : "normal",
        });
        continue;
      }
      const qr = raw.match(/^(?:QR: |\[QR]\()(.+?)(?:\))?$/);
      if (qr) { rows.push({ qr: qr[1], line: 178 }); continue; }
      let text = raw;
      let columns = small ? smallColumns : this._draft.size === "normal" ? normal : (normal / 2);
      let cell = small ? 9 : columns === normal ? 12 : 24;
      let glyph = small ? 17 : this._draft.size === "double_size" ? 48 : 24;
      let line = small ? 23 : this._draft.size === "double_size" ? 54 : 30;
      let allowInlineWide = small || this._draft.size === "normal";
      let align = this._draft.alignment; let bold = false; let underline = false;
      if (raw.startsWith("### ")) { text = raw.slice(4); columns = normal; cell = 12; glyph = 24; line = 30; align = "left"; bold = true; underline = true; allowInlineWide = true; }
      else if (raw.startsWith("## ")) { text = raw.slice(3); columns = (normal / 2); cell = 24; glyph = 24; line = 30; align = "center"; bold = true; allowInlineWide = false; }
      else if (raw.startsWith("# ")) { text = raw.slice(2); columns = (normal / 2); cell = 24; glyph = 48; line = 54; align = "center"; bold = true; allowInlineWide = false; }
      else if (["---", "___", "***"].includes(raw)) { text = "-".repeat(normal); columns = normal; cell = 12; glyph = 24; line = 30; align = "left"; allowInlineWide = false; }
      else if (/^- \[[ xX]]/.test(raw)) { text = `${/[xX]/.test(raw[3]) ? "[x]" : "[ ]"} ${raw.slice(6)}`; }
      else if (/^[-*] /.test(raw)) { text = `• ${raw.slice(2)}`; }
      for (const chars of this._wrapChars(this._printerChars(text, bold, underline), columns, allowInlineWide)) rows.push({ chars, columns, cell, glyph, line, align, font: small ? "small" : "normal", allowInlineWide });
    }
    return rows;
  }

  _previewChunks() {
    const chunks = [];
    let rows = [];
    let cursor = 4;
    for (const row of this._previewRows()) {
      if (rows.length && cursor + row.line + 8 > 8000) {
        chunks.push({ rows, height: cursor });
        rows = [];
        cursor = 0;
      }
      rows.push({ ...row, top: cursor });
      cursor += row.line;
    }
    chunks.push({ rows, height: Math.max(80, cursor + 8) });
    return chunks;
  }

  _drawPreview() {
    const canvases = this.renderRoot?.querySelectorAll("canvas[data-preview-chunk]");
    if (!canvases?.length) return;
    const chunks = this._previewChunks();
    const profile = this._profile();
    canvases.forEach((canvas, index) => {
      const chunk = chunks[index];
      if (!chunk) return;
      if (canvas.width !== profile.dots) canvas.width = profile.dots;
      if (canvas.height !== chunk.height) canvas.height = chunk.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#000";
      context.textBaseline = "alphabetic";
      for (const row of chunk.rows) {
        if (row.qr) {
          context.lineWidth = 4;
          context.strokeStyle = "#000";
          context.strokeRect((profile.dots - 160) / 2, row.top + 5, 160, 160);
          context.textAlign = "center";
          context.font = "700 18px monospace";
          context.fillText("QR", profile.dots / 2, row.top + 81);
          context.font = "400 11px monospace";
          context.fillText(row.qr.slice(0, 18), profile.dots / 2, row.top + 107, 145);
          context.textAlign = "left";
          continue;
        }
        const width = row.chars.reduce((total, char) => total + row.cell * this._charColumns(char, row.allowInlineWide), 0);
        const startX = row.align === "center"
          ? (profile.dots - width) / 2
          : row.align === "right" ? profile.dots - width : 0;
        const baseline = row.top + row.glyph * 0.88;
        let x = startX;
        row.chars.forEach((char) => {
          const columns = this._charColumns(char, row.allowInlineWide);
          const charWidth = row.cell * columns;
          context.font = `${char.bold ? "700" : "400"} ${row.glyph}px 'Courier New', 'Liberation Mono', monospace`;
          if (char.value !== " " && columns === 2) {
            context.save();
            context.translate(x, 0);
            context.scale(2, 1);
            context.fillText(char.value, 0, baseline, row.cell);
            context.restore();
          } else if (char.value !== " ") {
            context.fillText(char.value, x, baseline, row.cell);
          }
          if (char.underline) context.fillRect(x, baseline + 1, charWidth, Math.max(1, row.glyph / 18));
          x += charWidth;
        });
      }
    });
  }

  _renderPreview() {
    const chunks = this._previewChunks();
    const profile = this._profile();
    return html`
      <div class="paper-shell"><div class="paper">
        ${chunks.map((chunk, index) => html`
          <canvas
            data-preview-chunk=${String(index)}
            width=${String(profile.dots)}
            height=${String(chunk.height)}
            role="img"
            aria-label=${this._t("preview.section", { number: index + 1 })}
          ></canvas>
        `)}
        <div class="paper-note">${this._t("preview.profile", profile)}</div>
      </div></div>`;
  }

  _statusLabel(status) { return this._t(`history.status_${["saved", "submitted", "failed"].includes(status) ? status : "pending"}`); }
  _alignmentLabel(value) { return this._t(`alignment.${value}`); }
  _sizeLabel(value) { return this._t(value === "double_width" ? "size.double_width_legacy" : `size.${value}`); }

  _renderHistory() {
    if (!this._historyOpen) return "";
    return html`<div class="history-list">
      <div class="history-tools"><span class="history-date">${this._t("history.maximum", { count: this._settings.history_limit ?? 20 })}</span><button class="danger" @click=${this._clearHistory} ?disabled=${!this._history.length}><ha-icon icon="mdi:delete-sweep-outline"></ha-icon> ${this._t("history.delete_all")}</button></div>
      ${this._history.length ? this._history.map((item) => html`
        <div class="history-item">
          <div class="history-meta"><div><div class="history-title">${item.title || this._t("history.untitled")}</div><div class="history-date">${this._formatDate(item.created_at)}</div></div><span class="badge ${item.status}" title=${item.status === "failed" ? this._t("error.print_failed") : ""}>${this._statusLabel(item.status)}</span></div>
          <div class="history-preview">${item.preview || this._t("history.empty_note")}</div>
          <div class="history-options">${this._alignmentLabel(item.alignment)} · ${this._sizeLabel(item.size)}</div>
          <div class="history-actions"><button @click=${() => this._loadHistory(item.id)}><ha-icon icon="mdi:file-restore-outline"></ha-icon> ${this._t("history.load")}</button><button @click=${() => this._reprintHistory(item.id)} ?disabled=${this._busy}><ha-icon icon="mdi:printer-outline"></ha-icon> ${this._t("history.reprint")}</button><button class="icon-only danger" title=${this._t("history.delete")} @click=${() => this._deleteHistory(item.id)}><ha-icon icon="mdi:delete-outline"></ha-icon></button></div>
        </div>`) : html`<div class="empty">${this._t("history.empty")}</div>`}
    </div>`;
  }

  _toolButton(icon, title, action, text = "") {
    return html`<button title=${title} aria-label=${title} @mousedown=${(event) => event.preventDefault()} @click=${action}><ha-icon icon=${icon}></ha-icon>${text}</button>`;
  }

  _renderMarkdownTools() {
    return html`<div class="markdown-tools" aria-label=${this._t("tools.formatting")}>
      ${this._toolButton("mdi:format-header-1", this._t("tools.heading_1"), () => this._prefixLines("# "))}
      ${this._toolButton("mdi:format-header-2", this._t("tools.heading_2"), () => this._prefixLines("## "))}
      ${this._toolButton("mdi:format-header-3", this._t("tools.heading_3"), () => this._prefixLines("### "))}
      <span class="divider"></span>
      ${this._toolButton("mdi:format-bold", this._t("tools.bold"), () => this._insertAtSelection("**", "**"))}
      ${this._toolButton("mdi:format-underline", this._t("tools.underline"), () => this._insertAtSelection("*", "*"))}
      ${this._toolButton("mdi:arrow-expand-horizontal", this._t("tools.wide"), () => this._widenSelection())}
      <span class="divider"></span>
      ${this._toolButton("mdi:format-list-bulleted", this._t("tools.bulleted_list"), () => this._prefixLines("- "))}
      ${this._toolButton("mdi:format-list-numbered", this._t("tools.numbered_list"), () => this._prefixLines("1. "))}
      ${this._toolButton("mdi:checkbox-marked-outline", this._t("tools.checklist"), () => this._prefixLines("- [ ] "))}
      ${this._toolButton("mdi:link-variant", this._t("tools.link"), () => this._insertAtSelection("[", "](https://)", this._t("placeholder.link_text")))}
      ${this._toolButton("mdi:minus", this._t("tools.separator"), () => this._insertAtSelection("\n---\n", "", ""))}
      ${this._toolButton("mdi:qrcode", this._t("tools.qr_code"), () => this._insertAtSelection("QR: ", "", "https://"))}
    </div>`;
  }

  _renderPrinterSelector() {
    return html`<div class="field"><label for="printer-select">${this._t("field.printer")}</label>
      <select id="printer-select" .value=${this._selectedDeviceId}
        ?disabled=${this._switching || this._busy || this._saving || this._pendingRequests > 0}
        @change=${this._selectPrinter}>
        ${!this._printers.some((printer) => printer.device_id === this._selectedDeviceId)
          ? html`<option value=${this._selectedDeviceId}>${this._t("error.printer_unavailable")}</option>` : ""}
        ${this._printers.map((printer) => html`<option value=${printer.device_id}
          ?selected=${printer.device_id === this._selectedDeviceId}>${printer.name}</option>`)}
      </select></div>`;
  }

  render() {
    if (!this._config) return html``;
    if (!this._loaded) return html`<ha-card><div class="content">${this._renderPrinterSelector()}<div class="loading">${this._message || this._t("loading.personal_data")}</div></div></ha-card>`;
    const bytes = this._printableBytes();
    return html`<ha-card><div class="content">
      <div class="head"><div><div class="title">${this._printer.name || this._t("header.default_printer")}</div><div class="muted">${this._t("header.subtitle")}</div></div><div class="user"><ha-icon icon="mdi:account-outline"></ha-icon>${this._userName}</div></div>
      ${this._renderPrinterSelector()}
      ${this._renderStatus()}
      ${this._message ? html`<div class="message ${this._messageType}">${this._message}</div>` : ""}
      <fieldset class="workspace" style="border:0;padding:0;margin:0;min-width:0" ?disabled=${this._switching} data-columns=${String(this._config.columns)}>
        <section class="editor">
          <div class="field"><label for="note-title">${this._t("field.title")}</label><input id="note-title" maxlength="80" autocomplete="off" .value=${this._draft.title || ""} @input=${(event) => this._updateDraft("title", event.target.value)} placeholder=${this._t("field.title_placeholder")} /></div>
          <div class="field"><label for="note-markdown">${this._t("field.markdown")}</label>${this._renderMarkdownTools()}<textarea id="note-markdown" autocomplete="off" .value=${this._draft.markdown || ""} @input=${(event) => { this._captureSelection(event); this._updateDraft("markdown", event.target.value); }} @select=${this._captureSelection} @click=${this._captureSelection} @keyup=${this._captureSelection} placeholder=${this._t("field.markdown_placeholder")}></textarea><div class="count ${bytes > this._maxBytes ? "invalid" : ""}">${bytes.toLocaleString(this._language() === "de" ? "de-CH" : "en-GB")} / ${this._maxBytes.toLocaleString(this._language() === "de" ? "de-CH" : "en-GB")} UTF-8-Bytes</div></div>
          <div class="editor-controls">
            <button @click=${this._paste}><ha-icon icon="mdi:content-paste"></ha-icon>${this._t("action.paste")}</button>
            <button @click=${this._saveToHistory} ?disabled=${this._saving || this._busy || bytes > this._maxBytes}><ha-icon icon="mdi:content-save-outline"></ha-icon>${this._t("action.save")}</button>
            <button class="danger" @click=${this._clearEditor}><ha-icon icon="mdi:eraser"></ha-icon>${this._t("action.clear")}</button>
            <div class="compact-field"><label for="note-alignment">${this._t("field.alignment")}</label><select id="note-alignment" .value=${this._draft.alignment} @change=${(event) => this._updateDraft("alignment", event.target.value)}><option value="left">${this._t("alignment.left")}</option><option value="center">${this._t("alignment.center")}</option><option value="right">${this._t("alignment.right")}</option></select></div>
            <div class="compact-field"><label for="note-size">${this._t("field.size")}</label><select id="note-size" .value=${this._draft.size} @change=${(event) => this._updateDraft("size", event.target.value)}>${this._draft.size === "double_width" ? html`<option value="double_width">${this._t("size.double_width_legacy")}</option>` : ""}<option value="small">${this._t("size.small")}</option><option value="normal">${this._t("size.normal")}</option><option value="double_size">${this._t("size.double_size")}</option></select></div>
          </div>
          <div class="print-row"><span class="save-state">${this._saving ? this._t("autosave.saving") : this._t("autosave.idle")}</span><button class="primary" @click=${this._print} ?disabled=${this._busy || bytes > this._maxBytes}><ha-icon icon="mdi:printer"></ha-icon>${this._busy ? this._t("action.printing") : this._t("action.print")}</button></div>
        </section>
        <section class="preview"><div class="section-title"><ha-icon icon="mdi:eye-outline"></ha-icon>${this._t("preview.title")}</div>${this._renderPreview()}</section>
        <section class="history-panel"><div class="history-head" @click=${() => { this._historyOpen = !this._historyOpen; }}><div class="section-title" style="margin:0"><ha-icon icon="mdi:history"></ha-icon>${this._t("history.title", { count: this._history.length })}</div><ha-icon icon=${this._historyOpen ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon></div>${this._renderHistory()}</section>
      </fieldset>
      <div class="settings"><div class="section-title"><ha-icon icon="mdi:tune-variant"></ha-icon>${this._t("settings.title")}</div><div class="settings-text">${this._t(this._settings.reverse_print ? "settings.reverse" : "settings.forward")} · ${this._t("settings.copies", { count: this._settings.copies ?? 1 })} · ${this._t("settings.feed", { count: this._settings.feed_lines ?? 4 })} · ${this._t(this._settings.cut ? "settings.cut_on" : "settings.cut_off")}</div></div>
    </div></ha-card>`;
  }
}

if (!customElements.get("thermal-printer-notes-card")) customElements.define("thermal-printer-notes-card", ThermalPrinterNotesCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "thermal-printer-notes-card")) {
  const language = detectLanguage();
  window.customCards.push({ type: "thermal-printer-notes-card", name: translate(language, "card.name"), description: translate(language, "card.description"), preview: true });
}
