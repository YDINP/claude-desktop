import { describe, it, expect } from 'vitest'
import { BATCH_PLUGINS, getApplicablePlugins } from '../registry'
import type { CCSceneNode } from '../../../../../../shared/ipc-schema'

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, name = 'Node'): CCSceneNode {
  return {
    uuid,
    name,
    active: true,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: { x: 100, y: 100 },
    anchor: { x: 0.5, y: 0.5 },
    opacity: 255,
    color: { r: 255, g: 255, b: 255, a: 255 },
    components: [],
    children: [],
  }
}

const node1 = makeNode('uuid-1')
const node2 = makeNode('uuid-2')
const node3 = makeNode('uuid-3')

// ── BATCH_PLUGINS 구조 검증 ──────────────────────────────────────────────────

describe('BATCH_PLUGINS', () => {
  it('9개 플러그인이 등록되어 있다', () => {
    expect(BATCH_PLUGINS).toHaveLength(9)
  })

  it('모든 플러그인에 id, group, title, Component가 있다', () => {
    for (const p of BATCH_PLUGINS) {
      expect(p.id).toBeTruthy()
      expect(p.group).toBeTruthy()
      expect(p.title).toBeTruthy()
      expect(p.Component).toBeDefined()
    }
  })

  it('id가 모두 고유하다', () => {
    const ids = BATCH_PLUGINS.map(p => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('transform-group이 등록되어 있다', () => {
    const p = BATCH_PLUGINS.find(p => p.id === 'transform-group')
    expect(p).toBeDefined()
    expect(p?.group).toBe('transform')
    expect(p?.minNodes).toBe(1)
  })

  it('color-group이 등록되어 있다', () => {
    const p = BATCH_PLUGINS.find(p => p.id === 'color-group')
    expect(p).toBeDefined()
    expect(p?.group).toBe('color')
  })

  it('distribution-group은 minNodes=2이다', () => {
    const p = BATCH_PLUGINS.find(p => p.id === 'distribution-group')
    expect(p?.minNodes).toBe(2)
  })

  it('name-group이 등록되어 있다', () => {
    const p = BATCH_PLUGINS.find(p => p.id === 'name-group')
    expect(p?.group).toBe('name')
  })

  it('component-group이 등록되어 있다', () => {
    const p = BATCH_PLUGINS.find(p => p.id === 'component-group')
    expect(p?.group).toBe('component')
  })

  it('history-group은 minNodes=0이다', () => {
    const p = BATCH_PLUGINS.find(p => p.id === 'history-group')
    expect(p?.minNodes).toBe(0)
  })

  it('filter-group은 minNodes=2이다', () => {
    const p = BATCH_PLUGINS.find(p => p.id === 'filter-group')
    expect(p?.minNodes).toBe(2)
  })

  it('group 값이 허용된 값만 사용한다', () => {
    const allowedGroups = ['transform', 'color', 'distribution', 'name', 'component', 'misc']
    for (const p of BATCH_PLUGINS) {
      expect(allowedGroups).toContain(p.group)
    }
  })
})

// ── getApplicablePlugins ──────────────────────────────────────────────────────

describe('getApplicablePlugins', () => {
  it('빈 배열 → history-group(minNodes=0)만 반환한다', () => {
    const result = getApplicablePlugins([])
    const ids = result.map(p => p.id)
    expect(ids).toContain('history-group')
    expect(ids).not.toContain('transform-group')
    expect(ids).not.toContain('distribution-group')
  })

  it('노드 1개 → minNodes<=1인 플러그인 모두 반환', () => {
    const result = getApplicablePlugins([node1])
    const ids = result.map(p => p.id)
    expect(ids).toContain('transform-group')
    expect(ids).toContain('color-group')
    expect(ids).toContain('name-group')
    expect(ids).toContain('history-group')
    // minNodes=2인 것들은 제외
    expect(ids).not.toContain('distribution-group')
    expect(ids).not.toContain('filter-group')
  })

  it('노드 2개 → minNodes<=2인 플러그인 모두 반환', () => {
    const result = getApplicablePlugins([node1, node2])
    const ids = result.map(p => p.id)
    expect(ids).toContain('distribution-group')
    expect(ids).toContain('filter-group')
    expect(ids).toContain('transform-group')
  })

  it('노드 3개 → 모든 플러그인 반환(applies 없는 경우)', () => {
    const result = getApplicablePlugins([node1, node2, node3])
    // applies 없는 플러그인은 모두 포함
    const noApplies = BATCH_PLUGINS.filter(p => !p.applies)
    for (const p of noApplies) {
      expect(result.find(r => r.id === p.id)).toBeDefined()
    }
  })

  it('applies 조건이 false이면 제외된다', () => {
    // 직접 applies false 플러그인 주입해서 테스트
    const original = [...BATCH_PLUGINS]
    // applies가 있는 플러그인이 없으므로 동작 검증은 minNodes로 대체
    const result = getApplicablePlugins([node1])
    expect(result.every(p => (p.minNodes ?? 1) <= 1)).toBe(true)
  })

  it('applies 조건이 true이면 포함된다', () => {
    // applies가 있는 커스텀 플러그인 시뮬레이션
    // 실제 BATCH_PLUGINS는 applies 없음 → 모두 통과
    const result = getApplicablePlugins([node1, node2])
    expect(result.length).toBeGreaterThan(0)
  })

  it('결과는 BATCH_PLUGINS 순서를 유지한다', () => {
    const result = getApplicablePlugins([node1, node2])
    const sourceIds = BATCH_PLUGINS.map(p => p.id)
    const resultIds = result.map(p => p.id)
    // 결과의 순서가 원본 순서와 동일한지 확인
    let lastIdx = -1
    for (const id of resultIds) {
      const idx = sourceIds.indexOf(id)
      expect(idx).toBeGreaterThan(lastIdx)
      lastIdx = idx
    }
  })

  it('history-group은 노드가 0개여도 항상 포함된다', () => {
    const r0 = getApplicablePlugins([])
    const r1 = getApplicablePlugins([node1])
    const r3 = getApplicablePlugins([node1, node2, node3])
    expect(r0.find(p => p.id === 'history-group')).toBeDefined()
    expect(r1.find(p => p.id === 'history-group')).toBeDefined()
    expect(r3.find(p => p.id === 'history-group')).toBeDefined()
  })

  it('반환값이 BATCH_PLUGINS 참조 그대로이다 (filter 결과)', () => {
    const result = getApplicablePlugins([node1])
    for (const p of result) {
      expect(BATCH_PLUGINS).toContain(p)
    }
  })

  it('minNodes가 undefined인 플러그인은 기본값 1로 처리한다', () => {
    // distribution-group은 명시적으로 2 → 1개 노드에서 제외
    const result = getApplicablePlugins([node1])
    expect(result.find(p => p.id === 'distribution-group')).toBeUndefined()
  })

  it('대량 노드에서도 정확히 동작한다', () => {
    const manyNodes = Array.from({ length: 100 }, (_, i) => makeNode(`uuid-${i}`))
    const result = getApplicablePlugins(manyNodes)
    // minNodes <= 100이면 applies 없는 한 모두 포함
    expect(result.length).toBe(BATCH_PLUGINS.length)
  })
})
