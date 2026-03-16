# ISSUE-001 — shell:exec 임의 명령 실행 보안 취약점

**유형**: bug
**우선순위**: high
**관련 파일**: src/main/ipc/fs-handlers.ts (라인 605-613)

## 현상

`shell:exec` IPC 핸들러가 입력값 검증 없이 `shell: true` 옵션으로 임의 문자열을 실행함.
AI가 생성한 코드 블록을 사용자가 실행할 경우 파괴적인 명령(예: `rm -rf`)이 그대로 시스템에서 실행됨.

```ts
ipcMain.handle('shell:exec', async (_, code: string) => {
  const { execSync } = require('child_process')
  const output = execSync(code, { timeout: 10000, encoding: 'utf8', shell: true })
  // ↑ shell: true + 입력 검증 없음 → RCE 가능
})
```

또한 `require('child_process')`를 런타임에 매번 호출함 (일관성 없음, 상단 import 대신 동적 require).

## 기대 동작

- 허용 명령어 화이트리스트 또는 명시적 사용자 확인 다이얼로그 필요
- `shell: true` 제거 후 `execFile`로 교체 (인수 배열 방식으로 인젝션 방지)
- `require()` → 상단 import로 일원화

## 재현 시나리오

AI가 생성한 코드 블록 중 `rm -rf ~/Documents` 포함 → 사용자가 "실행" 클릭 → 파일 삭제됨

## 메모

`execSync` timeout 10초 동안 이벤트 루프가 블로킹되는 별도 성능 문제도 존재.
최소한 `execFile` + `timeout` + renderer 쪽 사용자 확인 UI 추가 필요.
