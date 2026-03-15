# ISSUE-010 — CocosPanel 미구현 버튼 UI에 노출

**유형**: ux
**우선순위**: low
**관련 파일**: src/renderer/src/components/sidebar/CocosPanel.tsx

## 현상

UI에 표시되는 버튼이 실제 기능 없이 TODO 상태로 방치됨:

- 라인 2541: `title="복원 기능은 추후 구현 예정 (TODO)"` — 복원 버튼이 클릭 가능하지만 동작 없음
- 라인 3108: CLI 빌드 실행 버튼 — 실제 실행 로직 미구현

사용자가 클릭 시 아무 반응 없어 혼란 유발.

## 기대 동작

옵션 A: 기능 구현
옵션 B: 버튼을 `disabled` 처리하고 tooltip으로 "준비 중" 안내
옵션 C: 버튼 자체를 UI에서 제거 (구현 완료 시 추가)

## 메모

ralph-loop 라운드 기획 시 "CC-빌드-트리거" 항목과 연계하여 구현 검토.

---
**처리 상태**: ✅ Round 2312에서 처리 완료
**처리 내용**: 복원 버튼 — snapshotKey+localStorage 스냅샷으로 실제 복원 구현. 빌드 버튼 — shellExec+start /B로 CocosCreator CLI 빌드 실제 실행.
**처리 일시**: 2026-03-15
