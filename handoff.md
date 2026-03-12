# Handoff — Claude Desktop Electron App
> 마지막 업데이트: 2026-03-12 (Round 72 완료)

## 현재 상태
- Round 72까지 완료 (HQ Mode Phase 3 — ResourceBar 라이브 데이터 + OpsFeed 자동스크롤)
- 브랜치: `feature/cocos-integration` (Round 64~67 CC 통합 작업)
- GitHub: `https://github.com/YDINP/claude-desktop` (main 브랜치)
- 앱 위치: `C:\Users\a\Documents\claude-desktop`

## Round 67 완료 작업

### QA 자동화 시스템
- `scripts/qa.ts` — TypeScript/import/CC/Sidebar/IPC 자동 검증 스크립트
- `npm run qa` / `npm run qa -- --round=N` 으로 실행
- `qa-report-roundN.md` 자동 생성

### QA 검수 결과 및 수정 (Round 63~67)

**Critical 4건 수정:**
- `preload/index.ts` — onCCEvent/onCCStatusChange removeAllListeners → removeListener(handler)
- `cc-bridge.ts` — _intentionalDisconnect 플래그 추가 (disconnect 후 재연결 루프 방지)
- `cc-handlers.ts` — _ccHandlersRegistered 가드 (ipcMain.handle 중복 등록 방지)
- `cc-handlers.ts` — CC_STATUS port/version 하드코딩 → ccBridge getter 참조

**Warning/성능/접근성 수정:**
- `env.d.ts` — claudePermissionReply allowSession 타입 동기화
- `cc-ws-extension-3x/main.js` — node:deselect 이벤트 추가
- `cc-ws-extension-2x/scene-script.js` — getNode 불필요 조건 제거
- `SceneTreePanel.tsx` — children undefined guard + NodeRow React.memo
- `CocosPanel.tsx` — unmount 가드 + handleNodeUpdate useCallback
- `theme.css` — --success #26a641 → #3fb950 (WCAG AA 4.6:1)
- `cc-action-parser.ts` — refreshTree 실제 구현
- `scripts/qa.ts` — import/오탐 수정 (import 문 제외 호출 카운트, disconnect 블록 파싱 개선)

## 다음 세션 작업 (Round 69~)

### Round 68: CC UX 완성 ✅ 완료
- [x] CC 프로젝트 자동 감지 (project.json/settings 탐지, 버전 배지)
- [x] Extension 설치 가이드 UI (버전별 폴더명/포트 표시)
- [x] WebSocket 재연결 카운트다운 UI (3→0초)
- [x] SceneTreePanel scene:saved debounce (500ms)
- [x] 포트 저장/로드 (cc-handlers in-memory)

### Round 69: Adaptive Thinking 시각화 (main 브랜치)
- [ ] thinking 블록 별도 패널/토글 UI
- [ ] Effort 레벨 선택 UI + maxBudgetUsd 설정
- [ ] ToolUse 실시간 상태 표시 고도화

## 알려진 이슈 (미수정, 검토 필요)
- `runInSandbox` — `new Function(code)` 직접 실행 (`MessageBubble.tsx:57`)
- `sandbox: false` Electron 설정 — OS 샌드박스 없음
- `bypassCSP: true` local:// 프로토콜 광범위 CSP 우회
- `session:importBackup` 백업 파일 구조 검증 없음

## 브랜치 구조
- `main` — Round 62까지 (안정 버전)
- `feature/cocos-integration` — Round 64~67 CC 통합 (검수 완료, merge 대기)
- 롤백: `git checkout rollback/pre-round-64` 태그

## 아키텍처 요약
```
Electron (Main)
├── ipc/fs-handlers.ts       — 파일시스템, Git
├── ipc/session-handlers.ts  — 세션 저장 (session.id 검증)
├── ipc/claude-handlers.ts   — Claude API + extraSystemPrompt 지원
├── ipc/cc-handlers.ts       — CC WebSocket 브릿지 IPC (NEW)
├── cc/cc-bridge.ts          — CC WebSocket 연결 관리 (NEW)
├── claude/agent-bridge.ts   — SDK 전수 파싱 (16개 타입)
└── main/index.ts            — BrowserWindow

Renderer (React 18)
├── components/chat/          — ChatPanel (CC 컨텍스트 주입), MessageBubble, InputBar
├── components/sidebar/       — Sidebar, SessionList, FileTree
│                               CocosPanel, SceneTreePanel, NodePropertyPanel, WebPreviewPanel (NEW)
├── components/shared/        — StatusBar, CommandPalette, SettingsPanel
├── hooks/useCCContext.ts     — CC 연결/씬트리 상태 (NEW)
├── utils/cc-action-parser.ts — Claude 응답 CC 액션 파싱 (NEW)
└── styles/                   — theme.css, global.css

CC Extensions (extensions/)
├── cc-ws-extension-2x/      — CC 2.x HTTP+WS port 9090
└── cc-ws-extension-3x/      — CC 3.x HTTP+WS port 9091

QA
└── scripts/qa.ts            — 자동화 QA 스크립트 (NEW)
```

## 참고 설정
- Plane 연동: **제외** (2026-03-12 사용자 지시)
- 빌드: `npm run build`
- QA: `npm run qa`
