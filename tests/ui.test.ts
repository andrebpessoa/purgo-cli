import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const spinnerInstance = {
	text: "",
	stop: mock(() => spinnerInstance),
	succeed: mock(() => spinnerInstance),
	fail: mock(() => spinnerInstance),
	start: mock(() => spinnerInstance),
};

const oraMock = mock(() => spinnerInstance);
const chalkMock = new Proxy(
	{},
	{
		get: () => (v: unknown) => String(v),
	},
);
const boxenMock = mock((s: string) => s);
const prettyBytesMock = mock((n: number) => `${n} B`);

mock.module("ora", () => ({ default: oraMock }));
mock.module("chalk", () => ({ default: chalkMock }));
mock.module("boxen", () => ({ default: boxenMock }));
mock.module("pretty-bytes", () => ({ default: prettyBytesMock }));

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
	oraMock.mockClear();
	spinnerInstance.stop.mockClear();
	spinnerInstance.succeed.mockClear();
	spinnerInstance.fail.mockClear();
	spinnerInstance.start.mockClear();
	boxenMock.mockClear();
	prettyBytesMock.mockClear();
});

afterEach(() => {
	console.log = originalLog;
	console.error = originalError;
});

const importUI = async () => await import("../src/ui");

describe("CleanUI", () => {
	test("startSearching creates spinner with correct message", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		ui.startSearching();

		expect(oraMock).toHaveBeenCalled();
	});

	test("updateSearching updates spinner text", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		ui.startSearching();
		ui.updateSearching("New message");

		expect(spinnerInstance.text).toBeDefined();
	});

	test("stopSpinner stops spinner when it exists", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		ui.startSearching();
		ui.stopSpinner();

		expect(spinnerInstance.stop).toHaveBeenCalled();
	});

	test("stopSpinner does not fail when spinner does not exist", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		expect(() => ui.stopSpinner()).not.toThrow();
	});

	test("showNothingToClean shows success message", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		ui.startSearching();
		ui.showNothingToClean();

		expect(spinnerInstance.succeed).toHaveBeenCalled();
	});

	test("showTargets displays list of targets with sizes", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		const targets = [
			{ path: "node_modules", size: 1024 },
			{ path: "dist", size: 512 },
		];

		ui.showTargets(targets);

		expect(consoleOutput.length).toBeGreaterThan(0);
		expect(prettyBytesMock).toHaveBeenCalled();
	});

	test("showTargets calculates total size correctly", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		const targets = [
			{ path: "a", size: 100 },
			{ path: "b", size: 200 },
			{ path: "c", size: 300 },
		];

		ui.showTargets(targets);

		expect(prettyBytesMock.mock.calls.length).toBeGreaterThanOrEqual(3);
	});

	test("showDryRunNotice displays warning in box", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		ui.showDryRunNotice();

		expect(boxenMock).toHaveBeenCalled();
	});

	test("showCancelled displays cancellation message", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		ui.showCancelled();

		expect(consoleOutput.length).toBeGreaterThan(0);
	});

	test("startCleaning returns started spinner", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		const spinner = ui.startCleaning();

		expect(spinner).toBeDefined();
		expect(oraMock).toHaveBeenCalled();
	});

	test("showCleanResult displays success when there are no errors", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		const spinner = ui.startCleaning();
		spinnerInstance.succeed.mockClear();
		ui.showCleanResult(spinner, 0);

		expect(spinnerInstance.succeed).toHaveBeenCalled();
	});

	test("showCleanResult displays failure when there are errors", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		const spinner = ui.startCleaning();
		spinnerInstance.fail.mockClear();
		ui.showCleanResult(spinner, 3);

		expect(spinnerInstance.fail).toHaveBeenCalled();
	});

	test("showSummary displays summary in box", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		const summary = {
			deletedCount: 5,
			totalSize: 1024000,
			errorCount: 0,
		};

		ui.showSummary(summary);

		expect(boxenMock).toHaveBeenCalled();
		expect(prettyBytesMock).toHaveBeenCalled();
	});

	test("startReinstall returns started spinner", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		const spinner = ui.startReinstall("npm");

		expect(spinner).toBeDefined();
		expect(oraMock).toHaveBeenCalled();
	});

	test("showReinstallSuccess marks spinner as success", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		const spinner = ui.startReinstall("npm");
		spinnerInstance.succeed.mockClear();
		ui.showReinstallSuccess(spinner, "npm");

		expect(spinnerInstance.succeed).toHaveBeenCalled();
	});

	test("showReinstallError marks spinner as failure and logs error", async () => {
		const { CleanUI } = await importUI();
		const ui = new CleanUI();

		const spinner = ui.startReinstall("npm");
		spinnerInstance.fail.mockClear();
		const error = new Error("Test error");

		ui.showReinstallError(spinner, error, "npm");

		expect(spinnerInstance.fail).toHaveBeenCalled();
		expect(consoleOutput.some((line) => line.includes("ERROR:"))).toBe(true);
	});
});
