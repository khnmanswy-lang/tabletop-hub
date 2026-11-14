/**
 * TABLETOP HUB — Unified Parlor Game Lounge
 * Hosts Blind Heist & Love Letter (2019 Edition) on a single port & domain.
 *
 * Designed for frictionless deployment on Render.com, Railway, Fly.io, or Docker.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { URL } = require('url');

const { createBlindHeistRoom } = require('./games/blind-heist/server');
const { createLoveLetterRoom } = require('./games/love-letter/server');
const { createSlaveRoom } = require('./games/slave-card-game/server');
const { createFlip7Room } = require('./games/flip-7/server');
const { createCockroachRoom } = require('./games/cockroach-poker/server');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// 1. Preload & pre-compress landing page HTML in memory (zero disk I/O per request)
const LANDING_HTML = fs.readFileSync(path.join(__dirname, 'landing.html'), 'utf8');
const LANDING_GZIP = zlib.gzipSync(Buffer.from(LANDING_HTML, 'utf8'));

function sendHtml(req, res, rawHtml, gzipBuf) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (gzipBuf && acceptEncoding.includes('gzip')) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Vary': 'Accept-Encoding',
      'Cache-Control': 'no-cache'
    });
    return res.end(gzipBuf);
  }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  return res.end(rawHtml);
}

// 2. Instantiate isolated game room engines
const blindHeist = createBlindHeistRoom();
const loveLetter = createLoveLetterRoom();
const slaveGame = createSlaveRoom();
const flip7Game = createFlip7Room();
const cockroachGame = createCockroachRoom();

const ALL_WSS = [
  blindHeist.wss,
  loveLetter.wss,
  slaveGame.wss,
  flip7Game.wss,
  cockroachGame.wss
];

// 3. HTTP Server
const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname.replace(/\/+$/, '') || '/';

  // Landing Lounge
  if (pathname === '/' || pathname === '/index.html') {
    return sendHtml(req, res, LANDING_HTML, LANDING_GZIP);
  }

  // Health / Uptime ping endpoint (Render keep-alive & monitoring)
  if (pathname === '/health' || pathname === '/ping') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    return res.end(JSON.stringify({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      games: ['blind-heist', 'love-letter', 'slave-card-game', 'flip-7', 'cockroach-poker'],
      timestamp: new Date().toISOString()
    }));
  }

  // Blind Heist game route
  if (pathname === '/heist') {
    return blindHeist.serveHtml(req, res);
  }

  // Love Letter game route
  if (pathname === '/love-letter') {
    return loveLetter.serveHtml(req, res);
  }

  // Slave Card Game route
  if (pathname === '/slave') {
    return slaveGame.serveHtml(req, res);
  }

  // Flip 7 game route
  if (pathname === '/flip-7') {
    return flip7Game.serveHtml(req, res);
  }

  // Cockroach Poker game route
  if (pathname === '/cockroach') {
    return cockroachGame.serveHtml(req, res);
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>404 Not Found — Tabletop Hub</title>
      <style>
        body { font-family: sans-serif; background: #FAF9F5; color: #141413; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { text-align: center; border: 1px solid #E5E2DC; background: #FFFFFF; padding: 32px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
        a { color: #D97757; text-decoration: none; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Room Not Found (404)</h2>
        <p style="margin: 12px 0 20px; color: #666560;">The requested parlor page does not exist.</p>
        <a href="/">← Return to Tabletop Lounge</a>
      </div>
    </body>
    </html>
  `);
});

// 4. WebSocket Upgrade Router + 30s Ping/Pong Keep-Alive Heartbeat
function bindHeartbeat(ws) {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
}

const heartbeatInterval = setInterval(() => {
  for (const wss of ALL_WSS) {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch {}
        continue;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }
}, 30000);
heartbeatInterval.unref?.();

server.on('upgrade', (request, socket, head) => {
  const reqUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname.replace(/\/+$/, '') || '/';

  if (pathname === '/heist/ws') {
    blindHeist.wss.handleUpgrade(request, socket, head, (ws) => {
      bindHeartbeat(ws);
      blindHeist.wss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/love-letter/ws') {
    loveLetter.wss.handleUpgrade(request, socket, head, (ws) => {
      bindHeartbeat(ws);
      loveLetter.wss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/slave/ws') {
    slaveGame.wss.handleUpgrade(request, socket, head, (ws) => {
      bindHeartbeat(ws);
      slaveGame.wss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/flip-7/ws') {
    flip7Game.wss.handleUpgrade(request, socket, head, (ws) => {
      bindHeartbeat(ws);
      flip7Game.wss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/cockroach/ws') {
    cockroachGame.wss.handleUpgrade(request, socket, head, (ws) => {
      bindHeartbeat(ws);
      cockroachGame.wss.emit('connection', ws, request);
    });
    return;
  }

  socket.destroy();
});

// 5. Start Server
server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`  TABLETOP HUB IS ONLINE (5 GAMES LIVE)`);
  console.log(`====================================================`);
  console.log(`  Port:            ${PORT}`);
  console.log(`  Lounge:          http://localhost:${PORT}/`);
  console.log(`  Blind Heist:     http://localhost:${PORT}/heist`);
  console.log(`  Love Letter:     http://localhost:${PORT}/love-letter`);
  console.log(`  Slave Game:      http://localhost:${PORT}/slave`);
  console.log(`  Flip 7:          http://localhost:${PORT}/flip-7`);
  console.log(`  Cockroach Poker: http://localhost:${PORT}/cockroach`);
  console.log(`  Health Check:    http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});