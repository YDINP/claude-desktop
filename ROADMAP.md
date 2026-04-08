# Claude Desktop — 개발 로드맵

> 마지막 업데이트: 2026-03-17 (R2726까지 완료 — 아키텍처 리팩토링 Phase A-F + /ultrawork 리팩토링 완료, QA Pass 2616 / Warning 0 / Critical 0)

## 개발 루프 실행 방식

> **3팀 IPC 오케스트레이션** — 설계팀/구현팀/QA팀이 독립된 Claude Code 세션으로 분리되어 HTTP IPC 브로커(`localhost:7331`)를 통해 통신.
> 상세 실행 절차: `Ben_Claude/prompts/claude-desktop-dev-loop.md` (Step 3)
> 팀 프롬프트: `Ben_Claude/prompts/teams/{design,impl,qa}-team.md`
> 브로커 서버: `Ben_Claude/scripts/team-broker.ts`

---

## ★ 핵심 개발 방향

> **claude-desktop = CC 에디터 대체** — Cocos Creator 에디터 없이 .fire/.scene/.prefab 파일을 직접 파싱·편집·저장하는 독립형 커스텀 에디터 엔진.

| 항목 | 방향 |
|------|------|
| **앱 성격** | 독립 실행형 CC 에디터 대체 (파일 기반) |
| **CC 에디터** | 불필요 — 에디터 미설치 환경에서도 완전 동작 |
| **WS 브릿지** | ~~Deprecated~~ **완전 제거** (Round 413 이후 CocosPanel에서 WS 코드 삭제 완료) |
| **데이터 소스** | 파일시스템 직접 접근 (.fire/.scene/.prefab/.meta) |
| **버전 지원** | CC 2.x / 3.x 파일 형식 자동 감지 |
| **오프라인** | 완전 지원 |

**방향 전환 이력**: Round 64~66에서 WS Extension 방식으로 출발 → Round 414부터 파일 직접 파싱 방식으로 전환 → Round 413 이후 WS UI 및 연결 코드 완전 제거.

---


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
| Round 500 | dev | 특별 라운드: PRD-Phase2.md 업데이트 — Round 472-499 구현 완료 기능 28개 반영, 헤더/기준 동기화 | ✅ |
| Round 501 | dev | Phase FF5-1: 씬뷰 선택 노드 마칭 앤트 애니메이션 — SVG <style> keyframe, cc-selected-rect className, dasharray 6/3 | ✅ |
| Round 512 | dev | Phase DD5-11: Inspector 컴포넌트 복사(⎘)/붙여넣기(📋) 버튼 — copiedCompRef + 3초 확인 표시 | ✅ |
| Round 511 | dev | Phase DD5-10: 멀티셀렉트 화살표 키 일괄 이동 (onMultiMove), HUD ⊕N개 카운터 | ✅ |
| Round 510 | dev | Phase DD5-9: HUD 실시간 드래그/리사이즈/회전 좌표 반영 (주황 강조), PRD 503-510 기록 추가 | ✅ |
| Round 509 | dev | Phase DD5-8: 씬뷰 rubber-band 드래그 선택 + Ctrl+클릭 멀티셀렉트 (로컬 multiSelected Set) | ✅ |
| Round 508 | dev | Phase DD5-7: 씬뷰 화살표 키 이동 — ←↑→↓ 1px, Shift+ 10px, onMove 파일 저장 | ✅ |
| Round 507 | dev | Phase DD5-6: Inspector RGBA 컬러 피커 + fontStyle 드롭다운 (Normal/Bold/Italic/BoldItalic) | ✅ |
| Round 506 | dev | Phase DD5-5: 씬뷰 캔버스 치수 레이블 + XY 좌표축 화살표 (우하단, zoom > 0.3) | ✅ |
| Round 505 | dev | Phase DD5-4: Inspector 숫자 스크러빙 — ScrubLabel 컴포넌트, 라벨 드래그로 값 조절 (ew-resize 커서) | ✅ |
| Round 504 | dev | Phase DD5-3: 씬뷰 스냅 크기 드롭다운 — Ctrl+드래그 스냅 1/5/10/25/50px 선택, 도움말 동적 반영 | ✅ |
| Round 503 | dev | Phase DD5-2: 씬뷰 회전 핸들 — 선택 노드 상단에 ↻ 핸들, 드래그로 회전, Shift 15° 스냅, onRotate 파일 저장 | ✅ |
| Round 502 | dev | Phase DD5-1: 씬뷰 그리드 스타일 순환 — gridStyle none/line/dot 3단계, dot은 교차점 circle, ⊹/· 버튼 | ✅ |
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

### Phase 2 — 완료 ✅
- Claude SDK 활용 확대 (16개 타입 파싱 완료)
- CC 통합 초기 (WebSocket Extension + 패널 + 자연어 편집) → **Round 413 이후 WS 방식 Deprecated**
- 시각 경험 (버블 차별화, 코드 헤더, 애니메이션)

### Phase 3 — 완료 ✅ (Round 74~82)
- 대화 UX 고도화 (메시지 검색, 대화 브랜치 fork UI)
- Monaco Editor 통합 + 인라인 AI 어시스턴트
- 터미널-AI 연동 (에러 자동 분석)
- 프로젝트 인텔리전스 (자동 시스템 프롬프트, 명령어 학습)
- Subagent 워크플로우 시각화 + Prompt 체이닝
- QA 라운드 x2 (Round 77, 82) ✅ Critical 0, Warning 0

### Phase 4 — ✅ 대부분 완료 (R2745)
- ~~스트리밍 UX 완성: 자동 스크롤 제어, ▌ 커서 애니메이션, 배치 렌더링~~ ✅
- ~~채팅 인터랙션: 메시지 재생성(↺), 스트리밍 중단(■), 인라인 편집~~ ✅
- ~~세션 관리: 태그 시스템, 즐겨찾기 핀, 날짜별 그룹 헤더~~ ✅ (이전 라운드에서 구현)
- ~~StatusBar: 실시간 토큰 카운터, API 비용 추산(세션/월별)~~ ✅
- ~~커맨드 팔레트: 최근 항목, AI 제안 명령어~~ ✅ (Ctrl+K)
- ~~알림/토스트 시스템: 성공/에러/정보 컴포넌트~~ ✅ (이전 라운드에서 구현)
- ~~키보드 단축키 오버레이 (? 키)~~ ✅ (이전 라운드에서 구현)
- PromptChain 템플릿 라이브러리 — 미착수
- AG-UI 이벤트 모델 기반 에이전트 실행 표준화 — 미착수

### Phase DD6 — ✅ 완료 (Round 513~523) — CC 씬에디터 완성 단계

| 라운드 | 기능 | 상태 |
|--------|------|------|
| Round 513 | 씬뷰 Delete/Backspace 키 — 선택 노드 삭제 | ✅ |
| Round 514 | 씬뷰 리사이즈 핸들 NW/NE/SW/SE — 이미 구현됨 | ✅ |
| Round 515 | 스마트 정렬 가이드선 — 이미 구현됨 (R206) | ✅ |
| Round 516 | 씬뷰 Ctrl+Z/Shift+Z — 이미 구현됨 (R98) | ✅ |
| Round 517 | Inspector 노드 color 피커 — 이미 구현됨 (R507) | ✅ |
| Round 518 | Inspector 섹션 상태 localStorage 저장 (타입 기반 키) | ✅ |
| Round 519 | 씬 트리 F2 인라인 이름 편집 | ✅ |
| Round 520 | Inspector props 타입 힌트 배지 (UUID/Vec2/Vec3/Color/Bool/Num) | ✅ |
| Round 521 | 터치패드 2손가락 스크롤 패닝 지원 | ✅ |
| Round 522 | Inspector 컴포넌트 빠른 검색 필터 (3개 이상) | ✅ |
| Round 523 | 씬뷰 레이어별 가시성 토글 (L 버튼 + CC 레이어 이름) | ✅ |

### Phase DD7 — ✅ 완료 (Round 524~534) — AI 어시스턴트 + UX 고도화

| 라운드 | 기능 | 상태 |
|--------|------|------|
| Round 524 | AI 씬 편집 — cc-action 가이드 컨텍스트 주입 + createNode/deleteNode/setActive | ✅ |
| Round 525 | 씬뷰 노드 주석 (Annotation) — 스티커 메모 SVG 렌더링 (로컬 저장) | ✅ |
| Round 526 | Inspector 변경 이력 — 속성 변경 타임라인 (최근 5개) | ✅ |
| Round 527 | 채팅 메시지 북마크 — ★ 필터 뷰 (useMemo virtualizer) | ✅ |
| Round 528 | 대화 내보내기 (MD/HTML/PDF) — ExportConversationButton | ✅ |
| Round 529 | 시스템 프롬프트 변수 — resolveVars ({{date}}/{{project}}/{{model}}/{{day}}) | ✅ |
| Round 530 | 씬뷰 Snap Grid — 1/2/4/8/16px 정밀 정렬 토글 | ✅ |
| Round 531 | CC Extension 자동 재연결 — 10초 인터벌 포트 ping + ⚡ 버튼 | ✅ |
| Round 532 | SessionList 날짜 그룹 헤더 — Today/Yesterday/이번 주/이전 | ✅ |
| Round 533 | 파일 에디터 탭 미저장 ● 인디케이터 — dirtyTabs Set 추적 | ✅ |
| Round 534 | QA 강화 + handoff.md + ROADMAP 갱신 | ✅ |

### SceneView 렌더링 분석 결과 (2026-03-13)

3개 병렬 oracle 에이전트 심층 분석. **IPC 파이프라인 완전 연결, SVG 렌더링 코드 실존 확인. 단, 중첩 씬에서 노드 위치 오류 발생.**

| 분류 | 항목 | 상태 |
|------|------|------|
| IPC 체인 | cc:getTree / cc:getCanvasSize Extension→renderer 6레이어 | ✅ 연결 |
| SVG 렌더링 | NodeRenderer rect/label/핸들/앵커 | ✅ 구현 |
| App 통합 | SceneViewPanel 마운트, snapshot 필터, close 가드 | ✅ 정상 |
| 좌표 변환 | cocosToSvg Y-up→Y-down, 앵커, 회전 수식 | ✅ 올바름 |
| **🔴 버그** | `utils.ts flattenTree()` — 로컬 좌표를 월드 좌표로 취급 → 중첩 노드 위치 오류 | ❌ 미수정 |
| **🟡 버그** | `NodeRenderer.tsx` DESIGN_W/H = 960/640 하드코딩 | ❌ 미수정 |

**다음 라운드 수정 대상**:
- Round 535 전 선행: `utils.ts flattenTree()` 부모 월드 좌표 누적 추가
- Round 535 전 선행: `NodeRenderer.tsx` designWidth/Height props 주입 (TODO 주석 있음)

### Phase DD8 — ✅ 완료 (Round 535~544) — 고급 편집 + 성능

| 라운드 | 기능 | 상태 |
|--------|------|------|
| Round 535 | 씬뷰 Undo/Redo — UndoEntry 확장 (prop 타입, Inspector 속성 변경 이력) | ✅ |
| Round 536 | 다중 노드 정렬 — 이미 구현됨 (left/centerH/right/top/centerV/bottom + distribute) | ✅ |
| Round 537 | 씬뷰 Ruler + Guide — 이미 구현됨 (showRuler, alignGuides) | ✅ |
| Round 538 | 채팅 Tool call 타임라인 — 이미 구현됨 (ToolUseIndicator in MessageBubble) | ✅ |
| Round 539 | Inline diff 렌더링 — Edit 도구 old/new string InlineDiff 컴포넌트 | ✅ |
| Round 540 | StatusBar 토큰 카운터 — 이미 구현됨 (contextUsage 진행 바) | ✅ |
| Round 541 | 씬뷰 선택 노드 복사/붙여넣기 — 이미 구현됨 (Ctrl+C/V) | ✅ |
| Round 542 | 씬뷰 노드 그룹화 — 이미 구현됨 (Ctrl+G/Ctrl+Shift+G) | ✅ |
| Round 543 | Inspector 배열 속성 편집 — ArrayPropRow (add/remove 버튼) | ✅ |
| Round 544 | QA Section 105 추가 (R535/R539/R543 체크, Pass 458) | ✅ |
| Round 545 | 씬뷰 노드 검색 하이라이트 — matchedUuids useMemo + NodeRenderer highlighted prop | ✅ |
| Round 546 | Inspector 실시간 미리보기 — applyAndSave 50ms debounce (saveTimerRef/flushSave) | ✅ |
| Round 547 | 채팅 코드 블록 실행 — shell:exec IPC + ▶ 버튼 + 인라인 결과 표시 | ✅ |
| Round 548 QA | QA Section 106 추가 (R545/R546/R547 체크, Pass 461) | ✅ |

### Phase DD10 — 진행 중 (Round 609~) — 씬뷰 Export + 채팅 강화 + Inspector 히스토리

| 라운드 | 기능 | 비고 |
|--------|------|------|
| Round 609 | 씬뷰 스크린샷 (📷) + 미니맵 오버뷰 (우하단 썸네일, pan indicator) | ✅ |
| Round 610 | 채팅 즐겨찾기 메시지 뷰 탭 (⭐ 필터, export JSON) + 컨텍스트 토큰 인디케이터 | ✅ |
| Round 611 | Inspector prop 변경 히스토리 트레이 (최근 15개, undo 버튼, 타임스탬프) | ✅ |
| Round 612 | QA Section 122 추가 (R609/R610/R611, Pass 509) | ✅ |
| Round 613 | 채팅 인라인 Diff 렌더링 (±줄 색상, 통계 헤더, isDiffContent 감지) | ✅ |
| Round 614 | 씬뷰 레이어 패널 (showLayerPanel, hiddenLayers, 가시성 토글) | ✅ |
| Round 615 | StatusBar 세션 경과 타이머 (⏱ Xm Ys, 1초 업데이트) | ✅ |
| Round 616 | QA Section 123 추가 (R613/R614/R615, Pass 512) | ✅ |
| Round 617 | SessionList 타임라인 뷰 (날짜 그룹, ● 마커, viewMode localStorage) | ✅ |
| Round 618 | InputBar PromptChain ⛓ 빠른 실행 버튼 (onOpenPromptChain) | ✅ |
| Round 619 | SceneView 컴포넌트 아이콘 오버레이 (COMP_ICONS, getComponentIcon, utils.ts) | ✅ |
| Round 620 | QA Section 124 추가 (R617/R618/R619, Pass 515) | ✅ |
| Round 621 | 채팅 메시지 접기/펼치기 (FOLD_THRESHOLD 600px, ResizeObserver, 그라데이션 페이드) | ✅ |
| Round 622 | 씬뷰 히트맵 오버레이 (🌡 버튼, buildHeatmap, 밀도→색상 보간) | ✅ |
| Round 623 | Inspector 컴포넌트 접기 (collapsedComps Set, ▸/▾, 배지 #N) | ✅ |
| Round 624 | QA Section 125 추가 (R621/R622/R623, Pass 518) | ✅ |
| Round 625 | SessionList 세션 메모 (noteText, session-note localStorage, 미리보기) | ✅ |
| Round 626 | Inspector Z-order 이동 (Z: N/M, ↑↓ 버튼, ⤒⤓ 맨 앞/뒤) | ✅ |
| Round 627 | NodeRenderer getComponentIcon 렌더링 (cc.Label→T, cc.Sprite→🖼 등) | ✅ |
| Round 628 | QA Section 126 추가 (R625/R626/R627, Pass 521) | ✅ |
| Round 629 | 채팅 컴팩트/와이드 뷰 모드 (chatViewMode, ⊟/⊞ 버튼, 10% padding) | ✅ |
| Round 630 | 씬뷰 퀵 액션 팝업 (showQuickActions, 핀/잠금/숨김/삭제/복사) | ✅ |
| Round 631 | Inspector 스타일 프리셋 (stylePresets, 💾 저장, 📂 불러오기, × 삭제) | ✅ |
| Round 632 | QA Section 127 추가 (R629/R630/R631, Pass 524) | ✅ |
| Round 633 | ChatPanel chatViewMode 뷰 모드 토글 (⊞/⊟, compact/wide, toggleViewMode) | ✅ |
| Round 634 | SceneToolbar 줌 프리셋 드롭다운 (zoomPresetOpen, onZoomTo, 25~200%) | ✅ |
| Round 635 | CocosPanel Inspector Transform 복사/붙여넣기 (transformClipboard, ⎘/📋) | ✅ |
| Round 636 | QA Section 128 추가 (R633/R634/R635, Pass 527) | ✅ |
| Round 637 | MessageBubble 코드 블록 실행 버튼 (onRunCode, bash/sh 언어 감지) | ✅ |
| Round 638 | SceneViewPanel 그리드 레이아웃 (handleGridLayout, √N×M 자동 배치) | ✅ |
| Round 639 | TerminalPanel AI 에러 자동 분석 (isErrorLine, AUTO_ANALYZE_KEY) | ✅ |
| Round 640 | QA Section 129 추가 (R637/R638/R639, Pass 530) | ✅ |
| Round 641 | SceneViewPanel 노드 검색 + 하이라이트 (showNodeSearch, nodeSearchQuery) | ✅ |
| Round 642 | SessionList 세션 통계 고도화 (sessionStats, SessionStats 타입) | ✅ |
| Round 643 | CocosPanel 저장 상태 표시 + Undo/Redo (isDirty, undoStack, savedToast) | ✅ |
| Round 644 | QA Section 130 추가 (R641/R642/R643, Pass 533) | ✅ |
| Round 645 | MessageBubble 이모지 리액션 (reactions, 👍❤️😂😮 토글) | ✅ |
| Round 646 | SceneToolbar 검색 버튼 (onToggleSearch, showSearch prop) | ✅ |
| Round 647 | InputBar 파일 드래그앤드롭 (dragOver, onDrop, isDragging) | ✅ |
| Round 648 | QA Section 131 추가 (R645/R646/R647, Pass 536) | ✅ |
| Round 649 | SessionList 핀 고정 (pinnedSessions, togglePin, localStorage) | ✅ |
| Round 650 | SceneViewPanel 노드 복사/붙여넣기 (copiedNode, Ctrl+C/V) | ✅ |
| Round 651 | ChatPanel 메시지 검색 (msgSearchQuery, showMsgSearch aliases) | ✅ |
| Round 652 | QA Section 132 추가 (R649/R650/R651, Pass 539) | ✅ |
| Round 653 | CocosPanel 컴포넌트 드래그 순서 변경 (compOrder, draggedComp) | ✅ |
| Round 654 | TerminalPanel 출력 필터링 (termFilter, showTermFilter) | ✅ |
| Round 655 | SceneViewPanel 노드 다중 선택/그룹화 (multiSelected, showGroupBtn) | ✅ |
| Round 656 | QA Section 133 추가 (R653/R654/R655, Pass 542) | ✅ |
| Round 657 | SessionList 세션 내보내기 (exportSession, 📤 버튼) | ✅ |
| Round 658 | ChatPanel 스크롤 위치 저장 (scrollPositions useRef, prevSessionIdRef) | ✅ |
| Round 659 | SceneToolbar 레이아웃 프리셋 (onLayoutPreset, layoutPresetOpen) | ✅ |
| Round 660 | QA Section 134 추가 (R657/R658/R659, Pass 545) | ✅ |
| Round 661 | MessageBubble 코드 복사 버튼 (copiedBlock, ✓/📋 토글) | ✅ |
| Round 662 | SceneViewPanel 노드 가시성 일괄 토글 (showAllToggle) | ✅ |
| Round 663 | InputBar 템플릿 변수 자동완성 (varSuggestions, varSuggestionsOpen) | ✅ |
| Round 664 | QA Section 135 추가 (R661/R662/R663, Pass 548) | ✅ |
| Round 665 | CocosPanel 컬러 피커 (colorPickerProp, 색상 스와치) | ✅ |
| Round 666 | ChatPanel 타임스탬프 토글 (showTimestamps, localStorage) | ✅ |
| Round 667 | TerminalPanel 탭 색상 태그 (tabColors, 우클릭 메뉴) | ✅ |
| Round 668 | QA Section 136 추가 (R665/R666/R667, Pass 551) | ✅ |
| Round 669 | SessionList 세션 복제 (duplicateSession, ⧉ 버튼) | ✅ |
| Round 670 | SceneViewPanel 노드 잠금 (lockedNodes/lockedLayers, 🔒/🔓) | ✅ |
| Round 671 | InputBar 음성 입력 (isRecording, SpeechRecognition, 🎤) | ✅ |
| Round 672 | QA Section 137 추가 (R669/R670/R671, Pass 554) | ✅ |
| Round 673 | CocosPanel 노드 프리셋 저장/불러오기 (nodePresets, nodePresetOpen) | ✅ |
| Round 674 | MessageBubble 인용 답장 (onQuoteReply, 앞 80자 인용) | ✅ |
| Round 675 | SceneToolbar 노드 정렬 버튼 (onAlignNodes, 6방향 정렬) | ✅ |
| Round 676 | QA Section 138 추가 (R673/R674/R675, Pass 557) | ✅ |
| Round 677 | SessionList 세션 병합 UI (mergeMode, mergeTargets) | ✅ |
| Round 678 | ChatPanel AI 제안 표시 개선 (suggestionIndex, 칩 UI) | ✅ |
| Round 679 | TerminalPanel 명령어 즐겨찾기 (cmdBookmarks, cmdBookmarkOpen) | ✅ |
| Round 680 | QA Section 139 추가 (R677/R678/R679, Pass 560) | ✅ |
| Round 681 | SceneViewPanel 씬 스냅샷 기록 (snapshots, snapshotOpen) | ✅ |
| Round 682 | ChatPanel 메시지 폴딩 (foldedMessages, foldThreshold=20) | ✅ |
| Round 683 | CocosPanel 프로퍼티 검색 (propSearchQuery, showPropSearch) | ✅ |
| Round 684 | QA Section 140 추가 (R681/R682/R683, Pass 563) | ✅ |
| Round 685 | InputBar 멀티라인 모드 (multilineMode, Ctrl+Enter 전송) | ✅ |
| Round 686 | TerminalPanel 출력 색상 테마 (outputTheme, solarized/monokai) | ✅ |
| Round 687 | SessionList 세션 아카이브 (archivedSessions, showArchived) | ✅ |
| Round 688 | QA Section 141 추가 (R685/R686/R687, Pass 566) | ✅ |
| Round 689 | SceneViewPanel 애니메이션 미리보기 (animPreview, animFrame, 슬라이더) | ✅ |
| Round 690 | MessageBubble 번역 버튼 (showTranslation, translatedText, 🌐) | ✅ |
| Round 691 | CocosPanel 노드 즐겨찾기 (favoriteNodes, favoritesOpen, ☆/★) | ✅ |
| Round 692 | QA Section 142 추가 (R689/R690/R691, Pass 569) | ✅ |
| Round 693 | ChatPanel 대화 자동 요약 (autoSummary, showAutoSummary) | ✅ |
| Round 694 | TerminalPanel 분할 레이아웃 (splitLayout, splitRatio) | ✅ |
| Round 695 | SceneViewPanel 노드 태그 (nodeTags, nodeTagInput) | ✅ |
| Round 696 | QA Section 143 추가 (R693/R694/R695, Pass 572) | ✅ |
| Round 697 | StatusBar CPU 모니터링 (cpuUsage, onCpuUpdate) | ✅ |
| Round 698 | SessionList 세션 타입 필터 (filterType: all/pinned/archived/recent) | ✅ |
| Round 699 | CocosPanel 변경 이력 뷰어 (changeHistory, showHistory) | ✅ |
| Round 700 | QA Section 144 추가 (R697/R698/R699, Pass 575) | ✅ |

### Phase DD9 — ✅ 완료 (Round 549~608) — 퍼포먼스 + 고급 UX

#### 🔥 고우선순위 (잔여)

#### 🟡 중우선순위

#### 🟡 중우선순위
| 라운드 | 기능 | 비고 |
|--------|------|------|
| Round 549 | 씬뷰 노드 핀 (Pin) — pinnedUuids + 📌 아이콘, 드래그/선택 차단 | ✅ |
| Round 550 | 세션 병합 — session:merge IPC, mergeMode UI, source→target append | ✅ |
| Round 551 | 프롬프트 히스토리 — ↑↓ 키 탐색 (Alt→순수 Arrow 전환) | ✅ |

#### 🟢 낮은우선순위
| 라운드 | 기능 | 비고 |
|--------|------|------|
| Round 553 | Inspector 컴포넌트 순서 재정렬 (drag handle) | ✅ |
| Round 554 | 채팅 메시지 번역 버튼 (Claude API 활용) | ✅ |
| Round 555 | 씬뷰 노드 스냅샷 비교 (before/after 오버레이) | ✅ |
| Round 556 | QA Section 108 추가 (R553/R554/R555, Pass 464) | ✅ |
| Round 557 | 씬뷰 smooth zoom (RAF 애니메이션, EASE=0.18) | ✅ |
| Round 558 | 세션 태그 색상 커스터마이즈 (right-click palette) | ✅ |
| Round 559 | Inspector numInput onWheel 증감 (Shift×10) | ✅ |
| Round 560 | QA Section 109 추가 (R557/R558/R559, Pass 467) | ✅ |
| Round 561 | 씬뷰 룰러 — 상단/좌측 눈금자 툴바 버튼 (SceneToolbar + getRulerTicks) | ✅ |
| Round 562 | 채팅 파일 드래그&드롭 첨부 (readFileAsText, 100KB 제한) | ✅ |
| Round 563 | SceneTree 노드 즐겨찾기 — ★ 토글 + 핀 섹션 (localStorage) | ✅ |
| Round 564 | QA Section 110 추가 (R561/R562/R563, Pass 473) | ✅ |
| Round 565 | Inspector 프로퍼티 키워드 검색 필터 (propSearch, Escape 초기화) | ✅ |
| Round 566 | 채팅 메시지 이모지 반응 (5종 토글, localStorage 저장) | ✅ |
| Round 567 | 씬뷰 노드 잠금 — lockedUuids + 🔒 아이콘 + 차단 (localStorage) | ✅ |
| Round 568 | QA Section 111 추가 (R565/R566/R567, Pass 476) | ✅ |
| Round 569 | 씬뷰 Cocos 좌표 툴바 표시 (cursorScenePos → SceneToolbar mousePos) | ✅ |
| Round 570 | 세션 JSON import/export (📥/📤 버튼, Blob URL 다운로드) | ✅ |
| Round 571 | Inspector 숫자 스크럽 드래그 (ScrubLabel, sensitivity 0.5/Shift 0.05) | ✅ |
| Round 572 | QA Section 112 추가 (R569/R570/R571, Pass 479) | ✅ |
| Round 573 | 씬뷰 노드 컬러 태깅 (우클릭 팔레트, nodeColors localStorage, NodeRenderer tint) | ✅ |
| Round 574 | 세션 AI 요약 (우클릭→요약생성, summarizeSession IPC, 모달 결과 표시) | ✅ |
| Round 575 | Inspector cc.Color 피커 개선 (type=color, alpha 슬라이더 r,g,b,a) | ✅ |
| Round 576 | QA Section 113 추가 (R573/R574/R575, Pass 482) | ✅ |
| Round 577 | Inspector opacity 슬라이더 (range 0~255, % 표시, applyAndSave) | ✅ |
| Round 578 | 단축키 도움말 모달 ? 키 단독 토글 (KeyboardShortcutsOverlay, input 포커스 무시) | ✅ |
| Round 579 | 씬 트리 전체 펼치기/접기 (⊞/⊟ 버튼, expandAll/collapseAll) | ✅ |
| Round 580 | QA Section 114 추가 (R577/R578/R579, Pass 485) | ✅ |
| Round 581 | 씬뷰 Marquee 선택 Shift union 버그 수정 + worldX 히트테스트 개선 | ✅ |
| Round 582 | AI 타이핑 인디케이터 (TypingIndicator, bounce 애니메이션, 이미 구현됨) | ✅ |
| Round 583 | Inspector cc.Vec2/cc.Vec3 컬러 레이블 (X=빨강, Y=초록, Z=파랑) | ✅ |
| Round 584 | QA Section 115 추가 (R581/R582/R583, Pass 488) | ✅ |
| Round 585 | 씬뷰 노드 툴팁 300ms 딜레이 + 위치 수정 + 첫 컴포넌트만 표시 | ✅ |
| Round 586 | 채팅 메시지 복사 버튼 (📋→✓ 1.5초, 기존 Copy 버튼 제거) | ✅ |
| Round 587 | 세션 통계 (sessionStats, active 세션 항상 표시, hover 세션 compact) | ✅ |
| Round 588 | QA Section 116 추가 (R585/R586/R587, Pass 491) | ✅ |
| Round 589 | 씬뷰 Zoom to Fit 개선 (handleFit: 노드 bounding box 기준, anchor 보정) | ✅ |
| Round 590 | 채팅 검색 하이라이트 — assistant 메시지 ReactMarkdown p/li 적용 | ✅ |
| Round 591 | Inspector Transform ⟳ Reset 버튼 + scale 행 개별 ↺ 버튼 | ✅ |
| Round 592 | QA Section 117 추가 (R589/R590/R591, Pass 494) | ✅ |
| Round 593 | 씬뷰 정렬 가이드라인 개선 (alignGuides 색상/두께 개선) | ✅ |
| Round 594 | 채팅 ModelSelector 컴포넌트 (🧠/⚖️/⚡ 아이콘, recent-model, 설명) | ✅ |
| Round 595 | Inspector prop 즐겨찾기 (favProps ☆/★, fav-props localStorage) | ✅ |
| Round 596 | QA Section 118 추가 (R593/R594/R595, Pass 497) | ✅ |
| Round 597 | 채팅 메시지 핀 고정 (3개 제한, 클릭 스크롤, handleTogglePin) | ✅ |
| Round 598 | Inspector 배열 prop 펼치기 (expandedArrayProps, 요소별 편집) | ✅ |
| Round 599 | 씬뷰 배경색 커스터마이즈 (🎨 팔레트, sceneBg, scene-bg localStorage) | ✅ |
| Round 600 | QA Section 119 추가 (R597/R598/R599, Pass 500 🎉) | ✅ |
| Round 601 | 씬뷰 측정 도구 소수점 1자리 + 클릭 복사 + 끝점 tick 마커 | ✅ |
| Round 602 | 채팅 메시지 컨텍스트 메뉴 (복사/핀/북마크/재시도/삭제) | ✅ |
| Round 603 | Inspector BoolToggle controlled 스위치 컴포넌트 | ✅ |
| Round 604 | QA Section 120 추가 (R601/R602/R603, Pass 503) | ✅ |
| Round 605 | CocosPanel 그룹 패널 탭 (CCFileProjectUI, 자식 노드 그룹, 이름 변경, 가시성 토글) | ✅ |
| Round 606 | SessionList 다중 태그 필터 (filterCustomTags Set AND 필터, 태그 chip 삭제) | ✅ |
| Round 607 | Inspector Enum 드롭다운 (overflow/horizontalAlign/verticalAlign/wrapMode) | ✅ |
| Round 608 | QA Section 121 추가 (R605/R606/R607, Pass 506) | ✅ |
| Round 1368 | Inspector cc.Widget 속성 편집 (alignMode, top/bottom/left/right, isAbsolute 토글) | ✅ |
| Round 1369 | SceneView Sprite/Label 노드 cc.Color fill 렌더링 (compColor/fillColor) | ✅ |
| Round 1370 | CocosPanel 씬 전환 히스토리 (최대 8개, 현재 씬 체크 표시, 전체경로 tooltip) | ✅ |
| Round 1371 | SceneView 노드 컴포넌트 뱃지 (우상단 최대 3개 아이콘, MAX_BADGES) | ✅ |
| Round 1372 | Inspector 컴포넌트 추가 드롭다운 (ADDABLE_COMPONENTS 7종, 중복 비활성화) | ✅ |
| Round 1373 | QA Section 367-368 추가 (R1368-R1372 기능 체크) | ✅ |
| Round 1374 | SceneView cc.Sprite spriteFrame 에셋 피커 UI (openFileDialog, 파일명 표시) | ✅ |
| Round 1375 | SceneView cc.Layout 컴포넌트 속성 편집 (type/padding/spacing/resizeMode) | ✅ |
| Round 1376 | 씬 파싱 결과 → Claude 채팅 컨텍스트 자동 주입 토글 (cc-ctx-inject, useCCFileContext) | ✅ |
| Round 1377 | NodeHierarchyList 컴포넌트 타입 필터 (cc.Label/Sprite/Button/Layout/Widget) | ✅ |
| Round 1378 | SceneView 노드 북마크 localStorage per scene 영구 저장 + 빠른 이동 | ✅ |
| Round 1379 | QA Section 369-370 추가 (R1374-R1378 기능 체크, Pass 1251) | ✅ |
| Round 1380 | cc-file-parser RichText/ScrollView/Mask/PageView 컴포넌트 지원 (extractComponentProps) | ✅ |
| Round 1381 | SceneView 씬 diff 뷰어 — savedSnapshot + 변경 노드 주황 테두리 강조 | ✅ |
| Round 1382 | CocosPanel 에셋 브라우저 폴더 트리 뷰 (group/tree 토글, 파일 타입 아이콘) | ✅ |
| Round 1383 | SceneView 씬 파일 탭 바 (sceneHistory 기반, 최대 5개 탭, 클릭 전환) | ✅ |
| Round 1384 | Inspector cc.Animation 클립 목록 뷰어 (defaultClip + clips UUID 표시) | ✅ |
| Round 1385 | QA Section 371-372 추가 (R1380-R1384 기능 체크, Pass 1256) | ✅ |
| Round 1386 | SceneView 노드 복사/붙여넣기/복제 deep clone (Ctrl+C/V/D, 재귀 UUID 갱신) | ✅ |
| Round 1387 | Inspector cc.AudioSource 속성 편집 (volume/loop/playOnLoad/preload) | ✅ |
| Round 1388 | NodeRenderer Sprite SLICED/TILED 렌더링 힌트 (점선 격자/x 패턴) | ✅ |
| Round 1389 | cc-file-watcher 부분 업데이트 IPC + debounce 300ms + 배너 5초 자동 숨김 | ✅ |
| Round 1390 | CocosPanel CC 프로젝트 설정 뷰어 (버전/해상도/물리엔진/빌드타겟) | ✅ |
| Round 1391 | QA Section 373-374 추가 (R1386-R1390 기능 체크, Pass 1264) | ✅ |
| Round 1392 | SceneView 정렬 가이드라인 SVG 렌더링 (#4af 스마트 가이드, snap 연동) | ✅ |
| Round 1393 | Inspector 로컬/월드 좌표 토글 (L/W 버튼, 월드 읽기 전용) | ✅ |
| Round 1394 | CocosPanel 씬 템플릿 생성 (빈씬/Canvas 템플릿, writeTextFile, 자동 열기) | ✅ |
| Round 1395 | SceneView 레이어 패널 고도화 (가시성/잠금 영구저장, 색상 라벨 팔레트) | ✅ |
| Round 1396 | cc-file-parser 2x _trs 파싱 정밀도 향상 (base64 디코딩, 개별 필드 폴백) | ✅ |
| Round 1397 | QA Section 375-376 추가 (R1392-R1396 기능 체크, Pass 1269) | ✅ |
| Round 1398 | CocosPanel 프리팹 인스턴스화 UI (readFile → JSON parse → 씬 추가, 📥 버튼) | ✅ |
| Round 1399 | SceneView 노드 그룹화 Ctrl+G / 해제 Ctrl+Shift+G (CocosPanel + SceneViewPanel) | ✅ |
| Round 1400 | cc-file-parser 파티클/카메라/조명 컴포넌트 + NodeRenderer 시각 힌트 (테두리 + 라벨 접두사) | ✅ |
| Round 1401 | SceneView 씬 통계 오버레이 (I키, 노드수/컴포넌트 분포, localStorage, ℹ 버튼) | ✅ |
| Round 1402 | Inspector 노드 참조 필드 🔗 표시 (__id__/__uuid__ 감지) | ✅ |
| Round 1403 | QA Section 377-378 추가 (R1398-R1402 기능 체크, Pass 1276) | ✅ |
| Round 1410 | cc-asset-resolver UUID→파일명 캐시 고도화 (resolveUUIDToPath, getAssetInfo, getAllTextureUUIDs) + preload API | ✅ |
| Round 1411 | SceneView Inspector 속성 검색 필터 (propFilter, Esc 초기화, 컴포넌트명/props 필터) | ✅ |
| Round 1412 | SceneView 채팅 연동 노드 하이라이트 (cc-highlight-node 이벤트, ChatPanel dispatch, 3초 깜빡임) | ✅ |
| Round 1413 | Inspector 다중 노드 일괄 편집 (active 일괄 토글, position 오프셋, 일괄 적용 버튼) | ✅ |
| Round 1414 | CocosPanel 씬 저장 이력 타임라인 (localStorage, 최근 5/20개, 복원 TODO UI) | ✅ |
| Round 1415 | QA Section 383-384 추가 (R1410-R1414 기능 체크, 런타임 체크 확장, Pass 1297) | ✅ |
| Round 1416 | SceneView 노드 잠금 완성 (resize/rotate 차단, lockedUuids 체크) | ✅ |
| Round 1417 | cc-file-parser 2x/3x Label 폰트 필드 강화 파싱 (fontFamily, spacingX/Y, overflow) + Inspector 표시 | ✅ |
| Round 1418 | CocosPanel 씬 유효성 검사 Lint (UUID중복, 빈이름, Canvas없음, 비활성부모, 깊이경고) | ✅ |
| Round 1419 | SceneView 뷰포트 프리셋 저장/불러오기 (localStorage, 1:1/2:1 기본, 사용자 max 5) | ✅ |
| Round 1420 | Inspector cc.Button 속성 편집 (interactable, autoGray, transition, duration, 색상 읽기전용) | ✅ |
| Round 1421 | QA Section 385-386 추가 (R1416-R1420 기능 체크, Pass 1304) | ✅ |
| Round 1422 | SceneView 그리드 크기/색상/불투명도 커스터마이즈 (localStorage grid-settings, 팝업 UI) | ✅ |
| Round 1423 | CocosPanel .bak 백업 파일 관리 UI (목록/복원/전체삭제, BackupManager 컴포넌트) | ✅ |
| Round 1424 | SceneView 다중 씬 비교 뷰 (좌우 분할, 비교 씬 선택 드롭다운, 읽기 전용) | ✅ |
| Round 1425 | Inspector cc.ProgressBar/Slider 속성 편집 (progress, totalLength, reverse) | ✅ |
| Round 1426 | cc-file-parser buildNodePathIndex + Inspector 노드 경로 표시 + 검색 경로 매칭 | ✅ |
| Round 1427 | QA Section 387-388 추가 (R1422-R1426 기능 체크, Pass 1313) | ✅ |
| Round 1428 | SceneView 히트 테스트 정밀화 (최소 8px, z-order 역순, Tab 순환, 비활성 클릭 차단) | ✅ |
| Round 1429 | Inspector cc.Animation 타임라인 바 시각화 + cc.Tween 읽기전용 표시 | ✅ |
| Round 1430 | CocosPanel 전역 노드 검색 (Ctrl+F, 이름/컴포넌트, Esc 닫기, 경로 표시) | ✅ |
| Round 1431 | SceneView Before/After 슬라이더 비교 (SVG clipPath, 드래그, BEFORE/AFTER 라벨) | ✅ |
| Round 1432 | cc-file-parser buildReferenceGraph (UUID 참조 그래프) + detectCycles (순환 참조 탐지) | ✅ |
| Round 1433 | QA Section 389-390 추가 (R1428-R1432 기능 체크, Pass 1318) | ✅ |
| Round 1434 | CocosPanel 에셋 썸네일 호버 미리보기 (128x128, base64, 파일명+크기) | ✅ |
| Round 1435 | SceneView 씬 JSON 뷰어 패널 ({ } 버튼, syntax highlight, 선택/전체 토글) | ✅ |
| Round 1436 | Inspector 컴포넌트 복사/붙여넣기 (클립보드 JSON, 중복 경고) | ✅ |
| Round 1437 | cc-file-saver mtime 기반 충돌 감지 + CocosPanel conflict dialog | ✅ |
| Round 1438 | 씬 로컬 HTTP 공유 (7332포트, 60초 자동 종료, URL 클립보드 복사) | ✅ |
| Round 1439 | QA Section 391-392 추가 (R1434-R1438 기능 체크, Pass 1325) | ✅ |
| Round 1440 | SceneView 씬 JSON 임포트 (붙여넣기 모달, UUID 자동 재생성) | ✅ |
| Round 1441 | cc-file-parser suggestOptimizations (draw call/노드수/깊이/비활성 비율) | ✅ |
| Round 1442 | SceneView 정렬 가이드라인 고도화 (레이블/중앙선/스냅임계값) | ✅ |
| Round 1443 | Inspector 북마크 패널 (★ 토글 + 목록 + 색상 태그) | ✅ |
| Round 1444 | CocosPanel 스크립트 편집기 연동 (✏️ 버튼, 사용중 강조) | ✅ |
| Round 1445 | QA Section 393-394 추가 (R1440-R1444 기능 체크, Pass 1332) | ✅ |
| Round 1446 | SceneView 편집 이력 패널 (⏱ 버튼, max 100 항목, 드래그/리사이즈/이름변경 기록) | ✅ |
| Round 1447 | cc-file-parser findCanvasNode + getDesignResolution (2x/3x Canvas 자동 감지) | ✅ |
| Round 1448 | CocosPanel 씬 의존성 분석 (📦 버튼, UUID 참조 추출, 타입별 그룹/누락 표시) | ✅ |
| Round 1449 | Inspector Transform 개별/전체 리셋 버튼 (↺ 위치/회전/스케일/전체) | ✅ |
| Round 1450 | SceneView 레이어 순서 드래그 재배치 (⋮⋮ 핸들, 파란 드롭 인디케이터) | ✅ |
| Round 1451 | QA Section 395-396 추가 (R1446-R1450 기능 체크, Pass 1335) | ✅ |
| Round 1452 | SceneView 씬 노드 템플릿 라이브러리 (📌, max 10, 기본 2개) | ✅ |
| Round 1453 | cc-file-parser Button/Toggle/Slider 이벤트 핸들러 파싱 | ✅ |
| Round 1454 | CocosPanel 씬 일괄 처리 (폰트통일/비활성삭제/이름정규화) | ✅ |
| Round 1455 | SceneView 카메라 뷰 북마크 Ctrl+1~5 저장/이동 (200ms lerp) | ✅ |
| Round 1456 | Inspector cc.UIOpacity/UITransform 직접 편집 섹션 | ✅ |
| Round 1457 | QA Section 397-398 추가 (R1452-R1456 기능 체크, Pass 1344) | ✅ |
| Round 1458 | SceneView 자동 레이아웃 (수평/수직 균등배분 + 격자 + 원형 배치) | ✅ |
| Round 1459 | cc-file-parser extractSceneMeta (스크립트/텍스처/물리/트윈/애니메이션 감지) | ✅ |
| Round 1460 | SceneView 노드 클릭 히트맵 (선택 빈도 색상 시각화 + 리셋) | ✅ |
| Round 1461 | CocosPanel CC 프로젝트 생성 마법사 (3단계: 이름/위치 → CC버전 → 템플릿) | ✅ |
| Round 1462 | NodeRenderer cc.Shadow SVG feDropShadow 렌더링 | ✅ |
| Round 1463 | QA Section 399-400 추가 (R1458-R1462 기능 체크, Section 400 달성!) | ✅ |
| Round 1464 | SceneView Tween/Animation 노드 CSS 애니메이션 프리뷰 (▶/■ 토글) | ✅ |
| Round 1465 | cc-file-parser diffScenes (added/removed/modified + changedFields) | ✅ |
| Round 1466 | CocosPanel 씬 저장 시 자동 썸네일 생성 (80x60 canvas → base64 localStorage) | ✅ |
| Round 1467 | Inspector 프리팹 인스턴스 뱃지 + cc-open-file 소스 표시 | ✅ |
| Round 1468 | SceneView/Inspector 선택 노드 AI 분석 요청 (cc-chat-prefill) | ✅ |
| Round 1469 | QA Section 401-402 추가 (R1464-R1468 기능 체크, Pass 1359) | ✅ |

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
| Round 1470 | CocosPanel Cocos 에디터 레이아웃 재설계 (계층|SceneView+Inspector 좌우 분할, ISSUE-004) | ✅ |
| Round 1471 | NodeRenderer 물리 컴포넌트 시각화 (RigidBody/BoxCollider/CircleCollider 점선+RB 뱃지) | ✅ |
| Round 1472 | CocosPanel 프리팹 편집 모드 (씬/프리팹 optgroup 분리, 🧩 배지) | ✅ |
| Round 1473 | Inspector 커스텀 스크립트 변수 편집 (isCustomScript 감지, 📝 아이콘, 청록 헤더) | ✅ |
| Round 1474 | CCFileSceneView 스크린샷 → Claude AI 비전 분석 (📷 버튼, cc-chat-prefill, ChatPanel 수신) | ✅ |
| Round 1475 | QA Section 403-404 추가 (R1470-R1474 기능 체크, Pass 1365) | ✅ |
| Round 1476 | 노드 복사 UUID 자동 재생성 (deepCopyNodeWithNewUuids, crypto.randomUUID, 딥복사) | ✅ |
| Round 1477 | 씬 저장 시 변경 diff → Claude 컨텍스트 자동 주입 (prevSceneRootRef, lastSaveDiff) | ✅ |
| Round 1478 | cc-file-parser 대형 씬 청크 스트리밍 파싱 (parseCCSceneChunked, isLargeScene) | ✅ |
| Round 1479 | Inspector Layer 필드 편집 고도화 (CC2.x/3.x layerOptions, 직접입력, parser fix) | ✅ |
| Round 1480 | QA Section 405-406 추가 (R1476-R1479 기능 체크, Pass 1371) | ✅ |
| Round 2159 | BatchInspector cc.BoxCollider2D + CircleCollider2D 확장 (sensor/density/friction/restitution 배치에 포함, QA Pass 2082) | ✅ |
| Round 2160 | BatchInspector cc.BoxCollider2D offset + CircleCollider2D offset 신규 배치 섹션 (QA Pass 2084) | ✅ |
| R2691-R2700 | SceneView 오버레이 10종 (center dot/nudge/random color/non-default anchor/pos gradient/zero size warn/opacity gradient/axis crosshair/color reset/sibling highlight) | ✅ |
| 리팩토링 스프린트 | qa.ts 31,802→81줄 (qa-checks/분리), useBatchPatch 훅, cocos-utils.ts 분리, mkBtnS/mkNiS 팩토리, ESLint, Phantom State 65쌍 제거 | ✅ |
| ISSUE-001 | shell:exec execSync→execFileAsync 보안 수정 | ✅ |
| ISSUE-007 | npm audit overrides (high 10→0, 18→11개) | ✅ |
| ISSUE-008 | claude-agent-sdk 0.1.75→0.2.76 (API 호환) | ✅ |
| ISSUE-009 | react-syntax-highlighter PrismLight (~500kB 절감) | ✅ |
| ISSUE-011 | CC Editor 패널 UX — 탭 자동 로드, 씬/프리팹 드롭다운 분리 | ✅ |
| ISSUE-012 | 리팩토링 로드맵 Phase 1-7 실행 완료 | ✅ |
| R2701 | SceneView 마르키 선택 rubber-band + Shift 키 기존 선택 병합 | ✅ |
| R2702 | BatchInspector opacity 고정값 일괄 (프리셋 0/64/128/192/255) | ✅ |
| R2703 | SceneView ⊕C 선택 노드 중심 팬 이동 | ✅ |
| R2704 | BatchInspector ΔR/ΔG/ΔB/ΔA 색상 채널 오프셋 | ✅ |
| R2706 | BatchInspector Sprite 단색 일괄 교체 (batchSolidColor + applyBatchSolidColor) | ✅ |
| R2708 | BatchInspector 이름 정규식 필터 다중 선택 | ✅ |
| R2709 | SceneView W:H 커스텀 비율 가이드 오버레이 (노란 점선) | ✅ |
| R2710 | BatchInspector W/H 고정값 일괄 + UITransform 동기화 | ✅ |
| R2711 | SceneView 노드 잠금 툴바 버튼 (🔒 토글) | ✅ |
| R2712 | BatchInspector Label fontSize 일괄 강화 | ✅ |
| R2714 | BatchInspector 조건부 active 토글 (비활성→활성 / 활성→비활성) | ✅ |
| R2715 | SceneView 단축키 팝업 (? 키, 전체 단축키 목록) | ✅ |
| R2716 | SceneView 이름 찾기+바꾸기 (regex 지원) | ✅ |
| R2717 | SceneView Opacity HUD 배지 | ✅ |
| R2718 | SceneView UUID 참조 화살표 시각화 | ✅ |
| R2719 | SceneView 격자 스냅 (grid snap) | ✅ |
| R2721 | BatchInspector Label 폰트 색상 일괄 설정 | ✅ |
| R2722 | SceneView 선택 히스토리 breadcrumb | ✅ |
| R2723 | BatchInspector 이름 접두사 자동 그룹 선택 | ✅ |
| R2725 | BatchInspector 선택 노드 일괄 lock/unlock | ✅ |
| 아키텍처 리팩토링 | Phase A(Kernel) + B(Chat 도메인) + C(Cocos Plugin System) + D(App.tsx 훅 추출 1898→961줄) + D.2(JSX→AppLayout 961→448줄) — commit ddf3bff7 | ✅ |
| 리팩토링 Phase E | CocosPanel/index.tsx 3,220→138줄 (6개 파일 분리: BuildTab, SceneTab, HierarchyPanel, ProjectHeader, ProjectToolbar, useCCFileProjectUI) — commit 0689fd08 | ✅ |
| 리팩토링 Phase C | NodeInspector.tsx 9,198줄 → NodeInspector/ 디렉토리 21개 파일 (useNodeInspector, NodeInspectorHeader, NodeTransformSection, renderers/ 10개) — commits 1ba6de35, 986711d4 | ✅ |
| 리팩토링 Phase F | useCCFileProjectUI.ts 1,719→532줄 (useHierarchyPanel, useNodeSelection, useKeyboardShortcuts, useSceneActions, useNodeOperations 분리) — commit 2cb2df45 | ✅ |
| R2726 | SceneView collapsedUuids 연동 — 씬 트리에서 접힌 노드 자식을 SceneView에서도 숨김 (flatNodes useMemo + collapsedUuids prop) | ✅ |
| /ultrawork 리팩토링 | AssetBrowser.tsx 880→639줄(assetUtils/AssetThumbnailPopup/TreeSearch 분리), SceneTree.tsx 530→360줄(GroupPanel 분리), useNodeInspector.tsx 816→683줄(useNodeClipboards/useNodePresets 분리) — commit 888662e6 | ✅ |
| electron 업그레이드 | 33→35.7.5 (ASAR Integrity Bypass 취약점 수정) | ✅ |

| R2727 | BatchInspector 회전 프리셋 버튼 (0°/45°/90°/180°/270° + Δ증감) | ✅ |
| R2728 | BatchInspector 스케일 프리셋 버튼 (×0.5/1/1.5/2 + XY연동 배수) | ✅ |
| R2729 | BatchInspector 편집 히스토리 플러그인 (localStorage, 자동/수동 기록, 클릭 재선택) | ✅ |
| R2730 | LayoutRenderer 전수감사 — _N$enabled 추가, #aaa 하드코딩 수정 | ✅ |
| R2731 | ParticleRenderer 전수감사 — read chain 8건 보완, _N$enabled, CC2.x color 섹션 조건분기 | ✅ |
| R2732 | ScrollViewRenderer 전수감사 — _N$enabled 3곳, read chain 3건, CSS fallback 수정, PageViewIndicator enabled 추가 | ✅ |
| R2733 | BatchInspector 균등 간격 — size 고려 엣지-투-엣지 갭, auto/fixed 두 모드 | ✅ |
| R2695 | BatchInspector 위치 선형 그라데이션 — from/to 범위 선형 보간 재배치 | ✅ |
| R2734 | SceneView 사용자 영구 가이드라인 — V/H 가이드라인 추가/표시토글/전체삭제 | ✅ |
| R2735 | QA 체크 9개 추가 (R2727-rotation~R2734) — QA 2616→2625 Pass | ✅ |
| R2736 | BatchInspector Layer 일괄 설정 (Default/UI/Node/Gizmos 프리셋 + 직접 입력) | ✅ |
| R2737 | BatchInspector Label 텍스트 일괄 수정 (지정/접두사/접미사 모드) | ✅ |
| R2738 | QA 체크 2개 추가 (R2736/R2737) — QA 2625→2627 Pass | ✅ |
| R2739 | BatchInspector opacity 그라데이션 — from→to 선형 보간 일괄 적용 | ✅ |
| R2740 | SceneView 가이드라인 드래그 이동 — 투명 hitbox + mousemove/up 핸들러 | ✅ |
| R2741 | QA 체크 2개 추가 (R2739/R2740) — QA 2627→2629 Pass | ✅ |
| R2742 | SceneView 가이드라인 auto-snap — 드래그 시 8px 이내 가이드에 자동 snap | ✅ |
| R2743 | BatchInspector 색상 밝기 조절 — +/- delta로 RGB 일괄 증감 | ✅ |
| R2744 | QA 체크 3개 추가 (R2741/R2742/R2743) — QA 2629→2632 Pass | ✅ |
| R2745 | Phase 4 스트리밍 UX — 재생성 action bar(항상 표시), Stop 펄스 애니메이션, Escape 중단, StatusBar 토큰/비용 표시, Ctrl+K 커맨드팔레트 | ✅ |
| R2746 | 커스텀 슬래시 커맨드 Phase 1~3 — SlashCommandRegistry handler/plugin/recent/grouped 확장, $ARGUMENTS 치환, 카테고리 그룹 드롭다운 UI | ✅ |
| R2747 | 사이드바 패널 6개 생성 (Calendar/Tasks/Notes/Clipboard/Diff/Remote) — QA Warning 57→0 | ✅ |
| R2748 | component.tsx 리팩토링 — 10,334줄→68줄 hub + 18개 분리 파일, 빌드 에러 수정 | ✅ |
| R2749 | SceneViewPanel 리팩토링 — 5,894→4,439줄 + 4개 훅(keyboard/mouse/actions/constants) 추출 | ✅ |
| R2750 | ChatPanel 리팩토링 — 2,498→1,497줄 + 7개 분리(ModelSelector/ExportButtons/chatUtils 등), 데드코드 350줄 제거 | ✅ |
| R2751 | SessionList 리팩토링 — 2,402→618줄 + 3개 분리(sessionUtils/TagDot/SessionItem), 데드코드 1,800줄 제거 | ✅ |
| R2752 | 중복 제거 — useCopyToClipboard(9패널)/useLocalStorage/useExpandedId/download.ts 공통 훅·유틸 추출 | ✅ |
| R2753 | CCFileSceneView 리팩토링 — 5,525→4,961줄 (ccSceneTypes/useCCSceneOverlayState/useCCSceneAssets/useCCSceneKeyboard 추출) | ✅ |
| R2754 | InputBar 2,086→1,565줄 (SlashCommandDropdown/SuggestionDropdown/QuickActionsBar 추출, phantom useState 180개 제거) | ✅ |
| R2755 | MessageBubble 2,070→1,272줄 (CodeBlock 848줄 추출) | ✅ |
| R2756 | SceneInspector 1,869→1,227줄 (InspectorComponents 추출), TerminalPanel 1,621→1,442줄, misc 1,523→1,238줄 | ✅ |
| R2757 | UX/UI 일관성 — --success-bright CSS변수, 색상 하드코딩 제거, empty state/borderRadius 통일 | ✅ |
| R2758 | 아키텍처 Phase D — session/terminal 도메인 모듈 생성 (zustand store, adapter, commands) | ✅ |
| R2759 | 감사 CRITICAL — _lrot.w 복원, 6패널 Sidebar 연결, GitPanel 삭제, remote IPC 구현 | ✅ |
| R2760 | Kernel ipcBridge 시그니처 8건 수정 + initIpcBridge App.tsx 초기화 + adapter 연결 | ✅ |
| R2761 | store 이중 구현 통합 — chat-store/terminal-store 삭제, domains로 이관 | ✅ |
| R2762 | 보안 강화 — CodeBlock Proxy 샌드박스, XSS 이스케이프, shell:exec 블록리스트 확장 | ✅ |
| R2763 | 에러 핸들링 — StatsPanel/FileViewer/AppLayout catch 추가, phantom useState 주석 전환 | ✅ |
| R2764 | 이중 IPC 구독 제거 — ipcBridge 9개 이벤트 구독 제거, terminal:data만 유지 | ✅ |
| R2765 | 보안 강화 2차 — Mermaid strict, bypassCSP false, richToHtml hex-only 검증 | ✅ |
| R2766 | session 도메인 dead code 삭제 + Sidebar 7탭 UI 버튼 추가 | ✅ |
| R2767 | CodeBlock iframe sandbox + shell:exec 화이트리스트 + ChatPanel useEffect 3훅 분리 | ✅ |
| R2768 | cc:open-file 이벤트명 통일 + 워크스페이스 대화복원 + selectedModel/ccLayout/fontSize 통합 | ✅ |
| R2769 | syntax-highlighter 공통 모듈 추출 + SessionItem React.memo | ✅ |
| R2770 | ui-store 생성 — AppLayout props 10개 제거, 모달 상태 zustand 중앙 관리 | ✅ |
| R2771 | API 키 설정 UI — SettingsPanel AI 탭 + WelcomeScreen 미설정 경고 배너 | ✅ |
| R2772 | aria 접근성 — Sidebar tablist/tab, SessionList listbox, FileTree tree | ✅ |
| R2773 | SessionList/SceneTree 가상 스크롤 + localStorage 키 cd- 접두사 통일 | ✅ |
| R2774 | AppLayout props 15개 추가 이관 (ccTab/mainPanelTab/chatFocusTrigger 등) | ✅ |
| R2775 | 공통 CSS 클래스 6개 추출 (panel-header/empty/btn/search/item) | ✅ |
| R2776 | 세션 전환 스트리밍 중단 (경쟁 조건 해소) + handleSend 이중 전송 방지 | ✅ |
| R2777 | 저장소 우선순위 — theme/accent electron-store 우선, localStorage 캐시 동기화 | ✅ |
| R2778 | 세션 전환 스트리밍 경쟁 조건 해소 + handleSend 이중 전송 가드 | ✅ |
| R2779 | 씬 저장 직렬화 큐 (pendingSaveRef) + useDebounce 공통 훅 3곳 적용 | ✅ |
