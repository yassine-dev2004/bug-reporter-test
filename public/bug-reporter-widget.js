/**
 * Bug Reporter Widget — v1.0.0
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
  class BugReporterWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.open = false;
      this.files = [];
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
          --accent: #f59e0b;
          --accent2: #38bdf8;
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
        }
        .launcher:hover { transform: scale(1.08); box-shadow: 0 28px 60px rgba(0,0,0,.45); }

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
        <button class="launcher" data-toggle type="button" aria-label="Open bug reporter">&#9888;</button>
      </div>`;

      this.shadowRoot.querySelector('[data-pos]').dataset.pos = this.position;

      this.shadowRoot.querySelector('[data-toggle]').addEventListener('click', () => {
        this.open = !this.open;
        this.render();
      });

      const close = this.shadowRoot.querySelector('[data-close]');
      if (close) close.addEventListener('click', () => { this.open = false; this.render(); });

      const images = this.shadowRoot.querySelector('#images');
      if (images) images.addEventListener('change', e => {
        this.files = Array.from(e.target.files || []);
        this.render();
      });

      const form = this.shadowRoot.querySelector('#report-form');
      if (form) form.addEventListener('submit', e => this.submit(e));
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
        const response = await fetch(`${this.apiBase}/api/reports`, {
          method: 'POST',
          headers: { 'X-PROJECT-KEY': this.projectKey },
          body: payload,
        });
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
        status.textContent = `❌ ${error.message}`;
        status.className = 'status bad';
      }
    }
  }

  customElements.define('bug-reporter-widget', BugReporterWidget);
})();
