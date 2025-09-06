/**
 * Production-ready Looking Glass Server
 * Serves minified HTML & JS and handles WebSocket command execution
 */

const http = require('http');
const fs = require('fs');
const Handlebars = require('handlebars');
const { minify } = require('html-minifier');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const net = require('net');

// -------------------- Config --------------------
const CONFIG_PATH = './config.json';
if (!fs.existsSync(CONFIG_PATH)) {
  console.error('config.json not found');
  process.exit(1);
}

const config = require(CONFIG_PATH);
const MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeEmptyAttributes: true,
  minifyJS: true
};

// -------------------- Templates --------------------
const htmlTemplateSource = fs.readFileSync('./index.hbs', 'utf8');
const clientScript = fs.readFileSync('./client.js', 'utf8');

Handlebars.registerHelper('eq', (a, b) => a === b);
const compiledTemplate = Handlebars.compile(htmlTemplateSource);

const minifiedHtml = minify(compiledTemplate(config), MINIFY_OPTIONS);
const minifiedJs = minify(clientScript, MINIFY_OPTIONS);

// -------------------- HTTP Server --------------------
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// -------------------- WebSocket Server --------------------
const wss = new WebSocket.Server({ server });
const activeCommands = new Map(); // ws -> child process
const ipTimestamps = new Map();   // ip -> last command timestamp
const RATE_LIMIT_MS = 5000;       // 1 command per 5 seconds per IP

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

wss.on('connection', (ws, req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;
  console.log(`[${clientIp}] WebSocket connected`);

  ws.on('message', (message) => {
    const [commandName, target] = message.toString().trim().split(/\s+/, 2);

    // Validate command
    if (!ALLOWED_COMMANDS[commandName]) {
      ws.send('Invalid command');
      ws.send('close');
      return;
    }

    // Validate target
    if (!target || !isValidTarget(target)) {
      ws.send('Invalid target');
      ws.send('close');
      return;
    }

    // Rate limiting
    const lastTime = ipTimestamps.get(clientIp) || 0;
    if (Date.now() - lastTime < RATE_LIMIT_MS) {
      ws.send('Rate limit exceeded');
      return;
    }

    // Single command per connection
    if (activeCommands.has(ws)) {
      ws.send('Command already running');
      return;
    }

    const [exec, args] = ALLOWED_COMMANDS[commandName];
    console.log(`[${clientIp}] Executing: ${exec} ${args.join(' ')} ${target}`);

    const child = spawn(exec, [...args, target]);
    activeCommands.set(ws, child);
    ipTimestamps.set(clientIp, Date.now());

    child.stdout.on('data', (data) => ws.send(data.toString()));
    child.stderr.on('data', (data) => console.error(`[${clientIp}] ${data}`));
    child.on('close', () => {
      activeCommands.delete(ws);
      ws.send('close');
    });
  });

  ws.on('close', () => {
    const child = activeCommands.get(ws);
    if (child) child.kill();
    activeCommands.delete(ws);
    console.log(`[${clientIp}] WebSocket closed`);
  });
});