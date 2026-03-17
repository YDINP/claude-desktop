// ── 에셋 브라우저 유틸리티 ──────────────────────────────────────────────────

export type AssetEntry = { uuid: string; path: string; relPath: string; type: string }

export const ASSET_TYPE_GROUPS: { key: string; icon: string; label: string; types: string[] }[] = [
  { key: 'texture', icon: '🖼', label: 'Texture', types: ['texture', 'sprite-atlas'] },
  { key: 'prefab', icon: '📦', label: 'Prefab', types: ['prefab'] },
  { key: 'scene', icon: '🎬', label: 'Scene', types: ['scene'] },
  { key: 'script', icon: '📜', label: 'Script', types: ['script'] },
  { key: 'audio', icon: '🔊', label: 'Audio', types: ['audio'] },
  { key: 'font', icon: '🔤', label: 'Font', types: ['font'] },
]

// R1382: 에셋 파일 타입 아이콘 매핑
export function getAssetFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['fire', 'scene'].includes(ext)) return '🎬'
  if (['prefab'].includes(ext)) return '📦'
  if (['ts', 'js', 'coffee'].includes(ext)) return '📜'
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg'].includes(ext)) return '🖼'
  if (['mp3', 'ogg', 'wav', 'aac'].includes(ext)) return '🔊'
  if (['ttf', 'otf', 'woff', 'fnt', 'bmfont'].includes(ext)) return '🔤'
  if (['json', 'plist'].includes(ext)) return '📋'
  if (['anim', 'clip'].includes(ext)) return '🎞'
  return '📄'
}

// R1382: 폴더 트리 빌드
export type FolderNode = { name: string; path: string; children: FolderNode[]; files: AssetEntry[] }

export function buildFolderTree(entries: AssetEntry[]): FolderNode {
  const root: FolderNode = { name: 'assets', path: '', children: [], files: [] }
  const folderMap = new Map<string, FolderNode>()
  folderMap.set('', root)

  const getOrCreateFolder = (dirPath: string): FolderNode => {
    if (folderMap.has(dirPath)) return folderMap.get(dirPath)!
    const parts = dirPath.split('/')
    const parentPath = parts.slice(0, -1).join('/')
    const parent = getOrCreateFolder(parentPath)
    const folder: FolderNode = { name: parts[parts.length - 1], path: dirPath, children: [], files: [] }
    parent.children.push(folder)
    folderMap.set(dirPath, folder)
    return folder
  }

  for (const entry of entries) {
    const parts = entry.relPath.split(/[\\/]/)
    const dirParts = parts.slice(0, -1)
    const dirPath = dirParts.join('/')
    const folder = getOrCreateFolder(dirPath)
    folder.files.push(entry)
  }

  // sort children alphabetically
  const sortFolder = (f: FolderNode) => {
    f.children.sort((a, b) => a.name.localeCompare(b.name))
    f.files.sort((a, b) => a.relPath.localeCompare(b.relPath))
    f.children.forEach(sortFolder)
  }
  sortFolder(root)
  return root
}
