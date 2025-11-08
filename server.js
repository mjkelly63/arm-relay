import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const AUTH = process.env.RELAY_TOKEN || 'secret';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK - Relay running');
});

const wss = new WebSocketServer({ server });

const rooms = new Map();
function room(id) {
  if (!rooms.has(id)) rooms.set(id, { esp: null, client: null });
  return rooms.get(id);
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const role = url.searchParams.get('role');
  const id = url.searchParams.get('id') || 'arm1';
  const token = url.searchParams.get('token');

  if (token !== AUTH || !['esp', 'client'].includes(role)) {
    ws.close();
    return;
  }

  const r = room(id);
  if (role === 'esp') r.esp = ws;
  if (role === 'client') r.client = ws;

  ws.on('message', (msg) => {
    const other = role === 'esp' ? r.client : r.esp;
    if (other && other.readyState === 1) other.send(msg);
  });

  ws.on('close', () => {
    if (r.esp === ws) r.esp = null;
    if (r.client === ws) r.client = null;
  });
});

server.listen(PORT, () => {
  console.log(`Relay running on ${PORT}`);
});
