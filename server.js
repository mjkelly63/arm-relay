import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const AUTH = process.env.RELAY_TOKEN || 'secret';

const server = http.createServer();
const wss = new WebSocketServer({ server });

const rooms = new Map();
function room(id){ if(!rooms.has(id)) rooms.set(id,{esp:null,client:null}); return rooms.get(id); }

wss.on('connection', (ws, req) => {
  const u = new URL(req.url, 'http://x');
  const role = u.searchParams.get('role'); // 'esp' or 'client'
  const id   = u.searchParams.get('id')||'arm1';
  const tok  = u.searchParams.get('token');

  if (tok !== AUTH || !['esp','client'].includes(role)) { ws.close(); return; }
  const r = room(id);
  if (role==='esp')    r.esp = ws;
  if (role==='client') r.client = ws;

  ws.on('message', (data) => {
    const other = role==='esp' ? r.client : r.esp;
    if (other && other.readyState===1) other.send(data);
  });

  ws.on('close', () => {
    if (r.esp===ws) r.esp=null;
    if (r.client===ws) r.client=null;
  });
});

server.listen(PORT, () => console.log('Relay on', PORT));
