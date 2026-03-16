# ISSUE-002 — session:setCollection 파일 읽기 예외 미처리

**유형**: bug
**우선순위**: high
**관련 파일**: src/main/ipc/session-handlers.ts (라인 616-632)

## 현상

`session:setCollection` IPC 핸들러에서 `readFile`이 try/catch 없이 사용됨.
세션 파일이 외부에서 삭제되거나 접근 권한 오류 시 unhandled rejection이 발생하고,
`ipcMain.handle`에서 에러가 renderer로 전달되지 않아 UI가 무응답 상태가 됨.

```ts
ipcMain.handle('session:setCollection', async (_, { id, collection }) => {
  if (!validateSessionId(id)) { throw new Error('Invalid session ID') }
  const filePath = join(sessionsDir, `${id}.json`)
  const raw = JSON.parse(await readFile(filePath, 'utf-8'))  // try/catch 없음
  // readFile 실패 → unhandled rejection → UI 무응답
})
```

## 기대 동작

```ts
try {
  const raw = JSON.parse(await readFile(filePath, 'utf-8'))
  // ...
} catch (e) {
  throw new Error(`세션 파일 읽기 실패: ${String(e)}`)
}
```

## 재현 시나리오

1. 세션 생성 후 `sessions/` 폴더에서 해당 `.json` 파일을 탐색기에서 삭제
2. 앱에서 해당 세션의 collection 설정 시도
3. UI 무응답 + 콘솔 에러만 출력됨 (사용자에게 피드백 없음)

---
**처리 상태**: ✅ Round 2314에서 처리 완료
**처리 일시**: 2026-03-15
