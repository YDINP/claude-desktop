# PRD — QA Warning 47개 전면 정리

> 작성일: 2026-03-16
> 목표: Warning 47 → 0 (또는 실제 미구현만 남기기)

---

## 분류

### 그룹 A — check-rounds.ts 키워드 수정 (False Positive → Pass 전환)
> 기능은 구현됐지만 QA 키워드가 실제 코드와 불일치

| Round | 현재 문제 키워드 | 수정 방법 |
|-------|----------------|-----------|
| R938 | `lockedNodes`, `showLockPanel`, `nodeLock` | `lockedUuids` OR `toggleLock` 으로 교체 |
| R1476-deepcopy | AND 조건에 `'R1476'` 포함 | `'R1476'` 제거, OR 연산자로 변경 |
| R1525-bbox-render | AND에 `'포인터Events'` (한글, 코드에 없음) | `'포인터Events'` 제거, `ff9944` + `strokeDasharray` 만으로 |
| R1545-state | AND에 `'React.useState'` 포함 | `'React.useState'` 제거, `editingZoom` + `setEditingZoom` 만으로 |
| R1508-hook-fix | AND에 `'React.useState(\'\')'` 포함 | `'React.useState(\'\')'` 제거, `cliVal` + `setCliVal` 만으로 |
| R2025-batch-node-anchor | AND에 `'R2025'` 포함, `patchNodeAnchor` 없음 | `'R2025'` 제거, `applyAnchor` 또는 OR 연산자로 |
| R1547-badge | AND에 `'컴포넌트 타입 배지'` (주석, 없을 수 있음) | 제거 or OR 변경 |

---

### 그룹 B — check-rounds.ts 항목 삭제 (구현 계획 없는 오래된 항목)
> R815~R968 범위 CocosPanel 항목들 — 레거시 기능들로 현재 구현 계획 없음

삭제 대상 (23개):
- R815: 레이어 관리 (`nodeLayers`, `showLayerPanel`, `layerMap`)
- R821: 검색 히스토리 (`nodeSearchHistory`, `searchHistoryList`)
- R827: 캐시 관리 (`previewCacheSize`, `showCacheManager`)
- R833: 일괄 수정 (`batchEditMode`, `batchEditTargets`)
- R839: 컴포넌트 검색 필터 (`compSearchFilter`, `compSearchResults`)
- R845: 태그 필터 (`nodeTagFilter`, `showNodeTagFilter`)
- R857: 복사 이력 (`nodeCopyHistory`, `showCopyHistory`)
- R863: 노드 그룹 (`nodeGroups`, `showGroupPanel`)
- R869: 프리팹 검색 (`prefabSearch`, `prefabSearchResults`)
- R881: 애니메이션 프리뷰 (`animationPreview`, `previewAnimation`)
- R887: 이벤트 로그 (`nodeEventLog`, `showEventLog`)
- R893: 머티리얼 인스펙터 (`materialInspector`, `showMaterialPanel`)
- R899: 물리 디버그 (`physicsDebug`, `physicsDebugOptions`)
- R905: 스크립트 에디터 (`scriptEditorOpen`, `editingScript`)
- R911: 스프라이트 에디터 (`spriteEditorOpen`, `editingSprite`)
- R917: 파티클 에디터 (`particleEditorOpen`, `editingParticle`)
- R923: 오디오 에디터 (`audioEditorOpen`, `editingAudio`)
- R929: 타일맵 에디터 (`tileMapEditorOpen`, `tileMapEditor`)
- R932: 씬 그래프 (`sceneGraph`, `showSceneGraph`)
- R950: 에셋 즐겨찾기 (`assetFavorites`, `showFavoritesPanel`)
- R962: 씬 스냅샷 (`sceneSnapshots`, `showSnapshotList`)
- R968: 리소스 미리보기 (`resourcePreview`, `showResourcePreview`)
- R1691: Label 멀티라인 미리보기 AND에 `'R1691'` 포함 → `'R1691'` 제거 or 구현

---

### 그룹 C — 실제 코드 구현 필요
> 해당 파일에 기능이 실제로 없음

#### C1: SceneViewPanel.tsx (4개 수정)
- **Round145**: `onWheel JSX` 제거 + `{ passive: false }` addEventListener 등록
  - keywords: `{ passive: false }`, `addEventListener('wheel'` AND `onWheel={handleWheel}` 없어야 pass
- **R232**: PNG 내보내기 버튼 (`handleExportPng`, canvas toDataURL)
- **R245**: 인라인 편집바 rotation 필드 (position x/y 옆에 rotation 입력)
- **R523**: 레이어 가시성 토글 (`hiddenLayers`, `allLayers`, `topLevelNodes`, `showLayerPanel`)

#### C2: SceneInspector.tsx (4개 버튼)
- **Round179**: Position (0,0) 리셋 버튼
- **Round180**: Rotation 0 리셋 버튼
- **Round181**: Scale (1,1) 리셋 버튼
- **Round182**: Anchor (0.5,0.5) 리셋 버튼

#### C3: NotesPanel.tsx, OutlinePanel.tsx, ConnectionPanel.tsx, SearchPanel.tsx (각 1개)
- **Round312** (NotesPanel): 하단에 `split('\n').length 줄` 표시
- **Round331** (OutlinePanel): 레벨별 카운트 배지
- **Round321** (ConnectionPanel): 헤더 배지 (연결 수)
- **Round399** (SearchPanel): 단어 단위 검색 체크박스 (`\b` 패턴)

#### C4: NodePropertyPanel.tsx (1개)
- **Round110**: ColorSwatch — `background: rgb(...)` 스타일 표시

#### C5: CocosPanel.tsx (2개)
- **R1547-nav**: `console.log('favorite select')` → 실제 `onSelectNode` 호출로 교체
- **R1691**: Label 멀티라인 미리보기 (`\\n` 파싱, 줄 수 표시)

---

### 그룹 D — 보류
- **R2705-altDrag**: Alt+drag 복제 (RISK:HIGH, dragRef 경쟁조건)
- **R2313-chokidar**: 파일 감시 버그 (ISSUE-003/004/005, 별도 스프린트)

---

## 구현 순서 (오케스트레이션)

### Round 1 (병렬 실행)
- **QA-FIX-AB**: check-rounds.ts A그룹 키워드 수정 + B그룹 23개 삭제
- **QA-FIX-C2**: SceneInspector.tsx 리셋 버튼 4개
- **QA-FIX-C3**: NotesPanel/OutlinePanel/ConnectionPanel/SearchPanel 각 1개씩 (4파일 병렬)

### Round 2 (Round 1 완료 후)
- **QA-FIX-C1**: SceneViewPanel.tsx 4개 수정
- **QA-FIX-C4**: NodePropertyPanel.tsx ColorSwatch
- **QA-FIX-C5**: CocosPanel.tsx R1547-nav + R1691

---

## 예상 결과
- Warning 47 → 목표 **5 이하** (R2705/R2313/R1472 등 실제 미구현 only)
