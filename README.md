# PAAW A2A Server

Expose PAAW skills via [Google Agent2Agent (A2A) Protocol](https://a2a-protocol.org/).

## Quick Start

```bash
npm install
npm run dev
```

Server runs on `http://localhost:4100`.

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /.well-known/agent-card.json` | Agent Card (discovery) |
| `POST /a2a/jsonrpc` | JSON-RPC (main) |
| `POST /a2a/rest` | HTTP+JSON/REST |
| `GET /health` | Health check |

## Skills

- **translate** — 中英互翻 + 學習筆記
- **ai-news-digest** — AI 新聞摘要

## Architecture

Built with [@a2a-js/sdk](https://github.com/a2aproject/a2a-js). Only need to implement `AgentExecutor` — the SDK handles all A2A protocol methods (tasks/send, tasks/get, tasks/cancel, tasks/subscribe), state management, streaming, and push notifications.

## License

MIT
