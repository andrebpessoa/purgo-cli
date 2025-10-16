import { rm } from "node:fs/promises";
import * as os from "node:os";
import { join, resolve } from "node:path";
import { execa } from "execa";
import getFolderSize from "get-folder-size";
import { glob } from "glob";
import prettyBytes from "pretty-bytes";
import prompts from "prompts";
import { loadConfig } from "./config";
import { executeHook } from "./hooks";
import { CleanUI } from "./ui";
import { deduplicatePaths, detectPackageManager, toBytes } from "./utils";

export { configCache } from "./cache";
export type { LoadedConfig, PurgoConfig } from "./config";
export type { HookExecutor } from "./hooks";
export { executeHook, hookExecutorSchema } from "./hooks";
export type {
	CleanSummary,
	ErrorItem,
	ProgressOptions,
	TargetWithSize,
} from "./ui";
export {
	CleanUI,
	cleanSummarySchema,
	progressOptionsSchema,
	targetWithSizeSchema,
} from "./ui";
export {
	deduplicatePaths,
	detectPackageManager,
	type PackageManager,
	toBytes,
} from "./utils";

/**
 * Options for cleaning a project.
 */
export interface CleanOptions {
	/** The root directory to start searching from. */
	rootDir: string;
	/** List of glob patterns to delete. Overrides config if provided. */
	targets?: string[];
	/** If true, only lists the files that would be deleted without removing them. */
	dryRun?: boolean;
	/** If true, reinstalls dependencies after cleaning (auto-detects package manager). */
	reinstall?: boolean;
	/** Explicit path to a global configuration file. */
	configPath?: string;
	/** If true, skips confirmation prompt (useful for CI/CD). */
	force?: boolean;
	/** Controls output verbosity: 'verbose' | 'normal' | 'quiet'. */
	verbosity?: "verbose" | "normal" | "quiet";
	/** If true, creates a backup before deleting files. */
	backup?: boolean;
}

const DEFAULT_TARGETS = [
	"node_modules",
	"dist",
	"build",
	"coverage",
	".turbo",
	".next",
	".svelte-kit",
];

const HOME_DIR =
	process.env.HOME ??
	process.env.USERPROFILE ??
	(typeof os.homedir === "function" ? os.homedir() : "");

const DEFAULT_GLOBAL_CONFIG = HOME_DIR
	? join(HOME_DIR, ".config", "purgo-cli", "config.json")
	: join(process.cwd(), ".purgo-cli", "config.json");

/**
 * Finds and removes directories and files from a project.
 * Ideal for cleaning node_modules, caches and build artifacts.
 * @param options Configuration options for the cleanup.
 */
export async function cleanProject(options: CleanOptions): Promise<void> {
	const startTime = Date.now();
	const {
		rootDir,
		dryRun = false,
		reinstall = false,
		configPath,
		targets: cliTargets,
		force = false,
		verbosity = "normal",
		// backup = false, // TODO: implement backup functionality
	} = options;

	const globalConfigPath =
		configPath || process.env.PURGO_GLOBAL_CONFIG || DEFAULT_GLOBAL_CONFIG;

	const { config } = await loadConfig({
		projectRoot: rootDir,
		globalConfigPath,
	});

	const ui = new CleanUI(verbosity);

	await executeHook(config.hooks?.preClean, "preClean", rootDir);

	const targets = cliTargets ?? config.targets ?? DEFAULT_TARGETS;
	const ignoreFromConfig = config.ignore ?? [];
	const finalIgnore = [
		"**/node_modules/**/node_modules",
		"**/.git",
		"**/.git/**",
		"**/.gitignore",
		...ignoreFromConfig,
	];

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

	ui.updateSearching("Calculating target sizes...");

	const targetsWithSize = await Promise.all(
		topLevelPaths.map(async (path) => {
			const absolutePath = resolve(rootDir, path);
			const folderSize = await getFolderSize(absolutePath);
			return { path, size: folderSize };
		}),
	);

	const totalSize = targetsWithSize.reduce(
		(acc, target) => acc + toBytes(target.size),
		0,
	);

	ui.stopSpinner();
	ui.showTargets(targetsWithSize);

	if (dryRun) {
		ui.showDryRunNotice();
		return;
	}

	if (!force) {
		const response = await prompts({
			type: "confirm",
			name: "confirm",
			message: `Are you sure you want to delete the ${topLevelPaths.length} listed items and free up ${prettyBytes(totalSize)}?`,
			initial: true,
		});

		if (!response.confirm) {
			ui.showCancelled();
			return;
		}
	} else {
		ui.showForceMode();
	}

	let deletedCount = 0;
	let errorCount = 0;
	const errorItems: { path: string; message: string }[] = [];

	// Helper function to delete with retry logic for permission errors
	const deleteWithRetry = async (
		absolutePath: string,
		path: string,
		maxRetries = 3,
	): Promise<boolean> => {
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				await rm(absolutePath, { recursive: true, force: true });
				return true;
			} catch (error) {
				const err = error as NodeJS.ErrnoException;
				const isPermissionError =
					err.code === "EBUSY" || err.code === "EPERM" || err.code === "EACCES";

				// Only retry permission errors
				if (isPermissionError && attempt < maxRetries) {
					ui.showRetrying(path, attempt + 1, maxRetries);
					await new Promise((resolve) =>
						setTimeout(resolve, 1000 * (attempt + 1)),
					);
					continue;
				}

				// Error persists or non-permission error
				const message = error instanceof Error ? error.message : String(error);
				const suggestion = isPermissionError
					? " Try closing programs that might be using this file/folder."
					: "";
				errorItems.push({
					path,
					message: `${message}${suggestion}`,
				});
				return false;
			}
		}
		return false;
	};

	if (topLevelPaths.length > 5) {
		ui.startProgress(topLevelPaths.length, "Deleting");

		for (let i = 0; i < topLevelPaths.length; i++) {
			const path = topLevelPaths[i];
			if (!path) continue;

			const absolutePath = resolve(rootDir, path);

			const success = await deleteWithRetry(absolutePath, path);
			if (success) {
				deletedCount++;
			} else {
				errorCount++;
			}

			ui.updateProgress({
				current: i + 1,
				total: topLevelPaths.length,
				itemName: path,
			});
		}

		ui.stopProgress(
			errorCount === 0,
			errorCount === 0
				? "Cleanup completed successfully!"
				: `Cleanup completed with ${errorCount} errors`,
		);
	} else {
		const deleteSpinner = ui.startCleaning();

		await Promise.all(
			topLevelPaths.map(async (path) => {
				const absolutePath = resolve(rootDir, path);
				const success = await deleteWithRetry(absolutePath, path);
				if (success) {
					deletedCount++;
				} else {
					errorCount++;
				}
			}),
		);

		ui.showCleanResult(deleteSpinner, errorCount);
	}

	const endTime = Date.now();
	const elapsedTime = (endTime - startTime) / 1000;

	ui.showSummary({
		deletedCount,
		totalSize,
		errorCount,
		errors: errorItems,
		elapsedTime,
		speed: totalSize / elapsedTime,
	});

	await executeHook(config.hooks?.postClean, "postClean", rootDir);

	if (reinstall && !dryRun && errorCount === 0) {
		const packageManager = detectPackageManager(rootDir);
		const reinstallSpinner = ui.startReinstall(packageManager);
		try {
			await execa(packageManager, ["install"], { cwd: rootDir });
			ui.showReinstallSuccess(reinstallSpinner, packageManager);
		} catch (error) {
			ui.showReinstallError(reinstallSpinner, error, packageManager);
		}
	} else if (reinstall && !dryRun && errorCount > 0) {
		ui.showReinstallSkipped(
			"Cleanup encountered errors. Dependencies were not reinstalled.",
		);
	}
}
