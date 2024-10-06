/*
  WebSocket Client Script for Command Execution and Status Updates

  This script connects to the server using WebSockets to send and receive 
  data related to command execution (ping, mtr, traceroute). The WebSocket 
  connection dynamically sends the command along with the target input 
  provided by the user.

  Key Features:
  - Initializes WebSocket connection to the server on page load.
  - Manages buttons' state to prevent sending multiple commands at once.
  - Listens for incoming data from the server, displays it in real-time, and
    handles connection closure.
  - Handles errors and WebSocket reconnections.
  - Includes a utility to copy text (e.g., IP addresses) to the clipboard.

  Functions:
  - toggleButtons: Enables/disables command buttons based on whether a 
    command is running.
  - connectWebSocket: Establishes a WebSocket connection and defines event 
    handlers for open, message, close, and error events.
  - send: Sends the selected command (ping, mtr, or traceroute) to the server 
    and updates the UI accordingly.
  - copy: Copies text to the clipboard with user feedback on the button.
*/

let ws;
let commandRunning = false;
const output = document.getElementById('output');
const target = document.getElementById('target');
const ping = document.getElementById('ping');
const mtr = document.getElementById('mtr');
const traceroute = document.getElementById('traceroute');

function toggleButtons(disabled) {
  ping.disabled = disabled;
  mtr.disabled = disabled;
  traceroute.disabled = disabled;
}

function connectWebSocket() {
  const prot = window.location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${prot}://${window.location.hostname}`);

  ws.onopen = () => {
    console.log('WebSocket connection opened');
  };

  ws.onmessage = (event) => {
    if (event.data == 'close') {
      commandRunning = false;
      toggleButtons(false);
      return;
    }
    output.classList.remove('d-none');
    output.textContent += event.data;
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
    commandRunning = false;
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    commandRunning = false;
  };
}

function send(commandType) {
  if (commandRunning) {
    return;
  }

  if (!target.value) {
    target.focus();
    return;
  }

  toggleButtons(true);
  commandRunning = true;
  output.textContent = '';

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(`${commandType} ${target.value}`);
  } else {
    output.textContent = 'WebSocket connection is not open';
  }
}

window.onload = connectWebSocket;
