import { existsSync } from "node:fs";
import { join } from "node:path";
import * as v from "valibot";

const pathsArraySchema = v.array(v.string());

/**
 * Converts various numeric-like values to a number representing bytes.
 * Supports numbers, bigints, and objects with size/bytes/raw properties.
 * @param value The value to convert to bytes
 * @returns The numeric byte value, or 0 if conversion is not possible
 */
export function toBytes(value: unknown): number {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : 0;
	}

	if (typeof value === "bigint") {
		return Number(value);
	}

	if (value && typeof value === "object") {
		const obj = value as Record<string, unknown>;

		if (typeof obj.size === "number") return obj.size;
		if (typeof obj.bytes === "number") return obj.bytes;
		if (typeof obj.raw === "number") return obj.raw;

		const primitive = obj.valueOf?.();
		if (typeof primitive === "number") return primitive;
	}

	return 0;
}

/**
 * Removes duplicate and nested paths, keeping only top-level parent directories.
 * For example, ['a', 'a/b', 'c'] becomes ['a', 'c'].
 * @param paths Array of file paths to deduplicate
 * @returns Deduplicated array with only parent paths
 * @throws Error if paths input is invalid
 */
export function deduplicatePaths(paths: string[]): string[] {
	const validation = v.safeParse(pathsArraySchema, paths);
	if (!validation.success) {
		throw new Error(
			`Invalid paths input: ${validation.issues.map((i) => i.message).join(", ")}`,
		);
	}

	const normalizePath = (p: string) => p.replace(/\\/g, "/");
	const sorted = [...paths]
		.map(normalizePath)
		.sort((a, b) => a.length - b.length);

	const kept: string[] = [];
	for (const p of sorted) {
		if (!kept.some((k) => p === k || p.startsWith(`${k}/`))) {
			kept.push(p);
		}
	}

	return kept;
}

/**
 * Supported package managers for dependency installation.
 */
export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

/**
 * Detects the package manager used in a project by checking for lock files.
 * Priority: bun.lockb > bun.lock > pnpm-lock.yaml > yarn.lock > package-lock.json
 * @param projectRoot The root directory of the project
 * @returns The detected package manager, defaults to 'npm' if none found
 */
export function detectPackageManager(projectRoot: string): PackageManager {
	const bunLockb = join(projectRoot, "bun.lockb");
	const bunLock = join(projectRoot, "bun.lock");
	const pnpmLock = join(projectRoot, "pnpm-lock.yaml");
	const yarnLock = join(projectRoot, "yarn.lock");
	const npmLock = join(projectRoot, "package-lock.json");

	if (existsSync(bunLockb) || existsSync(bunLock)) {
		return "bun";
	}

	if (existsSync(pnpmLock)) {
		return "pnpm";
	}

	if (existsSync(yarnLock)) {
		return "yarn";
	}

	if (existsSync(npmLock)) {
		return "npm";
	}

	return "npm";
}

/**
 * Detects the package manager that invoked this CLI execution.
 * Priority by environment hints: BUN env, then npm_config_user_agent substrings.
 * Returns null when it cannot infer the invoker.
 */
export function detectInvokerPackageManager(): PackageManager | null {
	// Bun sets BUN=1 when running via bun/bunx
	if (process.env.BUN === "1") return "bun";

	const ua = process.env.npm_config_user_agent || "";
	const lowerUA = ua.toLowerCase();

	if (lowerUA.includes("bun/")) return "bun";
	if (lowerUA.includes("pnpm/")) return "pnpm";
	if (lowerUA.includes("yarn/")) return "yarn";
	if (lowerUA.includes("npm/")) return "npm";

	return null;
}

/**
 * Chooses the preferred package manager for installs based on:
 * 1) The invoker that ran the CLI (bunx/npx/yarn dlx/pnpm dlx)
 * 2) Falls back to lockfile detection in the project root
 */
export function getPreferredPackageManager(
	projectRoot: string,
): PackageManager {
	const fromInvoker = detectInvokerPackageManager();
	if (fromInvoker) return fromInvoker;
	return detectPackageManager(projectRoot);
}

/**
 * Resolves the absolute directory of a given installed package name.
 * Returns null if it cannot be resolved.
 */
export function resolvePackageDir(packageName: string): string | null {
	try {
		// Dynamically import createRequire to avoid ESM/CJS nuances at top-level
		const { createRequire } =
			require("node:module") as typeof import("node:module");
		const req = createRequire(import.meta.url);
		const pkgJsonPath = req.resolve(`${packageName}/package.json`);
		const path = require("node:path") as typeof import("node:path");
		const fs = require("node:fs") as typeof import("node:fs");
		const real = fs.realpathSync.native
			? fs.realpathSync.native(pkgJsonPath)
			: fs.realpathSync(pkgJsonPath);
		return path.resolve(real, "..");
	} catch {
		return null;
	}
}

/**
 * Returns true if targetPath should be protected from deletion because
 * it equals or is contained by any of the protected directories.
 */
export function shouldProtectPath(
	targetPath: string,
	protectedDirs: string[],
): boolean {
	const path = require("node:path") as typeof import("node:path");
	const norm = (p: string) => path.resolve(p).replace(/\\/g, "/").toLowerCase();
	const target = norm(targetPath);
	for (const dir of protectedDirs) {
		if (!dir) continue;
		const base = norm(dir);
		// Protect if target is the protected dir itself, a descendant, or an ancestor
		if (target === base) return true;
		if (target.startsWith(`${base}/`)) return true; // target is inside protected dir
		if (base.startsWith(`${target}/`)) return true; // target is an ancestor of protected dir
	}
	return false;
}
