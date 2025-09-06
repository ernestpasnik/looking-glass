/*
  Production-ready WebSocket server with HTTP endpoint for serving
  minified HTML and client JS. Supports execution of network commands
  (ping, mtr, traceroute) with per-IP rate limiting and single command
  enforcement.
*/

const http = require('http');
const fs = require('fs');
const Handlebars = require('handlebars');
const { minify } = require('html-minifier');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const net = require('net');

// -------------------- Config & Templates --------------------

// Check that config exists
const CONFIG_PATH = './config.json';
if (!fs.existsSync(CONFIG_PATH)) {
  console.error('File not found: config.json');
  process.exit(1);
}

// Minifier options for HTML/JS
const MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeEmptyAttributes: true,
  minifyJS: true
};

// Load configuration and templates
const configData = require(CONFIG_PATH);
const templateSource = fs.readFileSync('./index.hbs', 'utf8');
const clientScript = fs.readFileSync('./client.js', 'utf8');

Handlebars.registerHelper('eq', (a, b) => a === b);
const compiledTemplate = Handlebars.compile(templateSource);

const minifiedHtml = minify(compiledTemplate(configData), MINIFY_OPTIONS);
const minifiedJs = minify(clientScript, MINIFY_OPTIONS);

// -------------------- HTTP Server --------------------

const SERVER_PORT = process.env.PORT || 3000;
const httpServer = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(minifiedHtml);
  } else if (req.url === '/client.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript',
      'Cache-Control': 'max-age=3600'
    });
    res.end(minifiedJs);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

httpServer.listen(SERVER_PORT, () => {
  console.log(`Server running on port ${SERVER_PORT}`);
});

// -------------------- WebSocket Server --------------------

// One command per IP at a time
const webSocketServer = new WebSocket.Server({ server: httpServer });
const activeCommands = new Map(); // ws -> child process
const lastCommandTimestamps = new Map(); // ip -> timestamp
const COMMAND_RATE_LIMIT_MS = 5000; // 1 command per 5s

// Allowed commands and args
const ALLOWED_COMMANDS = {
  ping: ['ping', ['-c', '4', '-w', '15']],
  mtr: ['mtr', ['-r', '-n', '-c', '4']],
  traceroute: ['traceroute', ['-w', '2']]
};

// Validate IP or hostname
function isValidTarget(target) {
  if (net.isIPv4(target) || net.isIPv6(target)) return true;
  const hostnameRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/;
  return hostnameRegex.test(target);
}

// Handle new WebSocket connections
webSocketServer.on('connection', (clientSocket, req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;
  console.log(`[${clientIp}] WebSocket connection established`);

  clientSocket.on('message', (message) => {
    const rawCommand = message.toString().trim();
    const [commandName, target] = rawCommand.split(/\s+/, 2);

    // Validate command
    if (!ALLOWED_COMMANDS[commandName]) {
      clientSocket.send('Invalid command format');
      clientSocket.send('close');
      console.log(`[${clientIp}] Invalid command: ${rawCommand}`);
      return;
    }

    // Validate target
    if (!target || !isValidTarget(target)) {
      clientSocket.send('Target must be a valid IP or hostname');
      clientSocket.send('close');
      console.log(`[${clientIp}] Invalid target: ${target}`);
      return;
    }

    // Rate limiting
    const lastTimestamp = lastCommandTimestamps.get(clientIp) || 0;
    if (Date.now() - lastTimestamp < COMMAND_RATE_LIMIT_MS) {
      clientSocket.send('Rate limit exceeded. Wait before sending another command.');
      return;
    }

    // Ensure only one command per IP
    if (activeCommands.has(clientSocket)) {
      clientSocket.send('Command already running. Wait until it finishes.');
      console.log(`[${clientIp}] Command already running`);
      return;
    }

    const [executable, args] = ALLOWED_COMMANDS[commandName];
    console.log(`[${clientIp}] Executing: ${executable} ${args.join(' ')} ${target}`);

    // Spawn child process
    const childProcess = spawn(executable, [...args, target]);
    activeCommands.set(clientSocket, childProcess);
    lastCommandTimestamps.set(clientIp, Date.now());

    // Stream stdout to client
    childProcess.stdout.on('data', (data) => clientSocket.send(data.toString()));
    childProcess.stderr.on('data', (data) => console.error(`[${clientIp}] ${data}`));

    // Cleanup on process close
    childProcess.on('close', () => {
      activeCommands.delete(clientSocket);
      clientSocket.send('close');
    });
  });

  // Cleanup on socket close
  clientSocket.on('close', () => {
    console.log(`[${clientIp}] WebSocket connection closed`);
    const childProcess = activeCommands.get(clientSocket);
    if (childProcess) {
      childProcess.kill();
      activeCommands.delete(clientSocket);
    }
  });
});