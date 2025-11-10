// =====================
// full server.js
// =====================
import http from "http";
import { WebSocketServer } from "ws"; 
 

const PORT = process.env.PORT || 10000;
const AUTH = process.env.RELAY_TOKEN || "secret";

// tiny room registry (1 ESP + 1 client per id)
const rooms = new Map();
function room(id) {
  if (!rooms.has(id)) rooms.set(id, { esp: null, client: null });
  return rooms.get(id);
}

const server = http.createServer((req, res) => {
  // a plain GET for health check
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK – relay running");
});

const wss = new WebSocketServer({ server });

// connection handler
wss.on("connection", (ws, req) => {
  try {
    const u = new URL(req.url, "http://x");
    const role = u.searchParams.get("role");      // esp | client
    const id   = u.searchParams.get("id") || "arm1";
    const tok  = u.searchParams.get("token");

    // reject if wrong token/role
    if (tok !== AUTH || !["esp", "client"].includes(role)) {
      ws.close();
      return;
    }

    const r = room(id);
    if (role === "esp")    r.esp = ws;
    if (role === "client") r.client = ws;

    // forward inbound messages to the opposite side
    ws.on("message", (data, isBinary) => {
      const other = role === "esp" ? r.client : r.esp;
      if (!other || other.readyState !== 1) return;

      if (isBinary) {
        other.send(data, { binary: true });
      } else {
        const text = (typeof data === "string") ? data : data.toString();
        other.send(text); // force text frames
      }
    });

    ws.on("close", () => {
      if (r.esp === ws) r.esp = null;
      if (r.client === ws) r.client = null;
    });

  } catch (e) {
    ws.close();
  }
});

server.listen(PORT, () => {
  console.log("Relay running on", PORT);
});
