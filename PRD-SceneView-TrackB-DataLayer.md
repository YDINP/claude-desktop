# PRD — Track B: Data Layer (SceneSync + Store + Coordinate Utils)

> 작성일: 2026-03-12
> 대상 앱: claude-desktop (Electron + React)
> 출력 디렉토리: `src/renderer/src/scene/`

---

## 1. 배경 및 목적

SceneView Track C (SVG 렌더러)와 Track D (Integration)이 공통으로 사용하는 데이터 레이어.
CC Extension HTTP API에서 씬 데이터를 수신 → 정규화 → React 상태로 관리하고,
화면 좌표 ↔ CC 월드 좌표 변환을 담당한다.

Track B의 결과물은 독립 모듈로서 Track C/D에서 import하여 사용한다.
Track B 자체는 어떤 UI도 렌더링하지 않는다.

---

## 2. 파일 구조

```
src/renderer/src/scene/
├── sceneTypes.ts        # 타입 정의 (전체 공유)
├── coordinateUtils.ts   # 좌표 변환 유틸
├── sceneViewStore.ts    # Zustand 스토어
└── useSceneSync.ts      # CC API 폴링 + WS 이벤트 훅
```

---

## 3. sceneTypes.ts

### 3-1. SceneNode

CC Extension에서 받아온 노드 데이터를 정규화한 타입.

```typescript
export interface Vec2 { x: number; y: number }
export interface Size { w: number; h: number }

export interface SceneNode {
  uuid: string
  name: string
  active: boolean

  // 로컬 변환 (CC 좌표계: Y-up, 앵커 기준)
  position: Vec2      // 부모 기준 로컬 position
  size: Size          // width, height
  anchor: Vec2        // 0~1 범위 (default: 0.5, 0.5)
  scale: Vec2         // (default: 1, 1)
  rotation: number    // CCW degrees

  // 시각 속성
  opacity: number     // 0~255
  color: string       // "#rrggbb"

  // 컴포넌트 목록 (className 문자열)
  components: string[]

  // 트리 관계
  parentUuid: string | null
  childUuids: string[]

  // 내부 캐시 (Track B에서 계산, 외부 mutate 금지)
  _dirty: boolean           // API 응답과 diff가 있으면 true
  _worldPos: Vec2           // 루트 기준 월드 position (계산값)
  _worldRot: number         // 누적 회전
  _worldScaleX: number      // 누적 스케일 X
  _worldScaleY: number      // 누적 스케일 Y
}
```

### 3-2. ViewTransform

씬 뷰어의 카메라(pan/zoom) 상태.

```typescript
export interface ViewTransform {
  offsetX: number   // 뷰포트 중심 기준 pan (px)
  offsetY: number
  zoom: number      // 1.0 = 100%
}
```

### 3-3. 드래그 상태

```typescript
export type DragKind = 'move' | 'resize'

export type ResizeHandle =
  | 'nw' | 'n' | 'ne'
  | 'w'            | 'e'
  | 'sw' | 's' | 'se'

export interface DragState {
  kind: DragKind
  uuid: string
  handle?: ResizeHandle      // resize 시에만

  // 드래그 시작 시점 스냅샷
  startScreenX: number
  startScreenY: number
  startNodeX: number         // CC 좌표 기준
  startNodeY: number
  startWidth: number
  startHeight: number
}
```

### 3-4. CanvasInfo

CC designResolution (Track A에서 추가된 API 결과).

```typescript
export interface CanvasInfo {
  width: number
  height: number
  fitWidth: boolean
  fitHeight: boolean
}
```

### 3-5. SceneState (스토어 루트)

```typescript
export interface SceneState {
  nodes: Record<string, SceneNode>  // uuid → node
  rootUuids: string[]               // 루트 노드 uuid 목록 (순서 보장)
  selectedUuid: string | null
  hoveredUuid: string | null
  viewTransform: ViewTransform
  drag: DragState | null
  canvas: CanvasInfo | null
  lastSyncAt: number | null         // timestamp
  syncError: string | null
}
```

---

## 4. coordinateUtils.ts

### 4-1. 좌표계 규약

| 좌표계 | X | Y | 단위 |
|--------|---|---|------|
| CC 월드 | 오른쪽+ | 위+ (Y-up) | CC 픽셀 |
| 스크린 | 오른쪽+ | 아래+ (Y-down) | CSS 픽셀 |

전환 공식:
```
sx = wx * zoom + offsetX
sy = -wy * zoom + offsetY   // Y축 반전
```

역변환:
```
wx = (sx - offsetX) / zoom
wy = -(sy - offsetY) / zoom
```

### 4-2. 구현

```typescript
import type { Vec2, ViewTransform, SceneNode, Size } from './sceneTypes'

/** CC 월드 좌표 → 스크린 좌표 */
export function worldToScreen(wx: number, wy: number, vt: ViewTransform): Vec2 {
  return {
    x: wx * vt.zoom + vt.offsetX,
    y: -wy * vt.zoom + vt.offsetY,
  }
}

/** 스크린 좌표 → CC 월드 좌표 */
export function screenToWorld(sx: number, sy: number, vt: ViewTransform): Vec2 {
  return {
    x: (sx - vt.offsetX) / vt.zoom,
    y: -(sy - vt.offsetY) / vt.zoom,
  }
}

/**
 * 노드의 스크린 bounding box 계산.
 * position = 앵커 기준 로컬 좌표 → 월드 좌표로 변환 후 스크린 투영.
 * 회전/스케일은 MVP에서 bounding box 수준으로만 처리(AABB).
 */
export function nodeScreenRect(
  node: SceneNode,
  vt: ViewTransform
): { x: number; y: number; w: number; h: number } {
  const wx = node._worldPos.x
  const wy = node._worldPos.y
  const sw = node.size.w * Math.abs(node._worldScaleX) * vt.zoom
  const sh = node.size.h * Math.abs(node._worldScaleY) * vt.zoom
  const center = worldToScreen(wx, wy, vt)

  return {
    x: center.x - sw * node.anchor.x,
    y: center.y - sh * (1 - node.anchor.y),  // Y-down 보정
    w: sw,
    h: sh,
  }
}

/**
 * 월드 좌표계에서 두 노드 간 relative position 계산.
 * 부모 노드의 월드 position 기준으로 자식 로컬 좌표 복원.
 */
export function worldToLocal(
  worldX: number,
  worldY: number,
  parentWorldX: number,
  parentWorldY: number,
  parentScaleX: number,
  parentScaleY: number,
): Vec2 {
  return {
    x: (worldX - parentWorldX) / (parentScaleX || 1),
    y: (worldY - parentWorldY) / (parentScaleY || 1),
  }
}

/** designResolution 중심을 (0,0)으로 할 때의 뷰포트 기본 offsetX/Y 계산 */
export function defaultViewTransform(
  canvasW: number,
  canvasH: number,
  viewportW: number,
  viewportH: number,
  initialZoom = 1,
): ViewTransform {
  return {
    offsetX: viewportW / 2,
    offsetY: viewportH / 2,
    zoom: initialZoom,
  }
}
```

---

## 5. sceneViewStore.ts

Zustand 스토어. UI 컴포넌트는 이 스토어만 참조한다.

```typescript
import { create } from 'zustand'
import type { SceneState, SceneNode, ViewTransform, DragState, CanvasInfo } from './sceneTypes'

interface SceneActions {
  // 씬 데이터
  setNodes(nodes: Record<string, SceneNode>, rootUuids: string[]): void
  updateNode(uuid: string, patch: Partial<SceneNode>): void
  setCanvas(info: CanvasInfo): void
  setSyncError(err: string | null): void

  // 선택/호버
  selectNode(uuid: string | null): void
  hoverNode(uuid: string | null): void

  // 뷰 트랜스폼
  setViewTransform(vt: Partial<ViewTransform>): void
  resetView(canvasW: number, canvasH: number, vpW: number, vpH: number): void

  // 드래그
  beginDrag(state: DragState): void
  endDrag(): void

  // 전체 초기화 (씬 전환 시)
  reset(): void
}

const initialState: SceneState = {
  nodes: {},
  rootUuids: [],
  selectedUuid: null,
  hoveredUuid: null,
  viewTransform: { offsetX: 0, offsetY: 0, zoom: 1 },
  drag: null,
  canvas: null,
  lastSyncAt: null,
  syncError: null,
}

export const useSceneStore = create<SceneState & SceneActions>((set, get) => ({
  ...initialState,

  setNodes(nodes, rootUuids) {
    set({ nodes, rootUuids, lastSyncAt: Date.now(), syncError: null })
  },

  updateNode(uuid, patch) {
    set(s => ({
      nodes: { ...s.nodes, [uuid]: { ...s.nodes[uuid], ...patch } },
    }))
  },

  setCanvas(info) { set({ canvas: info }) },
  setSyncError(err) { set({ syncError: err }) },

  selectNode(uuid) { set({ selectedUuid: uuid }) },
  hoverNode(uuid) { set({ hoveredUuid: uuid }) },

  setViewTransform(vt) {
    set(s => ({ viewTransform: { ...s.viewTransform, ...vt } }))
  },

  resetView(canvasW, canvasH, vpW, vpH) {
    const zoom = Math.min(vpW / canvasW, vpH / canvasH) * 0.9
    set({
      viewTransform: {
        offsetX: vpW / 2,
        offsetY: vpH / 2,
        zoom,
      }
    })
  },

  beginDrag(state) { set({ drag: state }) },
  endDrag() { set({ drag: null }) },

  reset() { set(initialState) },
}))
```

---

## 6. useSceneSync.ts

CC Extension API 폴링 + WS 이벤트 구독 훅.
이 훅이 마운트되면 씬 데이터를 주기적으로 fetch하고 스토어를 갱신한다.

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { useSceneStore } from './sceneViewStore'
import type { SceneNode, Vec2 } from './sceneTypes'

interface UseSyncOptions {
  port: number
  enabled: boolean        // connected === true 일 때만 활성화
  pollInterval?: number   // ms, default 2000
}

/** API 응답 → SceneNode 정규화 */
function normalizeNode(raw: any, parentUuid: string | null): SceneNode {
  return {
    uuid: raw.uuid,
    name: raw.name ?? '',
    active: raw.active ?? true,
    position: { x: raw.x ?? 0, y: raw.y ?? 0 },
    size: { w: raw.width ?? 100, h: raw.height ?? 100 },
    anchor: { x: raw.anchorX ?? 0.5, y: raw.anchorY ?? 0.5 },
    scale: { x: raw.scaleX ?? 1, y: raw.scaleY ?? 1 },
    rotation: raw.rotation ?? 0,
    opacity: raw.opacity ?? 255,
    color: raw.color ?? '#ffffff',
    components: raw.components ?? [],
    parentUuid,
    childUuids: (raw.children ?? []).map((c: any) => c.uuid),
    _dirty: false,
    _worldPos: { x: raw.x ?? 0, y: raw.y ?? 0 },
    _worldRot: raw.rotation ?? 0,
    _worldScaleX: raw.scaleX ?? 1,
    _worldScaleY: raw.scaleY ?? 1,
  }
}

/** 트리를 순회하며 월드 좌표 계산 */
function computeWorldTransforms(
  nodes: Record<string, SceneNode>,
  rootUuids: string[]
): void {
  function traverse(uuid: string, parentWorld: { x: number; y: number; rot: number; sx: number; sy: number }) {
    const n = nodes[uuid]
    if (!n) return
    n._worldPos = {
      x: parentWorld.x + n.position.x * parentWorld.sx,
      y: parentWorld.y + n.position.y * parentWorld.sy,
    }
    n._worldRot = parentWorld.rot + n.rotation
    n._worldScaleX = parentWorld.sx * n.scale.x
    n._worldScaleY = parentWorld.sy * n.scale.y
    for (const childUuid of n.childUuids) {
      traverse(childUuid, {
        x: n._worldPos.x,
        y: n._worldPos.y,
        rot: n._worldRot,
        sx: n._worldScaleX,
        sy: n._worldScaleY,
      })
    }
  }
  for (const uuid of rootUuids) {
    traverse(uuid, { x: 0, y: 0, rot: 0, sx: 1, sy: 1 })
  }
}

/** 트리 배열을 Record로 flatten */
function flattenTree(
  nodes: any[],
  parentUuid: string | null,
  out: Record<string, SceneNode>
): void {
  for (const raw of nodes) {
    const node = normalizeNode(raw, parentUuid)
    out[node.uuid] = node
    if (raw.children?.length) {
      flattenTree(raw.children, node.uuid, out)
    }
  }
}

export function useSceneSync({ port, enabled, pollInterval = 2000 }: UseSyncOptions) {
  const { setNodes, setSyncError, selectNode, setCanvas } = useSceneStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchScene = useCallback(async () => {
    if (!mountedRef.current || !enabled) return
    try {
      const base = `http://localhost:${port}`
      const res = await fetch(`${base}/scene/tree`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // flatten + 월드 좌표 계산
      const nodeMap: Record<string, SceneNode> = {}
      const roots: any[] = Array.isArray(data) ? data : data.children ?? [data]
      flattenTree(roots, null, nodeMap)
      const rootUuids = roots.map((r: any) => r.uuid)
      computeWorldTransforms(nodeMap, rootUuids)

      if (!mountedRef.current) return
      setNodes(nodeMap, rootUuids)

      // canvas info (Track A에서 추가된 엔드포인트)
      try {
        const cr = await fetch(`${base}/canvas`)
        if (cr.ok) {
          const ci = await cr.json()
          if (mountedRef.current) setCanvas(ci)
        }
      } catch { /* 미구현 버전 무시 */ }

    } catch (e) {
      if (mountedRef.current) setSyncError(String(e))
    }
  }, [port, enabled, setNodes, setSyncError, setCanvas])

  // 폴링 루프
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const loop = async () => {
      while (!cancelled && mountedRef.current) {
        await fetchScene()
        await new Promise(r => setTimeout(r, pollInterval))
      }
    }
    loop()

    // WS 이벤트: node:select → 스토어 selectNode
    const unsub = window.api.onCCEvent?.((event) => {
      if (cancelled) return
      if (event.type === 'node:select' && event.uuids?.[0]) {
        selectNode(event.uuids[0])
      }
    })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [enabled, port, fetchScene, selectNode, pollInterval])
}
```

---

## 7. 의존성

| 패키지 | 용도 | 기존 설치 여부 |
|--------|------|--------------|
| `zustand` | sceneViewStore | 미확인 — `package.json` 확인 필요 |

Zustand 미설치 시:
```bash
cd src/renderer && npm install zustand
```

대안 (Zustand 없이 useReducer + Context): Track D Integration 단계에서 판단.

---

## 8. Track 간 인터페이스

| Track | 의존 방향 | 사용 항목 |
|-------|----------|----------|
| C (UI) | → B | `useSceneStore`, `nodeScreenRect`, `worldToScreen`, `screenToWorld`, 타입 전체 |
| D (Integration) | → B | `useSceneSync`, `useSceneStore.reset()`, `setViewTransform` |
| A (Extension) | (없음) | B는 A의 HTTP API를 fetch로 직접 호출 |

---

## 9. 구현 순서 (Track B 단독)

1. `sceneTypes.ts` — 타입만 정의 (의존성 없음)
2. `coordinateUtils.ts` — 순수 함수 (의존성: sceneTypes)
3. `sceneViewStore.ts` — Zustand 스토어 (zustand 설치 필요)
4. `useSceneSync.ts` — 훅 (의존성: store + window.api)
5. 단위 테스트: `coordinateUtils` 왕복 변환 검증

---

## 10. 완료 기준

- [ ] `sceneTypes.ts` 타입 컴파일 통과
- [ ] `coordinateUtils.ts` 왕복 변환 오차 < 0.001px
- [ ] `sceneViewStore.ts` — setNodes/selectNode/drag 상태 전환 정상
- [ ] `useSceneSync.ts` — `http://localhost:9090/scene/tree` 응답 → 스토어 반영 확인
- [ ] Track C 가 `useSceneStore()` import 시 타입 에러 없음
