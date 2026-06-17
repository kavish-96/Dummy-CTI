import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { callService } from './services/callService';
import { siprtcService } from './services/siprtcService';

function App() {
  // States: 'idle', 'incoming', 'connected', 'outbound_calling'
  const [callStatus, setCallStatus] = useState('idle');
  const [currentCall, setCurrentCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [dialNumber, setDialNumber] = useState('');
  const [agentState, setAgentState] = useState('');
  const [ongoingCallInfo, setOngoingCallInfo] = useState('');
  const [transcript, setTranscript] = useState('');

  // SIP Registration States
  // const [sipUsername, setSipUsername] = useState('');
  // const [sipPassword, setSipPassword] = useState('');
  const [sipUsername, setSipUsername] =
    useState('sip:SIP1781071339415@phone.dev.r1.scb-global.com');

  const [sipPassword, setSipPassword] =
    useState('Aneri@1234');
  const [registrationStatus, setRegistrationStatus] = useState('unregistered');

  const timerRef = useRef(null);

  // Initialize SDK on mount
  useEffect(() => {
    siprtcService.initializeSDK().then((success) => {
      if (success) {
        console.log('SipRTC initialization successful');
      } else {
        console.log('SipRTC initialization failed');
      }
    }).catch(err => {
      console.error('Failed to initialize SDK', err);
    });
  }, []);

  // Listen for SDK Registration Events
  useEffect(() => {
    siprtcService.onEvent((status, event) => {
      switch (status) {
        case 'connecting':
          console.log('[SDK] Connecting');
          setRegistrationStatus('connecting');
          break;
        case 'connected':
          console.log('[SDK] Connected');
          setRegistrationStatus('connected');
          break;
        case 'registered':
          console.log('[SDK] Registered');
          setRegistrationStatus('registered');
          break;
        case 'registration_failed':
          console.log('[SDK] Registration Failed');
          setRegistrationStatus('registration_failed');
          break;
        case 'disconnected':
          console.log('[SDK] Disconnected');
          setRegistrationStatus('disconnected');
          break;
        case 'unregistered':
          console.log('[SDK] Unregistered');
          setRegistrationStatus('unregistered');
          break;
        case 'ringing':
          setCallStatus('outbound_calling');
          if (event && event.remoteuser) {
            setCurrentCall({ phone: event.remoteuser });
          }
          break;
        case 'incomingcall':
          setCallStatus('incoming');
          if (event && event.remoteuser) {
            setCurrentCall({ phone: event.remoteuser });
          }
          break;
        case 'confirmed':
          setCallStatus('connected');
          if (event) {
            setOngoingCallInfo(JSON.stringify(event));
          }
          break;
        case 'ended':
        case 'failed':
        case 'cancelled':
        case 'rejected':
          resetCall();
          break;
        case 'agentCurrentState':
          if (event && event.activity_name) setAgentState(event.activity_name);
          break;
        case 'liveTranscript':
          if (event && event.transcript) setTranscript(event.transcript);
          break;
        default:
          break;
      }
    });
  }, []);

  const handleRegister = () => {
    if (!sipUsername || !sipPassword) return;
    setRegistrationStatus('connecting');
    console.log('[SDK] Connecting');
    siprtcService.registerUser(sipUsername, sipPassword);
  };

  // Expose global function for Future CRM Integration
  useEffect(() => {
    window.startOutboundCall = (phone, contact_name) => {
      setDialNumber(phone);
      console.log(
        "CRM initiated outbound call:",
        phone
      );
      console.log('[SDK] Calling ...');
      siprtcService.call(phone);
    };
  }, []);

  // WebSocket Connection using CallService
  useEffect(() => {
    const handleMessage = (data) => {

      console.log(
        "BUILD CHECK v7",
        new Date().toISOString()
      );
      console.log(
        "Incoming data:",
        data,
        "BUILD:",
        data.build
      );

      if (data.type === 'incoming_call') {

        // Update UI state
        setCallStatus('incoming');

        setCurrentCall({
          customer_name: data.customer_name,
          phone: data.phone,
          ticket_id: data.ticket_id
        });

        try {

          window.parent.postMessage(
            {
              type: "incoming_call",
              phone: data.phone,
              customer_name: data.customer_name,
              ticket_id: data.ticket_id
            },
            "*"
          );

          console.log("Salesforce message sent");

        } catch (e) {
          console.error("Salesforce postMessage failed", e);
        }


        if (
          window.openFrameAPI &&
          data.incident_sys_id
          // data.contact_sys_id
        ) {
          try {
            // console.log("SCREEN POP ATTEMPT", data.contact_sys_id);

            console.log("SCREEN POP ATTEMPT", data.incident_sys_id);
            console.log(
              "openFrameAPI object",
              window.openFrameAPI
            );

            console.log(
              "openServiceNowForm",
              window.openFrameAPI.openServiceNowForm
            );

            window.openFrameAPI.openServiceNowForm({
              // entity: "customer_contact",
              // query: `sys_id=${data.contact_sys_id}`
              entity: "customer_incident",
              query: `sys_id=${data.incident_sys_id}`

            });

            console.log("openServiceNowForm called");

          } catch (err) {
            console.error("SCREEN POP ERROR", err);
          }
        }

      } else if (data.type === 'outbound_call_started') {
        setCallStatus('outbound_calling');
        setCurrentCall(prev => ({
          ...prev,
          phone: data.phone
        }));
      } else if (data.type === 'outbound_call_ended') {
        if (currentCall && currentCall.phone === data.phone) {
          resetCall();
        }
      } else if (data.type === 'dial_call') {
        console.log("Click-to-call event received", data);

        setCurrentCall({
          phone: data.phone,
          customer_name: data.contact_name
        });

        window.startOutboundCall(
          data.phone,
          data.contact_name
        );
      }
    };

    callService.connect(handleMessage);

    return () => {
      callService.disconnect();
      clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer effect for connected/outbound calls
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setCallDuration(0);
    }

    return () => clearInterval(timerRef.current);
  }, [callStatus]);

  // Format timer (MM:SS)
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleAccept = () => {
    // SDK method maps to Answer
    const ret = siprtcService.answer();
    if (ret === "success") {
      window.parent.postMessage(
        {
          type: 'call_accepted',
          phone: currentCall?.phone,
          ticket_id: currentCall?.ticket_id
        },
        '*'
      );
    }
  };

  const handleReject = () => {
    // SDK method maps to Reject
    const ret = siprtcService.reject();
    if (ret === "success") {
      window.parent.postMessage(
        {
          type: 'call_rejected',
          phone: currentCall?.phone
        },
        '*'
      );
    }
  };

  const handleEndCall = () => {
    // SDK method maps to Hangup
    const ret = siprtcService.hangup();
    if (ret === "success") {
      window.parent.postMessage(
        {
          type: 'call_ended',
          phone: currentCall?.phone
        },
        '*'
      );
    }
  };

  const handleEndOutboundCall = () => {
    // SDK method maps to Hangup
    siprtcService.hangup();
  };

  const handleClear = () => {
    resetCall();
  };

  const resetCall = () => {
    setCallStatus('idle');
    setCurrentCall(null);
    setCallDuration(0);
    setDialNumber('');
    setOngoingCallInfo('');
    setTranscript('');
  };

  const handleDialClick = (digit) => {
    setDialNumber(prev => prev + digit);
  };

  const handleDialClear = () => {
    setDialNumber('');
  };

  const handleDialBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const handleInitiateCall = () => {
    if (!dialNumber) return;
    console.log('[SDK] Calling ...');
    siprtcService.call(dialNumber);
  };

  return (
    <div className="cti-container">
      <div className="cti-card">
        <div className="cti-header">
          Agent Softphone
        </div>

        <div className="cti-body">
          {registrationStatus !== 'registered' ? (
            <div className="registration-container">
              <div className="status-badge status-idle" style={{ alignSelf: 'center', marginBottom: 16 }}>
                Status: {
                  registrationStatus === 'unregistered' ? 'Unregistered' :
                    registrationStatus === 'connecting' ? 'Registering...' :
                      registrationStatus === 'registration_failed' ? 'Registration Failed' :
                        registrationStatus === 'connected' ? 'Connected (Registering...)' :
                          registrationStatus === 'disconnected' ? 'Disconnected' : registrationStatus
                }
              </div>
              <input
                type="text"
                className="sip-input"
                placeholder="SIP Username"
                value={sipUsername}
                onChange={e => setSipUsername(e.target.value)}
                disabled={registrationStatus === 'connecting' || registrationStatus === 'connected'}
              />
              <input
                type="password"
                className="sip-input"
                placeholder="SIP Password"
                value={sipPassword}
                onChange={e => setSipPassword(e.target.value)}
                disabled={registrationStatus === 'connecting' || registrationStatus === 'connected'}
              />
              <button
                className="btn btn-call"
                onClick={handleRegister}
                disabled={registrationStatus === 'connecting' || registrationStatus === 'connected'}
                style={{ marginTop: 8 }}
              >
                Register
              </button>
            </div>
          ) : (
            <>
              {/* Status Badge */}
              <div className={`status-badge status-${callStatus}`}>
                {callStatus === 'idle' && 'Idle'}
                {callStatus === 'incoming' && 'Incoming Call'}
                {callStatus === 'connected' && 'Connected'}
                {callStatus === 'outbound_calling' && 'Calling...'}
              </div>

              {/* Call Information or Idle Text */}
              {callStatus === 'idle' ? (
                <div className="dial-container">
                  <input
                    type="text"
                    className="dial-input"
                    placeholder="Enter DID Number"
                    value={dialNumber}
                    onChange={(e) => setDialNumber(e.target.value)}
                  />
                  <div className="dial-pad">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                      <button key={digit} className="dial-btn" onClick={() => handleDialClick(digit)}>
                        {digit}
                      </button>
                    ))}
                    <div className="dial-actions">
                      <button className="btn btn-call" onClick={handleInitiateCall}>📞 Call</button>
                      <button className="btn btn-backspace" onClick={handleDialBackspace}>⌫</button>
                      <button className="btn btn-clear-dial" onClick={handleDialClear}>✕</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="call-info">
                  {callStatus === 'outbound_calling' ? (
                    <>
                      <h2 className="customer-name">
                        {currentCall?.customer_name || 'Calling...'}
                      </h2>

                      <p className="phone-number">
                        {currentCall?.phone}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="customer-name">{currentCall?.customer_name}</h2>
                      <p className="phone-number">{currentCall?.phone}</p>
                      {currentCall?.ticket_id && (
                        <p className="ticket-id">Ticket: {currentCall.ticket_id}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Timer */}
              {(callStatus === 'connected') && (
                <div className="timer">
                  {formatTime(callDuration)}
                </div>
              )}

              {/* Actions */}
              <div className="cti-actions">
                {callStatus === 'incoming' && (
                  <>
                    <button className="btn btn-accept" onClick={handleAccept}>Accept</button>
                    <button className="btn btn-reject" onClick={handleReject}>Reject</button>
                  </>
                )}

                {callStatus === 'connected' && (
                  <button className="btn btn-end" onClick={handleEndCall}>End Call</button>
                )}

                {callStatus === 'outbound_calling' && (
                  <button className="btn btn-end" onClick={handleEndOutboundCall}>End Call</button>
                )}

                {(callStatus === 'incoming' || callStatus === 'connected') && (
                  <button className="btn btn-clear" onClick={handleClear}>Clear</button>
                )}
              </div>
              {/* SDK Controls Panel */}
              <div className="sdk-controls-container">
                <div className="sdk-section">
                  <div className="sdk-section-title">Agent Utilities</div>
                  <div className="sdk-controls-grid grid-3">
                    <button
                      className="btn-sdk-control"
                      onClick={() => siprtcService.getAgentCurrentState()}
                      disabled={registrationStatus !== 'registered'}
                    >
                      Get State
                    </button>
                    <button
                      className="btn-sdk-control"
                      onClick={() => siprtcService.markAvailable()}
                      disabled={registrationStatus !== 'registered'}
                    >
                      Available
                    </button>
                    <button
                      className="btn-sdk-control"
                      onClick={() => siprtcService.increaseWrapupTime()}
                      disabled={registrationStatus !== 'registered'}
                    >
                      + Wrapup
                    </button>
                  </div>
                </div>

                <div className="sdk-section">
                  <div className="sdk-section-title">Call Utilities</div>
                  <div className="sdk-controls-grid grid-4">
                    <button
                      className="btn-sdk-control"
                      onClick={() => siprtcService.hold()}
                      disabled={registrationStatus !== 'registered' || callStatus === 'idle'}
                    >
                      Hold
                    </button>
                    <button
                      className="btn-sdk-control"
                      onClick={() => siprtcService.unhold()}
                      disabled={registrationStatus !== 'registered' || callStatus === 'idle'}
                    >
                      Unhold
                    </button>
                    <button
                      className="btn-sdk-control"
                      onClick={() => siprtcService.mute()}
                      disabled={registrationStatus !== 'registered' || callStatus === 'idle'}
                    >
                      Mute
                    </button>
                    <button
                      className="btn-sdk-control"
                      onClick={() => siprtcService.unmute()}
                      disabled={registrationStatus !== 'registered' || callStatus === 'idle'}
                    >
                      Unmute
                    </button>
                  </div>
                </div>
              </div>

              {/* Agent and Call Info Section */}
              <div className="agent-info-section">
                <div style={{ marginBottom: '8px' }}>
                  <strong>Agent State:</strong> {agentState || 'Unknown'}
                </div>
                <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
                  <strong>Ongoing Call Info:</strong> {ongoingCallInfo || 'None'}
                </div>
                <div>
                  <strong>Live Transcript:</strong> {transcript || 'No live transcript available'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
