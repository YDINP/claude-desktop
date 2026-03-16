# ISSUE-004 — CCFileWatcher.watch() 초기화 race condition

**유형**: bug
**우선순위**: high
**관련 파일**: src/main/cc/cc-file-watcher.ts (라인 53-86)

## 현상

`watch()` 메서드가 `async`이지만 `initializing` 플래그 분기에서 `pendingPaths`에 경로를 추가하고
즉시 `return`함. 호출자가 `await watch(paths)`를 해도 watcher 초기화 완료를 보장받지 못함.

```ts
if (this.initializing) {
  this.pendingPaths.push(...newPaths)
  return  // await 없이 즉시 반환 → 호출자는 초기화 완료로 오해
}
```

`pendingPaths`에 쌓인 경로가 언제 처리되는지 코드상 보장 없음 (finally 이후 처리 로직 미확인).

## 기대 동작

초기화 중 호출 시 완료를 기다리는 Promise를 반환하거나,
`pendingPaths` 처리를 `finally` 블록에서 명확히 실행:

```ts
if (this.initializing) {
  this.pendingPaths.push(...newPaths)
  return this._initPromise  // 진행 중인 초기화 Promise 반환
}
```

## 재현 시나리오

CC 프로젝트를 열면서 여러 씬 파일을 동시에 watch 등록 시
일부 파일의 변경 이벤트가 감지되지 않음.

---
**처리 상태**: ✅ Round 2313에서 처리 완료
**처리 일시**: 2026-03-15
