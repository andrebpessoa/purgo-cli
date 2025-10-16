import boxen from "boxen";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import prettyBytes from "pretty-bytes";
import * as v from "valibot";
import { type PackageManager, toBytes } from "./utils";

export const targetWithSizeSchema = v.object({
	path: v.string(),
	size: v.unknown(),
});

const errorItemSchema = v.object({
	path: v.string(),
	message: v.string(),
});

export const cleanSummarySchema = v.object({
	deletedCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
	totalSize: v.pipe(v.number(), v.minValue(0)),
	errorCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
	errors: v.optional(v.array(errorItemSchema)),
	elapsedTime: v.optional(v.number()),
	speed: v.optional(v.number()),
});

export const progressOptionsSchema = v.object({
	current: v.pipe(v.number(), v.integer(), v.minValue(0)),
	total: v.pipe(v.number(), v.integer(), v.minValue(1)),
	itemName: v.optional(v.string()),
});

/**
 * Represents a target file/directory with its size information.
 */
export type TargetWithSize = v.InferOutput<typeof targetWithSizeSchema>;

/**
 * Summary information about a cleanup operation.
 */
export type CleanSummary = v.InferOutput<typeof cleanSummarySchema>;

/**
 * Options for updating progress during cleanup.
 */
export type ProgressOptions = v.InferOutput<typeof progressOptionsSchema>;

/**
 * Represents an error item with its path and message.
 */
export type ErrorItem = v.InferOutput<typeof errorItemSchema>;

/**
 * User interface handler for purgo-cli cleanup operations.
 * Manages spinners, progress bars, and formatted output.
 */
export class CleanUI {
	private spinner?: Ora;
	private progressSpinner?: Ora;
	private verbosity: "verbose" | "normal" | "quiet";

	constructor(verbosity: "verbose" | "normal" | "quiet" = "normal") {
		this.verbosity = verbosity;
	}

	private shouldShow(
		level: "verbose" | "normal" | "quiet" = "normal",
	): boolean {
		if (this.verbosity === "quiet") return level === "quiet";
		if (this.verbosity === "normal") return level !== "verbose";
		return true; // verbose shows everything
	}

	startSearching(): void {
		if (!this.shouldShow("normal")) return;
		this.spinner = ora(
			chalk.cyan("Searching for artifacts to clean..."),
		).start();
	}

	updateSearching(message: string): void {
		if (!this.shouldShow("normal")) return;
		if (this.spinner) {
			this.spinner.text = chalk.cyan(message);
		}
	}

	stopSpinner(): void {
		this.spinner?.stop();
	}

	showForceMode(): void {
		if (!this.shouldShow("normal")) return;
		console.log(chalk.yellow("⚡ Force mode enabled - skipping confirmation"));
	}

	showRetrying(path: string, attempt: number, maxRetries: number): void {
		if (!this.shouldShow("verbose")) return;
		console.log(
			chalk.yellow(`⟳ Retrying ${path} (attempt ${attempt}/${maxRetries})...`),
		);
	}

	showNothingToClean(): void {
		this.spinner?.succeed(
			chalk.green("No targets found. The project is already clean!"),
		);
	}

	showTargets(targets: TargetWithSize[]): void {
		const totalSize = targets.reduce((acc, t) => acc + toBytes(t.size), 0);

		console.log(chalk.yellow("🔍 Targets found:"));
		for (const target of targets) {
			console.log(
				`  - ${target.path} ${chalk.gray(`(${prettyBytes(toBytes(target.size))})`)}`,
			);
		}
		console.log(
			chalk.bold(
				`\nTotal space to be freed: ${chalk.green(prettyBytes(totalSize))}`,
			),
		);
	}

	showDryRunNotice(): void {
		console.log(
			boxen(
				chalk.bold(
					chalk.yellow("--dry-run enabled. No files will be deleted."),
				),
				{
					padding: 1,
					margin: 1,
					borderStyle: "round",
				},
			),
		);
	}

	showCancelled(): void {
		console.log(chalk.red("Operation cancelled."));
	}

	startCleaning(): Ora {
		return ora(chalk.cyan("Cleaning artifacts...")).start();
	}

	showCleanResult(spinner: Ora, errorCount: number): void {
		if (errorCount > 0) {
			spinner.fail(chalk.red(`Cleanup completed with ${errorCount} errors.`));
		} else {
			spinner.succeed(chalk.green("Cleanup completed successfully!"));
		}
	}

	showSummary(summary: CleanSummary): void {
		if (!this.shouldShow("normal")) return;

		const lines = [
			chalk.bold(chalk.green("✨ Cleanup Summary ✨")),
			"",
			`${chalk.white("Items removed:")} ${chalk.bold(chalk.green(summary.deletedCount))}`,
			`${chalk.white("Space freed:")} ${chalk.bold(chalk.green(prettyBytes(summary.totalSize)))}`,
			`${chalk.white("Errors:")} ${chalk.bold(chalk.red(summary.errorCount))}`,
		];

		if (summary.elapsedTime !== undefined) {
			lines.push(
				`${chalk.white("Time elapsed:")} ${chalk.bold(chalk.cyan(`${summary.elapsedTime.toFixed(2)}s`))}`,
			);
		}

		if (
			summary.speed !== undefined &&
			Number.isFinite(summary.speed) &&
			summary.speed > 0
		) {
			lines.push(
				`${chalk.white("Speed:")} ${chalk.bold(chalk.cyan(`${prettyBytes(summary.speed)}/s`))}`,
			);
		}

		console.log(
			boxen(lines.join("\n"), {
				padding: 1,
				margin: 1,
				borderStyle: "round",
				borderColor: "green",
			}),
		);

		if (summary.errorCount > 0 && summary.errors && summary.errors.length > 0) {
			const maxToShow = Math.min(summary.errors.length, 10);
			const errorLines = [
				chalk.bold(chalk.red("Errors details (first 10):")),
				"",
				...summary.errors
					.slice(0, maxToShow)
					.map(
						(e: ErrorItem) =>
							`- ${chalk.yellow(e.path)}: ${chalk.red(e.message)}`,
					),
			];
			console.log(
				boxen(errorLines.join("\n"), {
					padding: 1,
					margin: 1,
					borderStyle: "round",
					borderColor: "red",
				}),
			);
		}
	}

	startReinstall(packageManager: PackageManager): Ora {
		return ora(chalk.cyan(`Running "${packageManager} install"...`)).start();
	}

	showReinstallSuccess(spinner: Ora, packageManager: string): void {
		spinner.succeed(
			chalk.green(
				`Dependencies reinstalled successfully with ${packageManager}!`,
			),
		);
	}

	showReinstallError(
		spinner: Ora,
		error: unknown,
		packageManager: string,
	): void {
		spinner.fail(
			chalk.red(`Failed to reinstall dependencies with ${packageManager}.`),
		);
		console.error(chalk.red(error));
	}

	showReinstallSkipped(reason: string): void {
		console.log(
			boxen(`${chalk.yellow("Reinstall skipped")}: ${chalk.white(reason)}`, {
				padding: 1,
				margin: 1,
				borderStyle: "round",
				borderColor: "yellow",
			}),
		);
	}

	startProgress(total: number, operation: string = "Processing"): void {
		this.progressSpinner = ora({
			text: chalk.cyan(`${operation} 0/${total}`),
			spinner: "dots",
		}).start();
	}

	updateProgress(options: ProgressOptions): void {
		if (!this.progressSpinner) return;

		const { current, total, itemName } = options;
		const percentage = Math.round((current / total) * 100);
		const bar = this.createProgressBar(percentage);

		const itemText = itemName ? ` - ${itemName}` : "";
		this.progressSpinner.text = chalk.cyan(
			`${bar} ${percentage}% (${current}/${total})${itemText}`,
		);
	}

	stopProgress(success: boolean = true, message?: string): void {
		if (!this.progressSpinner) return;

		if (success) {
			this.progressSpinner.succeed(
				chalk.green(message || "Operation completed"),
			);
		} else {
			this.progressSpinner.fail(chalk.red(message || "Operation failed"));
		}

		this.progressSpinner = undefined;
	}

	private createProgressBar(percentage: number, width: number = 20): string {
		const filled = Math.round((percentage / 100) * width);
		const empty = width - filled;
		return `[${"█".repeat(filled)}${" ".repeat(empty)}]`;
	}
}
