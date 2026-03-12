# Handoff — Claude Desktop Electron App
> 마지막 업데이트: 2026-03-12

## 현재 상태
- 마지막 커밋: Round 74 (메시지 검색)
- 빌드: `npm run build` ✅ (2026-03-12 성공)
- 앱 위치: `C:\Users\a\Documents\claude-desktop`
- GitHub: `https://github.com/YDINP/claude-desktop` (main 브랜치)

## 이번 세션 작업 (미커밋) — SceneView 기능 추가

### SceneView 4트랙 병렬 구현 완료 (tsc + build 모두 통과)

#### Track A — CC Extension `/scene/canvas-size` 엔드포인트
- `extensions/cc-ws-extension-2x/main.js` — `GET /scene/canvas-size` 추가 (callSceneScript 경유)
- `extensions/cc-ws-extension-2x/scene-script.js` — `getCanvasSize` 메서드 (cc.Canvas → designResolution)
- `extensions/cc-ws-extension-3x/main.js` — `GET /scene/canvas-size` 추가 (query-node-tree에서 Canvas 노드 탐색)
- `src/shared/ipc-schema.ts` — `CanvasSize` 인터페이스 + `CC_GET_CANVAS_SIZE` 상수
- `src/main/cc/cc-bridge.ts` — `getCanvasSize()` async 메서드
- `src/main/ipc/cc-handlers.ts` — `ccGetCanvasSize` IPC 핸들러
- `src/preload/index.ts` — `ccGetCanvasSize` contextBridge 노출

#### Track B — Data Layer (`src/renderer/src/scene/`)
- `sceneTypes.ts` — SceneNode, Vec2, Size, ViewTransform, DragState, CanvasInfo, SceneState
- `coordinateUtils.ts` — worldToScreen, screenToWorld, nodeScreenRect, defaultViewTransform
- `sceneViewStore.ts` — Zustand 스토어 (setNodes, selectNode, drag, viewTransform, reset)
- `useSceneSync.ts` — CC API 폴링 + onCCEvent WS 구독 훅
- `package.json` — `zustand ^5.0.0` 추가 (bun install 완료)

#### Track C — SVG UI (`src/renderer/src/components/sidebar/SceneView/`)
- `types.ts`, `utils.ts`, `useSceneSync.ts` (SceneView 내부 독립 버전)
- `SceneToolbar.tsx` — 도구/줌/그리드/스냅/Fit/새로고침
- `SceneInspector.tsx` — x,y,w,h,rot,anchor,active 수치 편집
- `NodeRenderer.tsx` — SVG rect + 선택 핸들 8개 + 앵커 원 (memo)
- `SceneViewPanel.tsx` — 메인 SVG 뷰포트 (pan/zoom/드래그, default export)
- `index.ts` — export barrel

#### Track D — App.tsx 통합
- `MainTab`에 `'scene'` 추가
- `wsCCConnected` useEffect: CC 연결 시 `'⬡ 씬뷰'` 탭 자동 추가/제거
- FileTabBar 닫기 버튼 조건에 `scene` 추가
- `applySnapshot` + init 복원 시 scene 필터
- `SceneViewPanel` import + 콘텐츠 영역 렌더링

## 이전 세션 작업 (미커밋)

### (이전) CC3x NodePropertyPanel 수정
- `enrichNode` 전면 재작성 — `query-node` dump 포맷 정확히 파싱
  - `isNodeDump` 판별: `n.name`이 object면 query-node 응답
  - rotation: `dv(n.rotation).z` (CC3x에서 2D 각도 = Vec3.z)
  - size/anchor: `__comps__`의 `cc.UITransform`에서 추출
  - opacity: `__comps__`의 `cc.UIOpacity`에서 추출 (없으면 255)
  - components: `n.__comps__` 배열의 `.type` 직접 사용
  - children: query-node는 UUID ref만 있으므로 tree에서만 재귀
  - scaleX/scaleY set-property 핸들러 추가

### (이전) NodePropertyPanel.tsx 리팩토링
- CC 에디터 방식 그룹 구조: **Node** / **cc.UITransform** / **cc.UIOpacity** (조건부)
- Scale X/Y 항목 추가
- 소숫점 후행 0 제거: `parseFloat(v.toFixed(2))` → "1", "0.5"
- Opacity: `cc.UIOpacity` 컴포넌트 있을 때만 해당 그룹으로 표시
- `PropRow`에 `decimals` prop 추가 (기본 0 = 정수, 2 = float)

### (이전) CocosPanel.tsx
- `node:deselect` 이벤트로 selectedNode 지우지 않음 (마지막 선택 노드 유지)
  - CC 에디터에서 노드 클릭 시 unselect→select 이벤트 순서 때문에 포커스 풀리는 현상 해결

### (이전) App.tsx — 사이드바 리사이즈 핸들 개선
- 핫존 4px → 8px
- 항상 보이는 1px 경계선 (hover 시 파란색)
- hover/드래그 시 중앙 그립 막대 표시
- 드래그 중 현재 width px값 툴팁 표시

## 주요 파일
| 파일 | 역할 |
|------|------|
| `extensions/cc-ws-extension-3x/main.js` | CC3x HTTP/WS 브릿지, enrichNode, set-property, canvas-size |
| `extensions/cc-ws-extension-2x/main.js` | CC2x HTTP/WS 브릿지, canvas-size |
| `src/renderer/src/components/sidebar/CocosPanel.tsx` | CC 연결 UI, 노드 선택 이벤트 |
| `src/renderer/src/components/sidebar/NodePropertyPanel.tsx` | 노드 속성 표시/편집 |
| `src/renderer/src/components/sidebar/SceneTreePanel.tsx` | CC 씬 트리 표시 |
| `src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx` | SVG 씬뷰 메인 (신규) |
| `src/renderer/src/scene/sceneViewStore.ts` | Zustand 씬 상태 스토어 (신규) |
| `src/renderer/src/scene/useSceneSync.ts` | CC API 폴링 + WS 훅 (신규) |
| `src/main/ipc/cc-handlers.ts` | CC IPC 핸들러 (connect, getTree, getNode, setProperty, getCanvasSize) |
| `src/main/cc/cc-bridge.ts` | CC WebSocket 연결 관리 |
| `src/shared/ipc-schema.ts` | CCNode, CanvasSize 타입 정의 |

## CC Extension 구조
- **포트**: 3x = 9091, 2x = 9090
- **엔드포인트**: `GET /scene/tree`, `GET /node/:uuid`, `POST /node/:uuid/property`, `POST /node/:uuid/move`, `GET /scene/canvas-size` ← 신규
- **디버그**: `GET /debug/tree`, `GET /debug/node/:uuid` (raw dump 확인용)
- **CC3x query-node dump 포맷 핵심**:
  - 모든 필드가 `{value, type, readonly, animatable, ...}` 래퍼
  - size/anchor는 `__comps__[cc.UITransform].value.contentSize/anchorPoint`
  - rotation 2D 각도 = `n.rotation.value.z`
  - children = UUID ref 배열 (트리 구조는 query-node-tree에서만)

## 알려진 이슈 / 미수정
- `runInSandbox` — `new Function(code)` 직접 실행 (`MessageBubble.tsx:57`)
- `sandbox: false` Electron 설정
- `bypassCSP: true` local:// 프로토콜 광범위 CSP 우회
- `session:importBackup` 백업 파일 구조 검증 없음
- CC3x `set-property` for opacity: `cc.UIOpacity` 컴포넌트 uuid 기반 접근 필요할 수 있음 (현재 node path로 처리)

## 아키텍처 요약
```
Electron (Main)
├── ipc/fs-handlers.ts       — 파일시스템, Git
├── ipc/session-handlers.ts  — 세션 저장
├── ipc/claude-handlers.ts   — Claude API
├── ipc/cc-handlers.ts       — CC WebSocket 브릿지 IPC
├── cc/cc-bridge.ts          — CC WebSocket 연결 관리
└── claude/agent-bridge.ts   — SDK 파싱

Renderer (React 18)
├── components/chat/          — ChatPanel, MessageBubble, InputBar
├── components/sidebar/       — Sidebar, CocosPanel, SceneTreePanel,
│                               NodePropertyPanel, WebPreviewPanel
│   └── SceneView/            — SceneViewPanel, Toolbar, Inspector, NodeRenderer (신규)
├── components/shared/        — StatusBar, CommandPalette, SettingsPanel
├── scene/                    — sceneTypes, coordinateUtils, sceneViewStore, useSceneSync (신규)
└── utils/cc-action-parser.ts — Claude 응답 CC 액션 파싱

CC Extensions
├── cc-ws-extension-2x/      — CC 2.x HTTP+WS port 9090
└── cc-ws-extension-3x/      — CC 3.x HTTP+WS port 9091
```

## 참고
- Plane 연동: **제외** (2026-03-12 사용자 지시)
- 빌드: `npm run build`
- QA: `npm run qa`
- CC Extension reload: CC Editor → Extension Manager → cc-ws-extension → Reload
