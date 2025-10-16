import { platform } from "node:os";
import chalk from "chalk";
import { execa } from "execa";

export interface HookExecutor {
	preClean?: string;
	postClean?: string;
}

export async function executeHook(
	hookCommand: string | undefined,
	hookName: string,
	cwd: string,
): Promise<void> {
	if (!hookCommand) return;

	console.log(chalk.cyan(`Running ${hookName} hook: ${hookCommand}`));

	try {
		const isWindows = platform() === "win32";
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
		console.error(chalk.red(`✗ ${hookName} hook failed:`), error);
		throw error;
	}
}
