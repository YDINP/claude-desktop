# PRD: SceneView — Track A: CC Extension + IPC 레이어

> 작성일: 2026-03-12
> 대상 기능: Cocos 씬뷰에서 canvas 크기(designResolution) 조회 API 추가

---

## 1. 현재 코드 분석

### 1-1. cc-ws-extension-2x/main.js

- **포트**: `9090`
- **HTTP 라우트 (현재)**:

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/scene/tree` | 씬 전체 노드 트리 (callSceneScript) |
| GET | `/node/:uuid` | 단일 노드 정보 (callSceneScript) |
| POST | `/node/:uuid/property` | 노드 프로퍼티 수정 |
| POST | `/node/:uuid/move` | 노드 이동 |
| GET | `/status` | `{ ok: true, version: '2x', port: 9090 }` |

- **씬 스크립트 호출 방식**: `Editor.Scene.callSceneScript('cc-ws-extension', '<method>', args, callback)`
- **WebSocket 이벤트 브로드캐스트**: `scene:ready`, `scene:saved`, `node:select`, `node:deselect`

### 1-2. cc-ws-extension-2x/scene-script.js

- **노출 메서드**: `getNodeTree`, `getNode`, `setNodeProperty`, `moveNode`
- **내부 유틸**: `findByUUID(node, uuid)`
- **2x API 접근 방식**: `cc.director.getScene()`, `node.uuid`, `node.width/height`, `node._components`, `cc.js.getClassName(c)`
- **Canvas 컴포넌트 접근**: 현재 미구현. 2x에서는 `cc.Canvas` 컴포넌트를 가진 노드에서 `canvas.designResolution`으로 접근 가능.

### 1-3. cc-ws-extension-3x/main.js

- **포트**: `9091`
- **HTTP 라우트 (현재)**:

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/scene/tree` | 씬 트리 (Editor.Message.request 'query-node-tree') |
| GET | `/debug/tree` | raw 씬 트리 |
| GET | `/debug/node/:uuid` | raw 단일 노드 |
| GET | `/node/:uuid` | enrichNode 처리된 노드 |
| POST | `/node/:uuid/property` | 노드 프로퍼티 수정 |
| POST | `/node/:uuid/move` | 노드 이동 |
| GET | `/status` | `{ ok: true, version: '3x', port: 9091 }` |

- **씬 스크립트 호출 방식**: `await Editor.Message.request('scene', 'query-node-tree')` (async)
- **dump 포맷 처리**: `dv()`, `enrichNode()` 헬퍼 함수로 CC 3.x dump wrapper 언래핑

### 1-4. cc-ws-extension-3x/scene-script.js

- **노출 메서드**: `getNodeTree`, `getNode`, `setNodeProperty`, `moveNode`
- **내부 유틸**: `findByUUID`, `getUITransform`, `getOpacity`, `getClassName`
- **3x API 접근 방식**: `node.getComponent(cc.UITransform)`, `node.setPosition()`, `node.angle`
- **Canvas 접근**: 3x는 `cc.Canvas` 대신 루트 Canvas 노드의 `UITransform.contentSize`로 근사 가능

### 1-5. cc-bridge.ts

- **현재 HTTP 메서드**:

| 메서드 | HTTP | 설명 |
|-------|------|------|
| `getTree()` | GET `/scene/tree` | 씬 트리 |
| `getNode(uuid)` | GET `/node/:uuid` | 단일 노드 |
| `setProperty(uuid, key, value)` | POST `/node/:uuid/property` | 프로퍼티 수정 |
| `moveNode(uuid, x, y)` | POST `/node/:uuid/move` | 노드 이동 |
| `checkStatus()` | GET `/status` | 상태 확인 |

- **포트 결정**: `port === 9091` → `'3x'`, 나머지 → `'2x'` (`this._port` 기반 fetch)

### 1-6. cc-handlers.ts

- **현재 IPC 핸들러**:

| 채널 | 동작 |
|------|------|
| `cc:connect` | `ccBridge.connect(port)` |
| `cc:disconnect` | `ccBridge.disconnect()` |
| `cc:status` | connected/port/version 반환 |
| `cc:getTree` | `ccBridge.getTree()` |
| `cc:getNode` | `ccBridge.getNode(uuid)` |
| `cc:setProperty` | `ccBridge.setProperty(uuid, key, value)` |
| `cc:moveNode` | `ccBridge.moveNode(uuid, x, y)` |
| `cc:detectProject` | 프로젝트 버전 감지 |
| `cc:openEditor` | CC 에디터 실행 |
| `cc:getPort` / `cc:setPort` | 포트 저장/조회 |
| `cc:installExtension` | extension 파일 복사 + npm install |

### 1-7. preload/index.ts

- **현재 노출된 CC API** (`window.api.cc*`):
  - `ccConnect`, `ccDisconnect`, `ccStatus`, `ccGetTree`, `ccGetNode`
  - `ccSetProperty`, `ccMoveNode`, `onCCEvent`, `onCCStatusChange`
  - `ccDetectProject`, `ccGetPort`, `ccSetPort`
  - `ccInstallExtension`, `ccOpenEditor`

### 1-8. ipc-schema.ts

- **CC 관련 상수**: `CC_CONNECT`, `CC_DISCONNECT`, `CC_STATUS`, `CC_GET_TREE`, `CC_GET_NODE`, `CC_SET_PROPERTY`, `CC_MOVE_NODE`, `CC_BUILD_WEB`, `CC_BUILD_STATUS`, `CC_EVENT`, `CC_DETECT_PROJECT`, `CC_GET_PORT`, `CC_SET_PORT`, `CC_INSTALL_EXTENSION`
- **CC 타입**: `CCNode`, `CCEvent`, `CCStatus`, `CCProjectInfo`
- **미존재**: `CanvasSize` 타입, `CC_GET_CANVAS_SIZE` 상수

---

## 2. 추가할 API 명세

### A-1: `GET /scene/canvas-size` — 2x extension (scene-script.js)

**목적**: 씬에서 Canvas 컴포넌트를 찾아 `designResolution` 반환

**2x scene-script.js에 추가할 메서드:**

```js
getCanvasSize(event) {
  const scene = cc.director.getScene();
  if (!scene) { event.reply('No scene loaded'); return; }

  // Canvas 컴포넌트를 가진 노드 탐색
  function findCanvas(node) {
    const canvas = node.getComponent(cc.Canvas);
    if (canvas) return canvas;
    for (const child of node.children) {
      const found = findCanvas(child);
      if (found) return found;
    }
    return null;
  }

  const canvas = findCanvas(scene);
  if (!canvas) { event.reply('Canvas component not found'); return; }

  const dr = canvas.designResolution;
  event.reply(null, { width: dr.width, height: dr.height });
},
```

**2x main.js에 추가할 라우트** (기존 `GET /status` 블록 앞에 삽입):

```js
// GET /scene/canvas-size
if (method === 'GET' && url === '/scene/canvas-size') {
  Editor.Scene.callSceneScript('cc-ws-extension', 'getCanvasSize', {}, (err, result) => {
    if (err) { res.writeHead(500); res.end(JSON.stringify({ error: String(err) })); return; }
    res.writeHead(200); res.end(JSON.stringify(result));
  });
  return;
}
```

### A-2: `GET /scene/canvas-size` — 3x extension

**3x의 Canvas 크기 조회 전략 (두 가지 중 선택):**

**전략 1 (권장): scene-script.js 에서 UITransform 기반 조회**

3x scene-script.js에 추가할 메서드:

```js
getCanvasSize() {
  const scene = cc.director.getScene();
  if (!scene) return null;

  // cc.Canvas 컴포넌트 또는 이름이 'Canvas'인 노드 탐색
  function findCanvasNode(node) {
    try {
      const comp = cc.Canvas ? node.getComponent(cc.Canvas) : null;
      if (comp) return node;
    } catch {}
    if (node.name === 'Canvas') return node;
    for (const child of node.children) {
      const found = findCanvasNode(child);
      if (found) return found;
    }
    return null;
  }

  const canvasNode = findCanvasNode(scene);
  if (!canvasNode) return null;

  const uiTrans = getUITransform(canvasNode);
  if (!uiTrans) return null;

  return {
    width: Math.round(uiTrans.contentSize.width),
    height: Math.round(uiTrans.contentSize.height),
  };
},
```

**전략 2 (대안): Editor.Message.request로 프로젝트 설정 조회**

```js
// main.js의 routeRequest3x 내
if (method === 'GET' && url === '/scene/canvas-size') {
  try {
    // CC 3.x: project-setting에서 canvas 크기 조회 시도
    const settings = await Editor.Message.request('project', 'query-settings', 'general');
    const w = settings?.designWidth ?? settings?.width;
    const h = settings?.designHeight ?? settings?.height;
    if (w && h) {
      res.writeHead(200); res.end(JSON.stringify({ width: w, height: h }));
      return;
    }
  } catch {}
  // fallback: scene-script로 UITransform 조회
  // ... (전략 1 방식으로 fallback)
}
```

> **주의**: `Editor.Message.request('project', ...)` API는 CC 버전마다 지원 여부가 다름. 전략 1(scene-script 기반 UITransform)이 더 안정적.

**3x main.js에 추가할 라우트** (기존 `GET /status` 블록 앞에 삽입):

```js
if (method === 'GET' && url === '/scene/canvas-size') {
  const raw = await Editor.Message.request('scene', 'call-scene-script', {
    name: 'cc-ws-extension-3x',
    method: 'getCanvasSize',
    args: [],
  });
  if (!raw) { res.writeHead(404); res.end(JSON.stringify({ error: 'Canvas not found' })); return; }
  res.writeHead(200); res.end(JSON.stringify(raw));
  return;
}
```

> **참고**: 3x scene-script가 `call-scene-script` 메시지를 지원하지 않는 경우, 트리에서 직접 Canvas 노드를 찾아 `query-node`로 UITransform size를 추출하는 방식으로 대체 가능.

### A-3: cc-bridge.ts에 `getCanvasSize()` 메서드 추가

기존 `getTree()`, `getNode()` 패턴과 동일:

```ts
async getCanvasSize(): Promise<{ width: number; height: number }> {
  const resp = await fetch(`http://127.0.0.1:${this._port}/scene/canvas-size`)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}
```

삽입 위치: `getTree()` 메서드 바로 다음 (line 80 이후)

### A-4: cc-handlers.ts에 IPC 핸들러 추가

기존 `ipcMain.handle(CC_GET_TREE, ...)` 패턴과 동일:

```ts
ipcMain.handle(CC_GET_CANVAS_SIZE, async () => {
  return ccBridge.getCanvasSize()
})
```

- `CC_GET_CANVAS_SIZE` 상수를 ipc-schema.ts에서 import
- 삽입 위치: `CC_GET_TREE` 핸들러 바로 다음 (line 43 이후)

### A-5: preload/index.ts에 `ccGetCanvasSize` 노출

**contextBridge.exposeInMainWorld 섹션** (Cocos Creator 블록 내):

```ts
ccGetCanvasSize: (): Promise<import('../shared/ipc-schema').CanvasSize> =>
  ipcRenderer.invoke('cc:getCanvasSize'),
```

삽입 위치: `ccGetTree` 바로 다음 (line 250 이후)

**Window 타입 선언 섹션** (Cocos Creator 블록 내):

```ts
ccGetCanvasSize: () => Promise<import('../shared/ipc-schema').CanvasSize>
```

삽입 위치: `ccGetTree: () => Promise<unknown>` 바로 다음

### A-6: ipc-schema.ts에 타입 및 상수 추가

**타입 추가** (`CCStatus` 인터페이스 다음에):

```ts
export interface CanvasSize {
  width: number
  height: number
}
```

**상수 추가** (기존 CC 상수 블록 맨 끝):

```ts
export const CC_GET_CANVAS_SIZE = 'cc:getCanvasSize'
```

**cc-handlers.ts import 수정**:

```ts
import {
  CC_CONNECT, CC_DISCONNECT, CC_STATUS,
  CC_GET_TREE, CC_GET_NODE, CC_SET_PROPERTY, CC_MOVE_NODE,
  CC_EVENT, CC_DETECT_PROJECT, CC_GET_PORT, CC_SET_PORT, CC_INSTALL_EXTENSION,
  CC_GET_CANVAS_SIZE,
} from '../../shared/ipc-schema'
```

---

## 3. 수정 파일 목록 & 변경 내용 요약

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `extensions/cc-ws-extension-2x/scene-script.js` | 기능 추가 | `getCanvasSize` 메서드 추가 — `cc.Canvas` 컴포넌트 탐색 후 `designResolution` 반환 |
| `extensions/cc-ws-extension-2x/main.js` | 기능 추가 | `GET /scene/canvas-size` 라우트 추가 — `callSceneScript` 경유 |
| `extensions/cc-ws-extension-3x/scene-script.js` | 기능 추가 | `getCanvasSize` 메서드 추가 — Canvas 노드 탐색 후 `UITransform.contentSize` 반환 |
| `extensions/cc-ws-extension-3x/main.js` | 기능 추가 | `GET /scene/canvas-size` 라우트 추가 — `call-scene-script` 또는 트리 탐색 방식 |
| `src/main/cc/cc-bridge.ts` | 기능 추가 | `getCanvasSize()` async 메서드 추가 — `GET /scene/canvas-size` fetch |
| `src/main/ipc/cc-handlers.ts` | 기능 추가 | `cc:getCanvasSize` IPC 핸들러 등록 + import에 `CC_GET_CANVAS_SIZE` 추가 |
| `src/preload/index.ts` | 기능 추가 | `ccGetCanvasSize` 노출 (contextBridge + Window 타입 선언 양쪽) |
| `src/shared/ipc-schema.ts` | 타입/상수 추가 | `CanvasSize` 인터페이스, `CC_GET_CANVAS_SIZE` 상수 추가 |

**수정 파일 수**: 8개
**신규 파일**: 없음

---

## 4. 의존성 & 주의사항

### 4-1. 2x vs 3x 차이점

| 항목 | CC 2.x | CC 3.x |
|------|--------|--------|
| Canvas 크기 API | `cc.Canvas.designResolution` ({width, height}) | `UITransform.contentSize` (Canvas 노드) |
| Scene script 호출 | `Editor.Scene.callSceneScript(...)` callback 기반 | `Editor.Message.request('scene', 'call-scene-script', ...)` Promise 기반 |
| Canvas 탐색 기준 | `node.getComponent(cc.Canvas)` | `node.getComponent(cc.Canvas)` 또는 `node.name === 'Canvas'` fallback |
| 반환값 단위 | `designResolution` = 논리 해상도 (변환 없음) | `contentSize` = UITransform의 논리 크기 (동일 단위) |

### 4-2. CC 미연결 시 fallback

cc-bridge.ts의 `getCanvasSize()`는 fetch 실패 시 예외를 throw함. 호출 측 (IPC 핸들러, renderer)에서 try/catch로 처리하거나 `null` 반환으로 래핑 권장:

```ts
// cc-handlers.ts 내 권장 처리
ipcMain.handle(CC_GET_CANVAS_SIZE, async () => {
  try {
    return await ccBridge.getCanvasSize()
  } catch {
    return null
  }
})
```

### 4-3. 에러 처리

- **2x**: `callSceneScript` 콜백의 `err` 인자로 에러 전달 → HTTP 500 반환
- **3x**: `call-scene-script` 메시지가 지원되지 않거나 null 반환 시 → HTTP 404 반환
- **cc-bridge**: `resp.ok` 검사 후 예외 throw (기존 패턴 동일)
- **renderer**: `window.api.ccGetCanvasSize()` 호출 시 `null` 반환되면 기본값 `{ width: 960, height: 640 }` 등으로 fallback 처리 권장

### 4-4. CC 3x scene-script call-scene-script 지원 여부

CC 3.x에서 `Editor.Message.request('scene', 'call-scene-script', ...)` 방식은 CC 버전에 따라 API명이 다를 수 있음. 실제 동작 확인 필요:
- CC 3.6.x: `call-scene-script` 지원 여부 불명확
- 불확실하면 **대안**: 트리 조회 후 `name === 'Canvas'` 노드의 `query-node` 결과에서 `__comps__`의 `cc.UITransform.contentSize` 추출 (main.js 내에서 전부 처리 가능, scene-script 불필요)

**3x 대안 구현 (main.js에서 scene-script 없이 처리):**

```js
if (method === 'GET' && url === '/scene/canvas-size') {
  // 트리에서 Canvas 노드 탐색
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
  // query-node로 UITransform contentSize 조회
  const nodeRaw = await Editor.Message.request('scene', 'query-node', canvasNode.uuid);
  const node = enrichNode(nodeRaw);
  res.writeHead(200); res.end(JSON.stringify({ width: node.size.width, height: node.size.height }));
  return;
}
```

이 방식은 scene-script 수정 없이 main.js만으로 처리 가능하며 3x 버전 호환성이 더 높음.

---

## 5. 구현 순서 (권장)

1. `ipc-schema.ts` — `CanvasSize` 타입 + `CC_GET_CANVAS_SIZE` 상수 추가
2. `cc-ws-extension-2x/scene-script.js` — `getCanvasSize` 추가
3. `cc-ws-extension-2x/main.js` — 라우트 추가
4. `cc-ws-extension-3x/main.js` — 라우트 추가 (대안 방식 권장)
5. `cc-bridge.ts` — `getCanvasSize()` 메서드 추가
6. `cc-handlers.ts` — IPC 핸들러 등록
7. `preload/index.ts` — `ccGetCanvasSize` 노출

각 단계는 독립적으로 완결되며, 5→6→7 순서 의존성 있음 (bridge → handler → preload).
