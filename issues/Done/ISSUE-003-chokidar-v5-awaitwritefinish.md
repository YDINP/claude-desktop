# ISSUE-003 — chokidar v5 awaitWriteFinish 옵션 호환성

**유형**: bug
**우선순위**: high
**관련 파일**: src/main/cc/cc-file-watcher.ts (라인 67-70), package.json

## 현상

`package.json`에 `"chokidar": "^5.0.0"` 명시되어 있으나, 코드에서는 v4 스타일의
`awaitWriteFinish` 객체 형식을 사용 중.

```ts
awaitWriteFinish: {
  stabilityThreshold: 200,
  pollInterval: 80,
},
```

chokidar v5는 ESM-only로 재작성되었으며 `awaitWriteFinish` 옵션의 객체 형식 지원이 제거되었을 가능성 있음.
옵션이 silently 무시되면 파일 저장 직후 중간 상태(빈 파일 or 부분 기록)를 읽는 race condition 발생.

## 기대 동작

- chokidar v4로 다운그레이드 (`"chokidar": "^4.0.0"`) 또는
- v5의 정확한 `WatchOptions` 타입 확인 후 옵션 형식 수정
- Windows 환경에서 파일 변경 감지 안정성 검증 테스트 추가

## 재현 시나리오

Cocos Creator에서 씬 파일 저장 → claude-desktop의 SceneView가 갱신되지 않거나
부분 기록된 JSON을 파싱하려다 parse error 발생.

## 메모

`npm ls chokidar`로 실제 설치된 버전 확인 필요.
현재 설치 버전이 v4.x이면 `^5.0.0` 범위 명세 자체가 잘못된 것.

---
**처리 상태**: ✅ Round 2313에서 처리 완료
**처리 일시**: 2026-03-15
