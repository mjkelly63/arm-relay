// server.js (ESM)
import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const AUTH = process.env.RELAY_TOKEN || 'secret';

// --- Minimal HTTP so Render can "see" the service and wake/health-check ---
const server = http.createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('relay alive');
    return;
  }
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  // lightweight 404 for anything else
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

// WebSocket server (explicit path = /ws to avoid accidental conflicts)
const wss = new WebSocketServer({ server, path: '/ws' });

// simple two-endpoint room map: { id: { esp, client } }
const rooms = new Map();
function room(id) {
  if (!rooms.has(id)) rooms.set(id, { esp: null, client: null });
  return rooms.get(id);
}

// keep-alive / cleanup
const HEARTBEAT_MS = 30000;
function heartbeat() { this.isAlive = true; }
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_MS);

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  // Parse query: ?role=esp|client&id=arm1&token=secret
  const u = new URL(req.url, 'http://x');
  const role = u.searchParams.get('role');      // 'esp' or 'client'
  const id   = u.searchParams.get('id') || 'arm1';
  const tok  = u.searchParams.get('token');

  if (tok !== AUTH || !['esp', 'client'].includes(role)) {
    try { ws.close(1008, 'unauthorized'); } catch {}
    return;
  }

  const r = room(id);
  if (role === 'esp')    r.esp = ws;
  if (role === 'client') r.client = ws;

  ws.on('message', (data) => {
    const other = role === 'esp' ? r.client : r.esp;
    if (other && other.readyState === 1) other.send(data);
  });

  ws.on('close', () => {
    if (r.esp === ws) r.esp = null;
    if (r.client === ws) r.client = null;
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Relay on', PORT);
});
