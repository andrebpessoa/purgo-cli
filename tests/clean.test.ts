import { describe, test, expect, mock, beforeEach } from "bun:test";

const rmMock = mock(async () => {});
const globMock = mock(async (_patterns: string[], _opts: any) => {
  return [
    "node_modules",
    "dist",
  ];
});
const getFolderSizeMock = mock(async (_p: string) => 1024 * 1024); // 1 MB per target
const promptsMock = mock(async (_q: any) => ({ confirm: true }));
const execaMock = mock(async (_cmd: string, _args: string[], _opts: any) => ({ stdout: "", stderr: "", exitCode: 0 }));

const oraMock = () => ({ start: () => ({ stop: () => {}, succeed: () => {}, fail: () => {}, text: "" }) });
const chalkMock = new Proxy({}, { get: () => (v: any) => String(v) });
const boxenMock = (s: string) => s;
const prettyBytesMock = (n: number) => `${n} B`;

mock.module("node:fs/promises", () => ({ rm: rmMock }));
mock.module("glob", () => ({ glob: globMock }));
mock.module("prompts", () => ({ default: promptsMock }));
mock.module("execa", () => ({ execa: execaMock }));
mock.module("get-folder-size", () => ({ default: getFolderSizeMock }));
mock.module("ora", () => ({ default: oraMock }));
mock.module("chalk", () => ({ default: chalkMock }));
mock.module("boxen", () => ({ default: boxenMock }));
mock.module("pretty-bytes", () => ({ default: prettyBytesMock }));

const importIndex = async (suffix: string = String(Math.random())) => await import(`../src/index?${suffix}`);

beforeEach(() => {
  rmMock.mockReset();
  globMock.mockReset();
  getFolderSizeMock.mockReset();
  promptsMock.mockReset();
  execaMock.mockReset();
});

describe("cleanProject", () => {
  test("dry-run does not delete files and does not ask for confirmation", async () => {
    const { cleanProject } = await importIndex("dry");

    globMock.mockImplementationOnce(async () => ["node_modules", "dist"]);
    getFolderSizeMock.mockImplementation(async () => 1024);

    await cleanProject({ rootDir: process.cwd(), dryRun: true, reinstall: false });

    expect(globMock).toHaveBeenCalled();
    expect(getFolderSizeMock).toHaveBeenCalled();
    expect(rmMock).toHaveBeenCalledTimes(0);
    expect(promptsMock).toHaveBeenCalledTimes(0);
    expect(execaMock).toHaveBeenCalledTimes(0);
  });

  test("reinstall runs bun install after successful cleanup", async () => {
    const { cleanProject } = await importIndex("reinstall");

    globMock.mockImplementationOnce(async () => ["node_modules", "dist"]);
    getFolderSizeMock.mockImplementation(async () => 2048);
    promptsMock.mockImplementationOnce(async () => ({ confirm: true }));

    await cleanProject({ rootDir: process.cwd(), dryRun: false, reinstall: true });

    expect(rmMock.mock.calls.length).toBe(2);
    expect(promptsMock).toHaveBeenCalledTimes(1);
    expect(execaMock).toHaveBeenCalled();
    const firstCall = execaMock.mock.calls[0];
    expect(firstCall && firstCall[0]).toBe("bun");
    expect(firstCall && Array.isArray(firstCall[1])).toBe(true);
  });

  test("returns early when no targets are found", async () => {
    const { cleanProject } = await importIndex("none");

    globMock.mockImplementationOnce(async () => []);

    await cleanProject({ rootDir: process.cwd(), dryRun: false, reinstall: true });

    expect(rmMock).toHaveBeenCalledTimes(0);
    expect(promptsMock).toHaveBeenCalledTimes(0);
    expect(execaMock).toHaveBeenCalledTimes(0);
  });

  test("user cancellation does not delete or reinstall", async () => {
    const { cleanProject } = await importIndex("cancel");

    globMock.mockImplementationOnce(async () => ["node_modules"]);
    getFolderSizeMock.mockImplementation(async () => 1000);
    promptsMock.mockImplementationOnce(async () => ({ confirm: false }));

    await cleanProject({ rootDir: process.cwd(), dryRun: false, reinstall: true });

    expect(rmMock).toHaveBeenCalledTimes(0);
    expect(execaMock).toHaveBeenCalledTimes(0);
  });

  test("deduplicates paths keeping only top directories", async () => {
    const { cleanProject } = await importIndex("dedup");

    globMock.mockImplementationOnce(async () => [
      "a",
      "a/b",
      "a/b/c",
      "x",
      "x/y",
    ]);
    getFolderSizeMock.mockImplementation(async () => 1);
    promptsMock.mockImplementationOnce(async () => ({ confirm: true }));

    await cleanProject({ rootDir: process.cwd(), dryRun: false, reinstall: false });

    expect(rmMock.mock.calls.length).toBe(2);
  });

  test("toBytes handles number, bigint, objects and fallback", async () => {
    const { cleanProject } = await importIndex("bytes");

    globMock.mockImplementationOnce(async () => [
      "n",
      "bi",
      "size",
      "bytes",
      "raw",
      "valueOf",
      "fallback",
    ]);

    const sizes: Record<string, any> = {
      n: 100,
      bi: BigInt(200),
      size: { size: 300 },
      bytes: { bytes: 400 },
      raw: { raw: 500 },
      valueOf: { valueOf: () => 600 },
      fallback: { unknown: true },
    };

    getFolderSizeMock.mockImplementation(async (p: string) => {
      const key = p.split(/\\|\//).pop() as string;
      return sizes[key];
    });

    promptsMock.mockImplementationOnce(async () => ({ confirm: true }));

    await cleanProject({ rootDir: process.cwd(), dryRun: false, reinstall: false });

    expect(rmMock.mock.calls.length).toBe(7);
  });

  test("delete errors increment errorCount and prevent full success", async () => {
    const { cleanProject } = await importIndex("errors");

    globMock.mockImplementationOnce(async () => ["ok", "fail"]);
    getFolderSizeMock.mockImplementation(async () => 1);
    promptsMock.mockImplementationOnce(async () => ({ confirm: true }));

    let call = 0;
    rmMock.mockImplementation(async () => {
      call++;
      if (call === 2) throw new Error("boom");
    });

    await cleanProject({ rootDir: process.cwd(), dryRun: false, reinstall: false });

    expect(rmMock.mock.calls.length).toBe(2);
    expect(execaMock).not.toHaveBeenCalled();
  });

  test("reinstall=true does not run when there were deletion errors", async () => {
    const { cleanProject } = await importIndex("block");

    globMock.mockImplementationOnce(async () => ["ok", "fail"]);
    getFolderSizeMock.mockImplementation(async () => 1);
    promptsMock.mockImplementationOnce(async () => ({ confirm: true }));

    let call = 0;
    rmMock.mockImplementation(async () => {
      call++;
      if (call === 2) throw new Error("boom");
    });

    await cleanProject({ rootDir: process.cwd(), dryRun: false, reinstall: true });

    expect(execaMock).toHaveBeenCalledTimes(0);
  });

  test("targets precedence: CLI prevails over config and default", async () => {
    mock.module("../src/config", () => ({
      loadConfig: mock(async () => ({ config: { targets: ["from-config"], ignore: ["**/build"] } })),
    }));

    const { cleanProject } = await importIndex("precedence");

    const targetsCli = ["cli-one", "cli-two"];
    globMock.mockImplementationOnce(async (patterns: string[]) => {
      expect(patterns).toEqual(targetsCli.map(t => `**/${t}`));
      return [];
    });

    await cleanProject({ rootDir: process.cwd(), dryRun: true, targets: targetsCli });
  });

  test("ignore merge includes fixed rule and config ones", async () => {
    mock.module("../src/config", () => ({
      loadConfig: mock(async () => ({ config: { ignore: ["**/build", "**/.cache"] } })),
    }));

    const { cleanProject } = await importIndex("ignore");

    globMock.mockImplementationOnce(async (_patterns: string[], opts: any) => {
      expect(Array.isArray(opts.ignore)).toBe(true);
      expect(opts.ignore).toContain("**/node_modules/**/node_modules");
      expect(opts.ignore).toContain("**/build");
      expect(opts.ignore).toContain("**/.cache");
      return [];
    });

    await cleanProject({ rootDir: process.cwd(), dryRun: true });
  });
});


