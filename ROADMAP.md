# Claude Desktop — 개발 로드맵

> 마지막 업데이트: 2026-03-13 (Round 235 완료 — SceneView 노드 잠금 Alt+L + 🔒 아이콘, Pass 253)

## 완료된 라운드

| 라운드 | 브랜치 | 주요 작업 | 상태 |
|--------|--------|-----------|------|
| Round 1~60 | main | 초기 개발 (60라운드) | ✅ |
| Round 61 | main | 보안(Shell Injection 수정)/안정성/성능/디자인 Critical 수정 | ✅ |
| Round 62 | main | 안정성(session 검증/IPC cleanup/debounce) + 디자인 Quick Wins + 성능 최적화 | ✅ |
| Round 63 | main | SDK 전수 파싱(16타입) + 메시지 버블 차별화 + 스트리밍 애니메이션 | ✅ |
| Round 64 | feature/cocos-integration | CC WebSocket Extension (2.x/3.x) | ✅ |
| Round 65 | feature/cocos-integration | claude-desktop CC 패널 (SceneTree/Property/WebPreview) | ✅ |
| Round 66 | feature/cocos-integration | Claude 자연어 씬 편집 연동 (컨텍스트 주입/액션 파서) | ✅ |
| Round 67 | feature/cocos-integration | QA 자동화 + 전체 검수 + Critical/Warning 수정 | ✅ |
| Round 68 | feature/cocos-integration | CC UX 완성 (프로젝트 자동감지/재연결 UI/포트 저장/debounce) | ✅ |
| Round 69 | feature/cocos-integration | Adaptive Thinking 시각화 + ThinkingPanel + ToolUse 입력 포맷터 | ✅ |
| Round 70 | feature/cocos-integration | HQ Mode Phase 1 — TitleBar/AgentBay/ResourceBar/OpsFeed 쉘 + hq.css | ✅ |
| Round 71 | feature/cocos-integration | HQ Mode Phase 2 — AgentCard 4종 상태 애니메이션 (idle/active/tool_running/error) | ✅ |
| Round 72 | feature/cocos-integration | HQ Mode Phase 3 — ResourceBar 라이브 git/memory + OpsFeed 자동스크롤/입력요약 | ✅ |
| Round 73 | feature/cocos-integration | HQ Mode Phase 4 — Ctrl+Shift+H 단축키 + 트랜지션 폴리싱 + CSS 변수 | ✅ |
| Round 74 | main | 대화 UX 고도화 — 메시지 검색(Ctrl+F) + 결과 하이라이트/점프, 코드블록 복사/실행 버튼 개선 | ✅ |
| Round 75 | main | 대화 브랜치 UI — forkedFrom 인덱스 저장, SessionList forkMap + ⎇ 배지 + 들여쓰기 트리 렌더링 | ✅ |
| Round 76 | main | Monaco Editor 통합 — FileViewer 코드뷰/편집 Monaco 교체, 내장 검색/미니맵/goto줄, 1000→561줄 간소화 | ✅ |
| Round 77 | main | QA + 안정성 — Critical 4건 수정(forkMap 순환참조/save forkedFrom/defaultValue/import 순서), ws 패키지 추가, SyntaxHighlighter import 경로 수정, 빌드 성공 | ✅ |
| Round 78 | main | 코드 편집기 Phase 2 — 인라인 AI 어시스턴트(선택 영역 설명/수정 패널), Monaco DiffEditor로 DiffPanel 교체(나란히/인라인 뷰 토글) | ✅ |
| Round 79 | main | 터미널 + AI 연동 — 출력 캡처/에러 감지 배너/Claude 분석 버튼, App 채팅 연결 | ✅ |
| Round 80 | main | 프로젝트 인텔리전스 — analyzeProject(파일구조→시스템프롬프트), command-learner(명령어 학습/추천), useProjectContext 훅 | ✅ |
| Round 81 | main | AI 워크플로우 고도화 — AgentPanel 3탭 리빌드(태스크/체이닝/히스토리), PromptChainPanel({{stepN}} placeholder 체이닝), work-history.ts | ✅ |
| Round 82 | main | QA + Phase 3 마무리 — QA 스크립트 cocos 탭 체크 수정, npm run qa Critical 0/Warning 0, handoff.md 갱신 | ✅ |
| Round 83 | dev | 사용자 정의 시스템 프롬프트 UI + InputBar 실시간 토큰 카운터 + 메시지 토큰 표시 + 컨텍스트 윈도우 진행 바 | ✅ |
| Round 84 | dev | CC 에셋 브라우저 — AssetBrowserPanel(검색/폴더토글/아이콘), /assets/tree 엔드포인트(3x/2x), IPC 레이어(AssetItem/AssetTree) | ✅ |
| Round 85 | dev | CC 컴포넌트 인스펙터 고도화 — NodePropertyPanel 콜랩서블 섹션, enrichNode compProps 추출, CCNode.components[].props 타입 | ✅ |
| Round 86 | dev | 월별 비용 추적 — cost-tracker.ts(localStorage 집계), App.tsx recordCost 연동, StatusBar 세션팝업 오늘/이번달 비용 표시 | ✅ |
| Round 87 | dev | 커맨드 팔레트 최근 실행 액션 — recent-action 타입, ⚡ 섹션 헤더, 최대 8개 recency 순 정렬, 실행 시 addRecentAction 저장 | ✅ |
| Round 88 | dev | PromptChain 템플릿 라이브러리 — 5개 프리셋(코드리뷰/디버깅/콘텐츠/번역/기능명세), 📚 버튼 토글, 가져오기로 체인 생성 | ✅ |
| Round 89 | dev | QA 강화 — scripts/qa.ts에 R83~88 신규 기능 5종 체크 추가, Pass 5→10, handoff.md 전체 갱신 | ✅ |
| Round 90 | dev | 파일 컨텍스트 패널 — useContextFiles hook(localStorage, IPC readFile), ChatPanel 📎 UI, system prompt 주입 | ✅ |
| Round 91 | dev | 네이티브 파일 다이얼로그 — fs:open-file-dialog IPC, preload openFileDialog, ChatPanel 📎 네이티브 피커 | ✅ |
| Round 92 | dev | StatsPanel API 비용 섹션 — cost-tracker 통합, 오늘/이번달 카드, 7일 비용 바 차트 | ✅ |
| Round 93 | dev | 스트리밍 배치 렌더링 최적화 — agent-bridge 16ms 배치, reconcileText, text_delta 실시간 렌더링 | ✅ |
| Round 94 | dev | AG-UI 이벤트 모델 — run_started/step_started/step_finished/run_finished, agui-store, RunTimeline 탭 | ✅ |
| Round 95 | dev | QA 강화 — R90~94 신규 기능 7종 체크 추가 (Pass 10→17), Critical 0 / Warning 0 | ✅ |
| Round 96 | dev | CC SceneView 다중 노드 선택 — Shift-click 멀티셀렉트, 마퀴 선택 rect, 배지/인스펙터 갱신 + CHANGELOG.md 생성 | ✅ |
| Round 97 | dev | Ollama 로컬 LLM 연동 — ollama-bridge.ts, IPC handlers, InputBar 모델 피커, ChatPanel 라우팅 | ✅ |
| Round 98 | dev | QA R96~97 기능 체크 추가 (Pass 17→21) + SceneView undo/redo 스택 (UndoEntry/Ctrl+Z/Y) | ✅ |
| Round 99 | dev | 멀티 AI 프로바이더 추상화 — AIProvider 인터페이스, openai-bridge.ts, SettingsPanel API Key UI | ✅ |
| Round 100 | dev | QA R98~99 체크 추가 (Pass 21→26) + 핸드오프 갱신 | ✅ |
| Round 101 | dev | 메모리 누수 수정 (bridge addEventListener) + SceneView 노드 복사/붙여넣기 (Ctrl+C/V) + CHANGELOG 갱신 | ✅ |
| Round 102 | dev | QA R101 체크 (Pass→29) + SceneInspector 노드 가시성 토글 + ccSetProperty port 버그 수정 | ✅ |
| Round 103 | dev | 전체 세션 메시지 검색 — session:searchAll IPC, GlobalSearchResult 타입, GlobalSearchPanel, Sidebar 탭 | ✅ |
| Round 104 | dev | QA R102~103 체크 (Pass→32) + SceneView Z-order (⬆⬆⬆⬇⬇ 버튼) + CC extension /node/:uuid/zorder 엔드포인트 | ✅ |
| Round 105 | dev | CC 2x Extension Z-order 고도화 (scene-script setNodeZOrder + /zorder 라우트) + QA Section 12 (Pass→34) | ✅ |
| Round 106 | dev | InputBar 빠른 액션 슬롯 — 4개 프리셋 버튼 (요약/코드리뷰/설명/계속), 우클릭 편집, localStorage 저장 | ✅ |
| Round 107 | dev | QA R106~107 체크 (Pass→36) + ChatPanel 세션 자동 제목 + SceneTreePanel 노드 이름 검색 | ✅ |
| Round 108 | dev | CC SceneTree 노드 인라인 이름 편집 — 더블클릭 편집, 3x/2x name property 지원 | ✅ |
| Round 109 | dev | QA R108~109 체크 (Pass→38) + 스트리밍 경과 시간 표시 + CC 노드 생성/삭제 (POST /scene/new-node, DELETE /node/:uuid) | ✅ |
| Round 110 | dev | NodePropertyPanel 색상 스왓치/Vec2/Vec3/Boolean 디스플레이 고도화 + QA 색상 스왓치 체크 수정 (Pass→40) | ✅ |
| Round 111 | dev | StatsPanel 고도화 — 전체 메시지 수/일별 메시지 차트/TOP 5 세션, globalStats IPC 확장 (Pass→43) | ✅ |
| Round 112 | dev | NodePropertyPanel 슬라이더 PropRow — Opacity(0~255)/Rotation(-180~180) range input + 숫자 입력 연동 (Pass→46) | ✅ |
| Round 113 | dev | 메시지 재생성 이력 보존 — alternatives[] 저장, saveAlternative/setAltIndex, ◂ N/M ▸ 네비게이션 (Pass→48) | ✅ |
| Round 114 | dev | CC 색상피커 — ComponentSection color swatch 클릭 시 native color picker, CC 3x extension color key 지원 (Pass→50) | ✅ |
| Round 115 | dev | 세션 커스텀 텍스트 태그 — allCustomTags 자동완성, handleAddCustomTag, filterCustomTag 필터 칩 (Pass→52) | ✅ |
| Round 116 | dev | QA 통합 검수 + CHANGELOG R110~115 갱신 (Pass 52 유지) | ✅ |
| Round 117 | dev | SceneView 멀티셀렉트 그룹 드래그 — DragState groupOffsets, 선택 노드 동시 이동 + undo/redo (Pass→54) | ✅ |
| Round 118 | dev | SceneView 그룹 bbox 점선 박스 — 멀티셀렉트 시 노드 둘레 황색 점선 bbox 렌더링 (Pass→55) | ✅ |
| Round 119 | dev | InputBar 멀티라인 auto-resize (text useEffect) + Shift+Enter 힌트 + 문자/줄 수 표시 (Pass→57) | ✅ |
| Round 120 | dev | QA 통합 + CHANGELOG R117~119 갱신 (Pass 57 유지) | ✅ |

## 진행 예정 라운드

| 라운드 | 브랜치 | 주요 작업 |
|--------|--------|-----------|
| Round 121 | dev | CC Extension 노드 컴포넌트 목록 개선 — cc.Label/cc.Sprite 등 주요 컴포넌트 props 추출 강화 | ✅ |
| Round 122 | dev | SessionList 날짜 그룹 헤더 — 오늘/어제/이번주/이번달/이전 섹션 구분 | ✅ |
| Round 123 | dev | SceneView 멀티셀렉트 정렬 도구 — 왼쪽/중앙/오른쪽/위/중앙/아래 정렬 버튼 6종 | ✅ |
| Round 124 | dev | SceneView 노드 리사이즈 핸들 — 모서리 드래그로 노드 크기 조절 | ✅ |
| Round 125 | dev | NodePropertyPanel 씬 동기화 — 선택 노드 자동 갱신 (WebSocket 이벤트 기반) | ✅ |
| Round 126 | dev | QA 통합 검수 + CHANGELOG 갱신 (R121~125) | ✅ |
| Round 127 | dev | SceneInspector 노드 이름 인라인 편집 — 더블클릭 rename + ccSetProperty | ✅ |
| Round 128 | dev | SceneView 노드 계층 트리 패널 — ≡ 버튼으로 토글, 재귀 트리 클릭 선택 | ✅ |
| Round 129 | dev | NodeHierarchyList 검색 필터 — 이름 기반 실시간 검색, flat 결과 뷰 | ✅ |
| Round 130 | dev | SceneView 드래그 좌표 오버레이 — 드래그 시 X/Y, 리사이즈 시 W/H 표시 | ✅ |
| Round 131 | dev | NodeHierarchyList 접기/펼치기 — ▸/▾ 클릭으로 자식 토글, 선택과 분리 | ✅ |
| Round 132 | dev | SceneView 마우스 씬 좌표 표시 — 커서 위치의 Cocos 씬 X/Y 실시간 표시 | ✅ |
| Round 133 | dev | SceneView 노드 라벨 표시 토글 — Aa 버튼으로 SVG 노드 이름 on/off | ✅ |
| Round 134 | dev | NodeHierarchyList 선택 노드 자동 스크롤 — focusUuid로 계층 패널 동기화 | ✅ |
| Round 135 | dev | NodePropertyPanel COMP_EDITABLE_KEYS 확장 — Slider/Toggle/ProgressBar/ScrollView/Animation | ✅ |
| Round 136 | dev | SceneView 선택 노드 포커스 — G키로 선택 노드 중심 카메라 이동 | ✅ |
| Round 137 | dev | SceneInspector Scale 편집 — scaleX/scaleY NumInput 섹션 추가 | ✅ |
| Round 138 | dev | SceneInspector Opacity 편집 — UIOpacity 있을 때 조건부 섹션 | ✅ |
| Round 139 | dev | NodeHierarchyList 컴포넌트 아이콘 — getComponentIcon(utils) 연동, 트리·검색 아이콘 표시 | ✅ |
| Round 140 | dev | SceneInspector Color 섹션 — RGBA 스왓치 + hex + alpha% 표시 | ✅ |
| Round 141 | dev | SceneView 노드 호버 툴팁 — 마우스 오버 시 컴포넌트 아이콘 + 이름 표시 | ✅ |
| Round 142 | dev | NodeHierarchyList 활성 dot 토글 — 녹/회색 dot 클릭으로 노드 active 즉시 전환 | ✅ |
| Round 143 | dev | NodeHierarchyList 전체 펼치기/접기 — ▾▾/▸▸ 버튼으로 씬 트리 전체 즉시 토글 | ✅ |
| Round 144 | dev | SceneView 단축키 도움말 — ? 키 오버레이, 전체 단축키 목록 + 클릭 닫기 | ✅ |
| Round 145 | dev | SceneView passive wheel 수정 — addEventListener({passive:false})로 preventDefault 정상화 | ✅ |
| Round 146 | dev | SceneInspector 부모 노드 표시 — "in: ParentName" 클릭 시 부모 노드 선택 + dep 수정 | ✅ |
| Round 147 | dev | SceneView 씬 해상도 레이블 — SVG 씬 경계 우상단에 "960 × 640" 표시, 줌 보정 폰트 크기 | ✅ |
| Round 148 | dev | SceneView 줌 인디케이터 클릭 → 1:1 리셋, 더블클릭 → Fit 전환 | ✅ |
| Round 149 | dev | NodeHierarchyList 검색 결과 카운트 — 검색창 우측 "N/total" 표시 | ✅ |
| Round 150 | dev | NodeHierarchyList 검색 X 버튼 — 검색어 있을 때 ×버튼 표시, 클릭으로 초기화 | ✅ |
| Round 151 | dev | SceneView 방향키 nudge — 선택 노드 1px / Shift+10px 이동, 단축키 도움말 갱신 | ✅ |
| Round 152 | dev | SceneView 선택 노드 size 레이블 — 단일 선택 시 bounding box 우상단 W×H 표시 | ✅ |
| Round 153 | dev | NodeHierarchyList 검색창 ESC 키 → 검색어 초기화 + 포커스 해제 | ✅ |
| Round 154 | dev | SceneInspector UUID 복사 버튼 — # 클릭 시 UUID 복사, ✓ 피드백 | ✅ |
| Round 155 | dev | SceneView 패닝 커서 — 이동 도구 grab, 패닝 중 grabbing 동적 전환 | ✅ |
| Round 156 | dev | SceneView 씬 원점 (0,0) 레이블 — 중앙 십자 우상단 SVG 텍스트 표시 | ✅ |
| Round 157 | dev | SceneInspector 컴포넌트 목록 아이콘 — 타입별 단일 문자 아이콘 accent 색상 표시 | ✅ |
| Round 158 | dev | SceneView Ctrl+A 전체 선택 — nodeMap 모든 노드 선택, 단축키 도움말 갱신 | ✅ |
| Round 159 | dev | SceneView 선택 노드 anchor point 마커 — 황색 ◇ polygon 표시 | ✅ |
| Round 160 | dev | SceneView Ctrl+D 복제 — 클립보드 유지, 20px 오프셋 복제 | ✅ |
| Round 161 | dev | SceneInspector 자식 노드 수 표시 — ↳N 형태, 부모/자식 정보 통합 | ✅ |
| Round 162 | dev | SceneView 균등 분포 배치 — 멀티셀렉트 3개↑ 수평(⊢⊣)/수직(⊤⊥) 균등 배치 | ✅ |
| Round 163 | dev | SceneView Space 키 임시 패닝 — Space 홀드로 grab 커서 패닝 모드 | ✅ |
| Round 164 | dev | SceneView 총 노드 수 표시 — 좌하단 "N개 노드", 멀티셀렉트 시 "· M 선택" 추가 | ✅ |
| Round 165 | dev | SceneInspector JSON 내보내기 — 노드 전체 정보 pretty JSON 클립보드 복사 | ✅ |
| Round 166 | dev | NodeHierarchyList 우클릭 컨텍스트 메뉴 — 선택/복사/활성화 (이벤트 위임) | ✅ |
| Round 167 | dev | SceneInspector Scale 비율 유지 잠금 — ∝ 버튼으로 Sx/Sy 연동 | ✅ |
| Round 168 | dev | SceneView 선택 노드 회전 핸들 — 오렌지 원형 핸들 드래그로 rotation 변경 | ✅ |
| Round 169 | dev | SceneInspector 컬러 피커 — 스워치 클릭 → native color picker, 즉시 반영 | ✅ |
| Round 170 | dev | SceneView 노드 더블클릭 → Inspector 이름 편집 포커스 자동 전환 | ✅ |
| Round 171 | dev | SceneView SVG 우클릭 컨텍스트 메뉴 — 선택/복사/붙여넣기/복제/삭제 | ✅ |
| Round 172 | dev | SceneInspector Size W/H 비율 잠금 — ∝ 버튼으로 W/H 연동 | ✅ |
| Round 173 | dev | 코드 블록 라인 번호 — 4줄 이상 시 showLineNumbers 자동 표시 | ✅ |
| Round 174 | dev | SceneToolbar 줌 레벨 더블클릭 인라인 편집 — 10%~800% 범위 직접 입력 | ✅ |
| Round 175 | dev | SceneInspector 자식 노드 목록 — ↳N 클릭으로 펼치기/접기, 클릭 선택 | ✅ |
| Round 176 | dev | SceneView 드래그/리사이즈 중 선택 노드 x,y,w,h 실시간 정보 표시 | ✅ |
| Round 177 | dev | SceneView 배경 밝기 토글 — ◑ 버튼으로 체크패턴 어두운/밝은 전환 | ✅ |
| Round 178 | dev | SceneView Alt+↑/↓ 계층 탐색 — 부모/첫자식 노드로 선택 이동 | ✅ |
| Round 179 | dev | SceneInspector Position ⊙ 리셋 버튼 — X,Y를 (0,0)으로 즉시 초기화 | ✅ |
| Round 180 | dev | SceneInspector Rotation ⊙ 리셋 버튼 — rotation을 0으로 즉시 초기화 | ✅ |
| Round 181 | dev | SceneInspector Scale ⊙ 리셋 버튼 — scaleX,Y를 1로 즉시 초기화 | ✅ |
| Round 182 | dev | SceneInspector Anchor ⊙ 리셋 버튼 — anchorX,Y를 0.5로 즉시 초기화 | ✅ |
| Round 183 | dev | SceneInspector 조상 Breadcrumb — 전체 부모 체인 클릭 가능한 경로로 표시 | ✅ |
| Round 184 | dev | SceneView 미니맵 오버레이 — 우하단 전체 씬 축소 맵 + 뷰포트 표시 + 토글 | ✅ |
| Round 185 | dev | SceneView 미니맵 클릭 네비게이션 — 클릭 시 뷰포트 이동, 더블클릭 숨기기 | ✅ |
| Round 186 | dev | SceneToolbar ⊡ 미니맵 토글 버튼 — 툴바에서 미니맵 표시/숨기기 직접 제어 | ✅ |
| Round 187 | dev | SceneView 회전 각도 오버레이 — 회전 드래그 중 중앙에 현재 각도 실시간 표시 | ✅ |
| Round 188 | dev | SceneView 다중 선택 bounding box — 선택 노드 전체를 감싸는 파란 점선 박스 | ✅ |
| Round 189 | dev | SceneView Ctrl+←→ 회전 단축키 — 1°/10° 단위 키보드 회전, 도움말 업데이트 | ✅ |
| Round 190 | dev | SceneInspector Color 알파 슬라이더 — range input으로 α 0~255 실시간 편집 | ✅ |
| Round 191 | dev | SceneView M키 미니맵 토글 + 단축키 도움말 업데이트 (Del/Backspace 추가) | ✅ |
| Round 192 | dev | SceneView 원점(0,0) 십자선 가이드 — 그리드 활성 시 좌표 원점 파란 점선 십자선 | ✅ |
| Round 193 | dev | SceneView N키 빠른 노드 생성 단축키 + 도움말 업데이트 | ✅ |
| Round 194 | dev | CalendarPanel 오늘 버튼 + 세션 수 통계 (전체/이번 달) | ✅ |
| Round 195 | dev | ClipboardPanel 검색 필터 — 텍스트/소스 실시간 검색 + Esc 초기화 | ✅ |
| Round 196 | dev | TasksPanel 인라인 편집 — 더블클릭으로 텍스트 편집, Enter 저장, Esc 취소 | ✅ |
| Round 197 | dev | SceneView Tab/Shift+Tab 형제 노드 순환 선택 | ✅ |
| Round 198 | dev | SceneView Ctrl+]/[ z-order 변경 — 부모 childUuids 배열에서 노드 순서 이동 | ✅ |
| Round 199 | dev | NodeHierarchyList 인라인 이름 편집 — 더블클릭/컨텍스트메뉴, Enter 저장 | ✅ |
| Round 200 | dev | SceneView Ctrl+G 그룹화 — 다중 선택 노드를 Group 부모로 묶기, upsert 지원 | ✅ |
| Round 201 | dev | SceneView N/E/S/W 측면 리사이즈 핸들 — 단일 축 크기 조절 (파란 핸들) | ✅ |
| Round 202 | dev | SceneView 픽셀 눈금자 — R 키 토글, 상단/좌측 Cocos 좌표 눈금자, 줌 반응형 틱 | ✅ |
| Round 203 | dev | SceneView 노드 잠금 — 🔒 아이콘 토글, 잠긴 노드 드래그/선택 방어 | ✅ |
| Round 204 | dev | SceneInspector 노드 메모 — 텍스트 메모 입력, Enter 저장, 노드 전환 자동 초기화 | ✅ |
| Round 205 | dev | NotesPanel 📝 — 사이드바 자유 메모장, 다중 노트 생성/편집/삭제, localStorage | ✅ |
| Round 206 | dev | SceneView 정렬 가이드라인 — 드래그 중 타 노드 경계/중앙 정렬 시 빨간 점선 + snap | ✅ |
| Round 207 | dev | SceneView 캔버스 크기 프리셋 — 툴바 드롭다운으로 DESIGN_W/H 동적 변경 | ✅ |
| Round 208 | dev | SceneView SVG 씬 내보내기 — ⬇ 버튼으로 씬 노드 레이아웃 SVG 다운로드 | ✅ |
| Round 209 | dev | SceneView 노드 가시성 토글 — 계층 트리 👁 아이콘으로 숨기기/표시 | ✅ |
| Round 210 | dev | SceneView Shift+리사이즈 비례 리사이즈 — 코너 핸들에서 aspect ratio 유지 | ✅ |
| Round 211 | dev | SceneView 씬 레이아웃 저장/로드 — 💾/📂 버튼, localStorage 저장·복원 | ✅ |
| Round 212 | dev | SceneView 씬 저장 슬롯 3개 — 슬롯 드롭다운, 전환 시 자동 저장 | ✅ |
| Round 213 | dev | SceneView 스냅 그리드 크기 조정 — 드롭다운으로 1~50px 선택 | ✅ |
| Round 214 | dev | SceneView 노드 태그 — Inspector 태그 추가/삭제, 계층 트리 tag: 필터 | ✅ |
| Round 215 | dev | SceneView 노드 라벨 색상 — Inspector 컬러 피커, SVG fill + 계층 인디케이터 반영 | ✅ |
| Round 216 | dev | SceneView 부모-자식 연결선 — ⤻ 토글 버튼, 계층 관계 반투명 점선 시각화 | ✅ |
| Round 217 | dev | SceneView 씬 통계 패널 — # 버튼 토글, 노드 상태 통계 오버레이 | ✅ |
| Round 218 | dev | SceneView Cocos에 적용 버튼 — Inspector에서 노드 위치/크기 Cocos Creator로 전송 | ✅ |
| Round 219 | dev | SceneView 하단 상태바 — 도구/줌/Snap/선택수, Space 패닝 힌트 | ✅ |
| Round 220 | dev | SceneView Ctrl+F 검색 하이라이트 — 매칭 노드 황색 점선 링, Esc 닫기 | ✅ |
| Round 221 | dev | SceneView LOD 렌더링 — 줌 레벨별 라벨/fill 숨김, 극소 노드 스킵 | ✅ |
| Round 222 | dev | SceneView 노드 이동 히스토리 — ↕ 버튼, 최근 20개 기록 팝업, 클릭 선택 | ✅ |
| Round 223 | dev | SceneView 컴포넌트 타입 필터 — 툴바 드롭다운, 미매칭 노드 dimmed 처리 | ✅ |
| Round 224 | dev | SceneView 노드 그룹 접기/펼치기 — Alt+클릭 toggle, collapsed 자식 숨김, ▶ 표시 | ✅ |
| Round 225 | dev | SceneView Focus Mode — Alt+Z 토글, 선택 노드 강조/나머지 dimmed, 툴바 버튼 | ✅ |
| Round 226 | dev | SceneView 검색 순환 네비게이션 — Enter 다음/Shift+Enter 이전, 현재/전체 카운트, 현재 항목 주황 강조 | ✅ |
| Round 227 | dev | SceneView 인라인 편집바 — 선택 노드 X/Y/W/H 캔버스 하단 인라인 편집, Enter 적용/Esc 취소 | ✅ |
| Round 228 | dev | SceneView 측정 도구 — Alt+M 토글, 드래그로 씬 좌표 거리/각도 측정, 오렌지 라인+수치 오버레이 | ✅ |
| Round 229 | dev | SceneView 참조 이미지 오버레이 — URL 입력, 투명도 슬라이더, 씬 경계 내 배치 | ✅ |
| Round 230 | dev | SceneView 즐겨찾기 — Ctrl+B 토글, ★ 캔버스 표시, 툴바 목록 팝업 빠른 선택 | ✅ |
| Round 231 | dev | SceneView 카메라 히스토리 — F/G 키 뷰 저장, Alt+←/→ 뒤로/앞으로 이동 (ref 기반) | ✅ |
| Round 232 | dev | SceneView PNG 내보내기 — SVG→Canvas→PNG 변환, scene.png 다운로드, 툴바 버튼 | ✅ |
| Round 233 | dev | SceneView Dirty 표시 — nodeMap 변경 시 상태바 "● 저장 안됨", saveToSlot 시 초기화 | ✅ |
| Round 234 | dev | SceneView 노드 크기 맞추기 — 선택 기준 노드 W/H/both 동일화, 툴바 ↔W/↕H/⊞ 버튼 | ✅ |
| Round 235 | dev | SceneView 노드 잠금 — Alt+L 단축키, 🔒 SVG 아이콘, 툴바 잠금 버튼, 드래그/리사이즈 차단 | ✅ |

## 전략 로드맵 (Phase)

### Phase 1 — 완료 ✅
- 보안/안정성 Critical 수정
- 성능 Quick Wins (번들 분리, 타이머 통합)
- 디자인 시스템 기반 (CSS 변수, WCAG AA)

### Phase 2 — 진행 중 🔄
- Claude SDK 활용 확대 (16개 타입 파싱 완료)
- CC 통합 (WebSocket Extension + 패널 + 자연어 편집)
- 시각 경험 (버블 차별화, 코드 헤더, 애니메이션)

### Phase 3 — 완료 ✅ (Round 74~82)
- 대화 UX 고도화 (메시지 검색, 대화 브랜치 fork UI)
- Monaco Editor 통합 + 인라인 AI 어시스턴트
- 터미널-AI 연동 (에러 자동 분석)
- 프로젝트 인텔리전스 (자동 시스템 프롬프트, 명령어 학습)
- Subagent 워크플로우 시각화 + Prompt 체이닝
- QA 라운드 x2 (Round 77, 82) ✅ Critical 0, Warning 0

### Phase 4 — 예정 (Round 83~90)
- 스트리밍 UX 완성: 자동 스크롤 제어, ▌ 커서 애니메이션, 배치 렌더링
- 채팅 인터랙션: 메시지 재생성(↺), 스트리밍 중단(■), 인라인 편집
- 세션 관리: 태그 시스템, 즐겨찾기 핀, 날짜별 그룹 헤더
- StatusBar: 실시간 토큰 카운터, API 비용 추산(세션/월별)
- 커맨드 팔레트: 최근 항목, AI 제안 명령어
- 알림/토스트 시스템: 성공/에러/정보 컴포넌트
- 키보드 단축키 오버레이 (? 키)
- PromptChain 템플릿 라이브러리
- AG-UI 이벤트 모델 기반 에이전트 실행 표준화

## QA 프로세스

매 라운드 완료 후 `npm run qa` 실행하여 검증.

---

## 트렌드 리서치 인사이트 (2026-03-12)

AI 데스크탑 앱 2025-2026 트렌드 조사 결과 우선 적용 항목:

| 항목 | 우선순위 | 적용 예정 라운드 |
|------|----------|-----------------|
| Tool call 타임라인 카드 UI (Cursor 2.0 패턴) | HIGH | Round 74 통합 |
| Inline diff 렌더링 (file write 변경 시각화) | HIGH | Round 78 |
| IPC 스트리밍 배치화 (토큰별 IPC 금지) | HIGH | Round 77 QA 시 |
| 에이전트 사이드바 (병렬 실행 시각화) | HIGH | Round 81 |
| AG-UI 이벤트 모델 (미래 호환성) | MEDIUM | Round 82+ |
| React 18 virtual scroll 추가 최적화 | MEDIUM | Round 77 |
| Cocos MCP 서버 (DaxianLee/cocos-mcp-server) | MEDIUM | CC 브랜치 검토 |
| DXT 플러그인 패키징 | LOW | 장기 검토 |

### Phase 4 트렌드 인사이트 (2026-03-12)

| 레퍼런스 | 패턴 | 적용 대상 |
|----------|------|-----------|
| **Cursor 2.0** — Inline Editing UX | 선택 텍스트 위에 플로팅 툴바 즉시 출현, 편집 제안을 인라인 diff로 시각화(수락/거절 원클릭), 파일 저장 없이 프리뷰 가능한 가상 편집 레이어 | Round 84 메시지 편집, Round 88 PromptChain 인라인 수정 |
| **GitHub Copilot Chat** — Regeneration + Stop | 각 응답 버블 하단에 ↺ 재생성 버튼 노출, 스트리밍 중 ■ Stop 버튼이 입력창 내부에 인라인 배치되어 UX 흐름 최소화, 재생성 시 이전 응답은 히스토리로 보존 | Round 84 재생성/중단 구현 |
| **Windsurf** — 세션 컨텍스트 시각화 | 대화 사이드바에 "Context Window" 진행 바 상시 표시, 세션 내 참조 파일·심볼 목록을 인라인 칩으로 시각화, 컨텍스트 초과 임박 시 자동 경고 토스트 | Round 86 StatusBar 토큰 카운터, Round 85 세션 태그 시스템 |
