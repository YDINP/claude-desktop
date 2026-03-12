# Handoff — Claude Desktop Electron App
> 마지막 업데이트: 2026-03-12 (Round 82 완료)

## 현재 상태
- 마지막 커밋: Round 81 (AI 워크플로우 고도화) + Round 82 QA 클린
- 빌드: `npm run build` ✅
- QA: `npm run qa` ✅ Critical 0, Warning 0
- 브랜치: `feature/cocos-integration`
- 앱 위치: `C:\Users\a\Documents\claude-desktop`
- GitHub: `https://github.com/YDINP/claude-desktop` (main 브랜치)

## Round 79~82 완료 항목 (최근 세션)

### Round 79 — 터미널 AI 연동
- TerminalPanel: PTY 출력 캡처, 에러 감지 배너, Claude 분석 버튼
- App.tsx: TerminalPanel → ChatPanel 채팅 연결 (`onAskAI`)
- command-learner.ts: localStorage 명령어 빈도 학습

### Round 80 — 프로젝트 인텔리전스
- `project-intelligence.ts`: `analyzeProject()` — nextjs/electron/cocos/react/node 감지
- `useProjectContext.ts`: 프로젝트 분석 결과 → `extraSystemPrompt` 자동 주입
- `fs-handlers.ts` + `preload/index.ts`: `project:analyze` IPC 핸들러 + contextBridge 노출

### Round 81 — AI 워크플로우 고도화
- `AgentPanel.tsx` 리빌드: 태스크/체이닝/히스토리 3탭 구조
- `PromptChainPanel.tsx`: `{{stepN}}` placeholder 체이닝, 순차 실행 엔진
- `work-history.ts`: localStorage 실행 이력 저장 (max 500)

### Round 82 — QA + Phase 3 마무리
- QA 스크립트 cocos 탭 체크 수정 (App.tsx도 확인하도록)
- `npm run qa`: Critical 0, Warning 0 ✅

## 주요 파일
| 파일 | 역할 |
|------|------|
| `extensions/cc-ws-extension-3x/main.js` | CC3x HTTP/WS 브릿지, enrichNode, set-property, canvas-size |
| `extensions/cc-ws-extension-2x/main.js` | CC2x HTTP/WS 브릿지, canvas-size |
| `src/renderer/src/components/sidebar/CocosPanel.tsx` | CC 연결 UI, 노드 선택 이벤트 |
| `src/renderer/src/components/sidebar/NodePropertyPanel.tsx` | 노드 속성 표시/편집 (Scale/UITransform/UIOpacity 그룹) |
| `src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx` | SVG 씬뷰 메인 |
| `src/renderer/src/components/sidebar/AgentPanel.tsx` | 에이전트 태스크/체이닝/히스토리 3탭 |
| `src/renderer/src/components/sidebar/PromptChainPanel.tsx` | 프롬프트 체이닝 UI |
| `src/renderer/src/utils/work-history.ts` | 실행 이력 localStorage 저장 |
| `src/renderer/src/utils/command-learner.ts` | 터미널 명령어 학습/추천 |
| `src/main/ipc/project-intelligence.ts` | 프로젝트 분석 (타입/기술스택 감지) |
| `src/renderer/src/hooks/useProjectContext.ts` | 프로젝트 컨텍스트 → extraSystemPrompt |
| `src/main/cc/cc-bridge.ts` | CC WebSocket 연결 관리 (포트별 독립 인스턴스) |
| `src/main/ipc/cc-handlers.ts` | CC IPC 핸들러 |
| `src/shared/ipc-schema.ts` | CCNode, CanvasSize 타입 정의 |

## CC Extension 구조
- **포트**: 3x = 9091, 2x = 9090
- **엔드포인트**: `GET /scene/tree`, `GET /node/:uuid`, `POST /node/:uuid/property`, `POST /node/:uuid/move`, `GET /scene/canvas-size`
- **디버그**: `GET /debug/tree`, `GET /debug/node/:uuid`
- **CC3x query-node dump 포맷 핵심**:
  - 모든 필드가 `{value, type, readonly, animatable, ...}` 래퍼
  - size/anchor는 `__comps__[cc.UITransform].value.contentSize/anchorPoint`
  - rotation 2D 각도 = `n.rotation.value.z`

## 알려진 이슈 / 미수정
- `runInSandbox` — `new Function(code)` 직접 실행 (`MessageBubble.tsx`)
- `sandbox: false` Electron 설정
- `bypassCSP: true` local:// 프로토콜 광범위 CSP 우회
- `session:importBackup` 백업 파일 구조 검증 없음

## 아키텍처 요약
```
Electron (Main)
├── ipc/fs-handlers.ts        — 파일시스템, Git, project:analyze
├── ipc/session-handlers.ts   — 세션 저장
├── ipc/claude-handlers.ts    — Claude API
├── ipc/cc-handlers.ts        — CC WebSocket 브릿지 IPC (포트별)
├── ipc/project-intelligence.ts — 프로젝트 타입/스택 분석
├── cc/cc-bridge.ts           — CC WebSocket (getCCBridge(port) 팩토리)
└── claude/agent-bridge.ts    — SDK 파싱

Renderer (React 18)
├── components/chat/           — ChatPanel, MessageBubble, InputBar
├── components/sidebar/        — 18개 패널 + AgentPanel(3탭) + PromptChainPanel
│   └── SceneView/             — SceneViewPanel, Toolbar, Inspector, NodeRenderer
├── components/terminal/       — TerminalPanel (에러 감지 + AI 연동)
├── components/shared/         — StatusBar, CommandPalette, SettingsPanel
├── hooks/useProjectContext.ts — 프로젝트 컨텍스트 훅
├── utils/work-history.ts      — 실행 이력 저장
├── utils/command-learner.ts   — 명령어 학습/추천
└── utils/cc-action-parser.ts  — Claude 응답 CC 액션 파싱

CC Extensions
├── cc-ws-extension-2x/       — CC 2.x HTTP+WS port 9090
└── cc-ws-extension-3x/       — CC 3.x HTTP+WS port 9091
```

## 참고
- Plane 연동: **제외** (2026-03-12 사용자 지시)
- 빌드: `npm run build`
- QA: `npm run qa`
- CC Extension reload: CC Editor → Extension Manager → cc-ws-extension → Reload
