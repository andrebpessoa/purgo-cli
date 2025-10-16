# 🧹 Purgo

Uma ferramenta CLI moderna e poderosa para limpar artefatos de build, dependências e caches de projetos JavaScript/TypeScript.

## ✨ Características

- 🚀 **Rápido e eficiente** - Construído com Bun e TypeScript
- 🎯 **Configurável** - Suporte para múltiplos formatos de configuração
- 🔌 **Extensível** - Sistema de hooks para pré e pós-limpeza
- 📦 **Inteligente** - Detecta e remove apenas diretórios de topo
- 🎨 **Interface moderna** - UI colorida e interativa
- 🔒 **Seguro** - Confirmação antes de deletar com modo dry-run

## 📥 Instalação

```bash
bun install purgo
```

Ou use diretamente com npx/bunx:

```bash
bunx purgo clean
```

## 🚀 Uso Básico

### Limpar projeto atual

```bash
purgo clean
```

### Modo dry-run (simular sem deletar)

```bash
purgo clean --dry-run
```

### Limpar e reinstalar dependências

```bash
purgo clean --reinstall
```

### Especificar diretório

```bash
purgo clean --path /caminho/do/projeto
```

### Targets customizados

```bash
purgo clean --targets "node_modules,dist,.next"
```

## ⚙️ Configuração

Purgo suporta múltiplos formatos de configuração através do [cosmiconfig](https://github.com/davidtheclark/cosmiconfig):

- `purgo.config.js`
- `purgo.config.json`
- `.purgorc`
- `.purgorc.json`
- `.purgorc.js`
- Campo `purgo` no `package.json`

### Exemplo de Configuração

```json
{
  "targets": [
    "node_modules",
    "dist",
    "build",
    ".next",
    ".turbo",
    "coverage"
  ],
  "ignore": [
    "**/important-cache/**"
  ],
  "hooks": {
    "preClean": "echo 'Iniciando limpeza...'",
    "postClean": "echo 'Limpeza concluída!'"
  }
}
```

### Extends

Você pode estender configurações de outros arquivos:

```json
{
  "extends": "../shared-config.json",
  "targets": ["node_modules", "dist"]
}
```

### Configuração Global

Crie uma configuração global em `~/.config/purgo/config.json`:

```json
{
  "targets": ["node_modules", "dist", ".turbo"],
  "ignore": ["**/keep-this/**"]
}
```

Ou especifique um caminho customizado:

```bash
purgo clean --config /caminho/para/config.json
```

## 🎣 Hooks

Execute comandos antes e depois da limpeza:

```json
{
  "hooks": {
    "preClean": "npm run backup",
    "postClean": "npm run restore-cache"
  }
}
```

## 📋 Opções CLI

| Opção | Alias | Descrição |
|-------|-------|-----------|
| `--dry-run` | `-d` | Lista o que seria deletado sem deletar |
| `--path <path>` | `-p` | Diretório raiz para buscar |
| `--reinstall` | `-r` | Executa `bun install` após limpeza |
| `--targets <list>` | `-t` | Lista de targets separados por vírgula |
| `--config <file>` | `-c` | Caminho para arquivo de configuração global |

## 🎯 Targets Padrão

Se não especificado, Purgo limpará:

- `node_modules`
- `dist`
- `build`
- `coverage`
- `.turbo`
- `.next`
- `.svelte-kit`
- `bun.lockb`
- `pnpm-lock.yaml`

## 🔧 Uso Programático

```typescript
import { cleanProject } from 'purgo';

await cleanProject({
  rootDir: process.cwd(),
  dryRun: false,
  reinstall: true,
  targets: ['node_modules', 'dist'],
});
```

## 🛡️ Segurança

- **Confirmação obrigatória** - Sempre pede confirmação antes de deletar (exceto dry-run)
- **Deduplicação inteligente** - Remove apenas diretórios de topo para evitar operações redundantes
- **Ignore patterns** - Protege diretórios importantes com padrões de exclusão
- **Detecção de ciclos** - Previne loops infinitos em configurações extends

## 🔍 Exemplos

### Limpeza de monorepo

```bash
purgo clean --path ./packages/app --reinstall
```

### Configuração para Next.js

```json
{
  "targets": [
    "node_modules",
    ".next",
    "out",
    ".turbo",
    "coverage"
  ],
  "hooks": {
    "postClean": "bun install"
  }
}
```

### Configuração para workspace

```json
{
  "targets": ["**/node_modules", "**/dist"],
  "ignore": ["**/packages/keep/node_modules"]
}
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

MIT © [André Pessoa](https://github.com/andrebpessoa)

## 🔗 Links

- [GitHub](https://github.com/andrebpessoa/purgo)
- [NPM](https://www.npmjs.com/package/purgo)
- [Reportar Bug](https://github.com/andrebpessoa/purgo/issues)

---

Feito com ❤️ e [Bun](https://bun.sh)
