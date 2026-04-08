---
active: false
iteration: 2
max_iterations: 100
completion_promise: 모든 대형 파일 1,500줄 이하 + UX/UI 일관성 + 아키텍처 정리
started_at: "2026-04-08T05:00:00Z"
---

## 안정화/리팩토링 오케스트레이션 루프 (Phase 2)

### 완료 항목 (커밋 a9a5ad12)
- ✅ Critical 0 / Warning 0 / Pass 2,632
- ✅ component.tsx 10,334→68줄 (18개 분리)
- ✅ ChatPanel 2,498→1,497줄, SessionList 2,402→618줄
- ✅ SceneViewPanel 5,894→4,439줄 (4개 훅)
- ✅ 공통 훅 4개 (useCopyToClipboard/useLocalStorage/useExpandedId/download.ts)
- ✅ 사이드바 패널 6개 생성

### 이번 루프 목표 (순서대로 진행)

#### 1. CCFileSceneView.tsx 리팩토링 (5,525줄)
- 렌더링/로직 분리, 훅 추출
- 1,500줄 이하 목표

#### 2. InputBar.tsx (2,086줄) + MessageBubble.tsx (2,070줄) 리팩토링
- 훅/하위 컴포넌트 추출
- 1,500줄 이하 목표

#### 3. SceneInspector.tsx (1,869줄) + TerminalPanel.tsx (1,621줄) + misc.tsx (1,523줄)
- 1,500줄 이하로 경량화

#### 4. UX/UI 디자인 일관성 강화
- 사이드바 패널 헤더/검색/필터/빈 상태 UI 통일
- 공통 컴포넌트 추출 (버튼/인풋/뱃지)
- 애니메이션/트랜지션 일관성

#### 5. 아키텍처 정리
- PRD-architecture-refactor.md 잔여 Phase
- IPC 직접 호출 → Typed Kernel 전환 (점진적)

### 규칙
- 신기능 금지, 기존 코드 구조 개선만
- 기존 동작 100% 보존
- QA Warning 0 유지
- 매 iteration 후 tsc + build + qa 검증
- 3~4개 파일씩 병렬 에이전트로 처리
