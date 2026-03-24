import React, { useState, useMemo } from 'react'
import type { CCSceneNode } from '@shared/ipc-schema'
import { useBatchPatch } from '@renderer/components/sidebar/hooks/useBatchPatch'
import type { BatchPluginProps } from './types'

export function NamePlugin({ nodes, sceneFile, saveScene, onMultiSelectChange }: BatchPluginProps) {
  const uuids = useMemo(() => nodes.map(n => n.uuid), [nodes])
  const uuidSet = useMemo(() => new Set(uuids), [uuids])
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const { patchNodes, patchComponents } = useBatchPatch({ sceneFile, saveScene, uuidSet, uuids, setBatchMsg })

  // R2642: 노드 이름 접두사/접미사
  const [namePrefix, setNamePrefix] = useState<string>('')
  const [nameSuffix, setNameSuffix] = useState<string>('')
  // R2671: 이름 find/replace
  const [nameFind, setNameFind] = useState<string>('')
  const [nameReplace, setNameReplace] = useState<string>('')
  // R2716: 이름 찾기+바꾸기 (정규식 지원)
  const [nameReplaceFrom, setNameReplaceFrom] = useState('')
  const [nameReplaceTo, setNameReplaceTo] = useState('')
  const [nameReplaceUseRegex, setNameReplaceUseRegex] = useState(false)
  // R2650: 노드 이름 일련번호 치환
  const [nameSerialBase, setNameSerialBase] = useState<string>('node')
  const [nameSerialStart, setNameSerialStart] = useState<number>(1)
  // R1730: 이름 일괄 변경 (Prefix/Suffix)
  const [batchNamePrefix, setBatchNamePrefix] = useState<string>('')
  const [batchNameSuffix, setBatchNameSuffix] = useState<string>('')
  // R1778: Regex 교체
  const [batchRegexPat, setBatchRegexPat] = useState<string>('')
  const [batchRegexRepl, setBatchRegexRepl] = useState<string>('')
  const [batchRegexErr, setBatchRegexErr] = useState<boolean>(false)
  // R1825: 이름 정규화 (base_001, base_002...)
  const [batchNormBase, setBatchNormBase] = useState<string>('')
  // R1856: 이름 find/replace
  const [batchFindStr, setBatchFindStr] = useState<string>('')
  const [batchReplaceStr, setBatchReplaceStr] = useState<string>('')
  // R2708: 이름 정규식 필터 선택
  const [batchNameRegexFilter, setBatchNameRegexFilter] = useState<string>('')
  // R2737: Label 텍스트 일괄 수정
  const [labelText, setLabelText] = useState<string>('') /* R2737 */
  const [labelMode, setLabelMode] = useState<'set' | 'prefix' | 'suffix'>('set') /* R2737 */

  const mkBtnS = (color: string, extra?: React.CSSProperties): React.CSSProperties => ({
    fontSize: 9, padding: '1px 5px', cursor: 'pointer',
    border: '1px solid var(--border)', borderRadius: 2,
    color, userSelect: 'none', ...extra,
  })
  const mkNiS = (w: number, padding = '1px 3px'): React.CSSProperties => ({
    width: w, fontSize: 9, padding, border: '1px solid var(--border)',
    borderRadius: 2, background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', textAlign: 'center',
  })

  return (
    <div>
      {batchMsg && <div style={{ fontSize: 9, color: '#4ade80', marginBottom: 4 }}>{batchMsg}</div>}

      {/* R2504: 노드 이름 일련번호 매기기 (2+ 노드) */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const applySerial = async (mode: 'append' | 'replace') => {
          if (!sceneFile.root) return
          const ns: CCSceneNode[] = []
          function coll(n: CCSceneNode) { if (uuidSet.has(n.uuid)) ns.push(n); n.children.forEach(coll) }
          coll(sceneFile.root)
          if (ns.length < 2) return
          // 순서 유지: 씬 트리 DFS 순서 그대로
          const nameMap = new Map(ns.map((n, i) => {
            const pad = String(i + 1).padStart(2, '0')
            const base = mode === 'replace' ? n.name.replace(/_\d+$/, '') : n.name
            return [n.uuid, `${base}_${pad}`]
          }))
          await patchNodes(n => ({ ...n, name: nameMap.get(n.uuid)! }), `이름 ${ns.length}개 번호 매기기 완료`)
        }
        const applyStrip = () => patchNodes(n => ({ ...n, name: n.name.replace(/_\d+$/, '') }), '접미어 제거 완료')
        const bs: React.CSSProperties = { fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.07)', color: '#fb923c', lineHeight: 1.6 }
        return (
          <div style={{ marginBottom: 6, padding: '3px 6px', background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 4 }}>
            <div style={{ fontSize: 9, color: '#fb923c', fontWeight: 600, marginBottom: 3 }}>① 이름 번호 (R2504)</div>
            <div style={{ display: 'flex', gap: 3 }}>
              <span style={bs} onClick={() => applySerial('append')} title="현재 이름 뒤에 _01, _02... 추가">+번호</span>
              <span style={bs} onClick={() => applySerial('replace')} title="기존 _숫자 접미어 제거 후 새 번호 부여">교체</span>
              <span style={{ ...bs, color: '#888', borderColor: '#444' }} onClick={applyStrip} title="이름 끝의 _숫자 접미어 제거">-번호</span>
            </div>
          </div>
        )
      })()}

      {/* R2648: 이름 알파벳순 Z-order 정렬 */}
      {uuids.length >= 2 && sceneFile.root && (() => {
        const applySortByName = async (dir: 'asc' | 'desc') => {
          if (!sceneFile.root) return
          const parentMap = new Map<string, CCSceneNode[]>()
          function findParents(n: CCSceneNode) {
            const selectedChildren = n.children.filter(c => uuidSet.has(c.uuid))
            if (selectedChildren.length > 0) parentMap.set(n.uuid, n.children)
            n.children.forEach(findParents)
          }
          findParents(sceneFile.root!)
          if (parentMap.size === 0) return
          function walkNameSort(n: CCSceneNode): CCSceneNode {
            const children = n.children.map(walkNameSort)
            if (!parentMap.has(n.uuid)) return { ...n, children }
            const selected = children.filter(c => uuidSet.has(c.uuid))
            selected.sort((a, b) => dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
            const result: CCSceneNode[] = [...children]
            const indices = children.map((c, i) => uuidSet.has(c.uuid) ? i : -1).filter(i => i >= 0)
            indices.forEach((idx, i) => { result[idx] = selected[i] })
            return { ...n, children: result }
          }
          await saveScene(walkNameSort(sceneFile.root!))
          setBatchMsg(`✓ 이름 ${dir === 'asc' ? 'A→Z' : 'Z→A'} Z-order 정렬`)
          setTimeout(() => setBatchMsg(null), 2000)
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>이름정렬 (R2648)</span>
            <span onClick={() => applySortByName('asc')} title="이름 A→Z 순으로 Z-order 재정렬 (R2648)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', userSelect: 'none', background: 'rgba(99,102,241,0.05)' }}>A→Z</span>
            <span onClick={() => applySortByName('desc')} title="이름 Z→A 순으로 Z-order 재정렬 (R2648)"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', userSelect: 'none', background: 'rgba(99,102,241,0.05)' }}>Z→A</span>
          </div>
        )
      })()}

      {/* R2642: 노드 이름 접두사/접미사 일괄 추가 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyNamePatch = async () => {
          if (!sceneFile.root) return
          if (!namePrefix && !nameSuffix) return
          await patchNodes(n => {
            return { ...n, name: `${namePrefix}${n.name}${nameSuffix}`}
          }, `이름 패치: ${namePrefix}*${nameSuffix} (${uuids.length}개)`)
        }
        const inS: React.CSSProperties = { width: 52, fontSize: 9, padding: '1px 3px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>이름패치 (R2642)</span>
            <input value={namePrefix} onChange={e => setNamePrefix(e.target.value)} placeholder="prefix" style={inS} title="접두사 (빈칸 가능)" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>*</span>
            <input value={nameSuffix} onChange={e => setNameSuffix(e.target.value)} placeholder="suffix" style={inS} title="접미사 (빈칸 가능)" />
            <span onClick={applyNamePatch}
              title={`선택 노드 이름에 prefix/suffix 추가 (R2642)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none' }}
            >적용</span>
          </div>
        )
      })()}

      {/* R2671: 노드 이름 문자열 찾아 치환 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyFindReplace = async () => {
          if (!sceneFile.root || !nameFind) return
          await patchNodes(n => {
            return { ...n, name: n.name.split(nameFind).join(nameReplace)}
          }, `이름 치환 "${nameFind}"→"${nameReplace}" (${uuids.length}개)`)
        }
        const inS: React.CSSProperties = { width: 52, fontSize: 9, padding: '1px 3px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>치환 (R2671)</span>
            <input value={nameFind} onChange={e => setNameFind(e.target.value)} placeholder="find" style={inS} title="찾을 문자열" />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→</span>
            <input value={nameReplace} onChange={e => setNameReplace(e.target.value)} placeholder="replace" style={inS} title="바꿀 문자열" />
            <span onClick={applyFindReplace}
              title={`이름에서 "${nameFind}"를 "${nameReplace}"로 치환 (R2671)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none' }}
            >적용</span>
          </div>
        )
      })()}

      {/* R2669: 노드 이름 공백 정리 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyNameTrim = async () => {
          if (!sceneFile.root) return
          await patchNodes(n => {
            return { ...n, name: n.name.trim().replace(/\s+/g, ' ')}
          }, `이름 공백 정리 (${uuids.length}개)`)
        }
        const bs: React.CSSProperties = { fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none' }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>trim (R2669)</span>
            <span onClick={applyNameTrim} title="이름 앞뒤 공백 제거 + 연속 공백 → 단일 공백 (R2669)" style={bs}>공백제거</span>
          </div>
        )
      })()}

      {/* R2667: 노드 이름 대소문자 변환 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyNameCase = async (mode: 'upper' | 'lower' | 'title') => {
          if (!sceneFile.root) return
          function toTitle(s: string) { return s.replace(/\b\w/g, c => c.toUpperCase()) }
          await patchNodes(n => {
            const newName = mode === 'upper' ? n.name.toUpperCase() : mode === 'lower' ? n.name.toLowerCase() : toTitle(n.name)
            return { ...n, name: newName}
          }, `이름 ${mode === 'upper' ? 'UPPER' : mode === 'lower' ? 'lower' : 'Title'} (${uuids.length}개)`)
        }
        const bs: React.CSSProperties = { fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none' }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>케이스 (R2667)</span>
            <span onClick={() => applyNameCase('upper')} title="이름 모두 대문자 (R2667)" style={bs}>ABC</span>
            <span onClick={() => applyNameCase('lower')} title="이름 모두 소문자 (R2667)" style={bs}>abc</span>
            <span onClick={() => applyNameCase('title')} title="이름 단어 첫 글자 대문자 (R2667)" style={bs}>Abc</span>
          </div>
        )
      })()}

      {/* R2716: 이름 찾기+바꾸기 (정규식 지원) */}
      {uuids.length >= 1 && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
          <input
            placeholder="찾기"
            value={nameReplaceFrom}
            onChange={e => setNameReplaceFrom(e.target.value)}
            style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '2px 4px' }}
          />
          <span style={{ color: '#94a3b8', fontSize: 11 }}>→</span>
          <input
            placeholder="바꾸기"
            value={nameReplaceTo}
            onChange={e => setNameReplaceTo(e.target.value)}
            style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '2px 4px' }}
          />
          <label style={{ fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 2 }}>
            <input type="checkbox" checked={nameReplaceUseRegex} onChange={e => setNameReplaceUseRegex(e.target.checked)} />
            /.*/
          </label>
          <button
            onClick={async () => {
              if (!nameReplaceFrom || nameReplaceFrom.length > 200) return
              await patchNodes(n => {
                if (!uuidSet.has(n.uuid)) return n
                try {
                  const newName = nameReplaceUseRegex
                    ? n.name.replace(new RegExp(nameReplaceFrom, 'g'), nameReplaceTo)
                    : n.name.replaceAll(nameReplaceFrom, nameReplaceTo)
                  return { ...n, name: newName }
                } catch {
                  return n
                }
              }, '이름 바꾸기')
            }}
            disabled={!nameReplaceFrom}
            style={{ fontSize: 10, padding: '2px 6px' }}
          >
            바꾸기
          </button>
        </div>
      )}

      {/* R2650: 노드 이름 일련번호 치환 — {base}{n} 형식으로 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        const applyNameSerial = async () => {
          if (!sceneFile.root) return
          let idx = nameSerialStart
          await patchNodes(n => {
            return { ...n, name: `${nameSerialBase}${idx++}`}
          }, `이름 일련번호 ${nameSerialBase}${nameSerialStart}… (${uuids.length}개)`)
        }
        const inS: React.CSSProperties = { width: 52, fontSize: 9, padding: '1px 3px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }
        const niS = mkNiS(30, '1px 2px')
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>이름번호 (R2650)</span>
            <input value={nameSerialBase} onChange={e => setNameSerialBase(e.target.value)} placeholder="base" style={inS} title="기본 이름" />
            <input type="number" value={nameSerialStart} min={0} step={1} onChange={e => setNameSerialStart(parseInt(e.target.value) || 1)} style={niS} title="시작 번호" />
            <span onClick={applyNameSerial}
              title={`선택 노드 이름을 ${nameSerialBase}N 형식으로 치환 (R2650)`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none' }}
            >적용</span>
          </div>
        )
      })()}

      {/* R2580: 선택 노드 이름 목록 클립보드 복사 */}
      {uuids.length >= 1 && sceneFile.root && (() => {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', width: 48, flexShrink: 0 }}>복사</span>
            <span
              onClick={async () => {
                if (!sceneFile.root) return
                const names: string[] = []
                function coll(n: CCSceneNode) { if (uuidSet.has(n.uuid)) names.push(n.name); n.children.forEach(coll) }
                coll(sceneFile.root)
                await navigator.clipboard.writeText(names.join('\n'))
                setBatchMsg(`✓ 이름 ${names.length}개 복사 (R2580)`)
                setTimeout(() => setBatchMsg(null), 2000)
              }}
              title={`선택 노드 이름 목록 복사 (줄바꿈 구분) — R2580`}
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none' }}
            >📋 이름 복사</span>
          </div>
        )
      })()}

      {/* R1778: 이름 정규식 교체 */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6 }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>이름 Regex 교체</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>패턴</span>
          <input value={batchRegexPat} onChange={e => setBatchRegexPat(e.target.value)} placeholder="/pattern/" style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: `1px solid ${batchRegexErr ? '#f87171' : 'var(--border)'}`, color: 'var(--text-primary)', borderRadius: 3 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>교체</span>
          <input value={batchRegexRepl} onChange={e => setBatchRegexRepl(e.target.value)} placeholder="교체 문자열" style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }} />
        </div>
        <button
          title="선택 노드 이름에 정규식 교체 적용"
          onClick={async () => {
            if (!sceneFile.root || !batchRegexPat) return
            let re: RegExp
            if (batchRegexPat.length > 200) { setBatchRegexErr(true); setBatchMsg('✗ 정규식이 너무 깁니다'); setTimeout(() => setBatchMsg(null), 2000); return }
            try { re = new RegExp(batchRegexPat, 'g'); setBatchRegexErr(false) } catch { setBatchRegexErr(true); setBatchMsg('✗ 잘못된 정규식'); setTimeout(() => setBatchMsg(null), 2000); return }
            function applyRegex(n: CCSceneNode): CCSceneNode {
              const children = n.children.map(applyRegex)
              if (!uuidSet.has(n.uuid)) return { ...n, children }
              return { ...n, name: n.name.replace(re, batchRegexRepl), children }
            }
            const result = await saveScene(applyRegex(sceneFile.root))
            setBatchMsg(result.success ? `✓ Regex 교체 (${uuids.length}개)` : `✗ ${result.error ?? '오류'}`)
            setTimeout(() => setBatchMsg(null), 2000)
          }}
          disabled={!batchRegexPat}
          style={{ fontSize: 9, padding: '2px 8px', background: batchRegexPat ? 'rgba(167,139,250,0.12)' : 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: batchRegexPat ? '#a78bfa' : 'var(--text-muted)', cursor: batchRegexPat ? 'pointer' : 'default' }}
        >Regex 적용 ({uuids.length}개)</button>
      </div>

      {/* R1730: 이름 Prefix/Suffix 일괄 추가 */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6 }}>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>이름 일괄 변경</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>Prefix</span>
          <input
            value={batchNamePrefix}
            onChange={e => setBatchNamePrefix(e.target.value)}
            placeholder="앞에 추가할 텍스트"
            style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 48, flexShrink: 0 }}>Suffix</span>
          <input
            value={batchNameSuffix}
            onChange={e => setBatchNameSuffix(e.target.value)}
            placeholder="뒤에 추가할 텍스트"
            style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={async () => {
              if (!sceneFile.root || (!batchNamePrefix && !batchNameSuffix)) return
              function applyName(n: CCSceneNode): CCSceneNode {
                const children = n.children.map(applyName)
                if (!uuidSet.has(n.uuid)) return { ...n, children }
                return { ...n, name: `${batchNamePrefix}${n.name}${batchNameSuffix}`, children }
              }
              const result = await saveScene(applyName(sceneFile.root))
              setBatchMsg(result.success ? `✓ 이름 변경 (${uuids.length}개)` : `✗ ${result.error ?? '오류'}`)
              setBatchNamePrefix('')
              setBatchNameSuffix('')
              setTimeout(() => setBatchMsg(null), 2000)
            }}
            style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(88,166,255,0.12)', border: '1px solid rgba(88,166,255,0.3)', borderRadius: 3, color: '#58a6ff', cursor: 'pointer' }}
          >이름 적용 ({uuids.length}개)</button>
          {/* R1777: 이름 Prefix/Suffix 제거 버튼 */}
          {(batchNamePrefix || batchNameSuffix) && (
            <button
              title="이름에서 현재 입력한 prefix/suffix 제거"
              onClick={async () => {
                if (!sceneFile.root || (!batchNamePrefix && !batchNameSuffix)) return
                function removePfxSfx(n: CCSceneNode): CCSceneNode {
                  const children = n.children.map(removePfxSfx)
                  if (!uuidSet.has(n.uuid)) return { ...n, children }
                  let name = n.name
                  if (batchNamePrefix && name.startsWith(batchNamePrefix)) name = name.slice(batchNamePrefix.length)
                  if (batchNameSuffix && name.endsWith(batchNameSuffix)) name = name.slice(0, -batchNameSuffix.length)
                  return { ...n, name, children }
                }
                const result = await saveScene(removePfxSfx(sceneFile.root))
                setBatchMsg(result.success ? `✓ prefix/suffix 제거 (${uuids.length}개)` : `✗ ${result.error ?? '오류'}`)
                setTimeout(() => setBatchMsg(null), 2000)
              }}
              style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 3, color: '#f87171', cursor: 'pointer' }}
            >이름 제거 ({uuids.length}개)</button>
          )}
          {/* R1754: 순서 번호 추가 */}
          <button
            title="선택 노드에 트리 순서대로 _1, _2... 번호 추가"
            onClick={async () => {
              if (!sceneFile.root) return
              let counter = 1
              function applySeq(n: CCSceneNode): CCSceneNode {
                const children = n.children.map(applySeq)
                if (!uuidSet.has(n.uuid)) return { ...n, children }
                return { ...n, name: `${n.name}_${counter++}`, children }
              }
              const result = await saveScene(applySeq(sceneFile.root))
              setBatchMsg(result.success ? `✓ 번호 추가 (${uuids.length}개)` : `✗ ${result.error ?? '오류'}`)
              setTimeout(() => setBatchMsg(null), 2000)
            }}
            style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 3, color: '#fbbf24', cursor: 'pointer' }}
          >번호 추가 _1,_2... ({uuids.length}개)</button>
        </div>
        {/* R1825: 이름 정규화 (base_001, base_002...) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <input
            value={batchNormBase}
            onChange={e => setBatchNormBase(e.target.value)}
            placeholder="base 입력 → 정규화"
            style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
          />
          <button
            title={`선택 노드를 {base}_001, _002... 형식으로 완전 재명명`}
            disabled={!batchNormBase}
            onClick={async () => {
              if (!sceneFile.root || !batchNormBase) return
              const pad = uuids.length >= 100 ? 3 : uuids.length >= 10 ? 2 : 1
              let counter = 1
              function applyNorm(n: CCSceneNode): CCSceneNode {
                const children = n.children.map(applyNorm)
                if (!uuidSet.has(n.uuid)) return { ...n, children }
                const idx = String(counter++).padStart(pad, '0')
                return { ...n, name: `${batchNormBase}_${idx}`, children }
              }
              const result = await saveScene(applyNorm(sceneFile.root))
              setBatchMsg(result.success ? `✓ 이름 정규화 (${uuids.length}개)` : `✗ ${result.error ?? '오류'}`)
              setBatchNormBase('')
              setTimeout(() => setBatchMsg(null), 2000)
            }}
            style={{ fontSize: 9, padding: '2px 8px', background: batchNormBase ? 'rgba(52,211,153,0.12)' : 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: batchNormBase ? '#34d399' : 'var(--text-muted)', cursor: batchNormBase ? 'pointer' : 'default', flexShrink: 0 }}
          >정규화 ({uuids.length}개)</button>
        </div>
        {/* R1856: 이름 find/replace */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <input
            value={batchFindStr}
            onChange={e => setBatchFindStr(e.target.value)}
            placeholder="찾기"
            style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
          />
          <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>→</span>
          <input
            value={batchReplaceStr}
            onChange={e => setBatchReplaceStr(e.target.value)}
            placeholder="바꾸기"
            style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
          />
          <button
            title="선택 노드 이름에서 찾기→바꾸기 실행"
            disabled={!batchFindStr}
            onClick={async () => {
              if (!sceneFile.root || !batchFindStr) return
              function applyFR(n: CCSceneNode): CCSceneNode {
                const children = n.children.map(applyFR)
                if (!uuidSet.has(n.uuid)) return { ...n, children }
                return { ...n, name: n.name.split(batchFindStr).join(batchReplaceStr), children }
              }
              const result = await saveScene(applyFR(sceneFile.root))
              setBatchMsg(result.success ? `✓ 이름 치환 (${uuids.length}개)` : `✗ ${result.error ?? '오류'}`)
              setTimeout(() => setBatchMsg(null), 2000)
            }}
            style={{ fontSize: 9, padding: '2px 6px', background: batchFindStr ? 'rgba(88,166,255,0.12)' : 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: batchFindStr ? '#58a6ff' : 'var(--text-muted)', cursor: batchFindStr ? 'pointer' : 'default', flexShrink: 0 }}
          >치환</button>
        </div>
        {/* R2708: 이름 정규식 필터 선택 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <input
            value={batchNameRegexFilter}
            onChange={e => setBatchNameRegexFilter(e.target.value)}
            placeholder="정규식 (예: Btn.*)"
            style={{ flex: 1, fontSize: 10, padding: '1px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 3 }}
          />
          <button
            title="정규식으로 노드명 매칭하여 선택"
            disabled={!batchNameRegexFilter}
            onClick={() => {
              if (!sceneFile.root || !batchNameRegexFilter) return
              if (batchNameRegexFilter.length > 200) return
              try {
                const re = new RegExp(batchNameRegexFilter, 'i')
                const matched: string[] = []
                function walk(n: CCSceneNode) {
                  if (re.test(n.name ?? '')) matched.push(n.uuid)
                  n.children?.forEach(walk)
                }
                walk(sceneFile.root)
                if (matched.length === 0) {
                  setBatchMsg('⚠ 매칭 없음')
                  setTimeout(() => setBatchMsg(null), 1500)
                  return
                }
                onMultiSelectChange?.(matched)
                setBatchMsg(`✓ ${matched.length}개 선택`)
                setTimeout(() => setBatchMsg(null), 1500)
              } catch {
                setBatchMsg('⚠ 잘못된 정규식')
                setTimeout(() => setBatchMsg(null), 1500)
              }
            }}
            style={{ fontSize: 9, padding: '2px 6px', background: batchNameRegexFilter ? 'rgba(88,166,255,0.12)' : 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: batchNameRegexFilter ? '#58a6ff' : 'var(--text-muted)', cursor: batchNameRegexFilter ? 'pointer' : 'default', flexShrink: 0 }}
          >선택</button>
          {['Button', 'Label', 'Sprite', 'Node', 'Panel'].map(q => (
            <button
              key={q}
              onClick={() => setBatchNameRegexFilter(q)}
              style={{ fontSize: 8, padding: '2px 4px', border: '1px solid rgba(107,114,128,0.4)', borderRadius: 2, background: 'rgba(107,114,128,0.05)', color: '#8b9dc3', cursor: 'pointer', flexShrink: 0 }}
            >{q}</button>
          ))}
        </div>
      </div>

      {/* R2737: Label 텍스트 일괄 수정 */}
      {uuids.length >= 1 && (() => {
        const applyLabelText = async () => {
          if (!labelText && labelMode === 'set') return
          await patchComponents(
            c => c.type === 'cc.Label',
            c => {
              const prev = typeof c.props['string'] === 'string' ? c.props['string'] as string : ''
              const next = labelMode === 'set' ? labelText : labelMode === 'prefix' ? labelText + prev : prev + labelText
              return { ...c, props: { ...c.props, string: next, _string: next, '_N$string': next } }
            },
            `Label텍스트 ${labelMode}="${labelText}" (${uuids.length}개)`,
          )
        }
        const inS: React.CSSProperties = { fontSize: 9, padding: '1px 3px', border: '1px solid var(--border)', borderRadius: 2, background: 'var(--bg-secondary)', color: 'var(--text-primary)', minWidth: 80 }
        return (
          <div style={{ marginBottom: 4, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Label텍스트 (R2737)</span>
            <select value={labelMode} onChange={e => setLabelMode(e.target.value as 'set' | 'prefix' | 'suffix')}
              style={{ fontSize: 9, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 3 }}>
              <option value="set">지정</option>
              <option value="prefix">접두사</option>
              <option value="suffix">접미사</option>
            </select>
            <input value={labelText} onChange={e => setLabelText(e.target.value)}
              style={inS} placeholder="텍스트..." />
            <span onClick={applyLabelText}
              title="선택된 Label 노드에 텍스트 적용"
              style={{ fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', color: '#94a3b8', userSelect: 'none' }}>적용</span>
          </div>
        )
      })()}
    </div>
  )
}
