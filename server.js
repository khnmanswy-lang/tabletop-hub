/**
 * TABLETOP HUB — Unified Parlor Game Lounge
 * Hosts Blind Heist & Love Letter (2019 Edition) on a single port & domain.
 *
 * Designed for frictionless deployment on Render.com, Railway, Fly.io, or Docker.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { createBlindHeistRoom } = require('./games/blind-heist/server');
const { createLoveLetterRoom } = require('./games/love-letter/server');
const { createSlaveRoom } = require('./games/slave-card-game/server');
const { createFlip7Room } = require('./games/flip-7/server');
const { createRichGameRoom } = require('./games/lets-get-rich/server');
const { createCockroachRoom } = require('./games/cockroach-poker/server');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// 1. Preload landing page HTML
const LANDING_HTML = fs.readFileSync(path.join(__dirname, 'landing.html'), 'utf8');

// 2. Instantiate isolated game room engines
const blindHeist = createBlindHeistRoom();
const loveLetter = createLoveLetterRoom();
const slaveGame = createSlaveRoom();
const flip7Game = createFlip7Room();
const richGame = createRichGameRoom();
const cockroachGame = createCockroachRoom();

// 3. HTTP Server
const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname.replace(/\/+$/, '') || '/';

  // Landing Lounge
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    return res.end(LANDING_HTML);
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
      games: ['blind-heist', 'love-letter', 'slave-card-game', 'flip-7', 'lets-get-rich', 'cockroach-poker'],
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

  // LINE Let's Get Rich route (HTML & static assets)
  if (pathname === '/rich' || pathname.startsWith('/rich/') || pathname.startsWith('/assets/')) {
    return richGame.serveStatic(req, res, pathname);
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

// 4. WebSocket Upgrade Router
server.on('upgrade', (request, socket, head) => {
  const reqUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname.replace(/\/+$/, '') || '/';

  if (pathname === '/heist/ws') {
    blindHeist.wss.handleUpgrade(request, socket, head, (ws) => {
      blindHeist.wss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/love-letter/ws') {
    loveLetter.wss.handleUpgrade(request, socket, head, (ws) => {
      loveLetter.wss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/slave/ws') {
    slaveGame.wss.handleUpgrade(request, socket, head, (ws) => {
      slaveGame.wss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/flip-7/ws') {
    flip7Game.wss.handleUpgrade(request, socket, head, (ws) => {
      flip7Game.wss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/rich/ws') {
    richGame.wss.handleUpgrade(request, socket, head, (ws) => {
      richGame.wss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/cockroach/ws') {
    cockroachGame.wss.handleUpgrade(request, socket, head, (ws) => {
      cockroachGame.wss.emit('connection', ws, request);
    });
    return;
  }

  socket.destroy();
});

// 5. Start Server
server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`  TABLETOP HUB IS ONLINE (6 GAMES LIVE)`);
  console.log(`====================================================`);
  console.log(`  Port:            ${PORT}`);
  console.log(`  Lounge:          http://localhost:${PORT}/`);
  console.log(`  Blind Heist:     http://localhost:${PORT}/heist`);
  console.log(`  Love Letter:     http://localhost:${PORT}/love-letter`);
  console.log(`  Slave Game:      http://localhost:${PORT}/slave`);
  console.log(`  Flip 7:          http://localhost:${PORT}/flip-7`);
  console.log(`  Cockroach Poker: http://localhost:${PORT}/cockroach`);
  console.log(`  Let's Get Rich:  http://localhost:${PORT}/rich`);
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