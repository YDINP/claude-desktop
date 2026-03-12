feature

cc연결 후 좌측 씬트리 하단에 에셋폴더 볼 수 있는 구조도 필요할듯.



cc에디터 연동 관련 고도화 작업도 꾸준히 필요.


---
**처리 상태**: ✅ Round 84에서 완료
**처리 내용**:
- `AssetBrowserPanel.tsx` — 에셋 트리 브라우저 (검색/폴더토글/파일타입 아이콘/경로복사)
- `extensions/cc-ws-extension-3x/main.js` + `2x/main.js` — `GET /assets/tree` 엔드포인트 추가 (fs 스캔)
- `src/shared/ipc-schema.ts` — `AssetItem`, `AssetTree` 타입 정의
- `src/main/cc/cc-bridge.ts` — `getAssets()` 메서드
- `src/main/ipc/cc-handlers.ts` — `cc:get-assets` IPC 핸들러
- `src/preload/index.ts` — `ccGetAssets` contextBridge 노출
- `CocosPanel.tsx` — 씬트리 하단 에셋 브라우저 섹션 (collapsible)
**완료 일시**: 2026-03-12

---
**미완료 항목** (→ ISSUE-002로 이전):
- 커스텀 커맨드/스킬 사용 지원 (`/ralph-loop`, `/ultrawork` 등 자동 제안)
- CC 연동 좌측 사이드바 나머지 컴포넌트 옵션 표시
