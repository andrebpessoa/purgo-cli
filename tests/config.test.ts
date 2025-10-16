import { describe, test, expect, mock, beforeEach } from "bun:test";

type CosmiconfigResult = { config: any; filepath?: string; isEmpty?: boolean } | null;

const existsSyncMock = mock((p: string) => true);

const searchMap = new Map<string, CosmiconfigResult>();
const loadMap = new Map<string, CosmiconfigResult>();

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^[A-Za-z]:/, "");
const cosmiconfigMockFactory = (_ns: string) => ({
  search: async (cwd: string) => searchMap.get(norm(cwd)) ?? null,
  load: async (fp: string) => loadMap.get(norm(fp)) ?? null,
});

mock.module("node:fs", () => ({ existsSync: existsSyncMock }));
mock.module("cosmiconfig", () => ({ cosmiconfig: cosmiconfigMockFactory }));

const cacheMock = {
  get: mock(() => null),
  set: mock(() => {}),
  clear: mock(() => {}),
};
mock.module("../src/cache", () => ({ configCache: cacheMock }));

const importConfig = async (suffix: string = String(Math.random())) => await import(`../src/config?${suffix}`);

beforeEach(() => {
  existsSyncMock.mockReset();
  searchMap.clear();
  loadMap.clear();
  cacheMock.get.mockClear();
  cacheMock.set.mockClear();
  cacheMock.clear.mockClear();
  cacheMock.get.mockImplementation(() => null);
});

describe("loadConfig", () => {
  test("merges global + workspace + package.json with extends", async () => {
    const { loadConfig } = await importConfig("merge");

    const projectRoot = "/proj";
    const globalPath = "/home/.config/purgo/config.json";

    existsSyncMock.mockImplementation((p: string) => p === globalPath || p.endsWith("extends-a.json") || p.endsWith("extends-b.json"));

    loadMap.set(globalPath, {
      config: {
        targets: [".next"],
        ignore: ["**/vendor"],
        extends: ["extends-a.json"],
      },
      filepath: globalPath,
    });

    loadMap.set("/home/.config/purgo/extends-a.json", {
      config: {
        ignore: ["**/.cache"],
        extends: ["extends-b.json"],
      },
      filepath: "/home/.config/purgo/extends-a.json",
    });

    loadMap.set("/home/.config/purgo/extends-b.json", {
      config: {
        targets: ["dist"],
      },
      filepath: "/home/.config/purgo/extends-b.json",
    });

    searchMap.set(projectRoot, {
      config: {
        ignore: ["**/build"],
      },
      filepath: `${projectRoot}/.purgo.json`,
    });

    loadMap.set(`${projectRoot}/package.json`, {
      config: {
        targets: ["coverage"],
      },
      filepath: `${projectRoot}/package.json`,
    } as any);

    const loaded = await loadConfig({ projectRoot, globalConfigPath: globalPath });

    expect(Array.isArray(loaded.config.targets) || typeof loaded.config.targets === "undefined").toBe(true);
    expect(Array.isArray(loaded.config.ignore) || typeof loaded.config.ignore === "undefined").toBe(true);

    expect(loaded.config.targets).toEqual(["coverage"]);

    expect(loaded.config.ignore).toEqual(["**/build"]);
  });

  test("validates schema and throws error when invalid", async () => {
    const { loadConfig } = await importConfig("invalid");
    const projectRoot = "/proj";

    searchMap.set(projectRoot, {
      config: {
        targets: 123,
      },
      filepath: `${projectRoot}/.purgo.json`,
    } as any);

    await expect(loadConfig({ projectRoot })).rejects.toThrow();
  });

  test("ignores global when path does not exist", async () => {
    const { loadConfig } = await importConfig("absent");
    const projectRoot = "/proj";
    const globalPath = "/absent/config.json";

    existsSyncMock.mockImplementation(() => false);

    const loaded = await loadConfig({ projectRoot, globalConfigPath: globalPath });
    expect(loaded.config).toEqual({});
    expect(loaded.filepath).toBeUndefined();
  });

  test("returns empty config when no workspace and no package.json", async () => {
    const { loadConfig } = await importConfig("empty");
    const projectRoot = "/empty";

    existsSyncMock.mockImplementation(() => false);

    const loaded = await loadConfig({ projectRoot });
    expect(loaded.config).toEqual({});
  });

  test("detects cycle in extends and throws error", async () => {
    const { loadConfig } = await importConfig("cycle");
    const projectRoot = "/proj";
    const globalPath = "/home/.config/purgo/config.json";

    existsSyncMock.mockImplementation((p: string) => true);

    loadMap.set(globalPath, { config: { extends: ["a.json"] }, filepath: globalPath });
    loadMap.set("/home/.config/purgo/a.json", { config: { extends: ["b.json"] }, filepath: "/home/.config/purgo/a.json" });
    loadMap.set("/home/.config/purgo/b.json", { config: { extends: ["a.json"] }, filepath: "/home/.config/purgo/b.json" });

    await expect(loadConfig({ projectRoot, globalConfigPath: globalPath })).rejects.toThrow(/cycle/i);
  });

  test("extends points to nonexistent file and throws error", async () => {
    const { loadConfig } = await importConfig("missing");
    const projectRoot = "/proj";
    const globalPath = "/home/.config/purgo/config.json";

    existsSyncMock.mockImplementation((p: string) => p === globalPath);
    loadMap.set(globalPath, { config: { extends: ["missing.json"] }, filepath: globalPath });

    await expect(loadConfig({ projectRoot, globalConfigPath: globalPath })).rejects.toThrow(/not found/i);
  });

  test("extends invalid by schema throws error", async () => {
    const { loadConfig } = await importConfig("bad");
    const projectRoot = "/proj";
    const globalPath = "/home/.config/purgo/config.json";

    existsSyncMock.mockImplementation((p: string) => true);
    loadMap.set(globalPath, { config: { extends: ["bad.json"] }, filepath: globalPath });
    loadMap.set("/home/.config/purgo/bad.json", { config: { targets: 123 }, filepath: "/home/.config/purgo/bad.json" } as any);

    await expect(loadConfig({ projectRoot, globalConfigPath: globalPath })).rejects.toThrow(/Invalid extends/i);
  });

  test("resolves relative extends path correctly", async () => {
    const { loadConfig } = await importConfig("rel");
    const projectRoot = "/proj";
    const globalPath = "/home/.config/purgo/config.json";

    existsSyncMock.mockImplementation((p: string) => true);
    loadMap.set(globalPath, { config: { extends: ["../shared/rel.json"] }, filepath: globalPath });
    loadMap.set("/home/.config/shared/rel.json", { config: { targets: ["rel"] }, filepath: "/home/.config/shared/rel.json" });

    const loaded = await loadConfig({ projectRoot, globalConfigPath: globalPath });
    expect(loaded.config.targets).toEqual(["rel"]);
  });

  test("hooks makes deep merge preserving unoverridden values", async () => {
    const { loadConfig } = await importConfig("hooks");
    const projectRoot = "/proj";
    const globalPath = "/home/.config/purgo/config.json";

    existsSyncMock.mockImplementation((p: string) => true);
    loadMap.set(globalPath, { config: { hooks: { preClean: "global-pre", postClean: "global-post" } }, filepath: globalPath });
    searchMap.set(projectRoot, { config: { hooks: { preClean: "workspace-pre" } }, filepath: `${projectRoot}/.purgo.json` });

    const loaded = await loadConfig({ projectRoot, globalConfigPath: globalPath });
    expect(loaded.config.hooks?.preClean).toBe("workspace-pre");
    expect(loaded.config.hooks?.postClean).toBe("global-post");
  });

  test("confirms merge order global -> workspace -> package.json", async () => {
    const { loadConfig } = await importConfig("order");
    const projectRoot = "/proj";
    const globalPath = "/home/.config/purgo/config.json";

    existsSyncMock.mockImplementation((p: string) => true);
    loadMap.set(globalPath, { config: { targets: ["g"], ignore: ["ig-g"] }, filepath: globalPath });
    searchMap.set(projectRoot, { config: { targets: ["w"], ignore: ["ig-w"] }, filepath: `${projectRoot}/.purgo.json` });
    loadMap.set(`${projectRoot}/package.json`, { config: { targets: ["p"] }, filepath: `${projectRoot}/package.json` } as any);

    const loaded = await loadConfig({ projectRoot, globalConfigPath: globalPath });
    expect(loaded.config.targets).toEqual(["p"]);
    expect(loaded.config.ignore).toEqual(["ig-w"]);
  });
});


