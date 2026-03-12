# PRD — Track C: Scene View UI
## SVG 렌더러 / Toolbar / Inspector

> 작성일: 2026-03-12
> 대상 앱: claude-desktop (Electron + React)
> 출력 디렉토리: `src/renderer/src/components/sidebar/SceneView/`

---

## 1. 배경 및 목적

기존 CocosPanel은 SceneTreePanel(씬 트리) + NodePropertyPanel(속성 패널)로만 구성되어 있다.
씬 구조를 텍스트 트리로만 파악할 수 있고, 노드 위치/크기를 시각적으로 확인·편집할 수 없는 한계가 있다.

Track C는 SVG 기반 씬 뷰어를 추가해 다음을 가능하게 한다.

- 씬 전체 레이아웃을 2D 캔버스로 시각화
- 노드 드래그로 position 직접 편집
- 선택 → Inspector 연동 (x, y, w, h, rot, anchor, active)
- Toolbar로 도구 전환 / 줌 / 그리드 / 스냅 제어

---

## 2. 기술 환경 (현황 파악)

### CSS 변수 (theme.css)

```
--bg-primary: #1e1e1e        --bg-secondary: #252526
--bg-tertiary: #2d2d30       --bg-hover: #2a2d2e
--bg-input: #3c3c3c          --border: #3d3d3d
--text-primary: #d4d4d4      --text-muted: #858585
--accent: #0098ff            --accent-hover: #1a7fc1
--accent-dim: rgba(0,152,255,0.15)
--success: #3fb950           --warning: #dcdcaa
--error: #f44747
--font-mono: 'Cascadia Code', 'Fira Code', monospace
```

### CCNode (ipc-schema.ts)

```typescript
interface CCNode {
  uuid: string
  name: string
  active: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  anchor: { x: number; y: number }
  scale: { x: number; y: number }
  rotation: number
  opacity: number
  color: { r: number; g: number; b: number; a: number }
  children: CCNode[]
  components: { type: string }[]
}
```

### 기존 IPC API (window.api)

- `ccGetTree()` → `CCNode` (루트)
- `ccGetNode(uuid)` → `CCNode`
- `ccSetProperty(uuid, key, value)` → void
- `onCCEvent(handler)` → unsubscribe fn
  - 이벤트 타입: `scene:ready`, `scene:saved`, `node:select`, `node:deselect`

> **신규 IPC 필요**: `ccSetNodeProperty(uuid, prop, value)` — 드래그 완료 시 x/y 전송
> 기존 `ccSetProperty`와 시그니처가 동일하므로 실제 구현에서는 동일 함수 사용 가능.
> PRD 명세 내에서는 명시적 구분을 위해 `window.api.ccSetProperty(uuid, 'x', x)` 형태로 표기.

---

## 3. 신규 타입 정의

SceneView 모듈 내부에서 사용하는 타입. `SceneView/types.ts`에 정의.

```typescript
// CCNode를 SceneView 내부에서 처리하기 위한 평탄화 타입
export interface SceneNode {
  uuid: string
  name: string
  active: boolean
  x: number            // position.x
  y: number            // position.y
  width: number        // size.width
  height: number       // size.height
  anchorX: number      // anchor.x
  anchorY: number      // anchor.y
  scaleX: number
  scaleY: number
  rotation: number     // degrees
  opacity: number
  color: { r: number; g: number; b: number; a: number }
  parentUuid: string | null
  childUuids: string[]
  components: { type: string }[]
}

// SVG 뷰포트 변환
export interface ViewTransform {
  offsetX: number   // pan X (씬 원점 기준 SVG px)
  offsetY: number   // pan Y
  zoom: number      // scale factor (1 = 100%)
}

// 드래그 상태
export interface DragState {
  uuid: string
  startSvgX: number
  startSvgY: number
  startNodeX: number
  startNodeY: number
}
```

---

## 4. 유틸 함수 (`SceneView/utils.ts`)

### CCNode → SceneNode 평탄화

```typescript
export function flattenTree(
  node: CCNode,
  parentUuid: string | null,
  out: Map<string, SceneNode>
): void {
  const sn: SceneNode = {
    uuid: node.uuid,
    name: node.name,
    active: node.active,
    x: node.position.x,
    y: node.position.y,
    width: node.size.width,
    height: node.size.height,
    anchorX: node.anchor.x,
    anchorY: node.anchor.y,
    scaleX: node.scale.x,
    scaleY: node.scale.y,
    rotation: node.rotation,
    opacity: node.opacity,
    color: node.color,
    parentUuid,
    childUuids: node.children.map(c => c.uuid),
    components: node.components,
  }
  out.set(node.uuid, sn)
  for (const child of node.children) {
    flattenTree(child, node.uuid, out)
  }
}
```

### 렌더링 순서 (DFS pre-order)

```typescript
export function getRenderOrder(
  rootUuid: string,
  nodeMap: Map<string, SceneNode>
): string[] {
  const result: string[] = []
  function dfs(uuid: string) {
    result.push(uuid)
    const node = nodeMap.get(uuid)
    if (!node) return
    for (const childUuid of node.childUuids) dfs(childUuid)
  }
  dfs(rootUuid)
  return result
}
```

### SVG 좌표 변환

Cocos 좌표계: Y축 위가 양수, 원점 = 씬 중앙
SVG 좌표계: Y축 아래가 양수, 원점 = 좌상단

```typescript
// 씬 크기가 designWidth x designHeight 일 때
// Cocos (cx, cy) → SVG (sx, sy)
export function cocosToSvg(
  cx: number,
  cy: number,
  designWidth: number,
  designHeight: number
): { sx: number; sy: number } {
  return {
    sx: designWidth / 2 + cx,
    sy: designHeight / 2 - cy,
  }
}

// SVG 마우스 좌표 → 씬 좌표 (ViewTransform 적용)
export function svgToCocos(
  svgX: number,
  svgY: number,
  view: ViewTransform,
  designWidth: number,
  designHeight: number
): { cx: number; cy: number } {
  const sceneX = (svgX - view.offsetX) / view.zoom
  const sceneY = (svgY - view.offsetY) / view.zoom
  return {
    cx: sceneX - designWidth / 2,
    cy: -(sceneY - designHeight / 2),
  }
}
```

### 컴포넌트 타입 아이콘

```typescript
export function getComponentIcon(components: { type: string }[]): string {
  const types = components.map(c => c.type)
  if (types.some(t => t.includes('Button'))) return 'B'
  if (types.some(t => t.includes('Label') || t.includes('RichText'))) return 'T'
  if (types.some(t => t.includes('Sprite'))) return 'S'
  if (types.some(t => t.includes('Layout'))) return 'L'
  if (types.some(t => t.includes('ScrollView'))) return 'V'
  if (types.some(t => t.includes('EditBox'))) return 'E'
  if (types.some(t => t.includes('ProgressBar'))) return 'P'
  if (types.some(t => t.includes('Toggle'))) return 'G'
  if (types.some(t => t.includes('Camera'))) return 'C'
  return ''
}
```

---

## 5. useSceneSync 훅 (`SceneView/useSceneSync.ts`)

씬 데이터 로드 및 이벤트 구독을 담당하는 커스텀 훅.

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import type { CCNode } from '../../../../../shared/ipc-schema'
import type { SceneNode } from './types'
import { flattenTree } from './utils'

interface UseSceneSyncReturn {
  nodeMap: Map<string, SceneNode>
  rootUuid: string | null
  loading: boolean
  refresh: () => Promise<void>
  updateNode: (uuid: string, partial: Partial<SceneNode>) => void
}

export function useSceneSync(connected: boolean): UseSceneSyncReturn {
  const [nodeMap, setNodeMap] = useState<Map<string, SceneNode>>(new Map())
  const [rootUuid, setRootUuid] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    if (!connected) return
    setLoading(true)
    try {
      const tree: CCNode | undefined = await window.api.ccGetTree?.()
      if (!tree) return
      const map = new Map<string, SceneNode>()
      flattenTree(tree, null, map)
      setNodeMap(map)
      setRootUuid(tree.uuid)
    } catch (e) {
      console.error('[useSceneSync] refresh failed:', e)
    } finally {
      setLoading(false)
    }
  }, [connected])

  // 로컬 낙관적 업데이트 (드래그 중 즉시 반영)
  const updateNode = useCallback((uuid: string, partial: Partial<SceneNode>) => {
    setNodeMap(prev => {
      const next = new Map(prev)
      const node = next.get(uuid)
      if (node) next.set(uuid, { ...node, ...partial })
      return next
    })
  }, [])

  useEffect(() => {
    if (!connected) return
    refresh()

    const unsub = window.api.onCCEvent?.((event) => {
      if (event.type === 'scene:ready' || event.type === 'scene:saved') {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null
          refresh()
        }, 500)
      }
    })

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      unsub?.()
    }
  }, [connected, refresh])

  return { nodeMap, rootUuid, loading, refresh, updateNode }
}
```

---

## 6. C-1: `index.ts` (export barrel)

**경로**: `src/renderer/src/components/sidebar/SceneView/index.ts`

```typescript
export { SceneViewPanel } from './SceneViewPanel'
export { SceneToolbar } from './SceneToolbar'
export { SceneInspector } from './SceneInspector'
export { NodeRenderer } from './NodeRenderer'
export { useSceneSync } from './useSceneSync'
export type { SceneNode, ViewTransform, DragState } from './types'
```

---

## 7. C-2: `SceneToolbar.tsx`

**경로**: `src/renderer/src/components/sidebar/SceneView/SceneToolbar.tsx`

### Props 인터페이스

```typescript
interface SceneToolbarProps {
  activeTool: 'select' | 'move'
  zoom: number
  gridVisible: boolean
  snapEnabled: boolean
  onToolChange: (tool: 'select' | 'move') => void
  onZoomChange: (zoom: number) => void
  onGridToggle: () => void
  onSnapToggle: () => void
  onFit: () => void
  onRefresh: () => void
}
```

### 전체 구현 코드

```typescript
import React from 'react'

interface SceneToolbarProps {
  activeTool: 'select' | 'move'
  zoom: number
  gridVisible: boolean
  snapEnabled: boolean
  onToolChange: (tool: 'select' | 'move') => void
  onZoomChange: (zoom: number) => void
  onGridToggle: () => void
  onSnapToggle: () => void
  onFit: () => void
  onRefresh: () => void
}

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

export function SceneToolbar({
  activeTool,
  zoom,
  gridVisible,
  snapEnabled,
  onToolChange,
  onZoomChange,
  onGridToggle,
  onSnapToggle,
  onFit,
  onRefresh,
}: SceneToolbarProps) {
  const zoomIn = () => {
    const next = ZOOM_STEPS.find(z => z > zoom) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
    onZoomChange(next)
  }
  const zoomOut = () => {
    const next = [...ZOOM_STEPS].reverse().find(z => z < zoom) ?? ZOOM_STEPS[0]
    onZoomChange(next)
  }

  const btnBase: React.CSSProperties = {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text-muted)',
    fontSize: 10,
    padding: '2px 5px',
    cursor: 'pointer',
    lineHeight: '16px',
    userSelect: 'none',
  }
  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: 'var(--accent-dim)',
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
  }
  const divider: React.CSSProperties = {
    width: 1,
    height: 14,
    background: 'var(--border)',
    flexShrink: 0,
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 6px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* 도구 선택 */}
      <button
        style={activeTool === 'select' ? btnActive : btnBase}
        onClick={() => onToolChange('select')}
        title="선택 도구 (V)"
      >
        ↖ 선택
      </button>
      <button
        style={activeTool === 'move' ? btnActive : btnBase}
        onClick={() => onToolChange('move')}
        title="이동 도구 (W)"
      >
        ✥ 이동
      </button>

      <div style={divider} />

      {/* 줌 */}
      <button style={btnBase} onClick={zoomOut} title="축소">−</button>
      <button
        style={{ ...btnBase, minWidth: 40, textAlign: 'center' }}
        onClick={() => onZoomChange(1)}
        title="100% 리셋"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button style={btnBase} onClick={zoomIn} title="확대">+</button>

      <div style={divider} />

      {/* Fit */}
      <button
        style={btnBase}
        onClick={onFit}
        title="화면에 맞추기 (F)"
      >
        ⊡ Fit
      </button>

      <div style={divider} />

      {/* 그리드 */}
      <button
        style={gridVisible ? btnActive : btnBase}
        onClick={onGridToggle}
        title="그리드 표시"
      >
        ⊞ Grid
      </button>

      {/* 스냅 */}
      <button
        style={snapEnabled ? btnActive : btnBase}
        onClick={onSnapToggle}
        title="스냅 활성화"
      >
        ⊕ Snap
      </button>

      <div style={{ flex: 1 }} />

      {/* 새로고침 */}
      <button
        style={btnBase}
        onClick={onRefresh}
        title="씬 새로고침"
      >
        ↺
      </button>
    </div>
  )
}
```

### 단축키 바인딩

단축키는 `SceneViewPanel.tsx`의 `useEffect`에서 등록한다. 아래 키 이벤트 처리 참조:

```typescript
// SceneViewPanel 내부 useEffect
useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    // 입력 필드 포커스 중엔 무시
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    if (e.key === 'v' || e.key === 'V') setActiveTool('select')
    if (e.key === 'w' || e.key === 'W') setActiveTool('move')
    if (e.key === 'f' || e.key === 'F') handleFit()
  }
  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [handleFit])
```

---

## 8. C-3: `SceneInspector.tsx`

**경로**: `src/renderer/src/components/sidebar/SceneView/SceneInspector.tsx`

### Props 인터페이스

```typescript
interface SceneInspectorProps {
  node: SceneNode | null
  onUpdate: (uuid: string, prop: string, value: number | boolean) => void
  onClose: () => void
}
```

### 전체 구현 코드

```typescript
import { useState, useEffect } from 'react'
import type { SceneNode } from './types'

interface SceneInspectorProps {
  node: SceneNode | null
  onUpdate: (uuid: string, prop: string, value: number | boolean) => void
  onClose: () => void
}

// 개별 수치 입력 필드
function NumInput({
  label,
  value,
  decimals = 0,
  prop,
  uuid,
  onSave,
}: {
  label: string
  value: number
  decimals?: number
  prop: string
  uuid: string
  onSave: (uuid: string, prop: string, value: number) => void
}) {
  const fmt = (v: number) =>
    decimals > 0 ? String(parseFloat(v.toFixed(decimals))) : String(Math.round(v))

  const [draft, setDraft] = useState(fmt(value))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setDraft(fmt(value))
  }, [value, dirty])

  const commit = () => {
    const num = parseFloat(draft)
    if (!isNaN(num) && num !== value) {
      onSave(uuid, prop, num)
    }
    setDirty(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 0',
      }}
    >
      <span
        style={{
          width: 48,
          fontSize: 9,
          color: 'var(--text-muted)',
          flexShrink: 0,
          letterSpacing: '0.2px',
        }}
      >
        {label}
      </span>
      <input
        value={draft}
        onChange={e => {
          setDraft(e.target.value)
          setDirty(true)
        }}
        onFocus={() => setDirty(true)}
        onBlur={() => { commit() }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setDraft(fmt(value))
            setDirty(false)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        style={{
          flex: 1,
          background: 'var(--bg-input)',
          color: dirty ? 'var(--warning)' : 'var(--text-primary)',
          border: dirty
            ? '1px solid var(--warning)'
            : '1px solid var(--border)',
          borderRadius: 3,
          padding: '2px 5px',
          fontSize: 10,
          outline: 'none',
          transition: 'border-color 0.1s',
        }}
      />
    </div>
  )
}

// 섹션 헤더
function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 600,
        color: 'var(--text-muted)',
        padding: '5px 0 2px',
        borderTop: '1px solid var(--border)',
        marginTop: 3,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  )
}

export function SceneInspector({ node, onUpdate, onClose }: SceneInspectorProps) {
  if (!node) return null

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: '2px solid var(--border)',
        background: 'var(--bg-secondary)',
        padding: '6px 8px',
        fontSize: 11,
        maxHeight: 280,
        overflowY: 'auto',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 140,
          }}
          title={node.name}
        >
          {node.name}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Active 토글 */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              fontSize: 9,
              color: 'var(--text-muted)',
            }}
          >
            <div
              onClick={() => onUpdate(node.uuid, 'active', !node.active)}
              style={{
                width: 24,
                height: 12,
                borderRadius: 6,
                background: node.active ? 'var(--success)' : 'var(--border)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: node.active ? 14 : 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.15s',
                }}
              />
            </div>
            active
          </label>

          {/* 닫기 */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Position */}
      <SectionHeader label="Position" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
        <NumInput label="X" value={node.x} uuid={node.uuid} prop="x" onSave={onUpdate} />
        <NumInput label="Y" value={node.y} uuid={node.uuid} prop="y" onSave={onUpdate} />
      </div>

      {/* Size */}
      <SectionHeader label="Size" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
        <NumInput label="W" value={node.width} uuid={node.uuid} prop="width" onSave={onUpdate} />
        <NumInput label="H" value={node.height} uuid={node.uuid} prop="height" onSave={onUpdate} />
      </div>

      {/* Rotation */}
      <SectionHeader label="Rotation" />
      <NumInput label="Rot" value={node.rotation} decimals={2} uuid={node.uuid} prop="rotation" onSave={onUpdate} />

      {/* Anchor */}
      <SectionHeader label="Anchor" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
        <NumInput label="Ax" value={node.anchorX} decimals={2} uuid={node.uuid} prop="anchorX" onSave={onUpdate} />
        <NumInput label="Ay" value={node.anchorY} decimals={2} uuid={node.uuid} prop="anchorY" onSave={onUpdate} />
      </div>

      {/* 컴포넌트 목록 */}
      {node.components.length > 0 && (
        <>
          <SectionHeader label="Components" />
          <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.9 }}>
            {node.components.map((c, i) => (
              <div key={i}>{c.type}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

### 동작 명세

| 상황 | 시각적 표시 |
|------|------------|
| 값 편집 중 (미확정) | `border-color: var(--warning)`, `color: var(--warning)` |
| Enter / blur | onUpdate 호출, dirty 상태 해제 |
| Escape | 원본값으로 복원, dirty 해제 |
| active 토글 | 슬라이드 스위치, `onUpdate(uuid, 'active', bool)` |

---

## 9. C-4: `NodeRenderer.tsx`

**경로**: `src/renderer/src/components/sidebar/SceneView/NodeRenderer.tsx`

### Props 인터페이스

```typescript
interface NodeRendererProps {
  node: SceneNode
  nodeMap: Map<string, SceneNode>
  view: ViewTransform
  selected: boolean
  hovered: boolean
  onMouseDown: (e: React.MouseEvent, uuid: string) => void
  onMouseEnter: (uuid: string) => void
  onMouseLeave: () => void
}
```

### 전체 구현 코드

```typescript
import React, { memo } from 'react'
import type { SceneNode, ViewTransform } from './types'
import { cocosToSvg, getComponentIcon } from './utils'

interface NodeRendererProps {
  node: SceneNode
  nodeMap: Map<string, SceneNode>
  view: ViewTransform
  selected: boolean
  hovered: boolean
  onMouseDown: (e: React.MouseEvent, uuid: string) => void
  onMouseEnter: (uuid: string) => void
  onMouseLeave: () => void
}

// 디자인 해상도 (씬 좌표 기준 — 추후 SceneViewPanel에서 주입할 것)
const DESIGN_W = 960
const DESIGN_H = 640

// 8방향 리사이즈 핸들 위치 (0~1 비율, 좌상단 기준)
const HANDLES = [
  { id: 'nw', rx: 0,   ry: 0   },
  { id: 'n',  rx: 0.5, ry: 0   },
  { id: 'ne', rx: 1,   ry: 0   },
  { id: 'e',  rx: 1,   ry: 0.5 },
  { id: 'se', rx: 1,   ry: 1   },
  { id: 's',  rx: 0.5, ry: 1   },
  { id: 'sw', rx: 0,   ry: 1   },
  { id: 'w',  rx: 0,   ry: 0.5 },
]

export const NodeRenderer = memo(function NodeRenderer({
  node,
  view,
  selected,
  hovered,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
}: NodeRendererProps) {
  // 씬 좌표 → SVG 좌표 변환
  const { sx, sy } = cocosToSvg(node.x, node.y, DESIGN_W, DESIGN_H)

  // 실제 픽셀 크기 (스케일 적용)
  const pw = node.width * Math.abs(node.scaleX)
  const ph = node.height * Math.abs(node.scaleY)

  // anchor 기준으로 좌상단 계산
  const rx = sx - pw * node.anchorX
  const ry = sy - ph * (1 - node.anchorY)  // Cocos Y 역전

  // 회전 중심 (anchor 점)
  const cx = sx
  const cy = sy

  const opacity = node.active ? (node.opacity / 255) : 0.3

  // 테두리 색상 결정
  const strokeColor = selected
    ? 'var(--accent)'
    : hovered
    ? 'rgba(0, 152, 255, 0.5)'
    : 'rgba(255, 255, 255, 0.25)'

  const strokeWidth = selected ? 1.5 : 1
  const strokeDash = node.active ? 'none' : '4 3'

  const icon = getComponentIcon(node.components)

  return (
    <g
      opacity={opacity}
      transform={`rotate(${-node.rotation} ${cx} ${cy})`}
      onMouseDown={e => onMouseDown(e, node.uuid)}
      onMouseEnter={() => onMouseEnter(node.uuid)}
      onMouseLeave={onMouseLeave}
      style={{ cursor: 'move' }}
    >
      {/* 노드 바디 */}
      <rect
        x={rx}
        y={ry}
        width={pw}
        height={ph}
        fill="rgba(255, 255, 255, 0.04)"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDash}
        rx={2}
      />

      {/* 라벨 */}
      {(pw > 20 && ph > 12) && (
        <text
          x={rx + 4}
          y={ry + 11}
          fontSize={9}
          fill="rgba(255, 255, 255, 0.7)"
          fontFamily="var(--font-mono)"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {icon ? `${icon} ` : ''}{node.name.length > 14 ? node.name.slice(0, 12) + '…' : node.name}
        </text>
      )}

      {/* 선택 핸들 (8개) */}
      {selected && HANDLES.map(h => {
        const hx = rx + pw * h.rx
        const hy = ry + ph * h.ry
        return (
          <g key={h.id}>
            <rect
              x={hx - 4}
              y={hy - 4}
              width={8}
              height={8}
              fill="var(--bg-secondary)"
              stroke="var(--accent)"
              strokeWidth={1}
              rx={1}
              style={{ cursor: `${h.id}-resize`, pointerEvents: 'all' }}
            />
          </g>
        )
      })}

      {/* 앵커 포인트 (선택 시) */}
      {selected && (
        <circle
          cx={cx}
          cy={cy}
          r={3}
          fill="var(--accent)"
          stroke="var(--bg-secondary)"
          strokeWidth={1}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </g>
  )
})
```

### 렌더링 세부 규칙

| 조건 | 스타일 |
|------|--------|
| 비활성 노드 (`active: false`) | `opacity: 0.3`, `strokeDasharray: "4 3"` |
| 선택된 노드 | 파란 테두리 + 8개 핸들 + 앵커 원 |
| 호버 상태 | 반투명 파란 테두리 |
| 라벨 | 너비 > 20px, 높이 > 12px 일 때만 표시 |
| 컴포넌트 아이콘 | 라벨 앞에 단일 문자 prefix |
| 회전 | `transform="rotate(-rotation cx cy)"` — Cocos 각도 반전 |

---

## 10. C-5: `SceneViewPanel.tsx` (메인)

**경로**: `src/renderer/src/components/sidebar/SceneView/SceneViewPanel.tsx`

### Props 인터페이스

```typescript
interface SceneViewPanelProps {
  connected: boolean
  wsKey: string  // 워크스페이스 key (remount용)
}
```

### 전체 구현 코드

```typescript
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { SceneNode, ViewTransform, DragState } from './types'
import { useSceneSync } from './useSceneSync'
import { NodeRenderer } from './NodeRenderer'
import { SceneToolbar } from './SceneToolbar'
import { SceneInspector } from './SceneInspector'
import { getRenderOrder } from './utils'

interface SceneViewPanelProps {
  connected: boolean
  wsKey: string
}

const DESIGN_W = 960
const DESIGN_H = 640
const SNAP_GRID = 4

export function SceneViewPanel({ connected }: SceneViewPanelProps) {
  // ── 씬 데이터 ──────────────────────────────────────────────
  const { nodeMap, rootUuid, loading, refresh, updateNode } = useSceneSync(connected)

  // ── 뷰 상태 ────────────────────────────────────────────────
  const [view, setView] = useState<ViewTransform>({ offsetX: 0, offsetY: 0, zoom: 1 })
  const [activeTool, setActiveTool] = useState<'select' | 'move'>('select')
  const [gridVisible, setGridVisible] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(false)

  // ── 선택 / 호버 상태 ───────────────────────────────────────
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null)
  const [hoveredUuid, setHoveredUuid] = useState<string | null>(null)

  // ── 드래그 상태 ────────────────────────────────────────────
  const dragRef = useRef<DragState | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  // ── SVG ref ────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Fit to view ────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFit = useCallback(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const padding = 32
    const zoomX = (width - padding * 2) / DESIGN_W
    const zoomY = (height - padding * 2) / DESIGN_H
    const zoom = Math.min(zoomX, zoomY, 2)
    const offsetX = (width - DESIGN_W * zoom) / 2
    const offsetY = (height - DESIGN_H * zoom) / 2
    setView({ offsetX, offsetY, zoom })
  }, [])

  // 최초 마운트 시 Fit
  useEffect(() => {
    if (rootUuid) handleFit()
  }, [rootUuid])

  // ── 단축키 ────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'v' || e.key === 'V') setActiveTool('select')
      if (e.key === 'w' || e.key === 'W') setActiveTool('move')
      if (e.key === 'f' || e.key === 'F') handleFit()
      if (e.key === 'Escape') setSelectedUuid(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleFit])

  // ── CC 이벤트: 외부 선택 동기화 ───────────────────────────
  useEffect(() => {
    const unsub = window.api.onCCEvent?.((event) => {
      if (event.type === 'node:select' && event.uuids?.[0]) {
        setSelectedUuid(event.uuids[0])
      }
      if (event.type === 'node:deselect') {
        setSelectedUuid(null)
      }
    })
    return () => unsub?.()
  }, [])

  // ── SVG 좌표 변환 헬퍼 ────────────────────────────────────
  const getSvgCoords = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top),
    }
  }, [])

  // 씬 좌표 변환 (SVG px → Cocos 좌표)
  const svgToScene = useCallback((svgX: number, svgY: number): { cx: number; cy: number } => {
    const sceneX = (svgX - view.offsetX) / view.zoom
    const sceneY = (svgY - view.offsetY) / view.zoom
    return {
      cx: sceneX - DESIGN_W / 2,
      cy: -(sceneY - DESIGN_H / 2),
    }
  }, [view])

  // ── 마우스 이벤트 ─────────────────────────────────────────
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    // 빈 영역 클릭 → 패닝 (middle btn 또는 space + left)
    if (e.button === 1 || (e.button === 0 && activeTool === 'move')) {
      isPanning.current = true
      panStart.current = {
        mx: e.clientX,
        my: e.clientY,
        ox: view.offsetX,
        oy: view.offsetY,
      }
      e.preventDefault()
      return
    }
    // 빈 배경 클릭 → 선택 해제
    if (e.button === 0) {
      setSelectedUuid(null)
    }
  }, [activeTool, view])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, uuid: string) => {
    e.stopPropagation()
    if (e.button !== 0) return
    setSelectedUuid(uuid)
    const node = nodeMap.get(uuid)
    if (!node) return

    const svgCoords = getSvgCoords(e)
    dragRef.current = {
      uuid,
      startSvgX: svgCoords.x,
      startSvgY: svgCoords.y,
      startNodeX: node.x,
      startNodeY: node.y,
    }
  }, [nodeMap, getSvgCoords])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // 패닝
    if (isPanning.current && panStart.current) {
      const dx = e.clientX - panStart.current.mx
      const dy = e.clientY - panStart.current.my
      setView(prev => ({
        ...prev,
        offsetX: panStart.current!.ox + dx,
        offsetY: panStart.current!.oy + dy,
      }))
      return
    }

    // 노드 드래그
    if (dragRef.current) {
      const drag = dragRef.current
      const svgCoords = getSvgCoords(e)
      const dsvgX = svgCoords.x - drag.startSvgX
      const dsvgY = svgCoords.y - drag.startSvgY

      // SVG 델타 → 씬 좌표 델타
      const dSceneX = dsvgX / view.zoom
      const dSceneY = -dsvgY / view.zoom  // Y축 반전

      let newX = drag.startNodeX + dSceneX
      let newY = drag.startNodeY + dSceneY

      // 스냅
      if (snapEnabled) {
        newX = Math.round(newX / SNAP_GRID) * SNAP_GRID
        newY = Math.round(newY / SNAP_GRID) * SNAP_GRID
      }

      // 낙관적 업데이트 (즉시 반영)
      updateNode(drag.uuid, { x: newX, y: newY })
    }
  }, [view.zoom, snapEnabled, getSvgCoords, updateNode])

  const handleMouseUp = useCallback(async () => {
    // 패닝 종료
    if (isPanning.current) {
      isPanning.current = false
      panStart.current = null
      return
    }

    // 드래그 종료 → IPC 전송
    if (dragRef.current) {
      const drag = dragRef.current
      const node = nodeMap.get(drag.uuid)
      if (node) {
        try {
          await window.api.ccSetProperty?.(drag.uuid, 'x', node.x)
          await window.api.ccSetProperty?.(drag.uuid, 'y', node.y)
        } catch (e) {
          console.error('[SceneView] setProperty failed:', e)
        }
      }
      dragRef.current = null
    }
  }, [nodeMap])

  // ── 줌 (wheel) ─────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const svgCoords = getSvgCoords(e as unknown as React.MouseEvent)
    setView(prev => {
      const newZoom = Math.min(8, Math.max(0.1, prev.zoom * factor))
      // 마우스 위치 기준 줌
      const newOffsetX = svgCoords.x - (svgCoords.x - prev.offsetX) * (newZoom / prev.zoom)
      const newOffsetY = svgCoords.y - (svgCoords.y - prev.offsetY) * (newZoom / prev.zoom)
      return { zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY }
    })
  }, [getSvgCoords])

  // ── Inspector 업데이트 ─────────────────────────────────────
  const handleInspectorUpdate = useCallback(async (uuid: string, prop: string, value: number | boolean) => {
    updateNode(uuid, { [prop]: value } as Partial<SceneNode>)
    try {
      await window.api.ccSetProperty?.(uuid, prop, value)
    } catch (e) {
      console.error('[SceneView] inspector update failed:', e)
    }
  }, [updateNode])

  // ── 렌더 순서 ────────────────────────────────────────────
  const renderOrder = useMemo(() => {
    if (!rootUuid) return []
    return getRenderOrder(rootUuid, nodeMap)
  }, [rootUuid, nodeMap])

  const selectedNode = selectedUuid ? nodeMap.get(selectedUuid) ?? null : null

  // ── SVG viewBox ─────────────────────────────────────────
  // 고정 viewBox를 사용하지 않고 offsetX/Y + zoom을 transform으로 처리
  const sceneTransform = `translate(${view.offsetX} ${view.offsetY}) scale(${view.zoom})`

  // ── 그리드 패턴 크기 (줌에 따라 조정) ─────────────────────
  const gridStep = 50  // 씬 좌표 50px 간격

  if (!connected) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 11,
        }}
      >
        연결되지 않음
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}
    >
      {/* 툴바 */}
      <SceneToolbar
        activeTool={activeTool}
        zoom={view.zoom}
        gridVisible={gridVisible}
        snapEnabled={snapEnabled}
        onToolChange={setActiveTool}
        onZoomChange={zoom => setView(prev => ({ ...prev, zoom }))}
        onGridToggle={() => setGridVisible(v => !v)}
        onSnapToggle={() => setSnapEnabled(v => !v)}
        onFit={handleFit}
        onRefresh={refresh}
      />

      {/* SVG 뷰포트 */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: activeTool === 'move' ? 'grab' : 'default',
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ display: 'block', userSelect: 'none' }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <defs>
            {/* 체크패턴 배경 */}
            <pattern
              id="checker"
              x="0"
              y="0"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <rect width="8" height="8" fill="#242424" />
              <rect x="8" y="0" width="8" height="8" fill="#1e1e1e" />
              <rect x="0" y="8" width="8" height="8" fill="#1e1e1e" />
              <rect x="8" y="8" width="8" height="8" fill="#242424" />
            </pattern>

            {/* 그리드 패턴 */}
            {gridVisible && (
              <pattern
                id="grid"
                x={view.offsetX % (gridStep * view.zoom)}
                y={view.offsetY % (gridStep * view.zoom)}
                width={gridStep * view.zoom}
                height={gridStep * view.zoom}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${gridStep * view.zoom} 0 L 0 0 0 ${gridStep * view.zoom}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                />
              </pattern>
            )}
          </defs>

          {/* 배경 */}
          <rect width="100%" height="100%" fill="url(#checker)" />
          {gridVisible && <rect width="100%" height="100%" fill="url(#grid)" />}

          {/* 씬 그룹 */}
          <g transform={sceneTransform}>
            {/* 씬 경계 */}
            <rect
              x={0}
              y={0}
              width={DESIGN_W}
              height={DESIGN_H}
              fill="rgba(0,0,0,0.6)"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              rx={1}
            />

            {/* 원점 십자 */}
            <line
              x1={DESIGN_W / 2 - 10} y1={DESIGN_H / 2}
              x2={DESIGN_W / 2 + 10} y2={DESIGN_H / 2}
              stroke="rgba(255,255,255,0.2)" strokeWidth={1}
            />
            <line
              x1={DESIGN_W / 2} y1={DESIGN_H / 2 - 10}
              x2={DESIGN_W / 2} y2={DESIGN_H / 2 + 10}
              stroke="rgba(255,255,255,0.2)" strokeWidth={1}
            />

            {/* 노드 렌더링 */}
            {renderOrder.map(uuid => {
              const node = nodeMap.get(uuid)
              if (!node) return null
              return (
                <NodeRenderer
                  key={uuid}
                  node={node}
                  nodeMap={nodeMap}
                  view={view}
                  selected={selectedUuid === uuid}
                  hovered={hoveredUuid === uuid}
                  onMouseDown={handleNodeMouseDown}
                  onMouseEnter={setHoveredUuid}
                  onMouseLeave={() => setHoveredUuid(null)}
                />
              )
            })}
          </g>
        </svg>

        {/* 로딩 오버레이 */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)',
              color: 'var(--text-muted)',
              fontSize: 11,
              pointerEvents: 'none',
            }}
          >
            씬 로딩 중...
          </div>
        )}

        {/* 줌 레벨 표시 */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            right: 8,
            fontSize: 9,
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.5)',
            padding: '1px 5px',
            borderRadius: 3,
            pointerEvents: 'none',
          }}
        >
          {Math.round(view.zoom * 100)}%
        </div>
      </div>

      {/* Inspector */}
      <SceneInspector
        node={selectedNode}
        onUpdate={handleInspectorUpdate}
        onClose={() => setSelectedUuid(null)}
      />
    </div>
  )
}
```

### 드래그 흐름 상세

```
mousedown (노드)
  └─ dragRef.current = { uuid, startSvgX, startSvgY, startNodeX, startNodeY }
  └─ setSelectedUuid(uuid)

mousemove
  └─ dsvg = current - start (SVG px)
  └─ dScene = dsvg / zoom   (씬 단위, Y 반전)
  └─ newX = startNodeX + dSceneX
  └─ newY = startNodeY + dSceneY
  └─ if snapEnabled: round to SNAP_GRID(4)
  └─ updateNode(uuid, { x: newX, y: newY })  ← 낙관적 업데이트

mouseup
  └─ ccSetProperty(uuid, 'x', node.x)
  └─ ccSetProperty(uuid, 'y', node.y)
  └─ dragRef.current = null
```

---

## 11. 파일 목록 요약

```
src/renderer/src/components/sidebar/SceneView/
├── index.ts              C-1  export barrel
├── types.ts                   SceneNode, ViewTransform, DragState
├── utils.ts                   flattenTree, getRenderOrder, cocosToSvg, svgToCocos, getComponentIcon
├── useSceneSync.ts            씬 데이터 로드 + 이벤트 훅
├── SceneToolbar.tsx      C-2  도구/줌/그리드/스냅 툴바
├── SceneInspector.tsx    C-3  수치 편집 인스펙터
├── NodeRenderer.tsx      C-4  SVG 단일 노드 렌더러
└── SceneViewPanel.tsx    C-5  메인 패널 (SVG 뷰포트 통합)
```

---

## 12. CocosPanel 통합 방안

`CocosPanel.tsx`에서 탭 UI 또는 토글 방식으로 SceneViewPanel 추가:

```typescript
// CocosPanel.tsx 내 connected 분기 내부
import { SceneViewPanel } from './SceneView'

// 탭 상태 추가
const [activeTab, setActiveTab] = useState<'tree' | 'scene'>('tree')

// 탭 헤더 렌더링 (connected 블록 상단)
<div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
  {(['tree', 'scene'] as const).map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      style={{
        flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600,
        background: activeTab === tab ? 'var(--accent-dim)' : 'none',
        color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
        border: 'none', borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      {tab === 'tree' ? '트리' : '씬뷰'}
    </button>
  ))}
</div>

// 탭 콘텐츠
{activeTab === 'tree' ? (
  <>
    <SceneTreePanel onSelectNode={...} />
    {selectedNode && <NodePropertyPanel node={selectedNode} onUpdate={() => {}} />}
  </>
) : (
  <SceneViewPanel connected={connected} wsKey={currentPath ?? ''} />
)}
```

---

## 13. 구현 우선순위

| 단계 | 작업 | 비고 |
|------|------|------|
| 1 | `types.ts` + `utils.ts` 작성 | 의존성 없음 |
| 2 | `useSceneSync.ts` | types + CCNode ipc 의존 |
| 3 | `NodeRenderer.tsx` | types + utils 의존 |
| 4 | `SceneToolbar.tsx` | 독립 |
| 5 | `SceneInspector.tsx` | types 의존 |
| 6 | `SceneViewPanel.tsx` | 모든 컴포넌트 통합 |
| 7 | `index.ts` | export barrel |
| 8 | `CocosPanel.tsx` 탭 통합 | 선택적 |

---

## 14. 주의사항 및 알려진 제약

1. **DESIGN_W / DESIGN_H**: 현재 960×640 하드코딩. 향후 `ccGetSceneSize()` IPC 추가 후 동적으로 받아야 함.

2. **NodeRenderer에서의 부모 좌표**: 현재 구현은 각 노드의 `position`을 월드 좌표로 가정함. CC2.x는 로컬 좌표를 반환하므로, `ccGetTree` 응답이 월드 좌표인지 로컬 좌표인지 Extension 쪽에서 확인 필요.

3. **ccSetProperty 키 이름**: `x`, `y`가 실제 Extension에서 허용하는 키인지 확인 필요. `NodePropertyPanel.tsx`에서는 `save('x', v)` 형태로 이미 사용 중이므로 동일하게 처리 가능.

4. **성능**: `useMemo`로 `renderOrder`를 캐싱하고 `NodeRenderer`를 `memo`로 래핑하여 불필요한 리렌더 방지. 씬에 노드가 200개 이상이면 virtualizing 검토 필요.

5. **라이트 테마**: CSS 변수를 사용하므로 `data-theme="light"` 자동 대응됨.
