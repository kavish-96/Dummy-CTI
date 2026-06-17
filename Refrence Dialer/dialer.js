/*
* How To Use:
* 1. fill in valid credentials in the config below
* 2. run the JsFiddle and enjoy
*/

// var g_client = new SiprtcWebRTCSDK("phone.siprtc.io");
var g_client = new SiprtcWebRTCSDK("wss.dev.r1.scb-global.com");
var g_remote_user
var incomingCallAudio = new window.Audio('media/phonerng.wav');
incomingCallAudio.loop = true;
// incomingCallAudio.crossOrigin = "anonymous";

var outgoingProgressCallAudio = new window.Audio('media/6rings.wav');
outgoingProgressCallAudio.loop = true;
// outgoingProgressCallAudio.crossOrigin = "anonymous";

var outgoingRBTAudio = new window.Audio('media/rbt.ogg');
outgoingRBTAudio.loop = true;
outgoingRBTAudio.type = 'audio/ogg';
// outgoingRBTAudio.crossOrigin = "anonymous";

// vars for setting worker staatus in the sdk
var workerInfo = {};
workerInfo.auth_id = "H49TC7AUSCBLXM9D5ZPW";
workerInfo.app_secret = "4OkP6h1NENKOcEv3ZMxz4XfMBhJLAukStz72NGgt";
workerInfo.base_url = "https://api.dev.r1.scb-global.com";
workerInfo.taskrouter_url = "https://taskrouter.dev.r1.scb-global.com";
workerInfo.worker_id = "WK27476C21F3164FB98E8A2C5498436ADC";
workerInfo.workspace_id = "WSBA0A49A999774C7EBE0A775D6DB655B5";
workerInfo.available_activity = "WAC7BD94C475B54D91AD079A2774FF7776";
workerInfo.unavailable_activity = "WA2FB41115EB224FCCA845D8F601D21A37";
workerInfo.wrapup_activity = "WA3735F2E3FA2349B0A28F80C459553AEC";
workerInfo.record_on_demand = false;
workerInfo.recording_status_callback = "https://rbaskets.in/319yzbv";
// workerInfo.application_type = "contactcenter";
workerInfo.hold_url = "https://raw.githubusercontent.com/RajatRTC/siprtc/main/single/play/march23/playinloop.xml";
workerInfo.access_token = "";

function callbackInit(status, event) {
  console.log("Call_Status_in_dialer " + status);
  console.log("Call_Events_In_Dialer" + "- " + status, event.status, event);
  switch (status) {
    /* Server status */
    case 'connected':
      $('#registerInfoText').html("Connected");
      break;

    case 'disconnected':
      $('#registerInfoText').html("Disconnected");
      console.log('in_disconnected');
      break;

    case 'connecting':
      $('#registerInfoText').html("Connecting...");
      break;

    case 'registration_failed':
      $('#registerInfoText').html("Register Failed");
      break;

    case 'registered':
    case 'unregistered':
      updateUI();
      break;

    /* Call status */
    case 'outgoingcall':
      $('#callInfoNumber').html(event.remoteuser);
      $('#callInfoText').html('Progress Tone...');
      $('#callStatus').show();
      $('#callControl').hide();
      outgoingProgressCallAudio.play();
      break;

    case 'incomingcall':
      $('#incomingCallNumber').html(event.remoteuser);
      $('#incomingCall').show();
      $('#callControl').hide();
      $('#incomingCall').show();
      break;

    case 'progress':
      $('#callInfoText').html('Ringing...');
      $('#callStatus').show();
      $('#callControl').hide();
      outgoingProgressCallAudio.pause();
      outgoingRBTAudio.play();
      break;

    case 'failed':
      console.log('infailed');
    case 'ended':
      console.log("ws_notify_call_ended", event);
      console.log('inended');
      $('#incomingCall').hide();
      $('#callControl').show();
      $('#callStatus').hide();
      $('#inCallButtons').hide();
      incomingCallAudio.pause();
      outgoingProgressCallAudio.pause();
      outgoingRBTAudio.pause();
      break;

    case 'confirmed':
      console.log("ws_notify_call_started", event);
      // show call data on frontend
      const callInfocontainer = document.getElementById('currentOngoingCallInfo');
      console.log("ws_notify_call_started", event);
      callInfocontainer.innerHTML = JSON.stringify(event);
      $('#callStatus').show();
      $('#incomingCall').hide();
      $('#callInfoText').html('In Call');
      $('#callInfoNumber').html(event.remoteuser);
      $('#inCallButtons').show();
      incomingCallAudio.pause();
      outgoingProgressCallAudio.pause();
      outgoingRBTAudio.pause();
      break;

    case 'accepted':
      break;

    case 'ringing':
      incomingCallAudio.play();
      break;

    case 'unmuted':
      $('#muteAgent').show();
      $('#unmuteAgent').hide();
      // $('#muteIcon').removeClass('fa-microphone-slash');
      // $('#muteIcon').addClass('fa-microphone');
      break;

    case 'muted':
      $('#muteAgent').hide();
      $('#unmuteAgent').show();
      // $('#muteIcon').addClass('fa-microphone-slash');
      // $('#muteIcon').removeClass('fa-microphone');
      break;

    case 'addAgent':
      if (event.status == "failed") {
        $('#muteSupervisor').hide();
      } else {
        $('#muteSupervisor').show();
      }
      break;

    case 'agentCurrentState':
      if (event.status === "success") {
        const stateContainer = document.getElementById('showAgentState');
        stateContainer.innerHTML = event.activity_name;
        stateContainer.title = event.activity_name;
        console.log("ws_notify_agent_current_state", event.activity_name);
      }
      break;

    case 'liveTranscript':
      if (event.status === "success") {
        const chatMessage = document.getElementById('transcription');
        chatMessage.innerHTML = event.transcript;
        console.log("ws_notify_live_transcript", event.transcript);
      }
      break;

    case 'newWhatsappMessage':
      if (event.status === "success") {
        const chatMessage = document.getElementById('whatsappMsg');
        chatMessage.innerHTML = event.data.message;
        console.log("ws_notify_live_transcript", event.data);
      }
      break;

    case 'whatsappDelivery':
      if (event.status === "success") {
        console.log("outbound whatsapp delivery", event.data);
        const chatMessage = document.getElementById('whatsappMsg');
        chatMessage.innerHTML = event.data;
      }
      break;

    case 'newEmail':
      if (event.status === "success") {
        const emailBody = document.getElementById('newEmailBody');
        emailBody.innerHTML = event.data.message;
        console.log("recived email body", event.data);
      }
      break;

    case 'newSmsText':
      if (event.status === "success") {
        const chatMessage = document.getElementById('smsText');
        chatMessage.innerHTML = event.data.message;
        console.log("ws_notify_live_transcript", event.data);
      }
      break;

    case 'transfer':
      break;

    default:
    // code block
  }
}

console.log(g_client.Version());

updateUI();

$('#unregisterUser').click(function () {
  g_client.UnInitialize();
});

// for (i=201;i<=300;i++){
//   var lclient = new SiprtcWebRTCSDK("phone.siprtc.io");
//   console.log(users[0]);
//   ret = lclient.Initialize("sip:siprt_user_test_"+i+"@phone.siprtc.io", "Tiger1234", callback)
//   if (ret != "success"){
//     console.log("Failed",ret);
//   }
// }

// start hold / unhold
$('#unhold').hide();

$('#hold').click(function () {
  console.log('hold press');
  $('#hold').hide();
  $('#unhold').show();
  // const callId = 987654321;
  g_client.isHold('hold');
});

$('#unhold').click(function () {
  $('#unhold').hide();
  $('#hold').show();
  // const callId = 987654321;
  g_client.isHold('unhold');
});

// start recording
$('#stopRecording').hide();
$('#startRecording').click(function () {
  $('#startRecording').hide();
  $('#stopRecording').show();
  g_client.record('start');
});

$('#callHold').click(function () {
  g_client.Hold();
});

$('#callUnHold').click(function () {
  g_client.Unhold();
});

// stop recording
$('#stopRecording').click(function () {
  $('#stopRecording').hide();
  $('#startRecording').show();
  g_client.record('stop');
});

// pause recording
$('#resumeRecording').hide();

$('#pauseRecording').click(function () {
  $('#pauseRecording').hide();
  $('#resumeRecording').show();
  g_client.record('pause');
});

// resume recording
$('#resumeRecording').click(function () {
  $('#resumeRecording').hide();
  $('#pauseRecording').show();
  g_client.record('resume');
});

// mute unmute Supervisor
$('#unMuteSupervisor').hide();

$('#muteSupervisor').hide();

$('#muteSupervisor').click(function () {
  $('#muteSupervisor').hide();
  $('#unMuteSupervisor').show();
  g_client.muteAgent('mute');
});

$('#unMuteSupervisor').click(function () {
  $('#unMuteSupervisor').hide();
  $('#muteSupervisor').show();
  const agentCallSid = "gje849t45t3493249";
  g_client.muteAgent('unmute', agentCallSid);
});

// add user
$('#addUser').click(function () {
  $('#muteSupervisor').show();
  // const agentToAdd = 'hariom1722494150360';
  const agentToAdd = 'SIP1739356090615';
  g_client.addAgent(agentToAdd);
});

// transfer call
$('#transfer').click(function () {
  // const agentToTransfer = "hariom1722494150360"; // sonu
  const agentToTransfer = "SIP1739356090615"; // sonu
  // const agentToTransfer = "+14794487016"; // viany
  // const agentToTransfer = "+18726271073"; // viany
  // const agentToTransfer = "SIP1764070541196"; // sami
  // const agentToTransfer = "SIP1730795154518"; // ravi
  g_client.transfer(agentToTransfer);
});

// get Participants
$('#getParticipants').click(function () {
  g_client.participants();
});

// get Participants
$('#sendWhatsapp').click(function () {
  const channel = "whatsapp";
  const to = $('#customerWhatsappNumber').val();
  const from = "447860054408";
  const message = $('#whatsappTextToSend').val();
  g_client.sendMessage(channel, to, from, message);
});

// remmove participant
$('#removeCallParticipant').click(function () {
  const callSid = $('#removeParticipantCallSID').val();
  const teamsDid = $('#removeParticipantTeamsDid').val();
  const payload = {
    participantCallSid: callSid,
    participantTeamsDid: teamsDid
  }
  g_client.removeCoworkerFromCall(payload);
});

// queue transfer
$('#queueTransfer').click(function () {
  const taskSID = $('#taskSID').val();
  const queueSid = $('#queueSid').val();
  const taskChannel = $('#taskChannel').val();
  const taskConversationSid = $('#taskConversationSid').val();

  const payload = {
    taskSID: taskSID,
    queueSid: queueSid,
    taskChannel: taskChannel, // voice, sms, whatsapp, email
    taskConversationSid: taskConversationSid // for non voice tasks
  }
  g_client.queueTransfer(payload);
});

// change task queue
$('#changeTaskQueue').click(function () {
  const taskSID = $('#taskSID').val();
  const queueSid = $('#queueSid').val();
  const taskChannel = $('#taskChannel').val();
  const taskConversationSid = $('#taskConversationSid').val();

  const payload = {
    taskSID: taskSID,
    queueSid: queueSid,
    taskChannel: taskChannel, // voice, sms, whatsapp, email
    taskConversationSid: taskConversationSid // for non voice tasks
  }
  g_client.changeTaskQueue(payload);
});

// supervisorIntervene
$('#supervisorIntervene').click(function () {
  const coWorkerId = $('#addedCoworkerWorkerId').val();
  const conversessionId = $('#addedConversessionId').val();
  const action = $('#intervenAction').val();
  const payload = {
    workerSid: coWorkerId,
    conversationSid: conversessionId,
    action: action
  }
  g_client.interveneInConversation(payload);
});

// add co-worker in chat
$('#addCoworkerInConversationr').click(function () {
  const coWorkerId = $('#addedCoworkerWorkerId').val();
  const conversessionId = $('#addedConversessionId').val();
  const payload = {
    workerSid: coWorkerId,
    conversationSid: conversessionId
  }
  g_client.addCoworkerInConversation(payload);
});

// remove co-worker in chat
$('#removeCoworkerInConversationr').click(function () {
  const coWorkerId = $('#addedCoworkerWorkerId').val();
  const conversessionId = $('#addedConversessionId').val();
  const payload = {
    workerSid: coWorkerId,
    conversationSid: conversessionId
  }
  g_client.removeCoworkerFromConversation(payload);
});

// transfer to co-worker
$('#transferConversationToCoworker').click(function () {
  const coWorkerId = $('#addedCoworkerWorkerId').val();
  const conversessionId = $('#addedConversessionId').val();
  const payload = {
    workerSid: coWorkerId,
    conversationSid: conversessionId
  }
  g_client.transferConversation(payload);
});

// get co-workers list
$('#getParticipantsInConversation').click(function () {
  const conversessionId = $('#addedConversessionId').val();
  g_client.getParticipantsInConversation(conversessionId);
});

// take over conversation start
$('#takeingoverConversation').click(function () {
  const coWorkerId = $('#addedCoworkerWorkerId').val();
  const conversessionId = $('#addedConversessionId').val();
  const payload = {
    workerSid: coWorkerId,
    conversationSid: conversessionId
  }
  g_client.takeoverConversation(payload);
});
// take over conversation end

// get Participants
$('#sendSms').click(function () {
  const channel = "sms";
  const to = $('#customerSmsNumber').val();
  const from = "447860054408";
  const message = $('#smsTextToSend').val();
  g_client.sendMessage(channel, to, from, message);
});

// sendEmail
$('#sendEmail').click(function () {
  const emailPayload = {
    "email": $('#customerEmail').val(),
    "subject": "Test Email 21",
    "emailBody": "This is oubound email from postman 78"
  }
  g_client.sendEmail(emailPayload);
});

// sendPrivateMessage
$('#sendPrivateMessage').click(function () {
  const coWorkerId = $('#addedCoworkerWorkerId').val();
  const conversessionId = $('#addedConversessionId').val();
  const payload = {
    workerSid: coWorkerId,
    conversationId: conversessionId,
    message: $('#privateMessage').val(),
  }
  g_client.sendPrivateMessage(payload);
});

// sendEmail
$('#sendEmailReply').click(function () {
  const emailReplyPayload = {
    "email": $('#customerReplyEmail').val(),
    "messageID": $('#emailMsgId').val(),
    "emailBody": "This is oubound email from postman 78"
  }
  g_client.sendEmailReply(emailReplyPayload);
});

// getConversation
$('#getWhtasappChatHistory').click(function () {
  const channel = "WhatsApp";
  const contact = "918081415840";
  const did = "447860054408";
  g_client.getConversation(channel, contact, did);
});

$('#getWhtasappSessionChat').click(function () {
  const channel = "WhatsApp";
  const conversationId = "conversationId";
  g_client.getSessionConversation(channel, conversationId);
});

$('#getSmsChatHistory').click(function () {
  const channel = "Sms";
  const contact = "918081415840";
  const did = "447860054408";
  g_client.getConversation(channel, contact, did);
});

$('#getSmsSessionChat').click(function () {
  const channel = "Sms";
  const conversationId = "conversationId";
  g_client.getSessionConversation(channel, conversationId);
});

//---register start ----//
$('#registerUser').click(function () {
  $('#errorMessageId').html("");
  var user = $('#usernameField').val();
  var pass = $('#passwordField').val();
  ret = g_client.Initialize(user, pass, workerInfo, callbackInit)
  if (ret != "success") {
    $('#registerInfoText').html("Register Failed");
    $('#errorMessageId').html(ret);
  } else {
    $('#registerInfoText').html("Registering...");
  }
});
//---register ends---//

$('#connectCall').click(function () {
  $('#errorMessageId').html("");
  var dest = $('#toField').val();
  var fromCallerID = $('#fromCallerID').val();
  var outboundCallerID = $('#outboundCallerID').val();
  ret = g_client.Call(dest, callbackInit, fromCallerID, true, outboundCallerID);
  if (ret != "success") {
    $('#errorMessageId').html(ret);
  }
});

$('#answer').click(function () {
  $('#errorMessageId').html("");
  ret = g_client.Answer();
  if (ret != "success") {
    $('#errorMessageId').html(ret);
  }
});

var hangup = function () {
  $('#errorMessageId').html("");
  ret = g_client.Hangup();
  if (ret != "success") {
    $('#errorMessageId').html(ret);
  }
};

$('#hangUp').click(hangup);

$('#reject').click(hangup);

$('#muteAgent').click(function () {
  console.log('agentMuteStatus', 'MUTE CLICKED');
  g_client.Mute({
    audio: true
  });
  // if (g_client.IsMuted().audio) {
  //   g_client.UnMute({
  //     audio: true
  //   });
  // } else {
  //   g_client.Mute({
  //     audio: true
  //   });
  // }
});

$('#unmuteAgent').click(function () {
  console.log('agentMuteStatus', 'UN MUTE CLICKED');
  g_client.UnMute({
    audio: true
  });
});

$('#passwordField').keypress(function (e) {
  if (e.which === 13) {
    //enter
    $('#registerUser').click();
  }
});

$('#toField').keypress(function (e) {
  if (e.which === 13) {
    //enter
    $('#connectCall').click();
  }
});

$('#inCallButtons').on('click', '.dialpad-char', function (e) {
  var $target = $(e.target);
  var value = $target.data('value');
  g_client.SendDtmf(value.toString());
});

function updateUI() {
  if (g_client.IsRegistered()) {
    $('#registerInfoText').html("Registered");
    $('#incomingCall').hide();
    $('#userCredentials').hide();
    $('#callControl').show();
    $('#callStatus').hide();
    $('#inCallButtons').hide();
  } else {
    $('#wrapper').show();
    $('#userCredentials').show();
    $('#incomingCall').hide();
    $('#callControl').hide();
    $('#callStatus').hide();
    $('#inCallButtons').hide();
  }
}

$('#setAgentActivity').click(function () {
  activity_id = workerInfo.available_activity;
  availability = "Busy";
  activity = "InACall";
  token = "eyJ0eXAiOiJKV1QiLCJub25jZSI6InpWbFJHVmhqNjVVUEMwYmZfQW5teE44ck83T3IxXzFfZ1RiaUhRWnR2M3MiLCJhbGciOiJSUzI1NiIsIng1dCI6Inp4ZWcyV09OcFRrd041R21lWWN1VGR0QzZKMCIsImtpZCI6Inp4ZWcyV09OcFRrd041R21lWWN1VGR0QzZKMCJ9.eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20iLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC8xY2Q1NzQxOC0yNWYwLTRjYzctOTY1MC1kNTMxMjAxZmZiZTQvIiwiaWF0IjoxNzMzNTc1NDkzLCJuYmYiOjE3MzM1NzU0OTMsImV4cCI6MTczMzU4Mzg3MywiYWNjdCI6MCwiYWNyIjoiMSIsImFpbyI6IkFUUUF5LzhZQUFBQUh2QnZRT3g3ZVVyTmxoM0dqcnZpQ1lReDZFd0psT0FjUWdFeUNLaWtiWWVyZVlrMytkeGtidEVvT3o1SklEU1IiLCJhbXIiOlsicHdkIl0sImFwcF9kaXNwbGF5bmFtZSI6IlNDQi1PUFRPWC1JRFMtREVWIiwiYXBwaWQiOiJhNGQ1OTQ1OC1lNjM0LTQwZTctYWY0ZC0yOGRjNTRlZmUyZGYiLCJhcHBpZGFjciI6IjEiLCJmYW1pbHlfbmFtZSI6IlRpd2FyaSIsImdpdmVuX25hbWUiOiJIYXJpb20iLCJpZHR5cCI6InVzZXIiLCJpcGFkZHIiOiI0NS4xMTQuMjE1LjEwNiIsIm5hbWUiOiJIYXJpb20gVGl3YXJpIiwib2lkIjoiNDA4NWE1NTgtNjE0NS00ZDdlLTk4NTgtYTgyMjJiZjY1YTY0IiwicGxhdGYiOiI1IiwicHVpZCI6IjEwMDMyMDAzQUU4MTVDMkMiLCJyaCI6IjEuQVRzQUdIVFZIUEFseDB5V1VOVXhJQl83NUFNQUFBQUFBQUFBd0FBQUFBQUFBQUFWQVVnN0FBLiIsInNjcCI6IkNvbnRhY3RzLlJlYWQgZW1haWwgTWFpbC5SZWFkIG9wZW5pZCBPcmdDb250YWN0LlJlYWQuQWxsIFByZXNlbmNlLlJlYWQgUHJlc2VuY2UuUmVhZC5BbGwgUHJlc2VuY2UuUmVhZFdyaXRlIHByb2ZpbGUgU3Vic2NyaXB0aW9uLlJlYWQuQWxsIFVzZXIuUmVhZCBVc2VyLlJlYWQuQWxsIFVzZXIuUmVhZEJhc2ljLkFsbCIsInN1YiI6IkRLZ0l1djd6YjBUMG5sOFpSWUd3a0J3Y05US3JrUGxuekFFd0d0dXNtTnMiLCJ0ZW5hbnRfcmVnaW9uX3Njb3BlIjoiRVUiLCJ0aWQiOiIxY2Q1NzQxOC0yNWYwLTRjYzctOTY1MC1kNTMxMjAxZmZiZTQiLCJ1bmlxdWVfbmFtZSI6Imh0aXdhcmlAc2NiLWdsb2JhbC5jb20iLCJ1cG4iOiJodGl3YXJpQHNjYi1nbG9iYWwuY29tIiwidXRpIjoiVG1NTXIxcmIxa21WcGloU2U2c2hBQSIsInZlciI6IjEuMCIsIndpZHMiOlsiYjc5ZmJmNGQtM2VmOS00Njg5LTgxNDMtNzZiMTk0ZTg1NTA5Il0sInhtc19pZHJlbCI6IjEgMTYiLCJ4bXNfc3QiOnsic3ViIjoidnJodzFuR2VramtKR0hXWGpoYS1GakVCRTNyZjFwQ3A3X3ZtUGVWUXcyVSJ9LCJ4bXNfdGNkdCI6MTU1MjM5MzIwOX0.gYjx-Zqg9hFWfHUI3A7obMXD7x0sDEDZYt9Dxzt39btMk6LT4J5g3k0wbgkHA_VPFmzCVklUr0zQsISvplXhB3uUoJzqN_UJQGWXUBQBTUeJbxEfWC-2NbQS9oHKKUAbhl8vrMzHru0dAIlhaNJwKP8gXgbNAPQVjqMiNhTamPylc2h5NKCWs3nEBorktTgfeDnPb8WezgwvBLpiYaNVcuPLWrJY-gfGw4EADNgGrWp8ZqZZu4RkCHWyaPm-YxJUn6dfxXuCDA98dLsyK9hbGSN3_-mlUfyYTrM74vaVMGKJIMBB8pbwitBljoMyIMfcFS5Dy8Ut5Aw8sLpO7s9OIg";
  azure_user_id = "4085a558-6145-4d7e-9858-a8222bf65a64";
  // g_client.setAgentActivity(activity_id, availability, activity, token, azure_user_id);
  g_client.setAgentActivity(activity_id);
});

$('#IncreaseAgentWrapupTime').click(function () {
  g_client.IncreaseAgentWrapupTime();
});

$('#getAgentCurrentState').click(function () {
  g_client.getAgentCurrentState();
});

// supervisor call control start here
// call barge
$('#callBarge').click(function () {
  const action = "barge";
  const confId = $('#supervisorWorkerCallId').val();
  const workerId = $('#supervisorWorkerId').val();
  g_client.handleSupervisorActions(action, confId, workerId);
});
// call whishper
$('#callWhishper').click(function () {
  const action = "whishper";
  const confId = $('#supervisorWorkerCallId').val();
  const workerId = $('#supervisorWorkerId').val();
  g_client.handleSupervisorActions(action, confId, workerId);
});
// call monitor
$('#callMonitor').click(function () {
  const action = "monitor";
  const confId = $('#supervisorWorkerCallId').val();
  const workerId = $('#supervisorWorkerId').val();
  g_client.handleSupervisorActions(action, confId, workerId);
});
//take over
$('#callTakeOver').click(function () {
  const action = "takeover";
  const confId = $('#supervisorWorkerCallId').val();
  const workerId = $('#supervisorWorkerId').val();
  g_client.handleSupervisorActions(action, confId, workerId);
});

// conversation take over
$('#conversationTakeOver').click(function () {
  const coWorkerId = $('#addedCoworkerWorkerId').val();
  const conversessionId = $('#addedConversessionId').val();
  const action = $('#intervenAction').val();
  const payload = {
    workerSid: coWorkerId,
    conversationSid: conversessionId,
    action: action
  }
  g_client.interveneInConversation(payload);
});
// supervisor call control ends here

// warm transfer start
$('#warmTransferConsultStart').click(function () {
  const action = "consultStart";
  const targetWorkerSid = $('#targetWorkerSid').val();
  const targetWorkerSipID = $('#targetWorkerSipID').val();
  const taskSID = $('#taskSID').val();
  g_client.warmTransfer(action, targetWorkerSid, targetWorkerSipID, taskSID);
});
$('#warmTransferConsultEnd').click(function () {
  const action = "consultEnd";
  const targetWorkerSid = $('#targetWorkerSid').val();
  const targetWorkerSipID = $('#targetWorkerSipID').val();
  g_client.warmTransfer(action, targetWorkerSid, targetWorkerSipID, "");
});
$('#warmTransferConfirmAction').click(function () {
  const action = "warmTransferConfirm";
  const targetWorkerSid = $('#targetWorkerSid').val();
  const targetWorkerSipID = $('#targetWorkerSipID').val();
  const taskSID = $('#taskSID').val();
  g_client.warmTransfer(action, targetWorkerSid, targetWorkerSipID, taskSID);
});
// warm transfer ends

// external transfer
$('#externalTansfer').click(function () {
  const payload = {
    externalContact: $('#externalContact').val()
  }
  g_client.externalTransfer(payload);
});
// callback ends

// callback start
$('#taskCallback').click(function () {
  const payload = {
    callBackId: $('#callBackId').val()
  }
  g_client.taskCallback(payload);
});
// callback ends

// accept / decline new interaction start
$('#acceptDeclineNew').click(function () {
  const newIntractionPayload = {
    taskSid: $('#incomingTaskSid').val(),
    reservationSid: $('#reservationSid').val(),
    reservationStatus: $('#reservationStatus').val()
  }
  g_client.handleIncomingInteraction(newIntractionPayload);
});
// accept / decline new interaction ends here

// accept / decline for adding interaction start here
$('#acceptDeclineAdded').click(function () {
  const addedIntractionPayload = {
    conversationId: $('#conversationId').val(),
    addedBy: $('#addedBy').val(), // only for add coworker case
    type: $('#incomingTaskVia').val(), // added / transfered
    reservationStatus: $('#reservationStatus').val() // accept / reject
  }
  g_client.handleIncomingInteraction(addedIntractionPayload);
});
// accept / decline for adding interaction ends here

// accept / decline for transfered interaction start here
$('#acceptDeclineTransfered').click(function () {
  const transferedIntractionPayload = {
    conversationId: $('#conversationId').val(),
    transferredBy: $('#transferredBy').val(), // only for transfer case
    type: $('#incomingTaskVia').val(), // added / transfered
    reservationStatus: $('#reservationStatus').val() // accept / reject
  }
  g_client.handleIncomingInteraction(transferedIntractionPayload);
});
// accept / decline for transfered interaction ends here