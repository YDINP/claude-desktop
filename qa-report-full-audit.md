# Claude Desktop — 전체 기능 이슈 분석 보고서 (종합)

> 작성일: 2026-03-13
> 분석 방법: 5개 병렬 oracle agent (도메인별) + 1개 SceneView 전용 (이전 세션)
> tsc ✅ | build ✅ | qa (Critical 0 / Warning 0) ✅ 통과 이후 심층 분석

---

## 전체 요약

| 도메인 | 🔴 Critical | 🟡 Major | 🟢 Minor |
|--------|------------|---------|---------|
| Electron 보안/IPC/빌드 | 4 | 8 | 4 |
| 파일시스템/Git/에디터 | 3 | 6 | 7 |
| 채팅/Claude API/세션 | 3 | 6 | 7 |
| 터미널/에이전트/패널 | 2 | 6 | 5 |
| App.tsx/워크스페이스/패널 | 1 | 7 | 11 |
| SceneView (신규 구현) | 8 | 14 | 14 |
| **합계** | **21** | **47** | **48** |

> ⚠️ SceneView 상세는 별도 `qa-report-sceneview-issues.md` 참조

---

## 🔴 CRITICAL — 즉시 수정

### [SEC-C1] `new Function(code)` — 렌더러 임의 코드 실행
**파일**: `MessageBubble.tsx:80`

Claude 응답에 포함된 JS 코드 블록이 1,000자 미만이면 렌더러에서 즉시 실행됨. 실제 샌드박스 없음(`console` 교체만). `window.api` 접근 가능 시 IPC를 통해 파일시스템·프로세스 실행으로 확장 가능.

**수정**: iframe sandbox + postMessage, 또는 Web Worker, 또는 실행 전 사용자 재확인 + 코드 서명

---

### [SEC-C2] `connections:pingServer` — `shell:true`로 임의 명령 실행
**파일**: `fs-handlers.ts:732-755`

```typescript
spawn(command, [...args, '--version'], { shell: true })
```
`command`/`args`가 렌더러에서 직접 전달됨. 셸 메타문자 injection으로 임의 OS 명령 실행 가능. **RCE 경로**.

**수정**: `shell: false`로 변경, allowlist 기반 명령어 제한

---

### [SEC-C3] `fs:exportHtml` — 경로 검증 없는 임의 경로 쓰기
**파일**: `fs-handlers.ts:138-145`

```typescript
await writeFile(filePath, html, 'utf-8')  // 검증 없음
```
`fs:writeTextFile`에는 `..` 체크가 있지만 `fs:exportHtml`은 전혀 없음. 임의 경로에 임의 내용 쓰기 가능.

**수정**: `fs:writeTextFile`과 동일한 경로 검증 적용

---

### [SEC-C4] `fs:delete` — 안전 경로 판별 로직 결함
**파일**: `fs-handlers.ts:544-556`

길이 10 제한 (`C:\Windows` = 10자, 통과), `path.resolve(filePath)`로 검증 후 `filePath` 원본으로 삭제 (TOCTOU). 중요 시스템 폴더 보호 없음.

**수정**: `normalized`로 `rm` 호출, 프로젝트 루트 외 경로 차단

---

### [SEC-C5] Electron v33 — EOL, 7 메이저 버전 뒤처짐
**파일**: `package.json:45`

현재 Stable: v40.x. Electron 33은 EOL. Chromium ~130 기반으로 6개월+ 보안 패치 누락. Critical CVE 다수 존재.

**수정**: `electron: "^40.0.0"` 업그레이드 (네이티브 애드온 재빌드 포함)

---

### [SEC-C6] 전체 IPC — 파일시스템 R/W 무제한 (allowlist 없음)
**파일**: `fs-handlers.ts` 전반

렌더러가 시스템 전체 경로를 직접 지정 가능한 핸들러 15개+:
- `fs:read-file`, `fs:read-file-base64` — 임의 파일 읽기
- `fs:writeTextFile`, `fs:exportHtml` — 임의 쓰기
- `fs:delete` — 재귀 삭제
- `plugins:readFile` — 플러그인 디렉토리 외 파일 읽기 가능

sandbox=false + 대형 IPC 표면 = 렌더러 XSS → OS 전체 접근

**수정**: 프로젝트 루트 또는 허용 디렉토리 기반 allowlist 적용

---

### [SEC-C7] 세션 인덱스 TOCTOU — 동시 저장 시 데이터 손실
**파일**: `session-handlers.ts:106-107`

```typescript
let index = await readIndex()
const existingEntry = (await readIndex()).find(...)  // 두 번 읽음
```
두 읽기 사이에 다른 핸들러가 `writeIndex()` 완료 시 구버전 덮어쓰기. 원자성 없는 `writeIndex`로 비정상 종료 시 인덱스 0바이트.

**수정**: `readIndex()` 1회, 원자적 쓰기 (tmp → rename)

---

### [SEC-C8] PTY `available` 전역 비활성화 — spawn 실패 시 터미널 전체 불능
**파일**: `pty-manager.ts:56-57`

하나의 탭에서 spawn 실패 시 `available = false`가 전역으로 설정됨. 이후 모든 `create()` 호출 무시 → 터미널 기능 완전 비활성화.

**수정**: `available` 플래그를 인스턴스 단위로 관리

---

### [SEC-C9] WorkspaceSnapshot에 전체 `chat.messages` 포함
**파일**: `App.tsx:685`

수백 메시지 × 다중 워크스페이스 = IPC 대용량 전달 + 민감 데이터(API 키, 비밀번호) 영속 저장.

**수정**: 스냅샷에서 `messages` 제외, sessionId만 저장 후 복원 시 로드

---

### [SEC-C10] PromptChainPanel — 언마운트 후 동시 체인 실행
**파일**: `PromptChainPanel.tsx:261-343`

`finally` 없이 `setIsRunning(false)` → 탭 전환 시 언마운트. 재마운트 후 사용자가 다시 실행 클릭 가능 → 두 체인이 동일 chainId로 동시 실행, localStorage 경합.

**수정**: `useRef` abort flag + cleanup에서 체인 취소

---

## 🟡 MAJOR — 우선순위 높음 (기능 결함)

### Electron 보안/IPC

| ID | 파일 | 이슈 |
|----|------|------|
| M-SEC1 | `index.ts:80` | F12 DevTools — 프로덕션 빌드에서 무조건 활성화 (`isDev` 가드 없음) |
| M-SEC2 | `index.ts:117-140` | `local://` 프로토콜 bypassCSP + home 디렉토리 전체 허용 + TOCTOU (resolvedPath 검증 후 filePath로 읽기) |
| M-SEC3 | `fs-handlers.ts:101` | `shell:open-external` — 도메인 allowlist 없음 |
| M-SEC4 | `terminal-handlers.ts:5` | PTY 생성 시 cwd 경로 검증 없음 |
| M-SEC5 | `fs-handlers.ts` 전반 | `execAsync` (shell 경유) git 명령 다수 — `cwd`에 shell injection 가능 |
| M-SEC6 | `ipc-schema.ts` | ~130개 IPC 채널 중 cc-handlers만 상수 사용, 나머지 전부 문자열 리터럴 |
| M-SEC7 | `package.json` | electron-builder 설정 없음 — ASAR/코드서명/node-pty 패키징 미정의 |
| M-SEC8 | `package.json:47` | `electron-rebuild` deprecated → `@electron/rebuild` 교체 필요 |

### 파일시스템/Git

| ID | 파일 | 이슈 |
|----|------|------|
| M-FS1 | `fs-handlers.ts` 전반 | `git status/fetch/clean/branches` 등 `execAsync` (shell) 사용 — cwd injection 경로 |
| M-FS2 | `fs-handlers.ts:558` | `fs:watchDir` watcher 생명주기 누수 — 프로젝트 전환 시 이전 watcher 잔존 |
| M-FS3 | `SearchPanel.tsx:138` | `handleReplaceAll` regex ReDoS — 렌더러 freeze 가능 |
| M-FS4 | `fs-handlers.ts:401` | `git:log limit` 검증 없이 shell에 삽입 |
| M-FS5 | `DiffPanel.tsx:43` | `useCallback` 의존성 누락 (`leftContent`/`rightContent` stale) |
| M-FS6 | `fs-handlers.ts:422` | `git:show`/`git:blame` maxBuffer 미설정 → 대형 커밋에서 메모리 과다 |

### 채팅/Claude API

| ID | 파일 | 이슈 |
|----|------|------|
| M-CHAT1 | `agent-bridge.ts:302` | `interrupt()` 시 `textFlushTimer` 미정리 → 중단 후 텍스트 계속 전송 |
| M-CHAT2 | `agent-bridge.ts:280` | `pendingPermissions` Promise — abort/reset 시 reject 없이 영구 누수 |
| M-CHAT3 | `ChatPanel.tsx:355` | 스트리밍 타이머 `chat.messages` stale closure — 토큰 레이트 항상 0 표시 |
| M-CHAT4 | `session-handlers.ts:104` | `JSON.stringify` circular reference → 인덱스 업데이트 전 파일 쓰기 실패 시 불일관 상태 |
| M-CHAT5 | `session-handlers.ts:197` | `globalSearch` — O(n) 파일 읽기, 무제한 메모리 적재 |
| M-CHAT6 | `session-handlers.ts:545` | PDF 내보내기 — tmpHtml 고정 경로 충돌 + BrowserWindow 누수 |

### 터미널/에이전트

| ID | 파일 | 이슈 |
|----|------|------|
| M-TERM1 | `TerminalPanel.tsx:142` | 에러 배너 버퍼 탭 간 공유 → A탭 에러가 B탭에서 재트리거 |
| M-TERM2 | `AgentPanel.tsx:235` | 언마운트 후 비동기 `runTask` 계속 실행 + localStorage 저장 지속 |
| M-TERM3 | `AgentPanel.tsx:338` | 스케줄러 `setTasks` updater 내에서 async `runTask` 호출 — 상태 배치 불안정 |
| M-TERM4 | `PromptChainPanel.tsx:279` | 빈 step 결과 `''` 무음 전파 — 이후 체이닝 의미 없는 결과 생산 |
| M-TERM5 | `work-history.ts:22` | localStorage `QuotaExceededError` 무음 실패 — 이후 상태 불일관 |
| M-TERM6 | `command-learner.ts` | 비밀번호·토큰 포함 명령어 평문 localStorage 저장 |

### App.tsx/패널

| ID | 파일 | 이슈 |
|----|------|------|
| M-APP1 | `App.tsx:405` | 워크스페이스 이름 인메모리만 — 재시작 시 소실 |
| M-APP2 | `App.tsx:800` | 동일 파일 중복 탭 방지 — 대소문자/상대경로 정규화 없음 |
| M-APP3 | `App.tsx:1262` | AgentBay 드래그 — 창 이탈 시 `mouseup` 없어 드래그 상태 고착 |
| M-APP4 | `TasksPanel.tsx:37` | `saveTasks` 비동기 경합 — debounce/큐 없어 순서 역전 시 과거 상태 저장 |
| M-APP5 | `SnippetPanel.tsx:162` | JSON 임포트 필드 검증 없음 + 파일 크기 제한 없음 |
| M-APP6 | `ClipboardPanel.tsx:21` | `clipboard-store` 구현 불투명 — 권한 실패 처리 미확인 |
| M-APP7 | `ConnectionPanel.tsx:83` | autoPing 인터벌 — `servers.length` 변경마다 재등록, 직전 인터벌 미정리 가능 |

---

## 🟢 MINOR (주요 항목만)

| 파일 | 이슈 |
|------|------|
| `fs-handlers.ts:537` | `fs:rename` — newName에 `../` traversal 검증 없음 |
| `SearchPanel.tsx:68` | wholeWord 모드에서 regex 특수문자 미이스케이프 |
| `fs-handlers.ts:845` | `includePattern` — rootPath 범위 밖 glob 탈출 가능 |
| `ChangedFilesPanel.tsx:87` | diff 캐시 파일 변경 후 무효화 없음 |
| `TerminalPanel.tsx:52` | HMR 후 `termIdCounter` 리셋 → 고아 pty 프로세스 |
| `useProjectContext.ts:6` | 빠른 경로 변경 시 이전 분석 결과로 덮어쓰기 (AbortController 없음) |
| `command-learner.ts` | 비밀번호 에코 off 여부 모름 — 입력 버퍼링 위험 |
| `ChatPanel.tsx:396` | setTimeout focus cleanup 없음 |
| `StatsPanel.tsx:87` | totalTokens = sessionCount × 500 임의 추정치 |
| `RemotePanel.tsx:73` | "연결" 버튼 — 실제로는 클립보드 복사만 수행 (UX 불일치) |
| `session-handlers.ts:619` | `session:setCollection` fileExists 체크 없음 |
| `BookmarksPanel.tsx:20` | 클립보드 복사 catch 없음 (공통 패턴) |
| `DiffPanel.tsx:69` | 오류 시 이전 diff 화면 잔존 |
| `ipc-schema.ts:91` | CCNode.scale Vec2 선언이지만 3x는 Vec3 반환 |
| `App.tsx:289` | WorkspaceTabBar 컨텍스트 메뉴 외부 클릭 해제 없음 |

---

## 수정 우선순위 로드맵

### 🚨 Tier 1 — 보안/데이터 손실 (즉시)
1. **SEC-C1** `new Function()` — 코드 실행 샌드박스 교체
2. **SEC-C2** `pingServer shell:true` → `shell:false` + 명령어 allowlist
3. **SEC-C3** `fs:exportHtml` 경로 검증 추가
4. **SEC-C5** Electron 버전 업그레이드 (33 → 40)
5. **SEC-C7** 세션 인덱스 TOCTOU + 원자적 쓰기
6. **M-TERM6** command-learner 민감 명령어 필터링

### ⚡ Tier 2 — 기능 결함 (1-2주)
7. **SEC-C9** WorkspaceSnapshot에서 messages 분리
8. **SEC-C10** PromptChainPanel abort flag
9. **M-CHAT1/M-CHAT2** agent-bridge interrupt() 정리
10. **M-SEC2** local:// 프로토콜 TOCTOU 수정
11. **SEC-C8** PTY available 인스턴스 단위화
12. **M-APP3** AgentBay 드래그 창 이탈 처리

### 🔧 Tier 3 — 코드 품질 (백로그)
13. IPC 채널명 상수 통일 (M-SEC6)
14. electron-builder 설정 추가 (M-SEC7)
15. electron-rebuild → @electron/rebuild (M-SEC8)
16. git 명령 execAsync → execFileAsync 통일 (M-SEC5/M-FS1)
17. watcher lifecycle 정리 (M-FS2)
18. localStorage QuotaExceeded fallback (M-TERM5)

---

## 참고 파일
- `qa-report-sceneview-issues.md` — SceneView 전용 상세 분석 (Critical 8 / Major 14 / Minor 14)
- `qa-report-roundlatest.md` — 기존 QA 스크립트 결과 (433 pass)

*보고서 생성: ultrawork mode, 5개 oracle agent 병렬*
