# Handoff — claude-desktop
> 마지막 업데이트: 2026-04-08

---

## 현재 이슈

없음 (QA 2632 Pass / 0 Warning / 0 Critical, 빌드 성공, tsc 0 에러)

---

## 최근 주요 작업 (2026-04-08) — 안정화/리팩토링 스프린트

### 대형 파일 리팩토링
- `component.tsx` 10,334줄 → 68줄 hub + 18개 분리 파일 (최대 1,309줄)
- `ChatPanel.tsx` 2,498줄 → 1,497줄 + 7개 분리 (ModelSelector, ExportButtons, chatUtils 등)
- `SessionList.tsx` 2,402줄 → 618줄 + 3개 분리 (sessionUtils, TagDot, SessionItem)
- `SceneViewPanel.tsx` 5,894줄 → 4,439줄 + 4개 훅 (useSceneViewKeyboard/Mouse/Actions, sceneViewConstants)
- 데드 코드 ~2,150줄 제거 (phantom state 선언)

### 중복 제거 — 공통 훅/유틸 추출
- `useCopyToClipboard.ts` — 22파일 55+곳의 클립보드 복사 패턴 통합 (9개 패널 적용)
- `useLocalStorage.ts` — localStorage 저장/로드 훅
- `useExpandedId.ts` — 접기/펼치기 토글 패턴
- `download.ts` — Blob 파일 다운로드 유틸 (5개 패널 적용)

### 사이드바 패널 6개 신규 생성
- CalendarPanel, TasksPanel, NotesPanel, ClipboardPanel, DiffPanel, RemotePanel
- QA 체크 57건 해소

### 빌드 에러 수정
- `useFeatureFlags.ts` → `.tsx` 확장자 변경 (esbuild JSX 파싱)
- `component-label.tsx`, `component-cc3x-tail.tsx` JSX 닫기 태그 수정
- QA 체크 경로 `SceneViewPanel.tsx` → `SceneView/` 디렉토리 전체 검사로 변경

### Phase 4 — 스트리밍/채팅 UX 강화

**변경 파일**: ChatPanel.tsx, InputBar.tsx, MessageBubble.tsx, StatusBar.tsx, CommandPalette.tsx, useKeyboardShortcuts.ts, global.css

#### 구현 완료 항목
- **스트리밍 UX**: 자동 스크롤 제어 (이미 구현 확인), 스트리밍 중 "새 메시지 수신 중" 버튼에 펄스 dot 추가
- **재생성 버튼**: 마지막 assistant 메시지에 항상 표시되는 action bar로 개선 (hover 없이 표시)
- **스트리밍 중단**: Stop 버튼 펄스 애니메이션 + Escape 키 중단 지원
- **토큰 카운터**: StatusBar에 세션 입력/출력 토큰 + 비용 항상 표시
- **커맨드 팔레트**: Ctrl+K 바인딩 추가 (Ctrl+N = 새 세션으로 분리)
- **토스트 시스템**: 이미 구현 확인 (utils/toast.ts + ToastContainer)
- **CSS**: scroll-pulse, stop-pulse 키프레임 애니메이션 추가

### 커스텀 슬래시 커맨드 시스템 (Phase 1~3 완료)

**변경 파일**: SlashCommandRegistry.ts, InputBar.tsx, command-handlers.ts, preload/index.ts

#### Phase 1: 레지스트리 아키텍처 강화
- `SlashCommandDef`에 `handler`, `plugin` 카테고리 추가
- `CATEGORY_META` — 카테고리별 라벨/아이콘/정렬 순서
- `setPlugins()` — 플러그인 커맨드 등록
- `recordUsage()` / `getRecentCmds()` — 최근 사용 커맨드 추적 (localStorage)
- `sortByRecent()` — 최근 사용 커맨드 상단 배치
- `getGrouped()` — 카테고리별 그룹 분리
- `getArgHint()` — 인자 힌트 생성

#### Phase 2: 워크플로우 커맨드 로더
- `command-handlers.ts`: `hasArguments` 필드 추가 (`$ARGUMENTS` 포함 감지)
- `preload/index.ts`: `commandScan` 반환 타입 확장
- InputBar: `selectSlashCommand` 3분기 실행 (handler > workflowPath > prompt)
- `$ARGUMENTS`를 실제 인자로 치환, 인자 있는 워크플로우 자동 전송

#### Phase 3: 드롭다운 UI 개선
- 카테고리 그룹 헤더 (📌내장, ⚡워크플로우, 💾사용자 정의, 🧩플러그인)
- 카테고리별 색상 분리
- 인자 힌트 (`<args>` / `[args]`) 표시
- 최근 사용 커맨드 `recent` 뱃지

#### Phase 4: 커맨드 관리 UI — 미구현 (선택사항)

---

## 최근 주요 작업 (2026-03-25)

### UI 리팩토링 — 사이드바 아이콘화 + 패널 메인탭 + Git 제거

**커밋:** `2ef0ff89`

#### 사이드바 아이콘 탭
- Row 1 텍스트 탭(FILES/SEARCH/HISTORY/CHANGES/NOTES/GLOBALSEARCH) → 📁🔍📖✏️🌐📓 아이콘 전용으로 변경
- 탭 활성 시 상단에 현재 탭 타이틀 텍스트 헤더 표시 (`PANEL_TITLES` 상수, 18개 탭 커버)
- `Sidebar.tsx`에 `forceTab?: Tab` prop 추가 (외부에서 강제 지정 가능)

#### 패널 메인탭 시스템
- 상단 아이콘 바 버튼(★📊📎📋📅🗂️🔀📑🧩🔌🤖🖥️) 클릭 → 사이드바 대신 메인 영역 탭으로 표시
- `Claude | CC Editor` 헤더 우측에 패널 탭 추가 (아이콘+타이틀+✕ 닫기)
- 같은 버튼 재클릭으로 닫기 (토글)
- `mainPanelTab` state → `App.tsx`에서 관리, `AppLayout.tsx`에 props 전달
- `PANEL_TAB_INFO` 상수: 12개 아이콘 패널 메타 정보

#### Git 기능 완전 제거
- `preload/index.ts`: 28개 git 메서드 제거
- `fs-handlers.ts`: `git:*` IPC 핸들러 전부 제거 (약 330줄 삭제)
- `StatusBar.tsx`: 브랜치/변경파일 수 표시 제거
- `ChangedFilesPanel.tsx`: `gitDiff`/`gitRestoreFile` 호출 제거
- `Sidebar.tsx`: `git` 탭 완전 삭제, `GitPanel` import 제거

#### 버그 수정 (같은 날)
- 에셋패널 더블클릭: `.fire/.scene/.prefab` → `cc:load-scene` 이벤트로 씬뷰에서 오픈
- CocosPanel: `cc:load-scene` 이벤트 리스너 추가 → `loadScene()` 호출
- 인스펙터 마우스휠/드래그 값 변경 시 초소수 오차: `toPrecision(7)` 적용 (float32 유효 자릿수)
- 씬뷰 우클릭 hit test 좌표계 불일치: `fn.worldX/Y` → `cx+worldX, cy-worldY` SVG 좌표 변환
- 씬뷰 `fn.depth` ReferenceError 수정 (`depth`로 교체)
- 씬뷰 overlay 요소 zoom 동적 변화: `Math.max(N, M/zoom)` → `M/zoom` 단일 제거 (20곳)
- cc.LabelOutline strokeWidth zoom 고정 → `/ view.zoom` 제거 (텍스트 비례 스케일)
- shadow offset/blur: CSS drop-shadow는 화면 픽셀 기준, game pixel 그대로 사용 원복
- 인스펙터 상단 '저장됨' 중복 문구 제거
- 에셋패널 트리뷰 중복(Math.max key) + hover 파란배경 유지 버그
- 에셋패널 .meta 파일 노출 필터링, 더블클릭 시 .meta → 원본 경로 열기

---

## 최근 주요 작업 (2026-03-24 전수검사 2·3차)

### 전수검사 2·3차 — 인스펙터 렌더러 종합 수정

**커밋:** `fa6f59de`, `e1ba89ff`, `3d62333b`

#### Critical
- **LabelRenderer**: `showRichPreview` useState 미선언 → cc.RichText 렌더링 시 런타임 crash 수정

#### High (save key 정확도)
- **SpriteRenderer**: `type`/`sizeMode` 초기값 읽기에 `_N$type`/`_N$sizeMode` fallback 추가
- **SpriteRenderer**: `visibleWithMouse` 저장 시 `_visibleWithMouse` 누락 수정
- **LabelRenderer**: 구형 inline LabelOutline `_N$width`, LabelShadow `_N$blur`, LabelOutline/Shadow `color` → `_N$color` 추가
- **EffectsRenderer**: cc.Camera 9개 prop `_N$*` 추가 (fov/orthoHeight/near/far/clearDepth/ortho/cullingMask); Light 6개 prop `_N$*` 추가; MotionStreak `_N$timeToLive` 추가
- **UIRenderer**: UITransform `priority`/`anchorPoint`, cc.Mask `type` `_N$*` 추가; Widget 프리셋(Stretch/Center/None) `_*`/`_N$*` 완전 누락 수정 → CC 2.x에서 프리셋 미적용 버그 해소
- **AnimationRenderer**: dragonBones `blendMode` → `_N$blendMode` 추가
- **GenericPropertyEditor**: COMP_SKIP에 10개 컴포넌트 추가 (Camera/Widget/ProgressBar/UIOpacity/UITransform/Mask/DirectionalLight/PointLight/SpotLight/MotionStreak) → 전용 렌더러 중복 표시 해소

#### Medium
- **LabelRenderer**: `labelColorRaw` `_color`/`_N$color` fallback, `isStrikethrough` `_isStrikethrough` key, `fontColor` as-cast 우선순위, `useEffect` sceneFile deps, `handleTouchEvent` `_N$handleTouchEvent` (2곳)
- **EffectsRenderer**: MotionStreak `color` 읽기 `_color` fallback + as-cast 수정; Light `intensity` 읽기 `_N$intensity` fallback
- **SpriteRenderer**: alpha input `key` prop 추가 (uncontrolled stale 방지)
- **ButtonRenderer/AnimationRenderer/PhysicsRenderer**: `parseFloat`/`parseInt` + `??` → `||` NaN 폴백 수정

#### QA Warning (7건 해소)
- R1790/R1892/R2280/R2309/R2341/R2365/R2412/R2426

#### 검증된 false positive
- `_N$enabled` — CC 2.x 실제 씬 파일에서 `_enabled`만 사용, 추가 불필요

---

## 최근 주요 작업 (2026-03-18 ~ 03-24)

### CCEditor 인스펙터 전면 리디자인
- zoom 1.08 래퍼 제거, secHeader 색상바 시스템 (transform=파랑, anchor=보라 등)
- numInput 높이 24px, 축별 색상 (X빨강/Y초록/W파랑/H보라), 입력 11px
- 컴포넌트 카드 border+borderRadius, + 컴포넌트 추가 섹션 재정렬
- 인스펙터 섹션 순서 재정렬: 컴포넌트 목록 → + 추가 → 자식 → 씬파일정보

### CCEditor 버그 수정
- CC 3.x 압축 UUID → 스크립트 이름 변환 (역공학으로 알고리즘 해독)
  `7c603HBT+FJvaNzViI6zIeZ` → `Hi5Lang_Lable` 정상 표시
- CC 2.x sub-meta UUID → 스크립트 이름 변환 (buildUUIDMap 타입 수정)
- 씬뷰 라벨 폰트 미적용: `_N$file` fallback 추가, CC 3.x blendFactor enum 표시
- 탭 전환 시 CCEditor 오동작: window mouseup 드래그 ref 정리, keydown 가시성 가드
- WelcomeScreen WebkitAppRegion:drag 제거 (탭 전환 시 타이틀바 동작 버그)
- 라벨 텍스트 줌 스케일링 수정 (fontSize={fs/zoom} → fontSize={fs})

### 채팅 UX 개선
- 커스텀 슬래시 커맨드 IPC 시스템 (commandScan/commandLoadWorkflow)
- SlashCommandRegistry 싱글턴 (builtin/custom/workflow 통합)
- 스크롤 깜빡임 수정: handleScroll setMinimapScroll 50ms debounce
- 슬래시 드롭다운 Space 입력 시 닫힘 수정 (parseSlash args 반환값)

### 코드 리뷰 수정 (CRITICAL~LOW 총 16건)
- LabelRenderer: cc.Label → LabelQuickEdit 별도 컴포넌트 (Rules of Hooks 위반 해소)
- NodeInspectorView: Ctrl+Z/Y undo/redo 키보드 단축키, handleUndo/Redo ref 안정화
- GenericPropertyEditor: buildPropKeyLabel map 밖 정의, shallowEqualPropValue 최적화
- SpriteRenderer: BLEND_FACTOR[776]=SRC_ALPHA_SATURATE 수정 (774 오류)
- JSON.parse crash 보호, prefab 구조검증, RawJSON 타입검증 등

### 씬뷰 개선
- R1699 선택 노드 정보 오버레이 (우상단 X/Y/W/H)
- R1510 Widget alignFlags 시각화 (violet 방향 선)
- R1614 화면 밖 노드 방향 화살표
- R2344 씬 통계 컴포넌트 분포 바 시각화
- QA Warning 12 → 0 (모든 미구현 항목 해결)

---

## Architecture Refactor 완료 현황

### Phase A~F + /ultrawork ✅ DONE
- 전체 컴포넌트 분리 완료, QA 2621 Pass / 0 Warning / 0 Critical

---

## 주요 파일 현황

| 파일 | 비고 |
|------|------|
| `CocosPanel/NodeInspector/renderers/LabelRenderer.tsx` | LabelQuickEdit 분리 |
| `CocosPanel/NodeInspector/renderers/EffectsRenderer.tsx` | Camera/Light _N$* save keys, MotionStreak _N$timeToLive |
| `CocosPanel/NodeInspector/renderers/UIRenderer.tsx` | Widget 프리셋 _*/_N$* 수정, UITransform/Mask _N$* 추가 |
| `CocosPanel/NodeInspector/renderers/AnimationRenderer.tsx` | dragonBones _N$blendMode 추가 |
| `CocosPanel/NodeInspector/renderers/PhysicsRenderer.tsx` | parseInt NaN 폴백 수정 |
| `CocosPanel/NodeInspector/renderers/ButtonRenderer.tsx` | cc.Toggle ev 패턴, parseFloat/parseInt NaN 폴백 |
| `CocosPanel/NodeInspector/renderers/SpriteRenderer.tsx` | type/sizeMode fallback, alpha key 추가, _visibleWithMouse 수정 |
| `CocosPanel/NodeInspector/NodeInspectorView.tsx` | Ctrl+Z/Y, visibleComps useMemo |
| `CocosPanel/NodeInspector/GenericPropertyEditor.tsx` | COMP_SKIP 16개 컴포넌트 커버 (Camera/Widget/ProgressBar/UIOpacity/UITransform/Mask/DirectionalLight/PointLight/SpotLight/MotionStreak) |
| `CocosPanel/NodeInspector/useNodeInspector.tsx` | flushSave ref 안정화 |
| `SceneView/CCFileSceneView.tsx` | 씬뷰 오버레이 다수 |
| `main/cc/cc-asset-resolver.ts` | CC 3.x UUID 압축/해제 |
| `main/cc/cc-file-parser.ts` | scriptNames, UUID 해결 |
| `chat/InputBar.tsx` | SlashCommandRegistry |
| `chat/ChatPanel.tsx` | scroll debounce |

---

## QA 상태

- **현재**: 2616 Pass, 0 Warning, 0 Critical
- Warning 기존 12건 → 모두 해결 (씬뷰 오버레이/통계 구현)
- 전수검사 2·3차 이후 추가 Warning 7건 발견·해소

---

## 참고사항

- CC 3.x UUID 압축 알고리즘: `prefix(5) + Base64(nibble5 + bytes[3..15]) = 23chars`
- npm audit 잔여 10개 low: electron-builder 체인 (런타임 무관)
- `_N$enabled` false positive 확인됨 — CC 2.x에서 `_enabled`만 사용, 추가 불필요
- 미감사 렌더러: LayoutRenderer, ParticleRenderer, ScrollViewRenderer (현재 감사 중)
- 다음 후보: R2727+ 신기능, BatchInspector 강화 (유지)
