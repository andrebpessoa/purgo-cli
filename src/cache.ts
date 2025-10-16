import type { LoadedConfig } from "./config";

interface CacheEntry {
	config: LoadedConfig;
	timestamp: number;
}

class ConfigCache {
	private cache: Map<string, CacheEntry> = new Map();
	private readonly TTL = 5 * 60 * 1000; // 5 minutes

	private getCacheKey(projectRoot: string, globalConfigPath?: string): string {
		return `${projectRoot}::${globalConfigPath || "none"}`;
	}

	private isValid(entry: CacheEntry): boolean {
		return Date.now() - entry.timestamp < this.TTL;
	}

	get(projectRoot: string, globalConfigPath?: string): LoadedConfig | null {
		const key = this.getCacheKey(projectRoot, globalConfigPath);
		const entry = this.cache.get(key);

		if (!entry) return null;

		if (!this.isValid(entry)) {
			this.cache.delete(key);
			return null;
		}

		return entry.config;
	}

	set(
		projectRoot: string,
		config: LoadedConfig,
		globalConfigPath?: string,
	): void {
		const key = this.getCacheKey(projectRoot, globalConfigPath);
		this.cache.set(key, {
			config,
			timestamp: Date.now(),
		});
	}

	clear(): void {
		this.cache.clear();
	}

	invalidate(projectRoot: string, globalConfigPath?: string): void {
		const key = this.getCacheKey(projectRoot, globalConfigPath);
		this.cache.delete(key);
	}

	cleanup(): void {
		for (const [key, entry] of this.cache.entries()) {
			if (!this.isValid(entry)) {
				this.cache.delete(key);
			}
		}
	}

	stats(): { size: number; entries: number } {
		this.cleanup();
		return {
			size: this.cache.size,
			entries: this.cache.size,
		};
	}
}

export const configCache = new ConfigCache();
