# Node.js Looking Glass

Lightweight and simple **Looking Glass** powered by **Node.js** and **Bootstrap 5.3**.  
Inspired by [hybula/lookingglass](https://github.com/hybula/lookingglass).

![Screenshot](https://i.imgur.com/LPByj0x.png)

---

## Requirements

- Linux-based server
- Node.js (v18+ recommended)
- Installed system tools: `ping`, `mtr`, `traceroute`

---

## Installation

```bash
# Clone Repository
git clone https://github.com/ernestpasnik/looking-glass.git
cd looking-glass

# Configure
mv config.dist.js config.js
# Edit config.js if needed
# nano config.js

# Install Dependencies
npm install

# Run Server
node server.js
```

---

# How to Use

1. Open your browser and navigate to your server (e.g., http://yourdomain.com).
2. Select a location from the dropdown to switch between sites.
3. In the Command Query section: Enter a valid IP or hostname. Click one of the buttons: ping, mtr, or traceroute. The command output will appear in real-time below.
4. Copy IP addresses or iPerf3 results using the “Copy” buttons.
5. Download test files from the Speed Test section.

---

# Features

- Real-time execution of network commands via WebSocket
- Minified HTML and JS for fast loading
- Bootstrap 5.3 responsive design
- Light/Dark theme support
- Rate-limited command execution per IP for security

---

# License

This project is licensed under the Apache-2.0 License.