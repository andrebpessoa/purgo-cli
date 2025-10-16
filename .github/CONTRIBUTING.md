# Contributing

## Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR-USERNAME/purgo-cli.git
cd purgo-cli

# Install and develop
bun install
git checkout -b feature/my-feature

# Make changes and test
bun test
bun run lint
bun run check
bun run build

# Commit and push
git commit -m "feat: new functionality"
git push origin feature/my-feature
```

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `chore:` - Maintenance

## Structure

```text
src/        # TypeScript code
tests/      # Tests
examples/   # Example configs
.github/    # CI/CD
```

## Report Issues

Use the available [issue templates](https://github.com/andrebpessoa/purgo-cli/issues/new/choose).
