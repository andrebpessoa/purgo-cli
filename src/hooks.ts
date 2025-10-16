import os from "node:os";
import chalk from "chalk";
import { execa } from "execa";
import * as v from "valibot";

export const hookExecutorSchema = v.object({
	preClean: v.optional(v.string()),
	postClean: v.optional(v.string()),
});

/**
 * Configuration for pre and post-clean hooks.
 */
export type HookExecutor = v.InferOutput<typeof hookExecutorSchema>;

/**
 * Executes a hook command in a shell.
 * @param hookCommand The shell command to execute
 * @param hookName The name of the hook (for logging)
 * @param cwd The working directory where the command will run
 * @throws Error if the hook command fails
 */
export async function executeHook(
	hookCommand: string | undefined,
	hookName: string,
	cwd: string,
): Promise<void> {
	if (!hookCommand) return;

	console.log(chalk.cyan(`Running ${hookName} hook: ${hookCommand}`));

	try {
		const isWindows = os.platform() === "win32";
		const shell = isWindows ? "cmd" : "sh";
		const shellArgs = isWindows ? ["/c", hookCommand] : ["-c", hookCommand];

		const result = await execa(shell, shellArgs, {
			cwd,
			stdio: "inherit",
		});

		if (result.exitCode === 0) {
			console.log(chalk.green(`✓ ${hookName} hook completed`));
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`✗ ${hookName} hook failed: ${errorMessage}`));
		throw new Error(`Hook "${hookName}" failed to execute: ${errorMessage}`);
	}
}
