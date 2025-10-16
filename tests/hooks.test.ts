import { beforeEach, describe, expect, mock, test } from "bun:test";

const execaMock = mock(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
mock.module("execa", () => ({ execa: execaMock }));

const chalkMock = new Proxy({} as object, {
	get: () => (v: unknown) => String(v),
});
mock.module("chalk", () => ({ default: chalkMock }));

let mockPlatform = "linux";
mock.module("node:os", () => ({
	platform: () => mockPlatform,
}));

let consoleOutput: string[] = [];
const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
	consoleOutput = [];
	console.log = mock((...args: unknown[]) => {
		consoleOutput.push(args.join(" "));
	});
	console.error = mock((...args: unknown[]) => {
		consoleOutput.push(`ERROR: ${args.join(" ")}`);
	});
	execaMock.mockClear();
	mockPlatform = "linux";
});

const importHooks = async (suffix: string = String(Math.random())) =>
	await import(`../src/hooks?${suffix}`);

describe("executeHook", () => {
	test("does nothing when hookCommand is undefined", async () => {
		const { executeHook } = await importHooks();

		await executeHook(undefined, "test", "/project");

		expect(execaMock).not.toHaveBeenCalled();
	});

	test("executes command on Unix with sh -c", async () => {
		mockPlatform = "linux";
		const { executeHook } = await importHooks("unix");

		await executeHook("echo test", "preClean", "/project");

		expect(execaMock).toHaveBeenCalled();
		const calls = execaMock.mock.calls as unknown as Array<unknown[]>;
		expect(calls[0]?.[0]).toBe("sh");
		expect(calls[0]?.[1]).toEqual(["-c", "echo test"]);
	});

	test("executes command on Windows with cmd /c", async () => {
		mockPlatform = "win32";
		const { executeHook } = await importHooks("win");

		await executeHook("echo test", "postClean", "/project");

		expect(execaMock).toHaveBeenCalled();
		const calls = execaMock.mock.calls as unknown as Array<unknown[]>;
		expect(calls[0]?.[0]).toBe("cmd");
		expect(calls[0]?.[1]).toEqual(["/c", "echo test"]);
	});

	test("passes correct cwd to execa", async () => {
		const { executeHook } = await importHooks("cwd");

		await executeHook("echo test", "preClean", "/my/project");

		expect(execaMock).toHaveBeenCalled();
		const calls = execaMock.mock.calls as unknown as Array<unknown[]>;
		expect(calls[0]?.[2]).toEqual({ cwd: "/my/project", stdio: "inherit" });
	});

	test("logs hook start", async () => {
		const { executeHook } = await importHooks("log-start");

		await executeHook("npm run test", "preClean", "/project");

		expect(consoleOutput.some((line) => line.includes("preClean"))).toBe(true);
		expect(consoleOutput.some((line) => line.includes("npm run test"))).toBe(
			true,
		);
	});

	test("logs success when exitCode is 0", async () => {
		execaMock.mockImplementationOnce(async () => ({
			exitCode: 0,
			stdout: "",
			stderr: "",
		}));
		const { executeHook } = await importHooks("success");

		await executeHook("echo success", "postClean", "/project");

		expect(consoleOutput.some((line) => line.includes("completed"))).toBe(true);
	});

	test("throws error when command fails", async () => {
		execaMock.mockImplementationOnce(async () => {
			throw new Error("Command failed");
		});
		const { executeHook } = await importHooks("fail");

		await expect(
			executeHook("invalid-command", "preClean", "/project"),
		).rejects.toThrow();
	});

	test("logs error when command fails", async () => {
		execaMock.mockImplementationOnce(async () => {
			throw new Error("Command failed");
		});
		const { executeHook } = await importHooks("fail-log");

		try {
			await executeHook("invalid-command", "postClean", "/project");
		} catch (_e) {}

		expect(consoleOutput.some((line) => line.includes("ERROR:"))).toBe(true);
		expect(consoleOutput.some((line) => line.includes("failed"))).toBe(true);
	});

	test("uses stdio inherit to show command output", async () => {
		const { executeHook } = await importHooks("stdio");

		await executeHook("echo output", "preClean", "/project");

		const calls = execaMock.mock.calls as unknown as Array<unknown[]>;
		const third = (calls[0]?.[2] ?? {}) as { stdio?: string };
		expect(third.stdio).toBe("inherit");
	});

	test("detects Darwin (macOS) as Unix", async () => {
		mockPlatform = "darwin";
		const { executeHook } = await importHooks("mac");

		await executeHook("echo mac", "preClean", "/project");

		const calls = execaMock.mock.calls as unknown as Array<unknown[]>;
		expect(calls[0]?.[0]).toBe("sh");
	});
});

console.log = originalLog;
console.error = originalError;
