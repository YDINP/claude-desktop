# PRD: 리팩토링 스프린트 2차

**작성일:** 2026-03-16
**버전:** 1.0
**상태:** In Progress

---

## 1. 개요

### 전제 조건
- R2710까지 구현 완료
- 리팩토링 1차(Phase 1-A~6) 완료
- QA 검사 단계에서 Warning 항목 발견

### 목적
1. **긴급 버그 해소:** React Hooks 규칙 위반 수정
2. **코드 품질 개선:** 데드코드 제거, 메모리 누수 방지
3. **CI 인프라 구축:** 자동화된 품질 검사 파이프라인 추가

### 범위
- 버그 수정 (BUG-001, BUG-002)
- 리팩토링 (REFACTOR-001~004)
- CI 워크플로우 추가 (CI-001)
- 미구현 항목 추적 (R2701~R2710)

---

## 2. 즉시 수정 항목 (버그)

### BUG-001: CCFileSceneView.tsx editingZoom Hooks 위반

**심각도:** High
**상태:** Todo

#### 문제 분석
- **위치:** `src/components/CCFileSceneView.tsx`
- **원인:** IIFE(즉시 실행 함수) 내부에서 `React.useState()` 호출
- **증상:** Rules of Hooks 위반으로 React ESLint 경고 발생
- **영향:** 렌더링 순서 불안정, 상태 초기화 불예측 가능

#### 수정 방법

```typescript
// [문제 코드]
const [zoom, setZoom] = useState(1);
const edittingZoom = (() => {
  const [z, setZ] = useState(1);  // ← Hooks 위반
  return { z, setZ };
})();

// [수정 코드]
const [editingZoom, setEditingZoom] = useState(1);
// 또는 분리된 컴포넌트 생성
```

#### 검증 기준
- `editingZoom` 변수 선언이 컴포넌트 최상단에 위치
- ESLint `react-hooks/rules-of-hooks` 경고 제거

---

### BUG-002: CocosPanel Quick Edit 조건부 Hooks 호출

**심각도:** Medium
**상태:** Todo

#### 문제 분석
- **위치:** `src/components/CocosPanel.tsx` Quick Edit 섹션
- **원인:** 조건부 렌더링 내에서 hooks 호출 가능성
- **증상:** 조건 변경 시 hooks 호출 순서 변경 → 상태 연결 끊김

#### 수정 방법

```typescript
// [문제 패턴]
if (isQuickEditOpen) {
  const [value, setValue] = useState('');  // ← 조건부 hooks
}

// [수정 패턴]
const [value, setValue] = useState('');  // 최상단
if (isQuickEditOpen) {
  // 조건부 렌더링만 수행
}
```

#### 검증 기준
- 모든 hooks 선언이 컴포넌트/커스텀 훅 최상단
- 조건 구문이 hooks 선언 이후에만 나타남

---

## 3. 리팩토링 항목

### REFACTOR-001: CocosPanel 최상단 Orphan useState 제거

**심각도:** Low
**상태:** Todo
**영향도:** 안전 (사이드이펙트 없음)

#### 문제 분석
- **위치:** `src/components/CocosPanel.tsx` L65~101
- **원인:** Phase 2 마이그레이션 과정에서 미사용 상태값 미정리
- **현황:** ~50개의 useState 쌍이 선언되었으나 사용처 없음 (완전 데드코드)

#### 수정 작업
1. L65~101 범위 스캔
2. 미사용 `useState` 쌍 식별 (변수명 검색으로 사용처 확인)
3. 모든 미사용 선언문 일괄 삭제

#### 기대 효과
- 코드 라인 수: ~100줄 감소
- 번들 크기: 소량 감소
- 초기 렌더 성능: 미미한 개선

#### 검증 기준
- L65~101 범위에서 `useState` 선언 완전 제거
- 나머지 로직 동작 변화 없음 (스냅샷 테스트)

---

### REFACTOR-002: useBatchPatch 미적용 함수 마이그레이션

**심각도:** Medium
**상태:** Todo
**영향도:** 코드 일관성, 성능

#### 문제 분석
- **위치:** `src/components/CocosPanel.tsx` applyXxx 함수들 (100+개)
- **현황:** Phase 1에서만 20개 함수 마이그레이션, 나머지 여전히 레거시 패턴
- **레거시 패턴:**
  ```typescript
  const walk = (node) => { /* 수정 로직 */ };
  saveScene(walk);
  setBatchMsg(...);
  ```
- **신규 패턴:**
  ```typescript
  patchNodes(selectedNodeIds, (node) => { /* 수정 */ });
  patchComponents(selectedComponentIds, (comp) => { /* 수정 */ });
  ```

#### 수정 작업
1. `applyXxx` 함수 목록화 (grep으로 인라인 walk 패턴 검색)
2. 함수별 수정 로직 분석 (node/component 수정 구분)
3. `patchNodes`/`patchComponents` 호출로 교체
4. 테스트 (각 함수별 UI 반영 확인)

#### 기대 효과
- 코드 일관성 향상
- 배치 처리 오버헤드 감소
- 신규 개발자 온보딩 용이

#### 검증 기준
- 레거시 walk 패턴 제거 (0개 유지)
- 각 applyXxx 함수의 UI 변경 정상 작동
- 배치 메시지 정상 표시

---

### REFACTOR-003: localStorage 동기 읽기 최적화

**심각도:** Low
**상태:** Todo
**영향도:** 초기 로딩 성능

#### 문제 분석
- **위치:** `src/components/CocosPanel.tsx` 초기 렌더
- **현황:** localStorage.getItem() 20회 이상 분산 호출
- **문제점:** 각 호출마다 동기 I/O 대기 → 초기 렌더 블로킹

#### 수정 방법

```typescript
// [문제 코드]
const val1 = localStorage.getItem('key1');
const val2 = localStorage.getItem('key2');
// ... 20회 반복

// [수정 코드]
const config = useMemo(() => {
  return {
    key1: localStorage.getItem('key1'),
    key2: localStorage.getItem('key2'),
    // ... 일괄 읽기
  };
}, []);
```

또는

```typescript
useEffect(() => {
  const config = {
    key1: localStorage.getItem('key1'),
    key2: localStorage.getItem('key2'),
  };
  setConfig(config);
}, []);
```

#### 기대 효과
- 초기 렌더 시간: 5~10ms 개선 (예상)
- 코드 가독성 향상

#### 검증 기준
- DevTools Performance 탭에서 초기 렌더 시간 측정
- localStorage 호출 횟수 확인 (1회 이하)

---

### REFACTOR-004: setTimeout/clearTimeout 누락 (메모리 누수)

**심각도:** Low
**상태:** Todo
**영향도:** 메모리 누수 방지

#### 문제 분석
- **위치:** `src/components/CocosPanel.tsx` 배치 핸들러 (100+개)
- **현황:** setTimeout 설정 후 cleanup 없음
- **영향:** 컴포넌트 언마운트 후에도 타이머 실행 → 메모리 누수

#### 수정 방법

```typescript
// [문제 코드]
const handleApply = () => {
  setTimeout(() => {
    setBatchMsg('');
  }, 1500);
};

// [수정 코드]
const timerRef = useRef(null);

const handleApply = () => {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => {
    setBatchMsg('');
  }, 1500);
};

useEffect(() => {
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };
}, []);
```

#### 기대 효과
- 메모리 누수 제거
- 컴포넌트 재마운트 시 경쟁 조건 방지

#### 검증 기준
- DevTools Memory 탭에서 컴포넌트 언마운트 후 타이머 미실행 확인
- 콘솔 경고 제거

---

## 4. 신규 기능: CI 워크플로우

### CI-001: GitHub Actions CI 파이프라인

**심각도:** High
**상태:** Todo

#### 목표
- 자동화된 품질 게이트
- 메인 브랜치 보호
- PR 검토 자동화 지원

#### 구현 내용

**파일 경로:** `.github/workflows/ci.yml`

**트리거 이벤트:**
- `push to dev` (자동 테스트)
- `push to main` (엄격한 체크)
- `pull_request to main` (PR 검토용)

**체크 항목:**

| # | 항목 | 설명 | 실패 시 동작 |
|---|------|------|-------------|
| 1 | TypeScript 컴파일 | `tsc --noEmit` | 빌드 실패 |
| 2 | ESLint | `eslint . --max-warnings 50` | Warning 50개 초과 시 실패 |
| 3 | Electron-Vite 빌드 | `electron-vite build` (선택적) | 경고만 표시 |

**설정:**

```yaml
name: CI

on:
  push:
    branches: [dev, main]
  pull_request:
    branches: [main]

jobs:
  lint-and-build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: tsc --noEmit

      - name: ESLint
        run: npx eslint . --max-warnings 50

      - name: Build (electron-vite)
        run: npm run build
        continue-on-error: true
```

#### 기대 효과
- PR 머지 전 최소 품질 기준 확보
- 린트 경고 증가 추적
- 빌드 실패 자동 감지

#### 검증 기준
- `.github/workflows/ci.yml` 파일 존재
- GitHub Actions 탭에서 워크플로우 실행 확인
- PR에 체크 상태 표시됨

---

## 5. 미구현 라운드 추적

R2710까지 구현되었으나, 다음 항목들은 아직 미완료 상태입니다. 스프린트 2차에서는 버그 해소에 집중하며, 이 항목들은 향후 스프린트에서 처리합니다.

| R번호 | 제목 | 설명 | 예상 위험도 | 담당자 예정 |
|-------|------|------|-----------|-----------|
| R2701 | 마르키 선택 (Rubber-band) | 드래그로 사각형 선택 영역 표시 | Medium | - |
| R2705 | Alt+drag 복제 | 선택 객체 Alt+드래그로 복제 | High | - |
| R2706 | 단색 일괄 적용 (Solid Color) | 배치 작업에 단색 옵션 추가 | Low | - |
| R2707 | 선택 히스토리 | 이전/다음 선택 상태로 이동 | Low | - |

---

## 6. QA 검증 계획

### 검증 체크리스트

| ID | 검증 항목 | 검증 방법 | 기준 |
|----|---------|---------|------|
| V-001 | BUG-001 수정 | grep: `editingZoom` 정상 선언 위치 확인 | 컴포넌트 최상단 |
| V-002 | BUG-002 수정 | grep: `useState` 조건부 호출 확인 | 0개 미검출 |
| V-003 | REFACTOR-001 | grep: `useState` L65~101 제거 확인 | 0개 미검출 |
| V-004 | REFACTOR-002 | grep: 레거시 `walk` 패턴 확인 | 0개 미검출 |
| V-005 | REFACTOR-003 | grep: `localStorage.getItem` 호출 횟수 | 1회 이상 병합 |
| V-006 | REFACTOR-004 | grep: `setTimeout` cleanup 확인 | 100% 정상화 |
| V-007 | CI-001 | 파일 존재 확인 | `.github/workflows/ci.yml` 존재 |
| V-008 | R2708 이름 정규식 | grep: `applyNameRegexSelect` 존재 | 함수 존재 및 작동 |
| V-009 | R2710 크기 고정값 | grep: `applyBatchFixedSize` 존재 | 함수 존재 및 작동 |

### QA 실행 순서
1. 정적 분석 (ESLint, TypeScript)
2. 코드 리뷰 (변경 사항 검토)
3. 수동 테스트 (각 기능별 UI 확인)
4. CI 워크플로우 검증 (GitHub Actions 실행)

---

## 7. 일정 및 우선순위

### 우선순위 매트릭스

| 우선순위 | 항목 | 예상 시간 |
|---------|------|---------|
| **P0 (High)** | BUG-001, BUG-002, CI-001 | 4~6h |
| **P1 (Medium)** | REFACTOR-002 | 6~8h |
| **P2 (Low)** | REFACTOR-001, REFACTOR-003, REFACTOR-004 | 3~5h |

### 예상 총 소요 시간
- **개발:** 13~19시간
- **QA:** 2~3시간
- **버퍼:** 2시간
- **총계:** 17~24시간 (2~3일)

---

## 8. 완료 기준

### 개발 완료
- [ ] BUG-001 수정 완료 및 ESLint 경고 제거
- [ ] BUG-002 수정 완료
- [ ] REFACTOR-001 완료 (~100줄 삭제)
- [ ] REFACTOR-002 완료 (레거시 패턴 0개)
- [ ] REFACTOR-003 완료 (localStorage 최적화)
- [ ] REFACTOR-004 완료 (cleanup 추가)
- [ ] CI-001 워크플로우 추가 및 실행 확인

### QA 완료
- [ ] V-001~V-009 모든 항목 검증 완료
- [ ] 수동 테스트 스냅샷 비교 (회귀 없음)
- [ ] GitHub Actions 2회 이상 성공 실행

### 문서 완료
- [ ] 이 PRD 최종 검토 및 승인
- [ ] TASKS-refactor-sprint2.json 작업 항목 등록

---

## 9. 참고 사항

- **breaking change 없음:** 모든 수정은 내부 리팩토링이며 API 변경 없음
- **테스트 전략:** 기존 스냅샷 테스트로 회귀 검증
- **롤백 계획:** Git 태깅으로 버전 관리, 필요 시 즉시 되돌림 가능
- **커뮤니케이션:** 각 단계별 진행상황은 TASKS 문서에 반영

