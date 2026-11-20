/**
 * AlphaPulse IN — WebSocket Live Data Sync Client
 */

class WSClient {
  constructor(endpoint, onTick, onSummary) {
    this.endpoint = endpoint || `ws://${window.location.host}/api/ws/ticks`;
    this.onTick = onTick;
    this.onSummary = onSummary;
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  connect() {
    try {
      this.socket = new WebSocket(this.endpoint);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateBadge('CONNECTED', '#10b981');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TICK_UPDATE') {
            if (this.onTick) this.onTick(data.ticks);
            if (data.scanner_summary && this.onSummary) {
              this.onSummary(data.scanner_summary);
            }
          }
        } catch (e) {
          console.error("WS Parse error:", e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.updateBadge('OFFLINE / LOCAL', '#f59e0b');
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected = false;
        this.updateBadge('OFFLINE / LOCAL', '#f59e0b');
      };
    } catch (e) {
      this.isConnected = false;
      this.updateBadge('STANDALONE', '#94a3b8');
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < 5) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 3000);
    }
  }

  updateBadge(label, color) {
    const dot = document.getElementById('backend-status-dot');
    const txt = document.getElementById('backend-status-label');
    if (dot) dot.style.backgroundColor = color;
    if (txt) txt.textContent = label;
  }
}

window.WSClient = WSClient;
