import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cosmiconfig } from "cosmiconfig";
import * as v from "valibot";
import { configCache } from "./cache";

const hooksSchema = v.object({
	preClean: v.optional(v.string()),
	postClean: v.optional(v.string()),
});

const configSchema = v.object({
	targets: v.optional(v.array(v.string())),
	ignore: v.optional(v.array(v.string())),
	extends: v.optional(v.union([v.string(), v.array(v.string())])),
	hooks: v.optional(hooksSchema),
});

/**
 * Configuration schema for purgo-cli.
 * Can be defined in .purgo-clirc, .purgo-clirc.json, .purgo-clirc.js, or package.json.
 */
export type PurgoConfig = v.InferOutput<typeof configSchema>;

const validateConfig = (value: unknown) => {
	return v.safeParse(configSchema, value);
};

const mergeConfigs = (
	base: PurgoConfig,
	override: PurgoConfig,
): PurgoConfig => {
	const mergedHooks = (() => {
		if (!override.hooks && !base.hooks) return undefined;
		if (!override.hooks) return base.hooks;
		if (!base.hooks) return override.hooks;

		return {
			preClean: override.hooks.preClean ?? base.hooks.preClean,
			postClean: override.hooks.postClean ?? base.hooks.postClean,
		};
	})();

	return {
		targets: override.targets ?? base.targets,
		ignore: override.ignore ?? base.ignore,
		extends: override.extends ?? base.extends,
		hooks: mergedHooks,
	};
};

const loadRawConfig = async (cwd: string): Promise<PurgoConfig | null> => {
	const explorer = cosmiconfig("purgo-cli");
	const result = await explorer.search(cwd);
	if (!result || result.isEmpty) return null;

	const validation = validateConfig(result.config);
	if (!validation.success) {
		const errorMessages = validation.issues
			.map(
				(issue) =>
					`  - ${issue.path?.map((p) => p.key).join(".") || "root"}: ${issue.message}`,
			)
			.join("\n");
		throw new Error(
			`Invalid 'purgo-cli' configuration in ${result.filepath}:\n${errorMessages}`,
		);
	}

	return validation.output;
};

const resolveExtends = async (
	config: PurgoConfig,
	cwd: string,
	visited = new Set<string>(),
): Promise<PurgoConfig> => {
	const extendList = config.extends
		? Array.isArray(config.extends)
			? config.extends
			: [config.extends]
		: [];

	let merged: PurgoConfig = { ...config };

	for (const extendPath of extendList) {
		const absolutePath = resolve(cwd, extendPath);

		if (visited.has(absolutePath)) {
			throw new Error(`Configuration extends cycle detected: ${absolutePath}`);
		}

		visited.add(absolutePath);

		if (!existsSync(absolutePath)) {
			throw new Error(`Extends file not found: ${absolutePath}`);
		}

		const explorer = cosmiconfig("purgo-cli");
		const result = await explorer.load(absolutePath);
		if (!result) {
			throw new Error(`Could not load extends: ${absolutePath}`);
		}

		const validation = validateConfig(result.config);
		if (!validation.success) {
			const errorMessages = validation.issues
				.map(
					(issue) =>
						`  - ${issue.path?.map((p) => p.key).join(".") || "root"}: ${issue.message}`,
				)
				.join("\n");
			throw new Error(`Invalid extends '${absolutePath}':\n${errorMessages}`);
		}

		const resolvedExtended = await resolveExtends(
			validation.output,
			resolve(absolutePath, ".."),
			visited,
		);
		merged = mergeConfigs(resolvedExtended, merged);
	}

	return merged;
};

/**
 * Represents a loaded configuration with its source file path.
 */
export interface LoadedConfig {
	config: PurgoConfig;
	filepath?: string;
}

/**
 * Options for loading configuration files.
 */
export interface LoadConfigOptions {
	/** The root directory of the project where config will be searched */
	projectRoot: string;
	/** Optional explicit path to a global configuration file */
	globalConfigPath?: string;
}

/**
 * Loads and merges purgo-cli configuration from multiple sources.
 * Merges global config, workspace config, and package.json config.
 * Results are cached for performance.
 * @param options Configuration loading options
 * @returns The merged configuration with its source file path
 * @throws Error if configuration is invalid or extends cycle is detected
 */
export const loadConfig = async (
	options: LoadConfigOptions,
): Promise<LoadedConfig> => {
	const { projectRoot, globalConfigPath } = options;

	const cached = configCache.get(projectRoot, globalConfigPath);
	if (cached) {
		return cached;
	}

	const configs: LoadedConfig[] = [];

	if (globalConfigPath && existsSync(globalConfigPath)) {
		const explorer = cosmiconfig("purgo-cli");
		const globalResult = await explorer.load(globalConfigPath);
		if (globalResult) {
			const validation = validateConfig(globalResult.config);
			if (!validation.success) {
				const errorMessages = validation.issues
					.map(
						(issue) =>
							`  - ${issue.path?.map((p) => p.key).join(".") || "root"}: ${issue.message}`,
					)
					.join("\n");
				throw new Error(
					`Invalid global config (${globalConfigPath}):\n${errorMessages}`,
				);
			}
			const resolved = await resolveExtends(
				validation.output,
				resolve(globalConfigPath, ".."),
			);
			configs.push({ config: resolved, filepath: globalConfigPath });
		}
	}

	const workspaceConfig = await loadRawConfig(projectRoot);
	if (workspaceConfig) {
		const resolved = await resolveExtends(workspaceConfig, projectRoot);
		configs.push({ config: resolved });
	}

	const configFromPackageJson = await cosmiconfig("purgo-cli").load(
		resolve(projectRoot, "package.json"),
	);

	if (configFromPackageJson?.config) {
		const validation = validateConfig(configFromPackageJson.config);
		if (!validation.success) {
			const errorMessages = validation.issues
				.map(
					(issue) =>
						`  - ${issue.path?.map((p) => p.key).join(".") || "root"}: ${issue.message}`,
				)
				.join("\n");
			throw new Error(`Invalid config in package.json:\n${errorMessages}`);
		}
		const resolved = await resolveExtends(validation.output, projectRoot);
		configs.push({ config: resolved });
	}

	const final = configs.reduce(
		(acc, current) => ({
			config: mergeConfigs(acc.config, current.config),
			filepath: current.filepath ?? acc.filepath,
		}),
		{ config: {}, filepath: undefined } as LoadedConfig,
	);

	configCache.set(projectRoot, final, globalConfigPath);

	return final;
};
