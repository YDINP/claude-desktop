# ISSUE-009 — 렌더러 번들 사이즈 과대 (index.js 3.8MB, vendor-monaco 7.3MB)

**유형**: performance
**우선순위**: low
**관련 파일**: electron.vite.config.ts (추정), src/renderer/

## 현상

빌드 결과 경고(황색) 발생 번들:
| 파일 | 크기 |
|------|------|
| `vendor-monaco-CHvxJ079.js` | 7,336 kB |
| `index-BZG8zGBE.js` | 3,848 kB |
| `vendor-syntax--Rg-6UaI.js` | 930 kB |
| `cytoscape.esm-DPjCjg9p.js` | 957 kB |
| `vendor-mermaid-0_rAXHnW.js` | 969 kB |
| `treemap-KZPCXAKY-MFuJyKxN.js` | 882 kB |

총 렌더러 번들 ~15MB 이상. Electron 앱이므로 초기 로딩 속도에 직접 영향.

## 기대 동작

- `index-BZG8zGBE.js` 3.8MB → 컴포넌트 lazy import 분리로 분할
- monaco-editor: 필요한 언어/기능만 등록 (현재 전체 로드 추정)
- cytoscape: mermaid 내부 의존성으로 직접 사용 여부 확인, 미사용 시 제거
- react-syntax-highlighter: 라이트 버전(`react-syntax-highlighter/dist/esm/light`) 전환
- mermaid: 다이어그램 타입별 dynamic import 활용 (이미 청킹되어 있으나 추가 최적화 여지)

## 메모

Electron은 Chromium 기반이라 브라우저 앱 대비 번들 크기 민감도가 낮지만,
앱 시작 시간(cold start) 개선을 위해 critical path 번들은 최적화 권장.
