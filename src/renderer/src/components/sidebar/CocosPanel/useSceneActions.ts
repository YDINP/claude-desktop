import { useState, useCallback, useRef } from 'react'
import type { CCSceneNode, CCSceneFile, CCFileProjectInfo } from '@shared/ipc-schema'

export type DepEntry = { uuid: string; path: string; type: string; missing: boolean }

export interface UseSceneActionsProps {
  sceneFile: CCSceneFile | null
  projectInfo: CCFileProjectInfo | null
  loadScene: (scenePath: string) => Promise<void>
  addRecentScene: (path: string) => void
}

export function useSceneActions({ sceneFile, projectInfo, loadScene, addRecentScene }: UseSceneActionsProps) {
  // R1448: 씬 의존성 분석
  const [showDepsAnalysis, setShowDepsAnalysis] = useState(false)
  const [depsLoading, setDepsLoading] = useState(false)
  const [depsEntries, setDepsEntries] = useState<DepEntry[]>([])
  const handleAnalyzeDeps = useCallback(async () => {
    if (!sceneFile?._raw || !projectInfo?.projectPath) return
    setDepsLoading(true)
    setShowDepsAnalysis(true)
    try {
      const raw = sceneFile._raw as Record<string, unknown>[]
      const referencedUuids = new Set<string>()
      function extractRefs(obj: unknown): void {
        if (!obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) { for (const item of obj) extractRefs(item); return }
        const rec = obj as Record<string, unknown>
        if (typeof rec.__uuid__ === 'string') { referencedUuids.add(rec.__uuid__); return }
        for (const val of Object.values(rec)) {
          if (val && typeof val === 'object') extractRefs(val)
        }
      }
      for (const entry of raw) extractRefs(entry)
      const assetsDir = projectInfo.projectPath + '/assets'
      const assetMap = await window.api.ccFileBuildUUIDMap(assetsDir)
      const entries: DepEntry[] = []
      for (const uuid of referencedUuids) {
        const asset = assetMap[uuid]
        if (asset) {
          entries.push({ uuid, path: asset.relPath, type: asset.type, missing: false })
        } else {
          entries.push({ uuid, path: '', type: 'unknown', missing: true })
        }
      }
      entries.sort((a, b) => {
        if (a.missing !== b.missing) return a.missing ? -1 : 1
        return a.type.localeCompare(b.type)
      })
      setDepsEntries(entries)
    } catch {
      setDepsEntries([])
    } finally {
      setDepsLoading(false)
    }
  }, [sceneFile, projectInfo])

  // R1454: 씬 일괄 처리
  const [showBatchMenu, setShowBatchMenu] = useState(false)
  const [batchToast, setBatchToast] = useState<string | null>(null)
  const batchToastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showBatchToast = useCallback((msg: string) => {
    setBatchToast(msg)
    if (batchToastRef.current) clearTimeout(batchToastRef.current)
    batchToastRef.current = setTimeout(() => setBatchToast(null), 2500)
  }, [])

  const handleBatchFontSize = useCallback(() => {
    if (!sceneFile?.root) return
    const sizeStr = prompt('모든 Label에 적용할 fontSize 값:', '24')
    if (!sizeStr) return
    const fontSize = parseInt(sizeStr)
    if (isNaN(fontSize) || fontSize <= 0) return
    let count = 0
    function walkFont(node: CCSceneNode) {
      for (const comp of node.components) {
        if (comp.type === 'cc.Label' && comp.props) {
          (comp.props as Record<string, unknown>).fontSize = fontSize
          ;(comp.props as Record<string, unknown>)._fontSize = fontSize
          ;(comp.props as Record<string, unknown>)._N$fontSize = fontSize
          count++
        }
      }
      node.children.forEach(walkFont)
    }
    walkFont(sceneFile.root)
    showBatchToast(`${count}개 Label 폰트 크기 → ${fontSize}`)
    setShowBatchMenu(false)
  }, [sceneFile, showBatchToast])

  const handleBatchRemoveInactive = useCallback(() => {
    if (!sceneFile?.root) return
    if (!confirm('모든 비활성(active=false) 노드를 삭제합니다. 계속하시겠습니까?')) return
    let count = 0
    function walkRemove(node: CCSceneNode): CCSceneNode {
      const filteredChildren = node.children
        .filter(child => { if (!child.active) { count++; return false } return true })
        .map(walkRemove)
      return { ...node, children: filteredChildren }
    }
    const newRoot = walkRemove(sceneFile.root)
    sceneFile.root = newRoot
    showBatchToast(`${count}개 비활성 노드 삭제됨`)
    setShowBatchMenu(false)
  }, [sceneFile, showBatchToast])

  const handleBatchNormalizeName = useCallback(() => {
    if (!sceneFile?.root) return
    let count = 0
    function walkName(node: CCSceneNode) {
      const original = node.name
      const normalized = original.replace(/[^a-zA-Z0-9가-힣_\- ]/g, '')
      if (normalized !== original) { node.name = normalized; count++ }
      node.children.forEach(walkName)
    }
    walkName(sceneFile.root)
    showBatchToast(`${count}개 노드 이름 정규화됨`)
    setShowBatchMenu(false)
  }, [sceneFile, showBatchToast])

  // R1394: 씬 템플릿 생성
  const [showNewSceneForm, setShowNewSceneForm] = useState(false)
  const [newSceneName, setNewSceneName] = useState('NewScene')
  const [newSceneTemplate, setNewSceneTemplate] = useState<'empty' | 'canvas'>('canvas')

  const handleCreateScene = useCallback(async () => {
    if (!projectInfo?.projectPath || !newSceneName.trim()) return
    const safeName = newSceneName.trim().replace(/[<>:"/\\|?*]/g, '_')
    const ext = projectInfo.version === '3x' ? '.scene' : '.fire'
    const scenePath = projectInfo.projectPath.replace(/\\/g, '/') + '/assets/' + safeName + ext
    let sceneJson: unknown[]
    if (newSceneTemplate === 'canvas') {
      sceneJson = [
        { __type__: 'cc.SceneAsset', _name: '', _objFlags: 0, _native: '', scene: { __id__: 1 } },
        { __type__: 'cc.Scene', _objFlags: 0, _parent: null, _children: [{ __id__: 2 }], _active: true, _level: 0, _components: [], _prefab: null, _opacity: 255, _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 }, _contentSize: { __type__: 'cc.Size', width: 0, height: 0 }, _anchorPoint: { __type__: 'cc.Vec2', x: 0, y: 0 }, _id: 'scene-' + Date.now(), _name: safeName, autoReleaseAssets: false },
        { __type__: 'cc.Node', _name: 'Canvas', _objFlags: 0, _parent: { __id__: 1 }, _children: [], _active: true, _components: [{ __id__: 3 }], _prefab: null, _opacity: 255, _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 }, _contentSize: { __type__: 'cc.Size', width: 960, height: 640 }, _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 }, _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] }, _id: 'canvas-' + Date.now() },
        { __type__: 'cc.Canvas', _name: '', _objFlags: 0, node: { __id__: 2 }, _enabled: true, _N$designResolution: { __type__: 'cc.Size', width: 960, height: 640 }, _N$fitWidth: false, _N$fitHeight: true },
      ]
    } else {
      sceneJson = [
        { __type__: 'cc.SceneAsset', _name: '', _objFlags: 0, _native: '', scene: { __id__: 1 } },
        { __type__: 'cc.Scene', _objFlags: 0, _parent: null, _children: [], _active: true, _level: 0, _components: [], _prefab: null, _opacity: 255, _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 }, _contentSize: { __type__: 'cc.Size', width: 0, height: 0 }, _anchorPoint: { __type__: 'cc.Vec2', x: 0, y: 0 }, _id: 'scene-' + Date.now(), _name: safeName, autoReleaseAssets: false },
      ]
    }
    const content = JSON.stringify(sceneJson, null, 2)
    try {
      const result = await window.api.writeTextFile(scenePath, content)
      if (result?.error) { console.error('씬 생성 실패:', result.error); return }
      setShowNewSceneForm(false)
      setNewSceneName('NewScene')
      await loadScene(scenePath)
      addRecentScene(scenePath)
    } catch (e) { console.error('씬 생성 오류:', e) }
  }, [projectInfo, newSceneName, newSceneTemplate, loadScene, addRecentScene])

  // R1461: 새 CC 프로젝트 생성 마법사 상태
  const [showProjectWizard, setShowProjectWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [wizardProjectName, setWizardProjectName] = useState('NewProject')
  const [wizardSavePath, setWizardSavePath] = useState('')
  const [wizardCCVersion, setWizardCCVersion] = useState<'2x' | '3x'>('2x')
  const [wizardTemplate, setWizardTemplate] = useState<'empty' | 'ui'>('empty')
  const [wizardCreating, setWizardCreating] = useState(false)
  const [wizardError, setWizardError] = useState<string | null>(null)

  const handleCreateProject = useCallback(async () => {
    if (!wizardProjectName.trim() || !wizardSavePath.trim()) {
      setWizardError('프로젝트 이름과 저장 위치를 입력하세요')
      return
    }
    setWizardCreating(true)
    setWizardError(null)
    try {
      const projectPath = `${wizardSavePath}/${wizardProjectName}`
      await window.api.createDir(projectPath, 'assets')
      await window.api.createDir(`${projectPath}/assets`, 'scenes')
      if (wizardCCVersion === '2x') {
        const sceneContent = wizardTemplate === 'ui'
          ? JSON.stringify([
            { "__type__": "cc.SceneAsset", "_name": "", "scene": { "__id__": 1 } },
            { "__type__": "cc.Scene", "_name": "Main", "_active": true, "_children": [{ "__id__": 2 }], "_components": [], "_id": "scene-root" },
            { "__type__": "cc.Node", "_name": "Canvas", "_active": true, "_children": [], "_components": [{ "__id__": 3 }, { "__id__": 4 }], "_contentSize": { "width": 960, "height": 640 }, "_anchorPoint": { "x": 0.5, "y": 0.5 }, "_trs": { "__type__": "TypedArray", "ctor": "Float64Array", "array": [0,0,0,0,0,0,1,1,1,1] }, "_id": "canvas-node" },
            { "__type__": "cc.Canvas", "_designResolution": { "width": 960, "height": 640 }, "node": { "__id__": 2 } },
            { "__type__": "cc.Widget", "isAlignTop": true, "isAlignBottom": true, "isAlignLeft": true, "isAlignRight": true, "node": { "__id__": 2 } }
          ], null, 2)
          : JSON.stringify([
            { "__type__": "cc.SceneAsset", "_name": "", "scene": { "__id__": 1 } },
            { "__type__": "cc.Scene", "_name": "Main", "_active": true, "_children": [], "_components": [], "_id": "scene-root" }
          ], null, 2)
        await window.api.createFile(`${projectPath}/assets/scenes`, 'Main.fire')
        await window.api.writeTextFile?.(`${projectPath}/assets/scenes/Main.fire`, sceneContent)
        const projJson = JSON.stringify({ engine: "cocos-creator-js", packages: "packages://", id: wizardProjectName }, null, 2)
        await window.api.createFile(projectPath, 'project.json')
        await window.api.writeTextFile?.(`${projectPath}/project.json`, projJson)
      } else {
        const sceneContent = wizardTemplate === 'ui'
          ? JSON.stringify([
            { "__type__": "cc.SceneAsset", "_name": "", "scene": { "__id__": 1 } },
            { "__type__": "cc.Scene", "_name": "Main", "_active": true, "_children": [{ "__id__": 2 }], "_components": [], "_id": "scene-root" },
            { "__type__": "cc.Node", "_name": "Canvas", "_active": true, "_children": [], "_components": [{ "__id__": 3 }, { "__id__": 4 }], "_lpos": { "x": 0, "y": 0, "z": 0 }, "_lrot": { "x": 0, "y": 0, "z": 0 }, "_lscale": { "x": 1, "y": 1, "z": 1 }, "_id": "canvas-node" },
            { "__type__": "cc.UITransform", "_contentSize": { "width": 960, "height": 640 }, "_anchorPoint": { "x": 0.5, "y": 0.5 }, "node": { "__id__": 2 } },
            { "__type__": "cc.Canvas", "node": { "__id__": 2 } }
          ], null, 2)
          : JSON.stringify([
            { "__type__": "cc.SceneAsset", "_name": "", "scene": { "__id__": 1 } },
            { "__type__": "cc.Scene", "_name": "Main", "_active": true, "_children": [], "_components": [], "_id": "scene-root" }
          ], null, 2)
        await window.api.createFile(`${projectPath}/assets/scenes`, 'Main.scene')
        await window.api.writeTextFile?.(`${projectPath}/assets/scenes/Main.scene`, sceneContent)
        const pkgJson = JSON.stringify({ name: wizardProjectName, uuid: crypto.randomUUID?.() ?? 'temp-uuid', creator: { version: "3.8.0" } }, null, 2)
        await window.api.createFile(projectPath, 'package.json')
        await window.api.writeTextFile?.(`${projectPath}/package.json`, pkgJson)
      }
      setShowProjectWizard(false)
      showBatchToast(`프로젝트 "${wizardProjectName}" 생성 완료`)
    } catch (err) {
      setWizardError((err as Error).message ?? '프로젝트 생성 실패')
    } finally {
      setWizardCreating(false)
    }
  }, [wizardProjectName, wizardSavePath, wizardCCVersion, wizardTemplate, showBatchToast])

  return {
    // Deps analysis
    showDepsAnalysis, setShowDepsAnalysis,
    depsLoading, depsEntries,
    handleAnalyzeDeps,
    // Batch menu
    showBatchMenu, setShowBatchMenu,
    batchToast, showBatchToast,
    handleBatchFontSize, handleBatchRemoveInactive, handleBatchNormalizeName,
    // New scene form
    showNewSceneForm, setShowNewSceneForm,
    newSceneName, setNewSceneName,
    newSceneTemplate, setNewSceneTemplate,
    handleCreateScene,
    // Project wizard
    showProjectWizard, setShowProjectWizard,
    wizardStep, setWizardStep,
    wizardProjectName, setWizardProjectName,
    wizardSavePath, setWizardSavePath,
    wizardCCVersion, setWizardCCVersion,
    wizardTemplate, setWizardTemplate,
    wizardCreating, wizardError, setWizardError,
    handleCreateProject,
  }
}

export type UseSceneActionsReturn = ReturnType<typeof useSceneActions>
