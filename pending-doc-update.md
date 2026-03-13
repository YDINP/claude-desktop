# Pending Documentation Update

> 이 파일을 다른 세션에서 열고 아래 프롬프트를 붙여넣으세요.

---

## 프롬프트

```
handoff.md 와 ROADMAP.md 에 아래 내용을 추가해줘. 기존 내용 수정 없이 추가만.

---

### 씬뷰 렌더링 심층 분석 결과 (2026-03-13)

3개 병렬 oracle 에이전트로 SceneView 노드 렌더링 동작 가능 여부 전수 분석.

**IPC 파이프라인**: cc:getTree / cc:getCanvasSize — Extension → cc-bridge → cc-handlers → preload → renderer 6레이어 완전 연결 ✅
**SVG 렌더링**: NodeRenderer rect/label/핸들/앵커 코드 실존, 동작 가능 ✅
**App 통합**: SceneViewPanel 마운트, snapshot 필터, close 가드 모두 정상 ✅
**좌표 변환 수식**: cocosToSvg Y-up→Y-down, 앵커, 회전 수식 올바름 ✅

**미수정 버그 (다음 라운드 수정 필요)**:
- 🔴 `SceneView/utils.ts flattenTree()` — node.position이 로컬 좌표인데 월드 좌표로 취급 → 중첩 노드 전부 위치 오류
- 🟡 `SceneView/NodeRenderer.tsx:25-26` — DESIGN_W/H = 960/640 하드코딩 → 캔버스 프리셋 변경 시 오프셋 오류

**수정 방법**:
1. utils.ts flattenTree() — parentWorldX/Y 누적 파라미터 추가 (worldX = parentWorldX + node.position.x)
2. NodeRenderer.tsx — designWidth/designHeight를 props로 받도록 변경 (TODO 주석 이미 있음)

---

위 내용을:
- handoff.md: "## 긴급 버그 수정" 섹션 바로 앞에 추가
- ROADMAP.md: "### Phase DD8" 섹션 바로 앞에 추가
```
