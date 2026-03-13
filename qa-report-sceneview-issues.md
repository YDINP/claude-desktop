# Claude Desktop — SceneView 기능 이슈 분석 보고서

> 작성일: 2026-03-13
> 분석 범위: SceneView 4트랙 신규 구현 전체 (tsc ✅, build ✅, qa ✅ 통과 이후 심층 분석)
> 분석 방법: 3개 병렬 oracle agent (SceneView UI / CC Extension IPC / App 통합)

---

## 전체 요약

| 심각도 | 건수 | 영역 |
|--------|------|------|
| 🔴 Critical | 8 | 즉시 수정 필요 (런타임 크래시 또는 상태 오염) |
| 🟡 Major | 14 | 기능 결함 (특정 조건에서 오동작) |
| 🟢 Minor | 14 | 코드 품질 / 엣지케이스 |

---

## 🔴 Critical

### [C-1] applySnapshot — activeTab=scene 인데 openTabs에서 scene 제거
**파일**: `App.tsx:707-709`

```typescript
setOpenTabs(snap.openTabs.filter(t => t !== 'preview' && t !== 'scene'))  // scene 제거
setActiveTab(snap.activeTab)  // 하지만 activeTab은 'scene' 그대로 복원
```

scene 탭이 활성 상태일 때 워크스페이스를 저장하고 다른 워크스페이스로 전환 후 돌아오면:
- `openTabs`에 'scene' 없음 → 탭 표시 없음
- `activeTab = 'scene'` → 씬뷰 패널은 렌더링되지만 disconnected 상태
- 사용자는 아무 탭도 선택되지 않은 것처럼 보이며, 'chat'을 수동 클릭해야 복구 가능

**수정**: `applySnapshot`에서 `snap.activeTab`이 scene/preview이면 'chat'으로 폴백

---

### [C-2] saveCurrentSnapshot — scene/preview 탭을 스냅샷에 그대로 저장
**파일**: `App.tsx:699-703`

CC 연결 상태에서 스냅샷 저장 시 scene/preview가 `openTabs`와 `activeTab`에 포함된 채 저장된다. C-1의 근본 원인.

**수정**: `saveCurrentSnapshot`에서 scene/preview 필터링 추가

---

### [C-3] SceneNode 타입 이중 정의 — 구조 비호환
**파일**: `SceneView/types.ts` vs `scene/sceneTypes.ts`

| 항목 | SceneView/types.ts | scene/sceneTypes.ts |
|------|---|---|
| size | `width, height` (flat) | `size: { w, h }` (nested) |
| color | `{ r, g, b, a }` | `string` |
| components | `{ type: string }[]` | `string[]` |

`SceneViewPanel.tsx`의 `groupBbox` useMemo에서 `n.size?.width`를 참조하는데 `SceneView/types.ts`의 SceneNode에는 `size` 필드가 없어 항상 `undefined` → fallback `50`만 사용됨.

**수정**: SSOT 통일 — `SceneView/types.ts` 기준으로 `scene/sceneTypes.ts`를 re-export하거나 반대 방향으로 통일

---

### [C-4] groupBbox에서 n.size?.width 항상 undefined
**파일**: `SceneViewPanel.tsx:1495-1496`

```typescript
const hw = (n.size?.width ?? 50) / 2   // n.size 없음 → 항상 50
const hh = (n.size?.height ?? 50) / 2  // 동일
```

C-3의 직접적 증상. 노드 크기가 항상 100x100으로 계산되어 그룹 선택 bounding box가 부정확함.

**수정**: `n.width, n.height` 또는 올바른 타입 기준 필드로 교체

---

### [C-5] 3x Extension — Canvas 노드 이름이 'Canvas'가 아닐 때 null dereference
**파일**: `cc-ws-extension-3x/main.js:420-432`

```js
function findCanvasInTree(node) {
  if (comps.includes('cc.Canvas') || node.name === 'Canvas') return node;
  // 못 찾으면 null 반환
}
const canvasNode = findCanvasInTree(tree);
const nodeRaw = await Editor.Message.request('scene', 'query-node', canvasNode.uuid); // ← null.uuid
```

캔버스 노드 이름이 한국어(`캔버스`)나 커스텀 이름(`GameCanvas`)이면 `null.uuid` → TypeError → 500 에러

**수정**: `if (!canvasNode)` 체크 추가 + 기본값 반환

---

### [C-6] 3x Extension — designResolution 대신 UITransform size 반환 (2x/3x 의미 불일치)
**파일**: `cc-ws-extension-3x/main.js:438`

2x는 `canvas.designResolution`(게임 해상도 설정값) 반환, 3x는 Canvas 노드의 UITransform contentSize 반환. 이 두 값은 다를 수 있어 씬뷰의 DESIGN_W/H가 버전마다 다른 값이 됨.

**수정**: 3x에서도 `cc.Canvas` 컴포넌트의 `designResolution` 속성 직접 조회 시도

---

### [C-7] async handleMouseUp — dragRef.current race condition
**파일**: `SceneViewPanel.tsx:939`

```typescript
const handleMouseUp = async (e: React.MouseEvent) => {
  // ...
  await window.api.ccSetProperty?.(...)  // 여러 await
  // ...
  dragRef.current = null  // ← await 완료 전에 새 드래그가 시작되면 덮어씀
}
```

await 중 사용자가 다른 노드를 클릭하면 `dragRef.current`가 새 드래그 상태로 설정된 후 null 리셋이 이를 날려버림.

**수정**: handleMouseUp 시작 시 `dragRef.current`를 로컬 변수에 캡처 후 null 처리

---

### [C-8] useSceneSync 이중 구현 — 두 상태 시스템 병존
**파일**: `SceneView/useSceneSync.ts` vs `scene/useSceneSync.ts`

- `SceneView/useSceneSync.ts`: `window.api.ccGetTree()` 기반, 로컬 상태 관리
- `scene/useSceneSync.ts`: HTTP fetch 폴링, Zustand store 업데이트

`SceneViewPanel`은 SceneView 버전만 사용하고 Zustand store는 구독하지 않아 두 시스템이 완전히 분리된 채 병존. `scene/` 디렉토리 전체가 현재 SceneViewPanel에 연결되어 있지 않음.

---

## 🟡 Major

### [M-1] SceneViewPanel — wsKey prop이 있지만 key로 전달되지 않음
**파일**: `SceneViewPanel.tsx:26`, `App.tsx:1579`

`SceneViewPanel`이 `wsKey: string` prop을 선언하지만 사용하지 않고, `App.tsx`에서 `key={activeWsId}`를 전달하지 않아 워크스페이스 전환 시 씬 데이터가 초기화되지 않음.

**수정**: `App.tsx:1579`에 `key={activeWsId}` 추가

---

### [M-2] keydown useEffect — selectedUuids/isDragging stale closure
**파일**: `SceneViewPanel.tsx:275-424`

`isDragging`, `isResizing`, `selectedUuids`가 의존성 배열에 없어 Escape, H 키, 잠금 토글 등에서 stale값 사용

---

### [M-3] svgToScene — canvasSize 의존성 누락
**파일**: `SceneViewPanel.tsx:624`

```typescript
}, [view])  // canvasSize 누락
```

`DESIGN_W/H`가 `canvasSize`에서 파생되지만 `view`만 의존성 → canvasSize 변경 시 좌표 계산 오류

---

### [M-4] handleDuplicate — uuid 중복 생성 버그
**파일**: `SceneViewPanel.tsx:259-272`

```typescript
updateNode(orig.uuid + '-dup-' + Date.now(), { // timestamp A
  uuid: orig.uuid + '-dup-' + Date.now(),       // timestamp B (다를 수 있음)
```

key와 uuid가 다른 값이 될 수 있음

---

### [M-5] scene/useSceneSync — nodeMap 직접 뮤테이션
**파일**: `scene/useSceneSync.ts:43`

`computeWorldTransforms`가 `flattenTree`로 생성한 nodeMap을 직접 뮤테이션. React/Zustand 불변성 원칙 위반.

---

### [M-6] IPC close-tab — scene/preview 탭 삭제 가능 (플리커 발생)
**파일**: `App.tsx:795-798`

`closeActiveFileTab`이 scene/preview를 가드하지 않아 Ctrl+W 또는 메뉴로 탭 삭제 → 즉시 wsCCConnected effect가 재추가 → 플리커

**수정**: `if (cur !== 'chat' && cur !== 'scene' && cur !== 'preview')`

---

### [M-7] scene 탭 삽입 — preview 위치 계산이 positional index에 의존
**파일**: `App.tsx:414-416`

```typescript
next = [next[0], next[1], 'preview', ...next.slice(2)]
```

scene이 이미 있으면 첫 번째 if 블록 skip → next[1]이 file tab일 수 있어 preview가 잘못된 위치에 삽입됨

---

### [M-8] 3x Extension unload — broadcast listener 미제거
**파일**: `cc-ws-extension-3x/main.js:492-497`

`load()`에서 4개 `addBroadcastListener` 등록했으나 `unload()`에서 `removeBroadcastListener` 없음 → Extension reload 시 리스너 누적

---

### [M-9] Extension httpServer — EADDRINUSE silent failure
**파일**: `cc-ws-extension-2x/main.js:213`, `cc-ws-extension-3x/main.js:478`

`httpServer.listen` 실패 핸들러 없음 → 포트 충돌 시 서버 미시작이지만 에러 없음

---

### [M-10] nudge useEffect — selectedUuids 의존성 누락
**파일**: `SceneViewPanel.tsx:463`

Alt+L, H키 핸들러에서 `selectedUuids` 참조하지만 의존성 배열에 없어 stale값 사용

---

### [M-11] cc-bridge.ts — getCanvasSize fetch에 timeout 없음
**파일**: `cc-bridge.ts:81-85`

`checkStatus()`는 2초 timeout이 있으나 `getCanvasSize`, `getTree`, `getNode`에는 없음

---

### [M-12] 2x scene-script.js — getCanvasSize에 designResolution null 방어 없음
**파일**: `cc-ws-extension-2x/scene-script.js:81`

`canvas.designResolution`이 null/undefined이면 `dr.width` TypeError → event.reply 미호출 → 무한 대기

---

### [M-13] setActiveTab — setOpenTabs updater 내부에서 다른 setState 호출
**파일**: `App.tsx:420-422`

updater 함수는 순수함수여야 하나 내부에서 `setActiveTab()` 호출. React 18 자동 배칭으로 현재는 동작하지만 anti-pattern.

---

### [M-14] ccGetAssets 핸들러 — port 기본값 없어 undefined 포트 fetch 가능
**파일**: `cc-handlers.ts:52`

다른 핸들러는 `port = 9090` 기본값이 있지만 `CC_GET_ASSETS` 핸들러만 없음 → `getCCBridge(undefined)` → `http://127.0.0.1:undefined/...`

---

## 🟢 Minor

| # | 파일 | 이슈 |
|---|------|------|
| m-1 | `NodeRenderer.tsx:25` | DESIGN_W/H 하드코딩 960×640, props로 미주입 |
| m-2 | `coordinateUtils.ts:61` | `defaultViewTransform`이 canvasW/H 파라미터를 무시 |
| m-3 | `sceneViewStore.ts` | `resetView`에서 canvasW/H=0이면 zoom=Infinity |
| m-4 | `SceneViewPanel.tsx:162` | `handleFit` useEffect 의존성 누락 |
| m-5 | `SceneInspector.tsx:210` | `navigator.clipboard.writeText` catch 미처리 |
| m-6 | `SceneViewPanel.tsx:1177` | PNG 내보내기 img.onerror 없어 ObjectURL 누수 |
| m-7 | `SceneViewPanel.tsx:1201` | loadFromSlot JSON.parse 타입 검증 없음 |
| m-8 | `ipc-schema.ts:91` | CCNode.scale 타입 Vec2이지만 3x는 Vec3 반환 |
| m-9 | `2x/main.js`, `3x/main.js` | status features 배열에 canvas-size 미등록 |
| m-10 | `SceneViewPanel.tsx:1082` | handleWheel → getSvgCoords WheelEvent/MouseEvent 타입 미스매치 |
| m-11 | `SceneInspector.tsx:178` | focusNameTrigger useEffect node 의존성 누락 |
| m-12 | `SceneViewPanel.tsx:26` | SceneViewPanel 기본 port 9091이지만 App.tsx는 9090 초기화 |
| m-13 | `App.tsx:838-839` | 워크스페이스 JSON에 scene/preview 포함 저장 |
| m-14 | 정렬 가이드 | 음수 스케일 시 Math.abs 처리 없어 가이드라인 위치 오류 가능 |

---

## 수정 우선순위

### 즉시 (Critical — 사용자 경험 직접 영향)
1. **[C-1] + [C-2]** `applySnapshot`/`saveCurrentSnapshot` scene/preview 필터링
2. **[C-3] + [C-4]** SceneNode 타입 SSOT 통일 + groupBbox 필드 수정
3. **[C-5]** 3x Canvas 노드 null 방어
4. **[M-1]** SceneViewPanel에 `key={activeWsId}` 추가

### 높음 (Major — 특정 조건에서 오작동)
5. **[M-6]** closeActiveFileTab scene/preview 가드
6. **[C-7]** async handleMouseUp dragRef race condition
7. **[M-8]** 3x unload broadcast listener 정리
8. **[M-9]** Extension httpServer error 핸들러

### 보통 (나머지 Major)
9. stale closure 의존성 배열 정리 (M-2, M-3, M-10)
10. **[C-8]** useSceneSync 이중 구현 통합 (SceneView/useSceneSync → scene/useSceneSync Zustand 연결)

---

*보고서 생성: ralph-loop iteration 1 (oracle × 3 병렬)*
