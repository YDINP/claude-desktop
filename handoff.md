# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-15

## 완료 (R1500-2331)
- [x] R1500~R2305: (이전 세션 완료)
- [x] R2306~R2314: 갭 수정 + 이슈 버그 수정 (이전 세션 완료)
- [x] R2315: 씬뷰 SVG 직접 내보내기 — handleSvgExport + XMLSerializer→.svg 다운로드 버튼
- [x] R2316: ISSUE-001 shell:exec 위험 패턴 블록리스트 — rm -rf/del/format/fork-bomb 차단
- [x] R2317: CocosPanel 즐겨찾기 프로젝트 — ★/☆ 토글 + 즐겨찾기 드롭다운 (localStorage cc-favorite-projects)
- [x] R2318: 씬뷰 cc.Camera 뷰 프레임 오버레이 — orthoHeight 기반 황색 점선 사각형 + 📷 아이콘
- [x] R2319: 씬뷰 카메라 프레임 토글 — showCameraFrames state + toolbar 📷 버튼
- [x] R2320: cross-scene 노드 클립보드 — Ctrl+C 시 localStorage 저장, Ctrl+V 씬 전환 후 붙여넣기
- [x] R2321: undo/redo 스택 카운터 — undoCount/redoCount 노출 + ↩3 ↪2 형식 표시
- [x] R2322: 씬 파일명 클릭 → Windows 탐색기에서 열기 (explorer /select)
- [x] R2323: Inspector 자동 스크롤 — 노드 전환 시 inspectorScrollRef.scrollTo(0,0)
- [x] R2324: 씬뷰 자동 팬 — 트리 선택 노드가 뷰포트 밖이면 중심으로 이동 (flatNodesRef + effectiveWRef)
- [x] R2325: 씬 검색 UUID 지원 — #접두어 또는 hex 패턴으로 노드 UUID 부분 매칭
- [x] R2326: 씬뷰 체크무늬 배경 패턴 — bgPattern state + ⊞ 툴바 버튼
- [x] R2327: Save As (다른 이름으로 저장) — cc:file:saveAs IPC + preload + CocosPanel 버튼
- [x] R2328: Inspector 컴포넌트 타입 tooltip — COMP_DESCRIPTIONS 맵 32종
- [x] R2329: 씬뷰 선택 이력 ← → 버튼 — Alt+←/→ 연동 마우스 접근성
- [x] R2330: Inspector 컴포넌트 헤더 아이콘 — COMP_ICONS 맵 22종
- [x] R2331: 컴포넌트 추가 패널 개선 — 아이콘+tooltip + 커스텀 타입 입력(Enter)
- [x] R2332: Inspector active 토글 H키 힌트 (스타일 배지 + title tooltip)
- [x] R2333: 회전 0° 리셋 + 스케일 1:1 리셋 버튼
- [x] R2334: 씬뷰 단축키 도움말 최신화 (Alt+←/→, G, Ctrl+P 추가)
- [x] R2335: Inspector Sprite 텍스처 썸네일 미리보기 (SpriteThumb + ccFileResolveTexture)
- [x] R2336: BatchInspector 2-노드 선택 시 dx/dy/dist 거리 정보 패널
- [x] R2337: Inspector 노드 N-복제 (dupeCount ×N 입력, 최대 20개)
- [x] R2338: 씬 트리 우클릭 메뉴 JSON 복사 옵션
- [x] R2339: 씬 트리 노드 색상 태그 커스텀 색상 picker 추가
- [x] R2340: Inspector cc.SpotLight intensity/range/spotAngle/color 퀵 편집
- [x] R2341: Inspector cc.WebView url/visibleWithMouse 퀵 편집
- [x] R2342: Inspector cc.Scrollbar direction/enableAutoHide/autoHideTime 퀵 편집
- [x] R2343: Inspector 단일노드 tag(_tag CC2.x) 편집 필드 (0이 아닌 경우만 표시)
- [x] R2344: 씬 통계 컴포넌트 분포 인라인 바 시각화 + 전체 컴포넌트 수

- [x] R2345~R2354: 이전 세션 완료 (cc.Label underlineHeight/strikethrough/charSpacing, cc.EditBox lineCount/tabIndex, cc.RichText fontColor, cc.Widget H/V-center 등)
- [x] R2355: Inspector cc.Layout childAlignment 퀵 편집 — None/LT/C/RB/LC/RC 버튼
- [x] R2356: Inspector cc.ProgressBar mode H/V/Fill 퀵 편집 버튼
- [x] R2357: Inspector cc.ProgressBar startWidth 입력 + 프리셋(0/1/5/10/20/50)
- [x] R2358: Inspector cc.Button autoGrayEffect 체크박스 (interactable 옆)
- [x] R2359: Inspector cc.Slider minValue/maxValue 범위 + step 퀵 편집 (프리셋 포함)
- [x] R2360: Inspector cc.ScrollView pagingEnabled/cancelInnerEvents/scrollDuration 퀵 편집

- [x] R2361: Inspector cc.AudioSource preload 체크박스 + startTime/endTime 입력 (-1=∞)
- [x] R2362: Inspector cc.Widget isAbs* px/% 전환 버튼 (절대px↔비율)
- [x] R2363: Inspector cc.Sprite packable 체크박스 + meshType Regular/Poly 버튼
- [x] R2364: Inspector cc.Label spacingY 입력 필드 (spcX 옆)
- [x] R2365: Inspector cc.Camera orthoHeight/near/far CC3.x 퀵 편집 (is3x 조건부)

- [x] R2366: Inspector cc.RigidBody bullet/allowSleep 체크박스
- [x] R2367: Inspector cc.BoxCollider/CircleCollider/PolygonCollider density 입력 필드 (3-col 그리드)
- [x] R2368: Inspector cc.PolygonCollider threshold 입력 필드 + 프리셋
- [x] R2369: Inspector cc.Label enableOutline/outlineWidth/outlineColor 퀵 편집 (CC3.x)
- [x] R2370: Inspector cc.Label enableShadow/shadowBlur/shadowColor 퀵 편집 (CC3.x)
- [x] R2371: Inspector cc.Label enableGradient/colorTop/colorBottom 퀵 편집 (CC3.x)
- [x] R2372: Inspector cc.Label enableDashLine 토글 (CC3.x)
- [x] R2373: Inspector cc.Graphics lineJoin/lineCap/miterLimit/fillOpacity/strokeOpacity 퀵 편집
- [x] R2374: Inspector cc.MotionStreak timeToLive/speedThreshold 입력 필드
- [x] R2375: Inspector cc.Animation sample rate/speed 입력 필드
- [x] R2376: Inspector cc.VideoPlayer volume 슬라이더 + keepAspectRatio/fullScreenEnabled
- [x] R2377: Inspector cc.PageView pageTurningSpeed/effectType/autoPlay 퀵 편집
- [x] R2378: Inspector cc.ToggleContainer autoCheckToggle 체크박스
- [x] R2379~R2451: Inspector 단일노드 갭 수정 (이전 세션 완료) — 주요: R2383(UITransform), R2384(sourcePos), R2387(Canvas.resize), R2390(RB group/rotOff), R2400(velLimits), R2402(PS speedAmplifier), R2403(linVel/angVel), R2404(Label platformFont), R2405(AudioSource), R2408(SkeletalAnim), R2409(Layout affectedByScale), R2410(Layout wrapMode), R2411(RB contactListener), R2415(PageView bounce), R2417(Anim wrapMode), R2420(LabelShadow), R2421(PS emitter), R2422(RB awake/sleep), R2425(Mask enabled), R2434(Widget enabled), R2436(PS/Dragon enabled), R2437(LabelOutline/Shadow enabled), R2438(RB enabled), R2440(PS loop), R2441(TiledLayer enabled), R2444(Canvas enabled), R2446(RichText props), R2447(EditBox props), R2448(PS var props), R2449(Sprite enabled), R2450(ScrollView bounce), R2451(Toggle enabled)

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2486** ← R2452 현재
- Branch: dev
- 최근 커밋: `9bcc8999` (R2451), `f2495dfd` (R2448~R2450), `a88cb67` (R2378)

## 갭 수정 완료 상태 (2026-03-15 기준)
- **BatchInspector bare shorthand → ALL DONE** (R2298-R2305)
- **BatchInspector 명시적 prop → ALL DONE** (R2306-R2311)
- **단일노드 인스펙터 갭 → 전면 분석 완료 — 모든 컴포넌트 타입 커버됨**
  - 44개 BatchInspector 컴포넌트 타입 전부 단일노드에도 구현됨
  - 마지막 갭: R2451 cc.Toggle enabled (2026-03-15 완료)
  - cc.Canvas/Mask/BlockInputEvents/UITransform/UIOpacity/LabelOutline/LabelShadow/ParticleSystem/TiledLayer/RigidBody/RigidBody2D/BoxCollider2D/CircleCollider2D/PolygonCollider2D/Sprite2D 등 모두 완료
- **더 이상 배치-단일노드 간 갭 없음 → 새 UX 기능 탐색으로 전환**

## 완료 (R2452~R2461)
- [x] R2452: ISSUE-011 CC Editor 씬 드롭다운 버그 수정 + 마지막 씬 자동 로드
- [x] R2453: 계층 패널 더블클릭/우클릭 인라인 이름 편집 (CC Editor F2 rename 패리티)
- [x] R2454: Inspector 섹션 접힘 상태 localStorage 영속화
- [x] R2455: 전역 검색 결과 클릭 시 계층 트리 자동 펼치기 (reveal in hierarchy)
- [x] R2456: 씬뷰 그리드 오버레이 토글 버튼 (#)
- [x] R2457: Inspector 노드 이름 입력 Enter 키 즉시 저장
- [x] R2458: 외부 변경 자동 리로드 토글 — 배너 체크박스 + localStorage 영속화
- [x] R2459: cc-file-saver 컴포넌트 추가 미저장 버그 수정 — normalizeTree에서 새 comp raw 엔트리 생성 + _components 동기화
- [x] R2460: deepCopyNodeWithNewUuids 컴포넌트 _rawIndex 초기화 — R2459 _components 동기화 충돌 방지
- [x] R2461: QA 섹션 1456~1459 추가 (Pass 2490)

## 완료 (R2462~R2468)
- [x] R2462: buildNewRawComp 타입별 기본값 맵 (COMP_DEFAULT_2x/3x) — 14종 컴포넌트 기본 props
- [x] R2463: Save As Prefab — 씬 트리 우클릭 "🧩 프리팹으로 저장", extractPrefabEntries DFS + UUID 재매핑
- [x] R2464: QA sections 1460-1461 (R2462/R2463 커버)
- [x] R2465: 씬뷰 거리 측정 도구 — M키/📏 버튼, 드래그로 두 점 거리 SVG 오버레이 + 수치 표시
- [x] R2466: 씬뷰 다중 선택 노드 그룹화 — 📦 버튼, 선택 노드를 Group 노드 하위로 묶음 + 로컬 좌표 변환
- [x] R2467: BatchInspector 컴포넌트 일괄 추가 — 다중 선택 노드에 12종 컴포넌트 일괄 부착 (중복 스킵)
- [x] R2468: QA sections 1462-1464 추가 (Pass 2495)

## 완료 (R2469~R2480)
- [x] R2469: 전역 검색 text:/t: 구문 — cc.Label/RichText 텍스트 내용 검색
- [x] R2470: 미니맵 노드 클릭 선택 — 히트 테스트(역순) + 빈 공간 클릭 시 팬 유지
- [x] R2471: Inspector breadcrumb 📋 버튼 — cc.find("path") 클립보드 복사
- [x] R2472: 씬뷰 다중 선택 노드 동시 드래그 — multiDragRef/multiDragDelta
- [x] R2473: QA sections 1465-1468 추가 (Pass 2499)
- [x] R2474: Inspector 📌 핀 노드 — 씬뷰 상단 핀 바, localStorage 영속화, 우클릭 해제
- [x] R2475: QA section 1469 추가 (Pass 2500)
- [x] R2476: 씬뷰 HUD opacity 인라인 슬라이더 — 선택 노드 불투명도 즉시 편집
- [x] R2477: 씬뷰 Escape → 부모 노드 선택 (루트면 해제)
- [x] R2478: QA sections 1470-1471 추가 (Pass 2502)
- [x] R2479: BatchInspector 원형 배치 — N개 노드를 반지름 r px 원형으로 균등 배치
- [x] R2480: QA section 1472 추가 (Pass 2503)

## 완료 (R2481~R2484)
- [x] R2481: BatchInspector 격자 배치 — 열/gX/gY 입력, M×N 격자 균등 배치 (기본 열수=ceil(sqrt(N)))
- [x] R2482: BatchInspector 정렬 도구 — ←L/↔C/R→ + ↑T/↕M/B↓ 6종 (min/mid/max 기반)
- [x] R2483: BatchInspector 균등 배분 — ↔=/↕= (3개+ 노드, 정렬 행에 통합)
- [x] R2484: Inspector 동일 이름 노드 수 뱃지 — =×N 오렌지 뱃지 (씬 내 같은 name 2개+)

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2507** ← R2484 현재
- Branch: dev
- 최근 커밋: `ac6f82ad` (R2484), `add27e2e` (R2483), `8897ec45` (R2482), `ef53cead` (R2481)

## 완료 (R2485~R2488)
- [x] R2485: BatchInspector 크기 균등화 — W↑/↓/≈ + H↑/↓/≈ (max/min/avg 버튼, 2개+ 노드)
- [x] R2486: 씬뷰 씬별 뷰 상태 영속화 — 씬 전환 시 pan/zoom 자동 복원 (sv-view2-* localStorage)
- [x] R2487: Inspector Raw JSON 인라인 편집 — 편집/적용/취소 버튼 + JSON 파싱 적용
- [x] R2488: 복제 오프셋 설정 — Ctrl+D 복제 시 X/Y 위치 오프셋 (SceneView 상단 바, 퀵 프리셋)

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2511** ← R2488 현재
- Branch: dev
- 최근 커밋: `afaccab8` (R2488), `7a0d39d4` (R2487 fix), `9af9fbb7` (R2486), `4f3e419e` (R2485)

## 다음 예정 (R2489+)
- CC Editor 패리티 계속: 씬뷰 추가 UX, Inspector 개선
- 남은 이슈: ISSUE-007(npm audit), ISSUE-008(SDK), ISSUE-009(번들)

## 누적 이슈 (QA 체크포인트에서 발견된 기존 이슈)
- ISSUE-001: shell:true 입력검증 없음 (Critical — 기존 누적, R2316에서 부분 완화)
- ISSUE-007: npm audit 18 취약점 (기존 누적 — 모두 breaking change 필요)
- ISSUE-008: SDK 업그레이드 (기존 누적)
