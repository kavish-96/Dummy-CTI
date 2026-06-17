class SipRTCService {
  constructor() {
    this.isInitialized = false;
    this.client = null;
    this.onEventCallback = null;
    this.workerInfo = null;
  }

  onEvent(callback) {
    this.onEventCallback = callback;
  }

  async initializeSDK() {
    await this.loadSDK();
    return this.createClient();
  }

  loadSDK() {
    if (window.SiprtcWebRTCSDK) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://mystorageaccountsdk.blob.core.windows.net/websdk/v20260318071601/release/websdkrelease.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load SDK script"));
      document.body.appendChild(script);
    });
  }

  createClient() {
    if (typeof SiprtcWebRTCSDK !== 'undefined') {
      try {
        this.client = new SiprtcWebRTCSDK("wss.dev.r1.scb-global.com");
        console.log("SDK client created");
        return true;
      } catch (error) {
        console.error("Failed to create SDK client", error);
        return false;
      }
    } else {
      console.warn("SiprtcWebRTCSDK is not defined.");
      return false;
    }
  }

  handleSDKEvent(status, event) {
    console.log("SDK EVENT:", status, event);
    if (this.onEventCallback) {
      this.onEventCallback(status, event);
    }
  }

  registerUser(username, password) {
    if (!this.client) {
      console.error("SDK client is not created yet.");
      return;
    }

    const workerInfo = {
      auth_id: "H49TC7AUSCBLXM9D5ZPW",
      app_secret: "4OkP6h1NENKOcEv3ZMxz4XfMBhJLAukStz72NGgt",
      base_url: "https://api.dev.r1.scb-global.com",
      taskrouter_url: "https://taskrouter.dev.r1.scb-global.com",
      worker_id: "WK27476C21F3164FB98E8A2C5498436ADC",
      workspace_id: "WSBA0A49A999774C7EBE0A775D6DB655B5",
      available_activity: "WAC7BD94C475B54D91AD079A2774FF7776",
      unavailable_activity: "WA2FB41115EB224FCCA845D8F601D21A37",
      wrapup_activity: "WA3735F2E3FA2349B0A28F80C459553AEC",
      record_on_demand: false,
      recording_status_callback: "https://rbaskets.in/319yzbv",
      hold_url: "https://raw.githubusercontent.com/RajatRTC/siprtc/main/single/play/march23/playinloop.xml",
      access_token: ""
    };

    this.workerInfo = workerInfo;

    const ret = this.client.Initialize(username, password, workerInfo, this.handleSDKEvent.bind(this));
    return ret;
  }

  call(destination) {
    if (!this.client) {
      console.error("SDK client is not created yet.");
      return;
    }
    console.log(`[SDK] Calling: ${destination}`);
    // Match reference dialer parameters: dest, callbackInit, fromCallerID, isVideo, outboundCallerID
    const ret = this.client.Call(destination, this.handleSDKEvent.bind(this), "", true, "");
    if (ret !== "success") {
      console.error("Call Failed", ret);
    }
    return ret;
  }

  register() {
    console.log('SipRTCService: register() placeholder called');
  }

  hold() {
    if (!this.client) return;
    console.log('[SDK] Hold');
    this.client.Hold();
  }

  unhold() {
    if (!this.client) return;
    console.log('[SDK] Unhold');
    this.client.Unhold();
  }

  mute() {
    if (!this.client) return;
    console.log('[SDK] Mute');
    this.client.Mute({ audio: true });
  }

  unmute() {
    if (!this.client) return;
    console.log('[SDK] Unmute');
    this.client.UnMute({ audio: true });
  }

  getAgentCurrentState() {
    if (!this.client) return;
    console.log('[SDK] Get Agent State');
    this.client.getAgentCurrentState();
  }

  markAvailable() {
    if (!this.client || !this.workerInfo) return;
    console.log('[SDK] Mark Available');
    this.client.setAgentActivity(this.workerInfo.available_activity);
  }

  increaseWrapupTime() {
    if (!this.client) return;
    console.log('[SDK] Increase Wrapup');
    this.client.IncreaseAgentWrapupTime();
  }

  answer() {
    if (!this.client) return "error";
    console.log('[SDK] Answer');
    // SDK method maps to Answer
    return this.client.Answer();
  }

  reject() {
    if (!this.client) return "error";
    console.log('[SDK] Reject');
    // SDK method maps to Reject (which uses Hangup)
    return this.client.Hangup();
  }

  hangup() {
    if (!this.client) return "error";
    console.log('[SDK] Hangup');
    // SDK method maps to Hangup
    return this.client.Hangup();
  }

  unregister() {
    console.log('SipRTCService: unregister() placeholder called');
  }
}

export const siprtcService = new SipRTCService();
