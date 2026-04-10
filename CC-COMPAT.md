# CC 2.x / 3.x 호환성 매트릭스

> 마지막 업데이트: 2026-04-08

---

## 1. 파서 (cc-file-parser.ts)

### 버전 감지

| 방법 | 설명 |
|------|------|
| `projectInfo.version` | `.creator` 프로젝트 파일에서 전달 (`'2x'` or `'3x'`) |
| `detectVersionFromRaw()` | 폴백 — 첫 노드 엔트리에 `_trs` 있으면 2x, `_lpos` 있으면 3x |

### 트랜스폼 파싱

| 필드 | CC 2.x | CC 3.x |
|------|--------|--------|
| 위치 | `_trs.array[0..2]` (Base64 TypedArray) 또는 `_position` 폴백 | `_lpos {x,y,z}` |
| 회전 | `_trs.array[3..6]` quaternion → eulerZ 변환 | `_lrot {x,y,z,w}` quaternion → eulerZ 변환 |
| 스케일 | `_trs.array[7..9]` | `_lscale {x,y,z}` |
| 크기 | `_contentSize {width, height}` | `cc.UITransform._contentSize` (별도 엔트리) |
| 앵커 | `_anchorPoint {x,y}` | `cc.UITransform._anchorPoint` |
| 불투명도 | `_opacity` (0~255) | `_uiProps._localOpacity` (0~1) |
| 레이어 | `_layer` | `layer` (underscore 없음) |
| 색상 | `_color {r,g,b,a}` | `_color {r,g,b,a}` |

### 컴포넌트 Props 파싱

| 규칙 | CC 2.x | CC 3.x |
|------|--------|--------|
| 접두사 패턴 | `_N$key` 우선, 없으면 `_key` → `key` 순 | `_key` 우선, 없으면 `key` 순 |
| `_N$` 필터 | 파싱 시 그대로 보존 | `extractComponentProps` 에서 스킵 |
| UUID 형식 | Base62 (alphanumeric, 하이픈 없음) | Dashed hex (RFC 4122 유사) |

### 컴포넌트별 파싱 지원 현황

| 컴포넌트 | CC 2.x | CC 3.x | 비고 |
|----------|--------|--------|------|
| `cc.Label` | ✅ | ✅ | `fontFamily`, `spacingX/Y`, `overflow` 강화 파싱 (R1417) |
| `cc.RichText` | ✅ | ✅ | |
| `cc.Sprite` | ✅ | ✅ | spriteFrame UUID 드롭 지원 |
| `cc.Button` | ✅ | ✅ | 이벤트 핸들러 파싱 (R1453) |
| `cc.Toggle` | ✅ | ✅ | |
| `cc.Slider` | ✅ | ✅ | |
| `cc.EditBox` | ✅ | ✅ | |
| `cc.Layout` | ✅ | ✅ | |
| `cc.Widget` | ✅ | ✅ | alignFlags → position/size 계산 (R2822) |
| `cc.ProgressBar` | ✅ | ✅ | |
| `cc.ScrollView` | ✅ | ✅ | |
| `cc.PageView` | ✅ | ✅ | |
| `cc.Scrollbar` | ✅ | ✅ | |
| `cc.Mask` | ✅ | ✅ | |
| `cc.AudioSource` | ✅ | ✅ | |
| `cc.Camera` | ✅ | ✅ | 2x/3x 통합 (R1606) |
| `cc.Canvas` | ✅ | ✅ | `findCanvasNode`, `getDesignResolution` (R1447) |
| `cc.UIOpacity` | ❌ (2.x 없음) | ✅ | CC 3.x 전용 컴포넌트 |
| `cc.UITransform` | ❌ (2.x 없음) | ✅ | CC 3.x 전용 — 저장 시 자동 생성 (R2820) |
| `cc.ParticleSystem` | ❌ (이름 다름) | ✅ | |
| `cc.ParticleSystem2D` | ✅ | ❌ (이름 다름) | 2.x 전용 |
| `cc.Animation` | ✅ | ✅ | |
| `cc.SkeletalAnimation` | ❌ | ✅ | 3.x 전용 (R1579) |
| `sp.Skeleton` | ✅ | ✅ | |
| `dragonBones.ArmatureDisplay` | ✅ | ✅ | |
| `cc.DirectionalLight` | ❌ | ✅ | 3.x 전용 |
| `cc.PointLight` | ❌ | ✅ | 3.x 전용 |
| `cc.SpotLight` | ❌ | ✅ | 3.x 전용 |
| `cc.MotionStreak` | ✅ | ✅ | |
| `cc.BoxCollider` / `cc.BoxCollider2D` | ✅ | ✅ | |
| `cc.CircleCollider` / `cc.CircleCollider2D` | ✅ | ✅ | |
| `cc.RigidBody` / `cc.RigidBody2D` | ✅ | ✅ | |
| `cc.TiledMap` | ✅ | ✅ | |
| `cc.SafeArea` | ✅ | ✅ | generic props only |
| `cc.BlockInputEvents` | ✅ | ✅ | generic props only |

---

## 2. 저장 (cc-file-saver.ts)

### 라운드트립 지원 현황

| 항목 | CC 2.x | CC 3.x | 비고 |
|------|--------|--------|------|
| 위치 저장 | `_trs.array[0..2]` 패치 | `_lpos` 패치 | |
| 회전 저장 | eulerZ → quaternion → `_trs.array[3..6]` | eulerZ → quaternion → `_lrot` | R2817 버그 수정 |
| 스케일 저장 | `_trs.array[7..9]` | `_lscale` | |
| 크기 저장 | `_contentSize {width,height}` | `cc.UITransform._contentSize` | |
| 앵커 저장 | `_anchorPoint {x,y}` | `cc.UITransform._anchorPoint` | |
| 불투명도 저장 | `_opacity` (0~255) | `_uiProps._localOpacity` (0~1 변환) | |
| 색상 저장 | `_color {r,g,b,a}` | `_color {r,g,b,a}` | |
| `enabled` 저장 | `_enabled` | `_enabled` | R2817 수정 |
| 신규 노드 추가 | `buildNewRawNode2x()` | `buildNewRawNode3x()` + UITransform 자동 추가 | |
| 신규 컴포넌트 추가 | `COMP_DEFAULT_2x` 기본값 (`_N$` prefix) | `COMP_DEFAULT_3x` 기본값 (`_` prefix) | |
| 컴포넌트 props 패치 | `_N$key` → `_key` → `key` 순서로 검색 | `_key` → `key` 순서로 검색 | |
| 충돌 감지 | mtime 기반 (R1437) | mtime 기반 | |
| 백업 | `.bak` 파일 자동 생성 | `.bak` 파일 자동 생성 | `listBakFiles`, `restoreFromBakFile` |

### 저장 지원 컴포넌트 기본값 (신규 노드 추가 시)

| 컴포넌트 | CC 2.x (`COMP_DEFAULT_2x`) | CC 3.x (`COMP_DEFAULT_3x`) |
|----------|--------------------------|--------------------------|
| `cc.Label` | `_N$string`, `_N$fontSize`, `_N$horizontalAlign` 등 | `_string`, `_fontSize`, `_horizontalAlign` 등 |
| `cc.Sprite` | `_N$type`, `_N$sizeMode`, `_N$fillType` | `_type`, `_sizeMode`, `_fillType` |
| `cc.Button` | `_N$interactable`, `_N$transition` 등 | `_interactable`, `_transition` 등 |
| `cc.Layout` | `_N$type`, `_N$paddingLeft` 등 | `_type`, `_paddingLeft` 등 |
| `cc.Widget` | `_N$isAlignTop` 등 | `_isAlignTop` 등 |
| `cc.ScrollView` | `_N$horizontal`, `_N$vertical` 등 | `_horizontal`, `_vertical` 등 |
| `cc.AudioSource` | `_N$clip`, `_N$volume` | `_clip`, `_volume` |
| `cc.Camera` | `_N$depth`, `_N$cullingMask`, `_N$clearFlags` | `_projection`, `_priority`, `_far` |
| `cc.ParticleSystem` | `_N$playOnLoad` | — (3x는 `ParticleSystem2D`) |
| `cc.ParticleSystem2D` | — | `_playOnLoad`, `_duration`, `_emissionRate` |

---

## 3. Inspector 렌더러 지원 현황

### 컴포넌트별 렌더러 매핑

| 컴포넌트 | 렌더러 | CC 2.x | CC 3.x |
|----------|--------|--------|--------|
| `cc.Label`, `cc.RichText`, `cc.LabelOutline`, `cc.LabelShadow` | `LabelRenderer` | ✅ | ✅ |
| `cc.Sprite`, `cc.Sprite2D`, `cc.Graphics`, `cc.VideoPlayer`, `cc.WebView`, `cc.TiledMap`, `cc.TiledLayer` | `SpriteRenderer` | ✅ | ✅ |
| `cc.Button`, `cc.Toggle`, `cc.ToggleContainer`, `cc.EditBox`, `cc.Slider` | `ButtonRenderer` | ✅ | ✅ |
| `cc.Canvas`, `cc.Widget`, `cc.ProgressBar`, `cc.UIOpacity`, `cc.UITransform`, `cc.Mask` | `UIRenderer` | ✅* | ✅ |
| `cc.AudioSource`, `cc.Camera`, `cc.DirectionalLight`, `cc.PointLight`, `cc.SpotLight`, `cc.MotionStreak`, `cc.BlockInputEvents` | `EffectsRenderer` | ✅ | ✅ |
| `cc.ParticleSystem`, `cc.ParticleSystem2D` | `ParticleRenderer` | ✅ | ✅ |
| `cc.Animation`, `cc.SkeletalAnimation`, `dragonBones.ArmatureDisplay`, `sp.Skeleton` | `AnimationRenderer` | ✅ | ✅ |
| `cc.ScrollView`, `cc.Scrollbar`, `cc.PageView`, `cc.PageViewIndicator` | `ScrollViewRenderer` | ✅ | ✅ |
| `cc.BoxCollider`, `cc.CircleCollider`, `cc.PolygonCollider`, `cc.RigidBody` (+ 2D 변형) | `PhysicsRenderer` | ✅ | ✅ |
| 나머지 | `GenericPropertyEditor` | ✅ | ✅ |

> `*` `cc.UIOpacity`, `cc.UITransform`은 CC 3.x 전용 컴포넌트이므로 2.x 씬에서는 렌더러가 표시되지 않습니다.

### 렌더러 공통 지원 사항

- 모든 렌더러는 `React.memo`로 최적화됨 (R2827)
- `is3x` prop으로 버전별 조건 분기 지원
- `_N$` / `_` / non-prefixed 3-way fallback 패턴 표준 적용
- `applyAndSave` 콜백으로 실시간 씬 파일 업데이트

---

## 4. SceneView 렌더링 지원/제한사항

### 지원 기능

| 기능 | CC 2.x | CC 3.x | 비고 |
|------|--------|--------|------|
| 노드 트리 렌더링 | ✅ | ✅ | SVG 기반 |
| 위치/크기 시각화 | ✅ | ✅ | worldX/Y 변환 |
| 부모 회전/스케일 계산 | ✅ | ✅ | worldRotZ, worldScaleX/Y (R2819) |
| 버전 배지 표시 | ✅ | ✅ | CC 2.x / 3.x 배지 (Round 461) |
| 레이어 필터 | ✅ | ✅ | layer/\_layer 모두 처리 (R1479) |
| 카메라 프레임 | ✅ | ✅ | `cameraFrames` 계산 |
| 씬 해상도 감지 | ✅ | ✅ | `getDesignResolution` (R1447) |
| `cc.Canvas` 해상도 | ✅ | ❌ | 3.x는 `settings.json` 기반 감지 (R2826) |

### 알려진 제한사항

| 항목 | 설명 |
|------|------|
| 3D 씬 | CC 3.x 3D 노드 (z-depth 스택) 미지원 — 2D 평면 투영만 렌더링 |
| `cc.TiledMap` 타일 | 타일 이미지 렌더링 없음 — 바운딩 박스만 표시 |
| `sp.Skeleton` / `dragonBones` 애니메이션 | 정적 바운딩 박스만 표시, 실시간 골격 렌더링 없음 |
| `cc.ParticleSystem` | 파티클 시뮬레이션 없음 — 이미터 위치 점으로만 표시 |
| `cc.Mask` 클리핑 | SVG에서 실제 마스크 클리핑 미적용 |
| Prefab 인스턴스 | Prefab 내부 구조 파싱 후 인라인 표시 (별도 Prefab 뷰 없음) |
| `cc.UITransform` 없는 3.x 노드 | 크기 0으로 처리됨 (점으로 표시) |
| CC 3.x `_lrot` 4축 회전 | Z-축 eulerZ만 추출 — X/Y 회전 무시 |

---

## 5. 알려진 제한사항 요약

| 분류 | 내용 | 상태 |
|------|------|------|
| 파서 | `_trs` Base64가 없는 구형 CC 2.x 파일 — `_position`/`_rotation`/`_scale` 폴백 | ✅ 처리됨 |
| 파서 | CC 3.x 압축 UUID (23자 Base62) → 내부 변환 알고리즘 | ✅ 처리됨 |
| 파서 | CC 2.x `_N$enabled` false positive — `_enabled`만 사용 (R2817) | ✅ 수정됨 |
| 저장 | CC 2.x `_trs` TypedArray 외 개별 필드(`_position` 등)로 저장된 파일 라운드트립 | ⚠️ `_trs` 있을 때만 패치, 없으면 구조 변경 없음 |
| 저장 | CC 3.x `cc.UITransform` 없는 노드에 신규 추가 시 자동 생성 | ✅ 처리됨 (R2820) |
| Inspector | `cc.Label.spacingY` CC 2.x 저장 누락 (R2820 수정) | ✅ 수정됨 |
| Inspector | CC 3.x rotation CCVec3 통일 (R2820) | ✅ 수정됨 |
| SceneView | CC 3.x `cc.Canvas` 설계 해상도 — `settings.json`에서만 감지 가능 | ✅ 처리됨 (R2826) |
| SceneView | 대형 씬 (isLargeScene) 청크 스트리밍 파싱 (R1478) | ✅ 처리됨 |
| 일반 | `cc.SkeletalAnimation` CC 2.x에서 사용 불가 (3.x 전용) | 정상 동작 |
| 일반 | `cc.UIOpacity`, `cc.UITransform` CC 2.x에서 사용 불가 (3.x 전용) | 정상 동작 |
