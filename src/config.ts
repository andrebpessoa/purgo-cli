import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type } from "arktype";
import { cosmiconfig } from "cosmiconfig";
import { configCache } from "./cache";

const hooksSchema = type({
	"preClean?": "string",
	"postClean?": "string",
});

const configSchema = type({
	"targets?": "string[]",
	"ignore?": "string[]",
	"extends?": "string | string[]",
	"hooks?": hooksSchema,
});

export type PurgoConfig = typeof configSchema.infer;

const validateConfig = (value: unknown) => {
	return configSchema(value);
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
	if (validation instanceof type.errors) {
		throw new Error(
			`Invalid 'purgo-cli' configuration in ${result.filepath}:\n${validation.summary}`,
		);
	}

	return validation;
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
		if (validation instanceof type.errors) {
			throw new Error(
				`Invalid extends '${absolutePath}':\n${validation.summary}`,
			);
		}

		const resolvedExtended = await resolveExtends(
			validation,
			resolve(absolutePath, ".."),
			visited,
		);
		merged = mergeConfigs(resolvedExtended, merged);
	}

	return merged;
};

export interface LoadedConfig {
	config: PurgoConfig;
	filepath?: string;
}

export interface LoadConfigOptions {
	projectRoot: string;
	globalConfigPath?: string;
}

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
			if (validation instanceof type.errors) {
				throw new Error(
					`Invalid global config (${globalConfigPath}):\n${validation.summary}`,
				);
			}
			const resolved = await resolveExtends(
				validation,
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
		if (validation instanceof type.errors) {
			throw new Error(`Invalid config in package.json:\n${validation.summary}`);
		}
		const resolved = await resolveExtends(validation, projectRoot);
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
