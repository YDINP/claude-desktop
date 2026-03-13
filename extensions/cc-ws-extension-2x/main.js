'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 9090;
let httpServer = null;
let wss = null;
const clients = new Set();

// ── 에셋 브라우저 헬퍼 ────────────────────────────────────
function getAssetType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const typeMap = {
    '.js': 'script', '.ts': 'script',
    '.prefab': 'prefab',
    '.png': 'texture', '.jpg': 'texture', '.jpeg': 'texture', '.webp': 'texture',
    '.plist': 'atlas',
    '.fire': 'scene', '.scene': 'scene',
    '.mp3': 'audio', '.ogg': 'audio', '.wav': 'audio',
    '.ttf': 'font', '.fnt': 'font',
    '.json': 'json', '.txt': 'text',
    '.anim': 'animation',
    '.mat': 'material',
  };
  return typeMap[ext] || 'file';
}

function scanAssetDir(dirPath, rootPath, depth = 0) {
  if (depth > 4) return [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name.endsWith('.meta')) continue;
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        const children = scanAssetDir(fullPath, rootPath, depth + 1);
        result.push({ name: entry.name, path: relPath, type: 'folder', children });
      } else {
        result.push({ name: entry.name, path: relPath, type: getAssetType(entry.name) });
      }
    }
    result.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
    return result;
  } catch (e) {
    return [];
  }
}

// ── CC 2.x 참고: props 추출 (CC 3.x only)
// CC 2.x는 enrichNode/dv 없이 scene script(getNode/getNodeTree)를 통해
// 이미 직렬화된 플레인 값을 반환하므로, 컴포넌트 props 추출은 CC 3.x 전용임.
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

  // POST /node/:uuid/zorder
  const zorderMatch = url.match(/^\/node\/([^\/]+)\/zorder$/);
  if (method === 'POST' && zorderMatch) {
    const uuid = zorderMatch[1];
    Editor.Scene.callSceneScript('cc-ws-extension', 'setNodeZOrder', { uuid, direction: body.direction }, (err) => {
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

  // GET /assets/tree
  if (method === 'GET' && url === '/assets/tree') {
    try {
      let projectPath = null;
      try { projectPath = Editor.projectPath; } catch(e) {}
      try { if (!projectPath) projectPath = Editor.Project?.path; } catch(e) {}
      if (!projectPath) projectPath = path.resolve(__dirname, '../../..');
      const assetsDir = path.join(projectPath, 'assets');
      if (!fs.existsSync(assetsDir)) {
        res.writeHead(200); res.end(JSON.stringify({ error: 'assets 폴더를 찾을 수 없습니다', tree: [] }));
        return;
      }
      const tree = scanAssetDir(assetsDir, assetsDir);
      res.writeHead(200); res.end(JSON.stringify({ tree, root: assetsDir }));
    } catch (e) {
      res.writeHead(200); res.end(JSON.stringify({ error: String(e), tree: [] }));
    }
    return;
  }

  // GET /status
  if (method === 'GET' && url === '/status') {
    res.writeHead(200); res.end(JSON.stringify({ ok: true, version: '2x', port: PORT, features: ['scene/tree', 'node', 'assets/tree', 'zorder'] }));
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

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        Editor.log(`[CC Bridge] Port ${PORT} already in use`);
      } else {
        Editor.error(`[cc-ws-ext] Server error: ${err.message}`);
      }
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
