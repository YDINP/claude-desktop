# PRD: CC 커스텀 에디터 엔진 — Phase 2 계획서

> 작성일: 2026-03-13 (라이브 브릿지 제거 + 커스텀 엔진 방향 확정)
> 최종 업데이트: 2026-03-13 (Round 471 완료 — HH-1 씬뷰 배경색 오버라이드)
> 기준: Round 471 완료 상태 (Round 414→471 총 58 라운드 구현 완료)
> 목표: claude-desktop을 CC 2.x / 3.x 완전 호환 커스텀 씬 에디터로 진화

---

## 핵심 방향 (Phase 2 확정)

**"CC 에디터를 실행하지 않아도 된다."**

claude-desktop이 Cocos Creator의 역할을 대체하는 **커스텀 엔진**이 된다.
씬(.fire/.scene), 컴포넌트(.ts/.js), 에셋(.meta) — 모두 파일 기반이므로
직접 파싱·편집·저장으로 CC 에디터 기능의 80%를 구현 가능하다.

### 전략 전환 요약

| 항목 | Phase 1 (구버전) | Phase 2 (확정) |
|------|-----------------|----------------|
| 방식 | CC 에디터 + WebSocket 연결 | **파일 직접 파싱·편집·저장** |
| CC 에디터 필요 여부 | 필수 | **불필요** (제거) |
| WS 브릿지 | 핵심 인프라 | **Deprecated** (레거시 유지) |
| 버전 지원 | 포트 기반 | **파일 형식 기반 (2x/3x 자동 감지)** |
| 오프라인 작업 | 불가 | **완전 오프라인 가능** |
| 에디터 커스터마이징 | 불가 | **자유롭게 확장 가능** |

### 비목표 (Phase 2)
- CC 에디터 창 임베드 (GPU 충돌, 기술적 불가)
- 애니메이션 클립 편집 (.anim 파일 — Phase 3 이후)
- 스크립트 로직 컴파일/실행 (Monaco 코드 편집은 별도)
- CC Extension WebSocket 신규 기능 개발 (레거시 유지만)

---

## 현재 구현 상태 (Phase 1 완료)

### 완료된 기능

| 영역 | 구현 완료 |
|------|----------|
| WS 브릿지 | WebSocket bridge (2x:9090, 3x:9091), 자동재연결, 포트 감지 |
| 씬 트리 | SceneTreePanel — 계층 보기, 검색, 인라인 이름 편집, 노드 선택 |
| 노드 속성 | NodePropertyPanel — Transform/Opacity/Color/Slider, 컴포넌트 섹션 |
| 씬뷰 | SceneView — SVG 렌더링, 멀티셀렉트, 드래그 이동, 리사이즈, undo/redo |
| 에셋 브라우저 | AssetBrowserPanel — 폴더트리, 검색, 타입필터, 경로 복사 |
| Extension | cc-ws-extension-2x, cc-ws-extension-3x (HTTP+WS) |

### 수정 완료 버그

| 버그 | 수정 내용 |
|------|----------|
| `cc:get-assets` HTTP 404 | IPC 핸들러 try/catch 추가, `{tree: [], error}` 반환 |
| CC port 인자 누락 | `portRef = useRef(9090)`, `executeCCActions(actions, port)` |
| DOMPurify CVE-2026-0540 | `package.json` overrides `"dompurify": "^3.3.2"` |

---

## CC 파일 시스템 이해 (구현 기반)

### Cocos Creator 프로젝트 구조

```
ProjectRoot/
├── assets/                   ← 모든 게임 에셋
│   ├── scenes/
│   │   ├── Main.fire         ← CC 2.x 씬 (JSON)
│   │   └── Main.scene        ← CC 3.x 씬 (JSON)
│   ├── prefabs/
│   │   └── Player.prefab     ← 프리팹 (JSON, 2x/3x 공통)
│   ├── scripts/
│   │   ├── GameManager.ts    ← 컴포넌트 스크립트
│   │   └── GameManager.ts.meta
│   └── textures/
│       ├── hero.png
│       └── hero.png.meta     ← 에셋 메타 (UUID, 설정)
├── project.json              ← CC 2.x 프로젝트 감지 마커
└── package.json              ← CC 3.x: creator.version 필드
```

### 파일 유형별 역할

| 파일 유형 | 역할 | 파싱 방식 |
|----------|------|----------|
| `.fire` | CC 2.x 씬 (JSON) | JSON.parse — flat 배열, `__id__` 인덱스 참조 |
| `.scene` | CC 3.x 씬 (JSON) | JSON.parse — 트리 구조, UUID 참조 |
| `.prefab` | 재사용 가능 노드 트리 (JSON) | 씬 파서와 동일 방식 |
| `.ts` / `.js` | 컴포넌트 스크립트 | Monaco 에디터로 편집 |
| `.meta` | 에셋 UUID + 설정 | JSON.parse — uuid, importer, userData |
| `.anim` | 애니메이션 클립 (JSON) | Phase 3 이후 |

---

## CC 2.x 파일 포맷 상세

### .fire 파일 구조 (flat 배열 + 인덱스 참조)

```json
[
  {
    "__type__": "cc.SceneAsset",
    "scene": { "__id__": 1 }
  },
  {
    "__type__": "cc.Scene",
    "_name": "Main",
    "_children": [{ "__id__": 2 }, { "__id__": 5 }],
    "_components": [{ "__id__": 10 }]
  },
  {
    "__type__": "cc.Node",
    "_name": "Canvas",
    "_id": "f8a3b2c1d4e5",
    "_active": true,
    "_children": [{ "__id__": 3 }],
    "_components": [{ "__id__": 4 }],
    "_trs": {
      "__type__": "TypedArray",
      "ctor": "Float32Array",
      "array": [0, 0, 0,  0, 0, 0, 1,  1, 1, 1]
    },
    "_contentSize": { "__type__": "cc.Size", "width": 720, "height": 1280 },
    "_anchorPoint": { "__type__": "cc.Vec2", "x": 0.5, "y": 0.5 },
    "_opacity": 255,
    "_color": { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 }
  },
  {
    "__type__": "cc.Node",
    "_name": "Button",
    "_id": "a1b2c3d4e5f6",
    "_active": true,
    "_children": [],
    "_components": [{ "__id__": 11 }, { "__id__": 12 }]
  },
  {
    "__type__": "cc.Canvas",
    "node": { "__id__": 2 },
    "_designResolution": { "__type__": "cc.Size", "width": 720, "height": 1280 },
    "_fitWidth": false,
    "_fitHeight": true
  }
]
```

### CC 2.x 핵심 노드 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `__type__` | string | `"cc.Node"`, `"cc.Scene"` 등 |
| `_id` | string | 짧은 alphanumeric UUID |
| `_name` | string | 노드 이름 |
| `_active` | boolean | 노드 활성화 여부 |
| `_children` | `{__id__: number}[]` | 자식 노드 인덱스 참조 |
| `_components` | `{__id__: number}[]` | 컴포넌트 인덱스 참조 |
| `_trs` | TypedArray (10 floats) | `[x,y,z, qx,qy,qz,qw, sx,sy,sz]` — 위치/회전/스케일 |
| `_contentSize` | `{width, height}` | 노드 크기 |
| `_anchorPoint` | `{x, y}` | 앵커 포인트 (0~1) |
| `_opacity` | 0-255 | 불투명도 |
| `_color` | `{r, g, b, a}` | 색상 |

> **⚠️ 중요**: 최신 CC 2.x는 `_position`/`_rotation`/`_scale` 대신 `_trs` TypedArray만 사용.

### CC 2.x 주요 컴포넌트 필드

```json
// cc.Label — _N$ 접두사가 실제 직렬화값!
{
  "__type__": "cc.Label",
  "node": { "__id__": 3 },
  "_string": "Hello World",
  "_N$string": "Hello World",
  "_fontSize": 40,
  "_lineHeight": 40,
  "_enableWrapText": true,
  "_N$horizontalAlign": 1,   // 0=LEFT, 1=CENTER, 2=RIGHT
  "_N$verticalAlign": 1,     // 0=TOP, 1=CENTER, 2=BOTTOM
  "_N$overflow": 0,          // 0=NONE, 1=CLAMP, 2=SHRINK, 3=RESIZE_HEIGHT
  "_N$fontFamily": "Arial",
  "_isSystemFontUsed": true
}

// cc.Sprite
{
  "__type__": "cc.Sprite",
  "node": { "__id__": 4 },
  "_spriteFrame": { "__uuid__": "f3a1b2c4d5e6-..." },
  "_type": 0,      // 0=SIMPLE, 1=SLICED, 2=TILED, 3=FILLED, 4=MESH
  "_sizeMode": 1,  // 0=CUSTOM, 1=TRIMMED, 2=RAW
  "_isTrimmedMode": true
}

// cc.Button — _N$ 필드!
{
  "__type__": "cc.Button",
  "node": { "__id__": 5 },
  "_N$interactable": true,
  "_N$transition": 1,                // 0=NONE, 1=COLOR, 2=SPRITE, 3=SCALE
  "_N$normalColor":  { "__type__": "cc.Color", "r": 230, "g": 230, "b": 230, "a": 255 },
  "_N$pressedColor": { "__type__": "cc.Color", "r": 200, "g": 200, "b": 200, "a": 255 },
  "_N$hoverColor":   { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 },
  "duration": 0.1,
  "zoomScale": 1.2
}

// cc.Layout — _N$layoutType!
{
  "__type__": "cc.Layout",
  "node": { "__id__": 6 },
  "_N$layoutType": 1,   // 0=NONE, 1=HORIZONTAL, 2=VERTICAL, 3=GRID
  "_resize": 0,         // ResizeMode: 0=NONE, 1=CONTAINER, 2=CHILDREN
  "spacingX": 0,
  "spacingY": 10,
  "paddingLeft": 5, "paddingRight": 5, "paddingTop": 5, "paddingBottom": 5,
  "verticalDirection": 1,   // 0=BOTTOM_TO_TOP, 1=TOP_TO_BOTTOM
  "horizontalDirection": 0  // 0=LEFT_TO_RIGHT, 1=RIGHT_TO_LEFT
}

// cc.Widget — _alignFlags 비트마스크!
// TOP=1, MID_V=2, BOT=4, LEFT=8, CENTER_H=16, RIGHT=32
// 45 = 0b101101 = TOP|BOT|LEFT|RIGHT = 사방 스트레치
{
  "__type__": "cc.Widget",
  "node": { "__id__": 7 },
  "_alignFlags": 45,
  "_left": 0, "_right": 0, "_top": 0, "_bottom": 0,
  "_isAbsLeft": true, "_isAbsRight": true, "_isAbsTop": true, "_isAbsBottom": true
}
```

### CC 2.x `_trs` TypedArray (핵심!)

CC 2.x에서 position/rotation/scale은 별도 필드가 아닌 `_trs` TypedArray에 압축 저장됨:

```json
"_trs": {
  "__type__": "TypedArray",
  "ctor": "Float32Array",
  "array": [480, 320, 0,  0, 0, 0, 1,  1, 1, 1]
  //        [x,  y,   z, qx,qy,qz,qw, sx,sy,sz]
}
```

- `array[0~2]`: position x, y, z
- `array[3~6]`: rotation quaternion (x, y, z, w) — identity = `[0,0,0,1]`
- `array[7~9]`: scale x, y, z

> **⚠️ 주의**: `_position`, `_rotation`, `_scale` 필드는 CC 2.x 초기 버전에서만 사용. 최신 2.x는 `_trs`만 사용.

### CC 2.x `_N$` 접두사 필드

에디터에서 직렬화된 실제 값은 `_N$` 접두사가 붙는 경우가 많음:

```
_N$string  →  Label 텍스트 (= _string 과 동일)
_N$horizontalAlign  →  Label 가로 정렬
_N$verticalAlign    →  Label 세로 정렬
_N$overflow         →  Label 오버플로우
_N$fontFamily       →  Label 폰트
_N$interactable     →  Button 활성화
_N$transition       →  Button 전환 방식
_N$layoutType       →  Layout 타입
```

### CC 2.x 파싱 알고리즘

```typescript
function parseTRS(trs: any): { position: Vec3; rotation: Quat; scale: Vec3 } {
  // TypedArray 형식
  if (trs?.['__type__'] === 'TypedArray') {
    const a = trs.array
    return {
      position: { x: a[0], y: a[1], z: a[2] },
      rotation: { x: a[3], y: a[4], z: a[5], w: a[6] },
      scale:    { x: a[7], y: a[8], z: a[9] }
    }
  }
  // 구버전 fallback
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale:    { x: 1, y: 1, z: 1 }
  }
}

function parseFireFile(raw: any[]): CCSceneNode {
  // 1. 인덱스 맵 (배열 인덱스 = 오브젝트 ID)
  // .fire: index 0 = cc.SceneAsset, index 1 = cc.Scene
  // .prefab: index 0 = cc.Prefab ("data" 필드), index 1 = 루트 cc.Node

  const isPrefab = raw[0]?.__type__ === 'cc.Prefab'
  const rootId = isPrefab ? raw[0].data.__id__ : raw[0].scene.__id__

  function buildNode(idx: number): CCSceneNode {
    const node = raw[idx] as any
    const trs = parseTRS(node._trs)
    const components = (node._components || [])
      .map((ref: {__id__: number}) => {
        const comp = raw[ref.__id__] as any
        return { type: comp.__type__, props: comp }
      })
    return {
      uuid: node._id || String(idx),
      name: node._name || '',
      active: node._active !== false,
      position: trs.position,
      rotation: trs.rotation,
      scale:    trs.scale,
      size:   node._contentSize ? { width: node._contentSize.width, height: node._contentSize.height } : undefined,
      anchor: node._anchorPoint ? { x: node._anchorPoint.x, y: node._anchorPoint.y } : undefined,
      opacity: node._opacity ?? 255,
      color:  node._color ? { r: node._color.r, g: node._color.g, b: node._color.b, a: node._color.a } : undefined,
      components,
      children: (node._children || []).map((ref: {__id__: number}) => buildNode(ref.__id__)),
      _rawIndex: idx
    }
  }

  return buildNode(rootId)
}
```

---

## CC 3.x 파일 포맷 상세

### .scene 파일 구조

```json
[
  {
    "__type__": "cc.SceneAsset",
    "_name": "game",
    "scene": { "__id__": 1 },
    "asyncLoadAssets": false
  },
  {
    "__type__": "cc.Scene",
    "_name": "game",
    "_active": true,
    "_children": [{ "__id__": 2 }],
    "_globals": { "__id__": 10 },
    "_autoReleaseAssets": false
  },
  {
    "__type__": "cc.Node",
    "_name": "Canvas",
    "_objFlags": 0,
    "_active": true,
    "_children": [{ "__id__": 3 }],
    "_components": [{ "__id__": 7 }, { "__id__": 8 }],
    "_layer": 524288,
    "_lpos": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
    "_lrot": { "__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1 },
    "_lscale": { "__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1 },
    "_euler": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 }
  },
  {
    "__type__": "cc.UITransform",
    "node": { "__id__": 2 },
    "_contentSize": { "__type__": "cc.Size", "width": 720, "height": 1280 },
    "_anchorPoint": { "__type__": "cc.Vec2", "x": 0.5, "y": 0.5 }
  }
]
```

### CC 3.x 핵심 노드 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `__type__` | string | `"cc.Node"`, `"cc.Scene"` 등 |
| `_name` | string | 노드 이름 |
| `_active` | boolean | 노드 활성화 |
| `_objFlags` | number | 비트플래그 (보통 0) |
| `_layer` | number | 레이어 마스크 비트값 (DEFAULT=1073741824, UI_2D=524288) |
| `_lpos` | `{x,y,z}` | 로컬 위치 (3D) |
| `_lrot` | `{x,y,z,w}` | 로컬 회전 (쿼터니언) |
| `_lscale` | `{x,y,z}` | 로컬 스케일 |
| `_euler` | `{x,y,z}` | 오일러 각도 (에디터 표시용, `_lrot`과 중복 — 저장 시 유지) |

> **⚠️ 오해 주의**: 필드명에 언더스코어 있음: `_lpos`, `_lrot`, `_lscale`, `_layer`
> **UITransform 분리**: `contentSize`, `anchorPoint`는 `cc.UITransform` 컴포넌트에만 있음.
> **cc.Canvas (3.x)**: `_designResolution`, `_fitWidth`, `_fitHeight` 없음 — Camera 컴포넌트로 처리됨.

### CC 3.x 주요 컴포넌트 필드

```json
// cc.UITransform
{
  "__type__": "cc.UITransform",
  "node": { "__id__": 2 },
  "_contentSize": { "__type__": "cc.Size", "width": 200, "height": 50 },
  "_anchorPoint": { "__type__": "cc.Vec2", "x": 0.5, "y": 0.5 }
}

// cc.Label
{
  "__type__": "cc.Label",
  "node": { "__id__": 3 },
  "_string": "Button",
  "_fontSize": 20,
  "_lineHeight": 40,
  "_horizontalAlign": 1,
  "_verticalAlign": 1,
  "_overflow": 0,
  "_enableWrapText": false,
  "color": { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 }
}

// cc.Sprite
{
  "__type__": "cc.Sprite",
  "node": { "__id__": 4 },
  "_spriteFrame": {
    "__uuid__": "a7f3b2c4-1234-5678-abcd-ef0123456789@f9941",
    "__expectedType__": "cc.SpriteFrame"
  },
  "_type": 0,
  "_sizeMode": 0,
  "grayscale": false
}

// cc.Button — 3.x: _N$ 없음!
{
  "__type__": "cc.Button",
  "node": { "__id__": 5 },
  "_interactable": true,
  "_transition": 2,              // 0=NONE, 1=COLOR, 2=SPRITE, 3=SCALE (언더스코어 있음)
  "_normalColor":  { "__type__": "cc.Color", "r": 214, "g": 214, "b": 214, "a": 255 },
  "_pressedColor": { "__type__": "cc.Color", "r": 150, "g": 150, "b": 150, "a": 255 },
  "_hoverColor":   { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 },
  "_disabledColor":{ "__type__": "cc.Color", "r": 120, "g": 120, "b": 120, "a": 200 },
  "_duration": 0.1,
  "_zoomScale": 1.2
}

// cc.Widget — 3.x: _alignFlags 비트값이 2.x와 다름!
// 3.x: LEFT=1, RIGHT=2, TOP=4, BOTTOM=8, HCENTER=16, VCENTER=32
// 2.x: TOP=1, MID_V=2, BOT=4, LEFT=8, CENTER_H=16, RIGHT=32
// 45 = 0b101101 = LEFT|RIGHT|TOP|BOTTOM = 사방 스트레치 (3.x 기준: 1+2+4+8=15? → 실제는 45)
// 실제 확인: 45 = TOP(4)+BOTTOM(8)+LEFT(1)+RIGHT(2)+...? → 포럼 원본 비트 정의로 검증 필요
{
  "__type__": "cc.Widget",
  "node": { "__id__": 6 },
  "_alignFlags": 45,
  "_target": null,
  "_left": 0, "_right": 0, "_top": 0, "_bottom": 0,
  "_isAbsLeft": true, "_isAbsRight": true, "_isAbsTop": true, "_isAbsBottom": true,
  "_alignMode": 1               // 0=ONCE, 1=ON_WINDOW_RESIZE, 2=ALWAYS
}
```

### CC 3.x 파싱 알고리즘

```typescript
function parseSceneFile(raw: any[]): CCSceneNode {
  // 3.x: _lpos/_lrot/_lscale (언더스코어 있음!)
  // .prefab: index 0 = cc.Prefab, "data" 필드로 루트 참조 (씬과 동일 패턴)
  const isPrefab = raw[0]?.__type__ === 'cc.Prefab'
  const rootId = isPrefab ? raw[0].data.__id__ : raw[0].scene.__id__

  function findComponent(compRefs: {__id__: number}[], type: string) {
    return compRefs
      .map(ref => raw[ref.__id__])
      .find(c => c?.__type__ === type)
  }

  function buildNode(idx: number): CCSceneNode {
    const node = raw[idx] as any
    const compRefs = node._components || []
    const uiTransform = findComponent(compRefs, 'cc.UITransform')
    const components = compRefs
      .map((ref: {__id__: number}) => {
        const comp = raw[ref.__id__] as any
        // cc.CompPrefabInfo는 컴포넌트 메타, 스킵
        if (comp.__type__ === 'cc.CompPrefabInfo') return null
        return { type: comp.__type__, props: comp }
      })
      .filter(Boolean)

    return {
      uuid: node._id || String(idx),
      name: node._name || '',
      active: node._active !== false,
      position: node._lpos   || { x: 0, y: 0, z: 0 },
      rotation: node._lrot   || { x: 0, y: 0, z: 0, w: 1 },
      scale:    node._lscale || { x: 1, y: 1, z: 1 },
      size:   uiTransform?._contentSize,
      anchor: uiTransform?._anchorPoint,
      opacity: 255,  // 3.x는 노드 opacity 없음 — 컴포넌트 color.a 로 처리
      color: undefined,
      components,
      children: (node._children || []).map((ref: {__id__: number}) => buildNode(ref.__id__)),
      _rawIndex: idx
    }
  }

  return buildNode(raw[0].__type__ === 'cc.Prefab'
    ? raw[0].data.__id__
    : raw[0].scene.__id__)
}
```

---

## .meta 파일 구조

### 이미지 텍스처 .meta (CC 2.x)

```json
{
  "ver": "2.3.3",
  "uuid": "f3a1b2c4-d5e6-7890-abcd-ef0123456789",
  "type": "sprite",
  "wrapMode": "clamp",
  "filterMode": "bilinear",
  "premultiplyAlpha": false,
  "genMipmaps": false,
  "platformSettings": {},
  "subMetas": {
    "hero": {
      "ver": "1.0.4",
      "uuid": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
      "rawTextureUuid": "f3a1b2c4-d5e6-7890-abcd-ef0123456789",
      "trimType": "auto",
      "trimThreshold": 1,
      "rotated": false,
      "offsetX": 0,
      "offsetY": 0,
      "trimX": 0,
      "trimY": 0,
      "width": 100,
      "height": 100,
      "rawWidth": 100,
      "rawHeight": 100
    }
  }
}
```

### 스크립트 .meta

```json
{
  "ver": "1.0.5",
  "uuid": "c3d4e5f6-a1b2-3456-789a-bcdef0123456",
  "isPlugin": false,
  "loadPluginInWeb": true,
  "loadPluginInNative": true,
  "loadPluginInEditor": false,
  "subMetas": {}
}
```

### .meta에서 UUID 추출 (에셋 참조 해석)

```typescript
async function buildAssetUUIDMap(projectPath: string): Promise<Map<string, string>> {
  const map = new Map<string, string>() // uuid → 파일경로
  const metaFiles = await glob(`${projectPath}/assets/**/*.meta`)
  for (const metaPath of metaFiles) {
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'))
    const assetPath = metaPath.replace(/\.meta$/, '')
    map.set(meta.uuid, assetPath)
    // subMetas (스프라이트 프레임 등)
    for (const [key, sub] of Object.entries(meta.subMetas || {})) {
      map.set((sub as any).uuid, `${assetPath}/${key}`)
    }
  }
  return map
}
```

---

## 버전 감지 로직

```typescript
async function detectCCVersion(projectPath: string): Promise<'2x' | '3x' | 'unknown'> {
  // CC 2.x: project.json 존재
  const projectJsonPath = path.join(projectPath, 'project.json')
  if (await fs.exists(projectJsonPath)) return '2x'

  // CC 3.x: package.json의 creator.version
  const packageJsonPath = path.join(projectPath, 'package.json')
  if (await fs.exists(packageJsonPath)) {
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
    if (pkg.creator?.version?.startsWith('3')) return '3x'
  }

  return 'unknown'
}
```

---

## 신규 파일 아키텍처

```
src/main/cc/
├── cc-bridge.ts              — [레거시] WS 브릿지 (유지, 신규 개발 없음)
├── cc-version-detector.ts    — [신규] CC 버전 감지 (2x/3x/unknown)
├── cc-file-parser.ts         — [신규] .fire/.scene/.prefab 파싱 → CCSceneNode
├── cc-file-writer.ts         — [신규] CCSceneNode → 파일 저장 (원자적)
├── cc-asset-resolver.ts      — [신규] .meta → UUID 맵, 에셋 경로 해석
└── cc-scene-index.ts         — [신규] 프로젝트 내 씬/프리팹 파일 목록 관리

src/renderer/src/
├── hooks/
│   ├── useCCProject.ts       — [신규] 프로젝트 열기/씬 목록/버전 상태 관리
│   └── useCCScene.ts         — [신규] 씬 파싱 결과 + undo/redo 스택
└── components/sidebar/
    ├── CocosPanel.tsx         — [수정] WS 연결 UI 제거, 파일 편집 모드 UI
    ├── SceneTreePanel.tsx     — [수정] 파일 기반 CCSceneNode 트리 렌더링
    ├── NodePropertyPanel.tsx  — [수정] 파일 기반 노드 속성 편집
    ├── AssetBrowserPanel.tsx  — [수정] .meta 기반 에셋 브라우저
    └── SceneView/             — [수정] 파일 기반 씬 렌더링 (WS 데이터 → 파일 데이터)
```

---

## 공통 타입 정의 (cc-types.ts)

```typescript
// 버전 무관 공통 노드 표현
export interface CCSceneNode {
  uuid: string
  name: string
  active: boolean
  position: { x: number; y: number; z?: number }
  rotation: number | { x: number; y: number; z: number; w?: number }
  scale: { x: number; y: number; z?: number }
  size?: { width: number; height: number }
  anchor?: { x: number; y: number }
  opacity: number
  color?: { r: number; g: number; b: number; a: number }
  layer?: number
  components: CCComponent[]
  children: CCSceneNode[]
  // 원본 raw 데이터 (역직렬화 시 필요)
  _raw?: unknown
  _rawIndex?: number
}

export interface CCComponent {
  type: string  // "cc.Label", "cc.Sprite", ...
  props: Record<string, unknown>
}

export interface CCProjectInfo {
  version: '2x' | '3x'
  path: string
  scenes: string[]   // 씬 파일 경로 목록
  prefabs: string[]  // 프리팹 파일 경로 목록
}

// 파서 인터페이스
export interface ICCFileParser {
  version: '2x' | '3x'
  parseFile(filePath: string): Promise<{ root: CCSceneNode; rawData: unknown[] }>
  serializeNode(node: CCSceneNode, rawData: unknown[]): string
  patchNode(rawData: unknown[], nodeIndex: number, updates: Partial<CCSceneNode>): unknown[]
}
```

---

## IPC API (cc-handlers.ts 확장)

### 신규 IPC 채널

```typescript
// 프로젝트 관련
'cc:detectVersion'      — (projectPath: string) → '2x' | '3x' | 'unknown'
'cc:listSceneFiles'     — (projectPath: string) → string[]  // .fire/.scene 파일 목록
'cc:listPrefabFiles'    — (projectPath: string) → string[]
'cc:buildAssetMap'      — (projectPath: string) → Map<string, string>  // uuid → 경로

// 파일 파싱
'cc:parseSceneFile'     — (filePath: string) → { root: CCSceneNode; rawData: unknown[] }
'cc:parsePrefabFile'    — (filePath: string) → { root: CCSceneNode; rawData: unknown[] }

// 파일 편집
'cc:writeSceneFile'     — (filePath: string, rawData: unknown[]) → void
'cc:patchNode'          — (filePath: string, uuid: string, updates: Partial<CCSceneNode>) → void

// 파일 감시
'cc:watchProject'       — (projectPath: string) → void  // fs.watch 등록
'cc:unwatchProject'     — (projectPath: string) → void
// 이벤트: 'cc:file-changed' (renderer 수신)

// 레거시 (유지)
'cc:connect'            — WS 연결 (레거시, 신규 UI 없음)
'cc:get-tree'           — WS 씬 트리 (레거시)
'cc:get-assets'         — WS 에셋 목록 (레거시)
```

---

## 구현 로드맵 (Phase A → D)

### Phase A — 파일 읽기 (Read-Only MVP)

| 우선순위 | 작업 | 예상 라운드 |
|---------|------|-----------|
| A-1 | `cc-version-detector.ts` — 프로젝트 버전 감지 | CC-버전감지 |
| A-2 | `cc-file-parser.ts` (2x) — .fire 파싱 → CCSceneNode | CC-파서-2x |
| A-3 | `cc-file-parser.ts` (3x) — .scene 파싱 → CCSceneNode | CC-파서-3x |
| A-4 | `useCCProject` 훅 + `CocosPanel` 프로젝트 열기 UI | CC-프로젝트-열기 |
| A-5 | SceneTreePanel → 파일 기반 렌더링 | CC-트리-파일 |
| A-6 | SceneView → 파일 기반 SVG 렌더링 | CC-씬뷰-파일 |

### Phase B — 편집 (Read-Write)

| 우선순위 | 작업 | 예상 라운드 |
|---------|------|-----------|
| B-1 | `cc-file-writer.ts` — 원자적 파일 저장 | CC-파일-편집 |
| B-2 | Transform 편집 (position/rotation/scale/size) | CC-트랜스폼-편집 |
| B-3 | 노드 active 토글 / 이름 변경 | CC-노드-편집 |
| B-4 | undo/redo 스택 (`useCCScene`) | CC-언두레두 |
| B-5 | fs.watch 파일 변경 감지 + 자동 리로드 | CC-파일-감시 |
| B-6 | 씬 전환 드롭다운 (씬 목록 → 파일 전환) | CC-씬-전환 |

### Phase C — 컴포넌트 편집

| 우선순위 | 작업 | 예상 라운드 |
|---------|------|-----------|
| C-1 | Label 텍스트/폰트/색상 편집 | CC-컴포넌트-Label |
| C-2 | Sprite spriteFrame 에셋 피커 | CC-컴포넌트-Sprite |
| C-3 | Button/Layout 속성 편집 | CC-컴포넌트-Button |
| C-4 | Widget 정렬 편집 | CC-컴포넌트-Widget |
| C-5 | 커스텀 스크립트 props 편집 | CC-스크립트-Props |

### Phase D — 씬 구조 편집

| 우선순위 | 작업 | 예상 라운드 |
|---------|------|-----------|
| D-1 | 노드 추가/삭제 | CC-노드-CRUD |
| D-2 | 노드 계층 이동 (drag-reparent) | CC-노드-계층이동 |
| D-3 | 프리팹 파싱 + 씬 인스턴스화 | CC-프리팹 |
| D-4 | cc-asset-resolver 에셋 브라우저 통합 | CC-에셋-리졸버 |

---

## 씬뷰 렌더러 아키텍처

### 좌표 변환 (Cocos Y-up → SVG Y-down)

CC는 Y-up (위가 +), SVG는 Y-down (아래가 +). anchorPoint가 자식들의 좌표 origin이 됨.

```typescript
interface Vec2 { x: number; y: number }

// Canvas 중앙을 SVG 원점(svgCenterX, svgCenterY)으로 설정
// 씬 루트 Canvas 노드 기준:
function cocosToSvg(ccX: number, ccY: number, svgCenterX: number, svgCenterY: number) {
  return {
    x: svgCenterX + ccX,
    y: svgCenterY - ccY   // Y축 반전
  }
}

function svgToCocos(svgX: number, svgY: number, svgCenterX: number, svgCenterY: number) {
  return {
    x: svgX - svgCenterX,
    y: svgCenterY - svgY
  }
}

// 부모 anchorPoint가 (0.5,0.5)가 아닐 때 자식 origin 보정
function getChildOrigin(
  parent: { screenCenter: Vec2; size: Vec2; anchor: Vec2; scale: Vec2 }
): Vec2 {
  return {
    x: parent.screenCenter.x + (parent.anchor.x - 0.5) * parent.size.x * parent.scale.x,
    y: parent.screenCenter.y - (parent.anchor.y - 0.5) * parent.size.y * parent.scale.y,
  }
}

// SVG <image>는 좌상단 기준 → anchor 보정 필요
function nodeTopLeft(center: Vec2, size: Vec2, anchor: Vec2, scale: Vec2): Vec2 {
  const w = size.x * scale.x
  const h = size.y * scale.y
  return {
    x: center.x - anchor.x * w,
    y: center.y - (1 - anchor.y) * h,
  }
}

// CC rotation: 반시계 양수 → SVG rotate(): 시계 양수이므로 부호 반전
// SVG: transform="rotate(-ccRotation, cx, cy)"
```

#### 핵심 공식 요약

```
screenX = svgCenterX + ccLocalX
screenY = svgCenterY - ccLocalY      // Y 반전이 전부

// anchorPoint 보정 (부모 origin)
parentOriginX += (anchorX - 0.5) * width  * scaleX
parentOriginY -= (anchorY - 0.5) * height * scaleY

// SVG <image> 좌상단
imageX = nodeCenterX - anchorX * (width * scaleX)
imageY = nodeCenterY - (1 - anchorY) * (height * scaleY)

// 월드 스케일 (누적 곱)
worldScaleX = parentWorldScaleX * node.scaleX

// SVG rotation
svgRotate = -ccDegrees
```

### Electron 로컬 이미지 프로토콜 (Sprite 렌더링)

CC 프로젝트 텍스처를 SVG `<image>`로 렌더링하려면 `file://` 직접 사용 금지 (CSP 우회 위험).
`protocol.handle('asset', ...)` 사용:

```typescript
// main/index.ts — app.ready 이전 등록
import { protocol, net } from 'electron'
import { pathToFileURL } from 'url'

protocol.registerSchemesAsPrivileged([{
  scheme: 'asset',
  privileges: { standard: true, secure: true, supportFetchAPI: true }
}])

app.whenReady().then(() => {
  protocol.handle('asset', (req) => {
    const filePath = decodeURIComponent(new URL(req.url).pathname)
    return net.fetch(pathToFileURL(filePath).toString())
  })
})

// renderer — SVG <image>에서
// <image href="asset:///C:/Users/.../assets/textures/hero.png" ... />
```

### SceneView 상태 관리

```typescript
// useCCScene.ts
interface SceneState {
  nodes: Map<string, CCSceneNode>  // uuid → node
  rawData: unknown[]                // 원본 JSON 배열 (직렬화 시 필요)
  selectedUuids: Set<string>
  history: SceneSnapshot[]          // undo/redo 스택
  historyIndex: number
  dirty: boolean                    // 저장 필요 여부
}

type SceneAction =
  | { type: 'LOAD'; root: CCSceneNode; rawData: unknown[] }
  | { type: 'UPDATE_NODE'; uuid: string; updates: Partial<CCSceneNode> }
  | { type: 'DELETE_NODE'; uuid: string }
  | { type: 'ADD_NODE'; parentUuid: string; node: CCSceneNode }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SELECT'; uuids: string[] }
```

### SVG 드래그 구현 (`setPointerCapture` 필수)

```tsx
// SVG는 HTML drag API 미지원 → pointer event 방식 사용
function useSVGDrag(onMove: (dx: number, dy: number) => void) {
  const dragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })

  const onPointerDown = (e: React.PointerEvent<SVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)  // 요소 밖에서도 이벤트 유지
    startPos.current = { x: e.clientX, y: e.clientY }
    dragging.current = true
  }
  const onPointerMove = (e: React.PointerEvent<SVGElement>) => {
    if (!dragging.current) return
    onMove(e.clientX - startPos.current.x, e.clientY - startPos.current.y)
    startPos.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => { dragging.current = false }
  return { onPointerDown, onPointerMove, onPointerUp }
}
```

### 8방향 리사이즈 핸들

```tsx
const handlePositions = (x: number, y: number, w: number, h: number) => ({
  nw: { cx: x,       cy: y       },
  n:  { cx: x + w/2, cy: y       },
  ne: { cx: x + w,   cy: y       },
  e:  { cx: x + w,   cy: y + h/2 },
  se: { cx: x + w,   cy: y + h   },
  s:  { cx: x + w/2, cy: y + h   },
  sw: { cx: x,       cy: y + h   },
  w:  { cx: x,       cy: y + h/2 },
})
// 각 핸들에 개별 onPointerDown 핸들러 → direction별 크기 계산
```

### SVG 렌더링 최적화

- 노드 수 < 200: React SVG 컴포넌트 (현재 방식 유지)
- 노드 수 200~1000: `React.memo` + `useMemo` per node
- 노드 수 > 1000: OffscreenCanvas + Web Worker

---

## 원자적 파일 저장 패턴

```typescript
import writeFileAtomic from 'write-file-atomic'

export async function saveSceneFile(
  filePath: string,
  rawData: unknown[]
): Promise<void> {
  // 1. JSON 직렬화 (2 spaces indent — CC 원본 형식 유지)
  const content = JSON.stringify(rawData, null, 2)

  // 2. 원자적 쓰기 (temp → rename)
  await writeFileAtomic(filePath, content, { encoding: 'utf-8' })

  // 3. .meta 파일은 수정하지 않음 (에셋 UUID는 파일에 종속)
}
```

---

## 기술 스택 (신규 추가 의존성)

| 패키지 | 용도 | 비고 |
|--------|------|------|
| `konva` + `react-konva` | SceneView Canvas 렌더러 (Transformer 내장) | SVG보다 고노드 성능 우수 |
| `write-file-atomic` | 원자적 파일 저장 | temp→rename, fsync 지원 |
| `chokidar` | 파일 변경 감지 | v4 사용, Windows 안정적 |
| `fast-json-patch` | JSON Patch diff/patch | 대용량 씬 부분 업데이트 |
| `zundo` | Zustand undo/redo 미들웨어 | `temporal()` 래퍼, 50스텝 |
| `immer` | Zustand immer 미들웨어 | 불변 상태 업데이트 |
| `d3-zoom` | SceneView pan/zoom | 선택적, Konva wheel로 대체 가능 |
| `glob` (내장) | .fire/.scene 파일 목록 | Node.js 내장 |

> **`stream-json`은 불필요** — CC 씬 파일 최대 수 MB, JSON.parse로 충분히 처리 가능.

```bash
npm i konva react-konva write-file-atomic chokidar fast-json-patch zundo immer
npm i -D @types/write-file-atomic
```

### chokidar Windows 설정 (필수 옵션)

```typescript
chokidar.watch(filePath, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {    // Windows: 파일 쓰기 완료 대기
    stabilityThreshold: 200,
    pollInterval: 100,
  },
})
```

### SceneView — Konva 기반 렌더러 (권장)

```
100~1000 노드 → Konva.js (react-konva) 권장
- Transformer: 8방향 리사이즈/회전 핸들 내장
- Layer 분리: NodeLayer (정적) / InteractionLayer (자주 갱신)
- 드래그: Stage draggable 또는 Konva wheel zoom
- 멀티셀렉트: Transformer.nodes([...shapes])
```

### Zustand + zundo undo/redo

```typescript
import { create } from 'zustand'
import { temporal } from 'zundo'
import { immer } from 'zustand/middleware/immer'

const useSceneStore = create(
  temporal(
    immer((set) => ({
      nodes: [] as CCSceneNode[],
      selectedIds: [] as string[],
      moveNode: (uuid: string, pos: Vec3) => set(s => {
        const n = s.nodes.find(n => n.uuid === uuid)
        if (n) { n.position = pos; }
      }),
    })),
    {
      partialize: (s) => ({ nodes: s.nodes }), // 씬 노드만 undo 추적
      limit: 50,
    }
  )
)

// undo/redo
const { undo, redo } = useSceneStore.temporal.getState()
```

---

## 성공 기준

### Phase A 완료 기준
- [x] `cc:detectVersion` — project.json/package.json으로 2x/3x 정확히 구분 ✅ Round 414
- [x] CC 2.x .fire 파일 파싱 → SceneTreePanel 렌더링 ✅ Round 415
- [x] CC 3.x .scene 파일 파싱 → SceneTreePanel 렌더링 ✅ Round 415
- [x] SceneView에 파일 기반 노드 렌더링 (위치/크기 정확) ✅ Round 417
- [x] CC 에디터 미실행 상태에서 완전 동작 ✅

### Phase B 완료 기준
- [x] Transform 편집 → 파일 저장 → 다시 열면 반영됨 ✅ Round 426
- [x] undo/redo 정상 동작 (50단계) ✅ Round 433
- [x] 파일 외부 변경 시 자동 리로드 ✅ Round 428
- [x] 씬 전환 드롭다운 동작 ✅

### Phase D 완료 기준
- [x] 노드 추가/삭제 → 파일 반영 ✅ Round 431-432
- [x] 프리팹 파싱 ✅ Round 435
- [x] 모든 기능 CC 에디터 없이 동작 ✅

### 추가 구현 완료 기능 (Round 442-471)
| 라운드 | 기능 |
|--------|------|
| 442-445 | Inspector boolean/UUID ref/벡터 props 편집 |
| 446-447 | 씬 트리 우클릭 컨텍스트 메뉴, Delete/Ctrl+D/Arrow 단축키 |
| 448-452 | Camera bgColor, 씬 통계, Sprite/Label SVG 렌더링, 드롭 열기 |
| 453-455 | 선택 노드 HUD, 컴포넌트 아이콘, Ctrl+S 저장 |
| 456-458 | Inspector 섹션 토글, 노드 active 토글, Ctrl+C/V 복사/붙여넣기 |
| 459-462 | Grid snap, 미니맵, CC버전배지, 마우스 씬 좌표 HUD |
| 463-467 | 노드 호버 하이라이트, 컴포넌트 삭제, 최근 파일, 더블클릭 Fit, 노드 경로 |
| 468-471 | layer 표시, 그리드 토글, 비활성 숨기기, 배경색 오버라이드 |

---

## WS 브릿지 Deprecation 계획

Phase 2 완료 후 정리 대상:

| 파일 | 조치 |
|------|------|
| `cc/cc-bridge.ts` | 유지 (레거시 지원) |
| `extensions/cc-ws-extension-2x/` | 유지 (기존 사용자) |
| `extensions/cc-ws-extension-3x/` | 유지 (기존 사용자) |
| `useCCContext.ts` — WS 관련 훅 | Phase D 완료 후 deprecated 표시 |
| `CocosPanel.tsx` — WS 연결 UI | Phase A 완료 후 숨김 (설정으로 토글) |
| `cc:get-tree` / `cc:get-node` IPC | 유지 (레거시), 신규 UI에서 미사용 |
