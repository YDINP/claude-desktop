# PRD: CC 에디터 앱 구현 — Phase 2 계획서

> 작성일: 2026-03-13
> 기준: Round 413 완료 상태
> 목표: Claude Desktop 앱 안에서 CC 에디터 핵심 경험 완결

---

## 현재 구현 상태 (Phase 1 완료 기준)

### 완료된 CC 통합 기능

| 영역 | 구현 완료 |
|------|----------|
| 연결 | WebSocket bridge (2x:9090, 3x:9091), 자동재연결, 포트 감지 |
| 씬 트리 | SceneTreePanel — 계층 보기, 검색, 인라인 이름 편집, 노드 선택 |
| 노드 속성 | NodePropertyPanel — Transform/Opacity/Color/Slider, 컴포넌트 섹션, JSON 복사 |
| 씬뷰 | SceneView — 노드 렌더링, 멀티셀렉트, 드래그 이동, 리사이즈 핸들, undo/redo, z-order |
| 에셋 브라우저 | AssetBrowserPanel — 폴더트리, 검색, 타입필터, 경로 복사 |
| Extension | cc-ws-extension-2x, cc-ws-extension-3x (HTTP+WS) |
| 기타 | 노드 생성/삭제, 컴포넌트 props 수정, openEditor, detectProject, installExtension |

### 알려진 버그

| 버그 | 원인 | 수정 방법 |
|------|------|----------|
| `cc:get-assets` HTTP 404 | 이전 버전 익스텐션 설치됨 (assets/tree 라우트 누락) | 익스텐션 재설치 + IPC error handling 강화 |
| CC_GET_ASSETS 에러 미처리 | ipcMain.handle에 try/catch 없음 | try/catch 추가, `{ tree: [], error }` 반환 |

---

## Phase 2 목표 (2026-03-13 방향 전환)

**"CC 에디터를 실행하지 않고도 claude-desktop 안에서 Cocos 프로젝트 파일을 직접 파싱·편집·저장한다"**

### 핵심 전략 변경
| | 기존 (Phase 1) | 신규 (Phase 2) |
|---|---|---|
| 방식 | CC 에디터 실행 + WebSocket 연결 | 프로젝트 파일 직접 파싱·저장 |
| CC 에디터 필요 여부 | 필수 | **불필요** (선택적) |
| 버전 지원 | 포트 기반 (2x:9090, 3x:9091) | 파일 형식 기반 (.fire / .scene) |
| 오프라인 작업 | 불가 | **가능** |

### 이원화 모드
- **파일 직접 편집 모드** (기본): CC 에디터 비실행 → `.fire`/`.scene`/`.prefab` 직접 파싱·저장
- **라이브 브릿지 모드** (선택): CC 에디터 실행 중 → 기존 WebSocket 실시간 연동
- 앱이 CC 에디터 연결 상태를 **자동 감지**해서 모드 전환

비목표:
- CC 에디터 창 임베드 (기술적 불가, GPU 충돌)
- 애니메이션/파티클 편집
- 스크립트 로직 컴파일 (코드 편집은 Monaco로 별도)

---

## CC 파일 직접 편집 아키텍처

### 버전별 파일 형식

| 버전 | 씬 파일 | 프리팹 | 프로젝트 감지 |
|------|---------|--------|-------------|
| CC 2.x | `.fire` (JSON) | `.prefab` (JSON) | `project.json` 존재 |
| CC 3.x | `.scene` (JSON) | `.prefab` (JSON) | `package.json` → `creator.version: "3.x"` |

### 신규 파일 구조
```
src/main/cc/
├── cc-bridge.ts          — 기존 WS 브릿지 (라이브 모드)
├── cc-file-parser.ts     — [신규] .fire/.scene/.prefab 직접 파싱
├── cc-file-writer.ts     — [신규] 씬/프리팹 파일 직접 저장
└── cc-version-adapter.ts — [신규] 2x/3x 공통 인터페이스 어댑터
```

### 공통 노드 인터페이스 (버전 무관)
```typescript
interface CCSceneNode {
  uuid: string
  name: string
  active: boolean
  position: { x: number; y: number; z?: number }
  rotation: number | { x: number; y: number; z: number }
  scale: { x: number; y: number }
  size?: { width: number; height: number }
  anchor?: { x: number; y: number }
  opacity: number
  color?: { r: number; g: number; b: number; a: number }
  components: { type: string; props: Record<string, unknown> }[]
  children: CCSceneNode[]
}

interface CCFileParser {
  version: '2x' | '3x'
  parseScene(filePath: string): Promise<CCSceneNode>
  parsePrefab(filePath: string): Promise<CCSceneNode>
  serializeScene(root: CCSceneNode, originalRaw: unknown): string
}
```

### 2x vs 3x 파싱 차이
| 항목 | CC 2.x (.fire) | CC 3.x (.scene) |
|------|---------------|----------------|
| 노드 구조 | `__depends__` 배열 (참조 기반) | 트리형 `children` 배열 |
| 컴포넌트 키 | `_components` | `comps` / `__prefab__` |
| UUID | 짧은 alphanumeric | 하이픈 포함 긴 UUID |
| 좌표계 | 2D (x, y) | 3D (x, y, z) |
| 색상 | `_color: {r,g,b,a}` | `__type__: "cc.Color"` |

### IPC 확장
```typescript
// cc-handlers.ts 추가 핸들러
'cc:parseSceneFile'    — 파일 경로 → CCSceneNode 트리
'cc:writeSceneFile'    — 변경된 노드 트리 → 파일 저장
'cc:listSceneFiles'    — 프로젝트 내 씬/프리팹 파일 목록
'cc:detectVersion'     — 프로젝트 경로 → '2x' | '3x'
```

---

## Phase 2 작업 계획

### [P0] 즉시 수정 — 버그 / 안정성

#### P0-1. cc:get-assets 404 수정
- **원인**: 설치된 익스텐션이 구버전 (assets/tree 라우트 없음)
- **수정**: `cc-handlers.ts` `CC_GET_ASSETS` 핸들러에 try/catch 추가
  ```typescript
  ipcMain.handle(CC_GET_ASSETS, async (_e, port: number) => {
    try {
      return await getCCBridge(port).getAssets()
    } catch (e) {
      return { tree: [], error: `에셋 로드 실패 (익스텐션 재설치 필요): ${String(e)}` }
    }
  })
  ```
- **UI 개선**: 에러 메시지에 "재설치" 버튼 추가
- **근본 해결**: 사용자가 CC 프로젝트에 익스텐션 재설치 필요

#### P0-2. QA / Lint / 의존성 전수 검증
- `npm run build` — TypeScript 타입 에러 0개
- `npm run lint` (있으면) — ESLint 경고 0개
- `npm audit` — 취약 의존성 확인
- `npm run qa` — QA 스크립트 전체 통과
- 불필요한 deps 정리 (package.json 검토)

#### P0-3. 리팩토링 우선순위
- 파일당 300줄 초과 컴포넌트 분리 검토 (SessionList 등)
- 반복 패턴 (`copiedXxx` state) 커스텀 훅 `useClipboard()` 추출
- `window.api as any` 캐스팅 → 타입 정의 보완
- CC 관련 패널들 공통 스타일 변수 추출

---

### [P1] CC 에디터 코어 — 에셋 & 씬 관리

#### P1-1. 에셋 브라우저 고도화
- **썸네일 미리보기**: 텍스처 파일 hover 시 img 태그로 미리보기 (CC 프로젝트 로컬 파일 접근)
- **에셋 우클릭 메뉴**: 경로 복사, 파일 탐색기에서 열기, 프리팹 인스턴스화
- **드래그 앤 드롭 → 씬**: 에셋을 SceneView에 드롭하면 노드로 생성
  - Sprite: cc.Sprite 컴포넌트 추가
  - Prefab: instantiate
- **에셋 타입 아이콘 개선**: 파일 확장자별 색상 구분

#### P1-2. 씬 전환
- **씬 목록 표시**: `/assets/tree`에서 `.fire` / `.scene` 파일 추출
- **씬 로드 API**: CC 2x `/scene/open`, CC 3x `Editor.Scene.open()`
- **씬 저장 버튼**: `/scene/save` 또는 `Ctrl+S` 단축키
- SceneTreePanel 상단에 씬 드롭다운 추가

#### P1-3. 프리팹 지원
- **프리팹 인스턴스화**: 에셋 브라우저에서 prefab 선택 → 씬에 배치
- **프리팹 편집 모드**: 선택 노드가 prefab root일 때 편집 옵션
- Extension 엔드포인트: `POST /scene/instantiate-prefab`

---

### [P2] CC 에디터 코어 — 컴포넌트 편집

#### P2-1. Label 컴포넌트 인라인 편집
- NodePropertyPanel에서 `cc.Label` 감지 → 텍스트 인라인 편집 UI
- `string` / `fontSize` / `color` / `horizontalAlign` 지원
- 변경 즉시 CC에 반영 (실시간 미리보기)

#### P2-2. Sprite 컴포넌트
- `spriteFrame` 에셋 피커 (에셋 브라우저 모달)
- `type` (SIMPLE/SLICED/TILED) 드롭다운
- `sizeMode` 선택

#### P2-3. Button 컴포넌트
- `normalColor` / `hoverColor` / `pressedColor` 색상피커 3종
- `interactable` 토글
- `transition` 드롭다운

#### P2-4. Layout 컴포넌트
- `type` (HORIZONTAL/VERTICAL/GRID) 드롭다운
- `spacingX` / `spacingY` 숫자 입력
- `padding` 4방향 입력

---

### [P3] CC 에디터 코어 — 빌드 통합

#### P3-1. 빌드 트리거 UI
- BuildPanel 컴포넌트 신설
- `cc:buildWeb` IPC — CocosCreator.exe CLI 실행
- 빌드 진행 상태 표시 (stdout streaming)
- 빌드 완료 → 결과 링크 or iframe 미리보기

#### P3-2. 빌드 설정
- 플랫폼 선택 (web-mobile / web-desktop)
- 빌드 경로 설정 (localStorage 저장)
- 디버그/릴리즈 토글

#### P3-3. CDN 업로드 연동
- 빌드 완료 후 자동 CDN 업로드 (기존 deploy 스크립트 연동)
- 업로드 진행률 표시

---

### [P4] Claude AI 연동 강화

#### P4-1. 씬 컨텍스트 자동 주입
- Claude 채팅 시작 시 현재 씬 트리 텍스트를 시스템 프롬프트에 자동 포함
- `/cc` 명령으로 씬 트리 스냅샷 삽입
- `useCCContext` 훅 — 현재 씬 상태를 Claude 컨텍스트로 변환

#### P4-2. CC Action Parser 강화
- Claude 응답에서 CC 액션 JSON 자동 파싱 (`src/renderer/src/utils/cc-action-parser.ts`)
- 액션 실행 전 사용자 확인 UI (승인/거부)
- 실행 결과 피드백 (성공/실패 메시지)

#### P4-3. 자연어 씬 편집 템플릿
- PromptChain 템플릿에 CC 씬 편집 프리셋 추가
- 예: "버튼 중앙 정렬", "레이아웃 정렬", "색상 변경"

---

## 기술 부채 및 리팩토링 계획

### 즉시 처리 (P0)

| 항목 | 현재 문제 | 목표 |
|------|----------|------|
| `window.api as any` | 17곳 이상 — 타입 안전 없음 | `window.api.ccGetAssets` 등 타입 선언 |
| CC 에러 핸들링 | try/catch 없는 IPC 핸들러 5곳 | 전체 래핑, 사용자 친화적 메시지 |
| 의존성 | `ws`, `node-pty` 등 — audit 필요 | npm audit fix |
| 빌드 경고 | TypeScript strict 위반 가능성 | strict: true 활성화 후 수정 |

### 중기 처리 (P1-P2)

| 항목 | 설명 |
|------|------|
| `useClipboard` 훅 | `copiedXxx` + setTimeout 패턴 반복 → 훅 추출 |
| CC 패널 컨텍스트 | `CCContext` React Context로 port/connected 전역 공유 |
| Extension 버전 관리 | 버전 불일치 감지 → 재설치 안내 자동화 |
| SceneView 성능 | 노드 수 100개+ 시 Canvas 렌더링 최적화 |

---

## QA 검증 계획

### 자동 QA (`scripts/qa.ts`)

현재 QA Pass: **433개**

추가할 QA 섹션 (P0):
- CC IPC 핸들러 에러 처리 (try/catch)
- 에셋 브라우저 에러 상태 표시
- TypeScript 빌드 성공 확인

### 수동 QA 체크리스트

```
[ ] CC 연결: 포트 9090 (2x), 9091 (3x) 각각 연결 성공
[ ] 씬 트리: 로드, 노드 선택, 이름 편집 동작
[ ] 노드 속성: Transform 편집, 색상 변경 CC에 즉시 반영
[ ] 에셋 브라우저: 폴더 펼치기, 검색, 경로 복사
[ ] SceneView: 드래그, 멀티셀렉트, undo/redo
[ ] 익스텐션 재설치 후 에셋 404 해소 확인
```

---

## 개발 순서 (추천 실행 순서)

```
P0-1: cc:get-assets 404 수정 (IPC error handling)   ← 즉시
P0-2: npm build + lint + audit 전수 검증             ← 즉시
P0-3: 리팩토링 (타입 보완, 에러 핸들링)              ← 1주
P1-1: 에셋 브라우저 고도화 (썸네일, 우클릭)           ← 1주
P1-2: 씬 전환 (씬 목록, load/save)                  ← 1주
P2-1: Label 인라인 편집                              ← 2주
P2-2: Sprite 컴포넌트 편집                           ← 2주
P3-1: 빌드 트리거 UI                                 ← 3주
P4-1: 씬 컨텍스트 자동 주입                          ← 3주
```

---

## Extension API 확장 계획 (2x/3x 공통)

현재 구현된 엔드포인트:
- `GET /scene/tree`
- `GET /scene/canvas-size`
- `GET /node/:uuid`
- `POST /node/:uuid/property`
- `POST /node/:uuid/move`
- `POST /node/:uuid/zorder`
- `POST /scene/new-node`
- `DELETE /node/:uuid`
- `GET /assets/tree`
- `POST /node/:uuid/component`

추가 필요 엔드포인트:
```
POST /scene/open             씬 파일 열기
POST /scene/save             씬 저장
POST /scene/instantiate      프리팹 인스턴스화
GET  /scene/list             씬 파일 목록
POST /node/:uuid/duplicate   노드 복제
GET  /build/status           빌드 상태
POST /build/web              웹 빌드 트리거
```

---

## 성공 기준

- [ ] 익스텐션 설치 후 에셋 브라우저 정상 동작 (404 없음)
- [ ] 씬 트리에서 노드 선택 → 속성 편집 → CC 실시간 반영
- [ ] Label/Sprite 텍스트 및 이미지 변경 앱 내에서 가능
- [ ] 씬 전환 (다른 .fire 파일 로드) 앱 내에서 가능
- [ ] 빌드 트리거 → 빌드 성공 확인 UI
- [ ] Claude 채팅에서 "버튼을 중앙으로 이동해줘" → 실행됨
- [ ] TypeScript 빌드 에러 0 / ESLint 경고 0 / npm audit 취약점 0
