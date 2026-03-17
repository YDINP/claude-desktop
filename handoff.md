# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-17

---

## 현재 이슈

없음 (QA 2615 Pass / 0 Warning / 0 Critical)

---

## 다음 작업: Architecture Refactor

**PRD**: `PRD-architecture-refactor.md`
**TASKS**: `TASKS-architecture-refactor.json`
**Plane**: `08f04d65-1e52-498e-a375-cc7ec54b4371` (Todo / architecture + refactor)

### Phase A — Kernel 구축 (다음 시작점)
- `src/renderer/src/kernel/` 디렉토리 신규 생성
- types.ts → eventBus.ts → commandBus.ts → ipcBridge.ts → index.ts
- 기존 코드 무수정, 새 구조 병존 시작

### Phase B — Chat 도메인 (Phase A 완료 후)
- `src/renderer/src/domains/chat/` 생성
- chat-store.ts (useState) → zustand 실제 store
- App.tsx 1,978줄 → ~400줄 목표

### Phase C — Cocos Plugin System (Phase A 완료 후, B와 병렬 가능)
- BatchPlugin interface + 플러그인 파일들 (~30개, 각 30~100줄)
- BatchInspector.tsx 14,775줄 → ~50줄

### Phase D — 나머지 도메인 (B+C 완료 후)
- session / filesystem / terminal 도메인
- preload namespacing (window.api.cocos.* 등)
- App.tsx 최종 ~200줄

---

## 완료된 작업 (이번 세션)

- [x] R2722 — SceneView 선택 히스토리 breadcrumb
- [x] R2723 — BatchInspector 이름 접두사 자동 그룹 선택
- [x] R2725 — BatchInspector 선택 노드 일괄 lock/unlock
- [x] Phase 4 — CocosPanel.tsx 31,067줄 → CocosPanel/ 8개 파일 분리
- [x] Phase 2 — BatchInspector apply* 566개 → patchNodes/patchComponents (93.3%)
- [x] electron 33 → 35.7.5 (ASAR 취약점 moderate 해결)
- [x] Architecture Refactor PRD + TASKS 문서화 완료

---

## 주요 파일 현황

| 파일 | 줄 수 | 비고 |
|------|-------|------|
| `src/renderer/src/App.tsx` | 1,978 | Phase B 목표: ~400줄 |
| `CocosPanel/BatchInspector.tsx` | 14,775 | Phase C 목표: ~50줄 |
| `CocosPanel/NodeInspector.tsx` | 9,198 | Phase C 이후 검토 |
| `CocosPanel/index.tsx` | 3,220 | Phase B/C 이후 감소 예상 |
| `src/preload/index.ts` | 621 | Phase D namespacing 예정 |

---

## QA 상태

- **현재**: 2615 Pass, 0 Warning, 0 Critical
- check-rounds.ts: readCached 디렉토리 경로 자동 병합 지원
- check-ipc.ts: handleSave 체크 → CocosPanel/index.tsx 기준

---

## 참고사항

- BatchInspector 잔여 38개 await saveScene: result.success 처리 / Z-sort 특수 케이스
- npm audit 잔여 10개 low: electron-builder 체인 (빌드툴 전용, 런타임 무관)
