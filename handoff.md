# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-15

## 완료 (R1500-2311)
- [x] R1500~R2305: (이전 세션 완료)
- [x] R2306: BatchInspector cc.Layout padding(pt/pb/pl/pr) + cc.Sprite capInset(insetTop/Bottom/Left/Right) _N$* 갭 수정
- [x] R2307: 단일노드 cc.Layout spacing/padding computed key + quick preset _N$* 갭 수정 (동적 `_${key}`, `_N$${key}` 패턴 적용)
- [x] R2308: 단일노드 cc.Sprite trim/grayscale/fillCenter/capInsets(newCi.t/.b/.l/.r) _N$* 갭 수정
- [x] R2309: 단일노드 cc.Toggle isChecked + cc.ToggleContainer allowSwitchOff _N$* 갭 수정
- [x] R2310: BatchInspector cc.ParticleSystem gravity → `_gravity/_N$gravity` (object 형태) + 단일노드 전체 컴포넌트 enabled→_enabled 갭 수정
- [x] R2311: cc.Animation BatchInspector playOnLoad `_N$${key}` + cc.Sprite BatchInspector flipX/Y `_N$${key}` + cc.ScrollView 단일노드 horizontal/vertical/inertia/elastic `_N$${key}` 갭 수정

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2346** ← R2311 현재
- Branch: dev
- 체크포인트 QA: CONDITIONAL_PASS (기존 누적 이슈 유지, 신규 Critical 없음)
- 최근 커밋: `37994fc` (R2311), `7a739f7` (R2310), `0be430f` (R2306-R2309)

## 갭 수정 완료 상태
- **BatchInspector bare shorthand `{ ...c.props, prop }` → ALL DONE** (R2298-R2305)
- **BatchInspector 명시적 `prop: value` → ALL DONE** (R2306-R2311)
- **단일노드 인스펙터 갭 → ALL DONE** (R2306-R2311)
- **computed key 패턴 (`[key as string]`) → ALL DONE** (R2307, R2311)
- **`_N$` 패턴 총 550건** (CocosPanel.tsx 기준)

## 다음 예정 (R2312+)
- 추가 갭 스캔 결과: **잔존 없음** — 모든 CC3.x `_N$` 갭 수정 완료 확인됨
- 신규 기능 개발 검토:
  - ISSUE-010: `cc:buildProject` IPC 구현 (빌드 버튼 실제 실행) — low priority
  - ISSUE-011 (= ISSUE-06 items 3-6): CC Editor 레이아웃 재설계 — 대규모, 별도 기획 필요
  - ROADMAP Phase DD10+ 기능 (씬뷰 Export, 채팅 강화, Inspector 히스토리 등)

## ISSUE-06/011 상태
- item 1: ✓ 자동 프로젝트 로드
- item 2: ✓ 씬/프리팹 드롭다운 버그
- item 3~6: ✗ 대규모 UI 재설계 필요 — 기획 우선

## 누적 이슈 (QA 체크포인트에서 발견된 기존 이슈)
- ISSUE-001: shell:true 입력검증 없음 (Critical — 기존 누적)
- ISSUE-002~010: 중간 심각도 기존 이슈들
- ISSUE-007: npm audit 18 취약점 (기존 누적)
