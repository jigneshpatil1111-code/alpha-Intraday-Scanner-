/**
 * AlphaPulse IN — WebSocket Live Data Sync Client V2
 * Handles full market tick updates and data source detection
 */

class WSClient {
  constructor(endpoint, onData, onSummary) {
    this.endpoint = endpoint || `ws://${window.location.host}/api/ws/ticks`;
    this.onData = onData;
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
        console.log('[WS] Connected to live tick stream');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TICK_UPDATE') {
            if (this.onData) this.onData(data);
          }
        } catch (e) {
          console.error("WS Parse error:", e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected = false;
      };
    } catch (e) {
      this.isConnected = false;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < 10) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 3000);
    }
  }
}

window.WSClient = WSClient;
