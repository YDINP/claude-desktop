# ISSUE-012 — 코드 품질 리팩토링 로드맵

**유형**: refactor
**우선순위**: medium
**관련 파일**: CocosPanel.tsx, CCFileSceneView.tsx, scripts/qa.ts, electron.vite.config.ts

---

## 현황 (2026-03-16 4-에이전트 분석 결과)

| 항목 | 수치 |
|------|------|
| CocosPanel.tsx | 31,145줄 / 461 useState / 545 applyXxx 함수 |
| CCFileSceneView.tsx | 4,747줄 / 109 useState |
| qa.ts | 1,711 섹션 (~30,000줄) |

---

## 완료된 즉시 수정 (2026-03-16)

- [x] `electron.vite.config.ts` — katex + xterm addon manualChunks 추가
- [x] `CocosPanel.tsx` L4 — `../../../../shared/ipc-schema` → `@shared/ipc-schema`
- [x] `CCFileSceneView.tsx` L476 — `.catch(() => {})` → pending sentinel 삭제로 재시도 허용
- [x] `CCFileSceneView.tsx` L1136 — `getContext('2d')!` → null 체크 + early return
- [x] `CCFileSceneView.tsx` L2765 — `scale as {x,y}` 무가드 → `?.` 옵셔널 체이닝
- [x] `CCFileSceneView.tsx` L3920/3945/3994 — `size!.x` → `size?.x ?? 0`
- [x] `CCFileSceneView.tsx` L1251 — `document.getElementById` → `resCustomWRef/HRef`

---

## Phase 1: 안전 고효과 (즉시 가능, 줄 수 감소 ~5,000)

### 1-A. 스타일 상수 파일 추출 (`cocos-styles.ts`)
- `fontSize: 9` 1,316회 / `cursor: 'pointer'` 1,194회 / `padding: '1px 4px'` 725회
- 공통 스타일 상수 + `<HoverButton>` 컴포넌트
- 예상 감소: -4,000~5,000줄

### 1-B. 유틸 함수 별도 파일 분리
- `validateScene`, `extractPrefabEntries`, `deepCopyNodeWithNewUuids` → `utils/cocos-utils.ts`
- 예상 감소: -100줄 (가독성 효과가 주)

---

## Phase 2: useBatchPatch 커스텀 훅 (줄 수 감소 ~15,000)

545개 `applyXxx` 함수가 동일한 3단계 패턴 반복:
```
1. tree-walk + uuid match
2. saveScene(patched)
3. setBatchMsg('✓ ...')
```

**목표 추상화:**
```typescript
// hooks/useBatchPatch.ts
function useBatchPatch(sceneFile, saveScene, uuids, setBatchMsg) {
  const patchNodes = useCallback(async (patcher, label) => {
    function walk(n) { ... }
    await saveScene({ ...sceneFile, root: walk(sceneFile.root) })
    setBatchMsg(`✓ ${label}`)
    setTimeout(() => setBatchMsg(null), 1500)
  }, [sceneFile, saveScene, uuids, setBatchMsg])
  return { patchNodes }
}

// 사용예:
const applyOpacity = () => patchNodes(n => ({ ...n, opacity: val }), `opacity ${val} (${uuids.length}개)`)
```

Type A(노드 직접) 300개 → 완전 추상화
Type B(컴포넌트) 200개 → `createComponentPatcher` 팩토리
예상 감소: -12,000~15,000줄

---

## Phase 3: qa.ts 선언적 테이블화 (줄 수 감소 ~28,000)

1,711개 섹션의 대부분이 파일 내 키워드 존재 여부만 체크:
```typescript
// 현재: ~18줄/섹션 × 1,711 = ~30,000줄
// 목표: 선언적 배열
const ROUND_CHECKS: RoundCheck[] = [
  { round: 'R2701', file: 'CCFileSceneView.tsx', keywords: ['marqueeStart', 'marqueeEnd'] },
  ...
]
```

**구조:**
```
scripts/
  qa.ts            — orchestrator (100줄 유지)
  qa-checks/
    check-rounds.ts  — 선언적 테이블 (~500줄로 1711 섹션 커버)
    check-build.ts   — tsc, bundle 검증
    check-ipc.ts     — IPC 채널 매핑
```

---

## Phase 4: 컴포넌트 파일 분리 (가독성 개선)

```
sidebar/
  CocosPanel.tsx (진입점 ~200줄)
  BatchInspector/
    index.tsx
    hooks/useBatchPatch.ts
    sections/LabelSection.tsx, SpriteSection.tsx, ...
  NodeInspector/
    index.tsx
    ...
  SceneView/
    CCFileSceneView.tsx (진입점 ~500줄)
    NodeOverlay.tsx    (flatNodes.map 렌더링 분리)
    hooks/useViewState.ts, useDragState.ts, ...
```

---

## Phase 5: Phantom State 정리 (~150개)

CocosPanel.tsx L115-679 구간에 선언만 되고 미사용인 state:
- `pluginList`, `hotReload`, `buildWarnings`, `buildTarget`, `debugMode`, `performanceStats` 등 150개+
- 미래 기능 stub으로 보임 → 별도 feature 브랜치에서 구현하거나 제거

---

## Phase 6: 동작 버그 — opGradFrom 이중 선언

CocosPanel.tsx L4290 vs L4369:
```typescript
// L4290 (CCFileProjectUI 내부?)
const [opGradFrom, setOpGradFrom] = useState<number>(255)
// L4369 (CCFileBatchInspector 내부?)
const [opGradFrom, setOpGradFrom] = useState<number>(255)  // ← 별도 state
```
두 apply 함수가 서로 다른 state를 참조 → UI에서 수정한 값이 다른 함수에 미반영될 수 있음.
**컴포넌트 경계 확인 후 단일 source로 통합 필요.**

---

## Phase 7: ESLint 설정 추가 (High)

프로젝트에 ESLint 설정 파일 전혀 없음:
```
eslint.config.ts (flat config)
  - @typescript-eslint/eslint-plugin
  - eslint-plugin-react-hooks (exhaustive-deps)
  - no-unused-vars
```

---

## 실행 우선순위

| Phase | 예상 효과 | 위험도 | 권장 시점 |
|-------|-----------|--------|----------|
| 1-A 스타일 상수 | -5,000줄 | 매우 낮음 | 즉시 |
| 1-B 유틸 분리 | 가독성 | 매우 낮음 | 즉시 |
| 2 useBatchPatch | -15,000줄 | 낮음 | 다음 리팩 스프린트 |
| 3 qa.ts 테이블화 | -28,000줄 | 매우 낮음 | 다음 리팩 스프린트 |
| 4 컴포넌트 분리 | 구조 개선 | 중간 | Phase 2 완료 후 |
| 5 Phantom State | 메모리 | 낮음 | Phase 4 중 |
| 6 opGradFrom 버그 | 버그 수정 | 낮음 | 즉시 |
| 7 ESLint | 품질 보증 | 낮음 | 즉시 |
