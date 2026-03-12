# Changelog — Claude Desktop

## [Round 199] — 2026-03-13
### Added
- NodeHierarchyList: 노드 이름 인라인 편집 — 더블클릭 또는 컨텍스트 메뉴 "이름 변경", Enter/blur로 저장

## [Round 198] — 2026-03-13
### Added
- SceneView: Ctrl+] / Ctrl+[ 로 노드 z-order 변경 (앞으로/뒤로 한 단계)

## [Round 197] — 2026-03-13
### Added
- SceneView: Tab/Shift+Tab으로 형제 노드 순환 선택 (다음/이전 형제 토글)

## [Round 196] — 2026-03-13
### Added
- TasksPanel: 인라인 태스크 편집 — 더블클릭으로 편집 모드, Enter 저장, Esc 취소

## [Round 195] — 2026-03-13
### Added
- ClipboardPanel: 검색 필터 — 텍스트/소스로 클립보드 항목 실시간 검색, Esc로 초기화

## [Round 194] — 2026-03-13
### Added
- CalendarPanel: "오늘" 버튼 — 다른 달 탐색 중 클릭 시 이번 달로 즉시 이동 + 오늘 날짜 선택
- CalendarPanel: 세션 수 요약 — "전체 N개 세션 · 이번 달 M개" 텍스트 표시

## [Round 193] — 2026-03-13
### Added
- SceneView: N 키 단축키 — 빠른 새 노드 생성 (선택 노드의 자식으로)
- SceneView: 단축키 도움말에 N(새 노드 생성) 항목 추가

## [Round 192] — 2026-03-13
### Added
- SceneView: 원점(0,0) 십자선 가이드 — 그리드 활성 시 Cocos 좌표 원점에 파란 점선 십자선 + 원 표시

## [Round 191] — 2026-03-13
### Added
- SceneView: M 키 단축키 — 미니맵 표시/숨기기 토글
- SceneView: 단축키 도움말에 M(미니맵), Del/Backspace(삭제) 항목 추가

## [Round 190] — 2026-03-13
### Added
- SceneInspector: Color 섹션에 알파(α) 슬라이더 추가 — 0~255 범위 드래그로 색상 투명도 실시간 편집

## [Round 189] — 2026-03-13
### Added
- SceneView: Ctrl+← → 회전 단축키 — 1°씩 회전, Ctrl+Shift+← → 10°씩 회전
- SceneView: 단축키 도움말에 Alt+↑/↓, Ctrl+←/→ 항목 추가

## [Round 188] — 2026-03-13
### Added
- SceneView: 다중 선택 시 합산 bounding box 표시 — 선택된 모든 노드를 감싸는 파란 점선 사각형

## [Round 187] — 2026-03-13
### Added
- SceneView: 회전 중 각도 오버레이 — 회전 드래그 시 중앙에 현재 각도(XX.X°) 실시간 표시

## [Round 186] — 2026-03-13
### Added
- SceneToolbar: ⊡ 미니맵 토글 버튼 — 툴바에서 미니맵 표시/숨기기 직접 제어

## [Round 185] — 2026-03-13
### Added
- SceneView: 미니맵 클릭 네비게이션 — 클릭 위치로 뷰포트 즉시 이동, 더블클릭으로 숨기기

## [Round 184] — 2026-03-13
### Added
- SceneView: 미니맵 오버레이 — 우하단 축소 맵에 전체 노드 + 뷰포트 표시, 클릭으로 토글

## [Round 183] — 2026-03-13
### Added
- SceneInspector: 조상 Breadcrumb 경로 표시 — 부모/조부모 전체 클릭 가능한 체인으로 표시 (Canvas › Panel › Button)

## [Round 182] — 2026-03-13
### Added
- SceneInspector: Anchor ⊙ 버튼 — 클릭 시 anchorX, anchorY를 0.5로 즉시 초기화

## [Round 181] — 2026-03-13
### Added
- SceneInspector: Scale ⊙ 버튼 — 클릭 시 scaleX, scaleY를 1로 즉시 초기화, 비활성(1,1)일 때 muted 색상

## [Round 180] — 2026-03-13
### Added
- SceneInspector: Rotation ⊙ 버튼 — 클릭 시 rotation을 0으로 즉시 초기화, 비활성(0)일 때 muted 색상

## [Round 179] — 2026-03-13
### Added
- SceneInspector: Position ⊙ 버튼 — 클릭 시 X, Y를 (0, 0)으로 즉시 초기화

## [Round 178] — 2026-03-13
### Added
- SceneView: Alt+↑ 부모 노드 선택, Alt+↓ 첫 자식 노드 선택 단축키

## [Round 177] — 2026-03-13
### Added
- SceneView: 배경 밝기 토글 (◑) — 체크패턴 어두운/밝은 모드 전환

## [Round 176] — 2026-03-13
### Added
- SceneView: 드래그/리사이즈 중 선택 노드 x,y,w,h 실시간 정보 표시

## [Round 175] — 2026-03-12
### Added
- SceneInspector: 자식 노드 목록 확장 — ↳N 클릭 시 자식 이름 목록 펼치기/접기, 클릭으로 선택

## [Round 174] — 2026-03-12
### Added
- SceneToolbar: 줌 레벨 더블클릭 인라인 편집 — 숫자 직접 입력 후 Enter 적용

## [Round 173] — 2026-03-12
### Added
- 코드 블록: 4줄 이상 시 라인 번호 자동 표시 (react-syntax-highlighter showLineNumbers)

## [Round 172] — 2026-03-12
### Added
- SceneInspector: Size W/H 비율 유지 잠금 버튼 — Scale 잠금과 동일하게 ∝ 토글

## [Round 171] — 2026-03-12
### Added
- SceneView: SVG 캔버스 우클릭 컨텍스트 메뉴 — 선택/복사/붙여넣기/복제/삭제

## [Round 170] — 2026-03-12
### Added
- SceneView: 노드 더블클릭 → SceneInspector 이름 편집 자동 포커스 (SVG → Inspector 연동)

## [Round 169] — 2026-03-12
### Added
- SceneInspector: 컬러 피커 — 색상 스워치 클릭 시 native color picker 열림, 변경 즉시 반영

## [Round 168] — 2026-03-12
### Added
- SceneView: 선택 노드 회전 핸들 — 상단 오렌지 원형 핸들 드래그로 실시간 rotation 변경

## [Round 167] — 2026-03-12
### Added
- SceneInspector: Scale 비율 유지 잠금 버튼 (∝) — Sx/Sy 중 하나 편집 시 비율 유지 자동 연동

## [Round 166] — 2026-03-12
### Added
- NodeHierarchyList: 우클릭 컨텍스트 메뉴 — 선택/복사/활성화 메뉴 (이벤트 위임 방식)

## [Round 165] — 2026-03-12
### Added
- SceneInspector: JSON 내보내기 버튼 — 노드 정보 전체를 pretty JSON으로 클립보드 복사

## [Round 164] — 2026-03-12
### Added
- SceneView: 씬 좌하단 총 노드 수 표시 — "N개 노드", 멀티셀렉트 시 "· M 선택" 추가

## [Round 163] — 2026-03-12
### Added
- SceneView: Space 키 임시 패닝 모드 — Space 홀드 시 현재 도구 유지하며 grab/grabbing 커서로 패닝 가능

## [Round 162] — 2026-03-12
### Added
- SceneView: 균등 분포 배치 — 멀티셀렉트 3개 이상 시 수평(⊢⊣)/수직(⊤⊥) 균등 배치 버튼

## [Round 161] — 2026-03-12
### Added
- SceneInspector: 자식 노드 수 표시 — "↳N" 형태로 헤더 하단에 표시, 부모/자식 정보 한 줄에 통합

## [Round 160] — 2026-03-12
### Added
- SceneView: Ctrl+D 복제 단축키 — 클립보드 변경 없이 선택 노드 20px 오프셋 복제

## [Round 159] — 2026-03-12
### Added
- SceneView: 선택 노드 anchor point 마커 — 노드 position(=anchor 위치)에 황색 ◇ polygon 표시

## [Round 158] — 2026-03-12
### Added
- SceneView: Ctrl+A 전체 선택 — nodeMap 모든 노드 선택, 단축키 도움말 항목 추가

## [Round 157] — 2026-03-12
### Added
- SceneInspector: 컴포넌트 목록에 타입별 아이콘 표시 — getComponentIcon 재사용, accent 색상

## [Round 156] — 2026-03-12
### Added
- SceneView: 씬 원점 (0,0) 레이블 — 중앙 십자 우상단에 "(0,0)" SVG 텍스트 표시, zoom 보정

## [Round 155] — 2026-03-12
### Added
- SceneView: 패닝 중 커서 grab → grabbing 변경 — isPanningActive 상태로 동적 커서 제어

## [Round 154] — 2026-03-12
### Added
- SceneInspector: UUID 복사 버튼 — 헤더 # 버튼 클릭 시 UUID 클립보드 복사, 복사 완료 시 ✓ 피드백

## [Round 153] — 2026-03-12
### Added
- NodeHierarchyList: 검색창 ESC 키 → 검색어 초기화 + 포커스 해제

## [Round 152] — 2026-03-12
### Added
- SceneView: 선택 노드 size 레이블 — 단일 선택 시 bounding box 우상단에 "W×H" SVG 텍스트 표시 (드래그/리사이즈 중 숨김)

## [Round 151] — 2026-03-12
### Added
- SceneView: 방향키로 선택 노드 1px nudge, Shift+방향키 10px 이동 + 단축키 도움말에 항목 추가

## [Round 150] — 2026-03-12
### Added
- NodeHierarchyList: 검색창 X 지우기 버튼 — 검색어 입력 시 ×버튼 표시, 클릭으로 즉시 초기화

## [Round 149] — 2026-03-12
### Added
- NodeHierarchyList: 검색 결과 카운트 표시 — 검색 중 "N/total" 형태로 검색창 우측 표시, 결과 없을 시 warning 색상

## [Round 148] — 2026-03-12
### Added
- SceneView: 줌 인디케이터 클릭 → 1:1(100%) 리셋, 더블클릭 → Fit 전환 / cursor:pointer + tooltip 추가

## [Round 147] — 2026-03-12
### Added
- SceneView: 씬 해상도 레이블 — SVG 씬 경계 우상단에 "960 × 640" 텍스트 표시, 줌에 무관하게 일정 크기 유지

## [Round 146] — 2026-03-12
### Added
- SceneInspector: 부모 노드 표시 — 헤더 아래 "in: ParentName" 클릭 시 부모 선택
### Fixed
- SceneViewPanel: handleInspectorUpdate dep 배열에 port 추가 — stale closure 수정

## [Round 145] — 2026-03-12
### Fixed
- SceneView: passive wheel 이벤트 → `addEventListener('wheel', fn, {passive:false})` 로 교체, `preventDefault` 정상 동작

## [Round 144] — 2026-03-12
### Added
- SceneViewPanel: 단축키 도움말 오버레이 — ? 키로 토글, 클릭으로 닫기, 전체 단축키 목록 표시

## [Round 143] — 2026-03-12
### Added
- NodeHierarchyList: 전체 펼치기(▾▾) / 전체 접기(▸▸) 버튼 — 검색창 우측 배치, 씬 전체 트리 즉시 토글

## [Round 142] — 2026-03-12
### Added
- NodeHierarchyList: 활성 인디케이터 dot — 각 노드 행 앞에 녹색(active)/회색(inactive) dot 클릭으로 즉시 토글
- SceneViewPanel: handleHierarchyToggleActive → updateNode + ccSetProperty('active') 연결

## [Round 141] — 2026-03-12
### Added
- SceneViewPanel: 노드 호버 툴팁 — 마우스 오버 시 컴포넌트 아이콘 + 노드 이름 툴팁 표시 (드래그·리사이즈 중 자동 숨김)

## [Round 140] — 2026-03-12
### Added
- SceneInspector: Color 섹션 — 노드 색상 RGBA 스왓치 + hex 코드 표시, alpha != 255 시 α% 표시

## [Round 139] — 2026-03-12
### Added
- NodeHierarchyList: 컴포넌트 아이콘 표시 — getComponentIcon(utils.ts) 연동, 트리·검색 결과 모두 노드명 앞에 B/T/S/L/V/E/P/G/C 아이콘 accent 색상 표시

## [Round 138] — 2026-03-12
### Added
- SceneInspector: Opacity 섹션 — UIOpacity 컴포넌트 있을 때만 표시, NumInput(α) 편집

## [Round 137] — 2026-03-12
### Added
- SceneInspector: Scale 섹션 추가 — scaleX(Sx)/scaleY(Sy) NumInput 편집 (decimals=2)

## [Round 136] — 2026-03-12
### Added
- SceneViewPanel: handleFocusSelected() — 선택 노드 중심으로 카메라 이동 + 줌 조정
- SceneViewPanel: G키 단축키 → handleFocusSelected (선택 노드 없으면 handleFit 대체)

## [Round 135] — 2026-03-12
### Added
- NodePropertyPanel: COMP_EDITABLE_KEYS 5종 추가 — cc.Slider(progress/totalLength), cc.Toggle(isChecked), cc.ProgressBar(progress/reverse), cc.ScrollView(horizontal/vertical/inertia), cc.Animation(speed)

## [Round 134] — 2026-03-12
### Added
- NodeHierarchyList: focusUuid prop — 선택 노드 변경 시 계층 패널 자동 스크롤 (scrollIntoView)
- NodeHierarchyList: 노드 행에 data-uuid 속성, scrollContainerRef로 DOM 쿼리
- SceneViewPanel: NodeHierarchyList에 focusUuid={selectedUuid} 전달

## [Round 133] — 2026-03-12
### Added
- SceneToolbar: "Aa" 라벨 토글 버튼 (showLabels/onLabelsToggle prop)
- NodeRenderer: showLabel prop (기본 true) — false 시 노드 이름 텍스트 숨김
- SceneViewPanel: showLabels 상태 + NodeRenderer에 showLabel={showLabels} 전달

## [Round 132] — 2026-03-12
### Added
- SceneViewPanel: cursorScenePos 상태 — handleMouseMove에서 svgToScene 변환 후 씬 좌표 실시간 추적
- SceneViewPanel: 마우스 씬 좌표 오버레이 (우측 하단, 줌 표시 왼쪽) — 드래그/리사이즈 중 숨김

## [Round 131] — 2026-03-12
### Added
- NodeHierarchyList: 노드 접기/펼치기 — ▸/▾ 토글 버튼 클릭으로 자식 노드 숨기기/표시
- NodeHierarchyList: collapsed Set 상태 관리, 이름 클릭(선택)과 화살표 클릭(토글) 분리

## [Round 130] — 2026-03-12
### Added
- SceneViewPanel: isDragging / isResizing 상태 추적 (dragRef/resizeRef 시작·종료 시 설정)
- SceneViewPanel: 드래그 중 `X: n  Y: n`, 리사이즈 중 `W: n  H: n` 오버레이 (좌측 하단, 파란색)

## [Round 129] — 2026-03-12
### Added
- NodeHierarchyList: 노드 검색 입력창 — 이름 기반 실시간 필터링 (대소문자 무관)
- NodeHierarchyList: 검색 시 flat 목록으로 전환, 검색 결과 없음 메시지, 높이 150px로 확장

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
