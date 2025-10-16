#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { cleanProject } from './index';

// Resolve version from package.json
const getVersion = (): string => {
  try {
    // Try ESM first
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packagePath = join(__dirname, '../package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return pkg.version;
  } catch {
    // Fallback for CommonJS
    const pkg = require('../package.json');
    return pkg.version;
  }
};

const program = new Command();

program
  .name('purgo')
  .description('A CLI tool to clean build artifacts and dependencies from projects.')
  .version(getVersion());

program
  .command('clean')
  .description('Clean directories and files from a project (node_modules, .next, etc.)')
  .option('-d, --dry-run', 'List what would be deleted, but don\'t delete anything.')
  .option('-p, --path <path>', 'The root directory to start searching from.', process.cwd())
  .option('-r, --reinstall', 'Run "bun install" after cleaning.')
  .option('-t, --targets <list>', 'Override targets (comma-separated).')
  .option('-c, --config <file>', 'Path to a global configuration file.')
  .action(async (options) => {
    try {
      await cleanProject({
        rootDir: options.path,
        dryRun: options.dryRun,
        reinstall: options.reinstall,
        configPath: options.config,
        targets: options.targets ? options.targets.split(',').map((item: string) => item.trim()).filter(Boolean) : undefined,
      });
    } catch (error) {
      console.error('An unexpected error occurred during cleanup:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);