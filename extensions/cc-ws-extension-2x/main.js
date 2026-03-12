'use strict';

const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const PORT = 9090;
let httpServer = null;
let wss = null;
const clients = new Set();

// ── 브로드캐스트 ──────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

// ── HTTP 핸들러 ───────────────────────────────────────────
function handleRequest(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url || '';
  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      routeRequest(req.method, url, parsed, res);
    } catch (e) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

function routeRequest(method, url, body, res) {
  // GET /scene/tree
  if (method === 'GET' && url === '/scene/tree') {
    Editor.Scene.callSceneScript('cc-ws-extension', 'getNodeTree', {}, (err, result) => {
      if (err) { res.writeHead(500); res.end(JSON.stringify({ error: String(err) })); return; }
      res.writeHead(200); res.end(JSON.stringify(result));
    });
    return;
  }

  // GET /node/:uuid
  const nodeMatch = url.match(/^\/node\/([^\/]+)$/);
  if (method === 'GET' && nodeMatch) {
    const uuid = nodeMatch[1];
    Editor.Scene.callSceneScript('cc-ws-extension', 'getNode', { uuid }, (err, result) => {
      if (err) { res.writeHead(500); res.end(JSON.stringify({ error: String(err) })); return; }
      res.writeHead(200); res.end(JSON.stringify(result));
    });
    return;
  }

  // POST /node/:uuid/property
  const propMatch = url.match(/^\/node\/([^\/]+)\/property$/);
  if (method === 'POST' && propMatch) {
    const uuid = propMatch[1];
    Editor.Scene.callSceneScript('cc-ws-extension', 'setNodeProperty', { uuid, key: body.key, value: body.value }, (err) => {
      if (err) { res.writeHead(500); res.end(JSON.stringify({ error: String(err) })); return; }
      res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // POST /node/:uuid/move
  const moveMatch = url.match(/^\/node\/([^\/]+)\/move$/);
  if (method === 'POST' && moveMatch) {
    const uuid = moveMatch[1];
    Editor.Scene.callSceneScript('cc-ws-extension', 'moveNode', { uuid, x: body.x, y: body.y }, (err) => {
      if (err) { res.writeHead(500); res.end(JSON.stringify({ error: String(err) })); return; }
      res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // GET /scene/canvas-size
  if (method === 'GET' && url === '/scene/canvas-size') {
    Editor.Scene.callSceneScript('cc-ws-extension', 'getCanvasSize', {}, (err, result) => {
      if (err) { res.writeHead(500); res.end(JSON.stringify({ error: String(err) })); return; }
      res.writeHead(200); res.end(JSON.stringify(result));
    });
    return;
  }

  // GET /status
  if (method === 'GET' && url === '/status') {
    res.writeHead(200); res.end(JSON.stringify({ ok: true, version: '2x', port: PORT }));
    return;
  }

  res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
}

// ── 이벤트 리스닝 ─────────────────────────────────────────
function attachEditorEvents() {
  Editor.on('scene:ready', () => broadcast({ type: 'scene:ready' }));
  Editor.on('scene:saved', () => broadcast({ type: 'scene:saved' }));
  Editor.Selection.on('select', (type, ids) => {
    if (type === 'node') broadcast({ type: 'node:select', uuids: ids });
  });
  Editor.Selection.on('unselect', (type, ids) => {
    if (type === 'node') broadcast({ type: 'node:deselect', uuids: ids });
  });
}

// ── 서버 시작/종료 ────────────────────────────────────────
module.exports = {
  load() {
    httpServer = http.createServer(handleRequest);
    wss = new WebSocket.Server({ server: httpServer });

    wss.on('connection', (ws) => {
      clients.add(ws);
      ws.send(JSON.stringify({ type: 'connected', version: '2x' }));
      ws.on('close', () => clients.delete(ws));
      ws.on('error', (err) => {
        console.error('[cc-ws-ext] WS error:', err.message);
        clients.delete(ws);
      });
    });

    httpServer.listen(PORT, '127.0.0.1', () => {
      Editor.log(`[cc-ws-ext] Server running on http://127.0.0.1:${PORT}`);
    });

    attachEditorEvents();
  },

  unload() {
    clients.forEach(ws => ws.close());
    clients.clear();
    if (wss) wss.close();
    if (httpServer) httpServer.close();
    Editor.log('[cc-ws-ext] Server stopped');
  },

  messages: {
    'get-status'(event) {
      event.reply(null, { ok: true, port: PORT, clients: clients.size });
    }
  }
};
