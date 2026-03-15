# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-15

## 완료 (R1500-2312)
- [x] R1500~R2305: (이전 세션 완료)
- [x] R2306: BatchInspector cc.Layout padding(pt/pb/pl/pr) + cc.Sprite capInset(insetTop/Bottom/Left/Right) _N$* 갭 수정
- [x] R2307: 단일노드 cc.Layout spacing/padding computed key + quick preset _N$* 갭 수정 (동적 `_${key}`, `_N$${key}` 패턴 적용)
- [x] R2308: 단일노드 cc.Sprite trim/grayscale/fillCenter/capInsets(newCi.t/.b/.l/.r) _N$* 갭 수정
- [x] R2309: 단일노드 cc.Toggle isChecked + cc.ToggleContainer allowSwitchOff _N$* 갭 수정
- [x] R2310: BatchInspector cc.ParticleSystem gravity → `_gravity/_N$gravity` (object 형태) + 단일노드 전체 컴포넌트 enabled→_enabled 갭 수정
- [x] R2311: cc.Animation BatchInspector playOnLoad `_N$${key}` + cc.Sprite BatchInspector flipX/Y `_N$${key}` + cc.ScrollView 단일노드 horizontal/vertical/inertia/elastic `_N$${key}` 갭 수정
- [x] R2312: ISSUE-010 처리 — 씬 저장 이력 복원(snapshotKey+localStorage+writeTextFile) + CLI 빌드 shellExec 실제 실행(start /B)
- [x] R2313: ISSUE-003/004/005 버그 수정 — chokidar v5 awaitWriteFinish boolean 수정 + _initPromise race condition 수정 + sender.destroyed 누수 수정
- [x] R2314: ISSUE-002/006 버그 수정 — session:setCollection try/catch 추가 + memTimer clearInterval 수정

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2349** ← R2314 현재
- Branch: dev
- 체크포인트 QA: CONDITIONAL_PASS (기존 누적 이슈 유지, 신규 Critical 없음)
- 최근 커밋: `37994fc` (R2311), `7a739f7` (R2310), `0be430f` (R2306-R2309)

## 갭 수정 완료 상태
- **BatchInspector bare shorthand `{ ...c.props, prop }` → ALL DONE** (R2298-R2305)
- **BatchInspector 명시적 `prop: value` → ALL DONE** (R2306-R2311)
- **단일노드 인스펙터 갭 → ALL DONE** (R2306-R2311)
- **computed key 패턴 (`[key as string]`) → ALL DONE** (R2307, R2311)
- **`_N$` 패턴 총 550건** (CocosPanel.tsx 기준)

## 다음 예정 (R2315+)
- ISSUE-010: ✅ 완료 (R2312)
- ISSUE-003/004/005: ✅ 완료 (R2313)
- ISSUE-002/006: ✅ 완료 (R2314)
- 남은 이슈: ISSUE-001(보안 누적), ISSUE-007(npm audit 18건 전부 breaking change 필요), ISSUE-008(SDK 업그레이드), ISSUE-009(번들), ISSUE-011(레이아웃)
- 신규 기능 개발: ROADMAP 업데이트 후 새 Phase 기획

## ISSUE-06/011 상태
- item 1: ✓ 자동 프로젝트 로드
- item 2: ✓ 씬/프리팹 드롭다운 버그
- item 3~6: ✗ 대규모 UI 재설계 필요 — 기획 우선

## 누적 이슈 (QA 체크포인트에서 발견된 기존 이슈)
- ISSUE-001: shell:true 입력검증 없음 (Critical — 기존 누적)
- ISSUE-002~010: 중간 심각도 기존 이슈들
- ISSUE-007: npm audit 18 취약점 (기존 누적)
