# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-14

## 완료 (R1500-2220)
- [x] R1500~R2199: (이전 세션 완료) ← QA Pass 2162 마일스톤
- [x] fix: 빌드 에러 2건 수정 (transformClipboard + JSX 주석) — dev/main 모두 적용
- [x] R2200-R2207: 컴포넌트 enabled 시리즈 + 신규 배치 속성
- [x] R2208: cc.EditBox placeholderFontSize 프리셋 + fontColor 컬러 스와치
- [x] R2209: cc.BoxCollider2D size 프리셋 + cc.CircleCollider2D radius 프리셋 (CC3.x)
- [x] R2210: cc.Label outlineWidth 프리셋 + outlineColor 컬러 스와치 (CC3.x)
- [x] R2211: cc.Label shadowColor 컬러 스와치 + shadowBlur 프리셋 (CC3.x)
- [x] R2212: cc.Label shadowOffset 프리셋 + cc.EditBox placeholderFontColor 컬러 스와치
- [x] R2213: cc.Label colorTop/colorBottom 그라디언트 컬러 스와치 (CC3.x)
- [x] R2214: 노드 _rotationX/_rotationY 일괄 설정 (CC2.x 3D 회전)
- [x] R2215: cc.Label _underlineHeight + cc.Sprite _color (CC3.x)
- [x] ISSUE-05 fix: CCFileAssetBrowser folderTree useMemo를 early return 이전으로 이동 — React Hooks 위반 크래시 수정
- [x] R2216: cc.Sprite _useGrayscale 토글 + cc.Label _spacingX 프리셋 (CC3.x)
- [x] ISSUE-06 (부분 fix): 씬/프리팹 드롭다운 버그 수정 + CC Editor 탭 자동 로드
- [x] R2217: cc.UIOpacity enabled + cc.RigidBody enabled (컴포넌트 레벨)
- [x] R2218: cc.BoxCollider2D enabled + cc.CircleCollider2D enabled (컴포넌트 레벨)
- [x] R2219: cc.LabelOutline enabled + cc.LabelShadow enabled (CC2.x 컴포넌트 레벨)
- [x] R2220: cc.PolygonCollider2D enabled + cc.WebView enabled (컴포넌트 레벨)

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2205** ← R2220 현재
- Branch: dev

## 다음 예정 (R2221+)
- 자율 탐색: 미구현 prop 계속 발굴
  - cc.Sprite CC3.x 고유 속성 탐색 (atlas, spriteFrame 제외한 단순 props)
  - cc.Camera CC3.x 추가 속성
  - cc.ParticleSystem 미커버 속성
  - 컴포넌트 enabled 미커버: Mask, Layout, Collider etc. → 대부분 완료됨
  - ISSUE-06 items 3~6 (대규모 CC Editor 재설계): 별도 기획 필요

## ISSUE-06 상태
- item 1: ✓ 자동 프로젝트 로드 (localStorage cc-last-project-path)
- item 2: ✓ 씬/프리팹 드롭다운 버그 (별도 스캔 후 병합)
- item 3: ✗ 씬/프리팹 우측 넓은 뷰 (대규모 UI 재설계)
- item 4: ✗ 좌측 노드 리스트 (대규모 UI 재설계)
- item 5: ✗ CC에디터 동일시 (장기 목표)
- item 6: ✗ QA 시 런타임 에러 체크 (QA 스크립트 추가 필요)
