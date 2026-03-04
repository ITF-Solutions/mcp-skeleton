# Contributing to mcp-skeleton

Thank you for your interest in contributing to mcp-skeleton!

## Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/). All commit messages and PR titles **must** follow this format:

```
<type>(<optional scope>): <description>
```

### Allowed Types

| Type | Purpose | Version Bump |
|------|---------|--------------|
| `feat` | New feature | Minor (1.x.0) |
| `fix` | Bug fix | Patch (1.0.x) |
| `docs` | Documentation only | None |
| `chore` | Maintenance, dependencies, CI | None |
| `refactor` | Code change that neither fixes a bug nor adds a feature | None |
| `test` | Adding or updating tests | None |
| `ci` | CI/CD pipeline changes | None |

### Examples

```
feat: add KV encryption support
fix(storage): handle timeout errors gracefully
docs: update deployment guide with Cloudflare setup
chore: bump @modelcontextprotocol/sdk to 1.0.5
test: add coverage for session management
ci: add Docker build step to release workflow
```

### Enforcement

- PR titles are validated in CI using [semantic-pull-request](https://github.com/amannn/action-semantic-pull-request)
- Builds will not run if the PR title doesn't follow the convention
- Release versioning is automated by [release-please](https://github.com/googleapis/release-please)

## Development Workflow

1. **Fork the repository** and create a new branch:

```bash
git checkout -b feat/my-new-feature
```

2. **Make your changes** and test locally:

```bash
npm install
npm run build
npm test
npm run typecheck
```

3. **Commit with conventional commits:**

```bash
git commit -m "feat: add my new feature"
```

4. **Push and create a PR:**

```bash
git push origin feat/my-new-feature
```

5. **Ensure your PR title follows conventional commits** (the CI will check this)

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run type check
npm run typecheck
```

## Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Keep functions focused and single-purpose
- Add comments for complex logic
- Use ESM imports with `.js` extensions

## Questions?

Open an issue for discussion!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
