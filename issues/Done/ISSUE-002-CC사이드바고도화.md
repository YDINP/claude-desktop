feature

cc 연동 좌측 사이드바 구성에 나머지 컴포넌트 옵션들도 볼 수 있도록 하는 구현방법.

현재 NodePropertyPanel은 cc.UITransform / cc.UIOpacity / Scale 정도만 표시.
씬에서 선택한 노드의 전체 컴포넌트 목록 + 각 컴포넌트의 속성을 드릴다운으로 볼 수 있으면 좋겠음.

예:
- cc.Sprite → spriteFrame, sizeMode, trim, color 등
- cc.Button → interactable, transition, normalColor 등
- cc.Label → string, fontSize, lineHeight, overflow 등
- cc.RichText → string, fontSize, maxWidth 등
- 커스텀 스크립트 컴포넌트도 속성 표시

---
**처리 상태: ✅ Round 85 완료
**확인 일시**: 2026-03-12 (ISSUE-001에서 이전됨)
