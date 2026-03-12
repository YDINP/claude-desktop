'use strict';

const http = require('http');
const WebSocket = require('ws');

const PORT = 9091; // 3.x는 9091로 구분
let httpServer = null;
let wss = null;
const clients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

function handleRequest(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url || '';
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      await routeRequest3x(req.method, url, parsed, res);
    } catch(e) {
      res.writeHead(500); res.end(JSON.stringify({ error: String(e) }));
    }
  });
}

async function routeRequest3x(method, url, body, res) {
  if (method === 'GET' && url === '/scene/tree') {
    const result = await Editor.Message.request('scene', 'query-node-tree');
    res.writeHead(200); res.end(JSON.stringify(result));
    return;
  }

  const nodeMatch = url.match(/^\/node\/([^\/]+)$/);
  if (method === 'GET' && nodeMatch) {
    const result = await Editor.Message.request('scene', 'query-node', nodeMatch[1]);
    res.writeHead(200); res.end(JSON.stringify(result));
    return;
  }

  const propMatch = url.match(/^\/node\/([^\/]+)\/property$/);
  if (method === 'POST' && propMatch) {
    await Editor.Message.request('scene', 'set-property', {
      uuid: propMatch[1], path: body.key, dump: { value: body.value }
    });
    res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    return;
  }

  const moveMatch = url.match(/^\/node\/([^\/]+)\/move$/);
  if (method === 'POST' && moveMatch) {
    await Editor.Message.request('scene', 'set-property', {
      uuid: moveMatch[1], path: 'position', dump: { value: { x: body.x, y: body.y, z: 0 } }
    });
    res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (method === 'GET' && url === '/status') {
    res.writeHead(200); res.end(JSON.stringify({ ok: true, version: '3x', port: PORT }));
    return;
  }

  res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
}

module.exports = {
  load() {
    httpServer = http.createServer(handleRequest);
    wss = new WebSocket.Server({ server: httpServer });
    wss.on('connection', (ws) => {
      clients.add(ws);
      ws.send(JSON.stringify({ type: 'connected', version: '3x' }));
      ws.on('close', () => clients.delete(ws));
      ws.on('error', () => clients.delete(ws));
    });
    httpServer.listen(PORT, '127.0.0.1', () => {
      console.log(`[cc-ws-ext] 3.x Server on port ${PORT}`);
    });

    // 3.x 이벤트
    Editor.Message.addBroadcastListener('scene:ready', () => broadcast({ type: 'scene:ready' }));
    Editor.Message.addBroadcastListener('scene:saved', () => broadcast({ type: 'scene:saved' }));
    Editor.Message.addBroadcastListener('selection:select', (type, uuids) => {
      if (type === 'node') broadcast({ type: 'node:select', uuids });
    });
  },

  unload() {
    clients.forEach(ws => ws.close());
    clients.clear();
    if (wss) wss.close();
    if (httpServer) httpServer.close();
  },

  methods: {
    'get-status'() { return { ok: true, port: PORT, clients: clients.size }; }
  }
};
