const http = require('http');
const fs = require('fs');
const Handlebars = require('handlebars');
const { minify } = require('html-minifier');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const net = require('net');

// Check config
if (!fs.existsSync('config.json')) {
  console.error('File not found: config.json');
  process.exit(1);
}

// Minify options
const options = {
  collapseWhitespace: true,
  removeComments: true,
  removeEmptyAttributes: true,
  minifyJS: true
};

// Load templates
const json = require('./config.json');
const hbs = fs.readFileSync('index.hbs', 'utf8');
const js = fs.readFileSync('client.js', 'utf8');
Handlebars.registerHelper('eq', (a, b) => a === b);
const template = Handlebars.compile(hbs);
const minifiedHtml = minify(template(json), options);
const minifiedJs = minify(js, options);

// HTTP server
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });
const clientCommands = new Map();

// Allowed commands
const COMMANDS = {
  ping: ['ping', ['-c', '4', '-w', '15']],
  mtr: ['mtr', ['-r', '-n', '-c', '4']],
  traceroute: ['traceroute', ['-w', '2']]
};

const isValidTarget = (target) => {
  if (net.isIPv4(target) || net.isIPv6(target)) return true;
  const hostnameRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/;
  return hostnameRegex.test(target);
};

wss.on('connection', (ws, req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;
  console.log(`[${ip}] WebSocket connection established`);

  ws.on('message', (message) => {
    const command = message.toString().trim();

    if (clientCommands.has(ws)) {
      console.log(`[${ip}] Command already running`);
      return;
    }

    const [cmd, target] = command.split(/\s+/, 2);
    if (!COMMANDS[cmd]) {
      console.log(`[${ip}] Invalid command: ${command}`);
      ws.send('Invalid command format');
      ws.send('close');
      return;
    }

    if (!target || !isValidTarget(target)) {
      console.log(`[${ip}] Invalid target: ${target}`);
      ws.send('Target must be a valid IP address or hostname');
      ws.send('close');
      return;
    }

    const [exec, args] = COMMANDS[cmd];
    console.log(`[${ip}] Executing ${exec} ${args.join(' ')} ${target}`);

    const proc = spawn(exec, [...args, target]);
    clientCommands.set(ws, proc);

    proc.stdout.on('data', (data) => ws.send(data.toString()));
    proc.stderr.on('data', (data) => console.error(`[${ip}] ${data}`));
    proc.on('close', () => {
      clientCommands.delete(ws);
      ws.send('close');
    });
  });

  ws.on('close', () => {
    console.log(`[${ip}] WebSocket connection closed`);
    const proc = clientCommands.get(ws);
    if (proc) {
      proc.kill();
      clientCommands.delete(ws);
    }
  });
});