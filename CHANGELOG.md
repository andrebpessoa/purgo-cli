# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-16

### 🎉 Initial Release

First stable release of Purgo - a modern CLI tool for cleaning build artifacts, dependencies, and caches from JavaScript/TypeScript projects.

### ✨ Features

- **CLI Interface** - Interactive command-line tool with modern UI
- **Multiple Configuration Formats** - Support for `.purgorc`, `.purgorc.json`, `purgo.config.js/ts`, and `package.json` field
- **Smart Path Deduplication** - Automatically removes only top-level directories to avoid redundant operations
- **Hooks System** - Pre/post-clean hooks for custom workflows
- **Dry-run Mode** - Preview what would be deleted without actually deleting
- **Configuration Inheritance** - Extend and merge configurations using the `extends` field
- **Ignore Patterns** - Protect important directories with glob patterns
- **Framework Support** - Built-in targets for Next.js, Svelte, Vite, and more
- **Global Configuration** - Set system-wide defaults at `~/.config/purgo/config.json`
- **Programmatic API** - Use Purgo in your Node.js/TypeScript scripts

### 📦 Default Targets

- `node_modules` - Dependencies
- `dist` - Build output
- `build` - Build artifacts
- `coverage` - Test coverage reports
- `.turbo` - Turborepo cache
- `.next` - Next.js build files
- `.svelte-kit` - SvelteKit build files
- `bun.lockb` - Bun lockfile
- `pnpm-lock.yaml` - PNPM lockfile

### 🛡️ Safety Features

- **Mandatory Confirmation** - Always prompts before deletion (except dry-run)
- **Configuration Cache** - 5-minute TTL cache for faster repeated operations
- **Cycle Detection** - Prevents infinite loops in `extends` chains
- **Schema Validation** - JSON Schema validation for all configurations

### 📚 Examples

Ready-to-use configuration examples included:

- `basic-config.json` - General projects
- `nextjs-config.json` - Next.js applications
- `react-vite-config.json` - React + Vite projects
- `monorepo-config.json` - Monorepo workspaces
- `ci-cd-config.json` - CI/CD pipelines
- `development-config.json` - Local development
- `shared-config.json` - Team base configuration

### 🔧 Technical Details

- Built with [Bun](https://bun.sh) and TypeScript
- Uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for configuration loading
- UI powered by [ora](https://github.com/sindresorhus/ora), [chalk](https://github.com/chalk/chalk), and [boxen](https://github.com/sindresorhus/boxen)
- File operations with [glob](https://github.com/isaacs/node-glob)
- Process execution via [execa](https://github.com/sindresorhus/execa)
- Schema validation with [zod](https://github.com/colinhacks/zod)

### 📖 Documentation

- Comprehensive README with examples and troubleshooting
- JSON Schema for configuration autocompletion in editors
- TypeScript type definitions included

---

[1.0.0]: https://github.com/andrebpessoa/purgo/releases/tag/v1.0.0
