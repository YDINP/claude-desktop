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

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2413** ← R2378 현재
- Branch: dev
- 최근 커밋: `a88cb67` (R2378), `fa66902` (R2377), `7986369` (R2376), `464bd91` (R2375), `5b8cca4` (R2374)

## 갭 수정 완료 상태
- **BatchInspector bare shorthand → ALL DONE** (R2298-R2305)
- **BatchInspector 명시적 prop → ALL DONE** (R2306-R2311)
- **단일노드 인스펙터 갭 → ALL DONE** (R2306-R2311)
- **`_N$` 패턴 총 550건** (CocosPanel.tsx 기준)

## 다음 예정 (R2332+)
- 기능 탐색: 대부분의 씬뷰/Inspector 기능이 이미 구현됨 (매우 comprehensive)
- 미발견 영역: 씬 비교, prefab 저장, 새로운 UX 개선 아이디어 탐색 필요
- 남은 이슈: ISSUE-007(npm audit), ISSUE-008(SDK), ISSUE-009(번들)

## 누적 이슈 (QA 체크포인트에서 발견된 기존 이슈)
- ISSUE-001: shell:true 입력검증 없음 (Critical — 기존 누적, R2316에서 부분 완화)
- ISSUE-007: npm audit 18 취약점 (기존 누적 — 모두 breaking change 필요)
- ISSUE-008: SDK 업그레이드 (기존 누적)
