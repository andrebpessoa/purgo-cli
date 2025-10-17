import { describe, expect, test } from "bun:test";
import {
	deduplicatePaths,
	detectInvokerPackageManager,
	getPreferredPackageManager,
	toBytes,
} from "../src/utils";

describe("toBytes", () => {
	test("correctly converts finite number", () => {
		expect(toBytes(1024)).toBe(1024);
		expect(toBytes(0)).toBe(0);
		expect(toBytes(999.5)).toBe(999.5);
	});

	test("returns 0 for infinite numbers or NaN", () => {
		expect(toBytes(Infinity)).toBe(0);
		expect(toBytes(-Infinity)).toBe(0);
		expect(toBytes(NaN)).toBe(0);
	});

	test("converts bigint to number", () => {
		expect(toBytes(BigInt(2048))).toBe(2048);
		expect(toBytes(BigInt(0))).toBe(0);
		expect(toBytes(BigInt(999999))).toBe(999999);
	});

	test("extracts size property from object", () => {
		expect(toBytes({ size: 512 })).toBe(512);
		expect(toBytes({ size: 0 })).toBe(0);
	});

	test("extracts bytes property from object", () => {
		expect(toBytes({ bytes: 256 })).toBe(256);
		expect(toBytes({ bytes: 1024 })).toBe(1024);
	});

	test("extracts raw property from object", () => {
		expect(toBytes({ raw: 128 })).toBe(128);
		expect(toBytes({ raw: 2048 })).toBe(2048);
	});

	test("uses valueOf() when available", () => {
		const obj = { valueOf: () => 4096 };
		expect(toBytes(obj)).toBe(4096);
	});

	test("prioritizes size over bytes and raw", () => {
		expect(toBytes({ size: 100, bytes: 200, raw: 300 })).toBe(100);
	});

	test("prioritizes bytes over raw when size does not exist", () => {
		expect(toBytes({ bytes: 200, raw: 300 })).toBe(200);
	});

	test("returns 0 for unknown values", () => {
		expect(toBytes(null)).toBe(0);
		expect(toBytes(undefined)).toBe(0);
		expect(toBytes("string")).toBe(0);
		expect(toBytes(true)).toBe(0);
		expect(toBytes({})).toBe(0);
		expect(toBytes([])).toBe(0);
	});

	test("returns 0 for object without recognized properties", () => {
		expect(toBytes({ unknown: 123 })).toBe(0);
		expect(toBytes({ value: 456 })).toBe(0);
	});
});

describe("deduplicatePaths", () => {
	test("remove child paths keeping only parent directories", () => {
		const paths = ["a", "a/b", "a/b/c", "x"];
		const result = deduplicatePaths(paths);
		expect(result).toEqual(["a", "x"]);
	});

	test("keeps independent paths", () => {
		const paths = ["node_modules", "dist", "build"];
		const result = deduplicatePaths(paths);
		expect(result.sort()).toEqual(["build", "dist", "node_modules"]);
	});

	test("normalizes backslashes (Windows)", () => {
		const paths = ["a\\b", "a\\b\\c", "a"];
		const result = deduplicatePaths(paths);
		expect(result).toEqual(["a"]);
	});

	test("sorts by length before deduplication", () => {
		const paths = ["a/b/c/d", "a", "a/b"];
		const result = deduplicatePaths(paths);
		expect(result).toEqual(["a"]);
	});

	test("returns empty array for empty input", () => {
		expect(deduplicatePaths([])).toEqual([]);
	});

	test("keeps only unique path", () => {
		expect(deduplicatePaths(["single"])).toEqual(["single"]);
	});

	test("removes only actual subpaths", () => {
		const paths = ["ab", "abc", "ab/c"];
		const result = deduplicatePaths(paths);
		expect(result).toEqual(["ab", "abc"]);
	});

	test("handles duplicate paths", () => {
		const paths = ["a", "a", "b", "b"];
		const result = deduplicatePaths(paths);
		expect(result).toEqual(["a", "b"]);
	});

	test("handles multiple levels of hierarchy", () => {
		const paths = [
			"packages/app/node_modules",
			"packages/app/node_modules/lib",
			"packages/lib/node_modules",
			"node_modules",
		];
		const result = deduplicatePaths(paths);
		expect(result).toEqual([
			"node_modules",
			"packages/app/node_modules",
			"packages/lib/node_modules",
		]);
	});
});

describe("detectInvokerPackageManager", () => {
	const originalEnv = { ...process.env };

	function resetEnv() {
		process.env = { ...originalEnv };
		delete process.env.BUN;
		delete process.env.npm_config_user_agent;
	}

	test("detects bun via BUN env", () => {
		resetEnv();
		process.env.BUN = "1";
		expect(detectInvokerPackageManager()).toBe("bun");
	});

	test("detects bun via user agent", () => {
		resetEnv();
		process.env.npm_config_user_agent = "bun/1.1.0 osx-x64";
		expect(detectInvokerPackageManager()).toBe("bun");
	});

	test("detects pnpm via user agent", () => {
		resetEnv();
		process.env.npm_config_user_agent = "pnpm/9.0.0 node/v20";
		expect(detectInvokerPackageManager()).toBe("pnpm");
	});

	test("detects yarn via user agent", () => {
		resetEnv();
		process.env.npm_config_user_agent = "yarn/4.0.0";
		expect(detectInvokerPackageManager()).toBe("yarn");
	});

	test("detects npm via user agent", () => {
		resetEnv();
		process.env.npm_config_user_agent = "npm/10.2.0";
		expect(detectInvokerPackageManager()).toBe("npm");
	});

	test("returns null when not detectable", () => {
		resetEnv();
		expect(detectInvokerPackageManager()).toBeNull();
	});
});

describe("getPreferredPackageManager", () => {
	test("prefers invoker over lockfile", () => {
		const orig = process.env.npm_config_user_agent;
		process.env.npm_config_user_agent = "pnpm/9.0.0";
		// projectRoot here is irrelevant because invoker wins
		expect(getPreferredPackageManager(process.cwd())).toBe("pnpm");
		if (orig === undefined) {
			delete process.env.npm_config_user_agent;
		} else {
			process.env.npm_config_user_agent = orig;
		}
	});
});
