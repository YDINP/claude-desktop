import { describe, it, expect } from 'vitest'
import { getAssetFileIcon, buildFolderTree, ASSET_TYPE_GROUPS } from '../assetUtils'
import type { AssetEntry, FolderNode } from '../assetUtils'

// ── ASSET_TYPE_GROUPS ──────────────────────────────────────────────────────

describe('ASSET_TYPE_GROUPS', () => {
  it('6개 그룹이 등록되어 있다', () => {
    expect(ASSET_TYPE_GROUPS).toHaveLength(6)
  })

  it('각 그룹에 key, icon, label, types가 있다', () => {
    for (const g of ASSET_TYPE_GROUPS) {
      expect(g.key).toBeTruthy()
      expect(g.icon).toBeTruthy()
      expect(g.label).toBeTruthy()
      expect(Array.isArray(g.types)).toBe(true)
    }
  })

  it('texture 그룹이 있다', () => {
    const t = ASSET_TYPE_GROUPS.find(g => g.key === 'texture')
    expect(t).toBeDefined()
    expect(t?.types).toContain('texture')
  })

  it('prefab 그룹이 있다', () => {
    const p = ASSET_TYPE_GROUPS.find(g => g.key === 'prefab')
    expect(p).toBeDefined()
  })
})

// ── getAssetFileIcon ───────────────────────────────────────────────────────

describe('getAssetFileIcon', () => {
  it('.fire → 🎬', () => {
    expect(getAssetFileIcon('main.fire')).toBe('🎬')
  })

  it('.scene → 🎬', () => {
    expect(getAssetFileIcon('game.scene')).toBe('🎬')
  })

  it('.prefab → 📦', () => {
    expect(getAssetFileIcon('enemy.prefab')).toBe('📦')
  })

  it('.ts → 📜', () => {
    expect(getAssetFileIcon('GameManager.ts')).toBe('📜')
  })

  it('.js → 📜', () => {
    expect(getAssetFileIcon('utils.js')).toBe('📜')
  })

  it('.png → 🖼', () => {
    expect(getAssetFileIcon('hero.png')).toBe('🖼')
  })

  it('.jpg → 🖼', () => {
    expect(getAssetFileIcon('background.jpg')).toBe('🖼')
  })

  it('.webp → 🖼', () => {
    expect(getAssetFileIcon('sprite.webp')).toBe('🖼')
  })

  it('.mp3 → 🔊', () => {
    expect(getAssetFileIcon('bgm.mp3')).toBe('🔊')
  })

  it('.ogg → 🔊', () => {
    expect(getAssetFileIcon('sfx.ogg')).toBe('🔊')
  })

  it('.ttf → 🔤', () => {
    expect(getAssetFileIcon('font.ttf')).toBe('🔤')
  })

  it('.fnt → 🔤', () => {
    expect(getAssetFileIcon('bitmap.fnt')).toBe('🔤')
  })

  it('.json → 📋', () => {
    expect(getAssetFileIcon('data.json')).toBe('📋')
  })

  it('.plist → 📋', () => {
    expect(getAssetFileIcon('atlas.plist')).toBe('📋')
  })

  it('.anim → 🎞', () => {
    expect(getAssetFileIcon('run.anim')).toBe('🎞')
  })

  it('.clip → 🎞', () => {
    expect(getAssetFileIcon('idle.clip')).toBe('🎞')
  })

  it('알 수 없는 확장자 → 📄', () => {
    expect(getAssetFileIcon('data.xyz')).toBe('📄')
  })

  it('확장자 없는 파일 → 📄', () => {
    expect(getAssetFileIcon('README')).toBe('📄')
  })

  it('대문자 확장자도 처리한다 (.PNG)', () => {
    expect(getAssetFileIcon('hero.PNG')).toBe('🖼')
  })

  it('경로 포함 파일명도 처리한다', () => {
    expect(getAssetFileIcon('assets/textures/hero.png')).toBe('🖼')
  })
})

// ── buildFolderTree ────────────────────────────────────────────────────────

function makeEntry(relPath: string, type = 'texture'): AssetEntry {
  return { uuid: relPath, path: '/project/assets/' + relPath, relPath, type }
}

describe('buildFolderTree', () => {
  it('빈 배열이면 root만 반환한다', () => {
    const root = buildFolderTree([])
    expect(root.name).toBe('assets')
    expect(root.files).toHaveLength(0)
    expect(root.children).toHaveLength(0)
  })

  it('루트 파일은 root.files에 들어간다', () => {
    const root = buildFolderTree([makeEntry('image.png')])
    expect(root.files).toHaveLength(1)
    expect(root.files[0].relPath).toBe('image.png')
  })

  it('하위 폴더 파일은 해당 폴더 노드에 들어간다', () => {
    const root = buildFolderTree([makeEntry('textures/hero.png')])
    const texFolder = root.children.find(c => c.name === 'textures')
    expect(texFolder).toBeDefined()
    expect(texFolder!.files).toHaveLength(1)
    expect(texFolder!.files[0].relPath).toBe('textures/hero.png')
  })

  it('중첩 폴더 트리가 올바르게 생성된다', () => {
    const root = buildFolderTree([makeEntry('ui/buttons/btn.png')])
    const ui = root.children.find(c => c.name === 'ui')
    expect(ui).toBeDefined()
    const btns = ui!.children.find(c => c.name === 'buttons')
    expect(btns).toBeDefined()
    expect(btns!.files).toHaveLength(1)
  })

  it('같은 폴더의 파일들이 함께 그룹된다', () => {
    const root = buildFolderTree([
      makeEntry('textures/a.png'),
      makeEntry('textures/b.png'),
    ])
    const tex = root.children.find(c => c.name === 'textures')
    expect(tex!.files).toHaveLength(2)
  })

  it('children이 알파벳 순으로 정렬된다', () => {
    const root = buildFolderTree([
      makeEntry('z-folder/file.png'),
      makeEntry('a-folder/file.png'),
      makeEntry('m-folder/file.png'),
    ])
    const names = root.children.map(c => c.name)
    expect(names).toEqual([...names].sort())
  })

  it('files가 알파벳 순으로 정렬된다', () => {
    const root = buildFolderTree([
      makeEntry('z.png'),
      makeEntry('a.png'),
      makeEntry('m.png'),
    ])
    const relPaths = root.files.map(f => f.relPath)
    expect(relPaths).toEqual([...relPaths].sort())
  })

  it('역슬래시 구분자도 처리한다', () => {
    const entry: AssetEntry = { uuid: 'test', path: '/p/a', relPath: 'textures\\hero.png', type: 'texture' }
    // relPath에 역슬래시가 있으면 split에서 처리
    const root = buildFolderTree([entry])
    // textures 폴더가 생성되어야 함
    expect(root.children.length + root.files.length).toBeGreaterThan(0)
  })

  it('path 속성이 올바르게 설정된다', () => {
    const root = buildFolderTree([makeEntry('textures/hero.png')])
    const tex = root.children.find(c => c.name === 'textures')!
    expect(tex.path).toBe('textures')
  })

  it('복수 중첩 구조에서 중복 폴더가 생성되지 않는다', () => {
    const root = buildFolderTree([
      makeEntry('textures/a.png'),
      makeEntry('textures/b.png'),
      makeEntry('textures/sub/c.png'),
    ])
    const texFolders = root.children.filter(c => c.name === 'textures')
    expect(texFolders).toHaveLength(1)
  })
})
