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
