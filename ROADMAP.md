# Claude Desktop — 개발 로드맵

> 마지막 업데이트: 2026-03-12 (Round 79 완료 — 터미널 AI 연동)

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
| Round 68 | feature/cocos-integration | CC UX 완성 (프로젝트 자동감지/재연결 UI/포트 저장/debounce) | ✅ |
| Round 69 | feature/cocos-integration | Adaptive Thinking 시각화 + ThinkingPanel + ToolUse 입력 포맷터 | ✅ |
| Round 70 | feature/cocos-integration | HQ Mode Phase 1 — TitleBar/AgentBay/ResourceBar/OpsFeed 쉘 + hq.css | ✅ |
| Round 71 | feature/cocos-integration | HQ Mode Phase 2 — AgentCard 4종 상태 애니메이션 (idle/active/tool_running/error) | ✅ |
| Round 72 | feature/cocos-integration | HQ Mode Phase 3 — ResourceBar 라이브 git/memory + OpsFeed 자동스크롤/입력요약 | ✅ |
| Round 73 | feature/cocos-integration | HQ Mode Phase 4 — Ctrl+Shift+H 단축키 + 트랜지션 폴리싱 + CSS 변수 | ✅ |
| Round 74 | main | 대화 UX 고도화 — 메시지 검색(Ctrl+F) + 결과 하이라이트/점프, 코드블록 복사/실행 버튼 개선 | ✅ |
| Round 75 | main | 대화 브랜치 UI — forkedFrom 인덱스 저장, SessionList forkMap + ⎇ 배지 + 들여쓰기 트리 렌더링 | ✅ |
| Round 76 | main | Monaco Editor 통합 — FileViewer 코드뷰/편집 Monaco 교체, 내장 검색/미니맵/goto줄, 1000→561줄 간소화 | ✅ |
| Round 77 | main | QA + 안정성 — Critical 4건 수정(forkMap 순환참조/save forkedFrom/defaultValue/import 순서), ws 패키지 추가, SyntaxHighlighter import 경로 수정, 빌드 성공 | ✅ |
| Round 78 | main | 코드 편집기 Phase 2 — 인라인 AI 어시스턴트(선택 영역 설명/수정 패널), Monaco DiffEditor로 DiffPanel 교체(나란히/인라인 뷰 토글) | ✅ |
| Round 79 | main | 터미널 + AI 연동 — 출력 캡처/에러 감지 배너/Claude 분석 버튼, App 채팅 연결 | ✅ |

## 진행 예정 라운드

| 라운드 | 브랜치 | 주요 작업 |
|--------|--------|-----------|

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

---

## 트렌드 리서치 인사이트 (2026-03-12)

AI 데스크탑 앱 2025-2026 트렌드 조사 결과 우선 적용 항목:

| 항목 | 우선순위 | 적용 예정 라운드 |
|------|----------|-----------------|
| Tool call 타임라인 카드 UI (Cursor 2.0 패턴) | HIGH | Round 74 통합 |
| Inline diff 렌더링 (file write 변경 시각화) | HIGH | Round 78 |
| IPC 스트리밍 배치화 (토큰별 IPC 금지) | HIGH | Round 77 QA 시 |
| 에이전트 사이드바 (병렬 실행 시각화) | HIGH | Round 81 |
| AG-UI 이벤트 모델 (미래 호환성) | MEDIUM | Round 82+ |
| React 18 virtual scroll 추가 최적화 | MEDIUM | Round 77 |
| Cocos MCP 서버 (DaxianLee/cocos-mcp-server) | MEDIUM | CC 브랜치 검토 |
| DXT 플러그인 패키징 | LOW | 장기 검토 |
