# PRD — HQ Mode: Dev Lab Command Center

> 작성일: 2026-03-12
> 대상 앱: claude-desktop (Electron + React 18)
> 현재 라운드: Round 62

---

## 1. 개요

Claude Desktop의 기본 채팅 UI를 유지하면서, 토글 한 번으로 "Dev Lab Command Center" 뷰로 전환하는 HQ Mode를 추가한다.

**목표:**
- 타이쿤 게임의 시각 언어(실시간 게이지, 에이전트 상태 시각화, ops 피드)를 개발 도구에 이식
- 게임 **메카닉(XP, 해금, 업적)은 없음** — 순수 시각/UX
- 언어는 개발 도메인 유지 (Session, Agent, Token, Context, Deploy 등)
- 기존 기능은 100% 유지, HQ 모드는 레이아웃/스킨 전환

---

## 2. 현재 아키텍처 (변경 영향 범위)

```
App.tsx
├── TitleBar.tsx                   ← HQ 토글 버튼 추가
├── [Sidebar.tsx]                  ← HQ 모드에서 AgentBay로 교체
│    └── SessionList.tsx           ← 기존 로직 재사용 (데이터 소스)
├── [ChatPanel.tsx]                ← HQ 모드에서 AgentConsole 래퍼 안에 위치
├── TerminalPanel.tsx              ← 변경 없음
├── StatusBar.tsx                  ← HQ 모드에서 ResourceBar로 교체
└── [신규] OpsFeed.tsx             ← HQ 모드 전용 하단 피드
```

**신규 파일:**
```
src/renderer/src/components/hq/
├── AgentBay.tsx         — 사이드바 대체 (에이전트 카드 그리드)
├── AgentCard.tsx        — 로봇 아바타 + 상태 애니메이션
├── ResourceBar.tsx      — 상단 리소스 게이지 바
└── OpsFeed.tsx          — 하단 실시간 tool call 피드

src/renderer/src/styles/
└── hq.css               — HQ 모드 전용 CSS
```

---

## 3. HQ 모드 레이아웃

### 3-1. 전체 구조

```
┌──────────────────────────────────────────────────────────────┐
│  ResourceBar  [◉ HQ]  CONTEXT ████████░░ 78%  42.1k tokens  │  32px
├─────────────────────┬────────────────────────────────────────┤
│                     │                                        │
│   AGENT BAY         │          AGENT CONSOLE                 │
│   (280px)           │                                        │
│                     │  ┌─ Session: "refactor auth" ────────┐ │
│  dot-grid bg        │  │  (기존 ChatPanel 그대로 동작)      │ │
│                     │  └───────────────────────────────────┘ │
│  [AgentCard×N]      │                                        │
│                     │                                        │
│  [ + SPAWN AGENT ]  │                                        │
│                     │                                        │
├─────────────────────┴────────────────────────────────────────┤
│ OPS ▶  [READ] auth.ts  ·  [EDIT] auth.ts:142  ·  [BASH] ... │  36px
└──────────────────────────────────────────────────────────────┘
```

### 3-2. 노멀 ↔ HQ 전환

- `TitleBar`에 `[⬡ HQ]` 버튼
- 클릭 시 `App.tsx`의 `hqMode: boolean` state 토글
- `electron-store`에 저장 (재실행 시 유지)
- `<div data-hq="true">` root attribute 세팅 → CSS layout 전환
- 전환 시 `transition: all 0.25s ease` 슬라이드 애니메이션

---

## 4. 컴포넌트 상세 명세

### 4-1. AgentBay

**역할:** SessionList를 에이전트 카드 그리드로 대체

**데이터 소스:** 기존 `window.api.sessionList()` IPC — 변경 없음

```typescript
interface AgentBayProps {
  sessions: SessionMeta[]
  activeSessionId: string | null
  currentAgentIsStreaming: boolean       // 현재 선택 세션의 스트리밍 여부
  currentAgentToolUses: ToolUseItem[]    // 현재 선택 세션의 마지막 tool uses
  onSelectSession: (id: string) => void
  onNewSession: () => void
}
```

**시각:**
- 배경: `radial-gradient(#1e1e3a 1px, transparent 1px)` dot grid, `background-size: 24px 24px`
- 헤더: `AGENT BAY  ● 3 online` (숫자 badge)
- 카드들 세로 스택
- 하단 고정: `[ + SPAWN AGENT ]` 버튼 (점선 테두리 스타일)

---

### 4-2. AgentCard

**역할:** 세션 1개를 에이전트로 시각화

```typescript
interface AgentCardProps {
  session: SessionMeta
  isActive: boolean          // 현재 선택된 세션
  isStreaming: boolean        // 이 세션이 현재 스트리밍 중
  lastToolName?: string      // 마지막 실행 tool 이름
  onClick: () => void
}
```

**레이아웃:**
```
╔═══════════════════════╗
║   (◎) (◎)             ║  ← 로봇 눈 (SVG)
║    ─────              ║  ← 입 (상태에 따라 변함)
║─────────────────────  ║
║ AGENT-03              ║  ← session title (truncate)
║ claude-sonnet-4-6     ║  ← 모델명
║ ▓▓▓▓▓░░░░░ 12.4k tok  ║  ← 토큰 게이지
║ 3m ago                ║  ← 마지막 활동
╚═══════════════════════╝
```

**상태별 스타일:**

| 상태 | 눈 | 입 | 카드 테두리 | glow |
|------|----|----|------------|------|
| idle | 느린 깜빡임 | `─────` | `rgba(255,255,255,0.08)` | 없음 |
| active (streaming) | 빠른 깜빡임 + cyan | `▄▄▄▄▄` (bounce) | `rgba(0,152,255,0.4)` | `0 0 20px rgba(0,152,255,0.25)` |
| tool running | orbit 아이콘 | `·····` (scroll) | `rgba(220,220,170,0.4)` | `0 0 16px rgba(220,220,170,0.2)` |
| error | `× ×` (red) | `∧∧∧∧∧` | `rgba(244,71,71,0.4)` | `0 0 16px rgba(244,71,71,0.2)` |
| selected | 상태 유지 | 상태 유지 | `rgba(0,152,255,0.6)` | 더 강하게 |

**로봇 눈 CSS 구현:**
- `<svg>` 2개 circle — 외부 라이브러리 불필요
- `@keyframes blink { 0%,90%,100% { ry: 6px } 95% { ry: 1px } }`
- active 상태: `fill: #00d4ff`, `filter: drop-shadow(0 0 4px #00d4ff)`
- error 상태: `content: '×'` text로 교체

**토큰 게이지:**
- 세션 토큰 / 전체 세션 중 최대 토큰으로 정규화 (상대 비율)
- 50k 초과 시 주황, 100k 초과 시 빨강

---

### 4-3. ResourceBar

**역할:** StatusBar 대체 (HQ 모드 상단)

```typescript
interface ResourceBarProps {
  contextUsage: number          // 0~1
  sessionTokens: number         // 현재 세션 누적
  totalCost: number
  activeAgentCount: number      // streaming 중인 세션 수
  model: string
  gitBranch?: string
  gitChanged?: number
  memMB?: number
  onToggleHQ: () => void
}
```

**레이아웃 (좌→우):**
```
[⬡ HQ] | CONTEXT [████████░░] 78% | TOKENS 42.1k | $0.0024 | ● 1 active | ⎇ main +3 | 128MB | ● online
```

**게이지 스타일:**
- 기존 StatusBar의 4px 바를 8px로 키움
- 색상 로직 유지 (`< 50%` → white, `50~80%` → amber, `> 80%` → red)
- 게이지 위에 숫자 tooltip hover

---

### 4-4. OpsFeed

**역할:** 현재 active session의 tool call을 실시간 가로 피드로 표시

```typescript
interface OpsFeedProps {
  toolUses: ToolUseItem[]      // chatStore에서
  isStreaming: boolean
}
```

**레이아웃:**
```
OPS ▶  [✓ READ] src/auth.ts  ·  [↻ BASH] npm test  ·  [✓ EDIT] auth.ts:142  ·  ...
```

**동작:**
- 새 tool use 추가 시 우측에서 슬라이드인 (`@keyframes slideInRight`)
- 리스트가 길어지면 자동으로 좌측 스크롤 (오래된 것 밀려남)
- 세션 변경 시 fade out + clear
- `status: running` → 주황 + rotate 아이콘
- `status: done` → 초록 + `✓`
- `status: error` → 빨강 + `✗`
- 클릭 시 해당 메시지로 ChatPanel 스크롤

---

## 5. 데이터 흐름

### 현재 chat-store → HQ 데이터 매핑

```
chat-store.isStreaming          → AgentCard: active 상태
chat-store.messages[-1].toolUses → AgentCard: tool running 상태
                                 → OpsFeed: 피드 아이템
chat-store.sessionInputTokens   → AgentCard: 토큰 게이지
chat-store.sessionOutputTokens  → ResourceBar: token count

project-store.totalCost         → ResourceBar: cost
```

**AgentCard의 실시간 상태 제한:**
- **현재 선택된 세션**만 실시간 스트리밍 상태 반영 (chat-store가 current session만 트래킹)
- **다른 세션들**은 sessionList의 `updatedAt`, `messageCount`로 최신성 표시
- 향후 Phase 2에서 multi-session 동시 스트리밍 지원 가능 (IPC 확장 필요, 이번 스코프 아님)

---

## 6. CSS / 시각 스타일 가이드

### HQ 전용 CSS 변수 (`hq.css`)

```css
[data-hq="true"] {
  --hq-bg: #0d0d1a;
  --hq-bay-bg: #0f0f1e;
  --hq-dot-color: rgba(255,255,255,0.04);
  --hq-dot-size: 24px;

  --hq-card-bg: rgba(255,255,255,0.025);
  --hq-card-border: rgba(255,255,255,0.07);
  --hq-card-active-border: rgba(0,152,255,0.45);
  --hq-card-active-glow: 0 0 20px rgba(0,152,255,0.2);

  --hq-ops-bg: rgba(0,0,0,0.4);
  --hq-ops-height: 36px;
  --hq-resource-height: 32px;

  /* 에이전트 상태 컬러 */
  --hq-idle: rgba(255,255,255,0.3);
  --hq-active: #00b4ff;
  --hq-tool: #dcdcaa;
  --hq-error: #f44747;
}
```

### Dot Grid Mixin
```css
.hq-dot-grid {
  background-image: radial-gradient(var(--hq-dot-color) 1px, transparent 1px);
  background-size: var(--hq-dot-size) var(--hq-dot-size);
}
```

### 전환 애니메이션
```css
/* Normal → HQ 진입 */
.hq-enter { animation: hqFadeIn 0.25s ease; }
@keyframes hqFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}

/* OpsFeed 아이템 슬라이드인 */
@keyframes opsFeedSlideIn {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

---

## 7. 구현 Phase 계획

### Phase 1 — 레이아웃 뼈대 (우선순위: HIGH)
**목표:** HQ 모드 토글 + 레이아웃 전환 동작
**변경 파일:** `TitleBar.tsx`, `App.tsx`, `hq.css`

- [ ] `TitleBar.tsx`: `[⬡ HQ]` 토글 버튼 추가, `onToggleHQ` prop
- [ ] `App.tsx`: `hqMode` state + `electron-store` 저장/로드
- [ ] `App.tsx`: HQ 모드 시 레이아웃 조건부 분기 (`Sidebar` ↔ `AgentBay`, `StatusBar` ↔ `ResourceBar`)
- [ ] `AgentBay.tsx`: 빈 shell (SessionList 데이터만 받아서 카드 placeholder 렌더)
- [ ] `ResourceBar.tsx`: 빈 shell (기존 StatusBar 데이터 재활용)
- [ ] `hq.css`: dot grid, 기본 변수

### Phase 2 — AgentCard 애니메이션 (우선순위: HIGH)
**목표:** 로봇 아바타 + 상태 시각화
**변경 파일:** `AgentCard.tsx` 신규, `AgentBay.tsx` 완성

- [ ] 로봇 눈 SVG 컴포넌트 (`RobotEyes.tsx` 또는 AgentCard 내 인라인)
- [ ] idle / active / tool-running / error 상태별 CSS 애니메이션
- [ ] 카드 glow 효과 (box-shadow transition)
- [ ] 토큰 게이지 바
- [ ] 현재 선택 세션 → `isStreaming` / `toolUses` 실시간 반영
- [ ] `[ + SPAWN AGENT ]` 버튼

### Phase 3 — 라이브 데이터 연결 (우선순위: MEDIUM)
**목표:** ResourceBar + OpsFeed 실제 동작

- [ ] `ResourceBar.tsx`: context 게이지, token count, cost, git, mem 실제 데이터 바인딩
- [ ] `OpsFeed.tsx`: chatStore.messages 마지막 toolUses 소비, 슬라이드인 애니메이션
- [ ] 세션 전환 시 OpsFeed clear + fade

### Phase 4 — 폴리시 (우선순위: LOW)
**목표:** 완성도

- [ ] Normal ↔ HQ 전환 애니메이션 (0.25s)
- [ ] AgentCard 선택 시 Console 패널 포커스 애니메이션
- [ ] OpsFeed 아이템 최대 20개 유지 (오래된 것 fade out)
- [ ] HQ 모드에서 light theme 대응 (다크 전용 변수 분기)
- [ ] 키보드 단축키: `Ctrl+Shift+H` → HQ 모드 토글

---

## 8. 변경하지 않는 것

- `ChatPanel.tsx` — 내부 로직 변경 없음, HQ에서도 그대로 동작
- `SessionList.tsx` — 데이터 소스로만 활용, 렌더링은 AgentBay에 위임
- `ToolUseIndicator.tsx` — ChatPanel 내부에서 그대로 동작
- `agent-bridge.ts`, `claude-handlers.ts` — IPC 변경 없음
- 기존 Normal 모드 — HQ 토글 off 시 완전 동일하게 유지

---

## 9. 기술 리스크 & 결정 사항

| 리스크 | 대응 |
|--------|------|
| 로봇 SVG 애니메이션 퍼포먼스 | `will-change: transform` + `memo()` wrapping |
| multi-session 실시간 상태 | Phase 1~3은 현재 선택 세션만, 향후 IPC 확장으로 해결 |
| light theme 호환 | Phase 4에서 `[data-theme="light"][data-hq="true"]` 오버라이드 |
| OpsFeed 스크롤 성능 | 최대 20개 유지, 가상화 불필요 |
| electron-store key 충돌 | `settings.hqMode` key 사용 (기존 키 확인 필요) |

---

## 10. 완료 기준

- [ ] HQ 토글 버튼 클릭 시 레이아웃 전환, 재실행 후에도 유지
- [ ] AgentCard에서 현재 선택 세션의 streaming/tool 상태가 실시간 반영
- [ ] ResourceBar에 context%, token, cost 게이지 표시
- [ ] OpsFeed에 tool call 스트림이 실시간 표시
- [ ] Normal 모드 기능 100% 정상 동작 (회귀 없음)
