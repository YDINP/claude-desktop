# Changelog — Claude Desktop

## [Round 370] — 2026-03-13
### Added
- CalendarPanel: 다음 이벤트 "더 보기" 토글 — 3개 초과 시 "더 보기 (N개)" 버튼, 전체/접기 토글

## [Round 369] — 2026-03-13
### Added
- SnippetPanel: 카테고리 필터 칩에 스니펫 수 표시 — 각 카테고리 버튼에 `(N)` 카운트 배지

## [Round 368] — 2026-03-13
### Added
- GlobalSearchPanel: 검색 기록 삭제 — 항목별 × 버튼으로 개별 삭제, 헤더 "전체 삭제" 버튼

## [Round 367] — 2026-03-13
### Added
- CocosPanel: 빠른 포트 선택 버튼 — 포트 입력 옆 9090(CC 2.x)/9091(CC 3.x) 버튼, 현재 포트 강조 표시

## [Round 366] — 2026-03-13
### Added
- RunTimeline: 진행 중 런 필터 토글 — 활성+완료 런이 혼재할 때 ⟳ 버튼으로 진행 중만 표시

## [Round 365] — 2026-03-13
### Added
- ConnectionPanel: 설정 파일 경로 복사 버튼 — 푸터 경로 옆 📋 버튼, 복사 후 ✓ 피드백

## [Round 364] — 2026-03-13
### Added
- WebPreviewPanel: URL 복사 버튼 — 현재 URL을 클립보드에 복사, 1.5초 ✓ 피드백

## [Round 363] — 2026-03-13
### Added
- AssetBrowserPanel: 타입 필터 칩 카운트 표시 — "📝 script (3)" 형태로 에셋 수 표시

## [Round 362] — 2026-03-13
### Added
- PluginsPanel: 코드 복사 버튼 — 코드 뷰 헤더에 📋 복사 버튼, 복사 후 "✓ 복사됨" 피드백

## [Round 361] — 2026-03-13
### Added
- BookmarksPanel: 미리보기 확장 토글 — ▼/▲ 버튼으로 북마크 전체 텍스트 인라인 펼치기/접기

## [Round 360] — 2026-03-13
### Added
- TasksPanel: 전부 완료 버튼 — 활성 태스크가 있을 때 "✓ 전부" 버튼으로 모든 태스크를 완료 처리

## [Round 359] — 2026-03-13
### Added
- SearchPanel: 전체 접기/펼치기 버튼 — 결과 요약 바에 ⊖/⊕ 버튼, 모든 파일 그룹 일괄 접기/펼치기

## [Round 358] — 2026-03-13
### Added
- StatsPanel: 히트맵 요일 레이블 — 활동 히트맵 좌측에 일/화/목/토 레이블 추가 (GitHub contribution chart 스타일)

## [Round 357] — 2026-03-13
### Added
- OutlinePanel: 역순 정렬 토글 — ↓/↑ 버튼으로 아웃라인 항목 순서 반전, 최신 헤딩 먼저 보기

## [Round 356] — 2026-03-13
### Added
- DiffPanel: diff 통계 표시 — 비교 후 추가/삭제 라인 수를 `getLineChanges()`로 계산해 "▲ N추가  ▼ N삭제" 표시

## [Round 355] — 2026-03-13
### Added
- FileTree: 숨김 파일 토글 — 헤더 `.` 버튼으로 `.`으로 시작하는 파일/폴더 표시/숨기기, 기본값 숨김(hideHidden=true)

## [Round 354] — 2026-03-13
### Added
- NodePropertyPanel: 노드 활성화/비활성화 토글 버튼 — 이름 왼쪽에 ●/○ 버튼, 클릭 시 ccSetProperty('active') 호출

## [Round 353] — 2026-03-13
### Added
- SceneTreePanel: 비활성 노드 숨기기 토글 — "비활성 N" 배지 클릭 시 비활성 노드 필터링, 재클릭 시 복원

## [Round 352] — 2026-03-13
### Added
- PromptChainPanel: 스텝 결과 복사 버튼 — 실행 완료 후 각 스텝 결과에 📋 복사 버튼 추가, 복사 시 ✓ 피드백

## [Round 351] — 2026-03-13
### Added
- GlobalSearchPanel: 검색 히스토리 — 최근 검색어 최대 5개 저장(localStorage), 포커스 시 히스토리 드롭다운 표시, 클릭 시 재검색

## [Round 350] — 2026-03-13
### Added
- AgentPanel: 태스크 검색 필터 — 태스크 1개↑ 시 검색 입력창 표시, 이름/프롬프트 대상 실시간 필터

## [Round 349] — 2026-03-13
### Added
- ClipboardPanel: 항목 고정(pin) 기능 — 호버 시 📌 버튼 표시, 고정 항목은 상단 고정 + 배경 강조

## [Round 348] — 2026-03-13
### Added
- NotesPanel: .txt/.md 파일 가져오기 — 📥 버튼 클릭으로 텍스트/마크다운 파일 임포트, 첫 줄 # 헤딩을 제목으로, 파일명 폴백

## [Round 347] — 2026-03-13
### Added
- CalendarPanel: 연도 빠른 이동 — 연도 클릭 시 드롭다운으로 ±5년 범위 연도 선택 가능

## [Round 346] — 2026-03-13
### Added
- ChangedFilesPanel: W/E 오퍼레이션 필터 버튼 — W(Write)/E(Edit) 배지 버튼 클릭 시 해당 타입만 필터, 재클릭 시 해제

## [Round 345] — 2026-03-13
### Added
- RemotePanel: 최근 접속 순 정렬 — 연결 클릭 시 lastUsed 타임스탬프 업데이트, 저장된 호스트 최근 사용 순 정렬, 24시간 이내 사용 호스트에 "최근" 배지

## [Round 344] — 2026-03-13
### Added
- GitPanel: 전체 스테이지/해제 버튼 — 변경사항 섹션에 "전체 +" 버튼, 스테이징됨 섹션에 "전체 해제" 버튼 추가

## [Round 343] — 2026-03-13
### Added
- SnippetPanel: 카테고리 퀵 필터 칩 — 카테고리별 필터 칩 버튼 표시(2개↑ 시), 선택 시 해당 카테고리 스니펫만 표시

## [Round 342] — 2026-03-13
### Added
- ConnectionPanel: 자동 핑 토글 버튼 — ⟳ ON/OFF 전환, 활성 시 30초 간격 자동 전체 핑

## [Round 341] — 2026-03-13
### Added
- CocosPanel: 연결 유지 시간 표시 — 연결됨 배지에 uptime 표시 (`연결됨 5m`), 10초 갱신

## [Round 340] — 2026-03-13
### Added
- DiffPanel: 최근 비교 파일 쌍 히스토리 — 비교 시 localStorage 저장(최대 8개), 🕐 버튼 드롭다운으로 재사용

## [Round 339] — 2026-03-13
### Added
- SearchPanel: 검색 결과 파일 그룹 ▾/▸ 접기/펼치기 — 파일명 옆 토글로 매치 목록 숨김/표시, 접힌 상태에서 매치 수 표시

## [Round 338] — 2026-03-13
### Added
- AssetBrowserPanel: 에셋 타입 필터 칩 버튼 — script/prefab/texture 등 타입별 필터, 검색과 AND 조합

## [Round 337] — 2026-03-13
### Added
- PluginsPanel: 플러그인 검색 필터 — 3개↑ 시 검색창 표시, 이름/설명/작성자 대상 검색

## [Round 336] — 2026-03-13
### Added
- WebPreviewPanel: ← → 뒤로/앞으로 탐색 버튼 — URL 히스토리 스택 관리, 비활성 상태 시 회색 처리

## [Round 335] — 2026-03-13
### Added
- TasksPanel: 기한 초과(overdue) 빠른 필터 배지 — 초과 태스크 존재 시 `⚠ 초과 N` 빨간 버튼 표시, 클릭 토글

## [Round 334] — 2026-03-13
### Added
- StatsPanel: 새로고침 버튼 추가 — 클릭 시 세션 통계/비용 재로드, `refreshing` 상태로 로딩 표시

## [Round 333] — 2026-03-13
### Added
- RunTimeline: RunCard 헤더 클릭으로 스텝 목록 접기/펼치기 — 4개 이상 스텝 시 기본 접힘, 진행 중 런은 항상 펼침

## [Round 332] — 2026-03-13
### Added
- BookmarksPanel: 북마크 아이템별 📋 복사 버튼 — 클릭 시 전체 텍스트 클립보드 복사, 1.5초 ✓ 피드백

## [Round 331] — 2026-03-13
### Added
- OutlinePanel: H1/H2/H3 레벨 필터 버튼에 항목 수 표시 (`H1(3)`) — 0개 레벨 버튼 자동 숨김

## [Round 330] — 2026-03-13
### Added
- GlobalSearchPanel: 검색 결과 날짜순/관련성순 정렬 토글 버튼 (📅/⭐) — updatedAt 기준 최신순

## [Round 329] — 2026-03-13
### Added
- NotesPanel: 노트 목록 각 항목에 글자 수 표시 — 999자 이하 `N자`, 이상 `N.Nk` 형식

## [Round 328] — 2026-03-13
### Added
- CalendarPanel: 날짜 미선택 시 오늘 이후 이벤트 최대 3개 "다음 이벤트" 미리보기 표시 (클릭 시 해당 날짜 선택)

## [Round 327] — 2026-03-13
### Added
- SceneTreePanel: 헤더에 비활성 노드 수 표시 — `비활성 N개` 빨간 텍스트 (active: false 재귀 카운트)

## [Round 326] — 2026-03-13
### Added
- PromptChainPanel: 체인 탭에 📋 복제 버튼 추가 — 스텝 전체 복사 후 `(복사)` 접미사로 새 체인 생성

## [Round 325] — 2026-03-13
### Added
- NodePropertyPanel: 컴포넌트 2개 이상일 때 ⊕/⊖ 전체 펼치기/접기 버튼 추가 (allOpen 기반)

## [Round 324] — 2026-03-13
### Added
- ChangedFilesPanel: ↓/↑ 정렬 토글 버튼 — 최신순/오래된순 전환 (sortAsc)

## [Round 323] — 2026-03-13
### Added
- RemotePanel: 3개 초과 호스트 시 검색 필터 입력 표시 — alias/hostname/user 부분 일치 필터링

## [Round 322] — 2026-03-13
### Added
- SnippetPanel: 각 스니펫에 📋 복사 버튼 추가 — 클립보드 복사 후 ✓ 피드백 1.5초 표시

## [Round 321] — 2026-03-13
### Added
- ConnectionPanel: 핑 후 헤더에 `N/M 활성` 배지 — 전체 활성 시 초록, 0개 활성 시 빨강, 일부 활성 시 노랑

## [Round 320] — 2026-03-13
### Added
- GitPanel: 헤더에 변경 파일 수 배지 — staged 있을 때 `N↑` (초록), 없을 때 `N` (회색) 표시

## [Round 319] — 2026-03-13
### Added
- SearchPanel: 결과 요약 배너 — 결과 있을 때 `N개 파일 · M개 매치` + 확장자 필터 수 표시

## [Round 318] — 2026-03-13
### Added
- PluginsPanel: 플러그인 정렬 토글 — 기본/이름순(A↓)/활성 먼저(●↑) 3단계 순환, sortedPlugins useMemo

## [Round 317] — 2026-03-13
### Added
- ClipboardPanel: 검색 시 필터 결과 수 헤더 표시 — 검색 활성 시 `N/M개 항목` 형태로 업데이트

## [Round 316] — 2026-03-13
### Added
- BookmarksPanel: 필터 시 결과 수 표시 — 검색/역할 필터 활성 시 `N/M개` 형태로 필터된/전체 수 표시

## [Round 315] — 2026-03-13
### Added
- TasksPanel: 태스크 Markdown 내보내기 버튼 — 📤 클릭으로 우선순위·마감일·메모 포함한 MD 파일 다운로드

## [Round 314] — 2026-03-13
### Added
- StatsPanel: 히트맵 헤더에 활동 일수 + 활동률 표시 — `N일 · X%` 형태로 활동 밀도 시각화

## [Round 313] — 2026-03-13
### Added
- FileTree: 전체 접기 버튼 — ⊖ 클릭으로 expandedDirs + childrenMap 초기화, 펼친 폴더 있을 때만 표시

## [Round 312] — 2026-03-13
### Added
- NotesPanel: 편집기 하단 줄 수 표시 — `N자 · M단어 · L줄` 형태로 줄 수 추가 표시

## [Round 311] — 2026-03-13
### Added
- RunTimeline: 완료된 런 삭제 버튼 — 🗑 클릭으로 `clearedAt` 타임스탬프 이전 완료 런 화면에서 제거

## [Round 310] — 2026-03-13
### Added
- GlobalSearchPanel: 역할 필터 버튼 — 전체/나/Claude 토글로 검색 결과 필터링, 결과 수 실시간 업데이트

## [Round 309] — 2026-03-13
### Added
- AssetBrowserPanel: 헤더 에셋 수 배지 — 전체 non-folder 에셋 수 표시, 검색 시 N/M 형태

## [Round 308] — 2026-03-13
### Added
- OutlinePanel: 아웃라인 전체 복사 버튼 — 📋 클릭으로 필터된 항목을 마크다운 헤딩 형식으로 클립보드 복사

## [Round 307] — 2026-03-13
### Added
- DiffPanel: 원본/수정 경로 교체 버튼 — ⇄ 클릭으로 `leftPath ↔ rightPath` + 콘텐츠 동시 교체

## [Round 306] — 2026-03-13
### Added
- WebPreviewPanel: 외부 브라우저에서 열기 버튼 — ↗ 클릭으로 `window.open(_blank)` 외부 열기

## [Round 305] — 2026-03-13
### Added
- SceneTreePanel: 헤더에 총 노드 수 표시 — `씬 트리 (N)` countNodes 재귀 집계

## [Round 304] — 2026-03-13
### Added
- NodePropertyPanel: 노드 UUID 복사 버튼 — 📋 클릭으로 UUID 클립보드 복사, ✓ 피드백

## [Round 303] — 2026-03-13
### Added
- PromptChainPanel: 체인 툴바에 마지막 실행 시간 + 단계 수 표시 — `마지막 실행: X분 전 · N단계`

## [Round 302] — 2026-03-13
### Added
- AgentPanel: 탭 배지 — 태스크 탭에 활성 수, 히스토리 탭에 런 수 배지 표시

## [Round 301] — 2026-03-13
### Added
- RemotePanel: 헤더에 총 호스트 수 배지 — `N개` (ssh config + 저장 호스트 합산)

## [Round 300] — 2026-03-13
### Added
- SearchPanel: 매치 줄 검색어 하이라이트 — `highlightLine` 함수로 `<mark>` 노란 배경 강조, 정규식 지원

## [Round 299] — 2026-03-13
### Added
- ConnectionPanel: "모두 핑" 버튼 — 전체 MCP 서버를 Promise.all로 동시 핑, 결과 실시간 반영

## [Round 298] — 2026-03-13
### Added
- GitPanel: 커밋 메시지 글자 수 카운터 — 첫 번째 줄 N/72 표시, 60자 초과 시 노랑, 72자 초과 시 빨강

## [Round 297] — 2026-03-13
### Added
- ChangedFilesPanel: 헤더에 W/E 작업 구분 카운트 표시 — `W:N E:N` 색상 구분 (초록/노랑)

## [Round 296] — 2026-03-13
### Added
- ClipboardPanel: 각 항목 글자 수 표시 — 타임스탬프 옆에 `N자` 우측 정렬 표시

## [Round 295] — 2026-03-13
### Added
- SnippetPanel: 정렬 토글 버튼 — 생성 순(최신 우선) / 이름 순(가나다) 전환, ↕️/🔤 버튼

## [Round 294] — 2026-03-13
### Added
- PluginsPanel: 활성화 플러그인 수 배지 — 헤더에 `N/M 활성` 배지 표시, 플러그인 토글 시 실시간 갱신

## [Round 293] — 2026-03-13
### Added
- RunTimeline: 완료 런 합산 비용 표시 — 헤더에 총 `$X.XXXX` 비용 합산, 런/완료 건수 표시

## [Round 292] — 2026-03-13
### Added
- OutlinePanel: 헤딩 레벨 필터 버튼 (H1/H2/H3) — 클릭 시 해당 레벨만 표시, 재클릭 시 전체 복귀

## [Round 291] — 2026-03-13
### Added
- BookmarksPanel: 역할 필터 토글 버튼 — 전체/나/Claude 순환, 활성 시 강조 표시

## [Round 290] — 2026-03-13
### Improved
- GlobalSearchPanel: 검색 결과 발췌문에 검색어 하이라이트 — `<mark>` 노란 배경 강조 표시

## [Round 289] — 2026-03-13
### Added
- StatsPanel: 일평균 세션 수 카드 — 스트릭 섹션에 `totalSessions/totalDays` 소수점 1자리 카드 추가

## [Round 288] — 2026-03-13
### Improved
- TasksPanel: 마감일 배지 D-Day 카운트다운 — `D-5`, `D-Day`, `⚠-3` 표시, 3일 이하 주황, 당일 노랑, 초과 빨강

## [Round 287] — 2026-03-13
### Added
- CalendarPanel: 선택 날짜 이벤트 전체 삭제 버튼 — 이벤트 있을 때 "전체 삭제" 버튼 표시

## [Round 286] — 2026-03-13
### Added
- TasksPanel: 전체 완료 시 🎉 배너 표시 — 100% 완료 시 진행률 바 대신 녹색 완료 배너 표시

## [Round 285] — 2026-03-13
### Added
- NotesPanel: 모노스페이스 코드 모드 토글 (`</>` 버튼) — 코드/텍스트 폰트 전환, 활성 시 강조

## [Round 284] — 2026-03-13
### Improved
- SceneView: 노드 정보 오버레이(I키)에 컴포넌트 타입 목록 추가 — `cc.` 접두사 제거 후 쉼표 구분 표시

## [Round 283] — 2026-03-13
### Improved
- CalendarPanel: 이번 달 이벤트 수 요약 표시 — 세션 요약 라인에 `이벤트 N개` 강조 표시 추가

## [Round 282] — 2026-03-13
### Added
- TasksPanel: 빠른 마감일 설정 버튼 — 오늘/내일/7일 후 토글 버튼, 재클릭 시 해제, × 초기화

## [Round 281] — 2026-03-13
### Added
- StatsPanel: 요일별 활동 분포 차트 — 최근 12주 요일별 누적 세션 바 차트, 최다 요일 황색 하이라이트

## [Round 280] — 2026-03-13
### Added
- NotesPanel: 선택된 노트 클립보드 복사 버튼 (📋) — `# title\n\ncontent` Markdown 형식으로 복사, 복사 후 ✓ 표시

## [Round 279] — 2026-03-13
### Improved
- TasksPanel: 우선순위 점 클릭으로 순환 변경 — 컬러 점 클릭 시 low→medium→high→low 순환 (PRIORITY_CYCLE)

## [Round 278] — 2026-03-13
### Improved
- CalendarPanel: 이벤트 색상 변경 — 이벤트 컬러 점 클릭으로 EVENT_COLORS 순환 변경

## [Round 277] — 2026-03-13
### Added
- NotesPanel: 노트 복제 버튼 (⊕) — 제목 + " 복사"로 핀 미설정 복제본 생성

## [Round 276] — 2026-03-13
### Added
- SceneView: 컨텍스트 메뉴 "📋 UUID 복사" + "📋 경로 복사" 항목 — navigator.clipboard.writeText

## [Round 275] — 2026-03-13
### Added
- TasksPanel: 태스크 메모 필드 — 📝 버튼으로 태스크별 memo textarea 토글, 저장 시 지속

## [Round 274] — 2026-03-13
### Improved
- CalendarPanel: 이벤트 인라인 편집 — 이벤트 더블클릭 시 제목 수정 입력창, Enter/Esc/blur로 확정

## [Round 273] — 2026-03-13
### Added
- NotesPanel: 검색어 하이라이트 — 목록 제목에서 검색어 매칭 부분을 `<mark>` 황색 강조

## [Round 272] — 2026-03-13
### Added
- StatsPanel: 연속 사용일 스트릭 표시 — 현재 연속일(🔥) + 최장 연속일 카드

## [Round 271] — 2026-03-13
### Added
- TasksPanel: 태스크 검색 필터 — 3개 이상 시 검색 입력창 표시, Escape로 초기화

## [Round 270] — 2026-03-13
### Added
- SceneView: Alt+H (좌우 반전) / Alt+V (상하 반전) — scaleX/Y 부호 반전 단축키

## [Round 269] — 2026-03-13
### Added
- SceneView: 리사이즈 중 Escape 키로 취소 — startWidth/Height/NodeX/Y로 원래 크기 복원

## [Round 268] — 2026-03-13
### Added
- SceneView: 드래그 중 Escape 키로 취소 — groupOffsets/startNodeX/Y를 사용해 원래 위치로 복원

## [Round 267] — 2026-03-13
### Added
- NotesPanel: 편집 영역 하단에 글자 수 / 단어 수 실시간 표시 상태바

## [Round 266] — 2026-03-13
### Added
- TasksPanel: 태스크 정렬 기능 — ⏱최신순 / 🔴우선순위 / 📅마감일 순 사이클 버튼

## [Round 265] — 2026-03-13
### Added
- CalendarPanel: 커스텀 이벤트 추가 — 날짜 클릭 시 이벤트 입력, 컬러 선택, localStorage 저장, 캘린더 셀에 컬러 점 표시

## [Round 264] — 2026-03-13
### Improved
- SceneView: 북마크 목록 클릭 시 카메라 자동 포커스 — 선택과 동시에 노드 bounding box로 뷰 이동

## [Round 263] — 2026-03-13
### Improved
- SceneView: 검색 이동 시 접힌 조상 노드 자동 펼치기 — handleSearchNav에서 parentUuid chain의 collapsedUuids 제거

## [Round 262] — 2026-03-13
### Improved
- SceneView: 호버 툴팁에 노드 메모(memo) 표시 — 📝 황색으로 memo 내용 표시

## [Round 261] — 2026-03-13
### Added
- TasksPanel: 진행률 바 — 완료/전체 비율 표시 (진행률 %, 완료 시 초록색)

## [Round 260] — 2026-03-13
### Added
- SceneView: 다중 선택 bounding box 중앙 마커 — 2개+ 선택 시 bbox 중앙에 작은 + 십자 마커 표시

## [Round 259] — 2026-03-13
### Added
- SceneView: 드래그 원본 위치 고스트 박스 — 드래그 중 노드 시작 위치에 반투명 파란 점선 박스 오버레이

## [Round 258] — 2026-03-13
### Added
- NotesPanel: 📤 Markdown 내보내기 버튼 — 전체 노트를 `notes-날짜.md` 파일로 다운로드

## [Round 257] — 2026-03-13
### Added
- TasksPanel: 마감일(dueDate) 필드 — 날짜 선택기 입력, 마감 초과 시 ⚠빨간 강조, 📅 날짜 표시

## [Round 256] — 2026-03-13
### Added
- SceneView: Alt 홀드 스냅 일시 비활성화 — 드래그 중 Alt 키를 누르면 스냅 그리드를 건너뜀

## [Round 255] — 2026-03-13
### Added
- SceneView: P키 부모 노드 선택 — 선택된 노드의 parentUuid로 이동, 단축키 도움말 업데이트

## [Round 254] — 2026-03-13
### Improved
- SceneView: 씬 통계 패널에 컴포넌트 타입 분포 추가 — 상위 5개 컴포넌트 타입별 사용 수 표시

## [Round 253] — 2026-03-13
### Improved
- SceneView: H키/Alt+L 다중 선택 일괄 처리 — 2개+ 선택 시 모든 노드 가시성/잠금 일괄 토글 (anyVisible/anyUnlocked 기준)

## [Round 252] — 2026-03-13
### Added
- NotesPanel: 노트 핀 고정 기능 — 📌 버튼으로 핀 토글, 핀 노드는 목록 상단 고정 + 황금 border

## [Round 251] — 2026-03-13
### Added
- SceneView: I키 노드 정보 오버레이 — 선택 노드의 pos/size/rot/anchor/opacity/visible/locked 정보 패널

## [Round 250] — 2026-03-13
### Added
- SceneView: 선택 노드 앵커 포인트 십자 마커 — anchor(pivot) 위치에 보라색 crosshair(+원) 오버레이

## [Round 249] — 2026-03-13
### Added
- NotesPanel: 노트 정렬 기능 — 최신/오래됨/제목순 순환 버튼 (↕최신 / ↕오래됨 / ↕제목)

## [Round 248] — 2026-03-13
### Improved
- NotesPanel: 노트 검색 기능 — 제목/내용 통합 검색 입력, 결과 수 표시 (N/전체)

## [Round 247] — 2026-03-13
### Added
- SceneView: Alt+[/] 투명도 조절 단축키 — 선택 노드 opacity를 10씩 감소/증가 (0~255)

## [Round 246] — 2026-03-13
### Added
- SceneView: 선택 반전 (Ctrl+Shift+A) — 현재 선택 상태를 반전, 비선택 노드 모두 선택

## [Round 245] — 2026-03-13
### Improved
- SceneView: 인라인 편집바에 회전(R) 필드 추가 — X/Y/W/H/R 5개 필드로 회전값 직접 편집 지원

## [Round 244] — 2026-03-13
### Improved
- SceneView: 부모-자식 연결선 개선 — 직선→cubic bezier 곡선, 화살표 마커 추가

## [Round 243] — 2026-03-13
### Added
- SceneView: 드래그 델타 오버레이 — 드래그 중 이동량(Δx, Δy)을 커서 옆에 실시간 표시

## [Round 242] — 2026-03-13
### Added
- SceneView: 그룹 해제 (Ctrl+Shift+G) — 그룹 노드의 자식들을 상위 레벨로 올리고 그룹 노드 비활성화

## [Round 241] — 2026-03-13
### Added
- SceneView: Alt+1~9 빠른 색상 레이블 — 9가지 미리 정의된 색상을 키보드로 즉시 지정, Alt+0으로 초기화

## [Round 240] — 2026-03-13
### Improved
- SceneView: 호버 툴팁 리치 정보 — 노드 이름 외 pos/size/컴포넌트 목록·잠금·숨김 상태 멀티라인 표시

## [Round 239] — 2026-03-13
### Added
- SceneView: H키 가시성 토글 단축키, 컨텍스트 메뉴 확장 (숨기기/보이기·잠금/해제·즐겨찾기), 단축키 도움말 업데이트

## [Round 238] — 2026-03-13
### Improved
- SceneView: G키 멀티셀렉트 bbox 줌 — 멀티셀렉트 시 선택 노드들의 bounding box에 맞춰 카메라 자동 맞춤

## [Round 237] — 2026-03-13
### Added
- SceneView: 노드 경로 브레드크럼 — 선택 노드의 Root→…→현재 경로를 상태바 위에 표시, 각 항목 클릭 시 해당 노드 선택

## [Round 236] — 2026-03-13
### Added
- SceneView: 태그 기반 노드 필터 — 씬 내 태그 목록 드롭다운, 선택 태그 없는 노드 dimmed 처리

## [Round 235] — 2026-03-13
### Added
- SceneView: 노드 잠금 — Alt+L 단축키로 선택 노드 잠금/해제, 잠긴 노드는 드래그/리사이즈 차단, SVG 🔒 아이콘 표시, 툴바 잠금 버튼

## [Round 234] — 2026-03-13
### Added
- SceneView: 노드 크기 맞추기 — 선택 노드들을 기준 노드의 W/H/both 크기로 동일화, 툴바 버튼 3종

## [Round 233] — 2026-03-13
### Added
- SceneView: 씬 변경 감지 (Dirty 표시) — nodeMap 변경 시 상태바에 "● 저장 안됨" 표시, 저장 시 초기화

## [Round 232] — 2026-03-13
### Added
- SceneView: PNG 내보내기 — SVG→Canvas→PNG 변환 후 scene.png 다운로드, 툴바 ⬇ PNG 버튼

## [Round 231] — 2026-03-13
### Added
- SceneView: 카메라 뷰 히스토리 — F/G 키 이동 시 히스토리 저장, Alt+← 뒤로/Alt+→ 앞으로 이동

## [Round 230] — 2026-03-13
### Added
- SceneView: 즐겨찾기 노드 (Ctrl+B) — 노드에 ★ 표시, 툴바 목록 팝업에서 빠른 선택

## [Round 229] — 2026-03-13
### Added
- SceneView: 참조 이미지 오버레이 — URL 입력해 씬 배경에 반투명 이미지 표시, 투명도 슬라이더 조절

## [Round 228] — 2026-03-13
### Added
- SceneView: 측정 도구 (Alt+M) — 드래그로 씬 좌표 거리·각도 측정, 라인+수치 오버레이 표시

## [Round 227] — 2026-03-13
### Added
- SceneView: 선택 노드 인라인 편집바 — 캔버스 하단에 X/Y/W/H 직접 편집 입력, Enter 적용/Esc 취소

## [Round 226] — 2026-03-13
### Added
- SceneView: 검색 결과 순환 네비게이션 — Enter/Shift+Enter로 매칭 노드 순환 선택, 현재/전체 카운트 표시, 현재 항목 주황색 강조

## [Round 225] — 2026-03-13
### Added
- SceneView: Focus Mode (Alt+Z) — 선택 노드만 강조, 나머지 희미하게 처리하는 집중 편집 모드

## [Round 224] — 2026-03-13
### Added
- SceneView: 노드 그룹 접기/펼치기 — Alt+클릭으로 자식 노드 숨기기, 접힘 상태 시각 표시 (▶ 아이콘)

## [Round 223] — 2026-03-13
### Added
- SceneView: 컴포넌트 타입 필터 — 툴바 드롭다운으로 특정 컴포넌트 유형 노드 강조, 미매칭 노드 희미하게 처리

## [Round 222] — 2026-03-13
### Added
- SceneView: 노드 이동 히스토리 — ↕ 버튼으로 최근 20개 이동 기록 표시, 클릭 시 해당 노드 선택

## [Round 221] — 2026-03-13
### Added
- SceneView: LOD 렌더링 — 줌 레벨에 따라 라벨/fill 숨김, 매우 작은 노드 스킵으로 성능 개선

## [Round 220] — 2026-03-13
### Added
- SceneView: Ctrl+F 씬 검색 + 하이라이트 — 매칭 노드에 황색 점선 링 표시, Esc로 닫기

## [Round 219] — 2026-03-13
### Added
- SceneView: 하단 상태바 — 현재 도구/줌/Snap/선택수/드래그상태 표시, Space 시 패닝 힌트

## [Round 218] — 2026-03-13
### Added
- SceneView: "Cocos에 적용" 버튼 — Inspector에서 선택 노드 위치/크기를 Cocos Creator에 직접 전송

## [Round 217] — 2026-03-13
### Added
- SceneView: 씬 통계 패널 — # 버튼 토글, 총 노드/활성/비활성/잠금/숨김/태그/선택 수 표시

## [Round 216] — 2026-03-13
### Added
- SceneView: 부모-자식 연결선 — ⤻ 버튼 토글, 계층 관계를 반투명 파란 점선으로 시각화

## [Round 215] — 2026-03-13
### Added
- SceneView: 노드 라벨 색상 — Inspector 컬러 피커로 노드 표시 색상 지정, 계층 트리 인디케이터에도 반영

## [Round 214] — 2026-03-13
### Added
- SceneView: 노드 태그 — Inspector에서 태그 추가/삭제, 계층 검색에서 `tag:` 프리픽스로 태그 필터

## [Round 213] — 2026-03-13
### Added
- SceneView: 스냅 그리드 크기 조정 — 1/2/4/5/8/10/16/20/50px 드롭다운 선택, SNAP_GRID를 동적 상태로 전환

## [Round 212] — 2026-03-13
### Added
- SceneView: 씬 저장 슬롯 3개 — 슬롯 드롭다운으로 독립 저장·로드, 슬롯 전환 시 자동 저장

## [Round 211] — 2026-03-13
### Added
- SceneView: 씬 레이아웃 저장/로드 — 💾/📂 버튼으로 nodeMap을 localStorage에 저장·복원

## [Round 210] — 2026-03-13
### Added
- SceneView: Shift+리사이즈 비례 리사이즈 — 코너 핸들 드래그 중 Shift 키로 aspect ratio 유지

## [Round 209] — 2026-03-13
### Added
- SceneView: 노드 가시성 토글 — 계층 트리 👁 아이콘으로 개별 노드 숨기기/표시, 숨겨진 노드 opacity 0.15

## [Round 208] — 2026-03-13
### Added
- SceneView: SVG 씬 내보내기 — ⬇ 버튼으로 씬 노드 레이아웃을 SVG 파일로 다운로드

## [Round 207] — 2026-03-13
### Added
- SceneView: 캔버스 크기 프리셋 드롭다운 — 960×640/1280×720/1920×1080/750×1334 등 동적 변경

## [Round 206] — 2026-03-13
### Added
- SceneView: 드래그 중 정렬 가이드라인 — 타 노드와 경계/중앙 정렬 시 빨간 점선 표시, snap 활성화 시 자동 스냅

## [Round 205] — 2026-03-13
### Added
- NotesPanel: 📝 노트 탭 — 여러 노트 생성/편집/삭제, 제목+본문, localStorage 저장

## [Round 204] — 2026-03-13
### Added
- SceneInspector: 노드 메모 입력란 — 텍스트 메모 추가, Enter 저장, 노드 전환 시 자동 초기화

## [Round 203] — 2026-03-13
### Added
- SceneView: 노드 잠금(Lock) — 🔒 아이콘 클릭으로 토글, 잠긴 노드는 드래그/선택 불가

## [Round 202] — 2026-03-13
### Added
- SceneView: 픽셀 눈금자 (R 키 토글) — 상단/좌측 Cocos 좌표 눈금자, 줌 반응형 틱 간격

## [Round 201] — 2026-03-13
### Added
- SceneView: N/E/S/W 측면 리사이즈 핸들 추가 — 파란 핸들로 단일 축 크기 조절

## [Round 200] — 2026-03-13
### Added
- SceneView: Ctrl+G 노드 그룹화 — 다중 선택 노드를 새 Group 부모 노드로 묶기
- useSceneSync: updateNode upsert 지원 — 신규 UUID 노드 삽입 가능

## [Round 199] — 2026-03-13
### Added
- NodeHierarchyList: 노드 이름 인라인 편집 — 더블클릭 또는 컨텍스트 메뉴 "이름 변경", Enter/blur로 저장

## [Round 198] — 2026-03-13
### Added
- SceneView: Ctrl+] / Ctrl+[ 로 노드 z-order 변경 (앞으로/뒤로 한 단계)

## [Round 197] — 2026-03-13
### Added
- SceneView: Tab/Shift+Tab으로 형제 노드 순환 선택 (다음/이전 형제 토글)

## [Round 196] — 2026-03-13
### Added
- TasksPanel: 인라인 태스크 편집 — 더블클릭으로 편집 모드, Enter 저장, Esc 취소

## [Round 195] — 2026-03-13
### Added
- ClipboardPanel: 검색 필터 — 텍스트/소스로 클립보드 항목 실시간 검색, Esc로 초기화

## [Round 194] — 2026-03-13
### Added
- CalendarPanel: "오늘" 버튼 — 다른 달 탐색 중 클릭 시 이번 달로 즉시 이동 + 오늘 날짜 선택
- CalendarPanel: 세션 수 요약 — "전체 N개 세션 · 이번 달 M개" 텍스트 표시

## [Round 193] — 2026-03-13
### Added
- SceneView: N 키 단축키 — 빠른 새 노드 생성 (선택 노드의 자식으로)
- SceneView: 단축키 도움말에 N(새 노드 생성) 항목 추가

## [Round 192] — 2026-03-13
### Added
- SceneView: 원점(0,0) 십자선 가이드 — 그리드 활성 시 Cocos 좌표 원점에 파란 점선 십자선 + 원 표시

## [Round 191] — 2026-03-13
### Added
- SceneView: M 키 단축키 — 미니맵 표시/숨기기 토글
- SceneView: 단축키 도움말에 M(미니맵), Del/Backspace(삭제) 항목 추가

## [Round 190] — 2026-03-13
### Added
- SceneInspector: Color 섹션에 알파(α) 슬라이더 추가 — 0~255 범위 드래그로 색상 투명도 실시간 편집

## [Round 189] — 2026-03-13
### Added
- SceneView: Ctrl+← → 회전 단축키 — 1°씩 회전, Ctrl+Shift+← → 10°씩 회전
- SceneView: 단축키 도움말에 Alt+↑/↓, Ctrl+←/→ 항목 추가

## [Round 188] — 2026-03-13
### Added
- SceneView: 다중 선택 시 합산 bounding box 표시 — 선택된 모든 노드를 감싸는 파란 점선 사각형

## [Round 187] — 2026-03-13
### Added
- SceneView: 회전 중 각도 오버레이 — 회전 드래그 시 중앙에 현재 각도(XX.X°) 실시간 표시

## [Round 186] — 2026-03-13
### Added
- SceneToolbar: ⊡ 미니맵 토글 버튼 — 툴바에서 미니맵 표시/숨기기 직접 제어

## [Round 185] — 2026-03-13
### Added
- SceneView: 미니맵 클릭 네비게이션 — 클릭 위치로 뷰포트 즉시 이동, 더블클릭으로 숨기기

## [Round 184] — 2026-03-13
### Added
- SceneView: 미니맵 오버레이 — 우하단 축소 맵에 전체 노드 + 뷰포트 표시, 클릭으로 토글

## [Round 183] — 2026-03-13
### Added
- SceneInspector: 조상 Breadcrumb 경로 표시 — 부모/조부모 전체 클릭 가능한 체인으로 표시 (Canvas › Panel › Button)

## [Round 182] — 2026-03-13
### Added
- SceneInspector: Anchor ⊙ 버튼 — 클릭 시 anchorX, anchorY를 0.5로 즉시 초기화

## [Round 181] — 2026-03-13
### Added
- SceneInspector: Scale ⊙ 버튼 — 클릭 시 scaleX, scaleY를 1로 즉시 초기화, 비활성(1,1)일 때 muted 색상

## [Round 180] — 2026-03-13
### Added
- SceneInspector: Rotation ⊙ 버튼 — 클릭 시 rotation을 0으로 즉시 초기화, 비활성(0)일 때 muted 색상

## [Round 179] — 2026-03-13
### Added
- SceneInspector: Position ⊙ 버튼 — 클릭 시 X, Y를 (0, 0)으로 즉시 초기화

## [Round 178] — 2026-03-13
### Added
- SceneView: Alt+↑ 부모 노드 선택, Alt+↓ 첫 자식 노드 선택 단축키

## [Round 177] — 2026-03-13
### Added
- SceneView: 배경 밝기 토글 (◑) — 체크패턴 어두운/밝은 모드 전환

## [Round 176] — 2026-03-13
### Added
- SceneView: 드래그/리사이즈 중 선택 노드 x,y,w,h 실시간 정보 표시

## [Round 175] — 2026-03-12
### Added
- SceneInspector: 자식 노드 목록 확장 — ↳N 클릭 시 자식 이름 목록 펼치기/접기, 클릭으로 선택

## [Round 174] — 2026-03-12
### Added
- SceneToolbar: 줌 레벨 더블클릭 인라인 편집 — 숫자 직접 입력 후 Enter 적용

## [Round 173] — 2026-03-12
### Added
- 코드 블록: 4줄 이상 시 라인 번호 자동 표시 (react-syntax-highlighter showLineNumbers)

## [Round 172] — 2026-03-12
### Added
- SceneInspector: Size W/H 비율 유지 잠금 버튼 — Scale 잠금과 동일하게 ∝ 토글

## [Round 171] — 2026-03-12
### Added
- SceneView: SVG 캔버스 우클릭 컨텍스트 메뉴 — 선택/복사/붙여넣기/복제/삭제

## [Round 170] — 2026-03-12
### Added
- SceneView: 노드 더블클릭 → SceneInspector 이름 편집 자동 포커스 (SVG → Inspector 연동)

## [Round 169] — 2026-03-12
### Added
- SceneInspector: 컬러 피커 — 색상 스워치 클릭 시 native color picker 열림, 변경 즉시 반영

## [Round 168] — 2026-03-12
### Added
- SceneView: 선택 노드 회전 핸들 — 상단 오렌지 원형 핸들 드래그로 실시간 rotation 변경

## [Round 167] — 2026-03-12
### Added
- SceneInspector: Scale 비율 유지 잠금 버튼 (∝) — Sx/Sy 중 하나 편집 시 비율 유지 자동 연동

## [Round 166] — 2026-03-12
### Added
- NodeHierarchyList: 우클릭 컨텍스트 메뉴 — 선택/복사/활성화 메뉴 (이벤트 위임 방식)

## [Round 165] — 2026-03-12
### Added
- SceneInspector: JSON 내보내기 버튼 — 노드 정보 전체를 pretty JSON으로 클립보드 복사

## [Round 164] — 2026-03-12
### Added
- SceneView: 씬 좌하단 총 노드 수 표시 — "N개 노드", 멀티셀렉트 시 "· M 선택" 추가

## [Round 163] — 2026-03-12
### Added
- SceneView: Space 키 임시 패닝 모드 — Space 홀드 시 현재 도구 유지하며 grab/grabbing 커서로 패닝 가능

## [Round 162] — 2026-03-12
### Added
- SceneView: 균등 분포 배치 — 멀티셀렉트 3개 이상 시 수평(⊢⊣)/수직(⊤⊥) 균등 배치 버튼

## [Round 161] — 2026-03-12
### Added
- SceneInspector: 자식 노드 수 표시 — "↳N" 형태로 헤더 하단에 표시, 부모/자식 정보 한 줄에 통합

## [Round 160] — 2026-03-12
### Added
- SceneView: Ctrl+D 복제 단축키 — 클립보드 변경 없이 선택 노드 20px 오프셋 복제

## [Round 159] — 2026-03-12
### Added
- SceneView: 선택 노드 anchor point 마커 — 노드 position(=anchor 위치)에 황색 ◇ polygon 표시

## [Round 158] — 2026-03-12
### Added
- SceneView: Ctrl+A 전체 선택 — nodeMap 모든 노드 선택, 단축키 도움말 항목 추가

## [Round 157] — 2026-03-12
### Added
- SceneInspector: 컴포넌트 목록에 타입별 아이콘 표시 — getComponentIcon 재사용, accent 색상

## [Round 156] — 2026-03-12
### Added
- SceneView: 씬 원점 (0,0) 레이블 — 중앙 십자 우상단에 "(0,0)" SVG 텍스트 표시, zoom 보정

## [Round 155] — 2026-03-12
### Added
- SceneView: 패닝 중 커서 grab → grabbing 변경 — isPanningActive 상태로 동적 커서 제어

## [Round 154] — 2026-03-12
### Added
- SceneInspector: UUID 복사 버튼 — 헤더 # 버튼 클릭 시 UUID 클립보드 복사, 복사 완료 시 ✓ 피드백

## [Round 153] — 2026-03-12
### Added
- NodeHierarchyList: 검색창 ESC 키 → 검색어 초기화 + 포커스 해제

## [Round 152] — 2026-03-12
### Added
- SceneView: 선택 노드 size 레이블 — 단일 선택 시 bounding box 우상단에 "W×H" SVG 텍스트 표시 (드래그/리사이즈 중 숨김)

## [Round 151] — 2026-03-12
### Added
- SceneView: 방향키로 선택 노드 1px nudge, Shift+방향키 10px 이동 + 단축키 도움말에 항목 추가

## [Round 150] — 2026-03-12
### Added
- NodeHierarchyList: 검색창 X 지우기 버튼 — 검색어 입력 시 ×버튼 표시, 클릭으로 즉시 초기화

## [Round 149] — 2026-03-12
### Added
- NodeHierarchyList: 검색 결과 카운트 표시 — 검색 중 "N/total" 형태로 검색창 우측 표시, 결과 없을 시 warning 색상

## [Round 148] — 2026-03-12
### Added
- SceneView: 줌 인디케이터 클릭 → 1:1(100%) 리셋, 더블클릭 → Fit 전환 / cursor:pointer + tooltip 추가

## [Round 147] — 2026-03-12
### Added
- SceneView: 씬 해상도 레이블 — SVG 씬 경계 우상단에 "960 × 640" 텍스트 표시, 줌에 무관하게 일정 크기 유지

## [Round 146] — 2026-03-12
### Added
- SceneInspector: 부모 노드 표시 — 헤더 아래 "in: ParentName" 클릭 시 부모 선택
### Fixed
- SceneViewPanel: handleInspectorUpdate dep 배열에 port 추가 — stale closure 수정

## [Round 145] — 2026-03-12
### Fixed
- SceneView: passive wheel 이벤트 → `addEventListener('wheel', fn, {passive:false})` 로 교체, `preventDefault` 정상 동작

## [Round 144] — 2026-03-12
### Added
- SceneViewPanel: 단축키 도움말 오버레이 — ? 키로 토글, 클릭으로 닫기, 전체 단축키 목록 표시

## [Round 143] — 2026-03-12
### Added
- NodeHierarchyList: 전체 펼치기(▾▾) / 전체 접기(▸▸) 버튼 — 검색창 우측 배치, 씬 전체 트리 즉시 토글

## [Round 142] — 2026-03-12
### Added
- NodeHierarchyList: 활성 인디케이터 dot — 각 노드 행 앞에 녹색(active)/회색(inactive) dot 클릭으로 즉시 토글
- SceneViewPanel: handleHierarchyToggleActive → updateNode + ccSetProperty('active') 연결

## [Round 141] — 2026-03-12
### Added
- SceneViewPanel: 노드 호버 툴팁 — 마우스 오버 시 컴포넌트 아이콘 + 노드 이름 툴팁 표시 (드래그·리사이즈 중 자동 숨김)

## [Round 140] — 2026-03-12
### Added
- SceneInspector: Color 섹션 — 노드 색상 RGBA 스왓치 + hex 코드 표시, alpha != 255 시 α% 표시

## [Round 139] — 2026-03-12
### Added
- NodeHierarchyList: 컴포넌트 아이콘 표시 — getComponentIcon(utils.ts) 연동, 트리·검색 결과 모두 노드명 앞에 B/T/S/L/V/E/P/G/C 아이콘 accent 색상 표시

## [Round 138] — 2026-03-12
### Added
- SceneInspector: Opacity 섹션 — UIOpacity 컴포넌트 있을 때만 표시, NumInput(α) 편집

## [Round 137] — 2026-03-12
### Added
- SceneInspector: Scale 섹션 추가 — scaleX(Sx)/scaleY(Sy) NumInput 편집 (decimals=2)

## [Round 136] — 2026-03-12
### Added
- SceneViewPanel: handleFocusSelected() — 선택 노드 중심으로 카메라 이동 + 줌 조정
- SceneViewPanel: G키 단축키 → handleFocusSelected (선택 노드 없으면 handleFit 대체)

## [Round 135] — 2026-03-12
### Added
- NodePropertyPanel: COMP_EDITABLE_KEYS 5종 추가 — cc.Slider(progress/totalLength), cc.Toggle(isChecked), cc.ProgressBar(progress/reverse), cc.ScrollView(horizontal/vertical/inertia), cc.Animation(speed)

## [Round 134] — 2026-03-12
### Added
- NodeHierarchyList: focusUuid prop — 선택 노드 변경 시 계층 패널 자동 스크롤 (scrollIntoView)
- NodeHierarchyList: 노드 행에 data-uuid 속성, scrollContainerRef로 DOM 쿼리
- SceneViewPanel: NodeHierarchyList에 focusUuid={selectedUuid} 전달

## [Round 133] — 2026-03-12
### Added
- SceneToolbar: "Aa" 라벨 토글 버튼 (showLabels/onLabelsToggle prop)
- NodeRenderer: showLabel prop (기본 true) — false 시 노드 이름 텍스트 숨김
- SceneViewPanel: showLabels 상태 + NodeRenderer에 showLabel={showLabels} 전달

## [Round 132] — 2026-03-12
### Added
- SceneViewPanel: cursorScenePos 상태 — handleMouseMove에서 svgToScene 변환 후 씬 좌표 실시간 추적
- SceneViewPanel: 마우스 씬 좌표 오버레이 (우측 하단, 줌 표시 왼쪽) — 드래그/리사이즈 중 숨김

## [Round 131] — 2026-03-12
### Added
- NodeHierarchyList: 노드 접기/펼치기 — ▸/▾ 토글 버튼 클릭으로 자식 노드 숨기기/표시
- NodeHierarchyList: collapsed Set 상태 관리, 이름 클릭(선택)과 화살표 클릭(토글) 분리

## [Round 130] — 2026-03-12
### Added
- SceneViewPanel: isDragging / isResizing 상태 추적 (dragRef/resizeRef 시작·종료 시 설정)
- SceneViewPanel: 드래그 중 `X: n  Y: n`, 리사이즈 중 `W: n  H: n` 오버레이 (좌측 하단, 파란색)

## [Round 129] — 2026-03-12
### Added
- NodeHierarchyList: 노드 검색 입력창 — 이름 기반 실시간 필터링 (대소문자 무관)
- NodeHierarchyList: 검색 시 flat 목록으로 전환, 검색 결과 없음 메시지, 높이 150px로 확장

## [Round 128] — 2026-03-12
### Added
- NodeHierarchyList.tsx: 재귀 노드 계층 트리 패널 — childUuids 기반 들여쓰기 렌더링
- NodeHierarchyList: 클릭 선택, Ctrl+클릭 멀티셀렉트, active 상태 시각화 (불투명도)
- SceneToolbar: ≡ 계층 토글 버튼 (showHierarchy prop)
- SceneViewPanel: 계층 트리 패널 SVG 위에 삽입 (120px 고정 높이, 스크롤)

## [Round 127] — 2026-03-12
### Added
- SceneInspector: 노드 이름 인라인 편집 — 이름 더블클릭 → 텍스트 입력 필드 활성화
- SceneInspector: Enter/Blur로 저장, Escape로 취소, 노드 변경 시 자동 취소
- SceneViewPanel: handleRename() — ccSetProperty('name') 호출 + updateNode 낙관적 업데이트

## [Round 126] — 2026-03-12
### Changed
- QA 통합 검수 (Pass 70 → Pass 73), CHANGELOG R121~125 갱신, ROADMAP R126 완료 처리

## [Round 125] — 2026-03-12
### Added
- useSceneSync: refreshNode(uuid) — ccGetNode로 단건 노드 최신화 (opacity/color/components)
- SceneViewPanel: node:select 이벤트 시 refreshNode() 자동 호출 (CC 에디터 선택 동기화)
- SceneViewPanel: selectedUuid 변경 시 200ms debounce refreshNode (UI 선택 시 props 최신화)

## [Round 124] — 2026-03-12
### Added
- SceneView types.ts: ResizeState 인터페이스 추가 (uuid, handle, startSvgX/Y, startWidth/Height, startNodeX/Y)
- SceneViewPanel: resizeRef + handleResizeMouseDown — 4개 모서리 핸들 클릭 시 ResizeState 초기화
- SceneViewPanel: handleMouseMove 리사이즈 분기 — nw/ne/se/sw 핸들별 width/height/x/y 실시간 조정
- SceneViewPanel: handleMouseUp 리사이즈 커밋 — ccSetProperty IPC로 width/height/x/y 저장
- SVG 4개 흰색 rect 핸들 렌더링 (단일 선택 시, zoom 보정 5px 크기, 파란 테두리)

## [Round 123] — 2026-03-12
### Added
- SceneToolbar: canAlign prop + 정렬 버튼 6종 (←L, ↔, R→, ↑T, ↕, B↓) — 멀티셀렉트 시 표시
- SceneViewPanel: handleAlign() — left/centerH/right/top/centerV/bottom 6방향 정렬
  (anchorX/anchorY 기반 경계 계산 + ccSetProperty IPC 배치 호출)

## [Round 122] — 2026-03-12
### Changed
- SessionList groupSessions: 5단계 날짜 그룹 (오늘/어제/이번 주/이번 달/이전)
- monthStart 계산 추가 (이번달 첫 날), 이번 주와 이전 사이에 이번달 섹션 삽입

## [Round 121] — 2026-03-12
### Added
- CC 3x Extension: POST /node/:uuid/component 엔드포인트 — cc.Label string/fontSize, cc.Button interactable 등 컴포넌트 props 직접 편집
- cc-bridge.ts: setComponentProp() 메서드 추가
- NodePropertyPanel: COMP_EDITABLE_KEYS 테이블 (cc.Label/cc.RichText/cc.Button/cc.EditBox), CompEditRow 인라인 편집 UI
- saveComp() — ccSetComponentProp IPC 연동

## [Round 119] — 2026-03-12
### Added
- InputBar: text useEffect → adjustHeight() 자동 호출 (Shift+Enter 줄바꿈 auto-resize)
- InputBar: placeholder에 Shift+Enter 힌트, 100자 이상 시 문자/줄 수 표시

## [Round 118] — 2026-03-12
### Added
- SceneViewPanel: groupBbox useMemo — 멀티셀렉트 노드 전체 bbox 계산 (패딩 8px)
- SVG 황색 점선 rect 렌더링 (strokeWidth/dasharray zoom 보정)

## [Round 117] — 2026-03-12
### Added
- SceneView DragState: groupOffsets? 필드 추가
- SceneViewPanel: isGroupDrag 감지 + 선택 노드 동시 이동 + undo/IPC 배치 처리

## [Round 115] — 2026-03-12
### Added
- SessionList: 커스텀 텍스트 태그 시스템 — 자유 텍스트 태그 입력 + 자동완성 드롭다운
- SessionList: filterCustomTag 필터 칩 + 태그 칩 클릭 시 필터 활성화

## [Round 114] — 2026-03-12
### Added
- NodePropertyPanel: ComponentSection color swatch 클릭 시 native color picker 팝업
- CC 3x extension: POST /node/:uuid/property에 color 케이스 (cc.Color) 추가

## [Round 113] — 2026-03-12
### Added
- chat-store: ChatMessage에 alternatives[] + altIndex 필드, saveAlternative/setAltIndex 액션
- ChatPanel: 재생성 전 현재 응답을 saveAlternative로 이력 보존
- MessageBubble: ◂ N/M ▸ 이전 응답 네비게이션 UI (altCount > 0 시 표시)

## [Round 112] — 2026-03-12
### Added
- NodePropertyPanel: PropRow에 sliderMin/sliderMax props → range 슬라이더 + 숫자 입력 연동
- Rotation 슬라이더 (-180~180), Opacity 슬라이더 (0-255) 적용

## [Round 111] — 2026-03-12
### Added
- session-handlers: globalStats에 totalMessages, avgMessagesPerSession, dailyMessageCounts, topSessions 반환
- StatsPanel: 4열 요약 카드, 일별 메시지 수 바 차트(보라색), 상위 세션 TOP 5 collapsible 섹션

## [Round 110] — 2026-03-12
### Added
- NodePropertyPanel: formatPropValue 강화 — Boolean(✓/✗), Vec2(x,y), Vec3(x,y,z), Color prefix
- NodePropertyPanel: ComponentSection에 color: prefix 감지 시 컬러 스왓치(14×14px) + HEX 코드 표시

## [Round 101] — 2026-03-12
### Fixed
- ollama-bridge.ts: AbortSignal addEventListener 메모리 누수 수정
- openai-bridge.ts: AbortSignal addEventListener 메모리 누수 수정
### Added
- SceneView: 노드 복사/붙여넣기 (Ctrl+C/V), ClipboardEntry 타입
- SceneToolbar: C 복사 / V 붙여넣기 버튼

## [Round 100] — 2026-03-12
### Added
- QA Section 9: R98~99 체크 5종 추가 (Pass 21→26)

## [Round 99] — 2026-03-12
### Added
- AIProvider 인터페이스 (src/main/providers/ai-provider.ts)
- openai-bridge.ts: Electron net 기반 OpenAI SSE 스트리밍
- openai-handlers.ts: openai:send/interrupt IPC 핸들러
- SettingsPanel: OpenAI API Key 입력 UI
- InputBar: gpt-4o/gpt-4o-mini/o3-mini 모델 옵션
- ChatPanel: openai: prefix 라우팅

## [Round 98] — 2026-03-12
### Added
- SceneView UndoEntry 타입, undo/redo 스택 (Ctrl+Z/Y)
- SceneToolbar: ↩/↪ 실행취소/다시실행 버튼
- QA Section 8: R96~97 체크 4종 추가 (Pass 17→21)

## [Round 97] — 2026-03-12
### Added
- ollama-bridge.ts: Electron net NDJSON 스트리밍
- ollama-handlers.ts: ollama:send/interrupt/list IPC
- InputBar: Ollama 모델 피커 (동적 조회)
- ChatPanel: ollama: prefix 라우팅
- ipc-schema.ts: OLLAMA_* 상수

## [Round 96] — 2026-03-12
### Added
- SceneView 다중 선택 (selectedUuids Set, Shift-click)
- 마퀴 드래그 선택 (MarqueeState)
- NodeRenderer: multiSelected 파란 점선 오버레이
- SceneInspector: 다중 선택 요약 표시
- SceneToolbar: 선택 수 배지
- CHANGELOG.md 신규 생성

## [Round 95] — 2026-03-12
### Changed
- QA 스크립트에 R90~94 신규 기능 7종 체크 추가 (Pass 10→17)

## [Round 94] — 2026-03-12
### Added
- AG-UI 이벤트 모델: AguiRunStarted/StepStarted/StepFinished/RunFinished 타입 (ipc-schema.ts)
- agui-store.ts: aguiSubscribe/aguiDispatch 인메모리 옵저버블 스토어 (신규)
- RunTimeline.tsx: 런·스텝 상태 시각화 컴포넌트 (신규)
### Changed
- agent-bridge.ts: run_started/step_started/step_finished/run_finished 이벤트 병행 방출
- AgentPanel.tsx: '런타임' 탭 추가
- App.tsx: AG-UI 이벤트 감지 후 aguiDispatch 호출

## [Round 93] — 2026-03-12
### Changed
- agent-bridge.ts: text_delta 이벤트 16ms 배치 (textBatch + setTimeout 플러시)
- chat-store.ts: reconcileText(fullText) 함수 추가
- App.tsx: isDeltaStreamingRef로 text_delta 실시간 렌더링 활성화

## [Round 92] — 2026-03-12
### Added
- StatsPanel API 비용 섹션: 오늘/이번달 카드 + 7일 바 차트 (cost-tracker 통합)

## [Round 91] — 2026-03-12
### Added
- 네이티브 파일 다이얼로그: fs:open-file-dialog IPC, preload openFileDialog
- ChatPanel 📎 버튼: 네이티브 파일 피커로 파일 첨부

## [Round 90] — 2026-03-12
### Added
- 파일 컨텍스트 패널: useContextFiles hook (localStorage 영속, IPC readFile)
- ChatPanel 📎 콜랩서블 바: 파일 칩 표시 + system prompt 자동 주입

## [Round 89] — 2026-03-12
### Changed
- scripts/qa.ts: R83~88 신규 기능 5종 체크 추가 (Pass 5→10)
- handoff.md 전체 갱신

## [Round 88] — 2026-03-12
### Added
- PromptChainPanel 템플릿 라이브러리: PRESET_TEMPLATES 5종 (코드리뷰/디버깅/콘텐츠/번역/기능명세)
- 📚 버튼 오버레이, 가져오기로 체인 생성

## [Round 87] — 2026-03-12
### Added
- CommandPalette recent-action 타입: ⚡ 섹션, 최대 8개 recency 순 저장
- 실행 시 addRecentAction 자동 저장

## [Round 86] — 2026-03-12
### Added
- cost-tracker.ts: localStorage 기반 일별/월별 API 비용 집계 (90일 보존)
- App.tsx: recordCost() 연동
- StatusBar: 세션 팝업에 오늘/이번달 누적 비용 표시

## [Round 85] — 2026-03-12
### Changed
- CC 3x enrichNode: components[].props 추출 (UITransform/UIOpacity 제외)
- NodePropertyPanel: 콜랩서블 ComponentSection + formatPropValue
- ipc-schema.ts: CCNode.components[].props? 타입 추가

## [Round 84] — 2026-03-12
### Added
- AssetBrowserPanel.tsx: CC 에셋 트리 브라우저 (검색/폴더토글/파일타입 아이콘/경로복사)
- extensions: GET /assets/tree 엔드포인트 (3x, 2x)
- ipc-schema.ts: AssetItem, AssetTree 타입
- cc-bridge.ts: getAssets() 메서드
- cc-handlers.ts: cc:get-assets IPC 핸들러

## [Round 83] — 2026-03-12
### Added
- ChatPanel: 커스텀 시스템 프롬프트 에디터 (localStorage), 컨텍스트 윈도우 진행 바
- InputBar: 실시간 토큰 추산 카운터
- MessageBubble: 메시지별 토큰 수 표시
- SettingsPanel: 글로벌 시스템 프롬프트 + 응답 언어 설정
