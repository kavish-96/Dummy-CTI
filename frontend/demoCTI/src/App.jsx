import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { callService } from './services/callService';

function App() {
  // States: 'idle', 'incoming', 'connected', 'outbound_calling'
  const [callStatus, setCallStatus] = useState('idle');
  const [currentCall, setCurrentCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [dialNumber, setDialNumber] = useState('');

  const timerRef = useRef(null);

  const lookupContact = async (phone) => {
    try {
      const response = await fetch(
        "https://dev199342.service-now.com/api/2062050/opto_cti/contact_lookup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            phone: phone
          })
        }
      );

      const data = await response.json();

      console.log("Lookup Result:", data);

      return data.result;

    } catch (error) {
      console.error("Lookup Error:", error);
      return null;
    }
  };

  useEffect(() => {
    console.log("openFrameAPI:", window.openFrameAPI);
  }, []);

  // Expose global function for Future CRM Integration
  useEffect(() => {
    window.startOutboundCall = (phone, contact_name) => {
      setDialNumber(phone);
      if (contact_name) {
        setCurrentCall({ phone, customer_name: contact_name });
      }
      callService.dialCall(phone);
      console.log(
        "CRM initiated outbound call:",
        phone
      );
      // Let the backend event trigger the actual OUTBOUND_CALLING state update,
      // but if the backend requires the client to just optimistically update, we can do it.
      // The prompt says "Result: Dialer auto-populates, Call starts automatically, UI enters Calling state"
      // Based on flow: Click Call -> Send -> Backend broadcasts outbound_call_started -> UI updates.
    };
  }, []);

  // WebSocket Connection using CallService
  useEffect(() => {
    const handleMessage = (data) => {

      console.log("Incoming data:", data);

      if (data.type === 'incoming_call') {

        console.log("SELF:", window.location.href);

        try {
          console.log("PARENT:", window.parent.location.href);
        } catch (e) {
          console.log("Cannot read parent");
        }

        try {
          console.log("TOP:", window.top.location.href);
        } catch (e) {
          console.log("Cannot read top");
        }
        // Update UI state
        setCallStatus('incoming');

        setCurrentCall({
          customer_name: data.customer_name,
          phone: data.phone,
          ticket_id: data.ticket_id
        });


        if (
          window.openFrameAPI &&
          data.contact_sys_id
        ) {
          try {
            window.openFrameAPI.openServiceNowForm({
              entity: "customer_contact",
              query: `sys_id=${data.contact_sys_id}`
            });
          } catch (err) {
            console.error("Screen pop failed", err);
          }
        }


        // Automatically open matching contact in ServiceNow
        // if (data.contact_sys_id) {
        //   window.parent.location.href =
        //     `/customer_contact.do?sys_id=${data.contact_sys_id}`;
        // }

        // Existing postMessage
        // window.parent.postMessage(
        //   {
        //     type: 'incoming_call',
        //     customer_name: data.customer_name,
        //     phone: data.phone,
        //     ticket_id: data.ticket_id
        //   },
        //   '*'
        // );


        window.postMessage(
          {
            type: "incoming_call",
            phone: data.phone,
            customer_name: data.customer_name,
            ticket_id: data.ticket_id
          },
          "*"
        );

        window.parent.parent?.postMessage(
          {
            type: 'incoming_call',
            customer_name: data.customer_name,
            phone: data.phone,
            ticket_id: data.ticket_id
          },
          '*'
        );

        console.log("Message sent to parent");
        console.log("Message sent to parent.parent");

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
    if (callStatus === 'connected' || callStatus === 'outbound_calling') {
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
    setCallStatus('connected');
    window.parent.postMessage(
      {
        type: 'call_accepted',
        phone: currentCall.phone,
        ticket_id: currentCall.ticket_id
      },
      '*'
    );
  };

  const handleReject = () => {
    window.parent.postMessage(
      {
        type: 'call_rejected',
        phone: currentCall.phone
      },
      '*'
    );
    resetCall();
  };

  const handleEndCall = () => {
    window.parent.postMessage(
      {
        type: 'call_ended',
        phone: currentCall.phone
      },
      '*'
    );
    resetCall();
  };

  const handleEndOutboundCall = () => {
    callService.endOutboundCall(currentCall.phone);
    resetCall();
  };

  const handleClear = () => {
    resetCall();
  };

  const resetCall = () => {
    setCallStatus('idle');
    setCurrentCall(null);
    setCallDuration(0);
    setDialNumber('');
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
    callService.dialCall(dialNumber);
  };

  return (
    <div className="cti-container">
      <div className="cti-card">
        <div className="cti-header">
          Agent Softphone
        </div>

        <div className="cti-body">
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
              <div className="dial-display">
                {dialNumber || <span className="placeholder">Enter Number</span>}
              </div>
              <div className="dial-pad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                  <button key={digit} className="dial-btn" onClick={() => handleDialClick(digit)}>
                    {digit}
                  </button>
                ))}
                <div className="dial-actions">
                  <button className="btn btn-call" onClick={handleInitiateCall}>Call</button>
                  <button className="btn btn-backspace" onClick={handleDialBackspace}>⌫</button>
                  <button className="btn btn-clear-dial" onClick={handleDialClear}>Clear</button>
                  <button
                    onClick={async () => {
                      const result = await lookupContact("+91 99999 99999");
                      console.log(result);
                    }}
                  >
                    Test Lookup
                  </button>
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
          {(callStatus === 'connected' || callStatus === 'outbound_calling') && (
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
        </div>
      </div>
    </div>
  );
}

export default App;
