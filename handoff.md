# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-15

## 완료 (R1500-2275)
- [x] R1500~R2225: (이전 세션 완료)
- [x] R2226~R2261: CC3.x 갭 수정 (Label/EditBox/ScrollView/Scrollbar/PageView/VideoPlayer/Canvas/Button/RichText/Slider/Layout/Widget 등)
- [x] R2262: cc.Layout _cellSize + cc.Widget _isAbs* 6종
- [x] R2263: BatchInspector cc.ScrollView _toggle 3종 + 단일노드 ParticleSystem _startColor/_endColor
- [x] R2264: 단일노드 cc.ScrollView _brake + _elasticDuration
- [x] R2265: BatchInspector cc.Widget 4방향 _top/_bottom/_left/_right + cc.ProgressBar _totalLength
- [x] R2266: BatchInspector cc.ProgressBar _reverse + _mode
- [x] R2267: BatchInspector cc.ProgressBar _startWidth + 단일노드 cc.Layout _horizontalDirection/_verticalDirection
- [x] R2268: 단일노드 cc.RichText _string/_fontSize/_lineHeight/_maxWidth/_horizontalAlign
- [x] R2269: 단일노드 cc.Canvas _resolutionPolicy + stateColors _colorKey
- [x] R2270: 단일노드 cc.Button normalColor + reset 4색
- [x] R2271: 단일노드 cc.ProgressBar _totalLength/_reverse + cc.Label _horizontalAlign/_verticalAlign
- [x] R2272: 단일노드 cc.Button _duration + BatchInspector cc.ParticleSystem _maxParticles/_totalParticles
- [x] R2273: cc.Canvas _fitWidth/_fitHeight (BatchInspector + 단일노드 동시)
- [x] R2274: 단일노드 cc.Label _string + cc.Slider _progress + cc.Button _interactable
- [x] R2275: 단일노드 cc.VideoPlayer _remoteURL + cc.PageView _slideDuration/_autoPageTurningInterval

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2310** ← R2275 현재
- Branch: dev
- 체크포인트 QA: CONDITIONAL_PASS (기존 누적 이슈 유지, 신규 Critical 없음)

## 다음 예정 (R2276+)
- 단일노드 ParticleSystem color (line 20741): `color: col, _N$color: col` → `_color: col` 추가 필요
- 추가 갭 스캔: `_N$` 패턴에서 `_*` 누락 항목 계속 탐색
- ISSUE-06 items 3~6 (CC Editor 재설계): 별도 기획 필요

## ISSUE-06 상태
- item 1: ✓ 자동 프로젝트 로드
- item 2: ✓ 씬/프리팹 드롭다운 버그
- item 3~6: ✗ 대규모 UI 재설계 필요

## 누적 이슈 (QA 체크포인트에서 발견된 기존 이슈)
- ISSUE-001: shell:true 입력검증 없음 (Critical — 기존 누적)
- ISSUE-002~010: 중간 심각도 기존 이슈들
- ISSUE-007: npm audit 18 취약점 (기존 누적)
