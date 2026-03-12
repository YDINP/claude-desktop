# PRD: Cocos Creator 통합 — Claude Desktop CC 워크스테이션

## 개요

### 배경
- **claude-desktop**은 Claude AI와 파일 편집을 통합한 Electron 앱
- 사용자는 Cocos Creator(CC) 프로젝트 UI 배치 작업을 CC 에디터 없이 claude-desktop 안에서 완결하고자 함
- 기존 `cocos-editor-server(HTTP)`는 단방향/제한적 API로 인한 한계 존재
- CC 에디터는 별도 Electron 앱이라 창 임베드 불가 (GPU 합성 충돌)
- Kapi 프로젝트에 이미 `cocos-mcp-server(HTTP)` 기반 코드 존재

### 목표
claude-desktop 안에서 다음을 모두 지원하는 통합 워크스테이션 구축:
- CC 씬 트리 확인 (실시간)
- 노드 프로퍼티 편집
- 웹 빌드 미리보기
- Claude 자연어 명령으로 씬 편집

### 비목표
- CC 에디터 창 임베드 (기술적 불가)
- CC 에디터 완전 대체
- 애니메이션/파티클 렌더링

---

## 아키텍처

### 시스템 다이어그램

```
claude-desktop (Electron)
├── 새 사이드바 패널들
│   ├── SceneTreePanel     — CC 씬 노드 계층 실시간 표시
│   ├── NodePropertyPanel  — 선택 노드 프로퍼티 편집
│   └── WebPreviewPanel    — CC 웹빌드 결과 iframe
├── src/main/ipc/cc-handlers.ts  — CC Extension 클라이언트
├── src/main/cc/cc-bridge.ts     — WebSocket 연결 관리
└── src/shared/ipc-schema.ts     — CC_* IPC 채널 추가

CC Creator Extension (프로젝트별 설치)
├── package.json           — Extension 메타데이터
├── main.js                — WebSocket 서버 (port: 9090)
├── scene-script.js        — 씬 접근 API
└── 지원 버전: CC 2.x / CC 3.x (버전별 구현)
```

### 통신 프로토콜

| 계층 | 기술 | 용도 |
|------|------|------|
| Transport | HTTP REST + WebSocket | Extension ↔ claude-desktop |
| IPC | Electron IPC | Renderer ↔ Main |
| Schema | `ipc-schema.ts` | 채널 정의 및 타입 안전 |

---

## 구현 계획

### Round 64: CC Extension WebSocket 서버

**목표**: Cocos Creator Extension에 WebSocket 기반 실시간 서버 구현

#### CC 2.x Extension (`packages/cc-extension-2x/`)

**파일 구조**
```
packages/cc-extension-2x/
├── package.json           — Extension 메타데이터
├── main.js                — WebSocket + HTTP 서버
├── scene-script.js        — 씬 접근 헬퍼 API
└── README.md              — 설치 및 사용 가이드
```

**WebSocket 서버 구현 (`main.js`)**
- 포트: `9090`
- HTTP REST API 병행 유지 (기존 호환성)
- Push 이벤트: `scene:ready`, `scene:saved`, `node:select`, `node:deselect`

**API 엔드포인트**

| Method | Endpoint | 설명 | Request Body |
|--------|----------|------|--------------|
| GET | `/scene/tree` | 전체 노드 트리 조회 | - |
| GET | `/node/:uuid` | 노드 상세 정보 | - |
| POST | `/node/:uuid/property` | 프로퍼티 수정 | `{ key: string, value: unknown }` |
| POST | `/node/:uuid/move` | 위치 이동 | `{ x: number, y: number }` |
| POST | `/build/web` | 웹빌드 트리거 | - |
| GET | `/build/status` | 빌드 상태 조회 | - |

**주요 코드 구조**
```js
const http = require('http')
const WebSocket = require('ws')

// HTTP 서버 (기존 호환)
const httpServer = http.createServer(handleRequest)

// WebSocket 서버
const wss = new WebSocket.Server({ server: httpServer })
const clients = new Set()

wss.on('connection', (ws) => {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
})

// CC 이벤트 → WebSocket push
Editor.on('scene:ready', () => broadcast({ type: 'scene:ready' }))
Editor.Selection.on('select', (type, ids) => {
  if (type === 'node') broadcast({ type: 'node:select', uuids: ids })
})

function broadcast(data) {
  const msg = JSON.stringify(data)
  clients.forEach(ws => ws.readyState === 1 && ws.send(msg))
}

httpServer.listen(9090)
```

#### CC 3.x Extension (`packages/cc-extension-3x/`)

**동일 HTTP/WebSocket 인터페이스** 제공 (API 스키마 동일)
- 내부 구현만 `Editor.Message.*` API로 변경
- CC 3.x 고유 API (`Node.*`, `Scene.*`) 어댑터 계층

---

### Round 65: claude-desktop CC 패널

**목표**: Electron IPC 기반 UI 패널 구현

#### IPC 채널 정의 (`src/shared/ipc-schema.ts`)

```ts
// 연결 관리
export const CC_CONNECT = 'cc:connect'         // (port?: number) → void
export const CC_DISCONNECT = 'cc:disconnect'   // () → void
export const CC_STATUS = 'cc:status'           // () → { connected: boolean, port: number }

// 데이터 조회
export const CC_GET_TREE = 'cc:getTree'       // () → CCNode[]
export const CC_GET_NODE = 'cc:getNode'       // (uuid: string) → CCNode | null

// 데이터 수정
export const CC_SET_PROPERTY = 'cc:setProperty'  // (uuid: string, key: string, value: unknown) → void
export const CC_MOVE_NODE = 'cc:moveNode'       // (uuid: string, x: number, y: number) → void

// 빌드
export const CC_BUILD_WEB = 'cc:buildWeb'       // () → void
export const CC_BUILD_STATUS = 'cc:buildStatus' // () → { building: boolean, progress: number }

// Push 이벤트
export const CC_EVENT = 'cc:event'              // { type: 'scene:ready' | 'node:select' | ... }

// 타입 정의
export interface CCNode {
  uuid: string
  name: string
  type: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  anchor: { x: number; y: number }
  opacity: number
  color: { r: number; g: number; b: number; a: number }
  children: CCNode[]
}

export interface CCEvent {
  type: 'scene:ready' | 'scene:saved' | 'node:select' | 'node:deselect'
  payload?: unknown
}
```

#### IPC 핸들러 (`src/main/ipc/cc-handlers.ts`)

```ts
import { ipcMain } from 'electron'
import { ccBridge } from '../cc/cc-bridge'
import { CC_* } from '../../shared/ipc-schema'

ipcMain.handle(CC_CONNECT, async (event, port = 9090) => {
  return ccBridge.connect(port)
})

ipcMain.handle(CC_GET_TREE, async () => {
  return ccBridge.getTree()
})

ipcMain.handle(CC_SET_PROPERTY, async (event, uuid, key, value) => {
  return ccBridge.setProperty(uuid, key, value)
})

ipcMain.handle(CC_MOVE_NODE, async (event, uuid, x, y) => {
  return ccBridge.moveNode(uuid, x, y)
})

ipcMain.handle(CC_BUILD_WEB, async () => {
  return ccBridge.buildWeb()
})

// Event 수신 시 Renderer로 전달
ccBridge.onEvent((event) => {
  mainWindow.webContents.send(CC_EVENT, event)
})
```

#### CC 브릿지 (`src/main/cc/cc-bridge.ts`)

```ts
import WebSocket from 'ws'

interface CCNode { /* ... */ }
interface CCEvent { /* ... */ }

class CCBridge {
  private ws: WebSocket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private eventHandlers: ((event: CCEvent) => void)[] = []

  async connect(port = 9090): Promise<boolean> {
    if (this.ws?.readyState === WebSocket.OPEN) return true

    return new Promise((resolve) => {
      this.ws = new WebSocket(`ws://localhost:${port}`)

      this.ws.on('open', () => {
        console.log('[CC] Connected')
        resolve(true)
      })

      this.ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString())
          this.eventHandlers.forEach(h => h(event))
        } catch (err) {
          console.error('[CC] Message parse error:', err)
        }
      })

      this.ws.on('close', () => {
        console.log('[CC] Disconnected')
        this.scheduleReconnect()
      })

      this.ws.on('error', (err) => {
        console.error('[CC] WebSocket error:', err)
        resolve(false)
      })
    })
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.ws) this.ws.close()
  }

  async getTree(): Promise<CCNode[]> {
    const resp = await fetch('http://localhost:9090/scene/tree')
    return resp.json()
  }

  async setProperty(uuid: string, key: string, value: unknown) {
    await fetch(`http://localhost:9090/node/${uuid}/property`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    })
  }

  async moveNode(uuid: string, x: number, y: number) {
    await fetch(`http://localhost:9090/node/${uuid}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y })
    })
  }

  async buildWeb() {
    await fetch('http://localhost:9090/build/web', { method: 'POST' })
  }

  onEvent(handler: (event: CCEvent) => void) {
    this.eventHandlers.push(handler)
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => this.connect(), 3000)
  }
}

export const ccBridge = new CCBridge()
```

#### UI 컴포넌트 (`src/renderer/src/components/sidebar/`)

**CocosPanel.tsx** — CC 탭 컨테이너
```tsx
import { useState, useEffect } from 'react'
import { useIPC } from '@/hooks/useIPC'
import { CC_CONNECT, CC_STATUS, CC_EVENT } from '@/shared/ipc-schema'
import SceneTreePanel from './SceneTreePanel'
import NodePropertyPanel from './NodePropertyPanel'
import WebPreviewPanel from './WebPreviewPanel'

export default function CocosPanel() {
  const { invoke, on } = useIPC()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    invoke(CC_CONNECT, 9090)
    const unsubscribe = on(CC_EVENT, (event) => {
      console.log('[Panel] Event:', event)
      // 씬 트리 갱신 등
    })
    return unsubscribe
  }, [])

  return (
    <div className="cocos-panel">
      <div className="header">
        <h2>🎮 Cocos Creator</h2>
        <span className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? '연결됨' : '대기 중...'}
        </span>
      </div>
      <SceneTreePanel />
      <NodePropertyPanel />
      <WebPreviewPanel />
    </div>
  )
}
```

**SceneTreePanel.tsx** — 노드 트리
```tsx
import { useState, useEffect } from 'react'
import { useIPC } from '@/hooks/useIPC'
import { CC_GET_TREE } from '@/shared/ipc-schema'

export default function SceneTreePanel() {
  const { invoke } = useIPC()
  const [nodes, setNodes] = useState([])

  useEffect(() => {
    invoke(CC_GET_TREE).then(setNodes)
  }, [])

  return (
    <div className="scene-tree">
      <h3>씬 트리</h3>
      <NodeTree nodes={nodes} />
    </div>
  )
}
```

**NodePropertyPanel.tsx** — 프로퍼티 편집
```tsx
import { useState } from 'react'
import { useIPC } from '@/hooks/useIPC'
import { CC_SET_PROPERTY, CC_MOVE_NODE } from '@/shared/ipc-schema'

export default function NodePropertyPanel({ selectedNode }) {
  const { invoke } = useIPC()
  const [position, setPosition] = useState(selectedNode?.position)

  const handlePositionChange = (x, y) => {
    invoke(CC_MOVE_NODE, selectedNode.uuid, x, y)
  }

  return (
    <div className="node-property">
      <h3>프로퍼티</h3>
      <div className="property-group">
        <label>위치 X</label>
        <input value={position.x} onChange={(e) => setPosition({ ...position, x: e.target.value })} />
      </div>
      {/* 더 많은 프로퍼티... */}
    </div>
  )
}
```

**WebPreviewPanel.tsx** — 웹빌드 미리보기
```tsx
export default function WebPreviewPanel() {
  const buildUrl = 'http://localhost:8080/game.html'

  return (
    <div className="web-preview">
      <h3>웹빌드 미리보기</h3>
      <iframe src={buildUrl} title="Game Preview" />
    </div>
  )
}
```

#### Sidebar 탭 추가
```tsx
// src/renderer/src/components/sidebar/SidebarTabs.tsx
const tabs = [
  { id: 'explorer', label: '📁', title: 'Explorer' },
  { id: 'search', label: '🔍', title: 'Search' },
  { id: 'cocos', label: '🎮', title: 'Cocos' },  // 신규
  { id: 'debug', label: '🐞', title: 'Debug' },
]
```

---

### Round 66: Claude 자연어 씬 편집 연동

**목표**: Claude가 CC 씬을 직접 편집할 수 있는 컨텍스트 주입 및 자동화

#### 씬 컨텍스트 자동 포함

Claude 채팅 입력 시 현재 씬 트리를 자동으로 컨텍스트에 포함:

```markdown
## Current Cocos Creator Scene

Scene: MainMenu.fire
Root: Canvas
├── Button (LoginButton)
│   ├── Label "로그인"
├── Panel (HealthBar)
│   ├── Sprite (Background)
│   ├── Sprite (FillBar)
│   └── Label "100/100"

Selected Node: LoginButton
  position: {x: 100, y: 250}
  size: {width: 200, height: 80}
  opacity: 255
  color: {r: 255, g: 255, b: 255, a: 255}
```

#### Claude 명령 예시 및 실행 흐름

| 명령 | 추론 | 실행 API |
|------|------|---------|
| "버튼을 화면 중앙에 배치해줘" | Canvas 크기 기반 중앙 좌표 계산 | `CC_MOVE_NODE(LoginButton, 320, 360)` |
| "헬스바 너비를 300으로 변경해줘" | width 프로퍼티 수정 | `CC_SET_PROPERTY(FillBar, 'width', 300)` |
| "로그인 패널 노드들 목록 보여줘" | 트리 필터링 | `CC_GET_TREE` 후 Panel 하위 노드 추출 |
| "버튼 색상을 빨강으로 바꿔" | RGB 값으로 변환 | `CC_SET_PROPERTY(LoginButton, 'color', {r:255, g:0, b:0, a:255})` |

#### IPC 브릿지 자동화

Claude 응답 파싱 → CC API 호출 자동화:

```ts
// src/main/claude/cc-automation.ts
interface CCAction {
  type: 'setProperty' | 'moveNode' | 'buildWeb'
  uuid: string
  key?: string
  value?: unknown
  x?: number
  y?: number
}

export async function executeClaudeActions(actions: CCAction[]) {
  for (const action of actions) {
    switch (action.type) {
      case 'setProperty':
        await ccBridge.setProperty(action.uuid, action.key!, action.value)
        break
      case 'moveNode':
        await ccBridge.moveNode(action.uuid, action.x!, action.y!)
        break
      case 'buildWeb':
        await ccBridge.buildWeb()
        break
    }
  }
  // 빌드 후 WebPreviewPanel 자동 새로고침
  mainWindow.webContents.send('cc:previewRefresh')
}
```

#### 씬 편집 프롬프트 템플릿

Claude 시스템 프롬프트에 추가:

```markdown
## Cocos Creator 통합 모드

사용자가 Cocos Creator 씬 편집을 요청할 때:

1. **현재 씬 컨텍스트 확인**: 제공된 노드 트리 구조 분석
2. **동작 분석**: 사용자 의도를 CC API 동작으로 변환
3. **액션 제안**: 실행할 API 호출을 마크다운 코드블록으로 제시
4. **실행 승인**: 사용자 확인 후 액션 실행 (또는 자동 실행 옵션)

### 지원 액션 포맷

\`\`\`json
[
  { "type": "moveNode", "uuid": "abc123", "x": 320, "y": 360 },
  { "type": "setProperty", "uuid": "def456", "key": "width", "value": 300 },
  { "type": "buildWeb" }
]
\`\`\`
```

---

### Round 67: UX 완성

**목표**: 사용자 경험 최적화 및 자동화

#### 1. CC 프로젝트 자동 감지

현재 열린 폴더를 기준으로 CC 프로젝트 감지:

```ts
// src/main/cc/project-detector.ts
export async function detectCocosProject(folderPath: string): Promise<{
  isCocos: boolean
  version?: string
  extPath?: string
} | null> {
  // package.json 또는 project.json에서 CC 버전 확인
  const hasProjectJson = await fileExists(join(folderPath, 'project.json'))
  if (!hasProjectJson) return null

  const projectJson = JSON.parse(await readFile(join(folderPath, 'project.json')))
  const version = projectJson.creator || '2.4.13'

  return {
    isCocos: true,
    version,
    extPath: join(folderPath, 'extensions/cocos-extension')
  }
}
```

#### 2. CC Extension 자동 설치 가이드

Extension 미설치 시 가이드 제공:

```tsx
// src/renderer/src/components/sidebar/ExtensionSetupGuide.tsx
export default function ExtensionSetupGuide({ project }) {
  const extSourcePath = 'C:/Users/a/Documents/claude-desktop/extensions/cc-extension-2x'
  const extTargetPath = `${project.path}/extensions/cocos-extension`

  return (
    <div className="setup-guide">
      <h3>⚠️ Extension 설치 필요</h3>
      <p>Cocos Creator 프로젝트에 Extension이 설치되지 않았습니다.</p>
      <ol>
        <li>탐색기에서 다음 폴더를 복사합니다:
          <code>{extSourcePath}</code>
        </li>
        <li>CC 프로젝트의 extensions 폴더에 붙여넣습니다:
          <code>{extTargetPath}</code>
        </li>
        <li>Cocos Creator를 재시작합니다</li>
        <li>여기서 다시 연결을 시도합니다</li>
      </ol>
      <button onClick={() => copyToClipboard(extSourcePath)}>
        경로 복사
      </button>
    </div>
  )
}
```

#### 3. 자동 재연결

연결 끊김 시 3초 간격으로 자동 재연결:

```ts
// src/main/cc/cc-bridge.ts의 scheduleReconnect()
private scheduleReconnect() {
  if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
  this.reconnectTimer = setTimeout(() => {
    console.log('[CC] Attempting to reconnect...')
    this.connect().catch(() => this.scheduleReconnect())
  }, 3000)
}
```

#### 4. 실시간 씬 갱신

CC Extension의 WebSocket 이벤트 수신 시 SceneTreePanel 자동 갱신:

```tsx
// src/renderer/src/components/sidebar/SceneTreePanel.tsx
useEffect(() => {
  const unsubscribe = on(CC_EVENT, async (event) => {
    if (event.type === 'scene:saved' || event.type === 'node:select') {
      const updatedTree = await invoke(CC_GET_TREE)
      setNodes(updatedTree)
    }
  })
  return unsubscribe
}, [])
```

#### 5. 멀티 프로젝트 지원

포트 설정으로 여러 CC 프로젝트 동시 연결 가능:

```tsx
// src/renderer/src/components/sidebar/CocosSettings.tsx
export default function CocosSettings() {
  const [port, setPort] = useState(9090)

  const handleConnect = async () => {
    await invoke(CC_CONNECT, port)
  }

  return (
    <div className="cocos-settings">
      <label>Extension 포트</label>
      <input
        type="number"
        value={port}
        onChange={(e) => setPort(parseInt(e.target.value))}
        min="9000"
        max="9999"
      />
      <button onClick={handleConnect}>연결</button>
    </div>
  )
}
```

---

## 파일 경로 참조

| 용도 | 경로 |
|------|------|
| CC Extension 기반 코드 | `C:\Users\a\Documents\Projects\Kapi\packages\cocos-mcp-server\` |
| claude-desktop IPC 패턴 | `C:\Users\a\Documents\claude-desktop\src\main\ipc\router.ts` |
| claude-desktop IPC 스키마 | `C:\Users\a\Documents\claude-desktop\src\shared\ipc-schema.ts` |
| CC 설치 경로 | `C:\ProgramData\cocos\editors\Creator\{버전}\` |

---

## 지원 버전

| 버전 | Extension | 상태 |
|------|-----------|------|
| CC 2.4.3 | cc-extension-2x | 미구현 |
| CC 2.4.5 | cc-extension-2x | 미구현 |
| CC 2.4.13 | cc-extension-2x | 미구현 |
| CC 3.6.1 | cc-extension-3x | 미구현 |

---

## 우선순위 및 로드맵

| Round | 중요도 | 설명 | 완료 조건 |
|-------|--------|------|---------|
| 64 | 필수 | WebSocket 기반 CC Extension 서버 구현 | Extension 배포 가능 |
| 65 | 필수 | claude-desktop CC 패널 및 IPC 통합 | 패널 UI 렌더링 + 기본 CRUD |
| 66 | 핵심 | Claude 자연어 씬 편집 연동 | 명령 파싱 + 자동 실행 |
| 67 | 완성도 | UX 최적화 (자동감지, 자동재연결 등) | 모든 오토메이션 동작 확인 |

---

## 롤백 전략

작업 도중 방향이 맞지 않을 때 쉽게 원복할 수 있도록 격리 원칙을 적용한다.

### Git 브랜치 전략

```bash
main                        ← 항상 안정 상태 유지
└── feature/cocos-integration  ← 모든 CC 통합 작업은 여기서
    ├── round-64-cc-extension
    ├── round-65-cc-panels
    └── round-66-claude-integration
```

- **Round 64~67 작업은 전부 `feature/cocos-integration` 브랜치에서 진행**
- main 브랜치는 건드리지 않음
- 완전히 검증된 후에만 main에 merge

```bash
# 브랜치 생성 (Round 64 시작 전)
git checkout -b feature/cocos-integration

# 원복 (언제든 가능)
git checkout main
```

---

### 라운드별 롤백 포인트

각 Round 시작 전 태그를 남겨 특정 시점으로 즉시 복귀 가능:

```bash
# 각 Round 시작 전 태그
git tag rollback/pre-round-64
git tag rollback/pre-round-65
git tag rollback/pre-round-66
git tag rollback/pre-round-67

# 특정 시점으로 원복
git checkout rollback/pre-round-64
```

---

### 코드 격리 원칙

CC 통합 코드를 기존 앱과 철저히 분리해서 제거가 쉽도록:

```
claude-desktop
├── src/main/cc/              ← CC 전용 폴더 (삭제하면 끝)
│   ├── cc-bridge.ts
│   └── project-detector.ts
├── src/main/ipc/cc-handlers.ts  ← 단일 파일 (제거 용이)
└── src/renderer/.../sidebar/
    ├── CocosPanel.tsx           ← 독립 컴포넌트
    ├── SceneTreePanel.tsx
    └── NodePropertyPanel.tsx
```

기존 파일 수정은 최소화:
- `ipc-schema.ts` — CC_* 채널 블록으로 묶어서 추가
- `Sidebar.tsx` — 탭 1개 추가만
- `router.ts` — `registerCCHandlers()` 1줄 추가

---

### 기능 플래그 (Feature Flag)

CC 통합을 코드 변경 없이 on/off:

```ts
// src/shared/feature-flags.ts
export const FEATURES = {
  COCOS_INTEGRATION: process.env.COCOS_INTEGRATION === 'true' || false,
}
```

```tsx
// Sidebar.tsx
{FEATURES.COCOS_INTEGRATION && (
  { id: 'cocos', label: '🎮', title: 'Cocos' }
)}
```

비활성화 시 패널 자체가 렌더링 안 됨. 환경변수 하나로 완전 비활성화 가능.

---

### 완전 제거 체크리스트

CC 통합을 완전히 롤백할 때:

```bash
# 방법 1: 브랜치 버리기 (가장 빠름)
git checkout main
git branch -D feature/cocos-integration

# 방법 2: 특정 커밋으로 되돌리기
git revert <cc-integration-commit-hash>

# 방법 3: 수동 제거 파일 목록
# - src/main/cc/ (폴더 전체)
# - src/main/ipc/cc-handlers.ts
# - src/renderer/.../CocosPanel.tsx
# - src/renderer/.../SceneTreePanel.tsx
# - src/renderer/.../NodePropertyPanel.tsx
# - src/renderer/.../WebPreviewPanel.tsx
# - src/shared/ipc-schema.ts → CC_* 블록 제거
# - src/renderer/.../Sidebar.tsx → cocos 탭 제거
# - src/main/ipc/router.ts → registerCCHandlers() 제거
```

---

## 성공 기준

- [ ] CC Extension WebSocket 서버 정상 작동 (CC 2.x / 3.x)
- [ ] claude-desktop CC 패널 렌더링 및 노드 트리 표시
- [ ] 노드 프로퍼티 편집 및 웹빌드 미리보기 동작
- [ ] Claude 채팅에서 자연어 명령으로 씬 편집 가능
- [ ] 자동 감지, 재연결, 실시간 갱신 모두 정상 동작

---

## 의존성 및 외부 도구

- **WebSocket 라이브러리**: `ws` (Node.js)
- **HTTP 클라이언트**: Node.js `http` / fetch API
- **Electron IPC**: 기존 claude-desktop 인프라 활용
- **CC 2.x/3.x Extension API**: 공식 문서 참조

