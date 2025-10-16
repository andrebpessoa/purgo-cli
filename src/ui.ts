import boxen from "boxen";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import prettyBytes from "pretty-bytes";
import { toBytes } from "./utils";

export interface TargetWithSize {
	path: string;
	size: unknown;
}

export interface CleanSummary {
	deletedCount: number;
	totalSize: number;
	errorCount: number;
}

export interface ProgressOptions {
	current: number;
	total: number;
	itemName?: string;
}

export class CleanUI {
	private spinner?: Ora;
	private progressSpinner?: Ora;

	startSearching(): void {
		this.spinner = ora(
			chalk.cyan("Searching for artifacts to clean..."),
		).start();
	}

	updateSearching(message: string): void {
		if (this.spinner) {
			this.spinner.text = chalk.cyan(message);
		}
	}

	stopSpinner(): void {
		this.spinner?.stop();
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
		const lines = [
			chalk.bold(chalk.green("✨ Cleanup Summary ✨")),
			"",
			`${chalk.white("Items removed:")} ${chalk.bold(chalk.green(summary.deletedCount))}`,
			`${chalk.white("Space freed:")} ${chalk.bold(chalk.green(prettyBytes(summary.totalSize)))}`,
			`${chalk.white("Errors:")} ${chalk.bold(chalk.red(summary.errorCount))}`,
		];

		console.log(
			boxen(lines.join("\n"), {
				padding: 1,
				margin: 1,
				borderStyle: "round",
				borderColor: "green",
			}),
		);
	}

	startReinstall(): Ora {
		return ora(chalk.cyan('Running "bun install"...')).start();
	}

	showReinstallSuccess(spinner: Ora): void {
		spinner.succeed(chalk.green("Dependencies reinstalled successfully!"));
	}

	showReinstallError(spinner: Ora, error: unknown): void {
		spinner.fail(chalk.red("Failed to reinstall dependencies."));
		console.error(chalk.red(error));
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
