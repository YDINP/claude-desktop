# QA Report — Round 67
> 2026-03-12T02:01:04.306Z

## Critical
- [src/main/ipc/router.ts] registerCCHandlers 중복 호출: 2회

## Warning
- [src/main/cc/cc-bridge.ts] disconnect 메서드 reconnect 취소 확인 필요
- [src/main/index.ts] registerCCHandlers 미등록

## Pass
- tsc --noEmit 오류 없음
- 65개 소스 파일 검사 완료
- 자동 재연결 로직 존재
- cocos 탭 정상 등록