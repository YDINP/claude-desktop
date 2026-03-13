import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useCCFileProject } from '../../hooks/useCCFileProject'
import { CCFileSceneView } from './SceneView/CCFileSceneView'
import type { CCSceneNode, CCSceneFile } from '../../../../shared/ipc-schema'

function BoolToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const [checked, setChecked] = useState(value)
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: 32, height: 16, flexShrink: 0, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => {
          setChecked(e.target.checked)
          onChange(e.target.checked)
        }}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <span style={{
        position: 'absolute', inset: 0,
        background: checked ? '#4caf50' : '#555',
        borderRadius: 16,
        transition: 'background 0.2s ease',
      }} />
      <span style={{
        position: 'absolute',
        top: 2, left: checked ? 18 : 2,
        width: 12, height: 12,
        background: '#fff',
        borderRadius: '50%',
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
      }} />
    </label>
  )
}

// Round 635: Inspector Transform 복사/붙여넣기 — module-level fallback
type TransformSnapshot = {
  position: CCSceneNode['position']
  rotation: CCSceneNode['rotation']
  scale: CCSceneNode['scale']
  size: CCSceneNode['size']
  anchor: CCSceneNode['anchor']
  opacity: number
}
let transformClipboard: TransformSnapshot | null = null

export function CocosPanel() {
  const fileProject = useCCFileProject()
  const [selectedNode, setSelectedNode] = useState<CCSceneNode | null>(null)
  return (
    <CCFileProjectUI
      fileProject={fileProject}
      selectedNode={selectedNode}
      onSelectNode={setSelectedNode}
    />
  )
}

// ── CC 파일 모드 UI ──────────────────────────────────────────────────────────

interface CCFileProjectUIProps {
  fileProject: {
    projectInfo: import('../../../../shared/ipc-schema').CCFileProjectInfo | null
    sceneFile: import('../../../../shared/ipc-schema').CCSceneFile | null
    loading: boolean
    error: string | null
    externalChange: { path: string; timestamp: number } | null
    canUndo: boolean
    canRedo: boolean
    openProject: () => Promise<void>
    loadScene: (scenePath: string) => Promise<void>
    saveScene: (root: import('../../../../shared/ipc-schema').CCSceneNode) => Promise<{ success: boolean; error?: string }>
    undo: () => Promise<{ success: boolean; error?: string } | undefined>
    redo: () => Promise<{ success: boolean; error?: string } | undefined>
    restoreBackup: () => Promise<{ success: boolean; error?: string }>
  }
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
}

function CCFileProjectUI({ fileProject, selectedNode, onSelectNode }: CCFileProjectUIProps) {
  const { projectInfo, sceneFile, loading, error, externalChange, canUndo, canRedo, openProject, loadScene, saveScene, undo, redo, restoreBackup } = fileProject
  const [selectedScene, setSelectedScene] = useState<string>('')
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const clipboardRef = useRef<CCSceneNode | null>(null)
  const [hideInactive, setHideInactive] = useState(false)
  const [collapsedUuids, setCollapsedUuids] = useState<Set<string>>(() => new Set())
  const expandAll = useCallback(() => setCollapsedUuids(new Set()), [])
  const collapseAll = useCallback(() => {
    if (!sceneFile?.root) return
    const uuids = new Set<string>()
    function collectParents(n: CCSceneNode) {
      if (n.children.length > 0) { uuids.add(n.uuid); n.children.forEach(collectParents) }
    }
    collectParents(sceneFile.root)
    setCollapsedUuids(uuids)
  }, [sceneFile?.root])
  const [sceneViewHeight, setSceneViewHeight] = useState(240)
  const [mainTab, setMainTab] = useState<'scene' | 'assets' | 'groups'>('scene')
  const dividerDragRef = useRef<{ startY: number; startH: number } | null>(null)
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cc-recent-files') ?? '[]') } catch { return [] }
  })
  const FAV_KEY = 'scene-tree-favorites'
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scene-tree-favorites') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleFavorite = useCallback((uuid: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem(FAV_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])
  const [lockedUuids, setLockedUuids] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scene-locked') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleLocked = useCallback((uuid: string) => {
    setLockedUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem('scene-locked', JSON.stringify([...next]))
      return next
    })
  }, [])
  const [nodeColors, setNodeColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('node-colors') ?? '{}') } catch { return {} }
  })
  const handleNodeColorChange = useCallback((uuid: string, color: string | null) => {
    setNodeColors(prev => {
      const next = { ...prev }
      if (color === null) delete next[uuid]
      else next[uuid] = color
      localStorage.setItem('node-colors', JSON.stringify(next))
      return next
    })
  }, [])
  const nodeMap = useMemo(() => {
    const map = new Map<string, CCSceneNode>()
    if (!sceneFile?.root) return map
    function walk(n: CCSceneNode) { map.set(n.uuid, n); n.children.forEach(walk) }
    walk(sceneFile.root)
    return map
  }, [sceneFile?.root])

  const addRecent = useCallback((path: string) => {
    setRecentFiles(prev => {
      const next = [path, ...prev.filter(f => f !== path)].slice(0, 6)
      localStorage.setItem('cc-recent-files', JSON.stringify(next))
      return next
    })
  }, [])

  const handleSceneChange = useCallback(async (path: string) => {
    setSelectedScene(path)
    if (path) { await loadScene(path); addRecent(path) }
  }, [loadScene, addRecent])

  const handleTreeDelete = useCallback(async (nodeUuid: string) => {
    if (!sceneFile?.root || sceneFile.root.uuid === nodeUuid) return
    function removeNode(n: CCSceneNode): CCSceneNode {
      return { ...n, children: n.children.filter(c => c.uuid !== nodeUuid).map(removeNode) }
    }
    await saveScene(removeNode(sceneFile.root))
    if (selectedNode?.uuid === nodeUuid) onSelectNode(null)
  }, [sceneFile, saveScene, selectedNode, onSelectNode])

  const handleTreeDuplicate = useCallback(async (nodeUuid: string) => {
    if (!sceneFile?.root || !sceneFile._raw) return
    const raw = sceneFile._raw as Record<string, unknown>[]
    const findNode = (n: CCSceneNode): CCSceneNode | null => {
      if (n.uuid === nodeUuid) return n
      for (const c of n.children) { const f = findNode(c); if (f) return f }
      return null
    }
    const orig = findNode(sceneFile.root)
    if (!orig) return
    const newId = 'dup-' + Date.now()
    const newIdx = raw.length
    const origRaw = orig._rawIndex != null ? { ...raw[orig._rawIndex] } : {}
    raw.push({ ...origRaw, _id: newId, _name: orig.name + '_Copy', _children: [], _components: [] })
    const dupNode: CCSceneNode = {
      ...orig, uuid: newId, name: orig.name + '_Copy',
      children: [], _rawIndex: newIdx,
    }
    function insertAfter(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === nodeUuid)
      if (idx >= 0) {
        const ch = [...n.children]
        ch.splice(idx + 1, 0, dupNode)
        return { ...n, children: ch }
      }
      return { ...n, children: n.children.map(insertAfter) }
    }
    try {
      const result = await saveScene(insertAfter(sceneFile.root))
      if (!result.success) raw.pop()
    } catch {
      raw.pop()
    }
  }, [sceneFile, saveScene])

  const handleSave = useCallback(async () => {
    if (!sceneFile?.root) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const result = await saveScene(sceneFile.root)
      setSaveMsg(result.success
        ? { ok: true, text: '저장 완료' }
        : { ok: false, text: result.error ?? '저장 실패' }
      )
      setTimeout(() => setSaveMsg(null), 3000)
    } finally {
      setSaving(false)
    }
  }, [sceneFile, saveScene])

  // 키보드 단축키: Ctrl+Z/Y, Delete, Ctrl+D, Arrow keys
  useEffect(() => {
    if (!sceneFile) return
    const handler = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      // 입력 필드 포커스 시 무시
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (ctrl && e.key === 's') { e.preventDefault(); handleSave(); return }
      if (ctrl && e.key === 'z' && canUndo) { e.preventDefault(); undo(); return }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && canRedo) { e.preventDefault(); redo(); return }
      if (e.key === 'Escape' && !isInput) { onSelectNode(null); return }

      if (isInput) return

      // Ctrl+C: 선택 노드 클립보드 복사
      if (ctrl && e.key === 'c' && selectedNode) {
        e.preventDefault()
        clipboardRef.current = selectedNode
        return
      }
      // Ctrl+V: 클립보드 노드 붙여넣기 (선택 노드의 자식으로 / 없으면 루트 자식으로)
      if (ctrl && e.key === 'v' && clipboardRef.current && sceneFile?.root) {
        e.preventDefault()
        const srcNode = clipboardRef.current
        const newId = 'paste-' + Date.now()
        const raw = sceneFile._raw as Record<string, unknown>[] | undefined
        const version = sceneFile.projectInfo.version ?? '2x'
        const newIdx = raw?.length ?? 0
        if (raw) {
          const origRaw = srcNode._rawIndex != null ? { ...raw[srcNode._rawIndex] } : {}
          raw.push({ ...origRaw, _id: newId, _name: srcNode.name + '_Paste', _children: [], _components: [] })
        }
        const pasteNode: CCSceneNode = { ...srcNode, uuid: newId, name: srcNode.name + '_Paste', children: [], _rawIndex: newIdx }
        const parentUuid = selectedNode?.uuid ?? sceneFile.root.uuid
        function addToParent(n: CCSceneNode): CCSceneNode {
          if (n.uuid === parentUuid) return { ...n, children: [...n.children, pasteNode] }
          return { ...n, children: n.children.map(addToParent) }
        }
        try {
          const result = await saveScene(addToParent(sceneFile.root))
          if (!result.success && raw) raw.pop()
        } catch {
          if (raw) raw.pop()
        }
        return
      }

      // Delete/Backspace: 선택 노드 삭제
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode && sceneFile.root?.uuid !== selectedNode.uuid) {
        e.preventDefault()
        handleTreeDelete(selectedNode.uuid)
        return
      }
      // Ctrl+D: 선택 노드 복제
      if (ctrl && e.key === 'd' && selectedNode) {
        e.preventDefault()
        handleTreeDuplicate(selectedNode.uuid)
        return
      }
      // Arrow keys: 선택 노드 1px 이동
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && selectedNode && sceneFile.root) {
        e.preventDefault()
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
        const dy = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
        const step = e.shiftKey ? 10 : 1
        const pos = selectedNode.position as { x: number; y: number; z: number }
        function moveNode(n: CCSceneNode): CCSceneNode {
          if (n.uuid === selectedNode!.uuid) {
            return { ...n, position: { ...pos, x: pos.x + dx * step, y: pos.y + dy * step } }
          }
          return { ...n, children: n.children.map(moveNode) }
        }
        saveScene(moveNode(sceneFile.root))
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sceneFile, canUndo, canRedo, undo, redo, selectedNode, handleTreeDelete, handleTreeDuplicate, saveScene, handleSave, onSelectNode])

  // sceneFile 재로드 시 선택 노드 동기화 (uuid 기반 재탐색)
  useEffect(() => {
    if (!sceneFile?.root || !selectedNode) return
    const find = (n: CCSceneNode): CCSceneNode | null => {
      if (n.uuid === selectedNode.uuid) return n
      for (const c of n.children) { const f = find(c); if (f) return f }
      return null
    }
    const fresh = find(sceneFile.root)
    if (fresh) onSelectNode(fresh)
  }, [sceneFile])

  const handleNodeMove = useCallback(async (uuid: string, x: number, y: number) => {
    if (!sceneFile?.root) return
    function updatePos(n: CCSceneNode): CCSceneNode {
      if (n.uuid === uuid) return { ...n, position: { ...n.position, x, y } }
      return { ...n, children: n.children.map(updatePos) }
    }
    await saveScene(updatePos(sceneFile.root))
  }, [sceneFile, saveScene])

  const handleNodeResize = useCallback(async (uuid: string, w: number, h: number) => {
    if (!sceneFile?.root) return
    function updateSize(n: CCSceneNode): CCSceneNode {
      if (n.uuid === uuid) return { ...n, size: { x: Math.round(w), y: Math.round(h) } }
      return { ...n, children: n.children.map(updateSize) }
    }
    await saveScene(updateSize(sceneFile.root))
  }, [sceneFile, saveScene])

  const handleNodeRotate = useCallback(async (uuid: string, angle: number) => {
    if (!sceneFile?.root) return
    const rounded = Math.round(angle * 10) / 10
    function updateRot(n: CCSceneNode): CCSceneNode {
      if (n.uuid === uuid) {
        const rot = typeof n.rotation === 'number'
          ? rounded
          : { ...(n.rotation as object), z: rounded }
        return { ...n, rotation: rot }
      }
      return { ...n, children: n.children.map(updateRot) }
    }
    await saveScene(updateRot(sceneFile.root))
  }, [sceneFile, saveScene])

  const handleMultiMove = useCallback(async (moves: Array<{ uuid: string; x: number; y: number }>) => {
    if (!sceneFile?.root) return
    function updateAll(n: CCSceneNode): CCSceneNode {
      const m = moves.find(mv => mv.uuid === n.uuid)
      if (m) return { ...n, position: { ...n.position, x: m.x, y: m.y } }
      return { ...n, children: n.children.map(updateAll) }
    }
    await saveScene(updateAll(sceneFile.root))
  }, [sceneFile, saveScene])

  const handleReparent = useCallback(async (dragUuid: string, dropUuid: string) => {
    if (!sceneFile?.root || dragUuid === dropUuid || sceneFile.root.uuid === dragUuid) return
    // 사이클 방지: drop 대상이 drag 노드의 하위인지 확인
    function isDesc(n: CCSceneNode, target: string): boolean {
      if (n.uuid === target) return true
      return n.children.some(c => isDesc(c, target))
    }
    const findNode = (n: CCSceneNode): CCSceneNode | null => {
      if (n.uuid === dragUuid) return n
      for (const c of n.children) { const f = findNode(c); if (f) return f }
      return null
    }
    const dragged = findNode(sceneFile.root)
    if (!dragged || isDesc(dragged, dropUuid)) return

    let moved: CCSceneNode | null = null
    function remove(n: CCSceneNode): CCSceneNode {
      const ch = n.children.filter(c => { if (c.uuid === dragUuid) { moved = c; return false } return true })
      return { ...n, children: ch.map(remove) }
    }
    function insert(n: CCSceneNode): CCSceneNode {
      if (n.uuid === dropUuid) return { ...n, children: [...n.children, moved!] }
      return { ...n, children: n.children.map(insert) }
    }
    const reduced = remove(sceneFile.root)
    if (!moved) return
    await saveScene(insert(reduced))
  }, [sceneFile, saveScene])

  // 트리 컨텍스트 메뉴용 핸들러들
  const handleTreeAddChild = useCallback(async (parentUuid: string) => {
    if (!sceneFile?.root || !sceneFile._raw) return
    const raw = sceneFile._raw as Record<string, unknown>[]
    const version = sceneFile.projectInfo.version ?? '2x'
    const newId = 'ctx-' + Date.now()
    const newIdx = raw.length
    raw.push(version === '3x' ? {
      __type__: 'cc.Node', _id: newId, _name: 'NewNode', _active: true,
      _children: [], _components: [],
      _lpos: { x: 0, y: 0, z: 0 }, _lrot: { x: 0, y: 0, z: 0 }, _lscale: { x: 1, y: 1, z: 1 },
      _color: { r: 255, g: 255, b: 255, a: 255 }, _layer: 33554432,
    } : {
      __type__: 'cc.Node', _id: newId, _name: 'NewNode', _active: true,
      _children: [], _components: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
      _contentSize: { width: 100, height: 100 }, _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
    })
    const newNode: CCSceneNode = {
      uuid: newId, name: 'NewNode', active: true,
      position: { x: 0, y: 0, z: 0 },
      rotation: version === '3x' ? { x: 0, y: 0, z: 0 } : 0,
      scale: { x: 1, y: 1, z: 1 }, size: { x: 100, y: 100 }, anchor: { x: 0.5, y: 0.5 },
      opacity: 255, color: { r: 255, g: 255, b: 255, a: 255 },
      components: [], children: [], _rawIndex: newIdx,
    }
    function addChild(n: CCSceneNode): CCSceneNode {
      if (n.uuid === parentUuid) return { ...n, children: [...n.children, newNode] }
      return { ...n, children: n.children.map(addChild) }
    }
    try {
      const result = await saveScene(addChild(sceneFile.root))
      if (!result.success) raw.pop()
    } catch {
      raw.pop()
    }
  }, [sceneFile, saveScene])

  const handleTreeToggleActive = useCallback(async (nodeUuid: string) => {
    if (!sceneFile?.root) return
    function toggle(n: CCSceneNode): CCSceneNode {
      if (n.uuid === nodeUuid) return { ...n, active: !n.active }
      return { ...n, children: n.children.map(toggle) }
    }
    await saveScene(toggle(sceneFile.root))
  }, [sceneFile, saveScene])

  const handleRenameInView = useCallback(async (nodeUuid: string, newName: string) => {
    if (!sceneFile?.root || !newName.trim()) return
    function rename(n: CCSceneNode): CCSceneNode {
      if (n.uuid === nodeUuid) return { ...n, name: newName.trim() }
      return { ...n, children: n.children.map(rename) }
    }
    await saveScene(rename(sceneFile.root))
  }, [sceneFile, saveScene])

  const handleRestore = useCallback(async () => {
    if (!sceneFile) return
    const result = await restoreBackup()
    setSaveMsg(result.success
      ? { ok: true, text: '백업 복원 완료' }
      : { ok: false, text: result.error ?? '복원 실패' }
    )
    setTimeout(() => setSaveMsg(null), 3000)
  }, [sceneFile, restoreBackup])

  return (
    <div
      style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
      onDrop={e => {
        e.preventDefault(); e.stopPropagation()
        const file = e.dataTransfer.files[0]
        if (!file) return
        const filePath = (file as File & { path?: string }).path
        if (!filePath) return
        if (/\.(fire|scene|prefab)$/i.test(filePath)) { loadScene(filePath); addRecent(filePath) }
      }}
    >
      {/* 외부 파일 변경 감지 배너 */}
      {externalChange && sceneFile && (
        <div style={{
          padding: '5px 10px', background: '#2d1a00', borderBottom: '1px solid #ff9944',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: '#ff9944', flex: 1 }}>
            파일이 외부에서 수정됨
          </span>
          <button
            onClick={() => loadScene(sceneFile.scenePath)}
            style={{
              padding: '2px 6px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
              background: '#ff9944', color: '#000', border: 'none',
            }}
          >
            다시 로드
          </button>
        </div>
      )}

      {/* 프로젝트 열기 섹션 */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <button
            onClick={openProject}
            disabled={loading}
            style={{
              flex: 1, padding: '4px 8px', background: 'var(--accent)', color: '#fff',
              borderRadius: 4, fontSize: 11, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '로드 중...' : projectInfo?.detected ? '📂 다른 프로젝트 열기' : '📂 CC 프로젝트 열기'}
          </button>
        </div>

        {/* 감지된 프로젝트 정보 */}
        {projectInfo?.detected && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 2 }}>
              {projectInfo.name}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                CC {projectInfo.version} ({projectInfo.creatorVersion})
              </span>
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={projectInfo.projectPath}>
              📁 {projectInfo.projectPath}
            </div>
            <div style={{ marginTop: 2 }}>
              씬 파일: <strong>{projectInfo.scenes?.length ?? 0}개</strong>
            </div>
          </div>
        )}

        {/* 씬 선택 드롭다운 */}
        {projectInfo?.scenes && projectInfo.scenes.length > 0 && (
          <select
            value={selectedScene}
            onChange={e => handleSceneChange(e.target.value)}
            style={{
              width: '100%', marginTop: 6, padding: '3px 6px', fontSize: 10,
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 4,
            }}
          >
            <option value="">씬 파일 선택...</option>
            {projectInfo.scenes.map(s => (
              <option key={s} value={s}>
                {s.split(/[\\/]/).pop()}
              </option>
            ))}
          </select>
        )}

        {/* 저장 / undo/redo / 백업 복원 버튼 */}
        {sceneFile?.root && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              title="씬 파일 저장 (.bak 자동 백업)"
              style={{
                flex: 1, padding: '3px 0', fontSize: 10, borderRadius: 3,
                cursor: saving ? 'not-allowed' : 'pointer',
                background: 'var(--accent)', color: '#fff', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? '저장 중...' : '💾 저장'}
            </button>
            <button
              onClick={undo}
              disabled={!canUndo}
              title="실행 취소 (Ctrl+Z)"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3,
                cursor: canUndo ? 'pointer' : 'not-allowed',
                background: 'none', border: '1px solid var(--border)',
                color: canUndo ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: canUndo ? 1 : 0.4,
              }}
            >
              ↩
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="다시 실행 (Ctrl+Y)"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3,
                cursor: canRedo ? 'pointer' : 'not-allowed',
                background: 'none', border: '1px solid var(--border)',
                color: canRedo ? 'var(--text-primary)' : 'var(--text-muted)',
                opacity: canRedo ? 1 : 0.4,
              }}
            >
              ↪
            </button>
            <button
              onClick={handleRestore}
              title=".bak 백업 파일에서 복원"
              style={{
                padding: '3px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}
            >
              .bak
            </button>
          </div>
        )}
        {saveMsg && (
          <div style={{
            marginTop: 4, fontSize: 10, padding: '3px 6px', borderRadius: 3,
            background: saveMsg.ok ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
            color: saveMsg.ok ? 'var(--success, #3fb950)' : 'var(--error, #f85149)',
          }}>
            {saveMsg.text}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--error, #f85149)', lineHeight: 1.4 }}>
            {error}
          </div>
        )}
      </div>

      {/* 씬/에셋 탭 바 */}
      {projectInfo?.detected && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['scene', 'groups', 'assets'] as const).map(t => (
            <button key={t} onClick={() => setMainTab(t)}
              style={{
                flex: 1, padding: '4px 0', fontSize: 10, border: 'none', cursor: 'pointer',
                background: mainTab === t ? 'var(--bg-primary)' : 'transparent',
                color: mainTab === t ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: mainTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: mainTab === t ? 600 : 400,
              }}
            >{t === 'scene' ? '🎬 씬 편집' : t === 'groups' ? '📦 그룹' : '📁 에셋'}</button>
          ))}
        </div>
      )}

      {/* 씬 파싱 결과 — SceneView + TreeView + Inspector */}
      {mainTab === 'scene' && sceneFile?.root && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* SVG 씬 뷰 (드래그로 높이 조절) */}
          <div style={{ height: sceneViewHeight, flexShrink: 0 }}>
            <CCFileSceneView
              sceneFile={sceneFile}
              selectedUuid={selectedNode?.uuid ?? null}
              onMove={handleNodeMove}
              onResize={handleNodeResize}
              onRename={handleRenameInView}
              onRotate={handleNodeRotate}
              onMultiMove={handleMultiMove}
              onSelect={uuid => {
                if (!uuid) { onSelectNode(null); return }
                const findNode = (n: CCSceneNode): CCSceneNode | null => {
                  if (n.uuid === uuid) return n
                  for (const c of n.children) { const f = findNode(c); if (f) return f }
                  return null
                }
                onSelectNode(findNode(sceneFile.root))
              }}
            />
          </div>
          {/* 씬뷰 높이 조절 divider */}
          <div
            style={{ height: 4, cursor: 'ns-resize', background: 'var(--border)', flexShrink: 0, opacity: 0.5 }}
            onMouseDown={e => { dividerDragRef.current = { startY: e.clientY, startH: sceneViewHeight } }}
            onMouseMove={e => {
              if (!dividerDragRef.current) return
              const dy = e.clientY - dividerDragRef.current.startY
              setSceneViewHeight(Math.max(80, Math.min(600, dividerDragRef.current.startH + dy)))
            }}
            onMouseUp={() => { dividerDragRef.current = null }}
            onMouseLeave={() => { dividerDragRef.current = null }}
          />
          {/* 씬 트리 */}
          <div style={{ flex: selectedNode ? 0 : 1, overflow: 'auto', maxHeight: selectedNode ? 180 : undefined }}>
            <div style={{ padding: '3px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                {sceneFile.scenePath.split(/[\\/]/).pop()}
              </span>
              {(() => {
                let nodes = 0; let inactive = 0; let comps = 0
                function count(n: CCSceneNode) { nodes++; if (!n.active) inactive++; comps += n.components.length; n.children.forEach(count) }
                count(sceneFile.root)
                return (
                  <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }} title={`노드 ${nodes}개 / 비활성 ${inactive}개 / 컴포넌트 ${comps}개`}>
                    {nodes}N{inactive > 0 ? <span style={{ color: '#444' }}>(-{inactive})</span> : null}/{comps}C
                  </span>
                )
              })()}
              <TreeSearch root={sceneFile.root} onSelect={onSelectNode} />
              <span
                onClick={expandAll}
                title="전체 펼치기"
                style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: '#555', lineHeight: 1 }}
              >⊞</span>
              <span
                onClick={collapseAll}
                title="전체 접기"
                style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: '#555', lineHeight: 1 }}
              >⊟</span>
              <span
                onClick={() => setHideInactive(h => !h)}
                title={hideInactive ? '비활성 노드 표시' : '비활성 노드 숨기기'}
                style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: hideInactive ? '#58a6ff' : '#555' }}
              >
                {hideInactive ? '◑' : '●'}
              </span>
            </div>
            {favorites.size > 0 && (
              <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 4, paddingBottom: 4 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', padding: '2px 8px' }}>★ 즐겨찾기</div>
                {[...favorites].map(uuid => {
                  const favNode = nodeMap.get(uuid)
                  if (!favNode) return null
                  return (
                    <div
                      key={uuid}
                      style={{ paddingLeft: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => onSelectNode(favNode)}
                    >
                      <span style={{ color: '#fbbf24', fontSize: 10 }}>★</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{favNode.name}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <CCFileSceneTree
              node={sceneFile.root}
              depth={0}
              selected={selectedNode}
              onSelect={onSelectNode}
              onReparent={handleReparent}
              onAddChild={handleTreeAddChild}
              onDelete={handleTreeDelete}
              onDuplicate={handleTreeDuplicate}
              onToggleActive={handleTreeToggleActive}
              hideInactive={hideInactive}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              lockedUuids={lockedUuids}
              onToggleLocked={toggleLocked}
              nodeColors={nodeColors}
              onNodeColorChange={handleNodeColorChange}
              collapsedUuids={collapsedUuids}
              onToggleCollapse={(uuid) => setCollapsedUuids(prev => {
                const next = new Set(prev)
                if (next.has(uuid)) next.delete(uuid); else next.add(uuid)
                return next
              })}
            />
          </div>
          {/* 노드 인스펙터 */}
          {selectedNode && (
            <CCFileNodeInspector
              node={selectedNode}
              sceneFile={sceneFile}
              saveScene={saveScene}
              onUpdate={onSelectNode}
            />
          )}
        </div>
      )}

      {/* 그룹 탭 */}
      {mainTab === 'groups' && sceneFile?.root && (
        <GroupPanel
          root={sceneFile.root}
          selectedNode={selectedNode}
          onSelectNode={onSelectNode}
          onRenameGroup={handleRenameInView}
          onToggleGroupActive={handleTreeToggleActive}
        />
      )}
      {mainTab === 'groups' && !sceneFile?.root && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>씬을 먼저 로드하세요.</div>
      )}

      {/* 에셋 탭 */}
      {mainTab === 'assets' && projectInfo?.detected && (
        projectInfo.assetsDir
          ? <CCFileAssetBrowser assetsDir={projectInfo.assetsDir} />
          : <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>assetsDir를 감지할 수 없습니다.</div>
      )}

      {/* 안내 (프로젝트 미선택) */}
      {!projectInfo?.detected && !loading && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-primary)' }}>파일 직접 편집 모드</div>
          <div>CC Extension 없이 .fire / .scene 파일을 직접 파싱·편집합니다.</div>
          <div style={{ marginTop: 6, fontSize: 10 }}>
            • CC 2.x (.fire) / CC 3.x (.scene) 모두 지원<br />
            • 에디터 미실행 상태에서도 씬 트리 조회 가능<br />
            • 저장 시 원본 파일 직접 수정 (자동 백업)
          </div>
          {recentFiles.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>최근 파일</div>
              {recentFiles.map(f => (
                <div
                  key={f}
                  onClick={() => handleSceneChange(f)}
                  title={f}
                  style={{
                    fontSize: 10, padding: '3px 6px', borderRadius: 3, cursor: 'pointer',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'var(--accent)', marginBottom: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {f.split(/[\\/]/).pop()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const NODE_COLOR_PALETTE: { color: string; label: string }[] = [
  { color: '#f87171', label: '빨강' },
  { color: '#fb923c', label: '주황' },
  { color: '#facc15', label: '노랑' },
  { color: '#4ade80', label: '초록' },
  { color: '#60a5fa', label: '파랑' },
  { color: '#a78bfa', label: '보라' },
]

/** 그룹 패널 — 자식이 있는 노드를 그룹으로 표시 */
function GroupPanel({
  root,
  selectedNode,
  onSelectNode,
  onRenameGroup,
  onToggleGroupActive,
}: {
  root: CCSceneNode
  selectedNode: CCSceneNode | null
  onSelectNode: (n: CCSceneNode | null) => void
  onRenameGroup: (uuid: string, name: string) => Promise<void>
  onToggleGroupActive: (uuid: string) => Promise<void>
}) {
  // 자식이 있는 노드를 재귀적으로 수집 (루트 제외)
  const groups = useMemo(() => {
    const result: CCSceneNode[] = []
    function collect(n: CCSceneNode, depth: number) {
      if (depth > 0 && n.children.length > 0) result.push(n)
      n.children.forEach(c => collect(c, depth + 1))
    }
    collect(root, 0)
    return result
  }, [root])

  const [editingUuid, setEditingUuid] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement | null>(null)

  // F2로 인라인 편집 시작
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' && selectedNode && selectedNode.children.length > 0) {
        e.preventDefault()
        setEditingUuid(selectedNode.uuid)
        setEditValue(selectedNode.name)
      }
      if (e.key === 'Escape' && editingUuid) {
        setEditingUuid(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNode, editingUuid])

  useEffect(() => {
    if (editingUuid && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingUuid])

  const commitRename = async (uuid: string) => {
    if (editValue.trim()) await onRenameGroup(uuid, editValue.trim())
    setEditingUuid(null)
  }

  const [hiddenUuids, setHiddenUuids] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('group-panel-hidden') ?? '[]')) }
    catch { return new Set() }
  })
  const toggleHidden = (uuid: string) => {
    setHiddenUuids(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      localStorage.setItem('group-panel-hidden', JSON.stringify([...next]))
      return next
    })
    onToggleGroupActive(uuid)
  }

  if (groups.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11 }}>
        자식 노드가 있는 그룹 노드가 없습니다.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>그룹 노드 (자식 포함)</span>
        <span style={{ fontSize: 9, color: '#555', marginLeft: 'auto' }}>{groups.length}개</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {groups.map(g => {
          const isSelected = selectedNode?.uuid === g.uuid
          return (
            <div
              key={g.uuid}
              onClick={() => onSelectNode(isSelected ? null : g)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px',
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-subtle, rgba(88,166,255,0.1))' : 'transparent',
                borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                opacity: g.active ? 1 : 0.45,
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              {/* 가시성 토글 (눈 아이콘) */}
              <span
                onClick={e => { e.stopPropagation(); toggleHidden(g.uuid) }}
                title={g.active ? '숨기기' : '표시'}
                style={{
                  fontSize: 11, cursor: 'pointer', flexShrink: 0, userSelect: 'none',
                  color: g.active ? 'var(--text-muted)' : '#555',
                }}
              >
                {g.active ? '👁' : '🙈'}
              </span>

              {/* 인라인 이름 편집 */}
              {editingUuid === g.uuid ? (
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitRename(g.uuid)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(g.uuid) }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingUuid(null) }
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    flex: 1, fontSize: 11, background: 'var(--bg-input, #1a1a2e)',
                    border: '1px solid var(--accent)', borderRadius: 3,
                    color: 'var(--text-primary)', padding: '1px 4px',
                  }}
                />
              ) : (
                <span
                  onDoubleClick={e => {
                    e.stopPropagation()
                    setEditingUuid(g.uuid)
                    setEditValue(g.name)
                  }}
                  style={{
                    flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', color: 'var(--text-primary)', userSelect: 'none',
                  }}
                  title={`${g.name} — 자식 ${g.children.length}개 (더블클릭 또는 F2로 이름 편집)`}
                >
                  {g.name}
                </span>
              )}

              {/* 자식 수 배지 */}
              <span style={{
                fontSize: 9, color: 'var(--text-muted)', flexShrink: 0,
                background: 'rgba(255,255,255,0.07)', borderRadius: 8,
                padding: '1px 5px',
              }}>
                {g.children.length}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ padding: '4px 8px', borderTop: '1px solid var(--border)', fontSize: 9, color: '#444', flexShrink: 0 }}>
        클릭: 선택 | 더블클릭/F2: 이름 편집 | 눈 아이콘: 가시성 토글
      </div>
    </div>
  )
}

/** 파싱된 CCSceneNode 트리 렌더링 */
function CCFileSceneTree({
  node, depth, selected, onSelect, onReparent, onAddChild, onDelete, onDuplicate, onToggleActive, hideInactive, favorites, onToggleFavorite, lockedUuids, onToggleLocked, nodeColors, onNodeColorChange, collapsedUuids, onToggleCollapse,
}: {
  node: CCSceneNode
  depth: number
  selected: CCSceneNode | null
  onSelect: (n: CCSceneNode | null) => void
  onReparent?: (dragUuid: string, dropUuid: string) => void
  onAddChild?: (uuid: string) => void
  onDelete?: (uuid: string) => void
  onDuplicate?: (uuid: string) => void
  onToggleActive?: (uuid: string) => void
  hideInactive?: boolean
  favorites?: Set<string>
  onToggleFavorite?: (uuid: string) => void
  lockedUuids?: Set<string>
  onToggleLocked?: (uuid: string) => void
  nodeColors?: Record<string, string>
  onNodeColorChange?: (uuid: string, color: string | null) => void
  collapsedUuids?: Set<string>
  onToggleCollapse?: (uuid: string) => void
}) {
  const [localCollapsed, setLocalCollapsed] = useState(depth > 2)
  const collapsed = collapsedUuids ? collapsedUuids.has(node.uuid) : localCollapsed
  const setCollapsed = onToggleCollapse
    ? (_updater: boolean | ((prev: boolean) => boolean)) => onToggleCollapse(node.uuid)
    : setLocalCollapsed
  const [isDragOver, setIsDragOver] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; showColorPicker?: boolean } | null>(null)
  const hasChildren = node.children.length > 0
  const isSelected = selected?.uuid === node.uuid
  const isRoot = depth === 0

  // 비활성 숨기기 (루트 제외)
  if (hideInactive && !node.active && !isRoot && !isSelected) return null

  return (
    <div>
      {ctxMenu && (
        <div
          style={{
            position: 'fixed', zIndex: 9999, left: ctxMenu.x, top: ctxMenu.y,
            background: 'var(--panel-bg, #16213e)', border: '1px solid var(--border)',
            borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', minWidth: 120,
          }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          {[
            { label: '자식 추가', action: () => { setCtxMenu(null); onAddChild?.(node.uuid) } },
            ...(!isRoot ? [
              { label: node.active ? '비활성화' : '활성화', action: () => { setCtxMenu(null); onToggleActive?.(node.uuid) } },
              { label: '복제', action: () => { setCtxMenu(null); onDuplicate?.(node.uuid) } },
              { label: '삭제', action: () => { setCtxMenu(null); onDelete?.(node.uuid) } },
            ] : []),
          ].map(item => (
            <div key={item.label}
              onClick={item.action}
              style={{
                padding: '6px 12px', fontSize: 11, cursor: 'pointer',
                color: item.label === '삭제' ? '#ff6b6b' : 'var(--text-primary)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </div>
          ))}
          {/* 색상 태그 팔레트 */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '5px 8px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>색상 태그</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {NODE_COLOR_PALETTE.map(({ color, label }) => (
                <div
                  key={color}
                  title={label}
                  onClick={() => { onNodeColorChange?.(node.uuid, color); setCtxMenu(null) }}
                  style={{
                    width: 16, height: 16, borderRadius: '50%', background: color, cursor: 'pointer',
                    border: nodeColors?.[node.uuid] === color ? '2px solid #fff' : '2px solid transparent',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
              <div
                title="초기화"
                onClick={() => { onNodeColorChange?.(node.uuid, null); setCtxMenu(null) }}
                style={{
                  width: 16, height: 16, borderRadius: '50%', cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'var(--text-muted)', boxSizing: 'border-box',
                }}
              >✕</div>
            </div>
          </div>
        </div>
      )}
      <div
        className="tree-node-row"
        draggable={!isRoot}
        onClick={() => { setCtxMenu(null); onSelect(isSelected ? null : node) }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onSelect(node); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('text/plain', node.uuid) }}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => {
          e.preventDefault(); e.stopPropagation(); setIsDragOver(false)
          const dragUuid = e.dataTransfer.getData('text/plain')
          if (dragUuid) onReparent?.(dragUuid, node.uuid)
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 2,
          padding: `2px 6px 2px ${8 + depth * 14}px`,
          cursor: isRoot ? 'default' : 'grab', fontSize: 11,
          background: isDragOver ? 'rgba(88,166,255,0.18)' : isSelected ? 'var(--accent-subtle, rgba(88,166,255,0.1))' : nodeColors?.[node.uuid] ? `${nodeColors[node.uuid]}26` : 'transparent',
          color: node.active ? 'var(--text-primary)' : 'var(--text-muted)',
          userSelect: 'none',
          outline: isDragOver ? '1px dashed #58a6ff' : 'none',
          borderLeft: depth > 0 ? `1px solid ${nodeColors?.[node.uuid] ?? 'rgba(255,255,255,0.05)'}` : 'none',
        }}
      >
        {hasChildren ? (
          <span
            onClick={e => { e.stopPropagation(); setCollapsed(c => !c) }}
            style={{ fontSize: 9, width: 12, textAlign: 'center', flexShrink: 0 }}
          >
            {collapsed ? '▸' : '▾'}
          </span>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        {nodeColors?.[node.uuid] && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: nodeColors[node.uuid], flexShrink: 0, display: 'inline-block' }} />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {node.name || '(unnamed)'}
        </span>
        {!isRoot && (
          <span
            onClick={e => { e.stopPropagation(); onToggleActive?.(node.uuid) }}
            title={node.active ? '비활성화' : '활성화'}
            style={{ fontSize: 9, color: node.active ? 'var(--text-muted)' : '#555', cursor: 'pointer', flexShrink: 0, paddingLeft: 2 }}
          >
            {node.active ? '●' : '○'}
          </span>
        )}
        {!isRoot && (
          <span
            onClick={e => { e.stopPropagation(); onToggleFavorite?.(node.uuid) }}
            title={favorites?.has(node.uuid) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            style={{
              fontSize: 10, cursor: 'pointer', flexShrink: 0,
              color: '#fbbf24',
              opacity: favorites?.has(node.uuid) ? 1 : 0,
              transition: 'opacity 0.1s',
            }}
            className={favorites?.has(node.uuid) ? 'fav-star is-fav' : 'fav-star'}
          >★</span>
        )}
        {!isRoot && (
          <span
            onClick={e => { e.stopPropagation(); onToggleLocked?.(node.uuid) }}
            title={lockedUuids?.has(node.uuid) ? '잠금 해제' : '잠금'}
            style={{
              fontSize: 9, cursor: 'pointer', flexShrink: 0,
              color: '#f87171',
              opacity: lockedUuids?.has(node.uuid) ? 1 : 0,
              transition: 'opacity 0.1s',
            }}
            className={lockedUuids?.has(node.uuid) ? 'lock-icon is-locked' : 'lock-icon'}
          >🔒</span>
        )}
        {node.components.length > 0 && (() => {
          const typeIconMap: Record<string, string> = {
            'cc.Sprite': '🖼', 'cc.Label': 'T', 'cc.RichText': 'T',
            'cc.Button': '⊕', 'cc.Canvas': '⊞', 'cc.Layout': '⊟',
            'cc.ScrollView': '⊠', 'cc.Camera': '📷', 'cc.Animation': '▶',
            'cc.AudioSource': '♪', 'cc.ParticleSystem': '✦',
          }
          const icons = node.components
            .map(c => typeIconMap[c.type])
            .filter(Boolean)
          const label = icons.length > 0
            ? icons.join('')
            : node.components[0].type.replace('cc.', '').slice(0, 6)
          return (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }} title={node.components.map(c => c.type).join(', ')}>
              {label}
            </span>
          )
        })()}
      </div>
      {!collapsed && hasChildren && node.children.map(child => (
        <CCFileSceneTree
          key={child.uuid}
          node={child}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
          onReparent={onReparent}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onToggleActive={onToggleActive}
          hideInactive={hideInactive}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          lockedUuids={lockedUuids}
          onToggleLocked={onToggleLocked}
          nodeColors={nodeColors}
          onNodeColorChange={onNodeColorChange}
          collapsedUuids={collapsedUuids}
          onToggleCollapse={onToggleCollapse}
        />
      ))}
    </div>
  )
}

/** 스크러빙 라벨: 마우스 좌우 드래그로 숫자 값 조절 */
function ScrubLabel({ label, value, onChange, step = 1, inputRef }: { label: string; value: number; onChange: (v: number) => void; step?: number; inputRef?: React.RefObject<HTMLInputElement | null> }) {
  const startRef = useRef<{ x: number; v: number; moved: boolean } | null>(null)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startRef.current = { x: e.clientX, v: value, moved: false }
    const sensitivity = e.shiftKey ? 0.05 : 0.5
    const onMove = (me: MouseEvent) => {
      if (!startRef.current) return
      startRef.current.moved = true
      const dx = me.clientX - startRef.current.x
      const raw = startRef.current.v + dx * sensitivity * step
      onChange(Math.round(raw / step) * step)
    }
    const onUp = (ue: MouseEvent) => {
      const wasDrag = startRef.current?.moved ?? false
      startRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (!wasDrag) {
        // 클릭으로 처리: input에 포커스
        inputRef?.current?.focus()
        inputRef?.current?.select()
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  return (
    <span
      onMouseDown={handleMouseDown}
      title={`드래그로 ${label} 조절 (Shift: 미세 조절)`}
      style={{ width: 38, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, cursor: 'ew-resize', userSelect: 'none' }}
    >{label}</span>
  )
}

/** CCSceneNode 프로퍼티 인스펙터 — 노드 선택 시 표시 */
function CCFileNodeInspector({
  node, sceneFile, saveScene, onUpdate,
}: {
  node: CCSceneNode
  sceneFile: CCSceneFile
  saveScene: (root: CCSceneNode) => Promise<{ success: boolean; error?: string }>
  onUpdate: (n: CCSceneNode | null) => void
}) {
  // 편집 중인 로컬 상태 (노드 변경 시 초기화)
  const [draft, setDraft] = useState<CCSceneNode>(() => ({ ...node }))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Round 643: 저장 상태 + Undo/Redo
  const [isDirty, setIsDirty] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [undoStack, setUndoStack] = useState<Partial<CCSceneNode>[]>([])
  const [compOrder, setCompOrder] = useState<string[]>([])
  const [draggedComp, setDraggedComp] = useState<string | null>(null)
  const [colorPickerProp, setColorPickerProp] = useState<string | null>(null)
  const [nodePresets, setNodePresets] = useState<Array<{ name: string; props: Record<string, unknown> }>>(() => {
    try { return JSON.parse(localStorage.getItem('node-presets') ?? '[]') } catch { return [] }
  })
  const [nodePresetOpen, setNodePresetOpen] = useState(false)
  const [nodePresetCategories, setNodePresetCategories] = useState<Record<string, string[]>>({})
  const [selectedPresetCategory, setSelectedPresetCategory] = useState<string>('all')
  const [favoriteNodes, setFavoriteNodes] = useState<Array<{ uuid: string; name: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('favorite-nodes') ?? '[]') } catch { return [] }
  })
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [changeHistory, setChangeHistory] = useState<Array<{ timestamp: number; prop: string; oldVal: unknown; newVal: unknown }>>([])
  const [showHistory, setShowHistory] = useState(false)
  const [redoStack, setRedoStack] = useState<Partial<CCSceneNode>[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const COLLAPSED_COMPS_KEY = 'collapsed-comps'
  const [collapsedComps, setCollapsedComps] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_COMPS_KEY) ?? '[]')) }
    catch { return new Set() }
  })
  const [expandedArrayProps, setExpandedArrayProps] = useState<Set<string>>(new Set())
  const [lockScale, setLockScale] = useState(false)
  const secHeader = (key: string, label: string) => (
    <div onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
      style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', marginTop: 5, marginBottom: 3, userSelect: 'none' }}>
      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{collapsed[key] ? '▸' : '▾'}</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
    </div>
  )

  // 자식 노드 추가
  const handleAddChild = useCallback(async () => {
    if (!sceneFile.root || !sceneFile._raw) return
    const raw = sceneFile._raw as Record<string, unknown>[]
    const version = sceneFile.projectInfo.version ?? '2x'
    const newId = 'new-' + Date.now()
    const newIdx = raw.length

    const newRawEntry: Record<string, unknown> = version === '3x' ? {
      __type__: 'cc.Node', _id: newId, _name: 'NewNode', _active: true,
      _children: [], _components: [],
      _lpos: { x: 0, y: 0, z: 0 }, _lrot: { x: 0, y: 0, z: 0 }, _lscale: { x: 1, y: 1, z: 1 },
      _color: { r: 255, g: 255, b: 255, a: 255 }, _layer: 33554432,
      _uiProps: { _localOpacity: 1 },
    } : {
      __type__: 'cc.Node', _id: newId, _name: 'NewNode', _active: true,
      _children: [], _components: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0,0,0,0,0,0,1,1,1,1] },
      _contentSize: { width: 100, height: 100 }, _anchorPoint: { x: 0.5, y: 0.5 },
      _opacity: 255, _color: { r: 255, g: 255, b: 255, a: 255 },
    }
    raw.push(newRawEntry)

    const newNode: CCSceneNode = {
      uuid: newId, name: 'NewNode', active: true,
      position: { x: 0, y: 0, z: 0 },
      rotation: version === '3x' ? { x: 0, y: 0, z: 0 } : 0,
      scale: { x: 1, y: 1, z: 1 }, size: { x: 100, y: 100 }, anchor: { x: 0.5, y: 0.5 },
      opacity: 255, color: { r: 255, g: 255, b: 255, a: 255 },
      components: [], children: [], _rawIndex: newIdx,
    }

    function addChild(n: CCSceneNode): CCSceneNode {
      if (n.uuid === node.uuid) return { ...n, children: [...n.children, newNode] }
      return { ...n, children: n.children.map(addChild) }
    }

    setSaving(true)
    try {
      const result = await saveScene(addChild(sceneFile.root))
      if (result.success) onUpdate(newNode)
      else { raw.pop(); setMsg({ ok: false, text: result.error ?? '추가 실패' }) }
    } catch {
      raw.pop()
      setMsg({ ok: false, text: '추가 실패' })
    } finally {
      setSaving(false)
    }
  }, [node.uuid, sceneFile, saveScene, onUpdate])

  // 노드 삭제 (루트 보호)
  const handleDelete = useCallback(async () => {
    if (!sceneFile.root || sceneFile.root.uuid === node.uuid) return
    function removeNode(n: CCSceneNode): CCSceneNode {
      return { ...n, children: n.children.filter(c => c.uuid !== node.uuid).map(removeNode) }
    }
    setSaving(true)
    const result = await saveScene(removeNode(sceneFile.root))
    setSaving(false)
    if (result.success) onUpdate(null)
    else setMsg({ ok: false, text: result.error ?? '삭제 실패' })
  }, [node.uuid, sceneFile, saveScene, onUpdate])

  // 노드 복제 (부모 아래에 형제로 추가)
  const handleDuplicate = useCallback(async () => {
    if (!sceneFile.root || !sceneFile._raw || sceneFile.root.uuid === node.uuid) return
    const raw = sceneFile._raw as Record<string, unknown>[]
    const newId = 'dup-' + Date.now()
    const origRaw = node._rawIndex != null ? { ...raw[node._rawIndex] } : {}
    const newIdx = raw.length
    raw.push({ ...origRaw, _id: newId, _name: node.name + '_Copy', _children: [] })
    const dupNode: CCSceneNode = { ...node, uuid: newId, name: node.name + '_Copy', children: [], _rawIndex: newIdx }
    function insertAfter(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === node.uuid)
      if (idx >= 0) { const ch = [...n.children]; ch.splice(idx + 1, 0, dupNode); return { ...n, children: ch } }
      return { ...n, children: n.children.map(insertAfter) }
    }
    setSaving(true)
    try {
      const result = await saveScene(insertAfter(sceneFile.root))
      if (result.success) onUpdate(dupNode)
      else { raw.pop(); setMsg({ ok: false, text: result.error ?? '복제 실패' }) }
    } catch {
      raw.pop()
      setMsg({ ok: false, text: '복제 실패' })
    } finally {
      setSaving(false)
    }
  }, [node, sceneFile, saveScene, onUpdate])

  const [propSearch, setPropSearch] = useState('')
  const [showPropSearch, setShowPropSearch] = useState(false)

  // Round 611: prop 변경 히스토리
  const PROP_HISTORY_KEY = 'prop-history'
  type PropHistoryEntry = { id: string; propKey: string; nodeName: string; oldValue: unknown; newValue: unknown; ts: number }
  const [propHistory, setPropHistory] = useState<PropHistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(PROP_HISTORY_KEY) ?? '[]') }
    catch { return [] }
  })
  const [historyOpen, setHistoryOpen] = useState(false)

  // Round 631: 스타일 프리셋
  const STYLE_PRESETS_KEY = 'style-presets'
  type StylePreset = {
    id: string
    name: string
    position: CCSceneNode['position']
    rotation: CCSceneNode['rotation']
    scale: CCSceneNode['scale']
    size: CCSceneNode['size']
    anchor: CCSceneNode['anchor']
    opacity: number
  }
  const [stylePresets, setStylePresets] = useState<StylePreset[]>(() => {
    try { return JSON.parse(localStorage.getItem(STYLE_PRESETS_KEY) ?? '[]') }
    catch { return [] }
  })
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false)

  const saveStylePreset = useCallback(() => {
    const rawName = window.prompt('프리셋 이름', `${draft.name}-${Date.now()}`)
    if (rawName === null) return
    const name = rawName.trim() || `${draft.name}-${Date.now()}`
    const preset: StylePreset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      position: draft.position,
      rotation: draft.rotation,
      scale: draft.scale,
      size: draft.size,
      anchor: draft.anchor,
      opacity: draft.opacity,
    }
    setStylePresets(prev => {
      const next = [preset, ...prev].slice(0, 10)
      localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(next))
      return next
    })
  }, [draft])

  const FAV_PROPS_KEY = 'fav-props'
  const [favProps, setFavProps] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_PROPS_KEY) ?? '[]')) }
    catch { return new Set() }
  })
  const toggleFavProp = useCallback((compType: string, propKey: string) => {
    const id = `${compType}:${propKey}`
    setFavProps(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(FAV_PROPS_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  // 노드 교체 시 draft + 컴포넌트 접힘 상태 + propSearch 초기화
  useMemo(() => { setDraft({ ...node }); setExpandedArrayProps(new Set()); setPropSearch(''); setShowPropSearch(false) }, [node.uuid])
  const copiedCompRef = useRef<{ type: string; props: Record<string, unknown> } | null>(null)
  const [compCopied, setCompCopied] = useState<string | null>(null) // 복사된 comp type 표시용
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const rotation = typeof draft.rotation === 'number' ? draft.rotation : (draft.rotation as { z: number }).z ?? 0

  // debounce 타이머 ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<{ updated: CCSceneNode; root: CCSceneNode } | null>(null)

  // 실제 저장 실행 (debounced)
  const flushSave = useCallback(async () => {
    if (!pendingSaveRef.current) return
    const { updated, root } = pendingSaveRef.current
    pendingSaveRef.current = null
    setSaving(true)
    const result = await saveScene(root)
    setSaving(false)
    if (result.success) {
      setMsg({ ok: true, text: '저장됨' })
      setIsDirty(false)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 1500)
      onUpdate(updated)
    } else {
      setMsg({ ok: false, text: result.error ?? '저장 실패' })
    }
    setTimeout(() => setMsg(null), 2000)
  }, [saveScene, onUpdate])

  // 노드 값 패치 후 씬 저장 (draft는 즉시 반영, saveScene은 50ms debounce)
  const applyAndSave = useCallback((patch: Partial<CCSceneNode>) => {
    if (!sceneFile.root) return
    const updated = { ...draft, ...patch }
    setDraft(updated)

    // R699: changeHistory 이력 추가
    const patchKeysForHistory = Object.keys(patch)
    if (patchKeysForHistory.length > 0) {
      const historyEntry = {
        timestamp: Date.now(),
        prop: patchKeysForHistory[0],
        oldVal: (draft as Record<string, unknown>)[patchKeysForHistory[0]],
        newVal: (patch as Record<string, unknown>)[patchKeysForHistory[0]],
      }
      setChangeHistory(prev => [historyEntry, ...prev].slice(0, 20))
    }

    // Round 643: dirty + undo 스택
    setIsDirty(true)
    const patchKeys = Object.keys(patch)
    if (patchKeys.length > 0) {
      const prevPatch: Partial<CCSceneNode> = {}
      for (const k of patchKeys) {
        ;(prevPatch as Record<string, unknown>)[k] = (draft as Record<string, unknown>)[k]
      }
      setUndoStack(prev => [prevPatch, ...prev].slice(0, 10))
      setRedoStack([])
    }

    // Round 611: 히스토리 기록
    if (patchKeys.length > 0) {
      const propKey = patchKeys[0]
      const oldValue = (draft as Record<string, unknown>)[propKey]
      const newValue = (patch as Record<string, unknown>)[propKey]
      const entry: PropHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        propKey,
        nodeName: draft.name ?? draft.uuid,
        oldValue,
        newValue,
        ts: Date.now(),
      }
      setPropHistory(prev => {
        const next = [entry, ...prev].slice(0, 15)
        localStorage.setItem(PROP_HISTORY_KEY, JSON.stringify(next))
        return next
      })
    }

    // sceneFile.root에서 uuid 찾아 교체
    function replaceNode(n: CCSceneNode): CCSceneNode {
      if (n.uuid === updated.uuid) return updated
      return { ...n, children: n.children.map(replaceNode) }
    }
    const newRoot = replaceNode(sceneFile.root)

    // debounce: 50ms 이내 연속 호출 시 마지막 것만 저장
    pendingSaveRef.current = { updated, root: newRoot }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { flushSave() }, 50)
  }, [draft, sceneFile, flushSave])

  // Round 643: Undo/Redo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const [prev, ...rest] = undoStack
    // 현재 값을 redo 스택에 보존
    const currentPatch: Partial<CCSceneNode> = {}
    for (const k of Object.keys(prev)) {
      ;(currentPatch as Record<string, unknown>)[k] = (draft as Record<string, unknown>)[k]
    }
    setRedoStack(r => [currentPatch, ...r].slice(0, 10))
    setUndoStack(rest)
    applyAndSave(prev)
  }, [undoStack, draft, applyAndSave])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const [next, ...rest] = redoStack
    setRedoStack(rest)
    applyAndSave(next)
  }, [redoStack, applyAndSave])

  // Round 635: Transform 복사/붙여넣기
  const [copyDone, setCopyDone] = useState(false)
  const handleCopyTransform = useCallback(async () => {
    const snap: TransformSnapshot = {
      position: draft.position,
      rotation: draft.rotation,
      scale: draft.scale,
      size: draft.size,
      anchor: draft.anchor,
      opacity: draft.opacity,
    }
    transformClipboard = snap
    try {
      await navigator.clipboard.writeText(JSON.stringify(snap))
    } catch { /* fallback already set */ }
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 1500)
  }, [draft])

  const handlePasteTransform = useCallback(async () => {
    let snap: TransformSnapshot | null = null
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text) as Partial<TransformSnapshot>
      if (parsed && typeof parsed === 'object' && 'position' in parsed) {
        snap = parsed as TransformSnapshot
      }
    } catch { /* ignore, try fallback */ }
    if (!snap && transformClipboard) snap = transformClipboard
    if (!snap) return
    applyAndSave({
      position: snap.position,
      rotation: snap.rotation,
      scale: snap.scale,
      size: snap.size,
      anchor: snap.anchor,
      opacity: snap.opacity,
    })
  }, [applyAndSave])

  // Round 631: 프리셋 적용 / 삭제 (applyAndSave 이후 정의)
  const applyStylePreset = useCallback((preset: StylePreset) => {
    applyAndSave({
      position: preset.position,
      rotation: preset.rotation,
      scale: preset.scale,
      size: preset.size,
      anchor: preset.anchor,
      opacity: preset.opacity,
    })
    setPresetDropdownOpen(false)
  }, [applyAndSave])

  const deleteStylePreset = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setStylePresets(prev => {
      const next = prev.filter(p => p.id !== id)
      localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // R673: 노드 프리셋 저장 / 적용 / 삭제
  const saveNodePreset = useCallback(() => {
    const rawName = window.prompt('프리셋 이름', `${draft.name}-${Date.now()}`)
    if (rawName === null) return
    const name = rawName.trim() || `${draft.name}-${Date.now()}`
    const props: Record<string, unknown> = {
      position: draft.position,
      rotation: draft.rotation,
      scale: draft.scale,
      size: draft.size,
      anchor: draft.anchor,
      opacity: draft.opacity,
      active: draft.active,
      color: draft.color,
    }
    setNodePresets(prev => {
      const next = [{ name, props }, ...prev].slice(0, 20)
      localStorage.setItem('node-presets', JSON.stringify(next))
      return next
    })
  }, [draft])

  const applyNodePreset = useCallback((preset: { name: string; props: Record<string, unknown> }) => {
    applyAndSave(preset.props as Partial<CCSceneNode>)
    setNodePresetOpen(false)
  }, [applyAndSave])

  const deleteNodePreset = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setNodePresets(prev => {
      const next = prev.filter((_, i) => i !== idx)
      localStorage.setItem('node-presets', JSON.stringify(next))
      return next
    })
  }, [])

  // R691: 노드 즐겨찾기 토글
  const toggleFavoriteNode = useCallback(() => {
    setFavoriteNodes(prev => {
      const exists = prev.some(f => f.uuid === node.uuid)
      const next = exists
        ? prev.filter(f => f.uuid !== node.uuid)
        : [...prev, { uuid: node.uuid, name: node.name }]
      localStorage.setItem('favorite-nodes', JSON.stringify(next))
      return next
    })
  }, [node.uuid, node.name])

  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    step = 1,
  ) => {
    const inputRef = { current: null } as React.RefObject<HTMLInputElement | null>
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <ScrubLabel label={label} value={value} onChange={onChange} step={step} inputRef={inputRef} />
        <input
          ref={inputRef}
          type="number"
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          onBlur={e => onChange(parseFloat(e.target.value) || 0)}
          onWheel={e => {
            e.preventDefault()
            const current = parseFloat((e.target as HTMLInputElement).value)
            if (isNaN(current)) return
            const delta = e.deltaY < 0 ? step : -step
            const multiplier = e.shiftKey ? 10 : 1
            onChange(current + delta * multiplier)
          }}
          style={{
            flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
          }}
        />
      </div>
    )
  }

  // 노드 경로 계산 (root → 선택 노드)
  const nodePath = useMemo(() => {
    const path: string[] = []
    function find(n: CCSceneNode, target: string): boolean {
      if (n.uuid === target) { path.push(n.name); return true }
      for (const c of n.children) {
        path.push(n.name)
        if (find(c, target)) return true
        path.pop()
      }
      return false
    }
    find(sceneFile.root, node.uuid)
    return path
  }, [sceneFile.root, node.uuid])

  // Z-order 정보 (같은 부모 내 인덱스, 형제 수)
  const zOrderInfo = useMemo(() => {
    function findParent(n: CCSceneNode): CCSceneNode | null {
      for (const c of n.children) {
        if (c.uuid === node.uuid) return n
        const found = findParent(c)
        if (found) return found
      }
      return null
    }
    const parent = findParent(sceneFile.root)
    if (!parent) return null
    const idx = parent.children.findIndex(c => c.uuid === node.uuid)
    return { idx, total: parent.children.length }
  }, [sceneFile.root, node.uuid])

  // Z-order (같은 부모 내 순서 이동)
  const handleZOrder = useCallback(async (dir: 1 | -1) => {
    if (!sceneFile.root) return
    function move(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === node.uuid)
      if (idx < 0) return { ...n, children: n.children.map(move) }
      const ch = [...n.children]
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= ch.length) return n
      ;[ch[idx], ch[newIdx]] = [ch[newIdx], ch[idx]]
      return { ...n, children: ch }
    }
    setSaving(true)
    await saveScene(move(sceneFile.root))
    setSaving(false)
  }, [node.uuid, sceneFile, saveScene])

  // Z-order 맨 앞/뒤로 이동
  const handleZOrderEdge = useCallback(async (edge: 'first' | 'last') => {
    if (!sceneFile.root) return
    function move(n: CCSceneNode): CCSceneNode {
      const idx = n.children.findIndex(c => c.uuid === node.uuid)
      if (idx < 0) return { ...n, children: n.children.map(move) }
      const ch = [...n.children]
      const [item] = ch.splice(idx, 1)
      if (edge === 'first') ch.unshift(item)
      else ch.push(item)
      return { ...n, children: ch }
    }
    setSaving(true)
    await saveScene(move(sceneFile.root))
    setSaving(false)
  }, [node.uuid, sceneFile, saveScene])

  return (
    <div style={{
      flexShrink: 0, borderTop: '1px solid var(--border)',
      padding: '6px 10px', background: 'var(--bg-secondary, #0d0d1a)', maxHeight: 420, overflowY: 'auto',
    }}>
      {nodePath.length > 1 && (
        <div style={{ fontSize: 9, color: '#555', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nodePath.join(' / ')}>
          {nodePath.slice(0, -1).map((p, i) => (
            <span key={i}><span>{p}</span><span style={{ margin: '0 3px' }}>/</span></span>
          ))}
          <span style={{ color: 'var(--accent)' }}>{nodePath[nodePath.length - 1]}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <input
          defaultValue={draft.name}
          onBlur={e => applyAndSave({ name: e.target.value })}
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', flex: 1, minWidth: 0 }}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* R683: 프로퍼티 검색 토글 */}
          <button
            onClick={() => { setShowPropSearch(o => !o); if (showPropSearch) setPropSearch('') }}
            title="프로퍼티 검색"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
              background: showPropSearch ? 'rgba(88,166,255,0.15)' : 'transparent',
              color: showPropSearch ? '#58a6ff' : '#555',
              border: `1px solid ${showPropSearch ? '#58a6ff' : '#444'}`,
              lineHeight: 1.4,
            }}
          >
            🔍
          </button>
          {/* Round 643: 저장 상태 배지 */}
          {saving
            ? <span title="저장 중" style={{ fontSize: 10, color: '#94a3b8' }}>⏳</span>
            : isDirty
            ? <span title="미저장 변경" style={{ fontSize: 10, color: '#f97316' }}>●</span>
            : savedToast
            ? <span title="저장 완료" style={{ fontSize: 10, color: '#4ade80' }}>✓</span>
            : null}
          {msg && <span style={{ fontSize: 9, color: msg.ok ? '#4ade80' : '#f85149' }}>{msg.text}</span>}
          {/* Round 643: Undo/Redo 버튼 */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="실행 취소 (Undo)"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, lineHeight: 1.4,
              background: 'transparent', border: `1px solid ${undoStack.length === 0 ? '#333' : '#555'}`,
              color: undoStack.length === 0 ? '#333' : '#94a3b8', cursor: undoStack.length === 0 ? 'default' : 'pointer',
            }}
          >↩</button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="다시 실행 (Redo)"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, lineHeight: 1.4,
              background: 'transparent', border: `1px solid ${redoStack.length === 0 ? '#333' : '#555'}`,
              color: redoStack.length === 0 ? '#333' : '#94a3b8', cursor: redoStack.length === 0 ? 'default' : 'pointer',
            }}
          >↪</button>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={e => applyAndSave({ active: e.target.checked })}
              style={{ margin: 0 }}
            />
            활성
          </label>
          {/* Round 635: Transform 복사/붙여넣기 */}
          <button
            onClick={handleCopyTransform}
            title="Transform 복사 (position/rotation/scale/size/anchor/opacity)"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: copyDone ? '#4ade80' : '#94a3b8', border: `1px solid ${copyDone ? '#4ade80' : '#94a3b8'}`,
              lineHeight: 1.4, transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            {copyDone ? '✓' : '⎘'}
          </button>
          <button
            onClick={handlePasteTransform}
            title="Transform 붙여넣기"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#94a3b8', border: '1px solid #94a3b8',
              lineHeight: 1.4,
            }}
          >
            📋
          </button>
          {/* Round 631: 프리셋 저장 / 불러오기 */}
          <button
            onClick={saveStylePreset}
            title="현재 Transform을 프리셋으로 저장"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#fbbf24', border: '1px solid #fbbf24',
              lineHeight: 1.4,
            }}
          >
            💾
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setPresetDropdownOpen(o => !o)}
              title="저장된 프리셋 불러오기"
              style={{
                padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: presetDropdownOpen ? '#1e1e2e' : 'transparent',
                color: '#60a5fa', border: '1px solid #60a5fa',
                lineHeight: 1.4,
              }}
            >
              📂
            </button>
            {presetDropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 2,
                background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border, #2a2a3a)',
                borderRadius: 4, zIndex: 50, minWidth: 160, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {stylePresets.length === 0 ? (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)' }}>저장된 프리셋 없음</div>
                ) : stylePresets.map(preset => (
                  <div
                    key={preset.id}
                    onClick={() => applyStylePreset(preset)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', cursor: 'pointer', fontSize: 10,
                      color: 'var(--text-primary, #ccc)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #1a1a2e)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {preset.name}
                    </span>
                    <span
                      onClick={e => deleteStylePreset(preset.id, e)}
                      style={{ marginLeft: 6, color: '#f85149', cursor: 'pointer', flexShrink: 0 }}
                      title="프리셋 삭제"
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* R673: 노드 프리셋 저장 / 불러오기 */}
          <button
            onClick={saveNodePreset}
            title="현재 노드 프로퍼티를 프리셋으로 저장"
            style={{
              padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#34d399', border: '1px solid #34d399',
              lineHeight: 1.4,
            }}
          >
            N+
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setNodePresetOpen(o => !o)}
              title="저장된 노드 프리셋 불러오기"
              style={{
                padding: '1px 4px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                background: nodePresetOpen ? '#1e1e2e' : 'transparent',
                color: '#34d399', border: '1px solid #34d399',
                lineHeight: 1.4,
              }}
            >
              N▾
            </button>
            {nodePresetOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 2,
                background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border, #2a2a3a)',
                borderRadius: 4, zIndex: 50, minWidth: 160, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {nodePresets.length === 0 ? (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)' }}>저장된 프리셋 없음</div>
                ) : nodePresets.map((preset, idx) => (
                  <div
                    key={idx}
                    onClick={() => applyNodePreset(preset)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', cursor: 'pointer', fontSize: 10,
                      color: 'var(--text-primary, #ccc)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #1a1a2e)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {preset.name}
                    </span>
                    <span
                      onClick={e => deleteNodePreset(idx, e)}
                      style={{ marginLeft: 6, color: '#f85149', cursor: 'pointer', flexShrink: 0 }}
                      title="프리셋 삭제"
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => applyAndSave({
              position: { ...draft.position, x: 0, y: 0 },
              rotation: typeof draft.rotation === 'number' ? 0 : { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: draft.scale.z ?? 1 },
            })}
            title="Transform 리셋 (position 0,0 / rotation 0 / scale 1,1)"
            style={{
              padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#a78bfa', border: '1px solid #a78bfa',
              lineHeight: 1.4,
            }}
          >
            ⟳ Reset
          </button>
          {/* R691: 즐겨찾기 토글 버튼 + 드롭다운 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={toggleFavoriteNode}
              title={favoriteNodes.some(f => f.uuid === node.uuid) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
              style={{
                padding: '1px 4px', fontSize: 12, borderRadius: 3, cursor: 'pointer',
                background: 'transparent',
                color: favoriteNodes.some(f => f.uuid === node.uuid) ? '#fbbf24' : '#555',
                border: `1px solid ${favoriteNodes.some(f => f.uuid === node.uuid) ? '#fbbf24' : '#444'}`,
                lineHeight: 1.4,
              }}
            >
              {favoriteNodes.some(f => f.uuid === node.uuid) ? '★' : '☆'}
            </button>
            <button
              onClick={() => setFavoritesOpen(o => !o)}
              title="즐겨찾기 목록"
              style={{
                padding: '1px 3px', fontSize: 9, borderRadius: 3, cursor: 'pointer',
                background: favoritesOpen ? '#1e1e2e' : 'transparent',
                color: '#fbbf24', border: '1px solid #555',
                lineHeight: 1.4, marginLeft: 1,
              }}
            >
              ▾
            </button>
            {favoritesOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 2,
                background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border, #2a2a3a)',
                borderRadius: 4, zIndex: 50, minWidth: 160, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                {favoriteNodes.length === 0 ? (
                  <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)' }}>즐겨찾기 없음</div>
                ) : favoriteNodes.map(fav => (
                  <div
                    key={fav.uuid}
                    onClick={() => { console.log('favorite select', fav.uuid); setFavoritesOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', cursor: 'pointer', fontSize: 10,
                      color: fav.uuid === node.uuid ? '#fbbf24' : 'var(--text-primary, #ccc)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #1a1a2e)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {fav.uuid === node.uuid ? '★ ' : '☆ '}{fav.name}
                    </span>
                    <span
                      onClick={e => {
                        e.stopPropagation()
                        setFavoriteNodes(prev => {
                          const next = prev.filter(f => f.uuid !== fav.uuid)
                          localStorage.setItem('favorite-nodes', JSON.stringify(next))
                          return next
                        })
                      }}
                      style={{ marginLeft: 6, color: '#f85149', cursor: 'pointer', flexShrink: 0 }}
                      title="즐겨찾기 삭제"
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAddChild}
            title="자식 노드 추가"
            style={{
              padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#4ade80', border: '1px solid #4ade80',
              lineHeight: 1.4,
            }}
          >
            + 자식
          </button>
          {sceneFile.root?.uuid !== node.uuid && (
            <>
              {zOrderInfo && (
                <span style={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap', userSelect: 'none' }}>
                  Z: {zOrderInfo.idx + 1} / {zOrderInfo.total}
                </span>
              )}
              <button onClick={() => handleZOrderEdge('first')} disabled={!zOrderInfo || zOrderInfo.idx === 0} title="맨 앞으로" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === 0 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === 0 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === 0 ? '#333' : '#555'}`, lineHeight: 1.4 }}>⤒</button>
              <button onClick={() => handleZOrder(-1)} disabled={!zOrderInfo || zOrderInfo.idx === 0} title="앞으로 이동" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === 0 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === 0 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === 0 ? '#333' : '#555'}`, lineHeight: 1.4 }}>↑</button>
              <button onClick={() => handleZOrder(1)} disabled={!zOrderInfo || zOrderInfo.idx === zOrderInfo.total - 1} title="뒤로 이동" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === zOrderInfo?.total - 1 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#333' : '#555'}`, lineHeight: 1.4 }}>↓</button>
              <button onClick={() => handleZOrderEdge('last')} disabled={!zOrderInfo || zOrderInfo.idx === zOrderInfo.total - 1} title="맨 뒤로" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: zOrderInfo?.idx === zOrderInfo?.total - 1 ? 'default' : 'pointer', background: 'transparent', color: zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#444' : '#888', border: `1px solid ${zOrderInfo?.idx === zOrderInfo?.total - 1 ? '#333' : '#555'}`, lineHeight: 1.4 }}>⤓</button>
              <button
                onClick={handleDuplicate}
                title="노드 복제"
                style={{
                  padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                  background: 'transparent', color: '#58a6ff', border: '1px solid #58a6ff',
                  lineHeight: 1.4,
                }}
              >
                복제
              </button>
              <button
                onClick={handleDelete}
                title="노드 삭제"
                style={{
                  padding: '1px 5px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                  background: 'transparent', color: '#f85149', border: '1px solid #f85149',
                  lineHeight: 1.4,
                }}
              >
                삭제
              </button>
            </>
          )}
          {/* R699: 변경 이력 토글 버튼 */}
          <button
            onClick={() => setShowHistory(o => !o)}
            title="변경 이력 보기"
            style={{
              padding: '1px 4px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
              background: showHistory ? 'rgba(88,166,255,0.15)' : 'transparent',
              color: showHistory ? '#58a6ff' : '#555',
              border: `1px solid ${showHistory ? '#58a6ff' : '#444'}`,
              lineHeight: 1.4,
            }}
          >
            📜
          </button>
        </div>
      </div>

      {/* R699: 변경 이력 패널 */}
      {showHistory && (
        <div style={{ marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>변경 이력 ({changeHistory.length})</span>
            {changeHistory.length > 0 && (
              <span
                onClick={() => setChangeHistory([])}
                style={{ fontSize: 9, color: '#f85149', cursor: 'pointer' }}
                title="이력 지우기"
              >
                지우기
              </span>
            )}
          </div>
          {changeHistory.length === 0 ? (
            <div style={{ fontSize: 9, color: '#555', padding: '3px 0' }}>변경 이력이 없습니다.</div>
          ) : (
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {changeHistory.map((entry, i) => (
                <div key={i} style={{ fontSize: 9, display: 'flex', gap: 4, alignItems: 'flex-start', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <span style={{ color: '#555', flexShrink: 0 }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  <span style={{ color: '#58a6ff', flexShrink: 0 }}>{entry.prop}</span>
                  <span style={{ color: '#f85149', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }} title={JSON.stringify(entry.oldVal)}>
                    {JSON.stringify(entry.oldVal)}
                  </span>
                  <span style={{ color: '#555', flexShrink: 0 }}>→</span>
                  <span style={{ color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }} title={JSON.stringify(entry.newVal)}>
                    {JSON.stringify(entry.newVal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* R683: 프로퍼티 검색창 */}
      {showPropSearch && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <input
            autoFocus
            placeholder="프로퍼티 이름 / 값 검색..."
            value={propSearch}
            onChange={e => setPropSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setPropSearch(''); setShowPropSearch(false) } }}
            style={{
              flex: 1, fontSize: 10, padding: '3px 6px', borderRadius: 3,
              background: 'var(--bg-input, #1a1a2e)', border: '1px solid var(--accent)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          {propSearch && (
            <span
              onClick={() => setPropSearch('')}
              style={{ cursor: 'pointer', color: '#888', fontSize: 12, lineHeight: 1 }}
              title="검색 초기화"
            >
              ×
            </span>
          )}
        </div>
      )}
      {secHeader('transform', '위치 / 크기 / 회전')}
      {!collapsed['transform'] && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              위치
              <span title="위치 리셋 (0,0)" onClick={() => applyAndSave({ position: { ...draft.position, x: 0, y: 0 } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↺</span>
            </div>
            {numInput('X', draft.position.x, v => applyAndSave({ position: { ...draft.position, x: v } }))}
            {numInput('Y', draft.position.y, v => applyAndSave({ position: { ...draft.position, y: v } }))}
            <div style={{ fontSize: 9, color: 'var(--text-muted)', margin: '5px 0 3px', display: 'flex', alignItems: 'center', gap: 4 }}>
              회전
              <span title="회전 리셋 (0°)" onClick={() => applyAndSave({ rotation: typeof draft.rotation === 'number' ? 0 : { x: 0, y: 0, z: 0 } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↺</span>
            </div>
            {numInput('Z°', rotation, v => {
              const r = typeof draft.rotation === 'number' ? v : { ...(draft.rotation as object), z: v } as CCSceneNode['rotation']
              applyAndSave({ rotation: r })
            })}
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>크기</div>
            {numInput('W', draft.size.x, v => applyAndSave({ size: { ...draft.size, x: v } }))}
            {numInput('H', draft.size.y, v => applyAndSave({ size: { ...draft.size, y: v } }))}
            <div style={{ fontSize: 9, color: 'var(--text-muted)', margin: '5px 0 3px', display: 'flex', alignItems: 'center', gap: 4 }}>
              스케일
              <span title="스케일 리셋 (1,1)" onClick={() => applyAndSave({ scale: { x: 1, y: 1, z: draft.scale.z ?? 1 } })} style={{ cursor: 'pointer', color: '#555', fontSize: 8 }} onMouseEnter={e => (e.currentTarget.style.color = '#aaa')} onMouseLeave={e => (e.currentTarget.style.color = '#555')}>↺</span>
              <span
                title={lockScale ? '비율 잠금 해제' : '비율 잠금'}
                onClick={() => setLockScale(l => !l)}
                style={{ cursor: 'pointer', fontSize: 9, color: lockScale ? '#58a6ff' : '#555' }}
                onMouseEnter={e => (e.currentTarget.style.color = lockScale ? '#7fc6ff' : '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = lockScale ? '#58a6ff' : '#555')}
              >{lockScale ? '🔒' : '🔓'}</span>
            </div>
            {numInput('X', draft.scale.x, v => {
              const ratio = draft.scale.x !== 0 ? v / draft.scale.x : 1
              applyAndSave({ scale: lockScale ? { x: v, y: draft.scale.y * ratio, z: draft.scale.z ?? 1 } : { ...draft.scale, x: v } })
            }, 0.01)}
            {numInput('Y', draft.scale.y, v => {
              const ratio = draft.scale.y !== 0 ? v / draft.scale.y : 1
              applyAndSave({ scale: lockScale ? { x: draft.scale.x * ratio, y: v, z: draft.scale.z ?? 1 } : { ...draft.scale, y: v } })
            }, 0.01)}
          </div>
        </div>
      )}

      {secHeader('anchor', '앵커 / 불투명도')}
      {!collapsed['anchor'] && (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
          {numInput('aX', draft.anchor.x, v => applyAndSave({ anchor: { ...draft.anchor, x: v } }), 0.01)}
          {numInput('aY', draft.anchor.y, v => applyAndSave({ anchor: { ...draft.anchor, y: v } }), 0.01)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ width: 38, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>α (불투명)</span>
          <input
            type="range"
            min={0}
            max={255}
            step={1}
            value={draft.opacity ?? 255}
            onChange={e => applyAndSave({ opacity: Number(e.target.value) })}
            style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent)' }}
          />
          <span style={{ width: 36, fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
            {Math.round(((draft.opacity ?? 255) / 255) * 100)}%
          </span>
        </div>
        {/* 앵커 9-point grid 프리셋 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 14px)', gap: 1, marginTop: 4, justifyContent: 'start' }}>
          {([0, 0.5, 1] as const).flatMap(ay => ([0, 0.5, 1] as const).map(ax => {
            const isActive = Math.abs(draft.anchor.x - ax) < 0.01 && Math.abs(draft.anchor.y - ay) < 0.01
            return (
              <div
                key={`${ax}-${ay}`}
                title={`앵커 (${ax}, ${ay})`}
                onClick={() => applyAndSave({ anchor: { x: ax, y: ay } })}
                style={{
                  width: 14, height: 14, borderRadius: 2, cursor: 'pointer',
                  background: isActive ? '#58a6ff' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            )
          }))}
        </div>
      </div>
      )}

      {draft.layer != null && (() => {
        const layerOptions: [number, string][] = [
          [1, 'DEFAULT'], [2, 'IGNORE_RAYCAST'], [4, 'GIZMOS'], [8, 'EDITOR'],
          [16, 'UI_3D'], [32, 'SCENE_GIZMO'], [64, 'PROFILER'],
          [524288, 'UI_2D'], [1073741824, 'ALL'],
        ]
        const isKnown = layerOptions.some(([v]) => v === draft.layer)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ width: 38, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>layer</span>
            <select
              value={isKnown ? draft.layer : 'custom'}
              onChange={e => { if (e.target.value !== 'custom') applyAndSave({ layer: Number(e.target.value) }) }}
              style={{
                flex: 1, fontSize: 9, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', borderRadius: 3, padding: '2px 3px',
              }}
            >
              {layerOptions.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              {!isKnown && <option value="custom">0x{draft.layer.toString(16)}</option>}
            </select>
          </div>
        )
      })()}

      {secHeader('color', '색상')}
      {!collapsed['color'] && (
      <div style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="color"
            value={`#${[draft.color.r, draft.color.g, draft.color.b].map(v => Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('')}`}
            onChange={e => {
              const hex = e.target.value.slice(1)
              const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
              applyAndSave({ color: { r, g, b, a: draft.color.a } })
            }}
            style={{ width: 28, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', background: 'none' }}
          />
          {numInput('A', draft.color.a, v => applyAndSave({ color: { ...draft.color, a: Math.min(255,Math.max(0,Math.round(v))) } }))}
        </div>
      </div>
      )}

      {/* 컴포넌트 props */}
      {secHeader('comps', `컴포넌트 (${draft.components.length})`)}
      {!collapsed['comps'] && (() => {
        const skipTypes = ['cc.UITransform', 'cc.Canvas', 'cc.PrefabInfo', 'cc.CompPrefabInfo', 'cc.SceneGlobals', 'cc.AmbientInfo', 'cc.ShadowsInfo', 'cc.FogInfo', 'cc.OctreeInfo', 'cc.SkyboxInfo']
        const visibleComps = draft.components.map((c, origIdx) => ({ comp: c, origIdx })).filter(({ comp: c }) => {
          if (skipTypes.includes(c.type)) return false
          return Object.values(c.props).some(v => {
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return true
            if (v && typeof v === 'object') {
              if ('__uuid__' in (v as object)) return true
              const keys = Object.keys(v as object).filter(k => typeof (v as Record<string, unknown>)[k] === 'number')
              if (keys.length >= 2 && keys.length <= 3) return true
            }
            return false
          })
        })
        // propSearch로 컴포넌트 타입 매칭: 해당 타입은 전체 표시 (자동 펼침)
        const typeMatchedComps = propSearch
          ? visibleComps.filter(({ comp: c }) => c.type.toLowerCase().includes(propSearch.toLowerCase()))
          : null
        const showComps = typeMatchedComps ?? visibleComps
        return showComps.map(({ comp, origIdx }, ci) => (
        <div
          key={`${node.uuid}-${origIdx}`}
          style={{ marginTop: 6, borderTop: dragOverIdx === ci ? '2px solid var(--accent)' : '1px solid var(--border)', paddingTop: 5, opacity: draggingIdx === ci ? 0.4 : 1 }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(ci) }}
          onDragLeave={() => setDragOverIdx(null)}
          onDrop={e => {
            e.preventDefault()
            setDragOverIdx(null)
            setDraggingIdx(null)
            const fromCi = parseInt(e.dataTransfer.getData('compCi'))
            if (isNaN(fromCi) || fromCi === ci) return
            const fromOrigIdx = visibleComps[fromCi]?.origIdx
            const toOrigIdx = origIdx
            if (fromOrigIdx == null || fromOrigIdx === toOrigIdx) return
            const newComps = [...draft.components]
            const [moved] = newComps.splice(fromOrigIdx, 1)
            // splice 후 toOrigIdx 보정: from이 to보다 앞에 있으면 한 칸 앞당겨짐
            const adjustedTo = fromOrigIdx < toOrigIdx ? toOrigIdx - 1 : toOrigIdx
            newComps.splice(adjustedTo, 0, moved)
            applyAndSave({ components: newComps })
          }}
        >
          <div
            style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setCollapsedComps(s => {
              const n = new Set(s)
              if (n.has(comp.type)) n.delete(comp.type); else n.add(comp.type)
              localStorage.setItem(COLLAPSED_COMPS_KEY, JSON.stringify([...n]))
              return n
            })}
          >
            <span
              draggable
              onDragStart={e => { e.dataTransfer.setData('compCi', String(ci)); e.dataTransfer.effectAllowed = 'move'; setDraggingIdx(ci) }}
              onDragEnd={() => { setDraggingIdx(null); setDragOverIdx(null) }}
              onClick={e => e.stopPropagation()}
              style={{ cursor: 'grab', padding: '0 4px', opacity: 0.5, fontSize: 10, lineHeight: 1 }}
              title="드래그하여 순서 변경"
            >⠿</span>
            <span style={{ fontSize: 7, color: 'var(--text-muted)', marginRight: 3 }}>{collapsedComps.has(comp.type) ? '▸' : '▾'}</span>
            <span style={{ flex: 1 }}>{comp.type.includes('.') ? comp.type.split('.').pop() : comp.type}</span>
            {showComps.length > 1 && (
              <span style={{ fontSize: 9, color: 'var(--text-muted)', marginRight: 4 }}>#{ci + 1}</span>
            )}
            {compCopied && copiedCompRef.current && copiedCompRef.current.type !== comp.type && (
              <span
                title={`${copiedCompRef.current.type.split('.').pop()} 붙여넣기`}
                onClick={e => {
                  e.stopPropagation()
                  if (!copiedCompRef.current) return
                  applyAndSave({ components: [...draft.components, { ...copiedCompRef.current }] })
                  setCompCopied(null)
                }}
                style={{ cursor: 'pointer', color: '#58a6ff', fontSize: 9, padding: '0 3px', lineHeight: 1 }}
              >📋</span>
            )}
            <span
              title="컴포넌트 복사"
              onClick={e => {
                e.stopPropagation()
                copiedCompRef.current = { type: comp.type, props: { ...comp.props } }
                setCompCopied(comp.type)
                setTimeout(() => setCompCopied(null), 3000)
              }}
              style={{ cursor: 'pointer', color: compCopied === comp.type ? '#58a6ff' : '#666', fontSize: 9, padding: '0 3px', lineHeight: 1 }}
            >{compCopied === comp.type ? '✓' : '⎘'}</span>
            <span
              title="컴포넌트 삭제"
              onClick={e => { e.stopPropagation(); applyAndSave({ components: draft.components.filter((_, i) => i !== origIdx) }) }}
              style={{ cursor: 'pointer', color: '#666', fontSize: 10, padding: '0 2px', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ff6666')}
              onMouseLeave={e => (e.currentTarget.style.color = '#666')}
            >✕</span>
          </div>
          {(!collapsedComps.has(comp.type) || typeMatchedComps !== null) && (() => {
            const HIDDEN = new Set(['objFlags', 'enabled', 'playOnLoad', 'id', 'prefab', 'compPrefabInfo', 'contentSize', 'anchorPoint', 'N$file', 'N$spriteAtlas', 'N$clips', 'N$defaultClip'])
            const allProps = Object.entries(comp.props).filter(([k]) => {
              if (HIDDEN.has(k)) return false
              return true
            })
            const showFilter = allProps.length >= 3
            // 타입 매칭 시 전체 prop 표시, 아닐 때만 prop 이름 필터
            const isTypeMatch = typeMatchedComps !== null
            const baseFiltered = (propSearch && !isTypeMatch)
              ? allProps.filter(([k]) => k.toLowerCase().includes(propSearch.toLowerCase()))
              : allProps
            // 즐겨찾기 prop을 맨 앞으로 정렬
            const filteredProps = [
              ...baseFiltered.filter(([k]) => favProps.has(`${comp.type}:${k}`)),
              ...baseFiltered.filter(([k]) => !favProps.has(`${comp.type}:${k}`)),
            ]
            return (
              <>
                {showFilter && (
                  <input
                    placeholder="Filter properties..."
                    value={propSearch}
                    onChange={e => setPropSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setPropSearch('') }}
                    style={{
                      width: '100%', boxSizing: 'border-box', marginBottom: 4,
                      background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 9,
                    }}
                  />
                )}
                {filteredProps.map(([k, v]) => {
            const isFavProp = favProps.has(`${comp.type}:${k}`)
            const favBtn = (
              <span
                key="fav"
                className={isFavProp ? 'prop-fav is-fav' : 'prop-fav'}
                title={isFavProp ? '즐겨찾기 해제' : '즐겨찾기'}
                onClick={e => { e.stopPropagation(); toggleFavProp(comp.type, k) }}
                style={{
                  cursor: 'pointer', fontSize: 9, flexShrink: 0,
                  color: '#fbbf24',
                  opacity: isFavProp ? 1 : 0,
                  transition: 'opacity 0.1s',
                  paddingLeft: 2,
                }}
              >{isFavProp ? '★' : '☆'}</span>
            )
            if (v && typeof v === 'object' && '__uuid__' in (v as object)) {
              const uuid = (v as { __uuid__: string }).__uuid__
              return (
                <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{k}{favBtn}</span>
                  <span style={{
                    flex: 1, fontSize: 9, color: '#888', fontFamily: 'monospace',
                    background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '2px 5px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    title: uuid,
                  }} title={uuid}>
                    {uuid.slice(0, 8)}…
                  </span>
                </div>
              )
            }
            // 벡터 타입 {x,y} 또는 {x,y,z} → 인라인 숫자 인풋
            if (v && typeof v === 'object' && !('__uuid__' in (v as object)) && !('__id__' in (v as object))) {
              const vobj = v as Record<string, unknown>
              const numKeys = Object.keys(vobj).filter(k => typeof vobj[k] === 'number')
              // RGBA 컬러 피커: r/g/b 키가 모두 있는 객체 (cc.Color 포함)
              const hasRgb = ['r', 'g', 'b'].every(c => c in vobj && typeof vobj[c] === 'number')
              if (hasRgb) {
                const r = Math.round(Math.min(255, Math.max(0, Number(vobj.r ?? 0))))
                const g = Math.round(Math.min(255, Math.max(0, Number(vobj.g ?? 0))))
                const b = Math.round(Math.min(255, Math.max(0, Number(vobj.b ?? 0))))
                const hasAlpha = 'a' in vobj && typeof vobj.a === 'number'
                const a = hasAlpha ? Math.round(Math.min(255, Math.max(0, Number(vobj.a ?? 255)))) : undefined
                const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                return (
                  <div key={k} className="prop-row" style={{ marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{k}{favBtn}</span>
                      <input
                        type="color"
                        value={hex}
                        onChange={e => {
                          const h = e.target.value
                          const r2 = parseInt(h.slice(1, 3), 16)
                          const g2 = parseInt(h.slice(3, 5), 16)
                          const b2 = parseInt(h.slice(5, 7), 16)
                          applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, r: r2, g: g2, b: b2 } } } : c
                            )
                          })
                        }}
                        style={{ width: 36, height: 20, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {r},{g},{b}{hasAlpha ? `,${a}` : ''}
                      </span>
                    </div>
                    {hasAlpha && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, paddingLeft: 56 }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 8 }}>A</span>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={a}
                          onChange={e => {
                            const newA = Number(e.target.value)
                            applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, a: newA } } } : c
                              )
                            })
                          }}
                          style={{ flex: 1, accentColor: 'var(--accent)', height: 4 }}
                        />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 22, textAlign: 'right' }}>{a}</span>
                      </div>
                    )}
                  </div>
                )
              }
              const isVec2 = vobj.__type__ === 'cc.Vec2'
              const isVec3 = vobj.__type__ === 'cc.Vec3'
              const isVecType = isVec2 || isVec3
              const vecAxes = isVec2 ? ['x', 'y'] : isVec3 ? ['x', 'y', 'z'] : null
              const axisColor: Record<string, string> = { x: '#e05555', y: '#55b055', z: '#4488dd' }
              if (isVecType && vecAxes) {
                return (
                  <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{k}{favBtn}</span>
                    <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                      {vecAxes.map(axis => (
                        <div key={axis} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: axisColor[axis] ?? 'var(--text-muted)',
                            marginRight: 2, flexShrink: 0, userSelect: 'none',
                          }}>{axis.toUpperCase()}</span>
                          <input type="number" defaultValue={Number(vobj[axis])}
                            title={axis}
                            onChange={e => {
                              const val = parseFloat(e.target.value)
                              if (!isNaN(val)) applyAndSave({
                                components: draft.components.map((c, i) =>
                                  i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: val } } } : c
                                )
                              })
                            }}
                            onBlur={e => applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: parseFloat(e.target.value) || 0 } } } : c
                              )
                            })}
                            onWheel={e => {
                              e.preventDefault()
                              const el = e.target as HTMLInputElement
                              const current = parseFloat(el.value)
                              if (isNaN(current)) return
                              const delta = e.deltaY < 0 ? 1 : -1
                              const multiplier = e.shiftKey ? 10 : 1
                              const newVal = current + delta * multiplier
                              el.value = String(newVal)
                              applyAndSave({
                                components: draft.components.map((c, i) =>
                                  i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: newVal } } } : c
                                )
                              })
                            }}
                            style={{
                              flex: 1, minWidth: 0, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                              color: 'var(--text-primary)', borderRadius: 3, padding: '2px 3px', fontSize: 9,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              if (numKeys.length >= 2 && numKeys.length <= 3) {
                return (
                  <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{k}{favBtn}</span>
                    <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                      {numKeys.map(axis => (
                        <input key={axis} type="number" defaultValue={Number(vobj[axis])}
                          title={axis}
                          onChange={e => {
                            const val = parseFloat(e.target.value)
                            if (!isNaN(val)) applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: val } } } : c
                              )
                            })
                          }}
                          onBlur={e => applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: parseFloat(e.target.value) || 0 } } } : c
                            )
                          })}
                          onWheel={e => {
                            e.preventDefault()
                            const el = e.target as HTMLInputElement
                            const current = parseFloat(el.value)
                            if (isNaN(current)) return
                            const delta = e.deltaY < 0 ? 1 : -1
                            const multiplier = e.shiftKey ? 10 : 1
                            const newVal = current + delta * multiplier
                            el.value = String(newVal)
                            applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === origIdx ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: newVal } } } : c
                              )
                            })
                          }}
                          style={{
                            flex: 1, minWidth: 0, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', borderRadius: 3, padding: '2px 3px', fontSize: 9,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )
              }
              return null
            }
            // 배열 타입 — 펼치기/접기 토글 + 요소별 편집
            if (Array.isArray(v)) {
              const arrKey = `${comp.type}:${k}:${ci}`
              const isExpanded = expandedArrayProps.has(arrKey)
              const arr = v as unknown[]
              return (
                <div key={k} className="prop-row" style={{ marginBottom: 3 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setExpandedArrayProps(prev => {
                      const next = new Set(prev)
                      if (next.has(arrKey)) next.delete(arrKey)
                      else next.add(arrKey)
                      return next
                    })}
                  >
                    <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>{isExpanded ? '▾' : '▸'}</span>
                    <span style={{ width: 48, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{k}{favBtn}</span>
                    <span style={{ fontSize: 9, color: '#666' }}>[{arr.length}]</span>
                  </div>
                  {isExpanded && arr.map((elem, elemIdx) => {
                    const elemLabel = `[${elemIdx}]`
                    if (elem !== null && typeof elem === 'object' && '__type__' in (elem as object)) {
                      return (
                        <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                          <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                          <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '1px 4px' }}>
                            {String((elem as Record<string, unknown>).__type__)}
                          </span>
                        </div>
                      )
                    }
                    if (typeof elem === 'number') {
                      return (
                        <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                          <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                          <input
                            type="number"
                            defaultValue={elem}
                            onBlur={e => {
                              const val = parseFloat(e.target.value)
                              if (isNaN(val)) return
                              const newArr = [...arr]
                              newArr[elemIdx] = val
                              applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                            }}
                            onWheel={e => {
                              e.preventDefault()
                              const el = e.target as HTMLInputElement
                              const current = parseFloat(el.value)
                              if (isNaN(current)) return
                              const delta = e.deltaY < 0 ? 1 : -1
                              const newVal = current + delta * (e.shiftKey ? 10 : 1)
                              el.value = String(newVal)
                              const newArr = [...arr]
                              newArr[elemIdx] = newVal
                              applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                            }}
                            style={{ flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 9 }}
                          />
                        </div>
                      )
                    }
                    if (typeof elem === 'string') {
                      return (
                        <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                          <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                          <input
                            type="text"
                            defaultValue={elem}
                            onBlur={e => {
                              const newArr = [...arr]
                              newArr[elemIdx] = e.target.value
                              applyAndSave({ components: draft.components.map((c, i) => i === origIdx ? { ...c, props: { ...c.props, [k]: newArr } } : c) })
                            }}
                            style={{ flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 9 }}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={elemIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16, marginTop: 2 }}>
                        <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{elemLabel}</span>
                        <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace' }}>{JSON.stringify(elem)}</span>
                      </div>
                    )
                  })}
                </div>
              )
            }
            if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return null
            const isBool = typeof v === 'boolean'
            const isText = typeof v === 'string'
            // fontStyle → 드롭다운
            if (k === 'fontStyle' && typeof v === 'number') {
              return (
                <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{k}{favBtn}</span>
                  <select
                    value={Number(v)}
                    onChange={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: Number(e.target.value) } } : c
                      )
                    })}
                    style={{ flex: 1, fontSize: 10, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                  >
                    <option value={0}>Normal</option>
                    <option value={1}>Bold</option>
                    <option value={2}>Italic</option>
                    <option value={3}>BoldItalic</option>
                  </select>
                </div>
              )
            }
            // 알려진 Cocos enum → 드롭다운
            const COCOS_ENUM_MAP: Record<string, Record<number, string>> = {
              overflow:        { 0: 'None', 1: 'Clamp', 2: 'Shrink', 3: 'Resize Height' },
              horizontalAlign: { 0: 'Left', 1: 'Center', 2: 'Right' },
              verticalAlign:   { 0: 'Top',  1: 'Center', 2: 'Bottom' },
              wrapMode:        { 0: 'Default', 1: 'Normal', 2: 'Loop', 3: 'PingPong', 4: 'ClampForever' },
            }
            if (k in COCOS_ENUM_MAP && typeof v === 'number') {
              const enumOptions = COCOS_ENUM_MAP[k]
              return (
                <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{k}{favBtn}</span>
                  <select
                    value={Number(v)}
                    onChange={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: Number(e.target.value) } } : c
                      )
                    })}
                    style={{ flex: 1, fontSize: 10, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3, padding: '1px 3px' }}
                  >
                    {Object.entries(enumOptions).map(([val, label]) => (
                      <option key={val} value={Number(val)}>{label}</option>
                    ))}
                  </select>
                </div>
              )
            }
            return (
              <div key={k} className="prop-row" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{k}{favBtn}</span>
                {isBool ? (
                  <BoolToggle
                    value={Boolean(v)}
                    onChange={checked => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: checked } } : c
                      )
                    })}
                  />
                ) : isText ? (
                  (() => {
                    const strV = String(v)
                    const isColor = strV.startsWith('#') || strV.startsWith('rgb')
                    const toHex = (s: string): string => {
                      if (s.startsWith('#')) return s.slice(0, 7)
                      const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
                      if (m) return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
                      return '#000000'
                    }
                    return (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                        {isColor && (
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div
                              className="colorSwatch"
                              onClick={() => setColorPickerProp(colorPickerProp === k ? null : k)}
                              style={{
                                width: 14, height: 14, borderRadius: 2, border: '1px solid var(--border)',
                                background: strV, cursor: 'pointer', marginTop: 3, flexShrink: 0,
                              }}
                            />
                            {colorPickerProp === k && (
                              <input
                                type="color"
                                value={toHex(strV)}
                                onChange={e => applyAndSave({
                                  components: draft.components.map((c, i) =>
                                    i === origIdx ? { ...c, props: { ...c.props, [k]: e.target.value } } : c
                                  )
                                })}
                                style={{
                                  position: 'absolute', top: 18, left: 0, zIndex: 100,
                                  width: 40, height: 24, padding: 0, border: 'none', cursor: 'pointer',
                                }}
                              />
                            )}
                          </div>
                        )}
                        <textarea
                          rows={2}
                          defaultValue={strV}
                          onBlur={e => applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === origIdx ? { ...c, props: { ...c.props, [k]: e.target.value } } : c
                            )
                          })}
                          style={{
                            flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
                            resize: 'vertical', fontFamily: 'inherit',
                          }}
                        />
                      </div>
                    )
                  })()
                ) : (
                  <input
                    type="number"
                    defaultValue={Number(v)}
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val)) applyAndSave({
                        components: draft.components.map((c, i) =>
                          i === origIdx ? { ...c, props: { ...c.props, [k]: val } } : c
                        )
                      })
                    }}
                    onBlur={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === origIdx ? { ...c, props: { ...c.props, [k]: parseFloat(e.target.value) || 0 } } : c
                      )
                    })}
                    onWheel={e => {
                      e.preventDefault()
                      const el = e.target as HTMLInputElement
                      const current = parseFloat(el.value)
                      if (isNaN(current)) return
                      const delta = e.deltaY < 0 ? 1 : -1
                      const multiplier = e.shiftKey ? 10 : 1
                      const newVal = current + delta * multiplier
                      el.value = String(newVal)
                      applyAndSave({
                        components: draft.components.map((c, i) =>
                          i === origIdx ? { ...c, props: { ...c.props, [k]: newVal } } : c
                        )
                      })
                    }}
                    style={{
                      flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
                    }}
                  />
                )}
              </div>
            )
                })}
              </>
            )
          })()}
        </div>
      ))
      })()}
      {/* 씬 파일 정보 (Inspector 하단) */}
      <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 9, color: '#444', lineHeight: 1.8 }}>
        <div title={sceneFile.scenePath} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          📄 {sceneFile.scenePath.split(/[\\/]/).pop()}
        </div>
        <div>CC {sceneFile.projectInfo.version === '3x' ? '3.x' : '2.x'} | {sceneFile.projectInfo.creatorVersion ?? ''}</div>
      </div>

      {!collapsed['comps'] && (() => {
        const compTypes = ['cc.Label', 'cc.Sprite', 'cc.Button', 'cc.Toggle', 'cc.Slider', 'cc.ScrollView', 'cc.Layout', 'cc.Widget', 'cc.Animation', 'cc.AudioSource', 'cc.RichText', 'cc.EditBox', 'cc.UIOpacity', 'cc.Mask']
        return (
          <details style={{ marginTop: 6 }}>
            <summary style={{ fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', padding: '3px 0' }}>
              + 컴포넌트 추가
            </summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
              {compTypes.map(ct => (
                <span
                  key={ct}
                  onClick={() => applyAndSave({ components: [...draft.components, { type: ct, props: {} }] })}
                  style={{
                    fontSize: 9, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                    border: '1px solid var(--border)', color: 'var(--text-muted)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#58a6ff')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {ct.split('.').pop()}
                </span>
              ))}
            </div>
          </details>
        )
      })()}

      {/* Round 611: 변경 이력 트레이 */}
      {(() => {
        const fmtVal = (v: unknown): string => {
          if (v === null || v === undefined) return 'null'
          if (typeof v === 'boolean') return v ? 'true' : 'false'
          if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
          if (typeof v === 'string') return v.length > 20 ? v.slice(0, 20) + '…' : v
          return JSON.stringify(v).slice(0, 30) + (JSON.stringify(v).length > 30 ? '…' : '')
        }
        const fmtTime = (ts: number): string => {
          const d = new Date(ts)
          return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
        }
        return (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)' }}>
            <div
              onClick={() => setHistoryOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 0', cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {historyOpen ? '▾' : '▸'} 📋 변경 이력 ({propHistory.length})
              </span>
              {propHistory.length > 0 && (
                <span
                  onClick={e => {
                    e.stopPropagation()
                    setPropHistory([])
                    localStorage.removeItem(PROP_HISTORY_KEY)
                  }}
                  title="이력 지우기"
                  style={{ fontSize: 10, color: '#555', cursor: 'pointer', padding: '0 2px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f85149')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                >
                  ×
                </span>
              )}
            </div>
            {historyOpen && (
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {propHistory.length === 0 ? (
                  <div style={{ fontSize: 10, color: '#444', padding: '4px 0' }}>이력 없음</div>
                ) : propHistory.map(h => (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <span
                      title="실행 취소 (undo)"
                      onClick={() => applyAndSave({ [h.propKey]: h.oldValue } as Partial<CCSceneNode>)}
                      style={{ fontSize: 10, cursor: 'pointer', color: '#555', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#58a6ff')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                    >
                      ↩
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-primary)' }}>[{h.nodeName}]</span>{' '}
                      <span style={{ fontFamily: 'monospace' }}>{h.propKey}</span>:{' '}
                      <span style={{ fontFamily: 'monospace', color: '#f85149' }}>{fmtVal(h.oldValue)}</span>
                      {' → '}
                      <span style={{ fontFamily: 'monospace', color: '#3fb950' }}>{fmtVal(h.newValue)}</span>
                    </span>
                    <span style={{ fontSize: 10, color: '#444', flexShrink: 0 }}>{fmtTime(h.ts)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
      {/* Round 643: 저장 완료 토스트 */}
      {savedToast && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: '#166534', color: '#4ade80', fontSize: 11,
          padding: '4px 10px', textAlign: 'center', borderRadius: 4,
          marginTop: 6, userSelect: 'none',
        }}>
          저장됨 ✓
        </div>
      )}
    </div>
  )
}

/** 씬 트리 노드 이름 검색 + 선택 */

function TreeSearch({ root, onSelect }: { root: CCSceneNode; onSelect: (n: CCSceneNode | null) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CCSceneNode[]>([])
  const [open, setOpen] = useState(false)

  const search = useCallback((q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    const found: CCSceneNode[] = []
    function walk(n: CCSceneNode) {
      if (n.name.toLowerCase().includes(q.toLowerCase())) found.push(n)
      n.children.forEach(walk)
    }
    walk(root)
    setResults(found.slice(0, 8))
    setOpen(true)
  }, [root])

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        value={query}
        onChange={e => search(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="노드 검색..."
        style={{
          width: '100%', background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', borderRadius: 3, padding: '2px 6px', fontSize: 10, boxSizing: 'border-box',
        }}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-secondary, #0d0d1a)', border: '1px solid var(--border)',
          borderRadius: 4, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {results.map(n => (
            <div
              key={n.uuid}
              onMouseDown={() => { onSelect(n); setQuery(''); setOpen(false) }}
              style={{
                padding: '4px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-subtle, rgba(88,166,255,0.1))')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              {n.name || '(unnamed)'}
              {n.components.length > 0 && (
                <span style={{ marginLeft: 4, color: 'var(--text-muted)', fontSize: 9 }}>
                  {n.components[0].type.replace('cc.','')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 에셋 브라우저 ──────────────────────────────────────────────────────────

type AssetEntry = { uuid: string; path: string; relPath: string; type: string }

const ASSET_TYPE_GROUPS: { key: string; icon: string; label: string; types: string[] }[] = [
  { key: 'texture', icon: '🖼', label: 'Texture', types: ['texture', 'sprite-atlas'] },
  { key: 'prefab', icon: '📦', label: 'Prefab', types: ['prefab'] },
  { key: 'scene', icon: '🎬', label: 'Scene', types: ['scene'] },
  { key: 'script', icon: '📜', label: 'Script', types: ['script'] },
  { key: 'audio', icon: '🔊', label: 'Audio', types: ['audio'] },
  { key: 'font', icon: '🔤', label: 'Font', types: ['font'] },
]

function CCFileAssetBrowser({ assetsDir }: { assetsDir: string }) {
  const [assets, setAssets] = useState<Record<string, AssetEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.api.ccFileBuildUUIDMap(assetsDir).then(map => {
      if (!cancelled) { setAssets(map); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [assetsDir])

  const grouped = useMemo(() => {
    if (!assets) return []
    const entries = Object.values(assets)
    const lowerQ = search.toLowerCase()
    const filtered = lowerQ
      ? entries.filter(e => e.relPath.toLowerCase().includes(lowerQ))
      : entries

    const groups: { key: string; icon: string; label: string; items: AssetEntry[] }[] = []
    const assigned = new Set<string>()

    for (const g of ASSET_TYPE_GROUPS) {
      const items = filtered.filter(e => g.types.includes(e.type))
      if (items.length > 0) {
        groups.push({ key: g.key, icon: g.icon, label: g.label, items })
        items.forEach(i => assigned.add(i.uuid))
      }
    }

    const others = filtered.filter(e => !assigned.has(e.uuid))
    if (others.length > 0) {
      groups.push({ key: 'other', icon: '📄', label: '기타', items: others })
    }

    return groups
  }, [assets, search])

  const handleCopy = useCallback((entry: AssetEntry) => {
    navigator.clipboard.writeText(entry.relPath).catch(() => {})
    setCopied(entry.uuid)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
        에셋 스캔 중...
      </div>
    )
  }

  if (!assets || Object.keys(assets).length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' }}>
        에셋을 찾을 수 없습니다
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 검색 */}
      <div style={{ padding: '6px 8px', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="에셋 검색..."
          style={{
            width: '100%', fontSize: 11, padding: '4px 8px', boxSizing: 'border-box',
            background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 4,
          }}
        />
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>
          전체 {Object.keys(assets).length}개 에셋
        </div>
      </div>
      {/* 그룹 리스트 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
        {grouped.length === 0 && (
          <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 10, textAlign: 'center' }}>
            검색 결과 없음
          </div>
        )}
        {grouped.map(g => (
          <div key={g.key} style={{ marginBottom: 2 }}>
            {/* 그룹 헤더 */}
            <div
              onClick={() => toggleGroup(g.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 4px',
                cursor: 'pointer', userSelect: 'none', borderRadius: 3,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <span style={{ fontSize: 8, color: 'var(--text-muted)', width: 10 }}>
                {expanded.has(g.key) ? '▾' : '▸'}
              </span>
              <span style={{ fontSize: 11 }}>{g.icon}</span>
              <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 500, flex: 1 }}>
                {g.label}
              </span>
              <span style={{
                fontSize: 9, color: 'var(--text-muted)', padding: '0 5px',
                background: 'rgba(255,255,255,0.06)', borderRadius: 8,
              }}>
                {g.items.length}
              </span>
            </div>
            {/* 그룹 항목 */}
            {expanded.has(g.key) && g.items.map(item => (
              <div
                key={item.uuid}
                onClick={() => handleCopy(item)}
                title={`${item.relPath}\n클릭하여 경로 복사`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 22px',
                  cursor: 'pointer', fontSize: 10, borderRadius: 3,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: copied === item.uuid ? 'var(--accent)' : 'var(--text-primary)',
                }}>
                  {copied === item.uuid ? '✓ 복사됨' : item.relPath.split(/[\\/]/).pop()}
                </span>
                <span style={{
                  fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%',
                  direction: 'rtl', textAlign: 'left',
                }}>
                  {item.relPath.split(/[\\/]/).slice(0, -1).join('/')}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
