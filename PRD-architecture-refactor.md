# PRD — Architecture Refactor: Kernel + Domain Module + Batch Plugin

> 작성일: 2026-03-17
> 목표: 현재 IPC 직접 호출 구조 → Typed Kernel + Domain Module + Plugin Architecture

---

## 배경 및 동기

### 현재 구조의 문제점

| 파일 | 줄 수 | 문제 |
|------|-------|------|
| `App.tsx` | 1,978줄 | Controller + Layout + EventBus 혼재 |
| `BatchInspector.tsx` | 14,775줄 | 모든 기능이 단일 파일에 누적 |
| `preload/index.ts` | 621줄 | 70+ IPC 메서드 단일 interface |
| `chat-store.ts` | 370줄 | 이름만 store, 실제로는 useState 훅 |

### 핵심 문제
- **UI가 IPC를 직접 안다**: `window.api.ccFileSaveScene(root)` 형태의 직접 호출
- **새 기능 추가 = 4개 파일 동시 수정** (main handler + preload + type + component)
- **테스트 불가**: IPC에 직접 의존하는 컴포넌트
- **BatchInspector 한계**: 기능 추가 시 14,775줄 파일에 계속 누적

---

## 목표 아키텍처

```
┌─────────────────────────────────────────────────────┐
│  UI Layer (순수 렌더링 + 명령 디스패치)               │
│  App.tsx(~50줄)  ChatPanel  BatchInspector(~50줄)    │
└────────────────────────┬────────────────────────────┘
                         │ dispatch(Command) / useStore()
┌────────────────────────▼────────────────────────────┐
│  Domain Layer                                       │
│  chat/  cocos/  session/  filesystem/  terminal/    │
│    각각: domain.ts + store.ts + adapter.ts + commands.ts │
│    cocos/plugins/  (각 30~100줄 플러그인)            │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  Kernel (Typed Message Bus)                         │
│  Command → Handler → IPC → Event → Store Update    │
└────────────────────────┬────────────────────────────┘
                         │ IPC (현재 구조 점진적 정리)
┌────────────────────────▼────────────────────────────┐
│  Main Process                                       │
│  ipc/router.ts → handlers → services               │
└─────────────────────────────────────────────────────┘
```

---

## Phase A — Kernel 구축

### 목표
IPC 경계를 타입 안전 메시지 버스로 추상화. 기존 코드 무수정.

### 생성 파일
```
src/renderer/src/kernel/
  types.ts          # AppCommands, AppEvents 타입 선언
  eventBus.ts       # EventEmitter (타입 안전)
  commandBus.ts     # Command 라우터
  ipcBridge.ts      # window.api ↔ Kernel 연결
  index.ts          # useKernel() 훅 export
```

### 핵심 타입
```typescript
type AppCommands =
  | { type: 'cocos:saveScene';    payload: CCSceneNode }
  | { type: 'cocos:selectNode';   payload: { uuid: string } }
  | { type: 'chat:send';          payload: { content: string; sessionId: string } }
  | { type: 'session:load';       payload: { sessionId: string } }
  // ...

type AppEvents =
  | { type: 'cocos:sceneSaved';        payload: { path: string } }
  | { type: 'cocos:externalChange';    payload: { path: string } }
  | { type: 'chat:messageChunk';       payload: ChatChunk }
  | { type: 'chat:streamingDone';      payload: { sessionId: string } }
  // ...
```

### useKernel 훅
```typescript
function CocosPanel() {
  const dispatch = useKernel()
  return <CCFileProjectUI
    onSave={root => dispatch({ type: 'cocos:saveScene', payload: root })}
  />
}
```

### 완료 기준
- `npx tsc --noEmit` 에러 없음
- 기존 코드 동작 유지 (Kernel은 추가만, 기존 window.api 호출 병존)

---

## Phase B — Chat 도메인 이전

### 목표
App.tsx에서 chat 관련 상태/로직 분리. App.tsx 1,978줄 → ~400줄.

### 생성 파일
```
src/renderer/src/domains/chat/
  domain.ts         # ChatMessage, ChatSession 순수 타입
  store.ts          # zustand (실제 전역 store)
  adapter.ts        # Kernel 이벤트 → store 업데이트
  commands.ts       # chat Command 핸들러 등록
  index.ts
```

### App.tsx 변화
```typescript
// Before: App.tsx에 수백 줄의 chat 상태
const [messages, setMessages] = useState(...)
const [isStreaming, setIsStreaming] = useState(...)
// ... 40개 이상의 chat 관련 state

// After: App.tsx는 레이아웃만
function App() {
  return <WorkspaceLayout />  // chat 상태는 chatStore에서 직접 구독
}
```

### 완료 기준
- `App.tsx` 줄 수 50% 이상 감소
- ChatPanel이 App.tsx props 없이 직접 chatStore 구독
- tsc 에러 없음

---

## Phase C — Cocos 도메인 + Batch Plugin System

### 목표
BatchInspector.tsx 14,775줄 → ~50줄. 각 기능을 독립 플러그인 파일로 분리.

### Batch Plugin Interface
```typescript
interface BatchPlugin {
  id: string                          // 'R1749-label-fontSize'
  group: 'transform' | 'color' | 'component' | 'name' | 'misc'
  title: string
  applies: (nodes: CCSceneNode[], ctx: BatchContext) => boolean
  render: (props: BatchPluginProps) => React.ReactNode
}
```

### 플러그인 파일 구조
```
src/renderer/src/domains/cocos/plugins/
  registry.ts               # 모든 플러그인 등록
  types.ts                  # BatchPlugin interface
  transform/
    positionReset.ts        # ~40줄
    sizeReset.ts
    nudge.ts
    gridSnap.ts
    posGradient.ts
    ...
  color/
    colorReset.ts
    colorGrad.ts
    randomColor.ts
    opacityFixed.ts
    ...
  component/
    labelFontSize.ts
    labelColor.ts
    spriteType.ts
    audioVolume.ts
    ...
  name/
    nameCase.ts
    nameFindReplace.ts
    namePrefix.ts
    ...
```

### BatchInspector.tsx 결과
```typescript
// BatchInspector.tsx — ~50줄
function CCFileBatchInspector({ uuids, ... }) {
  const plugins = useApplicablePlugins(uuids)
  const dispatch = useKernel()

  return (
    <div>
      {Object.entries(groupBy(plugins, p => p.group)).map(([group, items]) => (
        <BatchGroup key={group} title={group}>
          {items.map(p => <p.render key={p.id} nodes={...} dispatch={dispatch} />)}
        </BatchGroup>
      ))}
    </div>
  )
}
```

### Cocos 도메인 생성
```
src/renderer/src/domains/cocos/
  domain.ts         # CCSceneNode, CCSceneFile 재export (shared에서)
  store.ts          # zustand: sceneFile, selectedNode, lockedUuids...
  adapter.ts        # ccFile* IPC → Kernel 이벤트
  commands.ts       # saveScene, selectNode, batchOp Command 핸들러
  plugins/          # 위 구조
  index.ts
```

### 완료 기준
- `BatchInspector.tsx` 100줄 미만
- 각 플러그인 파일 100줄 미만
- 기존 QA 2615 Pass 유지
- tsc 에러 없음

---

## Phase D — 나머지 도메인 + App.tsx 최종 정리

### 목표
모든 도메인 이전 완료. App.tsx 순수 레이아웃 컴포넌트화.

### 생성 도메인
```
domains/session/    # 세션 저장/불러오기
domains/filesystem/ # 파일시스템 조작
domains/terminal/   # PTY 터미널
domains/settings/   # 설정/API 키
```

### preload 정리
```typescript
// Before: window.api.모든메서드() 70+개 flat interface
// After: 도메인별 namespaced
window.api.cocos.saveScene()
window.api.chat.send()
window.api.session.list()
```

### 완료 기준
- `App.tsx` 200줄 이하 (레이아웃만)
- `preload/index.ts` 도메인별 분리
- 전체 QA Pass 유지

---

## 예상 효과

| 지표 | Before | After |
|------|--------|-------|
| App.tsx | 1,978줄 | ~200줄 |
| BatchInspector.tsx | 14,775줄 | ~50줄 |
| 새 배치 기능 추가 | 기존 파일 수정 | 플러그인 파일 1개 생성 |
| 새 AI 프로바이더 | 4개 파일 수정 | domains/ 폴더 1개 생성 |
| IPC 채널 변경 | 3개 파일 수정 | adapter.ts 1개만 수정 |
| 컴포넌트 테스트 | 불가 | adapter mock으로 가능 |

---

## 마이그레이션 원칙

1. **점진적**: 기존 코드를 한 번에 교체하지 않는다
2. **병존 기간**: 신규 구조와 기존 window.api 직접 호출이 한동안 공존
3. **QA 유지**: 각 Phase 완료 후 `npm run qa` 0 Warning 필수
4. **역방향 없음**: 새 기능은 반드시 신규 구조로 추가

---

## 보류/제외

- **Main process 전면 재구성**: 현재 구조(ipc/router.ts + handlers)가 충분히 정돈됨. 현 단계에서 리스크 대비 가치 낮음
- **RxJS 도입**: streaming 처리에 이상적이나 러닝커브 대비 zustand subscriptions로 충분
- **Actor Model**: 개념적으로 적합하나 라이브러리 의존성 추가 비용
