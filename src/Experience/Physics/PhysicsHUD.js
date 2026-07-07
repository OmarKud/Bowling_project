// Read-only physics HUD: shows live V0, Speed, Ek, Ep, F, N, Lane Zone,
// Newly Fallen, Total Fallen, Gutter Ball as colored bars with trend arrows.
// Purely visual — does not touch any physics calculation.

const STATS = [
  { key: "v0",          label: "V0 ",   unit: "m/s",  color: "#4FC3F7", max: 30  },
  { key: "speed",       label: "Speed",                unit: "m/s",  color: "#29B6F6", max: 30  },
  { key: "Ek",          label: "Ek ",       unit: "J",    color: "#FFB74D", max: 150 },
  { key: "Ep",          label: "Ep ",        unit: "J",    color: "#FF8A65", max: 150 },
  { key: "pushForce",   label: "Push Force",           unit: "N",    color: "#FF7043", max: 600 },
  { key: "F",           label: "F ",           unit: "N",    color: "#BA68C8", max: 40  },
  { key: "N",           label: "N ",   unit: "N",    color: "#9575CD", max: 80  },
  { key: "laneZone",    label: "Lane Zone",            unit: "",     color: "#4DB6AC", max: 1   },
  { key: "totalFallen", label: "Total Fallen",         unit: "pins", color: "#66BB6A", max: 10  },
];

export default class PhysicsHUD {
  constructor() {
    this.prevValues = {};
    STATS.forEach((s) => (this.prevValues[s.key] = 0));
    this.prevGutter = false;

    this._injectStyles();
    this._buildDom();
  }

  _injectStyles() {
    if (document.getElementById("physics-hud-style")) return;
    const style = document.createElement("style");
    style.id = "physics-hud-style";
    style.textContent = `
      #physics-hud {
        position: fixed;
        top: 12px;
        left: 12px;
        z-index: 999;
        width: 260px;
        padding: 12px 14px;
        background: rgba(20, 22, 28, 0.82);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
        color: #eee;
        backdrop-filter: blur(6px);
        user-select: none;
      }
      #physics-hud h3 {
        margin: 0 0 10px 0;
        font-size: 12px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #999;
        font-weight: 600;
      }
      .phud-row {
        margin-bottom: 8px;
      }
      .phud-row-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        margin-bottom: 3px;
      }
      .phud-label {
        color: #cfcfcf;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 150px;
      }
      .phud-value-wrap {
        display: flex;
        align-items: center;
        gap: 4px;
        font-variant-numeric: tabular-nums;
      }
      .phud-value {
        font-weight: 700;
        font-size: 12px;
      }
      .phud-trend {
        font-size: 10px;
        width: 10px;
        display: inline-block;
        text-align: center;
      }
      .phud-trend.up { color: #66d97a; }
      .phud-trend.down { color: #ff6b6b; }
      .phud-trend.flat { color: #666; }
      .phud-bar-bg {
        width: 100%;
        height: 6px;
        border-radius: 4px;
        background: rgba(255,255,255,0.08);
        overflow: hidden;
      }
      .phud-bar-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.15s ease-out, background 0.3s ease-out;
      }
      .phud-gutter {
        margin-top: 10px;
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        text-align: center;
        background: rgba(255,255,255,0.06);
        color: #888;
        transition: all 0.15s ease-out;
      }
      .phud-gutter.active {
        background: rgba(255, 82, 82, 0.25);
        color: #ff6b6b;
      }
    `;
    document.head.appendChild(style);
  }

  _buildDom() {
    const root = document.createElement("div");
    root.id = "physics-hud";

    const title = document.createElement("h3");
    title.textContent = "Physics Live";
    root.appendChild(title);

    this.rows = {};

    STATS.forEach((s) => {
      const row = document.createElement("div");
      row.className = "phud-row";

      const top = document.createElement("div");
      top.className = "phud-row-top";

      const label = document.createElement("span");
      label.className = "phud-label";
      label.textContent = s.label;

      const valueWrap = document.createElement("span");
      valueWrap.className = "phud-value-wrap";

      const trend = document.createElement("span");
      trend.className = "phud-trend flat";
      trend.textContent = "•";

      const value = document.createElement("span");
      value.className = "phud-value";
      value.style.color = s.color;
      value.textContent = `0 ${s.unit}`;

      valueWrap.appendChild(trend);
      valueWrap.appendChild(value);
      top.appendChild(label);
      top.appendChild(valueWrap);

      const barBg = document.createElement("div");
      barBg.className = "phud-bar-bg";
      const barFill = document.createElement("div");
      barFill.className = "phud-bar-fill";
      barFill.style.width = "0%";
      barFill.style.background = s.color;
      barBg.appendChild(barFill);

      row.appendChild(top);
      row.appendChild(barBg);
      root.appendChild(row);

      this.rows[s.key] = { trend, value, barFill };
    });

    const gutter = document.createElement("div");
    gutter.className = "phud-gutter";
    gutter.textContent = "Gutter Ball: NO";
    root.appendChild(gutter);
    this.gutterEl = gutter;

    document.body.appendChild(root);
  }

  update(stats) {
    if (!stats) return;

    STATS.forEach((s) => {
      const raw = stats[s.key] !== undefined ? stats[s.key] : 0;
      const currentNum = parseFloat(raw);
      const isText = isNaN(currentNum); // (OIL, DRY, GUTTER)
      
      const prev = this.prevValues[s.key];
      const row = this.rows[s.key];

      row.trend.classList.remove("up", "down", "flat");

      if (isText) {
        // Lane Zone (OIL, DRY, GUTTER) as text with colored bar
        const textValue = String(raw).toUpperCase();
        row.trend.textContent = "•";
        row.trend.classList.add("flat");
        row.value.textContent = textValue;
        
        row.barFill.style.width = "100%"; 
        if (textValue === "OIL") {
            row.barFill.style.background = "#4FC3F7";
            row.value.style.color = "#4FC3F7";
        } else if (textValue === "DRY") {
            row.barFill.style.background = "#FFB74D"; 
            row.value.style.color = "#FFB74D";
        } else if (textValue === "GUTTER") {
            row.barFill.style.background = "#FF5252";
            row.value.style.color = "#FF5252";
        }

      } else {
        // Numeric stats (V0, Speed, Ek, Ep, F, N, Push Force, Total Fallen)
        const displayValue = currentNum.toFixed(2);

        if (currentNum - prev > 0.001) {
          row.trend.textContent = "▲";
          row.trend.classList.add("up");
        } else if (prev - currentNum > 0.001) {
          row.trend.textContent = "▼";
          row.trend.classList.add("down");
        } else {
          row.trend.textContent = "•";
          row.trend.classList.add("flat");
        }

        row.value.textContent = `${displayValue} ${s.unit}`;
        row.value.style.color = s.color; 

        const pct = Math.max(0, Math.min(1, currentNum / s.max)) * 100;
        row.barFill.style.width = `${pct}%`;
        row.barFill.style.background = s.color;
      }

      this.prevValues[s.key] = isText ? raw : currentNum;
    });

    const isGutter = !!stats.isGutter;
    if (isGutter !== this.prevGutter) {
      this.gutterEl.classList.toggle("active", isGutter);
      this.gutterEl.textContent = isGutter ? "Gutter Ball: YES" : "Gutter Ball: NO";
      this.prevGutter = isGutter;
    }
  }
}