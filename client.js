/*
  WebSocket Client for Network Commands

  Responsibilities:
  - Connect to WebSocket server on page load
  - Send commands (ping, mtr, traceroute)
  - Display output in real-time
  - Prevent multiple commands at once
  - Handle connection errors and auto-reconnect
*/

let webSocket;
let isCommandRunning = false;

const outputContainer = document.getElementById('output');
const targetInput = document.getElementById('target');
const pingButton = document.getElementById('ping');
const mtrButton = document.getElementById('mtr');
const tracerouteButton = document.getElementById('traceroute');

function setCommandButtonsState(disabled) {
  pingButton.disabled = disabled;
  mtrButton.disabled = disabled;
  tracerouteButton.disabled = disabled;
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  webSocket = new WebSocket(`${protocol}://${window.location.hostname}`);

  webSocket.onopen = () => console.log('WebSocket connected');

  webSocket.onmessage = (event) => {
    if (event.data === 'close') {
      isCommandRunning = false;
      setCommandButtonsState(false);
      return;
    }
    outputContainer.classList.remove('d-none');
    outputContainer.textContent += event.data;
  };

  webSocket.onclose = () => {
    console.log('WebSocket closed, reconnecting in 2s...');
    isCommandRunning = false;
    setCommandButtonsState(false);
    setTimeout(connectWebSocket, 2000);
  };

  webSocket.onerror = (error) => {
    console.error('WebSocket error:', error);
    isCommandRunning = false;
    setCommandButtonsState(false);
  };
}

function sendCommand(commandName) {
  if (isCommandRunning) return;

  const targetValue = targetInput.value.trim();
  if (!targetValue) {
    targetInput.focus();
    return;
  }

  setCommandButtonsState(true);
  isCommandRunning = true;
  outputContainer.textContent = '';

  if (webSocket && webSocket.readyState === WebSocket.OPEN) {
    webSocket.send(`${commandName} ${targetValue}`);
  } else {
    outputContainer.textContent = 'WebSocket connection is not open';
    setCommandButtonsState(false);
    isCommandRunning = false;
  }
}

// Attach buttons
pingButton.onclick = () => sendCommand('ping');
mtrButton.onclick = () => sendCommand('mtr');
tracerouteButton.onclick = () => sendCommand('traceroute');

window.onload = connectWebSocket;