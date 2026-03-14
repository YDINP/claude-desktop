# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-15

## 완료 (R1500-2225)
- [x] R1500~R2214: (이전 세션 완료)
- [x] R2215: cc.Label _underlineHeight + cc.Sprite _color (CC3.x)
- [x] ISSUE-05 fix: CCFileAssetBrowser folderTree useMemo early-return 이전 이동 (React Hooks 위반 수정)
- [x] R2216: cc.Sprite _useGrayscale + cc.Label _spacingX (CC3.x)
- [x] ISSUE-06 (부분 fix): 씬/프리팹 드롭다운 버그 + CC Editor 자동 로드
- [x] R2217: cc.UIOpacity enabled + cc.RigidBody enabled
- [x] R2218: cc.BoxCollider2D enabled + cc.CircleCollider2D enabled
- [x] R2219: cc.LabelOutline enabled + cc.LabelShadow enabled (CC2.x)
- [x] R2220: cc.PolygonCollider2D enabled + cc.WebView enabled
- [x] R2221: cc.DirectionalLight/PointLight enabled + cc.SkeletalAnimation enabled
- [x] R2222: cc.TiledLayer enabled + cc.UITransform _anchorPoint 프리셋
- [x] R2223: cc.AudioSource _pitch + cc.RichText lineHeight
- [x] R2224: cc.VideoPlayer keepAspectRatio + cc.Layout padding 4방향 프리셋
- [x] R2225: cc.Label charSpacing + cc.Sprite _isTrimmedMode

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2215** ← R2225 현재
- Branch: dev
- 체크포인트 QA: CONDITIONAL_PASS (기존 누적 이슈 10건 Warning, 신규 Critical 없음)

## 다음 예정 (R2226+)
- 자율 탐색 계속: 미구현 prop 발굴
  - cc.Scrollbar autoHideTime (R2185에 이미 있는지 확인 필요)
  - cc.AudioSource 미구현 속성 탐색
  - cc.RichText 미구현 속성 탐색
  - ISSUE-06 items 3~6 (CC Editor 재설계): 별도 기획 필요

## ISSUE-06 상태
- item 1: ✓ 자동 프로젝트 로드
- item 2: ✓ 씬/프리팹 드롭다운 버그
- item 3~6: ✗ 대규모 UI 재설계 필요

## 누적 이슈 (QA 체크포인트에서 발견된 기존 이슈)
- ISSUE-001: shell:true 입력검증 없음 (Critical — 기존 누적)
- ISSUE-002~010: 중간 심각도 기존 이슈들
