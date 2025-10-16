import { beforeEach, describe, expect, test } from "bun:test";
import { configCache } from "../src/cache";

describe("ConfigCache", () => {
	beforeEach(() => {
		configCache.clear();
	});

	test("returns null when no cache entry exists", () => {
		const result = configCache.get("/project", "/global");
		expect(result).toBeNull();
	});

	test("stores and retrieves configuration", () => {
		const config = {
			config: { targets: ["node_modules"] },
			filepath: "/project/.purgorc",
		};

		configCache.set("/project", config, "/global");
		const result = configCache.get("/project", "/global");

		expect(result).toEqual(config);
	});

	test("different cache keys do not collide", () => {
		const config1 = {
			config: { targets: ["node_modules"] },
			filepath: "/project1/.purgorc",
		};

		const config2 = {
			config: { targets: ["dist"] },
			filepath: "/project2/.purgorc",
		};

		configCache.set("/project1", config1);
		configCache.set("/project2", config2);

		expect(configCache.get("/project1")).toEqual(config1);
		expect(configCache.get("/project2")).toEqual(config2);
	});

	test("globalConfigPath influences cache key", () => {
		const config1 = {
			config: { targets: ["node_modules"] },
			filepath: "/project/.purgorc",
		};

		const config2 = {
			config: { targets: ["dist"] },
			filepath: "/project/.purgorc",
		};

		configCache.set("/project", config1, "/global1");
		configCache.set("/project", config2, "/global2");

		expect(configCache.get("/project", "/global1")).toEqual(config1);
		expect(configCache.get("/project", "/global2")).toEqual(config2);
	});

	test("clear removes all cache entries", () => {
		configCache.set("/project1", { config: {}, filepath: undefined });
		configCache.set("/project2", { config: {}, filepath: undefined });

		configCache.clear();

		expect(configCache.get("/project1")).toBeNull();
		expect(configCache.get("/project2")).toBeNull();
	});

	test("invalidate removes specific cache entry", () => {
		const config1 = { config: {}, filepath: "/p1" };
		const config2 = { config: {}, filepath: "/p2" };

		configCache.set("/project1", config1);
		configCache.set("/project2", config2);

		configCache.invalidate("/project1");

		expect(configCache.get("/project1")).toBeNull();
		expect(configCache.get("/project2")).toEqual(config2);
	});

	test("stats returns correct cache statistics", () => {
		configCache.set("/project1", { config: {}, filepath: undefined });
		configCache.set("/project2", { config: {}, filepath: undefined });

		const stats = configCache.stats();

		expect(stats.size).toBe(2);
		expect(stats.entries).toBe(2);
	});

	test("cleanup removes expired cache entries", async () => {
		const originalNow = Date.now;
		let currentTime = Date.now();
		Date.now = () => currentTime;

		try {
			configCache.set("/project", { config: {}, filepath: undefined });

			currentTime += 6 * 60 * 1000;

			configCache.cleanup();

			expect(configCache.get("/project")).toBeNull();
		} finally {
			Date.now = originalNow;
		}
	});

	test("cache entry expires after TTL (5 minutes)", async () => {
		const originalNow = Date.now;
		let currentTime = Date.now();
		Date.now = () => currentTime;

		try {
			const config = { config: {}, filepath: "/test" };
			configCache.set("/project", config);

			currentTime += 4 * 60 * 1000; // 4 minutes
			expect(configCache.get("/project")).toEqual(config);

			currentTime += 2 * 60 * 1000; // +2 minutes = 6 minutes total
			expect(configCache.get("/project")).toBeNull();
		} finally {
			Date.now = originalNow;
		}
	});

	test("set updates existing cache entry", () => {
		const config1 = { config: { targets: ["old"] }, filepath: "/old" };
		const config2 = { config: { targets: ["new"] }, filepath: "/new" };

		configCache.set("/project", config1);
		configCache.set("/project", config2);

		expect(configCache.get("/project")).toEqual(config2);
	});

	test("stats cleans expired cache entries before counting", () => {
		const originalNow = Date.now;
		let currentTime = Date.now();
		Date.now = () => currentTime;

		try {
			configCache.set("/project1", { config: {}, filepath: undefined });
			configCache.set("/project2", { config: {}, filepath: undefined });

			currentTime += 6 * 60 * 1000;

			const stats = configCache.stats();

			expect(stats.size).toBe(0);
		} finally {
			Date.now = originalNow;
		}
	});
});
