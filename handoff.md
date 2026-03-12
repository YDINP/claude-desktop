# Handoff - claude-desktop
> 마지막 업데이트: 2026-03-11

## 프로젝트 개요
`C:\Users\a\Documents\claude-desktop`
Electron + React + electron-vite로 만든 Claude 채팅 + 코드 에디터 하이브리드 앱.

## 완료된 작업 (이번 세션)

### 핵심 기능
- [x] 워크스페이스 탭 — Open Folder 시 기존 세션 유지, 새 탭 생성
- [x] 파일 탭 — Claude 채팅 탭 + 파일 뷰어 탭 공존
- [x] Ctrl+W — 앱 종료 대신 활성 파일 탭만 닫기 (main process `before-input-event`)
- [x] Ctrl+R — 렌더러 리로드 차단 (탭 상태 날아가는 버그 방지)
- [x] Ctrl+K/N — 새 채팅 시작
- [x] Ctrl+T — 터미널 토글
- [x] **Ctrl+Tab** — 파일 탭 순환 (Shift+Ctrl+Tab: 역방향) ← 신규
- [x] Ctrl+휠 — 파일 뷰어 글자/이미지 크기 조정
- [x] 세션 자동 저장 — 스트리밍 완료 시 userData JSON 저장
- [x] 세션 목록 자동 갱신 — `session:saved` 커스텀 이벤트

### 파일 뷰어
- [x] 마크다운 렌더링 (ReactMarkdown + remark-gfm)
- [x] 코드 신택스 하이라이팅 (react-syntax-highlighter, vscDarkPlus)
- [x] **이미지 뷰어** — `local://` 커스텀 프로토콜로 로컬 이미지 직접 서빙 ← 신규
  - `protocol.registerSchemesAsPrivileged` → `protocol.handle('local', ...)` in main/index.ts
  - FileViewer에서 IPC base64 방식 제거, `local://localhost?path=...` URL 사용
- [x] MD 하이퍼링크 — 앱 내 네비게이션 차단, 외부 브라우저로 열기

### UX 개선
- [x] 코드 블록 복사 버튼 (MessageBubble)
- [x] 툴 사용 콜랩스 (ToolUseIndicator)
- [x] 입력 히스토리 ↑/↓ (InputBar)
- [x] 스트리밍 브레일 스피너 (ChatPanel)
- [x] 메시지 hover 복사 (MessageBubble)
- [x] FileTree 아이콘 — 폴더/파일 2종류로 단순화
- [x] **StatusBar 비용 표시** — `totalCost > 0` 시 `$X.XXXX` 표시 ← 신규
- [x] **사이드바 드래그 리사이즈** — 우측 가장자리 드래그로 너비 조정 (140~480px) ← 신규
- [x] **FileTree 현재 파일 하이라이트** — 활성 파일탭과 동일한 파일을 accent 색으로 표시 ← 신규

## 아키텍처 요점

### 커스텀 프로토콜 (이미지)
```typescript
// src/main/index.ts
protocol.registerSchemesAsPrivileged([
  { scheme: 'local', privileges: { secure: true, standard: true, bypassCSP: true, supportFetchAPI: true } }
])
// app.whenReady() 안에서:
protocol.handle('local', async (request) => {
  const url = new URL(request.url)
  const filePath = url.searchParams.get('path') ?? ''
  const data = await readFile(filePath)
  return new Response(data, { status: 200, headers: { 'Content-Type': MIME[ext] } })
})
```

### 워크스페이스 스냅샷
- `WorkspaceSnapshot`: `{ messages, sessionId, openTabs, activeTab }`
- 워크스페이스 전환 시 현재 스냅샷 저장, 대상 스냅샷 복원
- `chat.hydrate(msgs, sid)` — chat-store 상태 교체

### 파일/사이드바 리사이즈
- 터미널: `bottomHeight` state + `isDragging` + mousemove 리스너
- 사이드바: `sidebarWidth` state + `isSidebarDragging` + mousemove 리스너

- [x] **워크스페이스 탭 퍼시스턴스** — 앱 재시작 시 이전에 열었던 모든 워크스페이스 복원 ← 신규
  - `AppConfig`: `openWorkspacePaths[]` + `activeWorkspacePath` 저장
  - IPC: `project:get-workspaces`, `project:set-workspaces`
  - App.tsx: 시작 시 전체 복원, 변경 시 자동 저장
- [x] **Ctrl+P 커맨드 팔레트** — 세션 검색 + 열린 탭 검색 (CommandPalette.tsx) ← 신규
  - 세션 제목/경로 필터링, 화살표 키 + Enter 선택, Escape 닫기

## 잠재적 개선 포인트 (미구현)
- [ ] Ctrl+P — 파일/세션 검색 팔레트 (VS Code 스타일)
- [ ] 파일 뷰어 내 Ctrl+F 검색
- [ ] 탭 드래그 재정렬
- [ ] 파일트리 우클릭 컨텍스트 메뉴
- [ ] 워크스페이스 지속성 — 앱 재시작 시 워크스페이스 복원

## 주요 파일
| 파일 | 역할 |
|------|------|
| `src/main/index.ts` | Electron 메인, 커스텀 프로토콜, before-input-event |
| `src/main/ipc/fs-handlers.ts` | readDir, readFile, readFileBase64 IPC |
| `src/renderer/src/App.tsx` | 워크스페이스/탭/단축키/레이아웃 |
| `src/renderer/src/components/shared/FileViewer.tsx` | 파일/이미지 뷰어 |
| `src/renderer/src/components/sidebar/FileTree.tsx` | 파일트리 (activeFilePath 하이라이트) |
| `src/preload/index.ts` | contextBridge API 노출 |
| `src/renderer/src/env.d.ts` | 렌더러용 Window.api 타입 |
