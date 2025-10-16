import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { glob } from 'glob';
import prompts from 'prompts';
import { execa } from 'execa';
import getFolderSize from 'get-folder-size';
import prettyBytes from 'pretty-bytes';
import { loadConfig } from './config';
import { toBytes, deduplicatePaths } from './utils';
import { CleanUI } from './ui';
import { executeHook } from './hooks';

export interface CleanOptions {
  /** The root directory to start searching from. */
  rootDir: string;
  /** List of glob patterns to delete. */
  targets?: string[];
  /** If true, only lists the files that would be deleted. */
  dryRun?: boolean;
  /** If true, runs 'bun install' after cleaning. */
  reinstall?: boolean;
  /** Explicit path to a global configuration file. */
  configPath?: string;
}

const DEFAULT_TARGETS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.next',
  '.svelte-kit',
  'bun.lockb',
  'pnpm-lock.yaml',
];

const DEFAULT_GLOBAL_CONFIG = join(homedir(), '.config', 'purgo', 'config.json');

/**
 * Finds and removes directories and files from a project.
 * Ideal for cleaning node_modules, caches and build artifacts.
 * @param options Configuration options for the cleanup.
 */
export async function cleanProject(options: CleanOptions): Promise<void> {
  const {
    rootDir,
    dryRun = false,
    reinstall = false,
    configPath,
    targets: cliTargets,
  } = options;

  const globalConfigPath = configPath || process.env.PURGO_GLOBAL_CONFIG || DEFAULT_GLOBAL_CONFIG;

  const { config } = await loadConfig({
    projectRoot: rootDir,
    globalConfigPath,
  });

  const ui = new CleanUI();

  await executeHook(config.hooks?.preClean, 'preClean', rootDir);

  const targets = cliTargets ?? config.targets ?? DEFAULT_TARGETS;
  const ignoreFromConfig = config.ignore ?? [];
  const finalIgnore = ['**/node_modules/**/node_modules', ...ignoreFromConfig];

  ui.startSearching();

  const globPatterns = targets.map((target: string) => `**/${target}`);
  const pathsToDelete = await glob(globPatterns, {
    cwd: rootDir,
    dot: true,
    ignore: finalIgnore,
  });

  const topLevelPaths = deduplicatePaths(pathsToDelete);

  if (topLevelPaths.length === 0) {
    ui.showNothingToClean();
    return;
  }

  ui.updateSearching('Calculating target sizes...');

  const targetsWithSize = await Promise.all(
    topLevelPaths.map(async (path) => {
      const absolutePath = resolve(rootDir, path);
      const folderSize = await getFolderSize(absolutePath);
      return { path, size: folderSize };
    })
  );

  const totalSize = targetsWithSize.reduce((acc, target) => acc + toBytes(target.size), 0);

  ui.stopSpinner();
  ui.showTargets(targetsWithSize);

  if (dryRun) {
    ui.showDryRunNotice();
    return;
  }

  const response = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: `Are you sure you want to delete the ${topLevelPaths.length} listed items and free up ${prettyBytes(totalSize)}?`,
    initial: true,
  });

  if (!response.confirm) {
    ui.showCancelled();
    return;
  }

  let deletedCount = 0;
  let errorCount = 0;

  if (topLevelPaths.length > 5) {
    ui.startProgress(topLevelPaths.length, 'Deleting');
    
    for (let i = 0; i < topLevelPaths.length; i++) {
      const path = topLevelPaths[i];
      if (!path) continue;
      
      const absolutePath = resolve(rootDir, path);
      
      try {
        await rm(absolutePath, { recursive: true, force: true });
        deletedCount++;
      } catch (error) {
        errorCount++;
      }

      ui.updateProgress({ 
        current: i + 1, 
        total: topLevelPaths.length,
        itemName: path 
      });
    }

    ui.stopProgress(errorCount === 0, 
      errorCount === 0 
        ? 'Cleanup completed successfully!' 
        : `Cleanup completed with ${errorCount} errors`
    );
  } else {
    const deleteSpinner = ui.startCleaning();

    await Promise.all(
      topLevelPaths.map(async (path) => {
        const absolutePath = resolve(rootDir, path);
        try {
          await rm(absolutePath, { recursive: true, force: true });
          deletedCount++;
        } catch (error) {
          errorCount++;
        }
      })
    );

    ui.showCleanResult(deleteSpinner, errorCount);
  }
  ui.showSummary({ deletedCount, totalSize, errorCount });

  await executeHook(config.hooks?.postClean, 'postClean', rootDir);

  if (reinstall && !dryRun && errorCount === 0) {
    const reinstallSpinner = ui.startReinstall();
    try {
      await execa('bun', ['install'], { cwd: rootDir });
      ui.showReinstallSuccess(reinstallSpinner);
    } catch (error) {
      ui.showReinstallError(reinstallSpinner, error);
    }
  }
}