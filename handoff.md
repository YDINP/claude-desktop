# Handoff — claude-desktop
> 마지막 업데이트: 2026-03-15

## 완료 (R1500-2331)
- [x] R1500~R2305: (이전 세션 완료)
- [x] R2306~R2314: 갭 수정 + 이슈 버그 수정 (이전 세션 완료)
- [x] R2315: 씬뷰 SVG 직접 내보내기 — handleSvgExport + XMLSerializer→.svg 다운로드 버튼
- [x] R2316: ISSUE-001 shell:exec 위험 패턴 블록리스트 — rm -rf/del/format/fork-bomb 차단
- [x] R2317: CocosPanel 즐겨찾기 프로젝트 — ★/☆ 토글 + 즐겨찾기 드롭다운 (localStorage cc-favorite-projects)
- [x] R2318: 씬뷰 cc.Camera 뷰 프레임 오버레이 — orthoHeight 기반 황색 점선 사각형 + 📷 아이콘
- [x] R2319: 씬뷰 카메라 프레임 토글 — showCameraFrames state + toolbar 📷 버튼
- [x] R2320: cross-scene 노드 클립보드 — Ctrl+C 시 localStorage 저장, Ctrl+V 씬 전환 후 붙여넣기
- [x] R2321: undo/redo 스택 카운터 — undoCount/redoCount 노출 + ↩3 ↪2 형식 표시
- [x] R2322: 씬 파일명 클릭 → Windows 탐색기에서 열기 (explorer /select)
- [x] R2323: Inspector 자동 스크롤 — 노드 전환 시 inspectorScrollRef.scrollTo(0,0)
- [x] R2324: 씬뷰 자동 팬 — 트리 선택 노드가 뷰포트 밖이면 중심으로 이동 (flatNodesRef + effectiveWRef)
- [x] R2325: 씬 검색 UUID 지원 — #접두어 또는 hex 패턴으로 노드 UUID 부분 매칭
- [x] R2326: 씬뷰 체크무늬 배경 패턴 — bgPattern state + ⊞ 툴바 버튼
- [x] R2327: Save As (다른 이름으로 저장) — cc:file:saveAs IPC + preload + CocosPanel 버튼
- [x] R2328: Inspector 컴포넌트 타입 tooltip — COMP_DESCRIPTIONS 맵 32종
- [x] R2329: 씬뷰 선택 이력 ← → 버튼 — Alt+←/→ 연동 마우스 접근성
- [x] R2330: Inspector 컴포넌트 헤더 아이콘 — COMP_ICONS 맵 22종
- [x] R2331: 컴포넌트 추가 패널 개선 — 아이콘+tooltip + 커스텀 타입 입력(Enter)
- [x] R2332: Inspector active 토글 H키 힌트 (스타일 배지 + title tooltip)
- [x] R2333: 회전 0° 리셋 + 스케일 1:1 리셋 버튼
- [x] R2334: 씬뷰 단축키 도움말 최신화 (Alt+←/→, G, Ctrl+P 추가)
- [x] R2335: Inspector Sprite 텍스처 썸네일 미리보기 (SpriteThumb + ccFileResolveTexture)
- [x] R2336: BatchInspector 2-노드 선택 시 dx/dy/dist 거리 정보 패널
- [x] R2337: Inspector 노드 N-복제 (dupeCount ×N 입력, 최대 20개)
- [x] R2338: 씬 트리 우클릭 메뉴 JSON 복사 옵션
- [x] R2339: 씬 트리 노드 색상 태그 커스텀 색상 picker 추가

## 빌드/QA
- **QA: Critical: 0, Warning: 0, Pass: 2374** ← R2339 현재
- Branch: dev
- 최근 커밋: `31ecac5` (R2339), `d3499f0` (R2338), `c6f1325` (R2337), `5b2897c` (R2336), `a02d5bc` (R2335)

## 갭 수정 완료 상태
- **BatchInspector bare shorthand → ALL DONE** (R2298-R2305)
- **BatchInspector 명시적 prop → ALL DONE** (R2306-R2311)
- **단일노드 인스펙터 갭 → ALL DONE** (R2306-R2311)
- **`_N$` 패턴 총 550건** (CocosPanel.tsx 기준)

## 다음 예정 (R2332+)
- 기능 탐색: 대부분의 씬뷰/Inspector 기능이 이미 구현됨 (매우 comprehensive)
- 미발견 영역: 씬 비교, prefab 저장, 새로운 UX 개선 아이디어 탐색 필요
- 남은 이슈: ISSUE-007(npm audit), ISSUE-008(SDK), ISSUE-009(번들)

## 누적 이슈 (QA 체크포인트에서 발견된 기존 이슈)
- ISSUE-001: shell:true 입력검증 없음 (Critical — 기존 누적, R2316에서 부분 완화)
- ISSUE-007: npm audit 18 취약점 (기존 누적 — 모두 breaking change 필요)
- ISSUE-008: SDK 업그레이드 (기존 누적)
