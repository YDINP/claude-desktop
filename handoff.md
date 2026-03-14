# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-15

## 완료 (R1500-2305)
- [x] R1500~R2275: (이전 세션 완료)
- [x] R2276~R2297: CC3.x 갭 수정 (TiledLayer/RigidBody/Toggle/DragonBones/sp.Skeleton/Layout/VideoPlayer/Canvas/Collider 등)
- [x] R2298: BatchInspector `enabled` → `_enabled` (CC3.x 전체 36건 replace_all)
- [x] R2299: BatchInspector UIOpacity opacity + TiledLayer opacity + Toggle interactable _N$* 갭 수정
- [x] R2300: BatchInspector PageView direction + VideoPlayer keepAspectRatio + MotionStreak stroke/fade _N$* 갭 수정
- [x] R2301: BatchInspector dragonBones/sp.Skeleton timeScale/debugBones/premultipliedAlpha/paused/debugSlots/useTint/enableBatch _N$* 갭 수정
- [x] R2302: BatchInspector dragonBones/sp.Skeleton/SkeletalAnimation playOnLoad/loop + TiledLayer visible _N$* 갭 수정 (CC3.x=_only, CC2.x=_N$)
- [x] R2303: BatchInspector AudioSource volume/preload/startTime/endTime + Layout resizeMode + Widget isAlignVerticalCenter/isAlignHorizontalCenter _N$* 갭 수정
- [x] R2304: BatchInspector RigidBody type/mass/fixedRotation/linearDamping(×2)/angularDamping(×2)/bullet/allowSleep/enabledContactListener/awake/sleepThreshold _N$* 갭 수정
- [x] R2305: BatchInspector ProgressBar totalLength/progress/reverse + Sprite grayscale _N$* 갭 수정

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2340** ← R2305 현재
- Branch: dev
- 체크포인트 QA: CONDITIONAL_PASS (기존 누적 이슈 유지, 신규 Critical 없음)
- 최근 커밋: `1150ab8` (R2301-R2305), `90df328` (R2298-R2300)

## 다음 예정 (R2306+)
- 추가 갭 스캔: `{ ...c.props, [prop] } }` 패턴 중 bare shorthand 잔존 여부 재확인
  - 현재 스캔 결과: **잔존 없음** — 모든 BatchInspector shorthand 패턴 수정 완료
- 단일노드 인스펙터 갭 추가 스캔: 다양한 컴포넌트의 `setXxx` 핸들러 내 `{ ...c.props, prop: value }` 패턴 (이미 대부분 수정됨)
- ISSUE-06 items 3~6 (CC Editor 재설계): 별도 기획 필요

## ISSUE-06 상태
- item 1: ✓ 자동 프로젝트 로드
- item 2: ✓ 씬/프리팹 드롭다운 버그
- item 3~6: ✗ 대규모 UI 재설계 필요

## 누적 이슈 (QA 체크포인트에서 발견된 기존 이슈)
- ISSUE-001: shell:true 입력검증 없음 (Critical — 기존 누적)
- ISSUE-002~010: 중간 심각도 기존 이슈들
- ISSUE-007: npm audit 18 취약점 (기존 누적)
