# 🧹 Purgo CLI

[![npm version](https://img.shields.io/npm/v/purgo-cli.svg)](https://www.npmjs.com/package/purgo-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-FFDF00)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**A modern, powerful CLI tool for cleaning build artifacts, dependencies, and caches from JavaScript/TypeScript projects.**

**[Features](#-features)** • **[Installation](#-installation)** • **[Quick Start](#-quick-start)** • **[Configuration](#%EF%B8%8F-configuration)** • **[Examples](#-examples)**

## ✨ Features

- 🚀 **Blazing Fast** - Built with Bun and optimized TypeScript
- 🎯 **Highly Configurable** - Multiple configuration formats supported
- 🔌 **Extensible** - Pre/post-clean hooks system
- 🧠 **Smart Detection** - Removes only top-level directories intelligently
- 🎨 **Modern UI** - Colorful, interactive terminal interface
- 🔒 **Safe Operations** - Confirmation required before deletion with dry-run mode
- 📦 **Framework Aware** - Built-in targets for popular frameworks
- ⚡ **Instant Setup** - No configuration needed to get started

## 📥 Installation

### Global Installation (Recommended)

```bash
bun install -g purgo-cli
# or
npm install -g purgo-cli
```

### Local Installation

```bash
bun install purgo-cli --save-dev
# or
npm install purgo-cli --save-dev
```

### One-time Usage

```bash
bunx purgo-cli clean
# or
npx purgo-cli clean
```

## 🚀 Quick Start

### Clean Current Project

```bash
purgo-cli clean
```

### Preview What Will Be Deleted

```bash
purgo-cli clean --dry-run
```

### Clean and Reinstall Dependencies

```bash
purgo-cli clean --reinstall
```

### Clean Specific Directory

```bash
purgo-cli clean --path ./packages/my-app
```

### Clean Custom Targets

```bash
purgo-cli clean --targets "node_modules,dist,.next,coverage"
```

## ⚙️ Configuration

purgo-cli supports multiple configuration formats via [cosmiconfig](https://github.com/davidtheclark/cosmiconfig):

- `purgo-cli.config.js` / `purgo-cli.config.ts`
- `purgo-cli.config.json`
- `.purgorc`
- `.purgorc.json`
- `.purgorc.js`
- `purgo-cli` field in `package.json`

### Basic Configuration Example

Create a `.purgorc.json` in your project root:

```json
{
  "targets": ["node_modules", "dist", "build", "coverage"],
  "ignore": ["**/important-data/**"],
  "hooks": {
    "preClean": "echo 'Starting cleanup...'",
    "postClean": "echo 'Cleanup completed!'"
  }
}
```

### Configuration Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `targets` | `string[]` | Directories/files to remove | `["node_modules", "dist"]` |
| `ignore` | `string[]` | Glob patterns to exclude | `["**/keep/**"]` |
| `extends` | `string \| string[]` | Base config(s) to inherit | `"./base.json"` |
| `hooks.preClean` | `string` | Run before cleanup | `"npm run backup"` |
| `hooks.postClean` | `string` | Run after cleanup | `"bun install"` |

### Extending Configurations

Create team-wide or shared configurations:

```json
{
  "extends": "./examples/shared-config.json",
  "targets": ["custom-target"],
  "ignore": ["**/data/**"]
}
```

### Global Configuration

Set system-wide defaults at `~/.config/purgo-cli/config.json` or use a custom path:

```bash
purgo-cli clean --config /path/to/global-config.json
```

## 📚 Examples

Browse the [`examples/`](https://github.com/andrebpessoa/purgo-cli/tree/main/examples) folder for pre-configured setups:

| Config | Best For | Key Features |
|--------|----------|--------------|
| **[basic-config.json](https://github.com/andrebpessoa/purgo-cli/blob/main/examples/basic-config.json)** | General projects | All default targets, simple hooks |
| **[nextjs-config.json](https://github.com/andrebpessoa/purgo-cli/blob/main/examples/nextjs-config.json)** | Next.js apps | `.next`, `out`, env files, auto-rebuild |
| **[react-vite-config.json](https://github.com/andrebpessoa/purgo-cli/blob/main/examples/react-vite-config.json)** | React + Vite | Vite cache, optimized for React |
| **[monorepo-config.json](https://github.com/andrebpessoa/purgo-cli/blob/main/examples/monorepo-config.json)** | Monorepos | Recursive patterns, workspace protection |
| **[ci-cd-config.json](https://github.com/andrebpessoa/purgo-cli/blob/main/examples/ci-cd-config.json)** | CI/CD pipelines | Aggressive cleanup, removes OS files |
| **[development-config.json](https://github.com/andrebpessoa/purgo-cli/blob/main/examples/development-config.json)** | Development | Preserves `.env.local`, quick cleanup |
| **[shared-config.json](https://github.com/andrebpessoa/purgo-cli/blob/main/examples/shared-config.json)** | Team base | Minimal setup for extending |

### Quick Download

```bash
# Download an example directly
curl -o .purgorc.json https://raw.githubusercontent.com/andrebpessoa/purgo-cli/main/examples/basic-config.json

# Or for Next.js
curl -o .purgorc.json https://raw.githubusercontent.com/andrebpessoa/purgo-cli/main/examples/nextjs-config.json
```

### Common Use Cases

**Next.js Project:**

```bash
curl -o .purgorc.json https://raw.githubusercontent.com/andrebpessoa/purgo-cli/main/examples/nextjs-config.json
purgo-cli clean --reinstall
```

**Monorepo Cleanup:**

```bash
curl -o .purgorc.json https://raw.githubusercontent.com/andrebpessoa/purgo-cli/main/examples/monorepo-config.json
purgo-cli clean --reinstall
```

> **Note:** The `monorepo-config.json` uses recursive glob patterns (`**/node_modules`, `**/dist`) to automatically find and clean all packages in your workspace - no loops needed!

**CI/CD Integration:**

```bash
# In your CI pipeline
curl -o .purgorc.json https://raw.githubusercontent.com/andrebpessoa/purgo-cli/main/examples/ci-cd-config.json
bunx purgo-cli clean --dry-run  # Preview
bunx purgo-cli clean            # Execute
```

## 🎣 Hooks

Execute commands before and after cleanup:

```json
{
  "hooks": {
    "preClean": "npm run backup-data",
    "postClean": "npm run setup && npm run build"
  }
}
```

Hooks run in the project root directory and inherit the shell environment.

## 📋 CLI Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--dry-run` | `-d` | List what would be deleted without deleting |
| `--path <path>` | `-p` | Root directory to search from |
| `--reinstall` | `-r` | Reinstall dependencies after cleanup (auto-detects npm/yarn/pnpm/bun) |
| `--targets <list>` | `-t` | Comma-separated list of targets to clean |
| `--config <file>` | `-c` | Path to global configuration file |

---

## 🎯 Default Targets

When no targets are specified, Purgo cleans:

- `node_modules` - Dependencies
- `dist` - Build output
- `build` - Build artifacts
- `coverage` - Test coverage reports
- `.turbo` - Turborepo cache
- `.next` - Next.js build files
- `.svelte-kit` - SvelteKit build files

> **Note:** Lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `bun.lock`) are **not** included in default targets to prevent accidental deletion. If you need to clean lock files, specify them explicitly:
>
> ```bash
> purgo-cli clean --targets "node_modules,dist,package-lock.json"
> ```

## 🔧 Programmatic Usage

```typescript
import { cleanProject } from 'purgo-cli';

await cleanProject({
  rootDir: process.cwd(),
  dryRun: false,
  reinstall: true,
  targets: ['node_modules', 'dist'],
  configPath: './purgo.config.json'
});
```

## 🛡️ Safety Features

- **Mandatory Confirmation** - Always prompts before deletion (except dry-run)
- **Smart Deduplication** - Removes only top-level directories to avoid redundant operations
- **Ignore Patterns** - Protects important directories with glob patterns
- **Cycle Detection** - Prevents infinite loops in extends configurations
- **Dry-run Mode** - Preview operations safely

## 🚨 Troubleshooting

### Common Issues

#### "Permission denied" errors

```bash
# Try with sudo (not recommended) or check file permissions
sudo purgo-cli clean
```

#### "Command not found"

```bash
# Install globally
bun install -g purgo-cli
# or use npx/bunx
bunx purgo-cli clean
```

#### Large directories not showing size

```bash
# This is normal - Purgo calculates sizes asynchronously
# Large dirs might show "calculating..." briefly
```

#### Hooks not executing

```bash
# Ensure commands are available in PATH
# Use absolute paths if needed
"preClean": "/usr/local/bin/backup-script.sh"
```

### Debug Mode

Enable verbose logging:

```bash
DEBUG=purgo-cli:* purgo-cli clean
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**

   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
4. **Add tests** for new functionality
5. **Ensure tests pass**

   ```bash
   bun test
   ```

6. **Update documentation** if needed
7. **Commit your changes**

   ```bash
   git commit -m 'Add amazing feature'
   ```

8. **Push to your branch**

   ```bash
   git push origin feature/amazing-feature
   ```

9. **Open a Pull Request**

### Development Setup

```bash
# Clone the repo
git clone https://github.com/andrebpessoa/purgo-cli.git
cd purgo-cli

# Install dependencies
bun install

# Run tests
bun test

# Build the project
bun run build

# Test locally
bun run cli --help
```

## 🙏 Acknowledgments

- Built with [Bun](https://bun.sh) - The fast JavaScript runtime
- Configuration powered by [cosmiconfig](https://github.com/davidtheclark/cosmiconfig)
- UI components from [ora](https://github.com/sindresorhus/ora) and [chalk](https://github.com/chalk/chalk)

## 🔗 Links

- [📖 Documentation](https://github.com/andrebpessoa/purgo-cli#readme)
- [🐛 Report Issues](https://github.com/andrebpessoa/purgo-cli/issues)
- [💬 Discussions](https://github.com/andrebpessoa/purgo-cli/discussions)
- [📦 NPM Package](https://www.npmjs.com/package/purgo-cli)

## 📄 License

MIT © [André Pessoa](https://github.com/andrebpessoa)
