# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-17

---

## 현재 이슈

없음 (QA 2616 Pass / 0 Warning / 0 Critical)

---

## Architecture Refactor 완료 현황

**PRD**: `PRD-architecture-refactor.md`
**아키텍처 가이드**: `.claude/CLAUDE.md` (설계 규격/컨벤션 문서)

### Phase A — Kernel 구축 ✅ DONE (commit: e58dd45b)
- `src/renderer/src/kernel/` — types.ts, eventBus.ts, commandBus.ts, ipcBridge.ts, index.ts

### Phase B — Chat 도메인 ✅ DONE (commit: 07719dfa)
- `src/renderer/src/domains/chat/` — domain.ts, store.ts, adapter.ts, commands.ts, index.ts

### Phase C — Cocos Plugin System ✅ DONE (commit: 2d24a08a)
- `src/renderer/src/domains/cocos/plugins/` — 8개 파일
- BatchInspector.tsx 14,774 → 66줄 (thin shell)

### Phase D — App.tsx 도메인 훅 추출 ✅ DONE (commit: 87db531e)
- App.tsx 1898→961줄 (49% 감소)
- 5 hooks + 3 components 분리

### Phase D.2 — JSX → AppLayout 추출 ✅ DONE (commit: ddf3bff7)
- App.tsx 961→448줄 (총 77% 감소)
- AppLayout.tsx 신규 (675줄)

### Phase E — CocosPanel/index.tsx 분리 ✅ DONE (commit: 0689fd08)

- index.tsx 3,220→138줄
- 6개 파일 분리: BuildTab, SceneTab, HierarchyPanel, ProjectHeader, ProjectToolbar, useCCFileProjectUI

### Phase F(NodeInspector) + useCCFileProjectUI 훅 분리 ✅ DONE (commits: 1ba6de35, 986711d4, 2cb2df45)
- `NodeInspector/` 디렉토리 21개 파일 분리
  - useNodeInspector.tsx 816→683줄 (useNodeClipboards, useNodePresets 추가 분리)
  - renderers/ (10개 파일) — 타입별 Quick Edit 렌더러
- `useCCFileProjectUI.ts` 1,719→532줄
  - useHierarchyPanel.ts (88줄), useNodeSelection.ts (117줄)
  - useKeyboardShortcuts.ts (283줄), useSceneActions.ts (249줄), useNodeOperations.ts (611줄)

### /ultrawork 리팩토링 ✅ DONE (commit: 888662e6)
- AssetBrowser.tsx 880→639줄 (assetUtils.ts, AssetThumbnailPopup.tsx, TreeSearch.tsx 분리)
- SceneTree.tsx 530→360줄 (GroupPanel.tsx 분리)
- useNodeInspector.tsx 816→683줄 (useNodeClipboards.ts, useNodePresets.ts 분리)

---

## 최근 완료 라운드 (R2711~R2726)

- [x] R2711~R2725 — SceneView/BatchInspector 기능 추가 (ROADMAP 참조)
- [x] R2726 — SceneView collapsedUuids 연동 (commit: ef81874a)

---

## 주요 파일 현황

| 파일 | 줄 수 | 비고 |
|------|-------|------|
| `src/renderer/src/App.tsx` | 448 | Phase D.2 완료 (77% 감소) |
| `src/renderer/src/components/shared/AppLayout.tsx` | 675 | 렌더링 JSX |
| `CocosPanel/BatchInspector.tsx` | 66 | Phase C 완료 (thin shell) |
| `CocosPanel/index.tsx` | 138 | Phase E 완료 (3,220→138) |
| `CocosPanel/useCCFileProjectUI.ts` | 532 | Phase F 완료 (1,719→532) |
| `CocosPanel/NodeInspector/index.tsx` | 17 | Phase F 완료 (9,198→분리) |
| `CocosPanel/NodeInspector/useNodeInspector.tsx` | 683 | /ultrawork 추가 분리 |
| `CocosPanel/NodeInspector/renderers/*.tsx` | 10개 | Phase F — 타입별 렌더러 |
| `SceneView/AssetBrowser.tsx` | 639 | /ultrawork 리팩토링 |
| `SceneView/SceneTree.tsx` | 360 | /ultrawork 리팩토링 |
| `src/preload/index.ts` | 621 | namespacing 예정 |

---

## QA 상태

- **현재**: 2616 Pass, 0 Warning, 0 Critical
- check-ipc.ts: handleSave 체크 → useCCFileProjectUI.ts 기준으로 업데이트됨

---

## 참고사항

- 다음 작업 후보: A(BatchInspector Z-order 일괄), D(BatchInspector 필터+액션 프리셋), R2727+(신기능)
- npm audit 잔여 10개 low: electron-builder 체인 (빌드툴 전용, 런타임 무관)
