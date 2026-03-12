# Handoff — Claude Desktop Electron App
> 마지막 업데이트: 2026-03-12 (Round 66 완료)

## 현재 상태
- Round 63까지 완료 (SDK 전수 파싱 + 버블 차별화 + 애니메이션)
- Round 64 진행 중: `feature/cocos-integration` 브랜치, CC Extension 파일 생성
- GitHub: `https://github.com/YDINP/claude-desktop` (main 브랜치)
- 앱 위치: `C:\Users\a\Documents\claude-desktop`

## Round 63 완료 작업

### Team A — SDK 전수 파싱
- **agent-bridge.ts**: thinking/thinking_delta/tool_result/tool_progress/usage/error/overloaded_error/system.status 처리
- **App.tsx**: 위 이벤트 핸들러 추가

### Team B — MessageBubble 차별화
- **MessageBubble.tsx**: user 버블 accent 라인, assistant 버블 success 라인, bg-user 배경
- **MessageBubble.tsx**: 코드 블록 헤더 바 (언어명 / 라인수 / 복사 버튼)
- **theme.css**: `--success`, `--bg-user` CSS 변수 추가

### Team C — 애니메이션
- **global.css**: blink / typing-bounce / fadeIn / tool-pulse 애니메이션
- 스트리밍 블링킹 커서, TypingIndicator 3-dot bounce
- 사이드바 패널 fadeIn 전환, ToolUseIndicator 진행 바

## Round 64 — CC Extension WebSocket 서버 (진행 중)
- [x] `feature/cocos-integration` 브랜치 생성
- [x] `rollback/pre-round-64` 태그
- [x] `extensions/cc-ws-extension-2x/` 파일 생성 (package.json / main.js / scene-script.js)
- [x] `extensions/cc-ws-extension-3x/` 파일 생성 (package.json / main.js / scene-script.js)
- [x] `extensions/README.md`
- [x] 커밋

## Round 65 완료 (3팀 모두 완료, TS 오류 없음)
- CC 패널 (SceneTreePanel / NodePropertyPanel / WebPreviewPanel)

## Round 66 완료
- [x] `src/renderer/src/hooks/useCCContext.ts` — 씬 트리 구독, contextString 생성
- [x] `src/renderer/src/utils/cc-action-parser.ts` — cc-action 블록 파싱 및 실행
- [x] `ChatPanel.tsx` — useCCContext 주입, handleSend에 extraSystemPrompt, 스트리밍 완료 후 cc-action 자동 실행, CC 연결 상태 배너
- [x] `claude:send` IPC — extraSystemPrompt 필드 지원 (메인/preload/env.d.ts)
- [x] TS 오류 없음, 커밋 완료

## 다음 세션 작업 (Round 67)
- Round 67: UX 완성 (자동감지, 재연결, 실시간 갱신)

## 알려진 이슈 (미수정, 검토 필요)
- `runInSandbox` — `new Function(code)` 직접 실행 (`MessageBubble.tsx:57`) — 사용자 확인 필요
- `sandbox: false` Electron 설정 — OS 샌드박스 없음 (`main/index.ts:50`)
- `bypassCSP: true` local:// 프로토콜 광범위 CSP 우회
- `session:importBackup` 백업 파일 구조 검증 없음

## 아키텍처 요약
```
Electron (Main)
├── ipc/fs-handlers.ts       — 파일시스템, Git (execFile로 Shell Injection 방지됨)
├── ipc/session-handlers.ts  — 세션 저장 (~/.claude-desktop/sessions/, session.id 검증 추가됨)
├── ipc/claude-handlers.ts   — Claude API 라우팅
├── claude/agent-bridge.ts   — Claude Agent SDK (Round 63에서 전수 파싱 완료)
└── main/index.ts            — BrowserWindow, local:// 프로토콜

Renderer (React 18)
├── components/chat/          — ChatPanel, MessageBubble (버블 차별화, 코드헤더), InputBar
├── components/sidebar/       — Sidebar, SessionList, FileTree
├── components/shared/        — StatusBar, CommandPalette, SettingsPanel
└── styles/                   — theme.css (--success/--bg-user), global.css (애니메이션)

CC Extensions (feature/cocos-integration)
├── extensions/cc-ws-extension-2x/  — CC 2.x HTTP+WS on port 9090
└── extensions/cc-ws-extension-3x/  — CC 3.x HTTP+WS on port 9091
```

## 참고 설정
- Plane 연동: **제외** (2026-03-12 사용자 지시)
- 빌드: `npm run build` (Electron + Vite)
- 번들: 406kB 메인 + vendor-react/syntax/markdown/terminal/mermaid 분리
