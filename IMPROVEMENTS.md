# Claude Desktop — 개선 이력 및 가이드

> 마지막 업데이트: 2026-03-11 (Ralph Loop Round 6)

## 아키텍처 개요

```
Electron (Main Process)
├── src/main/index.ts           — BrowserWindow, local:// 프로토콜, 앱 진입점
├── src/main/ipc/router.ts      — IPC 핸들러 등록
├── src/main/ipc/claude-handlers.ts  — Claude 메시지 라우팅
├── src/main/ipc/session-handlers.ts — 세션 저장/불러오기 (인덱스 파일 포함)
├── src/main/ipc/fs-handlers.ts      — 파일시스템, Git, Shell
├── src/main/ipc/terminal-handlers.ts
├── src/main/claude/agent-bridge.ts  — Claude Agent SDK 래퍼
├── src/main/terminal/pty-manager.ts — node-pty 터미널 관리
└── src/main/store/app-config.ts     — electron-store 설정

Renderer (React 18)
├── src/renderer/src/App.tsx              — 메인 레이아웃, 워크스페이스 관리
├── src/renderer/src/stores/
│   ├── chat-store.ts                     — 채팅 상태 (RAF 버퍼링 스트리밍)
│   └── project-store.ts                  — 프로젝트/모델 상태
└── src/renderer/src/components/
    ├── chat/ChatPanel.tsx                 — 메시지 목록, 스크롤
    ├── chat/MessageBubble.tsx             — 메시지 렌더링 (React.memo)
    ├── chat/InputBar.tsx                  — 입력창, 슬래시 커맨드
    ├── chat/ToolUseIndicator.tsx          — 툴 사용 표시 (React.memo)
    ├── sidebar/Sidebar.tsx                — 파일/히스토리/변경사항 탭
    ├── sidebar/FileTree.tsx               — 파일 트리 (React.memo)
    ├── sidebar/SessionList.tsx            — 세션 목록
    ├── sidebar/ChangedFilesPanel.tsx      — Claude가 변경한 파일 추적
    ├── shared/FileViewer.tsx              — 파일 뷰어 (검색, 줌, 마크다운)
    ├── shared/CommandPalette.tsx          — Ctrl+P 커맨드 팔레트
    ├── shared/KeyboardShortcutsOverlay.tsx — Ctrl+? 단축키 안내
    ├── shared/StatusBar.tsx               — Git 상태, 비용, 모델 표시
    ├── shared/TitleBar.tsx                — 커스텀 타이틀바
    ├── permission/PermissionModal.tsx     — 툴 권한 요청
    └── terminal/TerminalPanel.tsx         — xterm 터미널 (멀티탭)

Preload (contextBridge)
└── src/preload/index.ts                  — window.api 노출
```

---

## 세션 ID 패턴

새로 생성되는 세션 ID는 반드시 `/^[a-zA-Z0-9_-]+$/` 패턴이어야 합니다.
`session:load`, `session:delete`, `session:rename` IPC 핸들러에서 검증됩니다.

---

## 주요 개선 이력

### Round 0 (이전 세션) — 기능 구현

| 항목 | 파일 | 설명 |
|------|------|------|
| 세션 이름 변경 | SessionList.tsx | 더블클릭 인라인 편집 |
| Changed Files 패널 | ChangedFilesPanel.tsx | Claude 수정 파일 추적 |
| 파일 트리 컨텍스트 메뉴 | FileTree.tsx | 우클릭 → 열기/복사/탐색기 |
| 내보내기 버튼 | ChatPanel.tsx | 대화 마크다운 저장 |
| 재생성 버튼 | MessageBubble.tsx | hover 시 마지막 응답 재생성 |
| Git 상태 표시 | StatusBar.tsx | 브랜치, 변경 파일 수 |
| 커맨드 팔레트 | CommandPalette.tsx | Ctrl+P, 세션/파일/액션 |
| 단축키 오버레이 | KeyboardShortcutsOverlay.tsx | Ctrl+? |
| 라이트 테마 | theme.css | data-theme="light" |
| 데스크탑 알림 | App.tsx | 백그라운드 응답 완료 시 |
| 파일 드래그앤드롭 | InputBar.tsx | 파일 경로 자동 삽입 |
| 슬래시 커맨드 12개 | InputBar.tsx | /fix, /review, /test 등 |
| 파일 뷰어 검색 | FileViewer.tsx | Ctrl+F, 하이라이트 |
| 이미지 뷰어 | FileViewer.tsx | zoom, fit 모드 |
| 워크스페이스 멀티탭 | App.tsx | 여러 프로젝트 동시 작업 |
| 반응형 사이드바 | App.tsx | drag resize |

### Round 3 (이전) — UX 고도화

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 사이드바 토글 | App.tsx + TitleBar.tsx | Ctrl+B, ☰ 버튼, slide 애니메이션 |
| ✅ 이미지 인라인 미리보기 | InputBar.tsx | 붙여넣기 시 썸네일 + × 제거 버튼 |
| ✅ 권한 "세션 동안 허용" | PermissionModal.tsx + agent-bridge.ts | sessionAllowlist로 반복 허용 |
| ✅ 컨텍스트 한도 경고 | ChatPanel.tsx | 80%/95% 경고, 추정 토큰 표시 |
| ✅ 세션 피닝 | SessionList.tsx + session-handlers.ts | 📌 버튼 + 상단 고정 |
| ✅ 대화 전체 복사 버튼 | ChatPanel.tsx | 📋 클립보드 복사 (Markdown) |
| ✅ 스크롤 하단 버튼 | ChatPanel.tsx | 하단 이탈 시 ↓ 원형 버튼 |
| ✅ MessageBubble memo 버그 수정 | MessageBubble.tsx | isStreaming 변경 시 re-render 누락 수정 |

### Round 2 (이전) — UX·기능·성능

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 전역 단축키 | main/index.ts | Ctrl+Shift+Space → 앱 포커스 |
| ✅ 시스템 트레이 | main/index.ts | 트레이 아이콘 + 클릭 포커스 |
| ✅ 토큰 카운트 추적 | agent-bridge.ts + project-store.ts | 세션별 입출력 토큰 누계 |
| ✅ StatusBar 토큰 표시 | StatusBar.tsx | 입력↑ 출력↓ 토큰 수 + 비용 |
| ✅ CommandPalette `>` 모드 | CommandPalette.tsx | `>` 접두사로 커맨드만 필터 |
| ✅ ChatPanel 최적화 | ChatPanel.tsx + MessageBubble.tsx | StreamingSpinner memo, MD_COMPONENTS 상수, plain text 스트리밍 |
| ✅ 세션 자동 제목 생성 | App.tsx | 첫 응답 완료 시 자동 rename |

### Round 1 (이전) — 성능·보안·안정성

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ async I/O | session-handlers.ts | writeFileSync → writeFile 등 |
| ✅ 세션 인덱스 | session-handlers.ts | _index.json 으로 빠른 목록 조회 |
| ✅ node_modules 제외 | fs-handlers.ts | 파일 검색 시 node_modules 스킵 |
| ✅ local:// path traversal | main/index.ts | `..` 포함 경로 차단 |
| ✅ window bounds 디바운스 | main/index.ts | 500ms 디바운스 |
| ✅ interrupt 타입 수정 | agent-bridge.ts | error → interrupted |
| ✅ interrupted 이벤트 처리 | App.tsx | finishStreaming 정상 호출 |
| ✅ 터미널 리스너 단일화 | TerminalPanel.tsx | O(N)→O(1) 라우팅 |
| ✅ 터미널 리스너 cleanup | TerminalPanel.tsx | 탭 삭제 시 메모리 해제 |
| ✅ FileViewer link fix | FileViewer.tsx | window.open → openExternal |
| ✅ RAF 스트리밍 버퍼 | chat-store.ts | 프레임당 1회 state 업데이트 |
| ✅ 코드 스플리팅 | electron.vite.config.ts | 메인 번들 2.3MB→406kB |
| ✅ 타이핑 인디케이터 | ChatPanel.tsx | 응답 대기 중 스피너 표시 |
| ✅ 세션 ID 검증 | session-handlers.ts | path traversal 방지 |
| ✅ SDK import 캐싱 | agent-bridge.ts | 첫 호출 시 1회만 import |
| ✅ 동시 전송 방지 | agent-bridge.ts | 이전 요청 abort 후 신규 시작 |
| ✅ 파일 크기 제한 | fs-handlers.ts | 2MB 초과 파일 보호 메시지 |
| ✅ @types devDeps 이동 | package.json | 번들 크기 정확성 |
| ✅ 키보드 의존성 수정 | App.tsx | [chat, shortcutsOpen] → [chat.clearMessages, shortcutsOpen] |

---

## 단축키 목록

| 단축키 | 기능 |
|--------|------|
| `Ctrl+P` | 커맨드 팔레트 |
| `Ctrl+K` / `Ctrl+N` | 새 채팅 |
| `Ctrl+B` | 사이드바 토글 |
| `Ctrl+T` | 터미널 토글 |
| `Ctrl+Tab` | 탭 전환 |
| `Ctrl+W` | 현재 파일탭 닫기 |
| `Ctrl+1/2/3` | 모델 전환 (Opus/Sonnet/Haiku) |
| `Ctrl+Shift+Space` | 앱 포커스 (전역) |
| `Ctrl+?` | 단축키 목록 |
| `F12` | DevTools |
| `Ctrl+F` (파일 뷰어) | 파일 내 검색 |
| `Ctrl+=/-` (파일 뷰어) | 폰트 크기 조절 |

---

## 슬래시 커맨드 (InputBar)

`/` 입력 후 자동완성:

| 커맨드 | 용도 |
|--------|------|
| `/fix` | 버그 수정 |
| `/explain` | 코드 설명 |
| `/review` | 코드 리뷰 |
| `/refactor` | 리팩토링 |
| `/test` | 테스트 작성 |
| `/docs` | 문서화 |
| `/optimize` | 성능 최적화 |
| `/summarize` | 대화 요약 |
| `/translate` | 번역 |
| `/think` | 단계별 사고 |
| `/compare` | 비교 분석 |
| `/debug` | 디버깅 |

---

### Round 4 (이전) — 성능·탐색·접근성

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 파일 트리 검색 필터 | FileTree.tsx | 200ms 디바운스, 평면 결과 표시 |
| ✅ 사이드바 상태 영속화 | App.tsx | localStorage에 collapsed/width 저장 |
| ✅ WelcomeScreen 세션 표시 | App.tsx | 최근 대화 4개 + 프로젝트 직접 열기 |
| ✅ 메시지 우클릭 컨텍스트 메뉴 | MessageBubble.tsx | 복사, 코드 블록 복사, 바깥 클릭 닫기 |
| ✅ 가상 스크롤 | ChatPanel.tsx | @tanstack/react-virtual, 동적 높이 측정 |
| ✅ API 키 오류 도움말 | App.tsx | 401/auth 에러 감지 → 명확한 안내 메시지 |

### Round 5 (이전) — UX 심화

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 대화 내 검색 (Ctrl+F) | ChatPanel.tsx + App.tsx | 가상 스크롤 통합, ▲▼ 네비게이션, 매치 하이라이트 |
| ✅ 메시지 접기/펼치기 | MessageBubble.tsx | 500자/8줄 초과 시 collapse, 스트리밍 중 비활성 |
| ✅ 초안 자동저장 | InputBar.tsx | 500ms 디바운스 localStorage |
| ✅ 프롬프트 템플릿 라이브러리 | InputBar.tsx + app-config.ts + claude-handlers.ts | 사용자 정의 슬래시 커맨드 (노란색 구분) |
| ✅ 트레이 최소화 | main/index.ts | ×닫기 → 트레이 숨기기, 우클릭 메뉴 "열기/종료" |

### Round 6 (이전) — 설정·태그·내보내기

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 설정 패널 (Ctrl+,) | SettingsPanel.tsx + App.tsx + app-config.ts | 테마, 폰트 크기, 타임스탬프 토글, 기본 모델, 토큰 예산, TitleBar ⚙ 버튼 |
| ✅ 세션 태그/라벨 | SessionList.tsx + session-handlers.ts | 6색 컬러 태그, 태그 필터 바, 호버 시 🏷 팝오버 |
| ✅ HTML 포맷 내보내기 | ChatPanel.tsx + fs-handlers.ts | 다크 스타일 HTML + 저장 다이얼로그 |
| ✅ Changed Files 차이 뷰어 | ChangedFilesPanel.tsx + Sidebar.tsx + fs-handlers.ts | 인라인 git diff, +/- 색상 하이라이트, 접기/펼치기 |

### Round 7 (이전) — 성능·UX 고도화

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 세션 전체 텍스트 검색 | session-handlers.ts + CommandPalette.tsx | `#검색어`로 모든 세션 대화 내 검색, 매치 수/스니펫 표시 |
| ✅ FileViewer 인라인 편집 | FileViewer.tsx + fs-handlers.ts | ✏ 편집 모드, Ctrl+S 저장, 저장 상태 표시 |
| ✅ 키보드 접근성 강화 | SettingsPanel, CommandPalette, PermissionModal, ShortcutsOverlay | focus trap, aria-modal, role, auto-focus |

### Round 8 (이전) — 개발자 경험·생산성

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 프로젝트 시스템 프롬프트 | app-config.ts + agent-bridge.ts + SettingsPanel.tsx | 프로젝트별 시스템 프롬프트, 설정 패널 통합 |
| ✅ 코드 블록 ▶ 실행 | MessageBubble.tsx + terminal-store.ts + ChatPanel | 쉘 언어 감지, 활성 터미널로 전송 |
| ✅ 스트리밍 UX 개선 | ChatPanel.tsx + chat-store.ts + MessageBubble | 경과시간·tok/s 표시, 에러 ↺ 재시도 버튼 |

### Round 9 (이전) — 파일 관리·분할 뷰·백업

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 파일 트리 CRUD | FileTree.tsx + fs-handlers.ts | 새 파일/폴더 생성, 인라인 이름 바꾸기, 삭제 확인 |
| ✅ 파일 분할 뷰 | FileViewer.tsx + Sidebar.tsx + App.tsx | ⧉ 버튼·우클릭으로 나란히 비교, × 닫기 |
| ✅ 세션 백업/복원 | session-handlers.ts + SessionList.tsx | JSON 내보내기/가져오기 (↑ 백업 / ↓ 복원 버튼) |

### Round 10 (이전) — 탐색·검색·테마

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 프로젝트 코드 검색 | SearchPanel.tsx + Sidebar.tsx + fs-handlers.ts | 사이드바 🔍 탭, ripgrep 기반, Aa/정규식 옵션, 그룹 결과 |
| ✅ 최근 파일 목록 | FileTree.tsx + app-config.ts + fs-handlers.ts | 최근 15개 추적, 접기/펼치기, × 지우기 |
| ✅ 테마 커스터마이징 | SettingsPanel.tsx + app-config.ts + theme.css | 액센트 컬러 6색, 컴팩트 모드 (--msg-padding) |

### Round 11 (이전) — Git·분기·사운드

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ Git 작업 패널 | GitPanel.tsx + Sidebar.tsx + fs-handlers.ts | ⎇ 탭, 스테이징/해제·커밋·로그, git:statusFull로 StatusBar 호환 |
| ✅ 세션 분기 | session-handlers.ts + MessageBubble.tsx + App.tsx | 우클릭 → ⎇ 여기서 분기, 새 세션 자동 로드 |
| ✅ 응답 사운드 | sound.ts + App.tsx + SettingsPanel.tsx | Web Audio API 2음 차임, 테스트 버튼, soundEnabledRef |

### Round 12 (이전) — 파일 감지·편집·터미널

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 파일 시스템 감시 | fs-handlers.ts + FileTree.tsx + preload | fs.watch 기반 300ms 디바운스, 녹색 ● 활성 표시 |
| ✅ 사용자 메시지 편집·재전송 | MessageBubble.tsx + chat-store.ts + App.tsx | 더블클릭/✎ 버튼, Enter 재전송, 이후 메시지 잘라냄 |
| ✅ 터미널 ⌫ 지우기·탭 이름 변경 | TerminalPanel.tsx | ⌫ clear(), 더블클릭 인라인 이름 편집 |

### Round 13 (이전) — 터미널 검색·추론 파라미터·렌더링 성능

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 터미널 검색 (Ctrl+F) | TerminalPanel.tsx | @xterm/addon-search 설치, attachCustomKeyEventHandler로 캡처 |
| ✅ Temperature 슬라이더 | SettingsPanel.tsx + agent-bridge.ts + app-config.ts | 0.0-1.0, 기본값 1.0, claude:send 시 적용 |
| ✅ 렌더링 성능 개선 | MessageBubble.tsx + ChatPanel.tsx | useDeferredValue(완료 메시지), useTransition(검색), stale 시 opacity 0.7 |

### Round 14 (이전) — 코드 액션·북마크·세션 통계

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 코드 블록 빠른 액션 | MessageBubble.tsx + ChatPanel.tsx | 호버 시 설명/최적화/수정 버튼, ACTION_PROMPTS 템플릿 |
| ✅ 메시지 북마크 ★ | MessageBubble.tsx + chat-store.ts + BookmarksPanel.tsx | 호버 ☆/★ 토글, 금색 별 표시, 사이드바 ★ 탭 |
| ✅ 세션 통계 호버 | SessionList.tsx + session-handlers.ts | 400ms 딜레이 IPC, 💬 메시지수·~Ntok·날짜 |

### Round 15 (이전) — 파일 편집기·Git AI·경로 링크

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ FileViewer 찾기/바꾸기 | FileViewer.tsx | 편집 모드 Ctrl+H, 실시간 매치수, Replace/Replace All |
| ✅ AI 커밋 메시지 생성 | GitPanel.tsx + fs-handlers.ts | staged diff → claude-haiku-4-5 API, ✨ 버튼 |
| ✅ 채팅 내 파일 경로 클릭 | MessageBubble.tsx + ChatPanel + App.tsx | Windows/Unix 경로 감지, 클릭 시 FileViewer 탭 열기 |

### Round 16 (이전) — 메시지 복사·Git Diff 뷰·파일 내용 삽입

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 메시지 raw 복사 버튼 | MessageBubble.tsx | 호버 시 📋 버튼, msg.text 복사, 1.5초 ✓ 피드백 |
| ✅ Git 파일 diff 미리보기 | GitPanel.tsx + fs-handlers.ts + preload | 파일명 클릭 → diff 팝업, 라인 색상 구분, +/- 토글 분리 |
| ✅ 텍스트 파일 드래그→내용 삽입 | InputBar.tsx | 100KB 제한, 30개 확장자, 코드 블록 형식, 5000자 truncate |

### Round 17 (이전) — 성능·UX·협업 고도화

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 마크다운 파싱 캐싱 | MessageBubble.tsx | parsedRef로 동일 text 재파싱 방지, re-render 최적화 |
| ✅ 세션 마크다운 내보내기 | session-handlers.ts + SessionList.tsx + preload | 📄 버튼, dialog.showSaveDialog, 대화 → .md 변환 |
| ✅ InputBar @ 멘션 자동완성 | InputBar.tsx | @ 타이핑 시 최근 파일 드롭다운, 선택 시 코드 블록 삽입 |

### Round 18 (이전) — 자동화·팔레트·타임스탬프

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 세션 자동 제목 생성 | claude-handlers.ts + preload + App.tsx | 첫 응답 후 Haiku로 제목 생성, 실패 시 30자 폴백 |
| ✅ 메시지 타임스탬프 | (이미 구현됨) | HH:MM 형식으로 Role badge 옆 표시 |
| ✅ CommandPalette 확장 | CommandPalette.tsx + Sidebar.tsx + App.tsx | 12개 커맨드, 단축키 뱃지, 사이드바 탭 전환 |

### Round 19 (이전) — 수식·태그·시각화

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ KaTeX 수식 렌더링 | MessageBubble.tsx + main.tsx | remark-math + rehype-katex 설치, $...$ 및 $$...$$ 렌더링 |
| ✅ 세션 자동 태그 | claude-handlers.ts + preload + App.tsx | 첫 응답 후 Haiku로 태그 최대 3개 자동 생성 |
| ✅ StatusBar 컨텍스트 게이지 | StatusBar.tsx + App.tsx | 실제 API 토큰 기반 200k 대비 게이지 바, 색상 경보 |

### Round 20 (이전) — 시스템 연동·PDF·세션 UX

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 시스템 테마 자동 감지 | main/index.ts + preload + App.tsx + SettingsPanel | nativeTheme 이벤트, System 옵션 추가, OS 테마 자동 반영 |
| ✅ PDF 내보내기 | session-handlers.ts + preload + SessionList.tsx | 숨김 BrowserWindow로 HTML→PDF, 🖨 버튼 |
| ✅ 세션 날짜별 그룹화 | SessionList.tsx | 자정 기준 오늘/어제/이번주/이전 헤더, 핀 섹션 유지 |

### Round 21 (이전) — 노트·터미널·폰트

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 세션 노트 | session-handlers.ts + preload + SessionList.tsx | 📝 버튼, 인라인 textarea, Ctrl+Enter 저장, Esc 취소 |
| ✅ 터미널 히스토리 저장 | TerminalPanel.tsx | 💾 버튼, xterm buffer 추출, showSaveDialog + writeTextFile |
| ✅ 채팅 폰트 크기 단축키 | main/index.ts + preload + App.tsx + StatusBar + theme.css | Ctrl+=/−/0, 11-18px, --chat-font-size CSS 변수 |

### Round 22 (이전) — 협업·시각화·UX

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 메시지 이모지 반응 | chat-store.ts + MessageBubble.tsx + ChatPanel.tsx | 😊 팝업, 6개 이모지, 뱃지+카운트 표시, memo 감지 |
| ✅ 세션 통계 대시보드 | session-handlers.ts + preload + StatsPanel.tsx + Sidebar | 📊 탭, 세션수/7일 바차트/상위태그, globalStats IPC |
| ✅ 단축키 오버레이 업데이트 | KeyboardShortcutsOverlay.tsx | Ctrl+H/±/0/@멘션/터미널Ctrl+F 등 신규 단축키 추가 |

### Round 23 (이전) — 이미지·알림·일괄처리

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 이미지 라이트박스 | Lightbox.tsx + MessageBubble + ChatPanel + App | zoom-in 커서, Escape/배경 클릭 닫기, 90vw 확대 |
| ✅ 토스트 알림 시스템 | toast.ts + useToast.ts + Toast.tsx + App + SessionList | 전역 toast() 함수, 3초 자동 소멸, alert() 교체 |
| ✅ 다중 세션 일괄 삭제 | SessionList.tsx | 선택 모드, 체크박스, 전체/삭제 바, Escape 종료 |

### Round 24 (이전) — 재생성·즐겨찾기·터미널

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ AI 응답 재생성 버튼 | (이미 구현됨 확인) | ChatPanel handleRegenerate, 마지막 assistant에 ↺ |
| ✅ 파일 즐겨찾기 | app-config.ts + fs-handlers + preload + FileTree | ☆/★ 토글, 상단 즐겨찾기 섹션, 우클릭 메뉴 |
| ✅ 터미널 탭 드래그 재정렬 | TerminalPanel.tsx | draggable, borderLeft accent 표시, xterm ID Map 보존 |

### Round 25 (이전) — 편집기·스크롤·테마

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ FileViewer MD 분할 뷰 | FileViewer.tsx | 편집+ReactMarkdown 나란히, "분할 뷰" 버튼 토글 |
| ✅ 자동 스크롤 제어 | ChatPanel.tsx | isAtBottomRef 기반, "↓ 새 메시지" pill 버튼 |
| ✅ 커스텀 CSS 테마 | app-config + claude-handlers + SettingsPanel + css.ts | textarea 즉시 적용, 초기화 버튼, 앱 시작 시 복원 |

### Round 26 (이전) — 세션·파일 정보·Git 브랜치

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 세션 복제 | session-handlers.ts + preload + SessionList | duplicate-btn, 복사본 접미어, index 맨 위 등록 |
| ✅ 파일 정보 툴팁 | fs-handlers.ts + preload + FileTree.tsx | 500ms 딜레이, 크기·날짜 표시, 디렉토리 제외 |
| ✅ Git 브랜치 관리 | fs-handlers.ts + preload + GitPanel.tsx | 브랜치명 클릭 패널, ✓ 현재, checkout, 새 생성 |

### Round 27 (이전) — 메모리·병합·Stash

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 메모리 모니터 | main/index.ts + preload + StatusBar.tsx | rss 기준 3초 push, 500MB+ 경고색 |
| ✅ 세션 병합 | session-handlers.ts + preload + SessionList | ⊕ 버튼, 모드 배너, target 클릭 시 병합 |
| ✅ Git Stash | fs-handlers.ts + preload + GitPanel.tsx | stashList/Push/Pop/Drop, 접기 섹션 UI |

### Round 28 (완료) — 음성·스니펫·컨텍스트

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 음성 입력 | InputBar.tsx | Web Speech API 🎤 버튼, ko-KR + interimResults, pulse 애니메이션 |
| ✅ 코드 스니펫 라이브러리 | SnippetPanel.tsx + app-config.ts + Sidebar | 스니펫 CRUD, 📎 탭, pendingInsert 삽입 패턴 |
| ✅ 자동 컨텍스트 요약 | claude-handlers.ts + chat-store + ChatPanel | 30개+ 메시지 배너, Haiku 요약 압축, 🗜 버튼 |

### Round 29 (완료) — 새 창·비용·히스토리

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ Electron 새 창 | main/index.ts + preload/index.ts | Ctrl+Shift+N 전역 단축키 + app:newWindow IPC |
| ✅ API 비용 계산기 | StatusBar.tsx + chat-store.ts + App.tsx | 모델별 가격표, 💰 $X.XXX 실시간 표시 |
| ✅ 검색 히스토리 | SearchPanel.tsx | localStorage 최대 20개, 🕐 드롭다운, 개별/전체 삭제 |

### Round 30 (완료) — Mermaid·세션 정렬·입력 히스토리

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ Mermaid 다이어그램 렌더링 | MermaidBlock.tsx + MessageBubble.tsx | ```mermaid 코드블록 → SVG 렌더링, 에러 표시 |
| ✅ 세션 드래그 재정렬 | SessionList.tsx + session-handlers.ts + preload | HTML5 드래그, borderTop accent 피드백, 인덱스 영속 저장 |
| ✅ 입력 히스토리 Alt+↑/↓ | InputBar.tsx | 최대 100개 localStorage, Alt+↑(이전)/↓(다음), 현재 초안 보존 |

### Round 31 (완료) — 카운터·터미널 테마·탭 메뉴

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 입력창 문자/줄 카운터 | InputBar.tsx | 입력 시 NL·글자수 표시, 8000자 초과 빨간색 경고 |
| ✅ 터미널 컬러 테마 | TerminalPanel.tsx + app-config.ts + preload + main | dark/light/monokai/solarized/dracula 드롭다운, 실시간 전환 |
| ✅ 워크스페이스 탭 컨텍스트 메뉴 | App.tsx | 우클릭 → 이름변경(인라인)/탭닫기/새탭 |

### Round 32 (완료) — 신택스·핀·포커스

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ FileViewer 신택스 하이라이팅 | FileViewer.tsx | 언어 자동 감지, Prism 줄번호 포함, text fallback |
| ✅ 메시지 핀 | chat-store.ts + MessageBubble + ChatPanel + App | 📌/📍 버튼, 핀 메시지 접이식 상단 패널 |
| ✅ 포커스 모드 | App.tsx + KeyboardShortcutsOverlay | Ctrl+Shift+F, 사이드바·터미널 숨김, 우상단 배지 |

### Round 33 (완료) — 파일탐색·네트워크·히트맵

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ FileTree 키보드 탐색 | FileTree.tsx | ↑/↓/Enter/F2/←/→/Escape, accent outline 피드백 |
| ✅ 네트워크 상태 표시 | StatusBar.tsx | navigator.onLine 기반, 녹색/빨간색 dot, 오프라인 레이블 |
| ✅ 활동 히트맵 캘린더 | StatsPanel.tsx + session-handlers.ts | 12주×7일 GitHub 스타일, 4단계 녹색, tooltip |

### Round 34 (완료) — Git로그·북마크·스니펫

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ Git 커밋 히스토리 | GitPanel.tsx + fs-handlers.ts + preload | 커밋 목록, 클릭 시 diff 展開, git:log/show IPC |
| ✅ 북마크 검색 + 내보내기 | BookmarksPanel.tsx | 텍스트 필터, 📤 마크다운 다운로드 |
| ✅ 스니펫 카테고리 + 검색 | SnippetPanel.tsx + app-config.ts | category 필드, 그룹 헤더, 통합 검색 |

### Round 35 (완료) — 복원·팔레트·아카이브

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 파일 복원 버튼 | ChangedFilesPanel + fs-handlers + preload + App | ↩ 버튼, 확인 후 git checkout --, 리스트에서 제거 |
| ✅ 커맨드 팔레트 즐겨찾기 | CommandPalette.tsx | ★/☆ 토글, 사용빈도 배지, 즐겨찾기→전체 섹션 헤더 |
| ✅ 세션 아카이브 섹션 | SessionList.tsx | 30일+ 미핀 세션 → 📦 아카이브, 기본 접힘 |

### Round 36 (완료) — 툴뷰어·검색필터·프롬프트프로필

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ ToolUseIndicator 확장 | (이미 구현됨 확인) | collapsed 상태, ▸/▾, input/output JSON 뷰 기존 구현 |
| ✅ 검색 확장자 필터 칩 | SearchPanel.tsx | TS/TSX/JS 등 자동 추출, accent 토글, ✕ 전체 초기화 |
| ✅ 시스템 프롬프트 프로필 | SettingsPanel + app-config + main + preload | 이름 저장/불러오기/삭제, 칩 형태 빠른 전환 |

### Round 37 (완료) — 스크롤·터미널·세션팝업

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 채팅 ↑맨위 + 북마크 점프 | ChatPanel.tsx | scrollTop>500 시 ↑버튼, ★ 클릭→다음 북마크 virtualizer 이동 |
| ✅ 터미널 퀵 커맨드 | TerminalPanel.tsx | ls/git status 등 기본 3개, ⚙ 편집 모드, localStorage 저장 |
| ✅ StatusBar 세션 정보 팝업 | StatusBar.tsx + App.tsx | 💰 클릭 or ℹ 버튼, 세션 제목/생성일/토큰/비용 상세 |

### Round 38 (완료) — AI설명·Git액션·세션잠금

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 코드블록 AI 인라인 설명 | MessageBubble.tsx + claude-handlers + preload | 💡 버튼, Haiku 2-4줄 한국어, 토글로 숨기기 |
| ✅ Git 빠른 작업 | GitPanel.tsx + fs-handlers + preload | 🔄fetch/↩undo commit/🧹clean, 3초 결과 메시지 |
| ✅ 세션 잠금 | SessionList.tsx + session-handlers + preload | 🔒/🔓 토글, 삭제·이름변경·병합타겟 방지 |

### Round 39 (완료) — TODO·블레임·탭단축키

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ Tasks 패널 | TasksPanel.tsx + app-config + main + preload + Sidebar | 📋 탭, 우선순위 🔴🟡🟢, 전체/진행/완료 필터, 완료 정리 |
| ✅ Git Blame 뷰 | FileViewer.tsx + fs-handlers + preload + App | ⚖ 버튼, 작성자·날짜·hash 좌측 거터, cwd prop |
| ✅ 워크스페이스 탭 단축키 | App.tsx + KeyboardShortcutsOverlay | Ctrl+Alt+←/→ 순환, Ctrl+Shift+W 닫기 |

### Round 40 (완료) — 번역·설정관리·캘린더

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ AI 번역 버튼 | MessageBubble.tsx + claude-handlers + preload | 🌐 클릭, 한↔영 자동 감지, italic 번역문 표시, 원문 토글 |
| ✅ 설정 내보내기/가져오기 | SettingsPanel.tsx | 📤📥 JSON 파일 다운로드/업로드, version 검증 |
| ✅ 세션 캘린더 뷰 | CalendarPanel.tsx + Sidebar.tsx | 📅 탭, 월별 달력, 날짜별 세션 수 바, 클릭→세션 목록 |

### Round 41 (완료) — 프롬프트개선·시간구분·깃데코

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 프롬프트 개선 버튼 | InputBar.tsx + claude-handlers + preload | ✨ 클릭, Haiku로 명확한 프롬프트 재작성, 입력창 교체 |
| ✅ 채팅 시간 구분선 | ChatPanel.tsx | 1시간 이상 간격 시 날짜+시간 구분선, timestamp 없으면 스킵 |
| ✅ FileTree git 데코레이션 | FileTree.tsx | M/A/D/U/? 상태 배지, 5초 자기 폴링, 컬러 코딩 |

### Round 42 (완료) — 컬렉션·녹화·알림설정

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ 세션 컬렉션/폴더 | SessionList + session-handlers + preload | 📁 우클릭 메뉴, 이름 지정, 접이식 그룹 헤더 |
| ✅ 터미널 녹화 | TerminalPanel.tsx | 🔴 녹화 버튼, 타임스탬프 로그, ⏹ 저장 |
| ✅ 알림 설정 | SettingsPanel + app-config + main + preload | 4개 토글 (응답완료/백그라운드/긴세션/컨텍스트경고) |

### Round 43 (완료) — 테이블·태그·파일바꾸기

| 항목 | 파일 | 설명 |
|------|------|------|
| ✅ GFM 테이블 렌더링 | MessageBubble.tsx | remark-gfm 이미 있음, table/th/td/tr 스타일 렌더러 추가 |
| ✅ Git 태그 관리 | GitPanel.tsx + fs-handlers + preload | 🏷 목록/생성/삭제, 접이식 섹션 |
| ✅ 파일에서 바꾸기 | SearchPanel.tsx | ⇄ 토글, 바꿀 텍스트 입력, 모두 바꾸기 버튼 |

### Round 44 ✅ (2026-03-11)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 클립보드 히스토리 패널 | ClipboardPanel.tsx + clipboard-store.ts | Sidebar 🗂️ 탭, 최대 30개 중복 제거, 클릭 재복사, 전체 삭제 |
| ✅ FileViewer Ctrl+G 이동 | FileViewer.tsx | Ctrl+G 다이얼로그, 21px 줄 높이 계산, 전체 줄 수 표시 |
| ✅ 메시지 인용 답장 | ChatPanel.tsx + App.tsx + InputBar.tsx | ↩ 버튼으로 인용 블록 생성, pendingInsert 패턴 |

### Round 45 ✅ (2026-03-11)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 세션 검색 필터 | SessionList.tsx | 🔍 검색바, × 클리어, N개 매치 카운트, 실시간 필터링 |
| ✅ 파일 비교 패널 | DiffPanel.tsx + Sidebar.tsx | 🔀 탭, LCS diff 알고리즘, 색상 코드, 줄 번호 |
| ✅ AI 인사이트 (StatsPanel) | StatsPanel.tsx + claude-handlers.ts + preload | 💡 접이식 섹션, Haiku 분석, 3개 한국어 bullet |

### Round 46 ✅ (2026-03-11)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 이모지 반응 패널 | MessageBubble.tsx | 👍❤️😂🤔🎉 인라인 버튼, 카운트 표시, 활성 accent 배경 |
| ✅ 스니펫 가져오기/내보내기/단축키 | SnippetPanel.tsx + app-config.ts + preload | 📂 JSON/txt 가져오기, 📤 내보내기, /shortcut 배지 |
| ✅ 채팅 미니맵 | ChatPanel.tsx | 🗺 토글, 우측 40px 미니맵, 뷰포트 인디케이터, 클릭 탐색 |

### Round 47 ✅ (2026-03-11)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 스니펫 단축키 자동완성 | InputBar.tsx | /shortcut 트리거, 드롭다운 5개, ↑↓Enter 탐색, 내용 삽입 |
| ✅ 아웃라인 패널 | OutlinePanel.tsx + Sidebar.tsx | 📑 탭, H1/H2/H3 추출, 검색, 클릭 스크롤 |
| ✅ 터미널 멀티탭 | TerminalPanel.tsx | 이미 구현됨 (탭바, 드래그 재정렬, 더블클릭 이름변경) |

### Round 48 ✅ (2026-03-11)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 세션 마크다운 내보내기 | session-handlers.ts + SessionList.tsx | 📄 우클릭 메뉴, dialog.showSaveDialog, 역할별 H2 섹션 |
| ✅ 글로벌 토스트 시스템 | toast.ts + ToastContainer.tsx + App.tsx | 이벤트 에미터 패턴, 타입별 색상/아이콘, slide-in 애니메이션 |
| ✅ 메시지 그룹핑 | ChatPanel.tsx | 2분 이내 동일 role 연속 메시지 시각적 그룹, marginTop 조정 |

### Round 49 ✅ (2026-03-11)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 채팅 내 검색 (Ctrl+F) | ChatPanel.tsx | 이미 구현됨 (searchQuery, matchIdx, virtualizer.scrollToIndex) |
| ✅ 파일시스템 워처 IPC | fs-handlers.ts + FileTree.tsx | 이미 구현됨 (fs.watch, onDirChanged, refreshKey) |
| ✅ 단어 빈도 시각화 | StatsPanel.tsx | 📊 자주 쓴 단어, 빈도 비례 font-size/color, 세션 타이틀 코퍼스 |

### Round 50 ✅ (2026-03-11)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ AI 세션 요약 | claude-handlers.ts + ChatPanel.tsx + preload | 📝 요약 버튼, Haiku bullet points, 재생성, 접이식 패널 |
| ✅ 커맨드팔레트 고도화 | CommandPalette.tsx | 최근 파일/세션, AI 질문 제안, fuzzy scoring (120/100/70/30) |
| ✅ 파일트리 호버 미리보기 | FileTree.tsx | 600ms 디바운스, 20줄, 줄번호, 바이너리/크기 감지, 400×300 팝업 |

### Round 51 ✅ (2026-03-11)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ JS 코드 실행 샌드박스 | MessageBubble.tsx | ▶ 실행 버튼, new Function 샌드박스, 출력 패널, 50줄 제한 |
| ✅ 세션 자동 명명 | claude-handlers.ts + App.tsx + preload | 첫 메시지 전송 시 Haiku로 5-15자 한국어 제목 생성 |
| ✅ 사이드바 리사이즈 핸들 | App.tsx | 이미 구현됨, 범위 160-500px, 더블클릭 리셋, 투명→accent 색상 |

### Round 52 ✅ (2026-03-11)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 메시지 템플릿 시스템 | InputBar.tsx | 📋 버튼, 저장/삽입/삭제, localStorage, 검색, 최대 20개 |
| ✅ Git 스태시 관리 | fs-handlers.ts + GitPanel.tsx | 이미 구현됨 (stashList/Push/Pop/Drop, 접이식 섹션) |
| ✅ 플러그인 매니저 | PluginsPanel.tsx + fs-handlers.ts + Sidebar.tsx | 🧩 탭, JS 파일 스캔, 활성화/비활성화, 코드 미리보기 |

### Round 53 ✅ (2026-03-11)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 대화 분기 (Fork) | MessageBubble.tsx + ChatPanel.tsx + App.tsx | ⎇ 분기 버튼, session:fork IPC, 새 세션 (분기) 생성 |
| ✅ 설정 탭 구조 개편 | SettingsPanel.tsx | 일반/외관/AI/단축키/고급 5탭, accent 언더라인, 520px 폭 |
| ✅ MCP 서버 연결 패널 | ConnectionPanel.tsx + fs-handlers + Sidebar.tsx | 🔌 탭, ~/.claude.json 파싱, ping 테스트, 상태 색상 |

### Round 54 ✅ (2026-03-12)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ PDF 내보내기 버튼 | ChatPanel.tsx | 이미 구현됨, ExportPdfButton 추가 |
| ✅ 에이전트 태스크 패널 | AgentPanel.tsx + Sidebar.tsx | 🤖 탭, 예약 실행, 상태 추적, Haiku API 연동 |
| ✅ 커스텀 CSS 라이브 미리보기 | SettingsPanel.tsx + App.tsx | 이미 구현됨 (applyCustomCSS 유틸) |

### Round 55 ✅ (2026-03-12)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 긴 메시지 접기 개선 | MessageBubble.tsx | 2000자 기준, maxHeight 120px, gradient 페이드, 더보기▼/접기▲ |
| ✅ Git 브랜치 관리 | GitPanel.tsx + fs-handlers.ts + preload | 🌿 브랜치 섹션, 체크아웃/생성/삭제, force delete 확인 |
| ✅ AI 코드 문서화 | MessageBubble.tsx + claude-handlers.ts + preload | 📝 버튼, Haiku JSDoc 생성, #0d1a2d 패널 |

### Round 56 ✅ (2026-03-12)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 메시지 개인 메모 | MessageBubble.tsx + chat-store.ts | 🗒️ 버튼, 📎 배지, 노란 왼쪽 보더 패널, note? 필드 |
| ✅ SSH 원격 패널 | RemotePanel.tsx + fs-handlers.ts + Sidebar.tsx | 🖥️ 탭, ~/.ssh/config 파싱, 저장된 호스트, 클립보드 복사 |
| ✅ 멀티모델 전환 | MessageBubble.tsx + InputBar.tsx + chat-store.ts | 모델 배지, InputBar 드롭다운, localStorage 저장 |
| ✅ StatsPanel 훅 순서 버그 수정 | StatsPanel.tsx | useMemo 4개를 early return 앞으로 이동 |

### Round 57 ✅ (2026-03-12)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ AI 후속 질문 제안 | claude-handlers.ts + ChatPanel.tsx + App.tsx | 스트리밍 완료 후 3개 칩 표시, 클릭 즉시 전송 |
| ✅ FileTree CRUD | fs-handlers.ts + FileTree.tsx | 이미 구현됨 (우클릭 메뉴, 인라인 rename/create/delete) |
| ✅ 강조 색상 피커 | SettingsPanel.tsx + App.tsx | 7가지 프리셋, 커스텀 hex, --accent CSS 변수 즉시 반영 |
| ✅ 사이드바 탭 레이아웃 개편 | Sidebar.tsx | 2행 구조: 텍스트탭 5개(flex:1) + 이모지탭 12개(32px 스크롤) |

### Round 58 ✅ (2026-03-12)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 파일 드래그&드롭 첨부 | InputBar.tsx | isDragging 오버레이, 50KB/이미지 분기, file 태그 삽입 |
| ✅ 세션 멀티선택 병합 | SessionList.tsx + session-handlers.ts + preload | 선택 모드, 병합 IPC, 새 세션 생성 |
| ✅ 웰컴 스크린 | WelcomeScreen.tsx + ChatPanel.tsx | ✦ 로고, 3 퀵스타트 카드, 최근 세션, 단축키 힌트 |
| ✅ MessageBubble displayText TDZ 버그 수정 | MessageBubble.tsx | deferredText/displayText 선언을 useMemo 앞으로 이동 |

### Round 59 ✅ (2026-03-12)

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 인라인 이미지 렌더링 | MessageBubble.tsx | <image> 태그→file:// URL 변환, InlineImage 컴포넌트, 오류 플레이스홀더 |
| ✅ 세션 템플릿 시스템 | session-handlers.ts + SessionList.tsx + preload | 저장/목록/생성/삭제, ~/.claude-desktop/templates/ 폴더 |
| ✅ 채팅 글꼴 크기 슬라이더 | SettingsPanel.tsx + App.tsx | 12-20px 슬라이더, --chat-font-size 변수, 즉시 반영 |

### Round 60 ✅ (2026-03-12) — 최종 라운드

| 상태 | 항목 | 파일 | 설명 |
|------|------|------|------|
| ✅ 메시지 편집 이력 diff | chat-store.ts + MessageBubble.tsx | editHistory[] 필드, ✏️ N회 배지, 이전/현재 버전 비교 패널 |
| ✅ AI 스니펫 제안 | claude-handlers.ts + SnippetPanel.tsx + preload | 💡 버튼, Haiku JSON 추출, 삽입/추가 버튼 |
| ✅ 읽기 시간 & 통계 | MessageBubble.tsx | ~N분 읽기, ~N토큰 표시, hover 툴팁 |

## 전략 로드맵 (2026-03-12 기획팀 수립)

> 목표: **"Claude를 가장 잘 아는 Claude 전용 에이전트 워크스테이션"**
> - Cursor/Windsurf: 에디터 내 자동완성 중심
> - Claude.ai 웹: 범용 채팅
> - **이 앱**: Claude Agent SDK 100% 활용 — Thinking 시각화, 파일 되감기, 서브에이전트 관제, MCP 동적 관리

### Phase 1 — 즉시 착수 (임팩트↑, 난이도↓)

#### 🔴 안정성/보안 (Critical)

| 항목 | 위치 | 설명 |
|------|------|------|
| Shell Injection 수정 | `fs-handlers.ts` | `execAsync` 문자열 보간 → `execFile` + 배열 인자 |
| `openExternal` 화이트리스트 | `fs-handlers.ts:95` | `https:`, `http:` 프로토콜만 허용 |
| `writeTextFile` 경로 검증 | `fs-handlers.ts:145` | 절대경로 + `..` 포함 체크 |
| React 훅 규칙 위반 | `SessionList.tsx`, `ChatPanel.tsx` | useMemo/useState early return 순서 수정 |
| async try/catch 누락 | `MessageBubble.tsx` | handleExplain/Docs/Summarize/Translate |

#### ⚡ 성능 Quick Wins

| 항목 | 위치 | 설명 |
|------|------|------|
| SyntaxHighlighter ESM import | `MessageBubble.tsx` | CJS→ESM, tree-shaking 활성화, 번들 즉시 감소 |
| mermaid lazy load | `vite.config.ts` + `MermaidBlock.tsx` | 11MB+ 청크 분리, `React.lazy()` 래핑 |
| 스트리밍 타이머 통합 | `ChatPanel.tsx:249` | 2개 setInterval → 1개 |

#### 🎨 디자인 시스템 기반

| 항목 | 위치 | 설명 |
|------|------|------|
| WCAG AA 대비 수정 | `theme.css` | `--text-muted` 다크 #6b6b6b→#858585 |
| focus-visible 복원 | `global.css` | `:focus-visible { outline: 2px solid var(--accent) }` |
| 하드코딩 색상 제거 | 5개 파일 | WelcomeScreen/InputBar/ChatPanel/SettingsPanel/FileTree |
| 디자인 토큰 확장 | `theme.css` | spacing scale, typography scale, surface 계층, radius 확장 |

### Phase 2 — 중기 핵심 (Claude 차별화)

#### 🤖 Claude SDK 활용 확대 (현재 활용율 ~20%)

| # | 항목 | 설명 | 난이도 |
|---|------|------|--------|
| N1 | **SDK 메시지 전수 파싱** | agent-bridge.ts 16개 타입 처리 (현재 3개만) — 모든 기능의 토대 | 중간 |
| N2 | **Adaptive Thinking 시각화** | 접이식 사고 과정 패널 (`thinking` 블록) — Cursor/Windsurf 없는 Claude 전용 | 중간 |
| N3 | **Effort 레벨 선택** | `low/medium/high/max` 드롭다운 — 비용-품질 트레이드오프 직접 제어 | 낮음 |
| N4 | **maxBudgetUsd 설정** | 세션 비용 상한 (StatusBar 연동) — 비용 불안 해소 | 낮음 |
| N5 | **Prompt Suggestion 내장** | SDK 내장으로 현재 별도 Haiku 호출 비용 제거 | 낮음 |
| N6 | **파일 체크포인팅 되감기** | `Query.rewindFiles()` — 메시지 단위 파일 복원 (경쟁사 없음) | 높음 |
| N7 | **MCP 동적 관리 UI** | `Query.setMcpServers()` 런타임 연결/해제 | 중간 |
| N8 | **Permission Mode 전환** | 계획→실행→읽기전용 런타임 전환 | 중간 |
| N9 | **CLAUDE.md / Skills 연동** | 프로젝트 설정 + Claude Code CLI 세션 동기화 | 중간 |

#### ✨ 시각 경험

| # | 항목 | 설명 | 난이도 |
|---|------|------|--------|
| V1 | **메시지 버블 차별화** | user: 좌측 accent 라인, AI: success 라인 + 배경색 구분 | 중간 |
| V2 | **코드 블록 헤더 바** | 언어명 + 액션 버튼 상단 배치, 라인 넘버 | 중간 |
| V3 | **스트리밍 커서** | 블링킹 `|` + typing indicator 3-dot bounce | 중간 |
| V4 | **패널 전환 애니메이션** | 사이드바/터미널 width/height CSS transition | 중간 |
| V5 | **ToolUseIndicator 개선** | indeterminate 프로그레스 바, 도구별 아이콘, 접기 애니메이션 | 중간 |
| V6 | **스켈레톤 UI** | 세션/파일트리/패널 로딩 상태 shimmer 애니메이션 | 낮음 |
| V7 | **컨텍스트 링 게이지** | StatusBar 직선 바 → SVG 원형 게이지 | 낮음 |

#### ⚡ 성능 심화

| # | 항목 | 설명 | 난이도 |
|---|------|------|--------|
| P1 | **Web Worker 마크다운 파싱** | 10K자+ 응답 메인 스레드 언블로킹 | 높음 |
| P2 | **미니맵 독립 컴포넌트** | 스크롤마다 React 렌더 우회, DOM 직접 업데이트 | 중간 |
| P3 | **가상화 이미지 로딩** | IntersectionObserver 지연 로드 | 낮음 |
| P4 | **자동 context 압축** | SDK `SDKCompactBoundaryMessage` 활용, opt-in | 중간 |

### Phase 3 — 장기 비전 (아키텍처 변경)

| 항목 | 설명 |
|------|------|
| **멀티패널 자유 레이아웃** | CSS Grid + resize, "코딩/대화/리뷰" 프리셋 (GoldenLayout 없이) |
| **서브에이전트 오케스트레이션** | SDK `agents` 옵션, 병렬 에이전트 진행 시각화 (칸반) |
| **세션 분기 그래프** | SVG 기반 git 그래프 스타일 대화 히스토리 시각화 |
| **CSS 모듈 마이그레이션** | 인라인 스타일 100% → CSS modules (hover/pseudo-class 해방) |
| **Claude Code CLI 세션 동기화** | `~/.claude/projects/` 통합, CLI↔GUI 원활 전환 |
| **멀티에이전트 팀 워크스테이션** | 프론트/백/QA 에이전트 동시 작업, git worktree 격리 |

---

## 차후 작업 목록 (미구현)

### 🔥 신규 추가 (고우선순위)

| # | 항목 | 설명 | 난이도 |
|---|------|------|--------|
| A | **멀티패널 자유 레이아웃** | 패널을 드래그로 자유 배치, 분할(수직/수평), 크기 조절, 레이아웃 저장 (GoldenLayout 또는 직접 구현) | 높음 |
| B | **실시간 자동완성 (인텔리센스)** | 터미널 입력 시 명령어/플래그/경로 인라인 제안, 파일트리 연동, 화살표로 선택 | 높음 |
| C | **@ 멘션 파일 컨텍스트** | `@filename.ts` 입력 시 파일 내용 자동 삽입, 드롭다운 자동완성 | 중간 |

### 🗑️ 제거 계획 (Git 패널 정리)

| 항목 | 이유 | 대상 파일 |
|------|------|-----------|
| **GitPanel 탭 제거** | 터미널에서 직접 git 명령으로 충분, 패널 과부하 해소 | Sidebar.tsx의 `git` 탭 |
| **ChangedFilesPanel 탭 제거** | GitPanel과 기능 중복 | Sidebar.tsx의 `changes` 탭 |
| **관련 IPC 핸들러 정리** | `git:log`, `git:show`, `git:fetch`, `git:blame` 등 미사용 시 제거 | fs-handlers.ts |

> ⚠️ 실제 제거 전 사용 빈도 확인 필요 — 필요시 설정에서 탭 숨김 옵션으로 대체 고려

### 🔥 임팩트 높음

| # | 항목 | 설명 | 난이도 |
|---|------|------|--------|
| 1 | **TTS 읽어주기** | 🔊 버튼, `speechSynthesis` API로 어시스턴트 응답 음성 출력 | 낮음 |
| 2 | **응답 평가 시스템** | 👍/👎 버튼 + 이유 메모, 에이전트 행동 피드백 루프 | 낮음 |
| 3 | **AI 페르소나 프리셋** | 🎭 버튼으로 "코드 리뷰어/번역가/분석가" 시스템 프롬프트 즉시 전환 | 낮음 |
| 4 | **Python 코드 실행** | IPC → `python -c` subprocess, JS처럼 ▶ 버튼 인라인 실행 | 중간 |

### ⚡ 성능 개선

| # | 항목 | 설명 | 난이도 |
|---|------|------|--------|
| 5 | **Web Worker 마크다운 파싱** | 긴 메시지 렌더링 시 메인 스레드 블로킹 해소 | 높음 |
| 6 | **가상화 이미지 로딩** | viewport 밖 이미지 지연 로드 (IntersectionObserver) | 낮음 |
| 7 | **자동 context 압축** | SDK SDKCompactBoundaryMessage 활용, opt-in UI 제공 | 중간 |

### 🎨 시각화 & 탐색

| # | 항목 | 설명 | 난이도 |
|---|------|------|--------|
| 8 | **세션 분기 그래프** | fork된 세션들의 트리 시각화 (SVG, D3 없이) | 높음 |
| 9 | **HTTP API 테스터** | `GET https://...` 감지 → 인라인 응답 표시 | 중간 |
| 10 | **코드 diff 하이라이팅** | before/after 코드블록 자동 감지 → 변경사항 색상 표시 | 중간 |
| 11 | **세션 전체 텍스트 검색** | 모든 세션 내용 검색 (BM25 또는 SQLite FTS) | 높음 |
