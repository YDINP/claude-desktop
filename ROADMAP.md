# Claude Desktop — 개발 로드맵

> 마지막 업데이트: 2026-03-12

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
| Round 70 | main | 메시지 버블 고도화 + 코드 실행 결과 표시 + Phase 2 시각 경험 |
| Round 71+ | main | Phase 3: 멀티패널 레이아웃 + Subagent 오케스트레이션 |

## 전략 로드맵 (Phase)

### Phase 1 — 완료 ✅
- 보안/안정성 Critical 수정
- 성능 Quick Wins (번들 분리, 타이머 통합)
- 디자인 시스템 기반 (CSS 변수, WCAG AA)

### Phase 2 — 진행 중 🔄
- Claude SDK 활용 확대 (16개 타입 파싱 완료)
- CC 통합 (WebSocket Extension + 패널 + 자연어 편집)
- 시각 경험 (버블 차별화, 코드 헤더, 애니메이션)

### Phase 3 — 예정
- 멀티패널 레이아웃
- CSS 모듈 마이그레이션
- Subagent 오케스트레이션 UI

## QA 프로세스

매 라운드 완료 후 `npm run qa` 실행하여 검증.
