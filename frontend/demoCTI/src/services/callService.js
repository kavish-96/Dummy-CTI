class CallService {
  constructor() {
    this.ws = null;
    this.onMessage = null;
  }

  connect(onMessageCallback) {
    this.onMessage = onMessageCallback;
    this.ws = new WebSocket('ws://localhost:8000/ws');
    
    this.ws.onopen = () => {
      console.log('WebSocket Connected');
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onMessage) {
          this.onMessage(data);
        }
      } catch (e) {
        console.error('Error parsing message', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket Disconnected. Reconnecting...');
      setTimeout(() => this.connect(this.onMessage), 3000);
    };
  }

  dialCall(phone) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'dial_call', phone }));
    } else {
      console.warn('Cannot dial: WebSocket is not open.');
    }
  }

  endOutboundCall(phone) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end_outbound_call', phone }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export const callService = new CallService();
