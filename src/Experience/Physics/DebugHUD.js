// Simple, readable telemetry panel. Same colors as the lane scoreboards
// (BowlingScreens.js): navy background, cyan text, white labels.
// Intentionally plain: one column of "label   value" lines, grouped by
// simple section headers - nothing decorative to get in the way of reading.
export default class DebugHUD {
  constructor() {
    this._lastRender = 0;
    this._minRenderGapMs = 160;
    this._visible = true;
    this._buildDom();
    this._bindToggleKey();
  }

  _buildDom() {
    const root = document.createElement("div");
    root.id = "physics-debug-hud";
    root.style.cssText = `
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 9999;
      width: 320px;
      max-height: 85vh;
      overflow-y: auto;
      background: #050c1a;
      border: 1px solid #00ffff;
      color: #ffffff;
      font-family: "Courier New", ui-monospace, monospace;
      font-size: 14px;
      line-height: 1.7;
      padding: 12px 14px;
    `;
    root.innerHTML = `
      <div style="color:#00ffff;font-weight:bold;margin-bottom:8px;">
        PHYSICS OUTPUT — <span id="pdh-status">READY</span>
      </div>
      <div id="pdh-body">waiting for throw...</div>
      <div style="margin-top:8px;color:#666;font-size:11px;">press H to hide</div>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.statusEl = root.querySelector("#pdh-status");
    this.bodyEl = root.querySelector("#pdh-body");
  }

  _bindToggleKey() {
    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "h") this.toggle();
    });
  }

  toggle() {
    this._visible = !this._visible;
    this.root.style.display = this._visible ? "block" : "none";
  }

  setStatus(text, color = "#ffffff") {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.style.color = color;
  }

// مصفوفة لتخزين القيم السابقة للمقارنة
  _previousValues = {};

  update(sections) {
    const now = performance.now();
    if (now - this._lastRender < this._minRenderGapMs) return;
    this._lastRender = now;
    if (!this.bodyEl) return;

    this.bodyEl.innerHTML = sections
      .map((section) => {
        const rows = section.rows
          .map(([label, value]) => {
            // منطق مقارنة القيمة الحالية بالسابقة
            const prev = this._previousValues[label];
            let color = "#00ffff"; // اللون الافتراضي (Cyan)
            
            // تحويل القيمة لرقم للمقارنة
            const numericVal = parseFloat(value);
            if (!isNaN(numericVal) && prev !== undefined) {
                if (numericVal > prev) color = "#00ff00"; // زيادة = أخضر
                else if (numericVal < prev) color = "#ff4444"; // نقصان = أحمر
            }
            this._previousValues[label] = numericVal;

            return `
              <div style="display:flex;justify-content:space-between; margin: 4px 0;">
                <span style="color:#aaa;">${label}</span>
                <span style="color:${color}; font-family:monospace; font-weight:bold;">${value}</span>
              </div>`;
          })
          .join("");
        
        return `
          <div style="border-top:1px solid #1a2a40; margin-top:8px; padding-top:6px;">
            <div style="color:#ff7300; font-size:11px; text-transform:uppercase; margin-bottom:4px;">
              ${section.title}
            </div>
            ${rows}
          </div>`;
      })
      .join("");
  }
}