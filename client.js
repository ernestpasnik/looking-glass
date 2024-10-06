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

// https://github.com/hybula/lookingglass/blob/main/index.php#L384
async function copy(txt, btn) {
  if (!navigator || !navigator.clipboard || !navigator.clipboard.writeText) {
    return Promise.reject('The Clipboard API is not available');
  }
  btn.innerHTML = 'Copied';
  await navigator.clipboard.writeText(txt);
  await new Promise(r => setTimeout(r, 1000));
  btn.innerHTML = 'Copy';
}
