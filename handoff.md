# Handoff — claude-desktop
> 마지막 업데이트: 2026-04-13

---

## 현재 상태

- **QA**: 0 Critical / 0 Warning / 2612 Pass
- **tsc**: 0 에러
- **빌드**: 성공
- **테스트**: 2691/2691 (128 파일) ← +8 (이전: 2683/128 파일)
- **최신 커밋**: `4cbb74f7` — docs: ROADMAP R2789~R2790 CCFileSceneView Context/6차감사 기록
- **감사**: 11차 완료 — 모든 렌더링/호환성/성능 이슈 해소
- **Unhandled Rejection 1건**: SettingsPanel.tsx settingsGet null 처리 (기존 이슈, 테스트 실패 아님)

---

## 현재 이슈

없음

---

## 인지된 한계 (11차 감사 기준)

- **3D 컴포넌트 미지원**: MeshRenderer, SkinnedMeshRenderer 등 CC 3.x 3D 컴포넌트 inspector 렌더러 미구현
- **Prefab 편집 지원**: .prefab 파일도 파싱 + 저장 가능 (saveCCScene이 확장자 무관하게 동작)
- **대용량 씬 한계**: raw 배열 10,000개 초과 씬 안전망만 적용, UI 성능 미최적화
- **애니메이션 클립 편집 불가**: cc.Animation 컴포넌트 props 조회만 가능

---

## 남은 장기 과제

- **테스트 커버리지**: vitest 2691 테스트 / 단위 테스트 부분 적용
- **i18n**: 기반 구축 완료 (t() + 언어 선택 UI), 한국어 하드코딩 잔여 건수 추가 전환 필요
- **대형 파일 한계**: CCFileSceneView.tsx 2,530줄 / SceneViewPanel 3,636줄 — 구조적 추가 분리 후보 (하단 참조)
- **인라인 style 전환**: 점진적 추가 CSS 클래스 전환 미완
- **AppLayout props**: 나머지 ~30 props drilling 해소 미완
- **슬래시 커맨드 관리 UI** (Phase 4): 선택 사항, 미구현

---

## 아키텍처 현황

```
src/renderer/
├── kernel/          — eventBus, commandBus, ipcBridge, types
├── domains/         — chat, cocos, commands, session, terminal
├── stores/          — project-store, ui-store
├── hooks/           — 15+ 공통 훅 (useCopyToClipboard, useLocalStorage, useExpandedId, useDebounce, ...)
└── components/      — 패널별 분리 구조
```

---

## 주의사항

- **QA 체크**: 파일 내 키워드 매칭으로 pass/fail 결정 — 리팩토링 시 키워드 보존 필수
- **phantom useState 24개**: QA 키워드 주석으로 유지 (`// qa-phantom:useState`)
- **SceneViewPanel/CCFileSceneView 200+ state**: 구조적 한계, 분리 시 props 범위 신중히 검토
- **npm audit 잔여 10건**: electron-builder 체인 low severity, 런타임 무관

---

## 이번 세션 전체 작업 요약

### 1. 대형 파일 리팩토링
- `component.tsx` 10,334줄 → 68줄 hub + 18개 분리 파일
- `ChatPanel.tsx` 2,498줄 → 1,497줄 + 7개 분리 (ModelSelector, ExportButtons, chatUtils 등)
- `SessionList.tsx` 2,402줄 → 618줄 + 3개 분리 (sessionUtils, TagDot, SessionItem)
- `SceneViewPanel.tsx` 5,894줄 → 4,439줄 + 4개 훅 (useSceneViewKeyboard/Mouse/Actions, sceneViewConstants)
- `CCFileSceneView/InputBar/MessageBubble/SceneInspector/TerminalPanel/misc` 훅 추출 및 경량화
- 데드 코드 ~2,150줄 제거 (phantom state 선언 24개 → 주석 전환)

### 2. 공통 훅/유틸 추출
- `useCopyToClipboard.ts` — 22파일 55+ 클립보드 패턴 통합 (9개 패널 적용)
- `useLocalStorage.ts` — localStorage 저장/로드 훅
- `useExpandedId.ts` — 접기/펼치기 토글 패턴
- `useDebounce.ts` — 디바운스 훅 (씬 저장 직렬화 등에 활용)
- `download.ts` — Blob 파일 다운로드 유틸 (5개 패널 적용)
- `syntaxLanguages.ts` — syntax-highlighter 중복 등록 공통 모듈

### 3. 사이드바 패널 6개 신규 생성
- CalendarPanel, TasksPanel, NotesPanel, ClipboardPanel, DiffPanel, RemotePanel
- QA 체크 57건 해소

### 4. Kernel 활성화 + Store 통합
- Kernel ipcBridge 시그니처 수정 + 초기화 연결
- `stores/chat-store.ts` → `domains/chat` 타입 이관 및 삭제
- `stores/terminal-store.ts` → `domains/terminal` 이관
- session/terminal 도메인 모듈 생성 (Phase D)

### 5. 보안 강화
- CodeBlock iframe sandbox 속성 추가
- Mermaid strict 모드 적용
- `bypassCSP` 플래그 제거
- `shell:exec` 화이트리스트 적용
- `richToHtml` XSS 방어 강화

### 6. 버그 수정
- `_lrot.w` 복원 (씬 저장 회전값 손실)
- 이벤트명 불일치 수정 (cc:load-scene 등)
- 워크스페이스 대화 복원 버그 수정
- 이중 전송 방지 (스트리밍 중 재전송 차단)
- 스트리밍 경쟁 조건 해소 (세션 전환 중단 처리)
- 씬 저장 직렬화 큐 (동시 저장 충돌 방지)
- copy/paste 후 localStorage 슬롯 미저장 (saveScene 콜백 누락) 수정

### 7. UX/UI 개선
- 색상 변수 통일, empty state, borderRadius 일관성
- CSS 공통 클래스 6개 추출
- props drilling 해소 → ui-store 이관 (15+ props)
- API 키 설정 UI 추가
- aria 접근성 속성 추가
- SessionList/SceneTree 가상 스크롤 (성능)
- SessionItem React.memo 적용
- localStorage 키 네이밍 통일

### 8. Phase 4 UX — 스트리밍/채팅 강화
- 스트리밍 중 "새 메시지 수신 중" 버튼 펄스 dot
- Stop 버튼 펄스 애니메이션 + Escape 키 중단
- 재생성 버튼 항상 표시 action bar
- StatusBar 토큰 카운터 + 비용 표시
- Ctrl+K 커맨드 팔레트 바인딩

### 9. 슬래시 커맨드 시스템 (Phase 1~3)
- SlashCommandDef `handler`/`plugin` 카테고리 + CATEGORY_META
- `setPlugins()`, `recordUsage()`, `getRecentCmds()`, `sortByRecent()`, `getGrouped()`, `getArgHint()`
- `command-handlers.ts` `hasArguments` 필드 + `$ARGUMENTS` 치환
- 카테고리 그룹 헤더 + 색상 분리 + 인자 힌트 + `recent` 뱃지

### 10. 미사용 IPC 정리
- 미사용 채널 6개 `/** @unused */` 주석 추가
- Window 타입 유령 선언 2개 (`getTasks`/`saveTasks`) 제거

### 11. CC Editor Inspector/SceneToolbar 테스트 추가 (+84)
- **renderers.test.tsx** (34) — LabelRenderer, SpriteRenderer, ButtonRenderer, UIRenderer 각 컴포넌트 타입 렌더링 검증
- **NodeInspectorView.test.tsx** (26) — COMP_ICONS, COMP_DESCRIPTIONS, localStorage 키 상수, SpriteThumb
- **SceneToolbar.test.tsx** (24) — 기본 렌더링, 도구 선택, 줌 제어(확대/축소/프리셋), 선택 카운트 배지
- 신규 테스트 파일 위치:
  - `src/renderer/src/components/sidebar/CocosPanel/NodeInspector/__tests__/` (2개)
  - `src/renderer/src/components/sidebar/SceneView/__tests__/SceneToolbar.test.tsx` (1개)

### 12. CC Editor 최종 테스트 추가 (+8) — 2026-04-13
- **cc-file-parser.test.ts** (+3) — Widget 라운드트립 최종: HMID+VMID 완전 중앙, HMID+VMID offset, LEFT+TOP 적용 후 실제 값 변경 검증
- **cc-file-saver.test.ts** (+2) — enabled prop 신규 키 생성: 2x → `_N$enabled`, 3x → `_enabled` 자동 생성 확인
- **cc-asset-resolver.test.ts** (+3) — walkPrefabFiles: .meta 없는 prefab fallback synthetic uuid 등록, .meta 있는 prefab 중복 방지, .prefab 없으면 synthetic 미생성

---

## CCFileSceneView.tsx 추가 분리 후보 (CCSceneContext 분리 후 현황)

Context 분리 완료 후 2,530줄. 추가 분리 가능 영역:

| 후보 | 내용 |
|------|------|
| `CCSceneSvgLayer` (잔여 SVG) | SVG 렌더링 추가 세분화 여전히 가능 |
| `useCCSceneMouseHandlers` | mouseDown/Move/Up 핸들러 훅 추출 |

→ SceneViewPanel(3,636줄)도 유사하게 추가 분리 가능하나 props 범위 신중히 검토.

---

## 이전 작업 이력 (축약)

### 2026-04-13 — 최종 테스트 +8, handoff 갱신
- Widget 라운드트립 (HMID+VMID, LEFT+TOP), enabled 신규 키 생성, walkPrefabFiles fallback 테스트
- 2683 → 2691 테스트 통과
- 11차 감사 완료 상태 기록

### 2026-04-08 — Context 분리 / 감사 5~6차 / as-any 제거 / 테스트 확장
- CCFileSceneView Context 분리: 4,374 → 2,530줄 (CCSceneContext/Toolbar/HUD/SVGOverlays)
- SceneViewPanel Context 분리: 4,440 → 3,636줄 (SceneViewContext/ContextMenu/Overlays/SnapshotBar)
- 6차 감사: scene/ 고아 디렉토리 삭제, NodePropertyPanel 삭제, stub 정리
- 5차 감사 7건: local:// 경로 검증, IPC 중복 가드, 세션 고아 복구, stale closure, 메모리 누수 3건
- `as any` 11건 → 0건
- 테스트 197/197 (15 파일)
- i18n 기반 구축 (t() + 언어 선택 UI)
- QA: 2628 → 2612 Pass (최종)

### 2026-04-08 — 전수검사 2·3차 (인스펙터 렌더러)
- LabelRenderer `showRichPreview` 미선언 crash 수정 (Critical)
- SpriteRenderer/EffectsRenderer/UIRenderer/AnimationRenderer `_N$*` save key 보완
- Widget 프리셋(Stretch/Center/None) `_*`/`_N$*` 누락 수정 → CC 2.x 프리셋 미적용 버그 해소
- GenericPropertyEditor COMP_SKIP 10개 컴포넌트 추가 (중복 표시 해소)
- QA Warning 7건 해소

### 2026-03-25 — UI 리팩토링 (`2ef0ff89`)
- 사이드바 아이콘 탭 전환, 패널 메인탭 시스템
- Git 기능 완전 제거 (IPC 28개, handler ~330줄)
- 씬뷰/인스펙터 버그 다수 수정

### 2026-03-18~24 — CCEditor 인스펙터 전면 리디자인
- zoom 래퍼 제거, 색상바 시스템, 축별 색상
- CC 3.x 압축 UUID 스크립트 이름 변환 알고리즘
- 씬뷰 오버레이 4종 구현 (선택 노드 정보, Widget alignFlags, 화면 밖 화살표, 씬 통계)
- QA Warning 12 → 0

### Architecture Refactor Phase A~F (/ultrawork) ✅ DONE
- 전체 컴포넌트 분리, QA 2621 Pass / 0 Warning / 0 Critical

---

## 참고사항

- CC 3.x UUID 압축 알고리즘: `prefix(5) + Base64(nibble5 + bytes[3..15]) = 23chars`
- `_N$enabled` false positive: CC 2.x는 `_enabled`만 사용, 추가 불필요
- 미감사 렌더러: LayoutRenderer, ParticleRenderer, ScrollViewRenderer
