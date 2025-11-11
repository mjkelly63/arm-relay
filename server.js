// Minimal WebSocket relay for Render (HTTP + WS + keepalive)
import http from "http"; 
import { WebSocketServer } from "ws";
import url from "url";

const server = http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type":"text/plain; charset=utf-8"}); 
  res.end("WS relay online\n");
});

const wss = new WebSocketServer({ server, perMessageDeflate: false });

// room -> Set<ws>
const rooms = new Map();
const getRoom = id => rooms.get(id) || rooms.set(id, new Set()).get(id);

// keepalive: ping each client
function heartbeat(){ this.isAlive = true; }
wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", heartbeat);

  const q = url.parse(req.url, true).query;
  const id = (q.id || "arm1").toString();    // room id (web/esp/anything)
  const room = getRoom(id);
  room.add(ws);

  // confirm hello so clients know it's stable
  try { ws.send(JSON.stringify({hello:true, id})); } catch {}

  ws.on("message", (data) => {
    // Do NOT parse; just fan out raw or JSON text to peers.
    // If it's not text, skip.
    if (typeof data !== "string" && !Buffer.isBuffer(data)) return;
    for (const peer of room) {
      if (peer !== ws && peer.readyState === 1) {
        try { peer.send(data); } catch {}
      }
    }
  });

  ws.on("close", () => { room.delete(ws); if (!room.size) rooms.delete(id); });
  ws.on("error", () => {}); // swallow to avoid process crash
});

// ping sweep
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false; ws.ping();
  });
}, 30000);
wss.on("close", () => clearInterval(interval));

// IMPORTANT on Render: bind to 0.0.0.0 and process.env.PORT
const PORT = process.env.PORT || 10000;
server.keepAliveTimeout = 65000;
server.headersTimeout   = 66000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("WS relay listening on", PORT);
});
