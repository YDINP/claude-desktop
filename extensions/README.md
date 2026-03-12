# Claude Desktop CC Extensions

## 설치 방법

### CC 2.x (2.4.x)
1. `cc-ws-extension-2x` 폴더를 CC 프로젝트의 `packages/` 폴더에 복사
2. 폴더 내에서 `npm install` 실행
3. Cocos Creator 재시작
4. 메뉴 > Extensions > cc-ws-extension 확인

### CC 3.x
1. `cc-ws-extension-3x` 폴더를 CC 프로젝트의 `extensions/` 폴더에 복사
2. 폴더 내에서 `npm install` 실행
3. Cocos Creator 재시작
4. Extensions Manager에서 활성화

## 포트
- CC 2.x: HTTP + WebSocket on `127.0.0.1:9090`
- CC 3.x: HTTP + WebSocket on `127.0.0.1:9091`

## API
- `GET /status` — 연결 상태 확인
- `GET /scene/tree` — 씬 노드 트리
- `GET /node/:uuid` — 노드 상세
- `POST /node/:uuid/property` — 프로퍼티 수정 `{ key, value }`
- `POST /node/:uuid/move` — 위치 이동 `{ x, y }`

## WebSocket Events (Server → Client)
- `{ type: 'connected', version: '2x'|'3x' }`
- `{ type: 'scene:ready' }`
- `{ type: 'scene:saved' }`
- `{ type: 'node:select', uuids: string[] }`
- `{ type: 'node:deselect', uuids: string[] }`
