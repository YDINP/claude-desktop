/**
 * name plugin 순수 로직 테스트
 * NamePlugin 컴포넌트 내부 이름 조작 로직을 순수 함수로 재현하여 검증
 */
import { describe, it, expect } from 'vitest'
import type { CCSceneNode } from '../../../../../../shared/ipc-schema'

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeNode(uuid: string, overrides: Partial<CCSceneNode> = {}): CCSceneNode {
  return {
    uuid,
    name: uuid,
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
    ...overrides,
  }
}

// ── 접두사/접미사 추가 로직 (R2642) ──────────────────────────────────────────

function applyNamePatch(node: CCSceneNode, prefix: string, suffix: string): CCSceneNode {
  return { ...node, name: `${prefix}${node.name}${suffix}` }
}

// ── 문자열 find/replace 로직 (R2671) ─────────────────────────────────────────

function applyFindReplace(node: CCSceneNode, find: string, replace: string): CCSceneNode {
  return { ...node, name: node.name.split(find).join(replace) }
}

// ── 공백 정리 로직 (R2669) ────────────────────────────────────────────────────

function applyNameTrim(node: CCSceneNode): CCSceneNode {
  return { ...node, name: node.name.trim().replace(/\s+/g, ' ') }
}

// ── 대소문자 변환 로직 (R2667) ────────────────────────────────────────────────

function toTitle(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function applyNameCase(node: CCSceneNode, mode: 'upper' | 'lower' | 'title'): CCSceneNode {
  const newName =
    mode === 'upper' ? node.name.toUpperCase() :
    mode === 'lower' ? node.name.toLowerCase() :
    toTitle(node.name)
  return { ...node, name: newName }
}

// ── 정규식 교체 로직 (R1778 / R2716) ─────────────────────────────────────────

function applyRegexReplace(node: CCSceneNode, pattern: string, repl: string): CCSceneNode {
  try {
    const re = new RegExp(pattern, 'g')
    return { ...node, name: node.name.replace(re, repl) }
  } catch {
    return node
  }
}

// ── 일련번호 치환 로직 (R2650) ────────────────────────────────────────────────

function applySerialNames(nodes: CCSceneNode[], base: string, start: number): CCSceneNode[] {
  return nodes.map((n, i) => ({ ...n, name: `${base}${start + i}` }))
}

// ── 번호 붙이기 로직 (R2504 append 모드) ─────────────────────────────────────

function applySerialAppend(nodes: CCSceneNode[]): CCSceneNode[] {
  return nodes.map((n, i) => {
    const pad = String(i + 1).padStart(2, '0')
    return { ...n, name: `${n.name}_${pad}` }
  })
}

// ── 번호 교체 로직 (R2504 replace 모드) ──────────────────────────────────────

function applySerialReplace(nodes: CCSceneNode[]): CCSceneNode[] {
  return nodes.map((n, i) => {
    const pad = String(i + 1).padStart(2, '0')
    const base = n.name.replace(/_\d+$/, '')
    return { ...n, name: `${base}_${pad}` }
  })
}

// ── 번호 제거 로직 (R2504 strip) ──────────────────────────────────────────────

function applySerialStrip(node: CCSceneNode): CCSceneNode {
  return { ...node, name: node.name.replace(/_\d+$/, '') }
}

// ── 이름 알파벳순 정렬 로직 (R2648) ──────────────────────────────────────────

function sortNodesByName(nodes: CCSceneNode[], dir: 'asc' | 'desc'): CCSceneNode[] {
  return [...nodes].sort((a, b) =>
    dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('접두사/접미사 추가 (R2642)', () => {
  it('prefix 추가', () => {
    const node = makeNode('n', { name: 'hero' })
    expect(applyNamePatch(node, 'btn_', '').name).toBe('btn_hero')
  })

  it('suffix 추가', () => {
    const node = makeNode('n', { name: 'hero' })
    expect(applyNamePatch(node, '', '_node').name).toBe('hero_node')
  })

  it('prefix + suffix 동시 추가', () => {
    const node = makeNode('n', { name: 'hero' })
    expect(applyNamePatch(node, 'pre_', '_suf').name).toBe('pre_hero_suf')
  })

  it('둘 다 빈 문자열이면 이름 불변', () => {
    const node = makeNode('n', { name: 'hero' })
    expect(applyNamePatch(node, '', '').name).toBe('hero')
  })
})

describe('문자열 찾아 치환 (R2671)', () => {
  it('단순 치환', () => {
    const node = makeNode('n', { name: 'btn_hero' })
    expect(applyFindReplace(node, 'btn_', 'img_').name).toBe('img_hero')
  })

  it('여러 번 등장하는 문자열 전체 치환', () => {
    const node = makeNode('n', { name: 'aa_aa' })
    expect(applyFindReplace(node, 'aa', 'bb').name).toBe('bb_bb')
  })

  it('일치 없으면 이름 불변', () => {
    const node = makeNode('n', { name: 'hero' })
    expect(applyFindReplace(node, 'xyz', 'abc').name).toBe('hero')
  })

  it('replace를 빈 문자열로 — 삭제 효과', () => {
    const node = makeNode('n', { name: 'btn_hero' })
    expect(applyFindReplace(node, 'btn_', '').name).toBe('hero')
  })
})

describe('공백 정리 (R2669)', () => {
  it('앞뒤 공백 제거', () => {
    const node = makeNode('n', { name: '  hero  ' })
    expect(applyNameTrim(node).name).toBe('hero')
  })

  it('연속 공백 → 단일 공백', () => {
    const node = makeNode('n', { name: 'hello   world' })
    expect(applyNameTrim(node).name).toBe('hello world')
  })

  it('앞뒤 + 연속 공백 복합', () => {
    const node = makeNode('n', { name: '  a   b  ' })
    expect(applyNameTrim(node).name).toBe('a b')
  })

  it('공백 없으면 이름 불변', () => {
    const node = makeNode('n', { name: 'hero' })
    expect(applyNameTrim(node).name).toBe('hero')
  })
})

describe('대소문자 변환 (R2667)', () => {
  it('upper: 모두 대문자', () => {
    const node = makeNode('n', { name: 'hello World' })
    expect(applyNameCase(node, 'upper').name).toBe('HELLO WORLD')
  })

  it('lower: 모두 소문자', () => {
    const node = makeNode('n', { name: 'HELLO WORLD' })
    expect(applyNameCase(node, 'lower').name).toBe('hello world')
  })

  it('title: 단어 첫 글자 대문자', () => {
    const node = makeNode('n', { name: 'hello world' })
    expect(applyNameCase(node, 'title').name).toBe('Hello World')
  })

  it('이미 대문자이면 upper 후에도 동일', () => {
    const node = makeNode('n', { name: 'ABC' })
    expect(applyNameCase(node, 'upper').name).toBe('ABC')
  })
})

describe('정규식 교체 (R1778 / R2716)', () => {
  it('패턴으로 일치하는 부분 치환', () => {
    const node = makeNode('n', { name: 'node_01' })
    expect(applyRegexReplace(node, '_\\d+', '').name).toBe('node')
  })

  it('전역 치환 (g 플래그)', () => {
    const node = makeNode('n', { name: 'aa_bb_aa' })
    expect(applyRegexReplace(node, 'aa', 'cc').name).toBe('cc_bb_cc')
  })

  it('잘못된 정규식이면 이름 불변', () => {
    const node = makeNode('n', { name: 'hero' })
    expect(applyRegexReplace(node, '[invalid', 'x').name).toBe('hero')
  })

  it('일치 없으면 이름 불변', () => {
    const node = makeNode('n', { name: 'hero' })
    expect(applyRegexReplace(node, '\\d+', 'X').name).toBe('hero')
  })
})

describe('일련번호 치환 (R2650)', () => {
  it('base + start 번호로 이름 대체', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const result = applySerialNames(nodes, 'node', 1)
    expect(result.map(n => n.name)).toEqual(['node1', 'node2', 'node3'])
  })

  it('start 번호 0 시작', () => {
    const nodes = [makeNode('a'), makeNode('b')]
    const result = applySerialNames(nodes, 'item', 0)
    expect(result.map(n => n.name)).toEqual(['item0', 'item1'])
  })

  it('base가 빈 문자열이면 숫자만', () => {
    const nodes = [makeNode('a'), makeNode('b')]
    const result = applySerialNames(nodes, '', 5)
    expect(result.map(n => n.name)).toEqual(['5', '6'])
  })
})

describe('이름 번호 붙이기 (R2504)', () => {
  it('append: 이름 뒤에 _01, _02 추가', () => {
    const nodes = [makeNode('a', { name: 'hero' }), makeNode('b', { name: 'hero' })]
    const result = applySerialAppend(nodes)
    expect(result.map(n => n.name)).toEqual(['hero_01', 'hero_02'])
  })

  it('replace: 기존 _숫자 제거 후 새 번호 부여', () => {
    const nodes = [
      makeNode('a', { name: 'hero_99' }),
      makeNode('b', { name: 'hero_01' }),
    ]
    const result = applySerialReplace(nodes)
    expect(result.map(n => n.name)).toEqual(['hero_01', 'hero_02'])
  })

  it('strip: 이름 끝의 _숫자 제거', () => {
    const node = makeNode('a', { name: 'hero_03' })
    expect(applySerialStrip(node).name).toBe('hero')
  })

  it('strip: _숫자 없으면 이름 불변', () => {
    const node = makeNode('a', { name: 'hero' })
    expect(applySerialStrip(node).name).toBe('hero')
  })

  it('strip: 중간 _숫자는 제거하지 않음', () => {
    const node = makeNode('a', { name: 'hero_01_item' })
    expect(applySerialStrip(node).name).toBe('hero_01_item')
  })
})

describe('이름 알파벳순 정렬 (R2648)', () => {
  it('asc: A→Z 정렬', () => {
    const nodes = [
      makeNode('c', { name: 'cat' }),
      makeNode('a', { name: 'apple' }),
      makeNode('b', { name: 'banana' }),
    ]
    const result = sortNodesByName(nodes, 'asc')
    expect(result.map(n => n.name)).toEqual(['apple', 'banana', 'cat'])
  })

  it('desc: Z→A 정렬', () => {
    const nodes = [
      makeNode('a', { name: 'apple' }),
      makeNode('c', { name: 'cat' }),
      makeNode('b', { name: 'banana' }),
    ]
    const result = sortNodesByName(nodes, 'desc')
    expect(result.map(n => n.name)).toEqual(['cat', 'banana', 'apple'])
  })

  it('원본 배열 불변 (순수 함수)', () => {
    const nodes = [makeNode('b', { name: 'b' }), makeNode('a', { name: 'a' })]
    const original = nodes.map(n => n.name)
    sortNodesByName(nodes, 'asc')
    expect(nodes.map(n => n.name)).toEqual(original)
  })
})
