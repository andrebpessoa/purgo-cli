#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import prompts from "prompts";
import { cleanProject } from "./index";

const getVersion = (): string => {
	try {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const packagePath = join(__dirname, "../package.json");
		const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
		return pkg.version;
	} catch {
		const pkg = require("../package.json");
		return pkg.version;
	}
};

const program = new Command();

program
	.name("purgo-cli")
	.description(
		"A modern CLI tool for cleaning build artifacts, dependencies, and caches from JavaScript/TypeScript projects.",
	)
	.version(getVersion());

program
	.command("clean")
	.description(
		"Clean directories and files from a project (node_modules, .next, etc.)",
	)
	.option(
		"-d, --dry-run",
		"List what would be deleted, but don't delete anything.",
	)
	.option(
		"-p, --path <path>",
		"The root directory to start searching from.",
		process.cwd(),
	)
	.option(
		"-r, --reinstall",
		"Reinstall dependencies after cleaning (auto-detects package manager)",
	)
	.option("-t, --targets <list>", "Override targets (comma-separated).")
	.option("-c, --config <file>", "Path to a global configuration file.")
	.option(
		"-f, --force",
		"Skip confirmation prompt (useful for CI/CD environments).",
	)
	.option("-v, --verbose", "Show detailed output including retry attempts.")
	.option("-q, --quiet", "Suppress all non-essential output.")
	// .option("-b, --backup", "Create a backup before deleting files.")
	.action(async (options) => {
		try {
			const verbosity = options.quiet
				? "quiet"
				: options.verbose
					? "verbose"
					: "normal";

			await cleanProject({
				rootDir: options.path,
				dryRun: options.dryRun,
				reinstall: options.reinstall,
				configPath: options.config,
				force: options.force,
				verbosity,
				backup: options.backup,
				targets: options.targets
					? options.targets
							.split(",")
							.map((item: string) => item.trim())
							.filter(Boolean)
					: undefined,
			});
		} catch (error) {
			console.error("An unexpected error occurred during cleanup:", error);
			process.exit(1);
		}
	});

program
	.command("init")
	.description("Create a purgo-cli configuration file interactively")
	.option(
		"-p, --path <path>",
		"Directory where to create config",
		process.cwd(),
	)
	.action(async (options) => {
		try {
			console.log(
				chalk.cyan("✨ Let's create your purgo-cli configuration!\n"),
			);

			const response = await prompts([
				{
					type: "multiselect",
					name: "targets",
					message: "Select directories/files to clean:",
					choices: [
						{ title: "node_modules", value: "node_modules", selected: true },
						{ title: "dist", value: "dist", selected: true },
						{ title: "build", value: "build", selected: true },
						{ title: "coverage", value: "coverage", selected: true },
						{ title: ".turbo", value: ".turbo" },
						{ title: ".next", value: ".next" },
						{ title: ".svelte-kit", value: ".svelte-kit" },
						{ title: "out", value: "out" },
						{ title: ".cache", value: ".cache" },
					],
					hint: "- Space to select. Return to submit",
				},
				{
					type: "list",
					name: "ignore",
					message: "Directories/files to ignore (comma-separated, optional):",
					separator: ",",
					initial: "",
				},
				{
					type: "text",
					name: "preClean",
					message: "Pre-clean hook command (optional):",
					initial: "",
				},
				{
					type: "text",
					name: "postClean",
					message: "Post-clean hook command (optional):",
					initial: "",
				},
				{
					type: "select",
					name: "format",
					message: "Config file format:",
					choices: [
						{ title: ".purgo-clirc.json", value: "json" },
						{ title: "package.json", value: "package" },
					],
					initial: 0,
				},
			]);

			const config: Record<string, unknown> = {};

			if (response.targets && response.targets.length > 0) {
				config.targets = response.targets;
			}

			if (response.ignore && response.ignore.length > 0) {
				config.ignore = response.ignore;
			}

			const hooks: Record<string, string> = {};
			if (response.preClean) hooks.preClean = response.preClean;
			if (response.postClean) hooks.postClean = response.postClean;
			if (Object.keys(hooks).length > 0) {
				config.hooks = hooks;
			}

			if (response.format === "package") {
				const pkgPath = join(options.path, "package.json");
				try {
					const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
					pkg["purgo-cli"] = config;
					writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");
					console.log(chalk.green("\n✓ Configuration added to package.json"));
				} catch (error) {
					console.error(
						chalk.red("Error: Could not update package.json"),
						error,
					);
					process.exit(1);
				}
			} else {
				const configPath = join(options.path, ".purgo-clirc.json");
				writeFileSync(
					configPath,
					`${JSON.stringify(config, null, 2)}\n`,
					"utf-8",
				);
				console.log(chalk.green(`\n✓ Configuration saved to ${configPath}`));
			}

			console.log(
				chalk.cyan("\n✨ All set! Run 'purgo-cli clean' to start cleaning."),
			);
		} catch (error) {
			console.error("An error occurred during initialization:", error);
			process.exit(1);
		}
	});

program.parse(process.argv);
