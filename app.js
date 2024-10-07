const http = require('http')
const fs = require('fs')
const Handlebars = require('handlebars')
const { minify } = require('html-minifier')
const WebSocket = require('ws')
const { spawn } = require('child_process')
const net = require('net')

if (!fs.existsSync('config.json')) {
  console.error('File not found config.json')
  process.exit(1)
}

const options = {
  collapseWhitespace: true,
  removeComments: true,
  removeEmptyAttributes: true,
  minifyJS: true
}
const json = require('./config.json')
const hbs = fs.readFileSync('index.hbs', 'utf8')
const js = fs.readFileSync('client.js', 'utf8')
Handlebars.registerHelper('eq', function(a, b) { return a === b })
const template = Handlebars.compile(hbs)
const minifiedHtml = minify(template(json), options)
const minifedJs = minify(js, options)

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(minifiedHtml)
  } else if (req.url === '/client.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' })
    res.end(minifedJs)
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('404 Not Found')
  }
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

const wss = new WebSocket.Server({ server })
const clientCommands = new Map()
const commandRegex = /^(ping|mtr|traceroute) (.+)$/

const isValidTarget = (target) => {
  if (net.isIPv4(target) || net.isIPv6(target)) {
    return true
  }
  const hostnameRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/
  return hostnameRegex.test(target)
}

wss.on('connection', (ws, req) => {
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress
  console.log(`[${ip}] WebSocket connection established`)

  ws.on('message', (message) => {
    const command = message.toString().trim()

    if (clientCommands.has(ws)) {
      console.log(`[${ip}] Command already running`)
      return
    }

    const commandMatch = commandRegex.exec(command)
    if (!commandMatch) {
      console.log(`[${ip}] Invalid command ${command}`)
      ws.send('Invalid command format')
      ws.send('close')
      return
    }

    const target = commandMatch[2]
    if (!isValidTarget(target)) {
      console.log(`[${ip}] Invalid target ${target}`)
      ws.send('Target must be a valid IP address or hostname')
      ws.send('close')
      return
    }

    let cmd = commandMatch[1]
    switch (cmd) {
      case 'ping':
        cmd = 'ping -c 4 -w15'
        break
      case 'mtr':
        cmd = 'mtr -r -n -c 4'
        break
      case 'traceroute':
        cmd = 'traceroute -w2'
        break
      default:
        break
    }

    console.log(`[${ip}] Executing ${cmd} ${target}`)
    const commandProcess = spawn(`${cmd} ${target}`, { shell: true })
    clientCommands.set(ws, commandProcess)

    commandProcess.stdout.on('data', (data) => {
      ws.send(data.toString())
    })

    commandProcess.stderr.on('data', (data) => {
      console.error(data.toString())
    })

    commandProcess.on('close', (code) => {
      clientCommands.delete(ws)
      ws.send('close')
    })
  })

  ws.on('close', () => {
    console.log(`[${ip}] WebSocket connection closed`)
    const commandProcess = clientCommands.get(ws)
    if (commandProcess) {
      commandProcess.kill()
      clientCommands.delete(ws)
    }
  })
})
