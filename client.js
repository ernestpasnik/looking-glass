/**
 * Looking Glass WebSocket Client
 * Handles command execution, output display, and UI interactions.
 */

class LookingGlassClient {
  constructor() {
    this.ws = null;
    this.commandRunning = false;

    // Elements
    this.outputEl = document.getElementById('output');
    this.targetEl = document.getElementById('target');
    this.buttons = {
      ping: document.getElementById('ping'),
      mtr: document.getElementById('mtr'),
      traceroute: document.getElementById('traceroute')
    };

    // Bind button events
    this._bindUIEvents();
    // Connect WebSocket
    this._connectWebSocket();
  }

  /** Enable or disable command buttons */
  _toggleButtons(disabled) {
    Object.values(this.buttons).forEach(btn => btn.disabled = disabled);
  }

  /** Bind UI button events */
  _bindUIEvents() {
    Object.entries(this.buttons).forEach(([command, btn]) => {
      btn.addEventListener('click', () => this.sendCommand(command));
    });
  }

  /** Establish WebSocket connection */
  _connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${protocol}://${window.location.hostname}`);

    this.ws.addEventListener('open', () => console.log('WebSocket connected'));
    this.ws.addEventListener('close', () => {
      console.log('WebSocket closed');
      this.commandRunning = false;
      this._toggleButtons(false);
    });
    this.ws.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      this.commandRunning = false;
      this._toggleButtons(false);
    });
    this.ws.addEventListener('message', (event) => this._handleMessage(event.data));
  }

  /** Handle messages from server */
  _handleMessage(message) {
    if (message === 'close') {
      this.commandRunning = false;
      this._toggleButtons(false);
      return;
    }
    this.outputEl.classList.remove('d-none');
    this.outputEl.textContent += message;
  }

  /** Send command to server */
  sendCommand(command) {
    if (this.commandRunning) return;

    const target = this.targetEl.value.trim();
    if (!target) {
      this.targetEl.focus();
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.outputEl.textContent = 'WebSocket connection is not open';
      return;
    }

    this.commandRunning = true;
    this._toggleButtons(true);
    this.outputEl.textContent = '';
    this.ws.send(`${command} ${target}`);
  }
}

// Initialize client on page load
window.addEventListener('DOMContentLoaded', () => new LookingGlassClient());

/** Clipboard helper for copy buttons */
async function copyToClipboard(text, button) {
  if (!navigator.clipboard?.writeText) return;
  button.textContent = 'Copied';
  await navigator.clipboard.writeText(text);
  setTimeout(() => button.textContent = 'Copy', 1000);
}