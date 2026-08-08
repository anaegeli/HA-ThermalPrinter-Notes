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
      _message: { type: String },
      _messageType: { type: String },
      _userName: { type: String },
      _draft: { attribute: false },
      _history: { attribute: false },
      _settings: { attribute: false },
      _historyOpen: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
      ha-card {
        overflow: hidden;
      }
      .content {
        padding: 16px;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }
      .title {
        font-size: 20px;
        font-weight: 500;
      }
      .user {
        color: var(--secondary-text-color);
        font-size: 12px;
        white-space: nowrap;
      }
      .status-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 160px));
        gap: 6px;
        margin-bottom: 12px;
      }
      .status-chip {
        align-items: center;
        background: var(--secondary-background-color);
        border-radius: 6px;
        display: flex;
        gap: 8px;
        justify-content: space-between;
        min-width: 0;
        padding: 5px 8px;
      }
      .status-label {
        color: var(--secondary-text-color);
        font-size: 10px;
      }
      .status-value {
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .workspace-grid {
        align-items: start;
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .editor-column,
      .side-column {
        min-width: 0;
      }
      .side-column {
        display: grid;
        gap: 16px;
      }
      .field {
        margin-bottom: 12px;
      }
      label {
        color: var(--secondary-text-color);
        display: block;
        font-size: 12px;
        margin: 0 0 5px 2px;
      }
      input,
      textarea,
      select {
        box-sizing: border-box;
        width: 100%;
        color: var(--primary-text-color);
        background: var(--card-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        font: inherit;
        padding: 10px 12px;
      }
      input:focus,
      textarea:focus,
      select:focus {
        border-color: var(--primary-color);
        outline: 2px solid color-mix(in srgb, var(--primary-color) 25%, transparent);
      }
      textarea {
        min-height: 220px;
        resize: vertical;
        tab-size: 2;
        white-space: pre-wrap;
      }
      .textarea-wrap {
        position: relative;
      }
      .count {
        color: var(--secondary-text-color);
        font-size: 11px;
        margin-top: 4px;
        text-align: right;
      }
      .count.invalid {
        color: var(--error-color);
      }
      .editor-controls {
        align-items: end;
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        margin-top: 10px;
      }
      .editor-controls button {
        font-size: 12px;
        line-height: 1.2;
        padding: 7px 9px;
        width: 100%;
      }
      .compact-field {
        margin: 0;
        min-width: 0;
      }
      .compact-field select {
        min-height: 38px;
        padding: 7px 9px;
      }
      .toolbar,
      .print-row,
      .history-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 38px;
        color: var(--primary-text-color);
        background: var(--secondary-background-color);
        border: 0;
        border-radius: 8px;
        cursor: pointer;
        font: inherit;
        padding: 8px 12px;
      }
      button:hover {
        filter: brightness(0.96);
      }
      button:disabled {
        cursor: default;
        opacity: 0.55;
      }
      button.primary {
        color: var(--text-primary-color);
        background: var(--primary-color);
        font-weight: 500;
      }
      button.danger {
        color: var(--error-color);
      }
      button.icon-only {
        min-width: 38px;
        padding: 7px;
      }
      .print-row {
        justify-content: space-between;
        margin: 14px 0;
      }
      .save-state {
        color: var(--secondary-text-color);
        font-size: 12px;
      }
      .message {
        border-radius: 8px;
        margin: 10px 0;
        padding: 9px 11px;
      }
      .message.success {
        color: var(--success-color, #2e7d32);
        background: color-mix(in srgb, var(--success-color, #2e7d32) 12%, transparent);
      }
      .message.error {
        color: var(--error-color);
        background: color-mix(in srgb, var(--error-color) 12%, transparent);
      }
      .settings {
        border-top: 1px solid var(--divider-color);
        margin-top: 16px;
        padding-top: 16px;
      }
      .preview {
        min-width: 0;
      }
      .section-title {
        align-items: center;
        display: flex;
        font-size: 15px;
        font-weight: 500;
        gap: 6px;
        margin-bottom: 10px;
      }
      .paper {
        color: #111;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.12);
        min-height: 180px;
        padding: 16px;
      }
      .paper ha-markdown {
        --primary-text-color: #111;
        --secondary-text-color: #444;
      }
      .settings-text {
        color: var(--secondary-text-color);
        font-size: 12px;
        line-height: 1.6;
      }
      .history-head {
        align-items: center;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        padding: 12px;
      }
      .history-panel {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        min-width: 0;
        overflow: hidden;
      }
      .history-list {
        border-top: 1px solid var(--divider-color);
        max-height: 430px;
        overflow-y: auto;
      }
      .history-tools {
        align-items: center;
        display: flex;
        justify-content: space-between;
        padding: 10px 16px;
      }
      .history-item {
        border-top: 1px solid var(--divider-color);
        padding: 12px 16px;
      }
      .history-meta {
        align-items: flex-start;
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }
      .history-title {
        font-weight: 500;
      }
      .history-date,
      .history-preview,
      .history-options {
        color: var(--secondary-text-color);
        font-size: 12px;
      }
      .history-preview {
        margin: 6px 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .badge {
        border-radius: 10px;
        font-size: 10px;
        padding: 2px 7px;
        white-space: nowrap;
      }
      .badge.submitted {
        color: var(--success-color, #2e7d32);
        background: color-mix(in srgb, var(--success-color, #2e7d32) 14%, transparent);
      }
      .badge.failed {
        color: var(--error-color);
        background: color-mix(in srgb, var(--error-color) 14%, transparent);
      }
      .badge.saved {
        color: var(--primary-color);
        background: color-mix(in srgb, var(--primary-color) 14%, transparent);
      }
      .empty,
      .loading {
        color: var(--secondary-text-color);
        padding: 24px 16px;
        text-align: center;
      }
      @media (max-width: 780px) {
        .workspace-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 520px) {
        .editor-controls {
          grid-template-columns: 1fr;
        }
        .editor-controls button {
          width: 100%;
        }
        .head {
          align-items: flex-start;
          flex-direction: column;
        }
        .status-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
  }

  constructor() {
    super();
    this._loaded = false;
    this._busy = false;
    this._message = "";
    this._messageType = "success";
    this._userName = "";
    this._draft = this._emptyDraft();
    this._history = [];
    this._settings = {};
    this._historyOpen = true;
    this._saveTimer = undefined;
    this._savePromise = Promise.resolve();
  }

  setConfig(config) {
    if (!config) throw new Error("Karteneinstellungen fehlen");
    this._config = {
      title: "Thermodrucker",
      min_lines: 12,
      autosave_delay_ms: 500,
      ...config,
    };
  }

  set hass(hass) {
    const sessionUserId = hass?.user?.id || "";
    if (this._sessionUserId && sessionUserId !== this._sessionUserId) {
      clearTimeout(this._saveTimer);
      this._loaded = false;
      this._loading = false;
      this._draft = this._emptyDraft();
      this._history = [];
      this._settings = {};
      this._userName = "";
    }
    this._sessionUserId = sessionUserId;
    this._hass = hass;
    if (!this._loaded && !this._loading) this._loadState();
    this.requestUpdate();
  }

  getCardSize() {
    return 10;
  }

  static getStubConfig() {
    return { title: "Thermodrucker", min_lines: 12, autosave_delay_ms: 500 };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "title", selector: { text: {} } },
        { name: "min_lines", selector: { number: { min: 6, max: 30, step: 1, mode: "box" } } },
        { name: "autosave_delay_ms", selector: { number: { min: 150, max: 5000, step: 50, mode: "box", unit_of_measurement: "ms" } } },
        { name: "status_entity", selector: { entity: {} } },
        { name: "ready_entity", selector: { entity: {} } },
        { name: "queue_entity", selector: { entity: {} } },
      ],
      computeLabel: (schema) => ({
        title: "Kartentitel",
        min_lines: "Mindesthöhe der Texteingabe",
        autosave_delay_ms: "Verzögerung für automatisches Speichern",
        status_entity: "Status-Entität (optional)",
        ready_entity: "Bereit-Entität (optional)",
        queue_entity: "Warteschlangen-Entität (optional)",
      })[schema.name],
    };
  }

  _emptyDraft() {
    return { title: "", markdown: "", alignment: "left", size: "normal" };
  }

  async _request(type, extra = {}) {
    if (!this._hass?.connection) throw new Error("Home Assistant ist nicht verbunden");
    return this._hass.connection.sendMessagePromise({ type, ...extra });
  }

  async _loadState() {
    if (!this._hass?.connection || this._loading) return;
    this._loading = true;
    try {
      const state = await this._request("thermal_printer_notes/get_state");
      this._userName = state.user_name || "";
      this._draft = { ...this._emptyDraft(), ...(state.draft || {}) };
      this._history = state.history || [];
      this._settings = state.settings || {};
      this._loaded = true;
    } catch (err) {
      this._showError(err, "Daten konnten nicht geladen werden");
    } finally {
      this._loading = false;
      this.requestUpdate();
    }
  }

  _updateDraft(field, value) {
    this._draft = { ...this._draft, [field]: value };
    this._message = "";
    this._scheduleSave();
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    const configured = Number(this._config?.autosave_delay_ms ?? 500);
    const milliseconds = Number.isFinite(configured)
      ? Math.min(5000, Math.max(150, configured))
      : 500;
    this._saveTimer = setTimeout(() => this._saveDraft(false), milliseconds);
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
    const payload = this._documentPayload();
    this._saving = true;
    this.requestUpdate();
    this._savePromise = this._savePromise.then(async () => {
      const result = await this._request("thermal_printer_notes/save_draft", payload);
      if (result?.draft?.updated_at) {
        this._draft = { ...this._draft, updated_at: result.draft.updated_at };
      }
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
    if (this._printableBytes() > 4096) {
      this._showError(null, "Der Text überschreitet 4096 UTF-8-Bytes");
      return;
    }
    clearTimeout(this._saveTimer);
    this._saving = true;
    this._message = "";
    this.requestUpdate();
    try {
      try {
        await this._savePromise;
      } catch (_err) {
        this._savePromise = Promise.resolve();
      }
      const result = await this._request(
        "thermal_printer_notes/save_history",
        this._documentPayload(),
      );
      if (result?.draft?.updated_at) {
        this._draft = { ...this._draft, updated_at: result.draft.updated_at };
      }
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
    if (this._printableBytes() > 4096) {
      this._showError(null, "Der Text überschreitet 4096 UTF-8-Bytes");
      return;
    }
    clearTimeout(this._saveTimer);
    this._busy = true;
    this._message = "";
    try {
      await this._request("thermal_printer_notes/print", this._documentPayload());
      this._showMessage("Druck wurde übermittelt und im persönlichen Verlauf gespeichert");
    } catch (err) {
      this._showError(err, "Drucken fehlgeschlagen; der Versuch bleibt im Verlauf");
    }
    try {
      await this._refreshHistory();
    } catch (err) {
      this._showError(err, "Der Verlauf konnte nach dem Druck nicht aktualisiert werden");
    } finally {
      this._busy = false;
      this.requestUpdate();
    }
  }

  async _refreshHistory() {
    const state = await this._request("thermal_printer_notes/get_state");
    this._history = state.history || [];
    this._settings = state.settings || this._settings;
  }

  async _paste() {
    try {
      const text = await navigator.clipboard.readText();
      this._updateDraft("markdown", `${this._draft.markdown || ""}${text}`);
    } catch (err) {
      this._showError(err, "Zwischenablage konnte nicht gelesen werden");
    }
  }

  _clearEditor() {
    this._draft = this._emptyDraft();
    this._scheduleSave();
  }

  async _loadHistory(historyId) {
    try {
      const result = await this._request("thermal_printer_notes/history/get", {
        history_id: historyId,
      });
      const item = result.history;
      this._draft = {
        title: item.title || "",
        markdown: item.markdown || "",
        alignment: item.alignment || "left",
        size: item.size || "normal",
      };
      if (await this._saveDraft(false)) {
        this._showMessage("Verlaufseintrag in die Eingabe geladen");
        this.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (err) {
      this._showError(err, "Verlaufseintrag konnte nicht geladen werden");
    }
  }

  async _reprintHistory(historyId) {
    this._busy = true;
    try {
      await this._request("thermal_printer_notes/history/print", {
        history_id: historyId,
      });
      this._showMessage("Erneuter Druck wurde übermittelt");
    } catch (err) {
      this._showError(err, "Erneuter Druck fehlgeschlagen");
    } finally {
      try {
        await this._refreshHistory();
      } catch (err) {
        this._showError(err, "Der Verlauf konnte nicht aktualisiert werden");
      }
      this._busy = false;
      this.requestUpdate();
    }
  }

  async _deleteHistory(historyId) {
    if (!confirm("Diesen persönlichen Verlaufseintrag löschen?")) return;
    try {
      await this._request("thermal_printer_notes/history/delete", {
        history_id: historyId,
      });
      await this._refreshHistory();
    } catch (err) {
      this._showError(err, "Verlaufseintrag konnte nicht gelöscht werden");
    }
  }

  async _clearHistory() {
    if (!confirm("Deinen gesamten persönlichen Verlauf unwiderruflich löschen?")) return;
    try {
      await this._request("thermal_printer_notes/history/clear");
      this._history = [];
      this._showMessage("Dein persönlicher Verlauf wurde gelöscht");
    } catch (err) {
      this._showError(err, "Verlauf konnte nicht gelöscht werden");
    }
  }

  _showMessage(message) {
    this._message = message;
    this._messageType = "success";
    this.requestUpdate();
  }

  _showError(err, fallback) {
    this._message = err?.message ? `${fallback}: ${err.message}` : fallback;
    this._messageType = "error";
    this.requestUpdate();
  }

  _utf8Length(value) {
    return new TextEncoder().encode(value || "").length;
  }

  _previewMarkdown() {
    const title = (this._draft.title || "").trim();
    const body = this._draft.markdown || "";
    return title ? `# ${title}\n${body}` : body || "*Noch kein Text*";
  }

  _printableBytes() {
    const title = (this._draft.title || "").trim();
    const source = title ? `# ${title}\n${this._draft.markdown || ""}` : this._draft.markdown || "";
    return this._utf8Length(source);
  }

  _statusEntities() {
    return [
      ["Status", this._config?.status_entity],
      ["Bereit", this._config?.ready_entity],
      ["Warteschlange", this._config?.queue_entity],
    ].filter(([, entity]) => entity);
  }

  _renderStatus() {
    const entities = this._statusEntities();
    if (!entities.length) return "";
    return html`
      <div class="status-grid">
        ${entities.map(([label, entityId]) => {
          const state = this._hass?.states?.[entityId];
          const value = state
            ? this._hass.formatEntityState?.(state) || state.state
            : "Nicht verfügbar";
          return html`
            <div class="status-chip" title=${entityId}>
              <div class="status-label">${label}</div>
              <div class="status-value">${value}</div>
            </div>
          `;
        })}
      </div>
    `;
  }

  _formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  _statusLabel(status) {
    if (status === "saved") return "Gespeichert";
    if (status === "submitted") return "Übermittelt";
    if (status === "failed") return "Fehlgeschlagen";
    return "Wartet";
  }

  _alignmentLabel(value) {
    return { left: "Links", center: "Zentriert", right: "Rechts" }[value] || value;
  }

  _sizeLabel(value) {
    return {
      normal: "Normal",
      double_width: "Doppelte Breite",
      double_size: "Doppelte Grösse",
    }[value] || value;
  }

  _renderHistory() {
    if (!this._historyOpen) return "";
    return html`
      <div class="history-list">
        <div class="history-tools">
          <span class="history-date">Maximal ${this._settings.history_limit ?? 20} Einträge</span>
          <button class="danger" @click=${this._clearHistory} ?disabled=${!this._history.length}>
            <ha-icon icon="mdi:delete-sweep-outline"></ha-icon> Alle löschen
          </button>
        </div>
        ${this._history.length
          ? this._history.map(
              (item) => html`
                <div class="history-item">
                  <div class="history-meta">
                    <div>
                      <div class="history-title">${item.title || "Ohne Titel"}</div>
                      <div class="history-date">${this._formatDate(item.created_at)}</div>
                    </div>
                    <span class="badge ${item.status}" title=${item.error || ""}>
                      ${this._statusLabel(item.status)}
                    </span>
                  </div>
                  <div class="history-preview">${item.preview || "(leer)"}</div>
                  <div class="history-options">
                    ${this._alignmentLabel(item.alignment)} · ${this._sizeLabel(item.size)}
                  </div>
                  <div class="history-actions">
                    <button @click=${() => this._loadHistory(item.id)}>
                      <ha-icon icon="mdi:file-restore-outline"></ha-icon> Laden
                    </button>
                    <button @click=${() => this._reprintHistory(item.id)} ?disabled=${this._busy}>
                      <ha-icon icon="mdi:printer-outline"></ha-icon> Erneut drucken
                    </button>
                    <button class="icon-only danger" title="Löschen" @click=${() => this._deleteHistory(item.id)}>
                      <ha-icon icon="mdi:delete-outline"></ha-icon>
                    </button>
                  </div>
                </div>
              `,
            )
          : html`<div class="empty">Noch keine persönlichen Einträge vorhanden.</div>`}
      </div>
    `;
  }

  render() {
    if (!this._config) return html``;
    if (!this._loaded) {
      return html`<ha-card><div class="loading">Persönliche Druckdaten werden geladen …</div></ha-card>`;
    }
    const bytes = this._printableBytes();
    const minHeight = Math.max(6, Number(this._config.min_lines || 12)) * 1.45;
    return html`
      <ha-card>
        <div class="content">
          <div class="head">
            <div class="title">${this._config.title}</div>
            <div class="user"><ha-icon icon="mdi:account-outline"></ha-icon> ${this._userName}</div>
          </div>

          ${this._renderStatus()}

          ${this._message
            ? html`<div class="message ${this._messageType}">${this._message}</div>`
            : ""}

          <div class="workspace-grid">
            <div class="editor-column">
              <div class="field">
                <label for="note-title">Titel (optional)</label>
                <input
                  id="note-title"
                  maxlength="80"
                  autocomplete="off"
                  .value=${this._draft.title || ""}
                  @input=${(event) => this._updateDraft("title", event.target.value)}
                  placeholder="Titel des Ausdrucks"
                />
              </div>

              <div class="field">
                <label for="note-markdown">Markdown-Text</label>
                <div class="textarea-wrap">
                  <textarea
                    id="note-markdown"
                    autocomplete="off"
                    style=${`min-height:${minHeight}em`}
                    .value=${this._draft.markdown || ""}
                    @input=${(event) => this._updateDraft("markdown", event.target.value)}
                    placeholder="# Überschrift\nDein Text …"
                  ></textarea>
                </div>
                <div class="count ${bytes > 4096 ? "invalid" : ""}">${bytes} / 4096 UTF-8-Bytes</div>
              </div>

              <div class="editor-controls">
                <button @click=${this._paste}>
                  <ha-icon icon="mdi:content-paste"></ha-icon> Einfügen
                </button>
                <button
                  @click=${this._saveToHistory}
                  ?disabled=${this._saving || this._busy || bytes > 4096}
                >
                  <ha-icon icon="mdi:content-save-outline"></ha-icon> Speichern
                </button>
                <button class="danger" @click=${this._clearEditor}>
                  <ha-icon icon="mdi:eraser"></ha-icon> Eingabe leeren
                </button>
                <div class="compact-field">
                  <label for="note-alignment">Ausrichtung</label>
                  <select
                    id="note-alignment"
                    .value=${this._draft.alignment}
                    @change=${(event) => this._updateDraft("alignment", event.target.value)}
                  >
                    <option value="left">Links</option>
                    <option value="center">Zentriert</option>
                    <option value="right">Rechts</option>
                  </select>
                </div>
                <div class="compact-field">
                  <label for="note-size">Schriftgrösse</label>
                  <select
                    id="note-size"
                    .value=${this._draft.size}
                    @change=${(event) => this._updateDraft("size", event.target.value)}
                  >
                    <option value="normal">Normal</option>
                    <option value="double_width">Doppelte Breite</option>
                    <option value="double_size">Doppelte Grösse</option>
                  </select>
                </div>
              </div>

              <div class="print-row">
                <span class="save-state">${this._saving ? "Wird gespeichert …" : "Automatisch gespeichert"}</span>
                <button class="primary" @click=${this._print} ?disabled=${this._busy || bytes > 4096}>
                  <ha-icon icon="mdi:printer"></ha-icon>
                  ${this._busy ? "Wird gedruckt …" : "Drucken"}
                </button>
              </div>
            </div>

            <div class="side-column">
              <div class="preview">
                <div class="section-title"><ha-icon icon="mdi:eye-outline"></ha-icon> Druckvorschau</div>
                <div class="paper">
                  <ha-markdown .content=${this._previewMarkdown()}></ha-markdown>
                </div>
              </div>

              <div class="history-panel">
                <div class="history-head" @click=${() => (this._historyOpen = !this._historyOpen)}>
                  <div class="section-title" style="margin:0">
                    <ha-icon icon="mdi:history"></ha-icon> Mein Verlauf (${this._history.length})
                  </div>
                  <ha-icon icon=${this._historyOpen ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
                </div>
                ${this._renderHistory()}
              </div>
            </div>
          </div>

          <div class="settings">
            <div class="section-title"><ha-icon icon="mdi:tune-variant"></ha-icon> Zentrale Druckvorgaben</div>
            <div class="settings-text">
              ${this._settings.reverse_print ? "Rückwärtsdruck" : "Vorwärtsdruck"} ·
              ${this._settings.copies ?? 1} Exemplar(e) ·
              ${this._settings.feed_lines ?? 4} Vorschubzeilen ·
              Schneiden ${this._settings.cut ? "ein" : "aus"}
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get("thermal-printer-notes-card")) {
  customElements.define("thermal-printer-notes-card", ThermalPrinterNotesCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "thermal-printer-notes-card")) {
  window.customCards.push({
    type: "thermal-printer-notes-card",
    name: "Thermal Printer Notes",
    description: "Private Markdown-Notizen und persönlicher Druckverlauf pro Home-Assistant-Benutzer.",
    documentationURL: "https://github.com/anaegeli/HA-ThermalPrinter-Notes",
    preview: true,
  });
}
