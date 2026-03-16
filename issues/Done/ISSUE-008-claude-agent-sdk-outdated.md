# ISSUE-008 — @anthropic-ai/claude-agent-sdk 메이저 버전 뒤처짐

**유형**: feature
**우선순위**: medium
**관련 파일**: package.json

## 현상

현재 설치 버전 `0.1.75` vs 최신 `0.2.76` — 마이너 버전 101 차이.
SDK 0.2.x에는 새로운 API, 이벤트 타입, 성능 개선이 포함되어 있을 가능성 높음.

```
@anthropic-ai/claude-agent-sdk  0.1.75  →  0.2.76
```

## 기대 동작

1. `npm install @anthropic-ai/claude-agent-sdk@latest` 실행
2. `agent-bridge.ts`에서 사용 중인 API 호환성 확인
3. 0.2.x changelog 검토 후 breaking change 대응

## 재현 시나리오

최신 Claude API 기능(툴 사용 패턴 개선, 새 모델 지원 등)이 현재 버전에서 미지원될 수 있음.

## 메모

업그레이드 전 `CHANGELOG.md`와 migration guide 확인 필수.
`agent-bridge.ts`의 16개 이벤트 타입 파싱 로직이 영향받을 수 있음.
