/**
 * preset plugin 순수 로직 테스트
 * localStorage 기반 프리셋 저장/불러오기/삭제 로직 검증
 */
import { describe, it, expect, beforeEach } from 'vitest'

// ── 타입 정의 (preset.tsx에서 복제) ─────────────────────────────────────────

interface PresetActions {
  opacity?: number
  width?: number
  height?: number
  posX?: number
  posY?: number
  rotation?: number
  active?: boolean
  scaleX?: number
  scaleY?: number
}

interface ActionPreset {
  id: string
  name: string
  actions: PresetActions
}

const STORAGE_KEY = 'cc-batch-presets'

// ── 순수 로직 복제 ───────────────────────────────────────────────────────────

function loadPresets(): ActionPreset[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function savePresetsToStorage(presets: ActionPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

function savePreset(presets: ActionPreset[], name: string, actions: PresetActions): ActionPreset[] | null {
  if (!name.trim()) return null
  if (Object.keys(actions).length === 0) return null
  const newPreset: ActionPreset = { id: `p${Date.now()}`, name: name.trim(), actions }
  const updated = [...presets, newPreset]
  savePresetsToStorage(updated)
  return updated
}

function deletePreset(presets: ActionPreset[], id: string): ActionPreset[] {
  const updated = presets.filter(p => p.id !== id)
  savePresetsToStorage(updated)
  return updated
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('loadPresets — localStorage 기반 영속', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('localStorage가 비어 있으면 빈 배열 반환', () => {
    expect(loadPresets()).toEqual([])
  })

  it('저장된 프리셋을 불러온다', () => {
    const presets: ActionPreset[] = [
      { id: 'p1', name: 'test', actions: { opacity: 128 } },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
    expect(loadPresets()).toEqual(presets)
  })

  it('localStorage에 잘못된 JSON이 있으면 빈 배열 반환', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-json{{}')
    expect(loadPresets()).toEqual([])
  })

  it('여러 프리셋을 순서대로 불러온다', () => {
    const presets: ActionPreset[] = [
      { id: 'p1', name: 'A', actions: { opacity: 100 } },
      { id: 'p2', name: 'B', actions: { width: 200 } },
      { id: 'p3', name: 'C', actions: { active: false } },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
    const loaded = loadPresets()
    expect(loaded).toHaveLength(3)
    expect(loaded[0].name).toBe('A')
    expect(loaded[2].name).toBe('C')
  })
})

describe('savePresetsToStorage — 저장', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('프리셋 배열을 localStorage에 직렬화하여 저장한다', () => {
    const presets: ActionPreset[] = [{ id: 'p1', name: 'test', actions: { opacity: 255 } }]
    savePresetsToStorage(presets)
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual(presets)
  })

  it('빈 배열을 저장하면 "[]"가 저장된다', () => {
    savePresetsToStorage([])
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]')
  })

  it('다양한 actions 필드를 가진 프리셋을 저장/복원한다', () => {
    const presets: ActionPreset[] = [{
      id: 'p2',
      name: 'full',
      actions: {
        opacity: 200, width: 100, height: 50,
        posX: 10, posY: -20, rotation: 45,
        active: true, scaleX: 1.5, scaleY: 2,
      },
    }]
    savePresetsToStorage(presets)
    expect(loadPresets()[0].actions).toEqual(presets[0].actions)
  })
})

describe('savePreset — 신규 프리셋 생성', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('이름과 액션이 있으면 프리셋 목록에 추가된다', () => {
    const result = savePreset([], 'myPreset', { opacity: 100 })
    expect(result).not.toBeNull()
    expect(result!).toHaveLength(1)
    expect(result![0].name).toBe('myPreset')
    expect(result![0].actions.opacity).toBe(100)
  })

  it('이름이 빈 문자열이면 null 반환', () => {
    expect(savePreset([], '', { opacity: 100 })).toBeNull()
  })

  it('이름이 공백만이면 null 반환', () => {
    expect(savePreset([], '   ', { opacity: 100 })).toBeNull()
  })

  it('actions가 비어 있으면 null 반환', () => {
    expect(savePreset([], 'myPreset', {})).toBeNull()
  })

  it('저장 후 localStorage에서 불러오면 동일 데이터', () => {
    savePreset([], 'p1', { width: 300 })
    const loaded = loadPresets()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].actions.width).toBe(300)
  })

  it('기존 프리셋 목록에 이어서 추가된다', () => {
    const existing: ActionPreset[] = [{ id: 'p1', name: 'first', actions: { opacity: 50 } }]
    const result = savePreset(existing, 'second', { height: 200 })
    expect(result!).toHaveLength(2)
    expect(result![1].name).toBe('second')
  })

  it('이름 앞뒤 공백을 trim하여 저장한다', () => {
    const result = savePreset([], '  trimmed  ', { scaleX: 2 })
    expect(result![0].name).toBe('trimmed')
  })
})

describe('deletePreset — 삭제', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('id가 일치하는 프리셋을 삭제한다', () => {
    const presets: ActionPreset[] = [
      { id: 'p1', name: 'A', actions: { opacity: 100 } },
      { id: 'p2', name: 'B', actions: { width: 200 } },
    ]
    const result = deletePreset(presets, 'p1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p2')
  })

  it('존재하지 않는 id 삭제 시 목록 변화 없음', () => {
    const presets: ActionPreset[] = [{ id: 'p1', name: 'A', actions: { opacity: 100 } }]
    const result = deletePreset(presets, 'not-exist')
    expect(result).toHaveLength(1)
  })

  it('삭제 후 localStorage에 반영된다', () => {
    const presets: ActionPreset[] = [
      { id: 'p1', name: 'A', actions: { opacity: 100 } },
      { id: 'p2', name: 'B', actions: { width: 200 } },
    ]
    deletePreset(presets, 'p2')
    const loaded = loadPresets()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('p1')
  })

  it('모든 프리셋 삭제 후 빈 배열이 저장된다', () => {
    const presets: ActionPreset[] = [{ id: 'p1', name: 'A', actions: { opacity: 100 } }]
    deletePreset(presets, 'p1')
    expect(loadPresets()).toEqual([])
  })
})
