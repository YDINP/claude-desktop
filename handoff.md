# Handoff — Claude Desktop Electron App
> 마지막 업데이트: 2026-03-12 (Round 120 완료)

## 현재 상태
- 마지막 커밋: Round 120 (QA + CHANGELOG 갱신, Pass 57)
- 빌드: `npm run build` ✅
- QA: `npm run qa` ✅ Critical 0, Warning 0, Pass 57
- 브랜치: `dev`
- 앱 위치: `C:\Users\a\Documents\claude-desktop`
- GitHub: `https://github.com/YDINP/claude-desktop` (main 브랜치)

## Round 119 완료 항목 (최근 세션)

### Round 119 — InputBar 멀티라인 auto-resize + 문자/줄 수 표시
- `InputBar.tsx`: `useEffect(() => adjustHeight(), [text])` 추가 — text 변경(Shift+Enter 줄바꿈 포함) 시 자동 높이 조정
- placeholder에 "Shift+Enter for newline" 힌트 추가
- Send 버튼 왼쪽에 text.length > 100 시 `NL Nc` (줄 수 + 문자 수) 표시
- `scripts/qa.ts`: Section 23 추가 (Shift+Enter 힌트, 문자/줄 수 체크, Pass 55→57)

## Round 118 완료 항목 (이전 세션)

### Round 118 — SceneView 그룹 bbox 점선 박스
- `SceneViewPanel.tsx`: `groupBbox` useMemo — selectedUuids.size >= 2일 때 각 노드의 SVG bbox(sx±w/2, sy±h/2)를 합산해 패딩 8px 포함 전체 bbox 계산
- SVG `<g transform={sceneTransform}>` 안에서 황색(#fbbf24) 점선 rect 렌더링 (strokeWidth/strokeDasharray를 view.zoom으로 보정해 zoom 불변)
- `scripts/qa.ts`: Section 22 추가 (groupBbox + fbbf24 색상 체크, Pass 54→55)

## Round 117 완료 항목 (이전 세션)

### Round 117 — SceneView 멀티셀렉트 그룹 드래그
- `SceneView/types.ts`: `DragState`에 `groupOffsets?: Record<string, {startX, startY}>` 추가
- `SceneViewPanel.tsx`: `handleNodeMouseDown` — isGroupDrag 감지 시 groupOffsets 저장; `handleMouseMove` — 그룹 전체 동일 델타 이동; `handleMouseUp` — 그룹 노드 IPC 전송 + undoStack 배치 추가
- `scripts/qa.ts`: Section 21 추가 (Pass 52→54)

## Round 115 완료 항목 (이전 세션)

### Round 115 — 세션 커스텀 텍스트 태그 (자동완성 + 필터)
- `SessionList.tsx`: `allCustomTags` useMemo (전체 세션 커스텀 태그 빈도 수집), `customTagInput`/`showTagSuggest`/`filterCustomTag` state 추가
- `handleAddCustomTag` — 중복/길이 체크 후 기존 tags 배열에 커스텀 태그 추가
- 태그 피커 팝업: 커스텀 태그 텍스트 입력 + 자동완성 드롭다운 (이전 태그 제안)
- 세션 아이템: 커스텀 태그 칩 표시 (클릭 시 filterCustomTag 활성화)
- 태그 필터 바: `filterCustomTag` 활성 시 `#태그명 ×` 칩 표시 (클릭 시 해제)
- `scripts/qa.ts`: Section 20 추가 (allCustomTags, filterCustomTag 체크, Pass 50→52)

## Round 114 완료 항목 (이전 세션)

### Round 114 — CC Extension 색상피커
- `extensions/cc-ws-extension-3x/main.js`: `POST /node/:uuid/property`에 `color` 케이스 추가 — `cc.Color` 타입으로 `set-property` 호출 (r/g/b/a 지원)
- `src/renderer/src/components/sidebar/NodePropertyPanel.tsx`: `ComponentSection`에 `onSaveProp` prop 추가; color swatch 클릭 시 hidden `<input type="color">` 열림; onChange에서 hex → {r,g,b,a} 변환 후 `onSaveProp('color', ...)` 호출; ComponentSection 호출부에 `onSaveProp={(k, v) => save(k, v)}` 전달
- `scripts/qa.ts`: Section 19 추가 (CC 3x color key, NodePropertyPanel 색상피커 체크, Pass 48→50)

## Round 113 완료 항목 (이전 세션)

### Round 113 — 메시지 재생성 이력 보존
- `stores/chat-store.ts`: ChatMessage에 `alternatives?: string[]`, `altIndex?: number` 추가; `saveAlternative(id)` — 현재 text를 배열에 push 후 text 초기화; `setAltIndex(id, idx)` — 이력 인덱스 업데이트
- `ChatPanel.tsx`: `handleRegenerate` — 재생성 전 lastAssistant.text를 `saveAlternative` 호출로 보존
- `MessageBubble.tsx`: `onPrevAlt`/`altIndex`/`altCount` props 추가; `effectiveText` 변수로 altIndex 시 alternatives[altIndex] 표시; 재생성 버튼 다음에 `◂ N/M ▸` 네비게이션 렌더링
- `scripts/qa.ts`: Section 18 추가 (saveAlternative, MessageBubble 네비게이션 체크, Pass 46→48)

## Round 112 완료 항목 (이전 세션)

### Round 112 — NodePropertyPanel 슬라이더 PropRow
- `src/renderer/src/components/sidebar/NodePropertyPanel.tsx`: `PropRow`에 `sliderMin`/`sliderMax` optional props 추가 → `type="range"` 슬라이더 + 숫자 input 나란히 렌더링, 슬라이더 변경 시 즉시 save 호출
- Rotation에 `sliderMin={-180} sliderMax={180}`, Opacity에 `sliderMin={0} sliderMax={255}` 적용
- `scripts/qa.ts`: Section 17 추가 (슬라이더 PropRow/Opacity/Rotation 체크, Pass 43→46)

## Round 111 완료 항목 (이전 세션)

### Round 111 — StatsPanel 고도화 (세션별 통계 + 일별 메시지 차트 + TOP 5)
- `src/main/ipc/session-handlers.ts`: `session:globalStats` 핸들러 확장 — `totalMessages`, `avgMessagesPerSession`, `dailyMessageCounts` (7일), `topSessions` (messageCount 상위 5개) 반환
- `src/renderer/src/components/sidebar/StatsPanel.tsx`: StatsData 인터페이스 확장, 요약 카드 4열(전체 세션/최근7일/전체 메시지/평균 메시지), 일별 메시지 수 바 차트(보라색), 상위 세션 TOP 5 collapsible 섹션
- `scripts/qa.ts`: Section 16 추가 (globalStats 확장 필드, StatsPanel 차트/TOP 5 체크, Pass 40→43)

## Round 110 완료 항목 (이전 세션)

### Round 110 — NodePropertyPanel 디스플레이 고도화 + QA 수정
- `src/renderer/src/components/sidebar/NodePropertyPanel.tsx`: `formatPropValue` 강화 (Boolean → ✓/✗, Vec2 → `(x,y)`, Vec3 → `(x,y,z)`, Color → `color:R,G,B`); ComponentSection 행 렌더링에서 `color:` prefix 감지 시 컬러 스왓치(14×14px rgb 박스) + HEX 코드 표시
- `scripts/qa.ts`: Section 15 추가 (cc-bridge createNode/deleteNode, NodePropertyPanel ColorSwatch 체크, Pass 38→40); QA 색상 스왓치 감지 패턴 수정 (`background.*rgb` 리터럴 → `background` && `rgb(` 분리 체크)

## Round 109 완료 항목 (이전 세션)

### Round 109 — QA + 스트리밍 경과 시간 + CC 노드 생성/삭제
- `scripts/qa.ts`: Section 14 추가 (SceneTree rename, 스트리밍 경과 시간, Pass 36→38)
- `src/renderer/src/components/chat/InputBar.tsx`: `streamElapsed` state + `streamTimerRef`, 1초 인터벌 타이머, Stop 버튼 옆 `Xs` 경과 시간 표시
- `extensions/cc-ws-extension-3x/main.js`: `POST /scene/new-node`, `DELETE /node/:uuid`, CORS DELETE 추가
- `src/main/cc/cc-bridge.ts`: `createNode`, `deleteNode` 메서드
- `src/main/ipc/cc-handlers.ts`: `cc:createNode`, `cc:deleteNode` 핸들러
- `src/preload/index.ts`: `ccCreateNode`, `ccDeleteNode` contextBridge 노출
- `src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx`: `+`/`×` 버튼 (onCreateNode/onDeleteNode)
- `src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx`: `handleCreateNode`/`handleDeleteNode` 핸들러

## Round 108 완료 항목 (이전 세션)

### Round 108 — CC SceneTree 노드 인라인 이름 편집
- `extensions/cc-ws-extension-3x/main.js`: `name` property 케이스 추가 (set-property dump string)
- `extensions/cc-ws-extension-2x/scene-script.js`: `setNodeProperty`에 `name` 지원 추가
- `src/renderer/src/components/sidebar/SceneTreePanel.tsx`: `NodeRow`에 더블클릭 인라인 편집 UI (input/span 분기), `handleRename` 콜백 (ccSetProperty + 로컬 setTree 업데이트)

## Round 107 완료 항목 (이전 세션)

### Round 107 — 세션 자동 제목 + SceneTreePanel 노드 검색 + QA
- `src/renderer/src/components/chat/ChatPanel.tsx`: `autoSetTitle` callback — 첫 메시지 전송 시 50자 추출해 `sessionRename` 호출
- `src/renderer/src/components/sidebar/SceneTreePanel.tsx`: `nodeSearch` 상태, `matchesSearch` 필터, 검색 input UI, `forceExpand` prop으로 매칭 노드 자동 펼침
- `scripts/qa.ts`: Section 13 추가 (quick actions + autoSetTitle 체크, Pass 34→36)

## Round 106 완료 항목 (이전 세션)

### Round 106 — InputBar 빠른 액션 슬롯
- `src/renderer/src/components/chat/InputBar.tsx`: `DEFAULT_QUICK_ACTIONS` 4개 프리셋 (요약/코드리뷰/설명/계속), `quickActions`/`editingAction` 상태, `handleQuickAction`/`saveQuickActionEdit` 핸들러, 빠른 액션 바 UI (우클릭 편집 팝오버 포함), localStorage 영구 저장

## Round 105 완료 항목 (이전 세션)

### Round 105 — CC 2x Extension Z-order + QA Section 12
- `extensions/cc-ws-extension-2x/scene-script.js`: `setNodeZOrder` 함수 추가 (front/back/up/down, getSiblingIndex/setSiblingIndex)
- `extensions/cc-ws-extension-2x/main.js`: `POST /node/:uuid/zorder` 라우트 추가, status features에 'zorder' 추가
- `scripts/qa.ts`: Section 12 추가 (cc-bridge setZOrder, 2x extension Z-order 체크, Pass 32→34)

## Round 104 완료 항목 (이전 세션)

### Round 104 — QA 강화 + SceneView Z-order 제어
- `scripts/qa.ts`: Section 11 추가 (R102~103 체크 3종), Pass 29→32
- `extensions/cc-ws-extension-3x/main.js`: `POST /node/:uuid/zorder` 엔드포인트 추가 (front/back/up/down)
- `src/main/cc/cc-bridge.ts`: `setZOrder(uuid, direction)` 메서드
- `src/main/ipc/cc-handlers.ts`: `cc:setZOrder` IPC 핸들러
- `src/preload/index.ts`: `ccSetZOrder` contextBridge 노출
- `src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx`: ⬆⬆/⬆/⬇/⬇⬇ Z-order 버튼 추가
- `src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx`: `canZOrder`/`handleZOrder` 추가

## Round 103 완료 항목 (이전 세션)

### Round 103 — 전체 세션 메시지 검색
- `src/main/ipc/session-handlers.ts`: `session:searchAll` 핸들러 — 최근 100세션, 50건 제한, excerpt 추출
- `src/shared/ipc-schema.ts`: `SESSION_SEARCH_ALL` 상수, `GlobalSearchResult` 인터페이스
- `src/preload/index.ts`: `sessionSearchAll` contextBridge 노출
- `src/renderer/src/components/sidebar/GlobalSearchPanel.tsx` (신규): 400ms debounce 검색, 결과 카드 (세션명/날짜/role/excerpt), 클릭 시 해당 세션 이동
- `src/renderer/src/components/sidebar/Sidebar.tsx`: `Tab`에 `globalsearch` 추가, `🔍 전체` 탭 버튼, GlobalSearchPanel 마운트

## Round 102 완료 항목 (이전 세션)

### Round 102 — QA + SceneInspector 가시성 토글 + 버그 수정
- `scripts/qa.ts`: Section 10 추가 (R101 체크 3종), Pass 26→29
- `src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx`: `isActive` state + `handleActiveToggle` + 눈 아이콘 토글 버튼
- `src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx`: **버그 수정** — `ccSetProperty(uuid, ...)` → `ccSetProperty(port, uuid, ...)` (drag 완료 시 x/y 저장 + inspector 업데이트 모두 수정)

## Round 101 완료 항목 (이전 세션)

### Round 101 — 메모리 누수 수정 + SceneView 노드 복사/붙여넣기
- `src/main/ollama/ollama-bridge.ts`: AbortSignal `onAbort` cleanup 분리 (모든 경로에서 removeEventListener)
- `src/main/providers/openai-bridge.ts`: 동일하게 수정
- `src/renderer/src/components/sidebar/SceneView/types.ts`: `ClipboardEntry` 타입 추가
- `src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx`: `clipboard` state, Ctrl+C/V 핸들러, 로컬 복제 로직
- `src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx`: ⊡/⊞ 복사/붙여넣기 버튼
- `CHANGELOG.md`: R87~R101 전체 갱신
- QA: Warning 2→0 (메모리 누수 수정으로 해소)

## Round 100 완료 항목 (이전 세션)

### Round 100 — QA 강화 + 핸드오프 갱신
- `scripts/qa.ts`: Section 9 추가 (R98~99 체크 5종), Pass 21→26
  - SceneView UndoEntry 타입, undo/redo 스택 (R98)
  - openai-bridge.ts openaiChat, openai-handlers.ts, InputBar OpenAI 모델 옵션 (R99)
- `ROADMAP.md`, `handoff.md` 업데이트

## Round 99 완료 항목 (이전 세션)

### Round 99 — 멀티 AI 프로바이더 추상화 + OpenAI 연동
- `src/main/providers/ai-provider.ts` (신규): `AIMessage`, `AIProvider` 인터페이스
- `src/main/providers/openai-bridge.ts` (신규): Electron `net` 기반 OpenAI SSE 스트리밍 (`openaiChat`)
- `src/main/ipc/openai-handlers.ts` (신규): `openai:send` / `openai:interrupt` IPC 핸들러, claude:message 채널 라우팅
- `src/main/ipc/router.ts`: `registerOpenAIHandlers` 등록
- `src/shared/ipc-schema.ts`: `OPENAI_SEND`, `OPENAI_INTERRUPT` 상수 추가
- `src/preload/index.ts`: `openaiSend`, `openaiInterrupt` contextBridge 노출
- `src/renderer/src/components/shared/SettingsPanel.tsx`: OpenAI API Key 입력 UI (AI 탭, localStorage + settingsSet 저장)
- `src/renderer/src/components/chat/InputBar.tsx`: OpenAI 모델 섹션 (`gpt-4o`, `gpt-4o-mini`, `o3-mini`)
- `src/renderer/src/components/chat/ChatPanel.tsx`: `handleSend`/`handleInterrupt`에 `openai:` prefix 분기 추가

API Key 흐름: SettingsPanel → settingsSet IPC → main userData/settings.json → openai-handlers.ts에서 직접 읽음

## Round 98 완료 항목 (이전 세션)

### Round 98 — QA 강화 + SceneView undo/redo 스택
- `scripts/qa.ts`: Section 8 추가 (R96~97 체크 4종), Pass 17→21
- `src/renderer/src/components/sidebar/SceneView/types.ts`: `UndoEntry { uuid, prevX, prevY, nextX, nextY }` 추가
- `src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx`: `undoStack`/`redoStack` state, Ctrl+Z/Y 키보드 핸들러, 드래그 커밋 시 UndoEntry push
- `src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx`: ↩/↪ 버튼 추가, `canUndo`/`canRedo` opacity 제어

## Round 97 완료 항목 (이전 세션)

### Round 97 — Ollama 로컬 LLM 연동
- `src/main/ollama/ollama-bridge.ts` (신규): ollamaListModels, ollamaChat (Electron net, NDJSON 스트리밍)
- `src/main/ipc/ollama-handlers.ts` (신규): ollama:list/send/interrupt IPC, claude:message 채널 라우팅
- `src/main/ipc/router.ts`: registerOllamaHandlers 등록
- `src/preload/index.ts`: ollamaList/ollamaSend/ollamaInterrupt contextBridge 노출
- `src/renderer/src/components/chat/InputBar.tsx`: Ollama 모델 피커 (ollama:model prefix)
- `src/renderer/src/components/chat/ChatPanel.tsx`: handleSend/handleInterrupt Ollama 라우팅

## Round 96 완료 항목

### Round 96 — CC SceneView 다중 노드 선택
- SceneViewPanel: selectedUuids Set, shift-click 멀티셀렉트, 마퀴 rect 드래그
- NodeRenderer: multiSelected prop → 파란 점선 오버레이
- SceneInspector: selectionCount > 1 시 "N개 노드 선택됨" 표시
- SceneToolbar: 선택 수 배지
- CHANGELOG.md 신규 생성

## Round 94 완료 항목 (이전 세션)

### Round 94 — AG-UI 이벤트 모델
- `ipc-schema.ts`: `AguiRunStarted`, `AguiStepStarted`, `AguiStepFinished`, `AguiRunFinished`, `AguiEvent` 타입 추가
- `agent-bridge.ts`: `run_started`/`step_started`/`step_finished`/`run_finished` 이벤트 방출 (기존 이벤트와 병행)
- `agui-store.ts` (신규): 인메모리 옵저버블 스토어 (`aguiSubscribe`, `aguiDispatch`)
- `RunTimeline.tsx` (신규): `RunCard` + `RunTimeline` — 런/스텝 상태 시각화
- `AgentPanel.tsx`: 런타임 탭 추가, `RunTimeline` 마운트
- `App.tsx`: AG-UI 이벤트 타입 감지 후 `aguiDispatch` 호출

## Round 93 완료 항목 (이전 세션)

### Round 93 — 스트리밍 배치 렌더링 최적화
- `agent-bridge.ts`: `text_delta` 이벤트 16ms 배치 (textBatch + setTimeout 플러시), `result` 직전 `flushTextBatch()` 호출
- `chat-store.ts`: `reconcileText(fullText)` 추가 — RAF 취소 후 정규 전체 텍스트로 교체
- `App.tsx`: `isDeltaStreamingRef` 추적, `text_delta` 실시간 렌더링 활성화, `text` 이벤트는 `reconcileText`로 최종 정합

## Round 83~88 완료 항목 (이전 세션)

### Round 83 — 시스템 프롬프트 UI + 토큰 카운터
- `ChatPanel.tsx`: 커스텀 시스템 프롬프트 에디터 (localStorage), 컨텍스트 윈도우 진행 바
- `InputBar.tsx`: 실시간 토큰 추산 카운터 (~N 토큰 표시)
- `MessageBubble.tsx`: 메시지별 토큰 수 표시 (~Xt)
- `SettingsPanel.tsx`: 글로벌 시스템 프롬프트 + 응답 언어 설정

### Round 84 — CC 에셋 브라우저
- `AssetBrowserPanel.tsx`: 에셋 트리 브라우저 (검색/폴더토글/파일타입 아이콘/경로복사)
- `extensions/cc-ws-extension-3x/main.js` + `2x/main.js`: `GET /assets/tree` 엔드포인트
- `src/shared/ipc-schema.ts`: `AssetItem`, `AssetTree` 타입
- `src/main/cc/cc-bridge.ts`: `getAssets()` 메서드
- `src/main/ipc/cc-handlers.ts`: `cc:get-assets` IPC 핸들러
- `src/preload/index.ts`: `ccGetAssets` contextBridge 노출
- `CocosPanel.tsx`: 씬트리 하단 에셋 브라우저 섹션 (collapsible)

### Round 85 — CC 컴포넌트 인스펙터
- `extensions/cc-ws-extension-3x/main.js`: `enrichNode`에서 컴포넌트 props 추출
- `ipc-schema.ts`: `CCNode.components[].props?` 타입 추가
- `NodePropertyPanel.tsx`: 콜랩서블 `ComponentSection` + `formatPropValue` (UITransform/UIOpacity 제외)

### Round 86 — 월별 비용 추적
- `cost-tracker.ts`: localStorage 기반 일별/월별 비용 집계 (90일 유지)
- `App.tsx`: `recordCost()` 연동 (addCost와 동시 호출)
- `StatusBar.tsx`: 세션 팝업에 오늘/이번달 누적 비용 표시

### Round 87 — 커맨드 팔레트 최근 실행 액션
- `CommandPalette.tsx`: `recent-action` 타입, ⚡ 섹션, 최대 8개 recency 순 저장

### Round 88 — PromptChain 템플릿 라이브러리
- `PromptChainPanel.tsx`: `PRESET_TEMPLATES` 5종 (코드리뷰/디버깅/콘텐츠/번역/기능명세), 📚 버튼 오버레이

## 주요 파일 (Round 83~88 추가/수정)
| 파일 | 역할 |
|------|------|
| `src/renderer/src/components/chat/ChatPanel.tsx` | 시스템프롬프트 에디터, 컨텍스트 진행바 |
| `src/renderer/src/components/chat/InputBar.tsx` | 실시간 토큰 카운터 |
| `src/renderer/src/components/chat/MessageBubble.tsx` | 메시지 토큰 표시 |
| `src/renderer/src/components/sidebar/AssetBrowserPanel.tsx` | CC 에셋 브라우저 |
| `src/renderer/src/components/sidebar/NodePropertyPanel.tsx` | CC 컴포넌트 인스펙터 |
| `src/renderer/src/components/shared/StatusBar.tsx` | 오늘/이번달 비용 팝업 |
| `src/renderer/src/components/shared/CommandPalette.tsx` | recent-action 추적 |
| `src/renderer/src/components/sidebar/PromptChainPanel.tsx` | 템플릿 라이브러리 |
| `src/renderer/src/utils/cost-tracker.ts` | localStorage 비용 집계 |
| `src/shared/ipc-schema.ts` | AssetItem/AssetTree, CCNode.components[].props |
| `extensions/cc-ws-extension-3x/main.js` | /assets/tree, compProps 추출 |
| `extensions/cc-ws-extension-2x/main.js` | /assets/tree 엔드포인트 |

## 기존 주요 파일 (Round 64~82)
| 파일 | 역할 |
|------|------|
| `extensions/cc-ws-extension-3x/main.js` | CC3x HTTP/WS 브릿지 |
| `extensions/cc-ws-extension-2x/main.js` | CC2x HTTP/WS 브릿지 |
| `src/renderer/src/components/sidebar/CocosPanel.tsx` | CC 연결 UI + 에셋 브라우저 |
| `src/renderer/src/components/sidebar/AgentPanel.tsx` | 에이전트 태스크/체이닝/히스토리 |
| `src/renderer/src/utils/cost-tracker.ts` | 일별/월별 비용 집계 |
| `src/main/cc/cc-bridge.ts` | CC WebSocket 연결 관리 |
| `src/main/ipc/cc-handlers.ts` | CC IPC 핸들러 |
| `src/shared/ipc-schema.ts` | CCNode, AssetItem, AssetTree 타입 정의 |

## CC Extension 구조
- **포트**: 3x = 9091, 2x = 9090
- **엔드포인트**: `GET /scene/tree`, `GET /node/:uuid`, `POST /node/:uuid/property`, `GET /assets/tree`
- **CC3x enrichNode**: `components[].props` 포함 (각 컴포넌트 속성 값)

## 알려진 이슈 / 미수정
- `runInSandbox` — `new Function(code)` 직접 실행 (`MessageBubble.tsx`)
- `sandbox: false` Electron 설정
- `bypassCSP: true` local:// 프로토콜 광범위 CSP 우회
- `session:importBackup` 백업 파일 구조 검증 없음

## 다음 예정 (Round 89~91)
- Round 89: QA 강화 + 핸드오프 업데이트
- Round 90: 세션 관리 고도화 — 태그 시스템, 즐겨찾기 핀, 날짜별 그룹 헤더
- Round 91: 파일 컨텍스트 패널 — 파일 명시적 첨부, system prompt 자동 주입

## 아키텍처 요약
```
Electron (Main)
├── ipc/fs-handlers.ts        — 파일시스템, Git, project:analyze
├── ipc/session-handlers.ts   — 세션 저장
├── ipc/claude-handlers.ts    — Claude API
├── ipc/cc-handlers.ts        — CC IPC (cc:get-assets 포함)
├── ipc/project-intelligence.ts — 프로젝트 타입/스택 분석
├── cc/cc-bridge.ts           — CC WebSocket (getAssets 포함)
└── claude/agent-bridge.ts    — SDK 파싱

Renderer (React 18)
├── components/chat/           — ChatPanel(시스템프롬프트/진행바), InputBar(토큰), MessageBubble(토큰)
├── components/sidebar/        — AssetBrowserPanel, NodePropertyPanel(컴포넌트인스펙터)
│   ├── PromptChainPanel       — 템플릿 라이브러리 포함
│   └── AgentPanel             — 3탭(태스크/체이닝/히스토리)
├── components/shared/         — StatusBar(월별비용), CommandPalette(recent-action), ToastContainer
├── utils/cost-tracker.ts      — localStorage 비용 집계
└── stores/project-store.ts    — totalCost + recordCost 연동

CC Extensions
├── cc-ws-extension-2x/       — CC 2.x port 9090 (assets/tree 포함)
└── cc-ws-extension-3x/       — CC 3.x port 9091 (assets/tree, compProps 포함)
```

## 참고
- Plane 연동: **제외** (2026-03-12 사용자 지시)
- 빌드: `npm run build`
- QA: `npm run qa`
- CC Extension reload: CC Editor → Extension Manager → cc-ws-extension → Reload
