# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-24

---

## 현재 이슈

없음 (QA 2621 Pass / 0 Warning / 0 Critical)

---

## 최근 주요 작업 (2026-03-18 ~ 03-24)

### CCEditor 인스펙터 전면 리디자인
- zoom 1.08 래퍼 제거, secHeader 색상바 시스템 (transform=파랑, anchor=보라 등)
- numInput 높이 24px, 축별 색상 (X빨강/Y초록/W파랑/H보라), 입력 11px
- 컴포넌트 카드 border+borderRadius, + 컴포넌트 추가 섹션 재정렬
- 인스펙터 섹션 순서 재정렬: 컴포넌트 목록 → + 추가 → 자식 → 씬파일정보

### CCEditor 버그 수정
- CC 3.x 압축 UUID → 스크립트 이름 변환 (역공학으로 알고리즘 해독)
  `7c603HBT+FJvaNzViI6zIeZ` → `Hi5Lang_Lable` 정상 표시
- CC 2.x sub-meta UUID → 스크립트 이름 변환 (buildUUIDMap 타입 수정)
- 씬뷰 라벨 폰트 미적용: `_N$file` fallback 추가, CC 3.x blendFactor enum 표시
- 탭 전환 시 CCEditor 오동작: window mouseup 드래그 ref 정리, keydown 가시성 가드
- WelcomeScreen WebkitAppRegion:drag 제거 (탭 전환 시 타이틀바 동작 버그)
- 라벨 텍스트 줌 스케일링 수정 (fontSize={fs/zoom} → fontSize={fs})

### 채팅 UX 개선
- 커스텀 슬래시 커맨드 IPC 시스템 (commandScan/commandLoadWorkflow)
- SlashCommandRegistry 싱글턴 (builtin/custom/workflow 통합)
- 스크롤 깜빡임 수정: handleScroll setMinimapScroll 50ms debounce
- 슬래시 드롭다운 Space 입력 시 닫힘 수정 (parseSlash args 반환값)

### 코드 리뷰 수정 (CRITICAL~LOW 총 16건)
- LabelRenderer: cc.Label → LabelQuickEdit 별도 컴포넌트 (Rules of Hooks 위반 해소)
- NodeInspectorView: Ctrl+Z/Y undo/redo 키보드 단축키, handleUndo/Redo ref 안정화
- GenericPropertyEditor: buildPropKeyLabel map 밖 정의, shallowEqualPropValue 최적화
- SpriteRenderer: BLEND_FACTOR[776]=SRC_ALPHA_SATURATE 수정 (774 오류)
- JSON.parse crash 보호, prefab 구조검증, RawJSON 타입검증 등

### 씬뷰 개선
- R1699 선택 노드 정보 오버레이 (우상단 X/Y/W/H)
- R1510 Widget alignFlags 시각화 (violet 방향 선)
- R1614 화면 밖 노드 방향 화살표
- R2344 씬 통계 컴포넌트 분포 바 시각화
- QA Warning 12 → 0 (모든 미구현 항목 해결)

---

## Architecture Refactor 완료 현황

### Phase A~F + /ultrawork ✅ DONE
- 전체 컴포넌트 분리 완료, QA 2621 Pass / 0 Warning / 0 Critical

---

## 주요 파일 현황

| 파일 | 비고 |
|------|------|
| `CocosPanel/NodeInspector/renderers/LabelRenderer.tsx` | LabelQuickEdit 분리 |
| `CocosPanel/NodeInspector/NodeInspectorView.tsx` | Ctrl+Z/Y, visibleComps useMemo |
| `CocosPanel/NodeInspector/GenericPropertyEditor.tsx` | COMP_SKIP 확장, 최적화 |
| `CocosPanel/NodeInspector/useNodeInspector.tsx` | flushSave ref 안정화 |
| `SceneView/CCFileSceneView.tsx` | 씬뷰 오버레이 다수 |
| `main/cc/cc-asset-resolver.ts` | CC 3.x UUID 압축/해제 |
| `main/cc/cc-file-parser.ts` | scriptNames, UUID 해결 |
| `chat/InputBar.tsx` | SlashCommandRegistry |
| `chat/ChatPanel.tsx` | scroll debounce |

---

## QA 상태

- **현재**: 2621 Pass, 0 Warning, 0 Critical
- Warning 기존 12건 → 모두 해결 (씬뷰 오버레이/통계 구현)

---

## 참고사항

- CC 3.x UUID 압축 알고리즘: `prefix(5) + Base64(nibble5 + bytes[3..15]) = 23chars`
- npm audit 잔여 10개 low: electron-builder 체인 (런타임 무관)
- 다음 후보: R2727+ 신기능, BatchInspector 강화
