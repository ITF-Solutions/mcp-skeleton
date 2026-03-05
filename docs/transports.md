# MCP Transport Modes

MCP defines how clients and servers communicate via **transports**. This project supports two of the three MCP transports, each suited to different deployment scenarios.

## At a Glance

| | stdio | Streamable HTTP | SSE (legacy) |
|---|---|---|---|
| **Spec version** | All | 2025-03-26+ | Pre-2025-03-26 |
| **Communication** | stdin/stdout pipes | HTTP POST/GET | GET `/sse` + POST `/messages` |
| **Session lifecycle** | Process = session | `Mcp-Session-Id` header | SSE connection = session |
| **Network** | None (local process) | HTTP | HTTP (long-lived SSE) |
| **Multi-client** | No (1:1) | Yes | Yes |
| **Serverless** | No | Yes | No |
| **This project** | Yes | Yes | No |

## Transports

| Guide | Summary |
|-------|---------|
| [stdio](transport-stdio.md) | Local child process, stdin/stdout pipes. Simplest mode — no network, no server. |
| [Streamable HTTP](transport-streamable-http.md) | HTTP-based transport with session management. Used for Docker, VPS, and Cloudflare Workers. |
| [SSE (legacy)](transport-sse.md) | Legacy transport using Server-Sent Events. **Not used by this project** — documented for context. |

## Which Should I Use?

- **Local development / Claude Desktop** → [stdio](transport-stdio.md)
- **Docker / VPS / self-hosted** → [Streamable HTTP](transport-streamable-http.md) via [Docker](docker.md)
- **Serverless / global edge** → [Streamable HTTP](transport-streamable-http.md) via [Cloudflare Worker](cloudflare-worker.md)
- **Legacy MCP server you can't change** → [SSE](transport-sse.md) (client-side only)
