# ISSUE-005 — fs:watchDir 창 종료 시 watcher 미정리 메모리 누수

**유형**: bug
**우선순위**: high
**관련 파일**: src/main/ipc/fs-handlers.ts (라인 560-590), src/main/index.ts

## 현상

`fs:watchDir` 핸들러의 `watchers` Map이 모듈 스코프에 선언되어 `app.quit` 시에만 정리됨.
창이 닫혀도 watcher가 계속 살아있어 이미 destroy된 `webContents`에 이벤트를 전송하려 시도함.

```ts
const watchers = new Map<string, FSWatcher>()  // 모듈 스코프 — 창 닫힘 무관

app.on('quit', () => {     // app 종료 시에만 정리
  watchers.forEach(w => w.close())
  watchers.clear()
})
// win.on('closed') 핸들러에 watchers 정리 코드 없음
```

`event.sender.isDestroyed()` 체크로 크래시는 방지되지만 watcher 자체는 OS 레벨에서 계속 파일 변경을 감시 중.

## 기대 동작

`win.on('closed')` 또는 `router.ts`의 창 종료 이벤트에서 해당 창에 연결된 watcher 정리:

```ts
win.on('closed', () => {
  watchers.forEach((w, key) => { w.close(); watchers.delete(key) })
})
```

## 재현 시나리오

1. 대용량 디렉토리에 `fs:watchDir` 활성화
2. 창 닫기 (앱은 계속 실행)
3. 작업 관리자에서 chokidar 파일 핸들 수가 감소하지 않음 → 누수 확인

---
**처리 상태**: ✅ Round 2313에서 처리 완료
**처리 일시**: 2026-03-15
