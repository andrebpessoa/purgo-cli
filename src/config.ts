import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { cosmiconfig } from 'cosmiconfig';
import { z } from 'zod';
import { configCache } from './cache';

const configSchema = z.object({
  targets: z.array(z.string()).optional(),
  ignore: z.array(z.string()).optional(),
  extends: z.union([z.string(), z.array(z.string())]).optional(),
  hooks: z
    .object({
      preClean: z.string().optional(),
      postClean: z.string().optional(),
    })
    .optional(),
});

export type PurgoConfig = z.infer<typeof configSchema>;

const mergeConfigs = (base: PurgoConfig, override: PurgoConfig): PurgoConfig => {
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
  const explorer = cosmiconfig('purgo-cli');
  const result = await explorer.search(cwd);
  if (!result || result.isEmpty) return null;

  const parsed = configSchema.safeParse(result.config);
  if (!parsed.success) {
    throw new Error(
      `Invalid 'purgo-cli' configuration in ${result.filepath}:\n${parsed.error}`,
    );
  }

  return parsed.data;
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

    const explorer = cosmiconfig('purgo-cli');
    const result = await explorer.load(absolutePath);
    if (!result) {
      throw new Error(`Could not load extends: ${absolutePath}`);
    }

    const parsed = configSchema.safeParse(result.config);
    if (!parsed.success) {
      throw new Error(
        `Invalid extends '${absolutePath}':\n${parsed.error}`,
      );
    }

    const resolvedExtended = await resolveExtends(parsed.data, resolve(absolutePath, '..'), visited);
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
    const explorer = cosmiconfig('purgo-cli');
    const globalResult = await explorer.load(globalConfigPath);
    if (globalResult) {
      const parsed = configSchema.safeParse(globalResult.config);
      if (!parsed.success) {
        throw new Error(
          `Invalid global config (${globalConfigPath}):\n${parsed.error}`,
        );
      }
      const resolved = await resolveExtends(parsed.data, resolve(globalConfigPath, '..'));
      configs.push({ config: resolved, filepath: globalConfigPath });
    }
  }

  const workspaceConfig = await loadRawConfig(projectRoot);
  if (workspaceConfig) {
    const resolved = await resolveExtends(workspaceConfig, projectRoot);
    configs.push({ config: resolved });
  }

  const configFromPackageJson = await cosmiconfig('purgo-cli').load(
    resolve(projectRoot, 'package.json'),
  );

  if (configFromPackageJson && configFromPackageJson.config) {
    const parsed = configSchema.safeParse(configFromPackageJson.config);
    if (!parsed.success) {
      throw new Error(
        `Invalid config in package.json:\n${parsed.error}`,
      );
    }
    const resolved = await resolveExtends(parsed.data, projectRoot);
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
