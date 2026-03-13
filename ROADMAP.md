# Claude Desktop — 개발 로드맵

> 마지막 업데이트: 2026-03-13 (Round 499 완료 — YY3-1 씬뷰 F키 선택 노드 중앙 포커스)

## 완료된 라운드

| 라운드 | 브랜치 | 주요 작업 | 상태 |
|--------|--------|-----------|------|
| Round 414 | dev | CC 파일 기반 엔진 Phase A-1 (CC-버전감지): cc-version-detector.ts, CCFileProjectInfo/CCSceneNode 타입, cc-file-handlers IPC, preload 노출 | ✅ |
| Round 415 | dev | CC 파일 기반 엔진 Phase A-2 (CC-파서-2x/3x): cc-file-parser.ts, _trs TypedArray/UITransform 처리, CCSceneNode 트리 변환 | ✅ |
| Round 416 | dev | CC 파일 기반 엔진 Phase A-3 (CC-프로젝트-열기): useCCFileProject 훅, CocosPanel WS/파일 모드 토글, CCFileSceneTree UI | ✅ |
| Round 417 | dev | CC 파일 기반 엔진 Phase A-4 (CC-씬뷰-파일): CCFileSceneView SVG 렌더러, 팬/줌, 노드 타입별 색상, 앵커 표시 | ✅ |
| Round 418 | dev | SceneView QA Critical 수정: C-1/C-2 스냅샷 scene/preview 탭 필터, C-7 dragRef race condition, M-6 closeActiveFileTab 가드 | ✅ |
| Round 419 | dev | SceneView QA C-4/M-1 수정: groupBbox n.width(플랫구조), SceneViewPanel key={activeWsId} 워크스페이스 전환 초기화 | ✅ |
| Round 420 | dev | CC 파일 기반 Phase A-5 (cc-file-saver): temp→rename 원자적 저장, .bak 자동 백업, 2x/3x 패치 (euler↔quat, UITransform) | ✅ |
| Round 421 | dev | CC 파일 감시 (cc-file-watcher): chokidar v4, .fire/.scene/.prefab 필터, awaitWriteFinish, onChange 콜백 | ✅ |
| Round 422 | dev | CC 에셋 리졸버 (cc-asset-resolver): buildUUIDMap/.meta 전수 스캔/subMetas 처리, resolveTextureUrl(local://), extractReferencedUUIDs, preload API 노출 | ✅ |
| Round 423 | dev | QA 수정: [M-2/3/10] stale closure 의존성 배열 보완, [C-6] 3x designResolution 우선 추출, [M-8] unload listener 정리, [M-9] httpServer error 핸들러 | ✅ |
| Round 424 | dev | QA 수정: [M-4] handleDuplicate uuid 단일 생성, [M-12] 2x scene-script designResolution null 방어, [M-11] cc-bridge fetch timeout 추가 | ✅ |
| Round 425 | dev | QA 수정: [M-14] CC_GET_ASSETS port 기본값, [M-7] preview 탭 scene 인덱스 기반 삽입, [M-13] 워크스페이스 저장 scene/preview 필터링 | ✅ |
| Round 426 | dev | Phase B: CCFileNodeInspector 인스펙터 UI — position/rotation/scale/size/anchor/opacity/active 편집, blur→즉시 auto-save | ✅ |
| Round 427 | dev | Phase C: CCFileSceneView 드래그 이동 → saveCCScene 연동 (dragRef/dragOverride 주황 임시표시, mouseup→onMove→saveScene) | ✅ |
| Round 428 | dev | UX: externalChange 파일 외부 수정 감지 배너 + 다시 로드 버튼 | ✅ |
| Round 429 | dev | Phase C-1: 컴포넌트 props 편집 — CCSceneComponent._rawIndex 추가, 파서 rawIndex 채움, 저장 시 패치, 인스펙터 Label/string/fontSize 편집 UI | ✅ |
| Round 430 | dev | Phase B-3: 노드 이름 인라인 편집 (span→input, onBlur→applyAndSave) + cc-file-parser TS1230 타입 predicate 수정 | ✅ |
| Round 431 | dev | Phase D-1: 노드 삭제 — Inspector 삭제 버튼, patchNode _children 동기화 (삭제 시 raw refs 자동 갱신), 루트 보호 | ✅ |
| Round 432 | dev | Phase D-2: 노드 추가 — handleAddChild (2x/3x raw 엔트리 생성, sceneFile._raw mutation), saveScene 자동 재로드 + chokidar suppress, selectedNode uuid 동기화 | ✅ |
| Round 433 | dev | Phase B-4: undo/redo 스택 (50단계) — _saveRaw refs 기반 내부 저장, Ctrl+Z/Y 키바인딩, ↩/↪ 버튼 UI | ✅ |
| Round 435 | dev | Phase D-3: 프리팹 파싱 — resolveRootIdx (cc.Prefab.data ref), .prefab 파일 씬 목록 포함 | ✅ |
| Round 436 | dev | Phase D-4: 노드 계층 이동 — CCFileSceneTree drag&drop, 사이클 방지, 파란 드롭 하이라이트, onReparent → saveScene | ✅ |
| Round 437 | dev | Phase E-1: 씬뷰 SE 리사이즈 핸들 — resizeRef/resizeOverride, SE corner 핸들, onResize → saveScene size 업데이트 | ✅ |
| Round 438 | dev | Phase E-2/E-3: 씬뷰 100px 그리드+중앙 십자선, 노드 회전 SVG rotate() 적용 (CC Z-euler → SVG 부호 반전) | ✅ |
| Round 439 | dev | Phase E-4: 비활성 노드 반투명(opacity 0.2) 표시 + nodeOpacity = node.opacity/255 SVG 적용 | ✅ |
| Round 440 | dev | Phase F-1: Inspector 색상 에디터 — HTML color picker (RGB) + A 슬라이더, hex↔rgba 변환 | ✅ |
| Round 441 | dev | Phase F-2: 씬 트리 노드 검색 — TreeSearch 컴포넌트, 이름 부분 일치, 드롭다운 결과 최대 8개, 선택 시 Inspector 포커스 | ✅ |
| Round 442 | dev | Phase G-1: 컴포넌트 props 편집 — boolean checkbox, string textarea, number input 3분기, skipTypes 블랙리스트 전환 | ✅ |
| Round 443 | dev | Phase H-1: 씬뷰 Label 텍스트 렌더링 — cc.Label/Label/cc.RichText.string을 SVG text로, fontSize/color 적용 | ✅ |
| Round 444 | dev | Phase H-2: 씬뷰 Sprite 이미지 렌더링 — spriteFrame UUID → local:// URL 비동기 해상, SVG image 렌더링 | ✅ |
| Round 445 | dev | Phase G-2: Inspector UUID 레퍼런스 표시 — __uuid__ 타입 props를 읽기 전용 배지로 표시, hover 툴팁 full UUID | ✅ |
| Round 446 | dev | Phase I-1: 씬 트리 우클릭 컨텍스트 메뉴 — 자식 추가/복제/삭제, handleTreeDuplicate (얕은 복사+sibling 삽입) | ✅ |
| Round 447 | dev | Phase J-1: 씬뷰 키보드 단축키 — Delete(삭제), Ctrl+D(복제), Arrow(1px이동), Shift+Arrow(10px이동), 입력 포커스 시 무시 | ✅ |
| Round 448 | dev | Phase K-1: 씬뷰 배경색 — Camera.clearColor / Canvas.backgroundColor 파싱 → 씬 캔버스 배경 적용 | ✅ |
| Round 449 | dev | Phase L-1: 씬 트리 활성화 토글 — ●/○ 버튼, handleTreeToggleActive → saveScene, 비활성 노드 흐릿 표시 | ✅ |
| Round 450 | dev | Phase M-1: Inspector 벡터 props 편집 — {x,y}/{x,y,z} 타입 props를 2-3개 인라인 숫자 인풋으로 표시/편집 | ✅ |
| Round 451 | dev | Phase N-1: 씬 파일 드래그&드롭 열기 — .fire/.scene/.prefab 파일을 패널에 드롭하면 자동 로드 (Electron File.path) | ✅ |
| Round 452 | dev | Phase O-1: 씬 트리 헤더 통계 — 씬 파일명 옆에 N노드수/C컴포넌트수 즉시 표시 | ✅ |
| Round 453 | dev | Phase P-1: 씬뷰 선택 HUD — position/size/rotation 하단 오버레이, 노드명 우측 표시 | ✅ |
| Round 454 | dev | Phase Q-1: 씬 트리 컴포넌트 아이콘 — Sprite🖼/Label T/Button⊕/Canvas⊞ 등 타입별 아이콘, hover 전체 타입 표시 | ✅ |
| Round 455 | dev | Phase R-1: Ctrl+S 씬 저장 단축키 — 기존 키보드 핸들러에 Ctrl+S 추가, handleSave 연결 | ✅ |
| Round 456 | dev | Phase S-1: Inspector 섹션 접기/펼치기 — 위치/크기/회전, 앵커/불투명도, 색상 섹션별 ▸▾ 토글 | ✅ |
| Round 457 | dev | Phase T-1: Inspector maxHeight 420 확장 + 컴포넌트(N) 섹션 토글 추가 | ✅ |
| Round 458 | dev | Phase U-1: 노드 Ctrl+C/V 복사/붙여넣기 — clipboardRef 노드 저장, 붙여넣기 시 선택 노드 자식으로 추가 | ✅ |
| Round 459 | dev | Phase V-1: 씬뷰 Ctrl+드래그 10px 그리드 스냅 — mousemove에서 ctrlKey 감지, round(x/10)*10 스냅 | ✅ |
| Round 460 | dev | Phase W-1: 씬뷰 미니맵 오버레이 — zoom<0.8 시 우상단 80×60 미니맵, 노드 배치 + 뷰포트 박스 표시 | ✅ |
| Round 461 | dev | Phase X-1: 씬뷰 툴바 CC 버전 배지 — sceneFile.projectInfo.version 기반 CC 2.x/3.x 배지 표시 | ✅ |
| Round 462 | dev | Phase Y-1: 씬뷰 마우스 커서 씬 좌표 실시간 HUD — onMouseMove에서 ccX/ccY 계산, 좌하단 표시 | ✅ |
| Round 463 | dev | Phase Z-1: 씬뷰 노드 호버 하이라이트 — hoverUuid state, onMouseEnter/Leave, 흰 테두리 반투명 | ✅ |
| Round 464 | dev | Phase AA-1: Inspector 컴포넌트 ✕ 삭제 버튼 — 컴포넌트 헤더 우측 ✕ 클릭 → components 배열에서 제거 | ✅ |
| Round 465 | dev | Phase BB-1: 최근 씬 파일 목록 — localStorage 기반 최대 6개 저장, 안내 섹션에 빠른 재오픈 목록 표시 | ✅ |
| Round 466 | dev | Phase CC-1: 씬뷰 배경 더블클릭 Fit — onDoubleClick={handleFit} SVG에 바인딩 | ✅ |
| Round 467 | dev | Phase DD-1: Inspector 노드 경로 브레드크럼 — root→선택 노드 경로를 Inspector 헤더에 표시 | ✅ |
| Round 468 | dev | Phase EE-1: Inspector CC 3.x layer 비트 이름 표시 — layerNames 맵핑, DEFAULT/UI_2D 등 표시 | ✅ |
| Round 469 | dev | Phase FF-1: 씬뷰 그리드 표시 토글 버튼 — showGrid state, ⊹ 버튼 활성/비활성 강조 | ✅ |
| Round 470 | dev | Phase GG-1: 씬 트리 비활성 노드 숨기기 토글 — hideInactive prop, ●/◑ 버튼, active=false 노드 필터링 | ✅ |
| Round 471 | dev | Phase HH-1: 씬뷰 배경색 임시 오버라이드 — bgColorOverride state, color picker swatch, 더블클릭 초기화 | ✅ |
| Round 472 | docs | Phase II-1: PRD-CC-에디터-통합-Phase2.md 완료 기준 동기화 (Round 414-471 완료 항목 체크) | ✅ |
| Round 473 | dev | Phase JJ-1: Inspector 컴포넌트 추가 드롭다운 — `<details>` + 12개 컴포넌트 타입 배지, 클릭으로 즉시 추가 | ✅ |
| Round 474 | dev | Phase KK-1: 씬뷰 노드 SVG title 툴팁 — `<title>` 노드명 + 컴포넌트 타입 목록 | ✅ |
| Round 475 | dev | Phase LL-1: 씬 트리 헤더 비활성 노드 수 표시 — inactive 카운터, `(-N)` 서브텍스트 | ✅ |
| Round 476 | dev | Phase MM-1: Inspector 노드 복제 버튼 — handleDuplicate (형제로 삽입), 파란 "복제" 버튼 | ✅ |
| Round 477 | dev | Phase NN-1: 씬뷰 선택 노드 정렬 버튼 — HUD에 ⊙◁▷△▽ 버튼, onMove 호출로 중앙/좌/우/상/하 정렬 | ✅ |
| Round 478 | dev | Phase OO-1: 씬 트리 depth 레벨 세로 가이드 라인 — depth>0 노드에 borderLeft 반투명 라인 | ✅ |
| Round 479 | dev | Phase PP-1: Escape 키로 노드 선택 해제 — keydown handler에 Escape → onSelectNode(null) 추가 | ✅ |
| Round 480 | dev | Phase QQ-1: 씬뷰 줌% 클릭 시 1:1 리셋 — 줌 퍼센트 span → 클릭 가능 버튼, zoom=1 리셋 | ✅ |
| Round 481 | dev | Phase RR-1: 씬 트리 우클릭 메뉴 활성화/비활성화 — 동적 레이블, onToggleActive 호출 | ✅ |
| Round 482 | dev | Phase SS-1: Inspector 하단 씬 파일 정보 — 파일명/CC버전/creatorVersion 표시 | ✅ |
| Round 483 | dev | Phase TT-1: Inspector Z-order 이동 버튼 — handleZOrder(±1), 같은 부모 내 children 배열 swap | ✅ |
| Round 484 | dev | Phase UU-1: 씬뷰 캔버스 범위 밖 노드 반투명 표시 — isOutOfCanvas 감지, nodeOpacity × 0.4 적용 | ✅ |
| Round 485 | dev | Phase VV-2: 씬뷰 캔버스 외부 빗금 패턴 오버레이 — SVG defs hatch pattern + mask로 캔버스 영역 제외 | ✅ |
| Round 486 | dev | Phase WW-2: 씬뷰 선택 노드 치수 레이블 — 상단에 w×h SVG text 표시 (zoom > 0.3 시) | ✅ |
| Round 487 | dev | Phase YY-1: Inspector 컴포넌트 fold/unfold — collapsedComps Set state, ▸/▾ 헤더 토글, props body 조건부 렌더링 | ✅ |
| Round 488 | dev | Phase ZZ-1: 씬뷰 단축키 도움말 오버레이 — ? 버튼 툴바 추가, showHelp state, 9개 단축키 목록 오버레이 | ✅ |
| Round 489 | dev | Phase XX-1: Inspector 레이어 편집 드롭다운 — 9개 CC3.x 레이어 옵션, 미지원 값은 hex 표시 | ✅ |
| Round 490 | dev | Phase FF2-1: Inspector 앵커 9-point grid 프리셋 — 3×3 클릭 버튼, 현재 앵커 하이라이트 | ✅ |
| Round 491 | dev | Phase AA2-1: 씬뷰 Space 키 패닝 — isSpaceDownRef + window keydown/up, Space+좌클릭 드래그로 팬 | ✅ |
| Round 492 | dev | Phase JJ2-1: Inspector scale 비율 잠금 🔒 버튼 — lockScale state, X/Y 변경 시 비율 유지 연산 | ✅ |
| Round 493 | dev | Phase QQ2-1: Inspector 위치/회전 리셋 ↺ 버튼 — 위치 (0,0), 회전 0° 즉시 저장 | ✅ |
| Round 494 | dev | Phase RR2-1: 씬뷰 컴포넌트 색상 강화 — Button(주황)/ScrollView(청록)/EditBox(분홍)/Slider(보라) 색상 추가 | ✅ |
| Round 495 | dev | Phase SS2-2: 씬뷰 도움말 색상 범례 — ? 오버레이 하단에 컴포넌트 타입별 색상 점 범례 8개 | ✅ |
| Round 496 | dev | Phase TT2-1: 씬뷰 노드 이름 인라인 편집 — 더블클릭 → foreignObject input, Enter/Escape/blur → onRename 콜백 | ✅ |
| Round 497 | dev | Phase UU2-1: 씬뷰 높이 드래그 조절 — sceneViewHeight state, divider mousedown/move/up, 80~600px 범위 제한 | ✅ |
| Round 498 | dev | Phase ZZ3-1: 씬뷰 노드 이름 표시 토글 — showNodeNames state, T 버튼 툴바, 조건부 text 렌더링 | ✅ |
| Round 499 | dev | Phase YY3-1: 씬뷰 F키 선택 노드 포커스 — handleFitToSelected, window keydown F 핸들러, 미선택 시 Fit all | ✅ |
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
| Round 236 | dev | SceneView 태그 필터 — 씬 내 태그 드롭다운, 선택 태그 없는 노드 dimmed 처리 | ✅ |
| Round 237 | dev | SceneView 노드 경로 브레드크럼 — Root→…→선택 노드 경로 상태바 위 표시, 클릭 선택 | ✅ |
| Round 238 | dev | SceneView G키 멀티셀렉트 bbox 줌 — 멀티셀렉트 시 bounding box에 맞춰 카메라 자동 맞춤 | ✅ |
| Round 239 | dev | SceneView H키 가시성 토글 + 컨텍스트 메뉴 확장 (숨기기/잠금/즐겨찾기) + 단축키 도움말 | ✅ |
| Round 240 | dev | SceneView 호버 툴팁 리치 정보 — pos/size/컴포넌트 목록·잠금·숨김 멀티라인 표시 | ✅ |
| Round 241 | dev | SceneView Alt+1~9 빠른 색상 레이블 — 9색 팔레트 키보드 지정, Alt+0 초기화 | ✅ |
| Round 242 | dev | SceneView 그룹 해제 — Ctrl+Shift+G 자식 노드 상위 레벨 이동, handleUngroup | ✅ |
| Round 243 | dev | SceneView 드래그 델타 오버레이 — 드래그 중 Δx/Δy 이동량 커서 옆 실시간 표시 | ✅ |
| Round 244 | dev | SceneView 연결선 개선 — cubic bezier 곡선 + 화살표 마커 (부모→자식 방향) | ✅ |
| Round 245 | dev | SceneView 인라인 편집바 rotation(R) 필드 — X/Y/W/H에 R 추가, 회전값 직접 편집 | ✅ |
| Round 246 | dev | SceneView 선택 반전 — Ctrl+Shift+A로 선택/비선택 상태 반전 | ✅ |
| Round 247 | dev | SceneView Alt+[/] 투명도 조절 — 선택 노드 opacity -10/+10 단축키 | ✅ |
| Round 248 | dev | NotesPanel 노트 검색 — 제목/내용 통합 검색 입력, 결과 수 N/전체 표시 | ✅ |
| Round 249 | dev | NotesPanel 정렬 — 최신/오래됨/제목순 순환 버튼 (cycleSortOrder) | ✅ |
| Round 250 | dev | SceneView 앵커 포인트 십자 마커 — 선택 노드 pivot 위치에 #a78bfa crosshair 오버레이 | ✅ |
| Round 251 | dev | SceneView I키 노드 정보 오버레이 — pos/size/rot/anchor/opacity/visible/locked 패널 | ✅ |
| Round 252 | dev | NotesPanel 핀 고정 — 📌 토글, 핀 노드 목록 상단 고정 + 황금 border | ✅ |
| Round 253 | dev | SceneView H키/Alt+L 다중 선택 일괄 — anyVisible/anyUnlocked 기준 가시성/잠금 일괄 토글 | ✅ |
| Round 254 | dev | SceneView 씬 통계 컴포넌트 분포 — 상위 5개 컴포넌트 타입별 사용 수 (topComps) | ✅ |
| Round 255 | dev | SceneView P키 부모 노드 선택 — selectedUuid의 parentUuid로 이동 | ✅ |
| Round 256 | dev | SceneView Alt 홀드 스냅 일시 비활성화 — 드래그 중 Alt키로 snapGrid 일시 무효화 | ✅ |
| Round 257 | dev | TasksPanel 마감일 기능 — dueDate 날짜 입력, 마감 초과 ⚠ 빨간 강조 (overdue) | ✅ |
| Round 258 | dev | NotesPanel 📤 Markdown 내보내기 — 전체 노트 notes-날짜.md 다운로드 | ✅ |
| Round 259 | dev | SceneView 드래그 고스트 박스 — 드래그 시작 위치에 반투명 파란 점선 박스 오버레이 | ✅ |
| Round 260 | dev | SceneView 다중 선택 bbox 중앙 마커 — 2개+ 선택 bounding box 중앙 + 십자 마커 | ✅ |
| Round 261 | dev | TasksPanel 진행률 바 — 완료/전체 비율 progressPct%, 100% 완료 시 초록색 | ✅ |
| Round 262 | dev | SceneView 호버 툴팁 memo 표시 — hn.memo 있을 때 📝 황색으로 메모 내용 출력 | ✅ |
| Round 330 | dev | GlobalSearchPanel 날짜순 정렬 토글 — 📅/⭐ 버튼으로 관련성/날짜순 전환 | ✅ |
| Round 331 | dev | OutlinePanel H레벨 카운트 표시 — H1(N) 형식, 0개 레벨 버튼 자동 숨김 | ✅ |
| Round 332 | dev | BookmarksPanel 북마크별 📋 복사 버튼 — 전체 텍스트 클립보드 복사, 1.5초 ✓ 피드백 | ✅ |
| Round 333 | dev | RunTimeline RunCard 스텝 접기/펼치기 — 4개↑ 시 기본 접힘, 진행 중 런은 항상 펼침 | ✅ |
| Round 334 | dev | StatsPanel 새로고침 버튼 — 세션 통계/비용 재로드, refreshing 스피너 표시 | ✅ |
| Round 335 | dev | TasksPanel 기한 초과 필터 배지 — ⚠ 초과 N 빨간 버튼, 토글 클릭으로 overdue만 표시 | ✅ |
| Round 336 | dev | WebPreviewPanel ← → 뒤로/앞으로 탐색 — URL 히스토리 스택 관리, 비활성 시 회색 | ✅ |
| Round 337 | dev | PluginsPanel 검색 필터 — 3개↑ 시 표시, 이름/설명/작성자 대상 실시간 필터 | ✅ |
| Round 338 | dev | AssetBrowserPanel 타입 필터 칩 — script/prefab/texture 등, 검색과 AND 조합 | ✅ |
| Round 339 | dev | SearchPanel 파일 그룹 ▾/▸ 접기/펼치기 — 매치 목록 숨김/표시, 접힘 시 매치 수 표시 | ✅ |
| Round 340 | dev | DiffPanel 최근 비교 히스토리 — localStorage 저장(8개), 🕐 드롭다운으로 재사용 | ✅ |
| Round 341 | dev | CocosPanel 연결 유지 시간 — connectedAt 기록, 배지에 uptime(Ns/Nm/NhNm) 표시 | ✅ |
| Round 403 | dev | BookmarksPanel 정렬 토글 — sortOrder(기본/최신/오래된), ↕/🔽/🔼, ESC 초기화 | ✅ |
| Round 402 | dev | WebPreviewPanel 줌 컨트롤 — zoom, +/-/% 버튼, 0.5x-2.0x 단계별 스케일 | ✅ |
| Round 401 | dev | ConnectionPanel 서버 검색 필터 — serverSearch, 3개 초과 시 검색 입력, ESC 초기화 | ✅ |
| Round 400 | dev | NotesPanel 노트 템플릿 — showTemplates, ✦ 버튼, 4종 프리셋(미팅/할일/버그/아이디어) | ✅ |
| Round 399 | dev | SearchPanel 단어 단위 검색 — wholeWord, Ww 토글, \b 정규식 매칭 | ✅ |
| Round 398 | dev | CalendarPanel 이벤트 목록 복사 — eventsCopied, 다음 이벤트 📋 버튼 | ✅ |
| Round 397 | dev | AgentPanel 태스크 결과 복사 — copiedResultId, 결과 영역 📋 버튼 | ✅ |
| Round 396 | dev | GitPanel 커밋 해시 복사 — copiedCommitHash, 로그 각 커밋 📋 버튼 | ✅ |
| Round 395 | dev | DiffPanel diff 결과 요약 복사 — diffCopied, 📋 버튼, 파일명+통계 텍스트 | ✅ |
| Round 394 | dev | ClipboardPanel 핀 보호 스마트 삭제 — 핀 있으면 비핀만 삭제, 핀 카운트 배지 | ✅ |
| Round 393 | dev | FileTree 파일 검색 결과 카운트 — N개 파일/파일 없음 표시, ESC 초기화 | ✅ |
| Round 392 | dev | CocosPanel 프로젝트 경로 복사 — pathCopied, 프로젝트명 옆 📋, currentPath 복사 | ✅ |
| Round 391 | dev | SnippetPanel 내용 펼치기 — expandedSnippetId, ▼/▲ 토글, 120자 초과 시 표시 | ✅ |
| Round 390 | dev | ChangedFilesPanel 전체 경로 복사 — copiedAll, 헤더 📋 버튼, 경로 줄바꿈 복사 | ✅ |
| Round 389 | dev | SearchPanel 검색 결과 전체 복사 — resultsCopied, 파일경로+L행+내용 형식 클립보드 복사 | ✅ |
| Round 388 | dev | GlobalSearchPanel 발췌 복사 — copiedResultKey 상태, 📋 버튼, excerpt 클립보드 복사 | ✅ |
| Round 387 | dev | SceneTreePanel 검색 매치 카운트 — countMatches 재귀, N개 일치/없음 표시, Esc 초기화 | ✅ |
| Round 386 | dev | RemotePanel SSH 명령어 복사 — copiedHost, copyCmd, ssh [-p] user@host 형식 복사 | ✅ |
| Round 385 | dev | OutlinePanel 개별 헤딩 복사 — hover 📋, copiedItemKey, "#".repeat(level) 포함 복사 | ✅ |
| Round 384 | dev | TasksPanel 태스크 텍스트 복사 — 각 행 📋 버튼, copiedTaskId 상태, 제목 클립보드 복사 | ✅ |
| Round 383 | dev | RunTimeline RunCard 런 로그 복사 — logCopied, copyLog 콜백, 스텝 이름/상태/시간 텍스트 | ✅ |
| Round 382 | dev | StatsPanel 통계 요약 복사 — 📋 버튼, statsCopied, 세션/메시지/토큰/비용/스트릭 텍스트 | ✅ |
| Round 381 | dev | AssetBrowserPanel 전체 펼치기/접기 — ⊞/⊟ 버튼, getAllFolderPaths 재귀, allExpanded 계산 | ✅ |
| Round 380 | dev | ConnectionPanel 서버 명령어 복사 — 각 행 📋 버튼, copiedServerIdx, command+args 클립보드 | ✅ |
| Round 379 | dev | WebPreviewPanel URL 방문 기록 드롭다운 — uniqueHistory(중복제거), showHistory, 🕐N 버튼 | ✅ |
| Round 378 | dev | DiffPanel 언어 오버라이드 — langOverride 상태, 자동+10개 언어 select, lang 연산에 우선 적용 | ✅ |
| Round 377 | dev | BookmarksPanel 전체 북마크 복사 — copiedAll 상태, 📋 버튼, 필터된 북마크 마크다운 복사 | ✅ |
| Round 376 | dev | PluginsPanel 전체 켜기/끄기 버튼 — allEnabled 조건 일괄 saveEnabled | ✅ |
| Round 375 | dev | NotesPanel 검색 결과 콘텐츠 발췌 — 검색어 위치 주변 발췌 이탤릭 인라인 표시 | ✅ |
| Round 374 | dev | SceneTreePanel 컴포넌트 초과 +N — 2개 초과 시 components.length - 2 배지 | ✅ |
| Round 373 | dev | ChangedFilesPanel 파일 경로 복사 — copiedPath 상태, 📋 버튼, 1.5s ✓ 피드백 | ✅ |
| Round 372 | dev | RemotePanel 섹션 레이블 호스트 수 배지 — SSH Config/저장된 호스트 섹션에 filteredN 카운트 | ✅ |
| Round 371 | dev | ClipboardPanel 항목 텍스트 확장 — expandedId 상태, 120자 초과 항목 "▼ 펼치기/▲ 접기" 버튼 | ✅ |
| Round 370 | dev | CalendarPanel 다음 이벤트 더 보기 — 3개 초과 시 showAllUpcoming 토글, "더 보기/접기" 버튼 | ✅ |
| Round 369 | dev | SnippetPanel 카테고리 칩 스니펫 수 — 각 카테고리 버튼에 (N) 카운트 배지 | ✅ |
| Round 368 | dev | GlobalSearchPanel 검색 기록 삭제 — 항목별 × 버튼, 헤더 "전체 삭제" 버튼 | ✅ |
| Round 367 | dev | CocosPanel 빠른 포트 선택 버튼 — 포트 입력 옆 9090(CC 2.x)/9091(CC 3.x) 버튼, 현재 포트 강조 표시 | ✅ |
| Round 366 | dev | RunTimeline 진행 중 런 필터 — showOnlyActive 상태, ⟳ 토글 버튼, shownRuns 계산 | ✅ |
| Round 365 | dev | ConnectionPanel 설정 파일 경로 복사 — cfgCopied 상태, 푸터 📋 버튼 | ✅ |
| Round 364 | dev | WebPreviewPanel URL 복사 버튼 — urlCopied 상태, 📋 버튼, 클립보드 복사 | ✅ |
| Round 363 | dev | AssetBrowserPanel 타입 카운트 — 필터 칩에 typeCounts로 에셋 수 표시 | ✅ |
| Round 362 | dev | PluginsPanel 코드 복사 버튼 — 코드 뷰 헤더 📋 버튼, copiedCode 상태, 1.5s 피드백 | ✅ |
| Round 361 | dev | BookmarksPanel 미리보기 확장 토글 — ▼/▲ 버튼, expandedId 상태, 전체 텍스트 인라인 표시 | ✅ |
| Round 360 | dev | TasksPanel 전부 완료 버튼 — 활성 태스크 존재 시 "✓ 전부" 버튼, tasks.map done:true | ✅ |
| Round 359 | dev | SearchPanel 전체 접기/펼치기 — 결과 요약 바 ⊖/⊕ 버튼, 파일 그룹 일괄 접기/펼치기 | ✅ |
| Round 358 | dev | StatsPanel 히트맵 요일 레이블 — 히트맵 좌측 일/화/목/토 레이블, GitHub 스타일 | ✅ |
| Round 357 | dev | OutlinePanel 역순 정렬 토글 — ↓/↑ 버튼, reversed 상태, 최신 헤딩 먼저 표시 | ✅ |
| Round 356 | dev | DiffPanel diff 통계 표시 — getLineChanges()로 추가/삭제 라인 수 계산, 통계 바 렌더링 | ✅ |
| Round 355 | dev | FileTree 숨김 파일 토글 — 헤더 `.` 버튼, hideHidden 상태, `.`으로 시작하는 항목 필터링 | ✅ |
| Round 354 | dev | NodePropertyPanel 노드 활성화 토글 — ●/○ 버튼, ccSetProperty('active') 직접 호출 | ✅ |
| Round 353 | dev | SceneTreePanel 비활성 노드 숨기기 — "비활성 N" 배지 버튼으로 토글, filterTree로 즉시 필터 | ✅ |
| Round 352 | dev | PromptChainPanel 결과 복사 — 스텝 결과에 📋 복사 버튼, 복사 시 ✓ 피드백 | ✅ |
| Round 351 | dev | GlobalSearchPanel 검색 히스토리 — 최근 검색어 5개 저장, 포커스 시 드롭다운, 클릭 재검색 | ✅ |
| Round 350 | dev | AgentPanel 태스크 검색 필터 — 태스크 검색 입력창, 이름/프롬프트 대상 실시간 필터 | ✅ |
| Round 349 | dev | ClipboardPanel 항목 고정 — 📌 버튼으로 고정, 고정 항목 상단 정렬 + 배경 강조 | ✅ |
| Round 348 | dev | NotesPanel 파일 가져오기 — 📥 버튼으로 .txt/.md 임포트, # 제목 자동 추출 | ✅ |
| Round 347 | dev | CalendarPanel 연도 빠른 이동 — 연도 클릭 시 드롭다운으로 ±5년 연도 선택 | ✅ |
| Round 346 | dev | ChangedFilesPanel W/E 필터 — W(Write)/E(Edit) 배지 버튼으로 타입별 필터, 재클릭 시 해제 | ✅ |
| Round 345 | dev | RemotePanel 최근 접속 순 정렬 — lastUsed 타임스탬프, 최근 사용 순 정렬, 24h 이내 "최근" 배지 | ✅ |
| Round 344 | dev | GitPanel 전체 스테이지/해제 — 변경사항 섹션 "전체 +" 버튼, 스테이징됨 섹션 "전체 해제" 버튼 | ✅ |
| Round 343 | dev | SnippetPanel 카테고리 퀵 필터 — 카테고리 칩 버튼(2개↑ 시 표시), 선택 시 해당 카테고리만 필터 | ✅ |
| Round 342 | dev | ConnectionPanel 자동 핑 토글 — ⟳ ON/OFF, 활성 시 30초 간격 자동 전체 핑 | ✅ |
| Round 329 | dev | NotesPanel 노트 목록 글자 수 — content.length/1000 기반 N자/N.Nk 표시 | ✅ |
| Round 328 | dev | CalendarPanel 다음 이벤트 미리보기 — 날짜 미선택 시 오늘 이후 이벤트 3개 표시 | ✅ |
| Round 327 | dev | SceneTreePanel 비활성 노드 수 — active:false 재귀 카운트, 헤더 빨간 텍스트 | ✅ |
| Round 326 | dev | PromptChainPanel 체인 복제 버튼 — 📋 탭 버튼, 스텝 전체 복사 + (복사) 접미사 | ✅ |
| Round 325 | dev | NodePropertyPanel 컴포넌트 전체 접기/펼치기 — 2개 이상 시 ⊕/⊖ 버튼 (allOpen) | ✅ |
| Round 324 | dev | ChangedFilesPanel 정렬 토글 — ↓최신순/↑오래된순 전환 (sortAsc) | ✅ |
| Round 323 | dev | RemotePanel 호스트 검색 필터 — 3개 초과 시 입력 표시, alias/hostname/user 필터 | ✅ |
| Round 322 | dev | SnippetPanel 스니펫 복사 버튼 — 📋 클릭 시 클립보드 복사 + ✓ 1.5초 피드백 (copiedId) | ✅ |
| Round 321 | dev | ConnectionPanel 헤더 활성 서버 수 배지 — 핑 후 N/M 표시 (전체활성=초록/없음=빨강/일부=노랑) | ✅ |
| Round 320 | dev | GitPanel 헤더 변경 파일 수 배지 — stagedFiles.length↑ (초록) / files.length (회색) 표시 | ✅ |
| Round 319 | dev | SearchPanel 결과 요약 배너 — grouped.length/totalMatches 표시 + 확장자 필터 활성 수 | ✅ |
| Round 318 | dev | PluginsPanel 정렬 토글 — sortMode(default/name/enabled) 3단계 순환 버튼 + sortedPlugins useMemo | ✅ |
| Round 317 | dev | ClipboardPanel 검색 필터 결과 수 — 검색 시 N/M개 항목 헤더 표시 (filtered.length/entries.length) | ✅ |
| Round 316 | dev | BookmarksPanel 필터 결과 수 — 검색/역할 필터 시 N/M개 표시 (filtered.length/bookmarked.length) | ✅ |
| Round 315 | dev | TasksPanel 내보내기 버튼 — 📤 exportTasks로 우선순위·마감일·메모 포함 Markdown 다운로드 | ✅ |
| Round 314 | dev | StatsPanel 히트맵 활동 일수 표시 — totalDays/heatmapDays.length로 N일·X% 활동률 헤더 표시 | ✅ |
| Round 313 | dev | FileTree 전체 접기 버튼 — ⊖ expandedDirs.size>0 일 때 표시, 클릭 시 전체 초기화 | ✅ |
| Round 312 | dev | NotesPanel 줄 수 표시 — 편집기 하단 N자·M단어 옆에 L줄 추가 (split('\n').length) | ✅ |
| Round 311 | dev | RunTimeline 완료 런 삭제 버튼 — 🗑 clearedAt 타임스탬프로 완료 런 필터링 제거 | ✅ |
| Round 310 | dev | GlobalSearchPanel 역할 필터 — roleFilter(all/user/assistant) 토글 버튼 + 필터된 결과 수 표시 | ✅ |
| Round 309 | dev | AssetBrowserPanel 에셋 수 배지 — totalAssets/allFlat으로 non-folder 수 집계, 검색 시 N/M 표시 | ✅ |
| Round 308 | dev | OutlinePanel 아웃라인 복사 버튼 — 📋 copyOutline으로 필터된 헤딩을 마크다운 형식으로 클립보드 복사 | ✅ |
| Round 307 | dev | DiffPanel 경로 교체 버튼 — ⇄ handleSwap으로 leftPath↔rightPath + 콘텐츠 동시 교체 | ✅ |
| Round 306 | dev | WebPreviewPanel 외부 브라우저 열기 — ↗ 버튼 window.open(_blank), URL 있을 때만 표시 | ✅ |
| Round 305 | dev | SceneTreePanel 총 노드 수 — 헤더에 N 재귀 집계 (countNodes/totalNodes) | ✅ |
| Round 304 | dev | NodePropertyPanel UUID 복사 버튼 — 📋 클릭 UUID 복사, ✓ 1.5초 피드백 | ✅ |
| Round 303 | dev | PromptChainPanel 마지막 실행 시간 — 체인 툴바에 lastRun/relativeTime + 단계 수 | ✅ |
| Round 302 | dev | AgentPanel 탭 배지 — 태스크/히스토리 탭에 활성 수/런 수 배지 표시 | ✅ |
| Round 301 | dev | RemotePanel 호스트 수 배지 — 헤더에 N개 (sshHosts+savedHosts 합산) | ✅ |
| Round 300 | dev | SearchPanel 검색어 하이라이트 — highlightLine/<mark>/fbbf24, 정규식 모드 지원 | ✅ |
| Round 299 | dev | ConnectionPanel 모두 핑 버튼 — pingAll/Promise.all 동시 핑, 결과 실시간 반영 | ✅ |
| Round 298 | dev | GitPanel 커밋 메시지 카운터 — 첫 줄 N/72 글자 수, 60↑ 노랑/72↑ 빨강 경고 | ✅ |
| Round 297 | dev | ChangedFilesPanel W/E 카운트 — 헤더에 W:N E:N 색상 구분 표시 (write/edit 분리) | ✅ |
| Round 296 | dev | ClipboardPanel 글자 수 표시 — 타임스탬프 우측에 N자 배지, toLocaleString 천 단위 구분 | ✅ |
| Round 295 | dev | SnippetPanel 정렬 토글 — 생성 순(최신 우선)/이름 순(localeCompare) 전환, ↕️/🔤 버튼 | ✅ |
| Round 294 | dev | PluginsPanel 활성 플러그인 수 배지 — 헤더에 N/M 활성 배지, 토글 시 실시간 갱신 | ✅ |
| Round 293 | dev | RunTimeline 완료 런 합산 비용 — totalCostUsd/finishedRuns, 헤더 요약 표시 | ✅ |
| Round 292 | dev | OutlinePanel 헤딩 레벨 필터 — levelFilter/H1~H3 버튼, 재클릭 전체 복귀 | ✅ |
| Round 291 | dev | BookmarksPanel 역할 필터 토글 — roleFilter/cycleRole, 전체/나/Claude 순환 | ✅ |
| Round 290 | dev | GlobalSearchPanel 검색어 하이라이트 — highlightQuery/<mark> 노란 배경 표시 | ✅ |
| Round 289 | dev | StatsPanel 일평균 세션 카드 — totalSessions/totalDays, 소수점 1자리 표시 | ✅ |
| Round 288 | dev | TasksPanel 마감일 D-Day 카운트다운 — diffDays 계산, D-Day/⚠-N/D-N 색상 표시 | ✅ |
| Round 287 | dev | CalendarPanel 선택 날짜 이벤트 전체 삭제 — "전체 삭제" 버튼, e.date !== selectedDay | ✅ |
| Round 286 | dev | TasksPanel 전체 완료 배너 — progressPct===100 시 🎉 녹색 배너, 진행률 바 대체 | ✅ |
| Round 285 | dev | NotesPanel 모노스페이스 코드 모드 토글 — codeMode/font-mono, </> 버튼 | ✅ |
| Round 284 | dev | SceneView 노드 정보 오버레이 컴포넌트 타입 — cc. 제거 후 쉼표 구분 목록 표시 | ✅ |
| Round 283 | dev | CalendarPanel 이번 달 이벤트 수 요약 — monthEventCount/monthPrefix, 강조 표시 | ✅ |
| Round 282 | dev | TasksPanel 빠른 마감일 버튼 — 오늘/내일/7일 후 토글, 재클릭 해제, × 초기화 | ✅ |
| Round 281 | dev | StatsPanel 요일별 활동 분포 차트 — weekdayStats/isPeak, 최다 요일 황색 하이라이트 | ✅ |
| Round 280 | dev | NotesPanel 노트 클립보드 복사 — copyNoteToClipboard/noteCopied, Markdown 형식 복사 | ✅ |
| Round 279 | dev | TasksPanel 우선순위 점 클릭 순환 — cyclePriority/PRIORITY_CYCLE, low→medium→high→low | ✅ |
| Round 278 | dev | CalendarPanel 이벤트 색상 변경 — 컬러 점 클릭 nextColor/EVENT_COLORS 순환 | ✅ |
| Round 277 | dev | NotesPanel 노트 복제 — duplicateNote/⊕ 버튼, 제목+복사 자동 생성 | ✅ |
| Round 276 | dev | SceneView 컨텍스트 메뉴 UUID/경로 복사 — pathParts/clipboard.writeText | ✅ |
| Round 275 | dev | TasksPanel 태스크 메모 필드 — expandedMemoId/updateMemo, 📝 토글 버튼 | ✅ |
| Round 274 | dev | CalendarPanel 이벤트 인라인 편집 — 더블클릭 editingEventId/commitEventEdit | ✅ |
| Round 273 | dev | NotesPanel 검색어 하이라이트 — highlightText()/<mark> 황색 강조 | ✅ |
| Round 272 | dev | StatsPanel 연속 사용일 스트릭 — currentStreak/longestStreak useMemo 계산 | ✅ |
| Round 271 | dev | TasksPanel 검색 필터 — taskSearch + searchLower 필터링, Escape 초기화 | ✅ |
| Round 270 | dev | SceneView Alt+H/V 좌우/상하 반전 — scaleX/scaleY 부호 반전 단축키 | ✅ |
| Round 269 | dev | SceneView 리사이즈 중 Escape 취소 — startWidth/Height/NodeX/Y 복원 | ✅ |
| Round 268 | dev | SceneView 드래그 중 Escape 취소 — groupOffsets 기반 원위치 복원 | ✅ |
| Round 267 | dev | NotesPanel 글자/단어 수 실시간 상태바 — content.length + split(/\s+/) | ✅ |
| Round 266 | dev | TasksPanel 정렬 기능 — sortBy(created/priority/due) 사이클 버튼 | ✅ |
| Round 265 | dev | CalendarPanel 커스텀 이벤트 — localStorage, 컬러 선택, 셀 컬러 점 표시 | ✅ |
| Round 264 | dev | SceneView 북마크 클릭 카메라 포커스 — setView bounding box 계산으로 북마크 노드 자동 이동 | ✅ |
| Round 263 | dev | SceneView 검색 조상 자동 펼치기 — handleSearchNav에서 ancestors collapsedUuids 제거 | ✅ |

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
