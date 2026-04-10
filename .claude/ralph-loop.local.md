---
active: true
iteration: 1
max_iterations: 999
completion_promise: CC Editor 엔진 경량화 + 2.x/3.x 호환성 + 렌더링 이슈 체크
started_at: "2026-04-10T01:00:00Z"
---

## CC Editor 전용 루프 — 엔진 경량화 + 호환성 + 렌더링

### 작업 방향

#### 1. 엔진 경량화 및 안정성 확보
- CC Editor 관련 불필요한 코드/의존성 제거
- 파서/저장 로직 최적화
- 메모리 사용량 감소 (캐시 정리, 대형 데이터 구조 최적화)
- 에러 복구 경로 강화

#### 2. CC 2.x / 3.x 통합 호환성 체크
- 파서: 2.x vs 3.x 지원 범위 매트릭스 작성
- 저장: 2.x vs 3.x 라운드트립 정확성 매트릭스
- Inspector: 각 렌더러의 2.x/3.x 호환 범위
- SceneView: 2.x/3.x 렌더링 차이점
- BatchInspector: 2.x/3.x 플러그인 호환성

#### 3. 렌더링 이슈 케이스 체크
- 3.x rotation 변환 (방금 수정) — 추가 엣지 케이스
- Sprite 이미지 렌더링 위치/크기 정확성
- Label 텍스트 렌더링 (폰트/크기/정렬/색상)
- 앵커 포인트 시각적 정확성
- 중첩 노드 좌표 변환
- 음수 스케일 (flip) 처리
- 부모-자식 변환 체인

### 제외 (건드리지 않음)
- Chat 기능, Terminal, Session, 일반 UI
