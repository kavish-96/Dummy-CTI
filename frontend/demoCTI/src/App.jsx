import React, { useState, useEffect, useRef } from 'react';

import { callService } from './services/callService';
import { siprtcService } from './services/siprtcService';
import runtimeConfigService from './services/runtimeConfigService';


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
  // const [sipUsername, setSipUsername] = useState('sip:SIP1781071339415@phone.dev.r1.scb-global.com');
  // const [sipPassword, setSipPassword] = useState('Aneri@1234');
  const sipUsername = 'sip:SIP1782131820832@phone.dev.r1.scb-global.com';
  const sipPassword = '6975680373';
  const [registrationStatus, setRegistrationStatus] = useState('connecting');

  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      await runtimeConfigService.initialize();
    })();

    window.runtimeConfigService = runtimeConfigService;

    window.refreshRuntimeConfiguration = async () => {
      return await runtimeConfigService.refresh();
    };
  }, []);

  // Initialize SDK on mount
  useEffect(() => {
    siprtcService.initializeSDK()
      .then((success) => {

        if (!success) {
          console.log("SDK initialization failed");
          return;
        }

        console.log("SDK initialized");

        setRegistrationStatus("connecting");

        siprtcService.registerUser(
          sipUsername,
          sipPassword
        );

      })
      .catch(err => {
        console.error(
          "Failed to initialize SDK",
          err
        );
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

      if (data.type === "screen_pop_incident") {
        window.openFrameAPI.openServiceNowForm({
          entity: "incident",
          query: `sys_id=${data.incident_sys_id}`
        });
      }

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

        } catch (e) {
          console.error("Salesforce postMessage failed", e);
        }


        if (
          window.openFrameAPI && data.contact_sys_id
          // data.incident_sys_id
        ) {
          if (!runtimeConfigService.isFeatureEnabled("screen_pop")) {
            console.log("Screen Pop disabled by Portal");
          } else {
            try {
              console.log("SCREEN POP ATTEMPT", data.contact_sys_id);
              // console.log("SCREEN POP ATTEMPT", data.incident_sys_id);
              console.log(
                "openFrameAPI object",
                window.openFrameAPI
              );

              console.log("Calling openServiceNowForm...");

              window.openFrameAPI.openServiceNowForm({
                entity: "customer_contact",
                query: `sys_id=${data.contact_sys_id}`
                // entity: "incident",
                // query: `sys_id=${data.incident_sys_id}`
              });

              console.log("openServiceNowForm finished");

            } catch (err) {
              console.error("SCREEN POP ERROR", err);
            }
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
        if (!runtimeConfigService.isFeatureEnabled("click_to_call")) {
          console.log("Click-to-Call disabled by Portal");
          return;
        }

        console.log("Click-to-call event received", data);

        try {

          if (window.openFrameAPI) {

            window.openFrameAPI.show();

          }

        } catch (err) {

          console.error(
            "Failed to open CTI",
            err
          );

        }

        setCallStatus('outbound_calling');

        setCurrentCall({
          phone: data.phone,
          customer_name: data.contact_name
        });

        // setTimeout(() => {
        //   console.log(
        //     "Starting outbound call after CTI opened"
        //   );

        //   console.log(
        //     "Registration status:",
        //     registrationStatus
        //   );

        //   window.startOutboundCall(
        //     data.phone,
        //     data.contact_name
        //   );
        // }, 1000);

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
    <div className="w-full h-full p-0 m-0">
      <div className="w-full h-full bg-white rounded-none shadow-none m-0">

        <div className="p-6 flex flex-col gap-4">
          <>
            {/* Status Badge */}
            <div className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider self-center mb-2 ${callStatus === 'idle' ? 'bg-gray-100 text-gray-500 border border-gray-200' :
              callStatus === 'incoming' ? 'bg-yellow-100 text-yellow-800 animate-pulse' :
                callStatus === 'connected' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-sky-100 text-sky-800 animate-pulse'
              }`}>
              {callStatus === 'idle' && 'Idle'}
              {callStatus === 'incoming' && 'Incoming Call'}
              {callStatus === 'connected' && 'Connected'}
              {callStatus === 'outbound_calling' && 'Calling...'}
            </div>

            {/* Call Information or Idle Text */}
            {callStatus === 'idle' ? (
              <div className="flex flex-col">
                <input
                  type="text"
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-2xl font-medium text-center mb-6 text-gray-800 w-full box-border outline-none transition-all duration-200 shadow-inner focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20 placeholder-gray-400 tracking-wide"
                  placeholder="Enter Number"
                  value={dialNumber}
                  onChange={(e) => setDialNumber(e.target.value)}
                />
                <div className="grid grid-cols-3 gap-y-4 gap-x-6 justify-items-center px-2.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                    <button key={digit} className="bg-gray-50 border border-gray-200 rounded-full w-16 h-16 flex items-center justify-center text-2xl font-semibold cursor-pointer text-gray-800 shadow-[0_4px_0_#cbd5e1,0_4px_8px_rgba(0,0,0,0.05)] transition-all duration-[50ms] outline-none hover:bg-gray-100 hover:border-slate-300 active:translate-y-[3px] active:shadow-[0_1px_0_#cbd5e1,0_1px_3px_rgba(0,0,0,0.05)]" onClick={() => handleDialClick(digit)}>
                      {digit}
                    </button>
                  ))}
                  <div className="grid grid-cols-3 gap-3 col-span-3 mt-4 w-full">
                    <button className="py-3.5 px-0 rounded-full border-none font-bold relative transition-all duration-[50ms] text-white flex items-center justify-center gap-1.5 hover:brightness-105 active:translate-y-[3px] bg-emerald-600 shadow-[0_4px_0_#047857,0_4px_8px_rgba(5,150,105,0.15)] active:shadow-[0_1px_0_#047857,0_1px_3px_rgba(5,150,105,0.1)]" onClick={handleInitiateCall}>📞 Call</button>
                    <button className="py-3.5 px-0 rounded-full border-none font-bold relative transition-all duration-[50ms] text-white flex items-center justify-center gap-1.5 hover:brightness-105 active:translate-y-[3px] bg-amber-600 shadow-[0_4px_0_#b45309,0_4px_8px_rgba(217,119,6,0.15)] active:shadow-[0_1px_0_#b45309,0_1px_3px_rgba(217,119,6,0.1)]" onClick={handleDialBackspace}>⌫</button>
                    <button className="py-3.5 px-0 rounded-full border-none font-bold relative transition-all duration-[50ms] text-white flex items-center justify-center gap-1.5 hover:brightness-105 active:translate-y-[3px] bg-slate-600 shadow-[0_4px_0_#475569,0_4px_8px_rgba(100,116,139,0.15)] active:shadow-[0_1px_0_#475569,0_1px_3px_rgba(100,116,139,0.1)]" onClick={handleDialClear}>✕</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {callStatus === 'outbound_calling' ? (
                  <>
                    <h2 className="text-xl font-semibold m-0 mb-1 text-gray-800">
                      {currentCall?.customer_name || 'Calling...'}
                    </h2>

                    <p className="text-sm text-gray-500 m-0">
                      {currentCall?.phone}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold m-0 mb-1 text-gray-800">{currentCall?.customer_name}</h2>
                    <p className="text-sm text-gray-500 m-0">{currentCall?.phone}</p>
                    {currentCall?.ticket_id && (
                      <p className="text-xs text-sky-600 mt-1.5 font-medium tracking-wide">Ticket: {currentCall.ticket_id}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Timer */}
            {(callStatus === 'connected') && (
              <div className="text-2xl font-medium text-slate-500 text-center my-2 mb-4 tabular-nums">
                {formatTime(callDuration)}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2.5">
              {callStatus === 'incoming' && (
                <>
                  <button className="p-3 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 text-white flex items-center justify-center gap-1.5 hover:brightness-110 hover:shadow-md active:scale-95 bg-emerald-600" onClick={handleAccept}>Accept</button>
                  <button className="p-3 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 text-white flex items-center justify-center gap-1.5 hover:brightness-110 hover:shadow-md active:scale-95 bg-red-600" onClick={handleReject}>Reject</button>
                </>
              )}

              {callStatus === 'connected' && (
                <button className="p-3 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 text-white flex items-center justify-center gap-1.5 hover:brightness-110 hover:shadow-md active:scale-95 bg-red-600 col-span-2" onClick={handleEndCall}>End Call</button>
              )}

              {callStatus === 'outbound_calling' && (
                <button className="p-3 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 text-white flex items-center justify-center gap-1.5 hover:brightness-110 hover:shadow-md active:scale-95 bg-red-600 col-span-2" onClick={handleEndOutboundCall}>End Call</button>
              )}

              {(callStatus === 'incoming' || callStatus === 'connected') && (
                <button className="p-3 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 text-white flex items-center justify-center gap-1.5 hover:brightness-110 hover:shadow-md active:scale-95 bg-slate-500 col-span-2" onClick={handleClear}>Clear</button>
              )}
            </div>
            {/* SDK Controls Panel */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 mt-2 flex flex-col gap-3.5">
              <div className="flex flex-col gap-2">
                <div className="text-[0.7rem] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Agent Utilities</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    className="bg-white border border-gray-200 text-gray-800 text-xs font-semibold py-2 px-0.5 rounded-lg cursor-pointer transition-all duration-150 flex items-center justify-center outline-none hover:bg-gray-100 hover:border-slate-300 active:bg-slate-200 active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:border-gray-200"
                    onClick={() => siprtcService.getAgentCurrentState()}
                    disabled={registrationStatus !== 'registered'}
                  >
                    Get State
                  </button>
                  <button
                    className="bg-white border border-gray-200 text-gray-800 text-xs font-semibold py-2 px-0.5 rounded-lg cursor-pointer transition-all duration-150 flex items-center justify-center outline-none hover:bg-gray-100 hover:border-slate-300 active:bg-slate-200 active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:border-gray-200"
                    onClick={() => siprtcService.markAvailable()}
                    disabled={registrationStatus !== 'registered'}
                  >
                    Available
                  </button>
                  <button
                    className="bg-white border border-gray-200 text-gray-800 text-xs font-semibold py-2 px-0.5 rounded-lg cursor-pointer transition-all duration-150 flex items-center justify-center outline-none hover:bg-gray-100 hover:border-slate-300 active:bg-slate-200 active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:border-gray-200"
                    onClick={() => siprtcService.increaseWrapupTime()}
                    disabled={registrationStatus !== 'registered'}
                  >
                    + Wrapup
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-[0.7rem] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Call Utilities</div>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    className="bg-white border border-gray-200 text-gray-800 text-xs font-semibold py-2 px-0.5 rounded-lg cursor-pointer transition-all duration-150 flex items-center justify-center outline-none hover:bg-gray-100 hover:border-slate-300 active:bg-slate-200 active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:border-gray-200"
                    onClick={() => siprtcService.hold()}
                    disabled={registrationStatus !== 'registered' || callStatus === 'idle'}
                  >
                    Hold
                  </button>
                  <button
                    className="bg-white border border-gray-200 text-gray-800 text-xs font-semibold py-2 px-0.5 rounded-lg cursor-pointer transition-all duration-150 flex items-center justify-center outline-none hover:bg-gray-100 hover:border-slate-300 active:bg-slate-200 active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:border-gray-200"
                    onClick={() => siprtcService.unhold()}
                    disabled={registrationStatus !== 'registered' || callStatus === 'idle'}
                  >
                    Unhold
                  </button>
                  <button
                    className="bg-white border border-gray-200 text-gray-800 text-xs font-semibold py-2 px-0.5 rounded-lg cursor-pointer transition-all duration-150 flex items-center justify-center outline-none hover:bg-gray-100 hover:border-slate-300 active:bg-slate-200 active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:border-gray-200"
                    onClick={() => siprtcService.mute()}
                    disabled={registrationStatus !== 'registered' || callStatus === 'idle'}
                  >
                    Mute
                  </button>
                  <button
                    className="bg-white border border-gray-200 text-gray-800 text-xs font-semibold py-2 px-0.5 rounded-lg cursor-pointer transition-all duration-150 flex items-center justify-center outline-none hover:bg-gray-100 hover:border-slate-300 active:bg-slate-200 active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:border-gray-200"
                    onClick={() => siprtcService.unmute()}
                    disabled={registrationStatus !== 'registered' || callStatus === 'idle'}
                  >
                    Unmute
                  </button>
                </div>
              </div>
            </div>

            {/* Agent and Call Info Section */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 border border-gray-200 leading-relaxed">
              <div className="mb-2">
                <strong className="text-gray-800 font-semibold">Agent State:</strong> {agentState || 'Unknown'}
              </div>
              <div className="mb-2 break-all">
                <strong className="text-gray-800 font-semibold">Ongoing Call Info:</strong> {ongoingCallInfo || 'None'}
              </div>
              <div>
                <strong className="text-gray-800 font-semibold">Live Transcript:</strong> {transcript || 'No live transcript available'}
              </div>
            </div>
          </>
        </div>
      </div>
    </div>
  );
}

export default App;
