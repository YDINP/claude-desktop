# PRD — Phase 4: CocosPanel.tsx 파일 분리

> 작성일: 2026-03-16
> 목표: 31,067줄 단일 파일 → CocosPanel/ 디렉토리 (8개 파일)로 분리

---

## 배경

`CocosPanel.tsx`가 31,067줄로 성장하여 TypeScript 컴파일 속도 저하, 편집 시 IDE 렉, 코드 탐색 어려움 발생.

## 목표 파일 구조

```
src/renderer/src/components/sidebar/
├── CocosPanel.tsx          → re-export만 남김 (하위 호환)
└── CocosPanel/
    ├── index.tsx           CCFileProjectUI + CocosPanel export (~3,200줄)
    ├── types.ts            공유 타입 (CCFileProjectUIProps, TransformSnapshot, OptimizationSuggestion)
    ├── utils.ts            BoolToggle, ScrubLabel, COMP_ICONS, COMP_DESC 등 소형 유틸
    ├── BackupManager.tsx   BackupManager 컴포넌트 (lines 74~169)
    ├── SceneTree.tsx       GroupPanel + CCFileSceneTree (lines 3401~3917)
    ├── BatchInspector.tsx  CCFileBatchInspector (lines 3957~21010, ~17,050줄)
    ├── NodeInspector.tsx   SpriteThumb + CCFileNodeInspector (lines 21013~30205)
    └── AssetBrowser.tsx    TreeSearch + AssetThumbnailPopup + CCFileAssetBrowser (lines 30209~30948)
```

## 실행 단계

### Phase 4a (병렬) — 소형 파일
- `types.ts` 생성
- `utils.ts` 생성
- `BackupManager.tsx` 생성

### Phase 4b (병렬) — 중형 파일
- `SceneTree.tsx` (GroupPanel + CCFileSceneTree)
- `AssetBrowser.tsx` (TreeSearch + AssetThumbnailPopup + CCFileAssetBrowser)

### Phase 4c — 대형 파일
- `NodeInspector.tsx` (SpriteThumb + CCFileNodeInspector, ~9,190줄)

### Phase 4d — 초대형 파일
- `BatchInspector.tsx` (CCFileBatchInspector, ~17,050줄)

### Phase 4e — 조립
- `index.tsx` 완성 (CCFileProjectUI에서 로컬 함수 제거 → import로 교체)
- `CocosPanel.tsx` → re-export 파일로 교체

## 검증 기준
- 각 단계 완료 후 `npx tsc --noEmit` 에러 0
- 최종 `npm run qa` Warning 0 유지

## 주의사항
- `transformClipboard` (module-level 전역 변수) → `types.ts`에 포함
- `window.api.*` 호출하는 컴포넌트는 각 파일에서 `window.api` 타입 접근 가능 (전역)
- 기존 `CocosPanel.tsx` import 사용처 변경 불필요 (re-export 유지)
