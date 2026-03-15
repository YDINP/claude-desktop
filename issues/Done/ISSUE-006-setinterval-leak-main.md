# ISSUE-006 — main/index.ts setInterval clearInterval 불가 메모리 누수

**유형**: bug
**우선순위**: medium
**관련 파일**: src/main/index.ts (라인 201-206)

## 현상

메모리 모니터링 `setInterval`의 반환값을 저장하지 않아 앱 종료 시 clearInterval 불가.

```ts
setInterval(() => {
  if (win && !win.isDestroyed()) {
    const mem = process.memoryUsage()
    win.webContents.send('app:memoryUpdate', ...)
  }
}, 3000)
// ↑ 반환값 미저장 → clearInterval 불가
```

`isDestroyed()` 체크로 즉각적인 크래시는 방지되나, 앱 종료 시 타이머 클리어가 불가능함.
멀티 윈도우 환경에서 창마다 별도 타이머가 생성될 경우 누적 누수.

## 기대 동작

```ts
const memTimer = setInterval(() => { ... }, 3000)
app.on('will-quit', () => clearInterval(memTimer))
```

## 메모

경미한 이슈지만 멀티 윈도우 지원 확장 시 누수 누적 가능성 있음. 단순 수정으로 해결 가능.

---
**처리 상태**: ✅ Round 2314에서 처리 완료
**처리 일시**: 2026-03-15
