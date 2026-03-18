import React, { useState, useEffect } from 'react'

export function SpriteThumb({ sfUuid, assetsDir }: { sfUuid: string; assetsDir: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    window.api.ccFileResolveTexture?.(sfUuid, assetsDir).then(u => u && setUrl(u))
  }, [sfUuid, assetsDir])
  if (!url) return null
  return (
    <img
      src={url}
      title="스프라이트 텍스처 미리보기"
      style={{ width: 36, height: 36, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 3, background: 'rgba(0,0,0,0.4)', flexShrink: 0 }}
    />
  )
}

// R2330: 컴포넌트 타입별 아이콘 (Inspector 헤더 + hover panel 공유)
export const COMP_ICONS: Record<string, string> = {
  'cc.Label': 'T', 'cc.RichText': 'T',
  'cc.Sprite': '🖼', 'cc.TiledMap': '🗺', 'cc.VideoPlayer': '▷',
  'cc.Button': '⬜', 'cc.Toggle': '☑', 'cc.Slider': '⊟',
  'cc.Widget': '⚓', 'cc.Layout': '▤', 'cc.SafeArea': '📱',
  'cc.ScrollView': '⊠', 'cc.PageView': '⊟',
  'cc.EditBox': '✏', 'cc.ProgressBar': '▰',
  'cc.Animation': '▶', 'sp.Skeleton': '🦴', 'dragonBones.ArmatureDisplay': '🐉',
  'cc.AudioSource': '♪',
  'cc.RigidBody': '⚙', 'cc.BoxCollider': '⬡', 'cc.CircleCollider': '○', 'cc.PolygonCollider': '⬠',
  'cc.Camera': '📷', 'cc.Canvas': '🎨',
  'cc.BlockInputEvents': '🚫', 'cc.Mask': '◰', 'cc.ParticleSystem': '✦',
  'cc.MotionStreak': '〰', 'cc.GraphicsComponent': '✏',
}

// R2328: 컴포넌트 타입별 간단 설명 (Inspector 헤더 tooltip)
export const COMP_DESCRIPTIONS: Record<string, string> = {
  'cc.Label': '텍스트 레이블 — 문자열 렌더링',
  'cc.RichText': '리치텍스트 — HTML 태그 지원 텍스트',
  'cc.Sprite': '스프라이트 — 이미지/텍스처 렌더링',
  'cc.TiledMap': '타일맵 — TMX 기반 맵 렌더링',
  'cc.VideoPlayer': '비디오 플레이어 — 동영상 재생',
  'cc.Button': '버튼 — 클릭/탭 이벤트 처리',
  'cc.Toggle': '토글 — 체크박스 형태 스위치',
  'cc.Slider': '슬라이더 — 값 범위 입력',
  'cc.Widget': '위젯 — 부모 기준 앵커/스트레치 레이아웃',
  'cc.Layout': '레이아웃 — 자식 노드 자동 정렬',
  'cc.SafeArea': '세이프에리어 — 노치/홈바 회피 레이아웃',
  'cc.ScrollView': '스크롤뷰 — 스크롤 가능한 컨텐츠 영역',
  'cc.PageView': '페이지뷰 — 페이지 슬라이드 컨테이너',
  'cc.EditBox': '에디트박스 — 텍스트 입력 필드',
  'cc.Animation': '애니메이션 — 클립 기반 프레임 애니메이션',
  'sp.Skeleton': 'Spine 스켈레톤 — Spine 2D 애니메이션',
  'dragonBones.ArmatureDisplay': 'DragonBones — DragonBones 2D 애니메이션',
  'cc.AudioSource': '오디오소스 — 사운드 재생',
  'cc.RigidBody': '리지드바디 — 물리 시뮬레이션 바디',
  'cc.BoxCollider': '박스콜라이더 — 사각형 충돌 영역',
  'cc.CircleCollider': '원형콜라이더 — 원 충돌 영역',
  'cc.PolygonCollider': '폴리곤콜라이더 — 다각형 충돌 영역',
  'cc.Camera': '카메라 — 뷰 렌더링 시점',
  'cc.Canvas': '캔버스 — 씬 루트 렌더링 컨테이너',
  'cc.BlockInputEvents': '입력차단 — 하위 터치 이벤트 차단',
  'cc.ProgressBar': '프로그레스바 — 진행률 표시',
  'cc.Mask': '마스크 — 자식 렌더링 클리핑',
  'cc.ParticleSystem': '파티클시스템 — 입자 효과',
  'cc.MotionStreak': '모션스트릭 — 잔상 트레일 효과',
  'cc.GraphicsComponent': '그래픽스 — 벡터 드로잉',
}

// localStorage 키 상수
export const NOTES_KEY = 'cc-node-notes'
export const RECENT_COMPS_KEY = 'cc-recent-added-comps'
export const INSPECTOR_COLLAPSED_KEY = 'cc-inspector-collapsed'
export const COLLAPSED_COMPS_KEY = 'collapsed-comps'
export const PROP_HISTORY_KEY = 'prop-history'
export const STYLE_PRESETS_KEY = 'style-presets'
export const FAV_PROPS_KEY = 'fav-props'
