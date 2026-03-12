# Changelog — Claude Desktop

## [Round 128] — 2026-03-12
### Added
- NodeHierarchyList.tsx: 재귀 노드 계층 트리 패널 — childUuids 기반 들여쓰기 렌더링
- NodeHierarchyList: 클릭 선택, Ctrl+클릭 멀티셀렉트, active 상태 시각화 (불투명도)
- SceneToolbar: ≡ 계층 토글 버튼 (showHierarchy prop)
- SceneViewPanel: 계층 트리 패널 SVG 위에 삽입 (120px 고정 높이, 스크롤)

## [Round 127] — 2026-03-12
### Added
- SceneInspector: 노드 이름 인라인 편집 — 이름 더블클릭 → 텍스트 입력 필드 활성화
- SceneInspector: Enter/Blur로 저장, Escape로 취소, 노드 변경 시 자동 취소
- SceneViewPanel: handleRename() — ccSetProperty('name') 호출 + updateNode 낙관적 업데이트

## [Round 126] — 2026-03-12
### Changed
- QA 통합 검수 (Pass 70 → Pass 73), CHANGELOG R121~125 갱신, ROADMAP R126 완료 처리

## [Round 125] — 2026-03-12
### Added
- useSceneSync: refreshNode(uuid) — ccGetNode로 단건 노드 최신화 (opacity/color/components)
- SceneViewPanel: node:select 이벤트 시 refreshNode() 자동 호출 (CC 에디터 선택 동기화)
- SceneViewPanel: selectedUuid 변경 시 200ms debounce refreshNode (UI 선택 시 props 최신화)

## [Round 124] — 2026-03-12
### Added
- SceneView types.ts: ResizeState 인터페이스 추가 (uuid, handle, startSvgX/Y, startWidth/Height, startNodeX/Y)
- SceneViewPanel: resizeRef + handleResizeMouseDown — 4개 모서리 핸들 클릭 시 ResizeState 초기화
- SceneViewPanel: handleMouseMove 리사이즈 분기 — nw/ne/se/sw 핸들별 width/height/x/y 실시간 조정
- SceneViewPanel: handleMouseUp 리사이즈 커밋 — ccSetProperty IPC로 width/height/x/y 저장
- SVG 4개 흰색 rect 핸들 렌더링 (단일 선택 시, zoom 보정 5px 크기, 파란 테두리)

## [Round 123] — 2026-03-12
### Added
- SceneToolbar: canAlign prop + 정렬 버튼 6종 (←L, ↔, R→, ↑T, ↕, B↓) — 멀티셀렉트 시 표시
- SceneViewPanel: handleAlign() — left/centerH/right/top/centerV/bottom 6방향 정렬
  (anchorX/anchorY 기반 경계 계산 + ccSetProperty IPC 배치 호출)

## [Round 122] — 2026-03-12
### Changed
- SessionList groupSessions: 5단계 날짜 그룹 (오늘/어제/이번 주/이번 달/이전)
- monthStart 계산 추가 (이번달 첫 날), 이번 주와 이전 사이에 이번달 섹션 삽입

## [Round 121] — 2026-03-12
### Added
- CC 3x Extension: POST /node/:uuid/component 엔드포인트 — cc.Label string/fontSize, cc.Button interactable 등 컴포넌트 props 직접 편집
- cc-bridge.ts: setComponentProp() 메서드 추가
- NodePropertyPanel: COMP_EDITABLE_KEYS 테이블 (cc.Label/cc.RichText/cc.Button/cc.EditBox), CompEditRow 인라인 편집 UI
- saveComp() — ccSetComponentProp IPC 연동

## [Round 119] — 2026-03-12
### Added
- InputBar: text useEffect → adjustHeight() 자동 호출 (Shift+Enter 줄바꿈 auto-resize)
- InputBar: placeholder에 Shift+Enter 힌트, 100자 이상 시 문자/줄 수 표시

## [Round 118] — 2026-03-12
### Added
- SceneViewPanel: groupBbox useMemo — 멀티셀렉트 노드 전체 bbox 계산 (패딩 8px)
- SVG 황색 점선 rect 렌더링 (strokeWidth/dasharray zoom 보정)

## [Round 117] — 2026-03-12
### Added
- SceneView DragState: groupOffsets? 필드 추가
- SceneViewPanel: isGroupDrag 감지 + 선택 노드 동시 이동 + undo/IPC 배치 처리

## [Round 115] — 2026-03-12
### Added
- SessionList: 커스텀 텍스트 태그 시스템 — 자유 텍스트 태그 입력 + 자동완성 드롭다운
- SessionList: filterCustomTag 필터 칩 + 태그 칩 클릭 시 필터 활성화

## [Round 114] — 2026-03-12
### Added
- NodePropertyPanel: ComponentSection color swatch 클릭 시 native color picker 팝업
- CC 3x extension: POST /node/:uuid/property에 color 케이스 (cc.Color) 추가

## [Round 113] — 2026-03-12
### Added
- chat-store: ChatMessage에 alternatives[] + altIndex 필드, saveAlternative/setAltIndex 액션
- ChatPanel: 재생성 전 현재 응답을 saveAlternative로 이력 보존
- MessageBubble: ◂ N/M ▸ 이전 응답 네비게이션 UI (altCount > 0 시 표시)

## [Round 112] — 2026-03-12
### Added
- NodePropertyPanel: PropRow에 sliderMin/sliderMax props → range 슬라이더 + 숫자 입력 연동
- Rotation 슬라이더 (-180~180), Opacity 슬라이더 (0-255) 적용

## [Round 111] — 2026-03-12
### Added
- session-handlers: globalStats에 totalMessages, avgMessagesPerSession, dailyMessageCounts, topSessions 반환
- StatsPanel: 4열 요약 카드, 일별 메시지 수 바 차트(보라색), 상위 세션 TOP 5 collapsible 섹션

## [Round 110] — 2026-03-12
### Added
- NodePropertyPanel: formatPropValue 강화 — Boolean(✓/✗), Vec2(x,y), Vec3(x,y,z), Color prefix
- NodePropertyPanel: ComponentSection에 color: prefix 감지 시 컬러 스왓치(14×14px) + HEX 코드 표시

## [Round 101] — 2026-03-12
### Fixed
- ollama-bridge.ts: AbortSignal addEventListener 메모리 누수 수정
- openai-bridge.ts: AbortSignal addEventListener 메모리 누수 수정
### Added
- SceneView: 노드 복사/붙여넣기 (Ctrl+C/V), ClipboardEntry 타입
- SceneToolbar: C 복사 / V 붙여넣기 버튼

## [Round 100] — 2026-03-12
### Added
- QA Section 9: R98~99 체크 5종 추가 (Pass 21→26)

## [Round 99] — 2026-03-12
### Added
- AIProvider 인터페이스 (src/main/providers/ai-provider.ts)
- openai-bridge.ts: Electron net 기반 OpenAI SSE 스트리밍
- openai-handlers.ts: openai:send/interrupt IPC 핸들러
- SettingsPanel: OpenAI API Key 입력 UI
- InputBar: gpt-4o/gpt-4o-mini/o3-mini 모델 옵션
- ChatPanel: openai: prefix 라우팅

## [Round 98] — 2026-03-12
### Added
- SceneView UndoEntry 타입, undo/redo 스택 (Ctrl+Z/Y)
- SceneToolbar: ↩/↪ 실행취소/다시실행 버튼
- QA Section 8: R96~97 체크 4종 추가 (Pass 17→21)

## [Round 97] — 2026-03-12
### Added
- ollama-bridge.ts: Electron net NDJSON 스트리밍
- ollama-handlers.ts: ollama:send/interrupt/list IPC
- InputBar: Ollama 모델 피커 (동적 조회)
- ChatPanel: ollama: prefix 라우팅
- ipc-schema.ts: OLLAMA_* 상수

## [Round 96] — 2026-03-12
### Added
- SceneView 다중 선택 (selectedUuids Set, Shift-click)
- 마퀴 드래그 선택 (MarqueeState)
- NodeRenderer: multiSelected 파란 점선 오버레이
- SceneInspector: 다중 선택 요약 표시
- SceneToolbar: 선택 수 배지
- CHANGELOG.md 신규 생성

## [Round 95] — 2026-03-12
### Changed
- QA 스크립트에 R90~94 신규 기능 7종 체크 추가 (Pass 10→17)

## [Round 94] — 2026-03-12
### Added
- AG-UI 이벤트 모델: AguiRunStarted/StepStarted/StepFinished/RunFinished 타입 (ipc-schema.ts)
- agui-store.ts: aguiSubscribe/aguiDispatch 인메모리 옵저버블 스토어 (신규)
- RunTimeline.tsx: 런·스텝 상태 시각화 컴포넌트 (신규)
### Changed
- agent-bridge.ts: run_started/step_started/step_finished/run_finished 이벤트 병행 방출
- AgentPanel.tsx: '런타임' 탭 추가
- App.tsx: AG-UI 이벤트 감지 후 aguiDispatch 호출

## [Round 93] — 2026-03-12
### Changed
- agent-bridge.ts: text_delta 이벤트 16ms 배치 (textBatch + setTimeout 플러시)
- chat-store.ts: reconcileText(fullText) 함수 추가
- App.tsx: isDeltaStreamingRef로 text_delta 실시간 렌더링 활성화

## [Round 92] — 2026-03-12
### Added
- StatsPanel API 비용 섹션: 오늘/이번달 카드 + 7일 바 차트 (cost-tracker 통합)

## [Round 91] — 2026-03-12
### Added
- 네이티브 파일 다이얼로그: fs:open-file-dialog IPC, preload openFileDialog
- ChatPanel 📎 버튼: 네이티브 파일 피커로 파일 첨부

## [Round 90] — 2026-03-12
### Added
- 파일 컨텍스트 패널: useContextFiles hook (localStorage 영속, IPC readFile)
- ChatPanel 📎 콜랩서블 바: 파일 칩 표시 + system prompt 자동 주입

## [Round 89] — 2026-03-12
### Changed
- scripts/qa.ts: R83~88 신규 기능 5종 체크 추가 (Pass 5→10)
- handoff.md 전체 갱신

## [Round 88] — 2026-03-12
### Added
- PromptChainPanel 템플릿 라이브러리: PRESET_TEMPLATES 5종 (코드리뷰/디버깅/콘텐츠/번역/기능명세)
- 📚 버튼 오버레이, 가져오기로 체인 생성

## [Round 87] — 2026-03-12
### Added
- CommandPalette recent-action 타입: ⚡ 섹션, 최대 8개 recency 순 저장
- 실행 시 addRecentAction 자동 저장

## [Round 86] — 2026-03-12
### Added
- cost-tracker.ts: localStorage 기반 일별/월별 API 비용 집계 (90일 보존)
- App.tsx: recordCost() 연동
- StatusBar: 세션 팝업에 오늘/이번달 누적 비용 표시

## [Round 85] — 2026-03-12
### Changed
- CC 3x enrichNode: components[].props 추출 (UITransform/UIOpacity 제외)
- NodePropertyPanel: 콜랩서블 ComponentSection + formatPropValue
- ipc-schema.ts: CCNode.components[].props? 타입 추가

## [Round 84] — 2026-03-12
### Added
- AssetBrowserPanel.tsx: CC 에셋 트리 브라우저 (검색/폴더토글/파일타입 아이콘/경로복사)
- extensions: GET /assets/tree 엔드포인트 (3x, 2x)
- ipc-schema.ts: AssetItem, AssetTree 타입
- cc-bridge.ts: getAssets() 메서드
- cc-handlers.ts: cc:get-assets IPC 핸들러

## [Round 83] — 2026-03-12
### Added
- ChatPanel: 커스텀 시스템 프롬프트 에디터 (localStorage), 컨텍스트 윈도우 진행 바
- InputBar: 실시간 토큰 추산 카운터
- MessageBubble: 메시지별 토큰 수 표시
- SettingsPanel: 글로벌 시스템 프롬프트 + 응답 언어 설정
