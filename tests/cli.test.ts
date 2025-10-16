import { describe, test, expect, mock, beforeEach } from "bun:test";

const cleanProjectMock = mock(async (_opts: any) => {});
mock.module("../src/index", () => ({ cleanProject: cleanProjectMock }));

const exitOrig = process.exit;
let exitCalledWith: number | null = null;

beforeEach(() => {
  cleanProjectMock.mockReset();
  exitCalledWith = null;
  // @ts-ignore
  process.exit = (code?: number) => {
    exitCalledWith = (code as number) ?? 0;
    return undefined as any;
  };
});

const importCli = async (suffix: string) => await import(`../src/cli?${suffix}`);

describe("CLI clean command", () => {
  test("maps flags correctly to cleanProject", async () => {
    const argv = [
      "node",
      "purgo",
      "clean",
      "--dry-run",
      "--path",
      "/proj",
      "--reinstall",
      "--targets",
      "node_modules,dist ",
      "--config",
      "/cfg.json",
    ];

    const oldArgv = process.argv;
    process.argv = argv as any;

    await importCli("mapping");

    expect(cleanProjectMock).toHaveBeenCalled();
    const call = cleanProjectMock.mock.calls[0];
    expect(call).toBeTruthy();
    const opts = call && call[0];
    expect(opts.dryRun).toBe(true);
    expect(opts.rootDir).toBe("/proj");
    expect(opts.reinstall).toBe(true);
    expect(opts.configPath).toBe("/cfg.json");
    expect(opts.targets).toEqual(["node_modules", "dist"]);

    process.argv = oldArgv;
  });

  test("on action error, exits with exit(1)", async () => {
    cleanProjectMock.mockImplementationOnce(async () => { throw new Error("boom"); });
    await importCli("error");
    expect(exitCalledWith).toBe(1);
  });
});

process.exit = exitOrig;
