/**
 * AlphaPulse IN — 5-Minute Interactive Candlestick + EMA + VWAP Canvas Chart
 */

class LiveChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.candles = [];
    this.trades = [];
    this.hoverIdx = -1;

    if (this.canvas) {
      this.setupInteraction();
      window.addEventListener('resize', () => this.render());
    }
  }

  setData(candles, trades = []) {
    this.candles = candles || [];
    this.trades = trades || [];
    this.render();
  }

  setupInteraction() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const count = this.candles.length;
      if (count === 0) return;

      const plotW = this.canvas.width - 70;
      const step = plotW / Math.max(1, count - 1);
      const idx = Math.round((x - 10) / step);
      this.hoverIdx = Math.max(0, Math.min(count - 1, idx));
      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverIdx = -1;
      this.render();
    });
  }

  render() {
    if (!this.canvas || !this.ctx) return;
    const canvas = this.canvas;
    const ctx = this.ctx;

    // Set internal resolution to match display size
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    if (this.candles.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Select a stock or run backtest to load 5-min chart data...', w / 2, h / 2);
      return;
    }

    const padding = { top: 25, right: 65, bottom: 35, left: 15 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Price Bounds
    let minP = Infinity;
    let maxP = -Infinity;
    this.candles.forEach(c => {
      minP = Math.min(minP, c.low, c.ema9 || c.low, c.ema15 || c.low, c.vwap || c.low);
      maxP = Math.max(maxP, c.high, c.ema9 || c.high, c.ema15 || c.high, c.vwap || c.high);
    });

    const range = Math.max(1.0, maxP - minP);
    minP -= range * 0.05;
    maxP += range * 0.05;

    const getY = (p) => padding.top + (1.0 - (p - minP) / (maxP - minP)) * plotH;
    const getX = (i) => padding.left + (i / Math.max(1, this.candles.length - 1)) * plotW;

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let g = 0; g <= 4; g++) {
      const gy = padding.top + (g / 4) * plotH;
      ctx.moveTo(padding.left, gy);
      ctx.lineTo(w - padding.right, gy);
      const priceLabel = maxP - (g / 4) * (maxP - minP);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`₹${priceLabel.toFixed(1)}`, w - padding.right + 6, gy + 3);
    }
    ctx.stroke();

    // Draw VWAP line (Golden Amber)
    this.drawLine(ctx, getX, getY, 'vwap', '#f59e0b', 2.0);

    // Draw EMA 15 line (Violet)
    this.drawLine(ctx, getX, getY, 'ema15', '#a855f7', 1.8);

    // Draw EMA 9 line (Cyan)
    this.drawLine(ctx, getX, getY, 'ema9', '#06b6d4', 2.0);

    // Draw Candlesticks
    const candleW = Math.max(2, (plotW / this.candles.length) * 0.7);
    this.candles.forEach((c, i) => {
      const cx = getX(i);
      const isUp = c.close >= c.open;
      const color = isUp ? '#10b981' : '#ef4444';

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, getY(c.high));
      ctx.lineTo(cx, getY(c.low));
      ctx.stroke();

      // Body
      const bodyTop = getY(Math.max(c.open, c.close));
      const bodyBottom = getY(Math.min(c.open, c.close));
      const bodyH = Math.max(1.5, bodyBottom - bodyTop);

      ctx.fillStyle = color;
      ctx.fillRect(cx - candleW / 2, bodyTop, candleW, bodyH);
    });

    // Draw Trade Execution Markers
    this.trades.forEach(t => {
      const entryIdx = this.candles.findIndex(c => c.time === t.entry_time);
      if (entryIdx !== -1) {
        const tx = getX(entryIdx);
        const ty = getY(t.entry_price);

        ctx.fillStyle = t.type === 'LONG' ? '#10b981' : '#ef4444';
        ctx.beginPath();
        if (t.type === 'LONG') {
          ctx.moveTo(tx, ty + 12);
          ctx.lineTo(tx - 5, ty + 22);
          ctx.lineTo(tx + 5, ty + 22);
        } else {
          ctx.moveTo(tx, ty - 12);
          ctx.lineTo(tx - 5, ty - 22);
          ctx.lineTo(tx + 5, ty - 22);
        }
        ctx.closePath();
        ctx.fill();
      }
    });

    // Hover Crosshair & Tooltip
    if (this.hoverIdx >= 0 && this.hoverIdx < this.candles.length) {
      const hc = this.candles[this.hoverIdx];
      const hx = getX(this.hoverIdx);
      const hy = getY(hc.close);

      // Crosshair lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, padding.top);
      ctx.lineTo(hx, h - padding.bottom);
      ctx.moveTo(padding.left, hy);
      ctx.lineTo(w - padding.right, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tooltip HUD at top
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(padding.left, 4, plotW, 18);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.textAlign = 'left';

      const ohlcText = `T:${hc.time.slice(-5)} | O:${hc.open} H:${hc.high} L:${hc.low} C:${hc.close} | EMA9:${hc.ema9 || '-'} EMA15:${hc.ema15 || '-'} VWAP:${hc.vwap || '-'}`;
      ctx.fillText(ohlcText, padding.left + 8, 17);
    }
  }

  drawLine(ctx, getX, getY, prop, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    let started = false;
    this.candles.forEach((c, i) => {
      if (c[prop] != null) {
        const x = getX(i);
        const y = getY(c[prop]);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.stroke();
  }
}

window.LiveChart = LiveChart;
