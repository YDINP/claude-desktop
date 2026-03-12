# Changelog — Claude Desktop

## [Round 95] — 2026-03-12
### Changed
- QA 스크립트에 R90~94 신규 기능 7종 체크 추가 (Pass 10→17)

## [Round 94] — 2026-03-12
### Added
- AG-UI 이벤트 모델: AguiRunStarted/StepStarted/StepFinished/RunFinished 타입 (ipc-schema.ts)
- agui-store.ts: aguiSubscribe/aguiDispatch 인메모리 옵저버블 스토어 (신규)
- RunTimeline.tsx: 런·스텝 상태 시각화 컴포넌트 (신규)
### Changed
- agent-bridge.ts: run_started/step_started/step_finished/run_finished 이벤트 병행 방출
- AgentPanel.tsx: '런타임' 탭 추가
- App.tsx: AG-UI 이벤트 감지 후 aguiDispatch 호출

## [Round 93] — 2026-03-12
### Changed
- agent-bridge.ts: text_delta 이벤트 16ms 배치 (textBatch + setTimeout 플러시)
- chat-store.ts: reconcileText(fullText) 함수 추가
- App.tsx: isDeltaStreamingRef로 text_delta 실시간 렌더링 활성화

## [Round 92] — 2026-03-12
### Added
- StatsPanel API 비용 섹션: 오늘/이번달 카드 + 7일 바 차트 (cost-tracker 통합)

## [Round 91] — 2026-03-12
### Added
- 네이티브 파일 다이얼로그: fs:open-file-dialog IPC, preload openFileDialog
- ChatPanel 📎 버튼: 네이티브 파일 피커로 파일 첨부

## [Round 90] — 2026-03-12
### Added
- 파일 컨텍스트 패널: useContextFiles hook (localStorage 영속, IPC readFile)
- ChatPanel 📎 콜랩서블 바: 파일 칩 표시 + system prompt 자동 주입

## [Round 89] — 2026-03-12
### Changed
- scripts/qa.ts: R83~88 신규 기능 5종 체크 추가 (Pass 5→10)
- handoff.md 전체 갱신

## [Round 88] — 2026-03-12
### Added
- PromptChainPanel 템플릿 라이브러리: PRESET_TEMPLATES 5종 (코드리뷰/디버깅/콘텐츠/번역/기능명세)
- 📚 버튼 오버레이, 가져오기로 체인 생성

## [Round 87] — 2026-03-12
### Added
- CommandPalette recent-action 타입: ⚡ 섹션, 최대 8개 recency 순 저장
- 실행 시 addRecentAction 자동 저장

## [Round 86] — 2026-03-12
### Added
- cost-tracker.ts: localStorage 기반 일별/월별 API 비용 집계 (90일 보존)
- App.tsx: recordCost() 연동
- StatusBar: 세션 팝업에 오늘/이번달 누적 비용 표시

## [Round 85] — 2026-03-12
### Changed
- CC 3x enrichNode: components[].props 추출 (UITransform/UIOpacity 제외)
- NodePropertyPanel: 콜랩서블 ComponentSection + formatPropValue
- ipc-schema.ts: CCNode.components[].props? 타입 추가

## [Round 84] — 2026-03-12
### Added
- AssetBrowserPanel.tsx: CC 에셋 트리 브라우저 (검색/폴더토글/파일타입 아이콘/경로복사)
- extensions: GET /assets/tree 엔드포인트 (3x, 2x)
- ipc-schema.ts: AssetItem, AssetTree 타입
- cc-bridge.ts: getAssets() 메서드
- cc-handlers.ts: cc:get-assets IPC 핸들러

## [Round 83] — 2026-03-12
### Added
- ChatPanel: 커스텀 시스템 프롬프트 에디터 (localStorage), 컨텍스트 윈도우 진행 바
- InputBar: 실시간 토큰 추산 카운터
- MessageBubble: 메시지별 토큰 수 표시
- SettingsPanel: 글로벌 시스템 프롬프트 + 응답 언어 설정
