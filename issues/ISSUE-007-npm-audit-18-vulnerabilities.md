# ISSUE-007 — npm audit 18개 보안 취약점 (node-tar, yauzl)

**유형**: bug
**우선순위**: medium
**관련 파일**: package.json, package-lock.json

## 현상

`npm audit` 결과: **18개 취약점** (2 low, 6 moderate, 10 high)

주요 취약 패키지:
- **node-tar** (multiple CVE): Path traversal, symlink poisoning, hardlink escape, arbitrary file read/write
  - 경로: `node_modules/tar` ← `cacache` ← `electron-rebuild`
  - 심각도: high (10개)
- **yauzl** < 3.2.1: Off-by-one error
  - 경로: `node_modules/yauzl` ← `extract-zip` ← `electron`
  - 심각도: moderate

`npm audit fix`로 일부 해결 가능하나, 완전 해결은 `--force` 필요 (breaking changes 포함).

## 기대 동작

1. `npm audit fix` 실행으로 non-breaking 취약점 우선 해결
2. electron, electron-rebuild 버전 업그레이드 검토 (현재 electron v33 → 최신 v41)
3. electron-builder v25 → v26 업그레이드 검토

## 메모

devDependency에 있는 electron 관련 취약점은 빌드 시스템에만 영향을 미치므로
프로덕션 사용자에게는 직접 영향 없음. 그러나 빌드 환경 보안 관점에서 해결 권장.

```bash
# 현재 상태 재확인
npm audit 2>&1 | grep "vulnerabilities"
```
