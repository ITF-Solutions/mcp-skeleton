# CLAUDE.md

Project instructions for AI agents working on this codebase.

## Commit Convention

This project uses **Conventional Commits**. This is enforced in CI - PR titles that don't follow the convention will block the build.

Every commit message and PR title MUST follow this format:

```
<type>(<optional scope>): <description>
```

Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`

Examples:
- `feat: add new MCP tool for data processing`
- `fix(storage): handle KV timeout errors`
- `docs: update README with deployment instructions`
- `chore: bump dependencies`
- `test: add coverage for HTTP session management`
- `ci: add Docker build step`

Release versioning is handled by release-please:
- `feat` commits trigger a **minor** version bump
- `fix` commits trigger a **patch** version bump

## Build & Test

```bash
npm install          # Install dependencies
npm run build        # Build for Node.js
npm run build:worker # Build for Cloudflare Workers
npm test             # Run tests
npm run dev          # Dev mode (stdio) with hot reload
npm run dev:http     # Dev mode (http) with hot reload
```

## Project Structure

- `src/` - All source code (TypeScript)
  - `http/` - HTTP/SSE endpoint with session management (100% boilerplate)
  - `entrypoints/` - Runtime-specific entrypoints (stdio, http, worker)
  - `storage/` - Storage interface and implementations
  - `tools/` - MCP tool registration (**EXTENSION POINT**)
  - `config.ts` - Environment configuration loader (**EXTENSION POINT**)
- `terraform/` - Cloudflare infrastructure (optional)
- `.github/workflows/` - CI (build/test/lint) and Release (release-please)

## Key Conventions

- ESM (`"type": "module"`) - use `.js` extensions in imports
- Hono for HTTP framework
- Vitest for testing
- Interface-driven storage (swappable implementations)
- One MCP server instance per HTTP client session

## Extension Points

When extending this template for your use case:

1. **`src/tools/index.ts`** - Replace the echo tool with your domain-specific tools
2. **`src/config.ts`** - Add custom environment variables if needed
3. **`src/storage/`** - Add custom storage methods if needed
4. **README.md** - Replace with your project description
5. **package.json** - Update name, description, author, keywords
