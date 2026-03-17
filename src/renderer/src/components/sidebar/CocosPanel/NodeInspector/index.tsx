/**
 * NodeInspector — CCSceneNode 프로퍼티 인스펙터
 *
 * 디렉토리 구조:
 *   constants.tsx             — COMP_ICONS, COMP_DESCRIPTIONS, SpriteThumb, localStorage 키
 *   NodeInspectorTypes.ts     — 공유 타입/인터페이스
 *   useNodeInspector.tsx      — 상태 + 핸들러 커스텀 훅
 *   ComponentQuickEdit.tsx    — 컴포넌트 타입별 퀵에디트 렌더러
 *   GenericPropertyEditor.tsx — 범용 프로퍼티 에디터
 *   NodeInspectorHeader.tsx    — 헤더 (breadcrumb, stats, buttons, z-order, favorites, memo)
 *   NodeTransformSection.tsx  — Transform (position, rotation, scale, anchor, opacity, color)
 *   NodeInspectorView.tsx     — 메인 뷰 컴포넌트 (shell)
 *   index.tsx                 — re-export shell (이 파일)
 */

export { CCFileNodeInspector } from './NodeInspectorView'
export { SpriteThumb, COMP_ICONS, COMP_DESCRIPTIONS } from './constants'
