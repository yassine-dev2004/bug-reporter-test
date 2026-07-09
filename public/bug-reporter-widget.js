/**
 * Bug Reporter Widget — v1.1.0
 * Drop-in embeddable bug reporting widget using Web Components (Shadow DOM).
 *
 * Usage:
 *   <script src="bug-reporter-widget.js"></script>
 *   <bug-reporter-widget
 *     project-key="YOUR_PROJECT_KEY"
 *     api-base="https://your-api-host:8081"
 *     position="bottom-right">
 *   </bug-reporter-widget>
 *
 * Attributes:
 *   project-key  (required) — Your project key from the Bug Reporter dashboard
 *   api-base     (optional) — API base URL. Default: http://localhost:8081
 *   position     (optional) — bottom-right | bottom-left | top-right | top-left. Default: bottom-right
 */
(() => {
  const PRESET_PALETTES = [
    { name: 'Amber / Sky',   accent: '#f59e0b', accent2: '#38bdf8' },
    { name: 'Rose / Violet',  accent: '#f43f5e', accent2: '#8b5cf6' },
    { name: 'Emerald / Teal', accent: '#10b981', accent2: '#14b8a6' },
    { name: 'Orange / Pink',  accent: '#f97316', accent2: '#ec4899' },
    { name: 'Lime / Cyan',    accent: '#84cc16', accent2: '#06b6d4' },
    { name: 'Red / Blue',     accent: '#ef4444', accent2: '#3b82f6' },
    { name: 'Indigo / Fuchsia', accent: '#6366f1', accent2: '#d946ef' },
    { name: 'White Mono',     accent: '#e2e8f0', accent2: '#94a3b8' },
  ];

  const PRESET_LOGOS = ['⚠', '🐛', '💬', '🛠', '📝', '🔔', '🚀', '❗', '🎯', '⚡'];

  class BugReporterWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.open = false;
      this.files = [];
      this.logoSymbol = localStorage.getItem('brw-custom-logo') || '⚠';
      this.accentColor = localStorage.getItem('brw-custom-accent') || '#f59e0b';
      this.accent2Color = localStorage.getItem('brw-custom-accent2') || '#38bdf8';
      this.paletteOpen = false;
    }

    connectedCallback() {
      this.render();
    }

    get apiBase() { return this.getAttribute('api-base') || 'http://localhost:8081'; }
    get projectKey() { return this.getAttribute('project-key') || ''; }
    get position() { return this.getAttribute('position') || 'bottom-right'; }

    esc(v) {
      return String(v ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    render() {
      this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          pointer-events: none;
          --bg: #08121f;
          --panel: rgba(10, 18, 31, .97);
          --line: rgba(255,255,255,.08);
          --text: #edf4fb;
          --muted: #9fb1c6;
          --accent: ${this.accentColor};
          --accent2: ${this.accent2Color};
          --good: #22c55e;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        }
        .host {
          position: fixed;
          inset: auto 22px 22px auto;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          pointer-events: none;
        }
        .host[data-pos="top-right"]    { inset: 22px 22px auto auto; align-items: flex-start; }
        .host[data-pos="top-left"]     { inset: 22px auto auto 22px; align-items: flex-start; justify-content: flex-start; }
        .host[data-pos="bottom-left"]  { inset: auto auto 22px 22px; justify-content: flex-start; }

        .launcher-area {
          display: flex;
          align-items: center;
          gap: 8px;
          pointer-events: auto;
        }

        .launcher {
          pointer-events: auto;
          width: 64px; height: 64px;
          border: 0; border-radius: 999px;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          color: #03111d;
          font-size: 1.45rem; font-weight: 800;
          box-shadow: 0 22px 50px rgba(0,0,0,.35);
          cursor: pointer;
          transition: transform .15s, box-shadow .15s;
          flex-shrink: 0;
        }
        .launcher:hover { transform: scale(1.08); box-shadow: 0 28px 60px rgba(0,0,0,.45); }

        /* Palette toggle button (small gear next to launcher) */
        .palette-toggle {
          pointer-events: auto;
          width: 32px; height: 32px;
          border: 0; border-radius: 999px;
          background: rgba(255,255,255,.08);
          color: var(--muted);
          font-size: .9rem;
          cursor: pointer;
          transition: background .15s, transform .15s;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
          flex-shrink: 0;
        }
        .palette-toggle:hover { background: rgba(255,255,255,.15); transform: scale(1.1); }

        /* Palette panel */
        .palette-panel {
          pointer-events: auto;
          position: absolute;
          bottom: 76px;
          right: 0;
          width: 280px;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 22px 50px rgba(0,0,0,.45);
          animation: slideUp .2s ease;
        }
        .host[data-pos="top-right"] .palette-panel,
        .host[data-pos="top-left"]  .palette-panel { bottom: auto; top: 76px; }
        .host[data-pos="bottom-left"] .palette-panel,
        .host[data-pos="top-left"]    .palette-panel { right: auto; left: 0; }

        .palette-panel h4 {
          margin: 0 0 10px 0; font-size: .82rem; color: var(--muted);
          text-transform: uppercase; letter-spacing: .08em; font-weight: 700;
        }

        .palette-presets {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
          margin-bottom: 14px;
        }
        .palette-preset-btn {
          pointer-events: auto;
          border: 1px solid var(--line); border-radius: 10px;
          background: rgba(255,255,255,.03); color: var(--text);
          padding: 7px 8px; font-size: .78rem; cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          transition: border-color .15s, background .15s;
        }
        .palette-preset-btn:hover { background: rgba(255,255,255,.07); }
        .palette-preset-btn.active { border-color: var(--accent2); background: rgba(56,189,248,.08); }
        .palette-swatch {
          width: 18px; height: 18px; border-radius: 6px; flex-shrink: 0;
        }

        /* Custom color pickers */
        .palette-custom {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
          margin-bottom: 14px;
        }
        .palette-custom label {
          display: grid; gap: 4px; color: var(--muted); font-size: .76rem;
        }
        .palette-custom input[type="color"] {
          width: 100%; height: 34px; border: 1px solid var(--line);
          border-radius: 8px; background: transparent; cursor: pointer;
          padding: 2px;
        }

        /* Logo picker */
        .logo-picker {
          margin-bottom: 10px;
        }
        .logo-options {
          display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;
        }
        .logo-btn {
          pointer-events: auto;
          width: 36px; height: 36px; border: 1px solid var(--line);
          border-radius: 10px; background: rgba(255,255,255,.03);
          font-size: 1.1rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: border-color .15s, background .15s, transform .1s;
        }
        .logo-btn:hover { background: rgba(255,255,255,.07); transform: scale(1.08); }
        .logo-btn.active { border-color: var(--accent); background: rgba(245,158,11,.1); }

        .palette-reset {
          pointer-events: auto;
          width: 100%; border: 1px solid rgba(239,68,68,.3); border-radius: 10px;
          background: rgba(239,68,68,.06); color: #fca5a5;
          padding: 7px; font-size: .78rem; cursor: pointer;
          transition: background .15s;
        }
        .palette-reset:hover { background: rgba(239,68,68,.12); }

        .panel {
          pointer-events: auto;
          width: min(92vw, 380px);
          margin: 0 14px 76px 0;
          border-radius: 22px;
          overflow: hidden;
          background: var(--panel);
          border: 1px solid var(--line);
          box-shadow: 0 22px 50px rgba(0,0,0,.35);
          animation: slideUp .2s ease;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .host[data-pos="top-right"] .panel,
        .host[data-pos="top-left"]  .panel { margin: 76px 14px 0 0; }
        .host[data-pos="bottom-left"] .panel { margin: 0 0 76px 14px; }

        header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 16px;
          background: rgba(255,255,255,.03);
          border-bottom: 1px solid rgba(255,255,255,.06);
        }
        header strong { font-size: 1rem; color: var(--text); }
        button.icon {
          background: none; border: 0;
          color: var(--muted); font-size: 1.1rem; cursor: pointer;
          padding: 4px 8px; border-radius: 8px;
          transition: background .15s;
        }
        button.icon:hover { background: rgba(255,255,255,.06); }

        form { display: grid; gap: 10px; padding: 14px 16px 16px; }
        label { display: grid; gap: 5px; color: var(--muted); font-size: .86rem; }

        input, textarea, select, button.submit {
          font: inherit;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,.04);
          color: var(--text);
          padding: 10px 11px;
          transition: border-color .15s;
        }
        input:focus, textarea:focus, select:focus { outline: none; border-color: var(--accent2); }
        option { background: #0b1424; color: var(--text); }
        textarea { min-height: 92px; resize: vertical; }

        button.submit {
          border: 0;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          color: #03111d; font-weight: 800; cursor: pointer;
          transition: opacity .15s, transform .1s;
        }
        button.submit:hover { opacity: .9; transform: translateY(-1px); }
        button.submit:active { transform: translateY(0); }

        .status {
          padding: 0 16px 14px;
          color: var(--muted); font-size: .92rem;
        }
        .status.good { color: #86efac; }
        .status.bad  { color: #fca5a5; }

        .files { padding: 0 16px 14px; color: var(--muted); font-size: .86rem; }
        .chip {
          display: inline-block; margin: 4px 6px 0 0;
          padding: 5px 9px; border-radius: 999px;
          background: rgba(255,255,255,.05);
        }
      </style>

      <div class="host" data-pos="${this.position}">
        ${this.open ? `
        <section class="panel">
          <header>
            <strong>Report a problem</strong>
            <button class="icon" data-close type="button" aria-label="Close">✕</button>
          </header>
          <form id="report-form">
            <label>Username <input name="username" placeholder="Optional (anonymous if blank)"></label>
            <label>Description <textarea name="description" required placeholder="Tell us what happened…"></textarea></label>
            <label>Category
              <select name="category">
                <option value="bug">🐛 Bug</option>
                <option value="error">⚠️ Error</option>
                <option value="feature">💡 Feature request</option>
                <option value="other">📝 Other</option>
              </select>
            </label>
            <label>Screenshots (optional)
              <input id="images" type="file" accept="image/*" multiple>
            </label>
            <button class="submit" type="submit">Send report</button>
          </form>
          <div class="files">
            ${this.files.length
              ? this.files.map(f => `<span class="chip">${this.esc(f.name)}</span>`).join('')
              : '<span class="chip">No files selected</span>'}
          </div>
          <div class="status" id="status">Ready.</div>
        </section>` : ''}

        ${this.paletteOpen ? `
        <div class="palette-panel" id="palette-panel">
          <h4>🎨 Logo Icon</h4>
          <div class="logo-picker">
            <div class="logo-options">
              ${PRESET_LOGOS.map(l => `
                <button class="logo-btn ${l === this.logoSymbol ? 'active' : ''}" data-logo="${l}" type="button">${l}</button>
              `).join('')}
            </div>
          </div>

          <h4>🎨 Color Palette</h4>
          <div class="palette-presets">
            ${PRESET_PALETTES.map((p, i) => `
              <button class="palette-preset-btn ${p.accent === this.accentColor && p.accent2 === this.accent2Color ? 'active' : ''}"
                      data-preset="${i}" type="button">
                <span class="palette-swatch" style="background: linear-gradient(135deg, ${p.accent}, ${p.accent2})"></span>
                ${this.esc(p.name)}
              </button>
            `).join('')}
          </div>

          <h4>Custom Colors</h4>
          <div class="palette-custom">
            <label>Primary
              <input type="color" id="custom-accent" value="${this.accentColor}">
            </label>
            <label>Secondary
              <input type="color" id="custom-accent2" value="${this.accent2Color}">
            </label>
          </div>

          <button class="palette-reset" data-reset type="button">↩ Reset to defaults</button>
        </div>
        ` : ''}

        <div class="launcher-area">
          <button class="palette-toggle" data-palette type="button" aria-label="Customize widget">⚙</button>
          <button class="launcher" data-toggle type="button" aria-label="Open bug reporter">${this.logoSymbol}</button>
        </div>
      </div>`;

      this.shadowRoot.querySelector('[data-pos]').dataset.pos = this.position;

      // Launcher toggle
      this.shadowRoot.querySelector('[data-toggle]').addEventListener('click', () => {
        this.open = !this.open;
        this.paletteOpen = false;
        this.render();
      });

      // Close button
      const close = this.shadowRoot.querySelector('[data-close]');
      if (close) close.addEventListener('click', () => { this.open = false; this.render(); });

      // File input
      const images = this.shadowRoot.querySelector('#images');
      if (images) images.addEventListener('change', e => {
        this.files = Array.from(e.target.files || []);
        this.render();
      });

      // Form submit
      const form = this.shadowRoot.querySelector('#report-form');
      if (form) form.addEventListener('submit', e => this.submit(e));

      // Palette toggle
      const paletteBtn = this.shadowRoot.querySelector('[data-palette]');
      if (paletteBtn) paletteBtn.addEventListener('click', () => {
        this.paletteOpen = !this.paletteOpen;
        this.open = false;
        this.render();
      });

      // Palette: preset buttons
      this.shadowRoot.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = PRESET_PALETTES[parseInt(btn.dataset.preset)];
          this.accentColor = p.accent;
          this.accent2Color = p.accent2;
          this.savePrefs();
          this.render();
        });
      });

      // Palette: logo buttons
      this.shadowRoot.querySelectorAll('[data-logo]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.logoSymbol = btn.dataset.logo;
          localStorage.setItem('brw-custom-logo', this.logoSymbol);
          this.render();
        });
      });

      // Palette: custom color pickers
      const customAccent = this.shadowRoot.querySelector('#custom-accent');
      const customAccent2 = this.shadowRoot.querySelector('#custom-accent2');
      if (customAccent) customAccent.addEventListener('input', e => {
        this.accentColor = e.target.value;
        this.savePrefs();
        this.render();
      });
      if (customAccent2) customAccent2.addEventListener('input', e => {
        this.accent2Color = e.target.value;
        this.savePrefs();
        this.render();
      });

      // Palette: reset
      const resetBtn = this.shadowRoot.querySelector('[data-reset]');
      if (resetBtn) resetBtn.addEventListener('click', () => {
        this.accentColor = '#f59e0b';
        this.accent2Color = '#38bdf8';
        this.logoSymbol = '⚠';
        localStorage.removeItem('brw-custom-accent');
        localStorage.removeItem('brw-custom-accent2');
        localStorage.removeItem('brw-custom-logo');
        this.render();
      });
    }

    savePrefs() {
      localStorage.setItem('brw-custom-accent', this.accentColor);
      localStorage.setItem('brw-custom-accent2', this.accent2Color);
    }

    async submit(event) {
      event.preventDefault();
      const form = new FormData(event.target);
      const report = {
        username:    form.get('username')?.toString().trim() || null,
        description: form.get('description')?.toString().trim() || null,
        category:    form.get('category')?.toString() || 'bug',
        url:         location.href,
        browser:     navigator.userAgent,
        locale:      navigator.language,
      };
      const payload = new FormData();
      payload.append('report', new Blob([JSON.stringify(report)], { type: 'application/json' }));
      this.files.forEach(file => payload.append('images', file));

      const status = this.shadowRoot.getElementById('status');
      status.textContent = 'Sending report…';
      status.className = 'status';

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${this.apiBase}/api/reports`, {
          method: 'POST',
          headers: { 'X-PROJECT-KEY': this.projectKey },
          body: payload,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const text = await response.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
        if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
        status.textContent = `✅ Report sent! Ticket #${data.id}`;
        status.className = 'status good';
        this.open = false;
        this.files = [];
        this.render();
      } catch (error) {
        let msg = error.message;
        if (error.name === 'AbortError') {
          msg = 'Request timed out. Is the API server running?';
        } else if (msg === 'Failed to fetch') {
          msg = 'Cannot reach the API server. Check that api-base is correct and the server is running.';
        }
        status.textContent = `❌ ${msg}`;
        status.className = 'status bad';
      }
    }
  }

  customElements.define('bug-reporter-widget', BugReporterWidget);
})();
