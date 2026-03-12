# PRD: SceneView Track D — App 통합 + 워크트리 병렬 개발 계획

> 작성일: 2026-03-12
> 대상 파일: `src/renderer/src/App.tsx`, `src/renderer/src/components/sidebar/Sidebar.tsx`, `src/renderer/src/components/sidebar/CocosPanel.tsx`
> 의존 트랙: Track A (Extension IPC), Track B (SceneView 데이터 레이어), Track C (SceneViewPanel UI)

---

## 개요

Track D는 A/B/C 트랙이 완성된 SceneView 기능을 App.tsx 메인 탭 시스템에 통합하는 작업이다.
`scene` 탭을 `preview` 탭과 동일한 패턴으로 CC 연결 시 자동 추가/해제하고,
SceneViewPanel을 콘텐츠 영역에 렌더링한다.

---

## D-1: App.tsx 변경 명세

### D-1-1: MainTab 타입 확장

**현재 코드 (line 32)**
```typescript
type MainTab = 'chat' | 'preview' | FileTab
```

**변경 후**
```typescript
type MainTab = 'chat' | 'scene' | 'preview' | FileTab
```

---

### D-1-2: EMPTY_SNAPSHOT 변경 불필요

`scene` 탭은 `preview`와 동일하게 wsCCConnected 상태에 따라 동적으로 추가/제거된다.
EMPTY_SNAPSHOT의 `openTabs: ['chat']` 은 그대로 유지.

---

### D-1-3: wsCCConnected useEffect 수정

**현재 코드 (line 401~415)**
```typescript
// CC 연결 상태에 따라 preview 탭 추가/제거
useEffect(() => {
  setOpenTabs(prev => {
    if (wsCCConnected && !prev.includes('preview')) {
      return ['chat', 'preview', ...prev.filter(t => t !== 'chat')]
    }
    if (!wsCCConnected && prev.includes('preview')) {
      if (activeTabRef.current === 'preview') {
        activeTabRef.current = 'chat'
        setActiveTab('chat')
      }
      return prev.filter(t => t !== 'preview')
    }
    return prev
  })
}, [wsCCConnected])
```

**변경 후**
```typescript
// CC 연결 상태에 따라 scene + preview 탭 추가/제거
useEffect(() => {
  setOpenTabs(prev => {
    if (wsCCConnected) {
      let next = prev
      if (!next.includes('scene')) {
        next = ['chat', 'scene', ...next.filter(t => t !== 'chat')]
      }
      if (!next.includes('preview')) {
        next = [next[0], next[1], 'preview', ...next.slice(2)]
      }
      return next
    }
    // 연결 해제 시
    if (activeTabRef.current === 'scene' || activeTabRef.current === 'preview') {
      activeTabRef.current = 'chat'
      setActiveTab('chat')
    }
    return prev.filter(t => t !== 'scene' && t !== 'preview')
  })
}, [wsCCConnected])
```

탭 순서: `['chat', 'scene', 'preview', ...files]`

---

### D-1-4: FileTabBar 라벨 매핑 수정

**현재 코드 (line 343)**
```typescript
const label = t === 'chat' ? 'Claude' : t === 'preview' ? '🌐 프리뷰' : (t.split(/[\\/]/).pop() ?? t)
```

**변경 후**
```typescript
const label = t === 'chat' ? 'Claude'
  : t === 'scene' ? '⬡ 씬뷰'
  : t === 'preview' ? '🌐 프리뷰'
  : (t.split(/[\\/]/).pop() ?? t)
```

**닫기 버튼 조건도 수정 (line 363)**

현재 코드:
```typescript
{t !== 'chat' && t !== 'preview' && (
```

변경 후:
```typescript
{t !== 'chat' && t !== 'scene' && t !== 'preview' && (
```

`scene` 탭은 `preview`와 동일하게 닫기 버튼 없음.

---

### D-1-5: import 추가 + 콘텐츠 영역에 scene 탭 렌더링

**import 추가 (line 23 이후)**

현재:
```typescript
import { WebPreviewPanel } from './components/sidebar/WebPreviewPanel'
```

변경 후:
```typescript
import { WebPreviewPanel } from './components/sidebar/WebPreviewPanel'
import { SceneViewPanel } from './components/sidebar/SceneView/SceneViewPanel'
```

**콘텐츠 영역 추가 (line 1553~1556, 웹 프리뷰 탭 블록 바로 위)**

현재:
```tsx
{/* 웹 프리뷰 탭 */}
<div style={{ position: 'absolute', inset: 0, display: activeTab === 'preview' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
  <WebPreviewPanel key={activeWsId} defaultUrl={wsWebPreviewUrl} onUrlChange={setWsWebPreviewUrl} />
</div>
```

변경 후:
```tsx
{/* 씬뷰 탭 */}
<div style={{ position: 'absolute', inset: 0, display: activeTab === 'scene' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
  <SceneViewPanel connected={wsCCConnected} wsKey={activeWsId} />
</div>
{/* 웹 프리뷰 탭 */}
<div style={{ position: 'absolute', inset: 0, display: activeTab === 'preview' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
  <WebPreviewPanel key={activeWsId} defaultUrl={wsWebPreviewUrl} onUrlChange={setWsWebPreviewUrl} />
</div>
```

---

### D-1-6: applySnapshot 수정

**현재 코드 (line 695)**
```typescript
setOpenTabs(snap.openTabs.filter(t => t !== 'preview'))
```

**변경 후**
```typescript
setOpenTabs(snap.openTabs.filter(t => t !== 'preview' && t !== 'scene'))
```

워크스페이스 전환 시 scene/preview 탭은 CC 재연결 후 동적으로 복원된다.

---

### D-1-7: Init 복원 시 필터 수정

**현재 코드 (line 668)**
```typescript
openTabs: ws.openTabs.length > 0 ? ws.openTabs.filter((t: string) => t !== 'preview') : ['chat'],
```

**변경 후**
```typescript
openTabs: ws.openTabs.length > 0 ? ws.openTabs.filter((t: string) => t !== 'preview' && t !== 'scene') : ['chat'],
```

---

### D-1-8: CommandPalette openTabs 필터 수정

**현재 코드 (line 1652)**
```typescript
openTabs={openTabs.filter(t => t !== 'chat' && t !== 'preview')}
```

**변경 후**
```typescript
openTabs={openTabs.filter(t => t !== 'chat' && t !== 'preview' && t !== 'scene')}
```

CommandPalette의 탭 목록에서 시스템 탭(chat/scene/preview) 제외.

---

## D-2: Sidebar.tsx 변경 명세

SceneViewPanel은 App.tsx에서 직접 렌더링하므로 **Sidebar.tsx 변경 불필요**.

단, 향후 CocosPanel과 씬뷰 선택 노드 동기화가 필요한 경우:
- `SidebarProps`에 `onSceneNodeSelect?: (node: CCNode) => void` 추가
- CocosPanel에 해당 콜백을 전달
- App.tsx에서 selectedSceneNode 상태 관리 후 CocosPanel에 prop으로 내려줌

현재 Phase에서는 선택 노드 동기화 미구현, 향후 D+1 태스크로 분리.

---

## D-3: CocosPanel.tsx 변경 명세 (향후 동기화용)

씬뷰 탭에서 선택한 노드를 CocosPanel 노드 프로퍼티 패널과 동기화하는 방안:

**방안 1: App.tsx 경유 콜백 패턴**
```
SceneViewPanel
  ─[onNodeSelect(node)]→ App.tsx (selectedSceneNode state)
  ─[externalSelectedNode prop]→ CocosPanel
  ─[setSelectedNode(externalSelectedNode)]→ NodePropertyPanel
```

**CocosPanel props 추가 (선택 동기화 필요 시)**
```typescript
export function CocosPanel({ defaultPort, onPortChange, onConnectedChange, externalSelectedNode, onNodeSelect }: {
  defaultPort?: number
  onPortChange?: (port: number) => void
  onConnectedChange?: (connected: boolean) => void
  externalSelectedNode?: CCNode | null   // SceneViewPanel에서 선택한 노드
  onNodeSelect?: (node: CCNode | null) => void  // 내부 선택을 외부에 알림
} = {})
```

내부 `setSelectedNode` 호출 시 `onNodeSelect?.(node)` 함께 호출.
`externalSelectedNode`가 변경되면 `setSelectedNode(externalSelectedNode)` 동기화.

현재 Phase에서는 미구현. 씬뷰 UI 기본 동작 확인 후 D+1에서 구현.

---

## D-4: 워크트리 병렬 개발 계획

### 파일 충돌 분석표

| 파일 | Track A | Track B | Track C | Track D |
|------|:-------:|:-------:|:-------:|:-------:|
| `extensions/cc-ws-extension-2x/main.js` | ✅ | - | - | - |
| `extensions/cc-ws-extension-3x/main.js` | ✅ | - | - | - |
| `src/shared/ipc-schema.ts` | ✅ | - | - | - |
| `src/main/cc/cc-bridge.ts` | ✅ | - | - | - |
| `src/main/ipc/cc-handlers.ts` | ✅ | - | - | - |
| `src/preload/index.ts` | ✅ | - | - | - |
| `src/renderer/.../SceneView/sceneTypes.ts` | - | ✅ | - | - |
| `src/renderer/.../SceneView/SceneViewPanel.tsx` | - | - | ✅ | - |
| `src/renderer/.../SceneView/SceneCanvas.tsx` | - | - | ✅ | - |
| `src/renderer/.../SceneView/useSceneData.ts` | - | ✅ | - | - |
| `src/renderer/.../App.tsx` | - | - | - | ✅ |
| `src/renderer/.../Sidebar.tsx` | - | - | - | ✅ |
| `src/renderer/.../CocosPanel.tsx` | - | - | - | ✅ |

**결론: 완전한 파일 무충돌** — 4개 트랙이 동시에 독립 작업 가능.

---

### 워크트리 생성 명령어

```bash
# 프로젝트 루트에서 실행 (claude-desktop 디렉토리)
git worktree add ../claude-desktop-track-a feat/scene-view-track-a
git worktree add ../claude-desktop-track-b feat/scene-view-track-b
git worktree add ../claude-desktop-track-c feat/scene-view-track-c
git worktree add ../claude-desktop-track-d feat/scene-view-track-d
```

각 트랙은 독립 브랜치에서 작업하며 물리적으로 분리된 폴더에서 동시 개발 가능.

---

### 각 트랙 의존성 순서

```
Track A (Extension IPC) ─┐
                          ├─→ Track C (SceneViewPanel UI) ─→ Track D (App 통합)
Track B (Data Layer)    ─┘
```

- Track C는 Track B의 `sceneTypes.ts` 타입만 import (구현 없어도 컴파일 가능)
- Track C는 Track A의 `window.api.ccGetCanvasSize` 등 IPC API 사용
- Track D는 Track C의 `SceneViewPanel` 컴포넌트 import

---

### 머지 순서

```
feat/scene-view-track-a  ──PR #1──→ main
feat/scene-view-track-b  ──PR #2──→ main
feat/scene-view-track-c  ──PR #3──→ main (A, B 머지 후)
feat/scene-view-track-d  ──PR #4──→ main (A, B, C 머지 후)
```

A와 B는 파일 충돌 없으므로 순서 무관 동시 머지 가능.
C는 A, B가 main에 머지된 후 PR 생성 (import 경로 확인).
D는 C까지 머지 완료 후 마지막 PR.

---

### 트랙별 담당자 주의사항

**Track A 담당자**
- `ipc-schema.ts`에 SceneView용 타입 추가: `CanvasSize`, `SceneNode`, `SceneSnapshot` 등
- `src/preload/index.ts`에 신규 IPC 핸들러 노출 (`ccGetCanvasSize`, `ccGetSceneSnapshot` 등)
- Track C가 `window.api.ccGetCanvasSize()`를 호출하므로 preload 노출까지 완성 필요
- Extension 측: CC 씬 캔버스 사이즈 및 노드 트리 snapshot 전송 구현

**Track B 담당자**
- `SceneView/` 폴더 생성 및 `sceneTypes.ts` 먼저 완성 후 나머지 파일 작성
- `sceneTypes.ts` 경로: `src/renderer/src/components/sidebar/SceneView/sceneTypes.ts`
- Track C에서 `import type { ... } from '../SceneView/sceneTypes'` 로 타입 참조
- `useSceneData.ts` hook: CC WebSocket 데이터를 React 상태로 변환하는 로직 담당

**Track C 담당자**
- Track B의 `sceneTypes.ts`를 상대경로로 import (구현 없어도 타입만으로 컴파일 가능)
- `SceneViewPanel` props 인터페이스: `connected: boolean`, `wsKey: string`
- `wsKey` prop은 워크스페이스 전환 시 컴포넌트 리마운트에 사용 (`key={activeWsId}` 패턴)
- canvas 렌더링은 Track A의 CanvasSize IPC 완성 전까지 mock 데이터로 개발 가능

**Track D 담당자 (이 문서)**
- Track C의 `SceneViewPanel` import 경로: `./components/sidebar/SceneView/SceneViewPanel`
- D-1-3 wsCCConnected useEffect: scene 탭이 chat 바로 뒤, preview 앞에 위치
- applySnapshot 및 초기화 복원 시 `scene` 필터 누락 없도록 주의 (D-1-6, D-1-7)
- A+B+C PR 머지 확인 후 `npm run typecheck` 통과 확인하고 PR 생성

---

## 검증 체크리스트

Track D PR 생성 전 확인:

- [ ] `npm run typecheck` — TypeScript 오류 없음
- [ ] CC 연결 시 FileTabBar에 `⬡ 씬뷰` 탭 표시 (닫기 버튼 없음)
- [ ] `scene` 탭 클릭 시 SceneViewPanel 렌더링
- [ ] CC 연결 해제 시 `scene` + `preview` 탭 동시 제거
- [ ] `activeTab === 'scene'` 상태에서 CC 연결 해제 → `chat`으로 복귀
- [ ] 워크스페이스 전환 시 `scene` 탭 저장/복원 안 됨 (CC 재연결 후 동적 복원)
- [ ] CommandPalette 탭 목록에서 `scene` 탭 미노출
- [ ] `Ctrl+Tab` 탭 순환 시 `chat → scene → preview → ...files` 순서
