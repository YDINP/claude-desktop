import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useCCFileProject } from '../../hooks/useCCFileProject'
import { CCFileSceneView } from './SceneView/CCFileSceneView'
import type { CCSceneNode, CCSceneFile } from '../../../../shared/ipc-schema'

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
  const [sceneViewHeight, setSceneViewHeight] = useState(240)
  const [mainTab, setMainTab] = useState<'scene' | 'assets'>('scene')
  const dividerDragRef = useRef<{ startY: number; startH: number } | null>(null)
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cc-recent-files') ?? '[]') } catch { return [] }
  })

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
          {(['scene', 'assets'] as const).map(t => (
            <button key={t} onClick={() => setMainTab(t)}
              style={{
                flex: 1, padding: '4px 0', fontSize: 10, border: 'none', cursor: 'pointer',
                background: mainTab === t ? 'var(--bg-primary)' : 'transparent',
                color: mainTab === t ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: mainTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: mainTab === t ? 600 : 400,
              }}
            >{t === 'scene' ? '🎬 씬 편집' : '📁 에셋'}</button>
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
                onClick={() => setHideInactive(h => !h)}
                title={hideInactive ? '비활성 노드 표시' : '비활성 노드 숨기기'}
                style={{ cursor: 'pointer', fontSize: 11, flexShrink: 0, color: hideInactive ? '#58a6ff' : '#555' }}
              >
                {hideInactive ? '◑' : '●'}
              </span>
            </div>
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

/** 파싱된 CCSceneNode 트리 렌더링 */
function CCFileSceneTree({
  node, depth, selected, onSelect, onReparent, onAddChild, onDelete, onDuplicate, onToggleActive, hideInactive,
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
}) {
  const [collapsed, setCollapsed] = useState(depth > 2)
  const [isDragOver, setIsDragOver] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
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
        </div>
      )}
      <div
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
          background: isDragOver ? 'rgba(88,166,255,0.18)' : isSelected ? 'var(--accent-subtle, rgba(88,166,255,0.1))' : 'transparent',
          color: node.active ? 'var(--text-primary)' : 'var(--text-muted)',
          userSelect: 'none',
          outline: isDragOver ? '1px dashed #58a6ff' : 'none',
          borderLeft: depth > 0 ? `1px solid rgba(255,255,255,0.05)` : 'none',
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
        />
      ))}
    </div>
  )
}

/** 스크러빙 라벨: 마우스 좌우 드래그로 숫자 값 조절 */
function ScrubLabel({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  const startRef = useRef<{ x: number; v: number } | null>(null)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startRef.current = { x: e.clientX, v: value }
    const onMove = (me: MouseEvent) => {
      if (!startRef.current) return
      const dx = me.clientX - startRef.current.x
      onChange(Math.round((startRef.current.v + dx * step) / step) * step)
    }
    const onUp = () => {
      startRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  return (
    <span
      onMouseDown={handleMouseDown}
      title={`드래그로 ${label} 조절`}
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [collapsedComps, setCollapsedComps] = useState<Set<number>>(new Set())
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

  // 노드 교체 시 draft + 컴포넌트 접힘 상태 초기화
  useMemo(() => { setDraft({ ...node }); setCollapsedComps(new Set()) }, [node.uuid])
  const copiedCompRef = useRef<{ type: string; props: Record<string, unknown> } | null>(null)
  const [compCopied, setCompCopied] = useState<string | null>(null) // 복사된 comp type 표시용

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

  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    step = 1,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
      <ScrubLabel label={label} value={value} onChange={onChange} step={step} />
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        onBlur={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
        }}
      />
    </div>
  )

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
          {saving && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>저장 중...</span>}
          {msg && <span style={{ fontSize: 9, color: msg.ok ? '#4ade80' : '#f85149' }}>{msg.text}</span>}
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <input
              type="checkbox"
              checked={draft.active}
              onChange={e => applyAndSave({ active: e.target.checked })}
              style={{ margin: 0 }}
            />
            활성
          </label>
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
              <button onClick={() => handleZOrder(-1)} title="앞으로 이동" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: 'pointer', background: 'transparent', color: '#888', border: '1px solid #555', lineHeight: 1.4 }}>↑</button>
              <button onClick={() => handleZOrder(1)} title="뒤로 이동" style={{ padding: '1px 3px', fontSize: 10, borderRadius: 3, cursor: 'pointer', background: 'transparent', color: '#888', border: '1px solid #555', lineHeight: 1.4 }}>↓</button>
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
        </div>
      </div>

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 6px' }}>
          {numInput('aX', draft.anchor.x, v => applyAndSave({ anchor: { ...draft.anchor, x: v } }), 0.01)}
          {numInput('aY', draft.anchor.y, v => applyAndSave({ anchor: { ...draft.anchor, y: v } }), 0.01)}
          {numInput('α', draft.opacity, v => applyAndSave({ opacity: Math.min(255, Math.max(0, Math.round(v))) }))}
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
      {!collapsed['comps'] && draft.components.filter(c => {
        const skipTypes = ['cc.UITransform', 'cc.Canvas', 'cc.PrefabInfo', 'cc.CompPrefabInfo', 'cc.SceneGlobals', 'cc.AmbientInfo', 'cc.ShadowsInfo', 'cc.FogInfo', 'cc.OctreeInfo', 'cc.SkyboxInfo']
        if (skipTypes.includes(c.type)) return false
        return Object.values(c.props).some(v => {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return true
          if (v && typeof v === 'object') {
            if ('__uuid__' in (v as object)) return true
            // 벡터 타입 {x,y} 또는 {x,y,z}
            const keys = Object.keys(v as object).filter(k => typeof (v as Record<string, unknown>)[k] === 'number')
            if (keys.length >= 2 && keys.length <= 3) return true
          }
          return false
        })
      }).map((comp, ci) => (
        <div key={`${node.uuid}-${ci}`} style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 5 }}>
          <div
            style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setCollapsedComps(s => { const n = new Set(s); n.has(ci) ? n.delete(ci) : n.add(ci); return n })}
          >
            <span style={{ fontSize: 7, color: 'var(--text-muted)', marginRight: 3 }}>{collapsedComps.has(ci) ? '▸' : '▾'}</span>
            <span style={{ flex: 1 }}>{comp.type.includes('.') ? comp.type.split('.').pop() : comp.type}</span>
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
              onClick={e => { e.stopPropagation(); applyAndSave({ components: draft.components.filter((_, i) => i !== ci) }) }}
              style={{ cursor: 'pointer', color: '#666', fontSize: 10, padding: '0 2px', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ff6666')}
              onMouseLeave={e => (e.currentTarget.style.color = '#666')}
            >✕</span>
          </div>
          {!collapsedComps.has(ci) && Object.entries(comp.props).filter(([k]) => {
            // 내부 엔진 props 숨김: objFlags, enabled, playOnLoad, 등
            const HIDDEN = new Set(['objFlags', 'enabled', 'playOnLoad', 'id', 'prefab', 'compPrefabInfo', 'contentSize', 'anchorPoint', 'N$file', 'N$spriteAtlas', 'N$clips', 'N$defaultClip'])
            if (HIDDEN.has(k)) return false
            // 배열/Map 타입 (cc.Button clickEvents 등) 숨김
            if (Array.isArray(v)) return false
            return true
          }).map(([k, v]) => {
            if (v && typeof v === 'object' && '__uuid__' in (v as object)) {
              const uuid = (v as { __uuid__: string }).__uuid__
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
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
              // RGBA 컬러 피커: r/g/b 키가 모두 있는 객체
              const hasRgb = ['r', 'g', 'b'].every(c => c in vobj && typeof vobj[c] === 'number')
              if (hasRgb) {
                const r = Math.round(Math.min(255, Math.max(0, Number(vobj.r ?? 0))))
                const g = Math.round(Math.min(255, Math.max(0, Number(vobj.g ?? 0))))
                const b = Math.round(Math.min(255, Math.max(0, Number(vobj.b ?? 0))))
                const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
                    <input
                      type="color"
                      defaultValue={hex}
                      onChange={e => {
                        const h = e.target.value
                        const r2 = parseInt(h.slice(1, 3), 16)
                        const g2 = parseInt(h.slice(3, 5), 16)
                        const b2 = parseInt(h.slice(5, 7), 16)
                        applyAndSave({
                          components: draft.components.map((c, i) =>
                            i === ci ? { ...c, props: { ...c.props, [k]: { ...vobj, r: r2, g: g2, b: b2 } } } : c
                          )
                        })
                      }}
                      style={{ width: 36, height: 20, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{r},{g},{b}</span>
                  </div>
                )
              }
              if (numKeys.length >= 2 && numKeys.length <= 3) {
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
                    <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                      {numKeys.map(axis => (
                        <input key={axis} type="number" defaultValue={Number(vobj[axis])}
                          title={axis}
                          onChange={e => {
                            const val = parseFloat(e.target.value)
                            if (!isNaN(val)) applyAndSave({
                              components: draft.components.map((c, i) =>
                                i === ci ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: val } } } : c
                              )
                            })
                          }}
                          onBlur={e => applyAndSave({
                            components: draft.components.map((c, i) =>
                              i === ci ? { ...c, props: { ...c.props, [k]: { ...vobj, [axis]: parseFloat(e.target.value) || 0 } } } : c
                            )
                          })}
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
            if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return null
            const isBool = typeof v === 'boolean'
            const isText = typeof v === 'string'
            // fontStyle → 드롭다운
            if (k === 'fontStyle' && typeof v === 'number') {
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
                  <select
                    value={Number(v)}
                    onChange={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === ci ? { ...c, props: { ...c.props, [k]: Number(e.target.value) } } : c
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
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <span style={{ width: 52, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
                {isBool ? (
                  <input
                    type="checkbox"
                    defaultChecked={Boolean(v)}
                    onChange={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === ci ? { ...c, props: { ...c.props, [k]: e.target.checked } } : c
                      )
                    })}
                    style={{ margin: 0, cursor: 'pointer' }}
                  />
                ) : isText ? (
                  <textarea
                    rows={2}
                    defaultValue={String(v)}
                    onBlur={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === ci ? { ...c, props: { ...c.props, [k]: e.target.value } } : c
                      )
                    })}
                    style={{
                      flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
                      resize: 'vertical', fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <input
                    type="number"
                    defaultValue={Number(v)}
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val)) applyAndSave({
                        components: draft.components.map((c, i) =>
                          i === ci ? { ...c, props: { ...c.props, [k]: val } } : c
                        )
                      })
                    }}
                    onBlur={e => applyAndSave({
                      components: draft.components.map((c, i) =>
                        i === ci ? { ...c, props: { ...c.props, [k]: parseFloat(e.target.value) || 0 } } : c
                      )
                    })}
                    style={{
                      flex: 1, background: 'var(--input-bg, #1a1a2e)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', borderRadius: 3, padding: '2px 4px', fontSize: 10,
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      ))}
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
