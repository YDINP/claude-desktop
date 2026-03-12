# Claude Desktop — 개발 로드맵

> 마지막 업데이트: 2026-03-12 (Round 74~82 로드맵 추가)

## 완료된 라운드

| 라운드 | 브랜치 | 주요 작업 | 상태 |
|--------|--------|-----------|------|
| Round 1~60 | main | 초기 개발 (60라운드) | ✅ |
| Round 61 | main | 보안(Shell Injection 수정)/안정성/성능/디자인 Critical 수정 | ✅ |
| Round 62 | main | 안정성(session 검증/IPC cleanup/debounce) + 디자인 Quick Wins + 성능 최적화 | ✅ |
| Round 63 | main | SDK 전수 파싱(16타입) + 메시지 버블 차별화 + 스트리밍 애니메이션 | ✅ |
| Round 64 | feature/cocos-integration | CC WebSocket Extension (2.x/3.x) | ✅ |
| Round 65 | feature/cocos-integration | claude-desktop CC 패널 (SceneTree/Property/WebPreview) | ✅ |
| Round 66 | feature/cocos-integration | Claude 자연어 씬 편집 연동 (컨텍스트 주입/액션 파서) | ✅ |
| Round 67 | feature/cocos-integration | QA 자동화 + 전체 검수 + Critical/Warning 수정 | ✅ |

## 진행 예정 라운드

| 라운드 | 브랜치 | 주요 작업 |
|--------|--------|-----------|
| Round 68 | feature/cocos-integration | CC UX 완성 (프로젝트 자동감지/Extension 설치 가이드/실시간 갱신) |
| Round 69 | main | Adaptive Thinking 시각화 + Effort 레벨 UI + ToolUse 고도화 |
| Round 70 | main | **HQ Mode Phase 1** — TitleBar 토글, App.tsx hqMode state, hq.css dot grid, AgentBay/ResourceBar 쉘 |
| Round 71 | main | **HQ Mode Phase 2** — AgentCard 로봇 SVG 눈 + idle/active/tool/error 애니메이션 + 토큰 게이지 |
| Round 72 | main | **HQ Mode Phase 3** — ResourceBar 라이브 데이터 바인딩 + OpsFeed 툴콜 스트림 + 세션 전환 처리 |
| Round 73 | main | **HQ Mode Phase 4** — 0.25s 트랜지션 폴리싱 + Ctrl+Shift+H 단축키 + 라이트 테마 호환 + QA |
| Round 74 | main | **대화 UX 고도화** — 메시지 검색(Ctrl+F) + 결과 하이라이트/점프, 대화 내 코드블록 복사/실행 버튼 개선 |
| Round 75 | main | **대화 브랜치 UI** — session:fork IPC 연동, 메시지 우클릭 "여기서 분기" 메뉴, 브랜치 트리 시각화(SessionList 확장) |
| Round 76 | main | **코드 편집기 Phase 1** — Monaco Editor 통합, FileViewer를 Monaco 기반으로 교체, 구문 강조/미니맵/검색 |
| Round 77 | main | **QA + 안정성** — Round 74~76 통합 QA, HQ Mode 회귀 테스트, 메모리 프로파일링, 접근성(WCAG AA) 검수 |
| Round 78 | main | **코드 편집기 Phase 2** — 인라인 AI 어시스턴트(선택 영역 설명/수정), Monaco diff viewer로 DiffPanel 교체 |
| Round 79 | main | **터미널 + AI 연동** — 터미널 출력 자동 캡처 + Claude 에러 분석 제안, 빠른 명령어 팔레트 개선 |
| Round 80 | main | **프로젝트 인텔리전스** — 프로젝트별 자동 시스템 프롬프트(파일 구조 기반), 자주 사용 명령어 학습/추천 |
| Round 81 | main | **AI 워크플로우 고도화** — Subagent 실행 시각화(AgentPanel 리빌드), Prompt 체이닝 UI, 작업 히스토리 저장 |
| Round 82 | main | **QA + Phase 3 마무리** — Round 78~81 통합 QA, CSS 모듈 마이그레이션, 성능 벤치마크, 릴리스 준비 |

## 전략 로드맵 (Phase)

### Phase 1 — 완료 ✅
- 보안/안정성 Critical 수정
- 성능 Quick Wins (번들 분리, 타이머 통합)
- 디자인 시스템 기반 (CSS 변수, WCAG AA)

### Phase 2 — 진행 중 🔄
- Claude SDK 활용 확대 (16개 타입 파싱 완료)
- CC 통합 (WebSocket Extension + 패널 + 자연어 편집)
- 시각 경험 (버블 차별화, 코드 헤더, 애니메이션)

### Phase 3 — 예정 (Round 74~82)
- 대화 UX 고도화 (메시지 검색, 대화 브랜치 fork UI)
- Monaco Editor 통합 + 인라인 AI 어시스턴트
- 터미널-AI 연동 (에러 자동 분석)
- 프로젝트 인텔리전스 (자동 시스템 프롬프트, 명령어 학습)
- Subagent 워크플로우 시각화 + Prompt 체이닝
- CSS 모듈 마이그레이션
- QA 라운드 x2 (Round 77, 82)

## QA 프로세스

매 라운드 완료 후 `npm run qa` 실행하여 검증.
