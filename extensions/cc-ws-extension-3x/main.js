'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 9091;
let httpServer = null;
let wss = null;
const clients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

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

// CC 3.x dump 포맷: 각 필드가 {value, type, default, readonly, ...}로 래핑될 수 있음
// 단, {type: "cc.X", value: "uuid-ref"} 형태의 컴포넌트 참조는 언래핑하지 않음
function dv(field) {
  if (field === null || field === undefined) return field;
  if (typeof field !== 'object') return field;
  // dump wrapper 판별: readonly/visible/animatable/displayName 중 하나 이상 있으면 dump
  if ('value' in field && ('readonly' in field || 'animatable' in field || 'displayName' in field)) {
    return field.value;
  }
  return field;
}

// 컴포넌트 타입 추출 (트리 / dump 양쪽 처리)
function compType(c) {
  if (!c) return 'unknown';
  if (typeof c === 'string') return c;
  // plain string type (tree: {type:"cc.X", value:"uuid-ref", extends:[...]})
  if (c.type && typeof c.type === 'string') return c.type;
  if (c.__type__ && typeof c.__type__ === 'string') return c.__type__;
  // nested dump: type field itself is dump wrapper
  if (c.type && typeof c.type === 'object' && c.type.value) return String(c.type.value);
  return 'unknown';
}

// CC 3.x query-node-tree / query-node 응답을 CCNode 포맷으로 변환
// query-node-tree: plain values, children are full objects, components = [{type:"cc.X", value:"uuid-ref"}]
// query-node: dump-wrapped fields, __comps__ has UITransform with size/anchor, children are UUID refs only
function enrichNode(raw) {
  if (!raw) return null;
  // 최상위 dump 래퍼 벗기기
  const n = (raw.value && typeof raw.value === 'object' && !Array.isArray(raw.value)
    && ('readonly' in raw || 'animatable' in raw || 'displayName' in raw))
    ? raw.value : raw;

  // query-node 포맷 판별: name이 dump-wrapped object이면 query-node 응답
  const isNodeDump = n.name && typeof n.name === 'object' && 'value' in n.name;

  const pos = dv(n.position) || { x: 0, y: 0, z: 0 };

  // rotation: query-node에서는 Vec3 {x,y,z} — 2D 각도는 .z
  let rotation = 0;
  if (isNodeDump) {
    const rotVec = dv(n.rotation);
    rotation = (rotVec && typeof rotVec === 'object') ? (rotVec.z ?? 0) : (rotVec ?? 0);
  } else {
    const angle = dv(n.angle);
    const rot   = dv(n.rotation);
    rotation = (angle !== undefined && angle !== null) ? angle : (rot || 0);
  }

  // __comps__: query-node의 컴포넌트 배열 (각 항목: {type:"cc.X", value:{...dump props...}})
  const compsArr = Array.isArray(n.__comps__) ? n.__comps__ : [];

  // size & anchor: query-node → UITransform.__comps__ 에서 추출
  let size   = { width: 0, height: 0 };
  let anchor = { x: 0.5, y: 0.5 };
  if (isNodeDump) {
    const uiTr = compsArr.find(c => c.type === 'cc.UITransform');
    if (uiTr && uiTr.value) {
      const cs = dv(uiTr.value.contentSize);
      const ap = dv(uiTr.value.anchorPoint);
      if (cs) size   = { width: cs.width ?? 0, height: cs.height ?? 0 };
      if (ap) anchor = { x: ap.x ?? 0.5, y: ap.y ?? 0.5 };
    }
  } else {
    const s = dv(n.contentSize) || dv(n.size) || {};
    const a = dv(n.anchorPoint) || dv(n.anchor) || {};
    size   = { width: s.width ?? 0, height: s.height ?? 0 };
    anchor = { x: a.x ?? 0.5, y: a.y ?? 0.5 };
  }

  // opacity: query-node → UIOpacity 컴포넌트에서 추출
  let opacity = 255;
  if (isNodeDump) {
    const uiOp = compsArr.find(c => c.type === 'cc.UIOpacity');
    if (uiOp && uiOp.value) {
      const opVal = dv(uiOp.value.opacity);
      if (opVal !== undefined && opVal !== null) opacity = opVal;
    }
  } else {
    opacity = dv(n.opacity) ?? 255;
  }

  // components: query-node → __comps__.type, tree → components[].type
  const rawTreeComps = dv(n.__components) || dv(n.components) || [];
  const components = isNodeDump
    ? compsArr.map(c => ({ type: c.type || 'unknown' }))
    : (Array.isArray(rawTreeComps) ? rawTreeComps.map(c => ({ type: compType(c) })) : []);

  // children: query-node에서는 UUID ref만 있으므로 빈 배열, tree에서는 재귀
  const rawChildren = dv(n.children) || dv(n._children) || [];
  const children = (!isNodeDump && Array.isArray(rawChildren))
    ? rawChildren.map(enrichNode).filter(Boolean)
    : [];

  return {
    uuid:     dv(n.uuid)   || n.__uuid__ || '',
    name:     dv(n.name)   || '',
    active:   dv(n.active) !== false,
    position: { x: (pos && pos.x) ?? 0, y: (pos && pos.y) ?? 0 },
    size,
    anchor,
    scale:    dv(n.scale)  || { x: 1, y: 1 },
    rotation,
    opacity,
    color:    dv(n.color)  || { r: 255, g: 255, b: 255, a: 255 },
    children,
    components,
  };
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
      try { res.writeHead(500); res.end(JSON.stringify({ error: String(e) })); } catch {}
    }
  });
}

async function routeRequest3x(method, url, body, res) {
  if (method === 'GET' && url === '/scene/tree') {
    const raw = await Editor.Message.request('scene', 'query-node-tree');
    console.log('[cc-ws-ext] tree raw:', JSON.stringify(raw).slice(0, 800));
    const result = enrichNode(raw);
    res.writeHead(200); res.end(JSON.stringify(result ?? null));
    return;
  }

  if (method === 'GET' && url === '/debug/tree') {
    const raw = await Editor.Message.request('scene', 'query-node-tree');
    res.writeHead(200); res.end(JSON.stringify(raw ?? null));
    return;
  }

  const debugNodeMatch = url.match(/^\/debug\/node\/([^\/]+)$/);
  if (method === 'GET' && debugNodeMatch) {
    const raw = await Editor.Message.request('scene', 'query-node', debugNodeMatch[1]);
    res.writeHead(200); res.end(JSON.stringify(raw ?? null));
    return;
  }

  const nodeMatch = url.match(/^\/node\/([^\/]+)$/);
  if (method === 'GET' && nodeMatch) {
    const raw = await Editor.Message.request('scene', 'query-node', nodeMatch[1]);
    const result = enrichNode(raw);
    res.writeHead(200); res.end(JSON.stringify(result ?? null));
    return;
  }

  const propMatch = url.match(/^\/node\/([^\/]+)\/property$/);
  if (method === 'POST' && propMatch) {
    const uuid = propMatch[1];
    const { key, value } = body;
    // 현재 노드 조회해서 Vec3/Size 전체를 같이 전달
    const raw = await Editor.Message.request('scene', 'query-node', uuid);
    const node = enrichNode(raw);

    if (key === 'x') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'position',
        dump: { type: 'cc.Vec3', value: { x: value, y: node?.position?.y ?? 0, z: 0 } }
      });
    } else if (key === 'y') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'position',
        dump: { type: 'cc.Vec3', value: { x: node?.position?.x ?? 0, y: value, z: 0 } }
      });
    } else if (key === 'width') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'contentSize',
        dump: { type: 'cc.Size', value: { width: value, height: node?.size?.height ?? 0 } }
      });
    } else if (key === 'height') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'contentSize',
        dump: { type: 'cc.Size', value: { width: node?.size?.width ?? 0, height: value } }
      });
    } else if (key === 'anchorX') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'anchorPoint',
        dump: { type: 'cc.Vec2', value: { x: value, y: node?.anchor?.y ?? 0.5 } }
      });
    } else if (key === 'anchorY') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'anchorPoint',
        dump: { type: 'cc.Vec2', value: { x: node?.anchor?.x ?? 0.5, y: value } }
      });
    } else if (key === 'opacity') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'opacity',
        dump: { type: 'cc.Integer', value }
      });
    } else if (key === 'rotation') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'angle',
        dump: { type: 'cc.Float', value }
      });
    } else if (key === 'scaleX') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'scale',
        dump: { type: 'cc.Vec3', value: { x: value, y: node?.scale?.y ?? 1, z: 1 } }
      });
    } else if (key === 'scaleY') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'scale',
        dump: { type: 'cc.Vec3', value: { x: node?.scale?.x ?? 1, y: value, z: 1 } }
      });
    } else if (key === 'active') {
      await Editor.Message.request('scene', 'set-property', {
        uuid, path: 'active',
        dump: { type: 'cc.Boolean', value }
      });
    }

    res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    return;
  }

  const moveMatch = url.match(/^\/node\/([^\/]+)\/move$/);
  if (method === 'POST' && moveMatch) {
    await Editor.Message.request('scene', 'set-property', {
      uuid: moveMatch[1], path: 'position',
      dump: { type: 'cc.Vec3', value: { x: body.x, y: body.y, z: 0 } }
    });
    res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (method === 'GET' && url === '/scene/canvas-size') {
    function findCanvasInTree(node) {
      if (!node) return null;
      const comps = (node.components || []).map(c => compType(c));
      if (comps.includes('cc.Canvas') || node.name === 'Canvas') return node;
      for (const child of (node.children || [])) {
        const found = findCanvasInTree(child);
        if (found) return found;
      }
      return null;
    }
    const raw = await Editor.Message.request('scene', 'query-node-tree');
    const tree = enrichNode(raw);
    const canvasNode = findCanvasInTree(tree);
    if (!canvasNode) {
      res.writeHead(404); res.end(JSON.stringify({ error: 'Canvas not found' })); return;
    }
    const nodeRaw = await Editor.Message.request('scene', 'query-node', canvasNode.uuid);
    const node = enrichNode(nodeRaw);
    res.writeHead(200); res.end(JSON.stringify({ width: node.size.width, height: node.size.height }));
    return;
  }

  if (method === 'GET' && url === '/assets/tree') {
    try {
      let projectPath = null;
      try { projectPath = Editor.Project.path; } catch(e) {}
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

  if (method === 'GET' && url === '/status') {
    res.writeHead(200); res.end(JSON.stringify({ ok: true, version: '3x', port: PORT, features: ['scene/tree', 'node', 'assets/tree'] }));
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

    Editor.Message.addBroadcastListener('scene:ready', () => broadcast({ type: 'scene:ready' }));
    Editor.Message.addBroadcastListener('scene:saved', () => broadcast({ type: 'scene:saved' }));
    Editor.Message.addBroadcastListener('selection:select', (type, uuids) => {
      if (type === 'node') broadcast({ type: 'node:select', uuids });
    });
    Editor.Message.addBroadcastListener('selection:unselect', (type, uuids) => {
      if (type === 'node') broadcast({ type: 'node:deselect', uuids });
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
