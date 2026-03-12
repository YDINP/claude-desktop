# QA Report — Round latest
> 2026-03-12T11:28:18.096Z

## Critical
_없음_

## Warning
_없음_

## Pass
- tsc --noEmit 오류 없음
- 98개 소스 파일 검사 완료
- 자동 재연결 로직 존재
- cocos 탭 정상 등록
- registerCCHandlers 정상 등록
- AssetBrowserPanel.tsx 존재
- CC 3x /assets/tree 엔드포인트 존재
- cost-tracker.ts: recordCost + getMonthlyCost 존재
- CommandPalette recent-action 구현 존재
- PromptChainPanel 템플릿 라이브러리 존재
- useContextFiles hook 존재
- fs:open-file-dialog IPC 핸들러 존재
- StatsPanel API 비용 섹션 존재
- chat-store reconcileText 존재
- agent-bridge text_delta 16ms 배치 존재
- agui-store: aguiDispatch + aguiSubscribe 존재
- RunTimeline.tsx 존재
- SceneView 다중 선택 + MarqueeState 존재
- ollama-bridge.ts: ollamaListModels + ollamaChat 존재
- ollama-handlers.ts 존재
- InputBar Ollama 모델 피커 존재
- SceneView UndoEntry 타입 존재
- SceneView undo/redo 스택 존재
- openai-bridge.ts: openaiChat 존재
- openai-handlers.ts 존재
- InputBar OpenAI 모델 옵션 존재
- SceneView ClipboardEntry 타입 존재
- SceneView 노드 복사/붙여넣기 존재
- ollama-bridge addEventListener 메모리 누수 수정됨
- SceneInspector 노드 가시성 토글 존재
- GlobalSearchPanel: sessionSearchAll + 결과 타입 존재
- session:searchAll IPC 핸들러 존재
- cc-bridge.ts: setZOrder 메서드 존재
- CC 2x extension Z-order 엔드포인트 존재
- InputBar 빠른 액션 슬롯 존재
- 세션 자동 제목 기능 존재
- SceneTree 노드 인라인 이름 편집 존재
- 스트리밍 경과 시간 표시 존재
- cc-bridge.ts: createNode + deleteNode 존재
- NodePropertyPanel 색상 스왓치 표시 존재