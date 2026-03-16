# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-16

## 완료 — 리팩토링 스프린트 (2026-03-16)
- [x] ISSUE-001: shell:exec execSync→execFileAsync 교체 (보안/블로킹 수정)
- [x] Phase 1-A: mkBtnS/mkBtnTint/mkNiS 팩토리 함수, btnS/niS 36개 교체
- [x] Phase 1-B: validateScene/extractPrefabEntries/deepCopyNodeWithNewUuids → cocos-utils.ts
- [x] Phase 2: useBatchPatch 훅 (hooks/useBatchPatch.ts), 20개 apply 교체
- [x] Phase 3: qa.ts 31,802줄 → 81줄 (qa-checks/ 분리, OOM→정상)
- [x] Phase 5: Phantom State 65쌍 제거 (-137줄)
- [x] Phase 6: opGradFrom 이중 선언 버그 제거
- [x] Phase 7: eslint.config.ts 추가 (@typescript-eslint + react-hooks)
- [x] ISSUE-012: 리팩토링 로드맵 완료 처리 (Done/)

## 미완료 / 다음 스프린트
- [ ] Phase 2 나머지: ~525개 apply 함수 useBatchPatch 교체 (훅은 완성)
- [ ] Phase 4: CocosPanel → BatchInspector/NodeInspector/SceneView 파일 분리
- [ ] ISSUE-011: CC Editor 패널 (탭 클릭 시 Cocos 로드, 씬/프리팹 드롭다운, 노드 리스트)
- [ ] ISSUE-007: npm audit 18 취약점 (devDep, electron 업그레이드 필요)
- [ ] ISSUE-008: claude-agent-sdk 0.1.75 → 0.2.76 (agent-bridge.ts 호환성 확인 필요)
- [ ] ISSUE-009: 번들 최적화 (low priority)
- [ ] R2701-R2710: 10개 신규 기능 구현 (QA 스텁만 있음)

## 완료 (R2691-R2700) — 이번 세션 (계속)
- [x] R2691: SceneView 노드 중심 점 마커 (showCenterDot, 빨간 점 · )
- [x] R2692: BatchInspector nudge ←→↑↓ 버튼 + step 입력 (nudgeStep)
- [x] R2693: BatchInspector 🎲 랜덤 색상 일괄 적용 (applyRandomColor)
- [x] R2694: SceneView ⚓ 비기본 앵커 강조 (showNonDefaultAnchor, 앵커값 텍스트)
- [x] R2695: BatchInspector X/Y축 위치 선형 배치 (posGradFrom/To, applyPosGradient)
- [x] R2696: SceneView ⚠ 크기 0 노드 경고 오버레이 (showZeroSizeWarn)
- [x] R2697: BatchInspector opacity 선형 그라데이션 배치 (opGradFrom/To, applyOpGradient)
- [x] R2698: SceneView ╋ 선택 노드 위치 가이드 십자선 (showSelAxisLine, 청록 점선)
- [x] R2699: BatchInspector ⬜리셋 — color → (255,255,255,255) (applyColorReset)
- [x] R2700: SceneView ≡ 형제 노드 강조 오버레이 (showSiblingHighlight, 보라)
버그 수정: CocosPanel R2512 JSX 닫힘 누락, SceneView uuids 미정의, showSelBBox 중복

## 완료 (R2681-R2690) — 이번 세션 (이전)
- [x] R2681-R2690: [이하 생략]

## 완료 (R2662-2680) — 이번 세션 (계속)
- [x] R2662: BatchInspector rotation→0 리셋 (CC2.x 숫자/CC3.x {x,y,z} 공통)
- [x] R2663: BatchInspector ±range 랜덤 위치 오프셋 (randomRange)
- [x] R2664: BatchInspector ±range 랜덤 회전 오프셋 (randomRotRange, CC2/3 공통)
- [x] R2665: SceneView 깊이 히트맵 (얕음=초록→깊음=빨강, maxDepthVal)
- [x] R2666: SceneView opacity<255 노드에 α값 텍스트 오버레이 (showOpacityOverlay)
- [x] R2667: BatchInspector 이름 대소문자 변환 (UPPER/lower/Title, applyNameCase)
- [x] R2668: SceneView rotation≠0 노드에 각도 텍스트 오버레이 (showRotOverlay)
- [x] R2669: BatchInspector 이름 공백 정리 trim + replace(/\s+/g,' ')
- [x] R2670: SceneView 선택 노드 position(x,y) 텍스트 오버레이 (showPosText)
- [x] R2671: BatchInspector 이름 find/replace (nameFind→nameReplace)
- [x] R2672: SceneView scale≠1 노드에 scale 값 텍스트 오버레이 (showScaleText)
- [x] R2673: SceneView 노드당 컴포넌트 수 배지 (showCompCountBadge, 기본 타입 제외)
- [x] R2674: BatchInspector 절대 위치 직접 지정 (absPosX/Y + 축 checkbox)
- [x] R2675: SceneView 노드 크기 히트맵 (큰=노란/작은=파란, maxNodeArea)
- [x] R2676: BatchInspector 색상 블렌드 (현재→목표색 t% 혼합, colorBlendTarget/Amount)
- [x] R2677: BatchInspector 색상 반전 (255-r, 255-g, 255-b, applyColorInvert)
- [x] R2678: BatchInspector opacity 배수 (×N%, applyOpacityMult)
- [x] R2679: BatchInspector 선택 그룹 중심을 (0,0)으로 이동 (applyMoveToCenter)
- [x] R2680: SceneView 선택 그룹 중심 마커 (showSelCenter, 녹색 ⊕ 십자)

## 완료 (R2637-2650) — 이번 세션
- [x] R2637: SceneView 씬 전체 바운딩박스 오버레이 (showSceneBBox, 적색 점선 + WxH)
- [x] R2638: BatchInspector 회전 균등 분배 (rotGradFrom→rotGradTo, applyRotGrad)
- [x] R2639: BatchInspector 원형 배치 (applyCircleArrange, circleRadius)
- [x] R2640: SceneView 선택 순서 번호 오버레이 (showSelOrder, 녹색 ①② 번호)
- [x] R2641: SceneView 앵커 포인트 십자 마커 (showAnchorDot, 주황 ⊕)
- [x] R2642: BatchInspector 노드 이름 접두사/접미사 추가 (namePrefix, nameSuffix)
- [x] R2643: BatchInspector 격자 배치 (applyGridArrange, gridCols, dx/dy)
- [x] R2644: BatchInspector 선택 노드 통계 패널 (selStats, X/Y/W/H min·avg·max)
- [x] R2645: SceneView 선택 노드 연결선 오버레이 (showSelPolyline, 자주색 polyline)
- [x] R2646: SceneView 계층 구조 연결선 (showHierarchyLines, 부모→자식 cyan)
- [x] R2647: SceneView 선택 노드 그룹 BBox (showSelBBox, 파란 점선 + WxH)
- [x] R2648: BatchInspector 이름 알파벳순 Z-order 정렬 (applySortByName, A→Z/Z→A)
- [x] R2649: BatchInspector 선택 노드 복제 (applyDuplicate, deepClone + dx/dy)
- [x] R2650: BatchInspector 노드 이름 일련번호 치환 (applyNameSerial, {base}{n})

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

## 완료 (R2489~R2490)
- [x] R2489: Inspector 동일 이름 노드 팝업 — =×N 클릭 시 목록, 클릭으로 노드 전환
- [x] R2490: 씬뷰 HUD 컴포넌트 아이콘 목록 — 선택 노드 컴포넌트 타입 아이콘 22종

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2513** ← R2490 현재 (체크포인트 통과)
- Branch: dev
- 최근 커밋: `39b24aca` (R2490), `22502958` (R2489), `afaccab8` (R2488)

## 완료 (R2491~R2500)
- [x] R2491: BatchInspector 범용 prop 일괄 편집 — 컴포넌트타입/prop명/값 입력 적용
- [x] R2492: 씬 트리 우클릭 cc.find() 경로 복사 — ancestors 전파로 전체 경로 계산
- [x] R2493: 계층 트리 캔버스 범위 초과 노드 ⚠ 뱃지 — outOfCanvasUuids 누적 좌표 계산
- [x] R2494: BatchInspector 회전 델타 — 선택 노드 현재 회전값에 ±5/15/45/90° 증분 적용
- [x] R2495: BatchInspector 그리드 스냅 — 1/5/10/20/50/100px 단위 위치 정렬
- [x] R2496: BatchInspector 위치 흩뿌리기 — ±10~200px 범위 무작위 분산 (Scatter)
- [x] R2497: 씬뷰 클릭 시 계층 트리 조상 자동 펼치기 — expandToNode + requestAnimationFrame 스크롤
- [x] R2498: TreeSearch /regex/ 정규식 검색 — /Button.*/ 패턴으로 노드 이름 매칭 + 하이라이트
- [x] R2499: BatchInspector 3+노드 선택 시 바운딩박스 통계 — center/span 표시
- [x] R2500: BatchInspector 선택 반전 — 현재 선택 제외한 모든 노드 역선택

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2523** ← R2500 현재
- Branch: dev
- 최근 커밋: `a0b1df2c` (R2500)

## 완료 (R2501~R2510)
- [x] R2501: 씬뷰 중심선 가이드 오버레이 — CC 원점(0,0) 기준 점선 십자선 + ⊕ 버튼
- [x] R2502: Inspector 컴포넌트 추가 최근 이력 — 마지막 5개 타입 localStorage, 상단 빠른 접근
- [x] R2503: BatchInspector 정렬/분배 — L/CX/R/DH + T/CY/B/DV 8방향 정렬
- [x] R2504: BatchInspector 이름 일련번호 — +번호/교체/제거로 _01 _02 순번 자동 부여
- [x] R2505: BatchInspector 컴포넌트 일괄 추가 — 퀵버튼 7종 + 자유 입력, 중복 스킵
- [x] R2506: BatchInspector 컴포넌트 일괄 제거 — 공통 × 버튼 + 자유 입력
- [x] R2507: BatchInspector 하위 노드 포함 선택 확장 — ⊕하위 버튼으로 자손 UUID 추가
- [x] R2508: SceneView 다중 선택 중심점 마커 — 평균 위치에 주황 원+십자 SVG 오버레이
- [x] R2509: BatchInspector 선택 필터 — 활성/비활성 노드만 남기기 ✓N/✗N 버튼
- [x] R2510: BatchInspector 같은 이름 노드 일괄 선택 — =×N 버튼으로 동명 노드 전체 선택

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2533** ← R2510 현재
- Branch: dev
- 최근 커밋: `47f26bff` (R2510)

## 완료 (R2521~R2530)
- [x] R2521: SceneView 세계 좌표 표시 토글 — L/W 버튼으로 로컬/월드 좌표 전환
- [x] R2522: BatchInspector 직접 자식 선택 — ⬇ 자식 버튼 (R2515 부모 선택 대칭)
- [x] R2523: BatchInspector 공통 컴포넌트 ON/OFF — 선택 노드 컴포넌트 enabled 일괄 토글
- [x] R2524: SceneView 다중 선택 통합 바운딩박스 — 2개+ 선택 시 주황 점선 통합 rect
- [x] R2525: BatchInspector 오파시티 그라디언트 — from→to opacity 선형 분배
- [x] R2526: SceneView 깊이 필터 — D≤N 버튼+슬라이더로 depth 초과 노드 dim
- [x] R2527: BatchInspector 스케일 X/Y 링크 — ⊞/⊟ 토글로 X 변경 시 Y 동기화
- [x] R2528: BatchInspector 스케일 배율 버튼 — ×0.5/×0.75/×1.25/×2 scaleX/Y 곱셈
- [x] R2529: SceneView 핀 마커 레이블 — 더블클릭으로 커스텀 레이블 편집
- [x] R2530: BatchInspector 앵커 위치 보정 — 앵커 변경 시 position 자동 보정 체크박스

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2553** ← R2530 현재
- Branch: dev
- 최근 커밋: `d49f6c8a` (R2530)

## 완료 (R2531~R2539)
- [x] R2531: BatchInspector 2-노드 위치 교환 — ⇄ 교환 버튼 (posA↔posB swap)
- [x] R2532: SceneView 툴바 ⊹px 스냅-to-pixel — 선택 노드 position Math.round() 정수화
- [x] R2533: BatchInspector 가장자리 정렬 — ⊢L/R⊣/⊤T/B⊥/↔X/↕Y 6방향 edge align
- [x] R2534: SceneView 툴바 회전 버튼 — ↺90/↻90 + ∠0 리셋 (단일 노드 선택 시)
- [x] R2535: BatchInspector 스택 배치 — →/↓ edge-to-edge + 0/4/8px 간격 (2개+ 노드)
- [x] R2536: BatchInspector 미러 — ↔H/↕V scale 부호 반전으로 좌우/상하 뒤집기
- [x] R2537: SceneView 툴바 W/H 인라인 편집 — Enter/blur 시 onResize 직접 호출
- [x] R2538: BatchInspector 랜덤 색상 할당 — 🎲 버튼, 팔레트 10색 순환 적용
- [x] R2539: SceneView breadcrumb — 선택 노드 Root›Parent›Node 계층 경로 (조상 클릭 선택)

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2562** ← R2539 현재
- Branch: dev
- 최근 커밋: `4be0b5bf` (R2539)

## 완료 (R2540~R2554)
- [x] R2540: SceneView Go-to XY 입력 — x,y 좌표 입력 후 Enter로 뷰 중심 이동
- [x] R2541: BatchInspector 리셋 버튼 — ↺1:1 스케일 리셋 + ∠0° 회전 리셋
- [x] R2542: BatchInspector 사이즈 정수화 — ⊹sz 버튼, size.x/y Math.round + UITransform 동기화
- [x] R2543: SceneView 뷰 북마크 — 1/2/3 슬롯 (Ctrl+클릭 저장, 클릭 복원, 키보드 1~3)
- [x] R2544: SceneView 핀 마커 드롭다운 패널 — 📌N 클릭 시 핀 목록, 클릭으로 이동, X 삭제
- [x] R2545: BatchInspector 컴포넌트 타입 필터 — 2개+ 선택 시 공통 타입 버튼, 클릭으로 해당 타입만 선택
- [x] R2546: SceneView 빈 컨테이너 노드 점선 테두리 — isContainer + strokeDasharray
- [x] R2547: BatchInspector 2-노드 위치 교환 — ⇄ 위치 버튼 (정확히 2개 선택 시)
- [x] R2548: BatchInspector Label 텍스트 일괄 적용 — cc.Label/RichText 있는 노드에 Enter로 적용
- [x] R2549: SceneView 형제 순서 맨 앞/뒤 이동 — ⤒/⤓ 버튼 + handleReorderExtreme
- [x] R2550: SceneView 다중 선택 일괄 잠금/해제 — 🔒/🔓± 버튼, allLocked/anyLocked 상태 표시
- [x] R2551: SceneView 컴포넌트 타입 필터 — 상위 5종 자동 추출, 클릭 시 해당 타입 없는 노드 dim
- [x] R2552: NodeInspector 위치 전용 복사/붙여넣기 — P↑/P↓ 버튼 (posClipboard 분리)
- [x] R2553: NodeInspector 크기 전용 복사/붙여넣기 — S↑/S↓ 버튼 (sizeClipboard 분리)
- [x] R2554: NodeInspector 앵커 변경 시 위치 자동 보정 — 체크박스 토글, 9-point 프리셋 클릭 적용

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2577** ← R2554 현재
- Branch: dev
- 최근 커밋: `efd72855` (R2554)

## 완료 (R2555~R2561)
- [x] R2555: NodeInspector Z-order 이동 — 형제 내 인덱스 이동 ▲/▼/⤒/⤓ + 현재 위치 N/T 표시
- [x] R2556: BatchInspector 공통 prop 평균값 표시 — 선택 노드의 opacity/scale/rotation 평균 배지
- [x] R2557: SceneView cc.Label 텍스트 오버레이 — T 버튼으로 Label 텍스트 SVG에 직접 표시
- [x] R2558: SceneView 씬 통계 팝업 — ⓘ 버튼, 노드/비활성/컴포넌트 수, 유형 분포
- [x] R2559: BatchInspector 선택 노드 JSON 내보내기 — ⬇ JSON 버튼, children 제외 배열 다운로드
- [x] R2560: SceneView 미니맵 클릭 팬 — zoom<0.8 시 미니맵 클릭으로 뷰 이동
- [x] R2561: BatchInspector 위치 역전 — ⇄X/⇅Y 버튼으로 선택 노드 위치 순서 반전

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2584** ← R2561 현재

## 완료 (R2562~R2573)
- [x] R2562: NodeInspector 색상 클립보드 — C↑ 복사 / C↓ 붙여넣기 (posClipboard 패턴 확장)
- [x] R2563: NodeInspector 회전 클립보드 — R↑ 복사 / R↓ 붙여넣기 (CC2/3 rotation 양쪽 지원)
- [x] R2564: NodeInspector 스케일 클립보드 — Sc↑ 복사 / Sc↓ 붙여넣기
- [x] R2565: BatchInspector Z축 오프셋 (dZ) — CC3.x 3D 씬 위치 조정 지원
- [x] R2566: SceneView Ctrl+Click 다중 선택 토글 — 표준 에디터 멀티셀렉트 동작
- [x] R2567: NodeInspector 노드 JSON 복사 — {} 버튼으로 children 제외 JSON 클립보드
- [x] R2568: NodeInspector 개별 컴포넌트 ⏸/▶ 토글 — 컴포넌트 헤더에 enabled 빠른 전환
- [x] R2569: BatchInspector opacity 그라데이션 분배 — 255→0/0→255/128→0 선형 보간
- [x] R2570: BatchInspector 자동 그리드 배치 — ⊞2열/⊞3열/⊞√N 정렬
- [x] R2571: NodeInspector ⌊⌉All — 위치/크기/스케일 전체를 정수 픽셀로 반올림
- [x] R2572: BatchInspector 랜덤 산포 — ±50/100/200px 반경 내 random scatter
- [x] R2573: BatchInspector ⊕0 그룹 원점화 — 그룹 평균 중심을 (0,0)으로 이동

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2596** ← R2573 현재

## 완료 (R2574~R2577)
- [x] R2574: NodeInspector 불투명도 클립보드 — o↑ 복사 / o↓ 붙여넣기 (rotClipboard 패턴 확장)
- [x] R2575: BatchInspector 스케일 반전 — ↔H scaleX / ↕V scaleY 부호 반전으로 선택 노드 미러
- [x] R2576: SceneView 노드 크기 레이블 오버레이 — W×H 버튼으로 모든 노드 치수 표시 토글
- [x] R2577: BatchInspector ⌊⌉All — 선택 노드 위치/크기를 정수 픽셀로 일괄 반올림

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2600** ← R2577 현재 (2600 달성)
- Branch: dev
- 최근 커밋: `16457231` (R2577)

## 완료 (R2578~R2595)
- [x] R2578: SceneView 노드 불투명도 α% 오버레이 — α% 버튼 (100% 제외)
- [x] R2579: SceneView 컴포넌트 배지 오버레이 — ⚙ 버튼, 16종 아이콘 맵
- [x] R2580: BatchInspector 이름 목록 복사 — 📋 이름 버튼으로 선택 노드 이름 클립보드
- [x] R2581: SceneView 검색 결과 ‹/› 순환 — 검색 중 ‹/› 버튼으로 매칭 노드 순회
- [x] R2582: BatchInspector Z-order 재정렬 — 형제 내 선택 노드를 X↗/Y↗ 위치 기준 정렬
- [x] R2583: SceneView 회전값 ∠° 오버레이 — ∠° 버튼, 비영 회전 노드에 각도 표시
- [x] R2584: BatchInspector UUID 목록 복사 — 📋 UUID 버튼
- [x] R2585: SceneView 노드 이름 레이블 오버레이 — 이름 버튼, 줄임 처리
- [x] R2586: SceneView 앵커 포인트 전체 오버레이 — ⊕ 버튼, 십자선 + 원형 마커
- [x] R2587: BatchInspector 위치 대칭 이동 — ⟺X/⟺Y, 바운딩박스 중심 기준
- [x] R2588: SceneView 비흰색 노드 색상 스와치 오버레이 — 🎨 버튼
- [x] R2589: BatchInspector 정확히 2노드 선택 시 위치 교환 — ⇄ 위치 버튼
- [x] R2590: SceneView 우클릭 메뉴 '동일 이름 모두 선택' — 중복 이름 노드 일괄 선택
- [x] R2591: SceneView 자식 수 배지 오버레이 — ↳N 버튼, 자식 있는 노드에 배지
- [x] R2592: SceneView 깊이 레이블 오버레이 — D: 버튼 + flatNodes.map에 depth 추가
- [x] R2593: BatchInspector 랜덤 회전 — 🎲rot ±5/15/45° 프리셋
- [x] R2594: BatchInspector 랜덤 스케일 변동 — 🎲sc ±10/25/50% 프리셋
- [x] R2595: BatchInspector 크기 통일 — =W/=H/=WH (첫째 노드 기준)
- [x] R2596: BatchInspector tint 색상 그라디언트 — from/to 색상 RGB 선형 분배
- [x] R2597: BatchInspector scale 배수 적용 — ×0.5, ×2, 사용자 정의
- [x] R2598: SceneView flip 오버레이 — 음수 scale 노드에 ↔↕ 배지
- [x] R2599: BatchInspector size 배수 적용 — ×0.5, ×2, 사용자 정의
- [x] R2600: SceneView 다중 선택 bounding box — 2개 이상 선택 시 파란 점선 박스
- [x] R2601: SceneView component 타입 배지 — 주요 컴포넌트 단축명 우하단 배지
- [x] R2602: BatchInspector active 반전 — 선택 노드 active 개별 반전
- [x] R2603: SceneView tag 배지 — tag≠0 노드에 #N 배지
- [x] R2604: BatchInspector rotation 균등 분배 — from→to 각도 분배
- [x] R2605: BatchInspector scale 균등 분배 — from→to 스케일 분배
- [x] R2606: BatchInspector C↺ color 초기화 — tint 색상 흰색으로 reset
- [x] R2607: SceneView 중복 이름 노드 강조 — 같은 이름 2개 이상 주황 점선
- [x] R2608: BatchInspector rotation 스냅 — 15°/45°/90° 배수 반올림
- [x] R2609: BatchInspector size 스냅 — 8/16/32px 배수 반올림
- [x] R2610: SceneView rotation 방향 화살표 — 비영 회전 노드에 핑크 화살표
- [x] R2611: BatchInspector 위치 셔플 — Fisher-Yates 무작위 위치 교환
- [x] R2612: BatchInspector rotation 오프셋 — +90/-90/±180/사용자 정의 추가
- [x] R2613: BatchInspector sizeW 균등 분배 — from→to 너비 분배
- [x] R2614: BatchInspector sizeH 균등 분배 — from→to 높이 분배
- [x] R2615: SceneView W×H 크기 텍스트 오버레이 — 청록색 W×H 배지
- [x] R2616: BatchInspector posZ 균등 분배 — CC3.x position.Z 분배
- [x] R2617: SceneView 원점 십자선 오버레이 — CC (0,0) 녹색 십자선
- [x] R2618: BatchInspector posX 균등 분배 — position.X from→to 분배
- [x] R2619: BatchInspector posY 균등 분배 — position.Y from→to 분배
- [x] R2620: SceneView 스케일 배수 텍스트 오버레이 — scale≠1 노드에 황색 ×sx,sy
- [x] R2621: BatchInspector opacity 배수 스냅 — 64/128/192/255 배수 반올림
- [x] R2622: BatchInspector active 교차 패턴 — 홀수=on/짝수=off 교번
- [x] R2623: BatchInspector position XY 스냅 — 1/8/16/32px 배수 반올림
- [x] R2624: SceneView 레이어 배지 오버레이 — CC3.x 비기본 레이어 노드에 레이어명
- [x] R2625: SceneView 이벤트 핸들러 배지(⚡) — Button/Toggle/Slider 노드 강조
- [x] R2626: BatchInspector 무지개 색상 분배 — HSL 균등 색조 무지개 패턴
- [x] R2627: BatchInspector Label 텍스트 일련번호 — +번호/번호만 두 모드
- [x] R2628: BatchInspector 앵커 X/Y 균등 분배 — anchor.x/y from→to
- [x] R2629: SceneView 안전 영역 가이드 — 90% 황색 + 16:9 청색 점선
- [x] R2630: SceneView 삼분법 가이드 — 3×3 Rule of Thirds 보라색 점선
- [x] R2631: BatchInspector 색상 팔레트 추출 — 고유 색상 스와치 + 클릭 적용
- [x] R2632: BatchInspector 위치 X/Y 미러 — 그룹 중심 기준 수평/수직 반전
- [x] R2633: BatchInspector Label 폰트 크기 균등 분배 — fontSize from→to
- [x] R2634: BatchInspector 크기 통일 — 첫째 노드 W×H로 나머지 W만/H만/둘다
- [x] R2635: BatchInspector 선택 홀수/짝수 필터 — 짝수/홀수 인덱스만 유지

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2640+** ← R2635 현재 (세션 컴팩션 후 계속)
- Branch: dev
- 최근 커밋: `c8bc5262` (R2635)

## 다음 예정 (R2636+)
- CC Editor 패리티 계속: 씬뷰 추가 UX, Inspector 개선
- 남은 이슈: ISSUE-007(npm audit), ISSUE-008(SDK), ISSUE-009(번들)

## ⚠️ 영구 규칙 — 이슈 최우선 처리 (모든 라운드에 적용)

> 매 라운드 종료 후, 신규 기능 진행 전에 반드시 먼저 확인:
> ```bash
> ls C:/Users/a/Documents/claude-desktop/issues/*.md | grep -v README
> ```
> - `priority: high` 또는 `bug` 유형 → 즉시 현재/다음 라운드에서 처리
> - `priority: medium` → 다음 라운드 1순위 (ROADMAP 신규 기능보다 앞)
> - `priority: low` → 10라운드마다 기술부채 전용 라운드
> - medium 이슈 3개 이상 → 이슈 전용 라운드 단독 편성
>
> **이슈가 처리되지 않은 상태에서 신규 기능 개발 절대 금지.**

## 누적 이슈 (QA 체크포인트에서 발견된 기존 이슈)
- ISSUE-001: shell:true 입력검증 없음 (Critical — 기존 누적, R2316에서 부분 완화)
- ISSUE-007: npm audit 18 취약점 (기존 누적 — 모두 breaking change 필요)
- ISSUE-008: SDK 업그레이드 (기존 누적)
