# claude-desktop 프로젝트 아키텍처 가이드

> 이 문서는 Claude Code가 작업 시 따라야 할 설계 규격, 컨벤션, 스타일을 정의합니다.

---

## 프로젝트 성격

**claude-desktop = CC 에디터 대체** — Cocos Creator 없이 `.fire/.scene/.prefab`을 직접 파싱·편집하는 독립형 Electron 앱.

- 런타임: Electron 35, React 18, TypeScript, Zustand, Vite
- 파일 기반 접근 (WebSocket 브릿지 제거 완료)
- CC 2.x / 3.x 파일 형식 자동 감지

---

## 레이어 아키텍처

```
UI Layer       components/     → 순수 렌더링 + props 전달
Domain Layer   domains/        → 상태 + IPC 어댑터 + 커맨드
Kernel Layer   kernel/         → Typed Message Bus (CommandBus + EventBus)
Shared         shared/         → IPC 스키마 타입 (main/renderer 공유)
```

### 레이어 원칙
- **UI → Domain**: `dispatch(command)` 또는 `useStore()` 직접 구독
- **Domain → IPC**: adapter.ts에서만 `window.api.*` 호출
- **UI는 IPC를 직접 알면 안 됨** — 새 기능 추가 시 adapter 경유 필수
- **기존 `window.api` 직접 호출은 점진적 제거** — 신규 코드는 Kernel/Domain 경유

---

## 파일 구조 규칙

### 새 도메인 추가 시
```
src/renderer/src/domains/{name}/
  domain.ts      # 순수 타입 (외부 의존 없음)
  store.ts       # zustand create() — 전역 상태
  adapter.ts     # IPC 이벤트 → store 업데이트 / Command → window.api
  commands.ts    # CommandBus 핸들러 등록
  index.ts       # public API re-export
```

### 새 Cocos 배치 기능 추가 시 (BatchInspector)
```
src/renderer/src/domains/cocos/plugins/{group}/
  {featureName}.tsx   # BatchPlugin 구현 (각 30~100줄)
```
- `BatchPlugin` 인터페이스 (`plugins/types.ts`) 반드시 준수
- `plugins/registry.ts`에 등록 필수
- **BatchInspector.tsx는 직접 수정 금지** (66줄 thin shell 유지)

### 새 커스텀 훅 추가 시
```
src/renderer/src/hooks/use{Name}.ts
```
- 반환 타입 interface export 필수 (`export interface {Name}Return { ... }`)
- deps 파라미터가 있으면 interface로 타입 지정 (`interface {Name}Deps`)
- 부수효과(useEffect) 정리 함수 반드시 return

### 새 공유 컴포넌트 추가 시
```
src/renderer/src/components/shared/{ComponentName}.tsx
```
- Props interface export 필수
- 스타일: inline style (CSS-in-JS) — 별도 CSS 파일 없이 var() CSS 변수 활용

---

## 상태 관리 패턴

### 전역 상태 → zustand store
```typescript
// domains/{name}/store.ts 패턴
import { create } from 'zustand'
export const use{Name}Store = create<{State}>((set, get) => ({ ... }))
```

### 컴포넌트 로컬 상태 → useState/useRef
- 단일 컴포넌트에서만 쓰이는 상태는 로컬 유지
- 여러 컴포넌트 공유 시 domain store로 승격

### App 레벨 오케스트레이션 → AppContent + AppLayout
- **AppContent** (`App.tsx`): 훅 호출 + 상태 선언 + 이펙트만 (JSX 없음)
- **AppLayout** (`components/shared/AppLayout.tsx`): JSX 렌더링만 (로직 없음)
- 도메인 훅은 번들 객체 (`workspace`, `settings`, `resize`)로 AppLayout에 전달

---

## IPC / Kernel 패턴

### 새 IPC 채널 추가 시
1. `shared/ipc-schema.ts`에 타입 추가
2. `main/ipc/`에 핸들러 추가
3. `preload/index.ts`에 노출
4. `kernel/types.ts`에 AppCommand / AppEvent 추가
5. 해당 domain의 `adapter.ts`에서 연결

### Kernel Command 디스패치 (신규 코드)
```typescript
const dispatch = useKernel()
dispatch({ type: 'cocos:saveScene', payload: { root, sceneFile } })
```

### 레거시 직접 호출 (기존 코드 — 점진적 제거 대상)
```typescript
window.api.ccFileSaveScene(root)  // 직접 호출 — 신규 코드에서 사용 금지
```

---

## 컴포넌트 스타일 가이드

### CSS 변수 (var() 사용 필수)
```
--bg-primary, --bg-secondary, --bg-hover
--text-primary, --text-muted
--border
--accent, --accent-rgb
--font-mono
```

### 컴포넌트 크기 기준
| 파일 | 목표 | 경고선 |
|------|------|--------|
| 일반 컴포넌트 | ≤200줄 | >500줄 |
| 도메인 훅 | ≤200줄 | >300줄 |
| 플러그인 파일 | ≤100줄 | >150줄 |
| 스토어 | ≤300줄 | >500줄 |

파일이 경고선을 초과하면 분리 검토 필수.

### 타입 안전성
- `any` 금지 원칙 (AppLayout의 `project`/`chat` props 제외 — 순환 import 방지 예외)
- 컴포넌트 props interface는 반드시 파일 내 export
- discriminated union 활용 (switch-exhaustiveness)

---

## QA / 검증 규칙

```bash
npx tsc --noEmit     # 0 에러 필수
npm run qa           # 2615 Pass / 0 Warning / 0 Critical 유지
```

- 새 기능 추가 시 `scripts/qa-checks/`에 체크 항목 추가 의무
- 체크 파일: `check-rounds.ts`, `check-ipc.ts`, `check-components.ts` 등
- QA Pass 수가 감소하면 커밋 금지

---

## 커밋 메시지 규칙

형식: **제목(1줄) + 빈줄 + 본문(원인/설계 의도)**

```
{type}: {무엇을 바꿨는지 구체적으로}

왜 필요했는지(버그 원인 또는 기능 목적),
어떤 방식으로 해결/구현했는지.
```

- type: `feat`(기능), `fix`(버그), `refactor`(리팩), `docs`(문서), `chore`(설정)
- Round 작업: `R{N}` 접두사 포함 (예: `feat: R2711 SceneView ...`)
- 일반적 표현 금지 ("일괄 설정" → 구체적 API/기능명 기술)
- ❌ `fix: key 중복 수정` → ✅ `fix: key=0 충돌 — spacingX/Y가 같은 부모에서 기본값 0 공유`

---

## 금지 사항

- `window.api.*` 직접 호출을 신규 컴포넌트에 추가하지 않는다
- BatchInspector.tsx에 기능 직접 추가하지 않는다 (플러그인 파일 생성)
- AppLayout.tsx에 비즈니스 로직 추가하지 않는다 (handlers는 AppContent에서 정의)
- 500줄 초과 단일 파일 생성하지 않는다 (명확한 이유 없으면)
- tsc 에러가 있는 상태로 커밋하지 않는다
