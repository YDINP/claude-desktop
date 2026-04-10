---
active: true
iteration: 1
max_iterations: 999
completion_promise: CC Editor 품질 완벽 — 사용자 취소 전까지
started_at: "2026-04-10T00:00:00Z"
---

## CC Editor 전용 개선 루프

### 범위 제한
- CocosPanel 계열 (CocosPanel/, NodeInspector/, renderers/)
- SceneView 계열 (CCFileSceneView, SceneViewPanel, SceneToolbar, SceneInspector)
- CC 파일 처리 (cc-file-parser, cc-file-saver, cc-file-watcher, cc-asset-resolver, cc-version-detector)
- BatchInspector 플러그인 (domains/cocos/plugins/)
- CC 관련 IPC (cc-handlers, cc-file-handlers)

### 작업 방향
1. CC Editor 기능 완성도 검증 — 미구현/스텁 탐지
2. CC 파서/저장 안정성 — 엣지 케이스, 라운드트립 정확성
3. SceneView/Inspector 렌더링 정밀도
4. BatchInspector 플러그인 커버리지
5. CC 관련 테스트 확대
6. CC 관련 i18n 확장
7. CC 관련 성능 최적화

### 제외 (건드리지 않음)
- Chat 기능, Terminal, Session, 일반 UI
