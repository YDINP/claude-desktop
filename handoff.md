# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-17

---

## 현재 이슈

없음 (QA 2615 Pass / 0 Warning / 0 Critical)

---

## Architecture Refactor 완료 현황

**PRD**: `PRD-architecture-refactor.md`
**아키텍처 가이드**: `.claude/CLAUDE.md` (설계 규격/컨벤션 문서)

### Phase A — Kernel 구축 ✅ DONE (commit: e58dd45b)
- `src/renderer/src/kernel/` — types.ts, eventBus.ts, commandBus.ts, ipcBridge.ts, index.ts

### Phase B — Chat 도메인 ✅ DONE (commit: 07719dfa)
- `src/renderer/src/domains/chat/` — domain.ts, store.ts, adapter.ts, commands.ts, index.ts

### Phase C — Cocos Plugin System ✅ DONE (commit: 2d24a08a)
- `src/renderer/src/domains/cocos/plugins/` — color.tsx, component.tsx, distribution.tsx, misc.tsx, name.tsx, transform.tsx, registry.ts, types.ts
- BatchInspector.tsx 14,774 → 66줄 (thin shell)

### Phase D — App.tsx 도메인 훅 추출 ✅ DONE (commit: 87db531e)
- App.tsx 1898→961줄 (49% 감소)
- 5 hooks: useWorkspaceManager, useSessionManager, useSettingsSync, useResizeHandlers, useKeyboardShortcuts
- 3 components: WelcomeScreen, WorkspaceTabBar, FileTabBar

### Phase D.2 — JSX → AppLayout 추출 ✅ DONE (commit: ddf3bff7)
- App.tsx 961→448줄 (총 77% 감소)
- AppLayout.tsx 신규 (675줄) — 모든 렌더링 JSX
- `.claude/CLAUDE.md` 신규 — 아키텍처 설계 규격 문서

---

## 최근 완료 라운드 (R2711~R2725)

- [x] R2711 — SceneView 노드 잠금 툴바 버튼
- [x] R2712 — BatchInspector Label fontSize 일괄 강화
- [x] R2714 — BatchInspector 조건부 active 토글
- [x] R2715 — SceneView 단축키 팝업
- [x] R2716 — SceneView 이름 찾기+바꾸기 (regex)
- [x] R2717 — SceneView Opacity HUD 배지
- [x] R2718 — SceneView UUID 참조 화살표 시각화
- [x] R2719 — SceneView 격자 스냅
- [x] R2721 — BatchInspector Label 폰트 색상 일괄
- [x] R2722 — SceneView 선택 히스토리 breadcrumb
- [x] R2723 — BatchInspector 이름 접두사 자동 그룹 선택
- [x] R2725 — BatchInspector 선택 노드 일괄 lock/unlock

---

## 주요 파일 현황

| 파일 | 줄 수 | 비고 |
|------|-------|------|
| `src/renderer/src/App.tsx` | 448 | Phase D.2 완료 (1898→448, 77% 감소) |
| `src/renderer/src/components/shared/AppLayout.tsx` | 675 | Phase D.2 신규 — 모든 렌더링 JSX |
| `CocosPanel/BatchInspector.tsx` | 66 | Phase C 완료 (thin shell) |
| `CocosPanel/NodeInspector.tsx` | 9,198 | 향후 분리 검토 |
| `CocosPanel/index.tsx` | 3,220 | 향후 분리 검토 |
| `src/preload/index.ts` | 621 | Phase D namespacing 예정 |

---

## QA 상태

- **현재**: 2615 Pass, 0 Warning, 0 Critical
- check-rounds.ts: readCached 디렉토리 경로 자동 병합 지원
- check-ipc.ts: handleSave 체크 → CocosPanel/index.tsx 기준

---

## 참고사항

- BatchInspector 잔여 38개 `await saveScene: result.success` 처리 / Z-sort 특수 케이스
- npm audit 잔여 10개 low: electron-builder 체인 (빌드툴 전용, 런타임 무관)
- 다음 라운드 제안: R2726+ (BatchInspector/SceneView/NodeInspector 추가 기능)
